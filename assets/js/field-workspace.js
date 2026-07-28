(()=>{const $=id=>document.getElementById(id);let data={assignments:[],readOnlyStatuses:[]},all=[],shown=[],drafts=new Map(),openId=null,selectedDate='',cursor=new Date(),loading=false,timer=0;const ro=['SUBMITTED','UNDER_REVIEW','APPROVED','NOT_PAYABLE','PAID','CLOSED'];const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const timeout=(p,ms,label)=>Promise.race([Promise.resolve(p),new Promise((_,r)=>setTimeout(()=>r(new Error(`${label}ใช้เวลานานเกินไป`)),ms))]);const dateOf=a=>String(a.workDate||a.work_date||a.date||a.store?.workDate||'').slice(0,10);const dateLabel=v=>{if(!v)return'ทุกวันที่มีงาน';const[y,m,d]=v.split('-').map(Number);return new Intl.DateTimeFormat('th-TH',{weekday:'short',day:'numeric',month:'short',year:'numeric'}).format(new Date(y,m-1,d))};const monthLabel=d=>new Intl.DateTimeFormat('th-TH',{month:'long',year:'numeric'}).format(d);const brand=a=>(String(a.store?.brand||a.brand||'RI').match(/[A-Za-z0-9]+/)?.[0]||'RI').toUpperCase().slice(0,3);const posCodes=a=>Array.isArray(a.store?.posCodes)&&a.store.posCodes.length?a.store.posCodes:Array.from({length:Math.max(1,Number(a.store?.posCount||a.store?.pos||1))},(_,i)=>`POS${i+1}`);const draft=a=>drafts.get(a.id)||{assignmentId:a.id,pos:{},notes:''};const isRO=a=>(data.readOnlyStatuses||ro).includes(a.status);const status=s=>({ASSIGNED:'ยังไม่เริ่ม',DRAFT:'กำลังทำ',SUBMITTED:'ส่งแล้ว',UNDER_REVIEW:'กำลังตรวจ',APPROVED:'อนุมัติแล้ว',NOT_PAYABLE:'ไม่อนุมัติ',PAID:'จ่ายแล้ว',CLOSED:'ปิดงาน'})[s]||s||'ยังไม่เริ่ม';

async function hydrate(){try{const x=await timeout(LocalDraftDB.listDrafts(),5000,'การเปิดข้อมูล');drafts=new Map((x||[]).map(v=>[v.assignmentId,v]))}catch(e){console.warn(e);drafts=new Map()}}
function apply(){shown=selectedDate?all.filter(a=>dateOf(a)===selectedDate):all.slice();$('selectedDateLabel').textContent=dateLabel(selectedDate);$('listTitle').textContent=selectedDate?'ร้านที่ต้องทำวันนี้':'รายการร้าน';$('listSubtitle').textContent=selectedDate?`${shown.length} ร้านในวันที่เลือก`:'แตะร้านเพื่อเปิดกรอกข้อมูล';render();summary()}
function summary(){$('totalJobs').textContent=shown.length;$('draftJobs').textContent=shown.filter(a=>!isRO(a)&&(drafts.has(a.id)||['ASSIGNED','DRAFT'].includes(a.status))).length;$('sentJobs').textContent=shown.filter(isRO).length;$('draftStatus').textContent=drafts.size?`บันทึกไว้ ${drafts.size} งาน`:'บันทึกอัตโนมัติ';const dates=new Set(all.map(dateOf).filter(Boolean));$('calendarBadge').textContent=dates.size;$('calendarBadge').classList.toggle('hidden',!dates.size)}
function render(){$('jobList').innerHTML=shown.length?shown.map((a,i)=>card(a,i)).join(''):`<div class="empty"><b>${selectedDate?'ไม่มีงานในวันที่เลือก':'ยังไม่มีงานในเดือนนี้'}</b><span>${selectedDate?'เลือกวันที่อื่นจากปฏิทิน':'ติดต่อผู้ดูแลระบบหากควรมีงาน'}</span></div>`}
function card(a,i){const s=a.store||{},d=draft(a),expanded=openId===a.id,readonly=isRO(a),total=posCodes(a).length,done=posCodes(a).filter(p=>{const v=d.pos?.[p]||{};return v.customerCount&&v.billDate&&v.billTime}).length,cls=readonly?'sent':drafts.has(a.id)?'draft':'',txt=readonly?status(a.status):d.state==='READY_TO_SUBMIT'?'พร้อมส่ง':drafts.has(a.id)?'บันทึกไว้':'ยังไม่เริ่ม';return `<article class="store ${expanded?'open':''}" data-id="${esc(a.id)}"><button class="store-row" data-action="toggle"><span class="brand">${esc(brand(a))}</span><span class="store-info"><b>${i+1}. ${esc(s.storeName||'ไม่ระบุชื่อร้าน')}</b><small>${esc(s.storeCode||'-')} · ${total} POS${dateOf(a)?` · ${esc(dateLabel(dateOf(a)))}`:''}</small></span><span class="status ${cls}">${esc(txt)}${done?` · ${done}/${total}`:''}</span><span class="chev">${expanded?'▲':'▼'}</span></button>${expanded?panel(a,d,readonly):''}</article>`}
function panel(a,d,readonly){const s=a.store||{};return `<div class="panel"><div class="quick"><span><b>${esc(s.businessType||'-')} · ${esc(s.openTime||'-')}–${esc(s.closeTime||'-')}</b><small>${esc(s.address||'ไม่ระบุที่อยู่')}</small></span><button class="map" data-action="map">แผนที่</button></div><div class="sub"><b>ข้อมูลจากบิล</b><span>ยอดลูกค้า · วันที่ · เวลา</span></div><div class="pos-list">${posCodes(a).map(p=>posLine(d,p,readonly)).join('')}</div><label class="note">หมายเหตุ<textarea data-field="notes" ${readonly?'disabled':''}>${esc(d.notes||'')}</textarea></label><div class="sub"><b>รูปภาพประกอบ</b><span>เก็บในโทรศัพท์จนกว่าจะส่ง</span></div><div class="photos">${photoGroup(a,'RECEIPT','รูปบิล','receipt',readonly)}${photoGroup(a,'STORE','รูปร้าน','store',readonly)}</div><div class="actions"><button class="save" data-action="save" ${readonly?'disabled':''}>บันทึกไว้ก่อน</button><button class="submit" data-action="submit" ${readonly?'disabled':''}>ตรวจและส่งงาน</button></div>${readonly?'<div class="readonly">งานนี้ส่งแล้ว เปิดดูได้แต่แก้ไข เพิ่ม หรือลบข้อมูลไม่ได้</div>':''}</div>`}
function posLine(d,p,readonly){const v=d.pos?.[p]||{};return `<div class="pos"><strong>${esc(p)}</strong><label><span>ยอดลูกค้า</span><input data-pos="${esc(p)}" data-key="customerCount" inputmode="numeric" value="${esc(v.customerCount||'')}" ${readonly?'disabled':''}></label><label><span>วันที่ในบิล</span><input data-pos="${esc(p)}" data-key="billDate" type="date" value="${esc(v.billDate||'')}" ${readonly?'disabled':''}></label><label><span>เวลาในบิล</span><input data-pos="${esc(p)}" data-key="billTime" type="time" step="1" value="${esc(v.billTime||'')}" ${readonly?'disabled':''}></label></div>`}
function requiredCount(a,cat){
 const s=a.store||{};
 if(cat==='RECEIPT')return Math.max(1,Number(s.receiptMin||a.receiptMin||1));
 return Math.max(1,Number(s.storeMin||a.storeMin||5));
}
function photoGroup(a,cat,title,key,readonly){
 const min=requiredCount(a,cat);
 return `<div class="photo">
  <div class="photo-head">
   <span><b>${title}</b><small>อย่างน้อย ${min} รูป</small></span>
   <span id="${key}Count-${esc(a.id)}">0/${min} รูป</span>
  </div>
  <div id="${key}Preview-${esc(a.id)}" class="photo-preview"></div>
  <div class="photo-actions">
   <button data-action="${key}Camera" ${readonly?'disabled':''}>ถ่ายรูป</button>
   <button data-action="${key}Gallery" ${readonly?'disabled':''}>เลือกรูป</button>
  </div>
  <input class="hidden-file ${key}Camera" type="file" accept="image/*" capture="environment" data-category="${cat}">
  <input class="hidden-file ${key}Gallery" type="file" accept="image/*" multiple data-category="${cat}">
 </div>`;
}
function collect(a){const root=document.querySelector(`.store[data-id="${CSS.escape(String(a.id))}"]`),d=draft(a);d.pos=d.pos||{};root?.querySelectorAll('[data-pos]').forEach(el=>{const p=el.dataset.pos;d.pos[p]=d.pos[p]||{};d.pos[p][el.dataset.key]=el.value});d.notes=root?.querySelector('[data-field="notes"]')?.value||'';return d}
async function save(a,notify=true){const d=collect(a);await LocalDraftDB.saveDraft(d);drafts.set(a.id,await LocalDraftDB.getDraft(a.id)||d);render();summary();if(openId===a.id)setTimeout(()=>photoCounts(a),20);if(notify)await UI.success('บันทึกไว้แล้ว','กลับมาแก้ไขต่อได้')}
function imageThumb(img,readonly){
 const url=URL.createObjectURL(img.blob);
 return `<figure class="evidence-thumb" data-image-id="${esc(img.id)}">
  <img src="${url}" alt="${esc(img.category==='RECEIPT'?'รูปบิล':'รูปร้าน')}">
  ${readonly?'':`<button type="button" data-action="deleteImage" data-image-id="${esc(img.id)}" aria-label="ลบรูป">×</button>`}
 </figure>`;
}
async function photoCounts(a){
 const imgs=await LocalDraftDB.listImages(a.id);
 const receipt=imgs.filter(x=>x.category==='RECEIPT');
 const store=imgs.filter(x=>x.category==='STORE');
 const readonly=isRO(a);
 const receiptMin=requiredCount(a,'RECEIPT');
 const storeMin=requiredCount(a,'STORE');

 const rc=$(`receiptCount-${a.id}`);
 const sc=$(`storeCount-${a.id}`);
 if(rc){
  rc.textContent=`${receipt.length}/${receiptMin} รูป`;
  rc.classList.toggle('complete',receipt.length>=receiptMin);
 }
 if(sc){
  sc.textContent=`${store.length}/${storeMin} รูป`;
  sc.classList.toggle('complete',store.length>=storeMin);
 }

 const rp=$(`receiptPreview-${a.id}`);
 const sp=$(`storePreview-${a.id}`);
 if(rp)rp.innerHTML=receipt.length?receipt.map(x=>imageThumb(x,readonly)).join(''):'<span class="photo-empty">ยังไม่มีรูป</span>';
 if(sp)sp.innerHTML=store.length?store.map(x=>imageThumb(x,readonly)).join(''):'<span class="photo-empty">ยังไม่มีรูป</span>';
}
async function addFiles(a,files,cat){for(const f of files)await LocalDraftDB.saveImage({id:crypto.randomUUID(),assignmentId:a.id,name:f.name,type:f.type,size:f.size,blob:f,category:cat,state:'LOCAL',createdAt:new Date().toISOString()});await save(a,false);await photoCounts(a);await UI.success('เพิ่มรูปแล้ว',`${files.length} รูป`)}
function customerNumberValid(value){
 return /^\d+$/.test(String(value||''))&&Number(value)>=0;
}
async function validateBeforeSubmit(a){
 const d=await LocalDraftDB.getDraft(a.id);
 const missing=[];
 const invalid=[];
 for(const p of posCodes(a)){
  const v=d?.pos?.[p]||{};
  if(!v.customerCount||!v.billDate||!v.billTime)missing.push(p);
  else if(!customerNumberValid(v.customerCount))invalid.push(p);
 }
 const imgs=await LocalDraftDB.listImages(a.id);
 const receiptCount=imgs.filter(x=>x.category==='RECEIPT').length;
 const storeCount=imgs.filter(x=>x.category==='STORE').length;
 const receiptMin=requiredCount(a,'RECEIPT');
 const storeMin=requiredCount(a,'STORE');
 return {d,missing,invalid,receiptCount,storeCount,receiptMin,storeMin};
}
async function submit(a){
 await save(a,false);
 const check=await validateBeforeSubmit(a);

 if(check.missing.length){
  return UI.error('ข้อมูลยังไม่ครบ',`กรอกยอดลูกค้า วันที่ และเวลาให้ครบ: ${check.missing.join(', ')}`);
 }
 if(check.invalid.length){
  return UI.error('ยอดลูกค้าไม่ถูกต้อง',`ยอดลูกค้าต้องเป็นตัวเลขจำนวนเต็ม: ${check.invalid.join(', ')}`);
 }
 if(check.receiptCount<check.receiptMin||check.storeCount<check.storeMin){
  const need=[];
  if(check.receiptCount<check.receiptMin)need.push(`รูปบิล ${check.receiptCount}/${check.receiptMin}`);
  if(check.storeCount<check.storeMin)need.push(`รูปร้าน ${check.storeCount}/${check.storeMin}`);
  return UI.error('รูปภาพยังไม่ครบ',`กรุณาเพิ่ม ${need.join(' และ ')}`);
 }

 const c=await UI.confirm(
  'ยืนยันความพร้อมของงาน?',
  `ข้อมูลครบ ${posCodes(a).length} POS · รูปบิล ${check.receiptCount} รูป · รูปร้าน ${check.storeCount} รูป หลังส่งแล้วผู้ปฏิบัติงานจะแก้ไขไม่ได้`,
  'ยืนยันพร้อมส่ง'
 );
 if(c.isConfirmed){
  const d={...check.d,state:'READY_TO_SUBMIT',validatedAt:new Date().toISOString()};
  await LocalDraftDB.saveDraft(d);
  drafts.set(a.id,d);
  render();
  summary();
  if(openId===a.id)setTimeout(()=>photoCounts(a),20);
  await UI.success('ตรวจสอบครบแล้ว','งานถูกเก็บเป็นสถานะพร้อมส่งในโทรศัพท์ ขั้นตอนอัปโหลดขึ้นระบบจะเชื่อมต่อในรอบถัดไป');
 }
}

$('jobList').onclick=async e=>{const c=e.target.closest('.store');if(!c)return;const a=all.find(x=>String(x.id)===c.dataset.id),act=e.target.closest('[data-action]')?.dataset.action;if(!a||!act)return;if(act==='toggle'){openId=openId===a.id?null:a.id;render();if(openId)setTimeout(()=>{document.querySelector(`.store[data-id="${CSS.escape(String(a.id))}"]`)?.scrollIntoView({behavior:'smooth',block:'start'});photoCounts(a)},50)}if(act==='map'){const s=a.store||{},q=s.latitude&&s.longitude?`${s.latitude},${s.longitude}`:encodeURIComponent(s.address||s.storeName||'');open(`https://www.google.com/maps/search/?api=1&query=${q}`,'_blank')}if(act==='save')await save(a);if(act==='submit')await submit(a);if(act==='deleteImage'){const id=e.target.closest('[data-image-id]')?.dataset.imageId;if(id){const confirm=await UI.confirm('ลบรูปนี้?','รูปจะถูกลบออกจากโทรศัพท์','ลบรูป');if(confirm.isConfirmed){await LocalDraftDB.deleteImage(id);await photoCounts(a);await UI.success('ลบรูปแล้ว','')}}}if(['receiptCamera','receiptGallery','storeCamera','storeGallery'].includes(act))c.querySelector(`.${act}`)?.click()}
$('jobList').onchange=async e=>{const c=e.target.closest('.store');if(!c||!e.target.matches('.hidden-file'))return;const a=all.find(x=>String(x.id)===c.dataset.id);await addFiles(a,[...e.target.files],e.target.dataset.category);e.target.value=''}
$('jobList').oninput=e=>{const c=e.target.closest('.store');if(!c)return;const a=all.find(x=>String(x.id)===c.dataset.id);clearTimeout(timer);$('draftStatus').textContent='กำลังบันทึก…';timer=setTimeout(async()=>{try{await save(a,false);$('draftStatus').textContent='บันทึกแล้ว'}catch{$('draftStatus').textContent='กดบันทึกไว้ก่อน'}},650)}

function counts(){const m=new Map();all.forEach(a=>{const d=dateOf(a);if(d)m.set(d,(m.get(d)||0)+1)});return m}
function renderCalendar(){const y=cursor.getFullYear(),m=cursor.getMonth(),first=new Date(y,m,1),start=first.getDay(),last=new Date(y,m+1,0).getDate(),prev=new Date(y,m,0).getDate(),map=counts(),cells=[];$('calendarMonthLabel').textContent=monthLabel(cursor);for(let i=0;i<42;i++){let d,mm=m,yy=y,out=false;if(i<start){d=prev-start+i+1;mm=m-1;out=true}else if(i>=start+last){d=i-start-last+1;mm=m+1;out=true}else d=i-start+1;const dt=new Date(yy,mm,d),key=`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`,n=map.get(key)||0;cells.push(`<button class="day ${out?'out':''} ${n?'work':''} ${selectedDate===key?'selected':''}" data-date="${key}"><strong>${d}</strong>${n?`<i class="dot"></i><em>${n} ร้าน</em>`:''}</button>`)}$('calendarGrid').innerHTML=cells.join('')}
function openSheet(id){$(id).classList.remove('hidden');document.body.style.overflow='hidden'}function closeSheet(id){$(id).classList.add('hidden');document.body.style.overflow=''}
$('calendarBtn').onclick=$('dateFilterBtn').onclick=()=>{const d=selectedDate||all.map(dateOf).find(Boolean);if(d){const[y,m]=d.split('-').map(Number);cursor=new Date(y,m-1,1)}renderCalendar();openSheet('calendarSheet')};$('closeCalendarBtn').onclick=()=>closeSheet('calendarSheet');$('prevMonthBtn').onclick=()=>{cursor=new Date(cursor.getFullYear(),cursor.getMonth()-1,1);renderCalendar()};$('nextMonthBtn').onclick=()=>{cursor=new Date(cursor.getFullYear(),cursor.getMonth()+1,1);renderCalendar()};$('showAllDatesBtn').onclick=()=>{selectedDate='';closeSheet('calendarSheet');apply()};$('calendarGrid').onclick=e=>{const b=e.target.closest('[data-date]');if(!b)return;selectedDate=b.dataset.date;closeSheet('calendarSheet');apply()};$('menuBtn').onclick=()=>openSheet('menuSheet');$('refreshBtn').onclick=()=>{closeSheet('menuSheet');load()};$('showDraftBtn').onclick=()=>{closeSheet('menuSheet');const id=[...drafts.keys()][0];if(!id)return UI.info('ยังไม่มีงานที่บันทึกไว้','เริ่มกรอกข้อมูลร้านก่อน');const a=all.find(x=>x.id===id);selectedDate=dateOf(a);openId=id;apply();setTimeout(()=>document.querySelector(`.store[data-id="${CSS.escape(String(id))}"]`)?.scrollIntoView({behavior:'smooth'}),50)};$('logoutBtn').onclick=async()=>{closeSheet('menuSheet');const c=await UI.confirm('ออกจากระบบ?','ข้อมูลที่บันทึกไว้ในโทรศัพท์จะยังคงอยู่','ออกจากระบบ');if(c.isConfirmed){localStorage.removeItem('csi_session_token');localStorage.removeItem('csi_user');location.href='login.html'}};document.querySelectorAll('.overlay').forEach(o=>o.onclick=e=>{if(e.target===o)closeSheet(o.id)});

async function load(){if(loading)return;loading=true;UI.loading('กำลังโหลดงาน…');try{let cached=null;try{cached=JSON.parse(localStorage.getItem('csi_user')||'null')}catch{}if(cached?.displayName)$('userName').textContent=cached.displayName;const[r,p]=await Promise.all([timeout(Api.request('/api/field/assignments'),15000,'การโหลดงาน'),timeout(Api.request('/api/field/bootstrap'),10000,'การตรวจสอบผู้ใช้').catch(()=>null)]);if(!r||!Array.isArray(r.assignments))throw new Error('ข้อมูลรายการงานไม่ถูกต้อง');if(p?.user?.displayName){$('userName').textContent=p.user.displayName;localStorage.setItem('csi_user',JSON.stringify(p.user))}else if(!cached?.displayName)$('userName').textContent='ผู้ปฏิบัติงาน';data={...r,readOnlyStatuses:Array.isArray(r.readOnlyStatuses)?r.readOnlyStatuses:ro};all=r.assignments;await hydrate();const d=all.map(dateOf).find(Boolean);if(d){const[y,m]=d.split('-').map(Number);cursor=new Date(y,m-1,1)}selectedDate='';openId=null;apply()}catch(e){console.error(e);all=[];apply();const u=/401|unauthorized|กรุณาเข้าสู่ระบบ/i.test(e.message||'');await UI.error(u?'กรุณาเข้าสู่ระบบใหม่':'โหลดงานไม่สำเร็จ',u?'ข้อมูลการเข้าสู่ระบบหมดอายุ':e.message||'ไม่สามารถโหลดงานได้');if(u)location.href='login.html'}finally{UI.close();loading=false}}
(async()=>{try{if(navigator.storage?.persist)timeout(LocalDraftDB.requestPersistence(),3000,'การเตรียมพื้นที่').catch(()=>{})}catch{}await load()})()})();