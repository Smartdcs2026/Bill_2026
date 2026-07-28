(()=>{
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function chips(values,emptyText='ไม่พบรายการผิดปกติ'){
 if(!values?.length)return `<span class="healthy-chip">✓ ${emptyText}</span>`;
 return values.map(x=>`<span class="error-chip">${esc(x)}</span>`).join('');
}
async function load(){
 try{
  UI.loading('กำลังตรวจสอบฐานข้อมูล…');
  const d=await Api.request('/api/admin/database/health');
  UI.close();
  $('healthState').textContent=d.healthy?'พร้อมใช้งาน':'ต้องแก้ไข';
  $('healthState').className=d.healthy?'state-ok':'state-bad';
  $('tableCount').textContent=`${d.actual.tables}/${d.expected.tables}`;
  $('indexCount').textContent=`${d.actual.indexes}/${d.expected.indexes}`;
  $('checkedAt').textContent=d.checkedDisplay||'-';
  $('summary').className=`health-summary ${d.healthy?'ok':'bad'}`;
  $('summary').innerHTML=d.healthy
   ?'<b>ฐานข้อมูลตรงกับ Worker แล้ว</b><span>สามารถทดสอบ Permanent QR และ Two-Step Login ต่อได้</span>'
   :'<b>Schema ยังไม่ครบ</b><span>ให้รันไฟล์ SQL ใน database/run_in_order ตามลำดับ แล้วตรวจใหม่</span>';
  $('missingTables').innerHTML=chips(d.missingTables);
  const col=[];
  Object.entries(d.missingColumns||{}).forEach(([t,list])=>list.forEach(c=>col.push(`${t}.${c}`)));
  $('missingColumns').innerHTML=chips(col);
  $('missingIndexes').innerHTML=chips(d.missingIndexes);
  $('migrations').innerHTML=(d.migrations||[]).length
   ?d.migrations.map(x=>`<div class="migration-row"><b>${esc(x.version)}</b><span>${esc(x.name)}</span><small>${esc(x.appliedDisplay||x.appliedAt||'')}</small></div>`).join('')
   :'<span class="error-chip">ยังไม่มี Migration Registry</span>';
 }catch(e){
  UI.close();
  await UI.error('ตรวจสอบฐานข้อมูลไม่สำเร็จ',e.message);
 }
}
$('checkBtn').onclick=load;
$('menuBtn').onclick=()=>$('side').classList.toggle('open');
load();
})();