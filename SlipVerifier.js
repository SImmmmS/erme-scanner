/**
 * SlipVerifier.js (Clean Version)
 */
class SlipVerifier {
  constructor(debug = false) {
    this.ocrProcessor = new OCRProcessor(debug);
    this.slipParser = new SlipParser();
    this.isProcessing = false;
    this.currentSlipData = null; 
    this.debug = debug;
    this.init();
  }

  init() {
    this.bindEvents();
    this.showSection('upload');
  }

  bindEvents() {
    const uploadArea = document.getElementById('upload-section');
    const fileInput = document.getElementById('slip-upload');

    // ป้องกัน Error 100% ด้วยการเช็ค if ก่อนเสมอ
    if (uploadArea && fileInput) {
      uploadArea.addEventListener('click', () => fileInput.click());
      
      uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#00c300';
      });

      uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#cbd5e1';
      });

      uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#cbd5e1';
        if (e.dataTransfer.files.length > 0) {
          this.processFile(e.dataTransfer.files[0]);
        }
      });

      fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          this.processFile(e.target.files[0]);
        }
      });
    }
  }

  showSection(sectionName) {
    const sections = ['upload-section', 'processing-section', 'results-section', 'error-section'];
    sections.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = (id === sectionName + '-section') ? 'block' : 'none';
    });
  }

  showError(message) {
    this.showSection('error');
    const msgEl = document.getElementById('error-message');
    if (msgEl) msgEl.textContent = message;
  }

  updateProgress(percent, text) {
    const fill = document.getElementById('progress-fill');
    const txt = document.getElementById('processing-text');
    if (fill) fill.style.width = percent + '%';
    if (txt) txt.textContent = text;
  }

  showToast(message, type = 'info') {
    alert(message); // ใช้ alert ง่ายๆ เพื่อลดความเสี่ยง UI พัง
  }

  async processFile(file) {
    if (!file.type.startsWith('image/')) {
      this.showError('กรุณาอัปโหลดไฟล์รูปภาพเท่านั้น');
      return;
    }

    try {
      this.isProcessing = true;
      this.showSection('processing');
      this.updateProgress(20, 'กำลังอ่านไฟล์ภาพ...');

      // หน่วงเวลาเล็กน้อยให้ UI ขยับ
      await new Promise(r => setTimeout(r, 500));
      this.updateProgress(50, 'กำลังวิเคราะห์ข้อความ (OCR)...');

      // ประมวลผล OCR
      const ocrResult = await this.ocrProcessor.processImage(file);
      this.updateProgress(80, 'กำลังดึงยอดเงินและวันที่...');

      // ตัดคำและหาตัวเลข
      const slipData = this.slipParser.parse(ocrResult);
      this.updateProgress(100, 'เสร็จสมบูรณ์!');

      this.currentSlipData = {
        ...slipData,
        ocrResult: ocrResult
      };

      await new Promise(r => setTimeout(r, 500));
      this.showResults(this.currentSlipData);

    } catch (error) {
      console.error(error);
      this.showError(error.message || 'เกิดข้อผิดพลาดในการประมวลผลรูปภาพ');
    } finally {
      this.isProcessing = false;
    }
  }

  showResults(slipData) {
    this.showSection('results');
    const resultDetails = document.getElementById('slip-result-details');
    
    if (resultDetails) {
      resultDetails.innerHTML = 
        '<div class="result-item"><span class="result-label">ยอดเงินโอน:</span><span class="result-value amount-highlight">' + (slipData.amount || 'ไม่พบยอดเงิน') + '</span></div>' +
        '<div class="result-item"><span class="result-label">วันที่-เวลา:</span><span class="result-value">' + (slipData.datetime || '-') + '</span></div>' +
        '<div class="result-item"><span class="result-label">ผู้โอน:</span><span class="result-value">' + (slipData.sender || '-') + '</span></div>';
    }

    const rawDataContent = document.getElementById('raw-data-content');
    if (rawDataContent) {
      rawDataContent.textContent = slipData.ocrResult || 'ไม่มีข้อมูลดิบ';
    }
  }

  async destroy() {
    this.currentSlipData = null;
  }
}
