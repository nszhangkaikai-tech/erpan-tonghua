// 云数据库数据访问层（替代原 server.ts 的 in-memory db + data.json）
// 所有集合基于 openid 归属；全局配置集合独立存放。
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

function getOpenid(context) {
  const wxContext = cloud.getWXContext();
  return wxContext.OPENID;
}

function genInviteCode() {
  return 'BMTH-' + require('crypto').randomBytes(2).toString('hex').toUpperCase();
}

function getDefaultRights() {
  return {
    freeVoiceClonesRemaining: 5,
    storyGenerationsRemaining: 3,
    isVip: false,
    inviteCode: genInviteCode(),
  };
}

// ---------- 用户 ----------
async function ensureUser(openid, nickname) {
  if (!openid) throw new Error('openid 缺失');
  const res = await db.collection('users').doc(openid).get().catch(() => null);
  if (res && res.data) return res.data;
  const user = {
    _id: openid,
    openid,
    nickname: nickname || '小宝贝家长',
    rights: getDefaultRights(),
    profile: {},
    createdAt: new Date().toISOString(),
  };
  await db.collection('users').doc(openid).set(user);
  return user;
}

async function getUser(openid) {
  const res = await db.collection('users').doc(openid).get().catch(() => null);
  return res && res.data ? res.data : null;
}

async function updateUser(openid, patch) {
  await db.collection('users').doc(openid).update({ data: patch });
  const u = await getUser(openid);
  return u;
}

async function getRights(openid) {
  const u = await ensureUser(openid);
  return u.rights;
}

async function setRights(openid, rights) {
  await db.collection('users').doc(openid).update({ data: { rights } });
  return rights;
}

// 兼容原 getUserState：聚合用户维度数据
async function getUserState(openid, nickname) {
  const user = await ensureUser(openid, nickname);
  const [voiceClones, notifications] = await Promise.all([
    queryAll('voiceClones', { openid }),
    queryAll('notifications', { openid }),
  ]);
  return {
    user,
    rights: user.rights,
    voiceClones,
    notifications,
  };
}

// ---------- 通用分页查询 ----------
async function queryAll(collection, where, orderBy) {
  let all = [];
  let offset = 0;
  const MAX = 100;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let q = db.collection(collection).where(where);
    if (orderBy) q = q.orderBy(orderBy.field, orderBy.dir);
    q = q.skip(offset).limit(MAX);
    const res = await q.get();
    const list = res.data || [];
    all = all.concat(list);
    if (list.length < MAX) break;
    offset += MAX;
  }
  return all;
}

// ---------- 故事 ----------
async function listStories(openid) {
  return queryAll('userStories', { openid });
}
async function getStory(openid, id) {
  const res = await db.collection('userStories').doc(id).get().catch(() => null);
  const s = res && res.data ? res.data : null;
  if (s && s.openid !== openid) return null; // 跨用户隔离
  return s;
}
async function addStory(story) {
  const res = await db.collection('userStories').add(story);
  return { ...story, _id: res._id };
}
async function updateStory(openid, id, patch) {
  const existing = await getStory(openid, id);
  if (!existing) throw new Error('故事不存在或无权限');
  await db.collection('userStories').doc(id).update({ data: patch });
  return { ...existing, ...patch };
}
async function deleteStory(openid, id) {
  const existing = await getStory(openid, id);
  if (!existing) return false;
  await db.collection('userStories').doc(id).remove();
  return true;
}

// ---------- 声纹 ----------
async function listVoices(openid) {
  return queryAll('voiceClones', { openid });
}
async function addVoice(voice) {
  const res = await db.collection('voiceClones').add(voice);
  return { ...voice, _id: res._id };
}
async function deleteVoice(openid, id) {
  const res = await db.collection('voiceClones').doc(id).get().catch(() => null);
  const v = res && res.data ? res.data : null;
  if (!v || v.openid !== openid) return false;
  await db.collection('voiceClones').doc(id).remove();
  return true;
}

// ---------- 通知 ----------
async function listNotifications(openid) {
  return queryAll('notifications', { openid }, { field: 'createdAt', dir: 'desc' });
}
async function addNotification(openid, notif) {
  const record = { openid, ...notif };
  const res = await db.collection('notifications').add(record);
  return { ...record, _id: res._id };
}
async function markAllRead(openid) {
  await db.collection('notifications').where({ openid, isRead: false }).update({ data: { isRead: true } });
  return true;
}
async function deleteNotification(openid, id) {
  const res = await db.collection('notifications').doc(id).get().catch(() => null);
  const n = res && res.data ? res.data : null;
  if (!n || n.openid !== openid) return false;
  await db.collection('notifications').doc(id).remove();
  return true;
}

// ---------- 额度流水 ----------
async function recordQuota(openid, entry) {
  const record = { openid, ...entry };
  await db.collection('quotaLedger').add(record);
}

// ---------- 全局配置 ----------
async function getConfig() {
  const res = await db.collection('config').limit(1).get();
  return res.data && res.data[0] ? res.data[0] : null;
}
async function getTemplates() {
  const res = await db.collection('templates').limit(1000).get();
  return res.data || [];
}
async function getSensitiveConfig() {
  const res = await db.collection('sensitiveWordsConfig').limit(1).get();
  return res.data && res.data[0] ? res.data[0] : null;
}
async function pushAuditLog(audit) {
  const res = await db.collection('sensitiveWordsConfig').limit(1).get();
  if (!res.data || !res.data[0]) return;
  const doc = res.data[0];
  const logs = doc.auditLogs || [];
  logs.unshift(audit);
  await db.collection('sensitiveWordsConfig').doc(doc._id).update({ data: { auditLogs: _.unshift(audit) } });
}

// ---------- 兑换码 ----------
async function getCdkey(code) {
  const res = await db.collection('cdkeys').where({ code }).limit(1).get();
  return res.data && res.data[0] ? res.data[0] : null;
}
// 原子兑换：仅在 isUsed=false 时置为 true，返回是否真的更新成功（防止并发重复兑换）
async function markCdkeyUsedAtomic(code, openid) {
  const res = await db.collection('cdkeys').where({ code, isUsed: false })
    .update({ data: { isUsed: true, usedBy: openid, usedAt: new Date().toISOString() } });
  const updated = (res && typeof res.stats === 'object' && typeof res.stats.updated === 'number')
    ? res.stats.updated
    : (res && res.updated) || 0;
  return updated >= 1;
}
async function getCdkeyDoc(code) {
  const res = await db.collection('cdkeys').where({ code }).limit(1).get();
  return res.data && res.data[0] ? res.data[0] : null;
}
async function listCdkeys() {
  return queryAll('cdkeys', {});
}
// 通过邀请码找到真实推荐人 openid（rights.inviteCode 内嵌于 users 文档）
async function getUserByInviteCode(inviteCode) {
  const res = await db.collection('users').where({ 'rights.inviteCode': inviteCode }).limit(1).get();
  return res.data && res.data[0] ? res.data[0] : null;
}

// ---------- 邀请 ----------
async function addInvitationRecord(record) {
  const res = await db.collection('invitationRecords').add(record);
  return { ...record, _id: res._id };
}

// ---------- 统计 ----------
async function getStats() {
  const res = await db.collection('stats').limit(1).get();
  return res.data && res.data[0] ? res.data[0] : null;
}
async function incrStats(field, by = 1) {
  const res = await db.collection('stats').limit(1).get();
  if (!res.data || !res.data[0]) return;
  await db.collection('stats').doc(res.data[0]._id).update({ data: { [field]: _.inc(by) } });
}

// ---------- 异步任务 ----------
async function addJob(job) {
  const res = await db.collection('generationJobs').add(job);
  return { ...job, _id: res._id };
}
async function getJob(openid, id) {
  const res = await db.collection('generationJobs').doc(id).get().catch(() => null);
  const j = res && res.data ? res.data : null;
  if (j && j.openid !== openid) return null;
  return j;
}
// 后台异步任务专用：不校验归属，直接从 admin 上下文读取（云函数内执行有权限）
async function getJobRaw(id) {
  const res = await db.collection('generationJobs').doc(id).get().catch(() => null);
  return res && res.data ? res.data : null;
}
async function updateJob(id, patch) {
  await db.collection('generationJobs').doc(id).update({ data: patch });
}

// ---------- 资源（图片/音频） ----------
async function addAsset(asset) {
  const res = await db.collection('assets').add(asset);
  return { ...asset, _id: res._id };
}

// ---------- 管理员 ----------
async function getAdmin(username) {
  const res = await db.collection('admins').where({ username }).limit(1).get();
  return res.data && res.data[0] ? res.data[0] : null;
}
async function listAdmins() {
  return queryAll('admins', {});
}
async function addAdmin(username, passwordHash) {
  const res = await db.collection('admins').add({ username, password: passwordHash, createdAt: new Date().toISOString() });
  return res;
}
async function updateAdminPassword(username, passwordHash) {
  const res = await db.collection('admins').where({ username }).limit(1).get();
  if (!res.data || !res.data[0]) return false;
  await db.collection('admins').doc(res.data[0]._id).update({ data: { password: passwordHash } });
  return true;
}
// 管理端会话（存云数据库，替代原内存 Map）
async function createAdminSession(username) {
  const token = require('crypto').randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
  const record = { token, username, createdAt: new Date().toISOString(), expiresAt };
  await db.collection('adminSessions').add(record);
  return token;
}
async function getAdminSession(token) {
  const res = await db.collection('adminSessions').where({ token }).limit(1).get();
  const s = res.data && res.data[0] ? res.data[0] : null;
  if (!s) return null;
  if (new Date(s.expiresAt).getTime() < Date.now()) return null;
  return s;
}

module.exports = {
  cloud,
  db,
  _,
  getOpenid,
  getDefaultRights,
  ensureUser,
  getUser,
  updateUser,
  getRights,
  setRights,
  getUserState,
  queryAll,
  listStories,
  getStory,
  addStory,
  updateStory,
  deleteStory,
  listVoices,
  addVoice,
  deleteVoice,
  listNotifications,
  addNotification,
  markAllRead,
  deleteNotification,
  recordQuota,
  getConfig,
  getTemplates,
  getSensitiveConfig,
  pushAuditLog,
  getCdkey,
  markCdkeyUsedAtomic,
  getCdkeyDoc,
  listCdkeys,
  getUserByInviteCode,
  addInvitationRecord,
  getStats,
  incrStats,
  addJob,
  getJob,
  getJobRaw,
  updateJob,
  addAsset,
  getAdmin,
  listAdmins,
  addAdmin,
  updateAdminPassword,
  createAdminSession,
  getAdminSession,
};
