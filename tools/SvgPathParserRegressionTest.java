package org.apollo.agcdsky;

import java.util.ArrayList;
import java.util.List;

/** JVM-only behavior tests for the exact parser called by ElWidgetProvider. */
public final class SvgPathParserRegressionTest {
    private static final class RecordingSink implements SvgPathParser.Sink {
        final List<String> events = new ArrayList<>();
        @Override public void moveTo(float x, float y) { events.add("M " + x + " " + y); }
        @Override public void lineTo(float x, float y) { events.add("L " + x + " " + y); }
        @Override public void cubicTo(float x1, float y1, float x2, float y2, float x, float y) {
            events.add("C " + x1 + " " + y1 + " " + x2 + " " + y2 + " " + x + " " + y);
        }
        @Override public void close() { events.add("Z"); }
    }

    private static void expect(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    public static void main(String[] args) {
        RecordingSink crash = new RecordingSink();
        SvgPathParser.parse("M75.4402,9.2002L76.3346,9.2002", crash);
        expect(crash.events.size() == 2, "comma-separated crash fixture must produce two points");
        expect(crash.events.get(0).equals("M 75.4402 9.2002"), "comma-separated coordinates must not include delimiters");
        expect(crash.events.get(1).equals("L 76.3346 9.2002"), "parser must continue after compact command boundaries");

        RecordingSink syntax = new RecordingSink();
        SvgPathParser.parse("M-1.25,+2.5L.5-.75C1e1,2E-1,3.0,4,5,6Z", syntax);
        expect(syntax.events.equals(List.of("M -1.25 2.5", "L 0.5 -0.75", "C 10.0 0.2 3.0 4.0 5.0 6.0", "Z")),
                "signs, compact separators, decimals, exponents, curves, and close must parse");

        for (String malformed : List.of(
                "M", "M1,", "M1,2L", "M1,2L3", "M1,2C3,4,5,6,7",
                "M1,2L3,4e", "Q", "M1,2Q3,4", "m1,2")) {
            boolean rejected = false;
            try { SvgPathParser.parse(malformed, new RecordingSink()); }
            catch (IllegalArgumentException expected) { rejected = true; }
            expect(rejected, "malformed or unsupported path must fail: " + malformed);
        }
        for (String labelPath : args) {
            RecordingSink label = new RecordingSink();
            SvgPathParser.parse(labelPath, label);
            expect(!label.events.isEmpty(), "embedded widget label path must produce drawing operations");
        }
        System.out.println("EL widget Java path-parser regression: PASS");
    }
}
