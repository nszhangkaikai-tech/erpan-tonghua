// 云存储封装：上传 buffer / 获取临时 URL / 封面图处理（替代原 server.ts 的本地磁盘存储）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const SAFE_FETCH_MAX_BYTES = 20 * 1024 * 1024;
const SAFE_FETCH_TIMEOUT_MS = 15000;

function isPrivateHost(hostname) {
  const h = hostname.toLowerCase();
  const ipParts = h.split('.').map(Number);
  if (ipParts.length === 4 && ipParts.every(n => Number.isInteger(n) && n >= 0 && n <= 255)) {
    if (ipParts[0] === 10) return true;
    if (ipParts[0] === 127) return true;
    if (ipParts[0] === 0) return true;
    if (ipParts[0] === 169 && ipParts[1] === 254) return true;
    if (ipParts[0] === 172 && ipParts[1] >= 16 && ipParts[1] <= 31) return true;
    if (ipParts[0] === 192 && ipParts[1] === 168) return true;
    if (ipParts[0] === 100 && ipParts[1] >= 64 && ipParts[1] <= 127) return true;
  }
  if (h === '::1' || h === 'localhost' || h === '[::1]') return true;
  if (h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80')) return true;
  if (h.startsWith('[')) return true;
  return false;
}

async function safeFetch(sourceUrl) {
  let parsed;
  try { parsed = new URL(sourceUrl); } catch { throw new Error('Invalid URL'); }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('Blocked protocol');
  if (isPrivateHost(parsed.hostname)) throw new Error('Blocked private host');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SAFE_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(sourceUrl, { signal: controller.signal });
    if (!response.ok) throw new Error(`Download failed ${response.status}`);
    const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
    if (contentLength > SAFE_FETCH_MAX_BYTES) throw new Error('Response too large');
    return response;
  } finally {
    clearTimeout(timer);
  }
}

// 上传 buffer 到云存储，返回 fileID
async function uploadBuffer(buffer, cloudPath) {
  const res = await cloud.uploadFile({ cloudPath, fileContent: buffer });
  return res.fileID;
}

async function getTempFileURL(fileID) {
  if (!fileID || !fileID.startsWith('cloud://')) return fileID;
  const res = await cloud.getTempFileURL({ fileList: [fileID] });
  if (res.fileList && res.fileList[0] && res.fileList[0].tempFileURL) {
    return res.fileList[0].tempFileURL;
  }
  return fileID;
}

// 批量将 fileID 解析为临时 URL（前端用）
async function resolveUrls(list) {
  const ids = list.filter(f => typeof f === 'string' && f.startsWith('cloud://'));
  if (ids.length === 0) return {};
  const res = await cloud.getTempFileURL({ fileList: ids });
  const map = {};
  (res.fileList || []).forEach(item => { map[item.fileID] = item.tempFileURL; });
  return map;
}

// 处理封面图：下载（SSRF 安全）→ 上传云存储 → 返回 { fileID }
async function processCoverImage(sourceUrl, ownerId) {
  try {
    const response = await safeFetch(sourceUrl);
    const sourceBuf = Buffer.from(await response.arrayBuffer());
    if (sourceBuf.length > SAFE_FETCH_MAX_BYTES) throw new Error('Image too large');
    const filename = `img_${Date.now()}_${Math.floor(Math.random() * 1000)}.webp`;
    const cloudPath = `images/${ownerId}/${filename}`;
    const fileID = await uploadBuffer(sourceBuf, cloudPath);
    return { fileID, status: 'ready' };
  } catch (err) {
    console.error('[Image] cover process failed:', err.message);
    return { fileID: '', status: 'failed' };
  }
}

async function processChapterImage(sourceUrl, ownerId) {
  try {
    const response = await safeFetch(sourceUrl);
    const sourceBuf = Buffer.from(await response.arrayBuffer());
    if (sourceBuf.length > SAFE_FETCH_MAX_BYTES) throw new Error('Image too large');
    const filename = `img_${Date.now()}_${Math.floor(Math.random() * 1000)}.webp`;
    const cloudPath = `images/${ownerId}/${filename}`;
    const fileID = await uploadBuffer(sourceBuf, cloudPath);
    return { fileID, status: 'ready' };
  } catch (err) {
    console.error('[Image] chapter process failed:', err.message);
    return { fileID: '', status: 'failed' };
  }
}

module.exports = {
  uploadBuffer,
  getTempFileURL,
  resolveUrls,
  processCoverImage,
  processChapterImage,
};
