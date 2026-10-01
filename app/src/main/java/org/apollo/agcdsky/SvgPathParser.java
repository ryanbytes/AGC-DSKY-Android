package org.apollo.agcdsky;

/** Parses the M/L/C/Z commands used by the fixed EL legend outlines. */
final class SvgPathParser {
    interface Sink {
        void moveTo(float x, float y);
        void lineTo(float x, float y);
        void cubicTo(float x1, float y1, float x2, float y2, float x, float y);
        void close();
    }

    private SvgPathParser() {}

    static void parse(String data, Sink sink) {
        if (data == null || sink == null) throw new IllegalArgumentException("Path data and sink are required");
        int i = 0;
        char command = 0;
        boolean awaitingArguments = false;
        while (i < data.length()) {
            char ch = data.charAt(i);
            if (isSeparator(ch)) { i++; continue; }
            if (isLetter(ch)) {
                if (!isSupportedCommand(ch)) {
                    throw new IllegalArgumentException("Unsupported DSKY legend path command: " + ch);
                }
                if (awaitingArguments) {
                    throw new IllegalArgumentException("Missing arguments for DSKY legend path command: " + command);
                }
                command = ch;
                i++;
                if (command == 'Z') {
                    sink.close();
                    command = 0;
                    awaitingArguments = false;
                } else {
                    awaitingArguments = true;
                }
                continue;
            }
            switch (command) {
                case 'M': {
                    float x = readNumber(data, i); i = nextNumber(data, i);
                    float y = readNumber(data, i); i = nextNumber(data, i);
                    sink.moveTo(x, y);
                    command = 'L';
                    awaitingArguments = false;
                    break;
                }
                case 'L': {
                    float x = readNumber(data, i); i = nextNumber(data, i);
                    float y = readNumber(data, i); i = nextNumber(data, i);
                    sink.lineTo(x, y);
                    awaitingArguments = false;
                    break;
                }
                case 'C': {
                    float x1 = readNumber(data, i); i = nextNumber(data, i);
                    float y1 = readNumber(data, i); i = nextNumber(data, i);
                    float x2 = readNumber(data, i); i = nextNumber(data, i);
                    float y2 = readNumber(data, i); i = nextNumber(data, i);
                    float x = readNumber(data, i); i = nextNumber(data, i);
                    float y = readNumber(data, i); i = nextNumber(data, i);
                    sink.cubicTo(x1, y1, x2, y2, x, y);
                    awaitingArguments = false;
                    break;
                }
                default:
                    throw new IllegalArgumentException("Unsupported DSKY legend path command: " + command);
            }
        }
        if (awaitingArguments) {
            throw new IllegalArgumentException("Missing arguments for DSKY legend path command: " + command);
        }
    }

    private static int nextNumber(String data, int i) {
        int start = skipSeparators(data, i);
        int end = numberEnd(data, start);
        return skipSeparators(data, end);
    }

    private static float readNumber(String data, int i) {
        int start = skipSeparators(data, i);
        int end = numberEnd(data, start);
        return Float.parseFloat(data.substring(start, end));
    }

    private static int skipSeparators(String data, int i) {
        while (i < data.length() && isSeparator(data.charAt(i))) i++;
        return i;
    }

    private static boolean isSeparator(char ch) {
        return ch == ',' || ch == ' ' || ch == '\n' || ch == '\r' || ch == '\t';
    }

    private static boolean isLetter(char ch) {
        return (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z');
    }

    private static boolean isSupportedCommand(char ch) {
        return ch == 'M' || ch == 'L' || ch == 'C' || ch == 'Z';
    }

    private static int numberEnd(String data, int start) {
        int i = start, n = data.length();
        if (i < n && (data.charAt(i) == '+' || data.charAt(i) == '-')) i++;
        boolean digit = false;
        while (i < n && isDigit(data.charAt(i))) { digit = true; i++; }
        if (i < n && data.charAt(i) == '.') {
            i++;
            while (i < n && isDigit(data.charAt(i))) { digit = true; i++; }
        }
        if (!digit) throw new IllegalArgumentException("Invalid DSKY legend path number at " + start);
        if (i < n && (data.charAt(i) == 'e' || data.charAt(i) == 'E')) {
            int exponent = i++;
            if (i < n && (data.charAt(i) == '+' || data.charAt(i) == '-')) i++;
            int exponentDigits = i;
            while (i < n && isDigit(data.charAt(i))) i++;
            if (i == exponentDigits) throw new IllegalArgumentException("Invalid DSKY legend exponent at " + exponent);
        }
        return i;
    }

    private static boolean isDigit(char ch) { return ch >= '0' && ch <= '9'; }
}
