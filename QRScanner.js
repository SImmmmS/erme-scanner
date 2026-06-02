/**
 * QRScanner.js
 * คลาสสำหรับจัดการการสแกน QR Code
 * รองรับการแสดงข้อมูลดิบและข้อมูลที่ถอดรหัสแล้ว
 */
class QRScanner {
  constructor(debug = false) {
    this.debug = debug;
    this.stream = null;
    this.scanInterval = null;
    this.isScanning = false;
    this.lastScanResult = null;
    this.scanAttempts = 0;
    this.maxScanAttempts = 100; // จำกัดการพยายาม

    // ตัวแปรสำหรับเก็บข้อมูล QR
    this.rawQRData = null;
    this.parsedQRData = null;
  }

  /**
   * เริ่มต้นการสแกน QR Code
   */
  async startScanning(videoElement, canvasElement, onSuccess, onError) {
    try {
      // ขอสิทธิ์เข้าถึงกล้อง
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: {ideal: 1280},
          height: {ideal: 720},
          facingMode: 'environment' // ใช้กล้องหลัง
        }
      });

      // ตั้งค่า video element
      videoElement.srcObject = this.stream;
      videoElement.setAttribute('playsinline', true);
      videoElement.play();

      this.isScanning = true;
      this.scanAttempts = 0;

      // รอให้ video พร้อม
      videoElement.addEventListener('loadedmetadata', () => {
        this.startScanLoop(videoElement, canvasElement, onSuccess, onError);
      });

      if (this.debug) {
        console.log('QR Scanner: กล้องเริ่มทำงานแล้ว');
      }

    } catch (error) {
      console.error('QR Scanner Error:', error);
      if (onError) {
        onError(`ไม่สามารถเข้าถึงกล้องได้: ${error.message}`);
      }
    }
  }

  /**
   * เริ่ม loop การสแกน
   */
  startScanLoop(videoElement, canvasElement, onSuccess, onError) {
    const scanFrame = () => {
      if (!this.isScanning) return;

      this.scanAttempts++;

      try {
        // ตรวจสอบว่า video พร้อมแล้ว
        if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
          // ตั้งค่า canvas
          canvasElement.width = videoElement.videoWidth;
          canvasElement.height = videoElement.videoHeight;

          const context = canvasElement.getContext('2d');
          context.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

          // อ่านข้อมูลภาพ
          const imageData = context.getImageData(0, 0, canvasElement.width, canvasElement.height);

          // ใช้ jsQR ในการอ่าน QR Code
          const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });

          if (qrCode) {
            this.handleQRDetected(qrCode, onSuccess);
            return;
          }
        }

        // Debug log ทุก 20 ครั้ง
        if (this.debug && this.scanAttempts % 20 === 0) {
          console.log(`QR Scanner: พยายามสแกนครั้งที่ ${this.scanAttempts}`);
        }

        // หยุดหากพยายามมากเกินไป
        if (this.scanAttempts > this.maxScanAttempts) {
          if (onError) {
            onError('ไม่พบ QR Code กรุณาลองใหม่');
          }
          return;
        }

        // ทำซ้ำในรอบถัดไป
        if (this.isScanning) {
          this.scanInterval = requestAnimationFrame(scanFrame);
        }

      } catch (error) {
        console.error('QR Scan Error:', error);
        if (onError) {
          onError(`เกิดข้อผิดพลาดในการสแกน: ${error.message}`);
        }
      }
    };

    // เริ่มการสแกน
    scanFrame();
  }

  /**
   * จัดการเมื่อตรวจพบ QR Code
   */
  handleQRDetected(qrCode, onSuccess) {
    this.stopScanning();

    // เก็บข้อมูล QR ดิบ
    this.rawQRData = qrCode.data;

    if (this.debug) {
      console.log('=== QR Code Detected ===');
      console.log('Raw Data:', qrCode.data);
      console.log('Location:', qrCode.location);
      console.log('Scan Attempts:', this.scanAttempts);
      console.log('========================');
    }

    // ส่งข้อมูลกลับ (ไม่ parse ใน QRScanner)
    if (onSuccess) {
      onSuccess({
        data: this.rawQRData,
        location: qrCode.location,
        scanAttempts: this.scanAttempts
      });
    }
  }

  /**
   * หยุดการสแกน
   */
  stopScanning() {
    this.isScanning = false;

    if (this.scanInterval) {
      cancelAnimationFrame(this.scanInterval);
      this.scanInterval = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.debug) {
      console.log('QR Scanner: หยุดการสแกนแล้ว');
    }
  }

  /**
   * ดึงข้อมูล QR ล่าสุด
   */
  getLastScanResult() {
    return {
      rawData: this.rawQRData,
      scanAttempts: this.scanAttempts
    };
  }

  /**
   * ล้างข้อมูล
   */
  reset() {
    this.stopScanning();
    this.rawQRData = null;
    this.scanAttempts = 0;
    this.lastScanResult = null;
  }

  /**
   * เปิด/ปิด debug mode
   */
  setDebug(enabled) {
    this.debug = enabled;
  }

  /**
   * สแกน QR จากไฟล์ blob
   */
  async scanImageBlob(blob) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const result = this.scanImageElement(img);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };
      img.onerror = () => reject(new Error('ไม่สามารถโหลดรูปภาพได้'));
      img.src = URL.createObjectURL(blob);
    });
  }

  /**
   * สแกน QR จากไฟล์
   */
  async scanImageFile(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const result = this.scanImageElement(img);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };
      img.onerror = () => reject(new Error('ไม่สามารถโหลดรูปภาพได้'));
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * สแกน QR จาก Image Element
   */
  scanImageElement(imgElement) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = imgElement.naturalWidth || imgElement.width;
    canvas.height = imgElement.naturalHeight || imgElement.height;

    ctx.drawImage(imgElement, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);

    if (code) {
      this.rawQRData = code.data;

      if (this.debug) {
        console.log('QR Code ถูกพบ:', code.data);
      }

      return {
        success: true,
        data: code.data,
        location: code.location
      };
    } else {
      if (this.debug) {
        console.log('ไม่พบ QR Code ในรูปภาพ');
      }

      return {
        success: false,
        error: 'ไม่พบ QR Code ในรูปภาพ'
      };
    }
  }
}
