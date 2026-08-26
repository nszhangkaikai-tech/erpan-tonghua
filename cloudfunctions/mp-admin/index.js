// 云函数 mp-admin：管理端全套
// action: login（管理员登录，签发会话 token）
//        register（新建管理员，需有效会话）
//        reset（重置全局配置：模板/统计/审计日志，不触碰用户数据）
//        simulate-api-call（写入模拟 API 统计）
//        template/add | template/delete | template/toggle-recommend
//        safety-config/update | safety-config/audit-resolve
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const crypto = require('crypto');

const {
  db, _, getAdmin, addAdmin, getAdminSession, createAdminSession,
  getTemplates, listCdkeys, getStats, getSensitiveConfig,
  listAdmins, deleteAdmin, updateAdminPassword,
  addCdkey, deleteCdkey, getCdkey, cleanupBrokenCdkeys,
  addNotificationRaw, updateNotification, deleteNotificationRaw,
  getAuthors, getAuthorById, addAuthor, updateAuthor, deleteAuthor,
} = require('./common/db');
const { DEFAULT_TEMPLATES, DEFAULT_SENSITIVE_CONFIG, DEFAULT_STATS } = require('./common/seed');
const { genId } = require('./common/util');
const { getOrGenerateCover, FALLBACK_COVER } = require('./common/cover');
const { resolveUrls } = require('./common/storage');
const { DEFAULT_THEME_CONFIG } = require('./common/seed-theme-config');

// 与 common/seed.js 的哈希方案保持一致：存储值为 "sha256:<hex>"，校验时剥离前缀后比对 hex。
const ADMIN_SALT = process.env.ADMIN_SALT || "bd_dream_admin_salt_v1";
function rawHash(password) {
  return crypto.createHash('sha256').update(ADMIN_SALT + ':' + password).digest('hex');
}
function storedHash(password) {
  return 'sha256:' + rawHash(password);
}
function verifyPassword(password, stored) {
  const hashPart = stored.startsWith('sha256:') ? stored.slice(7) : stored;
  const expected = rawHash(password);
  if (hashPart.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(hashPart));
  } catch {
    return false;
  }
}

// 无状态签名令牌：username.ts.hmac(ADMIN_SALT)，避免依赖 adminSessions 集合写入
// （该环境 .add() 偶发丢失字段，已观察到 admins/adminSessions 文档仅剩 _id）。
function signToken(username) {
  const ts = Date.now();
  const payload = username + '.' + ts;
  const sig = crypto.createHmac('sha256', ADMIN_SALT).update(payload).digest('base64url');
  return payload + '.' + sig;
}
function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [username, ts, sig] = parts;
  const expected = crypto.createHmac('sha256', ADMIN_SALT).update(username + '.' + ts).digest('base64url');
  let ok = false;
  try { ok = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig)); } catch { ok = false; }
  if (!ok) return null;
  if (Date.now() - Number(ts) > 8 * 60 * 60 * 1000) return null; // 8 小时过期
  return { username };
}

// 校验管理员会话；非法返回错误对象，合法返回 session。
async function requireAdmin(event) {
  const token = event.adminToken || (event.data && event.data.adminToken);
  if (!token) return { error: '管理员令牌缺失' };
  const session = verifyToken(token);
  if (!session) return { error: '管理员令牌无效或已过期' };
  return session;
}

async function login(body) {
  const { username, password } = body;
  if (!username || !password) return { error: '请输入管理员账号和密码！' };
  const admin = await getAdmin(username.trim());
  if (!admin || !admin.password) return { error: '管理员账号或密码错误，请核对后再试！' };
  if (!verifyPassword(password, admin.password)) return { error: '管理员账号或密码错误，请核对后再试！' };
  const token = signToken(admin.username);
  return { success: true, user: { username: admin.username }, adminToken: token };
}

async function register(body) {
  const auth = await requireAdmin(body);
  if (auth.error) return auth;
  const { username, password } = body;
  if (!username || !password) return { error: '请输入需要新建的账号和密码！' };
  if (password.length < 5) return { error: '管理员密码长度不能小于5位！' };
  const exists = await getAdmin(username.trim());
  if (exists) return { error: '该管理员账号已存在，请更换！' };
  await addAdmin(username.trim(), storedHash(password));
  return { success: true, message: `管理员【${username}】账号新建成功！` };
}

async function reset(body) {
  const auth = await requireAdmin(body);
  if (auth.error) return auth;

  // 仅重置全局配置，绝不删除用户数据（比原 reset 更安全）。
  const templatesRes = await db.collection('templates').limit(1000).get();
  const existing = templatesRes.data || [];
  for (const t of existing) {
    await db.collection('templates').doc(t._id).remove();
  }
  // 以 seed 的 id 作为 _id 写入，规避该环境 add() 偶发丢字段
  for (const t of DEFAULT_TEMPLATES) {
    await db.collection('templates').doc(t.id).set({ data: t });
  }

  // 重置统计
  const statsRes = await db.collection('stats').limit(1).get();
  if (statsRes.data && statsRes.data[0]) {
    await db.collection('stats').doc(statsRes.data[0]._id).set({ data: DEFAULT_STATS });
  } else {
    await db.collection('stats').doc('stats_main').set({ data: { _id: 'stats_main', ...DEFAULT_STATS } });
  }

  // 清空审计日志，保留敏感词与类别
  const sensRes = await db.collection('sensitiveWordsConfig').limit(1).get();
  if (sensRes.data && sensRes.data[0]) {
    const cfg = sensRes.data[0];
    await db.collection('sensitiveWordsConfig').doc(cfg._id).update({
      data: { auditLogs: DEFAULT_SENSITIVE_CONFIG.auditLogs },
    });
  }

  return { success: true, message: '全局配置已重置（模板/统计/审计日志），用户数据不受影响' };
}

async function simulateApiCall(body) {
  const auth = await requireAdmin(body);
  if (auth.error) return auth;
  const { type } = body;
  let entry = {
    id: genId('apistat'),
    type: type || 'other',
    endpoint: '/api/admin/simulate-api-call',
    status: 200,
    createdAt: new Date().toISOString(),
  };
  if (type === 'gemini') {
    entry = { ...entry, service: 'StepFun Text', latencyMs: 1200 + Math.floor(Math.random() * 800), tokens: 1000 + Math.floor(Math.random() * 500), message: 'Success (Simulated text generation)' };
  } else if (type === 'tts') {
    entry = { ...entry, service: 'StepFun TTS', latencyMs: 500 + Math.floor(Math.random() * 400), tokens: 400 + Math.floor(Math.random() * 300), message: 'Success (Simulated audio speech synthesis)' };
  } else if (type === 'clone') {
    entry = { ...entry, service: 'StepFun Voice Clone', latencyMs: 1500 + Math.floor(Math.random() * 800), tokens: 0, message: 'Success (Simulated voice recording feature analysis)' };
  } else {
    entry = { ...entry, service: 'User Profile', latencyMs: 50 + Math.floor(Math.random() * 80), tokens: 0, message: 'Success (Simulated user profile update)' };
  }
  await db.collection('apiStats').doc(entry.id).set({ data: entry });
  return { success: true, type, apiStats: entry };
}

// 注意：该 CloudBase 环境的 db.collection().add() 偶发丢失自定义字段（仅保留 _id）。
// 因此模板统一以业务 id 作为文档 _id，并使用 doc(_id).set() 写入——系统 _id 永不丢失，
// 且 set 比 add 可靠，避免业务字段（name/id/aiPrompt...）写入后被剥离。
// 增删改查一律以 _id 为定位键，不再依赖自定义 id 字段做 where 查询。
async function templateAdd(body) {
  const auth = await requireAdmin(body);
  if (auth.error) return auth;
  const { name, cover, ageGroup, theme, educationalGoal, scene, mainCharacter, duration, description, aiPrompt } = body;
  const _id = genId('tpl');
  const coverInput = {
    id: _id,
    name: name || '未命名模板',
    ageGroup: ageGroup || '3-6岁',
    theme: theme || '睡前安抚',
    educationalGoal: educationalGoal || '勇敢自信',
    scene: scene || '神秘城堡',
    mainCharacter: mainCharacter || { name: '奇奇', role: '探险家', personality: '活泼聪明' },
    duration: duration || 'medium',
    description: description || '一款极具吸引力的陪伴绘本模板。',
    aiPrompt: aiPrompt || '',
  };
  let finalCover = cover;
  if (!finalCover) {
    try {
      const gen = await getOrGenerateCover(coverInput, { usedBy: ['template'] });
      finalCover = gen.coverUrl || FALLBACK_COVER;
    } catch (e) {
      finalCover = FALLBACK_COVER;
    }
  }
  const newTpl = {
    ...coverInput,
    cover: finalCover,
    isRecommended: false,
    useCount: 0,
  };
  await db.collection('templates').doc(_id).set({ data: newTpl });
  const templates = await getTemplates();
  return { success: true, templates };
}

// 通过业务 id 定位模板文档；返回 { doc, _id } 或 null。
// 该环境 doc(customId) 对自定义 _id 不可靠，必须用 where 查询再取系统 _id。
async function findTemplateById(id) {
  const res = await db.collection('templates').where({ id }).limit(1).get();
  if (!res.data || !res.data[0]) return null;
  return { doc: res.data[0], _id: res.data[0]._id };
}

async function resolveTemplateCovers(templates) {
  const list = templates || [];
  const map = await resolveUrls(list.map(t => t.cover));
  return list.map(t => (t.cover && map[t.cover]) ? { ...t, cover: map[t.cover] } : t);
}

async function templateDelete(body) {
  const auth = await requireAdmin(body);
  if (auth.error) return auth;
  const { id } = body;
  if (!id) return { error: '缺少模板 id' };
  const found = await findTemplateById(id);
  if (!found) return { error: 'Template not found.' };
  await db.collection('templates').doc(found._id).remove();
  const templates = await getTemplates();
  return { success: true, templates };
}

async function templateToggleRecommend(body) {
  const auth = await requireAdmin(body);
  if (auth.error) return auth;
  const { id } = body;
  if (!id) return { error: '缺少模板 id' };
  const found = await findTemplateById(id);
  if (!found) return { error: 'Template not found.' };
  const next = !found.doc.isRecommended;
  await db.collection('templates').doc(found._id).update({ data: { isRecommended: next } });
  return { success: true, tpl: { ...found.doc, isRecommended: next } };
}

async function templateUpdate(body) {
  const auth = await requireAdmin(body);
  if (auth.error) return auth;
  const { id, name, cover, ageGroup, theme, educationalGoal, scene, mainCharacter, duration, description, aiPrompt } = body;
  if (!id) return { error: 'id is required' };
  const found = await findTemplateById(id);
  if (!found) return { error: 'Template not found.' };
  const patch = {};
  if (name !== undefined) patch.name = name;
  if (cover !== undefined) {
    if (cover === '') {
      try {
        const gen = await getOrGenerateCover({
          id: found.doc.id || id,
          name: name !== undefined ? name : found.doc.name,
          ageGroup: ageGroup !== undefined ? ageGroup : found.doc.ageGroup,
          theme: theme !== undefined ? theme : found.doc.theme,
          educationalGoal: educationalGoal !== undefined ? educationalGoal : found.doc.educationalGoal,
          scene: scene !== undefined ? scene : found.doc.scene,
          mainCharacter: mainCharacter !== undefined ? mainCharacter : found.doc.mainCharacter,
          duration: duration !== undefined ? duration : found.doc.duration,
          description: description !== undefined ? description : found.doc.description,
          aiPrompt: aiPrompt !== undefined ? aiPrompt : found.doc.aiPrompt,
        }, { usedBy: ['template'], force: true });
        patch.cover = gen.coverUrl || FALLBACK_COVER;
      } catch (e) {
        patch.cover = FALLBACK_COVER;
      }
    } else {
      patch.cover = cover;
    }
  }
  if (ageGroup !== undefined) patch.ageGroup = ageGroup;
  if (theme !== undefined) patch.theme = theme;
  if (educationalGoal !== undefined) patch.educationalGoal = educationalGoal;
  if (scene !== undefined) patch.scene = scene;
  if (mainCharacter !== undefined) patch.mainCharacter = mainCharacter;
  if (duration !== undefined) patch.duration = duration;
  if (description !== undefined) patch.description = description;
  if (aiPrompt !== undefined) patch.aiPrompt = aiPrompt;
  await db.collection('templates').doc(found._id).update({ data: patch });
  const templates = await getTemplates();
  return { success: true, templates };
}

async function templateRegenerateCover(body) {
  const auth = await requireAdmin(body);
  if (auth.error) return auth;
  const { id } = body;
  if (!id) return { error: 'id is required' };
  const found = await findTemplateById(id);
  if (!found) return { error: 'Template not found.' };

  const generated = await getOrGenerateCover(found.doc, { usedBy: ['template'], force: true });
  if (!generated.coverUrl) return { error: '封面图生成失败，请检查图片模型配置和云函数日志' };
  const coverUpdatedAt = new Date().toISOString();
  await db.collection('templates').doc(found._id).update({ data: { cover: generated.coverUrl, coverUpdatedAt } });
  return {
    success: true,
    template: { ...found.doc, cover: generated.coverUrl, coverUpdatedAt },
    storageStatus: generated.storageStatus || 'unknown',
  };
}

async function templateGet(body) {
  const auth = await requireAdmin(body);
  if (auth.error) return auth;
  const { id } = body;
  if (!id) return { error: 'id is required' };
  const found = await findTemplateById(id);
  if (!found) return { error: 'Template not found.' };
  const [template] = await resolveTemplateCovers([found.doc]);
  return { success: true, template: template || found.doc };
}

async function safetyConfigUpdate(body) {
  const auth = await requireAdmin(body);
  if (auth.error) return auth;
  const { categories, sensitiveWords } = body;
  const res = await db.collection('sensitiveWordsConfig').limit(1).get();
  if (!res.data || !res.data[0]) return { error: '配置缺失' };
  const doc = res.data[0];
  const patch = {};
  if (Array.isArray(categories)) {
    const normalizedCategories = categories
      .map(item => {
        if (typeof item === 'string') {
          const key = item.trim();
          return key ? { key, name: key, handling: 'intercept' } : null;
        }
        if (!item || typeof item !== 'object') return null;
        const key = typeof item.key === 'string' ? item.key.trim() : '';
        const name = typeof item.name === 'string' ? item.name.trim() : key;
        const handling = item.handling === 'rewrite' ? 'rewrite' : 'intercept';
        return key && name ? { key, name, handling } : null;
      })
      .filter(Boolean)
      .filter((item, index, list) => list.findIndex(candidate => candidate.key === item.key) === index);
    patch.categories = normalizedCategories;
  }
  if (Array.isArray(sensitiveWords)) {
    const categoryKeys = new Set((patch.categories || doc.categories || []).map(item => item.key));
    const fallbackCategory = categoryKeys.values().next().value || 'abuse';
    const normalizedWords = sensitiveWords
      .map(item => {
        if (typeof item === 'string') {
          const word = item.trim();
          return word ? { word, category: fallbackCategory } : null;
        }
        if (!item || typeof item !== 'object') return null;
        const word = typeof item.word === 'string' ? item.word.trim() : '';
        const category = typeof item.category === 'string' && categoryKeys.has(item.category)
          ? item.category
          : fallbackCategory;
        return word ? { word, category } : null;
      })
      .filter(Boolean)
      .filter((item, index, list) => list.findIndex(candidate => candidate.word === item.word) === index);
    patch.sensitiveWords = normalizedWords;
  }
  await db.collection('sensitiveWordsConfig').doc(doc._id).update({ data: patch });
  const cfg = await getSensitiveConfig();
  return { success: true, config: cfg, sensitiveWordsConfig: cfg };
}

async function safetyConfigAuditResolve(body) {
  const auth = await requireAdmin(body);
  if (auth.error) return auth;
  const { id, status } = body; // status: 'approved' | 'overridden'
  const res = await db.collection('sensitiveWordsConfig').limit(1).get();
  if (!res.data || !res.data[0]) return { error: '配置缺失' };
  const doc = res.data[0];
  const logs = doc.auditLogs || [];
  const log = logs.find(l => l.id === id);
  if (!log) return { error: 'Audit record not found.' };
  log.status = status;
  await db.collection('sensitiveWordsConfig').doc(doc._id).update({ data: { auditLogs: logs } });
  return { success: true, auditLogs: logs };
}

async function templatesList(body) {
  const auth = await requireAdmin(body);
  if (auth.error) return auth;
  const templates = await getTemplates();
  return { success: true, list: await resolveTemplateCovers(templates) };
}

async function safetyConfigGet(body) {
  const auth = await requireAdmin(body);
  if (auth.error) return auth;
  const cfg = await getSensitiveConfig();
  return { success: true, config: cfg };
}

// ---------- §10.9 后台分页查询 / 管理 action ----------

// 通用分页列表（管理端，不校验 openid 归属）
async function pagedList(body, collection, { keywordField, keyword, orderField = 'createdAt', orderDir = 'desc', extraWhere = {} } = {}) {
  const auth = await requireAdmin(body);
  if (auth.error) return auth;
  const { page = 1, pageSize = 20 } = body;
  const where = { ...extraWhere };
  if (keyword && keywordField) {
    where[keywordField] = db.RegExp({ regexp: keyword, options: 'i' });
  }
  const countRes = await db.collection(collection).where(where).count().catch(() => ({ total: 0 }));
  const res = await db.collection(collection).where(where)
    .orderBy(orderField, orderDir).skip((page - 1) * pageSize).limit(pageSize).get();
  return { success: true, list: res.data || [], total: countRes.total, page, pageSize };
}

async function usersList(body) {
  // users._id === openid，按 openid/昵称模糊搜
  const auth = await requireAdmin(body);
  if (auth.error) return auth;
  const { page = 1, pageSize = 20, keyword } = body;
  const where = {};
  if (keyword) where._id = db.RegExp({ regexp: keyword, options: 'i' });
  const countRes = await db.collection('users').where(where).count().catch(() => ({ total: 0 }));
  const res = await db.collection('users').where(where)
    .orderBy('createdAt', 'desc').skip((page - 1) * pageSize).limit(pageSize).get();
  return { success: true, list: res.data || [], total: countRes.total, page, pageSize };
}

// 后台按 openid 更新任意用户的宝宝成长档案（合并写入，不覆盖未传字段）
async function usersProfileUpdate(body) {
  const auth = await requireAdmin(body);
  if (auth.error) return auth;
  const { openid, profile } = body;
  if (!openid) return { error: '缺少 openid' };
  const userRes = await db.collection('users').doc(openid).get().catch(() => null);
  if (!userRes || !userRes.data) return { error: '用户不存在' };
  const prev = userRes.data.profile || {};
  const merged = { ...prev, ...(profile || {}) };
  await db.collection('users').doc(openid).update({ data: { profile: merged } });
  return { success: true, profile: merged };
}

// ---------- 故事作者（供小程序选择；后台维护增删改查） ----------
async function authorList(body) {
  const auth = await requireAdmin(body);
  if (auth.error) return auth;
  const list = await getAuthors();
  return { success: true, list };
}
async function authorAdd(body) {
  const auth = await requireAdmin(body);
  if (auth.error) return auth;
  const { name, title, identity, style, bio, enabled, sortOrder } = body;
  if (!name) return { error: '缺少作者名称' };
  const author = await addAuthor({ name, title, identity, style, bio, enabled, sortOrder });
  return { success: true, author };
}
async function authorUpdate(body) {
  const auth = await requireAdmin(body);
  if (auth.error) return auth;
  const { id, name, title, identity, style, bio, enabled, sortOrder } = body;
  if (!id) return { error: '缺少作者 id' };
  const patch = {};
  if (name !== undefined) patch.name = name;
  if (title !== undefined) patch.title = title;
  if (identity !== undefined) patch.identity = identity;
  if (style !== undefined) patch.style = style;
  if (bio !== undefined) patch.bio = bio;
  if (enabled !== undefined) patch.enabled = enabled;
  if (sortOrder !== undefined) patch.sortOrder = Number(sortOrder) || 0;
  const updated = await updateAuthor(id, patch);
  if (!updated) return { error: '作者不存在' };
  return { success: true, author: updated };
}
async function authorDelete(body) {
  const auth = await requireAdmin(body);
  if (auth.error) return auth;
  const { id } = body;
  if (!id) return { error: '缺少作者 id' };
  await deleteAuthor(id);
  return { success: true };
}

async function storiesList(body) {
  const { page = 1, pageSize = 20, keyword } = body;
  return pagedList(body, 'userStories', { keywordField: 'title', keyword, orderField: 'createdAt', orderDir: 'desc' });
}

async function storiesDelete(body) {
  const auth = await requireAdmin(body);
  if (auth.error) return auth;
  const { id } = body;
  if (!id) return { error: '缺少故事 id' };
  await db.collection('userStories').doc(id).remove();
  return { success: true };
}

async function voiceList(body) {
  const { page = 1, pageSize = 20, keyword } = body;
  return pagedList(body, 'voiceClones', { keywordField: 'name', keyword, orderField: 'createdAt', orderDir: 'desc' });
}

async function voiceDelete(body) {
  const auth = await requireAdmin(body);
  if (auth.error) return auth;
  const { id } = body;
  if (!id) return { error: '缺少声纹 id' };
  await db.collection('voiceClones').doc(id).remove();
  return { success: true };
}

async function cdkeysList(body) {
  const auth = await requireAdmin(body);
  if (auth.error) return auth;
  const list = await listCdkeys();
  return { success: true, list };
}

async function notifList(body) {
  const { page = 1, pageSize = 20 } = body;
  return pagedList(body, 'notifications', { orderField: 'createdAt', orderDir: 'desc' });
}

// ---------- 管理员 ----------
async function adminsList(body) {
  const auth = await requireAdmin(body);
  if (auth.error) return auth;
  const list = await listAdmins();
  return { success: true, list };
}
async function adminsDelete(body) {
  const auth = await requireAdmin(body);
  if (auth.error) return auth;
  const { id } = body;
  if (!id) return { error: '缺少管理员 id' };
  await deleteAdmin(id);
  return { success: true };
}
async function adminsUpdate(body) {
  const auth = await requireAdmin(body);
  if (auth.error) return auth;
  const { id, username, password } = body;
  if (!username && !password) return { error: '至少需要 username 或 password' };
  // 优先按 id 定位（前端传 id），否则按 username
  const admin = id ? await db.collection('admins').doc(id).get().catch(() => null) : null;
  const target = admin && admin.data ? admin.data : await getAdmin(username);
  if (!target) return { error: '管理员不存在' };
  const patch = {};
  if (username) patch.username = username.trim();
  if (password) patch.password = storedHash(password);
  await db.collection('admins').doc(target._id).update({ data: patch });
  return { success: true };
}

// ---------- 兑换码 ----------
async function cdkeysGenerate(body) {
  const auth = await requireAdmin(body);
  if (auth.error) return auth;
  const { code, type, value, channel } = body;
  if (!code || !type || !value) return { error: '缺少兑换码、类型或额度' };
  const exists = await getCdkey(code.trim().toUpperCase());
  if (exists) return { error: '兑换码已存在' };
  const card = {
    code: code.trim().toUpperCase(),
    type,
    value: Number(value),
    isUsed: false,
    channel: channel || '后台生成',
    createdAt: new Date().toISOString(),
  };
  await addCdkey(card);
  return { success: true, card };
}
async function cdkeysBatchGenerate(body) {
  const auth = await requireAdmin(body);
  if (auth.error) return auth;
  const { type, value, count = 1, channel, prefix = '' } = body;
  const cards = [];
  for (let i = 0; i < Math.min(Number(count), 100); i++) {
    const suffix = require('crypto').randomBytes(3).toString('hex').toUpperCase();
    const code = (prefix ? prefix + '-' : '') + suffix;
    cards.push({
      code,
      type,
      value: Number(value),
      isUsed: false,
      channel: channel || '后台批量生成',
      createdAt: new Date().toISOString(),
    });
  }
  for (const c of cards) await addCdkey(c);
  return { success: true, cards, count: cards.length };
}
// 清理字段残缺的兑换码（早期 .add() 丢字段遗留，无 code 无法兑换）
async function cdkeysCleanup(body) {
  const auth = await requireAdmin(body);
  if (auth.error) return auth;
  const removed = await cleanupBrokenCdkeys();
  return { success: true, removed };
}
async function cdkeysDelete(body) {
  const auth = await requireAdmin(body);
  if (auth.error) return auth;
  const { code, _id } = body;
  // 支持按 code 或 _id 删除（残缺记录无 code，只能用 _id 定位）
  if (code) {
    const ok = await deleteCdkey(code);
    return { success: true, deleted: ok };
  }
  if (_id) {
    await db.collection('cdkeys').doc(_id).remove();
    return { success: true, deleted: true };
  }
  return { error: '缺少兑换码' };
}

// ---------- 通知维护 ----------
async function notifAdd(body) {
  const auth = await requireAdmin(body);
  if (auth.error) return auth;
  const { title, content, type, status = 'draft' } = body;
  if (!title) return { error: '缺少通知标题' };
  const notif = {
    id: genId('notif'),
    title,
    content: content || '',
    type: type || 'system',
    status,
    isRead: false,
    createdAt: new Date().toISOString(),
  };
  await addNotificationRaw(notif);
  return { success: true, notif };
}
async function notifEdit(body) {
  const auth = await requireAdmin(body);
  if (auth.error) return auth;
  const { id, title, content, type, status } = body;
  if (!id) return { error: '缺少通知 id' };
  const existing = await db.collection('notifications').doc(id).get().catch(() => null);
  if (!existing || !existing.data) return { error: '通知不存在' };
  const patch = {};
  if (title !== undefined) patch.title = title;
  if (content !== undefined) patch.content = content;
  if (type !== undefined) patch.type = type;
  if (status !== undefined) patch.status = status;
  await updateNotification(id, patch);
  return { success: true };
}
async function notifDelete(body) {
  const auth = await requireAdmin(body);
  if (auth.error) return auth;
  const { id } = body;
  if (!id) return { error: '缺少通知 id' };
  await deleteNotificationRaw(id);
  return { success: true };
}
async function notifPublish(body) {
  const auth = await requireAdmin(body);
  if (auth.error) return auth;
  const { id } = body;
  if (!id) return { error: '缺少通知 id' };
  await updateNotification(id, { status: 'published', publishedAt: new Date().toISOString() });
  return { success: true };
}
async function notifRecall(body) {
  const auth = await requireAdmin(body);
  if (auth.error) return auth;
  const { id } = body;
  if (!id) return { error: '缺少通知 id' };
  await updateNotification(id, { status: 'recalled' });
  return { success: true };
}

async function statsDashboard(body) {
  const auth = await requireAdmin(body);
  if (auth.error) return auth;
  const [stats, apiStatsRes, usersCount, storiesCount, voiceCount] = await Promise.all([
    getStats(),
    db.collection('apiStats').orderBy('createdAt', 'desc').limit(20).get().catch(() => ({ data: [] })),
    db.collection('users').count().catch(() => ({ total: 0 })),
    db.collection('userStories').count().catch(() => ({ total: 0 })),
    db.collection('voiceClones').count().catch(() => ({ total: 0 })),
  ]);
  return {
    success: true,
    stats,
    apiStats: (apiStatsRes.data || []),
    counts: {
      users: usersCount.total,
      stories: storiesCount.total,
      voices: voiceCount.total,
    },
  };
}

/* ========== §11. AI 模型配置与监控 ========== */

function maskKey(key) {
  if (!key || key.length <= 8) return key || '';
  return key.slice(0, 6) + '***' + key.slice(-4);
}

async function aiConfigGet(event) {
  const auth = await requireAdmin(event);
  if (auth.error) return auth;
  const apiKey = process.env.STEPFUN_API_KEY || '';
  let configDoc;
  try {
    const res = await db.collection('ai_config').limit(1).get();
    configDoc = (res.data && res.data[0]) || null;
  } catch (e) { configDoc = null; }
  return {
    success: true,
    config: {
      apiKeySet: !!(apiKey && apiKey !== 'MY_STEPFUN_API_KEY'),
      apiKey: maskKey(apiKey),
      model: process.env.STEPFUN_MODEL || 'step-3.7-flash',
      imageModel: (configDoc && configDoc.imageModel) || 'step-image-edit-2',
      ttsModel: (configDoc && configDoc.ttsModel) || 'stepaudio-2.5-tts',
      cloneEnabled: (configDoc && configDoc.cloneEnabled != null) ? configDoc.cloneEnabled : true,
      updatedAt: (configDoc && configDoc.updatedAt) || new Date().toISOString(),
    },
  };
}

async function aiConfigUpdate(event) {
  const auth = await requireAdmin(event);
  if (auth.error) return auth;
  const { apiKey, model, imageModel, ttsModel, cloneEnabled } = event;

  // 更新 ai_config 集合（记录自定义配置）
  const now = new Date().toISOString();
  let patch = { updatedAt: now };
  if (imageModel) patch.imageModel = imageModel;
  if (ttsModel) patch.ttsModel = ttsModel;
  if (cloneEnabled !== undefined) patch.cloneEnabled = cloneEnabled;
  if (model) patch.model = model;

  try {
    // 查找或创建配置文档
    const existing = await db.collection('ai_config').limit(1).get();
    if (existing.data && existing.data[0]) {
      await db.collection('ai_config').doc(existing.data[0]._id).update({ data: patch });
    } else {
      const cfgId = genId('aicfg');
      await db.collection('ai_config').doc(cfgId).set({ data: { _id: cfgId, ...patch } });
    }
  } catch (e) { /* 忽略集合不存在 */ }

  // API Key 通过环境变量更新提示（CloudBase 环境变量需在控制台或 CLI 设置）
  if (apiKey && apiKey.length > 10 && !apiKey.includes('*')) {
    // 注意：CloudBase 云函数运行时无法通过代码修改环境变量
    // 这里仅返回提示，管理员需在 CloudBase 控制台设置 STEPFUN_API_KEY
    return { success: true, message: '模型配置已保存；API Key 请在 CloudBase 控制台环境变量中设置 STEPFUN_API_KEY' };
  }

  return { success: true, message: 'AI 模型配置已更新' };
}

async function aiStats(event) {
  const auth = await requireAdmin(event);
  if (auth.error) return auth;

  // 聚合 apiStats 按 service 分组
  const byService = {};
  let totalRequests = 0;
  try {
    const res = await db.collection('apiStats')
      .where({ createdAt: cloud.database.command.gte(new Date(Date.now() - 30 * 86400000).toISOString()) })
      .get();
    (res.data || []).forEach(row => {
      totalRequests++;
      const svc = row.service || 'unknown';
      if (!byService[svc]) byService[svc] = { count: 0, totalTokens: 0, totalLatency: 0, successCount: 0, failCount: 0 };
      byService[svc].count++;
      byService[svc].totalTokens += row.tokens || 0;
      byService[svc].totalLatency += row.latencyMs || 0;
      if ((row.status >= 200 && row.status < 300) || row.success === true) byService[svc].successCount++;
      else byService[svc].failCount++;
    });
  } catch (e) { /* 集合可能为空 */ }

  return {
    success: true,
    stats: { totalRequests, byService, periodStart: new Date(Date.now() - 30 * 86400000).toISOString() },
  };
}

async function aiLogs(event) {
  const auth = await requireAdmin(event);
  if (auth.error) return auth;
  const page = parseInt(event.page) || 1;
  const pageSize = Math.min(parseInt(event.pageSize) || 15, 50);
  const skip = (page - 1) * pageSize;

  let query = db.collection('apiStats');
  if (event.service) query = query.where({ service: event.service });
  if (event.status === 'success') query = query.where({ success: true });
  if (event.status === 'fail') query = query.where(db.command.or([{ success: false }, { status: db.command.gte(400) }]));

  const [countRes, dataRes] = await Promise.all([
    query.count().catch(() => ({ total: 0 })),
    query.orderBy('createdAt', 'desc').skip(skip).limit(pageSize).get().catch(() => ({ data: [] })),
  ]);

  return {
    success: true,
    logs: dataRes.data || [],
    total: countRes.total,
  };
}

/* ========== §12. 主题配置（单一数据源 storyConfig） ========== */

// 确保 storyConfig 集合存在。CloudBase 在集合不存在时 doc().set() 会报
// -502005 collection not exists，故 set 前先尝试建集合（已存在则忽略）。
async function ensureStoryConfigCollection() {
  try {
    await db.createCollection('storyConfig');
  } catch (e) {
    // 集合已存在或当前环境不允许函数内建集合：忽略，set 时若仍报缺失会暴露
    console.warn('[mp-admin] ensureStoryConfigCollection skip:', e && e.message);
  }
}

// 读取主题配置文档；缺失时返回 exists:false（由前端小程序首次加载时经 mp-story 懒载入完整默认）。
// 注意：必须用 doc('themeConfig').get() 精准定位，不能用 limit(1) —— 历史上曾因临时占位文档
// （_tmp_create）排在前面导致读到空文档、配置「看似存在却全空」。
async function themeConfigGet(body) {
  const auth = await requireAdmin(body);
  if (auth.error) return auth;
  const res = await db.collection('storyConfig').doc('themeConfig').get().catch(() => null);
  // doc(id).get() 在 CloudBase SDK 中返回的是「文档对象本身」(res.data 为对象)，
  // 而非包裹在数组里；这里同时兼容两种形态。
  const doc = res && res.data ? (Array.isArray(res.data) ? res.data[0] : res.data) : null;
  if (!doc) return { success: true, exists: false, categories: [], themes: [], scenes: [] };
  return {
    success: true, exists: true,
    categories: doc.categories || [],
    themes: doc.themes || [],
    scenes: doc.scenes || [],
    version: doc.version || 1,
    updatedAt: doc.updatedAt || null,
  };
}

// 整文档覆盖保存（管理员在后台统一配置；前后端均从该文档读取）。
// 该环境 add() 偶发丢字段，统一用 doc('themeConfig').set() 写入系统 _id 永不丢失。
async function themeConfigSave(body) {
  const auth = await requireAdmin(body);
  if (auth.error) return auth;
  await ensureStoryConfigCollection();
  const { categories, themes, scenes } = body;
  if (!Array.isArray(categories) || !Array.isArray(themes) || !Array.isArray(scenes)) {
    return { error: 'categories / themes / scenes 必须为数组' };
  }
  const clean = (arr, pick) => (arr || []).filter(Boolean).map(pick).filter(Boolean);
  const safeCategories = clean(categories, c => (c && c.key) ? {
    key: String(c.key).slice(0, 40), name: String(c.name || c.key).slice(0, 40), sortOrder: Number(c.sortOrder) || 0,
  } : null);
  const safeThemes = clean(themes, t => (t && t.key) ? {
    key: String(t.key).slice(0, 40), name: String(t.name || t.key).slice(0, 40), category: String(t.category || 'custom').slice(0, 40),
    mood: String(t.mood || '').slice(0, 200), palette: String(t.palette || '').slice(0, 200), arc: String(t.arc || '').slice(0, 200),
    educationalGoals: Array.isArray(t.educationalGoals) ? t.educationalGoals.map(g => String(g).slice(0, 40)).filter(Boolean).slice(0, 20) : [],
    sortOrder: Number(t.sortOrder) || 0, enabled: t.enabled !== false,
  } : null);
  const safeScenes = clean(scenes, s => (s && s.key) ? {
    key: String(s.key).slice(0, 40), setting: String(s.setting || '').slice(0, 200), details: String(s.details || '').slice(0, 200),
    sortOrder: Number(s.sortOrder) || 0, enabled: s.enabled !== false,
  } : null);
  const data = {
    categories: safeCategories, themes: safeThemes, scenes: safeScenes,
    version: (Number(body.version) || 0) + 1, updatedAt: new Date().toISOString(),
  };
  await db.collection('storyConfig').doc('themeConfig').set({ data });
  return { success: true, exists: true, categories: safeCategories, themes: safeThemes, scenes: safeScenes, version: data.version, updatedAt: data.updatedAt };
}

// 最小可用默认（dev 兜底）：仅当文档缺失且尚未被小程序懒载入时写入。
// 生产环境通常由小程序首次加载经 mp-story 写入完整 33 主题默认库，本函数仅作后台独立兜底。
async function themeConfigSeedDefault(body) {
  const auth = await requireAdmin(body);
  if (auth.error) return auth;
  const res = await db.collection('storyConfig').doc('themeConfig').get().catch(() => null);
  const doc = res && res.data ? (Array.isArray(res.data) ? res.data[0] : res.data) : null;
  if (doc && Array.isArray(doc.themes) && doc.themes.length) {
    return { success: true, exists: true, message: '配置已存在，无需初始化', categories: doc.categories || [], themes: doc.themes || [], scenes: doc.scenes || [] };
  }
  await ensureStoryConfigCollection();
  // 注意：DEFAULT_THEME_CONFIG 自带 _id（'themeConfig'），但 doc('themeConfig').set()
  // 会由系统写入 _id，data 内再带 _id 会报「不能更新_id的值」，故解构剔除。
  const { _id, ...seedData } = DEFAULT_THEME_CONFIG;
  const data = {
    ...seedData,
    version: (doc && doc.version ? Number(doc.version) : 0) + 1,
    updatedAt: new Date().toISOString(),
  };
  await db.collection('storyConfig').doc('themeConfig').set({ data });
  return { success: true, exists: true, message: '已写入完整默认主题配置（含 6 大分类与全部归类主题）', categories: data.categories, themes: data.themes, scenes: data.scenes, version: data.version, updatedAt: data.updatedAt };
}

exports.main = async (event, context) => {
  const { action } = event;
  try {
    switch (action) {
      case 'login':
        return await login(event);
      case 'register':
        return await register(event);
      case 'reset':
        return await reset(event);
      case 'simulate-api-call':
        return await simulateApiCall(event);
      case 'template/add':
        return await templateAdd(event);
      case 'template/delete':
        return await templateDelete(event);
      case 'template/toggle-recommend':
        return await templateToggleRecommend(event);
      case 'safety-config/update':
        return await safetyConfigUpdate(event);
      case 'safety-config/audit-resolve':
        return await safetyConfigAuditResolve(event);
      case 'safety-config/get':
        return await safetyConfigGet(event);
      case 'templates/list':
        return await templatesList(event);
      case 'template/get':
        return await templateGet(event);
      case 'template/update':
        return await templateUpdate(event);
      case 'template/regenerate-cover':
        return await templateRegenerateCover(event);
      // §10.9 后台查询 / 管理
      case 'users/list':
        return await usersList(event);
      case 'users/profile-update':
        return await usersProfileUpdate(event);
      case 'stories/list':
        return await storiesList(event);
      case 'stories/delete':
        return await storiesDelete(event);
      case 'voice/list':
        return await voiceList(event);
      case 'voice/delete':
        return await voiceDelete(event);
      case 'cdkeys/list':
        return await cdkeysList(event);
      case 'notif/list':
        return await notifList(event);
      case 'stats/dashboard':
        return await statsDashboard(event);
      // 管理员管理
      case 'admins/list':
        return await adminsList(event);
      case 'admins/delete':
        return await adminsDelete(event);
      case 'admins/update':
        return await adminsUpdate(event);
      // 兑换码管理
      case 'cdkeys/generate':
        return await cdkeysGenerate(event);
      case 'cdkeys/batch-generate':
        return await cdkeysBatchGenerate(event);
      case 'cdkeys/delete':
        return await cdkeysDelete(event);
      case 'cdkeys/cleanup':
        return await cdkeysCleanup(event);
      // 通知维护
      case 'notif/add':
        return await notifAdd(event);
      case 'notif/edit':
        return await notifEdit(event);
      case 'notif/delete':
        return await notifDelete(event);
      case 'notif/publish':
        return await notifPublish(event);
      case 'notif/recall':
        return await notifRecall(event);
      // AI 模型配置与监控
      case 'ai/config/get':
        return await aiConfigGet(event);
      case 'ai/config/update':
        return await aiConfigUpdate(event);
      case 'ai/stats':
        return await aiStats(event);
      case 'ai/logs':
        return await aiLogs(event);
      // 主题配置（单一数据源）
      case 'theme-config/get':
        return await themeConfigGet(event);
      case 'theme-config/save':
        return await themeConfigSave(event);
      case 'theme-config/seed-default':
        return await themeConfigSeedDefault(event);
      // 故事作者体系
      case 'author/list':
        return await authorList(event);
      case 'author/add':
        return await authorAdd(event);
      case 'author/update':
        return await authorUpdate(event);
      case 'author/delete':
        return await authorDelete(event);
      default:
        return { error: 'unknown action: ' + action };
    }
  } catch (err) {
    console.error('[mp-admin] error:', err);
    return { error: err.message || 'server error' };
  }
};
