(function(){
 const DB_NAME='RetailInsightLocal',VERSION=1;
 function open(){
  return new Promise((resolve,reject)=>{
   const r=indexedDB.open(DB_NAME,VERSION);
   r.onupgradeneeded=()=>{const db=r.result;
    if(!db.objectStoreNames.contains('drafts')){const s=db.createObjectStore('drafts',{keyPath:'assignmentId'});s.createIndex('updatedAt','updatedAt')}
    if(!db.objectStoreNames.contains('images')){const s=db.createObjectStore('images',{keyPath:'id'});s.createIndex('assignmentId','assignmentId')}
    if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta',{keyPath:'key'});
   };
   r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
 }
 async function tx(store,mode,fn){const db=await open();return new Promise((resolve,reject)=>{const t=db.transaction(store,mode),s=t.objectStore(store);let result;try{result=fn(s)}catch(e){reject(e);return}t.oncomplete=()=>resolve(result?.result??result);t.onerror=()=>reject(t.error)})}
 async function getDraft(id){const db=await open();return new Promise((resolve,reject)=>{const r=db.transaction('drafts').objectStore('drafts').get(id);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error)})}
 async function saveDraft(d){return tx('drafts','readwrite',s=>s.put({...d,updatedAt:new Date().toISOString(),state:d.state||'LOCAL_DRAFT'}))}
 async function deleteDraft(id){return tx('drafts','readwrite',s=>s.delete(id))}
 async function listDrafts(){const db=await open();return new Promise((resolve,reject)=>{const r=db.transaction('drafts').objectStore('drafts').getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error)})}
 async function saveImage(img){return tx('images','readwrite',s=>s.put(img))}
 async function listImages(assignmentId){const db=await open();return new Promise((resolve,reject)=>{const r=db.transaction('images').objectStore('images').index('assignmentId').getAll(assignmentId);r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error)})}
 async function deleteImage(id){return tx('images','readwrite',s=>s.delete(id))}
 async function storageStatus(){const e=await navigator.storage?.estimate?.();return {usage:e?.usage||0,quota:e?.quota||0,persisted:await navigator.storage?.persisted?.()||false}}
 async function requestPersistence(){return navigator.storage?.persist?.()||false}
 window.LocalDraftDB={getDraft,saveDraft,deleteDraft,listDrafts,saveImage,listImages,deleteImage,storageStatus,requestPersistence};
})();