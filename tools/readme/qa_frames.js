const {chromium}=require('playwright');
const names=process.argv[2].split(','), times=[0.4,1.2,2.2,3.6,6,9,12.4];
(async()=>{const b=await chromium.launch();
for(const n of names){const p=await b.newPage({viewport:{width:1200,height:600}});p.on('pageerror',e=>console.log('ERR',n,e.message));
await p.goto('http://127.0.0.1:8767/'+n+'.svg');await p.waitForTimeout(400);
for(const t of times){await p.evaluate(t=>{const s=document.documentElement;s.pauseAnimations();s.setCurrentTime(t);document.getAnimations().forEach(a=>{a.pause();a.currentTime=t*1000;});},t);
await p.waitForTimeout(120);await p.screenshot({path:process.cwd()+'/qa/'+n+'-'+t+'.png'});}
await p.close();}
await b.close();})();
