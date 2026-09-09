package org.apollo.agcdsky;

import android.Manifest;
import android.app.Activity;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.GeolocationPermissions;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;

public final class MainActivity extends Activity {
    private static final int GEO_PERMISSION_REQUEST = 41;
    private static final int CM_PANEL_COLOR = 0xFF7F8484;
    private static final String JS_APP_HIDDEN = "if(window.AGCDSKY&&AGCDSKY.setAppVisible){AGCDSKY.setAppVisible(false)}";
    private static final String JS_APP_VISIBLE = "if(window.AGCDSKY&&AGCDSKY.setAppVisible){AGCDSKY.setAppVisible(false);AGCDSKY.setAppVisible(true)}";
    private static final Uri LOCAL_ASSET_ORIGIN = Uri.parse(NetClient.ASSET_ORIGIN);
    private WebView webView;
    private Bundle pendingWebViewState;
    private String pendingGeoOrigin;
    private GeolocationPermissions.Callback pendingGeoCallback;

    @Override protected void onCreate(Bundle state) {
        DebugReporter.install(this); requestWindowFeature(Window.FEATURE_NO_TITLE); super.onCreate(state);
        pendingWebViewState = state; configureWindow();
        if (!DebugReporter.showPendingReport(this, this::startDsky)) startDsky();
    }
    private void configureWindow() {
        Window window=getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON|WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.P){WindowManager.LayoutParams p=window.getAttributes();p.layoutInDisplayCutoutMode=WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;window.setAttributes(p);}
        View decor=window.getDecorView();decor.setBackgroundColor(CM_PANEL_COLOR);
        if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.R)configureModernSystemBars(window);else configureLegacySystemBars(window,decor);
    }
    @SuppressWarnings("deprecation") private static void configureModernSystemBars(Window window){window.setDecorFitsSystemWindows(false);if(Build.VERSION.SDK_INT<Build.VERSION_CODES.VANILLA_ICE_CREAM){window.setStatusBarColor(CM_PANEL_COLOR);window.setNavigationBarColor(CM_PANEL_COLOR);}WindowInsetsController c=window.getInsetsController();if(c!=null){c.hide(WindowInsets.Type.systemBars());c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);}}
    @SuppressWarnings("deprecation") private static void configureLegacySystemBars(Window window,View decor){window.setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,WindowManager.LayoutParams.FLAG_FULLSCREEN);window.setStatusBarColor(CM_PANEL_COLOR);window.setNavigationBarColor(CM_PANEL_COLOR);decor.setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY|View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN|View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_LAYOUT_STABLE);}
    void startDsky(){
        if(webView!=null)return;
        if((getApplicationInfo().flags&ApplicationInfo.FLAG_DEBUGGABLE)!=0)WebView.setWebContentsDebuggingEnabled(true);
        webView=new WebView(this);webView.setBackgroundColor(CM_PANEL_COLOR);WebSettings s=webView.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setGeolocationEnabled(true);s.setMediaPlaybackRequiresUserGesture(false);s.setBlockNetworkLoads(true);s.setAllowFileAccess(false);s.setAllowContentAccess(false);
        webView.addJavascriptInterface(new DebugReporter.JsBridge(this),"DebugBridge");webView.setWebViewClient(new NetClient(this));
        webView.setWebChromeClient(new WebChromeClient(){@Override public void onGeolocationPermissionsShowPrompt(String origin,GeolocationPermissions.Callback callback){if(!isLocalAssetOrigin(origin)){callback.invoke(origin,false,false);return;}if(hasLocationPermission()){callback.invoke(origin,true,false);return;}pendingGeoOrigin=origin;pendingGeoCallback=callback;requestPermissions(new String[]{Manifest.permission.ACCESS_COARSE_LOCATION,Manifest.permission.ACCESS_FINE_LOCATION},GEO_PERMISSION_REQUEST);}@Override public boolean onConsoleMessage(ConsoleMessage message){if(message!=null&&message.messageLevel()==ConsoleMessage.MessageLevel.ERROR){String text=message.message();if(text==null||!text.startsWith("[yaAGC]"))DebugReporter.appendWebError(MainActivity.this,message.sourceId()+":"+message.lineNumber()+"\n"+String.valueOf(text));}return super.onConsoleMessage(message);}});
        setContentView(webView);boolean restored=false;if(pendingWebViewState!=null){try{restored=webView.restoreState(pendingWebViewState)!=null;}catch(RuntimeException ignored){}pendingWebViewState=null;}if(!restored)webView.loadUrl(NetClient.ASSET_ORIGIN+NetClient.ASSET_PREFIX+"index.html");
    }
    private boolean isLocalAssetOrigin(String origin){if(origin==null)return false;try{Uri c=Uri.parse(origin);int port=c.getPort();return "https".equalsIgnoreCase(c.getScheme())&&LOCAL_ASSET_ORIGIN.getHost()!=null&&LOCAL_ASSET_ORIGIN.getHost().equalsIgnoreCase(c.getHost())&&(port==-1||port==443);}catch(RuntimeException ignored){return false;}}
    private boolean hasLocationPermission(){return checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED||checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED;}
    @Override public void onRequestPermissionsResult(int requestCode,String[] permissions,int[] grantResults){super.onRequestPermissionsResult(requestCode,permissions,grantResults);if(requestCode==GEO_PERMISSION_REQUEST&&pendingGeoCallback!=null){boolean grant=isLocalAssetOrigin(pendingGeoOrigin)&&hasLocationPermission();pendingGeoCallback.invoke(pendingGeoOrigin,grant,false);pendingGeoOrigin=null;pendingGeoCallback=null;}}
    @Override protected void onResume(){super.onResume();configureWindow();if(webView!=null){webView.onResume();webView.evaluateJavascript(JS_APP_VISIBLE,null);}}
    @Override protected void onPause(){if(webView!=null){webView.evaluateJavascript(JS_APP_HIDDEN,null);webView.onPause();}super.onPause();}
    @Override protected void onSaveInstanceState(Bundle outState){if(webView!=null)webView.saveState(outState);super.onSaveInstanceState(outState);}
    private void destroyWebView(){WebView doomed=webView;webView=null;WebViewTeardown.destroy(doomed,"DebugBridge");}
    @Override protected void onDestroy(){DebugReporter.dismissPendingReport(this);pendingWebViewState=null;if(pendingGeoCallback!=null){try{pendingGeoCallback.invoke(pendingGeoOrigin,false,false);}catch(RuntimeException ignored){}}pendingGeoOrigin=null;pendingGeoCallback=null;destroyWebView();super.onDestroy();}
}
