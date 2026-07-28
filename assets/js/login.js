(function(){
 const $=id=>document.getElementById(id);
 const statusEl=$('status'),cameraBox=$('cameraBox'),video=$('cameraVideo'),canvas=$('scanCanvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
 const fileInput=$('qrFile'),qrStep=$('qrStep'),codeStep=$('codeStep'),stopBtn=$('stopBtn'),sharedCode=$('sharedCode');
 let stream=null,raf=0,pending=null,busy=false,nativeDetector=null;

 function setStatus(text,type=''){statusEl.textContent=text;statusEl.className=`status ${type}`}
 function normalizeCode(){sharedCode.value=sharedCode.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,10)}
 function setStep(two=false){$('stepOne').classList.toggle('active',!two);$('stepTwo').classList.toggle('active',two)}
 function reset(){
  pending=null;sharedCode.value='';codeStep.classList.add('hidden');qrStep.classList.remove('hidden');
  setStep(false);setStatus('พร้อมอ่าน QR ประจำตัว');stopCamera();
 }
 async function identify(raw){
  if(!raw||busy)return;
  busy=true;stopCamera();setStatus('กำลังตรวจสอบ QR…');
  try{
   const data=await Api.request('/api/auth/qr/identify',{method:'POST',body:JSON.stringify({qrPayload:raw})});
   pending=data;$('displayName').textContent=data.user.displayName;
   $('employeeCode').textContent=data.user.employeeCode?`รหัสพนักงาน ${data.user.employeeCode}`:'';
   qrStep.classList.add('hidden');codeStep.classList.remove('hidden');setStep(true);
   setStatus('QR ถูกต้อง กรุณากรอกรหัสผ่านประจำรอบ','ok');
   setTimeout(()=>sharedCode.focus(),100);
  }catch(err){
   setStatus(err.message||'ไม่สามารถตรวจสอบ QR ได้','error');
   Swal.fire({icon:'error',title:'อ่าน QR ไม่สำเร็จ',text:err.message||'กรุณาตรวจสอบ QR แล้วลองใหม่',confirmButtonText:'ตกลง'});
  }finally{busy=false}
 }
 async function completeLogin(){
  normalizeCode();
  if(!pending)return setStatus('กรุณาสแกน QR ใหม่','error');
  if(!/^(?=.*[A-Z])(?=.*\d)[A-Z0-9]{10}$/.test(sharedCode.value)){
   return Swal.fire({icon:'warning',title:'รหัสไม่ครบ',text:'รหัสผ่านประจำรอบต้องมี 10 หลัก และมีทั้งตัวอักษรอังกฤษกับตัวเลข'});
  }
  $('loginBtn').disabled=true;
  Swal.fire({title:'กำลังเข้าสู่ระบบ',allowOutsideClick:false,didOpen:()=>Swal.showLoading()});
  try{
   const data=await Api.request('/api/auth/qr/complete',{method:'POST',body:JSON.stringify({
    challengeId:pending.challengeId,challengeToken:pending.challengeToken,sharedCode:sharedCode.value
   })});
   localStorage.setItem('csi_session_token',data.sessionToken);
   localStorage.setItem('csi_user',JSON.stringify(data.user));
   await Swal.fire({icon:'success',title:'เข้าสู่ระบบสำเร็จ',text:data.user.displayName,timer:900,showConfirmButton:false});
   location.href='field.html';
  }catch(err){
   Swal.close();setStatus(err.message,'error');
   await Swal.fire({icon:'error',title:'เข้าสู่ระบบไม่สำเร็จ',text:err.message||'กรุณาตรวจสอบรหัสผ่านประจำรอบ'});
  }finally{$('loginBtn').disabled=false}
 }
 async function getDetector(){
  if('BarcodeDetector' in window){
   try{return nativeDetector||(nativeDetector=new BarcodeDetector({formats:['qr_code']}))}catch(_){}
  }
  return null;
 }
 function decodeCanvas(){
  const img=ctx.getImageData(0,0,canvas.width,canvas.height);
  const result=window.jsQR?.(img.data,img.width,img.height,{inversionAttempts:'attemptBoth'});
  return result?.data||'';
 }
 async function decodeImageSource(source,width,height){
  canvas.width=width;canvas.height=height;ctx.drawImage(source,0,0,width,height);
  const detector=await getDetector();
  if(detector){
   try{const codes=await detector.detect(canvas);if(codes.length)return codes[0].rawValue}catch(_){}
  }
  return decodeCanvas();
 }
 async function scanFrame(){
  if(!stream)return;
  if(video.readyState>=2){
   const w=video.videoWidth,h=video.videoHeight;
   if(w&&h){
    const raw=await decodeImageSource(video,w,h);
    if(raw)return identify(raw);
   }
  }
  raf=requestAnimationFrame(scanFrame);
 }
 async function startCamera(){
  if(!navigator.mediaDevices?.getUserMedia){
   return Swal.fire({icon:'warning',title:'เปิดกล้องไม่ได้',text:'กรุณาเลือกไฟล์รูป QR จากโทรศัพท์แทน'});
  }
  try{
   stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280}},audio:false});
   video.srcObject=stream;cameraBox.style.display='block';stopBtn.classList.remove('hidden');
   await video.play();setStatus('วาง QR ให้อยู่ภายในกรอบ');raf=requestAnimationFrame(scanFrame);
  }catch(err){
   setStatus('ไม่สามารถเปิดกล้องได้ กรุณาเลือกรูป QR','error');
   Swal.fire({icon:'warning',title:'ไม่สามารถเปิดกล้อง',text:'กรุณาอนุญาตสิทธิ์กล้อง หรือใช้ปุ่มเลือกรูป QR จากโทรศัพท์'});
  }
 }
 function stopCamera(){
  if(raf)cancelAnimationFrame(raf);raf=0;
  if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;
  video.srcObject=null;cameraBox.style.display='none';stopBtn.classList.add('hidden');
 }
 async function decodeFile(file){
  setStatus('กำลังอ่านรูป QR…');
  try{
   const bitmap=await createImageBitmap(file);
   const max=1600,scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
   const raw=await decodeImageSource(bitmap,Math.max(1,Math.round(bitmap.width*scale)),Math.max(1,Math.round(bitmap.height*scale)));
   bitmap.close();
   if(!raw)throw new Error('ไม่พบ QR Code ในรูปที่เลือก กรุณาเลือกรูปที่ชัดและไม่ถูกตัด');
   await identify(raw);
  }catch(err){
   setStatus(err.message,'error');
   Swal.fire({icon:'error',title:'อ่านรูป QR ไม่สำเร็จ',text:err.message});
  }
 }
 $('scanBtn').onclick=startCamera;
 $('chooseBtn').onclick=()=>fileInput.click();
 stopBtn.onclick=stopCamera;
 $('loginBtn').onclick=completeLogin;
 $('rescanBtn').onclick=reset;
 sharedCode.oninput=normalizeCode;
 sharedCode.onkeydown=e=>{if(e.key==='Enter')completeLogin()};
 fileInput.onchange=()=>{const f=fileInput.files?.[0];if(f)decodeFile(f);fileInput.value=''};
 window.addEventListener('pagehide',stopCamera);
})();