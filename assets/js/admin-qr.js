(()=>{
const $=id=>document.getElementById(id);
const status=$('sharedCodeStatus');
function setStatus(text,type=''){
 status.textContent=text;
 status.className=`inline-status ${type}`;
}
function normalize(input){
 input.value=input.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,10);
}
async function guard(){
 try{
  const d=await Api.request('/api/staff/me');
  if(d.user.role_code!=='ADMIN')throw new Error('ไม่มีสิทธิ์ Admin');
 }catch(e){
  await UI.error('กรุณาเข้าสู่ระบบ Admin',e.message);
  location.href='admin-login.html';
  throw e;
 }
}
async function save(){
 const input=$('sharedCodeAdmin');
 normalize(input);
 if(!/^(?=.*[A-Z])(?=.*\d)[A-Z0-9]{10}$/.test(input.value)){
  await UI.error('รหัสไม่ถูกต้อง','ต้องมี 10 หลัก และมีทั้งตัวอักษรอังกฤษกับตัวเลข');
  input.focus();return;
 }
 const confirm=await UI.confirm(
  'เปลี่ยนรหัสผ่านประจำรอบ?',
  'รหัสเดิมจะใช้เข้าสู่ระบบไม่ได้ทันที แต่ QR ประจำตัวของทุกคนยังคงเดิม',
  'ยืนยันเปลี่ยนรหัส'
 );
 if(!confirm.isConfirmed)return;
 try{
  UI.loading('กำลังบันทึกรหัสประจำรอบ…');
  const d=await Api.request('/api/admin/shared-code/set',{
   method:'POST',body:JSON.stringify({sharedCode:input.value})
  });
  UI.close();input.value='';
  setStatus(d.message||'กำหนดรหัสประจำรอบเรียบร้อยแล้ว','ok');
  await UI.success('บันทึกสำเร็จ','QR ประจำตัวเดิมยังใช้งานได้');
 }catch(e){
  UI.close();setStatus(e.message,'error');
  UI.error('บันทึกไม่สำเร็จ',e.message);
 }
}
$('sharedCodeAdmin').addEventListener('input',e=>normalize(e.target));
$('sharedCodeAdmin').addEventListener('keydown',e=>{if(e.key==='Enter')save()});
$('setSharedCodeBtn').onclick=save;
$('menuBtn').onclick=()=>$('side').classList.toggle('open');
document.addEventListener('click',e=>{
 if(innerWidth<=850&&!e.target.closest('#side')&&!e.target.closest('#menuBtn'))$('side').classList.remove('open');
});
guard();
})();