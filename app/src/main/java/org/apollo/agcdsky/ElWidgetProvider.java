package org.apollo.agcdsky;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
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

/** Home-screen widget containing only the DSKY EL readout. */
public final class ElWidgetProvider extends AppWidgetProvider {
    private static final float PANEL_W = 106f;
    private static final float PANEL_H = 190f;
    private static final float REGISTER_X = 3f;
    private static final float[] REGISTER_Y = {97f, 131f, 165f};

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateOne(context, manager, appWidgetId);
        }
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager,
            int appWidgetId, Bundle newOptions) {
        super.onAppWidgetOptionsChanged(context, manager, appWidgetId, newOptions);
        updateOne(context, manager, appWidgetId);
    }

    private static void updateOne(Context context, AppWidgetManager manager, int appWidgetId) {
        Bundle options = manager.getAppWidgetOptions(appWidgetId);
        int widthDp = Math.max(80,
                options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 110));
        int heightDp = Math.max(100,
                options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 190));
        float density = context.getResources().getDisplayMetrics().density;
        int widthPx = clamp(Math.round(widthDp * density), 160, 1200);
        int heightPx = clamp(Math.round(heightDp * density), 200, 1600);

        float scaleDp = Math.min(widthDp / PANEL_W, heightDp / PANEL_H);
        float panelWidthDp = PANEL_W * scaleDp;
        float panelHeightDp = PANEL_H * scaleDp;
        float leftDp = (widthDp - panelWidthDp) * 0.5f;
        float topDp = (heightDp - panelHeightDp) * 0.5f;

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.el_widget);
        views.setImageViewBitmap(R.id.el_widget_image,
                ElRenderer.renderStatic(widthPx, heightPx));

        // TextClock runs inside the launcher host. R3 contains "ss", causing
        // Android's TextClock ticker to repaint every second while attached.
        // This avoids background-alarm batching and keeps the widget live even
        // when our application process is not running.
        int[] clocks = {R.id.el_clock_r1, R.id.el_clock_r2, R.id.el_clock_r3};
        float digitHeightPx = ElRenderer.DIGIT_H * scaleDp * density;
        for (int i = 0; i < clocks.length; i++) {
            int id = clocks[i];
            views.setTextViewTextSize(id, TypedValue.COMPLEX_UNIT_PX, digitHeightPx);
            if (Build.VERSION.SDK_INT >= 31) {
                float startPx = (leftDp + REGISTER_X * scaleDp) * density;
                float topPx = (topDp + REGISTER_Y[i] * scaleDp) * density;
                float widthClockPx = 100f * scaleDp * density;
                float heightClockPx = 22f * scaleDp * density;
                views.setViewLayoutMargin(id, RemoteViews.MARGIN_START,
                        startPx, TypedValue.COMPLEX_UNIT_PX);
                views.setViewLayoutMargin(id, RemoteViews.MARGIN_TOP,
                        topPx, TypedValue.COMPLEX_UNIT_PX);
                views.setViewLayoutWidth(id, widthClockPx, TypedValue.COMPLEX_UNIT_PX);
                views.setViewLayoutHeight(id, heightClockPx, TypedValue.COMPLEX_UNIT_PX);
            }
        }

        Intent launch = new Intent(context, MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openApp = PendingIntent.getActivity(
                context,
                appWidgetId,
                launch,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.el_widget_root, openApp);
        manager.updateAppWidget(appWidgetId, views);
    }

    private static int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }

    static final class ElRenderer {
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
        static final float DIGIT_H = SRC_H * DIGIT_SCALE;
        private static final float FIRST_DIGIT_X = 12.0f;

        // Exact numeric segment polygons from Ben Krasnow's DSKY V2.svg.
        private static final float[][][] SOURCE = new float[][][] {
            {{95.137274f,86.827056f},{96.244524f,85.303059f},{90.088724f,85.303059f},{90.497084f,86.827056f}},
            {{91.361734f,91.526056f},{89.694284f,85.303059f},{88.116524f,85.303059f},{89.783974f,91.526056f}},
            {{89.886064f,91.907059f},{91.463824f,91.907059f},{92.620814f,96.224998f},{91.456914f,97.769549f}},
            {{93.002124f,96.352056f},{91.758014f,98.003059f},{99.570014f,98.003059f},{97.418394f,96.352056f}},
            {{95.390774f,87.126332f},{96.543434f,85.539832f},{98.147444f,91.526056f},{96.569684f,91.526056f}},
            {{96.671774f,91.907059f},{98.249534f,91.907059f},{99.801954f,97.700791f},{97.815844f,96.176791f}},
            {{96.005094f,90.891059f},{96.447474f,92.542059f},{92.028414f,92.542059f},{91.586024f,90.891059f}}
        };
        private static final int[] LOGICAL_TO_SOURCE = {0,1,2,3,5,4,6};
        private static final String[] DIGIT_SEGMENTS = {
            "abcdef","bc","abdeg","abcdg","bcfg","acdfg","acdefg","abc","abcdefg","abcdfg"
        };

        // The Apollo sign cell is not a generic skewed '+' glyph. DSKY V2.svg
        // has three separate rectangular EL sections: a 6.731 x 1.524 center
        // bar and two 1.524 x 3.175 vertical arms, separated by 0.381 gaps.
        private static final float SIGN_W = 6.731f * DIGIT_SCALE;
        private static final float SIGN_T = 1.524f * DIGIT_SCALE;
        private static final float SIGN_ARM = 3.175f * DIGIT_SCALE;
        private static final float SIGN_GAP = 0.381f * DIGIT_SCALE;
        private static final float SIGN_H = 2f * SIGN_ARM + SIGN_T + 2f * SIGN_GAP;
        private static final float SIGN_TOP = (DIGIT_H - SIGN_H) * 0.5f;
        private static final float SIGN_X = 0.40f;
        private static final float SIGN_VX = SIGN_X + (SIGN_W - SIGN_T) * 0.5f;
        private static final float SIGN_HY = SIGN_TOP + SIGN_ARM + SIGN_GAP;

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

        static Bitmap renderStatic(int width, int height) {
            int fitWidth = Math.max(1, width);
            int fitHeight = Math.max(1, Math.round(fitWidth * PANEL_H / PANEL_W));
            if (fitHeight > height) {
                fitHeight = Math.max(1, height);
                fitWidth = Math.max(1, Math.round(fitHeight * PANEL_W / PANEL_H));
            }
            Bitmap bitmap = Bitmap.createBitmap(fitWidth, fitHeight, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bitmap);
            canvas.drawColor(Color.BLACK);
            float scale = Math.min(fitWidth / PANEL_W, fitHeight / PANEL_H);
            canvas.scale(scale, scale);
            drawElPanelStatic(canvas);
            return bitmap;
        }

        private static void drawElPanelStatic(Canvas canvas) {
            canvas.drawText("PROG", 87f, 9f, LABEL_PAINT);
            canvas.drawText("VERB", 20f, 54f, LABEL_PAINT);
            canvas.drawText("NOUN", 87f, 54f, LABEL_PAINT);
            canvas.drawLine(12f, 89f, 94f, 89f, RULE_PAINT);
            canvas.drawLine(12f, 125f, 94f, 125f, RULE_PAINT);
            canvas.drawLine(12f, 159f, 94f, 159f, RULE_PAINT);
            canvas.drawText("COMP", 19f, 14f, COMP_PAINT);
            canvas.drawText("ACTY", 19f, 22f, COMP_PAINT);
            drawDigits(canvas, "00", 68f, 14f);
            drawDigits(canvas, "16", 3f, 59f);
            drawDigits(canvas, "65", 68f, 59f);
            drawRegisterOff(canvas, REGISTER_X, REGISTER_Y[0]);
            drawRegisterOff(canvas, REGISTER_X, REGISTER_Y[1]);
            drawRegisterOff(canvas, REGISTER_X, REGISTER_Y[2]);
        }

        private static void drawRegisterOff(Canvas canvas, float x, float y) {
            drawSignParts(canvas, false, false, x, y);
            for (int i = 0; i < 5; i++) {
                drawDigitOff(canvas, x + FIRST_DIGIT_X + i * ADVANCE, y);
            }
        }

        private static void drawDigits(Canvas canvas, String text, float x, float y) {
            for (int i = 0; i < text.length(); i++) {
                drawDigit(canvas, text.charAt(i), x + i * ADVANCE, y);
            }
        }

        private static void drawDigitOff(Canvas canvas, float originX, float originY) {
            for (int logical = 0; logical < 7; logical++) {
                drawSegment(canvas, logical, false, originX, originY);
            }
        }

        private static void drawDigit(Canvas canvas, char ch, float originX, float originY) {
            String lit = ch >= '0' && ch <= '9' ? DIGIT_SEGMENTS[ch - '0'] : "";
            for (int logical = 0; logical < 7; logical++) {
                drawSegment(canvas, logical,
                        lit.indexOf((char) ('a' + logical)) >= 0, originX, originY);
            }
        }

        private static void drawSegment(Canvas canvas, int logical, boolean on,
                float originX, float originY) {
            float[][] points = SOURCE[LOGICAL_TO_SOURCE[logical]];
            Path path = new Path();
            for (int i = 0; i < points.length; i++) {
                float px = originX + (MIRROR_X - points[i][0] - SRC_X) * DIGIT_SCALE;
                float py = originY + (points[i][1] - SRC_Y) * DIGIT_SCALE;
                if (i == 0) path.moveTo(px, py); else path.lineTo(px, py);
            }
            path.close();
            canvas.drawPath(path, on ? SEG_ON : SEG_OFF);
        }

        private static void drawSignParts(Canvas canvas, boolean horizontalOn,
                boolean verticalOn, float originX, float originY) {
            drawBox(canvas, originX + SIGN_X, originY + SIGN_HY,
                    SIGN_W, SIGN_T, horizontalOn);
            drawBox(canvas, originX + SIGN_VX, originY + SIGN_TOP,
                    SIGN_T, SIGN_ARM, verticalOn);
            drawBox(canvas, originX + SIGN_VX,
                    originY + SIGN_HY + SIGN_T + SIGN_GAP,
                    SIGN_T, SIGN_ARM, verticalOn);
        }

        private static void drawBox(Canvas canvas, float x, float y,
                float w, float h, boolean on) {
            Path p = new Path();
            p.moveTo(x, y);
            p.lineTo(x + w, y);
            p.lineTo(x + w, y + h);
            p.lineTo(x, y + h);
            p.close();
            canvas.drawPath(p, on ? SEG_ON : SEG_OFF);
        }
    }
}
