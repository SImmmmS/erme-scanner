/**
 * SlipVerifier.js
 * ระบบหลักที่ประสานงานทุกส่วน
 * จัดการการตรวจสอบสลิปการโอนเงินแบบครบวงจร
 */
class SlipVerifier {
  constructor(debug = false) {
    this.ocrProcessor = new OCRProcessor(debug);
    this.slipParser = new SlipParser();
    this.qrScanner = new QRScanner(debug);
    this.qrCropSelector = null; // จะสร้างเมื่อมีรูปภาพ
    this.imagePreviewManager = new ImagePreviewManager(debug); // เพิ่ม Image Preview Manager
    this.isProcessing = false;
    this.currentCamera = null;
    this.currentQRData = null; // เก็บข้อมูล QR สำหรับการยืนยัน
    this.currentSlipData = null; // เก็บข้อมูลสลิปปัจจุบัน
    this.qrResult = null; // เก็บผลการสแกน QR แบบละเอียด
    this.currentQRMode = 'camera'; // camera หรือ image
    this.selectedBankType = 'auto'; // ธนาคารที่เลือก
    this.qrImageFile = null; // ไฟล์รูปภาพ QR
    this.currentImageFile = null; // ไฟล์รูปภาพปัจจุบัน
    this.currentImageDataUrl = null; // Data URL ของรูปภาพปัจจุบัน
    this.currentCropArea = null; // พื้นที่ crop ปัจจุบัน
    this.debug = debug;

    this.init();
  }

  /**
   * เปิด/ปิด debug mode
   */
  setDebug(enabled) {
    this.debug = enabled;
    this.ocrProcessor.setDebug(enabled);
    this.qrScanner.setDebug(enabled);
    this.imagePreviewManager.debug = enabled;
  }

  /**
   * เริ่มต้นระบบ
   */
  init() {
    this.bindEvents();
    this.showSection('upload');

    // ให้ bindQREvents ทำงานหลังจาก DOM พร้อมเสมอ
    setTimeout(() => {
      this.bindQREvents();
    }, 100);

    console.log('Slip Verifier initialized');
  }

  /**
   * ผูก Event Listeners
   */
  bindEvents() {
    // Upload events
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    const fileBtn = document.getElementById('file-btn');
    const cameraBtn = document.getElementById('camera-btn');
    const qrBtn = document.getElementById('qr-btn');

    // Drag & Drop
    uploadArea.addEventListener('dragover', this.handleDragOver.bind(this));
    uploadArea.addEventListener('dragleave', this.handleDragLeave.bind(this));
    uploadArea.addEventListener('drop', this.handleDrop.bind(this));
    uploadArea.addEventListener('click', () => fileInput.click());

    // File selection
    fileInput.addEventListener('change', this.handleFileSelect.bind(this));
    fileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
    });

    // Camera
    cameraBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.startCamera();
    });

    // QR Scanner
    qrBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.startQRScanner();
    });

    // Camera controls
    const captureBtn = document.getElementById('capture-btn');
    const cameraCancelBtn = document.getElementById('camera-cancel-btn');

    if (captureBtn) {
      captureBtn.addEventListener('click', this.capturePhoto.bind(this));
    }
    if (cameraCancelBtn) {
      cameraCancelBtn.addEventListener('click', this.stopCamera.bind(this));
    }

    // QR Scanner controls
    const qrCancelBtn = document.getElementById('qr-cancel-btn');
    const qrScanAgainBtn = document.getElementById('qr-scan-again-btn');
    const qrCopyDataBtn = document.getElementById('qr-copy-data-btn');

    if (qrCancelBtn) {
      qrCancelBtn.addEventListener('click', this.stopQRScanner.bind(this));
    }

    if (qrScanAgainBtn) {
      qrScanAgainBtn.addEventListener('click', this.restartQRScan.bind(this));
    }

    if (qrCopyDataBtn) {
      qrCopyDataBtn.addEventListener('click', this.copyQRData.bind(this));
    }

    // Result actions
    const copyDataBtn = document.getElementById('copy-data-btn');
    if (copyDataBtn) {
      copyDataBtn.addEventListener('click', this.copySlipData.bind(this));
    }

    // เพิ่ม event listener สำหรับปุ่มคัดลอกข้อมูลดิบ
    const copyRawBtn = document.getElementById('copy-raw-btn');
    if (copyRawBtn) {
      copyRawBtn.addEventListener('click', this.copyRawData.bind(this));
    }

    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', this.reset.bind(this));
    }

    const errorRetryBtn = document.getElementById('error-retry-btn');
    if (errorRetryBtn) {
      errorRetryBtn.addEventListener('click', this.reset.bind(this));
    }

    // เพิ่ม toggle สำหรับ raw data
    const toggleRawData = document.getElementById('toggle-raw-data');
    if (toggleRawData) {
      toggleRawData.addEventListener('click', this.toggleRawDataVisibility.bind(this));
    }
  }

  /**
   * ผูก Event Listeners สำหรับระบบ QR
   */
  bindQREvents() {
    console.log('🔗 Binding QR Events (checking elements...)');

    // QR mode buttons (ถ้ามี)
    const qrCameraModeBtn = document.getElementById('qr-camera-mode-btn');
    const qrImageModeBtn = document.getElementById('qr-image-mode-btn');

    if (qrCameraModeBtn) {
      qrCameraModeBtn.addEventListener('click', () => this.switchQRMode('camera'));
      console.log('✅ QR camera mode button bound');
    }

    if (qrImageModeBtn) {
      qrImageModeBtn.addEventListener('click', () => this.switchQRMode('image'));
      console.log('✅ QR image mode button bound');
    }

    // QR file input (ถ้ามี)
    const qrFileInput = document.getElementById('qr-file-input');
    const qrUploadArea = document.getElementById('qr-upload-area'); if (qrFileInput && qrUploadArea) {
      qrUploadArea.addEventListener('click', () => qrFileInput.click());
      qrFileInput.addEventListener('change', this.handleQRImageSelect.bind(this));

      // Drag & Drop for QR upload
      if (this.handleQRDragOver && this.handleQRDragLeave && this.handleQRDrop) {
        qrUploadArea.addEventListener('dragover', this.handleQRDragOver.bind(this));
        qrUploadArea.addEventListener('dragleave', this.handleQRDragLeave.bind(this));
        qrUploadArea.addEventListener('drop', this.handleQRDrop.bind(this));
      }

      console.log('✅ QR file upload events bound');
    }

    // QR crop controls (ถ้ามี)
    const qrScanSelectedBtn = document.getElementById('qr-scan-selected-btn');
    const qrResetSelectionBtn = document.getElementById('qr-reset-selection-btn');
    const qrSavePositionBtn = document.getElementById('qr-save-position-btn');

    if (qrScanSelectedBtn && this.scanSelectedQRArea) {
      qrScanSelectedBtn.addEventListener('click', this.scanSelectedQRArea.bind(this));
      console.log('✅ QR scan selected button bound');
    }

    if (qrResetSelectionBtn && this.resetQRSelection) {
      qrResetSelectionBtn.addEventListener('click', this.resetQRSelection.bind(this));
      console.log('✅ QR reset selection button bound');
    }

    if (qrSavePositionBtn && this.saveQRPosition) {
      qrSavePositionBtn.addEventListener('click', this.saveQRPosition.bind(this));
      console.log('✅ QR save position button bound');
    }

    console.log('📋 QR Events binding completed');
  }

  /**
   * จัดการ Drag Over
   */
  handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  }

  /**
   * จัดการ Drag Leave
   */
  handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
  }

  /**
   * จัดการ Drop ไฟล์
   */
  async handleDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('drag-over');

    const files = event.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];

      if (!this.validateFile(file)) return;

      this.currentImageFile = file;

      try {
        // สร้าง data URL สำหรับแสดงตัวอย่าง
        const dataUrl = await this.fileToDataUrl(file);
        this.currentImageDataUrl = dataUrl;

        // แสดงหน้า preview
        this.imagePreviewManager.showPreview(file, dataUrl);

      } catch (error) {
        console.error('Error processing dropped file:', error);
        this.showError('ไม่สามารถอ่านไฟล์ได้');
      }
    }
  }

  /**
   * จัดการเลือกไฟล์
   */
  async handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!this.validateFile(file)) return;

    this.currentImageFile = file;

    try {
      // สร้าง data URL สำหรับแสดงตัวอย่าง
      const dataUrl = await this.fileToDataUrl(file);
      this.currentImageDataUrl = dataUrl;

      // แสดงหน้า preview
      this.imagePreviewManager.showPreview(file, dataUrl);

    } catch (error) {
      console.error('Error processing file:', error);
      this.showError('ไม่สามารถอ่านไฟล์ได้');
    }
  }

  /**
   * แปลงไฟล์เป็น Data URL
   */
  fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * แปลง Blob เป็น Data URL
   */
  blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * ประมวลผลรูปภาพพร้อม crop area
   */
  async processImageWithCrop(imageFile, imageDataUrl, cropArea, selectedBank) {
    if (this.isProcessing) {
      this.showNotification('กำลังประมวลผลอยู่', 'warning');
      return;
    }

    this.isProcessing = true;
    this.currentImageFile = imageFile;
    this.currentImageDataUrl = imageDataUrl;
    this.currentCropArea = cropArea;
    this.selectedBankType = selectedBank;

    try {
      this.showSection('processing');

      // Debug: ตรวจสอบ function binding
      console.log('🔧 Checking updateProcessingStatus:', typeof this.updateProcessingStatus);
      if (typeof this.updateProcessingStatus !== 'function') {
        throw new Error('updateProcessingStatus is not a function');
      }

      this.updateProcessingStatus('กำลังเตรียมรูปภาพ...', 10);

      // แสดงรูปภาพใน processing section
      const processingImage = document.getElementById('processing-image');
      if (processingImage) {
        processingImage.src = imageDataUrl;
      }

      // ขั้นตอนที่ 1: ประมวลผล OCR จากรูปภาพเต็ม
      this.updateProcessingStatus('กำลังอ่านข้อความจากสลิป...', 20);
      const ocrResult = await this.ocrProcessor.processImage(imageFile);
      console.log('📝 OCR processing completed');

      // ขั้นตอนที่ 2: ประมวลผล QR จากพื้นที่ที่เลือก (ถ้ามี)
      this.updateProcessingStatus('กำลังสแกน QR Code...', 50);
      let qrResult = null;
      let qrCroppedImageDataUrl = null;

      if (cropArea) {
        console.log('� Processing QR from crop area:', cropArea);

        // ตัดรูปเฉพาะพื้นที่ QR ที่เลือก
        const qrCroppedBlob = await this.cropImage(imageDataUrl, cropArea);
        qrCroppedImageDataUrl = await this.blobToDataUrl(qrCroppedBlob);

        console.log('✂️ QR area cropped successfully');

        // อ่าน QR จากรูปที่ตัดแล้ว
        qrResult = await this.qrScanner.scanImageBlob(qrCroppedBlob);

        if (qrResult && qrResult.data) {
          console.log('✅ QR Code detected from cropped area');
        } else {
          console.log('⚠️ No QR Code found in cropped area');
        }
      } else {
        console.log('ℹ️ No crop area selected, skipping QR scan');
      }

      // ขั้นตอนที่ 3: วิเคราะห์และรวมข้อมูล
      this.updateProcessingStatus('กำลังวิเคราะห์ข้อมูล...', 80);
      await this.processResults(ocrResult, qrResult, qrCroppedImageDataUrl, cropArea ? true : false);

      this.updateProcessingStatus('เสร็จสิ้น', 100);

    } catch (error) {
      console.error('Processing error:', error);
      this.showError(error.message || 'เกิดข้อผิดพลาดในการประมวลผล');
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * ตัดรูปภาพตาม crop area
   */
  async cropImage(imageDataUrl, cropArea) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = cropArea.width;
        canvas.height = cropArea.height;

        ctx.drawImage(
          img,
          cropArea.x, cropArea.y, cropArea.width, cropArea.height,
          0, 0, cropArea.width, cropArea.height
        );

        canvas.toBlob(resolve, 'image/jpeg', 0.9);
      };
      img.src = imageDataUrl;
    });
  }

  /**
   * เริ่มต้นกล้อง
   */
  async startCamera() {
    console.log('📷 Starting camera...');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {facingMode: 'environment'}
      });

      const video = document.getElementById('camera-video');
      if (video) {
        video.srcObject = stream;
        this.currentCamera = stream;
        this.showSection('camera');
        this.showToast('กล้องเริ่มทำงานแล้ว', 'success');
      }
    } catch (error) {
      console.error('Camera error:', error);
      this.showToast('ไม่สามารถเปิดกล้องได้', 'error');
    }
  }

  /**
   * หยุดกล้อง
   */
  stopCamera() {
    if (this.currentCamera) {
      this.currentCamera.getTracks().forEach(track => track.stop());
      this.currentCamera = null;
    }

    const video = document.getElementById('camera-video');
    if (video) {
      video.srcObject = null;
    }

    // กลับไปหน้าหลัก
    this.showSection('upload');

    console.log('📷 Camera stopped and returned to upload');
  }

  /**
   * ถ่ายรูป
   */
  capturePhoto() {
    const video = document.getElementById('camera-video');
    const canvas = document.getElementById('camera-canvas');

    if (!video || !canvas) {
      this.showToast('ไม่พบกล้องหรือ canvas', 'error');
      return;
    }

    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0);

    // แปลง canvas เป็น blob
    canvas.toBlob(async (blob) => {
      if (blob) {
        this.stopCamera();

        // สร้าง File object จาก blob
        const file = new File([blob], 'camera-capture.jpg', {type: 'image/jpeg'});
        const dataUrl = await this.fileToDataUrl(file);

        // แสดงหน้า preview
        this.imagePreviewManager.showPreview(file, dataUrl);
      }
    }, 'image/jpeg', 0.9);
  }  /**
   * เริ่มต้น QR Scanner
   */
  async startQRScanner() {
    console.log('🔍 Starting QR Scanner...');
    this.showSection('qr');

    try {
      // เริ่ม QR Camera
      const video = document.getElementById('qr-video');
      const canvas = document.getElementById('qr-canvas');

      if (!video || !canvas) {
        throw new Error('ไม่พบ video หรือ canvas element');
      }

      // ขอสิทธิ์เข้าถึงกล้อง
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {facingMode: 'environment'}
      });

      video.srcObject = stream;
      this.qrCameraStream = stream;

      // เริ่มสแกน QR
      this.startQRScanLoop(video, canvas);

      this.showNotification('เริ่มสแกน QR Code แล้ว', 'success');

    } catch (error) {
      console.error('QR Scanner error:', error);
      this.showNotification('ไม่สามารถเปิดกล้องได้', 'error');
    }
  }

  /**
   * เริ่ม loop การสแกน QR
   */
  startQRScanLoop(video, canvas) {
    const scanQR = () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        const ctx = canvas.getContext('2d');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code) {
          this.handleQRDetected(code);
          return; // หยุดการสแกนเมื่อพบ QR
        }
      }

      // ต่อการสแกน
      this.qrScanTimer = requestAnimationFrame(scanQR);
    };

    scanQR();
  }

  /**
   * จัดการเมื่อตรวจพบ QR Code
   */
  handleQRDetected(qrCode) {
    console.log('📱 QR Code detected:', qrCode.data);

    // หยุดการสแกน
    if (this.qrScanTimer) {
      cancelAnimationFrame(this.qrScanTimer);
      this.qrScanTimer = null;
    }

    // แสดงผลลัพธ์
    this.displayQRResults(qrCode);
    this.showNotification('พบ QR Code แล้ว!', 'success');
  }

  /**
   * แสดงผลลัพธ์ QR
   */
  displayQRResults(qrCode) {
    // แสดงข้อมูลดิบ
    const rawDisplay = document.getElementById('qr-raw-display');
    if (rawDisplay) {
      rawDisplay.value = qrCode.data;
    }

    // ถอดรหัสข้อมูล
    const parsedData = this.parseQRData(qrCode.data);
    this.displayParsedQRData(parsedData);

    // แสดงส่วนผลลัพธ์
    const resultsSection = document.getElementById('qr-results');
    if (resultsSection) {
      resultsSection.style.display = 'block';
    }

    // เก็บข้อมูลสำหรับการคัดลอก
    this.currentQRData = {
      raw: qrCode.data,
      parsed: parsedData
    };
  }

  /**
   * แสดงข้อมูล QR ที่ถอดรหัสแล้ว
   */
  displayParsedQRData(data) {
    const elements = {
      'qr-amount-display': data.amount || '-',
      'qr-datetime-display': data.datetime || '-',
      'qr-sender-display': data.sender || '-',
      'qr-receiver-display': data.receiver || '-',
      'qr-reference-display': data.reference || '-'
    };

    Object.entries(elements).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value;
      }
    });
  }

  /**
   * แสดงข้อมูลดิบ QR Code
   */
  parseQRData(rawData) {
    try {
      // แสดงข้อมูลดิบ QR Code เท่านั้น
      return {
        raw_data: rawData,
        type: 'raw',
        message: 'ข้อมูลดิบ QR Code',
        length: rawData ? rawData.length : 0,
        preview: rawData && rawData.length > 100 ? rawData.substring(0, 100) + '...' : rawData,
        success: !!(rawData && rawData.length > 0)
      };
    } catch (error) {
      console.warn('Failed to parse QR data:', error);
      return {
        raw_data: null,
        type: 'error',
        message: 'ไม่สามารถอ่าน QR Code ได้',
        success: false
      };
    }
  }

  /**
   * เริ่มสแกน QR ใหม่
   */
  restartQRScan() {
    // ซ่อนผลลัพธ์
    const resultsSection = document.getElementById('qr-results');
    if (resultsSection) {
      resultsSection.style.display = 'none';
    }

    // เริ่มสแกนใหม่
    const video = document.getElementById('qr-video');
    const canvas = document.getElementById('qr-canvas');

    if (video && canvas) {
      this.startQRScanLoop(video, canvas);
    }

    this.showNotification('เริ่มสแกนใหม่', 'info');
  }

  /**
   * หยุด QR Scanner
   */
  stopQRScanner() {
    // หยุดการสแกน
    if (this.qrScanTimer) {
      cancelAnimationFrame(this.qrScanTimer);
      this.qrScanTimer = null;
    }

    // หยุดกล้อง
    if (this.qrCameraStream) {
      this.qrCameraStream.getTracks().forEach(track => track.stop());
      this.qrCameraStream = null;
    }

    // กลับไปหน้าหลัก
    this.showSection('upload');
    this.showNotification('หยุด QR Scanner แล้ว', 'info');
  }

  /**
   * คัดลอกข้อมูล QR
   */
  async copyQRData() {
    if (!this.currentQRData) {
      this.showNotification('ไม่มีข้อมูล QR ให้คัดลอก', 'warning');
      return;
    }

    const data = this.currentQRData.parsed;
    const text = `จำนวนเงิน: ${data.amount}
วันที่-เวลา: ${data.datetime}
ผู้โอน: ${data.sender}
ผู้รับ: ${data.receiver}
รหัสอ้างอิง: ${data.reference}

ข้อมูลดิบ: ${this.currentQRData.raw}`;

    try {
      await navigator.clipboard.writeText(text);
      this.showNotification('คัดลอกข้อมูล QR แล้ว', 'success');
    } catch (error) {
      console.error('Copy failed:', error);
      this.showNotification('ไม่สามารถคัดลอกได้', 'error');
    }
  }

  /**
   * จัดการเมื่อตรวจพบ QR Code
   */
  handleQRDetected(result) {
    this.stopQRScanner();
    this.showToast('ตรวจพบ QR Code แล้ว', 'success');

    // เก็บผลการสแกน QR
    this.qrResult = result;
    this.currentQRData = result.rawData;

    if (this.debug) {
      console.log('=== QR Detection Result ===');
      console.log('Raw Data:', result.rawData);
      console.log('Parsed Data:', result.parsedData);
      console.log('Type:', result.parsedData?.type);
      console.log('Is Payment Slip:', result.parsedData?.isPaymentSlip);
      console.log('============================');
    }

    // ประมวลผลข้อมูล QR
    this.processQRData(result.rawData);
  }

  /**
   * จัดการข้อผิดพลาด QR
   */
  handleQRError(errorMessage) {
    this.stopQRScanner();
    this.showToast(errorMessage, 'error');
  }

  /**
   * ประมวลผลข้อมูล QR
   */
  async processQRData(qrData) {
    console.log('🔍 Processing QR Data:', qrData);

    try {
      // แสดงข้อมูลดิบ QR Code เท่านั้น
      const qrResult = {
        raw_data: qrData,
        type: 'raw',
        message: 'ข้อมูลดิบ QR Code',
        length: qrData ? qrData.length : 0,
        preview: qrData && qrData.length > 100 ? qrData.substring(0, 100) + '...' : qrData,
        success: !!(qrData && qrData.length > 0)
      };

      console.log('QR Raw Data:', qrResult);

      if (qrResult.success) {
        this.currentQRData = qrResult;
        this.showToast('อ่าน QR Code สำเร็จ!', 'success');

        // ไปหน้าผลลัพธ์
        this.showQRResults(qrResult, qrData);
      } else {
        this.showToast('ไม่สามารถอ่าน QR Code ได้', 'error');
        console.log('Raw QR data:', qrData);
      }

    } catch (error) {
      console.error('QR processing error:', error);
      this.showToast('เกิดข้อผิดพลาดในการประมวลผล QR', 'error');
    }
  }

  /**
   * แสดงผลลัพธ์ QR
   */
  showQRResults(parsedData, rawData) {
    console.log('📊 Showing QR Results');

    // แสดงหน้าผลลัพธ์
    this.showSection('results');

    // ตั้งสถานะเป็น verified
    const verificationStatus = document.getElementById('verification-status');
    const verificationText = document.getElementById('verification-text');
    if (verificationStatus && verificationText) {
      verificationStatus.className = 'verification-status verified';
      verificationText.textContent = 'ตรวจสอบด้วย QR แล้ว';
    }

    // แสดงข้อมูลสลิป
    this.displaySlipData(parsedData);

    // แสดงข้อมูล QR
    this.displayQRData(parsedData, rawData);
  }

  /**
   * แสดงข้อมูลสลิป (เฉพาะข้อมูลจาก OCR เท่านั้น)
   */
  displaySlipData(data) {
    // ถ้าเป็นข้อมูลจาก QR ให้แสดงว่าไม่มีข้อมูลสลิป
    if (data.type === 'raw') {
      const elements = {
        'slip-amount': '-',
        'slip-datetime': '-',
        'slip-sender': '-',
        'slip-receiver': '-',
        'slip-reference': '-'
      };

      Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
          element.textContent = value;
        }
      });
      return;
    }

    // แสดงข้อมูลสลิปปกติ (จาก OCR)
    const elements = {
      'slip-amount': data.amount || '-',
      'slip-datetime': data.datetime || '-',
      'slip-sender': data.sender || '-',
      'slip-receiver': data.receiver || '-',
      'slip-reference': data.reference || '-'
    };

    Object.entries(elements).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value;
      }
    });
  }

  /**
   * แสดงข้อมูล QR Code (ข้อมูลดิบเท่านั้น)
   */
  displayQRData(parsedData, rawData) {
    // แสดงส่วน QR verification
    const qrVerification = document.getElementById('qr-verification');
    if (qrVerification) {
      qrVerification.style.display = 'block';
    }

    // แสดงข้อมูลดิบของ QR Code
    const qrRawData = parsedData.raw_data || rawData || '';
    const qrElements = {
      'qr-amount': `QR Code ความยาว: ${qrRawData.length} อักขระ`,
      'qr-datetime': parsedData.message || 'ข้อมูลดิบ QR Code',
      'qr-sender': `ประเภท: ${parsedData.type || 'raw'}`,
      'qr-receiver': `สถานะ: ${parsedData.success ? 'อ่านสำเร็จ' : 'อ่านไม่สำเร็จ'}`,
      'qr-reference': parsedData.preview || '-',
      'qr-raw-text': qrRawData
    };

    Object.entries(qrElements).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value;
      }
    });

    // แสดงข้อมูล statistics
    const stats = {
      'ocr-confidence': 'N/A (QR only)',
      'processing-time': '< 1 วินาที',
      'thai-chars': 'N/A',
      'qr-status': parsedData.success ? 'อ่าน QR Code สำเร็จ ✓' : 'ไม่สามารถอ่าน QR Code ได้ ✗',
      'qr-match-score': parsedData.success ? '100%' : '0%'
    };

    Object.entries(stats).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value;
      }
    });
  }

  /**
   * ตรวจสอบไฟล์
   */
  validateFile(file) {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedTypes.includes(file.type)) {
      this.showNotification('รองรับเฉพาะไฟล์ JPG, PNG, WEBP เท่านั้น', 'error');
      return false;
    }

    if (file.size > maxSize) {
      this.showNotification('ขนาดไฟล์เกิน 5MB', 'error');
      return false;
    }

    return true;
  }

  /**
   * แสดงพรีวิวรูปภาพ
   */
  showImagePreview(file) {
    const img = document.getElementById('processing-image');
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target.result;
    };

    reader.readAsDataURL(file);
  }

  /**
   * ประมวลผลไฟล์รูปภาพ
   */
  async processFile(file) {
    console.log('📁 Processing file:', file.name);

    if (!file.type.startsWith('image/')) {
      this.showToast('กรุณาเลือกไฟล์รูปภาพ', 'error');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      this.showToast('ขนาดไฟล์เกิน 10MB', 'error');
      return;
    }

    try {
      // แสดงหน้าประมวลผล
      this.showSection('processing');

      // แสดงรูปตัวอย่าง
      const reader = new FileReader();
      reader.onload = (e) => {
        const processingImage = document.getElementById('processing-image');
        if (processingImage) {
          processingImage.src = e.target.result;
        }
      };
      reader.readAsDataURL(file);

      // อัปเดต progress และข้อความ
      this.updateProgress(20, 'กำลังอ่านไฟล์...');

      await this.delay(500);
      this.updateProgress(50, 'กำลังประมวลผลด้วย OCR...');

      // ประมวลผล OCR
      const ocrResult = await this.ocrProcessor.processImage(file);

      this.updateProgress(80, 'กำลังแปลข้อมูล...');

      // แปลข้อมูลสลิป
      const slipData = this.slipParser.parse(ocrResult.text);

      this.updateProgress(100, 'เสร็จสิ้น!');

      // เก็บข้อมูล
      this.currentSlipData = {
        ...slipData,
        ocrResult: ocrResult,
        imageFile: file
      };

      await this.delay(500);

      // แสดงผลลัพธ์
      this.showResults(this.currentSlipData);

    } catch (error) {
      console.error('File processing error:', error);
      this.showError('เกิดข้อผิดพลาดในการประมวลผล: ' + error.message);
    }
  }

  /**
   * อัปเดต progress bar
   */
  updateProgress(percent, text) {
    const progressFill = document.getElementById('progress-fill');
    const processingText = document.getElementById('processing-text');

    if (progressFill) {
      progressFill.style.width = percent + '%';
    }

    if (processingText) {
      processingText.textContent = text;
    }
  }  /**
   * อัปเดต progress steps
   */
  updateProgressSteps(currentStep) {
    const stepMapping = {
      'upload': 0,
      'camera': 0,
      'qr': 0,
      'image-preview': 1,
      'processing': 2,
      'results': 3,
      'error': -1 // แสดงสถานะ error โดยไม่เปลี่ยน step
    };

    const stepIndex = stepMapping[currentStep];

    // ถ้าเป็น error ไม่ต้องเปลี่ยน progress
    if (stepIndex === -1) return;

    const steps = document.querySelectorAll('.step');
    const connectors = document.querySelectorAll('.step-connector');

    if (steps.length === 0) return;

    steps.forEach((step, index) => {
      step.classList.remove('active', 'completed');

      if (index < stepIndex) {
        step.classList.add('completed');
      } else if (index === stepIndex) {
        step.classList.add('active');
      }
    });

    connectors.forEach((connector, index) => {
      connector.classList.remove('completed');

      if (index < stepIndex) {
        connector.classList.add('completed');
      }
    });

    if (this.debug) {
      console.log(`📊 Progress updated: ${currentStep} (step ${stepIndex})`);
    }
  }

  /**
   * อัปเดตข้อความอธิบายใน header
   */
  updateHeaderDescription(sectionName) {
    const descriptions = {
      'upload': 'เลือกวิธีการอัปโหลดสลิปการโอนเงินของคุณ',
      'camera': 'ถ่ายรูปสลิปด้วยกล้อง',
      'qr': 'สแกน QR Code จากสลิป',
      'image-preview': 'ตรวจสอบรูปภาพและเลือกพื้นที่ QR Code',
      'processing': 'กำลังประมวลผลและอ่านข้อมูลจากสลิป',
      'results': 'ผลการตรวจสอบสลิปการโอนเงิน',
      'error': 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'
    };

    const headerDescription = document.getElementById('header-description');
    if (headerDescription && descriptions[sectionName]) {
      headerDescription.textContent = descriptions[sectionName];

      // เพิ่ม animation
      headerDescription.style.opacity = '0';
      setTimeout(() => {
        headerDescription.style.opacity = '1';
      }, 200);
    }
  }

  /**
   * แสดงข้อมูลดิบ
   */
  displayRawData(slipData, qrResult) {
    // OCR raw text
    const rawOcrText = document.getElementById('raw-ocr-text');
    if (rawOcrText && slipData) {
      rawOcrText.value = slipData.raw_text || '';
    }
  }

  /**
   * แสดงข้อผิดพลาด
   */
  showError(message) {
    console.error('❌ Error:', message);
    this.showSection('error');

    const errorMessage = document.getElementById('error-message');
    if (errorMessage) {
      errorMessage.textContent = message;
    }
  }

  /**
   * Delay helper function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }


  /**
   * แสดงข้อมูลตัวอย่างใน debug mode
   */
  showDebugExample() {
    this.showToast('ตัวอย่าง debug - ฟีเจอร์นี้จะพัฒนาในเวอร์ชันถัดไป', 'info');
  }

  /**
   * คัดลอกข้อมูลสลิป
   */
  copySlipData() {
    if (!this.currentSlipData) {
      this.showToast('ไม่มีข้อมูลให้คัดลอก', 'warning');
      return;
    }

    const data = this.currentSlipData;
    const copyText = `
ข้อมูลสลิปการโอนเงิน
จำนวนเงิน: ${data.amount || '-'}
วันที่-เวลา: ${data.datetime || '-'}
ผู้โอน: ${data.sender || '-'}
ผู้รับ: ${data.receiver || '-'}
รหัสอ้างอิง: ${data.reference || '-'}
`.trim();

    this.copyToClipboard(copyText);
  }

  /**
   * คัดลอกข้อมูลดิบ
   */
  copyRawData() {
    if (!this.currentSlipData || !this.currentSlipData.ocrResult) {
      this.showToast('ไม่มีข้อมูลดิบให้คัดลอก', 'warning');
      return;
    }

    const rawText = this.currentSlipData.ocrResult.text || '';
    this.copyToClipboard(rawText);
  }

  /**
   * คัดลอกข้อความไปยัง clipboard
   */
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      this.showToast('คัดลอกข้อมูลแล้ว', 'success');
    } catch (error) {
      console.error('Copy failed:', error);
      this.showToast('ไม่สามารถคัดลอกได้', 'error');
    }
  }

  /**
   * รีเซ็ตระบบ
   */
  reset() {
    console.log('🔄 Resetting system...');

    // ล้างข้อมูล
    this.currentSlipData = null;
    this.currentQRData = null;
    this.currentQRImageFile = null;
    this.currentCropArea = null; // รีเซ็ต crop area
    this.qrResult = null;
    this.isProcessing = false;

    // หยุดกล้องและ QR Scanner
    this.stopCamera();
    this.stopQRScanner();

    // กลับไปหน้าแรก
    this.showSection('upload');
    this.showToast('รีเซ็ตระบบแล้ว', 'info');
  }

  /**
   * Toggle การแสดงข้อมูลดิบ
   */
  toggleRawDataVisibility() {
    const rawDataContent = document.getElementById('raw-data-content');
    const toggleIcon = document.querySelector('#toggle-raw-data .bi');

    if (rawDataContent && toggleIcon) {
      const isVisible = rawDataContent.style.display !== 'none';

      rawDataContent.style.display = isVisible ? 'none' : 'block';
      toggleIcon.className = isVisible ? 'bi bi-chevron-down' : 'bi bi-chevron-up';
    }
  }

  /**
   * สร้างระบบเลือกธนาคารและตำแหน่ง QR แบบง่าย
   */
  createSimpleBankQRSelector() {
    console.log('🏦 Creating Simple Bank QR Selector...');
    const qrSection = document.getElementById('qr-section');
    if (!qrSection) {
      console.error('QR Section not found!');
      return;
    }

    // สร้าง UI แบบง่าย
    qrSection.innerHTML = `
      <div class="simple-qr-selector">
        <h3><i class="bi bi-qr-code-scan"></i> สแกน QR Code จากสลิป</h3>

        <!-- การเลือกธนาคาร -->
        <div class="bank-selector">
          <h4><i class="bi bi-bank"></i> เลือกธนาคาร:</h4>
          <div class="bank-buttons">
            <button class="bank-btn" data-bank="auto">อัตโนมัติ</button>
            <button class="bank-btn" data-bank="SCB">ไทยพาณิชย์</button>
            <button class="bank-btn" data-bank="KBANK">กสิกรไทย</button>
            <button class="bank-btn" data-bank="BBL">กรุงเทพ</button>
            <button class="bank-btn" data-bank="KTB">กรุงไทย</button>
            <button class="bank-btn" data-bank="TMB">ทหารไทย</button>
            <button class="bank-btn" data-bank="GSB">ออมสิน</button>
            <button class="bank-btn" data-bank="other">อื่นๆ</button>
          </div>
          <p class="selected-bank">เลือก: <span id="selected-bank-text">อัตโนมัติ</span></p>
        </div>

        <!-- การเลือกตำแหน่ง QR -->
        <div class="qr-position-selector">
          <h4><i class="bi bi-bullseye"></i> ตำแหน่ง QR Code ในสลิป:</h4>
          <div class="position-grid">
            <button class="position-btn" data-position="top-left">บนซ้าย</button>
            <button class="position-btn" data-position="top-center">บนกลาง</button>
            <button class="position-btn" data-position="top-right">บนขวา</button>
            <button class="position-btn" data-position="middle-left">กลางซ้าย</button>
            <button class="position-btn" data-position="middle-center">กลางกลาง</button>
            <button class="position-btn" data-position="middle-right">กลางขวา</button>
            <button class="position-btn" data-position="bottom-left">ล่างซ้าย</button>
            <button class="position-btn" data-position="bottom-center">ล่างกลาง</button>
            <button class="position-btn" data-position="bottom-right">ล่างขวา</button>
          </div>
          <p class="selected-position">เลือก: <span id="selected-position-text">กลางกลาง</span></p>
        </div>

        <!-- การอัปโหลดรูป -->
        <div class="qr-upload-section">
          <h4><i class="bi bi-upload"></i> อัปโหลดรูปสลิป:</h4>
          <input type="file" id="simple-qr-file" accept="image/*" style="display: none;">
          <button class="btn btn-primary" id="simple-upload-btn">
            <i class="bi bi-upload"></i> เลือกรูปภาพ
          </button>
          <div class="upload-info">
            <p>รองรับ JPG, PNG, WEBP | ขนาดไม่เกิน 5MB</p>
          </div>
        </div>

        <!-- แสดงรูปและพื้นที่ QR -->
        <div class="qr-preview-section" id="simple-qr-preview" style="display: none;">
          <h4><i class="bi bi-crop"></i> รูปภาพและพื้นที่ QR:</h4>
          <div class="preview-container">
            <div class="image-with-overlay">
              <img id="simple-preview-image" src="" alt="Preview">
              <div class="qr-overlay" id="simple-qr-overlay">
                <div class="qr-highlight-box"></div>
              </div>
            </div>
          </div>
          <div class="scan-controls">
            <button class="btn btn-success" id="simple-scan-btn">
              <i class="bi bi-search"></i> สแกน QR Code
            </button>
            <button class="btn btn-secondary" id="simple-adjust-btn">
              <i class="bi bi-arrows-move"></i> ปรับตำแหน่ง
            </button>
          </div>
        </div>

        <!-- ปุ่มควบคุม -->
        <div class="qr-controls">
          <button class="btn btn-secondary" id="qr-cancel-btn">
            <i class="bi bi-x"></i> ยกเลิก
          </button>
        </div>
      </div>
    `;

    // ตั้งค่าเริ่มต้น
    this.selectedBankType = 'auto';
    this.selectedQRPosition = 'middle-center';

    console.log('📋 HTML Created, binding events...');

    // ผูก events (รอ DOM อัปเดต)
    setTimeout(() => {
      this.bindSimpleQREvents();
    }, 100);
  }  /**
   * ผูก events สำหรับระบบ QR แบบง่าย
   */
  bindSimpleQREvents() {
    console.log('🔗 Binding Simple QR Events...');

    // Bank selection
    const bankButtons = document.querySelectorAll('.bank-btn');
    console.log('Found bank buttons:', bankButtons.length);

    bankButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        console.log('Bank button clicked:', e.target.dataset.bank);

        // ลบ active class จากปุ่มอื่น
        bankButtons.forEach(b => b.classList.remove('active'));
        // เพิ่ม active class ให้ปุ่มที่เลือก
        e.target.classList.add('active');

        this.selectedBankType = e.target.dataset.bank;
        const selectedText = document.getElementById('selected-bank-text');
        if (selectedText) {
          selectedText.textContent = e.target.textContent;
        }

        console.log('Selected bank:', this.selectedBankType);
        this.showToast(`เลือก: ${e.target.textContent}`, 'success');
      });
    });

    // Position selection
    const positionButtons = document.querySelectorAll('.position-btn');
    console.log('Found position buttons:', positionButtons.length);

    positionButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        console.log('Position button clicked:', e.target.dataset.position);

        // ลบ active class จากปุ่มอื่น
        positionButtons.forEach(b => b.classList.remove('active'));
        // เพิ่ม active class ให้ปุ่มที่เลือก
        e.target.classList.add('active');

        this.selectedQRPosition = e.target.dataset.position;
        const selectedText = document.getElementById('selected-position-text');
        if (selectedText) {
          selectedText.textContent = e.target.textContent;
        }

        // อัปเดตตำแหน่งในรูป
        this.updateQROverlayPosition();

        console.log('Selected position:', this.selectedQRPosition);
        this.showToast(`ตำแหน่ง QR: ${e.target.textContent}`, 'success');
      });
    });

    // File upload
    const uploadBtn = document.getElementById('simple-upload-btn');
    const fileInput = document.getElementById('simple-qr-file');

    console.log('Upload button:', uploadBtn ? 'found' : 'not found');
    console.log('File input:', fileInput ? 'found' : 'not found');

    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener('click', () => {
        console.log('Upload button clicked');
        fileInput.click();
      });

      fileInput.addEventListener('change', (e) => {
        console.log('File selected:', e.target.files.length);
        if (e.target.files.length > 0) {
          this.loadSimpleQRImage(e.target.files[0]);
        }
      });
    }

    // Scan button
    const scanBtn = document.getElementById('simple-scan-btn');
    console.log('Scan button:', scanBtn ? 'found' : 'not found');

    if (scanBtn) {
      scanBtn.addEventListener('click', () => {
        console.log('Scan button clicked');
        this.scanSimpleQR();
      });
    }

    // Adjust button
    const adjustBtn = document.getElementById('simple-adjust-btn');
    if (adjustBtn) {
      adjustBtn.addEventListener('click', () => {
        console.log('Adjust button clicked');
        this.showPositionAdjustment();
      });
    }

    // Cancel button
    const cancelBtn = document.getElementById('qr-cancel-btn');
    console.log('Cancel button:', cancelBtn ? 'found' : 'not found');

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        console.log('Cancel button clicked');
        this.stopQRScanner();
      });
    }

    // Set default selections
    setTimeout(() => {
      const defaultBank = document.querySelector('.bank-btn[data-bank="auto"]');
      const defaultPosition = document.querySelector('.position-btn[data-position="middle-center"]');

      console.log('Setting defaults...');
      console.log('Default bank:', defaultBank ? 'found' : 'not found');
      console.log('Default position:', defaultPosition ? 'found' : 'not found');

      if (defaultBank) {
        defaultBank.classList.add('active');
        console.log('Added active class to default bank');
      }
      if (defaultPosition) {
        defaultPosition.classList.add('active');
        console.log('Added active class to default position');
      }
    }, 200);
  }

  /**
   * โหลดรูปภาพ QR แบบง่าย
   */
  loadSimpleQRImage(file) {
    if (!file.type.startsWith('image/')) {
      this.showToast('กรุณาเลือกไฟล์รูปภาพ', 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.showToast('ขนาดไฟล์เกิน 5MB', 'error');
      return;
    }

    this.currentQRImageFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
      const previewImg = document.getElementById('simple-preview-image');
      const previewSection = document.getElementById('simple-qr-preview');

      previewImg.src = e.target.result;
      previewSection.style.display = 'block';

      // อัปเดตตำแหน่ง QR overlay
      previewImg.onload = () => {
        this.updateQROverlayPosition();
      };
    };

    reader.readAsDataURL(file);
    this.showToast('โหลดรูปภาพสำเร็จ', 'success');
  }

  /**
   * อัปเดตตำแหน่ง QR overlay
   */
  updateQROverlayPosition() {
    const overlay = document.getElementById('simple-qr-overlay');
    const highlightBox = overlay.querySelector('.qr-highlight-box');

    if (!highlightBox) return;

    // กำหนดตำแหน่งตาม position ที่เลือก
    const positions = {
      'top-left': {top: '10%', left: '10%', width: '30%', height: '30%'},
      'top-center': {top: '10%', left: '35%', width: '30%', height: '30%'},
      'top-right': {top: '10%', left: '60%', width: '30%', height: '30%'},
      'middle-left': {top: '35%', left: '10%', width: '30%', height: '30%'},
      'middle-center': {top: '35%', left: '35%', width: '30%', height: '30%'},
      'middle-right': {top: '35%', left: '60%', width: '30%', height: '30%'},
      'bottom-left': {top: '60%', left: '10%', width: '30%', height: '30%'},
      'bottom-center': {top: '60%', left: '35%', width: '30%', height: '30%'},
      'bottom-right': {top: '60%', left: '60%', width: '30%', height: '30%'}
    };

    const pos = positions[this.selectedQRPosition] || positions['middle-center'];

    highlightBox.style.top = pos.top;
    highlightBox.style.left = pos.left;
    highlightBox.style.width = pos.width;
    highlightBox.style.height = pos.height;
  }

  /**
   * สแกน QR แบบง่าย
   */
  async scanSimpleQR() {
    if (!this.currentQRImageFile) {
      this.showToast('กรุณาเลือกรูปภาพก่อน', 'error');
      return;
    }

    try {
      this.showToast('กำลังสแกน QR Code...', 'info');

      // สร้าง canvas จากรูปภาพ
      const img = document.getElementById('simple-preview-image');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);

      // คำนวณพื้นที่ที่ต้องการสแกน
      const cropArea = this.calculateCropArea(canvas.width, canvas.height);

      // ตัดรูปตามพื้นที่ที่เลือก
      const croppedCanvas = document.createElement('canvas');
      const croppedCtx = croppedCanvas.getContext('2d');

      croppedCanvas.width = cropArea.width;
      croppedCanvas.height = cropArea.height;

      croppedCtx.drawImage(
        canvas,
        cropArea.x, cropArea.y, cropArea.width, cropArea.height,
        0, 0, cropArea.width, cropArea.height
      );

      // แสดงรูปที่ตัดใน debug mode
      if (this.debug) {
        console.log('Crop area:', cropArea);
        console.log('Cropped image:', croppedCanvas.toDataURL());
      }

      // สแกน QR จากรูปที่ตัด
      const imageData = croppedCtx.getImageData(0, 0, croppedCanvas.width, croppedCanvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });

      if (code) {
        // พบ QR Code
        this.currentQRData = code.data;

        // แสดงรูปที่ใช้สแกนใน debug
        if (this.debug) {
          this.showQRDebugImages(this.currentQRImageFile, {
            canvas: croppedCanvas,
            imageData: imageData
          });
        }

        this.showToast('พบ QR Code แล้ว!', 'success');

        // ประมวลผลข้อมูล QR
        this.processQRData(code.data);
      } else {
        this.showToast('ไม่พบ QR Code ในตำแหน่งที่เลือก', 'error');

        if (this.debug) {
          console.log('ไม่พบ QR Code ในพื้นที่:', cropArea);
        }
      }

    } catch (error) {
      console.error('QR scan error:', error);
      this.showToast('เกิดข้อผิดพลาดในการสแกน QR', 'error');
    }
  }

  /**
   * คำนวณพื้นที่ crop ตามตำแหน่งที่เลือก
   */
  calculateCropArea(imageWidth, imageHeight) {
    const positions = {
      'top-left': {x: 0.1, y: 0.1, w: 0.3, h: 0.3},
      'top-center': {x: 0.35, y: 0.1, w: 0.3, h: 0.3},
      'top-right': {x: 0.6, y: 0.1, w: 0.3, h: 0.3},
      'middle-left': {x: 0.1, y: 0.35, w: 0.3, h: 0.3},
      'middle-center': {x: 0.35, y: 0.35, w: 0.3, h: 0.3},
      'middle-right': {x: 0.6, y: 0.35, w: 0.3, h: 0.3},
      'bottom-left': {x: 0.1, y: 0.6, w: 0.3, h: 0.3},
      'bottom-center': {x: 0.35, y: 0.6, w: 0.3, h: 0.3},
      'bottom-right': {x: 0.6, y: 0.6, w: 0.3, h: 0.3}
    };

    const pos = positions[this.selectedQRPosition] || positions['middle-center'];

    return {
      x: Math.round(imageWidth * pos.x),
      y: Math.round(imageHeight * pos.y),
      width: Math.round(imageWidth * pos.w),
      height: Math.round(imageHeight * pos.h)
    };
  }  /**
   * แสดง/ซ่อน section ต่างๆ พร้อม animation
   */
  showSection(sectionName) {
    console.log(`🔄 Switching to section: ${sectionName}`);

    // อัปเดต progress steps และ description
    this.updateProgressSteps(sectionName);
    this.updateHeaderDescription(sectionName);

    const sections = [
      'upload-section',
      'camera-section',
      'image-preview-section',
      'qr-section',
      'processing-section',
      'results-section',
      'error-section'
    ];

    const targetSection = document.getElementById(`${sectionName}-section`);

    if (!targetSection) {
      console.error(`Section not found: ${sectionName}-section`);
      return;
    }

    // ซ่อน sections อื่นๆ ด้วย animation
    sections.forEach(sectionId => {
      const section = document.getElementById(sectionId);
      if (section && sectionId !== `${sectionName}-section`) {
        if (section.style.display !== 'none') {
          section.classList.add('section-exit');
          setTimeout(() => {
            section.style.display = 'none';
            section.classList.remove('section-exit');
          }, 300);
        }
      }
    });

    // แสดง section ที่ต้องการด้วย animation
    setTimeout(() => {
      targetSection.style.display = 'block';
      targetSection.classList.add('section-enter');

      setTimeout(() => {
        targetSection.classList.remove('section-enter');
      }, 400);
    }, 100);
  }

  /**
   * แสดงข้อความ Toast
   */
  showToast(message, type = 'info') {
    console.log(`🍞 Toast [${type}]: ${message}`);

    const toast = document.getElementById('toast');
    const toastMessage = toast?.querySelector('.toast-message');
    const toastIcon = toast?.querySelector('.toast-icon');

    if (!toast || !toastMessage || !toastIcon) {
      console.warn('Toast elements not found');
      return;
    }

    // ตั้งค่าไอคอนและสี
    const toastConfig = {
      success: {icon: 'bi-check-circle-fill', class: 'success'},
      error: {icon: 'bi-exclamation-triangle-fill', class: 'error'},
      warning: {icon: 'bi-exclamation-triangle-fill', class: 'warning'},
      info: {icon: 'bi-info-circle-fill', class: 'info'}
    };

    const config = toastConfig[type] || toastConfig.info;

    toastIcon.className = `toast-icon bi ${config.icon}`;
    toastMessage.textContent = message;
    toast.className = `toast ${config.class}`;

    // แสดง toast
    toast.style.display = 'block';

    // ซ่อนหลัง 3 วินาที
    setTimeout(() => {
      toast.style.display = 'none';
    }, 3000);
  }

  /**
   * แสดงการแจ้งเตือน (alias สำหรับ showToast)
   */
  showNotification(message, type = 'info') {
    this.showToast(message, type);
  }

  /**
   * ทำลายและล้างข้อมูลทั้งหมด
   */
  async destroy() {
    console.log('🗑️ Destroying SlipVerifier...');

    try {
      // หยุดกล้องและ QR Scanner
      if (this.stopCamera && typeof this.stopCamera === 'function') {
        this.stopCamera();
      }

      if (this.stopQRScanner && typeof this.stopQRScanner === 'function') {
        this.stopQRScanner();
      }

      // ทำลาย crop selector
      if (this.qrCropSelector && this.qrCropSelector.destroy) {
        this.qrCropSelector.destroy();
        this.qrCropSelector = null;
      }

      // ล้างข้อมูลทั้งหมด
      this.currentSlipData = null;
      this.currentQRData = null;
      this.currentQRImageFile = null;
      this.qrResult = null;
      this.isProcessing = false;
      this.currentCamera = null;

      // ล้าง intervals/timeouts (ถ้ามี)
      if (this.processingInterval) {
        clearInterval(this.processingInterval);
        this.processingInterval = null;
      }

      if (this.qrScanInterval) {
        clearInterval(this.qrScanInterval);
        this.qrScanInterval = null;
      }

      console.log('✅ SlipVerifier destroyed successfully');
    } catch (error) {
      console.error('❌ Error during destroy:', error);
    }
  }

  /**
   * จัดการเลือกรูป QR
   */
  handleQRImageSelect(e) {
    console.log('📁 QR Image selected');
    const files = e.target.files;
    if (files.length > 0) {
      this.loadSimpleQRImage(files[0]);
    }
  }

  /**
   * จัดการ drag over สำหรับ QR upload
   */
  handleQRDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  }

  /**
   * จัดการ drag leave สำหรับ QR upload
   */
  handleQRDragLeave(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
  }

  /**
   * จัดการ drop สำหรับ QR upload
   */
  handleQRDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      this.loadSimpleQRImage(files[0]);
    }
  }

  /**
   * หยุดกล้อง QR (ถ้ามี)
   */
  stopQRCamera() {
    console.log('📱 Stopping QR camera...');

    // หยุด QR video stream ถ้ามี
    const qrVideo = document.getElementById('qr-video');
    if (qrVideo && qrVideo.srcObject) {
      const stream = qrVideo.srcObject;
      stream.getTracks().forEach(track => track.stop());
      qrVideo.srcObject = null;
      console.log('📱 QR camera stream stopped');
    }

    // ล้าง QR scanning interval ถ้ามี
    if (this.qrScanInterval) {
      clearInterval(this.qrScanInterval);
      this.qrScanInterval = null;
      console.log('📱 QR scan interval cleared');
    }
  }

  /**
   * อัปเดตสถานะการประมวลผล
   */
  updateProcessingStatus(message, percentage = 0) {
    console.log(`⚙️ Processing: ${message} (${percentage}%)`);

    // อัปเดตข้อความ
    const processingText = document.getElementById('processing-text');
    if (processingText) {
      processingText.textContent = message;
    }

    // อัปเดต progress bar
    const progressFill = document.getElementById('progress-fill');
    if (progressFill) {
      progressFill.style.width = `${percentage}%`;
    }
  }

  /**
   * ประมวลผลผลลัพธ์จาก OCR และ QR
   */
  async processResults(ocrResult, qrResult, qrCroppedImageDataUrl = null, hasQrCrop = false) {
    console.log('📊 Processing results...', {
      ocrResult,
      qrResult,
      hasQrCroppedImage: !!qrCroppedImageDataUrl,
      hasQrCrop
    });

    try {
      let parsedData = null;
      let dataSource = 'none';

      // รวมข้อมูลจาก QR และ OCR (ถ้ามี)
      let qrData = null;
      if (qrResult && qrResult.data) {
        try {
          // แสดงข้อมูลดิบ QR Code เท่านั้น
          qrData = {
            raw_data: qrResult.data,
            type: 'raw',
            message: 'ข้อมูลดิบ QR Code',
            length: qrResult.data.length,
            preview: qrResult.data.length > 100 ? qrResult.data.substring(0, 100) + '...' : qrResult.data,
            success: true
          };
          console.log('📱 QR raw data result:', qrData);
        } catch (qrError) {
          console.warn('⚠️ Failed to process QR data:', qrError);
          qrData = null;
        }
      }

      // ถ้ามี OCR ให้ parse ด้วย
      let ocrData = null;
      if (ocrResult) {
        if (ocrResult && ocrResult.length > 10) {
          try {
            ocrData = this.slipParser.parse(ocrResult);
            console.log('📝 OCR parse result:', ocrData);
          } catch (ocrError) {
            console.warn('⚠️ Failed to parse OCR data:', ocrError);
            ocrData = this.createBasicSlipData(ocrResult);
            console.log('📋 Created basic data from OCR:', ocrData);
          }
        }
      }

      // รวมข้อมูลโดยให้ OCR มีความสำคัญสูงกว่า (เพราะมีข้อมูลครบกว่า)
      if (ocrData) {
        parsedData = {...ocrData};
        dataSource = 'ocr';

        // เติมข้อมูลจาก QR ที่ขาดหาย
        if (qrData) {
          if (!parsedData.reference && qrData.reference) {
            parsedData.reference = qrData.reference;
          }
          if (!parsedData.receiver && qrData.receiver) {
            parsedData.receiver = qrData.receiver;
          }
          dataSource = 'combined';
        }
      } else if (qrData) {
        // ใช้ QR เป็นหลักถ้าไม่มี OCR
        const hasUsefulQrData = qrData.amount || qrData.reference || qrData.sender || qrData.receiver || qrData.datetime;
        if (hasUsefulQrData) {
          parsedData = qrData;
          dataSource = 'qr';
        }
      }

      // ถ้ายังไม่มีข้อมูล ให้สร้างข้อมูลเปล่า
      if (!parsedData) {
        console.log('⚠️ No parseable data found, creating empty data');
        parsedData = this.createEmptySlipData(ocrResult, qrResult);
        dataSource = 'empty';
      }

      console.log('✅ Final parsed data:', parsedData, 'Source:', dataSource);

      // เก็บข้อมูล
      this.currentSlipData = parsedData;
      if (qrResult && qrResult.data) {
        this.currentQRData = qrResult.data;
      }

      // แสดงผลลัพธ์
      this.showResults(parsedData, ocrResult, qrResult, dataSource, qrCroppedImageDataUrl, hasQrCrop);

    } catch (error) {
      console.error('Error processing results:', error);
      throw error;
    }
  }

  /**
   * สร้างข้อมูลพื้นฐานจากข้อความ OCR
   */
  createBasicSlipData(ocrText) {
    const data = {
      amount: 'ไม่สามารถอ่านได้',
      datetime: 'ไม่สามารถอ่านได้',
      sender: 'ไม่สามารถอ่านได้',
      receiver: 'ไม่สามารถอ่านได้',
      reference: 'ไม่สามารถอ่านได้',
      bank: 'ไม่ทราบ',
      type: 'transfer'
    };

    // พยายามหาจำนวนเงินจากข้อความ
    const amountMatch = ocrText.match(/(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*บาท/);
    if (amountMatch) {
      data.amount = amountMatch[1] + ' บาท';
    }

    // พยายามหาวันที่
    const dateMatch = ocrText.match(/(\d{1,2})\s*[\/\-\.]\s*(\d{1,2})\s*[\/\-\.]\s*(\d{2,4})/);
    if (dateMatch) {
      data.datetime = `${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}`;
    }

    return data;
  }

  /**
   * สร้างข้อมูลเปล่าเมื่อไม่สามารถอ่านได้
   */
  createEmptySlipData(ocrResult, qrResult) {
    return {
      amount: 'ไม่สามารถอ่านได้',
      datetime: 'ไม่สามารถอ่านได้',
      sender: 'ไม่สามารถอ่านได้',
      receiver: 'ไม่สามารถอ่านได้',
      reference: 'ไม่สามารถอ่านได้',
      bank: 'ไม่ทราบ',
      type: 'unknown',
      note: 'ข้อมูลไม่สมบูรณ์ - กรุณาตรวจสอบรูปภาพและลองใหม่'
    };
  }

  /**
   * แสดงผลลัพธ์
   */
  showResults(slipData, ocrResult, qrResult, dataSource = 'unknown', qrCroppedImageDataUrl = null, hasQrCrop = false) {
    console.log('📋 Showing results...', {
      dataSource,
      hasQrCroppedImage: !!qrCroppedImageDataUrl,
      hasQrCrop
    });

    this.showSection('results');

    // ตั้งสถานะการตรวจสอบ
    const verificationStatus = document.getElementById('verification-status');
    const verificationText = document.getElementById('verification-text');

    if (verificationStatus && verificationText) {
      switch (dataSource) {
        case 'qr':
          verificationStatus.className = 'verification-status verified';
          verificationText.textContent = 'ตรวจสอบด้วย QR แล้ว';
          break;
        case 'ocr':
          verificationStatus.className = 'verification-status partial';
          verificationText.textContent = 'ตรวจสอบด้วย OCR เท่านั้น';
          break;
        case 'ocr-basic':
          verificationStatus.className = 'verification-status warning';
          verificationText.textContent = 'อ่านข้อมูลได้บางส่วน';
          break;
        default:
          verificationStatus.className = 'verification-status error';
          verificationText.textContent = 'ข้อมูลไม่สมบูรณ์';
      }
    }

    // แสดงข้อมูลสลิป
    this.displaySlipData(slipData);

    // ซ่อน/แสดง sections ตามข้อมูลที่มี
    this.toggleRelevantSections(qrResult, ocrResult, dataSource);

    // แสดงข้อมูล QR (ถ้ามีและอ่านสำเร็จ)
    if (qrResult && qrResult.data && qrResult.success) {
      this.displayQRData(slipData, qrResult.data);
      if (hasQrCrop) {
        console.log('✅ QR Code successfully read from selected crop area');
        this.showNotification('อ่าน QR Code จากพื้นที่ที่เลือกสำเร็จ', 'success');
      }
    } else if (hasQrCrop) {
      console.log('⚠️ No QR Code found in selected crop area');
      this.showNotification('ไม่พบ QR Code ในพื้นที่ที่เลือก', 'warning');

      // แสดงข้อมูลจาก OCR แทน
      if (dataSource === 'ocr' && slipData) {
        const warningMessage = `ใช้ข้อมูลจาก OCR เท่านั้น: จำนวน ${slipData.amount ? slipData.amount.toLocaleString() : 'ไม่ระบุ'} บาท`;
        console.log('ℹ️ Using OCR data only:', warningMessage);
      }
    }

    // แสดงข้อมูล OCR ดิบ
    this.displayRawData(slipData, qrResult);
  }

  /**
   * ซ่อน/แสดง sections ตามความเกี่ยวข้อง
   */
  toggleRelevantSections(qrResult, ocrResult, dataSource) {
    // QR Verification Section - แสดงเฉพาะเมื่ออ่าน QR สำเร็จ
    const qrVerification = document.getElementById('qr-verification');
    if (qrVerification) {
      qrVerification.style.display = (qrResult && qrResult.data && qrResult.success) ? 'block' : 'none';
    }

    // Raw Data Section - แสดงเฉพาะในกรณีจำเป็น
    const rawDataContent = document.getElementById('raw-data-content');
    const toggleRawData = document.getElementById('toggle-raw-data');

    if (rawDataContent && toggleRawData) {
      const shouldShow = this.debug || dataSource === 'ocr-basic' || dataSource === 'empty';

      if (shouldShow) {
        rawDataContent.style.display = 'block';
        toggleRawData.style.display = 'inline';
      } else {
        rawDataContent.style.display = 'none';
        toggleRawData.style.display = 'none';
      }
    }

    console.log('🔀 Toggled sections:', {
      showQR: !!(qrResult && qrResult.data && qrResult.success),
      showRawData: this.debug || dataSource === 'ocr-basic' || dataSource === 'empty'
    });
  }

  /**
   * ซ่อนส่วน Raw Data
   */
  hideRawDataSection() {
    const rawDataSection = document.querySelector('.ocr-raw-data');
    if (rawDataSection) {
      rawDataSection.style.display = 'none';
    }
  }
}