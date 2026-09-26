'use strict';

// Shared electroluminescent DSKY rendering authority. Legacy parser-global
// names remain forwarded compatibility aliases at this boundary; renderer
// implementation authority stays local to AGCDSKY_RENDERER.
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
  // Emit energized phosphor only. Unlit electrodes are deliberately absent
  // from the SVG so they cannot leave a gray trace, antialias fringe, or filter shadow.
  function pathEl(name){return `<path class="el-seg on" data-seg="${name}" d="${PATH[name]}"/>`}
  function baseGlyph(ch,x){const lit=SEG[ch]||'';return `<g class="el-glyph" transform="translate(${x} 0)">${Array.from(lit).map(pathEl).join('')}</g>`}
  function baseSignGlyph(sign){
    const plus=sign==='+',bar=plus||sign==='-';
    let out=`<g class="el-sign">`;
    if(bar)out+=`<path class="el-seg on" d="M.54 10.92 L1.12 10.34 L5.74 10.34 L6.32 10.92 L5.72 11.50 L1.10 11.50 Z"/>`;
    if(plus){
      out+=`<path class="el-seg on" d="M3.56 4.26 L4.46 4.72 L3.76 10.06 L2.90 10.56 L2.58 10.10 L3.26 4.76 Z"/>`;
      out+=`<path class="el-seg on" d="M2.70 11.88 L3.60 12.34 L2.90 17.70 L2.04 18.20 L1.72 17.74 L2.40 12.38 Z"/>`;
    }
    return out+`</g>`;
  }

  function createImplementationSlot(name,initial,validate=null){
    if(validate&&!validate(initial))throw new TypeError(`Invalid initial renderer implementation: ${name}`);
    let value=initial,version=0;
    const history=[];
    return Object.freeze({
      get:()=>value,
      set(next,reason='explicit renderer implementation'){
        if(validate&&!validate(next))throw new TypeError(`Invalid renderer implementation: ${name}`);
        const prior=value;value=next;version++;history.push(Object.freeze({version,reason:String(reason)}));return prior;
      },
      version:()=>version,
      history:()=>history.map(item=>({...item}))
    });
  }

  const SVG_NS='http://www.w3.org/2000/svg',SEGMENT_NAMES=Object.freeze(Object.keys(PATH));
  function clearNode(node){while(node&&node.firstChild)node.removeChild(node.firstChild)}
  function stableSlots(el,kind,count){
    const existing=Array.from(el&&el.children||[]);
    const valid=existing.length===count&&existing.every((node,index)=>node.getAttribute&&node.getAttribute('data-el-base-slot')===kind&&node.getAttribute('data-el-base-slot-index')===String(index));
    if(valid)return existing;
    clearNode(el);
    const slots=[];
    for(let index=0;index<count;index++){
      const slot=document.createElementNS(SVG_NS,'g');
      slot.setAttribute('data-el-base-slot',kind);
      slot.setAttribute('data-el-base-slot-index',String(index));
      el.appendChild(slot);slots.push(slot);
    }
    return slots;
  }
  function basePath(name){
    const path=document.createElementNS(SVG_NS,'path');
    path.setAttribute('class','el-seg');
    path.setAttribute('data-seg',name);
    path.setAttribute('d',PATH[name]);
    return path;
  }
  function ensureBaseDigit(slot,x){
    const key=String(Number(x)||0),existing=slot.firstChild;
    const valid=slot.getAttribute('data-el-base-digit-x')===key&&existing&&existing.getAttribute&&existing.getAttribute('data-el-base-glyph')==='1'&&Array.from(existing.children||[]).length===SEGMENT_NAMES.length;
    if(valid)return existing;
    clearNode(slot);
    const glyph=document.createElementNS(SVG_NS,'g');
    glyph.setAttribute('class','el-glyph');
    glyph.setAttribute('data-el-base-glyph','1');
    glyph.setAttribute('transform',`translate(${Number(x)||0} 0)`);
    for(const name of SEGMENT_NAMES)glyph.appendChild(basePath(name));
    slot.appendChild(glyph);slot.setAttribute('data-el-base-digit-x',key);slot.setAttribute('data-el-base-value','');
    return glyph;
  }
  function paintBaseDigit(slot,ch,x,version){
    const glyph=ensureBaseDigit(slot,x),key=`${version}:${ch}`;
    if(slot.getAttribute('data-el-base-value')===key)return false;
    const lit=segmentPattern(ch);
    for(const path of Array.from(glyph.children||[])){
      const next=lit.includes(path.getAttribute('data-seg'))?'el-seg on':'el-seg';
      if(path.getAttribute('class')!==next)path.setAttribute('class',next);
    }
    slot.setAttribute('data-el-base-value',key);return true;
  }
  function ensureBaseSign(slot){
    const existing=slot.firstChild;
    const valid=existing&&existing.getAttribute&&existing.getAttribute('data-el-base-sign')==='1'&&Array.from(existing.children||[]).length===3;
    if(valid)return existing;
    clearNode(slot);
    const sign=document.createElementNS(SVG_NS,'g');sign.setAttribute('class','el-sign');sign.setAttribute('data-el-base-sign','1');
    const defs=[
      ['bar','M.54 10.92 L1.12 10.34 L5.74 10.34 L6.32 10.92 L5.72 11.50 L1.10 11.50 Z'],
      ['upper','M3.56 4.26 L4.46 4.72 L3.76 10.06 L2.90 10.56 L2.58 10.10 L3.26 4.76 Z'],
      ['lower','M2.70 11.88 L3.60 12.34 L2.90 17.70 L2.04 18.20 L1.72 17.74 L2.40 12.38 Z']
    ];
    for(const [part,d] of defs){const p=document.createElementNS(SVG_NS,'path');p.setAttribute('class','el-seg');p.setAttribute('data-sign-part',part);p.setAttribute('d',d);sign.appendChild(p)}
    slot.appendChild(sign);slot.setAttribute('data-el-base-value','');return sign;
  }
  function paintBaseSign(slot,value,version){
    const sign=String(value||' '),group=ensureBaseSign(slot),key=`${version}:${sign}`;
    if(slot.getAttribute('data-el-base-value')===key)return false;
    for(const path of Array.from(group.children||[])){
      const part=path.getAttribute('data-sign-part'),on=sign==='+'||(sign==='-'&&part==='bar'),next=on?'el-seg on':'el-seg';
      if(path.getAttribute('class')!==next)path.setAttribute('class',next);
    }
    slot.setAttribute('data-el-base-value',key);return true;
  }

  let glyphSlot,signSlot,digitsSlot,regSlot,set2Slot,setRegSlot,setLampSlot,clearLampsSlot;
  function baseRenderDigits(el,text){
    const chars=String(text).split(''),slots=stableSlots(el,'digits',chars.length),version=glyphSlot.version();
    chars.forEach((ch,i)=>paintBaseDigit(slots[i],ch,i*14,version));
  }
  function baseRenderReg(el,text){
    text=String(text);const chars=text.slice(1).split(''),slots=stableSlots(el,'register',1+chars.length);
    paintBaseSign(slots[0],text[0],signSlot.version());
    chars.forEach((ch,i)=>paintBaseDigit(slots[i+1],ch,7+i*14,glyphSlot.version()));
  }
  function baseSet2(id,text){digitsSlot.get()(document.getElementById(id),String(text).padEnd(2,' ').slice(0,2))}
  function baseSetReg(id,sign,digits){regSlot.get()(document.getElementById(id),(sign||' ')+String(digits).padEnd(5,' ').slice(0,5))}
  function baseSetLamp(name,on){const x=document.querySelector(`[data-lamp="${name}"]`);if(x)x.classList.toggle('on',!!on)}
  function baseClearLamps(){document.querySelectorAll('[data-lamp]').forEach(x=>x.classList.remove('on'));document.body.classList.remove('vn-flash-off','el-off')}

  const isFn=value=>typeof value==='function';
  glyphSlot=createImplementationSlot('glyph',baseGlyph,isFn);
  signSlot=createImplementationSlot('signGlyph',baseSignGlyph,isFn);
  digitsSlot=createImplementationSlot('renderDigits',baseRenderDigits,isFn);
  regSlot=createImplementationSlot('renderReg',baseRenderReg,isFn);
  set2Slot=createImplementationSlot('set2',baseSet2,isFn);
  setRegSlot=createImplementationSlot('setReg',baseSetReg,isFn);
  setLampSlot=createImplementationSlot('setLamp',baseSetLamp,isFn);
  clearLampsSlot=createImplementationSlot('clearLamps',baseClearLamps,isFn);

  compat.readonly('SEG',()=>SEG);
  compat.readonly('PATH',()=>PATH);
  for(const [name,slot] of Object.entries({glyph:glyphSlot,signGlyph:signSlot,renderDigits:digitsSlot,renderReg:regSlot,set2:set2Slot,setReg:setRegSlot,setLamp:setLampSlot,clearLamps:clearLampsSlot})){
    compat.alias(name,slot.get,(next,reason)=>slot.set(next,reason),slot.version,slot.history);
  }

  const implementationSlots=Object.freeze({
    glyph:glyphSlot,
    signGlyph:signSlot,
    renderDigits:digitsSlot,
    renderReg:regSlot,
    set2:set2Slot,
    setReg:setRegSlot,
    setLamp:setLampSlot,
    clearLamps:clearLampsSlot
  });
  function implementation(name){
    const slot=implementationSlots[name];
    if(!slot)throw new Error(`Unknown renderer implementation: ${String(name)}`);
    return slot.get();
  }
  function installImplementation(name,next,reason='explicit renderer implementation'){
    const slot=implementationSlots[name];
    if(!slot)throw new Error(`Unknown renderer implementation: ${String(name)}`);
    if(typeof next!=='function')throw new TypeError(`Renderer implementation must be a function: ${String(name)}`);
    return slot.set(next,reason);
  }
  function segmentPattern(ch){return SEG[ch]||''}
  function registerSegmentPattern(ch,pattern){SEG[ch]=String(pattern||'');return SEG[ch]}

  window.AGCDSKY_RENDERER=Object.freeze({
    renderDigits:(...args)=>digitsSlot.get()(...args),
    renderReg:(...args)=>regSlot.get()(...args),
    set2:(...args)=>set2Slot.get()(...args),
    setReg:(...args)=>setRegSlot.get()(...args),
    setLamp:(...args)=>setLampSlot.get()(...args),
    clearLamps:(...args)=>clearLampsSlot.get()(...args),
    implementation,
    installImplementation,
    segmentPattern,
    registerSegmentPattern,
    compatibilityVersions:()=>({
      glyph:glyphSlot.version(),signGlyph:signSlot.version(),renderDigits:digitsSlot.version(),renderReg:regSlot.version(),
      set2:set2Slot.version(),setReg:setRegSlot.version(),setLamp:setLampSlot.version(),clearLamps:clearLampsSlot.version()
    })
  });
})();