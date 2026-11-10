import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
const root = process.cwd();
const testMode = process.argv[2] || process.env.AR_CAMERA_TEST || 'resize';
const portrait = testMode === 'portrait' || testMode === 'stress';
const legacyTarget = testMode === 'photo';
const targetFraction = testMode === 'stress' ? 0.60 : 0.78;
const captureFilter = testMode === 'stress' ? 'blur(1.5px) brightness(0.9)' : testMode === 'blur' ? 'blur(0.6px) brightness(0.95)' : 'none';
const resizeCase = testMode === 'resize';
const blur = testMode === 'blur';
const out = await fs.mkdtemp(path.join(os.tmpdir(), 'tp-arjs-browser-'));
let missingMedia = false;
const requests = [], errors = [], browserErrors = [], consoleMessages=[];
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.webp':'image/webp','.png':'image/png','.glb':'model/gltf-binary','.mp4':'video/mp4','.gif':'image/gif'};
const server = http.createServer(async (req,res) => {
  try {
    let url = new URL(req.url, 'http://localhost').pathname;
    if(url.endsWith('/')) url += 'index.html';
    const file = path.resolve(root, '.' + decodeURIComponent(url));
    if(!file.startsWith(root + path.sep)) {res.writeHead(403).end(); return;}
    if(missingMedia && url.endsWith('/MMI-anime.mp4')) {requests.push({url,status:404});res.writeHead(404).end();return;}
    const data = await fs.readFile(file);
    requests.push({url,status:200});
    res.writeHead(200, {'Content-Type':mime[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-store'}).end(data);
  } catch(e) {res.writeHead(404).end();}
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const chromeExecutable=process.env.CHROME_PATH || (process.platform==='win32'
  ? String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`
  : process.platform==='darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'google-chrome');
const chrome = spawn(chromeExecutable, [
  '--headless=new','--remote-debugging-port=0',`--user-data-dir=${path.join(out,'profile')}`,
  '--no-first-run','--no-default-browser-check','--use-angle=swiftshader','--enable-unsafe-swiftshader',
  '--autoplay-policy=no-user-gesture-required','--window-size=430,932','--hide-scrollbars','about:blank'
], {windowsHide:true,stdio:['ignore','ignore','pipe']});
let ws;
const delay = ms => new Promise(r => setTimeout(r,ms));
try {
  const endpoint = await new Promise((resolve,reject) => {
    let stderr='';
    const timeout=setTimeout(()=>reject(new Error('Chrome startup timeout: '+stderr.slice(-1000))),20000);
    chrome.on('error', reject);
    chrome.stderr.on('data',chunk=>{stderr+=chunk;const m=stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(m){clearTimeout(timeout);resolve(m[1]);}});
  });
  const port=new URL(endpoint).port;
  const target=await (await fetch(`http://127.0.0.1:${port}/json/new?${origin}/`,{method:'PUT'})).json();
  ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  let sequence=0;
  const pending=new Map();
  ws.onmessage=event=>{
    const msg=JSON.parse(event.data);
    if(msg.id){const request=pending.get(msg.id);if(request){pending.delete(msg.id);msg.error?request.reject(new Error(JSON.stringify(msg.error))):request.resolve(msg.result);}}
    if(msg.method==='Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails);
    if(msg.method==='Runtime.consoleAPICalled'){const item={type:msg.params.type,args:msg.params.args.map(a=>a.value??a.description)};if(!item.args.join(" ").includes("Tracked page")){consoleMessages.push(item);if(consoleMessages.length>90)consoleMessages.shift();}if(item.type==='error'||item.type==='warn')console.log('BROWSER CONSOLE',JSON.stringify(item).slice(0,1500));}
    if(msg.method==='Target.attachedToTarget'&&msg.params.targetInfo.type==='worker'){console.log('WORKER',msg.params.targetInfo.url);ws.send(JSON.stringify({id:++sequence,method:'Runtime.enable',sessionId:msg.params.sessionId}));}
    if(msg.method==='Log.entryAdded' && msg.params.entry.level==='error') browserErrors.push(msg.params.entry);
  };
  const rpc=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const result=await rpc('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));return result.result.value;};
  const check=(condition,message)=>{if(!condition)throw new Error(message);};
  const waitFor=async(expression,timeout=60000)=>{const started=Date.now();while(Date.now()-started<timeout){const value=await evaluate(`Boolean(${expression})`);if(value)return value;await delay(500);}throw new Error('Timeout waiting for '+expression);};
  const screenshot=async name=>{const result=await rpc('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(out,name),Buffer.from(result.data,'base64'));};
  await rpc('Runtime.enable');await rpc('Page.enable');await rpc('Log.enable');await rpc('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:false,flatten:true});
  await rpc('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await rpc('Emulation.setTouchEmulationEnabled',{enabled:true});
  await rpc('Page.navigate',{url:origin+(legacyTarget?'/?cible=photo':'/')});
  await waitFor(`location.pathname === '/nft/' && document.getElementById('demarrer') && document.getElementById('demarrer').offsetHeight > 0`);
  check(await evaluate(`document.documentElement.scrollWidth <= window.innerWidth`),'Mobile landing overflows horizontally');
  check(await evaluate(`document.querySelector('.apercu img').naturalWidth === 1280`),'Target preview is missing');
  await screenshot('01-accueil.png');
  console.log('PASS root redirect, mobile landing, target preview');
  const injectCamera=async(mode='target')=>{
    await evaluate(`(async()=>{
      window.__markerEvents=[];
      window.addEventListener('arjs-nft-loaded',()=>window.__markerEvents.push('nft-loaded'));
      window.addEventListener('arjs-nft-init-data',e=>window.__markerMetadata=e.detail);
      if(${JSON.stringify(mode)}==='denied'){
        navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Test camera denied','NotAllowedError');};
        return;
      }
      const image=new Image();image.src=document.getElementById('cible-apercu').src;await image.decode();
      const canvas=document.createElement('canvas');canvas.width=${resizeCase ? 320 : portrait ? 960 : 1280};canvas.height=${resizeCase ? 240 : portrait ? 1280 : 960};
      const context=canvas.getContext('2d');window.__showMarker=${!resizeCase};
      function draw(){context.fillStyle='#eeeeee';context.fillRect(0,0,canvas.width,canvas.height);context.filter=${JSON.stringify(captureFilter)};const targetWidth=canvas.width*${targetFraction},targetHeight=targetWidth*0.75;window.__targetBox={x:(canvas.width-targetWidth)/2,y:(canvas.height-targetHeight)/2,width:targetWidth,height:targetHeight};if(window.__showMarker)context.drawImage(image,window.__targetBox.x,window.__targetBox.y,targetWidth,targetHeight);context.filter='none';}
      draw();window.__cameraInterval=setInterval(draw,70);
      window.__cameraCanvas=canvas;window.__cameraStream=canvas.captureStream(15);
      navigator.mediaDevices.getUserMedia=async()=>window.__cameraStream;
      navigator.mediaDevices.enumerateDevices=async()=>[];
    })()`);
  };
  await injectCamera();
  await evaluate(`document.getElementById('demarrer').click()`);
  await waitFor(`document.getElementById('animation') || !document.getElementById('reessayer').hidden`,75000);
  await evaluate(`document.getElementById('marqueur')?.addEventListener('markerFound',()=>window.__markerEvents.push('found'));document.getElementById('marqueur')?.addEventListener('markerLost',()=>window.__markerEvents.push('lost'));true`);
  setTimeout(async()=>{try{console.log('DIAGNOSTIC',await evaluate(`JSON.stringify({controller:!!document.querySelector('a-scene')?.systems.arjs?._arSession?.arContext?.arController,anchor:Object.keys(document.querySelector('a-nft')?.components['arjs-anchor']?._arAnchor||{}),context:Object.keys(document.querySelector('a-scene')?.systems.arjs?._arSession?.arContext||{})})`));}catch{}},12000);
  await waitFor(`document.getElementById('etat-camera').classList.contains('pret') && document.getElementById('etat-nft').classList.contains('pret') && document.getElementById('etat-animation').classList.contains('pret')`,75000);
  console.log('PASS camera stream, real NFT worker, animation loaded');
  if(resizeCase){
    await evaluate(`window.__cameraCanvas.width=960;window.__cameraCanvas.height=1280;window.__showMarker=true;true`);
    await waitFor(`document.getElementById('arjs-video').videoWidth===960&&document.getElementById('arjs-video').videoHeight===1280`);
    console.log('CAMERA RESIZED: 320x240 -> 960x1280');
  }

  await waitFor(`document.getElementById('interface').classList.contains('reconnue')`,12000);
  const geometry=await evaluate(`(()=>{const a=document.getElementById('ancrage').object3D,p=document.getElementById('animation').object3D;return {anchor:a.position.toArray(),scale:p.scale.toArray(),rotation:p.rotation.toArray(),events:window.__markerEvents,metadata:window.__markerMetadata,video:{width:document.getElementById('arjs-video').videoWidth,height:document.getElementById('arjs-video').videoHeight},smooth:document.getElementById('marqueur').components['arjs-anchor'].data.smoothCount};})()`);
  check(geometry.anchor[0]>0 && geometry.anchor[1]===0 && geometry.anchor[2]<0,'Animation anchor is not centered on NFT image plane');
  check(geometry.smooth===10,'NFT smoothing mapping is invalid');
  check(geometry.metadata.width===(legacyTarget?1280:640),'The descriptors do not match the chosen target');
  await evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))`);
  console.log('MOBILE LAYOUT',await evaluate(`JSON.stringify({innerWidth,innerHeight,body:document.body.getBoundingClientRect().toJSON(),interface:document.getElementById('interface').getBoundingClientRect().toJSON(),status:document.querySelector('.etat').getBoundingClientRect().toJSON(),video:document.getElementById('arjs-video').getBoundingClientRect().toJSON(),canvas:document.querySelector('a-scene').canvas.getBoundingClientRect().toJSON()})`));
  check(await evaluate(`getComputedStyle(document.getElementById('arjs-video')).zIndex === '0'`),'Camera video is hidden behind the page');
  check(await evaluate(`window.innerWidth === 390`),'Scanner changes the mobile viewport width');
  check(await evaluate(`(()=>{const v=document.getElementById('arjs-video').getBoundingClientRect(),c=document.querySelector('a-scene').canvas.getBoundingClientRect();return ['x','y','width','height'].every(k=>Math.abs(v[k]-c[k])<1)})()`),'Canvas and video do not share the same framing');
  check(await evaluate(`(()=>{const v=document.getElementById('arjs-video').getBoundingClientRect(),vid=document.getElementById('arjs-video'),b=window.__targetBox;const sx=v.width/vid.videoWidth,sy=v.height/vid.videoHeight;const box={left:v.left+b.x*sx,right:v.left+(b.x+b.width)*sx,top:v.top+b.y*sy,bottom:v.top+(b.y+b.height)*sy};return box.left>=0&&box.right<=innerWidth&&box.top>document.querySelector('.etat').getBoundingClientRect().bottom&&box.bottom<document.querySelector('.commandes').getBoundingClientRect().top;})()`),'The target is cropped or hidden by the interface');
  check(await evaluate(`(()=>{const sc=document.querySelector('a-scene');return sc.camera.projectionMatrix.equals(sc.components['align-video-overlay'].projection)})()`),'The renderer overwrites the projection for the camera crop');
  const mediaHeightRatio=await evaluate(`(()=>{const sc=document.querySelector('a-scene'),box=new AFRAME.THREE.Box3().setFromObject(document.getElementById('animation').object3D),ys=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])ys.push(new AFRAME.THREE.Vector3(x,y,z).project(sc.camera).y);const canvasRect=sc.canvas.getBoundingClientRect(),v=document.getElementById('arjs-video');return (Math.max(...ys)-Math.min(...ys))/2*canvasRect.height/(window.__targetBox.height/v.videoHeight*v.getBoundingClientRect().height);})()`);
  check(mediaHeightRatio>0.85&&mediaHeightRatio<1.2,'The animation does not cover the target with correct proportions: '+mediaHeightRatio);
  console.log('PASS animation coverage relative to image:',mediaHeightRatio.toFixed(3));
  await evaluate(`document.getElementById('diagnostic').open=true;true`);
  await waitFor(`Number(document.getElementById('analyse-canvas').dataset.frameNumber)>0`);
  check(await evaluate(`(()=>{const p=document.getElementById('analyse-canvas').getContext('2d').getImageData(320,240,1,1).data;return p[3]===255&&(p[0]+p[1]+p[2])>15})()`),'The analysed frame does not contain the target in its center after camera resize');
  console.log('PASS analysed-frame preview contains the target');
  await evaluate(`Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new DOMException('Test clipboard refusal','NotAllowedError')}}});document.getElementById('copier-diagnostic').click();true`);
  await waitFor(`!document.getElementById('diagnostic-texte').hidden`);
  const report=await evaluate(`JSON.parse(document.getElementById('diagnostic-texte').textContent)`);
  check(report.target===(legacyTarget?'photo':'mmi'),'Diagnostic does not identify the selected target');
  check(report.frames>0 && report.build==='20261110-5' && report.source[0] === (resizeCase || portrait ? 960 : 1280), 'Invalid diagnostic report');
  console.log('PASS diagnostic can be copied manually when clipboard is denied');

  await screenshot('03-analyse.png');
  await evaluate(`document.getElementById('diagnostic').open=false;true`);
  await delay(250);
  await waitFor(`!document.getElementById('animation-video').paused&&document.getElementById('animation-video').currentTime>0.1`);
  check(await evaluate(`(()=>{const m=document.getElementById('animation').getObject3D('mesh').material;return m.map&&m.map.isVideoTexture&&m.map.image===document.getElementById('animation-video')})()`),'The animation is not connected to a live video texture');
  check(!requests.some(r=>r.url.endsWith('.glb')),'The old 3D model is still requested');
  const textureVersion=await evaluate(`document.getElementById('animation').getObject3D('mesh').material.map.version`);
  const hashes=[];
  for(let i=0;i<6;i++){
    hashes.push(await evaluate(`(()=>{const v=document.getElementById('animation-video'),c=document.createElement('canvas');c.width=160;c.height=120;const x=c.getContext('2d');x.drawImage(v,0,0,160,120);const p=x.getImageData(0,0,160,120).data;let hash=2166136261;for(let i=0;i<p.length;i+=4){hash=Math.imul(hash^p[i],16777619);hash=Math.imul(hash^p[i+1],16777619);hash=Math.imul(hash^p[i+2],16777619);}return hash>>>0;})()`));
    await delay(250);
  }
  check(new Set(hashes).size>1,'The animation remains on a single frame');
  check(await evaluate(`document.getElementById('animation').getObject3D('mesh').material.map.version>${textureVersion}`),'The animation texture is not refreshed');
  await evaluate(`document.getElementById('animation-video').currentTime=document.getElementById('animation-video').duration-0.1;true`);
  await waitFor(`document.getElementById('animation-video').currentTime<1&&!document.getElementById('animation-video').paused`);
  console.log('PASS animated frames, GPU texture refresh, silent inline looping, no GLB request');
  await screenshot('02-image-reconnue.png');
  console.log('PASS target recognized, animation centered and visible',JSON.stringify(geometry));
  await evaluate('window.__showMarker=false');
  await waitFor(`!document.getElementById('interface').classList.contains('reconnue')`,20000);
  check(await evaluate(`!document.getElementById('marqueur').object3D.visible`),'Animation remains visible without target');
  console.log('PASS animation hidden after losing target');
  await waitFor(`document.getElementById('animation-video').paused`);
  await evaluate(`window.__normalAnimationPlay=document.getElementById('animation-video').play.bind(document.getElementById('animation-video'));document.getElementById('animation-video').play=async()=>{throw new DOMException('Test playback denied','NotAllowedError')};window.__showMarker=true;true`);
  await waitFor(`document.getElementById('interface').classList.contains('reconnue')&&!document.getElementById('activer-animation').hidden`);
  await evaluate(`document.getElementById('animation-video').play=window.__normalAnimationPlay;document.getElementById('activer-animation').click();true`);
  await waitFor(`!document.getElementById('animation-video').paused&&document.getElementById('activer-animation').hidden`);
  console.log('PASS pause after target loss and manual playback fallback');

  await rpc('Page.navigate',{url:origin+'/nft/'});
  await waitFor(`document.getElementById('demarrer') && !document.getElementById('accueil').hidden`);
  await injectCamera('denied');
  await evaluate(`document.getElementById('demarrer').click()`);
  await waitFor(`document.getElementById('interface').classList.contains('erreur')`,60000);
  check(await evaluate(`!document.getElementById('reessayer').hidden`),'Camera error retry is missing');
  console.log('PASS camera refusal shows error and retry');
  missingMedia=true;
  await rpc('Page.navigate',{url:origin+'/nft/'});
  await waitFor(`document.getElementById('demarrer') && !document.getElementById('accueil').hidden`);
  await injectCamera();
  await evaluate(`document.getElementById('demarrer').click()`);
  await waitFor(`document.getElementById('interface').classList.contains('erreur')`,60000);
  check(await evaluate(`document.getElementById('etat-message').textContent.includes('animation MMI')`),'Missing animation does not show correct error');
  console.log('PASS missing MP4 shows specific error');
  await rpc('Page.navigate',{url:origin+'/nft/cible.html'});
  await waitFor(`document.querySelector('img')?.naturalWidth === 1280`);
  check(await evaluate(`document.querySelector('a[download]') !== null`),'Target download is missing');
  await rpc('Emulation.setEmulatedMedia',{media:'print'});
  check(await evaluate(`getComputedStyle(document.querySelector('nav')).display === 'none'`),'Print view exposes controls');
  console.log('PASS target page, download, print view');
  await rpc('Emulation.setEmulatedMedia',{media:''});
  for(const [key,filename] of [['mmi','MMI-cible.png'],['photo','IMG_9765.webp']]){
    await rpc('Page.navigate',{url:origin+'/nft/cible.html?cible='+key});
    await waitFor(`document.getElementById('cible-image')?.complete&&document.getElementById('cible-image').naturalWidth===1280&&document.getElementById('cible-image').src.endsWith('${filename}')`);
    check(await evaluate(`document.getElementById('choix-cible').value==='${key}'&&document.getElementById('telecharger-cible').download==='${filename}'&&new URL(document.getElementById('ouvrir-scanner').href).searchParams.get('cible')==='${key}'`),'Target page, download and scanner link disagree for '+key);
  }
  console.log('PASS both target images, downloads and scanner links agree');

  check(errors.length===0,'Uncaught browser exceptions: '+JSON.stringify(errors));
  await fs.writeFile(path.join(out,'results.json'),JSON.stringify({geometry,requests,errors,browserErrors},null,2));
  console.log('ALL CHECKS PASSED. Artifacts: '+out);
} catch(error) {
  console.error('BROWSER CHECK FAILED:',error.message);
  if(ws && ws.readyState===WebSocket.OPEN){
    let id=999999;ws.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression:`JSON.stringify({title:document.getElementById('etat-titre')?.textContent,message:document.getElementById('etat-message')?.textContent,events:window.__markerEvents,body:document.body.innerText,sessionKeys:Object.keys(document.querySelector('a-scene')?.systems.arjs?._arSession||{}),controller:!!document.querySelector('a-scene')?.systems.arjs?._arSession?.arContext?.arController})`,returnByValue:true}}));
    ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id===id)console.error('PAGE STATE:',JSON.stringify(m.result));});
    await delay(1000);
  }
  console.error('Console history:',JSON.stringify(consoleMessages).slice(-13000));console.error('Exceptions:',JSON.stringify(errors));console.error('Browser errors:',JSON.stringify(browserErrors));
  await fs.writeFile(path.join(out,'failure.json'),JSON.stringify({requests,errors,browserErrors},null,2));
  console.error('Artifacts: '+out);process.exitCode=1;
} finally {
  if(ws)ws.close();chrome.kill();server.close();
}
