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
import android.widget.RemoteViews;

import java.util.Calendar;
import java.util.Locale;

/** Home-screen widget containing only the DSKY EL readout. */
public final class ElWidgetProvider extends AppWidgetProvider {
    private static final String ACTION_TICK = "org.apollo.agcdsky.EL_WIDGET_TICK";
    private static final long MINUTE_MS = 60_000L;
    private static final int TICK_REQUEST_CODE = 21;
    private static final float PANEL_W = 106f;
    private static final float PANEL_H = 190f;
    private static final int[] SECOND_DRAWABLES = {
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
            R.drawable.el_sec_55,R.drawable.el_sec_56,R.drawable.el_sec_57,R.drawable.el_sec_58,R.drawable.el_sec_59
    };

    @Override public void onEnabled(Context context) {
        super.onEnabled(context);
        scheduleNextMinute(context);
    }

    @Override public void onDisabled(Context context) {
        cancelTick(context);
        super.onDisabled(context);
    }

    @Override public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) updateOne(context, manager, id);
        if (ids.length > 0) scheduleNextMinute(context);
    }

    @Override public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager,
            int appWidgetId, Bundle newOptions) {
        super.onAppWidgetOptionsChanged(context, manager, appWidgetId, newOptions);
        updateOne(context, manager, appWidgetId);
    }

    @Override public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent.getAction();
        if (!ACTION_TICK.equals(action)
                && !Intent.ACTION_TIME_CHANGED.equals(action)
                && !Intent.ACTION_TIMEZONE_CHANGED.equals(action)
                && !Intent.ACTION_DATE_CHANGED.equals(action)) return;
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, ElWidgetProvider.class));
        for (int id : ids) updateOne(context, manager, id);
        if (ids.length > 0) scheduleNextMinute(context); else cancelTick(context);
    }

    private static void updateOne(Context context, AppWidgetManager manager, int appWidgetId) {
        Bundle options = manager.getAppWidgetOptions(appWidgetId);
        int widthDp = Math.max(80, options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 110));
        int heightDp = Math.max(100, options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 190));
        float scaleDp = Math.min(widthDp / PANEL_W, heightDp / PANEL_H);
        float panelWidthDp = PANEL_W * scaleDp;
        float panelHeightDp = PANEL_H * scaleDp;
        float density = context.getResources().getDisplayMetrics().density;
        int panelWidthPx = clamp(Math.round(panelWidthDp * density), 1, 1200);
        int panelHeightPx = clamp(Math.round(panelHeightDp * density), 1, 1800);

        Calendar now = Calendar.getInstance();
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.el_widget);
        boolean staticFallbackRegisters = Build.VERSION.SDK_INT < 31;
        views.setImageViewBitmap(R.id.el_widget_image,
                ElRenderer.render(panelWidthPx, panelHeightPx, now, staticFallbackRegisters));

        // Android 12+ lets the provider supply in-memory collection items to
        // AdapterViewFlipper. Each register is therefore an exact vector image
        // advanced by the launcher host rather than text rendered with a system
        // font. The minute refresh below re-synchronizes the flippers to wall time.
        if (Build.VERSION.SDK_INT >= 31) {
            RemoteViews.RemoteCollectionItems pairFrames = buildFrames(context, 60);
            RemoteViews.RemoteCollectionItems hourFrames = buildFrames(context, 24);
            views.setRemoteAdapter(R.id.el_hour_flipper, hourFrames);
            views.setRemoteAdapter(R.id.el_minute_flipper, pairFrames);
            views.setRemoteAdapter(R.id.el_seconds_flipper, pairFrames);
            views.setDisplayedChild(R.id.el_hour_flipper, now.get(Calendar.HOUR_OF_DAY));
            views.setDisplayedChild(R.id.el_minute_flipper, now.get(Calendar.MINUTE));
            views.setDisplayedChild(R.id.el_seconds_flipper, now.get(Calendar.SECOND));

            views.setViewLayoutWidth(R.id.el_widget_panel, panelWidthDp, TypedValue.COMPLEX_UNIT_DIP);
            views.setViewLayoutHeight(R.id.el_widget_panel, panelHeightDp, TypedValue.COMPLEX_UNIT_DIP);
            int[] flippers = {R.id.el_hour_flipper, R.id.el_minute_flipper, R.id.el_seconds_flipper};
            float[] y = {97f, 131f, 165f};
            for (int i = 0; i < flippers.length; i++) {
                views.setViewLayoutMargin(flippers[i], RemoteViews.MARGIN_START,
                        3f * scaleDp, TypedValue.COMPLEX_UNIT_DIP);
                views.setViewLayoutMargin(flippers[i], RemoteViews.MARGIN_TOP,
                        y[i] * scaleDp, TypedValue.COMPLEX_UNIT_DIP);
                views.setViewLayoutWidth(flippers[i], 100f * scaleDp, TypedValue.COMPLEX_UNIT_DIP);
                views.setViewLayoutHeight(flippers[i], 21f * scaleDp, TypedValue.COMPLEX_UNIT_DIP);
            }
        }

        Intent launch = new Intent(context, MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openApp = PendingIntent.getActivity(context, appWidgetId, launch,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.el_widget_root, openApp);
        manager.updateAppWidget(appWidgetId, views);
    }

    private static RemoteViews.RemoteCollectionItems buildFrames(Context context, int count) {
        RemoteViews.RemoteCollectionItems.Builder builder =
                new RemoteViews.RemoteCollectionItems.Builder();
        for (int i = 0; i < count; i++) {
            RemoteViews frame = new RemoteViews(context.getPackageName(), R.layout.el_second_frame);
            frame.setImageViewResource(R.id.el_second_image, SECOND_DRAWABLES[i]);
            builder.addItem(i, frame);
        }
        return builder.build();
    }

    private static PendingIntent tickIntent(Context context) {
        Intent tick = new Intent(context, ElWidgetProvider.class).setAction(ACTION_TICK);
        return PendingIntent.getBroadcast(context, TICK_REQUEST_CODE, tick,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void scheduleNextMinute(Context context) {
        AlarmManager alarm = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarm == null) return;
        long now = System.currentTimeMillis();
        long next = now - (now % MINUTE_MS) + MINUTE_MS;
        PendingIntent pi = tickIntent(context);
        if (Build.VERSION.SDK_INT < 31 || alarm.canScheduleExactAlarms()) {
            alarm.setExactAndAllowWhileIdle(AlarmManager.RTC, next, pi);
        } else {
            alarm.setAndAllowWhileIdle(AlarmManager.RTC, next, pi);
        }
    }

    private static void cancelTick(Context context) {
        AlarmManager alarm = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarm != null) alarm.cancel(tickIntent(context));
    }

    private static int clamp(int v, int lo, int hi) { return Math.max(lo, Math.min(hi, v)); }

    static final class ElRenderer {
        private static final int CORE = Color.rgb(201,245,189);
        private static final int LABEL = Color.rgb(172,220,167);
        private static final int RULE = Color.rgb(181,230,172);
        private static final int OFF = Color.rgb(28,39,28);
        private static final float SRC_X=88.116524f,SRC_Y=85.303059f,SRC_W=11.685430f,SRC_H=12.7f;
        private static final float SRC_PITCH=10.668f,DIGIT_SCALE=1.58f,MIRROR_X=2f*SRC_X+SRC_W;
        private static final float ADVANCE=SRC_PITCH*DIGIT_SCALE,DIGIT_H=SRC_H*DIGIT_SCALE,FIRST_DIGIT_X=12f;
        private static final float[][][] SOURCE={
            {{95.137274f,86.827056f},{96.244524f,85.303059f},{90.088724f,85.303059f},{90.497084f,86.827056f}},
            {{91.361734f,91.526056f},{89.694284f,85.303059f},{88.116524f,85.303059f},{89.783974f,91.526056f}},
            {{89.886064f,91.907059f},{91.463824f,91.907059f},{92.620814f,96.224998f},{91.456914f,97.769549f}},
            {{93.002124f,96.352056f},{91.758014f,98.003059f},{99.570014f,98.003059f},{97.418394f,96.352056f}},
            {{95.390774f,87.126332f},{96.543434f,85.539832f},{98.147444f,91.526056f},{96.569684f,91.526056f}},
            {{96.671774f,91.907059f},{98.249534f,91.907059f},{99.801954f,97.700791f},{97.815844f,96.176791f}},
            {{96.005094f,90.891059f},{96.447474f,92.542059f},{92.028414f,92.542059f},{91.586024f,90.891059f}}
        };
        private static final int[] MAP={0,1,2,3,5,4,6};
        private static final String[] SEG={"abcdef","bc","abdeg","abcdg","bcfg","acdfg","acdefg","abc","abcdefg","abcdfg"};
        private static final float SIGN_W=6.731f*DIGIT_SCALE,SIGN_T=1.524f*DIGIT_SCALE,
                SIGN_ARM=3.175f*DIGIT_SCALE,SIGN_GAP=.381f*DIGIT_SCALE;
        private static final float SIGN_H=2f*SIGN_ARM+SIGN_T+2f*SIGN_GAP;
        private static final float SIGN_TOP=(DIGIT_H-SIGN_H)*.5f,SIGN_X=.4f,
                SIGN_VX=SIGN_X+(SIGN_W-SIGN_T)*.5f,SIGN_HY=SIGN_TOP+SIGN_ARM+SIGN_GAP;
        private static final Paint ON=new Paint(Paint.ANTI_ALIAS_FLAG),LABEL_P=new Paint(Paint.ANTI_ALIAS_FLAG),
                RULE_P=new Paint(Paint.ANTI_ALIAS_FLAG),COMP_P=new Paint(Paint.ANTI_ALIAS_FLAG);
        static {
            ON.setStyle(Paint.Style.FILL); ON.setColor(CORE); ON.setShadowLayer(.75f,0,0,CORE);
            Typeface tf=Typeface.create("sans-serif-condensed",Typeface.BOLD);
            LABEL_P.setTypeface(tf); LABEL_P.setTextAlign(Paint.Align.CENTER); LABEL_P.setTextSize(5.1f); LABEL_P.setColor(LABEL); LABEL_P.setAlpha(220);
            RULE_P.setStyle(Paint.Style.FILL); RULE_P.setColor(RULE); RULE_P.setAlpha(212);
            COMP_P.setTypeface(tf); COMP_P.setTextAlign(Paint.Align.CENTER); COMP_P.setTextSize(4.9f); COMP_P.setColor(OFF); COMP_P.setAlpha(150);
        }
        static Bitmap render(int width,int height,Calendar now,boolean drawRegisters){
            Bitmap b=Bitmap.createBitmap(Math.max(1,width),Math.max(1,height),Bitmap.Config.ARGB_8888);
            Canvas c=new Canvas(b); c.drawColor(Color.BLACK); c.scale(width/PANEL_W,height/PANEL_H); drawPanel(c,now,drawRegisters); return b;
        }
        private static void drawPanel(Canvas c,Calendar now,boolean drawRegisters){
            c.drawText("PROG",87,9,LABEL_P); c.drawText("VERB",20,54,LABEL_P); c.drawText("NOUN",87,54,LABEL_P);
            rule(c,12,89,82,1.524f); rule(c,12,125,82,1.524f); rule(c,12,159,82,1.524f);
            c.drawText("COMP",19,14,COMP_P); c.drawText("ACTY",19,22,COMP_P);
            digits(c,"00",68,14); digits(c,"16",3,59); digits(c,"65",68,59);
            if (drawRegisters) {
                register(c,'+',five(now.get(Calendar.HOUR_OF_DAY)),3,97);
                register(c,'+',five(now.get(Calendar.MINUTE)),3,131);
                register(c,'+',five(now.get(Calendar.SECOND)),3,165);
            }
        }
        private static String five(int v){ return String.format(Locale.US,"%05d",v); }
        private static void rule(Canvas c,float x,float y,float w,float h){ Path p=box(x,y,w,h); c.drawPath(p,RULE_P); }
        private static void digits(Canvas c,String s,float x,float y){ for(int i=0;i<s.length();i++) digit(c,s.charAt(i),x+i*ADVANCE,y); }
        private static void register(Canvas c,char sign,String s,float x,float y){ sign(c,sign,x,y); for(int i=0;i<s.length();i++) digit(c,s.charAt(i),x+FIRST_DIGIT_X+i*ADVANCE,y); }
        private static void digit(Canvas c,char ch,float ox,float oy){ String lit=SEG[ch-'0']; for(int l=0;l<7;l++) if(lit.indexOf((char)('a'+l))>=0) segment(c,l,ox,oy); }
        private static void segment(Canvas c,int logical,float ox,float oy){ float[][] pts=SOURCE[MAP[logical]]; Path p=new Path(); for(int i=0;i<pts.length;i++){ float x=ox+(MIRROR_X-pts[i][0]-SRC_X)*DIGIT_SCALE; float y=oy+(pts[i][1]-SRC_Y)*DIGIT_SCALE; if(i==0)p.moveTo(x,y); else p.lineTo(x,y);} p.close(); c.drawPath(p,ON); }
        private static void sign(Canvas c,char s,float ox,float oy){ if(s!='+'&&s!='-')return; c.drawPath(box(ox+SIGN_X,oy+SIGN_HY,SIGN_W,SIGN_T),ON); if(s=='+'){ c.drawPath(box(ox+SIGN_VX,oy+SIGN_TOP,SIGN_T,SIGN_ARM),ON); c.drawPath(box(ox+SIGN_VX,oy+SIGN_HY+SIGN_T+SIGN_GAP,SIGN_T,SIGN_ARM),ON);} }
        private static Path box(float x,float y,float w,float h){ Path p=new Path(); p.moveTo(x,y);p.lineTo(x+w,y);p.lineTo(x+w,y+h);p.lineTo(x,y+h);p.close();return p; }
    }
}
