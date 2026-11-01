/**
 * Autonomous Thai Baht Text Converter (RFC/ETDA compliant)
 * Converts numeric amounts (THB) to official Thai text representation.
 * Example: 1,605,000.50 -> "หนึ่งล้านหกแสนห้าพันบาทห้าสิบสตางค์"
 * Example: 21.00 -> "ยี่สิบเอ็ดบาทถ้วน"
 */

const THAI_DIGITS = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
const THAI_POSITIONS = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];

function convertUnderMillion(numStr: string, hasHigherPrefix = false): string {
  let result = '';
  const len = numStr.length;

  for (let i = 0; i < len; i++) {
    const digit = parseInt(numStr[i]!, 10);
    const pos = len - i - 1;

    if (digit === 0) continue;

    if (pos === 0) {
      const hasHigherDigits = numStr.slice(0, len - 1).split('').some(c => c !== '0');
      if (digit === 1 && (hasHigherDigits || hasHigherPrefix)) {
        result += 'เอ็ด';
      } else {
        result += THAI_DIGITS[digit] ?? '';
      }
    } else if (pos === 1) {
      if (digit === 1) {
        result += 'สิบ';
      } else if (digit === 2) {
        result += 'ยี่สิบ';
      } else {
        result += (THAI_DIGITS[digit] ?? '') + 'สิบ';
      }
    } else {
      result += (THAI_DIGITS[digit] ?? '') + (THAI_POSITIONS[pos] ?? '');
    }
  }

  return result;
}

export function bahtText(amount: number): string {
  if (isNaN(amount) || amount === 0) {
    return 'ศูนย์บาทถ้วน';
  }

  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const fixedStr = absAmount.toFixed(2);
  const [bahtPart = '0', satangPart = '00'] = fixedStr.split('.');

  let bahtStr = '';
  let remainingBaht = bahtPart;

  // Handle numbers >= 1,000,000 in groups of 6 digits
  const chunks: string[] = [];
  while (remainingBaht.length > 6) {
    chunks.unshift(remainingBaht.slice(-6));
    remainingBaht = remainingBaht.slice(0, -6);
  }
  if (remainingBaht.length > 0) {
    chunks.unshift(remainingBaht);
  }

  let accumulatedNonZero = false;
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    const chunkText = convertUnderMillion(chunk, accumulatedNonZero);
    if (chunkText !== '') {
      accumulatedNonZero = true;
    }
    const millionSuffix = i < chunks.length - 1 && chunkText !== '' ? 'ล้าน'.repeat(chunks.length - 1 - i) : '';
    bahtStr += chunkText + millionSuffix;
  }

  if (bahtStr === '') {
    bahtStr = 'ศูนย์';
  }

  const satangNum = parseInt(satangPart, 10);
  let satangStr = '';

  if (satangNum === 0) {
    return (isNegative ? 'ลบ' : '') + bahtStr + 'บาทถ้วน';
  } else {
    satangStr = convertUnderMillion(satangPart) + 'สตางค์';
    return (isNegative ? 'ลบ' : '') + (bahtStr === 'ศูนย์' ? '' : bahtStr + 'บาท') + satangStr;
  }
}
