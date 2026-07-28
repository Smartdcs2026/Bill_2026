(()=>{
const $=id=>document.getElementById(id);let data=null,openId=null,drafts=new Map();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function statusName(s){return ({ASSIGNED:'ยังไม่เริ่ม',DRAFT:'ฉบับร่าง',SUBMITTED:'ส่งแล้ว',UNDER_REVIEW:'กำลังตรวจ',APPROVED:'อนุมัติแล้ว',NOT_PAYABLE:'ไม่อนุมัติจ่าย',PAID:'จ่ายแล้ว',CLOSED:'ปิดงาน'})[s]||s}
function storeTitle(a){const s=a.store||{};return `${s.brand||''} ${s.storeCode||''} ${s.storeName||''}`.trim()}
function posCodes(a){const s=a.store||{};return Array.isArray(s.posCodes)&&s.posCodes.length?s.posCodes:Array.from({length:Number(s.posCount||1)},(_,i)=>`POS${i+1}`)}
function draftFor(a){return drafts.get(a.id)||{assignmentId:a.id,state:'LOCAL_DRAFT',pos:{},notes:'',location:null}}
function render(){
 $('jobList').innerHTML=data.assignments.map((a,i)=>{
  const d=draftFor(a),expanded=openId===a.id,locked=data.readOnlyStatuses.includes(a.status),s=a.store||{};
  const done=Object.values(d.pos||{}).filter(x=>x.customerCount&&x.billDate&&x.billTime).length,total=posCodes(a).length;
  return `<article class="job ${expanded?'open':''}" data-id="${a.id}">
   <button class="job-head" data-action="toggle">
    <span class="seq">${i+1}</span><span class="job-main"><b>${esc(s.brand||'')} ${esc(s.storeName||'')}</b><small>${esc(s.storeCode||'')} · ${total} POS · ${esc(statusName(a.status))}</small></span>
    <span class="progress">${done}/${total}</span><span class="chev">${expanded?'▲':'▼'}</span>
   </button>
   ${expanded?detail(a,d,locked):''}
  </article>`;
 }).join('')||'<div class="empty">ไม่มีงานในเดือนนี้</div>';
}
function detail(a,d,locked){
 const s=a.store||{};
 return `<div class="job-detail">
  <div class="store-summary"><div><b>${esc(s.businessType||'-')}</b><small>${esc(s.openTime||'-')}–${esc(s.closeTime||'-')}</small></div><button class="mini" data-action="map">แผนที่</button></div>
  <div class="pos-list">${posCodes(a).map(code=>posRow(a,d,code,locked)).join('')}</div>
  <label class="note-label">หมายเหตุ<textarea data-field="notes" ${locked?'disabled':''}>${esc(d.notes||'')}</textarea></label>
  <div class="photo-strip">
   <button class="photo-btn" data-action="camera" ${locked?'disabled':''}>📷 ถ่ายภาพ</button>
   <button class="photo-btn" data-action="gallery" ${locked?'disabled':''}>🖼 เลือกรูป</button>
   <span id="photoCount-${a.id}">รูปในเครื่อง</span>
  </div>
  <div class="draft-meta">บันทึกในเครื่องล่าสุด: ${d.updatedAt?DateTH.formatDateTime(d.updatedAt):'ยังไม่บันทึก'}</div>
  <div class="job-actions">
   <button class="secondary" data-action="save" ${locked?'disabled':''}>บันทึกในเครื่อง</button>
   <button class="primary" data-action="submit" ${locked?'disabled':''}>ตรวจและส่งงาน</button>
  </div>
  ${locked?'<div class="locked">งานนี้ส่งแล้ว ผู้ปฏิบัติงานดูข้อมูลได้เท่านั้น</div>':''}
  <input class="hidden-file camera" type="file" accept="image/*" capture="environment">
  <input class="hidden-file gallery" type="file" accept="image/*" multiple>
 </div>`;
}
function posRow(a,d,code,locked){
 const v=d.pos?.[code]||{};
 return `<div class="pos-row"><b>${esc(code)}</b>
  <label><span>ยอดลูกค้า</span><input data-pos="${esc(code)}" data-key="customerCount" inputmode="numeric" value="${esc(v.customerCount||'')}" ${locked?'disabled':''}></label>
  <label><span>วันที่บิล</span><input data-pos="${esc(code)}" data-key="billDate" type="date" value="${esc(v.billDate||'')}" ${locked?'disabled':''}></label>
  <label><span>เวลา</span><input data-pos="${esc(code)}" data-key="billTime" type="time" step="1" value="${esc(v.billTime||'')}" ${locked?'disabled':''}></label>
 </div>`;
}
async function hydrate(){const list=await LocalDraftDB.listDrafts();drafts=new Map(list.map(x=>[x.assignmentId,x]))}
function collect(a){
 const root=document.querySelector(`.job[data-id="${a.id}"]`),d=draftFor(a);d.pos=d.pos||{};
 root.querySelectorAll('[data-pos]').forEach(el=>{const p=el.dataset.pos;d.pos[p]=d.pos[p]||{};d.pos[p][el.dataset.key]=el.value});
 d.notes=root.querySelector('[data-field="notes"]')?.value||'';return d;
}
async function save(a,toast=true){const d=collect(a);await LocalDraftDB.saveDraft(d);drafts.set(a.id,await LocalDraftDB.getDraft(a.id));render();if(toast)UI.success('บันทึกในเครื่องแล้ว','ข้อมูลยังไม่ได้ส่งเข้าสู่ระบบ')}
async function addFiles(a,files){for(const f of files){await LocalDraftDB.saveImage({id:crypto.randomUUID(),assignmentId:a.id,name:f.name,type:f.type,size:f.size,blob:f,state:'LOCAL',createdAt:new Date().toISOString()})}await save(a,false);UI.success('เก็บรูปในเครื่องแล้ว',`${files.length} รูป`)}
async function submit(a){await save(a,false);const d=await LocalDraftDB.getDraft(a.id),missing=[];for(const p of posCodes(a)){const v=d.pos?.[p]||{};if(!v.customerCount||!v.billDate||!v.billTime)missing.push(p)}
 if(missing.length)return UI.error('ข้อมูลยังไม่ครบ',`กรุณากรอกยอดลูกค้า วันที่ และเวลา: ${missing.join(', ')}`);
 const imgs=await LocalDraftDB.listImages(a.id);const c=await UI.confirm('พร้อมส่งงานหรือไม่?',`ข้อมูล ${posCodes(a).length} POS และรูปในเครื่อง ${imgs.length} รูป ระบบจะอัปโหลดแบบส่งต่อจากจุดเดิมได้`,'เริ่มส่งงาน');
 if(!c.isConfirmed)return;
 await UI.info('โครงส่งงานพร้อมแล้ว','รอบนี้ติดตั้ง Local Draft และการตรวจความครบถ้วนก่อนส่ง ส่วน Upload Session/Resume Server จะต่อในรอบถัดไป');
}
$('jobList').addEventListener('click',async e=>{
 const job=e.target.closest('.job');if(!job)return;const a=data.assignments.find(x=>x.id===job.dataset.id);const act=e.target.closest('[data-action]')?.dataset.action;if(!act)return;
 if(act==='toggle'){openId=openId===a.id?null:a.id;render();if(openId)setTimeout(()=>job.scrollIntoView({behavior:'smooth',block:'start'}),50)}
 if(act==='save')await save(a);
 if(act==='submit')await submit(a);
 if(act==='camera'||act==='gallery'){job.querySelector(`.${act}`).click()}
 if(act==='map'){const s=a.store||{},q=s.latitude&&s.longitude?`${s.latitude},${s.longitude}`:encodeURIComponent(s.address||s.storeName||'');window.open(`https://www.google.com/maps/search/?api=1&query=${q}`,'_blank')}
});
$('jobList').addEventListener('change',async e=>{const job=e.target.closest('.job');if(!job)return;const a=data.assignments.find(x=>x.id===job.dataset.id);if(e.target.matches('.camera,.gallery'))await addFiles(a,[...e.target.files])});
$('monthSelect').addEventListener('change',()=>load($('monthSelect').value));
async function load(month=''){try{UI.loading('กำลังโหลดงาน...');const boot=await Api.request('/api/field/bootstrap');$('appName').textContent=boot.app.name;$('userName').textContent=boot.user.displayName;const r=await Api.request('/api/field/assignments'+(month?`?month=${month}`:''));data=r;$('monthSelect').innerHTML=`<option value="${r.currentMonth}">${r.currentMonth} เดือนปัจจุบัน</option><option value="${r.previousMonth}">${r.previousMonth} เดือนก่อนหน้า</option>`;$('monthSelect').value=r.month;await hydrate();render();UI.close();const st=await LocalDraftDB.storageStatus();$('storageInfo').textContent=`ฉบับร่างในเครื่อง ${drafts.size} งาน · ${Math.round(st.usage/1048576)} MB`;}catch(e){UI.close();UI.error('โหลดงานไม่สำเร็จ',e.message)}}
(async()=>{if(navigator.storage?.persist){const ok=await LocalDraftDB.requestPersistence();$('persistentState').textContent=ok?'พื้นที่ฉบับร่างได้รับการป้องกัน':'โปรดอย่าล้างข้อมูลเว็บไซต์ก่อนส่งงาน'}await load()})();
})();