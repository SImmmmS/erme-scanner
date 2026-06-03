/**
 * app.js
 * ไฟล์หลักเชื่อมต่อระหว่าง UI และ SlipVerifier
 */

let slipVerifier = null;

document.addEventListener('DOMContentLoaded', () => {
  try {
    slipVerifier = new SlipVerifier(false);
    window.slipVerifier = slipVerifier;
    setupButtons();
  } catch (error) {
    const msg = error.message ? error.message : "ระบบทำงานผิดพลาด";
    showErrorState(msg);
  }
});

function showErrorState(message) {
  const safeMessage = (message && typeof message === 'string') ? message : "ไม่สามารถระบุสาเหตุได้";
  const errorHtml = 
    '<div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: #f8fafc; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 9999; font-family: sans-serif; padding: 20px;">' +
      '<div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); text-align: center;">' +
        '<h3 style="color: #dc2626; margin-bottom: 15px;">ระบบแจ้งเตือนข้อผิดพลาด</h3>' +
        '<p style="color: #64748b; margin-bottom: 25px;">' + safeMessage + '</p>' +
        '<button onclick="location.reload()" style="background: #2563eb; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 16px;">ลองใหม่</button>' +
      '</div>' +
    '</div>';
  document.body.insertAdjacentHTML('beforeend', errorHtml);
}

function setupButtons() {
  const toggleRawDataBtn = document.getElementById('toggle-raw-data');
  const rawDataContent = document.getElementById('raw-data-content');

  if (toggleRawDataBtn && rawDataContent) {
    toggleRawDataBtn.addEventListener('click', () => {
      const isHidden = rawDataContent.style.display === 'none' || rawDataContent.style.display === '';
      rawDataContent.style.display = isHidden ? 'block' : 'none';
    });
  }

  const copyDataBtn = document.getElementById('copy-data-btn');
  if (copyDataBtn) {
    copyDataBtn.addEventListener('click', () => {
      if (slipVerifier && slipVerifier.currentSlipData) {
        const data = slipVerifier.currentSlipData;
        const text = "ยอดเงิน: " + data.amount + "\nวันที่: " + data.datetime;
        navigator.clipboard.writeText(text);
        alert('คัดลอกข้อมูลแล้ว');
      }
    });

    // สร้างปุ่มบันทึกลง ERme
    const saveErmeBtn = document.createElement('button');
    saveErmeBtn.className = 'btn btn-primary';
    saveErmeBtn.style.backgroundColor = '#00c300';
    saveErmeBtn.style.color = 'white';
    saveErmeBtn.style.marginTop = '10px';
    saveErmeBtn.innerHTML = '<i class="bi bi-cloud-arrow-up"></i> บันทึกลงบัญชี ERme';
    
    saveErmeBtn.addEventListener('click', async () => {
      if (!slipVerifier || !slipVerifier.currentSlipData) {
        alert('ไม่มีข้อมูลสำหรับบันทึก');
        return;
      }

      const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzYTTZuYODNuBGZ6ksk4smqgStgiJ42ilxpyEdjhbXPDTYcBR646E06150rpxNCVF-rBg/exec";
      const data = slipVerifier.currentSlipData;
      let amountStr = data.amount ? String(data.amount).replace(/,/g, '').replace(' บาท', '').trim() : "0";

      const payload = {
        action: "save_slip_from_frontend",
        amount: amountStr, 
        datetime: data.datetime || "-",
        sender: data.sender || "-",
        receiver: data.receiver || "-"
      };

      saveErmeBtn.innerHTML = 'กำลังบันทึก...';
      saveErmeBtn.disabled = true;

      try {
        const response = await fetch(GAS_WEB_APP_URL, { method: "POST", body: JSON.stringify(payload) });
        const result = await response.json();
        
        if (result.status === "success") {
          alert("✅ บันทึกลงบัญชี ERme เรียบร้อยแล้ว!");
        } else {
          alert("❌ เกิดข้อผิดพลาด: " + result.message);
        }
      } catch (e) {
        alert("❌ ไม่สามารถเชื่อมต่อฐานข้อมูลได้");
      } finally {
        saveErmeBtn.innerHTML = '<i class="bi bi-cloud-arrow-up"></i> บันทึกลงบัญชี ERme';
        saveErmeBtn.disabled = false;
      }
    });

    copyDataBtn.parentNode.insertBefore(saveErmeBtn, copyDataBtn.nextSibling);
  }
}
