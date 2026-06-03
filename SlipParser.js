/**
 * SlipParser.js  (v2.0 — Improved)
 * ===================================
 * ✅ แก้บั๊ก:  ทุก field ที่หาไม่เจอคืน '-' แทน null
 *             (ป้องกัน "null" โชว์ในหน้าเว็บเมื่อใช้ string concat)
 * ✅ เพิ่ม:    ธนาคาร BAY / TTB / UOB / CIMB / TISCO / LH / ICBC / PromptPay
 * ✅ ปรับปรุง: Regex ผู้รับ ครอบคลุมทุกรูปแบบสลิปไทย
 * ✅ ปรับปรุง: Regex วันที่-เวลา รองรับ OCR artifacts จาก fixThaiSpacing
 *             (เช่น space หายหลัง : → "14: 30", วันที่ชนกัน "01/06/202514: 30")
 * ✅ ปรับปรุง: identifyBank() ใช้ case-insensitive matching
 * ✅ ปรับปรุง: calculateConfidence() ตรวจว่าไม่ใช่ '-' ด้วย
 */
class SlipParser {
  constructor() {

    // ══════════════════════════════════════════════════════
    // ข้อมูลธนาคารไทย (ครบทุกธนาคาร + case-insensitive)
    // ══════════════════════════════════════════════════════
    this.banks = {
      'SCB': {
        name    : 'ธนาคารไทยพาณิชย์',
        keywords: ['ไทยพาณิชย์', 'SCB', 'Siam Commercial', 'Thai Commercial'],
        color   : '#4e1a8b',
        logo    : 'assets/bank-logos/scb.png',
      },
      'KBANK': {
        name    : 'ธนาคารกสิกรไทย',
        keywords: ['กสิกรไทย', 'KBANK', 'KBank', 'Kasikorn', 'K-Bank', 'กสิกร'],
        color   : '#16a34a',
        logo    : 'assets/bank-logos/kbank.png',
      },
      'BBL': {
        name    : 'ธนาคารกรุงเทพ',
        keywords: ['กรุงเทพ', 'BBL', 'Bangkok Bank', 'Bualuang'],
        color   : '#1e40af',
        logo    : 'assets/bank-logos/bbl.png',
      },
      'KTB': {
        name    : 'ธนาคารกรุงไทย',
        keywords: ['กรุงไทย', 'KTB', 'Krung Thai', 'Krungthai'],
        color   : '#00a651',
        logo    : 'assets/bank-logos/ktb.png',
      },
      'BAY': {
        name    : 'ธนาคารกรุงศรีอยุธยา',
        keywords: ['กรุงศรี', 'BAY', 'Krungsri', 'Ayudhya', 'กรุงศรีอยุธยา'],
        color   : '#fbbf24',
        logo    : 'assets/bank-logos/bay.png',
      },
      'TMB': {
        name    : 'ธนาคารทีเอ็มบี ธนชาต (TTB)',
        keywords: ['ทหารไทย', 'TTB', 'TMB', 'Thanachart', 'ธนชาต', 'ทีทีบี', 'TMBThanachart'],
        color   : '#0369a1',
        logo    : 'assets/bank-logos/tmb.png',
      },
      'GSB': {
        name    : 'ธนาคารออมสิน',
        keywords: ['ออมสิน', 'GSB', 'Government Savings'],
        color   : '#dc2626',
        logo    : 'assets/bank-logos/gsb.png',
      },
      'BAAC': {
        name    : 'ธ.ก.ส.',
        keywords: ['เกษตรและสหกรณ์', 'BAAC', 'ธกส', 'ธ.ก.ส', 'เกษตร'],
        color   : '#059669',
        logo    : 'assets/bank-logos/baac.png',
      },
      'UOB': {
        name    : 'ธนาคารยูโอบี',
        keywords: ['UOB', 'ยูโอบี', 'United Overseas'],
        color   : '#1d4ed8',
        logo    : 'assets/bank-logos/uob.png',
      },
      'CIMB': {
        name    : 'ธนาคารซีไอเอ็มบีไทย',
        keywords: ['CIMB', 'ซีไอเอ็มบี'],
        color   : '#dc2626',
        logo    : 'assets/bank-logos/cimb.png',
      },
      'TISCO': {
        name    : 'ธนาคารทิสโก้',
        keywords: ['TISCO', 'ทิสโก้'],
        color   : '#0284c7',
        logo    : 'assets/bank-logos/tisco.png',
      },
      'LH': {
        name    : 'ธนาคารแลนด์ แอนด์ เฮ้าส์',
        keywords: ['แลนด์', 'LH Bank', 'LHBank', 'Land and House'],
        color   : '#7c3aed',
        logo    : 'assets/bank-logos/lh.png',
      },
      'ICBC': {
        name    : 'ธนาคารไอซีบีซี (ไทย)',
        keywords: ['ICBC', 'ไอซีบีซี'],
        color   : '#dc2626',
        logo    : 'assets/bank-logos/icbc.png',
      },
      'PROMPTPAY': {
        name    : 'พร้อมเพย์ / PromptPay',
        keywords: ['พร้อมเพย์', 'PromptPay', 'Prompt Pay', 'พร้อมเพย์'],
        color   : '#0284c7',
        logo    : 'assets/bank-logos/promptpay.png',
      },
    };

    // ══════════════════════════════════════════════════════
    // Regex Patterns
    // หมายเหตุ: OCRProcessor.fixThaiSpacing จะ:
    //   1) ลบ whitespace ทั้งหมดในบรรทัด
    //   2) เพิ่ม space หลัง ':'  → "จำนวนเงิน: 150"
    //   3) เพิ่ม space ระหว่างตัวเลข↔ตัวอักษรไทย
    // ดังนั้น pattern ต้องรองรับ:
    //   "14: 30"       (space หลัง colon ใน timestamp)
    //   "01/06/2568"   (ไม่มี space ระหว่างวันที่)
    //   "นายสมชายทองดี" (ชื่อชนกันไม่มี space)
    // ══════════════════════════════════════════════════════
    this.patterns = {

      // ─── จำนวนเงิน ─────────────────────────────────────
      amount: [
        /จำนวนเงิน\s*[:\-]\s*฿?\s*([\d,]+\.?\d*)/i,
        /ยอดเงิน\s*[:\-]\s*฿?\s*([\d,]+\.?\d*)/i,
        /ยอดโอน\s*[:\-]\s*฿?\s*([\d,]+\.?\d*)/i,
        /ยอดชำระ\s*[:\-]\s*฿?\s*([\d,]+\.?\d*)/i,
        /Amount\s*[:\-]\s*฿?\s*([\d,]+\.?\d*)/i,
        /Transfer Amount\s*[:\-]\s*฿?\s*([\d,]+\.?\d*)/i,
        /Total\s*[:\-]\s*฿?\s*([\d,]+\.?\d*)/i,
        // ฿ นำหน้า เช่น ฿1,500.00
        /฿\s*([\d,]+\.?\d*)/,
        // ตัวเลขตามด้วย บาท/Baht/THB
        /([\d,]+\.?\d*)\s*(?:บาท|Baht|THB)\b/i,
      ],

      // ─── วันที่-เวลา ────────────────────────────────────
      // รองรับ OCR artifact: "14: 30" (space หลัง colon ใน time)
      // รองรับ: "01/06/202514: 30" (วันที่ชนเวลา ไม่มี space)
      datetime: [
        // dd/mm/yyyy HH:MM[:SS] (มาตรฐาน)
        /(\d{1,2}\/\d{1,2}\/\d{2,4})\s*(\d{1,2}:\s*\d{2}(?::\s*\d{2})?)/,
        // dd/mm/yyyy ชนกับ HH:MM (ไม่มี space — OCR artifact)
        /(\d{1,2}\/\d{1,2}\/\d{4})(\d{1,2}:\s*\d{2})/,
        // dd-mm-yyyy HH:MM
        /(\d{1,2}-\d{1,2}-\d{2,4})\s*(\d{1,2}:\s*\d{2}(?::\s*\d{2})?)/,
        // yyyy-mm-dd HH:MM (ISO-ish)
        /(\d{4}-\d{2}-\d{2})\s*(\d{2}:\s*\d{2}(?::\s*\d{2})?)/,
        // วันที่: dd/mm/yyyy  [เวลา: HH:MM]
        /วันที่\s*[:\-]\s*(\d{1,2}\/\d{1,2}\/\d{2,4})(?:\s*(?:เวลา\s*[:\-]\s*)?)?([\d]{1,2}:\s*[\d]{2})?/i,
        // Date: dd/mm/yyyy  [Time: HH:MM]
        /Date\s*[:\-]\s*(\d{1,2}\/\d{1,2}\/\d{2,4})(?:\s*(?:Time\s*[:\-]\s*)?)?([\d]{1,2}:\s*[\d]{2})?/i,
        // เดือนไทยย่อ เช่น "1 มิ.ย. 2568 14: 30"
        /(\d{1,2}\s+(?:ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.)\s*\d{2,4})(?:\s*([\d]{1,2}:\s*[\d]{2}))?/,
        // SCB compact: 20250601 143025
        /(\d{8})\s*(\d{6})/,
        // fallback: วันที่เท่านั้น (ไม่มีเวลา)
        /วันที่\s*[:\-]\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
        /Date\s*[:\-]\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
      ],

      // ─── ผู้โอน ─────────────────────────────────────────
      sender: [
        /ผู้โอน\s*[:\-]\s*(.+?)(?=\n|ผู้รับ|ไปยัง|ถึง|To|จำนวน|Amount|$)/i,
        /ชื่อผู้โอน\s*[:\-]\s*(.+?)(?=\n|$)/i,
        /โอนจาก\s*[:\-]\s*(.+?)(?=\n|ไปยัง|ถึง|จำนวน|$)/i,
        /จาก\s*[:\-]\s*(.+?)(?=\n|ไปยัง|ถึง|To|จำนวน|Amount|$)/i,
        /From\s*[:\-]\s*(.+?)(?=\n|To|ไปยัง|จำนวน|Amount|$)/i,
        /บัญชีต้นทาง\s*[:\-]\s*(.+?)(?=\n|บัญชีปลายทาง|จำนวน|$)/i,
        /Source Account\s*[:\-]\s*(.+?)(?=\n|$)/i,
        /Sender\s*[:\-]\s*(.+?)(?=\n|Receiver|To|จำนวน|$)/i,
      ],

      // ─── ผู้รับ ─────────────────────────────────────────
      // ✅ เพิ่มหลาย pattern สำหรับสลิปต่างธนาคาร
      receiver: [
        /ผู้รับ\s*[:\-]\s*(.+?)(?=\n|จำนวน|Amount|เลขที่|Ref|$)/i,
        /ชื่อผู้รับ\s*[:\-]\s*(.+?)(?=\n|$)/i,
        /โอนไปยัง\s*[:\-]\s*(.+?)(?=\n|จำนวน|Amount|$)/i,
        /ไปยัง\s*[:\-]\s*(.+?)(?=\n|จำนวน|Amount|เลขที่|Ref|$)/i,
        /ถึง\s*[:\-]\s*(.+?)(?=\n|จำนวน|Amount|เลขที่|$)/i,
        /To\s*[:\-]\s*(.+?)(?=\n|Amount|จำนวน|Ref|$)/i,
        /บัญชีปลายทาง\s*[:\-]\s*(.+?)(?=\n|จำนวน|Amount|$)/i,
        /Receiver\s*[:\-]\s*(.+?)(?=\n|Amount|จำนวน|Ref|$)/i,
        /Beneficiary\s*[:\-]\s*(.+?)(?=\n|$)/i,
        /Destination\s*[:\-]\s*(.+?)(?=\n|$)/i,
        /Payee\s*[:\-]\s*(.+?)(?=\n|$)/i,
        /รับเข้าบัญชี\s*[:\-]\s*(.+?)(?=\n|$)/i,
      ],

      // ─── รหัสอ้างอิง ────────────────────────────────────
      reference: [
        /รหัสอ้างอิง\s*[:\-]\s*([A-Za-z0-9\-\/]+)/i,
        /เลขที่อ้างอิง\s*[:\-]\s*([A-Za-z0-9\-\/]+)/i,
        /เลขที่รายการ\s*[:\-]\s*([A-Za-z0-9\-\/]+)/i,
        /Reference\s*(?:No\.?)?\s*[:\-]\s*([A-Za-z0-9\-\/]+)/i,
        /Ref\.?\s*(?:No\.?)?\s*[:\-]\s*([A-Za-z0-9\-\/]+)/i,
        /Transaction\s*(?:ID|No\.?)\s*[:\-]\s*([A-Za-z0-9\-\/]+)/i,
        /Trans\.\s*No\.\s*[:\-]\s*([A-Za-z0-9\-\/]+)/i,
        /อ้างอิง\s*[:\-]\s*([A-Za-z0-9\-\/]+)/i,
      ],
    };
  }


  // ════════════════════════════════════════════════════════
  //  parse()  —  จุดเข้าหลัก
  // ════════════════════════════════════════════════════════

  /**
   * วิเคราะห์ข้อความสลิปแล้วคืน Object
   * ✅ ทุก field ที่หาไม่เจอ = '-'  (ไม่มี null เด็ดขาด)
   *
   * @param {string} text  ข้อความที่ได้จาก OCR
   * @returns {{amount, datetime, sender, receiver, reference, bank, confidence, raw_text}}
   */
  parse(text) {
    const FALLBACK = '-';

    // ── Default ทุก field เป็น '-' ──────────────────────────
    // ✅ แก้บั๊กหลัก: เดิมใช้ null ทำให้ string concat แสดงผล "null"
    //    เช่น: '<span>' + null + '</span>'  →  '<span>null</span>'
    //    แก้แล้ว: '<span>' + '-' + '</span>'  →  '<span>-</span>'
    const result = {
      amount    : FALLBACK,
      datetime  : FALLBACK,
      sender    : FALLBACK,
      receiver  : FALLBACK,
      reference : FALLBACK,
      bank      : FALLBACK,
      confidence: 0,
      raw_text  : text || '',
    };

    if (!text || text.trim().length === 0) {
      return result;
    }

    // ── Extract ──────────────────────────────────────────────
    result.bank = this.identifyBank(text) || FALLBACK;

    const amount = this.extractAmount(text);
    result.amount = (amount !== null && !isNaN(amount)) ? amount : FALLBACK;

    result.datetime  = this.extractDateTime(text)  || FALLBACK;
    result.sender    = this.extractSender(text)    || FALLBACK;
    result.receiver  = this.extractReceiver(text)  || FALLBACK;
    result.reference = this.extractReference(text) || FALLBACK;

    result.confidence = this.calculateConfidence(result);

    return result;
  }


  // ════════════════════════════════════════════════════════
  //  identifyBank()
  // ════════════════════════════════════════════════════════

  /**
   * ✅ ใช้ toUpperCase() ทั้งสองฝั่ง → case-insensitive matching
   */
  identifyBank(text) {
    const upper = text.toUpperCase();
    for (const [code, bank] of Object.entries(this.banks)) {
      for (const kw of bank.keywords) {
        if (upper.includes(kw.toUpperCase())) {
          return code;
        }
      }
    }
    return null;
  }


  // ════════════════════════════════════════════════════════
  //  extractAmount()
  // ════════════════════════════════════════════════════════

  extractAmount(text) {
    for (const pattern of this.patterns.amount) {
      const m = text.match(pattern);
      if (m && m[1]) {
        const n = parseFloat(m[1].replace(/,/g, ''));
        if (!isNaN(n) && n > 0) return n;
      }
    }
    return null;
  }


  // ════════════════════════════════════════════════════════
  //  extractDateTime()
  // ════════════════════════════════════════════════════════

  /**
   * ✅ แก้บั๊ก: รับประกันว่าจะไม่ return undefined
   *    ทุก branch คืน string หรือ null
   *    null จะถูก parse() แปลงเป็น '-' ก่อนบันทึก
   *
   * ✅ รองรับ OCR artifact "14: 30" → normalize เป็น "14:30"
   */
  extractDateTime(text) {
    for (const pattern of this.patterns.datetime) {
      const m = text.match(pattern);
      if (!m) continue;

      const datePart = m[1] ? m[1].trim() : null;
      const timePart = m[2] ? m[2].trim() : null;

      if (!datePart) continue;

      // Normalize "14: 30" → "14:30"  (OCR เพิ่ม space หลัง colon)
      const normalizeTime = (t) => t ? t.replace(/:\s+/g, ':') : null;

      if (timePart) {
        return `${datePart} ${normalizeTime(timePart)}`;
      }
      return datePart;
    }
    return null;  // parse() จะแปลงเป็น '-'
  }


  // ════════════════════════════════════════════════════════
  //  extractSender / extractReceiver / extractReference
  // ════════════════════════════════════════════════════════

  extractSender(text) {
    for (const pattern of this.patterns.sender) {
      const m = text.match(pattern);
      if (m && m[1]) {
        const val = m[1].trim();
        // กรองค่าที่ไม่สมเหตุสมผล (ว่าง หรือยาวเกินไป)
        if (val.length > 0 && val.length < 120) return val;
      }
    }
    return null;
  }

  extractReceiver(text) {
    for (const pattern of this.patterns.receiver) {
      const m = text.match(pattern);
      if (m && m[1]) {
        const val = m[1].trim();
        if (val.length > 0 && val.length < 120) return val;
      }
    }
    return null;
  }

  extractReference(text) {
    for (const pattern of this.patterns.reference) {
      const m = text.match(pattern);
      if (m && m[1]) {
        const val = m[1].trim();
        if (val.length > 0) return val;
      }
    }
    return null;
  }


  // ════════════════════════════════════════════════════════
  //  calculateConfidence()
  // ════════════════════════════════════════════════════════

  /**
   * ✅ แก้บั๊ก: ตรวจสอบว่าค่าไม่ใช่ '-' ด้วย
   *    เดิม: if (result[field])  → '-' ก็ถือว่า truthy → score สูงเกินจริง
   *    แก้แล้ว: ตรวจว่าไม่ใช่ FALLBACK ด้วย
   */
  calculateConfidence(result) {
    const FALLBACK = '-';
    const weights = {
      amount    : 30,
      datetime  : 20,
      sender    : 15,
      receiver  : 15,
      reference : 10,
      bank      : 10,
    };

    let score = 0;
    for (const [field, weight] of Object.entries(weights)) {
      const val = result[field];
      if (val !== null && val !== undefined && val !== FALLBACK) {
        score += weight;
      }
    }
    return Math.min(score, 100);
  }
}
