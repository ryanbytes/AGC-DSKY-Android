'use strict';

// Shared electroluminescent DSKY rendering authority. Late geometry/stability
// layers still use historical parser-global names, but those names are now
// accessor-backed slots owned by this service via AGCDSKY_COMPAT.
(() => {
  const compat=window.AGCDSKY_COMPAT;
  if(!compat)throw new Error('Runtime compatibility bridge unavailable');

  const SEG={0:'abcdef',1:'bc',2:'abdeg',3:'abcdg',4:'bcfg',5:'acdfg',6:'acdefg',7:'abc',8:'abcdefg',9:'abcdfg'};
  const PATH={
    a:'M1.62 1.28 L11.72 1.28 L12.32 1.84 L11.70 2.42 L1.60 2.42 L1.02 1.84 Z',
    g:'M0.88 10.92 L1.50 10.34 L10.90 10.34 L11.52 10.92 L10.88 11.50 L1.48 11.50 Z',
    d:'M-0.02 21.46 L0.60 20.88 L10.00 20.88 L10.62 21.46 L9.98 22.04 L0.58 22.04 Z',
    f:'M1.36 2.84 L2.42 3.36 L1.56 10.10 L0.54 10.68 L0.16 10.12 L1.02 3.40 Z',
    b:'M11.44 2.84 L12.50 3.36 L11.64 10.10 L10.62 10.68 L10.24 10.12 L11.10 3.40 Z',
    e:'M0.26 11.92 L1.32 12.44 L0.46 19.18 L-0.56 19.76 L-0.94 19.20 L-0.08 12.48 Z',
    c:'M10.34 11.92 L11.40 12.44 L10.54 19.18 L9.52 19.76 L9.14 19.20 L10.00 12.48 Z'
  };
  function pathEl(name,on){return `<path class="el-seg ${on?'on':'off'}" data-seg="${name}" d="${PATH[name]}"/>`}
  function baseGlyph(ch,x){const lit=SEG[ch]||'';return `<g class="el-glyph" transform="translate(${x} 0)">${['a','b','c','d','e','f','g'].map(s=>pathEl(s,lit.includes(s))).join('')}</g>`}
  function baseSignGlyph(sign){
    const plus=sign==='+',bar=plus||sign==='-';
    return `<g class="el-sign">`+
      `<path class="el-seg ${bar?'on':'off'}" d="M.54 10.92 L1.12 10.34 L5.74 10.34 L6.32 10.92 L5.72 11.50 L1.10 11.50 Z"/>`+
      `<path class="el-seg ${plus?'on':'off'}" d="M3.56 4.26 L4.46 4.72 L3.76 10.06 L2.90 10.56 L2.58 10.10 L3.26 4.76 Z"/>`+
      `<path class="el-seg ${plus?'on':'off'}" d="M2.70 11.88 L3.60 12.34 L2.90 17.70 L2.04 18.20 L1.72 17.74 L2.40 12.38 Z"/>`+
      `</g>`;
  }

  let glyphSlot,signSlot,digitsSlot,regSlot,set2Slot,setRegSlot,setLampSlot,clearLampsSlot;
  function baseRenderDigits(el,text){let out='';String(text).split('').forEach((ch,i)=>out+=glyphSlot.get()(ch,i*14));el.innerHTML=out}
  function baseRenderReg(el,text){text=String(text);let out=signSlot.get()(text[0]);text.slice(1).split('').forEach((ch,i)=>out+=glyphSlot.get()(ch,7+i*14));el.innerHTML=out}
  function baseSet2(id,text){digitsSlot.get()(document.getElementById(id),String(text).padEnd(2,' ').slice(0,2))}
  function baseSetReg(id,sign,digits){regSlot.get()(document.getElementById(id),(sign||' ')+String(digits).padEnd(5,' ').slice(0,5))}
  function baseSetLamp(name,on){const x=document.querySelector(`[data-lamp="${name}"]`);if(x)x.classList.toggle('on',!!on)}
  function baseClearLamps(){document.querySelectorAll('[data-lamp]').forEach(x=>x.classList.remove('on'));document.body.classList.remove('vn-flash-off','el-off')}

  const isFn=value=>typeof value==='function';
  compat.readonly('SEG',()=>SEG);
  compat.readonly('PATH',()=>PATH);
  glyphSlot=compat.mutable('glyph',baseGlyph,isFn);
  signSlot=compat.mutable('signGlyph',baseSignGlyph,isFn);
  digitsSlot=compat.mutable('renderDigits',baseRenderDigits,isFn);
  regSlot=compat.mutable('renderReg',baseRenderReg,isFn);
  set2Slot=compat.mutable('set2',baseSet2,isFn);
  setRegSlot=compat.mutable('setReg',baseSetReg,isFn);
  setLampSlot=compat.mutable('setLamp',baseSetLamp,isFn);
  clearLampsSlot=compat.mutable('clearLamps',baseClearLamps,isFn);

  window.AGCDSKY_RENDERER=Object.freeze({
    renderDigits:(...args)=>digitsSlot.get()(...args),
    renderReg:(...args)=>regSlot.get()(...args),
    set2:(...args)=>set2Slot.get()(...args),
    setReg:(...args)=>setRegSlot.get()(...args),
    setLamp:(...args)=>setLampSlot.get()(...args),
    clearLamps:(...args)=>clearLampsSlot.get()(...args),
    compatibilityVersions:()=>({
      glyph:glyphSlot.version(),signGlyph:signSlot.version(),renderDigits:digitsSlot.version(),renderReg:regSlot.version(),
      set2:set2Slot.version(),setReg:setRegSlot.version(),setLamp:setLampSlot.version(),clearLamps:clearLampsSlot.version()
    })
  });
})();
