// 通用工具：ID 生成、哈希、安全词检查、儿童友好改写
const crypto = require('crypto');

function genId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

function sha256Hex(data) {
  const buf = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// 敏感词类别 → 默认儿童友好改写映射
const CHILD_FRIENDLY_DEFAULTS = {
  politics: { replaced: '和平小河畔', suggestion: '倡导爱、和平与美好，和伙伴们友好地一起建设温暖美丽的家园' },
  adult: { replaced: '暖烘烘的漂亮衣服', suggestion: '穿戴整齐、大方得体，散发健康自信和阳光气质' },
  violence: { replaced: '举行手拉手的快乐比赛', suggestion: '和小朋友一起画画、堆积木、合作解决问题，用包容、赞美和微笑代替暴力' },
  abuse: { replaced: '萌萌的小可爱', suggestion: '多关注他人的长处，互相说鼓励的话，做温暖彼此、传递能量的好朋友' },
};

function getChildFriendlyReplacement(word, category) {
  return CHILD_FRIENDLY_DEFAULTS[category] || { replaced: '奇妙的好玩伴', suggestion: '建立友爱互助、健康成长的和谐氛围' };
}

// 安全词检查引擎。config 来自云数据库 sensitiveWordsConfig 集合。
function runSafetyCheck(textToScan, config) {
  if (!textToScan) return null;
  const safeConfig = config || { sensitiveWords: [], categories: [] };
  const words = safeConfig.sensitiveWords || [];
  const categories = safeConfig.categories || [];

  for (const item of words) {
    if (!item.word) continue;
    const escapedWord = item.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const wordRegex = new RegExp(escapedWord, 'gi');
    const isCJK = (ch) => /[\u4e00-\u9fa5]/.test(ch);
    let match;
    let validMatch = null;
    while ((match = wordRegex.exec(textToScan)) !== null) {
      const matchStart = match.index;
      const matchEnd = matchStart + item.word.length;
      const prevChar = textToScan[matchStart - 1] || '';
      const nextChar = textToScan[matchEnd] || '';
      const prevIsCJK = matchStart > 0 && isCJK(prevChar);
      const nextIsCJK = matchEnd < textToScan.length && isCJK(nextChar);
      if (!prevIsCJK && !nextIsCJK) {
        validMatch = match;
        break;
      }
    }
    if (!validMatch) continue;

    const cat = categories.find(c => c.key === item.category) || { key: item.category, name: '敏感内容', handling: 'intercept' };
    const mapping = getChildFriendlyReplacement(item.word, item.category);
    return {
      blocked: cat.handling === 'intercept',
      rewrite: cat.handling === 'rewrite',
      word: item.word,
      category: item.category,
      categoryName: cat.name,
      suggestion: mapping.suggestion,
      original: textToScan,
      replacedText: textToScan.replace(wordRegex, mapping.replaced),
    };
  }
  return null;
}

// 校验音频 buffer 头（MP3/WAV/OGG/AAC）
function isValidAudioBuffer(buf) {
  if (!buf || buf.length < 4) return false;
  const isMp3 = (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) ||
    (buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0);
  const isWav = buf[0] === 0x52 && buf[1] === 0x49;
  const isOgg = buf[0] === 0x4F && buf[1] === 0x67;
  const isAac = buf[0] === 0xFF && (buf[1] & 0xF0) === 0xF0;
  return isMp3 || isWav || isOgg || isAac;
}

function audioFormatFromBuffer(buf) {
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return { extension: 'mp3', mimeType: 'audio/mpeg' };
  if (buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0) return { extension: 'mp3', mimeType: 'audio/mpeg' };
  if (buf[0] === 0x52 && buf[1] === 0x49) return { extension: 'wav', mimeType: 'audio/wav' };
  if (buf[0] === 0x4F && buf[1] === 0x67) return { extension: 'ogg', mimeType: 'audio/ogg' };
  return { extension: 'aac', mimeType: 'audio/aac' };
}

function genSafetyAuditLog(type, originalInput, category, categoryName, actionTaken, triggeredWord, processedText, message) {
  return {
    id: genId('audit'),
    timestamp: new Date().toISOString(),
    type,
    originalInput,
    processedInput: processedText || (actionTaken === 'intercept' ? '直接拦截（无改写）' : '内容自动改写净化'),
    actionTaken,
    category,
    categoryName: categoryName || category,
    triggeredWord: triggeredWord || '',
    status: 'pending_review',
    message,
  };
}

module.exports = {
  genId,
  sha256Hex,
  runSafetyCheck,
  getChildFriendlyReplacement,
  isValidAudioBuffer,
  audioFormatFromBuffer,
  genSafetyAuditLog,
};
