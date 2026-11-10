/* ---------- brush: a centerline + width profile becomes a filled outline (tapered both ends, slight wobble) ---------- */
function rng(seed){let s=seed>>>0||1;return()=>{s^=s<<13;s>>>=0;s^=s>>>17;s^=s<<5;s>>>=0;return s/4294967296;};}
function brush(pts,w,seed,taper=0.22,amp=0.08){
  const r=rng(seed), n=pts.length, L=[],R=[]; const ph=[r()*6,r()*6,r()*6];
  for(let i=0;i<n;i++){const a=pts[Math.max(0,i-1)],b=pts[Math.min(n-1,i+1)];let tx=b[0]-a[0],ty=b[1]-a[1];const l=Math.hypot(tx,ty)||1;tx/=l;ty/=l;
    const u=i/(n-1); let k=1; if(u<taper) k=Math.sin(u/taper*Math.PI/2); if(u>1-taper) k=Math.min(k,Math.sin((1-u)/taper*Math.PI/2));
    const wob=1+amp*(Math.sin(u*9+ph[0])+0.5*Math.sin(u*23+ph[1])), wl=w*k*wob*(1+0.06*Math.sin(u*31+ph[2])), wr=w*k*wob*(1-0.05*Math.sin(u*27+ph[1]));
    L.push([pts[i][0]-ty*wl/2,pts[i][1]+tx*wl/2]); R.push([pts[i][0]+ty*wr/2,pts[i][1]-tx*wr/2]);}
  const f=v=>v.toFixed(2); let d='M'+f(L[0][0])+' '+f(L[0][1]); for(let i=1;i<n;i++) d+='L'+f(L[i][0])+' '+f(L[i][1]); for(let i=n-1;i>=0;i--) d+='L'+f(R[i][0])+' '+f(R[i][1]); return d+'Z';
}
const arc=(cx,cy,r,a0,a1,n=64,ry)=>{const p=[];for(let i=0;i<=n;i++){const a=(a0+(a1-a0)*i/n)*Math.PI/180;p.push([cx+r*Math.cos(a),cy+(ry||r)*Math.sin(a)]);}return p;};
const line=(x0,y0,x1,y1,n=24)=>{const p=[];for(let i=0;i<=n;i++){const t=i/n;p.push([x0+(x1-x0)*t,y0+(y1-y0)*t]);}return p;};
/* stipple: dots inside a region, density by a function; deterministic */
function stipple(test,seed,count,size=0.42){const r=rng(seed);let d='';for(let i=0;i<count;i++){const x=r()*24,y=r()*24;if(test(x,y)){const s=size*(0.7+r()*0.6);d+=`M${(x-s/2).toFixed(2)} ${(y-s/2).toFixed(2)}h${s.toFixed(2)}v${s.toFixed(2)}h${(-s).toFixed(2)}z`;}}return d;}
const inC=(cx,cy,r)=>(x,y)=>(x-cx)**2+(y-cy)**2<r*r;
/* ---------- the five concepts: each returns svg inner markup for state 0 (light) and 1 (dark) at a size ---------- */
const S=[
 {id:'sol-luna',name:'sol ☉ · luna ☽',gloss:'sol · luna',
  desc:'The alchemical signs for sun and moon. Light is ☉, a drawn ring with its point; dark is ☽, the same ring eaten into a crescent. Switching, a second stroke sweeps across the ring.',
  draw(st,small){let d=brush(arc(12,12,7.4,-80,272),1.9,3);
    if(st===0){d+=brush(arc(12,12,1.05,0,360,16),1.6,9,0,0);}
    else{d+=brush(arc(15.2,10.6,6.2,-105,155),1.7,11);}
    let dots=''; if(st===1&&!small) dots=stipple((x,y)=>inC(12,12,7)(x,y)&&!inC(15.2,10.6,6.4)(x,y),5,900);
    return `<path d="${d}" fill="currentColor"/><path d="${dots}" fill="currentColor" opacity=".8"/>`;}},
 {id:'terminator',name:'the terminator',gloss:'linea lucis',
  desc:'A drawn ring whose inside is stippled like the fog. The line between lit and unlit moves across it: light mode lights the left half, dark mode the right. The most literal, and the closest to the background.',
  draw(st,small){const d=brush(arc(12,12,7.6,-95,268),1.8,21);
    const half=st===0?(x=>x<12):(x=>x>12);
    const dots=small?brush(st===0?arc(12,12,3.6,90,270,24):arc(12,12,3.6,-90,90,24),3.6,7,0.05,0.02):stipple((x,y)=>inC(12,12,6.4)(x,y)&&half(x),8,1400);
    return `<path d="${d}" fill="currentColor"/><path d="${dots}" fill="currentColor" opacity=".85"/>`;}},
 {id:'eye',name:'the eye',gloss:'oculus',
  desc:'An eye in two strokes. Open in light, with a stippled iris; closed in dark, the lower lid becomes the only stroke and three short lashes fall from it. Watched by day, asleep by night: the Lain register.',
  draw(st,small){let d='';
    if(st===0){d+=brush(arc(12,15.5,9,-160,-20,40,7),1.7,31)+brush(arc(12,8.5,9,20,160,40,7),1.7,33);
      const iris=small?brush(arc(12,12,1.4,0,360,16),2.2,35,0,0):''; d+=iris;
      const dots=small?'':stipple(inC(12,12,2.9),36,700,0.5); return `<path d="${d}" fill="currentColor"/><path d="${dots}" fill="currentColor"/>`;}
    d+=brush(arc(12,8,9,25,155,40,6),1.8,37);
    [[-0.55,1],[0,1],[0.55,1]].forEach(([k],i)=>{const x=12+k*9.5;d+=brush(line(x,14.2+Math.abs(k)*-1.2,x+k*1.8,17.2+Math.abs(k)*-1,10),1.2,41+i,0.35,0.05);});
    return `<path d="${d}" fill="currentColor"/>`;}},
 {id:'seal',name:'the seal',gloss:'sigillum',
  desc:'The brand mark itself as the switch: light shows φ, dark shows Φ, the same closing gesture as the logo transition, in miniature. The most coherent, but it spends the mark on a utility.',
  draw(st){let d='';
    if(st===0){d+=brush(arc(12.2,9.6,5.6,-100,236,48,6.4),1.8,51)+brush(line(11.6,4.2,11.9,21.5,20),1.6,53,0.15);}
    else{d+=brush(arc(12,12,6.8,-95,268,56,6.2),1.8,55)+brush(line(11.9,2.5,12.1,21.5,20),1.6,57,0.18);}
    return `<path d="${d}" fill="currentColor"/>`;}},
 {id:'threshold',name:'the threshold',gloss:'limen',
  desc:'An arched doorway. In light, the inside of the door is empty, light comes through; in dark, the doorway fills with stippled night. The entrance motif, thaer\'s ritual of crossing in.',
  draw(st,small){const d=brush([...line(6.5,21,6.5,10.5,12),...arc(12,10.5,5.5,180,360,24).slice(1),...line(17.5,10.5,17.5,21,12).slice(1)],1.8,61,0.12)+brush(line(4.5,21.2,19.5,21.2,16),1.5,63,0.2);
    const fill=st===1?(small?brush(line(12,9,12,20,8),7.2,65,0.08,0.02):stipple((x,y)=>(y>10.5&&x>7.6&&x<16.4&&y<20.4)||inC(12,10.5,4.4)(x,y)&&y<=10.5,66,1600)):'';
    return `<path d="${d}" fill="currentColor"/><path d="${fill}" fill="currentColor" opacity=".85"/>`;}},
];
