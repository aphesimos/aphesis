// Records the φ as the brush engine draws it (the same code as the home), one outline per frame.
const fs=require('fs'), S=process.argv[2], FPS=+process.argv[3]||24;
global.requestAnimationFrame=()=>0; global.cancelAnimationFrame=()=>0;
const src=fs.readFileSync(S+'/model.js','utf8')+'\nconst reduz=false;\n'+fs.readFileSync(S+'/core.js','utf8')+`
const ANC='isolada';
const eixoPhi=eixoHaste.concat(eixoAnel(KFIM,0)), relPhi=relogioCaneta(eixoPhi);
const VEL=800;
function drawState(k){
  const x=sDoTempo(relPhi,MJ(k)); const pos=posicao(0,ANC);
  if(x<=NS_-1) return {...BASE,...pos,te:TS-LT-1,hs:x};
  const kk=x-(NS_-1), arc=relPhi.s[Math.floor(x)]-relPhi.s[NS_-1];
  return {...BASE,...pos,te:TH(0)+kk*ST,hs:NS_-1,penHaste:arc};
}
const dur=relPhi.seg/VEL, n=Math.round(dur*FPS), frames=[];
for(let i=0;i<=n;i++) frames.push(caminho(geometria(drawState(i/n))));
frames.push(caminho(geometria({...BASE,...posicao(0,ANC)})));
module.exports={dur,frames,viewBox:'-45 -90 1090 1090'};`;
const m={exports:{}}; new Function('module','require','FPS',src)(m,require,FPS);
fs.writeFileSync('engine_frames.json',JSON.stringify(m.exports));
console.log('dur',m.exports.dur.toFixed(2),'frames',m.exports.frames.length,'avg len',Math.round(m.exports.frames.reduce((a,b)=>a+b.length,0)/m.exports.frames.length));
