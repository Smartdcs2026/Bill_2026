(function(){
 'use strict';
 const DB_NAME='RetailInsightLocal',VERSION=3;
 function open(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,VERSION);r.onupgradeneeded=()=>{const db=r.result;
  if(!db.objectStoreNames.contains('drafts')){const s=db.createObjectStore('drafts',{keyPath:'assignmentId'});s.createIndex('updatedAt','updatedAt')}
  if(!db.objectStoreNames.contains('images')){const s=db.createObjectStore('images',{keyPath:'id'});s.createIndex('assignmentId','assignmentId');s.createIndex('state','state')}
  if(!db.objectStoreNames.contains('assignments'))db.createObjectStore('assignments',{keyPath:'key'});
  if(!db.objectStoreNames.contains('locations')){const s=db.createObjectStore('locations',{keyPath:'id'});s.createIndex('assignmentId','assignmentId');s.createIndex('state','state')}
  if(!db.objectStoreNames.contains('queue')){const s=db.createObjectStore('queue',{keyPath:'id'});s.createIndex('state','state');s.createIndex('assignmentId','assignmentId')}
  if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta',{keyPath:'key'});
 };r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
 async function request(store,mode,make){const db=await open();return new Promise((resolve,reject)=>{const t=db.transaction(store,mode),s=t.objectStore(store),r=make(s);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
 const now=()=>new Date().toISOString();
 const getDraft=id=>request('drafts','readonly',s=>s.get(id)).then(v=>v||null);
 const saveDraft=d=>request('drafts','readwrite',s=>s.put({...d,updatedAt:now(),state:d.state||'LOCAL_DRAFT'}));
 const deleteDraft=id=>request('drafts','readwrite',s=>s.delete(id));
 const listDrafts=()=>request('drafts','readonly',s=>s.getAll()).then(v=>v||[]);
 const saveImage=img=>request('images','readwrite',s=>s.put({...img,state:img.state||'LOCAL_ONLY',updatedAt:now()}));
 const listImages=assignmentId=>request('images','readonly',s=>s.index('assignmentId').getAll(assignmentId)).then(v=>v||[]);
 const listPendingImages=()=>request('images','readonly',s=>s.getAll()).then(v=>(v||[]).filter(x=>!['UPLOADED','VERIFIED'].includes(x.state)));
 const getImage=id=>request('images','readonly',s=>s.get(id)).then(v=>v||null);
 const updateImage=(id,patch)=>getImage(id).then(v=>v?saveImage({...v,...patch,id}):null);
 const deleteImage=id=>request('images','readwrite',s=>s.delete(id));
 const removeQueueByImage=async imageId=>{const rows=await listQueue();let removed=0;for(const q of rows.filter(x=>String(x.imageId||x.payload?.imageId||'')===String(imageId))){await removeQueue(q.id);removed++}return removed};
 const deleteImageSafely=async id=>{const image=await getImage(id);if(!image)return {deleted:false,removedQueue:0};const removedQueue=await removeQueueByImage(id);await deleteImage(id);return {deleted:true,removedQueue,assignmentId:image.assignmentId}};
 const saveAssignments=(items,userKey='default')=>request('assignments','readwrite',s=>s.put({key:userKey,items,updatedAt:now()}));
 const getAssignments=(userKey='default')=>request('assignments','readonly',s=>s.get(userKey)).then(v=>v||null);
 const saveLocation=loc=>request('locations','readwrite',s=>s.put({...loc,state:loc.state||'QUEUED',updatedAt:now()}));
 const getLocation=id=>request('locations','readonly',s=>s.get(id)).then(v=>v||null);
 const updateLocation=(id,patch)=>getLocation(id).then(v=>v?saveLocation({...v,...patch,id}):null);
 const listLocations=assignmentId=>request('locations','readonly',s=>s.index('assignmentId').getAll(assignmentId)).then(v=>v||[]);
 const enqueue=item=>request('queue','readwrite',s=>s.put({...item,id:item.id||crypto.randomUUID(),state:item.state||'QUEUED',createdAt:item.createdAt||now(),updatedAt:now()}));
 const getQueue=id=>request('queue','readonly',s=>s.get(id)).then(v=>v||null);
 const updateQueue=(id,patch)=>getQueue(id).then(v=>v?request('queue','readwrite',s=>s.put({...v,...patch,id,updatedAt:now()})):null);
 const listQueue=()=>request('queue','readonly',s=>s.getAll()).then(v=>v||[]);
 const listFailedQueue=()=>listQueue().then(v=>(v||[]).filter(x=>x.state==='FAILED'));
 const resetFailedQueue=async(assignmentId='')=>{const rows=await listFailedQueue();for(const row of rows.filter(x=>!assignmentId||String(x.assignmentId)===String(assignmentId)))await updateQueue(row.id,{state:'QUEUED',nextRetryAt:null,lastError:null});return true};
 const removeQueue=id=>request('queue','readwrite',s=>s.delete(id));
 const setMeta=(key,value)=>request('meta','readwrite',s=>s.put({key,value,updatedAt:now()}));
 const getMeta=key=>request('meta','readonly',s=>s.get(key)).then(v=>v?.value??null);
 async function storageStatus(){const e=await navigator.storage?.estimate?.();return{usage:e?.usage||0,quota:e?.quota||0,persisted:await navigator.storage?.persisted?.()||false}}
 const requestPersistence=()=>navigator.storage?.persist?.()||false;
 const allFrom=store=>request(store,'readonly',s=>s.getAll()).then(v=>v||[]);
 async function exportSnapshot(userKey='field'){
  const [drafts,images,assignments,locations,queue,meta]=await Promise.all(['drafts','images','assignments','locations','queue','meta'].map(allFrom));
  return {format:'RetailInsightLocalBackup',version:1,exportedAt:now(),userKey,data:{drafts,images:images.map(x=>({...x,blob:null,blobMeta:x.blob?{type:x.blob.type||'',size:x.blob.size||0}:null})),assignments,locations,queue,meta}};
 }
 function queueSignature(q){const p=q?.payload||{};return [q?.type||'',q?.assignmentId||'',p.imageId||p.locationId||p.clientSubmissionId||p.id||q?.referenceId||''].join('::')}
 async function repairQueue(){
  const rows=await listQueue(),active=rows.filter(x=>x.state!=='DONE'),seen=new Map();let removedDuplicates=0,removedDone=0,removedMissingImages=0;
  for(const row of active.sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')))){
   if(row.type==='IMAGE_UPLOAD'){
    const imageId=row.imageId||row.payload?.imageId;
    if(!imageId||!(await getImage(imageId))){await removeQueue(row.id);removedMissingImages++;continue}
   }
   const sig=queueSignature(row);if(!sig.endsWith('::')&&seen.has(sig)){await removeQueue(row.id);removedDuplicates++}else seen.set(sig,row.id);
  }
  const cutoff=Date.now()-7*864e5;
  for(const row of rows.filter(x=>x.state==='DONE')){const t=new Date(row.updatedAt||row.createdAt||0).getTime();if(t&&t<cutoff){await removeQueue(row.id);removedDone++}}
  return {removedDuplicates,removedDone,removedMissingImages,activeAfter:(await listQueue()).filter(x=>x.state!=='DONE').length};
 }
 async function localCounts(){const [drafts,images,locations,queue]=await Promise.all(['drafts','images','locations','queue'].map(allFrom));return{drafts:drafts.length,images:images.length,locations:locations.length,queue:queue.filter(x=>x.state!=='DONE').length}}
 function validBackup(snapshot){return snapshot&&snapshot.format==='RetailInsightLocalBackup'&&Number(snapshot.version)===1&&snapshot.data&&typeof snapshot.data==='object'}
 function newerOrEqual(incoming,current){const a=new Date(incoming?.updatedAt||incoming?.createdAt||0).getTime(),b=new Date(current?.updatedAt||current?.createdAt||0).getTime();return !current||!b||a>=b}
 async function importSnapshot(snapshot,userKey='field'){
  if(!validBackup(snapshot))throw new Error('รูปแบบไฟล์สำรองไม่ถูกต้อง');
  if(String(snapshot.userKey||'')!==String(userKey||''))throw new Error('ไฟล์สำรองเป็นของผู้ใช้งานคนอื่น');
  const data=snapshot.data||{},result={drafts:0,assignments:0,locations:0,queue:0,skippedImages:0,skippedQueue:0,olderSkipped:0};
  for(const incoming of Array.isArray(data.drafts)?data.drafts:[]){
   if(!incoming?.assignmentId)continue;const current=await getDraft(incoming.assignmentId);if(newerOrEqual(incoming,current)){await saveDraft({...incoming,state:incoming.state||'LOCAL_DRAFT'});result.drafts++}else result.olderSkipped++;
  }
  const assignmentRows=(Array.isArray(data.assignments)?data.assignments:[]).filter(x=>String(x?.key||'')===String(userKey));
  if(assignmentRows.length){const incoming=assignmentRows.sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')))[0],current=await getAssignments(userKey);if(newerOrEqual(incoming,current)){await saveAssignments(Array.isArray(incoming.items)?incoming.items:[],userKey);result.assignments=Array.isArray(incoming.items)?incoming.items.length:0}else result.olderSkipped++}
  for(const incoming of Array.isArray(data.locations)?data.locations:[]){
   if(!incoming?.id||!incoming?.assignmentId)continue;const current=await getLocation(incoming.id);if(newerOrEqual(incoming,current)){await saveLocation(incoming);result.locations++}else result.olderSkipped++;
  }
  result.skippedImages=(Array.isArray(data.images)?data.images:[]).length;
  for(const incoming of Array.isArray(data.queue)?data.queue:[]){
   if(!incoming?.id||!incoming?.assignmentId||incoming.state==='DONE')continue;
   if(incoming.type==='IMAGE_UPLOAD'){
    const imageId=incoming.imageId||incoming.payload?.imageId;if(!imageId||!(await getImage(imageId))){result.skippedQueue++;continue}
   }
   const current=await getQueue(incoming.id);if(newerOrEqual(incoming,current)){await enqueue({...incoming,state:incoming.state==='PROCESSING'?'QUEUED':incoming.state,nextRetryAt:null});result.queue++}else result.olderSkipped++;
  }
  await setMeta('last_restore_at',now());return result;
 }
 window.LocalDraftDB={getDraft,saveDraft,deleteDraft,listDrafts,saveImage,getImage,updateImage,listImages,listPendingImages,deleteImage,deleteImageSafely,removeQueueByImage,saveAssignments,getAssignments,saveLocation,getLocation,updateLocation,listLocations,enqueue,getQueue,updateQueue,listQueue,listFailedQueue,resetFailedQueue,removeQueue,setMeta,getMeta,storageStatus,requestPersistence,exportSnapshot,importSnapshot,repairQueue,localCounts};
})();
