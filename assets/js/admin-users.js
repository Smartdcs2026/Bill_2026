(()=>{
const $=id=>document.getElementById(id);
let users=[];
let supervisors=[];
let actionUserId=null;
let actionAnchor=null;

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const roleName=v=>({FIELD_USER:'ผู้ปฏิบัติงาน',REVIEWER:'หัวหน้างาน',ADMIN:'Admin',FINANCE:'การเงิน',EXECUTIVE:'ผู้บริหาร'})[v]||v;
const initials=name=>{
 const p=String(name||'?').trim().split(/\s+/).filter(Boolean);
 return (p.length>1?(p[0][0]+p[p.length-1][0]):p[0]?.slice(0,2)||'?').toUpperCase();
};

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

async function loadSupervisors(){const d=await Api.request('/api/admin/workplan-template/options');supervisors=d.supervisors||[];$('editSupervisorUserId').innerHTML='<option value="">เลือกหัวหน้างาน</option>'+supervisors.map(x=>`<option value="${esc(x.id)}">${esc(x.displayName)} — ${esc(x.employeeCode||'-')}</option>`).join('')}

async function loadUsers(){
 closeActionMenu();
 try{
  $('usersStatus').textContent='กำลังโหลดข้อมูล…';
  $('refreshUsersBtn').disabled=true;
  const p=new URLSearchParams({
   q:$('userSearch').value.trim(),
   role:$('roleFilter').value,
   status:$('statusFilter').value,
   limit:'500'
  });
  const d=await Api.request('/api/admin/users?'+p);
  users=d.users||[];
  render();
  $('usersStatus').textContent=`แสดง ${users.length} บัญชี`;
 }catch(e){
  $('usersStatus').textContent='โหลดข้อมูลไม่สำเร็จ';
  UI.error('โหลดข้อมูลไม่สำเร็จ',e.message);
 }finally{
  $('refreshUsersBtn').disabled=false;
 }
}

function userQrHtml(u){
 if(u.roleCode!=='FIELD_USER')return '<span class="last-use">ไม่ใช้ QR</span>';
 if(!u.activeQrCount)return '<span class="badge warn"><span class="status-dot"></span>ยังไม่มี QR</span>';
 return `<div class="qr-cell"><b>พร้อมใช้งาน</b><small>สร้าง ${esc(u.qrCreatedDisplay||'-')}</small></div>`;
}

function rowHtml(u){
 return `<tr>
  <td>
   <div class="user-cell">
    <span class="avatar">${esc(initials(u.displayName))}</span>
    <span class="user-copy"><b>${esc(u.displayName)}</b><small>@${esc(u.username)}</small></span>
   </div>
  </td>
  <td class="code-cell">${esc(u.employeeCode||'-')}</td>
  <td><span class="badge role">${esc(roleName(u.roleCode))}</span></td>
  <td><span class="badge ${u.isActive?'ok':'off'}"><span class="status-dot"></span>${u.isActive?'เปิดใช้งาน':'ปิดใช้งาน'}</span></td>
  <td>${userQrHtml(u)}</td>
  <td><span class="last-use">${esc(u.qrLastUsedDisplay||'-')}</span></td>
  <td class="col-action"><button class="more-btn" data-act="menu" data-id="${u.id}" aria-label="จัดการ ${esc(u.displayName)}">⋮</button></td>
 </tr>`;
}

function mobileCardHtml(u){
 return `<article class="mobile-user-card">
  <div class="mobile-user-head">
   <span class="avatar">${esc(initials(u.displayName))}</span>
   <span class="user-copy"><b>${esc(u.displayName)}</b><small>@${esc(u.username)}</small></span>
   <button class="more-btn" data-act="menu" data-id="${u.id}" aria-label="จัดการ ${esc(u.displayName)}">⋮</button>
  </div>
  <div class="mobile-user-meta">
   <div class="mobile-meta"><span>รหัสพนักงาน</span><b>${esc(u.employeeCode||'-')}</b></div>
   <div class="mobile-meta"><span>สิทธิ์</span><b>${esc(roleName(u.roleCode))}</b></div>
   <div class="mobile-meta"><span>บัญชี</span><b>${u.isActive?'เปิดใช้งาน':'ปิดใช้งาน'}</b></div>
   <div class="mobile-meta"><span>QR</span><b>${u.roleCode==='FIELD_USER'?(u.activeQrCount?'พร้อมใช้งาน':'ยังไม่มี QR'):'ไม่ใช้ QR'}</b></div>
  </div>
 </article>`;
}

function render(){
 $('metricTotal').textContent=users.length;
 $('metricField').textContent=users.filter(x=>x.roleCode==='FIELD_USER').length;
 $('metricQr').textContent=users.filter(x=>x.roleCode==='FIELD_USER'&&x.activeQrCount>0).length;
 $('metricOff').textContent=users.filter(x=>!x.isActive).length;

 $('usersBody').innerHTML=users.length
  ?users.map(rowHtml).join('')
  :'<tr class="empty-row"><td colspan="7">ไม่พบผู้ใช้งานตามเงื่อนไขที่เลือก</td></tr>';

 $('mobileUsers').innerHTML=users.length
  ?users.map(mobileCardHtml).join('')
  :'<div class="empty-row">ไม่พบผู้ใช้งานตามเงื่อนไขที่เลือก</div>';
}

function openUser(u=null){
 closeActionMenu();
 $('editUserId').value=u?.id||'';
 $('editDisplayName').value=u?.displayName||'';
 $('editUsername').value=u?.username||'';
 $('editEmployeeCode').value=u?.employeeCode||'';
 $('editPassword').value='';
 $('editRoleCode').value=u?.roleCode||'FIELD_USER';
 $('editSupervisorUserId').value=u?.supervisorUserId||'';
 toggleSupervisorField();
 $('userDialogTitle').textContent=u?'แก้ไขผู้ใช้งาน':'เพิ่มผู้ใช้งาน';
 $('userDialog').showModal();
 setTimeout(()=>$('editDisplayName').focus(),80);
}


async function showDialogValidation_(title,message,focusId){
 const dialog=$('userDialog');
 if(dialog.open)dialog.close();
 await UI.error(title,message);
 if(!dialog.open)dialog.showModal();
 setTimeout(()=>$(focusId)?.focus(),80);
}

let savingUser=false;
async function saveUser(){
 if(savingUser)return;
 const dialog=$('userDialog'),saveBtn=$('saveUserBtn'),id=$('editUserId').value;
 const payload={
  id,
  displayName:$('editDisplayName').value.trim(),
  username:$('editUsername').value.trim().toLowerCase(),
  employeeCode:$('editEmployeeCode').value.trim(),
  password:$('editPassword').value,
  roleCode:$('editRoleCode').value,
  supervisorUserId:$('editSupervisorUserId').value
 };

 if(!payload.displayName){
  await showDialogValidation_('ข้อมูลไม่ครบ','กรุณากรอกชื่อผู้ใช้งาน','editDisplayName');return;
 }
 if(!/^[a-z0-9._-]{3,80}$/.test(payload.username)){
  await showDialogValidation_('Username ไม่ถูกต้อง','ใช้ตัวอักษรอังกฤษพิมพ์เล็ก ตัวเลข จุด ขีดกลาง หรือขีดล่าง อย่างน้อย 3 ตัว','editUsername');return;
 }
 if(payload.roleCode==='FIELD_USER'&&!payload.employeeCode){await showDialogValidation_('ข้อมูลไม่ครบ','ผู้ปฏิบัติงานต้องมีรหัสพนักงาน','editEmployeeCode');return}
 if(payload.roleCode==='FIELD_USER'&&!payload.supervisorUserId){await showDialogValidation_('ข้อมูลไม่ครบ','กรุณาเลือกหัวหน้างานผู้ดูแล','editSupervisorUserId');return}
 if(['ADMIN','REVIEWER'].includes(payload.roleCode)&&!id&&!/^(?=.*[A-Za-z])(?=.*\d).{10,}$/.test(payload.password)){
  await showDialogValidation_('รหัสผ่านไม่ถูกต้อง','Admin และหัวหน้างานต้องมีรหัสผ่านอย่างน้อย 10 ตัว และมีทั้งตัวอักษรกับตัวเลข','editPassword');return;
 }

 savingUser=true;saveBtn.disabled=true;saveBtn.textContent='กำลังบันทึก…';
 if(dialog.open)dialog.close();
 try{
  UI.loading(id?'กำลังแก้ไขผู้ใช้งาน…':'กำลังเพิ่มผู้ใช้งาน…');
  const result=await Api.request(id?'/api/admin/users/update':'/api/admin/users/create',{
   method:'POST',body:JSON.stringify(payload)
  });
  UI.close();
  await UI.success('บันทึกสำเร็จ',result.message||'บันทึกข้อมูลผู้ใช้งานเรียบร้อยแล้ว');
  await loadUsers();
 }catch(e){
  UI.close();
  await UI.error('บันทึกไม่สำเร็จ',e.message||'ระบบไม่สามารถบันทึกข้อมูลได้');
  if(!dialog.open)dialog.showModal();
 }finally{
  savingUser=false;saveBtn.disabled=false;saveBtn.textContent='บันทึกผู้ใช้งาน';
 }
}

async function setStatus(u){
 const c=await UI.confirm(
  `${u.isActive?'ปิด':'เปิด'}บัญชี ${u.displayName}?`,
  u.isActive?'Session ที่ใช้งานอยู่จะถูกยกเลิกทันที':'ผู้ใช้จะกลับมาเข้าสู่ระบบได้',
  u.isActive?'ยืนยันปิดบัญชี':'ยืนยันเปิดบัญชี'
 );
 if(!c.isConfirmed)return;
 try{
  UI.loading('กำลังอัปเดตสถานะ…');
  await Api.request('/api/admin/users/status',{method:'POST',body:JSON.stringify({id:u.id,isActive:!u.isActive})});
  UI.close();await UI.success('ดำเนินการสำเร็จ');await loadUsers();
 }catch(e){UI.close();UI.error('ดำเนินการไม่สำเร็จ',e.message)}
}

async function createQr(u){
 const replacing=Number(u.activeQrCount)>0;
 if(replacing){
  const c=await UI.confirm(
   'ออก QR ใหม่ให้ '+u.displayName+'?',
   'QR เดิมจะถูกยกเลิกทันที และผู้ปฏิบัติงานต้องใช้ไฟล์ QR ใหม่',
   'ยืนยันออก QR ใหม่'
  );
  if(!c.isConfirmed)return;
 }
 try{
  UI.loading(replacing?'กำลังออก QR ใหม่…':'กำลังสร้าง QR ประจำตัว…');
  const d=await Api.request('/api/admin/qr/create',{
   method:'POST',body:JSON.stringify({userId:u.id,revokeExisting:true})
  });
  const holder=document.createElement('div');
  new QRCode(holder,{text:d.qrPayload,width:900,height:900,correctLevel:QRCode.CorrectLevel.H});
  await new Promise(r=>setTimeout(r,250));
  const img=holder.querySelector('img'),canvas=holder.querySelector('canvas');
  const href=img?.src||canvas?.toDataURL('image/png');
  const a=document.createElement('a');
  a.download=`RetailInsight_QR_${u.employeeCode||u.username}_${u.displayName}.png`;
  a.href=href;a.click();
  UI.close();
  await UI.success(replacing?'ออก QR ใหม่สำเร็จ':'สร้าง QR สำเร็จ',`QR ประจำตัวแบบถาวร · สร้าง ${d.createdDisplay||''}`);
  await loadUsers();
 }catch(e){UI.close();UI.error('สร้าง QR ไม่สำเร็จ',e.message)}
}

async function revokeQr(u){
 if(!u.activeQrCredentialId)return UI.error('ไม่พบ QR','ผู้ใช้งานนี้ไม่มี QR ที่กำลังใช้งาน');
 const c=await UI.confirm(
  'ยกเลิก QR ของ '+u.displayName+'?',
  'หลังยกเลิก QR นี้จะเข้าสู่ระบบไม่ได้ จนกว่า Admin จะสร้าง QR ใหม่',
  'ยืนยันยกเลิก QR'
 );
 if(!c.isConfirmed)return;
 try{
  UI.loading('กำลังยกเลิก QR…');
  await Api.request('/api/admin/qr/revoke',{method:'POST',body:JSON.stringify({credentialId:u.activeQrCredentialId})});
  UI.close();await UI.success('ยกเลิก QR สำเร็จ');await loadUsers();
 }catch(e){UI.close();UI.error('ยกเลิก QR ไม่สำเร็จ',e.message)}
}

function buildActionMenu(u){
 const items=[
  `<div class="menu-title">${esc(u.displayName)}</div>`,
  `<button data-menu-act="edit">✎ แก้ไขผู้ใช้งาน</button>`
 ];
 if(u.roleCode==='FIELD_USER'){
  items.push(`<button data-menu-act="qr">▣ ${u.activeQrCount?'ออก QR ใหม่':'สร้าง QR ประจำตัว'}</button>`);
  if(u.activeQrCount)items.push(`<button data-menu-act="revokeQr" class="danger">⊘ ยกเลิก QR</button>`);
 }
 items.push('<div class="menu-separator"></div>');
 items.push(`<button data-menu-act="status" class="${u.isActive?'danger':''}">${u.isActive?'○ ปิดบัญชี':'● เปิดบัญชี'}</button>`);
 return items.join('');
}

function positionActionMenu(anchor){
 const menu=$('actionMenu');
 const rect=anchor.getBoundingClientRect();
 const gap=7;
 menu.style.visibility='hidden';
 menu.classList.remove('hidden');
 const mw=menu.offsetWidth,mh=menu.offsetHeight;
 let left=Math.min(window.innerWidth-mw-10,rect.right-mw);
 let top=rect.bottom+gap;
 if(top+mh>window.innerHeight-10)top=Math.max(10,rect.top-mh-gap);
 menu.style.left=`${Math.max(10,left)}px`;
 menu.style.top=`${top}px`;
 menu.style.visibility='visible';
}

function openActionMenu(anchor,id){
 const u=users.find(x=>x.id===id);if(!u)return;
 if(actionUserId===id&&!$('actionMenu').classList.contains('hidden'))return closeActionMenu();
 closeActionMenu();
 actionUserId=id;actionAnchor=anchor;anchor.classList.add('active');
 $('actionMenu').innerHTML=buildActionMenu(u);
 $('actionMenu').setAttribute('aria-hidden','false');
 positionActionMenu(anchor);
}

function closeActionMenu(){
 $('actionMenu')?.classList.add('hidden');
 $('actionMenu')?.setAttribute('aria-hidden','true');
 if(actionAnchor)actionAnchor.classList.remove('active');
 actionUserId=null;actionAnchor=null;
}

function handleListClick(e){
 const b=e.target.closest('button[data-act="menu"]');
 if(!b)return;
 e.stopPropagation();
 openActionMenu(b,b.dataset.id);
}

$('usersBody').addEventListener('click',handleListClick);
$('mobileUsers').addEventListener('click',handleListClick);

$('actionMenu').addEventListener('click',e=>{
 const b=e.target.closest('button[data-menu-act]');if(!b)return;
 const u=users.find(x=>x.id===actionUserId);if(!u)return;
 const act=b.dataset.menuAct;closeActionMenu();
 if(act==='edit')openUser(u);
 if(act==='status')setStatus(u);
 if(act==='qr')createQr(u);
 if(act==='revokeQr')revokeQr(u);
});

$('refreshUsersBtn').onclick=loadUsers;
$('newUserBtn').onclick=()=>openUser();
$('saveUserBtn').onclick=saveUser;
$('cancelUserBtn').onclick=()=>{if(!savingUser)$('userDialog').close()};
$('closeUserDialog').onclick=()=>{if(!savingUser)$('userDialog').close()};
$('editUsername').addEventListener('blur',e=>{e.target.value=e.target.value.trim().toLowerCase()});
$('roleFilter').onchange=loadUsers;
$('statusFilter').onchange=loadUsers;
$('userSearch').onkeydown=e=>{if(e.key==='Enter')loadUsers()};
$('clearSearchBtn').onclick=()=>{$('userSearch').value='';loadUsers()};
$('menuBtn').onclick=()=>$('side').classList.toggle('open');

document.addEventListener('click',e=>{
 if(!e.target.closest('#actionMenu')&&!e.target.closest('.more-btn'))closeActionMenu();
 if(window.innerWidth<=850&&!e.target.closest('#side')&&!e.target.closest('#menuBtn'))$('side').classList.remove('open');
});
window.addEventListener('resize',closeActionMenu);
window.addEventListener('scroll',closeActionMenu,true);
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeActionMenu()});

function toggleSupervisorField(){const isField=$('editRoleCode').value==='FIELD_USER';$('supervisorField').style.display=isField?'':'none';$('editSupervisorUserId').disabled=!isField}
$('editRoleCode').addEventListener('change',toggleSupervisorField);
guard().then(async()=>{await loadSupervisors();await loadUsers();toggleSupervisorField()});
})();

