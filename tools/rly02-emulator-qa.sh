#!/usr/bin/env bash
set -euo pipefail

PKG=org.apollo.agcdsky.eltest
APK=app/build/outputs/apk/regular/debug/app-regular-debug.apk

test -f "$APK"
adb install -r "$APK" >/tmp/rly02-adb-install.txt
adb logcat -c
adb shell am force-stop "$PKG" || true
adb shell am start -W -n "$PKG/org.apollo.agcdsky.SensorMainActivity" | tee /tmp/rly02-am-start.txt

PID=""
for _ in $(seq 1 60); do
  PID="$(adb shell pidof -s "$PKG" | tr -d '\r' || true)"
  [ -n "$PID" ] && break
  sleep 1
done
test -n "$PID"

adb forward --remove tcp:9222 >/dev/null 2>&1 || true
adb forward tcp:9222 "localabstract:webview_devtools_remote_$PID"

python3 - <<'PY'
import json, sys, time, urllib.request
import websocket

def targets():
    with urllib.request.urlopen("http://127.0.0.1:9222/json", timeout=2) as r:
        return json.load(r)

pages = []
for _ in range(60):
    try:
        pages = [x for x in targets() if x.get("webSocketDebuggerUrl")]
        if pages:
            break
    except Exception:
        pass
    time.sleep(1)
if not pages:
    raise SystemExit("RLY02 EMULATOR FAIL: no debuggable WebView target")

page = next((x for x in pages if "appassets.androidplatform.net" in x.get("url","")), pages[0])
ws = websocket.create_connection(page["webSocketDebuggerUrl"], timeout=15, suppress_origin=True)
seq = 0

def cdp(method, params=None):
    global seq
    seq += 1
    ident = seq
    ws.send(json.dumps({"id":ident,"method":method,"params":params or {}}))
    while True:
        msg = json.loads(ws.recv())
        if msg.get("id") == ident:
            return msg

def evaluate(expr, await_promise=False):
    out = cdp("Runtime.evaluate", {
        "expression": expr,
        "returnByValue": True,
        "awaitPromise": await_promise,
        "userGesture": True
    })
    result = out.get("result", {})
    if result.get("exceptionDetails"):
        raise RuntimeError("JS exception: " + json.dumps(result["exceptionDetails"]))
    inner = result.get("result", {})
    return inner.get("value")

cdp("Runtime.enable")
ready = None
for _ in range(90):
    ready = evaluate("""(()=>({
      ready:document.readyState,
      topology:!!window.DSKY_RELAY_TOPOLOGY,
      audio:!!window.DSKY_RELAY_AUDIO,
      display:!!window.AGCDSKY_DISPLAY,
      hardware:!!(window.AGCDSKY_SERVICE_REGISTRY&&AGCDSKY_SERVICE_REGISTRY.get('AGCDSKY_HARDWARE')),
      appState:!!window.AGCDSKY_APP_STATE
    }))()""")
    if ready and all(ready.get(k) for k in ("topology","audio","display","hardware","appState")):
        break
    time.sleep(1)
else:
    raise SystemExit("RLY02 EMULATOR FAIL: DSKY runtime services did not initialize: " + repr(ready))

qa = evaluate("""(async()=>{
  const t=window.DSKY_RELAY_TOPOLOGY;
  const a=window.DSKY_RELAY_AUDIO;
  const d=window.AGCDSKY_DISPLAY;
  const h=window.AGCDSKY_SERVICE_REGISTRY.get('AGCDSKY_HARDWARE');
  const state=window.AGCDSKY_APP_STATE;
  const fail=m=>{throw new Error('RLY02 EMULATOR FAIL: '+m)};
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const expectedHoles=['3:10','8:5','8:6','8:7','8:8','8:9','8:10','9:10','10:10','11:10','12:9','12:10'];

  if(t.physicalRelayCount!==132)fail('physicalRelayCount='+t.physicalRelayCount);
  if(t.latchingRelayCount!==120)fail('latchingRelayCount='+t.latchingRelayCount);
  if(t.nonLatchingRelayCount!==12)fail('nonLatchingRelayCount='+t.nonLatchingRelayCount);
  if(t.latchingRelays.length!==120||t.nonLatchingRelays.length!==12||t.packageSlots.length!==132)fail('runtime inventory lengths');

  const ids=[...t.latchingRelays,...t.nonLatchingRelays].map(x=>x.id);
  if(new Set(ids).size!==132)fail('duplicate physical relay identity');

  const holes=[];
  let physicalProfiles=0;
  for(let row=1;row<=12;row++)for(let bit=0;bit<11;bit++){
    const physical=t.isLatchingRelay(row,bit);
    const p=a.profileFor(row,bit);
    if(physical){
      if(!p)fail('missing latching profile '+row+':'+bit);
      physicalProfiles++;
    }else{
      holes.push(row+':'+bit);
      if(p!==null)fail('nonexistent latching position has profile '+row+':'+bit);
      if(a.hapticPatternFor(row,bit,true)!==null)fail('nonexistent latching position has haptic '+row+':'+bit);
      if(a.contactTraceFor(row,bit,true).length!==0)fail('nonexistent latching position has contact trace '+row+':'+bit);
    }
  }
  if(physicalProfiles!==120)fail('physical profile count='+physicalProfiles);
  if(JSON.stringify(holes)!==JSON.stringify(expectedHoles))fail('hole set '+JSON.stringify(holes));

  if(a.latchingRelayCount!==120||a.auxiliaryRelayCount!==12||a.totalIndividualRelays!==132)fail('audio model population');
  for(const name of t.nonLatchingNames){
    if(!a.auxiliaryProfileFor(name))fail('missing non-latching profile '+name);
  }

  const snap0=h.snapshot();
  if(snap0.physicalRelayCount!==132||snap0.latchingRelayCount!==120||snap0.nonLatchingRelayCount!==12)fail('hardware snapshot population');

  const priorMode=state.mode;
  state.mode='agc';
  d.onChannel(0o11,0o00007);
  d.onChannel(0o12,0o30000);
  d.onChannel(0o163,0o00771);
  await sleep(120);
  const on=h.snapshot().auxRelays;
  const missingOn=t.nonLatchingNames.filter(name=>!on[name]);
  if(missingOn.length)fail('non-latching source route did not assert '+missingOn.join(','));

  d.onChannel(0o11,0);
  d.onChannel(0o12,0);
  d.onChannel(0o163,0);
  await sleep(120);
  const off=h.snapshot().auxRelays;
  const stuck=t.nonLatchingNames.filter(name=>off[name]);
  if(stuck.length)fail('non-latching source route did not release '+stuck.join(','));

  const dec10=d.implementation('decodeChannel10');
  dec10((3<<11)|0o2000);
  await sleep(5);
  const holeWrite=h.snapshot().lastWrite;
  if(!holeWrite||holeWrite.relay!==3||holeWrite.changed!==0)fail('unpopulated ROW-03:B produced physical armature motion');

  state.mode=priorMode;
  return {
    physicalRelayCount:t.physicalRelayCount,
    latchingRelayCount:t.latchingRelayCount,
    nonLatchingRelayCount:t.nonLatchingRelayCount,
    physicalProfiles,
    holes,
    nonLatchingNames:[...t.nonLatchingNames],
    allNonLatchingSourcesAsserted:true,
    allNonLatchingSourcesReleased:true,
    row03BPhysicalChanges:holeWrite.changed
  };
})()""", await_promise=True)

print("RLY02 EMULATOR PASS")
print(json.dumps(qa, indent=2, sort_keys=True))
ws.close()
PY

if adb logcat -b crash -d | grep -E 'FATAL EXCEPTION|org\.apollo\.agcdsky'; then
  echo "RLY02 EMULATOR FAIL: crash buffer is not empty" >&2
  exit 1
fi
