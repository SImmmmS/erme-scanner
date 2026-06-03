/**
 * app.js
 * ไฟล์หลักสำหรับเริ่มต้นแอปพลิเคชัน (ฉบับแก้บั๊กและเพิ่มปุ่มบันทึก ERme สมบูรณ์แบบ)
 */

let slipVerifier = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('Starting Slip Verifier Application...');
    showLoadingState();
    checkBrowserSupport();

    const urlParams = new URLSearchParams(window.location.search);
    const debugMode = urlParams.get('debug') === 'true';

    slipVerifier = new SlipVerifier(debugMode);
    window.slipVerifier = slipVerifier;

    hideLoadingState();
    console.log('Slip Verifier Application started successfully');

  } catch (error) {
    console.error('Failed to start application:', error);
    // ดึง error ออกมาแบบ String ป้องกันบั๊ก
    const errorMsg = error.message ? error.message : "ระบบทำงานผิดพลาด";
    showErrorState(errorMsg);
  }
});

function checkBrowserSupport() {
  const requiredFeatures = ['navigator.mediaDevices', 'navigator.clipboard', 'FileReader', 'URL.createObjectURL'];
  const missingFeatures = requiredFeatures.filter(feature => {
    try { return !eval(feature); } catch (e) { return true; }
  });

  if (missingFeatures.length > 0) {
    throw new Error("เบราว์เซอร์ไม่รองรับฟีเจอร์: " + missingFeatures.join(', '));
  }
}

function showLoadingState() {
  const loadingHtml = 
    '<div id="app-loading" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(248, 250, 252, 0.95); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 9999; font-family: \'Kanit\', sans-serif;">' +
      '<div class="loading-spinner" style="width: 60px; height: 60px; border: 4px solid #e2e8f0; border-top: 4px solid #2563eb; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 20px;"></div>' +
      '<h3 style="color: #2563eb; margin-bottom: 10px; font-weight: 600;">กำลังเริ่มต้นระบบ</h3>' +
      '<p style="color: #64748b; text-align: center;">กำลังโหลดระบบตรวจสอบสลิปการโอนเงิน<br>กรุณารอสักครู่...</p>' +
    '</div>' +
    '<style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>';

  document.body.insertAdjacentHTML('beforeend', loadingHtml);
}

function hideLoadingState() {
  const loadingElement = document.getElementById('app-loading');
  if (loadingElement) {
    loadingElement.style.opacity = '0';
    setTimeout(() => loadingElement.remove(), 300);
  }
}

// ------------------------------------------------------------------
// ฟังก์ชันนี้แก้บั๊ก ${message} เรียบร้อยแล้ว (ใช้วิธีต่อ String)
// ------------------------------------------------------------------
function showErrorState(message) {
  hideLoadingState();
  const safeMessage = (message && typeof message === 'string') ? message : "ไม่สามารถระบุสาเหตุได้";

  const errorHtml = 
    '<div id="app-error" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(248, 250, 252, 0.95); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 9999; font-family: \'Kanit\', sans-serif; text-align: center; padding: 20px;">' +
      '<div style="background: white; padding: 40px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); max-width: 500px;">' +
        '<div style="font-size: 4rem; color: #dc2626; margin-bottom: 20px;"><i class="bi bi-exclamation-triangle"></i></div>' +
        '<h3 style="color: #dc2626; margin-bottom: 15px; font-weight: 600;">ระบบแจ้งเตือนข้อผิดพลาด</h3>' +
        '<p style="color: #64748b; margin-bottom: 25px; line-height: 1.6; font-weight: bold;">' + safeMessage + '</p>' +
        '<button onclick="location.reload()" style="background: #2563eb; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-family: \'Kanit\', sans-serif; font-weight: 500; cursor: pointer; font-size: 16px;">' +
        '<i class="bi bi-arrow-counterclockwise"></i> ลองใหม่</button>' +
      '</div>' +
    '</div>';

  document.body.insertAdjacentHTML('beforeend', errorHtml);
}

window.addEventListener('beforeunload', async () => {
  if (slipVerifier && typeof slipVerifier.destroy === 'function') {
    await slipVerifier.destroy();
  }
});

window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  if (slipVerifier) slipVerifier.showToast('เกิดข้อผิดพลาดที่ไม่คาดคิด', 'error');
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  if (slipVerifier) slipVerifier.showToast('เกิดข้อผิดพลาดในการประมวลผล', 'error');
  event.preventDefault();
});

window.addEventListener('online', () => {
  if (slipVerifier) slipVerifier.showToast('เชื่อมต่ออินเทอร์เน็ตแล้ว', 'success');
});

window.addEventListener('offline', () => {
  if (slipVerifier) slipVerifier.showToast('ไม่มีการเชื่อมต่ออินเทอร์เน็ต', 'warning');
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
      const icon = toggleRawDataBtn.querySelector('i');
      const text = toggleRawDataBtn.querySelector('.toggle-text');

      if (isExpanded) {
        rawDataContent.style.display = 'none';
        toggleRawDataBtn.setAttribute('data-expanded', 'false');
        icon.className = 'bi bi-chevron-down';
        text.textContent = 'แสดงข้อมูลดิบ';
      } else {
        rawDataContent.style.display = 'block';
        toggleRawDataBtn.setAttribute('data-expanded', 'true');
        icon.className = 'bi bi-chevron-up';
        text.textContent = 'ซ่อนข้อมูลดิบ';
      }
    });
  }

  const copyRawBtn = document.getElementById('copy-raw-btn');
  if (copyRawBtn) copyRawBtn.addEventListener('click', copyRawData);

  const copyDataBtn = document.getElementById('copy-data-btn');
  if (copyDataBtn) {
    copyDataBtn.addEventListener('click', copySlipData);
    
    // =========================================================================
    // สร้างปุ่ม "บันทึกลงบัญชี ERme" แบบอัตโนมัติ
    // =========================================================================
    if (!document.getElementById('save-erme-btn')) {
      const saveErmeBtn = document.createElement('button');
      saveErmeBtn.id = 'save-erme-btn';
      saveErmeBtn.className = copyDataBtn.className || 'btn btn-primary';
      saveErmeBtn.style.cssText = copyDataBtn.style.cssText;
      saveErmeBtn.style.backgroundColor = '#00c300'; // สีเขียว LINE
      saveErmeBtn.style.color = 'white';
      saveErmeBtn.style.marginTop = '10px';
      saveErmeBtn.style.width = '100%';
      saveErmeBtn.style.border = 'none';
      saveErmeBtn.style.padding = '10px';
      saveErmeBtn.style.borderRadius = '8px';
      saveErmeBtn.style.fontWeight = 'bold';
      saveErmeBtn.style.cursor = 'pointer';
      saveErmeBtn.innerHTML = '<i class="bi bi-cloud-arrow-up"></i> บันทึกลงบัญชี ERme';
      
      saveErmeBtn.addEventListener('click', () => {
        if (window.slipVerifier && window.slipVerifier.currentSlipData) {
          sendDataToERme(window.slipVerifier.currentSlipData);
        } else {
          window.slipVerifier.showToast('ไม่มีข้อมูลสลิปสำหรับบันทึก', 'warning');
        }
      });
      
      copyDataBtn.parentNode.insertBefore(saveErmeBtn, copyDataBtn.nextSibling);
    }
  }
});

// ฟังก์ชันคัดลอก (เปลี่ยนมาใช้ต่อ String ธรรมดาเพื่อความปลอดภัยสูงสุด)
async function copySlipData() {
  try {
    if (!slipVerifier || !slipVerifier.currentSlipData) throw new Error('ไม่มีข้อมูลสลิปให้คัดลอก');

    const data = slipVerifier.currentSlipData;
    const formattedData = 
      "ข้อมูลสลิปการโอนเงิน\n===================\n" +
      "ธนาคาร: " + (data.bank?.name || '-') + "\n" +
      "จำนวนเงิน: " + (SlipParser.formatAmount ? SlipParser.formatAmount(data.amount) : data.amount) + "\n" +
      "วันที่-เวลา: " + (SlipParser.formatDateTime ? SlipParser.formatDateTime(data.datetime) : data.datetime) + "\n" +
      "ผู้โอน: " + (data.sender || '-') + "\n" +
      "ผู้รับ: " + (data.receiver || '-') + "\n" +
      "รหัสอ้างอิง: " + (data.reference || '-') + "\n\n" +
      "สร้างโดยระบบตรวจสอบสลิป\nเวลา: " + new Date().toLocaleString('th-TH');

    await navigator.clipboard.writeText(formattedData);
    slipVerifier.showToast('คัดลอกข้อมูลแล้ว', 'success');
  } catch (error) {
    console.error('Copy slip data failed:', error);
    slipVerifier.showToast('ไม่สามารถคัดลอกข้อมูลได้', 'error');
  }
}

async function copyRawData() {
  try {
    if (!slipVerifier || !slipVerifier.ocrProcessor) throw new Error('ไม่มีข้อมูล OCR ให้คัดลอก');

    const debugData = slipVerifier.ocrProcessor.getDebugData();
    const rawData = 
      "ข้อมูล OCR ดิบ\n================\n" +
      "ข้อความต้นฉบับ:\n" + (debugData.rawText || 'ไม่มีข้อมูล') + "\n\n" +
      "ข้อความหลังปรับปรุง:\n" + (debugData.improvedText || 'ไม่มีข้อมูล') + "\n\n" +
      "สถิติการประมวลผล:\n" +
      "- ความมั่นใจ: " + (debugData.confidence ? Math.round(debugData.confidence) + '%' : '-') + "\n" +
      "- เวลาประมวลผล: " + (debugData.processingTime || '-') + " ms\n" +
      "สร้างโดยระบบตรวจสอบสลิป\nเวลา: " + new Date().toLocaleString('th-TH');

    await navigator.clipboard.writeText(rawData);
    slipVerifier.showToast('คัดลอกข้อมูล OCR แล้ว', 'success');
  } catch (error) {
    console.error('Copy raw data failed:', error);
    slipVerifier.showToast('ไม่สามารถคัดลอกข้อมูลได้', 'error');
  }
}

function setQRData(qrData) {
  if (slipVerifier) slipVerifier.currentQRData = qrData;
}

function clearQRData() {
  if (slipVerifier) slipVerifier.currentQRData = null;
}

window.SlipVerifierApp = {
  getInstance: () => slipVerifier,
  restart: () => location.reload(),
  version: '1.0.2'
};

// ============================================================================
// ฟังก์ชันส่งข้อมูลเข้าระบบ ERme (Google Sheets)
// ============================================================================
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
      btn.innerHTML = '<i class="bi bi-hourglass-split"></i> กำลังบันทึกข้อมูล...';
      btn.disabled = true;
    }

    const response = await fetch(GAS_WEB_APP_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    if (result.status === "success") {
      if(window.slipVerifier) {
        window.slipVerifier.showToast('✅ บันทึกลงบัญชี ERme เรียบร้อยแล้ว!', 'success');
      } else {
        alert("✅ บันทึกลงบัญชี ERme เรียบร้อยแล้ว!");
      }
    } else {
      if(window.slipVerifier) {
        window.slipVerifier.showToast('❌ เกิดข้อผิดพลาด: ' + result.message, 'error');
      } else {
        alert("❌ เกิดข้อผิดพลาด: " + result.message);
      }
    }
  } catch (error) {
    console.error("Error sending to GAS:", error);
    if(window.slipVerifier) {
      window.slipVerifier.showToast('❌ ไม่สามารถเชื่อมต่อกับฐานข้อมูลได้', 'error');
    } else {
      alert("❌ ไม่สามารถเชื่อมต่อกับฐานข้อมูลได้");
    }
  } finally {
    if(btn) {
      btn.innerHTML = '<i class="bi bi-cloud-arrow-up"></i> บันทึกลงบัญชี ERme';
      btn.disabled = false;
    }
  }
}
