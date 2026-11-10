// Renders a photo into a sketch-drawing timelapse MP4 (30 fps, frame-exact, with pencil sound) using sketch-video.html.
// Usage: node tools/render-sketch.js photo.jpg [out.mp4] [--ratio orig|9:16|1:1|16:9] [--dur 20]
//                                    [--finish pencil|color] [--photo start|end|none] [--no-sound]
// Needs: playwright (Chromium) and ffmpeg with libx264.
const {chromium}=require('playwright');
const {spawn}=require('child_process');
const fs=require('fs'),path=require('path'),os=require('os');
const pos=[],opt={ratio:'orig',dur:20,finish:'pencil',photo:'start',sound:true};
for(let a=process.argv.slice(2),i=0;i<a.length;i++){
  if(a[i]==='--no-sound')opt.sound=false;
  else if(a[i].startsWith('--')){const k=a[i].slice(2);if(!(k in opt)||a[i+1]===undefined){console.error('unknown option',a[i]);process.exit(1)}opt[k]=k==='dur'?parseFloat(a[++i]):a[++i]}
  else pos.push(a[i]);
}
if(!pos[0]||!fs.existsSync(pos[0])){console.error('usage: node tools/render-sketch.js photo.jpg [out.mp4] [--ratio 9:16] [--dur 20] [--finish color] [--photo end] [--no-sound]');process.exit(1)}
const OUT=pos[1]||path.basename(pos[0]).replace(/\.[^.]+$/,'')+'-sketch.mp4';
(async()=>{
  const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:900}});
  p.on('pageerror',e=>{console.error('page error',e.message);process.exit(1)});
  await p.goto('file://'+path.resolve(__dirname,'..','sketch-video.html')+'?tool=1');
  await p.evaluate(o=>Object.assign(S,o),opt);
  await p.setInputFiles('#file',pos[0]);
  await p.waitForFunction('window.__ready',null,{timeout:120000});
  const {N,FPS}=await p.evaluate(()=>({N:T.N,FPS}));
  const args=['-y','-loglevel','error','-f','image2pipe','-framerate',String(FPS),'-c:v','mjpeg','-i','-'];
  let wav=null;
  if(opt.sound){ // pencil sound, rendered offline
    const wavB64=await p.evaluate(async()=>{
      const SR=48000,A=new OfflineAudioContext(2,Math.ceil(SR*S.dur),SR);startAudio(A,0);
      const buf=await A.startRendering();const n=buf.length,L=buf.getChannelData(0),R=buf.getChannelData(1);
      const ab=new ArrayBuffer(44+n*4),v=new DataView(ab);const s=(o,str)=>{for(let i=0;i<str.length;i++)v.setUint8(o+i,str.charCodeAt(i))};
      s(0,'RIFF');v.setUint32(4,36+n*4,true);s(8,'WAVE');s(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,2,true);
      v.setUint32(24,SR,true);v.setUint32(28,SR*4,true);v.setUint16(32,4,true);v.setUint16(34,16,true);s(36,'data');v.setUint32(40,n*4,true);
      for(let i=0,o=44;i<n;i++,o+=4){v.setInt16(o,Math.max(-1,Math.min(1,L[i]))*32767,true);v.setInt16(o+2,Math.max(-1,Math.min(1,R[i]))*32767,true)}
      let bin='';const u=new Uint8Array(ab);for(let i=0;i<u.length;i+=32768)bin+=String.fromCharCode.apply(null,u.subarray(i,i+32768));return btoa(bin);
    });
    wav=path.join(os.tmpdir(),'sketch-audio-'+process.pid+'.wav');fs.writeFileSync(wav,Buffer.from(wavB64,'base64'));
    args.push('-i',wav,'-map','0:v','-map','1:a','-c:a','aac','-b:a','160k');
  }
  args.push('-c:v','libx264','-preset','slow','-crf','18','-pix_fmt','yuv420p','-r',String(FPS),'-movflags','+faststart',OUT);
  const ff=spawn('ffmpeg',args,{stdio:['pipe','inherit','inherit']});
  for(let i=0;i<N;i++){
    const jpg=await p.evaluate(i=>{renderAt(i);return cv.toDataURL('image/jpeg',.93).split(',')[1]},i);
    if(!ff.stdin.write(Buffer.from(jpg,'base64')))await new Promise(r=>ff.stdin.once('drain',r));
    if(i%120===0)console.log(`frame ${i}/${N}`);
  }
  ff.stdin.end();const code=await new Promise(r=>ff.on('close',r));if(wav)fs.unlinkSync(wav);await b.close();
  if(code){console.error('ffmpeg failed with code',code);process.exit(1)}
  console.log('wrote',OUT);
})();
