# Android crash reporting

Prototype builds should capture failures without embedding GitHub credentials in the APK.

## Repository implementation

`DebugReporter.java` installs an uncaught-exception handler before WebView startup and writes the latest native crash to the app-private `debug-last.txt` file. MainActivity checks for that file before constructing a WebView. When a report exists, the app offers a native **REPORT TO GITHUB** action that opens a pre-filled issue in this private repository using the user's normal GitHub session.

The report includes:

- timestamp
- native stack trace or WebView console error
- Android release / SDK level
- manufacturer and model
- package name

Location coordinates and GitHub credentials are intentionally excluded.

MainActivity and DreamService also capture WebView console errors through `WebChromeClient`.

## Emergency hand-built diagnostic APK

The SDK-free diagnostic package built on 2026-08-22 cannot use the full source-level `DebugReporter` implementation. Its launcher therefore uses a smaller equivalent path in Dalvik bytecode:

1. install `Thread.UncaughtExceptionHandler` before entering the WebView startup method;
2. persist the native stack trace in app-private SharedPreferences;
3. on the next launch, clear that saved trace and open a pre-filled GitHub issue draft containing it;
4. the user must explicitly submit the issue in GitHub.

This still embeds no GitHub token.

### Reproduction procedure

1. Install the diagnostic APK.
2. Launch it normally.
3. If it crashes, launch it a second time.
4. The second launch should open a GitHub issue draft with the captured stack trace. Submit that issue.
5. If the second launch crashes before opening the issue draft, treat that as evidence that Android is rejecting/loading/verifying the DEX before the crash handler can execute.

Do not claim a crash is diagnosed until the actual stack trace or Android runtime error has been inspected.
