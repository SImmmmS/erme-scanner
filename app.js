/**
 * app.js
 * ไฟล์หลักสำหรับเริ่มต้นแอปพลิเคชัน
 * ระบบตรวจสอบสลิปการโอนเงิน
 */

// ตัวแปรสำหรับเก็บ instance หลัก
let slipVerifier = null;

/**
 * เริ่มต้นแอปพลิเคชันเมื่อ DOM โหลดเสร็จ
 */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('Starting Slip Verifier Application...');

    // แสดง loading state
    showLoadingState();

    // ตรวจสอบการรองรับของเบราว์เซอร์
    checkBrowserSupport();

    // ตรวจสอบ debug mode จาก URL
    const urlParams = new URLSearchParams(window.location.search);
    const debugMode = urlParams.get('debug') === 'true';

    // เริ่มต้น Slip Verifier
    slipVerifier = new SlipVerifier(debugMode);

    // ทำให้ slipVerifier เป็น global variable
    window.slipVerifier = slipVerifier;

    if (debugMode) {
      console.log('🐛 Debug Mode Enabled');
    }

    // ซ่อน loading state
    hideLoadingState();

    console.log('Slip Verifier Application started successfully');

  } catch (error) {
    console.error('Failed to start application:', error);
    showErrorState(error.message);
  }
});

/**
 * ตรวจสอบการรองรับของเบราว์เซอร์
 */
function checkBrowserSupport() {
  const requiredFeatures = [
    'navigator.mediaDevices',
    'navigator.clipboard',
    'FileReader',
    'URL.createObjectURL'
  ];

  const missingFeatures = requiredFeatures.filter(feature => {
    try {
      return !eval(feature);
    } catch (e) {
      return true;
    }
  });

  if (missingFeatures.length > 0) {
    throw new Error(`เบราว์เซอร์ไม่รองรับฟีเจอร์: ${missingFeatures.join(', ')}`);
  }
}

/**
 * แสดง loading state
 */
function showLoadingState() {
  const loadingHtml = `
        <div id="app-loading" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(248, 250, 252, 0.95);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            font-family: 'Kanit', sans-serif;
        ">
            <div class="loading-spinner" style="
                width: 60px;
                height: 60px;
                border: 4px solid #e2e8f0;
                border-top: 4px solid #2563eb;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin-bottom: 20px;
            "></div>
            <h3 style="color: #2563eb; margin-bottom: 10px; font-weight: 600;">
                กำลังเริ่มต้นระบบ
            </h3>
            <p style="color: #64748b; text-align: center; max-width: 300px;">
                กำลังโหลดระบบตรวจสอบสลิปการโอนเงิน<br>
                กรุณารอสักครู่...
            </p>
        </div>
        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    `;

  document.body.insertAdjacentHTML('beforeend', loadingHtml);
}

/**
 * ซ่อน loading state
 */
function hideLoadingState() {
  const loadingElement = document.getElementById('app-loading');
  if (loadingElement) {
    loadingElement.style.opacity = '0';
    setTimeout(() => loadingElement.remove(), 300);
  }
}

/**
 * แสดง error state
 */
function showErrorState(message) {
  hideLoadingState();

  const errorHtml = `
        <div id="app-error" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(248, 250, 252, 0.95);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            font-family: 'Kanit', sans-serif;
            text-align: center;
            padding: 20px;
        ">
            <div style="
                background: white;
                padding: 40px;
                border-radius: 12px;
                box-shadow: 0 10px 25px rgba(0,0,0,0.1);
                max-width: 500px;
            ">
                <div style="
                    font-size: 4rem;
                    color: #dc2626;
                    margin-bottom: 20px;
                ">
                    <i class="bi bi-exclamation-triangle"></i>
                </div>
                <h3 style="color: #dc2626; margin-bottom: 15px; font-weight: 600;">
                    เกิดข้อผิดพลาด
                </h3>
                <p style="color: #64748b; margin-bottom: 25px; line-height: 1.6;">
                    ${message}
                </p>
                <button onclick="location.reload()" style="
                    background: #2563eb;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    font-family: 'Kanit', sans-serif;
                    font-weight: 500;
                    cursor: pointer;
                    font-size: 16px;
                ">
                    <i class="bi bi-arrow-counterclockwise"></i> ลองใหม่
                </button>
            </div>
        </div>
    `;

  document.body.insertAdjacentHTML('beforeend', errorHtml);
}

/**
 * จัดการเมื่อหน้าต่างปิด
 */
window.addEventListener('beforeunload', async () => {
  if (slipVerifier && typeof slipVerifier.destroy === 'function') {
    await slipVerifier.destroy();
  }
});

/**
 * จัดการ errors ทั่วไป
 */
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);

  if (slipVerifier) {
    slipVerifier.showToast('เกิดข้อผิดพลาดที่ไม่คาดคิด', 'error');
  }
});

/**
 * จัดการ Promise rejections
 */
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);

  if (slipVerifier) {
    slipVerifier.showToast('เกิดข้อผิดพลาดในการประมวลผล', 'error');
  }

  event.preventDefault();
});

/**
 * ฟังก์ชันสำหรับการ debug (สำหรับ development)
 */
if (window.location.search.includes('debug=true')) {
  window.slipVerifier = slipVerifier;
  console.log('Debug mode enabled');

  // เพิ่มปุ่ม debug
  document.addEventListener('DOMContentLoaded', () => {
    const debugBtn = document.createElement('button');
    debugBtn.innerHTML = '<i class="bi bi-bug"></i> Debug';
    debugBtn.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #f59e0b;
            color: white;
            border: none;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
            z-index: 1000;
            cursor: pointer;
        `;

    debugBtn.addEventListener('click', () => {
      console.log('Current SlipVerifier instance:', slipVerifier);
      console.log('OCR Processor:', slipVerifier?.ocrProcessor);
      console.log('Slip Parser:', slipVerifier?.slipParser);
    });

    document.body.appendChild(debugBtn);
  });
}

/**
 * Service Worker Registration (สำหรับอนาคต)
 */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // navigator.serviceWorker.register('/sw.js')
    //     .then(registration => console.log('SW registered'))
    //     .catch(error => console.log('SW registration failed'));
  });
}

/**
 * เช็คการเชื่อมต่ออินเทอร์เน็ต
 */
window.addEventListener('online', () => {
  if (slipVerifier) {
    slipVerifier.showToast('เชื่อมต่ออินเทอร์เน็ตแล้ว', 'success');
  }
});

window.addEventListener('offline', () => {
  if (slipVerifier) {
    slipVerifier.showToast('ไม่มีการเชื่อมต่ออินเทอร์เน็ต', 'warning');
  }
});

/**
 * ซ่อนส่วนทั้งหมด
 */
function hideAllSections() {
  const sections = [
    'upload-section',
    'camera-section',
    'qr-section',
    'processing-section',
    'results-section',
    'error-section'
  ];

  sections.forEach(sectionId => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.style.display = 'none';
    }
  });
}

/**
 * เพิ่ม Event Listeners สำหรับฟีเจอร์ใหม่
 */
document.addEventListener('DOMContentLoaded', () => {
  // Toggle สำหรับแสดง/ซ่อนข้อมูล OCR ดิบ
  const toggleRawDataBtn = document.getElementById('toggle-raw-data');
  const rawDataContent = document.getElementById('raw-data-content');

  if (toggleRawDataBtn && rawDataContent) {
    toggleRawDataBtn.addEventListener('click', () => {
      const isExpanded = toggleRawDataBtn.getAttribute('data-expanded') === 'true';
      const icon = toggleRawDataBtn.querySelector('i');
      const text = toggleRawDataBtn.querySelector('.toggle-text');

      if (isExpanded) {
        // ซ่อนข้อมูล
        rawDataContent.style.display = 'none';
        toggleRawDataBtn.setAttribute('data-expanded', 'false');
        icon.className = 'bi bi-chevron-down';
        text.textContent = 'แสดงข้อมูลดิบ';
      } else {
        // แสดงข้อมูล
        rawDataContent.style.display = 'block';
        toggleRawDataBtn.setAttribute('data-expanded', 'true');
        icon.className = 'bi bi-chevron-up';
        text.textContent = 'ซ่อนข้อมูลดิบ';
      }
    });
  }

  // ปุ่มคัดลอกข้อมูลดิบ
  const copyRawBtn = document.getElementById('copy-raw-btn');
  if (copyRawBtn) {
    copyRawBtn.addEventListener('click', copyRawData);
  }

  // อัปเดตปุ่มคัดลอกข้อมูลเดิม
  const copyDataBtn = document.getElementById('copy-data-btn');
  if (copyDataBtn) {
    copyDataBtn.addEventListener('click', copySlipData);
  }
});

/**
 * คัดลอกข้อมูลสลิปแบบจัดรูปแบบ
 */
async function copySlipData() {
  try {
    if (!slipVerifier || !slipVerifier.currentSlipData) {
      throw new Error('ไม่มีข้อมูลสลิปให้คัดลอก');
    }

    const data = slipVerifier.currentSlipData;
    const formattedData = `ข้อมูลสลิปการโอนเงิน
===================
ธนาคาร: ${data.bank?.name || '-'}
จำนวนเงิน: ${SlipParser.formatAmount(data.amount)}
วันที่-เวลา: ${SlipParser.formatDateTime(data.datetime)}
ผู้โอน: ${data.sender || '-'}
ผู้รับ: ${data.receiver || '-'}
รหัสอ้างอิง: ${data.reference || '-'}

สร้างโดยระบบตรวจสอบสลิป
เวลา: ${new Date().toLocaleString('th-TH')}`;

    await navigator.clipboard.writeText(formattedData);
    slipVerifier.showToast('คัดลอกข้อมูลแล้ว', 'success');

  } catch (error) {
    console.error('Copy slip data failed:', error);
    slipVerifier.showToast('ไม่สามารถคัดลอกข้อมูลได้', 'error');
  }
}

/**
 * คัดลอกข้อมูล OCR ดิบ
 */
async function copyRawData() {
  try {
    if (!slipVerifier || !slipVerifier.ocrProcessor) {
      throw new Error('ไม่มีข้อมูล OCR ให้คัดลอก');
    }

    const debugData = slipVerifier.ocrProcessor.getDebugData();
    const rawData = `ข้อมูล OCR ดิบ
================
ข้อความต้นฉบับ:
${debugData.rawText || 'ไม่มีข้อมูล'}

ข้อความหลังปรับปรุง:
${debugData.improvedText || 'ไม่มีข้อมูล'}

สถิติการประมวลผล:
- ความมั่นใจ: ${debugData.confidence ? Math.round(debugData.confidence) + '%' : '-'}
- เวลาประมวลผล: ${debugData.processingTime || '-'} ms
- ตัวอักษรทั้งหมด: ${debugData.improvedText?.length || 0}
- ตัวอักษรไทย: ${(debugData.improvedText?.match(/[\u0E00-\u0E7F]/g) || []).length}

สร้างโดยระบบตรวจสอบสลิป
เวลา: ${new Date().toLocaleString('th-TH')}`;

    await navigator.clipboard.writeText(rawData);
    slipVerifier.showToast('คัดลอกข้อมูล OCR แล้ว', 'success');

  } catch (error) {
    console.error('Copy raw data failed:', error);
    slipVerifier.showToast('ไม่สามารถคัดลอกข้อมูลได้', 'error');
  }
}

/**
 * ฟังก์ชันช่วยสำหรับการจัดการ QR Data
 */
function setQRData(qrData) {
  if (slipVerifier) {
    slipVerifier.currentQRData = qrData;
    console.log('QR Data set:', qrData);
  }
}

/**
 * ล้างข้อมูล QR
 */
function clearQRData() {
  if (slipVerifier) {
    slipVerifier.currentQRData = null;
    console.log('QR Data cleared');
  }
}

/**
 * Export สำหรับการใช้งานภายนอก
 */
window.SlipVerifierApp = {
  getInstance: () => slipVerifier,
  restart: () => location.reload(),
  version: '1.0.0'
};
