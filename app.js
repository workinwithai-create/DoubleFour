// DoubleFour — WorkinWithAI. Double-time feel desk. Live samples only (FluidR3 + CC0 acoustic kit), pinned to commit SHAs.
const APP = "doublefour";
const FLUID_SHA = "044fab8e1456bfafc5776e86dfd6bb8697149aef"; // gleitz/midi-js-soundfonts
const KIT_SHA = "9f04cf9a734527edfbb0a4eee1f674e45bbf71bc";   // sfzinstruments/virtuosity_drums
const FLUID = `https://cdn.jsdelivr.net/gh/gleitz/midi-js-soundfonts@${FLUID_SHA}/FluidR3_GM`;
const KIT = `https://cdn.jsdelivr.net/gh/sfzinstruments/virtuosity_drums@${KIT_SHA}/Samples`;
const SR = 48000, LOOKAHEAD_MS = 25, SCHEDULE_AHEAD = 0.12, STEPS = 16, MAX_SHIFT = 4;
const NAMES = ["C","C#","D","Eb","E","F","F#","G","Ab","A","Bb","B"];
const FLAT = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"];
const noteName = n => FLAT[n%12] + (Math.floor(n/12)-1);
const CHAIRS = [
  { id:"kit",     name:"Acoustic kit (Virtuosity, CC0)", ch:9, gain:0.9 },
  { id:"bass",    name:"Upright bass (FluidR3 Acoustic Bass)", ch:0, gain:0.9 },
  { id:"piano",   name:"Grand piano (FluidR3 Acoustic Grand)", ch:1, gain:0.6 },
  { id:"strings", name:"String ensemble (FluidR3)", ch:2, gain:0.32 },
];
const RANGE = { piano:[40,76], bass:[28,55], strings:[52,76] };
const PROGRAM = { piano:"acoustic_grand_piano", bass:"acoustic_bass", strings:"string_ensemble_1" };
const KITMAP = { 36:"kickmic/kick/kickmic_kick_snoff_vl3_rr1.flac", 38:"mid/snare/mid_snare_center_vl24.flac", 42:"mid/hh/mid_hh_closed_vl3_rr1.flac", 51:"mid/ride/mid_ride_ride_vl2_rr1.flac" };
const KITNAME = { 36:"kick", 38:"snare", 42:"closed hat", 51:"ride" };
const recipes = [
  { id:"backbeat", name:"Backbeat doubles", blurb:"Snare moves to every and. Kick on every beat. Hats in 16ths." },
  { id:"ride", name:"Ride drive", blurb:"Ride in 8ths, snare on the ands. Upright in 8th roots." },
  { id:"walk", name:"Upright runs", blurb:"Upright walks in 8ths: root, 3rd, 5th, approach." },
  { id:"push", name:"Piano push", blurb:"Piano anticipates in 16th pushes over the doubled kit." },
  { id:"race", name:"Race out", blurb:"Backbeat doubles plus a 16th snare run into bar 9." },
];
const grooves = [
  { id:"amber", name:"Amber Loop", bpm:92, key:9, chords:"Am F C G" },
  { id:"porch", name:"Porch Four", bpm:86, key:4, chords:"E B C#m A" },
  { id:"fold",  name:"Fold Radio", bpm:104, key:2, chords:"Dm Bb F C" },
];
const QUAL = {"":[0,4,7], m:[0,3,7], min:[0,3,7], "7":[0,4,7,10], m7:[0,3,7,10], maj7:[0,4,7,11], dim:[0,3,6], sus2:[0,2,7], sus4:[0,5,7]};
const ROOT = {C:0,D:2,E:4,F:5,G:7,A:9,B:11};
const pc = x => ((x%12)+12)%12;
const inRange = (n,lo,hi) => { while(n<lo) n+=12; while(n>hi) n-=12; return n; };

// ---------- state (one mutable object, persisted) ----------
const DEFAULT = { bpm:92, keyRoot:9, chords:"Am F C G", groove:"amber", recipe:"backbeat", form:"full", bars:8,
  mutes:{kit:false,bass:false,piano:false,strings:false}, gains:{kit:0.9,bass:0.9,piano:0.6,strings:0.32}, midiIn:"", midiOut:"", midiInMode:"chords" };
const state = Object.assign({}, DEFAULT, JSON.parse(localStorage.getItem(APP+"-settings")||"{}"));
state.mutes = Object.assign({}, DEFAULT.mutes, state.mutes); state.gains = Object.assign({}, DEFAULT.gains, state.gains);
const save = () => localStorage.setItem(APP+"-settings", JSON.stringify(state));
function parseChord(s){ const m=/^([A-G])(#|b)?(maj7|min|m7|m|7|dim|sus2|sus4)?$/.exec(s.trim()); if(!m) return null;
  return { root:pc(ROOT[m[1]]+(m[2]==="#"?1:m[2]==="b"?-1:0)), ivs:QUAL[m[3]||""], minor:/^m(?!aj)|min|dim/.test(m[3]||""), name:s.trim() }; }
function parseProg(str){ const t=str.trim().split(/[\s,|]+/).filter(Boolean); if(t.length!==4) return null; const c=t.map(parseChord); return c.includes(null)?null:c; }
let prog = parseProg(state.chords) || parseProg(DEFAULT.chords);
const transpose = () => pc(state.keyRoot - prog[0].root);
const keyLabel = () => NAMES[state.keyRoot].replace("#","s") + (prog[0].minor?"m":"");
const chordName = i => NAMES[pc(prog[i].root+transpose())] + prog[i].name.replace(/^[A-G](#|b)?/,"");

// ---------- arrangement: one function feeds live, WAV and MIDI (deterministic) ----------
function stepEvents(step, st, pr){
  const out=[], bar=Math.floor(step/STEPS), s=step%STEPS, t=pc(st.keyRoot-pr[0].root);
  const c=pr[bar%4], nx=pr[(bar+1)%4], root=pc(c.root+t), R=st.recipe;
  const dbl = st.form==="double" || (bar%8)>=4, lastBar = (bar%4)===3;
  const b = inRange(33+pc(root-33),33,44), f=b+7;
  const voicing=(lo,hi)=>c.ivs.slice(0,4).map(iv=>inRange(lo+pc(root+iv-lo),lo,hi)).sort((x,y)=>x-y);
  const kit=(n,v,d=2)=>{ if(!st.mutes.kit) out.push({part:"kit",note:n,dur:d,vel:v}); };
  const bass=(n,d,v)=>{ if(!st.mutes.bass) out.push({part:"bass",note:n,dur:d,vel:v}); };
  const piano=(d,v)=>{ if(st.mutes.piano) return; out.push({part:"piano",note:inRange(40+pc(root-40),40,51),dur:d,vel:v}); for(const n of voicing(55,67)) out.push({part:"piano",note:n,dur:d,vel:v*0.8}); };
  if(!dbl){ // your loop, straight feel
    if(s===0||s===8||s===10) kit(36, s===0?1:0.8, 4);
    if(s===4||s===12) kit(38,0.8,4);
    if(s%2===0) kit(42, s%4===0?0.6:0.4);
    if(s===0) bass(b,8,0.95); if(s===8) bass(f,8,0.8);
    if(s===0||s===8) piano(8, s===0?0.75:0.6);
  } else { // double-time feel: same chords, same BPM, felt pulse on the 8th
    const race = R==="race" && lastBar && s>=12;
    if(R==="ride"){ if(s%2===0) kit(51, s%4===0?0.6:0.45, 4); if(s===0||s===8) kit(36,1,4); }
    else { if(s%4===0) kit(36, s===0?1:0.85, 4); kit(42, s%2===0?0.5:0.3, 1); }
    if(race) kit(38, 0.45+0.12*(s-12), 1); else if(s%4===2) kit(38, 0.85, 2);
    if(R==="walk"){ if(s%2===0){ const q=(s/2)%4, nr=inRange(33+pc(nx.root+t-33),33,44);
        bass(q===0?b : q===1?b+c.ivs[1] : q===2?b+c.ivs[2] : (nr>b?nr-1:nr+1), 2, q===0?1:0.85); } }
    else if(s%2===0) bass(R==="ride"||(s/2)%2===0 ? b : f, 2, s%4===0?0.95:0.8);
    if(R==="push"){ if([0,3,6,8,11,14].includes(s)) piano(2, s%8===0?0.75:0.6); }
    else if(s%2===0) piano(2, s%4===0?0.65:0.5);
  }
  if(!st.mutes.strings && s===0) for(const n of voicing(57,70)) out.push({part:"strings",note:n,dur:16,vel:0.6}); // harmony keeps the original rate
  return out;
}

// ---------- samples: pinned CDN, raw ArrayBuffers kept for export ----------
const files = [];
for (const id of ["piano","bass","strings"]) for (let n=RANGE[id][0]; n<=RANGE[id][1]; n++) files.push({ id, note:n, url:`${FLUID}/${PROGRAM[id]}-mp3/${noteName(n)}.mp3`, label:CHAIRS.find(c=>c.id===id).name });
for (const [n,p] of Object.entries(KITMAP)) files.push({ id:"kit", note:+n, url:`${KIT}/${p}`, label:`Acoustic kit ${KITNAME[n]}` });
const raw = {}, missing = new Set(); let loaded = 0, loadDone = false;
const loadAll = (async () => {
  let i = 0; const worker = async () => { while (i < files.length) { const f = files[i++];
    try { const r = await fetch(f.url); if (!r.ok) throw new Error(r.status); raw[f.url] = await r.arrayBuffer(); }
    catch (e) { missing.add(f.label + " (" + f.url.split("/").pop() + ")"); }
    loaded++; showLoad(); } };
  await Promise.all(Array.from({length:8}, worker)); loadDone = true; showLoad();
})();
function showLoad(){
  const el = document.getElementById("status"); if(!el) return;
  if (missing.size) { el.className="status miss"; const inst=[...new Set([...missing].map(m=>m.replace(/ \(.*$/,"")))];
    el.textContent = `Missing instruments, playback disabled: ${inst.join(", ")} — ${missing.size} file(s) failed, e.g. ${[...missing].slice(0,3).join(", ")}`; }
  else el.textContent = loadDone ? `Chairs seated ${loaded}/${files.length} · live FluidR3 + CC0 kit` : `Seating chairs ${loaded}/${files.length}`;
  const ok = loadDone && !missing.size; ["playA","playB","play8","exportWav"].forEach(id=>{ const b=document.getElementById(id); if(b) b.disabled=!ok; });
}
async function decodeAll(c){ // -> {id:{note:{buf,offset}}}; offset skips MP3 encoder padding / pre-roll so hits land on the grid
  const out={};
  await Promise.all(files.map(async f => { const buf = await c.decodeAudioData(raw[f.url].slice(0));
    const d0=buf.getChannelData(0); let pk=0; for(let i=0;i<d0.length;i++){ const a=Math.abs(d0[i]); if(a>pk) pk=a; }
    let on=0; while(on<d0.length && Math.abs(d0[on])<pk*0.01) on++; on=Math.max(0,on-2);
    (out[f.id]=out[f.id]||{})[f.note] = { buf, offset:on/buf.sampleRate }; }));
  return out;
}
function pick(id, note){ if(id==="kit") return note; const [lo,hi]=RANGE[id]; const n=Math.min(hi,Math.max(lo,note)); if(Math.abs(n-note)>MAX_SHIFT) throw new Error(id+" out of range "+note); return n; }

// ---------- sampler voice ----------
const REL = { kit:0.03, bass:0.05, piano:0.1, strings:0.25 };
function voice(c, bufs, dest, ev, t, sd, track){
  const r = pick(ev.part, ev.note), smp = bufs[ev.part][r], buf = smp.buf, rate = Math.pow(2,(ev.note-r)/12);
  const end = t + ev.dur*sd, rel = REL[ev.part], g = c.createGain(); g.connect(dest);
  const usable = (buf.duration - smp.offset)/rate - 0.05;
  let off = ev.part==="kit" ? t + Math.min(usable, ev.note===51?1.6:ev.note===42?0.2:0.7) : end;
  if (ev.part!=="strings") off = Math.min(off, t + usable - rel);
  if (ev.part==="kit") g.gain.setValueAtTime(ev.vel, t);
  else { g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(ev.vel, t+(ev.part==="strings"?0.12:0.002)); }
  g.gain.setValueAtTime(ev.vel, off); g.gain.linearRampToValueAtTime(0, off+rel);
  const srcs=[]; const XF=0.25, LOOP_FROM=1.0; let segStart=t, segOff=smp.offset, first=true;
  for(;;){ // strings hold with crossfaded retriggers from the sustain section
    const s=c.createBufferSource(); s.buffer=buf; s.playbackRate.value=rate; const sg=c.createGain(); s.connect(sg); sg.connect(g);
    const segEnd = segStart + (buf.duration-segOff)/rate - 0.05;
    if(!first){ sg.gain.setValueAtTime(0,segStart); sg.gain.linearRampToValueAtTime(1,segStart+XF); }
    s.start(segStart, segOff);
    if(ev.part==="strings" && segEnd < off+rel){ sg.gain.setValueAtTime(1,segEnd-XF); sg.gain.linearRampToValueAtTime(0,segEnd); s.stop(segEnd+0.01); srcs.push(s); segStart=segEnd-XF; segOff=LOOP_FROM; first=false; }
    else { s.stop(off+rel+0.01); srcs.push(s); break; }
  }
  if(track) for(const s of srcs){ active.add(s); s.onended=()=>active.delete(s); }
}
function makeComp(c){ const k=c.createDynamicsCompressor(); k.threshold.value=-8; k.knee.value=6; k.ratio.value=12; k.attack.value=0.003; k.release.value=0.15; return k; }
function buildBus(c, gains){ const comp=makeComp(c); comp.connect(c.destination); const chairs={}; for(const ch of CHAIRS){ const g=c.createGain(); g.gain.value=gains[ch.id]; g.connect(comp); chairs[ch.id]=g; } return {comp,chairs}; }

// ---------- live engine: lookahead scheduler on the audio clock ----------
let ctx=null, bus=null, liveBufs=null, timerId=null, nextStepTime=0, step=0, playing=false, mode=null, startBar=0, loopBars=4;
const active=new Set(), stepLog=[]; window.__schedLog=[];
async function ensureCtx(){
  if(!ctx){ ctx=new (window.AudioContext||window.webkitAudioContext)({sampleRate:SR}); bus=buildBus(ctx,state.gains); }
  await ctx.resume(); if(!liveBufs){ await loadAll; if(!missing.size) liveBufs=await decodeAll(ctx); }
}
function liveForm(){ return mode==="eight" ? "double" : "full"; }
function start(m){
  if(!ctx||ctx.state!=="running"||!liveBufs||missing.size) return;
  stop(); mode=m; startBar = m==="eight"?4:0; loopBars = m==="loop"?4:m==="eight"?4:8;
  nextStepTime=ctx.currentTime+0.1; step=0; stepLog.length=0; playing=true;
  timerId=setInterval(scheduler, LOOKAHEAD_MS); scheduler(); requestAnimationFrame(draw);
}
function scheduler(){ while(nextStepTime < ctx.currentTime+SCHEDULE_AHEAD){ scheduleStep(step, nextStepTime); nextStepTime += 60/state.bpm/4; step=(step+1)%(loopBars*STEPS); } }
function scheduleStep(st, time){
  const sd=60/state.bpm/4, abs = startBar*STEPS + st, live = Object.assign({}, state, {form: mode==="eight"?"double":"full"});
  const evs = stepEvents(abs, live, prog);
  for(const ev of evs){ voice(ctx, liveBufs, bus.chairs[ev.part], ev, time, sd, true); midiSend(ev, time, sd); }
  stepLog.push({bar:Math.floor(abs/STEPS), s:abs%STEPS, time}); if(stepLog.length>256) stepLog.shift();
  window.__schedLog.push({step:abs, time, bpm:state.bpm, recipe:state.recipe, mutes:Object.assign({},state.mutes), notes:evs.map(e=>e.part+":"+e.note)});
  if(window.__schedLog.length>3000) window.__schedLog.shift();
}
function stop(){
  clearInterval(timerId); timerId=null; playing=false; mode=null;
  for(const s of active){ try{ s.stop(); }catch(e){} } active.clear();
  if(midiOut) for(const c of CHAIRS) midiOut.send([0xB0|c.ch,123,0]);
  document.querySelectorAll(".bar").forEach(b=>b.classList.remove("active"));
}
function draw(){ // playhead from ctx.currentTime
  if(!playing) return; const now=ctx.currentTime; let cur=null;
  for(const e of stepLog){ if(e.time<=now) cur=e; else break; }
  if(cur){ const fr=(cur.s+Math.min(1,(now-cur.time)/(60/state.bpm/4)))/STEPS;
    document.querySelectorAll(".bar").forEach((el,i)=>{ el.classList.toggle("active",i===cur.bar); if(i===cur.bar) el.querySelector(".ph").style.left=(fr*100)+"%"; }); }
  requestAnimationFrame(draw);
}
document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="hidden" && playing){ stop(); document.getElementById("status").textContent="Stopped (tab hidden). Press play to start again."; } });

// ---------- export ----------
let compLatency=null;
async function measureCompLatency(){
  if(compLatency!==null) return compLatency;
  const oc=new OfflineAudioContext(1,4096,SR), b=oc.createBuffer(1,600,SR), x=b.getChannelData(0); for(let i=0;i<600;i++) x[i]=0.3*Math.sin(2*Math.PI*60*i/SR);
  const s=oc.createBufferSource(); s.buffer=b; const k=makeComp(oc); s.connect(k); k.connect(oc.destination); s.start(0);
  const d=(await oc.startRendering()).getChannelData(0); let best=0,bv=-Infinity;
  for(let L=0;L<1024;L++){ let c=0; for(let i=0;i<600;i++) c+=x[i]*d[i+L]; if(c>bv){bv=c;best=L;} } return compLatency=best;
}
function merged(o){ const st=Object.assign({},state,o||{}); st.mutes=Object.assign({},state.mutes,(o||{}).mutes); st.gains=Object.assign({},state.gains,(o||{}).gains); return st; }
async function renderLoop(o){
  await loadAll; if(missing.size) throw new Error("Missing samples");
  const st=merged(o), N=Math.round(st.bars*4*60/st.bpm*SR), TAIL=Math.round(3*SR), D=await measureCompLatency();
  const oc=new OfflineAudioContext(2, D+N+TAIL, SR), bufs=await decodeAll(oc), b=buildBus(oc, st.gains), sd=60/st.bpm/4;
  for(let s=0;s<st.bars*STEPS;s++) for(const ev of stepEvents(s, st, prog)) voice(oc, bufs, b.chairs[ev.part], ev, s*sd, sd, false);
  const buf=await oc.startRendering();
  const ch=[0,1].map(i=>{ const d=buf.getChannelData(i), x=new Float32Array(N); x.set(d.subarray(D,D+N)); for(let j=0;j<TAIL;j++) x[j]+=d[D+N+j]; return x; });
  let pk=0; for(const d of ch) for(let i=0;i<N;i++){ const a=Math.abs(d[i]); if(a>pk) pk=a; }
  const k=pk>0?Math.pow(10,-1.1/20)/pk:1; for(const d of ch) for(let i=0;i<N;i++) d[i]*=k;
  return {ch,N,st};
}
function wav24(ch,N){ const nc=2,len=N*nc*3,b=new ArrayBuffer(44+len),v=new DataView(b); let p=0;
  const str=s=>{for(const c of s) v.setUint8(p++,c.charCodeAt(0));}, u32=x=>{v.setUint32(p,x,true);p+=4}, u16=x=>{v.setUint16(p,x,true);p+=2};
  str("RIFF");u32(36+len);str("WAVE");str("fmt ");u32(16);u16(1);u16(nc);u32(SR);u32(SR*nc*3);u16(nc*3);u16(24);str("data");u32(len);
  for(let i=0;i<N;i++) for(let c=0;c<nc;c++){ let x=Math.round(Math.max(-1,Math.min(1,ch[c][i]))*8388607); if(x<0)x+=16777216; v.setUint8(p++,x&255);v.setUint8(p++,(x>>8)&255);v.setUint8(p++,(x>>16)&255); }
  return new Uint8Array(b); }
function midiFile(st){
  const PPQ=480,T=PPQ/4, vlq=n=>{const a=[n&127]; while(n>>=7) a.unshift((n&127)|128); return a;};
  const trk=evs=>{ evs.sort((a,b)=>a.t-b.t||a.o-b.o); let last=0; const d=[]; for(const e of evs){ d.push(...vlq(e.t-last),...e.b); last=e.t; }
    d.push(...vlq(st.bars*STEPS*T-last),0xFF,0x2F,0); return [0x4D,0x54,0x72,0x6B,(d.length>>>24)&255,(d.length>>16)&255,(d.length>>8)&255,d.length&255,...d]; };
  const name=s=>{const c=[...s].map(x=>x.charCodeAt(0)); return [0xFF,0x03,c.length,...c];}, us=Math.round(60000000/st.bpm);
  const tracks=[trk([{t:0,o:0,b:name(APP+" "+keyLabel())},{t:0,o:1,b:[0xFF,0x51,3,(us>>16)&255,(us>>8)&255,us&255]},{t:0,o:2,b:[0xFF,0x58,4,4,2,24,8]}])];
  for(const c of CHAIRS){ const evs=[{t:0,o:0,b:name(c.name)}];
    for(let s=0;s<st.bars*STEPS;s++) for(const ev of stepEvents(s,st,prog)) if(ev.part===c.id){ const v=Math.max(1,Math.round(ev.vel*110));
      evs.push({t:s*T,o:2,b:[0x90|c.ch,ev.note,v]}); evs.push({t:(s+ev.dur)*T,o:1,b:[0x80|c.ch,ev.note,0]}); }
    tracks.push(trk(evs)); }
  return new Uint8Array([].concat([0x4D,0x54,0x68,0x64,0,0,0,6,0,1,0,tracks.length,PPQ>>8,PPQ&255],...tracks));
}
const fileBase = st => `${APP}-${st.recipe}${st.form==="double"?"-doubleonly":""}-${st.bpm}bpm-${keyLabel()}`;
function download(bytes,name,type){ const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([bytes],{type})); a.download=name; document.body.appendChild(a); a.click(); a.remove(); }
async function exportWavBytes(o){ const r=await renderLoop(o); return {bytes:wav24(r.ch,r.N), name:fileBase(r.st)+".wav"}; }
function exportMidBytes(o){ const st=merged(o); return {bytes:midiFile(st), name:fileBase(st)+".mid"}; }
window.__doublefour = { state, stepEvents, exportWavBytes, exportMidBytes, loadAll, start:m=>start(m), stop, files, get playing(){return playing;}, get ctx(){return ctx;}, get missing(){return [...missing];} };

// ---------- license gate (Lemon Squeezy License API) ----------
const lic = JSON.parse(localStorage.getItem(APP+"-license")||'{"valid":false}');
async function validateKey(key){ const r=await fetch("https://api.lemonsqueezy.com/v1/licenses/validate",{method:"POST",headers:{"Accept":"application/json","Content-Type":"application/x-www-form-urlencoded"},body:"license_key="+encodeURIComponent(key)}); const j=await r.json(); return !!j.valid; }
const licUI = () => document.getElementById("licState").textContent = lic.valid ? "Licensed: 8 and 16-bar WAV export unlocked." : "Free demo: all playback, MIDI export, MIDI I/O, 4-bar WAV. License unlocks 8/16-bar WAV.";

// ---------- Web MIDI ----------
let midiAccess=null, midiOut=null, midiInPort=null; const held=new Set(); let slot=0, chordNotes=null;
function midiSend(ev,time,sd){ if(!midiOut||!ctx) return; const c=CHAIRS.find(x=>x.id===ev.part), at=performance.now()+(time-ctx.currentTime)*1000, v=Math.max(1,Math.round(ev.vel*110));
  midiOut.send([0x90|c.ch,ev.note,v],at); midiOut.send([0x80|c.ch,ev.note,0],at+ev.dur*sd*1000-5); }
function chordFromNotes(notes){ const pcs=[...new Set([...notes].map(n=>n%12))], lo=Math.min(...notes)%12;
  for(const r of [lo,...pcs]) for(const [q,ivs] of Object.entries({"":[0,4,7],m:[0,3,7],"7":[0,4,7,10],m7:[0,3,7,10],maj7:[0,4,7,11],dim:[0,3,6],sus2:[0,2,7],sus4:[0,5,7]})){
    const set=ivs.map(i=>(r+i)%12); if(set.length===pcs.length && set.every(x=>pcs.includes(x))) return NAMES[r]+q; } return null; }
function onMidi(e){ const [s,n,v]=e.data, cmd=s&0xF0;
  if(cmd===0x90&&v>0){ if(state.midiInMode==="transport"){ playing?stop():ensureCtx().then(()=>start("full")); return; } held.add(n); chordNotes=new Set(held); }
  else if(cmd===0x80||(cmd===0x90&&v===0)){ held.delete(n);
    if(state.midiInMode==="chords"&&held.size===0&&chordNotes&&chordNotes.size>=3){ const c=chordFromNotes(chordNotes); chordNotes=null;
      if(c){ const t=ui.chords.value.trim().split(/\s+/); while(t.length<4) t.push("C"); t[slot]=c; slot=(slot+1)%4; ui.chords.value=t.join(" "); onChords(); } } } }
function refreshMidi(){ if(!midiAccess) return;
  const fill=(sel,ports,cur)=>{ sel.innerHTML='<option value="">(none)</option>'+[...ports.values()].map(p=>`<option value="${p.id}">${p.name}</option>`).join(""); sel.value=[...ports.keys()].includes(cur)?cur:""; };
  fill(ui.midiIn,midiAccess.inputs,state.midiIn); fill(ui.midiOut,midiAccess.outputs,state.midiOut);
  if(midiInPort) midiInPort.onmidimessage=null; midiInPort=midiAccess.inputs.get(ui.midiIn.value)||null; if(midiInPort) midiInPort.onmidimessage=onMidi;
  midiOut=midiAccess.outputs.get(ui.midiOut.value)||null; }

// ---------- UI (TagFour/LiftTwo conventions: cards, bars, punch list, dock) ----------
const ui={}; ["bpm","key","chords","chordErr","form","bars","midiIn","midiInMode","midiOut","midiNote","licKey","licBtn","tap","tapBtn"].forEach(id=>ui[id]=document.getElementById(id));
ui.key.innerHTML=NAMES.map((n,i)=>`<option value="${i}">${n}</option>`).join("");
function syncInputs(){ ui.bpm.value=state.bpm; ui.key.value=state.keyRoot; ui.chords.value=state.chords; ui.form.value=state.form; ui.bars.value=state.bars; ui.midiInMode.value=state.midiInMode; }
function onChords(){ const p=parseProg(ui.chords.value); if(!p){ ui.chordErr.textContent="Exactly 4 chords, e.g. Am F C G (m, 7, m7, maj7, dim, sus2, sus4)"; return; }
  ui.chordErr.textContent=""; const t=transpose(); prog=p; state.chords=ui.chords.value.trim(); state.keyRoot=pc(p[0].root+t); ui.key.value=state.keyRoot; save(); render(); }
function paintGrooves(){ const el=document.getElementById("grooves"); el.innerHTML="";
  grooves.forEach(g=>{ const b=document.createElement("button"); b.className="card"+(state.groove===g.id?" on":""); b.innerHTML=`<b>${g.name}</b><span>${g.bpm} BPM · ${g.chords}</span>`;
    b.onclick=()=>{ state.groove=g.id; state.bpm=g.bpm; state.chords=g.chords; prog=parseProg(g.chords); state.keyRoot=prog[0].root; save(); syncInputs(); render(); }; el.appendChild(b); }); }
function paintRecipes(){ const el=document.getElementById("recipes"); el.innerHTML="";
  recipes.forEach(r=>{ const b=document.createElement("button"); b.className="card"+(state.recipe===r.id?" on":""); b.innerHTML=`<b>${r.name}</b><span>${r.blurb}</span>`; b.onclick=()=>{ state.recipe=r.id; save(); render(); }; el.appendChild(b); }); }
function paintChairs(){ const el=document.getElementById("chairs"); el.innerHTML="";
  CHAIRS.forEach(c=>{ const d=document.createElement("div"); d.className="chair"+(state.mutes[c.id]?" muted":"");
    d.innerHTML=`<label><input type="checkbox" data-mute="${c.id}" ${state.mutes[c.id]?"checked":""}/> Mute</label><div>${c.name}</div><input type="range" min="0" max="1" step="0.01" data-gain="${c.id}" value="${state.gains[c.id]}"/>`; el.appendChild(d); }); }
function paintBars(){ const el=document.getElementById("bars8"); el.innerHTML="";
  for(let i=0;i<8;i++){ const d=document.createElement("div"); d.className="bar"+(i>=4?" dbl":""); d.innerHTML=`<div class="ph"></div><div class="n">${i+1} · ${i>=4?"2×":"1×"}</div><div class="c">${chordName(i%4)}</div>`; el.appendChild(d); } }
function punch(){ const r=recipes.find(x=>x.id===state.recipe);
  return `DoubleFour punch list\n${state.bpm} BPM · key ${keyLabel()} · ${r.name}\n\nThe problem: the loop never changes gear, so the song never gets to its last section.\nThe move: keep the click and the chords. Move the kit, upright and piano to the next subdivision for four bars. ${r.blurb}\n\nYour loop (bars 1-4, 1×): ${[0,1,2,3].map(chordName).join(" | ")}\nDouble-time (bars 5-8, 2×): ${[0,1,2,3].map(chordName).join(" | ")}\nStrings hold the chords at the original rate so the harmony does not rush.\n\nDrop the WAV on bar 1. Export file: ${fileBase(state)}.wav + .mid (one track per chair).\nNot half-time (HalfEight), not a key change (ModEight), not a tag (TagFour).`; }
function render(){ paintGrooves(); paintRecipes(); paintChairs(); paintBars(); document.getElementById("punch").textContent=punch(); }
ui.bpm.addEventListener("change",()=>{ const v=Math.round(+ui.bpm.value); if(!(v>=60&&v<=180)){ ui.bpm.value=state.bpm; return; } state.bpm=v; save(); render(); });
ui.key.addEventListener("change",()=>{ state.keyRoot=+ui.key.value; save(); render(); });
ui.chords.addEventListener("change",onChords);
ui.form.addEventListener("change",()=>{ state.form=ui.form.value; save(); render(); });
ui.bars.addEventListener("change",()=>{ state.bars=+ui.bars.value; save(); });
ui.midiInMode.addEventListener("change",()=>{ state.midiInMode=ui.midiInMode.value; save(); });
ui.midiIn.addEventListener("change",()=>{ state.midiIn=ui.midiIn.value; save(); refreshMidi(); });
ui.midiOut.addEventListener("change",()=>{ state.midiOut=ui.midiOut.value; save(); refreshMidi(); });
document.getElementById("chairs").addEventListener("input",e=>{ const m=e.target.dataset.mute, g=e.target.dataset.gain;
  if(m){ state.mutes[m]=e.target.checked; e.target.closest(".chair").classList.toggle("muted",e.target.checked); }
  if(g){ state.gains[g]=+e.target.value; if(bus) bus.chairs[g].gain.setTargetAtTime(state.gains[g],ctx.currentTime,0.01); }
  save(); });
const go = m => async () => { await ensureCtx(); start(m); };
document.getElementById("playA").onclick=go("loop");
document.getElementById("playB").onclick=go("full");
document.getElementById("play8").onclick=go("eight");
document.getElementById("stop").onclick=stop;
document.getElementById("copy").onclick=()=>navigator.clipboard.writeText(punch());
document.getElementById("exportWav").onclick=async()=>{ const s=document.getElementById("status");
  if(!lic.valid && state.bars>4){ s.textContent="Demo: 4-bar WAV export. Unlock below for 8/16 bars."; return; }
  s.textContent="Rendering…"; try{ const r=await exportWavBytes(); download(r.bytes,r.name,"audio/wav"); s.textContent="Saved "+r.name; }catch(e){ s.textContent="Export failed: "+e.message; } };
document.getElementById("exportMid").onclick=()=>{ const r=exportMidBytes(); download(r.bytes,r.name,"audio/midi"); document.getElementById("status").textContent="Saved "+r.name; };
ui.tapBtn.onclick=async()=>{ ui.tapBtn.textContent="Starting…"; await ensureCtx(); if(ctx.state==="running") ui.tap.classList.add("hide"); showLoad(); };
ui.licBtn.onclick=async()=>{ const k=ui.licKey.value.trim(); if(!k) return; document.getElementById("licState").textContent="Checking…";
  try{ lic.valid=await validateKey(k); lic.key=k; localStorage.setItem(APP+"-license",JSON.stringify(lic)); licUI(); if(!lic.valid) document.getElementById("licState").textContent="That key is not valid."; }
  catch(e){ document.getElementById("licState").textContent="Could not reach Lemon Squeezy."; } };
if(lic.valid&&lic.key) validateKey(lic.key).then(v=>{ lic.valid=v; localStorage.setItem(APP+"-license",JSON.stringify(lic)); licUI(); }).catch(()=>{});
if(navigator.requestMIDIAccess) navigator.requestMIDIAccess().then(a=>{ midiAccess=a; a.onstatechange=refreshMidi; refreshMidi(); }).catch(()=>{ ui.midiNote.textContent="Web MIDI unavailable or blocked in this browser."; });
else ui.midiNote.textContent="Web MIDI not supported here (try Chrome/Edge).";
syncInputs(); render(); licUI(); showLoad();
