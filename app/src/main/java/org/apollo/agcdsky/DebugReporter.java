package org.apollo.agcdsky;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.os.Build;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.lang.ref.WeakReference;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public final class DebugReporter {
    private static final String REPORT_FILE="debug-last.txt";
    private static final String LOG_TAG="AGC-DSKY";
    private static final int MAX_REPORT_CHARS=20000;
    private static final int MAX_EVENT_DETAIL_CHARS=20000;
    private static final long MAX_REPORT_BYTES=64L*1024L;
    private static boolean installed;
    private static WeakReference<Activity> pendingReportOwner = new WeakReference<>(null);
    private static WeakReference<AlertDialog> pendingReportDialog = new WeakReference<>(null);
    private DebugReporter(){}
    public static synchronized void install(Context context){if(installed)return;installed=true;final Context app=context.getApplicationContext();final Thread.UncaughtExceptionHandler previous=Thread.getDefaultUncaughtExceptionHandler();Thread.setDefaultUncaughtExceptionHandler((thread,error)->{try{writeReport(app,"NATIVE CRASH on "+thread.getName(),stackTrace(error));}catch(Throwable ignored){}if(previous!=null)previous.uncaughtException(thread,error);});}
    public static boolean hasReport(Context context){File file=reportFile(context);return file.isFile()&&file.length()>0;}
    public static synchronized boolean showPendingReport(Activity activity,Runnable continueStartup){
        if(!hasReport(activity))return false;
        dismissPendingReport(null);
        AlertDialog dialog=new AlertDialog.Builder(activity)
                .setTitle("AGC DSKY DEBUG REPORT")
                .setMessage("The previous run produced a crash/error report. Copy it before starting the DSKY again?")
                .setCancelable(false)
                .setPositiveButton("COPY REPORT",(d,which)->{if(copyReport(activity))clear(activity);continueStartup.run();})
                .setNegativeButton("CONTINUE",(d,which)->continueStartup.run())
                .setNeutralButton("CLEAR",(d,which)->{clear(activity);continueStartup.run();})
                .create();
        pendingReportOwner=new WeakReference<>(activity);
        pendingReportDialog=new WeakReference<>(dialog);
        dialog.setOnDismissListener(ignored->{
            synchronized(DebugReporter.class){
                if(pendingReportDialog.get()==dialog){
                    pendingReportDialog.clear();
                    pendingReportOwner.clear();
                }
            }
        });
        dialog.show();
        return true;
    }
    public static synchronized void dismissPendingReport(Activity activity){
        Activity owner=pendingReportOwner.get();
        AlertDialog dialog=pendingReportDialog.get();
        if(dialog==null){pendingReportOwner.clear();return;}
        if(activity!=null&&owner!=activity)return;
        pendingReportDialog.clear();
        pendingReportOwner.clear();
        try{if(dialog.isShowing())dialog.dismiss();}catch(RuntimeException ignored){}
    }
    public static void appendWebError(Context context,String detail){if(detail==null||detail.trim().isEmpty())return;writeReport(context.getApplicationContext(),"WEBVIEW/JAVASCRIPT ERROR",detail);}
    public static final class JsBridge{private final Context app;public JsBridge(Context context){app=context.getApplicationContext();}@JavascriptInterface public void report(String detail){appendWebError(app,detail);}@JavascriptInterface public void ready(String detail){if(!isDebuggable(app))return;String safe=detail==null?"unknown":detail.replace('\n',' ').replace('\r',' ');if(safe.length()>80)safe=safe.substring(0,80);Log.i(LOG_TAG,"FRONTEND READY "+safe);}}
    private static boolean isDebuggable(Context context){return(context.getApplicationInfo().flags&ApplicationInfo.FLAG_DEBUGGABLE)!=0;}
    private static boolean copyReport(Activity activity){String report=readReport(activity);if(report.length()>MAX_REPORT_CHARS)report=report.substring(report.length()-MAX_REPORT_CHARS);ClipboardManager clipboard=(ClipboardManager)activity.getSystemService(Context.CLIPBOARD_SERVICE);if(clipboard==null)return false;clipboard.setPrimaryClip(ClipData.newPlainText("AGC DSKY debug report",report));return true;}
    private static synchronized void writeReport(Context context,String source,String detail){String safeDetail=detail==null?"(no detail)":detail;if(safeDetail.length()>MAX_EVENT_DETAIL_CHARS)safeDetail=safeDetail.substring(0,MAX_EVENT_DETAIL_CHARS)+"\n...(event detail truncated)";StringBuilder out=new StringBuilder();out.append("AGC DSKY prototype debug report\n");out.append("Time: ").append(new SimpleDateFormat("yyyy-MM-dd HH:mm:ss Z",Locale.US).format(new Date())).append('\n');out.append("Source: ").append(source).append('\n');out.append("App: ").append(context.getPackageName()).append(' ').append(packageVersion(context)).append('\n');out.append("Android: ").append(Build.VERSION.RELEASE).append(" (SDK ").append(Build.VERSION.SDK_INT).append(")\n");out.append("Device: ").append(Build.MANUFACTURER).append(' ').append(Build.MODEL).append('\n');out.append("WebView: ").append(webViewVersion()).append('\n');out.append("Note: local report only; location coordinates are intentionally not included.\n\n");out.append(safeDetail).append('\n');File file=reportFile(context);byte[] event=out.toString().getBytes(StandardCharsets.UTF_8);byte[] separator="\n---\n".getBytes(StandardCharsets.UTF_8);boolean append=file.isFile()&&file.length()>0&&file.length()+separator.length+event.length<=MAX_REPORT_BYTES;try(FileOutputStream stream=new FileOutputStream(file,append)){if(append)stream.write(separator);stream.write(event);stream.flush();}catch(Exception ignored){}}
    private static long packageVersionCode(PackageInfo info){if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.P)return info.getLongVersionCode();return legacyPackageVersionCode(info);}
    @SuppressWarnings("deprecation") private static long legacyPackageVersionCode(PackageInfo info){return info.versionCode;}
    private static String packageVersion(Context context){try{PackageInfo info=context.getPackageManager().getPackageInfo(context.getPackageName(),0);long code=packageVersionCode(info);return String.valueOf(info.versionName)+" ("+code+")";}catch(Exception ignored){return"unknown";}}
    private static String webViewVersion(){try{PackageInfo info=WebView.getCurrentWebViewPackage();if(info==null)return"unknown";long code=packageVersionCode(info);return info.packageName+" "+String.valueOf(info.versionName)+" ("+code+")";}catch(Throwable ignored){return"unavailable";}}
    private static String readReport(Context context){File file=reportFile(context);if(!file.isFile())return"(report file missing)";int capacity=(int)Math.min(file.length(),MAX_REPORT_BYTES);try(FileInputStream stream=new FileInputStream(file);ByteArrayOutputStream output=new ByteArrayOutputStream(capacity)){byte[] buffer=new byte[4096];int remaining=capacity;while(remaining>0){int count=stream.read(buffer,0,Math.min(buffer.length,remaining));if(count<0)break;if(count==0)continue;output.write(buffer,0,count);remaining-=count;}byte[] data=output.toByteArray();return data.length==0?"(empty report)":new String(data,StandardCharsets.UTF_8);}catch(Exception error){return"Unable to read report: "+error;}}
    private static void clear(Context context){File file=reportFile(context);if(file.exists())file.delete();}
    private static File reportFile(Context context){return new File(context.getFilesDir(),REPORT_FILE);}
    private static String stackTrace(Throwable error){StringWriter buffer=new StringWriter();PrintWriter writer=new PrintWriter(buffer);error.printStackTrace(writer);writer.flush();return buffer.toString();}
}
