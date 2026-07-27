(function(){
 function fallback(type,title,text){
  if(type==='confirm')return Promise.resolve({isConfirmed:window.confirm(`${title}\n${text||''}`)});
  window.alert(`${title}${text?'\n'+text:''}`);return Promise.resolve({isConfirmed:true});
 }
 const UI={
  fire(o){return window.Swal?Swal.fire(o):fallback(o.showCancelButton?'confirm':o.icon,o.title,o.text)},
  success(title,text=''){return UI.fire({icon:'success',title,text,confirmButtonText:'ตกลง'})},
  error(title,text=''){return UI.fire({icon:'error',title,text,confirmButtonText:'ตกลง'})},
  info(title,text=''){return UI.fire({icon:'info',title,text,confirmButtonText:'ตกลง'})},
  confirm(title,text='',confirmButtonText='ยืนยัน'){return UI.fire({icon:'question',title,text,showCancelButton:true,confirmButtonText,cancelButtonText:'ยกเลิก',reverseButtons:true})},
  loading(title='กำลังประมวลผล...'){if(window.Swal)Swal.fire({title,allowOutsideClick:false,allowEscapeKey:false,didOpen:()=>Swal.showLoading()})},
  close(){if(window.Swal)Swal.close()}
 };
 window.UI=UI;
})();