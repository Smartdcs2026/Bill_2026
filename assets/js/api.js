(function(){
  const cfg=window.APP_CONFIG;
  async function request(path,options={}){
    const headers=new Headers(options.headers||{});
    if(options.body&&!headers.has('Content-Type'))headers.set('Content-Type','application/json');
    const session=localStorage.getItem('csi_session_token');
    if(session)headers.set('Authorization',`Bearer ${session}`);
    let res;
    try{res=await fetch(`${cfg.API_BASE_URL}${path}`,{...options,headers})}
    catch(e){throw new Error('ไม่สามารถเชื่อมต่อระบบได้ กรุณาตรวจสอบอินเทอร์เน็ต')}
    const data=await res.json().catch(()=>({ok:false,error:'INVALID_JSON',message:'ระบบตอบกลับไม่ถูกต้อง'}));
    if(res.status===401&&session&&path!=='/api/staff/login'){localStorage.removeItem('csi_session_token');localStorage.removeItem('csi_user')}
    if(!res.ok||data.ok===false)throw new Error(data.message||data.error||`HTTP_${res.status}`);
    return data;
  }
  function saveSession(data){localStorage.setItem('csi_session_token',data.sessionToken);localStorage.setItem('csi_user',JSON.stringify(data.user||{}))}
  function user(){try{return JSON.parse(localStorage.getItem('csi_user')||'null')}catch{return null}}
  async function logout(){try{await request('/api/staff/logout',{method:'POST'})}catch(_){}localStorage.removeItem('csi_session_token');localStorage.removeItem('csi_user')}
  window.Api={request,saveSession,user,logout};
})();