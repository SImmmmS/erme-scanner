/**
 * app.js
 * ไฟล์หลักสำหรับเริ่มต้นแอปพลิเคชัน
 */

let slipVerifier = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    showLoadingState();
    
    // ปิดการเช็คเบราว์เซอร์ที่เข้มงวดเกินไป เพื่อให้ทำงานบน LINE LIFF ได้
    checkBrowserSupport();

    const urlParams = new URLSearchParams(window.location.search);
    const debugMode = urlParams.get('debug') === 'true';

    slipVerifier = new SlipVerifier(debugMode);
    window.slipVerifier = slipVerifier;

    hideLoadingState();
  } catch (error) {
    console.error('Failed to start application:', error);
    showErrorState(error.message);
  }
});

/**
 * ยกเลิกการเช็คที่ทำให้เกิด Error ใน LINE
 */
function checkBrowserSupport() {
  console.log('Browser check bypassed for LINE compatibility');
  return true; 
}

function showLoadingState() {
  const loadingHtml = `
        <div id="app-loading" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(248, 250, 252, 0.95); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 9999;">
            <div style="width: 50px; height: 50px; border: 4px solid #e2e8f0; border-top: 4px solid #00c300; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 20px;"></div>
            <h3 style="color: #00c300; margin-bottom: 10px;">กำลังเริ่มต้นระบบ...</h3>
        </div>
        <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
    `;
  document.body.insertAdjacentHTML('beforeend', loadingHtml);
}

function hideLoadingState() {
  const loadingElement = document.getElementById('app-loading');
  if (loadingElement) {
    loadingElement.style.opacity = '0';
    setTimeout(() => loadingElement.remove(), 300);
  }
}

function showErrorState(message) {
  hideLoadingState();
  const errorHtml = `
        <div id="app-error" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(248, 250, 252, 0.95); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 9999; text-align: center; padding: 20px;">
            <h3 style="color: #dc2626; margin-bottom: 15px;">เกิดข้อผิดพลาด</h3>
            <p style="color: #64748b; margin-bottom: 25px;">กรุณารีเฟรชหน้าจอใหม่อีกครั้ง</p>
            <button onclick="location.reload()" style="background: #00c300; color: white; border: none; padding: 12px 24px; border-radius: 8px;">ลองใหม่</button>
        </div>
    `;
  document.body.insertAdjacentHTML('beforeend', errorHtml);
}

window.addEventListener('beforeunload', async () => {
  if (slipVerifier && typeof slipVerifier.destroy === 'function') {
    await slipVerifier.destroy();
  }
});

function hideAllSections() {
  const sections = ['upload-section', 'camera-section', 'qr-section', 'processing-section', 'results-section', 'error-section'];
  sections.forEach(sectionId => {
    const section = document.getElementById(sectionId);
    if (section) section.style.display = 'none';
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const toggleRawDataBtn = document.getElementById('toggle-raw-data');
  const rawDataContent = document.getElementById('raw-data-content');

  if (toggleRawDataBtn && rawDataContent) {
    toggleRawDataBtn.addEventListener('click', () => {
      const isExpanded = toggleRawDataBtn.getAttribute('data-expanded') === 'true';
      if (isExpanded) {
        rawDataContent.style.display = 'none';
        toggleRawDataBtn.setAttribute('data-expanded', 'false');
      } else {
        rawDataContent.style.display = 'block';
        toggleRawDataBtn.setAttribute('data-expanded', 'true');
      }
    });
  }

  const copyDataBtn = document.getElementById('copy-data-btn');
  if (copyDataBtn) {
    // ซ่อนปุ่มคัดลอกทิ้งไปเลย เพื่อไม่ให้กวนใจในแอป LINE
    copyDataBtn.style.display = 'none';
    
    // สร้างปุ่มบันทึกลง ERme ขึ้นมาแทนที่
    if (!document.getElementById('save-erme-btn')) {
      const saveErmeBtn = document.createElement('button');
      saveErmeBtn.id = 'save-erme-btn';
      saveErmeBtn.style.cssText = 'background-color: #00c300; color: white; width: 100%; border: none; padding: 12px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 16px; margin-top: 10px;';
      saveErmeBtn.innerHTML = '<i class="bi bi-cloud-arrow-up"></i> บันทึกลงบัญชี ERme';
      
      saveErmeBtn.addEventListener('click', () => {
        if (window.slipVerifier && window.slipVerifier.currentSlipData) {
          sendDataToERme(window.slipVerifier.currentSlipData);
        }
      });
      
      copyDataBtn.parentNode.insertBefore(saveErmeBtn, copyDataBtn.nextSibling);
    }
  }
});

// ฟังก์ชันยิงข้อมูลเข้า Google Sheets
async function sendDataToERme(parsedSlipData) {
  const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzYTTZuYODNuBGZ6ksk4smqgStgiJ42ilxpyEdjhbXPDTYcBR646E06150rpxNCVF-rBg/exec";
  
  let amountStr = parsedSlipData.amount ? String(parsedSlipData.amount).replace(/,/g, '') : "0";
  
  const payload = {
    action: "save_slip_from_frontend",
    amount: amountStr, 
    datetime: parsedSlipData.datetime || "ไม่ระบุ",
    sender: parsedSlipData.sender || "-",
    receiver: parsedSlipData.receiver || "-"
  };

  const btn = document.getElementById('save-erme-btn');

  try {
    if(btn) {
      btn.innerHTML = 'กำลังบันทึกข้อมูล...';
      btn.disabled = true;
    }

    const response = await fetch(GAS_WEB_APP_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    if (result.status === "success") {
      alert("✅ บันทึกลงบัญชี ERme เรียบร้อยแล้ว!");
      // ปิดหน้า LIFF อัตโนมัติเมื่อบันทึกเสร็จ (ฟีเจอร์ของ LINE)
      if (typeof liff !== 'undefined' && liff.isInClient()) {
        liff.closeWindow();
      }
    } else {
      alert("❌ เกิดข้อผิดพลาด: " + result.message);
    }
    
  } catch (error) {
    alert("❌ ไม่สามารถเชื่อมต่อกับฐานข้อมูลได้");
  } finally {
    if(btn) {
      btn.innerHTML = '<i class="bi bi-cloud-arrow-up"></i> บันทึกลงบัญชี ERme';
      btn.disabled = false;
    }
  }
}
