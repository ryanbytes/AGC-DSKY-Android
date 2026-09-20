package org.apollo.agcdsky;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.Typeface;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.TypedValue;
import android.util.LruCache;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.Locale;

public final class ElWidgetProvider extends AppWidgetProvider {
    private static final String ACTION_TICK="org.apollo.agcdsky.EL_WIDGET_TICK";
    private static final long MINUTE_MS=60_000L;
    private static final int TICK_REQUEST_CODE=21;
    private static final String PREFS="el_widget_state_v2",PREF_MODE="mode",PREF_LIVE="live_snapshot";
    private static final String MODE_CLOCK="clock",MODE_LIVE="live";
    private static final long LIVE_REFRESH_MIN_MS=120L;
    private static final Handler MAIN_HANDLER=new Handler(Looper.getMainLooper());
    private static final Object LIVE_REFRESH_LOCK=new Object();
    private static boolean liveRefreshPending;
    private static long lastLiveRefreshElapsed;
    private static Context liveRefreshContext;

    // MIT/IL SCD 1006315G sheet 2: the active EL face is 2.360 x 4.060 in
    // inside a 2.620 x 4.420-in hardware frame.  Nominal frame insets are
    // .130 in per side and .180 in top/bottom.
    private static final float U=106f/2.360f;
    private static final float ACTIVE_W=106f,ACTIVE_H=4.060f*U;
    private static final float ACTIVE_X=.130f*U,ACTIVE_Y=.180f*U;
    private static final float PANEL_W=2.620f*U,PANEL_H=4.420f*U;
    private static final float R1_Y=84.441f,R2_Y=118.576f,R3_Y=152.712f;
    private static final float FRAME_H=23f;

    private static final int[] SECOND_DRAWABLES={
      R.drawable.el_sec_00,R.drawable.el_sec_01,R.drawable.el_sec_02,R.drawable.el_sec_03,R.drawable.el_sec_04,
      R.drawable.el_sec_05,R.drawable.el_sec_06,R.drawable.el_sec_07,R.drawable.el_sec_08,R.drawable.el_sec_09,
      R.drawable.el_sec_10,R.drawable.el_sec_11,R.drawable.el_sec_12,R.drawable.el_sec_13,R.drawable.el_sec_14,
      R.drawable.el_sec_15,R.drawable.el_sec_16,R.drawable.el_sec_17,R.drawable.el_sec_18,R.drawable.el_sec_19,
      R.drawable.el_sec_20,R.drawable.el_sec_21,R.drawable.el_sec_22,R.drawable.el_sec_23,R.drawable.el_sec_24,
      R.drawable.el_sec_25,R.drawable.el_sec_26,R.drawable.el_sec_27,R.drawable.el_sec_28,R.drawable.el_sec_29,
      R.drawable.el_sec_30,R.drawable.el_sec_31,R.drawable.el_sec_32,R.drawable.el_sec_33,R.drawable.el_sec_34,
      R.drawable.el_sec_35,R.drawable.el_sec_36,R.drawable.el_sec_37,R.drawable.el_sec_38,R.drawable.el_sec_39,
      R.drawable.el_sec_40,R.drawable.el_sec_41,R.drawable.el_sec_42,R.drawable.el_sec_43,R.drawable.el_sec_44,
      R.drawable.el_sec_45,R.drawable.el_sec_46,R.drawable.el_sec_47,R.drawable.el_sec_48,R.drawable.el_sec_49,
      R.drawable.el_sec_50,R.drawable.el_sec_51,R.drawable.el_sec_52,R.drawable.el_sec_53,R.drawable.el_sec_54,
      R.drawable.el_sec_55,R.drawable.el_sec_56,R.drawable.el_sec_57,R.drawable.el_sec_58,R.drawable.el_sec_59};

    @Override public void onEnabled(Context context){super.onEnabled(context);if(MODE_CLOCK.equals(widgetMode(context)))scheduleNextMinute(context);}
    @Override public void onDisabled(Context context){cancelTick(context);super.onDisabled(context);}
    @Override public void onUpdate(Context context,AppWidgetManager manager,int[] ids){NtpTime.start(context);for(int id:ids)updateOne(context,manager,id);if(ids.length>0&&MODE_CLOCK.equals(widgetMode(context)))scheduleNextMinute(context);}
    @Override public void onAppWidgetOptionsChanged(Context context,AppWidgetManager manager,int appWidgetId,Bundle newOptions){super.onAppWidgetOptionsChanged(context,manager,appWidgetId,newOptions);updateOne(context,manager,appWidgetId);}
    @Override public void onReceive(Context context,Intent intent){super.onReceive(context,intent);String action=intent.getAction();if(!ACTION_TICK.equals(action)&&!Intent.ACTION_TIME_CHANGED.equals(action)&&!Intent.ACTION_TIMEZONE_CHANGED.equals(action)&&!Intent.ACTION_DATE_CHANGED.equals(action)&&!Intent.ACTION_MY_PACKAGE_REPLACED.equals(action))return;updateAll(context);if(hasWidgets(context)&&MODE_CLOCK.equals(widgetMode(context)))scheduleNextMinute(context);else cancelTick(context);}

    static String widgetMode(Context context){
      String value=context.getSharedPreferences(PREFS,Context.MODE_PRIVATE).getString(PREF_MODE,MODE_CLOCK);
      return MODE_LIVE.equals(value)?MODE_LIVE:MODE_CLOCK;
    }
    static String setWidgetMode(Context context,String requested){
      String mode=MODE_LIVE.equalsIgnoreCase(String.valueOf(requested))?MODE_LIVE:MODE_CLOCK;
      context.getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit().putString(PREF_MODE,mode).apply();
      if(MODE_CLOCK.equals(mode))scheduleNextMinute(context);else cancelTick(context);
      updateAll(context);
      return mode;
    }
    static void publishLiveSnapshot(Context context,String json){
      if(json==null||json.length()>32768)return;
      LiveState state=LiveState.parse(json);
      if(state==null)return;
      context.getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit().putString(PREF_LIVE,json).apply();
      if(MODE_LIVE.equals(widgetMode(context)))requestLiveRefresh(context);
    }
    private static LiveState liveState(Context context){
      SharedPreferences prefs=context.getSharedPreferences(PREFS,Context.MODE_PRIVATE);
      LiveState state=LiveState.parse(prefs.getString(PREF_LIVE,null));
      return state==null?LiveState.EMPTY:state;
    }
    private static boolean hasWidgets(Context context){
      AppWidgetManager manager=AppWidgetManager.getInstance(context);
      return manager.getAppWidgetIds(new ComponentName(context,ElWidgetProvider.class)).length>0;
    }
    private static void updateAll(Context context){
      AppWidgetManager manager=AppWidgetManager.getInstance(context);
      int[] ids=manager.getAppWidgetIds(new ComponentName(context,ElWidgetProvider.class));
      for(int id:ids)updateOne(context,manager,id);
    }
    private static void requestLiveRefresh(Context context){
      synchronized(LIVE_REFRESH_LOCK){
        liveRefreshContext=context.getApplicationContext();
        if(liveRefreshPending)return;
        long now=SystemClock.elapsedRealtime();
        long delay=Math.max(0L,LIVE_REFRESH_MIN_MS-(now-lastLiveRefreshElapsed));
        liveRefreshPending=true;
        MAIN_HANDLER.postDelayed(()->{
          Context app;
          synchronized(LIVE_REFRESH_LOCK){
            liveRefreshPending=false;
            lastLiveRefreshElapsed=SystemClock.elapsedRealtime();
            app=liveRefreshContext;
          }
          if(app!=null&&MODE_LIVE.equals(widgetMode(app)))updateAll(app);
        },delay);
      }
    }

    private static void updateOne(Context context,AppWidgetManager manager,int appWidgetId){
      Bundle options=manager.getAppWidgetOptions(appWidgetId);
      int widthDp=Math.max(80,options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH,118));
      int heightDp=Math.max(96,options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT,199));
      float scaleDp=Math.min(widthDp/PANEL_W,heightDp/PANEL_H);
      float panelWidthDp=PANEL_W*scaleDp,panelHeightDp=PANEL_H*scaleDp;
      float density=context.getResources().getDisplayMetrics().density;
      int panelWidthPx=clamp(Math.round(panelWidthDp*density),1,1200),panelHeightPx=clamp(Math.round(panelHeightDp*density),1,1800);
      Calendar now=Calendar.getInstance();now.setTimeInMillis(NtpTime.accurateNow(context));
      RemoteViews views=new RemoteViews(context.getPackageName(),R.layout.el_widget);
      int[] flippers={R.id.el_hour_flipper,R.id.el_minute_flipper,R.id.el_seconds_flipper};
      boolean live=MODE_LIVE.equals(widgetMode(context));
      if(Build.VERSION.SDK_INT>=31){
        views.setViewLayoutWidth(R.id.el_widget_panel,panelWidthDp,TypedValue.COMPLEX_UNIT_DIP);
        views.setViewLayoutHeight(R.id.el_widget_panel,panelHeightDp,TypedValue.COMPLEX_UNIT_DIP);
        float[] y={R1_Y,R2_Y,R3_Y};
        for(int i=0;i<flippers.length;i++){
          views.setViewLayoutMargin(flippers[i],RemoteViews.MARGIN_START,ACTIVE_X*scaleDp,TypedValue.COMPLEX_UNIT_DIP);
          views.setViewLayoutMargin(flippers[i],RemoteViews.MARGIN_TOP,(ACTIVE_Y+y[i])*scaleDp,TypedValue.COMPLEX_UNIT_DIP);
          views.setViewLayoutWidth(flippers[i],ACTIVE_W*scaleDp,TypedValue.COMPLEX_UNIT_DIP);
          views.setViewLayoutHeight(flippers[i],FRAME_H*scaleDp,TypedValue.COMPLEX_UNIT_DIP);
        }
      }
      if(live){
        views.setImageViewBitmap(R.id.el_widget_image,ElRenderer.renderLive(panelWidthPx,panelHeightPx,liveState(context)));
        for(int id:flippers)views.setViewVisibility(id,View.GONE);
      }else{
        views.setImageViewBitmap(R.id.el_widget_image,ElRenderer.renderClock(panelWidthPx,panelHeightPx));
        for(int id:flippers)views.setViewVisibility(id,View.VISIBLE);
        populateFlipper(context,views,R.id.el_hour_flipper,24);
        populateFlipper(context,views,R.id.el_minute_flipper,60);
        populateFlipper(context,views,R.id.el_seconds_flipper,60);
        views.setInt(R.id.el_hour_flipper,"setDisplayedChild",now.get(Calendar.HOUR_OF_DAY));
        views.setInt(R.id.el_minute_flipper,"setDisplayedChild",now.get(Calendar.MINUTE));
        views.setInt(R.id.el_seconds_flipper,"setDisplayedChild",now.get(Calendar.SECOND));
      }
      Intent launch=new Intent(context,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP);
      PendingIntent openApp=PendingIntent.getActivity(context,appWidgetId,launch,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
      views.setOnClickPendingIntent(R.id.el_widget_root,openApp);
      manager.updateAppWidget(appWidgetId,views);
    }

    private static void populateFlipper(Context context,RemoteViews views,int viewId,int count){
      views.removeAllViews(viewId);
      for(int i=0;i<count;i++){
        RemoteViews frame=new RemoteViews(context.getPackageName(),R.layout.el_second_frame);
        frame.setImageViewResource(R.id.el_second_image,frameDrawable(i));
        views.addView(viewId,frame);
      }
    }
    static int frameDrawable(int position){return SECOND_DRAWABLES[Math.floorMod(position,SECOND_DRAWABLES.length)];}
    private static PendingIntent tickIntent(Context context){Intent tick=new Intent(context,ElWidgetProvider.class).setAction(ACTION_TICK);return PendingIntent.getBroadcast(context,TICK_REQUEST_CODE,tick,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
    private static void scheduleNextMinute(Context context){AlarmManager alarm=(AlarmManager)context.getSystemService(Context.ALARM_SERVICE);if(alarm==null)return;long now=System.currentTimeMillis(),next=now-(now%MINUTE_MS)+MINUTE_MS;PendingIntent pi=tickIntent(context);if(Build.VERSION.SDK_INT<31||alarm.canScheduleExactAlarms())alarm.setExactAndAllowWhileIdle(AlarmManager.RTC,next,pi);else alarm.setAndAllowWhileIdle(AlarmManager.RTC,next,pi);}
    private static void cancelTick(Context context){AlarmManager alarm=(AlarmManager)context.getSystemService(Context.ALARM_SERVICE);if(alarm!=null)alarm.cancel(tickIntent(context));}
    private static int clamp(int v,int lo,int hi){return Math.max(lo,Math.min(hi,v));}

    static final class LiveState{
      static final LiveState EMPTY=new LiveState("  ","  ","  ","      ","      ","      ",false,false,false);
      final String prog,verb,noun,r1,r2,r3;
      final boolean comp,vnFlashOff,elOff;
      LiveState(String prog,String verb,String noun,String r1,String r2,String r3,boolean comp,boolean vnFlashOff,boolean elOff){
        this.prog=prog;this.verb=verb;this.noun=noun;this.r1=r1;this.r2=r2;this.r3=r3;this.comp=comp;this.vnFlashOff=vnFlashOff;this.elOff=elOff;
      }
      static LiveState parse(String raw){
        if(raw==null||raw.isEmpty())return null;
        try{
          JSONObject root=new JSONObject(raw),display=root.optJSONObject("display");
          if(display==null)return null;
          int ch11=root.optInt("ch11",0),ch163=root.optInt("ch163",0);
          return new LiveState(digits(display.optJSONArray("prog"),2),digits(display.optJSONArray("verb"),2),digits(display.optJSONArray("noun"),2),reg(display.optJSONObject("r1")),reg(display.optJSONObject("r2")),reg(display.optJSONObject("r3")),(ch11&00002)!=0,(ch163&00040)!=0,(ch163&01000)!=0);
        }catch(Exception ignored){return null;}
      }
      private static String reg(JSONObject value){
        if(value==null)return "      ";
        char sign=value.optBoolean("plus",false)?'+':value.optBoolean("minus",false)?'-':' ';
        return sign+digits(value.optJSONArray("digits"),5);
      }
      private static String digits(JSONArray value,int count){
        StringBuilder out=new StringBuilder(count);
        for(int i=0;i<count;i++){
          String s=value==null?" ":value.optString(i," ");
          char ch=s.isEmpty()?' ':s.charAt(0);
          out.append(ch>='0'&&ch<='9'?ch:' ');
        }
        return out.toString();
      }
      String signature(){return prog+"|"+verb+"|"+noun+"|"+r1+"|"+r2+"|"+r3+"|"+(comp?'1':'0')+(vnFlashOff?'1':'0')+(elOff?'1':'0');}
    }

    static final class ElRenderer{
      private static final int CACHE_KIB=4096;
      private static final LruCache<String,Bitmap> BITMAP_CACHE=new LruCache<String,Bitmap>(CACHE_KIB){
        @Override protected int sizeOf(String key,Bitmap value){return Math.max(1,value.getAllocationByteCount()/1024);}
      };
      private static final int CORE=Color.rgb(109,236,180),RULE=CORE;
      private static final int FRAME=Color.rgb(86,90,86),PANEL=Color.rgb(105,109,103),HARDWARE=Color.rgb(162,166,159),INK=Color.rgb(5,6,5);

      // 1006315G Detail C is datum-dimensioned. The metric segment trace
      // already matches those physical dimensions; do not affine-squeeze it.
      private static final float U=106f/2.360f,MM_TO_U=U/25.4f;
      private static final float SRC_X=88.116524f,SRC_Y=85.303059f,SRC_W=11.685430f,MIRROR_X=2f*SRC_X+SRC_W,DATUM_X=MIRROR_X-96.244524f;
      private static final float DIGIT_H=.500f*U,UPPER_ADV=.420f*U,REG_ADV=.410f*U,FIRST_DIGIT_X=.400f*U;
      // Same sheet-2 upper electrode datums as the shared WebView renderer.
      private static final float LEFT_FIELD_X=.150f*U,RIGHT_FIELD_X=1.620f*U;
      private static final float PROG_Y=.315f*U,VERB_NOUN_Y=1.220f*U;

      // 1006315G Detail A, position 6: three separate luminous islands.
      // Segment A is the pair of vertical islands; segment B is horizontal.
      private static final float SIGN_W=.265f*U,SIGN_H=.338f*U,SIGN_T=.065f*U,SIGN_X=.025f*U,SIGN_GAP=.010f*U;
      private static final float SIGN_TOP=(DIGIT_H-SIGN_H)*.5f,SIGN_VX=SIGN_X+(SIGN_W-SIGN_T)*.5f;
      private static final float SIGN_A_H=(SIGN_H-SIGN_T-2f*SIGN_GAP)*.5f,SIGN_HY=SIGN_TOP+SIGN_A_H+SIGN_GAP,SIGN_LOWER_Y=SIGN_HY+SIGN_T+SIGN_GAP;

      private static final float[][][] SOURCE={
        {{95.137274f,86.827056f},{96.244524f,85.303059f},{90.088724f,85.303059f},{90.497084f,86.827056f}},
        {{91.361734f,91.526056f},{89.694284f,85.303059f},{88.116524f,85.303059f},{89.783974f,91.526056f}},
        {{89.886064f,91.907059f},{91.463824f,91.907059f},{92.620814f,96.224998f},{91.456914f,97.769549f}},
        {{93.002124f,96.352056f},{91.758014f,98.003059f},{99.570014f,98.003059f},{97.418394f,96.352056f}},
        {{95.390774f,87.126332f},{96.543434f,85.539832f},{98.147444f,91.526056f},{96.569684f,91.526056f}},
        {{96.671774f,91.907059f},{98.249534f,91.907059f},{99.801954f,97.700791f},{97.815844f,96.176791f}},
        {{96.005094f,90.891059f},{96.447474f,92.542059f},{92.028414f,92.542059f},{91.586024f,90.891059f}}};
      private static final int[] MAP={0,1,2,3,5,4,6};
      private static final Paint ON=new Paint(Paint.ANTI_ALIAS_FLAG),PANEL_P=new Paint(Paint.ANTI_ALIAS_FLAG),LABEL_P=new Paint(Paint.ANTI_ALIAS_FLAG),RULE_P=new Paint(Paint.ANTI_ALIAS_FLAG),COMP_P=new Paint(Paint.ANTI_ALIAS_FLAG),LEGEND_BG_P=new Paint(Paint.ANTI_ALIAS_FLAG),COMP_BG_P=new Paint(Paint.ANTI_ALIAS_FLAG),HARDWARE_STROKE_P=new Paint(Paint.ANTI_ALIAS_FLAG),HARDWARE_FILL_P=new Paint(Paint.ANTI_ALIAS_FLAG);
      static{
        ON.setStyle(Paint.Style.FILL);ON.setColor(CORE);
        PANEL_P.setStyle(Paint.Style.FILL);PANEL_P.setColor(PANEL);
        // 1006315G calls for .125-in-high Futura Demibold legends. Android does
        // not ship Futura, so use the broad system sans rather than the old
        // condensed face; 7.42 panel units matches the WebView cap-height target.
        Typeface tf=Typeface.create("sans-serif",Typeface.BOLD);
        LABEL_P.setTypeface(tf);LABEL_P.setTextAlign(Paint.Align.CENTER);LABEL_P.setTextSize(7.42f);LABEL_P.setColor(INK);LABEL_P.setAlpha(245);
        RULE_P.setStyle(Paint.Style.FILL);RULE_P.setColor(RULE);RULE_P.setAlpha(224);
        COMP_P.setTypeface(tf);COMP_P.setTextAlign(Paint.Align.CENTER);COMP_P.setTextSize(7.42f);COMP_P.setColor(INK);COMP_P.setAlpha(235);
        LEGEND_BG_P.setStyle(Paint.Style.FILL);LEGEND_BG_P.setColor(CORE);LEGEND_BG_P.setAlpha(235);
        COMP_BG_P.setStyle(Paint.Style.FILL);COMP_BG_P.setColor(CORE);COMP_BG_P.setAlpha(235);
        HARDWARE_STROKE_P.setStyle(Paint.Style.STROKE);HARDWARE_STROKE_P.setStrokeWidth(.48f);HARDWARE_STROKE_P.setColor(HARDWARE);HARDWARE_STROKE_P.setAlpha(184);
        HARDWARE_FILL_P.setStyle(Paint.Style.FILL);HARDWARE_FILL_P.setColor(HARDWARE);HARDWARE_FILL_P.setAlpha(224);
      }
      static Bitmap renderClock(int width,int height){return render(width,height,null);}
      static Bitmap renderLive(int width,int height,LiveState state){return render(width,height,state==null?LiveState.EMPTY:state);}
      private static Bitmap render(int width,int height,LiveState live){
        width=Math.max(1,width);height=Math.max(1,height);
        String key=width+"x"+height+(live==null?":clock":":live:"+live.signature());
        synchronized(BITMAP_CACHE){Bitmap cached=BITMAP_CACHE.get(key);if(cached!=null&&!cached.isRecycled())return cached;}
        Bitmap b=Bitmap.createBitmap(width,height,Bitmap.Config.ARGB_8888);Canvas c=new Canvas(b);c.drawColor(FRAME);c.scale(width/PANEL_W,height/PANEL_H);drawPanel(c,live);
        synchronized(BITMAP_CACHE){BITMAP_CACHE.put(key,b);}return b;
      }
      private static void drawPanel(Canvas c,LiveState live){
        boolean liveMode=live!=null,elOff=liveMode&&live.elOff;
        c.drawPath(box(.24f,.24f,PANEL_W-.48f,PANEL_H-.48f),HARDWARE_STROKE_P);
        c.drawPath(box(ACTIVE_X,ACTIVE_Y,ACTIVE_W,ACTIVE_H),PANEL_P);
        c.save();
        c.translate(ACTIVE_X,ACTIVE_Y);
        dot(c,53.000f,6.914f,1.294f,1.369f);dot(c,53.000f,43.427f,1.294f,1.369f);dot(c,53.000f,79.949f,1.294f,1.369f);
        dot(c,100.863f,79.949f,1.294f,1.369f);dot(c,100.863f,114.085f,1.294f,1.369f);dot(c,100.863f,148.220f,1.294f,1.369f);
        dot(c,8.286f,148.220f,1.294f,1.369f);dot(c,8.286f,114.085f,1.294f,1.369f);dot(c,8.286f,79.949f,1.294f,1.369f);
        if(!elOff)section(c,66.441f,.554f,39.525f,11.678f,LEGEND_BG_P);c.drawText("PROG",86.237f,8.600f,LABEL_P);
        if(!elOff)section(c,0f,41.203f,39.525f,11.678f,LEGEND_BG_P);c.drawText("VERB",19.763f,49.252f,LABEL_P);
        if(!elOff)section(c,66.441f,41.203f,39.525f,11.678f,LEGEND_BG_P);c.drawText("NOUN",86.237f,49.252f,LABEL_P);
        if(!elOff&&liveMode&&live.comp)section(c,0f,.633f,39.525f,35.838f,COMP_BG_P);c.drawText("COMP",19.763f,17.900f,COMP_P);c.drawText("ACTY",19.763f,25.000f,COMP_P);
        if(!elOff){
          rule(c,12.770f,78.602f,84.900f,2.695f);rule(c,12.770f,112.737f,84.900f,2.695f);rule(c,12.770f,146.873f,84.900f,2.695f);
          digits(c,liveMode?live.prog:"00",RIGHT_FIELD_X,PROG_Y);
          if(!liveMode||!live.vnFlashOff){digits(c,liveMode?live.verb:"16",LEFT_FIELD_X,VERB_NOUN_Y);digits(c,liveMode?live.noun:"65",RIGHT_FIELD_X,VERB_NOUN_Y);}
          if(liveMode){register(c,live.r1.charAt(0),live.r1.substring(1),0,R1_Y);register(c,live.r2.charAt(0),live.r2.substring(1),0,R2_Y);register(c,live.r3.charAt(0),live.r3.substring(1),0,R3_Y);}
        }
        c.restore();
      }
      private static void section(Canvas c,float x,float y,float w,float h,Paint p){c.drawPath(box(x,y,w,h),p);}
      private static void rule(Canvas c,float x,float y,float w,float h){c.drawPath(box(x,y,w,h),RULE_P);}
      private static void dot(Canvas c,float cx,float cy,float rx,float ry){Path p=new Path();for(int i=0;i<12;i++){double a=Math.PI*2d*i/12d;float x=cx+(float)Math.cos(a)*rx,y=cy+(float)Math.sin(a)*ry;if(i==0)p.moveTo(x,y);else p.lineTo(x,y);}p.close();c.drawPath(p,HARDWARE_FILL_P);}
      private static void digits(Canvas c,String s,float x,float y){for(int i=0;i<s.length();i++)digit(c,s.charAt(i),x+i*UPPER_ADV,y);}
      private static void register(Canvas c,char sign,String s,float x,float y){sign(c,sign,x,y);for(int i=0;i<s.length();i++)digit(c,s.charAt(i),x+FIRST_DIGIT_X+i*REG_ADV,y);}
      private static void digit(Canvas c,char ch,float ox,float oy){String lit=WidgetRelayModel.segmentsForDigit(ch);for(int l=0;l<7;l++)if(lit.indexOf((char)('a'+l))>=0)segment(c,l,ox,oy);}
      private static void segment(Canvas c,int logical,float ox,float oy){float[][] pts=SOURCE[MAP[logical]];Path p=new Path();for(int i=0;i<pts.length;i++){float x=ox+(MIRROR_X-pts[i][0]-DATUM_X)*MM_TO_U,y=oy+(pts[i][1]-SRC_Y)*MM_TO_U;if(i==0)p.moveTo(x,y);else p.lineTo(x,y);}p.close();c.drawPath(p,ON);}
      private static void sign(Canvas c,char s,float ox,float oy){
        if(s!='+'&&s!='-')return;
        c.drawPath(box(ox+SIGN_X,oy+SIGN_HY,SIGN_W,SIGN_T),ON);
        if(s=='+'){
          c.drawPath(box(ox+SIGN_VX,oy+SIGN_TOP,SIGN_T,SIGN_A_H),ON);
          c.drawPath(box(ox+SIGN_VX,oy+SIGN_LOWER_Y,SIGN_T,SIGN_A_H),ON);
        }
      }
      private static Path box(float x,float y,float w,float h){Path p=new Path();p.moveTo(x,y);p.lineTo(x+w,y);p.lineTo(x+w,y+h);p.lineTo(x,y+h);p.close();return p;}
    }
}
