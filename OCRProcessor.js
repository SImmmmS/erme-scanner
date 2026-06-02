/**
 * OCRProcessor.js
 * จัดการการประมวลผล OCR และปรับปรุงข้อความภาษาไทย
 * ใช้ Tesseract.js สำหรับแปลงรูปเป็นข้อความ
 */
class OCRProcessor {
  constructor(debug = false) {
    this.isInitialized = false;
    this.progressCallback = null;
    this.debug = debug;
    this.debugData = {
      rawText: '',
      improvedText: '',
      processingTime: 0,
      confidence: 0
    };
  }

  /**
   * เปิด/ปิด debug mode
   */
  setDebug(enabled) {
    this.debug = enabled;
  }

  /**
   * ดึงข้อมูล debug
   */
  getDebugData() {
    return this.debugData;
  }

  /**
   * เริ่มต้นระบบ OCR
   * ไม่ต้องสร้าง worker เพราะใช้ Tesseract.recognize() โดยตรง
   */
  async initialize(progressCallback = null) {
    if (this.isInitialized) return;

    try {
      this.progressCallback = progressCallback;

      // แจ้งเริ่มต้น
      if (progressCallback) {
        progressCallback(10, 'เริ่มต้นระบบ OCR...');
      }

      // ตรวจสอบว่า Tesseract พร้อมใช้งาน
      if (typeof Tesseract === 'undefined') {
        throw new Error('Tesseract.js ไม่พร้อมใช้งาน');
      }

      if (progressCallback) {
        progressCallback(50, 'ระบบ OCR พร้อมใช้งาน...');
      }

      if (this.debug) {
        console.log('OCR Processor using direct Tesseract.recognize() method');
      }

      this.isInitialized = true;

      if (progressCallback) {
        progressCallback(100, 'เสร็จสิ้น');
      }

      console.log('OCR Processor initialized successfully (Direct mode)');

    } catch (error) {
      console.error('Failed to initialize OCR:', error);
      throw new Error('ไม่สามารถเริ่มต้นระบบ OCR ได้');
    }
  }

  /**
   * ประมวลผลรูปภาพและแปลงเป็นข้อความ
   * ใช้วิธีเดียวกับ image-ocr-comparison.html โดยใช้ Tesseract.recognize() โดยตรง
   * พร้อมการจัดการภาพขนาดใหญ่
   * @param {File|HTMLImageElement|HTMLCanvasElement} image
   * @param {Function} progressCallback
   * @returns {Promise<string>} ข้อความที่ได้
   */
  async processImage(image, progressCallback = null) {
    const startTime = Date.now();

    try {
      // แจ้งเริ่มต้น
      if (progressCallback) {
        progressCallback(10, 'เริ่มต้นการประมวลผล...');
      }

      // สร้าง canvas สำหรับการประมวลผล พร้อมการปรับขนาดหากจำเป็น
      const canvas = await this.createOptimizedCanvas(image);

      if (progressCallback) {
        progressCallback(30, 'กำลังเตรียมรูปภาพ...');
      }

      // ประมวลผลด้วย Tesseract.recognize() โดยตรง (เหมือน image-ocr-comparison.html)
      const result = await Tesseract.recognize(canvas, 'tha+eng', {
        logger: m => {
          if (m.status === 'recognizing text' && progressCallback) {
            const percentage = Math.round(30 + (m.progress * 50));
            progressCallback(percentage, 'กำลังอ่านข้อความ...');
          }
        }
      });

      const rawText = result.data.text;
      const confidence = result.data.confidence;

      // เก็บข้อมูล debug
      this.debugData.rawText = rawText;
      this.debugData.confidence = confidence;

      if (this.debug) {
        console.log('=== OCR Debug ===');
        console.log('Raw Text:', rawText);
        console.log('Confidence:', confidence);
        console.log('Characters:', rawText.length);
      }

      // ปรับปรุงข้อความ
      if (progressCallback) {
        progressCallback(90, 'กำลังปรับปรุงข้อความ...');
      }

      const improvedText = this.improveThaiText(rawText);

      // เก็บข้อมูล debug
      this.debugData.improvedText = improvedText;
      this.debugData.processingTime = Date.now() - startTime;

      if (this.debug) {
        console.log('Improved Text:', improvedText);
        console.log('Processing Time:', this.debugData.processingTime, 'ms');
        console.log('=================');
      }

      // เสร็จสิ้น
      if (progressCallback) {
        progressCallback(100, 'เสร็จสิ้น');
      }

      return improvedText;

    } catch (error) {
      console.error('OCR processing failed:', error);
      throw new Error('ไม่สามารถอ่านข้อความจากรูปภาพได้');
    }
  }

  /**
   * ประมวลผลรูปภาพแบบ Grayscale เพื่อเปรียบเทียบ
   * @param {File|HTMLImageElement|HTMLCanvasElement} image
   * @param {Function} progressCallback
   * @returns {Promise<Object>} ผลลัพธ์การประมวลผล
   */
  async processImageWithGrayscale(image, progressCallback = null) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();

    try {
      // สร้าง canvas สำหรับ Grayscale
      const grayscaleCanvas = await this.createGrayscaleCanvas(image);

      if (progressCallback) {
        progressCallback(30, 'กำลังประมวลผลแบบ Grayscale...');
      }

      // ประมวลผล OCR ด้วย Tesseract.recognize() โดยตรง
      const result = await Tesseract.recognize(grayscaleCanvas, 'tha+eng', {
        logger: m => {
          if (m.status === 'recognizing text' && progressCallback) {
            const percentage = Math.round(30 + (m.progress * 50));
            progressCallback(percentage, 'กำลังอ่านข้อความ (Grayscale)...');
          }
        }
      });
      const rawText = result.data.text;
      const confidence = result.data.confidence;

      if (progressCallback) {
        progressCallback(80, 'กำลังปรับปรุงข้อความ...');
      }

      const improvedText = this.improveThaiText(rawText);
      const processingTime = Date.now() - startTime;

      const resultData = {
        raw: rawText,
        improved: improvedText,
        confidence: confidence,
        time: processingTime / 1000, // แปลงเป็นวินาที
        chars: improvedText.length,
        thaiChars: (improvedText.match(/[\u0E00-\u0E7F]/g) || []).length,
        type: 'grayscale'
      };

      if (progressCallback) {
        progressCallback(100, 'เสร็จสิ้น');
      }

      return resultData;

    } catch (error) {
      console.error('Grayscale OCR processing failed:', error);
      throw new Error('ไม่สามารถประมวลผลแบบ Grayscale ได้');
    }
  }

  /**
   * ประมวลผลรูปภาพต้นฉบับ (Original) เพื่อเปรียบเทียบ
   * @param {File|HTMLImageElement|HTMLCanvasElement} image
   * @param {Function} progressCallback
   * @returns {Promise<Object>} ผลลัพธ์การประมวลผล
   */
  async processImageOriginal(image, progressCallback = null) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();

    try {
      // สร้าง canvas สำหรับการประมวลผล
      const canvas = await this.createProcessingCanvas(image);

      if (progressCallback) {
        progressCallback(30, 'กำลังประมวลผลภาพต้นฉบับ...');
      }

      // ประมวลผล OCR ด้วย Tesseract.recognize() โดยตรง
      const result = await Tesseract.recognize(canvas, 'tha+eng', {
        logger: m => {
          if (m.status === 'recognizing text' && progressCallback) {
            const percentage = Math.round(30 + (m.progress * 50));
            progressCallback(percentage, 'กำลังอ่านข้อความ (Original)...');
          }
        }
      });
      const rawText = result.data.text;
      const confidence = result.data.confidence;

      if (progressCallback) {
        progressCallback(80, 'กำลังปรับปรุงข้อความ...');
      }

      const improvedText = this.improveThaiText(rawText);
      const processingTime = Date.now() - startTime;

      const resultData = {
        raw: rawText,
        improved: improvedText,
        confidence: confidence,
        time: processingTime / 1000, // แปลงเป็นวินาที
        chars: improvedText.length,
        thaiChars: (improvedText.match(/[\u0E00-\u0E7F]/g) || []).length,
        type: 'original'
      };

      if (progressCallback) {
        progressCallback(100, 'เสร็จสิ้น');
      }

      return resultData;

    } catch (error) {
      console.error('Original OCR processing failed:', error);
      throw new Error('ไม่สามารถประมวลผลภาพต้นฉบับได้');
    }
  }

  /**
   * สร้าง Canvas แบบ Grayscale จากภาพต้นฉบับ
   * @param {File|HTMLImageElement|HTMLCanvasElement} image
   * @returns {Promise<HTMLCanvasElement>}
   */
  async createGrayscaleCanvas(image) {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = function() {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          canvas.width = img.width;
          canvas.height = img.height;

          // วาดภาพต้นฉบับ
          ctx.drawImage(img, 0, 0);

          // แปลงเป็น Grayscale
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;

          for (let i = 0; i < data.length; i += 4) {
            // คำนวณค่า grayscale ด้วยสูตร luminance
            const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);

            data[i] = gray;     // Red
            data[i + 1] = gray; // Green
            data[i + 2] = gray; // Blue
            // Alpha (i + 3) ไม่ต้องเปลี่ยน
          }

          ctx.putImageData(imageData, 0, 0);
          resolve(canvas);
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => {
        reject(new Error('ไม่สามารถโหลดภาพได้'));
      };

      // ตั้งค่า src ตามประเภทของ input
      if (image instanceof File) {
        const reader = new FileReader();
        reader.onload = (e) => {
          img.src = e.target.result;
        };
        reader.readAsDataURL(image);
      } else if (image instanceof HTMLImageElement) {
        img.src = image.src;
      } else if (image instanceof HTMLCanvasElement) {
        img.src = image.toDataURL();
      } else {
        reject(new Error('ประเภทไฟล์ไม่รองรับ'));
      }
    });
  }

  /**
   * สร้าง canvas สำหรับการประมวลผล (เหมือน image-ocr-comparison.html)
   * @param {File|HTMLImageElement|HTMLCanvasElement} image
   * @returns {Promise<HTMLCanvasElement>}
   */
  async createProcessingCanvas(image) {
    return new Promise((resolve, reject) => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (image instanceof HTMLCanvasElement) {
          // ถ้าเป็น canvas แล้วใช้เลย
          canvas.width = image.width;
          canvas.height = image.height;
          ctx.drawImage(image, 0, 0);
          resolve(canvas);
        } else {
          // สร้าง Image element
          const img = new Image();

          img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            resolve(canvas);
          };

          img.onerror = () => {
            reject(new Error('ไม่สามารถโหลดรูปภาพได้'));
          };

          if (image instanceof File) {
            // ถ้าเป็น File ให้สร้าง URL
            img.src = URL.createObjectURL(image);
          } else if (typeof image === 'string') {
            // ถ้าเป็น URL string
            img.src = image;
          } else if (image instanceof HTMLImageElement) {
            // ถ้าเป็น Image element แล้ว
            img.src = image.src;
          } else {
            reject(new Error('รูปแบบรูปภาพไม่รองรับ'));
          }
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * สร้าง canvas สำหรับการประมวลผลพร้อมการปรับขนาดที่เหมาะสม
   * @param {File|HTMLImageElement|HTMLCanvasElement} image
   * @returns {Promise<HTMLCanvasElement>}
   */
  async createOptimizedCanvas(image) {
    return new Promise((resolve, reject) => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (image instanceof HTMLCanvasElement) {
          // ถ้าเป็น canvas แล้วให้ปรับขนาดหากจำเป็น
          const optimizedCanvas = this.resizeCanvasIfNeeded(image);
          resolve(optimizedCanvas);
        } else {
          // สร้าง Image element
          const img = new Image();

          img.onload = () => {
            // ตรวจสอบขนาดและปรับให้เหมาะสม
            const maxDimension = 2048; // ขนาดสูงสุดที่ Tesseract ทำงานได้ดี
            let {width, height} = this.calculateOptimalSize(img.width, img.height, maxDimension);

            canvas.width = width;
            canvas.height = height;

            // วาดภาพด้วยการปรับขนาด
            ctx.drawImage(img, 0, 0, width, height);

            if (this.debug) {
              console.log(`OCR Canvas: Original ${img.width}x${img.height} -> Optimized ${width}x${height}`);
            }

            resolve(canvas);
          };

          img.onerror = () => {
            reject(new Error('ไม่สามารถโหลดรูปภาพได้'));
          };

          if (image instanceof File) {
            img.src = URL.createObjectURL(image);
          } else if (typeof image === 'string') {
            img.src = image;
          } else if (image instanceof HTMLImageElement) {
            img.src = image.src;
          } else {
            reject(new Error('รูปแบบรูปภาพไม่รองรับ'));
          }
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * คำนวณขนาดที่เหมาะสมสำหรับ OCR
   * @param {number} originalWidth
   * @param {number} originalHeight
   * @param {number} maxDimension
   * @returns {Object} {width, height}
   */
  calculateOptimalSize(originalWidth, originalHeight, maxDimension = 2048) {
    // ถ้าภาพไม่ใหญ่เกินไป ใช้ขนาดเดิม
    if (originalWidth <= maxDimension && originalHeight <= maxDimension) {
      return {width: originalWidth, height: originalHeight};
    }

    // คำนวณ ratio เพื่อลดขนาด
    const ratio = Math.min(maxDimension / originalWidth, maxDimension / originalHeight);

    return {
      width: Math.round(originalWidth * ratio),
      height: Math.round(originalHeight * ratio)
    };
  }

  /**
   * ปรับขนาด canvas หากจำเป็น
   * @param {HTMLCanvasElement} sourceCanvas
   * @returns {HTMLCanvasElement}
   */
  resizeCanvasIfNeeded(sourceCanvas) {
    const maxDimension = 2048;

    if (sourceCanvas.width <= maxDimension && sourceCanvas.height <= maxDimension) {
      return sourceCanvas;
    }

    const {width, height} = this.calculateOptimalSize(sourceCanvas.width, sourceCanvas.height, maxDimension);

    const resizedCanvas = document.createElement('canvas');
    resizedCanvas.width = width;
    resizedCanvas.height = height;

    const ctx = resizedCanvas.getContext('2d');
    ctx.drawImage(sourceCanvas, 0, 0, width, height);

    if (this.debug) {
      console.log(`Canvas Resize: ${sourceCanvas.width}x${sourceCanvas.height} -> ${width}x${height}`);
    }

    return resizedCanvas;
  }

  /**
   * สร้าง canvas สำหรับการประมวลผล (ฟังก์ชันเดิม)
   * @param {File|HTMLImageElement|HTMLCanvasElement} image
   * @returns {Promise<HTMLCanvasElement>}
   */
  async createProcessingCanvas(image) {
    return new Promise((resolve, reject) => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (image instanceof HTMLCanvasElement) {
          // ถ้าเป็น canvas แล้วใช้เลย
          canvas.width = image.width;
          canvas.height = image.height;
          ctx.drawImage(image, 0, 0);
          resolve(canvas);
        } else {
          // สร้าง Image element
          const img = new Image();

          img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            resolve(canvas);
          };

          img.onerror = () => {
            reject(new Error('ไม่สามารถโหลดรูปภาพได้'));
          };

          if (image instanceof File) {
            // ถ้าเป็น File ให้สร้าง URL
            img.src = URL.createObjectURL(image);
          } else if (typeof image === 'string') {
            // ถ้าเป็น URL string
            img.src = image;
          } else if (image instanceof HTMLImageElement) {
            // ถ้าเป็น Image element แล้ว
            img.src = image.src;
          } else {
            reject(new Error('รูปแบบรูปภาพไม่รองรับ'));
          }
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * เปรียบเทียบผลลัพธ์ระหว่าง Original และ Grayscale
   * @param {Object} originalResult ผลลัพธ์จากภาพต้นฉบับ
   * @param {Object} grayscaleResult ผลลัพธ์จาก Grayscale
   * @returns {Object} ผลการเปรียบเทียบพร้อมคำแนะนำ
   */
  compareResults(originalResult, grayscaleResult) {
    if (!originalResult || !grayscaleResult) {
      throw new Error('ต้องมีผลลัพธ์ทั้งสองแบบเพื่อเปรียบเทียบ');
    }

    // คำนวณคะแนนรวม
    const originalScore = this.calculateScore(originalResult);
    const grayscaleScore = this.calculateScore(grayscaleResult);

    // เปรียบเทียบ
    const comparison = {
      better: originalScore > grayscaleScore ? 'original' : 'grayscale',
      originalScore: originalScore,
      grayscaleScore: grayscaleScore,
      recommendation: this.getRecommendation(originalResult, grayscaleResult)
    };

    return comparison;
  }

  /**
   * คำนวณคะแนนคุณภาพ
   * @param {Object} result
   * @returns {number}
   */
  calculateScore(result) {
    const confidenceWeight = 0.7;
    const lengthWeight = 0.3;

    const confidenceScore = result.confidence || 0;
    const lengthScore = Math.min(result.chars / 100, 1) * 100; // คะแนนเต็มที่ 100 ตัวอักษร

    return (confidenceScore * confidenceWeight) + (lengthScore * lengthWeight);
  }

  /**
   * ให้คำแนะนำการใช้งาน
   * @param {Object} originalResult
   * @param {Object} grayscaleResult
   * @returns {string}
   */
  getRecommendation(originalResult, grayscaleResult) {
    const originalScore = this.calculateScore(originalResult);
    const grayscaleScore = this.calculateScore(grayscaleResult);

    if (Math.abs(originalScore - grayscaleScore) < 5) {
      return 'คุณภาพใกล้เคียงกัน ใช้วิธีใดก็ได้';
    }

    if (originalScore > grayscaleScore) {
      return 'แนะนำใช้การประมวลผลแบบภาพต้นฉบับ';
    } else {
      return 'แนะนำใช้การประมวลผลแบบ Grayscale';
    }
  }

  /**
   * ฟังก์ชันปรับปรุงข้อความภาษาไทย
   * @param {string} text ข้อความที่ต้องการปรับปรุง
   * @returns {string}
   */
  improveThaiText(text) {
    if (!text) return '';

    // ใช้ fixThaiSpacing ที่ผ่านการทดสอบแล้ว
    return this.fixThaiSpacing(text);
  }

  /**
   * ฟังก์ชันแก้ไขสระลอยและช่องว่างสำหรับภาษาไทย - ประมวลผลทีละบรรทัด
   * ฟังก์ชันนี้ทดสอบแล้วในไฟล์ image-ocr-comparison.html และให้ผลลัพธ์ที่ดีที่สุด
   */
  fixThaiSpacing(text) {
    if (!text) return '';

    // แบ่งข้อความเป็นบรรทัด
    const lines = text.split('\n');
    const processedLines = [];

    // ฐานข้อมูลรูปแบบคำสำคัญ (ลบการแสดงผลธนาคารออกแล้ว)
    const keywordPatterns = {
      // ข้อมูลการโอนเงิน
      'โอนเงิน': /โ\s*อ\s*น\s*เ\s*ง\s*ิ\s*น/g,
      'สำเร็จ': /ส\s*ํ\s*า\s*เ\s*ร\s*็\s*จ/g,
      'จำนวน': /จ\s*ํ\s*า\s*น\s*ว\s*น/g,
      'จำนวนเงิน': /จ\s*ํ\s*า\s*น\s*ว\s*น\s*เ\s*ง\s*ิ\s*น/g,
      'รหัสอ้างอิง': /ร\s*ห\s*ั\s*ส\s*อ\s*้\s*า\s*ง\s*อ\s*ิ\s*ง/g,

      // วันเวลา
      'มิ.ย.': /ม\s*ิ\s*\.\s*ย\s*\./g,
      'ก.พ.': /ก\s*\.\s*พ\s*\./g,
      'มี.ค.': /ม\s*ี\s*\.\s*ค\s*\./g,
      'เม.ย.': /เ\s*ม\s*\.\s*ย\s*\./g,
      'พ.ค.': /พ\s*\.\s*ค\s*\./g,
      'ก.ค.': /ก\s*\.\s*ค\s*\./g,
      'ส.ค.': /ส\s*\.\s*ค\s*\./g,
      'ก.ย.': /ก\s*\.\s*ย\s*\./g,
      'ต.ค.': /ต\s*\.\s*ค\s*\./g,
      'พ.ย.': /พ\s*\.\s*ย\s*\./g,
      'ธ.ค.': /ธ\s*\.\s*ค\s*\./g,

      // คำทั่วไป
      'บาท': /บ\s*า\s*ท/g,
      'นาย': /น\s*า\s*ย/g,
      'ไปยัง': /ไ\s*ป\s*ย\s*ั\s*ง/g,
      'จาก': /จ\s*า\s*ก/g
    };

    // วนลูปประมวลผลทีละบรรทัด
    for (let line of lines) {
      if (!line.trim()) {
        processedLines.push('');
        continue;
      }

      // ลบช่องว่างทั้งหมดในบรรทัด
      let cleanLine = line.replace(/\s+/g, '');

      // ตรวจจับรูปแบบคำสำคัญ
      let fixedLine = cleanLine;

      Object.keys(keywordPatterns).forEach(correctWord => {
        const pattern = keywordPatterns[correctWord];
        const noSpacePattern = pattern.source.replace(/\\s\*/g, '');
        const regex = new RegExp(noSpacePattern, 'gi');
        fixedLine = fixedLine.replace(regex, correctWord);
      });

      // แก้ไขตัวเลขและเครื่องหมาย
      fixedLine = fixedLine.replace(/(\d)([,.])/g, '$1$2');
      fixedLine = fixedLine.replace(/([,.])(\d)/g, '$1$2');
      fixedLine = fixedLine.replace(/(\d{1,2}):(\d{2})/g, '$1:$2');

      // ลบอักขระขยะ
      fixedLine = fixedLine.replace(/[|#%@©®™&*+=\[\]{}]/g, '');

      // เพิ่มช่องว่างที่จำเป็น
      fixedLine = fixedLine.replace(/:/g, ': ');
      fixedLine = fixedLine.replace(/(\d)([ก-ฮ])/g, '$1 $2');
      fixedLine = fixedLine.replace(/([ก-ฮ])(\d)/g, '$1 $2');
      fixedLine = fixedLine.replace(/\s+/g, ' ').trim();

      processedLines.push(fixedLine);
    }

    return processedLines.join('\n').trim();
  }

  /**
   * ทำลายระบบ OCR
   * ไม่ต้องใช้ worker เพราะใช้ Tesseract.recognize() โดยตรง
   */
  async destroy() {
    // ไม่ต้องทำลาย worker เพราะไม่ได้ใช้
    this.isInitialized = false;
    this.progressCallback = null;

    if (this.debug) {
      console.log('OCRProcessor destroyed');
    }
  }

  /**
   * ค้นหาตัวเลขในข้อความ (static method สำหรับใช้ใน SlipParser)
   * @param {string} text ข้อความที่ต้องการค้นหา
   * @returns {Array<string>} array ของตัวเลขที่พบ
   */
  static findNumbers(text) {
    if (!text) return [];

    // Pattern สำหรับหาตัวเลขที่มีทศนิยม, จุลภาค, และหน่วยบาท
    const numberPatterns = [
      // ตัวเลขที่มีจุลภาคและทศนิยม เช่น 1,234.56
      /\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?/g,
      // ตัวเลขที่มีทศนิยมอย่างเดียว เช่น 1234.56
      /\d+\.\d{1,2}/g,
      // ตัวเลขเต็มที่มีจุลภาค เช่น 1,234
      /\d{1,3}(?:,\d{3})+/g,
      // ตัวเลขเต็มธรรมดา เช่น 1234
      /\d{2,}/g
    ];

    const foundNumbers = new Set();

    // ใช้ทุก pattern เพื่อหาตัวเลข
    for (const pattern of numberPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          // กรองเฉพาะตัวเลขที่น่าจะเป็นจำนวนเงิน
          const cleanNumber = match.replace(/,/g, '');
          const numValue = parseFloat(cleanNumber);

          // ต้องเป็นตัวเลขที่มีค่ามากกว่า 1 และไม่เกิน 10 ล้าน
          if (!isNaN(numValue) && numValue >= 1 && numValue <= 10000000) {
            foundNumbers.add(match);
          }
        });
      }
    }

    // แปลงเป็น array และเรียงจากมากไปน้อย
    return Array.from(foundNumbers).sort((a, b) => {
      const numA = parseFloat(a.replace(/,/g, ''));
      const numB = parseFloat(b.replace(/,/g, ''));
      return numB - numA;
    });
  }

  /**
   * ค้นหาวันที่ในข้อความ
   * @param {string} text ข้อความ
   * @returns {Array} รายการวันที่ที่พบ
   */
  static findDates(text) {
    if (!text) return [];

    const datePatterns = [
      // รูปแบบ dd/mm/yyyy
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/g,
      // รูปแบบ dd/mm/yy
      /(\d{1,2})\/(\d{1,2})\/(\d{2})/g,
      // รูปแบบ dd-mm-yyyy
      /(\d{1,2})-(\d{1,2})-(\d{4})/g,
      // รูปแบบ dd.mm.yyyy
      /(\d{1,2})\.(\d{1,2})\.(\d{4})/g,
      // รูปแบบไทย เช่น 22 มิ.ย. 2568
      /(\d{1,2})\s*(ม|ก|มี|เม|พ|มิ|ส|ต|ธ)\.\s*([ยคพ]\.)\s*(\d{4})/gi
    ];

    const dates = [];

    datePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        dates.push(match[0]);
      }
    });

    // ลบรายการซ้ำ
    return [...new Set(dates)];
  }

  /**
   * ค้นหาเวลาในข้อความ
   * @param {string} text ข้อความ
   * @returns {Array} รายการเวลาที่พบ
   */
  static findTimes(text) {
    if (!text) return [];

    const timePatterns = [
      // รูปแบบ HH:MM
      /(\d{1,2}):\s*(\d{2})/g,
      // รูปแบบ HH:MM:SS
      /(\d{1,2}):\s*(\d{2}):\s*(\d{2})/g,
      // รูปแบบ HH.MM
      /(\d{1,2})\.\s*(\d{2})/g
    ];

    const times = [];

    timePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        // ตรวจสอบว่าเป็นเวลาที่ถูกต้อง
        const hours = parseInt(match[1]);
        const minutes = parseInt(match[2]);

        if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
          times.push(match[0]);
        }
      }
    });

    // ลบรายการซ้ำ
    return [...new Set(times)];
  }
}