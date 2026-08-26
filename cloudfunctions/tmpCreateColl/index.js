const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const COLLECTIONS = [
  'users', 'voiceClones', 'userStories', 'notifications',
  'generationJobs', 'assets', 'quotaLedger', 'invitationRecords',
  'config', 'templates', 'stats', 'sensitiveWordsConfig', 'cdkeys',
  'admins', 'adminSessions', 'apiStats',
];
exports.main = async () => {
  const created = [];
  const existed = [];
  for (const name of COLLECTIONS) {
    try {
      await db.createCollection(name);
      created.push(name);
    } catch (e) {
      // 已存在或无需创建，忽略
      existed.push(name);
    }
  }
  return { success: true, created, existed };
};
