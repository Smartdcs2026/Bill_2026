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
 const removeQueue=id=>request('queue','readwrite',s=>s.delete(id));
 const setMeta=(key,value)=>request('meta','readwrite',s=>s.put({key,value,updatedAt:now()}));
 const getMeta=key=>request('meta','readonly',s=>s.get(key)).then(v=>v?.value??null);
 async function storageStatus(){const e=await navigator.storage?.estimate?.();return{usage:e?.usage||0,quota:e?.quota||0,persisted:await navigator.storage?.persisted?.()||false}}
 const requestPersistence=()=>navigator.storage?.persist?.()||false;
 window.LocalDraftDB={getDraft,saveDraft,deleteDraft,listDrafts,saveImage,getImage,updateImage,listImages,listPendingImages,deleteImage,saveAssignments,getAssignments,saveLocation,getLocation,updateLocation,listLocations,enqueue,getQueue,updateQueue,listQueue,removeQueue,setMeta,getMeta,storageStatus,requestPersistence};
})();
