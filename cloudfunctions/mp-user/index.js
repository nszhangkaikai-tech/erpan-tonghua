// 云函数 mp-user：用户维度数据（资料、配置、通知、统计、引导拉取）
const {
  getOpenid, ensureUser, getUserState, updateUser, getUser,
  listStories, listVoices, listNotifications, markAllRead, deleteNotification,
  getConfig, getTemplates, getStats,
  addNotification, recordQuota, incrStats, addAsset, queryAll, getJob, updateJob,
  getAdminSession,
  db, _,
} = require('./common/db');
const { resolveUrls } = require('./common/storage');

function redactCdkeys(list) {
  return (list || []).map(c => ({
    channel: c.channel,
    type: c.type,
    value: c.type === 'vip' ? c.value : undefined,
    isUsed: c.isUsed,
    code: c.isUsed ? c.code : '***' + (c.code || '').slice(-3),
  }));
}

async function getUserData(openid) {
  const userState = await getUserState(openid);
  const [stories, assets, jobs, quota, invites, templates, config, stats] =
    await Promise.all([
      listStories(openid),
      queryAll('assets', { openid }),
      queryAll('generationJobs', { openid }),
      queryAll('quotaLedger', { openid }),
      queryAll('invitationRecords', { referredId: openid }),
      getTemplates(),
      getConfig(),
      getStats(),
    ]);
  const templateCoverMap = await resolveUrls((templates || []).map(t => t.cover));

  // 安全约束（上线硬规则）：普通用户响应严禁携带 admins / adminSessions /
  // sensitiveWordsConfig / apiStats / 兑换码（cdkeys）等管理端数据。
  return {
    profile: userState.user.profile || {},
    voiceClones: userState.voiceClones,
    userStories: stories,
    invitationRecords: invites,
    notifications: userState.notifications,
    rights: userState.rights,
    stats: stats,
    templates: (templates || []).map(t => ({
      id: t.id, name: t.name, cover: templateCoverMap[t.cover] || t.cover, ageGroup: t.ageGroup,
      theme: t.theme, educationalGoal: t.educationalGoal, scene: t.scene,
      duration: t.duration, description: t.description,
      isRecommended: !!t.isRecommended, useCount: t.useCount || 0,
      visualStyle: t.visualStyle, coverPromptSeed: t.coverPromptSeed, contentPromptSeed: t.contentPromptSeed,
    })),
    config: config,
    assets: assets,
    generationJobs: jobs.slice(0, 5),
    quotaLedger: quota.slice(0, 5),
  };
}

// 校验管理员会话（普通用户不得调用 updateConfig 等管理动作）
async function requireAdmin(event) {
  const token = event.adminToken || (event.data && event.data.adminToken);
  if (!token) return { error: '管理员令牌缺失' };
  const session = await getAdminSession(token);
  if (!session) return { error: '管理员令牌无效或已过期' };
  return session;
}

// 可写入的宝宝成长档案字段（含历史字段 + 新增成长信息字段）。
// 采用「合并写入」而非整体替换：仅覆盖 body 中显式传入的字段，未传字段保留原值，
// 既向后兼容旧端（只传 nickname/age...），又支持后台/新端写入更丰富的成长数据。
const PROFILE_FIELDS = [
  'nickname', 'age', 'gender', 'interests', 'parentName', 'bedTime',
  'childName', 'avatarUrl', 'birthday', 'heightCm', 'weightKg',
  'traits', 'favoriteTheme', 'favoriteScene', 'growthNotes',
];

async function updateProfile(openid, body) {
  const user = await ensureUser(openid);
  const prev = user.profile || {};
  const profile = { ...prev };
  PROFILE_FIELDS.forEach((f) => {
    if (body[f] === undefined) return;
    let v = body[f];
    if (f === 'age') v = parseInt(body[f], 10) || prev.age || v;
    if (f === 'heightCm' || f === 'weightKg') v = (body[f] === '' || body[f] == null) ? prev[f] : Number(body[f]);
    profile[f] = v;
  });
  await updateUser(openid, { profile });
  await incrStats('profileCompletedCount', 1);
  const nickname = profile.nickname || prev.nickname || '宝贝';
  await addNotification(openid, {
    id: 'notif_' + Date.now(),
    title: '孩子成长画像已更新',
    content: `已成功保存『${nickname}』的成长档案。我们将为您定制更贴合的成长故事。`,
    type: 'system',
    isRead: false,
    createdAt: new Date().toISOString(),
  });
  const ns = await listNotifications(openid);
  return { success: true, profile, notifications: ns };
}

async function updateConfig(openid, body) {
  // 硬规则：全局配置变更必须管理员会话鉴权，普通小程序用户调用必须失败。
  const auth = await requireAdmin(body);
  if (auth.error) return auth;
  const config = (await getConfig()) || {
    themes: ['睡前安抚', '勇敢与自信', '习惯养成', '分享与友爱', '想象力开发'],
    educationalGoals: {},
    scenes: ['静谧森林', '彩虹山谷', '温馨卧室', '孩子的幼儿园', '蓝色海洋深处', '浩瀚太空港', '神奇魔法城堡'],
  };
  if (Array.isArray(body.themes)) config.themes = body.themes;
  if (body.educationalGoals && typeof body.educationalGoals === 'object') config.educationalGoals = body.educationalGoals;
  if (Array.isArray(body.scenes)) config.scenes = body.scenes;
  const res = await db.collection('config').limit(1).get();
  if (res.data && res.data[0]) {
    await db.collection('config').doc(res.data[0]._id).update({ data: config });
  } else {
    await db.collection('config').doc('config_main').set({ data: { _id: 'config_main', ...config } });
  }
  return { success: true, config };
}

async function statsPlay(openid, body) {
  await incrStats('storiesPlayedCount', 1);
  return { success: true };
}

exports.main = async (event, context) => {
  const openid = getOpenid(context);
  if (!openid) return { error: '身份缺失' };
  const { action } = event;
  try {
    switch (action) {
      case 'login': {
        // 云开发下身份由 wx-server-sdk 自动注入，无需 code2Session / token。
        // 仅确保用户记录存在并返回 openid（前端存储用）。
        const user = await ensureUser(openid, event.nickname || event.avatar ? (event.nickname || '小宝贝家长') : undefined);
        return { success: true, token: 'cloud', openid, user };
      }
      case 'getUserData': {
        const data = await getUserData(openid);
        return { success: true, ...data };
      }
      case 'updateProfile':
        return await updateProfile(openid, event);
      case 'updateConfig':
        return await updateConfig(openid, event);
      case 'notifReadAll':
        await markAllRead(openid);
        return { success: true, notifications: await listNotifications(openid) };
      case 'notifDelete': {
        const ok = await deleteNotification(openid, event.id);
        return { success: ok, notifications: await listNotifications(openid) };
      }
      case 'statsPlay':
        return await statsPlay(openid, event);
      default:
        return { error: 'unknown action: ' + action };
    }
  } catch (err) {
    console.error('[mp-user] error:', err);
    return { error: err.message || 'server error' };
  }
};
