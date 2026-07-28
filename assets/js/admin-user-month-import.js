(()=>{
'use strict';

const $=id=>document.getElementById(id);
let rawRows=[];
let validated=[];
let previewDates=[];
let previewDateIndex=0;
let currentFileName='';

const RUN_MODE_LABELS={
 CONTINUOUS:'รันต่อเนื่อง',
 MONTHLY_RESET:'เริ่มใหม่ทุกเดือน',
 NO_SEQUENCE_CHECK:'ไม่ตรวจลำดับ'
};

const aliases={
 brand:['brand','แบรนด์','ยี่ห้อ'],
 businessType:['business type','businesstype','ประเภทธุรกิจ','ประเภทกิจการ'],
 storeCode:['store code','storecode','รหัสร้าน','รหัสสาขา'],
 storeName:['store name','storename','ชื่อร้าน','ชื่อสาขา'],
 posCount:['pos','pos count','poscount','จำนวน pos','จำนวนเครื่อง','จำนวนเครื่อง pos'],
 openClose:['open-close','open close','open–close','เวลาเปิด-ปิด','เวลาเปิดปิด'],
 address:['address','ที่อยู่','ที่อยู่ร้าน'],
 storeType:['store type','storetype','รูปแบบร้าน','ประเภทร้าน'],
 rank:['rank','ระดับร้าน','อันดับ'],
 latitude:['latitude','lat','ละติจูด'],
 longitude:['longitude','lng','lon','ลองจิจูด'],
 workDate:['work date','workdate','วันที่ทำงาน','วันทำงาน'],
 note:['note','notes','หมายเหตุ'],
 receiptSlots:['receipt slots','receiptslots','รูปบิล','ช่องรูปบิล','จำนวนช่องรูปบิล'],
 storeSlots:['store photo slots','storephotoslots','store slots','รูปหน้าร้าน','รูปร้าน','จำนวนรูปร้าน'],
 runMode:['customer run mode','customerrunmode','run mode','รูปแบบยอดลูกค้า','กฎยอดลูกค้า']
};

function normalizeKey(value){
 return String(value||'')
  .trim()
  .toLowerCase()
  .replace(/[_\-–—]/g,' ')
  .replace(/\s+/g,' ');
}

function pick(row,names){
 const map=new Map(Object.keys(row).map(k=>[normalizeKey(k),row[k]]));
 for(const name of names){
  const key=normalizeKey(name);
  if(map.has(key))return map.get(key);
 }
 return '';
}

function safeText(value){
 return String(value??'').trim();
}

function escapeHtml(value){
 return String(value??'').replace(/[&<>"']/g,c=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
 })[c]);
}

function parseDate(value,fallback=''){
 if(value instanceof Date&&!Number.isNaN(value.getTime())){
  return toYmd(value);
 }
 if(typeof value==='number'&&window.XLSX?.SSF){
  const p=XLSX.SSF.parse_date_code(value);
  if(p)return `${p.y}-${String(p.m).padStart(2,'0')}-${String(p.d).padStart(2,'0')}`;
 }
 const s=safeText(value);
 if(!s)return fallback;
 let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
 if(m)return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
 m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
 if(m)return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
 const d=new Date(s);
 return Number.isNaN(d.getTime())?fallback:toYmd(d);
}

function toYmd(date){
 return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function displayDate(ymd){
 if(!ymd)return '-';
 const [y,m,d]=ymd.split('-');
 return `${d}/${m}/${y}`;
}

function normalizeRunMode(value){
 const s=normalizeKey(value).replace(/\s/g,'_').toUpperCase();
 if(['CONTINUOUS','RUN_CONTINUOUS','ต่อเนื่อง','รันต่อเนื่อง'].includes(s))return 'CONTINUOUS';
 if(['MONTHLY_RESET','RESET_MONTHLY','เริ่มใหม่ทุกเดือน','ตัดยอดรายเดือน'].includes(s))return 'MONTHLY_RESET';
 if(['NO_SEQUENCE_CHECK','NO_CHECK','ไม่ตรวจลำดับ'].includes(s))return 'NO_SEQUENCE_CHECK';
 return $('defaultRunMode').value||'CONTINUOUS';
}

function normalizeRow(row,index){
 const pos=Math.max(0,Number(pick(row,aliases.posCount)||0));
 const receipt=Math.max(1,Number(pick(row,aliases.receiptSlots)||$('receiptSlots').value||1));
 const storePhotos=Math.max(1,Number(pick(row,aliases.storeSlots)||$('storeSlots').value||5));
 const normalized={
  rowNumber:index+2,
  brand:safeText(pick(row,aliases.brand)),
  businessType:safeText(pick(row,aliases.businessType)),
  storeCode:safeText(pick(row,aliases.storeCode)),
  storeName:safeText(pick(row,aliases.storeName)),
  posCount:pos,
  openClose:safeText(pick(row,aliases.openClose)),
  address:safeText(pick(row,aliases.address)),
  storeType:safeText(pick(row,aliases.storeType)),
  rank:safeText(pick(row,aliases.rank)),
  latitude:safeText(pick(row,aliases.latitude)),
  longitude:safeText(pick(row,aliases.longitude)),
  workDate:parseDate(pick(row,aliases.workDate),$('defaultWorkDate').value),
  note:safeText(pick(row,aliases.note)),
  receiptSlots:receipt,
  storeSlots:storePhotos,
  runMode:normalizeRunMode(pick(row,aliases.runMode)),
  errors:[],
  warnings:[]
 };

 if(!normalized.brand)normalized.errors.push('ไม่มีแบรนด์');
 if(!normalized.storeCode)normalized.errors.push('ไม่มีรหัสร้าน');
 if(!normalized.storeName)normalized.errors.push('ไม่มีชื่อร้าน');
 if(!Number.isInteger(normalized.posCount)||normalized.posCount<1)normalized.errors.push('POS ต้องมากกว่า 0');
 if(!normalized.workDate)normalized.errors.push('ไม่มีวันที่ทำงาน');
 if(normalized.workDate&&!normalized.workDate.startsWith($('workMonth').value)){
  normalized.errors.push('วันที่อยู่นอกเดือนงาน');
 }
 if(!normalized.address)normalized.warnings.push('ไม่มีที่อยู่');
 if(!normalized.latitude||!normalized.longitude)normalized.warnings.push('ไม่มีพิกัดครบ');
 return normalized;
}

function validateDuplicate(rows){
 const seen=new Map();
 for(const row of rows){
  const key=`${row.storeCode}|${row.workDate}`;
  if(!row.storeCode||!row.workDate)continue;
  if(seen.has(key)){
   row.errors.push(`ซ้ำกับแถว ${seen.get(key)}`);
  }else{
   seen.set(key,row.rowNumber);
  }
 }
}

function summaryOf(rows){
 return {
  total:rows.length,
  valid:rows.filter(r=>!r.errors.length).length,
  invalid:rows.filter(r=>r.errors.length).length,
  warnings:rows.reduce((n,r)=>n+r.warnings.length,0),
  stores:new Set(rows.filter(r=>!r.errors.length).map(r=>r.storeCode)).size,
  dates:new Set(rows.filter(r=>!r.errors.length).map(r=>r.workDate)).size,
  pos:rows.filter(r=>!r.errors.length).reduce((n,r)=>n+r.posCount,0)
 };
}

function defaults(){
 return {
  operatorUserId:$('operatorUserId').value,
  workDate:$('defaultWorkDate').value,
  receiptSlots:Number($('receiptSlots').value||1),
  storeSlots:Number($('storeSlots').value||5),
  runMode:$('defaultRunMode').value
 };
}

async function guard(){
 try{
  const d=await Api.request('/api/staff/me');
  const role=d.user?.role_code||d.user?.roleCode;
  if(role!=='ADMIN')throw new Error('ไม่มีสิทธิ์ Admin');
 }catch(e){
  await UI.error('กรุณาเข้าสู่ระบบ Admin',e.message);
  location.href='admin-login.html';
  throw e;
 }
}

async function loadOperators(){
 const d=await Api.request('/api/admin/users?role=FIELD_USER&status=ACTIVE&limit=500');
 $('operatorUserId').innerHTML=
  '<option value="">เลือกผู้ปฏิบัติงาน</option>'+
  (d.users||[]).map(u=>
   `<option value="${escapeHtml(u.id)}">${escapeHtml(u.displayName)} (${escapeHtml(u.employeeCode||u.username)})</option>`
  ).join('');
}

async function readFile(){
 const f=$('fileInput').files[0];
 if(!f)throw new Error('กรุณาเลือกไฟล์');
 const ab=await f.arrayBuffer();
 const wb=XLSX.read(ab,{type:'array',cellDates:true});
 const ws=wb.Sheets[wb.SheetNames[0]];
 return {
  fileName:f.name,
  rows:XLSX.utils.sheet_to_json(ws,{defval:'',raw:true})
 };
}

function render(rows){
 validated=rows;
 const s=summaryOf(rows);

 $('summary').innerHTML=`
  <span class="pill">ทั้งหมด ${s.total}</span>
  <span class="pill success">ผ่าน ${s.valid}</span>
  <span class="pill ${s.invalid?'danger':''}">ผิด ${s.invalid}</span>
  <span class="pill warning">คำเตือน ${s.warnings}</span>
  <span class="pill">ร้าน ${s.stores}</span>
  <span class="pill">วันทำงาน ${s.dates}</span>
  <span class="pill">POS ${s.pos}</span>`;

 $('previewBody').innerHTML=rows.map(r=>`
  <tr class="${r.errors.length?'row-invalid':'row-valid'}">
   <td>${r.rowNumber}</td>
   <td>${escapeHtml(r.brand||'-')}</td>
   <td>${escapeHtml(r.storeCode||'-')}</td>
   <td>${escapeHtml(r.storeName||'-')}</td>
   <td>${r.posCount||'-'}</td>
   <td>${displayDate(r.workDate)}</td>
   <td>${r.receiptSlots}</td>
   <td>${r.storeSlots}</td>
   <td>${escapeHtml(RUN_MODE_LABELS[r.runMode]||r.runMode)}</td>
   <td>
    ${r.errors.length
      ?`<span class="validation-error">${escapeHtml(r.errors.join(', '))}</span>`
      :`<span class="validation-ok">ผ่าน</span>`}
    ${r.warnings.length
      ?`<small class="validation-warning">${escapeHtml(r.warnings.join(', '))}</small>`
      :''}
   </td>
  </tr>`).join('');

 const warnings=[];
 if(!rows.some(r=>r.address))warnings.push('ไฟล์ไม่มีข้อมูลที่อยู่ร้านทุกแถว');
 if(!rows.some(r=>r.latitude&&r.longitude))warnings.push('ไฟล์ไม่มีพิกัดร้านที่สมบูรณ์');
 $('contractWarnings').classList.toggle('hidden',!warnings.length);
 $('contractWarnings').innerHTML=warnings.map(x=>`<span>• ${escapeHtml(x)}</span>`).join('');

 $('commitBtn').disabled=s.invalid>0||s.valid===0;
 $('mobilePreviewBtn').disabled=s.valid===0;
 previewDates=[...new Set(rows.filter(r=>!r.errors.length).map(r=>r.workDate))].sort();
 previewDateIndex=0;
}

async function preview(){
 try{
  if(!$('operatorUserId').value)throw new Error('กรุณาเลือกผู้ปฏิบัติงาน');
  if(!$('workMonth').value)throw new Error('กรุณาเลือกเดือนงาน');

  UI.loading('กำลังอ่านและตรวจสอบไฟล์...');
  const f=await readFile();
  currentFileName=f.fileName;
  rawRows=f.rows;

  const rows=rawRows.map(normalizeRow);
  validateDuplicate(rows);
  render(rows);

  UI.close();
  const s=summaryOf(rows);
  $('importStatus').textContent=
   `ตรวจ ${f.fileName} แล้ว: ผ่าน ${s.valid} แถว / ผิด ${s.invalid} แถว`;

  if(s.invalid){
   await UI.info('พบข้อมูลที่ต้องแก้ไข',`มี ${s.invalid} แถวที่ยังนำเข้าไม่ได้`);
  }else{
   await UI.success('ตรวจสอบไฟล์ผ่าน',`พร้อมดูตัวอย่าง ${s.stores} ร้าน ก่อนนำเข้า`);
  }
 }catch(e){
  UI.close();
  $('commitBtn').disabled=true;
  $('mobilePreviewBtn').disabled=true;
  await UI.error('ตรวจสอบไฟล์ไม่สำเร็จ',e.message);
 }
}

function selectedOperatorName(){
 const option=$('operatorUserId').selectedOptions[0];
 return option?.textContent||'ผู้ปฏิบัติงาน';
}

function renderWorkerPreview(){
 const date=previewDates[previewDateIndex]||'';
 const rows=validated.filter(r=>!r.errors.length&&r.workDate===date);

 $('previewOperatorName').textContent=selectedOperatorName();
 $('previewWorkDate').textContent=displayDate(date);
 $('previewStoreCount').textContent=rows.length;
 $('previewPosCount').textContent=rows.reduce((n,r)=>n+r.posCount,0);
 $('previewPhotoCount').textContent=rows.reduce((n,r)=>n+r.receiptSlots+r.storeSlots,0);

 $('workerPreviewList').innerHTML=rows.length?rows.map((r,index)=>`
  <article class="worker-preview-store">
   <button type="button" class="worker-preview-row">
    <span class="worker-preview-brand">${escapeHtml((r.brand||'RI').slice(0,3).toUpperCase())}</span>
    <span class="worker-preview-copy">
     <b>${index+1}. ${escapeHtml(r.storeName)}</b>
     <small>${escapeHtml(r.storeCode)} · ${r.posCount} POS · ${escapeHtml(RUN_MODE_LABELS[r.runMode])}</small>
    </span>
    <span class="worker-preview-chevron">⌄</span>
   </button>
   <div class="worker-preview-expanded">
    <div class="worker-preview-pos">
     ${Array.from({length:r.posCount},(_,i)=>`
      <span><b>POS${i+1}</b><i>ยอดลูกค้า</i><i>วันที่</i><i>เวลา</i></span>`).join('')}
    </div>
    <div class="worker-preview-evidence">
     <span>รูปบิลขั้นต่ำ <b>${r.receiptSlots}</b></span>
     <span>รูปร้านขั้นต่ำ <b>${r.storeSlots}</b></span>
    </div>
   </div>
  </article>`).join('')
  :'<div class="worker-preview-empty">ไม่มีงานในวันที่เลือก</div>';
}

function openWorkerPreview(){
 if(!previewDates.length)return;
 previewDateIndex=0;
 renderWorkerPreview();
 $('workerPreviewDialog').showModal();
}

function closeWorkerPreview(){
 $('workerPreviewDialog').close();
}

async function commit(){
 const s=summaryOf(validated);
 if(s.invalid||!s.valid)return;

 const c=await UI.confirm(
  'ยืนยันอัปโหลดงานรายบุคคล?',
  `ผู้ปฏิบัติงาน ${selectedOperatorName()} · ${s.stores} ร้าน · ${s.pos} POS · ${s.dates} วันทำงาน`,
  'ยืนยันอัปโหลด'
 );
 if(!c.isConfirmed)return;

 try{
  UI.loading('กำลังสร้างงาน กรุณาอย่าปิดหน้า...');
  const payloadRows=validated.map(r=>({
   Brand:r.brand,
   BusinessType:r.businessType,
   StoreCode:r.storeCode,
   StoreName:r.storeName,
   POS:r.posCount,
   OpenClose:r.openClose,
   Address:r.address,
   StoreType:r.storeType,
   Rank:r.rank,
   Latitude:r.latitude,
   Longitude:r.longitude,
   WorkDate:r.workDate,
   Note:r.note,
   ReceiptSlots:r.receiptSlots,
   StorePhotoSlots:r.storeSlots,
   CustomerRunMode:r.runMode
  }));

  const d=await Api.request('/api/admin/import/user-month/commit',{
   method:'POST',
   body:JSON.stringify({
    fileName:currentFileName||'import',
    rows:payloadRows,
    defaults:defaults(),
    operatorUserId:$('operatorUserId').value,
    workMonth:$('workMonth').value,
    defaultWorkDate:$('defaultWorkDate').value,
    roundId:$('roundId').value.trim(),
    roundName:$('roundName').value.trim()
   })
  });

  UI.close();
  $('importStatus').textContent=
   `สร้างงาน ${d.assignments||s.valid} รายการ ให้ ${d.operator?.displayName||selectedOperatorName()}`;
  await UI.success(
   'อัปโหลดงานสำเร็จ',
   `${d.stores||s.stores} ร้าน / ${d.assignments||s.valid} งาน`
  );
 }catch(e){
  UI.close();
  await UI.error('อัปโหลดไม่สำเร็จ',e.message);
 }
}

function downloadTemplate(){
 const rows=[
  ['Brand','Business Type','Store Code','Store Name','POS','Open-Close','Address','Store Type','Rank','Latitude','Longitude','Work Date','Note','Receipt Slots','Store Photo Slots','Customer Run Mode'],
  ['CJ','C-Store','CJ1161','เลียบคลองเกาะเกรียง',3,'06:00-23:00','ปทุมธานี','Stand Alone','B+','13.9631505','100.4834996','01/07/2026','ตัวอย่างข้อมูล',1,5,'CONTINUOUS'],
  ['CJ','C-Store','CJ1386','คูขวาง 6',2,'00:00-24:00','ปทุมธานี','Community','B','','','02/07/2026','',1,5,'MONTHLY_RESET']
 ];
 const csv='\uFEFF'+rows.map(row=>row.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\r\n');
 const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob);
 const a=document.createElement('a');
 a.href=url;
 a.download='RetailInsight_Monthly_Assignment_Template.csv';
 a.click();
 URL.revokeObjectURL(url);
}

$('previewBtn').onclick=preview;
$('mobilePreviewBtn').onclick=openWorkerPreview;
$('commitBtn').onclick=commit;
$('downloadTemplateBtn').onclick=downloadTemplate;
$('closeWorkerPreviewBtn').onclick=closeWorkerPreview;
$('previewPrevDayBtn').onclick=()=>{
 if(!previewDates.length)return;
 previewDateIndex=(previewDateIndex-1+previewDates.length)%previewDates.length;
 renderWorkerPreview();
};
$('previewNextDayBtn').onclick=()=>{
 if(!previewDates.length)return;
 previewDateIndex=(previewDateIndex+1)%previewDates.length;
 renderWorkerPreview();
};

$('workerPreviewDialog').addEventListener('click',e=>{
 if(e.target===$('workerPreviewDialog'))closeWorkerPreview();
});

const now=new Date();
const month=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
$('workMonth').value=month;
$('defaultWorkDate').value=`${month}-01`;
$('roundId').value=`${month}-R01`;

guard().then(loadOperators);
})();