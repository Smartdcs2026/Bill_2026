(()=>{
  const root=document.getElementById('policies');
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const modes=[
    ['NO_CHECK','ไม่ตรวจ'],
    ['MONTHLY_RESET','เริ่มใหม่ทุกเดือน'],
    ['CONTINUOUS','รันต่อเนื่อง'],
    ['PER_POS','ตรวจแยกแต่ละ POS'],
    ['ROUND_RESET','เริ่มใหม่ตามรอบงาน'],
    ['ADMIN_RESET','Admin กำหนดจุดเริ่มใหม่'],
    ['WARNING_ONLY','เตือนเท่านั้น']
  ];

  async function load(){
    const r=await Api.request('/api/admin/receipt-policies');
    root.innerHTML=(r.policies||[]).map(p=>`<form class="policy-card" data-brand="${esc(p.brand_id)}">
      <h2>${esc(p.brand_code)} · ${esc(p.brand_name)}</h2>
      <label>วิธีรันยอดลูกค้า
        <select name="customerCountMode">${modes.map(x=>`<option value="${x[0]}" ${p.customer_count_mode===x[0]?'selected':''}>${x[1]}</option>`).join('')}</select>
      </label>
      <label>เมื่อยอดลดลง
        <select name="countDecreaseAction">
          <option value="ALLOW" ${p.count_decrease_action==='ALLOW'?'selected':''}>อนุญาต</option>
          <option value="WARN" ${!p.count_decrease_action||p.count_decrease_action==='WARN'?'selected':''}>เตือนและให้เหตุผล</option>
          <option value="BLOCK" ${p.count_decrease_action==='BLOCK'?'selected':''}>ห้ามส่ง</option>
        </select>
      </label>
      <div class="two">
        <label>รูปบิลขั้นต่ำ<input name="receiptMin" type="number" min="1" value="${p.receipt_min||1}"></label>
        <label>รูปร้านขั้นต่ำ<input name="storePhotoMin" type="number" min="1" value="${p.store_photo_min||1}"></label>
        <label>ย้อนหลังได้ (วัน)<input name="receiptDaysBefore" type="number" min="0" value="${p.receipt_days_before??2}"></label>
        <label>ล่วงหน้าได้ (วัน)<input name="receiptDaysAfter" type="number" min="0" value="${p.receipt_days_after??2}"></label>
      </div>
      <label>หมายเหตุนโยบาย<textarea name="policyNote">${esc(p.policy_note||'')}</textarea></label>
      <button>บันทึกแบรนด์นี้</button>
    </form>`).join('');

    root.onsubmit=async e=>{
      e.preventDefault();
      const f=e.target;
      const o=Object.fromEntries(new FormData(f));
      o.brandId=f.dataset.brand;
      o.allowPosReason=true;
      await Api.request('/api/admin/receipt-policies/save',{method:'POST',body:JSON.stringify(o)});
      alert('บันทึกแล้ว');
    };
  }

  load().catch(e=>alert(e.message));
})();
