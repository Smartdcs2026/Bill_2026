(()=>{
const $=id=>document.getElementById(id);
async function login(){
 const username=$('username').value.trim(),password=$('password').value;
 if(!username||!password)return UI.error('ข้อมูลไม่ครบ','กรุณากรอก Username และรหัสผ่าน');
 try{UI.loading('กำลังเข้าสู่ระบบ...');const d=await Api.request('/api/staff/login',{method:'POST',body:JSON.stringify({username,password,portal:window.LOGIN_PORTAL})});Api.saveSession(d);UI.close();await UI.success('เข้าสู่ระบบสำเร็จ',`ยินดีต้อนรับ ${d.user.displayName}`);location.href=window.LOGIN_TARGET}
 catch(e){UI.close();UI.error('เข้าสู่ระบบไม่สำเร็จ',e.message)}
}
$('loginBtn').addEventListener('click',login);$('password').addEventListener('keydown',e=>{if(e.key==='Enter')login()});
const b=$('bootstrapBtn');if(b)b.addEventListener('click',async()=>{
 const r=await UI.fire({title:'ตั้งค่า Admin ครั้งแรก / กู้คืน',html:'<input id="sw-token" class="swal2-input" type="password" placeholder="Bootstrap Token"><input id="sw-name" class="swal2-input" placeholder="ชื่อ Admin"><input id="sw-user" class="swal2-input" placeholder="Username"><input id="sw-code" class="swal2-input" placeholder="รหัสพนักงาน (ถ้ามี)"><input id="sw-pass" class="swal2-input" type="password" placeholder="รหัสผ่านใหม่อย่างน้อย 10 ตัว">',showCancelButton:true,confirmButtonText:'สร้าง/กู้คืน Admin',cancelButtonText:'ยกเลิก',preConfirm:()=>({token:document.getElementById('sw-token').value,displayName:document.getElementById('sw-name').value,username:document.getElementById('sw-user').value,employeeCode:document.getElementById('sw-code').value,password:document.getElementById('sw-pass').value})});
 if(!r.isConfirmed)return;
 try{UI.loading('กำลังตั้งค่าบัญชี Admin...');const x=await Api.request('/api/bootstrap/admin',{method:'POST',headers:{'X-Admin-Bootstrap-Token':r.value.token},body:JSON.stringify(r.value)});UI.close();UI.success('ดำเนินการสำเร็จ',x.message)}
 catch(e){UI.close();UI.error('ดำเนินการไม่สำเร็จ',e.message)}
});
})();