(()=>{
const $=id=>document.getElementById(id);
let users=[];
const token=()=>$('adminTokenUsers').value.trim();
const headers=()=>({'X-Admin-Bootstrap-Token':token()});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function roleName(v){return ({FIELD_USER:'ผู้ปฏิบัติงาน',REVIEWER:'หัวหน้างาน',ADMIN:'Admin',FINANCE:'การเงิน',EXECUTIVE:'ผู้บริหาร'})[v]||v}
async function loadUsers(){
 try{
  $('usersStatus').textContent='กำลังโหลด...';
  const p=new URLSearchParams({q:$('userSearch').value.trim(),role:$('roleFilter').value,status:$('statusFilter').value,limit:'500'});
  const d=await Api.request('/api/admin/users?'+p.toString(),{headers:headers()});
  users=d.users||[];render();$('usersStatus').textContent=`พบ ${users.length} คน`;
 }catch(e){$('usersStatus').textContent=e.message}
}
function render(){
 $('usersBody').innerHTML=users.map(u=>`<tr>
 <td>${esc(u.displayName)}</td><td>${esc(u.username)}</td><td>${esc(u.employeeCode||'-')}</td>
 <td><span class="badge">${esc(roleName(u.roleCode))}</span></td>
 <td><span class="badge ${u.isActive?'':'off'}">${u.isActive?'ใช้งาน':'ปิดใช้งาน'}</span></td>
 <td>${u.activeQrCount||0}</td>
 <td><div class="actions-row">
 <button class="btn btn-secondary compact" data-act="edit" data-id="${u.id}">แก้ไข</button>
 <button class="btn ${u.isActive?'btn-danger':'btn-primary'} compact" data-act="status" data-id="${u.id}">${u.isActive?'ปิด':'เปิด'}</button>
 ${u.roleCode==='FIELD_USER'?`<button class="btn btn-primary compact" data-act="qr" data-id="${u.id}">สร้าง QR</button>`:''}
 </div></td></tr>`).join('')||'<tr><td colspan="7">ยังไม่มีข้อมูล</td></tr>';
}
function openUser(u=null){
 $('editUserId').value=u?.id||'';$('editDisplayName').value=u?.displayName||'';$('editUsername').value=u?.username||'';
 $('editEmployeeCode').value=u?.employeeCode||'';$('editRoleCode').value=u?.roleCode||'FIELD_USER';
 $('userDialogTitle').textContent=u?'แก้ไขผู้ใช้งาน':'เพิ่มผู้ใช้งาน';$('userDialog').showModal();
}
async function saveUser(){
 try{
  const id=$('editUserId').value,payload={id,displayName:$('editDisplayName').value,username:$('editUsername').value,employeeCode:$('editEmployeeCode').value,roleCode:$('editRoleCode').value};
  await Api.request(id?'/api/admin/users/update':'/api/admin/users/create',{method:'POST',headers:headers(),body:JSON.stringify(payload)});
  $('userDialog').close();await loadUsers();
 }catch(e){alert(e.message)}
}
async function setStatus(u){
 if(!confirm(`${u.isActive?'ปิด':'เปิด'}ใช้งาน ${u.displayName} ใช่หรือไม่`))return;
 try{await Api.request('/api/admin/users/status',{method:'POST',headers:headers(),body:JSON.stringify({id:u.id,isActive:!u.isActive})});await loadUsers()}catch(e){alert(e.message)}
}
async function createQr(u){
 try{
  const d=await Api.request('/api/admin/qr/create',{method:'POST',headers:headers(),body:JSON.stringify({userId:u.id,expiresDays:30,revokeExisting:true})});
  const canvas=document.createElement('canvas');await QRCode.toCanvas(canvas,d.qrPayload,{width:700,margin:3});
  const a=document.createElement('a');a.download=`QR_${u.employeeCode||u.username}_${u.displayName}.png`;a.href=canvas.toDataURL('image/png');a.click();
  alert(`สร้าง QR ให้ ${u.displayName} เรียบร้อยแล้ว\nหมดอายุ: ${d.expiresAt}`);
  await loadUsers();
 }catch(e){alert(e.message)}
}
$('usersBody').addEventListener('click',e=>{const b=e.target.closest('button[data-act]');if(!b)return;const u=users.find(x=>x.id===b.dataset.id);if(!u)return;if(b.dataset.act==='edit')openUser(u);if(b.dataset.act==='status')setStatus(u);if(b.dataset.act==='qr')createQr(u)});
$('refreshUsersBtn').addEventListener('click',loadUsers);$('newUserBtn').addEventListener('click',()=>openUser());
$('saveUserBtn').addEventListener('click',saveUser);$('closeUserDialog').addEventListener('click',()=>$('userDialog').close());
$('userSearch').addEventListener('keydown',e=>{if(e.key==='Enter')loadUsers()});$('roleFilter').addEventListener('change',loadUsers);$('statusFilter').addEventListener('change',loadUsers);
})();