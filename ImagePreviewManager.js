/**
 * ImagePreviewManager.js
 * จัดการการแสดงรูปภาพตัวอย่างและการเลือกพื้นที่ QR
 */

class ImagePreviewManager {
  constructor(debug = false) {
    this.debug = debug;
    this.currentImage = null;
    this.selectedBank = 'full';
    this.cropSelector = null;
    this.savedPositions = this.loadSavedPositions();
    this.imageElement = null;
    this.cropOverlay = null;
    this.cropSelection = null;

    // Mouse/Touch selection state
    this.isSelecting = false;
    this.isResizing = false;
    this.isDragging = false;
    this.startX = 0;
    this.startY = 0;
    this.offsetX = 0;
    this.offsetY = 0;

    // สำหรับ debounce การอัปเดตรูปที่ตัด
    this.cropUpdateTimeout = null;

    // ตำแหน่งเริ่มต้นสำหรับแต่ละธนาคาร (เป็นเปอร์เซ็นต์ของรูปภาพ)
    this.defaultBankPositions = {
      'SCB': {x: 0.15, y: 0.7, width: 0.7, height: 0.25},
      'KBANK': {x: 0.1, y: 0.65, width: 0.8, height: 0.3},
      'BBL': {x: 0.1, y: 0.6, width: 0.8, height: 0.35},
      'KTB': {x: 0.15, y: 0.65, width: 0.7, height: 0.3},
      'TTB': {x: 0.1, y: 0.6, width: 0.8, height: 0.35},
      'BAY': {x: 0.1, y: 0.65, width: 0.8, height: 0.3},
      'GSB': {x: 0.15, y: 0.7, width: 0.7, height: 0.25},
      'full': {x: 0, y: 0, width: 1, height: 1},
      'custom': {x: 0.2, y: 0.2, width: 0.6, height: 0.6}
    };

    this.init();
  }

  /**
   * เริ่มต้นระบบ
   */
  init() {
    this.bindEvents();
    if (this.debug) {
      console.log('🖼️ ImagePreviewManager initialized');
    }
  }

  /**
   * ผูก Event Listeners
   */
  bindEvents() {
    // Bank selection
    const bankRadios = document.querySelectorAll('input[name="preview-bank-type"]');
    bankRadios.forEach(radio => {
      radio.addEventListener('change', this.handleBankChange.bind(this));
    });    // Action buttons
    const processBtn = document.getElementById('process-slip-btn');
    const backBtn = document.getElementById('preview-back-btn');
    const changeImageBtn = document.getElementById('change-image-btn');

    if (processBtn) {
      processBtn.addEventListener('click', this.handleProcessSlip.bind(this));
    }

    if (backBtn) {
      backBtn.addEventListener('click', this.handleBack.bind(this));
    }

    if (changeImageBtn) {
      changeImageBtn.addEventListener('click', this.handleChangeImage.bind(this));
    }

    // Image elements
    this.imageElement = document.getElementById('preview-image');
    this.cropOverlay = document.getElementById('qr-crop-overlay');
    this.cropSelection = document.getElementById('crop-selection');

    if (this.imageElement) {
      this.imageElement.addEventListener('load', this.handleImageLoad.bind(this));
      this.imageElement.addEventListener('click', this.handleImageClick.bind(this));
    }
  }

  /**
   * แสดงรูปภาพตัวอย่าง
   */
  showPreview(imageFile, imageDataUrl) {
    this.currentImage = {
      file: imageFile,
      dataUrl: imageDataUrl
    };

    const imageElement = document.getElementById('preview-image');
    if (imageElement) {
      imageElement.src = imageDataUrl;
    }

    // แสดงส่วน preview โดยใช้ SlipVerifier showSection
    if (window.slipVerifier && typeof window.slipVerifier.showSection === 'function') {
      window.slipVerifier.showSection('image-preview');
    } else {
      this.showSection('image-preview');
    }

    // รีเซ็ตการเลือกธนาคาร
    this.resetBankSelection();

    if (this.debug) {
      console.log('🖼️ Showing image preview');
    }
  }

  /**
   * จัดการเมื่อรูปภาพโหลดเสร็จ
   */
  handleImageLoad() {
    if (this.debug) {
      console.log('🖼️ Image loaded, setting up crop area');
    }

    // ตั้งค่าพื้นที่ crop เริ่มต้น
    this.setupCropArea();
  }

  /**
   * ตั้งค่าพื้นที่ crop
   */
  setupCropArea() {
    if (!this.imageElement || !this.cropOverlay || !this.cropSelection) {
      return;
    }

    const position = this.getCurrentBankPosition();
    this.updateCropSelection(position);
    this.updateClickInstruction();
    this.updateImageClickMode();

    // ตั้งค่า interaction สำหรับ crop area
    this.setupCropInteraction();
  }

  /**
   * ได้รับตำแหน่งปัจจุบันตามธนาคารที่เลือก
   */
  getCurrentBankPosition() {
    // ตรวจสอบว่ามีตำแหน่งที่บันทึกไว้หรือไม่
    if (this.savedPositions[this.selectedBank]) {
      return this.savedPositions[this.selectedBank];
    }

    // ใช้ตำแหน่งเริ่มต้น
    return this.defaultBankPositions[this.selectedBank] || this.defaultBankPositions['full'];
  }

  /**
   * อัปเดตพื้นที่เลือก
   */
  updateCropSelection(position) {
    if (!this.imageElement || !this.cropSelection) {
      return;
    }

    const rect = this.imageElement.getBoundingClientRect();
    const imageWidth = rect.width;
    const imageHeight = rect.height;

    const left = position.x * imageWidth;
    const top = position.y * imageHeight;
    const width = position.width * imageWidth;
    const height = position.height * imageHeight;

    this.cropSelection.style.left = `${left}px`;
    this.cropSelection.style.top = `${top}px`;
    this.cropSelection.style.width = `${width}px`;
    this.cropSelection.style.height = `${height}px`;

    // แสดง/ซ่อน crop overlay
    if (this.selectedBank === 'full') {
      this.cropOverlay.style.display = 'none';
      this.showCropControls(false);
    } else {
      this.cropOverlay.style.display = 'block';
      this.showCropControls(true);
      // ตัดรูปและแสดงผลอัตโนมัติ
      setTimeout(() => this.cropAndShowPreview(), 100);
    }

    this.updateAreaDescription();
  }

  /**
   * ตั้งค่าการ interact กับ crop area
   */
  setupCropInteraction() {
    if (!this.cropSelection) {
      return;
    }

    // Remove existing event listeners first
    this.removeExistingListeners();

    // Setup image click for creating new selection
    this.setupImageClick();

    // Setup crop area interaction
    this.setupCropAreaInteraction();

    // Setup resize handles
    this.setupResizeHandles();

    // Debug: ตรวจสอบ setup
    if (this.debug) {
      console.log('🔧 Setting up crop interaction...');
      console.log('Crop selection element:', this.cropSelection);
      console.log('Image element:', this.imageElement);
    }
  }

  /**
   * ลบ event listeners เดิม
   */
  removeExistingListeners() {
    // Remove document listeners if they exist
    if (this.boundMouseMove) {
      document.removeEventListener('mousemove', this.boundMouseMove);
      document.removeEventListener('touchmove', this.boundTouchMove);
    }
    if (this.boundMouseUp) {
      document.removeEventListener('mouseup', this.boundMouseUp);
      document.removeEventListener('touchend', this.boundTouchEnd);
    }
  }

  /**
   * ตั้งค่าการคลิกบนรูปภาพเพื่อสร้าง crop area ใหม่
   */
  setupImageClick() {
    if (!this.imageElement) return;

    // Remove existing click listener
    this.imageElement.removeEventListener('mousedown', this.boundImageMouseDown);
    this.imageElement.removeEventListener('touchstart', this.boundImageTouchStart);

    // Create new bound functions
    this.boundImageMouseDown = this.handleImageMouseDown.bind(this);
    this.boundImageTouchStart = this.handleImageTouchStart.bind(this);

    // Add new listeners
    this.imageElement.addEventListener('mousedown', this.boundImageMouseDown);
    this.imageElement.addEventListener('touchstart', this.boundImageTouchStart, {passive: false});
  }

  /**
   * ตั้งค่าการโต้ตอบกับ crop area (ลากเพื่อเลื่อน)
   */
  setupCropAreaInteraction() {
    if (!this.cropSelection) return;

    // Remove existing listeners
    this.cropSelection.removeEventListener('mousedown', this.boundCropMouseDown);
    this.cropSelection.removeEventListener('touchstart', this.boundCropTouchStart);

    // Create new bound functions
    this.boundCropMouseDown = this.handleCropMouseDown.bind(this);
    this.boundCropTouchStart = this.handleCropTouchStart.bind(this);

    // Add new listeners
    this.cropSelection.addEventListener('mousedown', this.boundCropMouseDown);
    this.cropSelection.addEventListener('touchstart', this.boundCropTouchStart, {passive: false});

    // Document-level move and up events
    this.boundMouseMove = this.handleMouseMove.bind(this);
    this.boundMouseUp = this.handleMouseUp.bind(this);
    this.boundTouchMove = this.handleTouchMove.bind(this);
    this.boundTouchEnd = this.handleTouchEnd.bind(this);

    document.addEventListener('mousemove', this.boundMouseMove);
    document.addEventListener('mouseup', this.boundMouseUp);
    document.addEventListener('touchmove', this.boundTouchMove, {passive: false});
    document.addEventListener('touchend', this.boundTouchEnd);
  }

  /**
   * ตั้งค่า resize handles
   */
  setupResizeHandles() {
    const handles = this.cropSelection.querySelectorAll('.crop-handle');
    handles.forEach(handle => {
      // Remove existing listeners
      handle.removeEventListener('mousedown', this.boundHandleMouseDown);
      handle.removeEventListener('touchstart', this.boundHandleTouchStart);

      // Create bound functions if not exist
      if (!this.boundHandleMouseDown) {
        this.boundHandleMouseDown = this.handleResizeMouseDown.bind(this);
        this.boundHandleTouchStart = this.handleResizeTouchStart.bind(this);
      }

      // Add new listeners
      handle.addEventListener('mousedown', this.boundHandleMouseDown);
      handle.addEventListener('touchstart', this.boundHandleTouchStart, {passive: false});
    });
  }  /**
   * จัดการการเปลี่ยนธนาคาร
   */
  handleBankChange(event) {
    this.selectedBank = event.target.value;

    if (this.debug) {
      console.log('🏦 Bank changed to:', this.selectedBank);
    }

    // แสดงพื้นที่เริ่มต้นของธนาคารที่เลือก (ยกเว้น "ทั้งรูป")
    if (this.selectedBank !== 'full') {
      const position = this.getCurrentBankPosition();
      this.updateCropSelection(position);
    } else {
      // ซ่อน crop overlay สำหรับ "ทั้งรูป"
      if (this.cropOverlay) {
        this.cropOverlay.style.display = 'none';
      }
    }

    // แสดง/ซ่อนคำแนะนำการคลิก
    this.updateClickInstruction();
    this.updateImageClickMode();
  }

  /**
   * อัปเดตคำแนะนำการคลิก
   */
  updateClickInstruction() {
    const instructionElement = document.getElementById('click-instruction');
    if (!instructionElement) return;

    if (this.selectedBank === 'full') {
      instructionElement.style.display = 'none';
    } else {
      instructionElement.style.display = 'block';
    }
  }

  /**
   * อัปเดต cursor mode สำหรับการคลิก
   */
  updateImageClickMode() {
    const wrapper = document.querySelector('.preview-image-wrapper');
    if (!wrapper) return;

    if (this.selectedBank === 'full') {
      wrapper.classList.remove('click-mode');
    } else {
      wrapper.classList.add('click-mode');
    }
  }

  /**
   * อัปเดตคำอธิบายพื้นที่
   */
  updateAreaDescription() {
    const descElement = document.getElementById('qr-area-description');
    if (!descElement) return;

    if (this.selectedBank === 'full') {
      descElement.textContent = 'ทั้งรูป';
    } else if (this.selectedBank === 'custom') {
      descElement.textContent = 'กำหนดเอง';
    } else {
      const bankNames = {
        'SCB': 'ไทยพาณิชย์',
        'KBANK': 'กสิกรไทย',
        'BBL': 'กรุงเทพ',
        'KTB': 'กรุงไทย',
        'TTB': 'ทหารไทยธนชาต',
        'BAY': 'กรุงศรีอยุธยา',
        'GSB': 'ออมสิน'
      };
      descElement.textContent = `${bankNames[this.selectedBank]} (QR Area)`;
    }
  }

  /**
   * แสดง/ซ่อนการควบคุม crop
   */
  showCropControls(show) {
    // ไม่ต้องแสดงปุ่มควบคุมแล้ว เพราะใช้ auto-save
    return;
  }

  /**
   * จัดการการคลิกบนรูปภาพ (สร้าง crop area ใหม่ด้วยการลาก)
   */
  handleImageMouseDown(event) {
    // ตรวจสอบว่าไม่ใช่การคลิกบน crop area หรือ handle
    if (event.target.closest('.crop-selection') || event.target.closest('.crop-handle')) {
      return;
    }

    // เฉพาะเมื่อไม่ใช่ "ทั้งรูป"
    if (this.selectedBank === 'full') {
      return;
    }

    this.isSelecting = true;
    const rect = this.imageElement.getBoundingClientRect();
    this.startX = event.clientX - rect.left;
    this.startY = event.clientY - rect.top;

    // ซ่อน crop area ปัจจุบันชั่วคราว
    this.cropSelection.style.display = 'none';

    event.preventDefault();
  }

  /**
   * จัดการการลาก crop area (เลื่อนตำแหน่ง)
   */
  handleCropMouseDown(event) {
    // ตรวจสอบว่าไม่ใช่ handle
    if (event.target.classList.contains('crop-handle')) {
      return;
    }

    this.isDragging = true;
    const cropRect = this.cropSelection.getBoundingClientRect();
    const imageRect = this.imageElement.getBoundingClientRect();

    this.offsetX = event.clientX - cropRect.left;
    this.offsetY = event.clientY - cropRect.top;

    // เพิ่ม visual feedback
    this.cropSelection.style.opacity = '0.8';

    event.preventDefault();
    event.stopPropagation();
  }

  /**
   * จัดการการปรับขนาด
   */
  handleResizeMouseDown(event) {
    this.isResizing = true;
    this.resizeHandle = event.target.classList[1]; // เช่น 'bottom-right'

    // เพิ่ม visual feedback
    this.cropSelection.style.opacity = '0.8';

    event.stopPropagation();
    event.preventDefault();
  }

  /**
   * จัดการการเคลื่อนไหวของเมาส์ (สำหรับทุกโหมด)
   */
  handleMouseMove(event) {
    if (this.isSelecting) {
      this.updateSelection(event.clientX, event.clientY);
    } else if (this.isDragging) {
      this.updateCropPosition(event.clientX, event.clientY);
    } else if (this.isResizing) {
      this.updateCropSize(event.clientX, event.clientY);
    }
  }

  /**
   * จัดการการปล่อยเมาส์
   */
  handleMouseUp(event) {
    if (this.isSelecting) {
      this.finishSelection();
    } else if (this.isDragging || this.isResizing) {
      this.finishDragging();
    }

    // รีเซ็ต state
    this.isSelecting = false;
    this.isDragging = false;
    this.isResizing = false;
    this.resizeHandle = null;

    // คืน visual feedback
    if (this.cropSelection) {
      this.cropSelection.style.opacity = '1';
    }
  }

  /**
   * อัปเดตการเลือกพื้นที่ (ขณะลาก)
   */
  updateSelection(clientX, clientY) {
    if (!this.imageElement || !this.cropSelection) return;

    const rect = this.imageElement.getBoundingClientRect();
    const currentX = clientX - rect.left;
    const currentY = clientY - rect.top;

    // คำนวณขนาดและตำแหน่ง
    const left = Math.min(this.startX, currentX);
    const top = Math.min(this.startY, currentY);
    const width = Math.abs(currentX - this.startX);
    const height = Math.abs(currentY - this.startY);

    // ขนาดขั้นต่ำ
    const minSize = 30;
    if (width < minSize || height < minSize) return;

    // จำกัดไม่ให้เกินขอบรูปภาพ
    const maxWidth = rect.width - left;
    const maxHeight = rect.height - top;
    const finalWidth = Math.min(width, maxWidth);
    const finalHeight = Math.min(height, maxHeight);

    // แสดงและอัปเดต crop area
    this.cropSelection.style.display = 'block';
    this.cropSelection.style.left = `${left}px`;
    this.cropSelection.style.top = `${top}px`;
    this.cropSelection.style.width = `${finalWidth}px`;
    this.cropSelection.style.height = `${finalHeight}px`;
  }

  /**
   * เสร็จสิ้นการเลือกพื้นที่
   */
  finishSelection() {
    if (!this.cropSelection) return;

    // ตรวจสอบว่ามีขนาดพอสมควร
    const width = this.cropSelection.offsetWidth;
    const height = this.cropSelection.offsetHeight;

    if (width < 30 || height < 30) {
      // คืนสู่ตำแหน่งเดิม
      const position = this.getCurrentBankPosition();
      this.updateCropSelection(position);
      return;
    }

    // บันทึกตำแหน่งและอัปเดตรูปตัด
    this.saveCropPosition();
    this.cropAndShowPreview();
  }

  /**
   * เสร็จสิ้นการลาก/ปรับขนาด
   */
  finishDragging() {
    // บันทึกตำแหน่งและอัปเดตรูปตัด
    this.saveCropPosition();
    this.cropAndShowPreview();
  }

  /**
   * อัปเดตตำแหน่ง crop (ขณะลาก)
   */
  updateCropPosition(clientX, clientY) {
    if (!this.imageElement || !this.cropSelection) return;

    const imageRect = this.imageElement.getBoundingClientRect();

    // คำนวณตำแหน่งใหม่
    const newLeft = clientX - this.offsetX - imageRect.left;
    const newTop = clientY - this.offsetY - imageRect.top;

    // จำกัดไม่ให้เกินขอบรูปภาพ
    const cropWidth = this.cropSelection.offsetWidth;
    const cropHeight = this.cropSelection.offsetHeight;

    const maxLeft = imageRect.width - cropWidth;
    const maxTop = imageRect.height - cropHeight;

    const constrainedLeft = Math.max(0, Math.min(newLeft, maxLeft));
    const constrainedTop = Math.max(0, Math.min(newTop, maxTop));

    this.cropSelection.style.left = `${constrainedLeft}px`;
    this.cropSelection.style.top = `${constrainedTop}px`;

    // อัปเดตรูปที่ตัดแล้วแบบ real-time (debounced)
    this.debouncedCropUpdate();
  }

  /**
   * อัปเดตขนาด crop (ขณะปรับขนาด)
   */
  updateCropSize(clientX, clientY) {
    if (!this.imageElement || !this.cropSelection || !this.resizeHandle) return;

    const imageRect = this.imageElement.getBoundingClientRect();

    // คำนวณตำแหน่งเมาส์ relative กับรูปภาพ
    const mouseX = clientX - imageRect.left;
    const mouseY = clientY - imageRect.top;

    const currentLeft = this.cropSelection.offsetLeft;
    const currentTop = this.cropSelection.offsetTop;
    const currentWidth = this.cropSelection.offsetWidth;
    const currentHeight = this.cropSelection.offsetHeight;

    let newLeft = currentLeft;
    let newTop = currentTop;
    let newWidth = currentWidth;
    let newHeight = currentHeight;

    // คำนวณขนาดใหม่ตาม handle ที่ถูกลาก
    switch (this.resizeHandle) {
      case 'top-left':
        newLeft = mouseX;
        newTop = mouseY;
        newWidth = currentLeft + currentWidth - mouseX;
        newHeight = currentTop + currentHeight - mouseY;
        break;
      case 'top-right':
        newTop = mouseY;
        newWidth = mouseX - currentLeft;
        newHeight = currentTop + currentHeight - mouseY;
        break;
      case 'bottom-left':
        newLeft = mouseX;
        newWidth = currentLeft + currentWidth - mouseX;
        newHeight = mouseY - currentTop;
        break;
      case 'bottom-right':
        newWidth = mouseX - currentLeft;
        newHeight = mouseY - currentTop;
        break;
      case 'top-center':
        newTop = mouseY;
        newHeight = currentTop + currentHeight - mouseY;
        break;
      case 'bottom-center':
        newHeight = mouseY - currentTop;
        break;
      case 'left-center':
        newLeft = mouseX;
        newWidth = currentLeft + currentWidth - mouseX;
        break;
      case 'right-center':
        newWidth = mouseX - currentLeft;
        break;
    }

    // ตรวจสอบขนาดขั้นต่ำ
    const minSize = 30;
    if (newWidth < minSize || newHeight < minSize) return;

    // ตรวจสอบไม่ให้เกินขอบรูปภาพ
    if (newLeft < 0 || newTop < 0 ||
      newLeft + newWidth > imageRect.width ||
      newTop + newHeight > imageRect.height) return;

    // อัปเดตตำแหน่งและขนาด
    this.cropSelection.style.left = `${newLeft}px`;
    this.cropSelection.style.top = `${newTop}px`;
    this.cropSelection.style.width = `${newWidth}px`;
    this.cropSelection.style.height = `${newHeight}px`;

    // อัปเดตรูปที่ตัดแล้วแบบ real-time (debounced)
    this.debouncedCropUpdate();
  }

  /**
   * Debounced crop update เพื่อไม่ให้อัปเดตบ่อยเกินไป
   */
  debouncedCropUpdate() {
    if (this.cropUpdateTimeout) {
      clearTimeout(this.cropUpdateTimeout);
    }

    this.cropUpdateTimeout = setTimeout(() => {
      this.cropAndShowPreview();
    }, 200); // รอ 200ms หลังจากหยุดลากแล้วจึงอัปเดต
  }

  /**
   * รีเซ็ตการเลือกธนาคาร
   */
  resetBankSelection() {
    const defaultRadio = document.querySelector('input[name="preview-bank-type"][value="full"]');
    if (defaultRadio) {
      defaultRadio.checked = true;
      this.selectedBank = 'full';
      this.updateCropSelection(this.defaultBankPositions['full']);
    }
  }

  /**
   * รีเซ็ต crop area
   */
  handleResetCrop() {
    const position = this.defaultBankPositions[this.selectedBank] || this.defaultBankPositions['custom'];
    this.updateCropSelection(position);

    if (this.debug) {
      console.log('🔄 Crop area reset');
    }
  }

  /**
   * บันทึกตำแหน่ง crop
   */
  handleSaveCropPosition() {
    if (this.selectedBank === 'full') {
      this.showNotification('ไม่สามารถบันทึกตำแหน่งสำหรับ "ทั้งรูป" ได้', 'warning');
      return;
    }

    const position = this.getCurrentCropPosition();
    this.savedPositions[this.selectedBank] = position;
    this.savePosistionsToStorage();

    this.showNotification('บันทึกตำแหน่งเรียบร้อยแล้ว', 'success');

    if (this.debug) {
      console.log('💾 Saved position for', this.selectedBank, position);
    }
  }

  /**
   * ได้รับตำแหน่ง crop ปัจจุบัน
   */
  getCurrentCropPosition() {
    if (!this.imageElement || !this.cropSelection) {
      return this.defaultBankPositions[this.selectedBank];
    }

    // ใช้ getBoundingClientRect เพื่อให้ได้ตำแหน่งที่แม่นยำ
    const imageRect = this.imageElement.getBoundingClientRect();
    const cropRect = this.cropSelection.getBoundingClientRect();

    // คำนวณตำแหน่ง relative กับรูปภาพ
    const left = cropRect.left - imageRect.left;
    const top = cropRect.top - imageRect.top;
    const width = cropRect.width;
    const height = cropRect.height;

    // แปลงเป็นเปอร์เซ็นต์ของรูปภาพ
    return {
      x: left / imageRect.width,
      y: top / imageRect.height,
      width: width / imageRect.width,
      height: height / imageRect.height
    };
  }

  /**
   * ได้รับพื้นที่ crop ในรูปแบบพิกเซล
   */
  getCropAreaPixels() {
    if (this.selectedBank === 'full') {
      return null; // ใช้รูปเต็ม
    }

    const position = this.getCurrentCropPosition();

    // สร้าง canvas เพื่อวัดขนาดรูปจริง
    const img = new Image();
    img.src = this.currentImage.dataUrl;

    return new Promise((resolve) => {
      img.onload = () => {
        const cropArea = {
          x: Math.round(position.x * img.naturalWidth),
          y: Math.round(position.y * img.naturalHeight),
          width: Math.round(position.width * img.naturalWidth),
          height: Math.round(position.height * img.naturalHeight)
        };
        resolve(cropArea);
      };
    });
  }  /**
   * จัดการการประมวลผลสลิป
   */
  async handleProcessSlip() {
    if (!this.currentImage) {
      this.showNotification('ไม่มีรูปภาพให้ประมวลผล', 'error');
      return;
    }

    console.log('🔍 Processing slip...');

    // บันทึกตำแหน่งอัตโนมัติก่อนประมวลผล
    this.saveCropPosition();

    try {
      const cropArea = await this.getCropAreaPixels();

      // ตรวจสอบ SlipVerifier instance
      const verifier = window.slipVerifier || window.app?.slipVerifier;

      if (!verifier) {
        console.error('SlipVerifier not found');
        this.showNotification('ไม่พบระบบประมวลผล', 'error');
        return;
      }

      console.log('📤 Sending to SlipVerifier:', {
        file: this.currentImage.file?.name,
        bank: this.selectedBank,
        cropArea: cropArea
      });

      // ส่งข้อมูลไปยัง SlipVerifier
      await verifier.processImageWithCrop(
        this.currentImage.file,
        this.currentImage.dataUrl,
        cropArea,
        this.selectedBank
      );

    } catch (error) {
      console.error('Error processing slip:', error);
      this.showNotification('เกิดข้อผิดพลาดในการประมวลผล: ' + error.message, 'error');
    }
  }

  /**
   * จัดการการกลับ
   */
  handleBack() {
    // กลับไปหน้าอัปโหลด โดยใช้ SlipVerifier showSection
    if (window.slipVerifier && typeof window.slipVerifier.showSection === 'function') {
      window.slipVerifier.showSection('upload');
    } else {
      this.showSection('upload');
    }
  }

  /**
   * จัดการการเปลี่ยนรูป
   */
  handleChangeImage() {
    const fileInput = document.getElementById('file-input');
    if (fileInput) {
      fileInput.click();
    }
  }

  /**
   * แสดงส่วนต่างๆ
   */
  showSection(sectionName) {
    const sections = ['upload', 'camera', 'image-preview', 'qr', 'processing', 'results', 'error'];
    sections.forEach(section => {
      const element = document.getElementById(`${section}-section`);
      if (element) {
        element.style.display = section === sectionName ? 'block' : 'none';
      }
    });
  }

  /**
   * โหลดตำแหน่งที่บันทึกไว้
   */
  loadSavedPositions() {
    try {
      const saved = localStorage.getItem('slip-verifier-crop-positions');
      return saved ? JSON.parse(saved) : {};
    } catch (error) {
      console.warn('Failed to load saved positions:', error);
      return {};
    }
  }

  /**
   * บันทึกตำแหน่งลง localStorage
   */
  savePosistionsToStorage() {
    try {
      localStorage.setItem('slip-verifier-crop-positions', JSON.stringify(this.savedPositions));
    } catch (error) {
      console.warn('Failed to save positions:', error);
    }
  }

  /**
   * แสดงการแจ้งเตือน
   */
  showNotification(message, type = 'info') {
    if (window.slipVerifier && window.slipVerifier.showNotification) {
      window.slipVerifier.showNotification(message, type);
    } else {
      console.log(`${type.toUpperCase()}: ${message}`);
    }
  }

  /**
   * จัดการการคลิกที่รูปภาพ (เริ่มต้นระบบ click-and-drag)
   */
  handleImageClick(event) {
    if (this.selectedBank === 'full') {
      return; // ไม่ต้องเลือกพื้นที่สำหรับ "ทั้งรูป"
    }

    // เริ่มระบบ click-and-drag
    this.startRectangleSelection(event);
  }

  /**
   * เริ่มการเลือกพื้นที่แบบสี่เหลี่ยม (click-and-drag)
   */
  startRectangleSelection(event) {
    if (!this.imageElement) return;

    event.preventDefault();
    event.stopPropagation();

    const imageRect = this.imageElement.getBoundingClientRect();
    const startX = event.clientX - imageRect.left;
    const startY = event.clientY - imageRect.top;

    // ตรวจสอบว่าคลิกภายในรูปภาพหรือไม่
    if (startX < 0 || startY < 0 || startX > imageRect.width || startY > imageRect.height) {
      return;
    }

    // บันทึกจุดเริ่มต้น
    this.selectionStart = {
      x: startX,
      y: startY
    };
    this.isCreatingSelection = true;

    // แสดง crop overlay
    if (this.cropOverlay) {
      this.cropOverlay.style.display = 'block';
    }

    // ซ่อน crop selection ชั่วคราวจนกว่าจะมีการลาก
    if (this.cropSelection) {
      this.cropSelection.style.display = 'none';
    }

    // เปลี่ยน cursor
    document.body.style.cursor = 'crosshair';

    // เพิ่ม event listeners
    document.addEventListener('mousemove', this.handleRectangleMove);
    document.addEventListener('mouseup', this.handleRectangleEnd);

    if (this.debug) {
      console.log('🎯 Start selection at:', {x: startX, y: startY});
    }
  }

  /**
   * จัดการการเคลื่อนไหวเมาส์ขณะลาก
   */
  handleRectangleMove = (event) => {
    if (!this.isCreatingSelection || !this.imageElement || !this.cropSelection) return;

    const imageRect = this.imageElement.getBoundingClientRect();
    const currentX = event.clientX - imageRect.left;
    const currentY = event.clientY - imageRect.top;

    // จำกัดไม่ให้เกินขอบรูป
    const constrainedX = Math.max(0, Math.min(currentX, imageRect.width));
    const constrainedY = Math.max(0, Math.min(currentY, imageRect.height));

    // คำนวณกรอบสี่เหลี่ยม
    const left = Math.min(this.selectionStart.x, constrainedX);
    const top = Math.min(this.selectionStart.y, constrainedY);
    const width = Math.abs(constrainedX - this.selectionStart.x);
    const height = Math.abs(constrainedY - this.selectionStart.y);

    // ถ้าขนาดมากกว่า 5px ค่อยแสดงกรอบ
    if (width > 5 && height > 5) {
      this.cropSelection.style.display = 'block';
      this.cropSelection.style.left = `${left}px`;
      this.cropSelection.style.top = `${top}px`;
      this.cropSelection.style.width = `${width}px`;
      this.cropSelection.style.height = `${height}px`;
    }

    if (this.debug) {
      console.log('📏 Rectangle:', {left, top, width, height});
    }
  }

  /**
   * จัดการการปล่อยเมาส์ (สิ้นสุดการเลือก)
   */
  handleRectangleEnd = (event) => {
    if (!this.isCreatingSelection) return;

    this.isCreatingSelection = false;

    // ลบ event listeners
    document.removeEventListener('mousemove', this.handleRectangleMove);
    document.removeEventListener('mouseup', this.handleRectangleEnd);

    // คืนค่า cursor
    document.body.style.cursor = '';

    if (!this.imageElement || !this.cropSelection) return;

    const imageRect = this.imageElement.getBoundingClientRect();
    const currentX = event.clientX - imageRect.left;
    const currentY = event.clientY - imageRect.top;

    const constrainedX = Math.max(0, Math.min(currentX, imageRect.width));
    const constrainedY = Math.max(0, Math.min(currentY, imageRect.height));

    const left = Math.min(this.selectionStart.x, constrainedX);
    const top = Math.min(this.selectionStart.y, constrainedY);
    const width = Math.abs(constrainedX - this.selectionStart.x);
    const height = Math.abs(constrainedY - this.selectionStart.y);

    // ตรวจสอบขนาดขั้นต่ำ
    if (width < 10 || height < 10) {
      // ถ้าเล็กเกินไป ให้สร้างกรอบเล็กๆ รอบจุดที่คลิก
      this.createMinimumSizeRectangle(this.selectionStart.x, this.selectionStart.y);
      return;
    }

    // แสดงกรอบขั้นสุดท้าย
    this.cropSelection.style.display = 'block';
    this.cropSelection.style.left = `${left}px`;
    this.cropSelection.style.top = `${top}px`;
    this.cropSelection.style.width = `${width}px`;
    this.cropSelection.style.height = `${height}px`;

    // เพิ่ม animation
    this.cropSelection.classList.add('selection-created');
    setTimeout(() => {
      this.cropSelection.classList.remove('selection-created');
    }, 300);

    // ตั้งค่า interaction handles
    this.setupCropInteraction();

    // บันทึกและตัดรูป
    this.saveCropPosition();
    this.cropAndShowPreview();

    if (this.debug) {
      console.log('✅ Rectangle completed:', {left, top, width, height});
    }
  }

  /**
   * สร้างกรอบขนาดขั้นต่ำเมื่อคลิกเดียว
   */
  createMinimumSizeRectangle(centerX, centerY) {
    if (!this.imageElement || !this.cropSelection) return;

    const imageRect = this.imageElement.getBoundingClientRect();
    const size = 80; // ขนาดขั้นต่ำ
    const halfSize = size / 2;

    let left = centerX - halfSize;
    let top = centerY - halfSize;
    let width = size;
    let height = size;

    // ปรับให้อยู่ในขอบเขตรูป
    if (left < 0) left = 0;
    if (top < 0) top = 0;
    if (left + width > imageRect.width) left = imageRect.width - width;
    if (top + height > imageRect.height) top = imageRect.height - height;
    if (width > imageRect.width) width = imageRect.width;
    if (height > imageRect.height) height = imageRect.height;

    // แสดงกรอบ
    this.cropSelection.style.display = 'block';
    this.cropSelection.style.left = `${left}px`;
    this.cropSelection.style.top = `${top}px`;
    this.cropSelection.style.width = `${width}px`;
    this.cropSelection.style.height = `${height}px`;

    // เพิ่ม animation
    this.cropSelection.classList.add('click-created');
    setTimeout(() => {
      this.cropSelection.classList.remove('click-created');
    }, 300);

    // ตั้งค่า interaction handles
    this.setupCropInteraction();

    // บันทึกและตัดรูป
    this.saveCropPosition();
    this.cropAndShowPreview();

    if (this.debug) {
      console.log('🎯 Created minimum rectangle at:', {left, top, width, height});
    }
  }

  /**
   * เริ่มระบบ click-and-drag selection
   */
  startClickAndDragSelection(event) {
    if (!this.imageElement) return;

    event.preventDefault();
    event.stopPropagation();

    const imageRect = this.imageElement.getBoundingClientRect();
    const startX = event.clientX - imageRect.left;
    const startY = event.clientY - imageRect.top;

    // ตรวจสอบว่าคลิกภายในรูปภาพหรือไม่
    if (startX < 0 || startY < 0 || startX > imageRect.width || startY > imageRect.height) {
      return;
    }

    // เก็บตำแหน่งเริ่มต้น
    this.dragStartX = startX;
    this.dragStartY = startY;
    this.isCreatingSelection = true;

    // สร้าง crop selection ใหม่ (เริ่มต้นขนาดเล็ก)
    if (this.cropSelection) {
      this.cropSelection.style.left = `${startX}px`;
      this.cropSelection.style.top = `${startY}px`;
      this.cropSelection.style.width = '2px';
      this.cropSelection.style.height = '2px';
      this.cropSelection.style.display = 'block';
    }

    // แสดง crop overlay
    if (this.cropOverlay) {
      this.cropOverlay.style.display = 'block';
    }

    // เพิ่ม cursor แบบ crosshair
    this.imageElement.style.cursor = 'crosshair';

    // เพิ่ม event listeners สำหรับการลาก
    const handleMouseMove = (e) => this.updateClickAndDragSelection(e);
    const handleMouseUp = (e) => this.finishClickAndDragSelection(e, handleMouseMove, handleMouseUp);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    if (this.debug) {
      console.log('🎯 Started click-and-drag at:', {x: startX, y: startY});
    }
  }

  /**
   * อัปเดตการเลือกพื้นที่ขณะลาก
   */
  updateClickAndDragSelection(event) {
    if (!this.isCreatingSelection || !this.imageElement || !this.cropSelection) return;

    const imageRect = this.imageElement.getBoundingClientRect();
    const currentX = event.clientX - imageRect.left;
    const currentY = event.clientY - imageRect.top;

    // จำกัดไม่ให้เกินขอบรูป
    const constrainedX = Math.max(0, Math.min(currentX, imageRect.width));
    const constrainedY = Math.max(0, Math.min(currentY, imageRect.height));

    // คำนวณขนาดและตำแหน่งของกรอบ
    const left = Math.min(this.dragStartX, constrainedX);
    const top = Math.min(this.dragStartY, constrainedY);
    const width = Math.abs(constrainedX - this.dragStartX);
    const height = Math.abs(constrainedY - this.dragStartY);

    // อัปเดตตำแหน่งและขนาด
    this.cropSelection.style.left = `${left}px`;
    this.cropSelection.style.top = `${top}px`;
    this.cropSelection.style.width = `${width}px`;
    this.cropSelection.style.height = `${height}px`;

    // เพิ่ม class สำหรับ animation ขณะสร้าง
    if (width > 5 && height > 5) {
      this.cropSelection.classList.add('creating');
    }

    // อัปเดตข้อมูลขนาดแบบเรียลไทม์
    this.updateSelectionInfo(width, height);

    // แสดงข้อมูลขนาดในเวลาจริง (ถ้าต้องการ)
    if (this.debug && width > 5 && height > 5) {
      console.log('📏 Selection size:', {width, height});
    }
  }

  /**
   * อัปเดตข้อมูลขนาดการเลือก
   */
  updateSelectionInfo(width, height) {
    // หาบริเวณแสดงข้อมูลขนาด
    let sizeInfo = document.getElementById('selection-size-info');
    if (!sizeInfo) {
      sizeInfo = document.createElement('div');
      sizeInfo.id = 'selection-size-info';
      sizeInfo.className = 'selection-size-info';

      const wrapper = document.querySelector('.preview-image-wrapper');
      if (wrapper) {
        wrapper.appendChild(sizeInfo);
      }
    }

    if (width > 5 && height > 5) {
      sizeInfo.textContent = `${Math.round(width)} × ${Math.round(height)} px`;
      sizeInfo.style.display = 'block';
    } else {
      sizeInfo.style.display = 'none';
    }
  }

  /**
   * ซ่อนข้อมูลขนาดการเลือก
   */
  hideSelectionInfo() {
    const sizeInfo = document.getElementById('selection-size-info');
    if (sizeInfo) {
      sizeInfo.style.display = 'none';
    }
  }

  /**
   * เสร็จสิ้นการเลือกพื้นที่ click-and-drag
   */
  finishClickAndDragSelection(event, mouseMoveHandler, mouseUpHandler) {
    this.isCreatingSelection = false;

    // ลบ event listeners
    document.removeEventListener('mousemove', mouseMoveHandler);
    document.removeEventListener('mouseup', mouseUpHandler);

    // คืนค่า cursor
    this.imageElement.style.cursor = '';

    // ซ่อนข้อมูลขนาด
    this.hideSelectionInfo();

    if (!this.imageElement || !this.cropSelection) return;

    // ลบ class creating
    this.cropSelection.classList.remove('creating');

    const finalWidth = this.cropSelection.offsetWidth;
    const finalHeight = this.cropSelection.offsetHeight;

    // ตรวจสอบขนาดขั้นต่ำ
    const minSize = 10;
    if (finalWidth < minSize || finalHeight < minSize) {
      // ถ้าเล็กเกินไป ให้สร้างกรอบขนาดมาตรฐานรอบจุดที่คลิก
      this.createStandardCropArea(event);
      return;
    }

    // เพิ่ม animation class
    this.cropSelection.classList.add('selection-created');
    setTimeout(() => {
      this.cropSelection.classList.remove('selection-created');
    }, 300);

    // ตั้งค่า interaction สำหรับ crop area
    this.setupCropInteraction();

    // บันทึกตำแหน่งอัตโนมัติและตัดรูป
    this.saveCropPosition();
    this.cropAndShowPreview();

    if (this.debug) {
      const position = this.getCurrentCropPosition();
      console.log('🎯 Finished click-and-drag selection:', position);
    }
  }

  /**
   * สร้างพื้นที่ crop ขนาดมาตรฐานรอบจุดที่คลิก
   */
  createStandardCropArea(event) {
    if (!this.imageElement) return;

    const imageRect = this.imageElement.getBoundingClientRect();
    const clickX = event.clientX - imageRect.left;
    const clickY = event.clientY - imageRect.top;

    // สร้างพื้นที่ crop รอบๆ จุดที่คลิก
    const cropSize = 120; // ขนาดพื้นที่ crop มาตรฐาน
    const halfSize = cropSize / 2;

    let left = clickX - halfSize;
    let top = clickY - halfSize;
    let width = cropSize;
    let height = cropSize;

    // ปรับให้อยู่ในขอบเขตรูปภาพ
    if (left < 0) left = 0;
    if (top < 0) top = 0;
    if (left + width > imageRect.width) left = imageRect.width - width;
    if (top + height > imageRect.height) top = imageRect.height - height;
    if (width > imageRect.width) width = imageRect.width;
    if (height > imageRect.height) height = imageRect.height;

    // แปลงเป็นเปอร์เซ็นต์
    const position = {
      x: left / imageRect.width,
      y: top / imageRect.height,
      width: width / imageRect.width,
      height: height / imageRect.height
    };

    this.updateCropSelection(position);

    // แสดง crop overlay
    if (this.cropOverlay) {
      this.cropOverlay.style.display = 'block';
    }

    // เพิ่ม animation class
    if (this.cropSelection) {
      this.cropSelection.classList.add('click-created');
      setTimeout(() => {
        this.cropSelection.classList.remove('click-created');
      }, 300);
    }

    // ตั้งค่า interaction สำหรับ crop area
    this.setupCropInteraction();

    // บันทึกตำแหน่งอัตโนมัติและตัดรูป
    this.saveCropPosition();
    this.cropAndShowPreview();

    if (this.debug) {
      console.log('🎯 Created standard crop area at:', position);
    }
  }

  /**
   * บันทึกตำแหน่ง crop อัตโนมัติ
   */
  saveCropPosition() {
    if (this.selectedBank === 'full') {
      return;
    }

    const position = this.getCurrentCropPosition();
    this.savedPositions[this.selectedBank] = position;
    this.savePosistionsToStorage();

    if (this.debug) {
      console.log('💾 Auto-saved position for', this.selectedBank, position);
    }
  }

  /**
   * ตัดรูปตาม crop selection และแสดงผล
   */
  async cropAndShowPreview() {
    if (!this.currentImage || !this.currentImage.dataUrl) {
      this.showNotification('ไม่มีรูปภาพให้ตัด', 'error');
      return null;
    }

    try {
      const cropArea = await this.getCropAreaPixels();

      if (this.debug) {
        console.log('🔍 Crop area pixels:', cropArea);
        console.log('🔍 Current crop position:', this.getCurrentCropPosition());
      }

      if (!cropArea) {
        // ถ้าเป็น "ทั้งรูป" ให้ใช้รูปต้นฉบับ
        return this.currentImage.dataUrl;
      }

      const croppedImageUrl = await this.cropImageWithCanvas(
        this.currentImage.dataUrl,
        cropArea
      );

      return croppedImageUrl;

    } catch (error) {
      console.error('Error cropping image:', error);
      this.showNotification('เกิดข้อผิดพลาดในการตัดรูป: ' + error.message, 'error');
      return null;
    }
  }

  /**
   * ตัดรูปด้วย Canvas
   */
  async cropImageWithCanvas(imageDataUrl, cropArea) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          // ตั้งขนาด canvas ตามพื้นที่ที่ต้องการตัด
          canvas.width = cropArea.width;
          canvas.height = cropArea.height;

          // วาดส่วนที่ต้องการตัดลงใน canvas
          ctx.drawImage(
            img,
            cropArea.x, cropArea.y, cropArea.width, cropArea.height, // source rectangle
            0, 0, cropArea.width, cropArea.height // destination rectangle
          );

          // แปลงเป็น data URL
          const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.9);
          resolve(croppedDataUrl);

        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => reject(new Error('Failed to load image for cropping'));
      img.src = imageDataUrl;
    });
  }

  // Touch events for mobile support
  handleImageTouchStart(event) {
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      this.handleImageMouseDown({
        clientX: touch.clientX,
        clientY: touch.clientY,
        target: event.target,
        preventDefault: () => event.preventDefault(),
        stopPropagation: () => event.stopPropagation()
      });
    }
  }

  handleCropTouchStart(event) {
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      this.handleCropMouseDown({
        clientX: touch.clientX,
        clientY: touch.clientY,
        target: event.target,
        preventDefault: () => event.preventDefault(),
        stopPropagation: () => event.stopPropagation()
      });
    }
  }

  handleResizeTouchStart(event) {
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      this.handleResizeMouseDown({
        clientX: touch.clientX,
        clientY: touch.clientY,
        target: event.target,
        preventDefault: () => event.preventDefault(),
        stopPropagation: () => event.stopPropagation()
      });
    }
  }

  handleTouchMove(event) {
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      this.handleMouseMove({
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      event.preventDefault();
    }
  }

  handleTouchEnd(event) {
    this.handleMouseUp();
    event.preventDefault();
  }
}
