package org.apollo.agcdsky;

import android.annotation.SuppressLint;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.os.Build;
import android.os.Bundle;
import android.util.LruCache;
import android.util.TypedValue;
import android.view.View;
import android.widget.RemoteViews;
import java.util.Calendar;
import java.util.Locale;

public class ElWidgetProvider extends AppWidgetProvider {
    private static final String ACTION_TICK="org.apollo.agcdsky.EL_WIDGET_TICK";
    private static final long MINUTE_MS=60_000L;
    private static final int TICK_REQUEST_CODE=21;
    // Two independent, fixed-identity Android widget picker entries.
    // Existing ElWidgetProvider instances remain the classic DSKY clock after upgrade.
    protected boolean isDateWidget(){return false;}
    private static int[] widgetIds(Context context,AppWidgetManager manager,Class<?> provider){
      return manager.getAppWidgetIds(new ComponentName(context,provider));
    }
    private static void refreshAll(Context context){
      AppWidgetManager manager=AppWidgetManager.getInstance(context);
      int[] classics=widgetIds(context,manager,ElWidgetProvider.class);
      int[] dates=widgetIds(context,manager,DateElWidgetProvider.class);
      for(int id:classics)updateOne(context,manager,id,false);
      for(int id:dates)updateOne(context,manager,id,true);
      if(classics.length+dates.length>0)scheduleNextMinute(context);
      else cancelTick(context);
    }

    // MIT/IL SCD 1006315G sheet 2: the active EL face is 2.360 x 4.060 in
    // inside a 2.620 x 4.420-in hardware frame.  Nominal frame insets are
    // .130 in per side and .180 in top/bottom.
    private static final float U=106f/2.360f;
    private static final float ACTIVE_W=106f,ACTIVE_H=4.060f*U;
    private static final float ACTIVE_X=.130f*U,ACTIVE_Y=.180f*U;
    private static final float PANEL_W=2.620f*U,PANEL_H=4.420f*U;
    private static final float R1_Y=83.992f,R2_Y=118.127f,R3_Y=152.263f;
    private static final float FRAME_X=-1.537f,FRAME_W=107.537f,FRAME_H=23f;

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

    @Override public void onEnabled(Context context){super.onEnabled(context);scheduleNextMinute(context);}
    @Override public void onDisabled(Context context){super.onDisabled(context);refreshAll(context);}
    @Override public void onUpdate(Context context,AppWidgetManager manager,int[] ids){NtpTime.start(context);for(int id:ids)updateOne(context,manager,id,isDateWidget());if(ids.length>0)scheduleNextMinute(context);}
    @Override public void onAppWidgetOptionsChanged(Context context,AppWidgetManager manager,int appWidgetId,Bundle newOptions){super.onAppWidgetOptionsChanged(context,manager,appWidgetId,newOptions);updateOne(context,manager,appWidgetId,isDateWidget());}
    @Override public void onReceive(Context context,Intent intent){
      super.onReceive(context,intent);
      String action=intent.getAction();
      if(ACTION_TICK.equals(action)||Intent.ACTION_TIME_CHANGED.equals(action)
          ||Intent.ACTION_TIMEZONE_CHANGED.equals(action)||Intent.ACTION_DATE_CHANGED.equals(action)
          ||Intent.ACTION_MY_PACKAGE_REPLACED.equals(action))refreshAll(context);
    }

    private static void updateOne(Context context,AppWidgetManager manager,int appWidgetId,boolean date){
      Bundle options=manager.getAppWidgetOptions(appWidgetId);
      int widthDp=Math.max(80,options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH,118));
      int heightDp=Math.max(96,options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT,199));
      float scaleDp=Math.min(widthDp/PANEL_W,heightDp/PANEL_H);
      float panelWidthDp=PANEL_W*scaleDp,panelHeightDp=PANEL_H*scaleDp;
      float density=context.getResources().getDisplayMetrics().density;
      int panelWidthPx=clamp(Math.round(panelWidthDp*density),1,1200),panelHeightPx=clamp(Math.round(panelHeightDp*density),1,1800);
      Calendar now=Calendar.getInstance();now.setTimeInMillis(NtpTime.accurateNow(context));
      RemoteViews views=new RemoteViews(context.getPackageName(),R.layout.el_widget);
      boolean staticFallbackRegisters=Build.VERSION.SDK_INT<31;
      views.setImageViewBitmap(R.id.el_widget_image,ElRenderer.render(panelWidthPx,panelHeightPx,now,staticFallbackRegisters,date));
      views.setContentDescription(R.id.el_widget_image,date
          ?"DSKY date clock: year, month, day, hours, minutes, seconds"
          :"DSKY classic clock: program, verb, noun legends and time registers");
      int[] flippers={R.id.el_hour_flipper,R.id.el_minute_flipper,R.id.el_seconds_flipper};
      for(int flipper:flippers)views.setViewVisibility(flipper,Build.VERSION.SDK_INT>=31?View.VISIBLE:View.GONE);
      if(Build.VERSION.SDK_INT>=31){
        RemoteViews.RemoteCollectionItems pairFrames=buildFrames(context,60),hourFrames=buildFrames(context,24);
        views.setRemoteAdapter(R.id.el_hour_flipper,hourFrames);
        views.setRemoteAdapter(R.id.el_minute_flipper,pairFrames);
        views.setRemoteAdapter(R.id.el_seconds_flipper,pairFrames);
        views.setDisplayedChild(R.id.el_hour_flipper,now.get(Calendar.HOUR_OF_DAY));
        views.setDisplayedChild(R.id.el_minute_flipper,now.get(Calendar.MINUTE));
        views.setDisplayedChild(R.id.el_seconds_flipper,now.get(Calendar.SECOND));
        views.setViewLayoutWidth(R.id.el_widget_panel,panelWidthDp,TypedValue.COMPLEX_UNIT_DIP);
        views.setViewLayoutHeight(R.id.el_widget_panel,panelHeightDp,TypedValue.COMPLEX_UNIT_DIP);
        float[] y={R1_Y,R2_Y,R3_Y};
        for(int i=0;i<flippers.length;i++){
          views.setViewLayoutMargin(flippers[i],RemoteViews.MARGIN_START,(ACTIVE_X+FRAME_X)*scaleDp,TypedValue.COMPLEX_UNIT_DIP);
          views.setViewLayoutMargin(flippers[i],RemoteViews.MARGIN_TOP,(ACTIVE_Y+y[i])*scaleDp,TypedValue.COMPLEX_UNIT_DIP);
          views.setViewLayoutWidth(flippers[i],FRAME_W*scaleDp,TypedValue.COMPLEX_UNIT_DIP);
          views.setViewLayoutHeight(flippers[i],FRAME_H*scaleDp,TypedValue.COMPLEX_UNIT_DIP);
        }
      }
      Intent launch=new Intent(context,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP);
      PendingIntent openApp=PendingIntent.getActivity(context,appWidgetId,launch,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
      views.setOnClickPendingIntent(R.id.el_widget_root,openApp);
      manager.updateAppWidget(appWidgetId,views);
    }

    @android.annotation.TargetApi(Build.VERSION_CODES.S) private static RemoteViews.RemoteCollectionItems buildFrames(Context context,int count){RemoteViews.RemoteCollectionItems.Builder builder=new RemoteViews.RemoteCollectionItems.Builder();for(int i=0;i<count;i++){RemoteViews frame=new RemoteViews(context.getPackageName(),R.layout.el_second_frame);frame.setImageViewResource(R.id.el_second_image,SECOND_DRAWABLES[i]);builder.addItem(i,frame);}return builder.build();}
    private static PendingIntent tickIntent(Context context){Intent tick=new Intent(context,ElWidgetProvider.class).setAction(ACTION_TICK);return PendingIntent.getBroadcast(context,TICK_REQUEST_CODE,tick,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
    // RTC is deliberately non-wakeup. Use exact minute boundaries only where
    // the platform permits them; Android 12+ otherwise gets the inexact idle-safe fallback.
    // Lint cannot infer the pre-S permission rules or the S+ canScheduleExactAlarms guard below.
    @SuppressLint("MissingPermission")
    private static void scheduleNextMinute(Context context){
      AlarmManager alarm=(AlarmManager)context.getSystemService(Context.ALARM_SERVICE);
      if(alarm==null)return;
      long now=System.currentTimeMillis(),next=now-(now%MINUTE_MS)+MINUTE_MS;
      PendingIntent pi=tickIntent(context);
      if(Build.VERSION.SDK_INT<31){
        alarm.setExactAndAllowWhileIdle(AlarmManager.RTC,next,pi);
        return;
      }
      if(alarm.canScheduleExactAlarms()){
        try{
          alarm.setExactAndAllowWhileIdle(AlarmManager.RTC,next,pi);
          return;
        }catch(SecurityException ignored){}
      }
      alarm.setAndAllowWhileIdle(AlarmManager.RTC,next,pi);
    }
    private static void cancelTick(Context context){AlarmManager alarm=(AlarmManager)context.getSystemService(Context.ALARM_SERVICE);if(alarm!=null)alarm.cancel(tickIntent(context));}
    private static int clamp(int v,int lo,int hi){return Math.max(lo,Math.min(hi,v));}

    static final class ElRenderer{
      private static final int CACHE_KIB=4096;
      private static final LruCache<String,Bitmap> BITMAP_CACHE=new LruCache<String,Bitmap>(CACHE_KIB){
        @Override protected int sizeOf(String key,Bitmap value){return Math.max(1,value.getAllocationByteCount()/1024);}
      };
      private static final int CORE=Color.rgb(109,236,180),RULE=CORE;
      private static final int FRAME=Color.rgb(86,90,86),PANEL=Color.rgb(105,109,103),HARDWARE=Color.rgb(162,166,159),INK=Color.rgb(5,6,5);

      // MIT/IL SCD 1006315G geometry; Detail A drawing dimensions control sign size. CAD retains the register placement. Coordinates below are inches in the STEP
      // component datum; U converts them uniformly into the 106-unit face.
      private static final float U=106f/2.360f,DIGIT_TOP_IN=.0322398905f;
      private static final float DIGIT_H=.500f*U,UPPER_ADV=.420f*U,REG_ADV=.410f*U,FIRST_DIGIT_X=.180f*U,REGISTER_ROW_X=-.010f*U;
      private static final float LEFT_FIELD_X=-.035451f*U,RIGHT_FIELD_X=1.434549f*U;
      private static final float PROG_Y=.315f*U,VERB_NOUN_Y=1.220f*U;

      private static final Paint ON=new Paint(Paint.ANTI_ALIAS_FLAG),PANEL_P=new Paint(Paint.ANTI_ALIAS_FLAG),LABEL_P=new Paint(Paint.ANTI_ALIAS_FLAG),RULE_P=new Paint(Paint.ANTI_ALIAS_FLAG),LEGEND_BG_P=new Paint(Paint.ANTI_ALIAS_FLAG),HARDWARE_STROKE_P=new Paint(Paint.ANTI_ALIAS_FLAG),HARDWARE_FILL_P=new Paint(Paint.ANTI_ALIAS_FLAG);
      // Static outlines use the app's League Spartan Medium geometric-sans construction. The SCD specifies Futura Demibold; these paths keep rendering deterministic but are not exact Futura outlines.
      private static final Path PROG_LABEL=labelPath("M75.4402,9.2002L76.3346,9.2002L76.3346,7.0175L77.1682,7.0175C78.2262,7.0175 79.0598,6.4293 79.0598,5.2670C79.0598,4.1024 78.2262,3.5858 77.1682,3.5858L75.4402,3.5858L75.4402,9.2002ZM76.3346,4.3162L76.9223,4.3162C77.5773,4.3162 78.1090,4.5478 78.1090,5.2864C78.1090,6.0226 77.5773,6.2870 76.9223,6.2870L76.3346,6.2870L76.3346,4.3162ZM80.1328,9.2002L81.0268,9.2002L81.0268,6.8721L81.7491,6.8721L83.0243,9.2002L84.0351,9.2002L82.6516,6.8048C83.1310,6.7642 83.8572,6.2871 83.8572,5.2392C83.8572,4.1875 83.1241,3.5858 82.1961,3.5858L80.1328,3.5858L80.1328,9.2002ZM81.0268,4.3162L81.8848,4.3162C82.4841,4.3162 82.9393,4.5807 82.9393,5.2643C82.9393,5.9479 82.4783,6.2263 81.8790,6.2263L81.0268,6.2263L81.0268,4.3162ZM87.7595,4.3282C88.8703,4.3282 89.6472,5.2299 89.6472,6.3887C89.6472,7.5495 88.8703,8.4539 87.7595,8.4539C86.6528,8.4539 85.8690,7.5495 85.8690,6.3887C85.8690,5.2299 86.6528,4.3282 87.7595,4.3282ZM87.7595,9.3023C89.3985,9.3023 90.5748,8.0305 90.5748,6.3887C90.5748,4.7512 89.3753,3.4837 87.7595,3.4837C86.1575,3.4837 84.9395,4.7512 84.9395,6.3887C84.9395,8.0305 86.1034,9.3023 87.7595,9.3023ZM94.1244,6.8292L95.9696,6.8292C95.9166,7.7456 95.2128,8.4539 94.1901,8.4539C93.0835,8.4539 92.2997,7.5124 92.2997,6.3887C92.2997,5.2670 93.0835,4.3282 94.1901,4.3282C94.8954,4.3282 95.3810,4.6592 95.6892,5.0961L96.5151,4.6785C96.1138,4.0738 95.3985,3.4837 94.1901,3.4837C92.5302,3.4837 91.3702,4.7883 91.3702,6.3887C91.3702,7.9934 92.5302,9.3023 94.1901,9.3023C95.8106,9.3023 96.9668,8.0236 96.9668,6.4444L96.9668,6.1247L94.1244,6.1247L94.1244,6.8292Z");
      private static final Path VERB_LABEL=labelPath("M15.1026,44.2348L14.0953,44.2348L12.5432,48.7391L10.9958,44.2348L9.9885,44.2348L12.0259,49.8492L13.0606,49.8492L15.1026,44.2348ZM16.0433,49.8492L19.4452,49.8492L19.4452,49.0511L16.9331,49.0511L16.9331,47.4229L19.4012,47.4229L19.4012,46.6460L16.9331,46.6460L16.9331,45.0329L19.4452,45.0329L19.4452,44.2348L16.0433,44.2348L16.0433,49.8492ZM20.7603,49.8492L21.6543,49.8492L21.6543,47.5211L22.3766,47.5211L23.6518,49.8492L24.6625,49.8492L23.2790,47.4538C23.7585,47.4132 24.4847,46.9361 24.4847,45.8882C24.4847,44.8365 23.7516,44.2348 22.8236,44.2348L20.7603,44.2348L20.7603,49.8492ZM21.6543,44.9652L22.5123,44.9652C23.1116,44.9652 23.5667,45.2297 23.5667,45.9133C23.5667,46.5969 23.1058,46.8753 22.5065,46.8753L21.6543,46.8753L21.6543,44.9652ZM25.8253,49.8492L27.7907,49.8492C28.9518,49.8492 29.5365,49.1957 29.5365,48.2646C29.5365,47.3602 28.8645,46.9461 28.3881,46.8943C28.8084,46.8185 29.2794,46.2961 29.2794,45.5959C29.2794,44.5639 28.4306,44.2348 27.4995,44.2348L25.8253,44.2348L25.8253,49.8492ZM26.7169,47.3424L27.5985,47.3424C28.2427,47.3424 28.6019,47.6715 28.6019,48.2059C28.6019,48.7031 28.3726,49.1138 27.6449,49.1138L26.7169,49.1138L26.7169,47.3424ZM26.7169,44.9702L27.4346,44.9702C28.0161,44.9702 28.3908,45.1620 28.3908,45.7517C28.3908,46.2022 28.1089,46.6229 27.5274,46.6229L26.7169,46.6229L26.7169,44.9702Z");
      private static final Path NOUN_LABEL=labelPath("M78.2936,49.8492L79.5449,49.8492L79.5449,44.2348L78.6529,44.2348L78.6529,49.0094L78.7112,48.9978L75.9965,44.2348L74.7510,44.2348L74.7510,49.8492L75.6454,49.8492L75.6454,45.0804L75.5847,45.0708L78.2936,49.8492ZM83.4402,44.9772C84.5511,44.9772 85.3279,45.8789 85.3279,47.0377C85.3279,48.1985 84.5511,49.1029 83.4402,49.1029C82.3335,49.1029 81.5498,48.1985 81.5498,47.0377C81.5498,45.8789 82.3335,44.9772 83.4402,44.9772ZM83.4402,49.9513C85.0793,49.9513 86.2555,48.6795 86.2555,47.0377C86.2555,45.4002 85.0561,44.1327 83.4402,44.1327C81.8382,44.1327 80.6202,45.4002 80.6202,47.0377C80.6202,48.6795 81.7841,49.9513 83.4402,49.9513ZM90.7273,47.6622C90.7273,48.5821 90.1910,49.1261 89.4447,49.1261C88.6923,49.1261 88.1513,48.5821 88.1513,47.6622L88.1513,44.2348L87.2593,44.2348L87.2593,47.7098C87.2593,49.0987 88.1451,49.9513 89.4447,49.9513C90.7401,49.9513 91.6217,49.0987 91.6217,47.7098L91.6217,44.2348L90.7273,44.2348L90.7273,47.6622ZM96.4047,49.8492L97.6560,49.8492L97.6560,44.2348L96.7640,44.2348L96.7640,49.0094L96.8223,48.9978L94.1076,44.2348L92.8621,44.2348L92.8621,49.8492L93.7565,49.8492L93.7565,45.0804L93.6958,45.0708L96.4047,49.8492Z");
      // Date legends use fixed League Spartan Medium outlines, the same source
      // family and legend boxes as the native PROG/VERB/NOUN vectors.
      private static final Path YEAR_LABEL=labelPath("M78.0006,7.1801L76.0951,3.586L77.1797,3.586L78.4472,6.1465L79.7104,3.586L80.7908,3.586L78.8938,7.1801L78.8938,9.2004L78.0006,9.2004L78.0006,7.1801ZM81.6275,3.586L85.0302,3.586L85.0302,4.3856L82.5164,4.3856L82.5164,5.9976L84.9876,5.9976L84.9876,6.776L82.5164,6.776L82.5164,8.4008L85.0302,8.4008L85.0302,9.2004L81.6275,9.2004L81.6275,3.586ZM88.0744,3.586L88.9888,3.586L91.107,9.2004L90.1543,9.2004L89.6906,7.9159L87.3768,7.9159L86.909,9.2004L85.952,9.2004L88.0744,3.586ZM87.6661,7.1205L89.4014,7.1205L88.538,4.6749L88.5252,4.6749L87.6661,7.1205ZM91.8757,3.586L93.9386,3.586C94.2476,3.586 94.5276,3.6505 94.7786,3.7795C95.0295,3.9085 95.2287,4.0964 95.3762,4.3431C95.5236,4.5898 95.5974,4.8889 95.5974,5.2405C95.5974,5.5893 95.5307,5.8764 95.3974,6.1018C95.2642,6.3273 95.1033,6.4974 94.9147,6.6122C94.7261,6.7271 94.5525,6.7916 94.3937,6.8058L95.776,9.2004L94.768,9.2004L93.492,6.8738L92.7689,6.8738L92.7689,9.2004L91.8757,9.2004L91.8757,3.586ZM92.7689,6.2273L93.6196,6.2273C93.9201,6.2273 94.1725,6.1522 94.3766,6.0019C94.5808,5.8516 94.6829,5.6063 94.6829,5.2661C94.6829,4.923 94.5815,4.6791 94.3788,4.5345C94.176,4.3899 93.9258,4.3176 93.6281,4.3176L92.7689,4.3176L92.7689,6.2273Z");
      private static final Path MONTH_LABEL=labelPath("M11.0413,44.235L11.0413,49.8494L10.1481,49.8494L10.1481,46.0257L10.1906,45.3068L10.0205,46.115L8.7912,49.4921L7.9108,49.4921L6.6858,46.115L6.5157,45.3068L6.5582,46.0257L6.5582,49.8494L5.665,49.8494L5.665,44.235L6.8858,44.235L8.2894,48.4373L8.3532,48.7733L8.4127,48.4373L9.8248,44.235L11.0413,44.235ZM12.146,47.0379C12.146,46.6296 12.2176,46.249 12.3607,45.8959C12.5039,45.5429 12.7031,45.2345 12.9583,44.9708C13.2135,44.7071 13.512,44.5015 13.8537,44.3541C14.1954,44.2066 14.5661,44.1329 14.9659,44.1329C15.3714,44.1329 15.745,44.2066 16.0867,44.3541C16.4284,44.5015 16.7261,44.7071 16.9799,44.9708C17.2336,45.2345 17.4307,45.5429 17.5711,45.8959C17.7114,46.249 17.7816,46.6296 17.7816,47.0379C17.7816,47.4491 17.7129,47.8312 17.5753,48.1842C17.4378,48.5372 17.2429,48.8463 16.9905,49.1114C16.7381,49.3766 16.4404,49.5829 16.0973,49.7303C15.7542,49.8778 15.3771,49.9515 14.9659,49.9515C14.5519,49.9515 14.1734,49.8778 13.8303,49.7303C13.4872,49.5829 13.1894,49.3766 12.9371,49.1114C12.6847,48.8463 12.4898,48.5372 12.3522,48.1842C12.2147,47.8312 12.146,47.4491 12.146,47.0379ZM13.0774,47.0379C13.0774,47.4236 13.1582,47.7724 13.3199,48.0843C13.4815,48.3962 13.7041,48.6443 13.9876,48.8286C14.2712,49.0129 14.5973,49.1051 14.9659,49.1051C15.3374,49.1051 15.6649,49.0129 15.9484,48.8286C16.232,48.6443 16.4539,48.3962 16.6141,48.0843C16.7743,47.7724 16.8544,47.4236 16.8544,47.0379C16.8544,46.6523 16.7743,46.3035 16.6141,45.9916C16.4539,45.6797 16.232,45.433 15.9484,45.2515C15.6649,45.0701 15.3374,44.9793 14.9659,44.9793C14.5973,44.9793 14.2712,45.0701 13.9876,45.2515C13.7041,45.433 13.4815,45.6797 13.3199,45.9916C13.1582,46.3035 13.0774,46.6523 13.0774,47.0379ZM22.357,49.8494L19.7072,45.1792L19.7072,49.8494L18.814,49.8494L18.814,44.235L20.0602,44.235L22.7186,48.8967L22.7186,44.235L23.6075,44.235L23.6075,49.8494L22.357,49.8494ZM26.0435,45.0346L24.5846,45.0346L24.5846,44.235L28.3998,44.235L28.3998,45.0346L26.941,45.0346L26.941,49.8494L26.0435,49.8494L26.0435,45.0346ZM32.7371,47.4335L30.2744,47.4335L30.2744,49.8494L29.3854,49.8494L29.3854,44.235L30.2744,44.235L30.2744,46.6381L32.7371,46.6381L32.7371,44.235L33.6218,44.235L33.6218,49.8494L32.7371,49.8494L32.7371,47.4335Z");
      private static final Path DAY_LABEL=labelPath("M78.8698,44.235L80.3032,44.235C80.9015,44.235 81.3949,44.3548 81.7833,44.5944C82.1718,44.834 82.461,45.1651 82.651,45.5876C82.841,46.0101 82.936,46.4935 82.936,47.0379C82.936,47.5852 82.8417,48.0701 82.6531,48.4926C82.4646,48.9151 82.1761,49.2468 81.7876,49.4879C81.3991,49.7289 80.9043,49.8494 80.3032,49.8494L78.8698,49.8494L78.8698,44.235ZM79.7587,45.0431L79.7587,49.0413L80.2266,49.0413C80.6293,49.0413 80.961,48.9555 81.2219,48.7839C81.4828,48.6124 81.6756,48.3763 81.8003,48.0758C81.9251,47.7752 81.9889,47.4321 81.9917,47.0465C81.9946,46.6608 81.9329,46.317 81.8067,46.015C81.6805,45.713 81.487,45.4756 81.2261,45.3026C80.9653,45.1296 80.6321,45.0431 80.2266,45.0431L79.7587,45.0431ZM85.759,44.235L86.6735,44.235L88.7917,49.8494L87.8389,49.8494L87.3753,48.5649L85.0615,48.5649L84.5936,49.8494L83.6366,49.8494L85.759,44.235ZM85.3507,47.7695L87.0861,47.7695L86.2226,45.3239L86.2099,45.3239L85.3507,47.7695ZM90.9895,47.8291L89.084,44.235L90.1686,44.235L91.4361,46.7955L92.6993,44.235L93.7796,44.235L91.8827,47.8291L91.8827,49.8494L90.9895,49.8494L90.9895,47.8291Z");
      private static final Path COMP_LABEL=labelPath("M9.4039,14.9030C9.4039,13.7677 10.2081,12.8818 11.4374,12.8818C12.0812,12.8818 12.5962,13.1088 12.8120,13.2809L13.1982,12.5168C12.9399,12.2914 12.2741,11.9979 11.3894,11.9979C9.7306,11.9979 8.4364,13.2728 8.4364,14.9157C8.4364,16.5544 9.7349,17.8165 11.3894,17.8165C12.2741,17.8165 12.9399,17.5230 13.1982,17.2976L12.8120,16.5335C12.5962,16.7056 12.0812,16.9326 11.4374,16.9326C10.2081,16.9326 9.4039,16.0467 9.4039,14.9030ZM16.8480,12.8424C17.9589,12.8424 18.7357,13.7441 18.7357,14.9030C18.7357,16.0637 17.9589,16.9681 16.8480,16.9681C15.7414,16.9681 14.9576,16.0637 14.9576,14.9030C14.9576,13.7441 15.7414,12.8424 16.8480,12.8424ZM16.8480,17.8165C18.4871,17.8165 19.6633,16.5447 19.6633,14.9030C19.6633,13.2654 18.4639,11.9979 16.8480,11.9979C15.2460,11.9979 14.0280,13.2654 14.0280,14.9030C14.0280,16.5447 15.1919,17.8165 16.8480,17.8165ZM24.8512,12.1000L23.4391,16.3042L23.3780,16.6387L23.3169,16.3042L21.9095,12.1000L20.6899,12.1000L20.6899,17.7144L21.5843,17.7144L21.5843,13.8918L21.5417,13.1734L21.7107,13.9788L22.9365,17.3556L23.8177,17.3556L25.0453,13.9788L25.2166,13.1734L25.1741,13.8918L25.1741,17.7144L26.0661,17.7144L26.0661,12.1000L24.8512,12.1000ZM27.4690,17.7144L28.3633,17.7144L28.3633,15.5317L29.1970,15.5317C30.2549,15.5317 31.0886,14.9436 31.0886,13.7812C31.0886,12.6166 30.2549,12.1000 29.1970,12.1000L27.4690,12.1000L27.4690,17.7144ZM28.3633,12.8304L28.9511,12.8304C29.6061,12.8304 30.1377,13.0620 30.1377,13.8006C30.1377,14.5368 29.6061,14.8013 28.9511,14.8013L28.3633,14.8013L28.3633,12.8304Z");
      private static final Path ACTY_LABEL=labelPath("M9.6239,24.2868L10.5821,24.2868L11.0503,23.0043L13.3645,23.0043L13.8262,24.2868L14.7801,24.2868L12.6612,18.6724L11.7498,18.6724L9.6239,24.2868ZM12.2010,19.7621L12.2138,19.7621L13.0761,22.2062L11.3411,22.2062L12.2010,19.7621ZM16.3388,21.4754C16.3388,20.3401 17.1430,19.4543 18.3722,19.4543C19.0160,19.4543 19.5311,19.6812 19.7468,19.8533L20.1331,19.0892C19.8748,18.8638 19.2090,18.5703 18.3243,18.5703C16.6655,18.5703 15.3713,19.8452 15.3713,21.4881C15.3713,23.1268 16.6697,24.3889 18.3243,24.3889C19.2090,24.3889 19.8748,24.0954 20.1331,23.8700L19.7468,23.1059C19.5311,23.2780 19.0160,23.5050 18.3722,23.5050C17.1430,23.5050 16.3388,22.6191 16.3388,21.4754ZM22.3360,24.2868L23.2326,24.2868L23.2326,19.4705L24.6931,19.4705L24.6931,18.6724L20.8755,18.6724L20.8755,19.4705L22.3360,19.4705L22.3360,24.2868ZM27.1109,24.2868L28.0076,24.2868L28.0076,22.2665L29.9011,18.6724L28.8227,18.6724L27.5583,21.2325L26.2912,18.6724L25.2089,18.6724L27.1109,22.2665L27.1109,24.2868Z");
      static{
        ON.setStyle(Paint.Style.FILL);ON.setColor(CORE);
        PANEL_P.setStyle(Paint.Style.FILL);PANEL_P.setColor(PANEL);
        // Black display legends use fixed outlines, avoiding device-dependent fonts.
        LABEL_P.setStyle(Paint.Style.FILL);LABEL_P.setColor(INK);
        RULE_P.setStyle(Paint.Style.FILL);RULE_P.setColor(RULE);RULE_P.setAlpha(224);
        
        LEGEND_BG_P.setStyle(Paint.Style.FILL);LEGEND_BG_P.setColor(CORE);LEGEND_BG_P.setAlpha(235);
        HARDWARE_STROKE_P.setStyle(Paint.Style.STROKE);HARDWARE_STROKE_P.setStrokeWidth(.48f);HARDWARE_STROKE_P.setColor(HARDWARE);HARDWARE_STROKE_P.setAlpha(184);
        HARDWARE_FILL_P.setStyle(Paint.Style.FILL);HARDWARE_FILL_P.setColor(HARDWARE);HARDWARE_FILL_P.setAlpha(224);
      }
      static Bitmap render(int width,int height,Calendar now,boolean drawRegisters,boolean date){
        width=Math.max(1,width);height=Math.max(1,height);
        String key=width+"x"+height+(date?(":date:"+now.get(Calendar.YEAR)+":"+now.get(Calendar.MONTH)+":"+now.get(Calendar.DAY_OF_MONTH)):":classic")+(drawRegisters?(":time:"+now.get(Calendar.HOUR_OF_DAY)+":"+now.get(Calendar.MINUTE)+":"+now.get(Calendar.SECOND)):":animated");
        synchronized(BITMAP_CACHE){Bitmap cached=BITMAP_CACHE.get(key);if(cached!=null&&!cached.isRecycled())return cached;}
        Bitmap b=Bitmap.createBitmap(width,height,Bitmap.Config.ARGB_8888);Canvas c=new Canvas(b);c.drawColor(FRAME);c.scale(width/PANEL_W,height/PANEL_H);drawPanel(c,now,drawRegisters,date);
        synchronized(BITMAP_CACHE){BITMAP_CACHE.put(key,b);}return b;
      }
      private static void drawPanel(Canvas c,Calendar now,boolean drawRegisters,boolean date){
        c.drawPath(box(.24f,.24f,PANEL_W-.48f,PANEL_H-.48f),HARDWARE_STROKE_P);
        c.drawPath(box(ACTIVE_X+FRAME_X,ACTIVE_Y,ACTIVE_W-FRAME_X,ACTIVE_H),PANEL_P);
        c.save();
        c.translate(ACTIVE_X,ACTIVE_Y);
        dot(c,53.000f,6.914f,1.294f,1.369f);dot(c,53.000f,43.427f,1.294f,1.369f);dot(c,53.000f,79.949f,1.294f,1.369f);
        dot(c,100.863f,79.949f,1.294f,1.369f);dot(c,100.863f,114.085f,1.294f,1.369f);dot(c,100.863f,148.220f,1.294f,1.369f);
        dot(c,8.286f,148.220f,1.294f,1.369f);dot(c,8.286f,114.085f,1.294f,1.369f);dot(c,8.286f,79.949f,1.294f,1.369f);
        section(c,66.441f,.554f,39.525f,11.678f,LEGEND_BG_P);c.drawPath(date?YEAR_LABEL:PROG_LABEL,LABEL_P);
        section(c,0f,41.203f,39.525f,11.678f,LEGEND_BG_P);c.drawPath(date?MONTH_LABEL:VERB_LABEL,LABEL_P);
        section(c,66.441f,41.203f,39.525f,11.678f,LEGEND_BG_P);c.drawPath(date?DAY_LABEL:NOUN_LABEL,LABEL_P);
        // COMP ACTY stays printed; its dormant EL phosphor remains absent in both clock widgets.
        c.drawPath(COMP_LABEL,LABEL_P);c.drawPath(ACTY_LABEL,LABEL_P);
        rule(c,.020841f,78.602f,97.911123f,2.695f);rule(c,9.726333f,112.737f,88.205631f,2.695f);rule(c,9.726333f,146.873f,88.205631f,2.695f);
        if(date){digits(c,String.format(Locale.US,"%02d",now.get(Calendar.YEAR)%100),RIGHT_FIELD_X,PROG_Y);digits(c,String.format(Locale.US,"%02d",now.get(Calendar.MONTH)+1),LEFT_FIELD_X,VERB_NOUN_Y);digits(c,String.format(Locale.US,"%02d",now.get(Calendar.DAY_OF_MONTH)),RIGHT_FIELD_X,VERB_NOUN_Y);}
        if(drawRegisters){register(c,'+',five(now.get(Calendar.HOUR_OF_DAY)),REGISTER_ROW_X,R1_Y);register(c,'+',five(now.get(Calendar.MINUTE)),REGISTER_ROW_X,R2_Y);register(c,'+',five(now.get(Calendar.SECOND)),REGISTER_ROW_X,R3_Y);}
        c.restore();
      }
      private static String five(int v){return String.format(Locale.US,"%05d",v);}
      private static Path labelPath(String d){
        Path path=new Path();
        SvgPathParser.parse(d,new SvgPathParser.Sink(){
          @Override public void moveTo(float x,float y){path.moveTo(x,y);}
          @Override public void lineTo(float x,float y){path.lineTo(x,y);}
          @Override public void cubicTo(float x1,float y1,float x2,float y2,float x,float y){path.cubicTo(x1,y1,x2,y2,x,y);}
          @Override public void close(){path.close();}
        });
        return path;
      }
      private static void section(Canvas c,float x,float y,float w,float h,Paint p){c.drawPath(box(x,y,w,h),p);}
      private static void rule(Canvas c,float x,float y,float w,float h){c.drawPath(box(x,y,w,h),RULE_P);}
      private static void dot(Canvas c,float cx,float cy,float rx,float ry){Path p=new Path();for(int i=0;i<12;i++){double a=Math.PI*2d*i/12d;float x=cx+(float)Math.cos(a)*rx,y=cy+(float)Math.sin(a)*ry;if(i==0)p.moveTo(x,y);else p.lineTo(x,y);}p.close();c.drawPath(p,HARDWARE_FILL_P);}
      private static void digits(Canvas c,String s,float x,float y){for(int i=0;i<s.length();i++)digit(c,s.charAt(i),x+i*UPPER_ADV,y);}
      private static void register(Canvas c,char sign,String s,float x,float y){sign(c,sign,x,y);for(int i=0;i<s.length();i++)digit(c,s.charAt(i),x+FIRST_DIGIT_X+i*REG_ADV,y);}
      private static void digit(Canvas c,char ch,float ox,float oy){String lit=WidgetRelayModel.segmentsForDigit(ch);for(int l=0;l<7;l++)if(lit.indexOf((char)('a'+l))>=0)c.drawPath(segmentPath(l,ox,oy),ON);}
      private static float sx(float ox,float xIn){return ox+xIn*U;}
      private static float sy(float oy,float yIn){return oy+(yIn-DIGIT_TOP_IN)*U;}
      private static void ml(Path p,float ox,float oy,float xIn,float yIn,boolean move){float x=sx(ox,xIn),y=sy(oy,yIn);if(move)p.moveTo(x,y);else p.lineTo(x,y);}
      private static Path segmentPath(int logical,float ox,float oy){
        Path p=new Path();
        switch(logical){
          case 0: // a: physical E / top
            ml(p,ox,oy,.199003944f,.032239891f,true);ml(p,ox,oy,.236689000f,.097239891f,false);ml(p,ox,oy,.410356000f,.097239891f,false);ml(p,ox,oy,.427798000f,.032239891f,false);break;
          case 1: // b: physical H / upper right
            ml(p,ox,oy,.438152000f,.032239891f,true);ml(p,ox,oy,.370443000f,.284562891f,false);ml(p,ox,oy,.437742000f,.284562891f,false);ml(p,ox,oy,.505451000f,.032239891f,false);break;
          case 2: // c: physical M / lower right
            ml(p,ox,oy,.435059000f,.294562891f,true);ml(p,ox,oy,.367759000f,.294562891f,false);ml(p,ox,oy,.325740000f,.451148891f,false);ml(p,ox,oy,.371746000f,.530501891f,false);break;
          case 3: // d: physical N / bottom
            ml(p,ox,oy,.138381000f,.462239891f,true);ml(p,ox,oy,.068381000f,.532239891f,false);ml(p,ox,oy,.361195000f,.532239891f,false);ml(p,ox,oy,.322764000f,.462239891f,false);break;
          case 4: // e: physical K / lower left
            ml(p,ox,oy,.117759000f,.294562891f,true);ml(p,ox,oy,.053885898f,.532591879f,false);ml(p,ox,oy,.145868000f,.440610891f,false);ml(p,ox,oy,.185059000f,.294562891f,false);break;
          case 5: // f: physical F / upper left
            ml(p,ox,oy,.187742000f,.284562891f,true);ml(p,ox,oy,.233934000f,.112425891f,false);ml(p,ox,oy,.188151849f,.032240581f,false);ml(p,ox,oy,.120443000f,.284562891f,false);break;
          case 6: // g: physical J / middle
            ml(p,ox,oy,.206770000f,.252239891f,true);ml(p,ox,oy,.189327000f,.317239891f,false);ml(p,ox,oy,.351320000f,.317239891f,false);ml(p,ox,oy,.368762000f,.252239891f,false);break;
          default: return p;
        }
        p.close();return p;
      }
      private static void sign(Canvas c,char s,float ox,float oy){
        if(s!='+'&&s!='-')return;
        c.drawPath(rawBox(ox,oy,-.024223f,.231536f,.265000f,.065000f),ON);
        if(s=='+'){
          c.drawPath(rawBox(ox,oy,.073794f,.306536f,.065000f,.126500f),ON);
          c.drawPath(rawBox(ox,oy,.073794f,.095036f,.065000f,.126500f),ON);
        }
      }
      private static Path rawBox(float ox,float oy,float xIn,float yIn,float wIn,float hIn){Path p=new Path();float x=sx(ox,xIn),y=sy(oy,yIn),w=wIn*U,h=hIn*U;p.moveTo(x,y);p.lineTo(x+w,y);p.lineTo(x+w,y+h);p.lineTo(x,y+h);p.close();return p;}
      private static Path box(float x,float y,float w,float h){Path p=new Path();p.moveTo(x,y);p.lineTo(x+w,y);p.lineTo(x+w,y+h);p.lineTo(x,y+h);p.close();return p;}
    }
}
