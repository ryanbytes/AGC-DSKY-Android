package org.apollo.agcdsky;

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
import android.graphics.Typeface;
import android.os.Build;
import android.os.Bundle;
import android.util.TypedValue;
import android.util.LruCache;
import android.widget.RemoteViews;
import java.util.Calendar;
import java.util.Locale;

public final class ElWidgetProvider extends AppWidgetProvider {
    private static final String ACTION_TICK="org.apollo.agcdsky.EL_WIDGET_TICK";
    private static final long MINUTE_MS=60_000L;
    private static final int TICK_REQUEST_CODE=21;

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

    @Override public void onEnabled(Context context){super.onEnabled(context);scheduleNextMinute(context);}
    @Override public void onDisabled(Context context){cancelTick(context);super.onDisabled(context);}
    @Override public void onUpdate(Context context,AppWidgetManager manager,int[] ids){NtpTime.start(context);for(int id:ids)updateOne(context,manager,id);if(ids.length>0)scheduleNextMinute(context);}
    @Override public void onAppWidgetOptionsChanged(Context context,AppWidgetManager manager,int appWidgetId,Bundle newOptions){super.onAppWidgetOptionsChanged(context,manager,appWidgetId,newOptions);updateOne(context,manager,appWidgetId);}
    @Override public void onReceive(Context context,Intent intent){super.onReceive(context,intent);String action=intent.getAction();if(!ACTION_TICK.equals(action)&&!Intent.ACTION_TIME_CHANGED.equals(action)&&!Intent.ACTION_TIMEZONE_CHANGED.equals(action)&&!Intent.ACTION_DATE_CHANGED.equals(action)&&!Intent.ACTION_MY_PACKAGE_REPLACED.equals(action))return;AppWidgetManager manager=AppWidgetManager.getInstance(context);int[] ids=manager.getAppWidgetIds(new ComponentName(context,ElWidgetProvider.class));for(int id:ids)updateOne(context,manager,id);if(ids.length>0)scheduleNextMinute(context);else cancelTick(context);}

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
      boolean staticFallbackRegisters=Build.VERSION.SDK_INT<31;
      views.setImageViewBitmap(R.id.el_widget_image,ElRenderer.render(panelWidthPx,panelHeightPx,now,staticFallbackRegisters));
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
        int[] flippers={R.id.el_hour_flipper,R.id.el_minute_flipper,R.id.el_seconds_flipper};
        float[] y={R1_Y,R2_Y,R3_Y};
        for(int i=0;i<flippers.length;i++){
          views.setViewLayoutMargin(flippers[i],RemoteViews.MARGIN_START,ACTIVE_X*scaleDp,TypedValue.COMPLEX_UNIT_DIP);
          views.setViewLayoutMargin(flippers[i],RemoteViews.MARGIN_TOP,(ACTIVE_Y+y[i])*scaleDp,TypedValue.COMPLEX_UNIT_DIP);
          views.setViewLayoutWidth(flippers[i],ACTIVE_W*scaleDp,TypedValue.COMPLEX_UNIT_DIP);
          views.setViewLayoutHeight(flippers[i],FRAME_H*scaleDp,TypedValue.COMPLEX_UNIT_DIP);
        }
      }
      Intent launch=new Intent(context,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP);
      PendingIntent openApp=PendingIntent.getActivity(context,appWidgetId,launch,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
      views.setOnClickPendingIntent(R.id.el_widget_root,openApp);
      manager.updateAppWidget(appWidgetId,views);
    }

    private static RemoteViews.RemoteCollectionItems buildFrames(Context context,int count){RemoteViews.RemoteCollectionItems.Builder builder=new RemoteViews.RemoteCollectionItems.Builder();for(int i=0;i<count;i++){RemoteViews frame=new RemoteViews(context.getPackageName(),R.layout.el_second_frame);frame.setImageViewResource(R.id.el_second_image,SECOND_DRAWABLES[i]);builder.addItem(i,frame);}return builder.build();}
    private static PendingIntent tickIntent(Context context){Intent tick=new Intent(context,ElWidgetProvider.class).setAction(ACTION_TICK);return PendingIntent.getBroadcast(context,TICK_REQUEST_CODE,tick,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
    private static void scheduleNextMinute(Context context){AlarmManager alarm=(AlarmManager)context.getSystemService(Context.ALARM_SERVICE);if(alarm==null)return;long now=System.currentTimeMillis(),next=now-(now%MINUTE_MS)+MINUTE_MS;PendingIntent pi=tickIntent(context);if(Build.VERSION.SDK_INT<31||alarm.canScheduleExactAlarms())alarm.setExactAndAllowWhileIdle(AlarmManager.RTC,next,pi);else alarm.setAndAllowWhileIdle(AlarmManager.RTC,next,pi);}
    private static void cancelTick(Context context){AlarmManager alarm=(AlarmManager)context.getSystemService(Context.ALARM_SERVICE);if(alarm!=null)alarm.cancel(tickIntent(context));}
    private static int clamp(int v,int lo,int hi){return Math.max(lo,Math.min(hi,v));}

    static final class ElRenderer{
      private static final int CACHE_KIB=4096;
      private static final LruCache<String,Bitmap> BITMAP_CACHE=new LruCache<String,Bitmap>(CACHE_KIB){
        @Override protected int sizeOf(String key,Bitmap value){return Math.max(1,value.getAllocationByteCount()/1024);}
      };
      private static final int CORE=Color.rgb(109,236,180),RULE=CORE;
      private static final int FRAME=Color.rgb(86,90,86),PANEL=Color.rgb(105,109,103),HARDWARE=Color.rgb(162,166,159),INK=Color.rgb(5,6,5);

      // MIT/IL SCD 1006315G geometry transcribed from the drawing-backed
      // 1006315G-exact.step model. Coordinates below are inches in the STEP
      // component datum; U converts them uniformly into the 106-unit face.
      private static final float U=106f/2.360f,DIGIT_TOP_IN=.0322398905f;
      private static final float DIGIT_H=.500f*U,UPPER_ADV=.420f*U,REG_ADV=.410f*U,FIRST_DIGIT_X=.180f*U,REGISTER_ROW_X=-.010f*U;
      private static final float LEFT_FIELD_X=-.035451f*U,RIGHT_FIELD_X=1.434549f*U;
      private static final float PROG_Y=.315f*U,VERB_NOUN_Y=1.220f*U;

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
        COMP_BG_P.setStyle(Paint.Style.FILL);COMP_BG_P.setColor(CORE);COMP_BG_P.setAlpha(24);
        HARDWARE_STROKE_P.setStyle(Paint.Style.STROKE);HARDWARE_STROKE_P.setStrokeWidth(.48f);HARDWARE_STROKE_P.setColor(HARDWARE);HARDWARE_STROKE_P.setAlpha(184);
        HARDWARE_FILL_P.setStyle(Paint.Style.FILL);HARDWARE_FILL_P.setColor(HARDWARE);HARDWARE_FILL_P.setAlpha(224);
      }
      static Bitmap render(int width,int height,Calendar now,boolean drawRegisters){
        width=Math.max(1,width);height=Math.max(1,height);
        String key=width+"x"+height+(drawRegisters?((":dyn:"+now.get(Calendar.HOUR_OF_DAY)+":"+now.get(Calendar.MINUTE)+":"+now.get(Calendar.SECOND))):":static");
        synchronized(BITMAP_CACHE){Bitmap cached=BITMAP_CACHE.get(key);if(cached!=null&&!cached.isRecycled())return cached;}
        Bitmap b=Bitmap.createBitmap(width,height,Bitmap.Config.ARGB_8888);Canvas c=new Canvas(b);c.drawColor(FRAME);c.scale(width/PANEL_W,height/PANEL_H);drawPanel(c,now,drawRegisters);
        synchronized(BITMAP_CACHE){BITMAP_CACHE.put(key,b);}return b;
      }
      private static void drawPanel(Canvas c,Calendar now,boolean drawRegisters){
        c.drawPath(box(.24f,.24f,PANEL_W-.48f,PANEL_H-.48f),HARDWARE_STROKE_P);
        c.drawPath(box(ACTIVE_X,ACTIVE_Y,ACTIVE_W,ACTIVE_H),PANEL_P);
        c.save();
        c.translate(ACTIVE_X,ACTIVE_Y);
        dot(c,53.000f,6.914f,1.294f,1.369f);dot(c,53.000f,43.427f,1.294f,1.369f);dot(c,53.000f,79.949f,1.294f,1.369f);
        dot(c,100.863f,79.949f,1.294f,1.369f);dot(c,100.863f,114.085f,1.294f,1.369f);dot(c,100.863f,148.220f,1.294f,1.369f);
        dot(c,8.286f,148.220f,1.294f,1.369f);dot(c,8.286f,114.085f,1.294f,1.369f);dot(c,8.286f,79.949f,1.294f,1.369f);
        section(c,66.441f,.554f,39.525f,11.678f,LEGEND_BG_P);c.drawText("PROG",86.237f,8.600f,LABEL_P);
        section(c,0f,41.203f,39.525f,11.678f,LEGEND_BG_P);c.drawText("VERB",19.763f,49.252f,LABEL_P);
        section(c,66.441f,41.203f,39.525f,11.678f,LEGEND_BG_P);c.drawText("NOUN",86.237f,49.252f,LABEL_P);
        section(c,0f,.633f,39.525f,35.838f,COMP_BG_P);c.drawText("COMP",19.763f,17.900f,COMP_P);c.drawText("ACTY",19.763f,25.000f,COMP_P);
        rule(c,12.770f,78.602f,84.900f,2.695f);rule(c,12.770f,112.737f,84.900f,2.695f);rule(c,12.770f,146.873f,84.900f,2.695f);
        digits(c,"00",RIGHT_FIELD_X,PROG_Y);digits(c,"16",LEFT_FIELD_X,VERB_NOUN_Y);digits(c,"65",RIGHT_FIELD_X,VERB_NOUN_Y);
        if(drawRegisters){register(c,'+',five(now.get(Calendar.HOUR_OF_DAY)),REGISTER_ROW_X,R1_Y);register(c,'+',five(now.get(Calendar.MINUTE)),REGISTER_ROW_X,R2_Y);register(c,'+',five(now.get(Calendar.SECOND)),REGISTER_ROW_X,R3_Y);}
        c.restore();
      }
      private static String five(int v){return String.format(Locale.US,"%05d",v);}
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
          case 0:
            ml(p,ox,oy,.420955898f,.102240f,true);ml(p,ox,oy,.490955898f,.032240f,false);ml(p,ox,oy,.198141898f,.032240f,false);ml(p,ox,oy,.236572898f,.102240f,false);break;
          case 1:
            ml(p,ox,oy,.124277898f,.269917f,true);ml(p,ox,oy,.191577898f,.269917f,false);ml(p,ox,oy,.2335968980f,.113331f,false);ml(p,ox,oy,.187590898f,.033978f,false);break;
          case 2:
            ml(p,ox,oy,.121184898f,.532240f,true);ml(p,ox,oy,.188893898f,.279917f,false);ml(p,ox,oy,.121594898f,.279917f,false);ml(p,ox,oy,.505451f,.532240f,false);break;
          case 3:
            ml(p,ox,oy,.360332954f,.532240f,true);ml(p,ox,oy,.322647898f,.467240f,false);ml(p,ox,oy,.148980898f,.467240f,false);ml(p,ox,oy,.131538898f,.532240f,false);break;
          case 4:
            ml(p,ox,oy,.371594898f,.279917f,true);ml(p,ox,oy,.325402898f,.452054f,false);ml(p,ox,oy,.371185049f,.532239310f,false);ml(p,ox,oy,.438893898f,.279917f,false);break;
          case 5:
            ml(p,ox,oy,.441577898f,.269917f,true);ml(p,ox,oy,.505451f,.031888012f,false);ml(p,ox,oy,.413468898f,.123869f,false);ml(p,ox,oy,.374277898f,.269917f,false);break;
          case 6:
            ml(p,ox,oy,.3525668980f,.312240f,true);ml(p,ox,oy,.370009898f,.247240f,false);ml(p,ox,oy,.2080168980f,.247240f,false);ml(p,ox,oy,.190574898f,.312240f,false);break;
          default: return p;
        }
        p.close();return p;
      }
      private static void sign(Canvas c,char s,float ox,float oy){
        if(s!='+'&&s!='-')return;
        c.drawPath(rawBox(ox,oy,-.007784f,.231536f,.232122f,.065000f),ON);
        if(s=='+'){
          c.drawPath(rawBox(ox,oy,.073794f,.305065f,.065000f,.082843f),ON);
          c.drawPath(rawBox(ox,oy,.073794f,.139908f,.065000f,.081628f),ON);
        }
      }
      private static Path rawBox(float ox,float oy,float xIn,float yIn,float wIn,float hIn){Path p=new Path();float x=sx(ox,xIn),y=sy(oy,yIn),w=wIn*U,h=hIn*U;p.moveTo(x,y);p.lineTo(x+w,y);p.lineTo(x+w,y+h);p.lineTo(x,y+h);p.close();return p;}
      private static Path box(float x,float y,float w,float h){Path p=new Path();p.moveTo(x,y);p.lineTo(x+w,y);p.lineTo(x+w,y+h);p.lineTo(x,y+h);p.close();return p;}
    }
}