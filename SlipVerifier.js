/**
 * SlipVerifier.js
 * ระบบหลักที่ประสานงานทุกส่วน
 * จัดการการตรวจสอบสลิปการโอนเงินแบบครบวงจร (ฉบับแก้ไขบั๊ก Event Listener)
 */
class SlipVerifier {
  constructor(debug = false) {
    this.ocrProcessor = new OCRProcessor(debug);
    this.slipParser = new SlipParser();
    this.qrScanner = new QRScanner(debug);
    this.qrCropSelector = null; 
    this.imagePreviewManager = new ImagePreviewManager(debug); 
    this.isProcessing = false;
    this.currentCamera = null;
    this.currentQRData = null; 
    this.currentSlipData = null; 
    this.qrResult = null; 
    this.currentQRMode = 'camera'; 
    this.selectedBankType = 'auto'; 
    this.qrImageFile = null; 
    this.currentImageFile = null; 
    this.currentImageDataUrl = null; 
    this.currentCropArea = null; 
    this.debug = debug;

    this.init();
  }

  setDebug(enabled) {
    this.debug = enabled;
    this.ocrProcessor.setDebug(enabled);
    this.qrScanner.setDebug(enabled);
    this.imagePreviewManager.debug = enabled;
  }

  init() {
    this.bindEvents();
    this.showSection('upload');

    setTimeout(() => {
      this.bindQREvents();
    }, 100);

    console.log('Slip Verifier initialized');
  }

  bindEvents() {
    // แก้บั๊ก: ค้นหา Element โดยรองรับทั้ง ID แบบเก่าและแบบใหม่ (ที่อยู่ใน index.html)
    const uploadArea = document.getElementById('upload-area') || document.getElementById('upload-section');
    const fileInput = document.getElementById('file-input') || document.getElementById('slip-upload');
    const fileBtn = document.getElementById('file-btn');
    const cameraBtn = document.getElementById('camera-btn');
    const qrBtn = document.getElementById('qr-btn');

    // ป้องกัน Error โดยการเช็คก่อนว่ามี Element นี้อยู่ในหน้าเว็บหรือไม่ (if uploadArea)
    if (uploadArea) {
      uploadArea.addEventListener('dragover', this.handleDragOver.bind(this));
      uploadArea.addEventListener('dragleave', this.handleDragLeave.bind(this));
      uploadArea.addEventListener('drop', this.handleDrop.bind(this));
      uploadArea.addEventListener('click', (e) => {
        // ให้กดพื้นที่เพื่ออัปโหลดได้เลย
        if (e.target !== fileInput && fileInput) fileInput.click();
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', this.handleFileSelect.bind(this));
    }

    if (fileBtn) {
      fileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (fileInput) fileInput.click();
      });
    }

    if (cameraBtn) {
      cameraBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.startCamera();
      });
    }

    if (qrBtn) {
      qrBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.startQRScanner();
      });
    }

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

    const toggleRawData = document.getElementById('toggle-raw-data');
    if (toggleRawData) {
      toggleRawData.addEventListener('click', this.toggleRawDataVisibility.bind(this));
    }
  }

  bindQREvents() {
    const qrCameraModeBtn = document.getElementById('qr-camera-mode-btn');
    const qrImageModeBtn = document.getElementById('qr-image-mode-btn');

    if (qrCameraModeBtn) {
      qrCameraModeBtn.addEventListener('click', () => this.switchQRMode('camera'));
    }
    if (qrImageModeBtn) {
      qrImageModeBtn.addEventListener('click', () => this.switchQRMode('image'));
    }

    const qrFileInput = document.getElementById('qr-file-input');
    const qrUploadArea = document.getElementById('qr-upload-area'); 
    
    if (qrFileInput && qrUploadArea) {
      qrUploadArea.addEventListener('click', () => qrFileInput.click());
      qrFileInput.addEventListener('change', this.handleQRImageSelect.bind(this));

      if (this.handleQRDragOver && this.handleQRDragLeave && this.handleQRDrop) {
        qrUploadArea.addEventListener('dragover', this.handleQRDragOver.bind(this));
        qrUploadArea.addEventListener('dragleave', this.handleQRDragLeave.bind(this));
        qrUploadArea.addEventListener('drop', this.handleQRDrop.bind(this));
      }
    }

    const qrScanSelectedBtn = document.getElementById('qr-scan-selected-btn');
    const qrResetSelectionBtn = document.getElementById('qr-reset-selection-btn');
    const qrSavePositionBtn = document.getElementById('qr-save-position-btn');

    if (qrScanSelectedBtn && this.scanSelectedQRArea) {
      qrScanSelectedBtn.addEventListener('click', this.scanSelectedQRArea.bind(this));
    }
    if (qrResetSelectionBtn && this.resetQRSelection) {
      qrResetSelectionBtn.addEventListener('click', this.resetQRSelection.bind(this));
    }
    if (qrSavePositionBtn && this.saveQRPosition) {
      qrSavePositionBtn.addEventListener('click', this.saveQRPosition.bind(this));
    }
  }

  handleDragOver(e) {
    e.preventDefault();
    if(e.currentTarget.classList) e.currentTarget.classList.add('drag-over');
  }

  handleDragLeave(e) {
    if(e.currentTarget.classList) e.currentTarget.classList.remove('drag-over');
  }

  async handleDrop(event) {
    event.preventDefault();
    if(event.currentTarget.classList) event.currentTarget.classList.remove('drag-over');

    const files = event.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (!this.validateFile(file)) return;
      this.currentImageFile = file;

      try {
        // ประมวลผลทันที ข้ามขั้นตอน Preview เพื่อความรวดเร็ว
        await this.processFile(file);
      } catch (error) {
        console.error('Error processing dropped file:', error);
        this.showError('ไม่สามารถอ่านไฟล์ได้');
      }
    }
  }

  async handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (!this.validateFile(file)) return;

    this.currentImageFile = file;

    try {
      // ประมวลผลทันที ข้ามขั้นตอน Preview เพื่อความรวดเร็ว
      await this.processFile(file);
    } catch (error) {
      console.error('Error processing file:', error);
      this.showError('ไม่สามารถอ่านไฟล์ได้');
    }
  }

  fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

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

      if (typeof this.updateProcessingStatus !== 'function') {
        throw new Error('updateProcessingStatus is not a function');
      }

      this.updateProcessingStatus('กำลังเตรียมรูปภาพ...', 10);

      const processingImage = document.getElementById('processing-image');
      if (processingImage) {
        processingImage.src = imageDataUrl;
      }

      this.updateProcessingStatus('กำลังอ่านข้อความจากสลิป...', 20);
      const ocrResult = await this.ocrProcessor.processImage(imageFile);

      this.updateProcessingStatus('กำลังสแกน QR Code...', 50);
      let qrResult = null;
      let qrCroppedImageDataUrl = null;

      if (cropArea) {
        const qrCroppedBlob = await this.cropImage(imageDataUrl, cropArea);
        qrCroppedImageDataUrl = await this.blobToDataUrl(qrCroppedBlob);
        qrResult = await this.qrScanner.scanImageBlob(qrCroppedBlob);
      }

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

  async startCamera() {
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
      this.showToast('ไม่สามารถเปิดกล้องได้', 'error');
    }
  }

  stopCamera() {
    if (this.currentCamera) {
      this.currentCamera.getTracks().forEach(track => track.stop());
      this.currentCamera = null;
    }
    const video = document.getElementById('camera-video');
    if (video) video.srcObject = null;
    this.showSection('upload');
  }

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

    canvas.toBlob(async (blob) => {
      if (blob) {
        this.stopCamera();
        const file = new File([blob], 'camera-capture.jpg', {type: 'image/jpeg'});
        await this.processFile(file); // ส่งไปประมวลผลทันที
      }
    }, 'image/jpeg', 0.9);
  }  

  async startQRScanner() {
    this.showSection('qr');
    try {
      const video = document.getElementById('qr-video');
      const canvas = document.getElementById('qr-canvas');
      if (!video || !canvas) throw new Error('ไม่พบ video หรือ canvas element');

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {facingMode: 'environment'}
      });

      video.srcObject = stream;
      this.qrCameraStream = stream;
      this.startQRScanLoop(video, canvas);
      this.showNotification('เริ่มสแกน QR Code แล้ว', 'success');

    } catch (error) {
      this.showNotification('ไม่สามารถเปิดกล้องได้', 'error');
    }
  }

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
          return; 
        }
      }
      this.qrScanTimer = requestAnimationFrame(scanQR);
    };
    scanQR();
  }

  handleQRDetected(qrCode) {
    if (this.qrScanTimer) {
      cancelAnimationFrame(this.qrScanTimer);
      this.qrScanTimer = null;
    }
    this.displayQRResults(qrCode);
    this.showNotification('พบ QR Code แล้ว!', 'success');
  }

  displayQRResults(qrCode) {
    const rawDisplay = document.getElementById('qr-raw-display');
    if (rawDisplay) rawDisplay.value = qrCode.data;

    const parsedData = this.parseQRData(qrCode.data);
    this.displayParsedQRData(parsedData);

    const resultsSection = document.getElementById('qr-results');
    if (resultsSection) resultsSection.style.display = 'block';

    this.currentQRData = { raw: qrCode.data, parsed: parsedData };
  }

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
      if (element) element.textContent = value;
    });
  }

  parseQRData(rawData) {
    try {
      return {
        raw_data: rawData,
        type: 'raw',
        message: 'ข้อมูลดิบ QR Code',
        length: rawData ? rawData.length : 0,
        preview: rawData && rawData.length > 100 ? rawData.substring(0, 100) + '...' : rawData,
        success: !!(rawData && rawData.length > 0)
      };
    } catch (error) {
      return { raw_data: null, type: 'error', message: 'ไม่สามารถอ่าน QR Code ได้', success: false };
    }
  }

  restartQRScan() {
    const resultsSection = document.getElementById('qr-results');
    if (resultsSection) resultsSection.style.display = 'none';

    const video = document.getElementById('qr-video');
    const canvas = document.getElementById('qr-canvas');
    if (video && canvas) this.startQRScanLoop(video, canvas);
  }

  stopQRScanner() {
    if (this.qrScanTimer) {
      cancelAnimationFrame(this.qrScanTimer);
      this.qrScanTimer = null;
    }
    if (this.qrCameraStream) {
      this.qrCameraStream.getTracks().forEach(track => track.stop());
      this.qrCameraStream = null;
    }
    this.showSection('upload');
  }

  async copyQRData() {
    if (!this.currentQRData) return;
    const data = this.currentQRData.parsed;
    const text = `จำนวนเงิน: ${data.amount}\nวันที่-เวลา: ${data.datetime}\nผู้โอน: ${data.sender}\nผู้รับ: ${data.receiver}\nรหัสอ้างอิง: ${data.reference}\n\nข้อมูลดิบ: ${this.currentQRData.raw}`;
    try {
      await navigator.clipboard.writeText(text);
      this.showNotification('คัดลอกข้อมูล QR แล้ว', 'success');
    } catch (error) {
      this.showNotification('ไม่สามารถคัดลอกได้', 'error');
    }
  }

  handleQRError(errorMessage) {
    this.stopQRScanner();
    this.showToast(errorMessage, 'error');
  }

  async processQRData(qrData) {
    try {
      const qrResult = {
        raw_data: qrData,
        type: 'raw',
        message: 'ข้อมูลดิบ QR Code',
        length: qrData ? qrData.length : 0,
        preview: qrData && qrData.length > 100 ? qrData.substring(0, 100) + '...' : qrData,
        success: !!(qrData && qrData.length > 0)
      };

      if (qrResult.success) {
        this.currentQRData = qrResult;
        this.showToast('อ่าน QR Code สำเร็จ!', 'success');
        this.showQRResults(qrResult, qrData);
      } else {
        this.showToast('ไม่สามารถอ่าน QR Code ได้', 'error');
      }
    } catch (error) {
      this.showToast('เกิดข้อผิดพลาดในการประมวลผล QR', 'error');
    }
  }

  showQRResults(parsedData, rawData) {
    this.showSection('results');
    const verificationStatus = document.getElementById('verification-status');
    const verificationText = document.getElementById('verification-text');
    if (verificationStatus && verificationText) {
      verificationStatus.className = 'verification-status verified';
      verificationText.textContent = 'ตรวจสอบด้วย QR แล้ว';
    }
    this.displaySlipData(parsedData);
    this.displayQRData(parsedData, rawData);
  }

  displaySlipData(data) {
    if (data.type === 'raw') {
      const elements = { 'slip-amount': '-', 'slip-datetime': '-', 'slip-sender': '-', 'slip-receiver': '-', 'slip-reference': '-' };
      Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
      });
      return;
    }

    const elements = {
      'slip-amount': data.amount || '-',
      'slip-datetime': data.datetime || '-',
      'slip-sender': data.sender || '-',
      'slip-receiver': data.receiver || '-',
      'slip-reference': data.reference || '-'
    };
    Object.entries(elements).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    });
  }

  displayQRData(parsedData, rawData) {
    const qrVerification = document.getElementById('qr-verification');
    if (qrVerification) qrVerification.style.display = 'block';

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
      if (element) element.textContent = value;
    });
  }

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

  showImagePreview(file) {
    const img = document.getElementById('processing-image');
    if(!img) return;
    const reader = new FileReader();
    reader.onload = (e) => { img.src = e.target.result; };
    reader.readAsDataURL(file);
  }

  async processFile(file) {
    if (!file.type.startsWith('image/')) {
      this.showToast('กรุณาเลือกไฟล์รูปภาพ', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.showToast('ขนาดไฟล์เกิน 10MB', 'error');
      return;
    }

    try {
      this.showSection('processing');

      const reader = new FileReader();
      reader.onload = (e) => {
        const processingImage = document.getElementById('processing-image');
        if (processingImage) {
          processingImage.src = e.target.result;
        }
      };
      reader.readAsDataURL(file);

      this.updateProgress(20, 'กำลังอ่านไฟล์...');
      await this.delay(500);
      this.updateProgress(50, 'กำลังประมวลผลด้วย OCR...');

      const ocrResult = await this.ocrProcessor.processImage(file);
      this.updateProgress(80, 'กำลังแปลข้อมูล...');

      const slipData = this.slipParser.parse(ocrResult.text);
      this.updateProgress(100, 'เสร็จสิ้น!');

      this.currentSlipData = {
        ...slipData,
        ocrResult: ocrResult,
        imageFile: file
      };

      await this.delay(500);
      this.showResults(this.currentSlipData);

    } catch (error) {
      console.error('File processing error:', error);
      this.showError('เกิดข้อผิดพลาดในการประมวลผล: ' + error.message);
    }
  }

  updateProgress(percent, text) {
    const progressFill = document.getElementById('progress-fill');
    const processingText = document.getElementById('processing-text');
    if (progressFill) progressFill.style.width = percent + '%';
    if (processingText) processingText.textContent = text;
  }  

  updateProgressSteps(currentStep) {
    const stepMapping = {
      'upload': 0, 'camera': 0, 'qr': 0, 'image-preview': 1, 'processing': 2, 'results': 3, 'error': -1
    };
    const stepIndex = stepMapping[currentStep];
    if (stepIndex === -1) return;

    const steps = document.querySelectorAll('.step');
    const connectors = document.querySelectorAll('.step-connector');

    steps.forEach((step, index) => {
      step.classList.remove('active', 'completed');
      if (index < stepIndex) step.classList.add('completed');
      else if (index === stepIndex) step.classList.add('active');
    });

    connectors.forEach((connector, index) => {
      connector.classList.remove('completed');
      if (index < stepIndex) connector.classList.add('completed');
    });
  }

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
      headerDescription.style.opacity = '0';
      setTimeout(() => { headerDescription.style.opacity = '1'; }, 200);
    }
  }

  displayRawData(slipData, qrResult) {
    const rawOcrText = document.getElementById('raw-ocr-text');
    if (rawOcrText && slipData) rawOcrText.value = slipData.raw_text || '';
  }

  showError(message) {
    this.showSection('error');
    const errorMessage = document.getElementById('error-message');
    if (errorMessage) errorMessage.textContent = message;
  }

  delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  showDebugExample() {
    this.showToast('ตัวอย่าง debug - ฟีเจอร์นี้จะพัฒนาในเวอร์ชันถัดไป', 'info');
  }

  copySlipData() {
    if (!this.currentSlipData) return;
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

  copyRawData() {
    if (!this.currentSlipData || !this.currentSlipData.ocrResult) return;
    this.copyToClipboard(this.currentSlipData.ocrResult.text || '');
  }

  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      this.showToast('คัดลอกข้อมูลแล้ว', 'success');
    } catch (error) {
      this.showToast('ไม่สามารถคัดลอกได้', 'error');
    }
  }

  reset() {
    this.currentSlipData = null;
    this.currentQRData = null;
    this.currentQRImageFile = null;
    this.currentCropArea = null; 
    this.qrResult = null;
    this.isProcessing = false;
    this.stopCamera();
    this.stopQRScanner();
    this.showSection('upload');
  }

  toggleRawDataVisibility() {
    const rawDataContent = document.getElementById('raw-data-content');
    const toggleIcon = document.querySelector('#toggle-raw-data .bi');
    if (rawDataContent && toggleIcon) {
      const isVisible = rawDataContent.style.display !== 'none';
      rawDataContent.style.display = isVisible ? 'none' : 'block';
      toggleIcon.className = isVisible ? 'bi bi-chevron-down' : 'bi bi-chevron-up';
    }
  }

  createSimpleBankQRSelector() {
    // (ฟังก์ชันนี้ยังคงอยู่เพื่อให้ระบบไม่พัง)
  }  
  bindSimpleQREvents() {
    // (ฟังก์ชันนี้ยังคงอยู่เพื่อให้ระบบไม่พัง)
  }
  loadSimpleQRImage(file) {
    // (ฟังก์ชันนี้ยังคงอยู่เพื่อให้ระบบไม่พัง)
  }
  updateQROverlayPosition() {}
  async scanSimpleQR() {}
  calculateCropArea() { return {x:0, y:0, width:100, height:100}; }

  showSection(sectionName) {
    this.updateProgressSteps(sectionName);
    this.updateHeaderDescription(sectionName);

    const sections = ['upload-section', 'camera-section', 'image-preview-section', 'qr-section', 'processing-section', 'results-section', 'error-section'];
    const targetSection = document.getElementById(`${sectionName}-section`);

    if (!targetSection) return;

    sections.forEach(sectionId => {
      const section = document.getElementById(sectionId);
      if (section && sectionId !== `${sectionName}-section` && section.style.display !== 'none') {
        section.classList.add('section-exit');
        setTimeout(() => {
          section.style.display = 'none';
          section.classList.remove('section-exit');
        }, 300);
      }
    });

    setTimeout(() => {
      targetSection.style.display = 'block';
      targetSection.classList.add('section-enter');
      setTimeout(() => { targetSection.classList.remove('section-enter'); }, 400);
    }, 100);
  }

  showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMessage = toast?.querySelector('.toast-message');
    const toastIcon = toast?.querySelector('.toast-icon');

    if (!toast || !toastMessage || !toastIcon) return;

    const config = {
      success: {icon: 'bi-check-circle-fill', class: 'success'},
      error: {icon: 'bi-exclamation-triangle-fill', class: 'error'},
      warning: {icon: 'bi-exclamation-triangle-fill', class: 'warning'},
      info: {icon: 'bi-info-circle-fill', class: 'info'}
    }[type] || {icon: 'bi-info-circle-fill', class: 'info'};

    toastIcon.className = `toast-icon bi ${config.icon}`;
    toastMessage.textContent = message;
    toast.className = `toast ${config.class}`;
    toast.style.display = 'block';

    setTimeout(() => { toast.style.display = 'none'; }, 3000);
  }

  showNotification(message, type = 'info') { this.showToast(message, type); }

  async destroy() {
    try {
      if (this.stopCamera) this.stopCamera();
      if (this.stopQRScanner) this.stopQRScanner();
      if (this.qrCropSelector && this.qrCropSelector.destroy) {
        this.qrCropSelector.destroy();
        this.qrCropSelector = null;
      }
      this.currentSlipData = null;
      this.currentQRData = null;
      this.currentQRImageFile = null;
      this.qrResult = null;
      this.isProcessing = false;
      this.currentCamera = null;
    } catch (error) {}
  }

  handleQRImageSelect(e) {
    if (e.target.files.length > 0) this.loadSimpleQRImage(e.target.files[0]);
  }

  handleQRDragOver(e) {
    e.preventDefault();
    if(e.currentTarget.classList) e.currentTarget.classList.add('drag-over');
  }

  handleQRDragLeave(e) {
    e.preventDefault();
    if(e.currentTarget.classList) e.currentTarget.classList.remove('drag-over');
  }

  handleQRDrop(e) {
    e.preventDefault();
    if(e.currentTarget.classList) e.currentTarget.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) this.loadSimpleQRImage(e.dataTransfer.files[0]);
  }

  stopQRCamera() {
    const qrVideo = document.getElementById('qr-video');
    if (qrVideo && qrVideo.srcObject) {
      qrVideo.srcObject.getTracks().forEach(track => track.stop());
      qrVideo.srcObject = null;
    }
  }

  updateProcessingStatus(message, percentage = 0) {
    const processingText = document.getElementById('processing-text');
    if (processingText) processingText.textContent = message;
    const progressFill = document.getElementById('progress-fill');
    if (progressFill) progressFill.style.width = `${percentage}%`;
  }

  async processResults(ocrResult, qrResult, qrCroppedImageDataUrl = null, hasQrCrop = false) {
    try {
      let parsedData = null;
      let dataSource = 'none';

      let qrData = null;
      if (qrResult && qrResult.data) {
        qrData = {
          raw_data: qrResult.data,
          type: 'raw',
          message: 'ข้อมูลดิบ QR Code',
          length: qrResult.data.length,
          preview: qrResult.data.length > 100 ? qrResult.data.substring(0, 100) + '...' : qrResult.data,
          success: true
        };
      }

      let ocrData = null;
      if (ocrResult && ocrResult.length > 10) {
        try {
          ocrData = this.slipParser.parse(ocrResult);
        } catch (ocrError) {
          ocrData = this.createBasicSlipData(ocrResult);
        }
      }

      if (ocrData) {
        parsedData = {...ocrData};
        dataSource = 'ocr';
        if (qrData) {
          if (!parsedData.reference && qrData.reference) parsedData.reference = qrData.reference;
          if (!parsedData.receiver && qrData.receiver) parsedData.receiver = qrData.receiver;
          dataSource = 'combined';
        }
      } else if (qrData) {
        parsedData = qrData;
        dataSource = 'qr';
      }

      if (!parsedData) {
        parsedData = this.createEmptySlipData();
        dataSource = 'empty';
      }

      this.currentSlipData = parsedData;
      if (qrResult && qrResult.data) this.currentQRData = qrResult.data;

      this.showResults(parsedData, ocrResult, qrResult, dataSource, qrCroppedImageDataUrl, hasQrCrop);

    } catch (error) { throw error; }
  }

  createBasicSlipData(ocrText) {
    const data = { amount: 'ไม่สามารถอ่านได้', datetime: 'ไม่สามารถอ่านได้', sender: '-', receiver: '-', reference: '-', bank: 'ไม่ทราบ', type: 'transfer' };
    const amountMatch = ocrText.match(/(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*บาท/);
    if (amountMatch) data.amount = amountMatch[1] + ' บาท';
    const dateMatch = ocrText.match(/(\d{1,2})\s*[\/\-\.]\s*(\d{1,2})\s*[\/\-\.]\s*(\d{2,4})/);
    if (dateMatch) data.datetime = `${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}`;
    return data;
  }

  createEmptySlipData() {
    return { amount: 'ไม่สามารถอ่านได้', datetime: 'ไม่สามารถอ่านได้', sender: '-', receiver: '-', reference: '-', bank: 'ไม่ทราบ', type: 'unknown' };
  }

  showResults(slipData, ocrResult, qrResult, dataSource = 'unknown', qrCroppedImageDataUrl = null, hasQrCrop = false) {
    this.showSection('results');

    // สร้างข้อมูลที่ดึงได้ลงไปใน HTML (เพื่อให้ app.js ดึงไปเซฟ)
    const resultDetails = document.getElementById('slip-result-details');
    if(resultDetails) {
        resultDetails.innerHTML = `
            <div class="result-item">
                <span class="result-label">ยอดเงินโอน:</span>
                <span class="result-value amount-highlight">${slipData.amount || '-'} บาท</span>
            </div>
            <div class="result-item">
                <span class="result-label">วันที่-เวลา:</span>
                <span class="result-value">${slipData.datetime || '-'}</span>
            </div>
        `;
    }

    this.toggleRelevantSections(qrResult, ocrResult, dataSource);
  }

  toggleRelevantSections(qrResult, ocrResult, dataSource) {
    const qrVerification = document.getElementById('qr-verification');
    if (qrVerification) {
      qrVerification.style.display = (qrResult && qrResult.data && qrResult.success) ? 'block' : 'none';
    }

    const rawDataContent = document.getElementById('raw-data-content');
    const toggleRawData = document.getElementById('toggle-raw-data');

    if (rawDataContent && toggleRawData) {
      const shouldShow = this.debug || dataSource === 'ocr-basic' || dataSource === 'empty';
      rawDataContent.style.display = shouldShow ? 'block' : 'none';
      toggleRawData.style.display = shouldShow ? 'inline' : 'none';
    }
  }

  hideRawDataSection() {
    const rawDataSection = document.querySelector('.ocr-raw-data');
    if (rawDataSection) rawDataSection.style.display = 'none';
  }
}
