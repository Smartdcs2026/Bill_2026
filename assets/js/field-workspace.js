(()=>{const $=id=>document.getElementById(id);let data={assignments:[],readOnlyStatuses:[]},all=[],shown=[],drafts=new Map(),openId=null,selectedDate='',cursor=new Date(),loading=false,timer=0,onlineVerified=false,syncing=false;const ro=['SUBMITTED','UNDER_REVIEW','APPROVED','NOT_PAYABLE','PAID','CLOSED'];const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const timeout=(p,ms,label)=>Promise.race([Promise.resolve(p),new Promise((_,r)=>setTimeout(()=>r(new Error(`${label}ใช้เวลานานเกินไป`)),ms))]);const dateOf=a=>String(a.workDate||a.work_date||a.date||a.store?.workDate||'').slice(0,10);const dateLabel=v=>{if(!v)return'ทุกวันที่มีงาน';const[y,m,d]=v.split('-').map(Number);return new Intl.DateTimeFormat('th-TH',{weekday:'short',day:'numeric',month:'short',year:'numeric'}).format(new Date(y,m-1,d))};const monthLabel=d=>new Intl.DateTimeFormat('th-TH',{month:'long',year:'numeric'}).format(d);const brand=a=>(String(a.store?.brand||a.brand||'RI').match(/[A-Za-z0-9]+/)?.[0]||'RI').toUpperCase().slice(0,3);const posCodes=a=>Array.isArray(a.store?.posCodes)&&a.store.posCodes.length?a.store.posCodes:Array.from({length:Math.max(1,Number(a.store?.posCount||a.store?.pos||1))},(_,i)=>`POS${i+1}`);const draft=a=>drafts.get(a.id)||{assignmentId:a.id,pos:{},notes:''};const isRO=a=>(data.readOnlyStatuses||ro).includes(a.status);const userKey=()=>{try{const u=JSON.parse(localStorage.getItem('csi_user')||'null');return u?.id||u?.employeeCode||u?.employee_code||'field'}catch{return'field'}};const setConnection=(mode,text)=>{const b=$('connectionBar');if(!b)return;b.className=`connection-bar ${mode}`;$('connectionText').textContent=text};const status=s=>({ASSIGNED:'ยังไม่เริ่ม',DRAFT:'กำลังทำ',SUBMITTED:'ส่งแล้ว',UNDER_REVIEW:'กำลังตรวจ',APPROVED:'อนุมัติแล้ว',NOT_PAYABLE:'ไม่อนุมัติ',PAID:'จ่ายแล้ว',CLOSED:'ปิดงาน'})[s]||s||'ยังไม่เริ่ม';
const retryDelay=count=>Math.min(15*60*1000,Math.max(15000,15000*Math.pow(2,Math.max(0,Number(count||0)-1))));const retryReady=q=>!q.nextRetryAt||Date.now()>=new Date(q.nextRetryAt).getTime();const queueTypeLabel=t=>({IMAGE_UPLOAD:'รูปภาพ',LOCATION_UPDATE:'พิกัด',SUBMISSION:'ส่งงาน'})[t]||t||'ข้อมูล';


async function pendingSummary(){
 const [queue,allDrafts]=await Promise.all([LocalDraftDB.listQueue(),LocalDraftDB.listDrafts()]);
 const pending=(queue||[]).filter(q=>q.state!=='DONE');
 const failed=pending.filter(q=>q.state==='FAILED');
 const waiting=failed.filter(q=>!retryReady(q));
 const ready=(allDrafts||[]).filter(d=>d.state==='READY_TO_SUBMIT');
 return {pending:pending.length,failed:failed.length,waiting:waiting.length,ready:ready.length,assignmentIds:[...new Set([...pending.map(q=>q.assignmentId),...ready.map(d=>d.assignmentId)].filter(Boolean))]};
}
async function refreshSyncStatus(){
 try{
  const s=await pendingSummary();
  if(s.pending||s.ready)setConnection(navigator.onLine?'pending':'local',`มีข้อมูลรอส่ง ${s.pending+s.ready} รายการ`);
  return s;
 }catch{return {pending:0,ready:0,assignmentIds:[]}}
}

async function hydrate(){try{const x=await timeout(LocalDraftDB.listDrafts(),5000,'การเปิดข้อมูล');drafts=new Map((x||[]).map(v=>[v.assignmentId,v]))}catch(e){console.warn(e);drafts=new Map()}}
function apply(){shown=selectedDate?all.filter(a=>dateOf(a)===selectedDate):all.slice();$('selectedDateLabel').textContent=dateLabel(selectedDate);$('listTitle').textContent=selectedDate?'งานในวันที่เลือก':'รายการงาน';$('listSubtitle').textContent=selectedDate?`${shown.length} งานในวันที่เลือก`:'แตะรายการเพื่อเริ่มหรือทำงานต่อ';render();summary()}
function summary(){$('totalJobs').textContent=shown.length;$('draftJobs').textContent=shown.filter(a=>!isRO(a)&&(drafts.has(a.id)||['ASSIGNED','DRAFT'].includes(a.status))).length;$('sentJobs').textContent=shown.filter(isRO).length;const ds=$('draftStatus');if(ds){ds.textContent=drafts.size?`บันทึกไว้ ${drafts.size} งาน`:'บันทึกแล้ว';ds.classList.toggle('hidden',!drafts.size)};const dates=new Set(all.map(dateOf).filter(Boolean));$('calendarBadge').textContent=dates.size;$('calendarBadge').classList.toggle('hidden',!dates.size)}
function render(){$('jobList').innerHTML=shown.length?shown.map((a,i)=>card(a,i)).join(''):`<div class="empty"><span class="empty-icon">▦</span><b>${selectedDate?'ไม่มีงานในวันที่เลือก':'ยังไม่พบงานที่ได้รับมอบหมาย'}</b><span>${selectedDate?'เลือกวันอื่นจากปฏิทินด้านบน':'กดอัปเดตงานเพื่อตรวจสอบแผนล่าสุด'}</span><button type="button" data-empty-action="refresh">อัปเดตงาน</button></div>`}
function card(a,i){const s=a.store||{},d=draft(a),expanded=openId===a.id,readonly=isRO(a),total=posCodes(a).length,done=posCodes(a).filter(p=>{const v=d.pos?.[p]||{};return v.customerCount&&v.billDate&&v.billTime}).length,cls=readonly?'sent':drafts.has(a.id)?'draft':'',txt=readonly?status(a.status):d.state==='READY_TO_SUBMIT'?'พร้อมส่ง':drafts.has(a.id)?'บันทึกไว้':'ยังไม่เริ่ม';return `<article class="store ${expanded?'open':''}" data-id="${esc(a.id)}"><button class="store-row" data-action="toggle"><span class="brand">${esc(brand(a))}</span><span class="store-info"><b>${i+1}. ${esc(s.storeName||'ไม่ระบุชื่อร้าน')}</b><small>${esc(s.storeCode||'-')} · ${total} POS${dateOf(a)?` · ${esc(dateLabel(dateOf(a)))}`:''}</small></span><span class="status ${cls}">${esc(txt)}${done?` · ${done}/${total}`:''}</span><span class="chev">${expanded?'▲':'▼'}</span></button>${expanded?panel(a,d,readonly):''}</article>`}
function panel(a,d,readonly){const s=a.store||{},loc=d.location||{};return `<div class="panel"><div class="quick"><span><b>${esc(s.businessType||'-')} · ${esc(s.openTime||'-')}–${esc(s.closeTime||'-')}</b><small>${esc(s.address||'ไม่ระบุที่อยู่')}</small></span><button class="map" data-action="map">แผนที่</button></div><div class="location-box"><span><b>${a.locationUpdateRequested?'มีคำขอให้อัปเดตพิกัดร้าน':'พิกัดหน้าร้าน'}</b><small>${loc.latitude?`บันทึกล่าสุด ${esc(new Date(loc.capturedAt).toLocaleString('th-TH'))}`:'กดเพื่อบันทึกพิกัด ณ จุดที่อยู่ตอนนี้'}</small></span><button data-action="location">บันทึกพิกัดปัจจุบัน</button></div><div class="sub"><b>ข้อมูลจากบิล</b><span>ยอดลูกค้า · วันที่ · เวลา</span></div><div class="pos-list">${posCodes(a).map(p=>posLine(d,p,readonly)).join('')}</div><label class="note">หมายเหตุ<textarea data-field="notes" ${readonly?'disabled':''}>${esc(d.notes||'')}</textarea></label><div class="sub"><b>รูปภาพประกอบ</b><span>เก็บในโทรศัพท์จนกว่าจะส่ง</span></div><div class="photos">${photoGroup(a,'RECEIPT','รูปบิล','receipt',readonly)}${photoGroup(a,'STORE','รูปร้าน','store',readonly)}</div><div class="actions"><button class="save" data-action="save" ${readonly?'disabled':''}>บันทึกไว้ก่อน</button><button class="submit" data-action="submit" ${readonly?'disabled':''}>ตรวจและส่งงาน</button></div>${readonly?'<div class="readonly">งานนี้ส่งแล้ว เปิดดูได้แต่แก้ไข เพิ่ม หรือลบข้อมูลไม่ได้</div>':''}</div>`}
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
async function addFiles(a,files,cat){for(const f of files){const id=crypto.randomUUID();await LocalDraftDB.saveImage({id,assignmentId:a.id,name:f.name,type:f.type,size:f.size,blob:f,category:cat,state:'LOCAL_ONLY',createdAt:new Date().toISOString()});await LocalDraftDB.enqueue({type:'IMAGE_UPLOAD',assignmentId:a.id,imageId:id})}await save(a,false);await photoCounts(a);await refreshSyncStatus();await UI.success('เพิ่มรูปแล้ว',`${files.length} รูป`)}
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

async function captureLocation(a){
 if(!navigator.geolocation)return UI.error('อุปกรณ์ไม่รองรับพิกัด','กรุณาเปิดจากโทรศัพท์ที่รองรับตำแหน่ง');
 UI.loading('กำลังอ่านพิกัดปัจจุบัน…');
 try{
  const pos=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:20000,maximumAge:0}));
  const loc={id:crypto.randomUUID(),assignmentId:a.id,latitude:pos.coords.latitude,longitude:pos.coords.longitude,accuracy:pos.coords.accuracy,capturedAt:new Date(pos.timestamp||Date.now()).toISOString(),state:'QUEUED'};
  await LocalDraftDB.saveLocation(loc);await LocalDraftDB.enqueue({type:'LOCATION_UPDATE',assignmentId:a.id,locationId:loc.id});
  const d=collect(a);d.location=loc;await LocalDraftDB.saveDraft(d);drafts.set(a.id,d);render();summary();setTimeout(()=>photoCounts(a),20);
  await refreshSyncStatus();await UI.success('บันทึกพิกัดแล้ว','เก็บไว้ในโทรศัพท์และรอส่งเข้าระบบ');
 }catch(e){await UI.error('บันทึกพิกัดไม่สำเร็จ',e?.code===1?'กรุณาอนุญาตสิทธิ์ตำแหน่งให้แอป':'ไม่สามารถอ่านพิกัดได้ กรุณาลองอีกครั้ง')}finally{UI.close()}
}
async function requireOnlineLogin(reason){
 try{await Api.verifySession({force:true});onlineVerified=true;setConnection('online','ยืนยันตัวตนออนไลน์แล้ว');return true}catch(e){
  localStorage.setItem('csi_login_return','field.html');localStorage.setItem('csi_login_reason',reason||'ยืนยันตัวตนเพื่อเชื่อมต่อระบบ');
  await UI.info('ต้องเข้าสู่ระบบอีกครั้ง',reason||'กรุณาสแกน QR และกรอกรหัสก่อนเชื่อมต่อระบบ');location.href='login.html';return false
 }
}


function blobToBase64(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||'').split(',')[1]||'');r.onerror=()=>reject(r.error||new Error('อ่านรูปไม่สำเร็จ'));r.readAsDataURL(blob)})}
async function sha256Blob(blob){const b=await blob.arrayBuffer();const h=await crypto.subtle.digest('SHA-256',b);return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function processQueue(assignmentId){
 const items=(await LocalDraftDB.listQueue()).filter(q=>q.assignmentId===assignmentId&&q.state!=='DONE'&&retryReady(q)).sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt)));
 let done=0;
 for(const q of items){
  await LocalDraftDB.updateQueue(q.id,{state:'PROCESSING',lastError:null});
  try{
   if(q.type==='IMAGE_UPLOAD'){
    const img=await LocalDraftDB.getImage(q.imageId);if(!img)throw new Error('ไม่พบรูปในโทรศัพท์');
    await LocalDraftDB.updateImage(img.id,{state:'UPLOADING'});
    const checksum=img.checksum||await sha256Blob(img.blob);
    const result=await Api.request('/api/field/image-upload',{method:'POST',body:JSON.stringify({imageId:img.id,assignmentId:img.assignmentId,category:img.category,fileName:img.name||`${img.id}.jpg`,mimeType:img.type||'image/jpeg',size:img.size||img.blob.size,checksum,dataBase64:await blobToBase64(img.blob),capturedAt:img.createdAt})});
    await LocalDraftDB.updateImage(img.id,{state:'VERIFIED',checksum,serverFileId:result.fileId||'',uploadedAt:new Date().toISOString()});
   }else if(q.type==='LOCATION_UPDATE'){
    const loc=await LocalDraftDB.getLocation(q.locationId);if(!loc)throw new Error('ไม่พบพิกัดในโทรศัพท์');
    await Api.request('/api/field/location',{method:'POST',body:JSON.stringify(loc)});
    await LocalDraftDB.updateLocation(loc.id,{state:'SYNCED',syncedAt:new Date().toISOString()});
   }
   await LocalDraftDB.updateQueue(q.id,{state:'DONE',completedAt:new Date().toISOString()});done++;
   setConnection('online',`กำลังส่งข้อมูล ${done}/${items.length}`);
  }catch(e){
   const retryCount=Number(q.retryCount||0)+1;await LocalDraftDB.updateQueue(q.id,{state:'FAILED',lastError:e.message||String(e),retryCount,nextRetryAt:new Date(Date.now()+retryDelay(retryCount)).toISOString(),lastAttemptAt:new Date().toISOString()});
   if(q.imageId)await LocalDraftDB.updateImage(q.imageId,{state:'FAILED'});
   throw e;
  }
 }
 return {done,total:items.length};
}
async function syncPending(options={}){
 if(syncing)return {skipped:true};
 if(!navigator.onLine)throw new Error('อุปกรณ์ยังไม่ได้เชื่อมต่ออินเทอร์เน็ต');
 const token=localStorage.getItem('csi_session_token');
 if(!token)throw new Error('กรุณาเข้าสู่ระบบก่อนส่งข้อมูล');
 syncing=true;
 const silent=Boolean(options.silent);
 try{
  const state=await pendingSummary();
  if(!state.assignmentIds.length){
   if(!silent)setConnection('online','ออนไลน์ · ไม่มีข้อมูลรอส่ง');
   return {total:0,success:0,failed:0};
  }
  let success=0,failed=0;const errors=[];
  for(const assignmentId of state.assignmentIds){
   const a=all.find(x=>String(x.id)===String(assignmentId));
   if(!a)continue;
   try{
    setConnection('syncing',`กำลังซิงก์งาน ${success+failed+1}/${state.assignmentIds.length}`);
    await processQueue(assignmentId);
    const remainingForAssignment=(await LocalDraftDB.listQueue()).filter(q=>String(q.assignmentId)===String(assignmentId)&&q.state!=='DONE');if(remainingForAssignment.length)throw new Error('ยังมีข้อมูลรอส่งตามรอบลองใหม่');
    const d=await LocalDraftDB.getDraft(assignmentId);
    if(d?.state==='READY_TO_SUBMIT')await finalizeSubmission(a,d);
    success++;
   }catch(e){failed++;errors.push({assignmentId,message:e.message||String(e)});}
  }
  await hydrate();render();summary();
  const remain=await pendingSummary();
  if(remain.pending||remain.ready)setConnection('pending',`ส่งแล้วบางส่วน · ยังเหลือ ${remain.pending+remain.ready} รายการ`);
  else setConnection('online',`ซิงก์สำเร็จ · ${new Date().toLocaleString('th-TH')}`);
  return {total:state.assignmentIds.length,success,failed,errors,remaining:remain.pending+remain.ready};
 }finally{syncing=false}
}

async function finalizeSubmission(a,d){
 const images=await LocalDraftDB.listImages(a.id);
 const payload={assignmentId:a.id,pos:d.pos||{},notes:d.notes||'',location:d.location||null,imageIds:images.filter(x=>x.state==='VERIFIED').map(x=>x.id),validatedAt:d.validatedAt||new Date().toISOString(),clientSubmissionId:d.clientSubmissionId||crypto.randomUUID()};
 const result=await Api.request('/api/field/submit',{method:'POST',body:JSON.stringify(payload)});
 const submitted={...d,state:'SUBMITTED',submittedAt:new Date().toISOString(),clientSubmissionId:payload.clientSubmissionId,serverSubmissionId:result.submissionId||''};
 await LocalDraftDB.saveDraft(submitted);drafts.set(a.id,submitted);const queue=await LocalDraftDB.listQueue();for(const q of queue.filter(x=>x.assignmentId===a.id&&x.state==='DONE'))await LocalDraftDB.removeQueue(q.id);
 a.status='SUBMITTED';render();summary();if(openId===a.id)setTimeout(()=>photoCounts(a),20);
 return result;
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
  if(!(await requireOnlineLogin('กรุณาเข้าสู่ระบบก่อนส่งข้อมูลงาน')))return;
  const d={...check.d,state:'READY_TO_SUBMIT',validatedAt:new Date().toISOString(),clientSubmissionId:check.d.clientSubmissionId||crypto.randomUUID()};
  await LocalDraftDB.saveDraft(d);drafts.set(a.id,d);render();summary();if(openId===a.id)setTimeout(()=>photoCounts(a),20);
  UI.loading('กำลังส่งข้อมูลงาน…');
  try{const progress=await processQueue(a.id);await finalizeSubmission(a,d);await UI.success('ส่งงานสำเร็จ',`ส่งรูปและพิกัดครบแล้ว${progress.total?` ${progress.total} รายการ`:''} รูปต้นฉบับยังอยู่ในโทรศัพท์`)}catch(e){setConnection('local','ส่งไม่ครบ · ระบบเก็บข้อมูลไว้ในโทรศัพท์');await UI.error('ส่งงานยังไม่สำเร็จ',`${e.message||'การเชื่อมต่อขัดข้อง'} ข้อมูลและรูปยังอยู่ในโทรศัพท์ สามารถกดส่งอีกครั้งได้`)}finally{UI.close()}
 }
}


function ensureSyncCenter(){
 if(document.getElementById('syncCenterSheet'))return;
 const menu=document.querySelector('#menuSheet .menu');
 if(menu&&!document.getElementById('syncCenterBtn')){const b=document.createElement('button');b.id='syncCenterBtn';b.type='button';b.textContent='ศูนย์ตรวจสอบการส่งข้อมูล';menu.insertBefore(b,menu.querySelector('.danger'));b.onclick=()=>{closeSheet('menuSheet');openSyncCenter()}}
 const wrap=document.createElement('div');wrap.id='syncCenterSheet';wrap.className='overlay hidden';wrap.innerHTML=`<section class="sheet sync-center"><div class="handle"></div><header><span><small>OFFLINE DELIVERY</small><h2>ศูนย์ตรวจสอบการส่งข้อมูล</h2></span><button id="closeSyncCenterBtn" type="button">×</button></header><div id="syncCenterSummary" class="sync-center-summary"></div><div id="syncCenterList" class="sync-center-list"></div><div class="sync-center-actions"><button id="retryFailedBtn" type="button">ลองส่งรายการที่ผิดพลาดอีกครั้ง</button></div></section>`;document.body.appendChild(wrap);wrap.onclick=e=>{if(e.target===wrap)closeSheet('syncCenterSheet')};document.getElementById('closeSyncCenterBtn').onclick=()=>closeSheet('syncCenterSheet');document.getElementById('retryFailedBtn').onclick=retryFailedNow;
}
async function openSyncCenter(){ensureSyncCenter();const [queue,storage]=await Promise.all([LocalDraftDB.listQueue(),LocalDraftDB.storageStatus().catch(()=>({usage:0,quota:0,persisted:false}))]);const active=(queue||[]).filter(q=>q.state!=='DONE').sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));const failed=active.filter(q=>q.state==='FAILED');const mb=n=>`${(Number(n||0)/1048576).toFixed(1)} MB`;document.getElementById('syncCenterSummary').innerHTML=`<span><b>${active.length}</b><small>รอส่ง</small></span><span><b>${failed.length}</b><small>ผิดพลาด</small></span><span><b>${storage.quota?Math.round(storage.usage/storage.quota*100):0}%</b><small>พื้นที่เครื่อง</small></span><span><b>${storage.persisted?'ปลอดภัย':'ทั่วไป'}</b><small>การเก็บข้อมูล</small></span>`;document.getElementById('syncCenterList').innerHTML=active.length?active.map(q=>`<article><span><b>${queueTypeLabel(q.type)} · ${esc(q.assignmentId||'-')}</b><small>${q.state==='FAILED'?esc(q.lastError||'ส่งไม่สำเร็จ'):'รอส่งเข้าระบบ'}${q.nextRetryAt?` · ลองใหม่ ${esc(new Date(q.nextRetryAt).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}))}`:''}</small></span><em class="${String(q.state).toLowerCase()}">${esc(q.state)}</em></article>`).join(''):`<div class="sync-center-empty">ไม่มีข้อมูลค้างส่งในโทรศัพท์</div>`;document.getElementById('retryFailedBtn').disabled=!failed.length;openSheet('syncCenterSheet')}
async function retryFailedNow(){if(!(await requireOnlineLogin('กรุณาเข้าสู่ระบบก่อนลองส่งข้อมูลอีกครั้ง')))return;await LocalDraftDB.resetFailedQueue();closeSheet('syncCenterSheet');UI.loading('กำลังลองส่งข้อมูลอีกครั้ง…');try{const r=await syncPending();if(r.failed)await UI.error('ยังส่งได้ไม่ครบ',`สำเร็จ ${r.success} งาน · เหลือ ${r.failed} งาน`);else await UI.success('ส่งข้อมูลสำเร็จ','รายการที่ค้างถูกส่งเรียบร้อยแล้ว')}catch(e){await UI.error('ยังส่งไม่สำเร็จ',e.message||'กรุณาลองอีกครั้ง')}finally{UI.close();refreshSyncStatus()}}

$('jobList').onclick=async e=>{const emptyAction=e.target.closest('[data-empty-action]')?.dataset.emptyAction;if(emptyAction==='refresh'){if(await requireOnlineLogin('กรุณาเข้าสู่ระบบก่อนอัปเดตรายการงาน'))load(true);return}const c=e.target.closest('.store');if(!c)return;const a=all.find(x=>String(x.id)===c.dataset.id),act=e.target.closest('[data-action]')?.dataset.action;if(!a||!act)return;if(act==='toggle'){openId=openId===a.id?null:a.id;render();if(openId)setTimeout(()=>{document.querySelector(`.store[data-id="${CSS.escape(String(a.id))}"]`)?.scrollIntoView({behavior:'smooth',block:'start'});photoCounts(a)},50)}if(act==='map'){const s=a.store||{},q=s.latitude&&s.longitude?`${s.latitude},${s.longitude}`:encodeURIComponent(s.address||s.storeName||'');open(`https://www.google.com/maps/search/?api=1&query=${q}`,'_blank')}if(act==='save')await save(a);if(act==='location')await captureLocation(a);if(act==='submit')await submit(a);if(act==='deleteImage'){const id=e.target.closest('[data-image-id]')?.dataset.imageId;if(id){const confirm=await UI.confirm('ลบรูปนี้?','รูปจะถูกลบออกจากโทรศัพท์','ลบรูป');if(confirm.isConfirmed){await LocalDraftDB.deleteImage(id);await photoCounts(a);await UI.success('ลบรูปแล้ว','')}}}if(['receiptCamera','receiptGallery','storeCamera','storeGallery'].includes(act))c.querySelector(`.${act}`)?.click()}
$('jobList').onchange=async e=>{const c=e.target.closest('.store');if(!c||!e.target.matches('.hidden-file'))return;const a=all.find(x=>String(x.id)===c.dataset.id);await addFiles(a,[...e.target.files],e.target.dataset.category);e.target.value=''}
$('jobList').oninput=e=>{const c=e.target.closest('.store');if(!c)return;const a=all.find(x=>String(x.id)===c.dataset.id);clearTimeout(timer);$('draftStatus').textContent='กำลังบันทึก…';timer=setTimeout(async()=>{try{await save(a,false);$('draftStatus').textContent='บันทึกแล้ว'}catch{$('draftStatus').textContent='กดบันทึกไว้ก่อน'}},650)}

function counts(){const m=new Map();all.forEach(a=>{const d=dateOf(a);if(d)m.set(d,(m.get(d)||0)+1)});return m}
function renderCalendar(){const y=cursor.getFullYear(),m=cursor.getMonth(),first=new Date(y,m,1),start=first.getDay(),last=new Date(y,m+1,0).getDate(),prev=new Date(y,m,0).getDate(),map=counts(),cells=[];$('calendarMonthLabel').textContent=monthLabel(cursor);for(let i=0;i<42;i++){let d,mm=m,yy=y,out=false;if(i<start){d=prev-start+i+1;mm=m-1;out=true}else if(i>=start+last){d=i-start-last+1;mm=m+1;out=true}else d=i-start+1;const dt=new Date(yy,mm,d),key=`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`,n=map.get(key)||0;cells.push(`<button class="day ${out?'out':''} ${n?'work':''} ${selectedDate===key?'selected':''}" data-date="${key}"><strong>${d}</strong>${n?`<i class="dot"></i><em>${n} ร้าน</em>`:''}</button>`)}$('calendarGrid').innerHTML=cells.join('')}
function openSheet(id){$(id).classList.remove('hidden');document.body.style.overflow='hidden'}function closeSheet(id){$(id).classList.add('hidden');document.body.style.overflow=''}
$('calendarBtn').onclick=()=>{const d=selectedDate||all.map(dateOf).find(Boolean);if(d){const[y,m]=d.split('-').map(Number);cursor=new Date(y,m-1,1)}renderCalendar();openSheet('calendarSheet')};$('closeCalendarBtn').onclick=()=>closeSheet('calendarSheet');$('prevMonthBtn').onclick=()=>{cursor=new Date(cursor.getFullYear(),cursor.getMonth()-1,1);renderCalendar()};$('nextMonthBtn').onclick=()=>{cursor=new Date(cursor.getFullYear(),cursor.getMonth()+1,1);renderCalendar()};$('showAllDatesBtn').onclick=()=>{selectedDate='';closeSheet('calendarSheet');apply()};$('calendarGrid').onclick=e=>{const b=e.target.closest('[data-date]');if(!b)return;selectedDate=b.dataset.date;closeSheet('calendarSheet');apply()};$('menuBtn').onclick=()=>openSheet('menuSheet');$('refreshBtn').onclick=async()=>{closeSheet('menuSheet');if(await requireOnlineLogin('กรุณาเข้าสู่ระบบก่อนอัปเดตรายการงาน'))load(true)};$('syncBtn').onclick=async()=>{if(!(await requireOnlineLogin('กรุณาเข้าสู่ระบบก่อนซิงก์ข้อมูล')))return;UI.loading('กำลังซิงก์ข้อมูลที่รอส่ง…');try{const r=await syncPending();await load(true);if(r.failed)await UI.error('ซิงก์ได้บางส่วน',`สำเร็จ ${r.success} งาน · ยังไม่สำเร็จ ${r.failed} งาน ข้อมูลยังอยู่ในโทรศัพท์`);else await UI.success('ซิงก์เรียบร้อย',r.total?`ส่งข้อมูลสำเร็จ ${r.success} งาน`:'ไม่มีข้อมูลรอส่ง')}catch(e){await UI.error('ซิงก์ไม่สำเร็จ',e.message||'กรุณาลองอีกครั้ง')}finally{UI.close()}};$('showDraftBtn').onclick=()=>{closeSheet('menuSheet');const id=[...drafts.keys()][0];if(!id)return UI.info('ยังไม่มีงานที่บันทึกไว้','เริ่มกรอกข้อมูลร้านก่อน');const a=all.find(x=>x.id===id);selectedDate=dateOf(a);openId=id;apply();setTimeout(()=>document.querySelector(`.store[data-id="${CSS.escape(String(id))}"]`)?.scrollIntoView({behavior:'smooth'}),50)};$('logoutBtn').onclick=async()=>{closeSheet('menuSheet');const c=await UI.confirm('ออกจากระบบ?','ข้อมูลที่บันทึกไว้ในโทรศัพท์จะยังคงอยู่','ออกจากระบบ');if(c.isConfirmed){localStorage.removeItem('csi_session_token');localStorage.removeItem('csi_user');location.href='login.html'}};document.querySelectorAll('.overlay').forEach(o=>o.onclick=e=>{if(e.target===o)closeSheet(o.id)});

async function load(forceOnline=false){if(loading)return;loading=true;if(forceOnline)UI.loading('กำลังอัปเดตงาน…');try{let cachedUser=null;try{cachedUser=JSON.parse(localStorage.getItem('csi_user')||'null')}catch{}if(cachedUser?.displayName)$('userName').textContent=cachedUser.displayName;await hydrate();const cached=await LocalDraftDB.getAssignments(userKey());if(cached?.items?.length){all=cached.items;data={assignments:all,readOnlyStatuses:ro};apply();setConnection('local',`ทำงานในเครื่อง · แผนล่าสุด ${new Date(cached.updatedAt).toLocaleString('th-TH')}`)}
 const token=localStorage.getItem('csi_session_token');if(!token&&!forceOnline){if(!cached?.items?.length){all=[];apply();setConnection('local','ยังไม่มีแผนงานในเครื่อง กรุณาเข้าสู่ระบบเพื่ออัปเดต')}return}
 const[r,p]=await Promise.all([timeout(Api.request('/api/field/assignments'),15000,'การโหลดงาน'),timeout(Api.request('/api/field/bootstrap'),10000,'การตรวจสอบผู้ใช้').catch(()=>null)]);if(!r||!Array.isArray(r.assignments))throw new Error('ข้อมูลรายการงานไม่ถูกต้อง');if(p?.user?.displayName){$('userName').textContent=p.user.displayName;localStorage.setItem('csi_user',JSON.stringify(p.user))}else if(!cachedUser?.displayName)$('userName').textContent='ผู้ปฏิบัติงาน';data={...r,readOnlyStatuses:Array.isArray(r.readOnlyStatuses)?r.readOnlyStatuses:ro};all=r.assignments;await LocalDraftDB.saveAssignments(all,userKey());await LocalDraftDB.setMeta('last_sync_at',new Date().toISOString());onlineVerified=true;setConnection('online',`ออนไลน์ · อัปเดตล่าสุด ${new Date().toLocaleString('th-TH')}`);setTimeout(()=>syncPending({silent:true}).catch(()=>refreshSyncStatus()),250);const d=all.map(dateOf).find(Boolean);if(d){const[y,m]=d.split('-').map(Number);cursor=new Date(y,m-1,1)}selectedDate='';openId=null;apply()}catch(e){console.error(e);const cached=await LocalDraftDB.getAssignments(userKey());if(cached?.items?.length){all=cached.items;data={assignments:all,readOnlyStatuses:ro};apply();setConnection('local','ทำงานในเครื่อง · ยังไม่ได้อัปเดตจากระบบ');if(forceOnline)await UI.error('อัปเดตงานไม่สำเร็จ','ยังใช้แผนงานที่เก็บไว้ในโทรศัพท์ได้ตามปกติ')}else{all=[];apply();setConnection('local','ไม่สามารถเชื่อมต่อระบบได้');if(forceOnline)await UI.error('โหลดงานไม่สำเร็จ',e.message||'ไม่สามารถโหลดงานได้')}}finally{UI.close();loading=false}}
window.addEventListener('online',()=>{refreshSyncStatus();setTimeout(()=>syncPending({silent:true}).catch(()=>refreshSyncStatus()),500)});window.addEventListener('offline',()=>setConnection('local','ทำงานในเครื่อง · ข้อมูลจะส่งเมื่อออนไลน์'));
(async()=>{ensureSyncCenter();try{if(navigator.storage?.persist)timeout(LocalDraftDB.requestPersistence(),3000,'การเตรียมพื้นที่').catch(()=>{})}catch{}await load()})()})();