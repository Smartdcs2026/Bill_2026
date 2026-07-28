(()=>{
const $=id=>document.getElementById(id);
let data=null,openId=null,drafts=new Map();

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statusName=s=>({ASSIGNED:'ยังไม่เริ่ม',DRAFT:'กำลังทำ',SUBMITTED:'ส่งแล้ว',UNDER_REVIEW:'กำลังตรวจ',APPROVED:'อนุมัติแล้ว',NOT_PAYABLE:'ไม่อนุมัติ',PAID:'จ่ายแล้ว',CLOSED:'ปิดงาน'})[s]||s;
const posCodes=a=>{
 const s=a.store||{};
 return Array.isArray(s.posCodes)&&s.posCodes.length?s.posCodes:Array.from({length:Number(s.posCount||1)},(_,i)=>`POS${i+1}`);
};
const draftFor=a=>drafts.get(a.id)||{assignmentId:a.id,state:'LOCAL_DRAFT',pos:{},notes:'',location:null};

function updateSummary(){
 const all=data?.assignments||[];
 $('totalJobs').textContent=all.length;
 $('draftJobs').textContent=all.filter(a=>['ASSIGNED','DRAFT'].includes(a.status)).length;
 $('sentJobs').textContent=all.filter(a=>!['ASSIGNED','DRAFT'].includes(a.status)).length;
 $('draftStatus').textContent=drafts.size?`มีฉบับร่าง ${drafts.size} งาน`:'บันทึกอัตโนมัติ';
}

function render(){
 const all=data?.assignments||[];
 $('jobList').innerHTML=all.map((a,i)=>{
  const d=draftFor(a),expanded=openId===a.id,locked=data.readOnlyStatuses.includes(a.status),s=a.store||{};
  const done=Object.values(d.pos||{}).filter(x=>x.customerCount&&x.billDate&&x.billTime).length;
  const total=posCodes(a).length;
  return `<article class="job ${expanded?'open':''}" data-id="${a.id}">
   <button class="job-head" data-action="toggle" type="button">
    <span class="seq">${i+1}</span>
    <span class="job-main">
      <b>${esc(s.brand||'')} · ${esc(s.storeName||'')}</b>
      <small>${esc(s.storeCode||'')} · ${total} จุดขาย · ${esc(statusName(a.status))}</small>
    </span>
    <span class="progress ${done===total&&total?'done':''}">${done}/${total}</span>
    <span class="chev">${expanded?'▲':'▼'}</span>
   </button>
   ${expanded?detail(a,d,locked):''}
  </article>`;
 }).join('')||'<div class="empty"><b>ยังไม่มีงานในเดือนนี้</b><span>กรุณาเลือกเดือนอื่น หรือติดต่อผู้ดูแลระบบ</span></div>';
 updateSummary();
}

function detail(a,d,locked){
 const s=a.store||{};
 return `<div class="job-detail">
  <div class="store-summary">
   <div><b>${esc(s.storeCode||'')} · ${esc(s.businessType||'-')}</b>
   <small>${esc(s.openTime||'-')}–${esc(s.closeTime||'-')}<br>${esc(s.address||'')}</small></div>
   <button class="mini" data-action="map" type="button">เปิดแผนที่</button>
  </div>

  <div class="section-label"><b>ข้อมูลจากบิล</b><span>กรอกให้ตรงกับบิลทุกจุดขาย</span></div>
  <div class="pos-list">${posCodes(a).map(code=>posRow(d,code,locked)).join('')}</div>

  <label class="note-label">หมายเหตุ
   <textarea data-field="notes" placeholder="ระบุเฉพาะข้อมูลที่จำเป็นต่อการตรวจงาน" ${locked?'disabled':''}>${esc(d.notes||'')}</textarea>
  </label>

  <div class="section-label"><b>รูปภาพประกอบงาน</b><span>เก็บไว้ในโทรศัพท์จนกว่าจะกดส่ง</span></div>
  <div class="evidence-grid">
   <div class="evidence-card">
    <div class="evidence-head"><b>รูปบิล</b><span class="evidence-count" id="receiptCount-${a.id}">0 รูป</span></div>
    <div class="evidence-actions">
     <button class="photo-btn" data-action="receiptCamera" ${locked?'disabled':''}>ถ่ายรูป</button>
     <button class="photo-btn" data-action="receiptGallery" ${locked?'disabled':''}>เลือกรูป</button>
    </div>
   </div>
   <div class="evidence-card">
    <div class="evidence-head"><b>รูปร้าน</b><span class="evidence-count" id="storeCount-${a.id}">0 รูป</span></div>
    <div class="evidence-actions">
     <button class="photo-btn" data-action="storeCamera" ${locked?'disabled':''}>ถ่ายรูป</button>
     <button class="photo-btn" data-action="storeGallery" ${locked?'disabled':''}>เลือกรูป</button>
    </div>
   </div>
  </div>

  <div class="draft-meta">บันทึกล่าสุด ${d.updatedAt?DateTH.formatDateTime(d.updatedAt):'ยังไม่เคยบันทึก'}</div>
  <div class="job-actions">
   <button class="secondary" data-action="save" ${locked?'disabled':''}>บันทึกไว้ก่อน</button>
   <button class="primary" data-action="submit" ${locked?'disabled':''}>ตรวจและส่งงาน</button>
  </div>
  ${locked?'<div class="locked">งานนี้ส่งแล้ว สามารถเปิดดูได้แต่ไม่สามารถแก้ไข เพิ่ม หรือลบข้อมูล</div>':''}

  <input class="hidden-file receiptCamera" type="file" accept="image/*" capture="environment" data-category="RECEIPT">
  <input class="hidden-file receiptGallery" type="file" accept="image/*" multiple data-category="RECEIPT">
  <input class="hidden-file storeCamera" type="file" accept="image/*" capture="environment" data-category="STORE">
  <input class="hidden-file storeGallery" type="file" accept="image/*" multiple data-category="STORE">
 </div>`;
}

function posRow(d,code,locked){
 const v=d.pos?.[code]||{};
 return `<div class="pos-row">
  <b>${esc(code)}</b>
  <label><span>ยอดลูกค้า</span><input data-pos="${esc(code)}" data-key="customerCount" inputmode="numeric" pattern="[0-9]*" placeholder="0" value="${esc(v.customerCount||'')}" ${locked?'disabled':''}></label>
  <label><span>วันที่ในบิล</span><input data-pos="${esc(code)}" data-key="billDate" type="date" value="${esc(v.billDate||'')}" ${locked?'disabled':''}></label>
  <label><span>เวลาในบิล</span><input data-pos="${esc(code)}" data-key="billTime" type="time" step="1" value="${esc(v.billTime||'')}" ${locked?'disabled':''}></label>
 </div>`;
}

function withTimeout(promise,ms,label='การเชื่อมต่อ'){
 let timer;
 return Promise.race([
  Promise.resolve(promise).finally(()=>clearTimeout(timer)),
  new Promise((_,reject)=>{
   timer=setTimeout(()=>reject(new Error(`${label}ใช้เวลานานเกินไป กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่`)),ms);
  })
 ]);
}

function cachedUser(){
 try{
  const raw=localStorage.getItem('csi_user');
  if(!raw)return null;
  const u=JSON.parse(raw);
  return u&&typeof u==='object'?u:null;
 }catch(_){return null}
}

async function hydrate(){
 try{
  const list=await withTimeout(LocalDraftDB.listDrafts(),5000,'การเปิดข้อมูลฉบับร่าง');
  drafts=new Map((list||[]).map(x=>[x.assignmentId,x]));
 }catch(e){
  console.warn('Draft storage unavailable:',e);
  drafts=new Map();
  $('draftStatus').textContent='พร้อมกรอกงาน';
 }
}

function collect(a){
 const root=document.querySelector(`.job[data-id="${a.id}"]`),d=draftFor(a);
 d.pos=d.pos||{};
 root.querySelectorAll('[data-pos]').forEach(el=>{
  const p=el.dataset.pos;
  d.pos[p]=d.pos[p]||{};
  d.pos[p][el.dataset.key]=el.value;
 });
 d.notes=root.querySelector('[data-field="notes"]')?.value||'';
 return d;
}

async function updatePhotoCounts(a){
 const imgs=await LocalDraftDB.listImages(a.id);
 const receipts=imgs.filter(x=>x.category==='RECEIPT').length;
 const stores=imgs.filter(x=>x.category==='STORE').length;
 const r=$(`receiptCount-${a.id}`),s=$(`storeCount-${a.id}`);
 if(r)r.textContent=`${receipts} รูป`;
 if(s)s.textContent=`${stores} รูป`;
}

async function save(a,toast=true){
 const d=collect(a);
 await LocalDraftDB.saveDraft(d);
 drafts.set(a.id,await LocalDraftDB.getDraft(a.id));
 render();
 if(openId===a.id)setTimeout(()=>updatePhotoCounts(a),0);
 if(toast)await UI.success('บันทึกไว้ในโทรศัพท์แล้ว','คุณสามารถกลับมาแก้ไขและส่งภายหลังได้');
}

async function addFiles(a,files,category){
 if(!files.length)return;
 for(const f of files){
  await LocalDraftDB.saveImage({
   id:crypto.randomUUID(),assignmentId:a.id,name:f.name,type:f.type,size:f.size,
   blob:f,category,state:'LOCAL',createdAt:new Date().toISOString()
  });
 }
 await save(a,false);
 await updatePhotoCounts(a);
 await UI.success('เก็บรูปไว้แล้ว',`${category==='RECEIPT'?'รูปบิล':'รูปร้าน'} ${files.length} รูป`);
}

async function submit(a){
 await save(a,false);
 const d=await LocalDraftDB.getDraft(a.id),missing=[];
 for(const p of posCodes(a)){
  const v=d.pos?.[p]||{};
  if(!v.customerCount||!v.billDate||!v.billTime)missing.push(p);
 }
 if(missing.length)return UI.error('ข้อมูลยังไม่ครบ',`กรุณากรอกยอดลูกค้า วันที่ และเวลาให้ครบ: ${missing.join(', ')}`);
 const imgs=await LocalDraftDB.listImages(a.id);
 const receiptCount=imgs.filter(x=>x.category==='RECEIPT').length;
 const storeCount=imgs.filter(x=>x.category==='STORE').length;
 const c=await UI.confirm(
  'ตรวจสอบและส่งงาน?',
  `ข้อมูล ${posCodes(a).length} จุดขาย · รูปบิล ${receiptCount} รูป · รูปร้าน ${storeCount} รูป เมื่อส่งแล้วผู้ปฏิบัติงานจะแก้ไขไม่ได้`,
  'ยืนยันส่งงาน'
 );
 if(!c.isConfirmed)return;
 await UI.info('เตรียมข้อมูลพร้อมส่งแล้ว','ระบบส่งข้อมูลและรูปภาพขึ้น Server แบบต่อจากจุดเดิมจะเชื่อมต่อในรอบถัดไป');
}

$('jobList').addEventListener('click',async e=>{
 const job=e.target.closest('.job');if(!job)return;
 const a=data.assignments.find(x=>x.id===job.dataset.id);
 const act=e.target.closest('[data-action]')?.dataset.action;
 if(!act)return;
 if(act==='toggle'){
  openId=openId===a.id?null:a.id;render();
  if(openId)setTimeout(()=>{document.querySelector(`.job[data-id="${a.id}"]`)?.scrollIntoView({behavior:'smooth',block:'start'});updatePhotoCounts(a)},80);
 }
 if(act==='save')await save(a);
 if(act==='submit')await submit(a);
 if(['receiptCamera','receiptGallery','storeCamera','storeGallery'].includes(act))job.querySelector(`.${act}`).click();
 if(act==='map'){
  const s=a.store||{},q=s.latitude&&s.longitude?`${s.latitude},${s.longitude}`:encodeURIComponent(s.address||s.storeName||'');
  window.open(`https://www.google.com/maps/search/?api=1&query=${q}`,'_blank');
 }
});

$('jobList').addEventListener('change',async e=>{
 const job=e.target.closest('.job');if(!job)return;
 const a=data.assignments.find(x=>x.id===job.dataset.id);
 if(e.target.matches('.hidden-file')){
  await addFiles(a,[...e.target.files],e.target.dataset.category);
  e.target.value='';
 }
});

let autoSaveTimer=0;
$('jobList').addEventListener('input',e=>{
 const job=e.target.closest('.job');if(!job)return;
 const a=data.assignments.find(x=>x.id===job.dataset.id);
 clearTimeout(autoSaveTimer);
 $('draftStatus').textContent='กำลังบันทึก…';
 autoSaveTimer=setTimeout(async()=>{
  try{await save(a,false);$('draftStatus').textContent='บันทึกแล้ว'}catch(_){$('draftStatus').textContent='ยังไม่ได้บันทึก'}
 },700);
});

$('monthSelect').addEventListener('change',()=>load($('monthSelect').value));
$('logoutBtn').onclick=async()=>{
 const c=await UI.confirm('ออกจากระบบ?','ฉบับร่างที่บันทึกไว้ในโทรศัพท์จะยังคงอยู่','ออกจากระบบ');
 if(c.isConfirmed){localStorage.removeItem('csi_session_token');localStorage.removeItem('csi_user');location.href='login.html'}
};
$('draftNavBtn').onclick=()=>{
 const first=[...drafts.keys()][0];
 if(first){openId=first;render();setTimeout(()=>document.querySelector(`.job[data-id="${first}"]`)?.scrollIntoView({behavior:'smooth'}),50)}
 else UI.info('ยังไม่มีฉบับร่าง','เริ่มกรอกข้อมูลร้าน แล้วระบบจะบันทึกไว้ให้อัตโนมัติ');
};
$('topBtn').onclick=()=>scrollTo({top:0,behavior:'smooth'});

let loadingJobs=false;

async function load(month=''){
 if(loadingJobs)return;
 loadingJobs=true;
 UI.loading('กำลังโหลดงาน…');

 try{
  const cached=cachedUser();
  if(cached?.displayName)$('userName').textContent=cached.displayName;

  const assignmentPath='/api/field/assignments'+(month?`?month=${encodeURIComponent(month)}`:'');
  const assignmentPromise=withTimeout(
   Api.request(assignmentPath),
   15000,
   'การโหลดรายการงาน'
  );

  const profilePromise=withTimeout(
   Api.request('/api/field/bootstrap'),
   10000,
   'การตรวจสอบผู้ใช้งาน'
  ).catch(error=>{
   console.warn('Profile fallback:',error);
   return null;
  });

  const [r,boot]=await Promise.all([assignmentPromise,profilePromise]);

  if(!r||!Array.isArray(r.assignments)){
   throw new Error('รูปแบบข้อมูลรายการงานไม่ถูกต้อง กรุณาแจ้งผู้ดูแลระบบ');
  }

  if(boot?.user?.displayName){
   $('userName').textContent=boot.user.displayName;
   localStorage.setItem('csi_user',JSON.stringify(boot.user));
  }else if(cached?.displayName){
   $('userName').textContent=cached.displayName;
  }else{
   $('userName').textContent='ผู้ปฏิบัติงาน';
  }

  data={
   ...r,
   readOnlyStatuses:Array.isArray(r.readOnlyStatuses)
    ?r.readOnlyStatuses
    :['SUBMITTED','UNDER_REVIEW','APPROVED','NOT_PAYABLE','PAID','CLOSED']
  };

  const current=r.currentMonth||r.month||'';
  const previous=r.previousMonth||'';
  const options=[];
  if(current)options.push(`<option value="${esc(current)}">เดือนปัจจุบัน</option>`);
  if(previous&&previous!==current)options.push(`<option value="${esc(previous)}">เดือนก่อนหน้า</option>`);
  $('monthSelect').innerHTML=options.join('');
  if(r.month)$('monthSelect').value=r.month;

  await hydrate();
  render();
 }catch(e){
  console.error('Field load failed:',e);
  data={
   assignments:[],
   readOnlyStatuses:['SUBMITTED','UNDER_REVIEW','APPROVED','NOT_PAYABLE','PAID','CLOSED']
  };
  render();

  const message=e?.message||'ระบบไม่สามารถโหลดรายการงานได้';
  const unauthorized=/401|unauthorized|กรุณาเข้าสู่ระบบ/i.test(message);

  await UI.error(
   unauthorized?'กรุณาเข้าสู่ระบบใหม่':'โหลดงานไม่สำเร็จ',
   unauthorized
    ?'ข้อมูลการเข้าสู่ระบบหมดอายุ กรุณาสแกน QR และกรอกรหัสผ่านอีกครั้ง'
    :`${message}\n\nระบบยกเลิกการรออัตโนมัติแล้ว จึงไม่ค้างหมุนตลอดเวลา`
  );

  if(unauthorized)location.href='login.html';
 }finally{
  UI.close();
  loadingJobs=false;
 }
}

(async()=>{
 try{
  if(navigator.storage?.persist){
   withTimeout(LocalDraftDB.requestPersistence(),3000,'การเตรียมพื้นที่บันทึก')
    .catch(error=>console.warn('Storage persistence skipped:',error));
  }
 }catch(error){
  console.warn('Storage preparation skipped:',error);
 }
 await load();
})();
})();
