/**
 * QRCropSelector.js
 * คลาสสำหรับจัดการการเลือกพื้นที่ QR Code ในรูปภาพ
 * รองรับการลาก ปรับขนาด และบันทึกตำแหน่ง
 */
class QRCropSelector {
  constructor(imageElement, selectionElement) {
    this.image = imageElement;
    this.selection = selectionElement;
    this.cropBox = selectionElement.querySelector('.qr-selection-crop');
    this.handles = selectionElement.querySelectorAll('.crop-handle');

    this.isDragging = false;
    this.isResizing = false;
    this.currentHandle = null;
    this.startPos = {x: 0, y: 0};
    this.startBox = {x: 0, y: 0, width: 0, height: 0};

    this.minSize = 50; // ขนาดต่ำสุดของกรอบ
    this.savedPositions = this.loadSavedPositions();

    this.init();
  }

  /**
   * เริ่มต้นระบบ
   */
  init() {
    this.bindEvents();
    this.loadLastPosition();
  }

  /**
   * ผูก Event Listeners
   */
  bindEvents() {
    // Crop box dragging
    this.cropBox.addEventListener('mousedown', this.startDrag.bind(this));
    this.cropBox.addEventListener('touchstart', this.startDrag.bind(this));

    // Handle resizing
    this.handles.forEach(handle => {
      handle.addEventListener('mousedown', this.startResize.bind(this));
      handle.addEventListener('touchstart', this.startResize.bind(this));
    });

    // Global mouse/touch events
    document.addEventListener('mousemove', this.onMove.bind(this));
    document.addEventListener('touchmove', this.onMove.bind(this));
    document.addEventListener('mouseup', this.endAction.bind(this));
    document.addEventListener('touchend', this.endAction.bind(this));

    // Prevent context menu
    this.selection.addEventListener('contextmenu', e => e.preventDefault());
  }

  /**
   * เริ่มการลากกรอบ
   */
  startDrag(e) {
    if (e.target.classList.contains('crop-handle')) return;

    e.preventDefault();
    this.isDragging = true;

    const pos = this.getEventPos(e);
    const rect = this.image.getBoundingClientRect();

    this.startPos = {
      x: pos.x - rect.left,
      y: pos.y - rect.top
    };

    const cropRect = this.cropBox.getBoundingClientRect();
    this.startBox = {
      x: cropRect.left - rect.left,
      y: cropRect.top - rect.top,
      width: cropRect.width,
      height: cropRect.height
    };

    this.cropBox.style.cursor = 'grabbing';
  }

  /**
   * เริ่มการปรับขนาด
   */
  startResize(e) {
    e.preventDefault();
    e.stopPropagation();

    this.isResizing = true;
    this.currentHandle = e.target;

    const pos = this.getEventPos(e);
    const rect = this.image.getBoundingClientRect();

    this.startPos = {
      x: pos.x - rect.left,
      y: pos.y - rect.top
    };

    const cropRect = this.cropBox.getBoundingClientRect();
    this.startBox = {
      x: cropRect.left - rect.left,
      y: cropRect.top - rect.top,
      width: cropRect.width,
      height: cropRect.height
    };
  }

  /**
   * จัดการการเคลื่อนไหว
   */
  onMove(e) {
    if (!this.isDragging && !this.isResizing) return;

    e.preventDefault();

    const pos = this.getEventPos(e);
    const rect = this.image.getBoundingClientRect();
    const currentPos = {
      x: pos.x - rect.left,
      y: pos.y - rect.top
    };

    if (this.isDragging) {
      this.handleDrag(currentPos);
    } else if (this.isResizing) {
      this.handleResize(currentPos);
    }
  }

  /**
   * จัดการการลาก
   */
  handleDrag(currentPos) {
    const deltaX = currentPos.x - this.startPos.x;
    const deltaY = currentPos.y - this.startPos.y;

    let newX = this.startBox.x + deltaX;
    let newY = this.startBox.y + deltaY;

    // จำกัดขอบเขต
    const imageRect = this.image.getBoundingClientRect();
    newX = Math.max(0, Math.min(newX, imageRect.width - this.startBox.width));
    newY = Math.max(0, Math.min(newY, imageRect.height - this.startBox.height));

    this.updateCropBox(newX, newY, this.startBox.width, this.startBox.height);
  }

  /**
   * จัดการการปรับขนาด
   */
  handleResize(currentPos) {
    const deltaX = currentPos.x - this.startPos.x;
    const deltaY = currentPos.y - this.startPos.y;

    let newX = this.startBox.x;
    let newY = this.startBox.y;
    let newWidth = this.startBox.width;
    let newHeight = this.startBox.height;

    const handleClass = this.currentHandle.className;

    if (handleClass.includes('top-left')) {
      newX = this.startBox.x + deltaX;
      newY = this.startBox.y + deltaY;
      newWidth = this.startBox.width - deltaX;
      newHeight = this.startBox.height - deltaY;
    } else if (handleClass.includes('top-right')) {
      newY = this.startBox.y + deltaY;
      newWidth = this.startBox.width + deltaX;
      newHeight = this.startBox.height - deltaY;
    } else if (handleClass.includes('bottom-left')) {
      newX = this.startBox.x + deltaX;
      newWidth = this.startBox.width - deltaX;
      newHeight = this.startBox.height + deltaY;
    } else if (handleClass.includes('bottom-right')) {
      newWidth = this.startBox.width + deltaX;
      newHeight = this.startBox.height + deltaY;
    }

    // จำกัดขนาดและขอบเขต
    const imageRect = this.image.getBoundingClientRect();

    newWidth = Math.max(this.minSize, newWidth);
    newHeight = Math.max(this.minSize, newHeight);

    newX = Math.max(0, Math.min(newX, imageRect.width - newWidth));
    newY = Math.max(0, Math.min(newY, imageRect.height - newHeight));

    if (newX + newWidth > imageRect.width) {
      newWidth = imageRect.width - newX;
    }
    if (newY + newHeight > imageRect.height) {
      newHeight = imageRect.height - newY;
    }

    this.updateCropBox(newX, newY, newWidth, newHeight);
  }

  /**
   * อัปเดตตำแหน่งกรอบ
   */
  updateCropBox(x, y, width, height) {
    const imageRect = this.image.getBoundingClientRect();

    // แปลงเป็น percentage
    const percentX = (x / imageRect.width) * 100;
    const percentY = (y / imageRect.height) * 100;
    const percentWidth = (width / imageRect.width) * 100;
    const percentHeight = (height / imageRect.height) * 100;

    this.cropBox.style.left = `${percentX}%`;
    this.cropBox.style.top = `${percentY}%`;
    this.cropBox.style.width = `${percentWidth}%`;
    this.cropBox.style.height = `${percentHeight}%`;
  }

  /**
   * จบการกระทำ
   */
  endAction(e) {
    this.isDragging = false;
    this.isResizing = false;
    this.currentHandle = null;
    this.cropBox.style.cursor = 'move';
  }

  /**
   * ดึงตำแหน่งจาก event
   */
  getEventPos(e) {
    if (e.touches && e.touches[0]) {
      return {x: e.touches[0].clientX, y: e.touches[0].clientY};
    }
    return {x: e.clientX, y: e.clientY};
  }

  /**
   * ดึงขอบเขตที่เลือก
   */
  getCropBounds() {
    const imageRect = this.image.getBoundingClientRect();
    const cropRect = this.cropBox.getBoundingClientRect();

    // แปลงเป็น pixel coordinates
    const x = cropRect.left - imageRect.left;
    const y = cropRect.top - imageRect.top;
    const width = cropRect.width;
    const height = cropRect.height;

    // แปลงเป็น percentage สำหรับการบันทึก
    const percentBounds = {
      x: (x / imageRect.width) * 100,
      y: (y / imageRect.height) * 100,
      width: (width / imageRect.width) * 100,
      height: (height / imageRect.height) * 100
    };

    return {
      pixel: {x, y, width, height},
      percent: percentBounds,
      imageSize: {
        width: imageRect.width,
        height: imageRect.height
      }
    };
  }

  /**
   * ตั้งตำแหน่งกรอบ
   */
  setCropBounds(bounds) {
    this.updateCropBox(
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height
    );
  }

  /**
   * รีเซ็ตตำแหน่งเป็นค่าเริ่มต้น
   */
  resetSelection() {
    this.updateCropBox(
      this.image.offsetWidth * 0.2,
      this.image.offsetHeight * 0.2,
      this.image.offsetWidth * 0.6,
      this.image.offsetHeight * 0.6
    );
  }

  /**
   * บันทึกตำแหน่งปัจจุบัน
   */
  saveCurrentPosition(key = 'default') {
    const bounds = this.getCropBounds();
    this.savedPositions[key] = bounds.percent;
    localStorage.setItem('qrCropPositions', JSON.stringify(this.savedPositions));
  }

  /**
   * โหลดตำแหน่งที่บันทึก
   */
  loadSavedPositions() {
    try {
      const saved = localStorage.getItem('qrCropPositions');
      return saved ? JSON.parse(saved) : {};
    } catch (error) {
      console.error('Error loading saved positions:', error);
      return {};
    }
  }

  /**
   * โหลดตำแหน่งล่าสุด
   */
  loadLastPosition(key = 'default') {
    if (this.savedPositions[key]) {
      const bounds = this.savedPositions[key];
      const imageRect = this.image.getBoundingClientRect();

      this.updateCropBox(
        (bounds.x / 100) * imageRect.width,
        (bounds.y / 100) * imageRect.height,
        (bounds.width / 100) * imageRect.width,
        (bounds.height / 100) * imageRect.height
      );
    } else {
      this.resetSelection();
    }
  }

  /**
   * ทำลายทรัพยากร
   */
  destroy() {
    document.removeEventListener('mousemove', this.onMove.bind(this));
    document.removeEventListener('touchmove', this.onMove.bind(this));
    document.removeEventListener('mouseup', this.endAction.bind(this));
    document.removeEventListener('touchend', this.endAction.bind(this));
  }
}
