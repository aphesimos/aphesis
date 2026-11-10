/* ========== o traço ==========
   anel: por ângulo θ (sentido da caneta), raio da borda de fora e de dentro em volta de (cx, cy).
   m = medido no φ; h = arco "curado" que fecha o círculo por cima da haste; s = começo do anel já solto da haste.
   a ponta é o perfil medido da ponta solta do φ (largura relativa T e desvio do eixo F), aplicado atrás da posição da caneta. */
const {cx,cy,ts:TS,step:ST,n:N,fim:KFIM,k50:K50,ta:TA,tfin:TFIN,delta:DELTA}=M;
const TH=i=>TS+i*ST, KI=t=>(t-TS)/ST;
const T259=TH(KFIM), LT=(M.tip_t.length-1)*ST;            // comprimento da ponta, em graus
const lerp=(a,b,t)=>a+(b-a)*t, clamp=x=>Math.max(0,Math.min(1,x));
const MJ=x=>{x=clamp(x);return x*x*x*(10-15*x+6*x*x);};   // jerk mínimo
function amostraArr(a,x){const i=Math.max(0,Math.min(a.length-1,x)),j=Math.floor(i),f=i-j;return j+1<a.length?a[j]+(a[j+1]-a[j])*f:a[j];}
const COS=[],SIN=[]; for(let i=0;i<N;i++){const t=TH(i)*Math.PI/180;COS.push(Math.cos(t));SIN.push(Math.sin(t));}
// haste: linhas de baixo (0) para cima; ponta de cima = ponta de baixo girada 180°
const NS_=M.sy.length, SST=M.sstep, LB=(M.tt.length-1)*SST;
function pontaHaste(d){ // d: distância da extremidade (unid.) → [fator de largura, desvio do centro]
  if(d>=LB) return [1,0]; const j=d/SST; return [amostraArr(M.tt,j), -amostraArr(M.tdx,j)];}
/* estado:
   te  posição da caneta no anel (graus);  r  quanto o começo do anel já se soltou e o arco relaxou (0..1);
   sl  deslocamento da haste em relação ao anel (unid.);  hs  linhas da haste desenhadas (fracionário);
   ponta: 'nenhuma' | 'atravessa' | 'fixa'  (ponta de cima da haste); inicioFino: começo do anel afinado (caneta do Φ);
   penHaste: distância extra da caneta além do topo da haste (para a ponta da haste sumir quando a caneta segue no anel) */
function relaxOnda(te,th,p2){ // o começo do anel se solta da haste no rastro da ponta que passa por cima dele
  // à esquerda da haste ele não se mexe: fica inteiro sob a haste reta e a faixa que fecha.
  // à direita, solta numa frente larga atrás da ponta; o que faltar termina enquanto a haste desliza.
  const g0=clamp((th+92)/8), g=g0*g0*(3-2*g0);
  const x=clamp((te-(th+360)-6)/26), f=x*x*(3-2*x);
  return g*Math.max(f,p2||0);}
function geometria(st){
  const ke=Math.min(N-1,KI(st.te)), nk=Math.floor(ke);
  const O=[],I=[];
  const um=(k)=>{
    let ro,ri;
    if(k<=K50){const rk=st.r==='onda'?relaxOnda(st.te,TH(k),st.p2):st.r;
      // começo solto: o mesmo arco do fechamento, mas começando fino (pincelada), para nunca expor um corte reto
      let rs=(M.ro_s[k]+M.ri_s[k])/2, hs_=(M.ro_s[k]-M.ri_s[k])/2; const d0=TH(k)-TS; if(d0<LT) hs_*=amostraArr(M.tip_t,d0/ST);
      ro=lerp(M.ro_m[k],rs+hs_,rk); ri=lerp(M.ri_m[k],rs-hs_,rk);}
    else if(TH(k)<=TA){ro=M.ro_m[k];ri=M.ri_m[k];}
    else {ro=M.ro_h[k];ri=M.ri_h[k];}
    let rc=(ro+ri)/2, hw=(ro-ri)/2;
    const d=st.te-TH(k);
    if(d<LT){const j=Math.max(0,d)/ST; hw*=amostraArr(M.tip_t,j); rc+=amostraArr(M.tip_f,j);}
    return [rc+hw, rc-hw];
  };
  for(let k=0;k<=nk;k++){const [a,b]=um(k);O.push([cx+a*COS[k],cy+a*SIN[k]+st.dyA]);I.push([cx+b*COS[k],cy+b*SIN[k]+st.dyA]);}
  if(ke>nk&&nk+1<N){const f=ke-nk,[a,b]=um(nk+1),[a0,b0]=um(nk);
    const t=(TH(nk)+f*ST)*Math.PI/180, c=Math.cos(t), s=Math.sin(t), ra=lerp(a0,a,f), rb=lerp(b0,b,f);
    O.push([cx+ra*c,cy+ra*s+st.dyA]); I.push([cx+rb*c,cy+rb*s+st.dyA]);}
  // ponto mais baixo da borda de fora do anel sobre a largura da haste: acima dele a haste aparece com a ponta
  let yBorda=-1e9;
  if(st.ponta==='atravessa'){ const x0=X0H-2, x1=X1H+2;
    for(let k=0;k<O.length;k++){const p=O[k]; if(TH(k)>=255&&p[0]>=x0&&p[0]<=x1&&p[1]<cy+st.dyA) yBorda=Math.max(yBorda,p[1]);} }
  const L=[],R=[]; const he=Math.min(NS_-1,st.hs), nh=Math.floor(he);
  const yTopo=M.sy[NS_-1]-st.sl+st.dyH;
  // quanto a haste já se endireitou: acompanha a soltura do anel sobre ela
  const rH=st.r==='onda'?(x=>x*x*(3-2*x))(clamp((st.te-274-9)/14)):st.r;
  const linha=(i,frac)=>{
    const i2=Math.min(NS_-1,i+1), y=lerp(M.sy[i],M.sy[i2],frac)-st.sl+st.dyH;
    const comPonta=st.ponta==='fixa'||(st.ponta==='atravessa'&&y<yBorda);
    const SLi=k=>lerp(M.sl[k],M.sl_reta[k],rH), SRi=k=>lerp(M.sr[k],M.sr_reta[k],rH);
    let l=lerp(SLi(i),SLi(i2),frac), r=lerp(SRi(i),SRi(i2),frac), c=(l+r)/2, w=(r-l)/2;
    // ponta: a ponta de baixo girada 180°, presa na linha da base dela (a LB da extremidade)
    const base=(dExt)=>{ const ib=Math.max(0,Math.min(NS_-1,Math.round((i+frac)-(LB-dExt)/SST)));
      return [(SLi(ib)+SRi(ib))/2,(SRi(ib)-SLi(ib))/2]; };
    if(comPonta){const dE=y-yTopo; if(dE<LB){const [cb,wb]=base(dE),[f,dx]=pontaHaste(dE); c=cb+dx; w=wb*f;}}
    if(st.hs<NS_-1||st.penHaste!==undefined){const dp=(he-(i+frac))*SST+(st.penHaste||0);
      if(dp>=0&&dp<LB){const [cb,wb]=base(dp),[f,dx]=pontaHaste(dp); c=cb+dx; w=wb*f;}}
    return [[c-w,y],[c+w,y]];
  };
  if(st.hs>=0){ for(let i=0;i<=nh;i++){const [a,b]=linha(i,0);L.push(a);R.push(b);}
    if(he>nh){const [a,b]=linha(nh,he-nh);L.push(a);R.push(b);} }
  return {O,I,L,R};
}
const X0H=Math.min(...M.sl_reta), X1H=Math.max(...M.sr_reta);
const f1=v=>v.toFixed(1);
// cada traço é um contorno só (borda de um lado, ida; do outro, volta): sem costuras internas
function contorno(A,B){ if(A.length<2) return ''; let d='M'+f1(A[0][0])+' '+f1(A[0][1]);
  for(let i=1;i<A.length;i++) d+='L'+f1(A[i][0])+' '+f1(A[i][1]);
  for(let i=B.length-1;i>=0;i--) d+='L'+f1(B[i][0])+' '+f1(B[i][1]);
  return d+'Z';}
function caminho(G){ return contorno(G.O,G.I)+contorno(G.L,G.R); }
/* ---------- posição na tela por contexto ----------
   isolada: a haste fica, a bola desce, e o conjunto vai do φ centrado (assimétrico) ao Φ centrado (simétrico).
   no texto: a bola fica na linha do texto e a haste sobe. */
function caixa(st){const G=geometria(st);let a=1e9,b=-1e9;for(const p of G.O.concat(G.I,G.L,G.R)){a=Math.min(a,p[1]);b=Math.max(b,p[1]);}return (a+b)/2;}
const BASE={te:T259,r:0,sl:0,hs:NS_-1,ponta:'nenhuma',dyA:0,dyH:0};
const C_PHI=500-caixa(BASE);
const C_PHIF=500-caixa({...BASE,te:TFIN,r:1,sl:DELTA,ponta:'fixa',dyA:DELTA,dyH:DELTA});
function posicao(p2,ancora){ // devolve deslocamentos verticais do anel e da haste (na tela)
  if(ancora==='texto') return {dyA:0, dyH:0};
  const c=lerp(C_PHI,C_PHIF,p2); return {dyA:DELTA*p2+c, dyH:DELTA*p2+c};}
/* ---------- tempo da caneta: jerk mínimo + lei de potência 2/3 ----------
   v ∝ κ^(-1/3): devagar nas curvas fechadas, mais rápida nas retas. */
function relogioCaneta(pts){ // pts: pontos do eixo na ordem da caneta → tabela comprimento ↔ tempo
  const n=pts.length, s=[0], w=[0]; const K0=1/400, KMAX=1/18;
  for(let i=1;i<n;i++) s.push(s[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
  for(let i=1;i<n;i++){const a=Math.max(0,i-4),b=Math.min(n-1,i+4);
    const a1=Math.atan2(pts[i][1]-pts[a][1],pts[i][0]-pts[a][0]), a2=Math.atan2(pts[b][1]-pts[i][1],pts[b][0]-pts[i][0]);
    let da=Math.abs(a2-a1); if(da>Math.PI) da=2*Math.PI-da; const ds=Math.max(1e-6,s[b]-s[a]);
    const k=Math.min(KMAX,da/ds); w.push(w[i-1]+(s[i]-s[i-1])*Math.cbrt(k+K0));}
  const total=w[n-1]; return {s,w,total,seg:total/Math.cbrt(K0)};}
function sDoTempo(rel,tau){ // tau 0..1 (tempo da caneta normalizado) → índice fracionário no caminho
  const alvo=tau*rel.total, w=rel.w; let lo=0,hi=w.length-1;
  if(alvo<=0)return 0; if(alvo>=w[hi])return hi;
  while(hi-lo>1){const m=(lo+hi)>>1; if(w[m]<alvo)lo=m; else hi=m;} return lo+(alvo-w[lo])/(w[hi]-w[lo]);}
function animar(dur,fn,fim){let t0=null,raf;const q=now=>{if(t0===null)t0=now;const k=clamp((now-t0)/Math.max(1,dur));fn(k);if(k<1)raf=requestAnimationFrame(q);else fim&&fim();};raf=requestAnimationFrame(q);return()=>cancelAnimationFrame(raf);}
// eixos para o relógio da caneta
const eixoHaste=[]; for(let i=0;i<NS_;i++) eixoHaste.push([(M.sl[i]+M.sr[i])/2,M.sy[i]]);
function eixoAnel(k1,r){const p=[];for(let k=0;k<=k1;k++){let ro,ri; if(k<=K50){ro=lerp(M.ro_m[k],M.ro_s[k],r);ri=lerp(M.ri_m[k],M.ri_s[k],r);} else if(TH(k)<=TA){ro=M.ro_m[k];ri=M.ri_m[k];} else {ro=M.ro_h[k];ri=M.ri_h[k];}
  const rc=(ro+ri)/2; p.push([cx+rc*COS[k],cy+rc*SIN[k]]);} return p;}
