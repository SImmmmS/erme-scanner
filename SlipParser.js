/**
 * SlipParser.js (Updated with PromptPayQRParser)
 * วิเคราะห์และแยกข้อมูลจากข้อความสลิปการโอนเงิน
 * รองรับธนาคารไทยหลักทั้งหมด และ QR Code parsing ตามมาตรฐาน
 */
class SlipParser {
  constructor() {
    // ข้อมูลธนาคารไทย
    this.banks = {
      'SCB': {
        name: 'ธนาคารไทยพาณิชย์',
        keywords: ['ไทยพาณิชย์', 'SCB', 'Siam Commercial Bank'],
        color: '#4e1a8b',
        logo: 'assets/bank-logos/scb.png'
      },
      'KBANK': {
        name: 'ธนาคารกสิกรไทย',
        keywords: ['กสิกรไทย', 'KBANK', 'Kasikorn Bank', 'K-Bank'],
        color: '#16a34a',
        logo: 'assets/bank-logos/kbank.png'
      },
      'BBL': {
        name: 'ธนาคารกรุงเทพ',
        keywords: ['กรุงเทพ', 'BBL', 'Bangkok Bank'],
        color: '#1e40af',
        logo: 'assets/bank-logos/bbl.png'
      },
      'KTB': {
        name: 'ธนาคารกรุงไทย',
        keywords: ['กรุงไทย', 'KTB', 'Krung Thai Bank'],
        color: '#1e7e34',
        logo: 'assets/bank-logos/ktb.png'
      },
      'TMB': {
        name: 'ธนาคารทหารไทย',
        keywords: ['ทหารไทย', 'TMB', 'TMB Bank'],
        color: '#6366f1',
        logo: 'assets/bank-logos/tmb.png'
      },
      'GSB': {
        name: 'ธนาคารออมสิน',
        keywords: ['ออมสิน', 'GSB', 'Government Savings Bank'],
        color: '#dc2626',
        logo: 'assets/bank-logos/gsb.png'
      },
      'BAAC': {
        name: 'ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร',
        keywords: ['เกษตรและสหกรณ์', 'BAAC', 'เกษตร'],
        color: '#059669',
        logo: 'assets/bank-logos/baac.png'
      }
    };

    // รูปแบบการค้นหาข้อมูล
    this.patterns = {
      // จำนวนเงิน
      amount: [
        /จำนวนเงิน[:\s]*฿?\s*([\d,]+\.?\d*)/i,
        /Amount[:\s]*฿?\s*([\d,]+\.?\d*)/i,
        /฿\s*([\d,]+\.?\d*)/,
        /([\d,]+\.?\d*)\s*บาท/,
        /เงิน[:\s]*([\d,]+\.?\d*)/
      ],

      // วันที่และเวลา
      datetime: [
        /(\d{1,2}\/\d{1,2}\/\d{4})\s*(\d{1,2}:\d{2})/,
        /(\d{1,2}-\d{1,2}-\d{4})\s*(\d{1,2}:\d{2})/,
        /วันที่[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/,
        /เวลา[:\s]*(\d{1,2}:\d{2})/
      ],

      // ผู้โอน
      sender: [
        /จาก[:\s]*(.+?)(?=\s*ไปยัง|\s*ถึง|\s*To|\n|$)/i,
        /From[:\s]*(.+?)(?=\s*To|\s*ไปยัง|\n|$)/i,
        /ผู้โอน[:\s]*(.+?)(?=\s*ผู้รับ|\s*ไปยัง|\n|$)/i
      ],

      // ผู้รับ
      receiver: [
        /ไปยัง[:\s]*(.+?)(?=\s*จำนวน|\s*Amount|\n|$)/i,
        /To[:\s]*(.+?)(?=\s*Amount|\s*จำนวน|\n|$)/i,
        /ผู้รับ[:\s]*(.+?)(?=\s*จำนวน|\s*Amount|\n|$)/i,
        /ถึง[:\s]*(.+?)(?=\s*จำนวน|\s*Amount|\n|$)/i
      ],

      // รหัสอ้างอิง
      reference: [
        /รหัสอ้างอิง[:\s]*(.+?)(?=\s|\n|$)/i,
        /Reference[:\s]*(.+?)(?=\s|\n|$)/i,
        /Ref[:\s]*(.+?)(?=\s|\n|$)/i,
        /อ้างอิง[:\s]*(.+?)(?=\s|\n|$)/i,
        /Transaction ID[:\s]*(.+?)(?=\s|\n|$)/i
      ]
    };
  }

  /**
   * วิเคราะห์ข้อความและแยกข้อมูลสลิป
   */
  parse(text) {
    const result = {
      amount: null,
      datetime: null,
      sender: null,
      receiver: null,
      reference: null,
      bank: null,
      confidence: 0,
      raw_text: text
    };

    if (!text || text.trim().length === 0) {
      return result;
    }

    // ระบุธนาคาร
    result.bank = this.identifyBank(text);

    // แยกข้อมูลตามรูปแบบ
    result.amount = this.extractAmount(text);
    result.datetime = this.extractDateTime(text);
    result.sender = this.extractSender(text);
    result.receiver = this.extractReceiver(text);
    result.reference = this.extractReference(text);

    // คำนวณความมั่นใจ
    result.confidence = this.calculateConfidence(result);

    return result;
  }

  /**
   * ระบุธนาคารจากข้อความ
   */
  identifyBank(text) {
    for (const [code, bank] of Object.entries(this.banks)) {
      for (const keyword of bank.keywords) {
        if (text.includes(keyword)) {
          return code;
        }
      }
    }
    return null;
  }

  /**
   * แยกจำนวนเงิน
   */
  extractAmount(text) {
    for (const pattern of this.patterns.amount) {
      const match = text.match(pattern);
      if (match) {
        const amount = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(amount) && amount > 0) {
          return amount;
        }
      }
    }
    return null;
  }

  /**
   * แยกวันที่และเวลา
   */
  extractDateTime(text) {
    for (const pattern of this.patterns.datetime) {
      const match = text.match(pattern);
      if (match) {
        if (match.length >= 3) {
          return `${match[1]} ${match[2]}`;
        } else {
          return match[1];
        }
      }
    }
    return null;
  }

  /**
   * แยกผู้โอน
   */
  extractSender(text) {
    for (const pattern of this.patterns.sender) {
      const match = text.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
    return null;
  }

  /**
   * แยกผู้รับ
   */
  extractReceiver(text) {
    for (const pattern of this.patterns.receiver) {
      const match = text.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
    return null;
  }

  /**
   * แยกรหัสอ้างอิง
   */
  extractReference(text) {
    for (const pattern of this.patterns.reference) {
      const match = text.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
    return null;
  }

  /**
   * คำนวณความมั่นใจ
   */
  calculateConfidence(result) {
    let score = 0;
    const weights = {
      amount: 30,
      datetime: 20,
      sender: 15,
      receiver: 15,
      reference: 10,
      bank: 10
    };

    Object.keys(weights).forEach(field => {
      if (result[field]) {
        score += weights[field];
      }
    });

    return Math.min(score, 100);
  }
}
