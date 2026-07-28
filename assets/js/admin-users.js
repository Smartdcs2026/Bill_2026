(()=>{
const $=id=>document.getElementById(id);let users=[];
const headers=()=>({});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function roleName(v){return ({FIELD_USER:'ผู้ปฏิบัติงาน',REVIEWER:'หัวหน้างาน',ADMIN:'Admin',FINANCE:'การเงิน',EXECUTIVE:'ผู้บริหาร'})[v]||v}
async function guard(){try{const d=await Api.request('/api/staff/me');if(d.user.role_code!=='ADMIN')throw new Error('ไม่มีสิทธิ์ Admin')}catch(e){await UI.error('กรุณาเข้าสู่ระบบ Admin',e.message);location.href='admin-login.html';throw e}}
async function loadUsers(){try{$('usersStatus').textContent='กำลังโหลด...';const p=new URLSearchParams({q:$('userSearch').value.trim(),role:$('roleFilter').value,status:$('statusFilter').value,limit:'500'});const d=await Api.request('/api/admin/users?'+p);users=d.users||[];render();$('usersStatus').textContent=`พบ ${users.length} คน`}catch(e){UI.error('โหลดข้อมูลไม่สำเร็จ',e.message)}}
function render(){
 $('metricTotal').textContent=users.length;
 $('metricField').textContent=users.filter(x=>x.roleCode==='FIELD_USER').length;
 $('metricQr').textContent=users.filter(x=>x.activeQrCount>0).length;
 $('metricOff').textContent=users.filter(x=>!x.isActive).length;
 $('usersBody').innerHTML=users.map(u=>`<tr>
  <td class="name-cell"><b>${esc(u.displayName)}</b><small>@${esc(u.username)}</small></td>
  <td>${esc(u.employeeCode||'-')}</td>
  <td><span class="badge">${esc(roleName(u.roleCode))}</span></td>
  <td><span class="badge ${u.isActive?'ok':'off'}">${u.isActive?'ใช้งาน':'ปิดใช้งาน'}</span></td>
  <td class="qr-cell">${u.roleCode==='FIELD_USER'?(u.activeQrCount?`<b>ใช้งาน</b><small>สร้าง ${esc(u.qrCreatedDisplay||'-')}</small>`:'<span class="badge off">ยังไม่มี QR</span>'):'-'}</td>
  <td>${u.qrLastUsedDisplay?esc(u.qrLastUsedDisplay):'-'}</td>
  <td><div class="row-menu"><button class="more-btn" data-act="menu" data-id="${u.id}">⋮</button><div class="action-pop hidden" data-menu="${u.id}">
   <button data-act="edit" data-id="${u.id}">แก้ไขผู้ใช้งาน</button>
   ${u.roleCode==='FIELD_USER'?`<button data-act="qr" data-id="${u.id}">${u.activeQrCount?'ออก QR ใหม่':'สร้าง QR ประจำตัว'}</button>${u.activeQrCount?`<button class="danger" data-act="revokeQr" data-id="${u.id}">ยกเลิก QR</button>`:''}`:''}
   <button class="${u.isActive?'danger':''}" data-act="status" data-id="${u.id}">${u.isActive?'ปิดบัญชี':'เปิดบัญชี'}</button>
  </div></div></td>
 </tr>`).join('')||'<tr><td colspan="7">ยังไม่มีข้อมูล</td></tr>';
}function openUser(u=null){$('editUserId').value=u?.id||'';$('editDisplayName').value=u?.displayName||'';$('editUsername').value=u?.username||'';$('editEmployeeCode').value=u?.employeeCode||'';$('editPassword').value='';$('editRoleCode').value=u?.roleCode||'FIELD_USER';$('userDialogTitle').textContent=u?'แก้ไขผู้ใช้งาน':'เพิ่มผู้ใช้งาน';$('userDialog').showModal()}
let savingUser=false;
async function saveUser(){
 if(savingUser)return;

 const dialog=$('userDialog');
 const saveBtn=$('saveUserBtn');
 const id=$('editUserId').value;
 const payload={
  id,
  displayName:$('editDisplayName').value.trim(),
  username:$('editUsername').value.trim().toLowerCase(),
  employeeCode:$('editEmployeeCode').value.trim(),
  password:$('editPassword').value,
  roleCode:$('editRoleCode').value
 };

 if(!payload.displayName){
  await UI.error('ข้อมูลไม่ครบ','กรุณากรอกชื่อผู้ใช้งาน');
  $('editDisplayName').focus();
  return;
 }
 if(!/^[a-z0-9._-]{3,80}$/.test(payload.username)){
  await UI.error('Username ไม่ถูกต้อง','ใช้ตัวอักษรอังกฤษพิมพ์เล็ก ตัวเลข จุด ขีดกลาง หรือขีดล่าง อย่างน้อย 3 ตัว');
  $('editUsername').focus();
  return;
 }
 if(['ADMIN','REVIEWER'].includes(payload.roleCode)&&!id&&!/^(?=.*[A-Za-z])(?=.*\d).{10,}$/.test(payload.password)){
  await UI.error('รหัสผ่านไม่ถูกต้อง','Admin และหัวหน้างานต้องมีรหัสผ่านอย่างน้อย 10 ตัว และมีทั้งตัวอักษรกับตัวเลข');
  $('editPassword').focus();
  return;
 }

 savingUser=true;
 saveBtn.disabled=true;
 saveBtn.textContent='กำลังบันทึก...';

 /*
  Native <dialog> อยู่ใน browser top layer ซึ่งอยู่เหนือ SweetAlert
  จึงต้องปิด dialog ก่อนเปิด Loading/ข้อความแจ้งผล
 */
 if(dialog.open)dialog.close();

 try{
  UI.loading(id?'กำลังแก้ไขผู้ใช้งาน...':'กำลังเพิ่มผู้ใช้งาน...');
  const result=await Api.request(
   id?'/api/admin/users/update':'/api/admin/users/create',
   {method:'POST',body:JSON.stringify(payload)}
  );
  UI.close();
  await UI.success('บันทึกสำเร็จ',result.message||'บันทึกข้อมูลผู้ใช้งานเรียบร้อยแล้ว');
  await loadUsers();
 }catch(e){
  UI.close();
  await UI.error('บันทึกไม่สำเร็จ',e.message||'ระบบไม่สามารถบันทึกข้อมูลได้');
  /*
   เปิดฟอร์มเดิมกลับมาโดยข้อมูลที่กรอกยังอยู่
   เพื่อให้ผู้ใช้แก้ไขแล้วลองบันทึกใหม่
  */
  if(!dialog.open)dialog.showModal();
 }finally{
  savingUser=false;
  saveBtn.disabled=false;
  saveBtn.textContent='บันทึก';
 }
}
async function setStatus(u){const c=await UI.confirm(`${u.isActive?'ปิด':'เปิด'}บัญชี ${u.displayName}?`,u.isActive?'Session ที่ใช้งานอยู่จะถูกยกเลิกทันที':'ผู้ใช้จะกลับมาเข้าสู่ระบบได้',u.isActive?'ยืนยันปิดบัญชี':'ยืนยันเปิดบัญชี');if(!c.isConfirmed)return;try{UI.loading();await Api.request('/api/admin/users/status',{method:'POST',body:JSON.stringify({id:u.id,isActive:!u.isActive})});UI.close();await UI.success('ดำเนินการสำเร็จ');loadUsers()}catch(e){UI.close();UI.error('ดำเนินการไม่สำเร็จ',e.message)}}
async function createQr(u){
 const replacing=Number(u.activeQrCount)>0;
 if(replacing){
  const c=await UI.confirm('ออก QR ใหม่ให้ '+u.displayName+'?','QR เดิมจะถูกยกเลิกทันที และผู้ปฏิบัติงานต้องใช้ไฟล์ QR ใหม่','ยืนยันออก QR ใหม่');
  if(!c.isConfirmed)return;
 }
 try{
  UI.loading(replacing?'กำลังออก QR ใหม่...':'กำลังสร้าง QR ประจำตัว...');
  const d=await Api.request('/api/admin/qr/create',{method:'POST',body:JSON.stringify({userId:u.id,revokeExisting:true})});
  const holder=document.createElement('div');
  new QRCode(holder,{text:d.qrPayload,width:900,height:900,correctLevel:QRCode.CorrectLevel.H});
  await new Promise(r=>setTimeout(r,250));
  const img=holder.querySelector('img'),canvas=holder.querySelector('canvas'),href=img?.src||canvas?.toDataURL('image/png');
  const a=document.createElement('a');
  a.download=`RetailInsight_QR_${u.employeeCode||u.username}_${u.displayName}.png`;a.href=href;a.click();
  UI.close();
  await UI.success(replacing?'ออก QR ใหม่สำเร็จ':'สร้าง QR สำเร็จ',`QR ประจำตัวแบบถาวร · สร้าง ${d.createdDisplay||''}`);
  await loadUsers();
 }catch(e){UI.close();UI.error('สร้าง QR ไม่สำเร็จ',e.message)}
}
async function revokeQr(u){
 if(!u.activeQrCredentialId)return UI.error('ไม่พบ QR','ผู้ใช้งานนี้ไม่มี QR ที่กำลังใช้งาน');
 const c=await UI.confirm('ยกเลิก QR ของ '+u.displayName+'?','หลังยกเลิก QR นี้จะเข้าสู่ระบบไม่ได้ จนกว่า Admin จะสร้าง QR ใหม่','ยืนยันยกเลิก QR');
 if(!c.isConfirmed)return;
 try{UI.loading('กำลังยกเลิก QR...');await Api.request('/api/admin/qr/revoke',{method:'POST',body:JSON.stringify({credentialId:u.activeQrCredentialId})});UI.close();await UI.success('ยกเลิก QR สำเร็จ');await loadUsers()}
 catch(e){UI.close();UI.error('ยกเลิก QR ไม่สำเร็จ',e.message)}
}
$('usersBody').addEventListener('click',e=>{
 const b=e.target.closest('button[data-act]');if(!b)return;
 const act=b.dataset.act,id=b.dataset.id;
 if(act==='menu'){
  document.querySelectorAll('.action-pop').forEach(x=>{if(x.dataset.menu!==id)x.classList.add('hidden')});
  document.querySelector(`[data-menu="${id}"]`)?.classList.toggle('hidden');return;
 }
 const u=users.find(x=>x.id===id);if(!u)return;
 document.querySelectorAll('.action-pop').forEach(x=>x.classList.add('hidden'));
 if(act==='edit')openUser(u);
 if(act==='status')setStatus(u);
 if(act==='qr')createQr(u);
 if(act==='revokeQr')revokeQr(u);
});
$('refreshUsersBtn').onclick=loadUsers;
$('newUserBtn').onclick=()=>openUser();
$('saveUserBtn').onclick=e=>{e.preventDefault();saveUser()};
$('closeUserDialog').onclick=e=>{e.preventDefault();if(!savingUser)$('userDialog').close()};
$('editUsername').addEventListener('blur',e=>{e.target.value=e.target.value.trim().toLowerCase()});
$('roleFilter').onchange=loadUsers;$('statusFilter').onchange=loadUsers;$('userSearch').onkeydown=e=>{if(e.key==='Enter')loadUsers()};
$('menuBtn').onclick=()=>$('side').classList.toggle('open');
document.addEventListener('click',e=>{if(!e.target.closest('.row-menu'))document.querySelectorAll('.action-pop').forEach(x=>x.classList.add('hidden'))});
guard().then(loadUsers);
})();