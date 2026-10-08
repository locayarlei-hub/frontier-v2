(() => {
  function prepare(id, emptyId, hasData) {
    const c = document.getElementById(id), e = document.getElementById(emptyId);
    if (!c || !e) return null;
    c.classList.toggle("hidden", !hasData);
    e.classList.toggle("hidden", hasData);
    if (!hasData) return null;
    const r = c.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    c.width = Math.max(1, r.width * dpr); c.height = 255 * dpr;
    const ctx = c.getContext("2d"); ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,r.width,255);
    return { c, ctx, w:r.width, h:255 };
  }
  function roundRect(ctx,x,y,w,h,r){
    if(h<=0||w<=0)return;
    const rr=Math.min(r,w/2,h/2); ctx.beginPath(); ctx.moveTo(x+rr,y);
    ctx.arcTo(x+w,y,x+w,y+h,rr); ctx.arcTo(x+w,y+h,x,y+h,rr);
    ctx.arcTo(x,y+h,x,y,rr); ctx.arcTo(x,y,x+w,y,rr); ctx.closePath();
  }
  function money(v){ return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:0}).format(Number(v||0)); }
  function theme(){
    const s=getComputedStyle(document.body),get=(name,fallback)=>s.getPropertyValue(name).trim()||fallback;
    return {text:get("--text","#f6ead9"),muted:get("--muted","#baa58f"),panel:get("--panel","#2a1d16"),line:get("--line","rgba(240,221,192,.10)"),rust:get("--rust","#a65f3d"),copper:get("--copper","#c7895b"),sand:get("--sand","#d5b58b"),teal:get("--teal","#5d827e"),income:get("--income","#84b694"),expense:get("--expense","#d98574"),reserve:get("--reserve","#7f9fb7")};
  }

  function projectBars(id,emptyId,projects,progressFn) {
    const list=(projects||[]).slice(0,8), prep=prepare(id,emptyId,list.length>0); if(!prep)return;
    const {ctx,w,h}=prep,left=39,right=10,top=18,bottom=54,pw=w-left-right,ph=h-top-bottom,gap=10,bw=Math.max(18,(pw-gap*(list.length-1))/list.length);
    const t=theme();ctx.font="10px system-ui";ctx.strokeStyle=t.line;ctx.fillStyle=t.muted;
    [0,25,50,75,100].forEach(v=>{const y=top+ph-v/100*ph;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(w-right,y);ctx.stroke();ctx.fillText(v+"%",4,y+4)});
    list.forEach((p,i)=>{const v=progressFn(p),x=left+i*(bw+gap),bh=v/100*ph,y=top+ph-bh,g=ctx.createLinearGradient(0,y,0,top+ph);g.addColorStop(0,t.rust);g.addColorStop(1,t.sand);ctx.fillStyle=g;roundRect(ctx,x,y,bw,bh,6);ctx.fill();ctx.save();ctx.translate(x+bw/2,h-8);ctx.rotate(-.44);ctx.fillStyle=t.muted;ctx.textAlign="right";ctx.font="9px system-ui";ctx.fillText(String(p.name||"").slice(0,18),0,0);ctx.restore();});
  }

  function expensePie(id,emptyId,entries) {
    const expenses=(entries||[]).filter(x=>x.type==="expense"), prep=prepare(id,emptyId,expenses.length>0); if(!prep)return;
    const sums={};expenses.forEach(x=>sums[x.category]=(sums[x.category]||0)+Number(x.amount||0));
    const data=Object.entries(sums).sort((a,b)=>b[1]-a[1]).slice(0,7), total=data.reduce((s,x)=>s+x[1],0);
    const t=theme(),{ctx,w}=prep, palette=[t.copper,t.teal,t.sand,t.rust,t.reserve,"#d49b7e","#b19a72"],cx=Math.min(w*.31,138),cy=122,r=76;
    let start=-Math.PI/2;
    data.forEach(([_,v],i)=>{const a=v/total*Math.PI*2;ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,r,start,start+a);ctx.closePath();ctx.fillStyle=palette[i%palette.length];ctx.fill();start+=a});
    ctx.beginPath();ctx.arc(cx,cy,42,0,Math.PI*2);ctx.fillStyle=t.panel;ctx.fill();ctx.textAlign="center";ctx.fillStyle=t.text;ctx.font="700 14px system-ui";ctx.fillText(money(total),cx,cy+5);
    let ly=54,lx=Math.max(cx+r+28,w*.56);ctx.textAlign="left";ctx.font="10px system-ui";
    data.forEach(([k,v],i)=>{ctx.fillStyle=palette[i%palette.length];ctx.fillRect(lx,ly-8,9,9);ctx.fillStyle=t.muted;ctx.fillText(`${k} ${Math.round(v/total*100)}%`,lx+14,ly);ly+=26});
  }

  function cashFlow(id,emptyId,entries) {
    const usable=(entries||[]).filter(x=>x.type==="income"||x.type==="expense"), prep=prepare(id,emptyId,usable.length>0); if(!prep)return;
    const months={}; usable.forEach(x=>{const m=String(x.date||"").slice(0,7);if(!m)return;months[m]||={income:0,expense:0};months[m][x.type]+=Number(x.amount||0)});
    const keys=Object.keys(months).sort().slice(-6); if(!keys.length){prepare(id,emptyId,false);return}
    const {ctx,w,h}=prep,left=41,right=11,top=28,bottom=38,pw=w-left-right,ph=h-top-bottom,max=Math.max(1,...keys.flatMap(k=>[months[k].income,months[k].expense])),step=keys.length>1?pw/(keys.length-1):0;
    const t=theme();ctx.strokeStyle=t.line;[0,.25,.5,.75,1].forEach(t=>{const y=top+ph-ph*t;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(w-right,y);ctx.stroke()});
    [["income",t.income],["expense",t.expense]].forEach(([type,color])=>{ctx.beginPath();keys.forEach((k,i)=>{const x=left+i*step,y=top+ph-months[k][type]/max*ph;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.strokeStyle=color;ctx.lineWidth=3;ctx.stroke();keys.forEach((k,i)=>{const x=left+i*step,y=top+ph-months[k][type]/max*ph;ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fillStyle=color;ctx.fill()})});
    ctx.font="9px system-ui";ctx.fillStyle=t.muted;ctx.textAlign="center";keys.forEach((k,i)=>ctx.fillText(new Date(k+"-01T12:00:00").toLocaleDateString("pt-BR",{month:"short"}),left+i*step,h-9));
    ctx.textAlign="left";ctx.fillStyle=t.income;ctx.fillText("● Entradas",left,12);ctx.fillStyle=t.expense;ctx.fillText("● Saídas",left+72,12);
  }

  window.FrontierCharts={projectBars,expensePie,cashFlow};
})();