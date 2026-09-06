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
import android.os.Bundle;
import android.widget.RemoteViews;

import java.util.Calendar;
import java.util.Locale;

/**
 * Resizable home-screen widget that renders only the DSKY electroluminescent
 * readout. It intentionally omits the faceplate, screws, annunciator bank,
 * keyboard, controls, captions, and every other part of the physical DSKY.
 */
public final class ElWidgetProvider extends AppWidgetProvider {
    private static final String ACTION_TICK = "org.apollo.agcdsky.EL_WIDGET_TICK";
    private static final long UPDATE_INTERVAL_MS = 60_000L;
    private static final int TICK_REQUEST_CODE = 16;

    @Override
    public void onEnabled(Context context) {
        super.onEnabled(context);
        schedule(context);
    }

    @Override
    public void onDisabled(Context context) {
        cancel(context);
        super.onDisabled(context);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateOne(context, manager, appWidgetId);
        }
        if (appWidgetIds.length > 0) {
            schedule(context);
        }
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager,
            int appWidgetId, Bundle newOptions) {
        super.onAppWidgetOptionsChanged(context, manager, appWidgetId, newOptions);
        updateOne(context, manager, appWidgetId);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent.getAction();
        if (!ACTION_TICK.equals(action)
                && !Intent.ACTION_TIME_CHANGED.equals(action)
                && !Intent.ACTION_TIMEZONE_CHANGED.equals(action)) {
            return;
        }

        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, ElWidgetProvider.class));
        for (int id : ids) {
            updateOne(context, manager, id);
        }
        if (ids.length > 0) {
            schedule(context);
        } else {
            cancel(context);
        }
    }

    private static void updateOne(Context context, AppWidgetManager manager, int appWidgetId) {
        Bundle options = manager.getAppWidgetOptions(appWidgetId);
        int widthDp = Math.max(80,
                options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 180));
        int heightDp = Math.max(100,
                options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 300));
        float density = context.getResources().getDisplayMetrics().density;
        int widthPx = clamp(Math.round(widthDp * density), 160, 1200);
        int heightPx = clamp(Math.round(heightDp * density), 200, 1600);

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.el_widget);
        views.setImageViewBitmap(R.id.el_widget_image, ElRenderer.render(widthPx, heightPx));

        Intent launch = new Intent(context, MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openApp = PendingIntent.getActivity(
                context,
                appWidgetId,
                launch,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.el_widget_image, openApp);
        manager.updateAppWidget(appWidgetId, views);
    }

    private static int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }

    private static PendingIntent tickIntent(Context context) {
        Intent tick = new Intent(context, ElWidgetProvider.class).setAction(ACTION_TICK);
        return PendingIntent.getBroadcast(
                context,
                TICK_REQUEST_CODE,
                tick,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void schedule(Context context) {
        AlarmManager alarm = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarm == null) {
            return;
        }
        long now = System.currentTimeMillis();
        long nextMinute = now - (now % UPDATE_INTERVAL_MS) + UPDATE_INTERVAL_MS;
        alarm.setInexactRepeating(
                AlarmManager.RTC,
                nextMinute,
                UPDATE_INTERVAL_MS,
                tickIntent(context));
    }

    private static void cancel(Context context) {
        AlarmManager alarm = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarm != null) {
            alarm.cancel(tickIntent(context));
        }
    }

    /** Bitmap renderer for the 106 x 190 EL SVG coordinate system. */
    static final class ElRenderer {
        private static final float PANEL_W = 106f;
        private static final float PANEL_H = 190f;

        private static final int CORE = Color.rgb(201, 245, 189);
        private static final int LABEL = Color.rgb(172, 220, 167);
        private static final int RULE = Color.rgb(181, 230, 172);
        private static final int OFF = Color.rgb(28, 39, 28);

        private static final float SRC_X = 88.116524f;
        private static final float SRC_Y = 85.303059f;
        private static final float SRC_W = 11.685430f;
        private static final float SRC_H = 12.700000f;
        private static final float SRC_PITCH = 10.668000f;
        private static final float DIGIT_SCALE = 1.58f;
        private static final float MIRROR_X = 2f * SRC_X + SRC_W;
        private static final float ADVANCE = SRC_PITCH * DIGIT_SCALE;
        private static final float DIGIT_H = SRC_H * DIGIT_SCALE;
        private static final float FIRST_DIGIT_X = 9.7f;

        // Raw polygons are exact points from Ben Krasnow's DSKY V2.svg
        // EL_Segments artwork. Logical b/c/e/f use the opposite source side
        // after mirroring so the crew-facing display retains correct handedness.
        private static final float[][][] SOURCE = new float[][][] {
                { // a
                        {95.137274f, 86.827056f}, {96.244524f, 85.303059f},
                        {90.088724f, 85.303059f}, {90.497084f, 86.827056f}
                },
                { // f
                        {91.361734f, 91.526056f}, {89.694284f, 85.303059f},
                        {88.116524f, 85.303059f}, {89.783974f, 91.526056f}
                },
                { // e
                        {89.886064f, 91.907059f}, {91.463824f, 91.907059f},
                        {92.620814f, 96.224998f}, {91.456914f, 97.769549f}
                },
                { // d
                        {93.002124f, 96.352056f}, {91.758014f, 98.003059f},
                        {99.570014f, 98.003059f}, {97.418394f, 96.352056f}
                },
                { // b
                        {95.390774f, 87.126332f}, {96.543434f, 85.539832f},
                        {98.147444f, 91.526056f}, {96.569684f, 91.526056f}
                },
                { // c
                        {96.671774f, 91.907059f}, {98.249534f, 91.907059f},
                        {99.801954f, 97.700791f}, {97.815844f, 96.176791f}
                },
                { // g
                        {96.005094f, 90.891059f}, {96.447474f, 92.542059f},
                        {92.028414f, 92.542059f}, {91.586024f, 90.891059f}
                }
        };

        // logical a,b,c,d,e,f,g -> source a,f,e,d,c,b,g
        private static final int[] LOGICAL_TO_SOURCE = {0, 1, 2, 3, 5, 4, 6};
        private static final String[] DIGIT_SEGMENTS = {
                "abcdef", "bc", "abdeg", "abcdg", "bcfg",
                "acdfg", "acdefg", "abc", "abcdefg", "abcdfg"
        };

        private static final Paint SEG_ON = new Paint(Paint.ANTI_ALIAS_FLAG);
        private static final Paint SEG_OFF = new Paint(Paint.ANTI_ALIAS_FLAG);
        private static final Paint LABEL_PAINT = new Paint(Paint.ANTI_ALIAS_FLAG);
        private static final Paint RULE_PAINT = new Paint(Paint.ANTI_ALIAS_FLAG);
        private static final Paint COMP_PAINT = new Paint(Paint.ANTI_ALIAS_FLAG);

        static {
            SEG_ON.setStyle(Paint.Style.FILL);
            SEG_ON.setColor(CORE);
            SEG_ON.setShadowLayer(0.85f, 0f, 0f, CORE);

            SEG_OFF.setStyle(Paint.Style.FILL);
            SEG_OFF.setColor(OFF);
            SEG_OFF.setAlpha(145);

            Typeface condensedBold = Typeface.create("sans-serif-condensed", Typeface.BOLD);
            LABEL_PAINT.setTypeface(condensedBold);
            LABEL_PAINT.setTextAlign(Paint.Align.CENTER);
            LABEL_PAINT.setTextSize(5.1f);
            LABEL_PAINT.setColor(LABEL);
            LABEL_PAINT.setAlpha(220);

            RULE_PAINT.setStyle(Paint.Style.STROKE);
            RULE_PAINT.setStrokeWidth(2.05f);
            RULE_PAINT.setStrokeCap(Paint.Cap.ROUND);
            RULE_PAINT.setColor(RULE);
            RULE_PAINT.setAlpha(212);

            COMP_PAINT.setTypeface(condensedBold);
            COMP_PAINT.setTextAlign(Paint.Align.CENTER);
            COMP_PAINT.setTextSize(4.9f);
            COMP_PAINT.setColor(OFF);
            COMP_PAINT.setAlpha(150);
        }

        private ElRenderer() {}

        static Bitmap render(int width, int height) {
            // The bitmap itself is the EL panel, not a widget-sized canvas with
            // black letterbox bars. The ImageView/launcher owns any unused host
            // area. This keeps RemoteViews bitmap memory low and makes the
            // widget payload exactly the 106:190 EL section at every size.
            int fitWidth = Math.max(1, width);
            int fitHeight = Math.max(1, Math.round(fitWidth * PANEL_H / PANEL_W));
            if (fitHeight > height) {
                fitHeight = Math.max(1, height);
                fitWidth = Math.max(1, Math.round(fitHeight * PANEL_W / PANEL_H));
            }

            Bitmap bitmap = Bitmap.createBitmap(
                    fitWidth, fitHeight, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bitmap);
            canvas.drawColor(Color.BLACK);

            float scale = Math.min(fitWidth / PANEL_W, fitHeight / PANEL_H);
            float left = (fitWidth - PANEL_W * scale) * 0.5f;
            float top = (fitHeight - PANEL_H * scale) * 0.5f;
            canvas.save();
            canvas.translate(left, top);
            canvas.scale(scale, scale);
            drawElPanel(canvas);
            canvas.restore();
            return bitmap;
        }

        private static void drawElPanel(Canvas canvas) {
            canvas.drawText("PROG", 87f, 9f, LABEL_PAINT);
            canvas.drawText("VERB", 20f, 54f, LABEL_PAINT);
            canvas.drawText("NOUN", 87f, 54f, LABEL_PAINT);
            canvas.drawLine(12f, 89f, 94f, 89f, RULE_PAINT);
            canvas.drawLine(12f, 125f, 94f, 125f, RULE_PAINT);
            canvas.drawLine(12f, 159f, 94f, 159f, RULE_PAINT);

            // Clock mode has no AGC Executive, so COMP ACTY is deliberately
            // unlit rather than simulated from network/CPU/timer activity.
            canvas.drawText("COMP", 19f, 14f, COMP_PAINT);
            canvas.drawText("ACTY", 19f, 22f, COMP_PAINT);

            drawDigits(canvas, "00", 68f, 14f);
            drawDigits(canvas, "16", 3f, 59f);
            drawDigits(canvas, "65", 68f, 59f);

            Calendar now = Calendar.getInstance();
            drawRegister(canvas, '+', five(now.get(Calendar.HOUR_OF_DAY)), 3f, 97f);
            drawRegister(canvas, '+', five(now.get(Calendar.MINUTE)), 3f, 131f);
            drawRegister(canvas, '+', five(now.get(Calendar.SECOND)), 3f, 165f);
        }

        private static String five(int value) {
            return String.format(Locale.US, "%05d", value);
        }

        private static void drawDigits(Canvas canvas, String text, float x, float y) {
            for (int i = 0; i < text.length(); i++) {
                drawDigit(canvas, text.charAt(i), x + i * ADVANCE, y);
            }
        }

        private static void drawRegister(Canvas canvas, char sign, String digits, float x, float y) {
            drawSign(canvas, sign, x, y);
            for (int i = 0; i < digits.length(); i++) {
                drawDigit(canvas, digits.charAt(i), x + FIRST_DIGIT_X + i * ADVANCE, y);
            }
        }

        private static void drawDigit(Canvas canvas, char ch, float originX, float originY) {
            String lit = ch >= '0' && ch <= '9' ? DIGIT_SEGMENTS[ch - '0'] : "";
            for (int logical = 0; logical < 7; logical++) {
                char segmentName = (char) ('a' + logical);
                drawSegment(canvas, logical, lit.indexOf(segmentName) >= 0, originX, originY);
            }
        }

        private static void drawSegment(Canvas canvas, int logical, boolean on,
                float originX, float originY) {
            float[][] points = SOURCE[LOGICAL_TO_SOURCE[logical]];
            Path path = new Path();
            for (int i = 0; i < points.length; i++) {
                float px = originX + (MIRROR_X - points[i][0] - SRC_X) * DIGIT_SCALE;
                float py = originY + (points[i][1] - SRC_Y) * DIGIT_SCALE;
                if (i == 0) {
                    path.moveTo(px, py);
                } else {
                    path.lineTo(px, py);
                }
            }
            path.close();
            canvas.drawPath(path, on ? SEG_ON : SEG_OFF);
        }

        private static void drawSign(Canvas canvas, char sign, float originX, float originY) {
            boolean plus = sign == '+';
            boolean bar = plus || sign == '-';
            float signX = originX + 0.95f;
            float signY = originY + DIGIT_H * 0.50f;
            float signW = 7.4f;
            float signT = 1.55f;
            float skew = -0.75f;

            Path horizontal = new Path();
            float hy = signY - signT * 0.5f;
            horizontal.moveTo(signX, hy);
            horizontal.lineTo(signX + signW, hy);
            horizontal.lineTo(signX + signW + skew, hy + signT);
            horizontal.lineTo(signX + skew, hy + signT);
            horizontal.close();
            canvas.drawPath(horizontal, bar ? SEG_ON : SEG_OFF);

            drawSignVertical(canvas, signX + signW * 0.5f, signY, signT, skew, true, plus);
            drawSignVertical(canvas, signX + signW * 0.5f, signY, signT, skew, false, plus);
        }

        private static void drawSignVertical(Canvas canvas, float x, float cy, float thickness,
                float skew, boolean upper, boolean on) {
            float length = 4.8f;
            float y0 = upper ? cy - thickness * 0.5f - length : cy + thickness * 0.5f;
            Path path = new Path();
            path.moveTo(x, y0);
            path.lineTo(x + thickness, y0);
            path.lineTo(x + thickness + skew, y0 + length);
            path.lineTo(x + skew, y0 + length);
            path.close();
            canvas.drawPath(path, on ? SEG_ON : SEG_OFF);
        }
    }
}
