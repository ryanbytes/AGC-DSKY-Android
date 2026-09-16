#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const java=fs.readFileSync(path.join(root,'app/src/main/java/org/apollo/agcdsky/ElWidgetProvider.java'),'utf8');
const layout=fs.readFileSync(path.join(root,'app/src/main/res/layout/el_widget.xml'),'utf8');
function assert(c,m){if(!c)throw new Error(m)}

for(const token of [
  'ACTIVE_W=106f,ACTIVE_H=4.060f*U',
  'ACTIVE_X=.130f*U,ACTIVE_Y=.180f*U',
  'PANEL_W=2.620f*U,PANEL_H=4.420f*U',
  'FRAME=Color.rgb(124,129,131)',
  'PANEL=Color.rgb(78,83,90)',
  'renderGlass(panelWidthPx,panelHeightPx)',
  'GLASS_REAR_DX=.016f*U',
  'GLASS_REAR_DY=.021f*U',
  'private static void drawGlass(Canvas c)'
])assert(java.includes(token),`widget glass renderer missing ${token}`);
assert(!java.includes('SensorManager'),'launcher widget must remain static and battery-cheap');
assert(layout.includes('android:background="#7C8183"'),'widget frame must use forced FS595 body approximation');
assert(layout.includes('android:id="@+id/el_widget_glass"'),'front glass ImageView missing');
assert(layout.indexOf('el_widget_glass')>layout.indexOf('el_seconds_flipper'),'glass must be layered above live register flippers');
console.log('widget glass smoke: PASS');
console.log('  1006315G active/frame geometry preserved; FS595 colors + rear/front static glass planes present');
