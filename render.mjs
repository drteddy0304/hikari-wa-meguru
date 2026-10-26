import { clamp, random, DURATION, personalPhase } from './core.mjs?v=calendar-nov-apr';
const serif = '"Yu Mincho", "Hiragino Mincho ProN", "Noto Serif JP", serif';
const ease = n => { n = clamp(n); return n*n*(3-2*n); };
const rgb = (c,a=1) => `rgba(${c.join(',')},${a})`;
export function demoPhoto(warm = true) {
  const canvas = document.createElement('canvas'); canvas.width = 800; canvas.height = 1000;
  const c = canvas.getContext('2d'), rng=random(42), color=warm?[239,207,157]:[173,205,243];
  c.fillStyle='#101923';c.fillRect(0,0,800,1000);
  const glow=c.createRadialGradient(470,330,20,470,330,230);glow.addColorStop(0,rgb(color,.17));glow.addColorStop(1,rgb(color,0));c.fillStyle=glow;c.fillRect(0,0,800,1000);
  c.save();c.beginPath();c.arc(470,330,67,0,Math.PI*2);c.clip();c.fillStyle=rgb(color);c.fillRect(390,250,160,160);
  for(let i=0;i<130;i++){c.fillStyle=`rgba(45,50,65,${rng()*.19})`;c.beginPath();c.arc(405+rng()*130,265+rng()*130,2+rng()*13,0,Math.PI*2);c.fill();}c.restore();
  // A low, soft horizon makes the source photograph visibly distinct from the CD.
  c.fillStyle='#0a1017';c.beginPath();c.moveTo(0,900);for(let x=0;x<=800;x+=25)c.lineTo(x,850+Math.sin(x*.013)*40+rng()*22);c.lineTo(800,1000);c.lineTo(0,1000);c.fill();
  return canvas;
}
export function moonTexture() {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=700;const c=canvas.getContext('2d'),rng=random(1729);
  const g=c.createRadialGradient(260,200,20,350,350,400);g.addColorStop(0,'#ece4ce');g.addColorStop(.65,'#b6b19f');g.addColorStop(1,'#686e68');c.fillStyle=g;c.fillRect(0,0,700,700);
  for(let i=0;i<2100;i++){const x=rng()*700,y=rng()*700,r=1+rng()**4*68;c.fillStyle=`rgba(34,45,48,${.018+rng()*.085})`;c.beginPath();c.ellipse(x,y,r,r*(.6+rng()*.5),0,0,Math.PI*2);c.fill();if(i%4===0){c.strokeStyle='rgba(250,246,220,.07)';c.lineWidth=1;c.stroke();}}
  for(let i=0;i<55000;i++){const n=rng();c.fillStyle=n>.5?'rgba(255,255,239,.065)':'rgba(10,19,26,.06)';c.fillRect(rng()*700,rng()*700,1.5,1.5);}return canvas;
}
export function disc(c, texture, x, y, r, phase, light=null, added=0) {
  c.save();
  const halo=c.createRadialGradient(x,y,r*.7,x,y,r*1.4);halo.addColorStop(0,'rgba(209,204,174,.12)');halo.addColorStop(1,'rgba(209,204,174,0)');c.fillStyle=halo;c.fillRect(x-r*1.4,y-r*1.4,r*2.8,r*2.8);
  c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.clip();c.drawImage(texture,x-r,y-r,r*2,r*2);
  // A spherical terminator: visible illuminated area is independent of participation.
  const cos=1-2*clamp(phase);
  c.fillStyle='rgba(6,14,23,.89)';c.beginPath();
  for(let i=0;i<=100;i++){const dy=-r+2*r*i/100,dx=Math.sqrt(Math.max(0,r*r-dy*dy));const bx=x+cos*dx;if(i===0)c.moveTo(bx,y+dy);else c.lineTo(bx,y+dy);}
  for(let i=100;i>=0;i--){const dy=-r+2*r*i/100;c.lineTo(x-Math.sqrt(Math.max(0,r*r-dy*dy)),y+dy);}c.closePath();c.fill();
  if(light && added>0){
    // Clip personal light to the calendar's illuminated region, never the dark side.
    c.beginPath();
    for(let i=0;i<=100;i++){const dy=-r+2*r*i/100,dx=Math.sqrt(Math.max(0,r*r-dy*dy));if(i===0)c.moveTo(x+cos*dx,y+dy);else c.lineTo(x+cos*dx,y+dy);}
    for(let i=100;i>=0;i--){const dy=-r+2*r*i/100;c.lineTo(x+Math.sqrt(Math.max(0,r*r-dy*dy)),y+dy);}c.closePath();c.clip();
    // Personal light reveals texture even before the scheduled moon has filled.
    // This layer does not alter the shared calendar phase.
    c.save();c.globalAlpha=added*(.28+.30*light.brightness);
    c.drawImage(texture,x-r,y-r,r*2,r*2);c.restore();
    c.globalCompositeOperation='screen';
    const wash=c.createRadialGradient(x-r*.2,y-r*.25,0,x,y,r);
    wash.addColorStop(0,rgb(light.meanRGB,.30*added));wash.addColorStop(1,rgb(light.meanRGB,.04*added));
    c.fillStyle=wash;c.fillRect(x-r,y-r,r*2,r*2);
    for(const p of light.samples){const px=x+Math.cos(p.angle)*r*p.distance,py=y+Math.sin(p.angle)*r*p.distance;const g=c.createRadialGradient(px,py,0,px,py,r*.13);g.addColorStop(0,rgb(p.rgb,.13*added*(.4+light.brightness)));g.addColorStop(1,rgb(p.rgb,0));c.fillStyle=g;c.fillRect(px-r*.13,py-r*.13,r*.26,r*.26);}
    c.globalCompositeOperation='source-over';
  }
  c.restore();c.save();c.strokeStyle='rgba(235,232,210,.28)';c.lineWidth=1;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.stroke();
  for(const k of [.17,.21,.96]){c.strokeStyle=`rgba(225,222,204,${k>.9?.15:.35})`;c.beginPath();c.arc(x,y,r*k,0,Math.PI*2);c.stroke();}
  c.fillStyle='#09121d';c.beginPath();c.arc(x,y,r*.075,0,Math.PI*2);c.fill();c.strokeStyle='rgba(235,232,210,.4)';c.stroke();c.restore();
}
function text(c, value, y, size, color='#eee8db', spacing=0) {
  c.fillStyle=color;c.font=`${size}px ${serif}`;c.textAlign='center';if('letterSpacing' in c)c.letterSpacing=`${spacing}px`;c.fillText(value,540,y);if('letterSpacing' in c)c.letterSpacing='0px';
}
export function createScene(photo, light, phase, sample=false) {
  return { photo, light, phase, sample, texture:moonTexture() };
}
// Both PNG and video are this exact scene at a different timestamp / resolution.
export function drawScene(canvas, scene, seconds=DURATION) {
  const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);c.save();c.scale(canvas.width/1080,canvas.height/1920);
  const bg=c.createLinearGradient(0,0,1080,1920);bg.addColorStop(0,'#142430');bg.addColorStop(.65,'#0b1521');bg.addColorStop(1,'#121a25');c.fillStyle=bg;c.fillRect(0,0,1080,1920);
  c.strokeStyle='rgba(216,211,190,.17)';c.lineWidth=1;c.strokeRect(44,44,992,1832);
  const rng=random(75);for(let i=0;i<95;i++){c.fillStyle=`rgba(229,225,204,${rng()*.4})`;c.fillRect(65+rng()*950,80+rng()*1650,1.4,1.4);}
  text(c,'山形りお',165,42,'#e4d7b4',9);
  text(c,'あなたからもらった光で、',320,30,'#ece6d7',1);
  text(c,'CDの盤面が完成します。',365,30,'#ece6d7',1);
  const added=ease((seconds-3)/5);
  const target=scene.light?personalPhase(scene.phase):scene.phase;
  const currentPhase=scene.phase+(target-scene.phase)*added;
  disc(c,scene.texture,540,795,305,currentPhase,scene.light,added);
  if(scene.photo && scene.light){
    const p=scene.photo,scale=Math.min(300/p.width,270/p.height),w=p.width*scale,h=p.height*scale,x=540-w/2,y=1195-h/2;
    c.save();c.globalAlpha=1-ease((seconds-6)/2);c.drawImage(p,x,y,w,h);c.restore();
    for(const s of scene.light.samples){
      const u=(seconds-1.2-s.delay*6)/4.5;if(u<=0||u>=1)continue;
      const e=ease(u),sx=x+s.x*w,sy=y+s.y*h,ey=795+Math.sin(s.angle)*270*s.distance,edge=Math.sqrt(305*305-(ey-795)**2),ex=540+edge*(1-2*target+2*target*(.15+.7*s.distance));
      const px=sx+(ex-sx)*e+Math.sin(e*Math.PI)*Math.sin(s.angle)*85,py=sy+(ey-sy)*e;
      c.save();c.globalAlpha=Math.min(1,u*8,(1-u)*8);c.shadowColor=rgb(s.rgb);c.shadowBlur=18;c.fillStyle=rgb(s.rgb);c.beginPath();c.arc(px,py,s.size*2,0,Math.PI*2);c.fill();c.restore();
    }
  }
  // Event details remain readable even at the first frame.
  text(c,'山形りお ONEMAN LIVE',1395,29,'#d6ccaf',3);text(c,'「ひかりは巡る」',1495,65,'#f1ead8',5);
  text(c,'2027年4月24日（土）',1600,34);text(c,'青山 月見ル君想フ',1655,32);text(c,'MINI ALBUM RELEASE',1755,25,'#d6ccaf',5);
  text(c,scene.sample?'試作 / SAMPLE · 体験用サンプル':'ひかりは巡る · 試作',1835,18,'#909b9e',1);c.restore();
}
