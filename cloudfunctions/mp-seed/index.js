// 临时数据播种云函数（部署后调用一次即删，不进入生产函数列表）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const {
  DEFAULT_TEMPLATES, DEFAULT_CDKEYS, DEFAULT_SENSITIVE_CONFIG, DEFAULT_STATS, DEFAULT_CONFIG, getSeedAdmin
} = require('./common/seed');

// 显式创建集合（本环境不会因写入自动建集合）
async function ensureCollection(name) {
  try {
    await db.createCollection(name);
  } catch (e) {
    // 已存在或并发创建，忽略
  }
}

async function ensureDoc(collection, query, doc) {
  const res = await db.collection(collection).where(query).limit(1).get();
  if (res.data && res.data.length > 0) return false;
  // 环境 add() 偶发丢失字段，改用 doc(id).set 确保字段全保留
  const id = doc.id || doc.code || (collection + '_main');
  await db.collection(collection).doc(id).set({ data: { ...doc, id } });
  return true;
}

async function seedGlobal() {
  const collections = ['templates', 'config', 'stats', 'sensitiveWordsConfig', 'cdkeys', 'admins'];
  for (const c of collections) {
    await ensureCollection(c);
  }

  let added = 0;
  for (const t of DEFAULT_TEMPLATES) {
    if (await ensureDoc('templates', { id: t.id }, t)) added++;
  }
  if (await ensureDoc('config', {}, DEFAULT_CONFIG)) added++;
  if (await ensureDoc('stats', {}, DEFAULT_STATS)) added++;
  if (await ensureDoc('sensitiveWordsConfig', {}, DEFAULT_SENSITIVE_CONFIG)) added++;
  for (const c of DEFAULT_CDKEYS) {
    if (await ensureDoc('cdkeys', { code: c.code }, c)) added++;
  }
  const seedAdmin = getSeedAdmin();
  if (await ensureDoc('admins', { username: seedAdmin.username }, seedAdmin)) added++;
  return added;
}

exports.main = async (event) => {
  if (event.action !== 'run') return { error: 'unknown action' };
  const added = await seedGlobal();
  return { success: true, added };
};
