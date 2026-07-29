(()=>{'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data={supervisors:[],workers:[]};
let selected=new Set();
let supervisorFilter='ALL';

async function guard(){
 const me=await Api.verifySession({force:true});
 const role=me?.user?.role_code||me?.user?.roleCode;
 if(role!=='ADMIN')throw new Error('หน้านี้ใช้ได้เฉพาะผู้ดูแลระบบ');
 $('adminName').textContent=me.user.display_name||me.user.displayName||'Admin';
}
function displayDate(v){if(!v)return '-';try{return new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Bangkok'}).format(new Date(v))}catch{return v}}
function initials(name){return String(name||'?').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'?'}
function supervisorName(id){return data.supervisors.find(x=>x.id===id)?.display_name||'ยังไม่มีหัวหน้า'}
function searchable(w){return `${w.display_name||''} ${w.employee_code||''} ${w.username||''} ${supervisorName(w.supervisor_user_id)}`.toLowerCase()}
function visibleWorkers(){
 const q=$('workerSearch').value.trim().toLowerCase();
 const status=$('statusFilter').value;
 return data.workers.filter(w=>{
  if(supervisorFilter==='UNASSIGNED'&&w.supervisor_user_id)return false;
  if(!['ALL','UNASSIGNED'].includes(supervisorFilter)&&w.supervisor_user_id!==supervisorFilter)return false;
  if(status==='ACTIVE'&&!Number(w.is_active))return false;
  if(status==='INACTIVE'&&Number(w.is_active))return false;
  if(status==='UNASSIGNED'&&w.supervisor_user_id)return false;
  if(status==='NO_CODE'&&w.employee_code)return false;
  return !q||searchable(w).includes(q);
 });
}
function renderSummary(){
 $('summarySupervisors').textContent=data.supervisors.length;
 $('summaryWorkers').textContent=data.workers.length;
 $('summaryUnassigned').textContent=data.workers.filter(w=>!w.supervisor_user_id).length;
 $('summaryInactive').textContent=data.workers.filter(w=>!Number(w.is_active)).length;
}
function renderSupervisorChips(){
 const chips=[
  {id:'ALL',name:'ทั้งหมด',count:data.workers.length},
  ...data.supervisors.map(s=>({id:s.id,name:s.display_name,count:data.workers.filter(w=>w.supervisor_user_id===s.id).length})),
  {id:'UNASSIGNED',name:'ยังไม่มีหัวหน้า',count:data.workers.filter(w=>!w.supervisor_user_id).length}
 ];
 $('supervisorChips').innerHTML=chips.map(x=>`<button class="supervisor-chip ${supervisorFilter===x.id?'active':''}" data-supervisor="${esc(x.id)}"><span>${esc(x.name)}</span><b>${x.count}</b></button>`).join('');
}
function renderSelection(){
 const n=selected.size;
 $('selectedCount').textContent=`เลือกแล้ว ${n} คน`;
 $('selectionHint').textContent=n?'พร้อมย้ายหัวหน้างานหรือแก้ไขข้อมูล':'เลือกผู้ปฏิบัติงานเพื่อจัดการหลายคนพร้อมกัน';
 $('moveBtn').disabled=!n;
 $('bulkSection').classList.toggle('has-selection',n>0);
}
function workerCard(w){
 const active=Number(w.is_active)===1;
 const noCode=!String(w.employee_code||'').trim();
 const canSelect=active&&!noCode;
 return `<article class="worker-directory-card ${selected.has(w.id)?'selected':''} ${!active?'inactive':''} ${noCode?'missing-code':''}" data-worker-card="${esc(w.id)}">
  <label class="worker-card-select" title="เลือกผู้ปฏิบัติงาน"><input type="checkbox" data-worker-id="${esc(w.id)}" ${selected.has(w.id)?'checked':''} ${canSelect?'':'disabled'}><span></span></label>
  <div class="worker-avatar">${esc(initials(w.display_name))}</div>
  <div class="worker-main">
   <div class="worker-name-line"><b>${esc(w.display_name||'-')}</b><span class="worker-status ${active?'active':'inactive'}">${active?'เปิดใช้งาน':'ปิดใช้งาน'}</span></div>
   <div class="worker-code-line"><strong>${esc(w.employee_code||'ไม่มีรหัสพนักงาน')}</strong><span>Username: ${esc(w.username||'-')}</span></div>
  </div>
  <div class="worker-meta"><span>หัวหน้างาน</span><b>${esc(supervisorName(w.supervisor_user_id))}</b></div>
  <div class="worker-readiness"><span>${noCode?'ข้อมูลไม่ครบ':w.supervisor_user_id?'พร้อมสร้างเท็มเพลต':'ยังไม่มีหัวหน้า'}</span></div>
  <a class="worker-edit-link" href="admin-users.html?q=${encodeURIComponent(w.employee_code||w.username||'')}" aria-label="แก้ไขข้อมูล ${esc(w.display_name)}">แก้ไข</a>
 </article>`;
}
function renderDirectory(){
 const rows=visibleWorkers();
 $('directoryCount').textContent=`${rows.length} รายการ`;
 $('workerDirectory').innerHTML=rows.length?rows.map(workerCard).join(''):'<div class="team-empty-state"><b>ไม่พบผู้ปฏิบัติงาน</b><span>ลองเปลี่ยนตัวกรองหรือคำค้นหา</span></div>';
 renderSelection();
}
function renderTargets(){
 $('targetSupervisor').innerHTML='<option value="">เลือกหัวหน้างาน</option>'+data.supervisors.filter(x=>Number(x.is_active)!==0).map(x=>`<option value="${esc(x.id)}">${esc(x.display_name)} — ${esc(x.employee_code||'-')}</option>`).join('');
}
function renderHistory(history){
 $('historyTimeline').innerHTML=history.length?history.map(h=>`<article class="team-history-item">
  <div class="history-date"><b>${esc(displayDate(h.changed_at))}</b><span>มีผล ${esc(h.effective_from||'-')}</span></div>
  <div class="history-flow"><strong>${esc(h.worker_name||'-')}</strong><span>${esc(h.from_name||'ยังไม่มีหัวหน้า')}</span><i>ไปยัง</i><span>${esc(h.to_name||'-')}</span></div>
  <div class="history-reason"><span>เหตุผล</span><b>${esc(h.reason||'-')}</b><small>ดำเนินการโดย ${esc(h.changed_by_name||'-')}</small></div>
 </article>`).join(''):'<div class="team-empty-state"><b>ยังไม่มีประวัติ</b><span>เมื่อมีการย้ายหัวหน้างาน รายการจะแสดงที่นี่</span></div>';
}
async function loadHistory(){const d=await Api.request('/api/admin/team/history');renderHistory(d.history||[])}
async function load(){
 data=await Api.request('/api/admin/team/overview');
 renderSummary();renderSupervisorChips();renderTargets();renderDirectory();await loadHistory();
 $('teamStatus').textContent=`พร้อมใช้งาน · หัวหน้า ${data.supervisors.length} คน · ผู้ปฏิบัติงาน ${data.workers.length} คน`;
}
async function move(){
 const ids=[...selected],toSupervisorUserId=$('targetSupervisor').value,reason=$('moveReason').value.trim(),effectiveFrom=$('effectiveFrom').value;
 if(!ids.length||!toSupervisorUserId||!reason)return UI.error('ข้อมูลไม่ครบ','เลือกผู้ปฏิบัติงาน หัวหน้างานใหม่ และระบุเหตุผล');
 const target=data.supervisors.find(x=>x.id===toSupervisorUserId);
 const ok=await UI.confirm('ยืนยันการเปลี่ยนหัวหน้างาน',`ย้ายผู้ปฏิบัติงาน ${ids.length} คน ไปยัง ${target?.display_name||'หัวหน้างานที่เลือก'}`,'ยืนยัน');
 if(!ok.isConfirmed)return;
 UI.loading('กำลังบันทึกการเปลี่ยนหัวหน้างาน…');
 try{
  const r=await Api.request('/api/admin/team/move',{method:'POST',body:JSON.stringify({workerUserIds:ids,toSupervisorUserId,reason,effectiveFrom})});
  UI.close();selected.clear();$('moveReason').value='';await UI.success('บันทึกสำเร็จ',r.message);await load();
 }catch(e){UI.close();UI.error('บันทึกไม่สำเร็จ',e.message)}
}
$('menuBtn').onclick=()=>$('side').classList.toggle('open');
$('workerSearch').oninput=renderDirectory;
$('statusFilter').onchange=renderDirectory;
$('supervisorChips').onclick=e=>{const b=e.target.closest('[data-supervisor]');if(!b)return;supervisorFilter=b.dataset.supervisor;selected.clear();renderSupervisorChips();renderDirectory()};
$('workerDirectory').onchange=e=>{const id=e.target?.dataset?.workerId;if(!id)return;e.target.checked?selected.add(id):selected.delete(id);renderDirectory()};
$('selectVisible').onclick=()=>{visibleWorkers().filter(w=>Number(w.is_active)===1&&w.employee_code).forEach(w=>selected.add(w.id));renderDirectory()};
$('clearAll').onclick=()=>{selected.clear();renderDirectory()};
$('moveBtn').onclick=move;
document.querySelectorAll('[data-summary-filter]').forEach(b=>b.onclick=()=>{const f=b.dataset.summaryFilter;supervisorFilter=f==='UNASSIGNED'?'UNASSIGNED':'ALL';$('statusFilter').value=f==='INACTIVE'?'INACTIVE':'ALL';selected.clear();renderSupervisorChips();renderDirectory();document.querySelector('.team-directory-section')?.scrollIntoView({behavior:'smooth',block:'start'})});
(async()=>{try{await guard();$('effectiveFrom').value=new Date().toISOString().slice(0,10);await load()}catch(e){$('teamStatus').textContent=e.message;UI.error('เปิดหน้าไม่สำเร็จ',e.message)}})();
})();
