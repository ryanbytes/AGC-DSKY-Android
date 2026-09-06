'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const fail = message => {
  console.error(`EL WIDGET FAIL: ${message}`);
  process.exit(1);
};
const requireText = (text, needle, label) => {
  if (!text.includes(needle)) fail(`${label} is missing: ${needle}`);
};
const forbid = (text, needle, label) => {
  if (text.includes(needle)) fail(`${label} must not contain: ${needle}`);
};

const manifest = read('app/src/main/AndroidManifest.xml');
const layout = read('app/src/main/res/layout/el_widget.xml');
const info = read('app/src/main/res/xml/el_widget_info.xml');
const provider = read('app/src/main/java/org/apollo/agcdsky/ElWidgetProvider.java');

requireText(manifest, 'android:name=".ElWidgetProvider"', 'manifest');
requireText(manifest, 'android:resource="@xml/el_widget_info"', 'manifest');
requireText(manifest, 'android.appwidget.action.APPWIDGET_UPDATE', 'manifest');
forbid(manifest, 'android.permission.INTERNET', 'manifest');

requireText(layout, '<ImageView', 'widget layout');
requireText(layout, 'android:id="@+id/el_widget_image"', 'widget layout');
requireText(layout, 'android:background="#000000"', 'widget layout');
requireText(layout, 'android:padding="0dp"', 'widget layout');
requireText(layout, 'android:scaleType="fitCenter"', 'widget layout');
if ((layout.match(/<ImageView\b/g) || []).length !== 1) {
  fail('widget layout must contain exactly one ImageView');
}
for (const physical of ['Button', 'TextView', 'FrameLayout', 'LinearLayout', 'RelativeLayout']) {
  forbid(layout, `<${physical}`, 'widget layout');
}

requireText(info, 'android:initialLayout="@layout/el_widget"', 'widget metadata');
requireText(info, 'android:resizeMode="horizontal|vertical"', 'widget metadata');
requireText(info, 'android:widgetCategory="home_screen"', 'widget metadata');

requireText(provider, 'private static final float PANEL_W = 106f;', 'EL renderer');
requireText(provider, 'private static final float PANEL_H = 190f;', 'EL renderer');
requireText(provider, 'Ben Krasnow\'s DSKY V2.svg', 'EL renderer');
requireText(provider, 'canvas.drawText("PROG", 87f, 9f', 'EL renderer');
requireText(provider, 'canvas.drawText("VERB", 20f, 54f', 'EL renderer');
requireText(provider, 'canvas.drawText("NOUN", 87f, 54f', 'EL renderer');
requireText(provider, 'drawRegister(canvas, \'+\'', 'EL renderer');
requireText(provider, 'AlarmManager.RTC,', 'widget scheduler');
forbid(provider, 'AlarmManager.RTC_WAKEUP', 'widget scheduler');

// The user explicitly wants the widget to be the EL section itself. These
// primitives would be the usual way to redraw a faceplate/bezel/fastener and
// are deliberately forbidden in the widget renderer.
for (const primitive of ['drawRect(', 'drawRoundRect(', 'drawCircle(', 'drawOval(']) {
  forbid(provider, primitive, 'EL-only renderer');
}
for (const physical of ['faceplate', 'fastener', 'keyboard', 'annunciator bank']) {
  // These words are allowed in the class-level explanation only, but never as
  // drawable implementation identifiers or resources. Strip that comment.
  const implementation = provider.replace(/\/\*\*[\s\S]*?\*\//, '');
  if (implementation.toLowerCase().includes(physical)) {
    fail(`EL renderer implementation unexpectedly references ${physical}`);
  }
}

console.log('EL widget source smoke: PASS');
