package org.apollo.agcdsky;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.ConnectivityManager;
import android.net.Network;
import android.os.SystemClock;
import android.util.Log;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

/** Process-local network-time correction for DSKY presentation time. No SET_TIME permission is used. */
public final class NtpTime {
    public static final String SERVER = "time.cloudflare.com";
    private static final String TAG = "AgcDskyNtp";
    private static final String PREFS = "ntp_time";
    private static final String OFFSET = "offset_ms";
    private static final String SYNC_UTC = "sync_utc_ms";
    private static final String SYNC_ELAPSED = "sync_elapsed_ms";
    private static final String RTT = "rtt_ms";
    private static final String LAST_ATTEMPT_UTC = "last_attempt_utc_ms";
    private static final String LAST_ATTEMPT_RESULT = "last_attempt_result";
    private static final String LAST_ATTEMPT_REASON = "last_attempt_reason";
    private static final String LAST_ERROR = "last_error";
    private static final long STALE_AFTER_MS = TimeUnit.HOURS.toMillis(2);
    private static final long PERIOD_MS = TimeUnit.HOURS.toMillis(1);
    private static final int SAMPLES = 3;
    private static final int TIMEOUT_MS = 3_000;
    private static final ScheduledExecutorService SCHEDULER = Executors.newSingleThreadScheduledExecutor();
    private static final ExecutorService WORKER = Executors.newSingleThreadExecutor();
    private static final AtomicBoolean STARTED = new AtomicBoolean();
    private static final AtomicBoolean IN_FLIGHT = new AtomicBoolean();
    private static final CopyOnWriteArrayList<Listener> LISTENERS = new CopyOnWriteArrayList<>();

    public interface Listener { void onNtpStatusChanged(Status status); }

    public static final class Status {
        public final long offsetMs, lastSyncUtcMs, roundTripMs, ageMs, lastAttemptUtcMs;
        public final String state, source, lastAttemptResult, lastAttemptReason, lastError;
        public final boolean usingNetworkTime, syncInFlight;
        Status(long offsetMs,long lastSyncUtcMs,long roundTripMs,long ageMs,String state,long lastAttemptUtcMs,
               String lastAttemptResult,String lastAttemptReason,String lastError,boolean syncInFlight) {
            this.offsetMs=offsetMs;this.lastSyncUtcMs=lastSyncUtcMs;this.roundTripMs=roundTripMs;this.ageMs=ageMs;this.state=state;
            this.lastAttemptUtcMs=lastAttemptUtcMs;this.lastAttemptResult=lastAttemptResult;this.lastAttemptReason=lastAttemptReason;this.lastError=lastError;
            this.syncInFlight=syncInFlight;this.usingNetworkTime="synced".equals(state);this.source=this.usingNetworkTime?"sntp":"system";
        }
        public String toJson() {
            try {
                JSONObject value=new JSONObject();
                value.put("server",SERVER);value.put("source",source);value.put("usingNetworkTime",usingNetworkTime);
                value.put("offsetMs",offsetMs);value.put("lastSyncUtcMs",lastSyncUtcMs);value.put("roundTripMs",roundTripMs);
                value.put("ageMs",ageMs);value.put("state",state);value.put("syncInFlight",syncInFlight);
                value.put("lastAttemptUtcMs",lastAttemptUtcMs);value.put("lastAttemptResult",lastAttemptResult);
                value.put("lastAttemptReason",lastAttemptReason);value.put("lastError",lastError);
                return value.toString();
            } catch (Exception ignored) { return "{\"state\":\"unavailable\",\"source\":\"system\",\"usingNetworkTime\":false}"; }
        }
    }

    private NtpTime() {}

    public static void start(Context context) {
        Context app=context.getApplicationContext();
        if(!STARTED.compareAndSet(false,true))return;
        registerConnectivity(app);
        requestSync(app,"startup");
        SCHEDULER.scheduleAtFixedRate(()->requestSync(app,"periodic"),PERIOD_MS,PERIOD_MS,TimeUnit.MILLISECONDS);
    }

    public static void addListener(Listener listener){if(listener!=null)LISTENERS.addIfAbsent(listener);}
    public static void removeListener(Listener listener){LISTENERS.remove(listener);}
    public static Status status(Context context){return readStatus(context.getApplicationContext());}
    public static long accurateNow(Context context){Status status=readStatus(context.getApplicationContext());return System.currentTimeMillis()+(status.usingNetworkTime?status.offsetMs:0L);}
    public static boolean requestSyncNow(Context context){Context app=context.getApplicationContext();start(app);return requestSync(app,"manual");}

    private static void registerConnectivity(Context context){
        ConnectivityManager manager=context.getSystemService(ConnectivityManager.class);
        if(manager==null)return;
        try{
            manager.registerDefaultNetworkCallback(new ConnectivityManager.NetworkCallback(){
                @Override public void onAvailable(Network network){requestSync(context,"network available");}
            });
        }catch(RuntimeException error){Log.w(TAG,"network callback unavailable",error);}
    }

    private static boolean requestSync(Context context,String reason){
        if(!IN_FLIGHT.compareAndSet(false,true))return false;
        recordAttempt(context,reason,"syncing","");
        notifyListeners(readStatus(context));
        WORKER.execute(()->{
            try{synchronize(context,reason);}
            finally{IN_FLIGHT.set(false);notifyListeners(readStatus(context));}
        });
        return true;
    }

    private static void synchronize(Context context,String reason){
        List<SntpClient.Sample> samples=new ArrayList<>();
        String lastFailure="";
        for(int i=0;i<SAMPLES;i++){
            try{samples.add(SntpClient.query(SERVER,TIMEOUT_MS));}
            catch(Exception error){
                lastFailure=error.getClass().getSimpleName()+(error.getMessage()==null?"":": "+error.getMessage());
                Log.w(TAG,"SNTP sample failed: "+reason+" #"+(i+1),error);
            }
        }
        if(samples.isEmpty()){
            recordAttempt(context,reason,"failed",lastFailure.isEmpty()?"No valid SNTP response":lastFailure);
            return;
        }
        List<Long> offsets=new ArrayList<>();
        for(SntpClient.Sample sample:samples)offsets.add(sample.offsetMs);
        Collections.sort(offsets);
        long median=offsets.get(offsets.size()/2);
        List<SntpClient.Sample> accepted=new ArrayList<>();
        for(SntpClient.Sample sample:samples)if(Math.abs(sample.offsetMs-median)<=2_000L)accepted.add(sample);
        if(accepted.isEmpty()){
            Log.w(TAG,"SNTP samples rejected as outliers");
            recordAttempt(context,reason,"failed","SNTP samples rejected as outliers");
            return;
        }
        accepted.sort(Comparator.comparingLong(value->value.roundTripMs));
        SntpClient.Sample best=accepted.get(0);
        long offset=medianOfOffsets(accepted);
        long syncUtc=System.currentTimeMillis()+offset;
        SharedPreferences.Editor edit=context.getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit();
        edit.putLong(OFFSET,offset).putLong(SYNC_UTC,syncUtc).putLong(SYNC_ELAPSED,SystemClock.elapsedRealtime()).putLong(RTT,best.roundTripMs)
                .putLong(LAST_ATTEMPT_UTC,System.currentTimeMillis()).putString(LAST_ATTEMPT_RESULT,"success")
                .putString(LAST_ATTEMPT_REASON,reason).putString(LAST_ERROR,"").apply();
        Log.i(TAG,"SNTP synchronized via "+SERVER+" offset="+offset+"ms rtt="+best.roundTripMs+"ms samples="+accepted.size());
    }

    private static void recordAttempt(Context context,String reason,String result,String error){
        context.getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit()
                .putLong(LAST_ATTEMPT_UTC,System.currentTimeMillis())
                .putString(LAST_ATTEMPT_RESULT,result)
                .putString(LAST_ATTEMPT_REASON,reason==null?"":reason)
                .putString(LAST_ERROR,error==null?"":error)
                .apply();
    }

    private static long medianOfOffsets(List<SntpClient.Sample> samples){
        List<Long> offsets=new ArrayList<>();for(SntpClient.Sample sample:samples)offsets.add(sample.offsetMs);
        Collections.sort(offsets);return offsets.get(offsets.size()/2);
    }

    private static Status readStatus(Context context){
        SharedPreferences prefs=context.getSharedPreferences(PREFS,Context.MODE_PRIVATE);
        long syncUtc=prefs.getLong(SYNC_UTC,0L);
        long offset=prefs.getLong(OFFSET,0L);
        long elapsedAtSync=prefs.getLong(SYNC_ELAPSED,0L);
        long age=syncUtc==0L?-1L:Math.max(0L,elapsedAtSync>0L&&SystemClock.elapsedRealtime()>=elapsedAtSync
                ?SystemClock.elapsedRealtime()-elapsedAtSync:System.currentTimeMillis()+offset-syncUtc);
        String state=syncUtc==0L?"unavailable":age>STALE_AFTER_MS?"stale":"synced";
        return new Status(offset,syncUtc,prefs.getLong(RTT,-1L),age,state,prefs.getLong(LAST_ATTEMPT_UTC,0L),
                prefs.getString(LAST_ATTEMPT_RESULT,"never"),prefs.getString(LAST_ATTEMPT_REASON,""),
                prefs.getString(LAST_ERROR,""),IN_FLIGHT.get());
    }

    private static void notifyListeners(Status status){for(Listener listener:LISTENERS)listener.onNtpStatusChanged(status);}
}
