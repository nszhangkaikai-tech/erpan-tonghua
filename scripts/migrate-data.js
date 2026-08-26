// 数据迁移脚本：将旧 data.json（Express 内存态）迁移到 CloudBase 云数据库集合。
// 运行前提：node scripts/migrate-data.js 需安装 wx-server-sdk 并配置
//   - CLOUD_ENV 环境变量（云环境 ID）
//   - 或在 CloudBase 云函数 / 云托管环境内运行
// 建议在本地用 tcb 命令行或 Node 直接跑（需要能访问云数据库的网络/密钥）。
//
// 用法：
//   export CLOUD_ENV=blacke-d7g0wczgza0632d5a
//   node scripts/migrate-data.js [path/to/data.json]
//
// 注意：本脚本为“幂等补种”——只创建缺失的全局配置（templates/config/stats/sensitiveWordsConfig/cdkeys/admins），
//       不会覆盖已有用户数据。用户维度的 voices/stories/notifications 会按 openid 去重建。

const path = require('path');
const cloud = require('wx-server-sdk');

const env = process.env.CLOUD_ENV || 'blacke-d7g0wczgza0632d5a';
cloud.init({ env });

const { DEFAULT_TEMPLATES, DEFAULT_CDKEYS, DEFAULT_SENSITIVE_CONFIG, DEFAULT_STATS, DEFAULT_CONFIG, getSeedAdmin } = require('../cloudfunctions/common/seed');

async function loadDataJson(jsonPath) {
  const fs = require('fs');
  if (!fs.existsSync(jsonPath)) {
    console.warn(`[migrate] 未找到 data.json: ${jsonPath}，仅进行默认种子补种。`);
    return null;
  }
  return JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
}

async function ensureDoc(collection, query, doc) {
  const db = cloud.database();
  const res = await db.collection(collection).where(query).limit(1).get();
  if (res.data && res.data.length > 0) return false;
  await db.collection(collection).add(doc);
  return true;
}

async function seedGlobal() {
  let added = 0;
  // templates
  for (const t of DEFAULT_TEMPLATES) {
    if (await ensureDoc('templates', { id: t.id }, t)) added++;
  }
  // config
  if (await ensureDoc('config', {}, DEFAULT_CONFIG)) added++;
  // stats
  if (await ensureDoc('stats', {}, DEFAULT_STATS)) added++;
  // sensitiveWordsConfig
  if (await ensureDoc('sensitiveWordsConfig', {}, DEFAULT_SENSITIVE_CONFIG)) added++;
  // cdkeys
  for (const c of DEFAULT_CDKEYS) {
    if (await ensureDoc('cdkeys', { code: c.code }, c)) added++;
  }
  // admin（默认 admin / admin123，生产务必改密或设 ADMIN_PASSWORD）
  const seedAdmin = getSeedAdmin();
  if (await ensureDoc('admins', { username: seedAdmin.username }, seedAdmin)) added++;
  return added;
}

// 将 data.json 里的用户迁移到 users 集合（openid 维度）
async function migrateUsers(data) {
  if (!data || !data.users) return 0;
  const db = cloud.database();
  let n = 0;
  for (const u of data.users) {
    const openid = u.openid || u.id;
    if (!openid) continue;
    const res = await db.collection('users').where({ openid }).limit(1).get();
    if (res.data && res.data.length > 0) continue;
    await db.collection('users').doc(openid).set({
      _id: openid,
      openid,
      nickname: u.nickname || '小宝贝家长',
      rights: u.rights || { freeVoiceClonesRemaining: 5, storyGenerationsRemaining: 3, isVip: false, inviteCode: 'BMTH-' + Math.random().toString(36).slice(2, 6).toUpperCase() },
      profile: u.profile || {},
      createdAt: u.createdAt || new Date().toISOString(),
    });
    n++;
  }
  return n;
}

async function migrateVoices(data) {
  if (!data || !data.voiceClones) return 0;
  const db = cloud.database();
  let n = 0;
  const openid = data.users && data.users[0] ? (data.users[0].openid || data.users[0].id) : 'legacy_user';
  for (const v of data.voiceClones) {
    const res = await db.collection('voiceClones').where({ id: v.id }).limit(1).get();
    if (res.data && res.data.length > 0) continue;
    await db.collection('voiceClones').add({ openid, ...v });
    n++;
  }
  return n;
}

async function migrateStories(data) {
  if (!data || !data.userStories) return 0;
  const db = cloud.database();
  let n = 0;
  const openid = data.users && data.users[0] ? (data.users[0].openid || data.users[0].id) : 'legacy_user';
  for (const s of data.userStories) {
    const res = await db.collection('userStories').where({ id: s.id }).limit(1).get();
    if (res.data && res.data.length > 0) continue;
    await db.collection('userStories').add({ openid, ...s });
    n++;
  }
  return n;
}

async function migrateNotifications(data) {
  if (!data || !data.notifications) return 0;
  const db = cloud.database();
  let n = 0;
  const openid = data.users && data.users[0] ? (data.users[0].openid || data.users[0].id) : 'legacy_user';
  for (const nt of data.notifications) {
    const res = await db.collection('notifications').where({ id: nt.id, openid }).limit(1).get();
    if (res.data && res.data.length > 0) continue;
    await db.collection('notifications').add({ openid, ...nt });
    n++;
  }
  return n;
}

async function main() {
  const jsonPath = process.argv[2] || path.resolve(__dirname, '../backend/data.json');
  const data = await loadDataJson(jsonPath);

  const g = await seedGlobal();
  console.log(`[migrate] 全局种子补种完成，新增 ${g} 条`);

  if (data) {
    const u = await migrateUsers(data);
    const v = await migrateVoices(data);
    const s = await migrateStories(data);
    const n = await migrateNotifications(data);
    console.log(`[migrate] 用户 ${u} / 声纹 ${v} / 故事 ${s} / 通知 ${n} 条已迁移`);
  }
  console.log('[migrate] 完成 ✅');
  process.exit(0);
}

main().catch(err => {
  console.error('[migrate] 失败:', err);
  process.exit(1);
});
