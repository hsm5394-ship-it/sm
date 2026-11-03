// Renders index.html into a vertical 1080x1920 Instagram Reels MP4 (24 fps, with soundtrack).
// Usage: node tools/render-reels.js [out.mp4] [startSec] [endSec]
// Needs: playwright (Chromium) and ffmpeg with libx264.
const {chromium}=require('playwright');
const {spawn}=require('child_process');
const fs=require('fs'),path=require('path'),os=require('os');
const OUT=process.argv[2]||'morning-giant-reels.mp4';
const T0=parseFloat(process.argv[3]||'0'),T1=parseFloat(process.argv[4]||'52.2');
const FPS=24,VW=1080,VH=1920;
(async()=>{
  const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:720}});
  p.on('pageerror',e=>{console.error('page error',e.message);process.exit(1)});
  await p.goto('file://'+path.resolve(__dirname,'..','index.html')+'?t=0');
  await p.waitForFunction('window.__ready',null,{timeout:120000});
  // soundtrack, rendered offline
  const wavB64=await p.evaluate(async(dur)=>{
    const SR=48000,A=new OfflineAudioContext(2,Math.ceil(SR*dur),SR);startAudio(A);
    const buf=await A.startRendering();const n=buf.length,L=buf.getChannelData(0),R=buf.getChannelData(1);
    const ab=new ArrayBuffer(44+n*4),v=new DataView(ab);const s=(o,str)=>{for(let i=0;i<str.length;i++)v.setUint8(o+i,str.charCodeAt(i))};
    s(0,'RIFF');v.setUint32(4,36+n*4,true);s(8,'WAVE');s(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,2,true);
    v.setUint32(24,SR,true);v.setUint32(28,SR*4,true);v.setUint16(32,4,true);v.setUint16(34,16,true);s(36,'data');v.setUint32(40,n*4,true);
    for(let i=0,o=44;i<n;i++,o+=4){v.setInt16(o,Math.max(-1,Math.min(1,L[i]))*32767,true);v.setInt16(o+2,Math.max(-1,Math.min(1,R[i]))*32767,true)}
    let bin='';const u=new Uint8Array(ab);for(let i=0;i<u.length;i+=32768)bin+=String.fromCharCode.apply(null,u.subarray(i,i+32768));return btoa(bin);
  },T1+0.5);
  const wav=path.join(os.tmpdir(),'mg-audio-'+process.pid+'.wav');fs.writeFileSync(wav,Buffer.from(wavB64,'base64'));
  // render the 16:9 frame tall enough for 1920px, then crop a 9:16 window that follows the giant
  await p.evaluate(({VW,VH})=>{
    setScale(VH/720);
    window.__vc=document.createElement('canvas');__vc.width=VW;__vc.height=VH;
    window.__cropX=t=>{ // logical x (0..1280) to centre the crop on
      let x=640;const c=shotAt(t).cam(t);
      const track=O=>{const a=Mx.ap(O.torso,30,-120),h=Mx.ap(O.head,35,-35);return w2s({...c,sx:0,sy:0},1,(a[0]+h[0])/2,(a[1]+h[1])/2)[0]};
      if(t>=45.4)x=640;                                   // the empty clearing
      else if(t>=37.4){const fr=flight(t);x=track(rig(poseAt(Math.floor(t*12)/12),fr.root))}
      else if(t>=14.5&&t<17.6)x=600;                       // birds over the treetops
      else x=track(robotAt(t));
      const half=VW/OUT/2;return Math.max(half,Math.min(1280-half,x));
    };
  },{VW,VH});
  const ff=spawn('ffmpeg',['-y','-loglevel','error','-f','image2pipe','-framerate',String(FPS),'-c:v','mjpeg','-i','-',
    '-ss',String(T0),'-i',wav,'-map','0:v','-map','1:a','-c:v','libx264','-preset','slow','-crf','18','-pix_fmt','yuv420p',
    '-r',String(FPS),'-c:a','aac','-b:a','192k','-shortest','-movflags','+faststart',OUT],{stdio:['pipe','inherit','inherit']});
  const N=Math.round((T1-T0)*FPS);let smooth=null;
  for(let i=0;i<N;i++){const t=T0+i/FPS;
    const jpg=await p.evaluate(({t,smooth})=>{renderAt(t);let x=__cropX(t);
      if(smooth!==null&&Math.abs(x-smooth)<200)x=smooth+(x-smooth)*.12; // ease the pan, but cut with the edit
      const g=__vc.getContext('2d');const sx=x*OUT-__vc.width/2;g.drawImage(cv,sx,0,__vc.width,__vc.height,0,0,__vc.width,__vc.height);
      return [__vc.toDataURL('image/jpeg',.93).split(',')[1],x]},{t,smooth});
    smooth=jpg[1];
    if(!ff.stdin.write(Buffer.from(jpg[0],'base64')))await new Promise(r=>ff.stdin.once('drain',r));
    if(i%120===0)console.log(`frame ${i}/${N}`);
  }
  ff.stdin.end();await new Promise(r=>ff.on('close',r));fs.unlinkSync(wav);await b.close();console.log('wrote',OUT);
})();
