(function(){
 const TZ='Asia/Bangkok';
 function pad(v){return String(v).padStart(2,'0')}
 function formatDateTime(value){
  if(!value)return '';
  const d=value instanceof Date?value:new Date(value);
  if(Number.isNaN(d.getTime()))return String(value);
  const p=new Intl.DateTimeFormat('en-GB',{timeZone:TZ,day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false})
   .formatToParts(d).reduce((a,x)=>(a[x.type]=x.value,a),{});
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}:${p.second}`;
 }
 function combineThai(dateValue,timeValue){
  if(!dateValue||!timeValue)return '';
  const [y,m,d]=dateValue.split('-'),parts=timeValue.split(':');
  return `${d}/${m}/${y} ${pad(parts[0])}:${pad(parts[1])}:${pad(parts[2]||0)}`;
 }
 window.DateTH={formatDateTime,combineThai,timeZone:TZ,format:'dd/MM/yyyy HH:mm:ss'};
})();