// 全局种子数据：模板 / 兑换码 / 敏感词配置 / 统计 / 配置 / 管理员
// 供 mp-admin 的 reset 与 scripts/migrate-data.js 初始化云数据库集合使用。
const crypto = require('crypto');
const { STORYBOOK_TEMPLATE_CATALOG } = require('./storybook');

const LEGACY_TEMPLATES = [
  {
    id: "tpl_hedgehog",
    name: "森林深处的小刺猬",
    cover: "https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?w=500&q=80",
    ageGroup: "2-4岁",
    theme: "睡前安抚",
    educationalGoal: "克服怕黑恐惧",
    scene: "静谧森林",
    mainCharacter: { name: "刺刺", role: "怕黑的小刺猬", personality: "善良羞涩但有点怕黑" },
    duration: "short",
    description: "陪伴宝宝入睡的温馨森林童话，看小刺猬如何和月亮做朋友，不再害怕夜晚的降临。",
    isRecommended: true,
    useCount: 184
  },
  {
    id: "tpl_dragon",
    name: "小飞龙的彩虹翅膀",
    cover: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=500&q=80",
    ageGroup: "5-7岁",
    theme: "勇敢与自信",
    educationalGoal: "拥抱独特自我",
    scene: "彩虹山谷",
    mainCharacter: { name: "皮皮", role: "翅膀奇特的小飞龙", personality: "乐观坚强，热爱天空" },
    duration: "medium",
    description: "鼓起勇气飞向蓝天！让孩子学会接受自己的不完美，找到属于自己独特的闪光点。",
    isRecommended: true,
    useCount: 312
  },
  {
    id: "tpl_toys",
    name: "玩具卧室的收纳总动员",
    cover: "https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=500&q=80",
    ageGroup: "2-5岁",
    theme: "习惯养成",
    educationalGoal: "玩具物归原位",
    scene: "孩子的温馨卧室",
    mainCharacter: { name: "闹闹", role: "调皮的小熊玩偶", personality: "好动，喜欢收拾玩具" },
    duration: "short",
    description: "通过有趣的玩具王国魔法，引导孩子在玩耍后主动分类并收拾好自己的玩具伙伴们。",
    isRecommended: true,
    useCount: 425
  },
  {
    id: "tpl_apple",
    name: "分享树上的金苹果",
    cover: "https://images.unsplash.com/photo-1607990283143-e81e7a2c93ab?w=500&q=80",
    ageGroup: "6-9岁",
    theme: "分享与友爱",
    educationalGoal: "体会分享的加倍快乐",
    scene: "神奇苹果庄园",
    mainCharacter: { name: "果果", role: "聪明的小松鼠", personality: "脑子活，但起初不爱分享" },
    duration: "long",
    description: "当整棵树只剩下一颗金苹果时，小松鼠果果发现只有把苹果分给伙伴，苹果才会变得香甜。",
    isRecommended: false,
    useCount: 95
  },
  {
    id: "tpl_stars",
    name: "小小宇航员的星空漫步",
    cover: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=500&q=80",
    ageGroup: "5-8岁",
    theme: "想象力开发",
    educationalGoal: "探索浩瀚宇宙",
    scene: "浩瀚太空港",
    mainCharacter: { name: "晨晨", role: "好奇心强烈的小宇航员", personality: "勇敢求知，喜欢数星星" },
    duration: "medium",
    description: "穿上漂亮的宇航服，和小宇航员晨晨一起，坐上火箭去探索银河系的秘密，认识各种有趣的星球朋友吧！",
    isRecommended: true,
    useCount: 250
  },
  {
    id: "tpl_mermaid",
    name: "深海人鱼小歌唱家的勇气",
    cover: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=500&q=80",
    ageGroup: "4-7岁",
    theme: "勇敢与自信",
    educationalGoal: "克服登台恐惧",
    scene: "蓝色海洋深处",
    mainCharacter: { name: "丽丽", role: "声音甜美的小人鱼", personality: "害羞，但在朋友鼓励下变得勇敢" },
    duration: "short",
    description: "丽丽有一副金嗓子，可她总是害羞不敢在大合唱中唱歌。看看海洋节这天，她是如何找到歌唱勇气的。",
    isRecommended: true,
    useCount: 198
  },
  {
    id: "tpl_dinosaur",
    name: "小恐龙拖拉拉的长高秘诀",
    cover: "https://images.unsplash.com/photo-1569336415962-a4bd9f69cd83?w=500&q=80",
    ageGroup: "3-6岁",
    theme: "习惯养成",
    educationalGoal: "拒绝拖拉磨蹭",
    scene: "神奇魔法城堡",
    mainCharacter: { name: "拉拉", role: "爱磨蹭的小霸王龙", personality: "活泼，但总是‘等一下’" },
    duration: "short",
    description: "小恐龙拉拉做什么都要等一下，直到他错过了最好玩的森林晚会。为了改掉磨蹭，他发明了一个神奇的‘滴答手表’。",
    isRecommended: false,
    useCount: 156
  },
  {
    id: "tpl_bear",
    name: "大熊阿宽的森林分享面包房",
    cover: "https://images.unsplash.com/photo-1498579150354-977475b7ea0b?w=500&q=80",
    ageGroup: "3-5岁",
    theme: "分享与友爱",
    educationalGoal: "体会分享的加倍快乐",
    scene: "静谧森林",
    mainCharacter: { name: "阿宽", role: "厨艺高超的棕熊", personality: "憨厚老实，渴望交朋友" },
    duration: "medium",
    description: "阿宽烤了世界上最香甜的面包，但他起初只舍得自己吃。当他试着把面包分给森林里的小松鼠小兔子后，奇妙的事情发生了！",
    isRecommended: false,
    useCount: 284
  }
];

const DEFAULT_TEMPLATES = [...LEGACY_TEMPLATES, ...STORYBOOK_TEMPLATE_CATALOG];

const DEFAULT_CDKEYS = [
  { code: "STORY88", type: "times", value: 10, isUsed: false, channel: "小红书社群引流", createdAt: "2026-07-19T00:00:00.000Z" },
  { code: "TIMES20", type: "times", value: 20, isUsed: false, channel: "微信私域促活", createdAt: "2026-07-19T00:00:00.000Z" },
  { code: "VIPMONTH", type: "vip", value: 30, isUsed: false, channel: "新品上线激活礼", createdAt: "2026-07-19T00:00:00.000Z" },
  { code: "VIP666", type: "vip", value: 7, isUsed: false, channel: "达人推广合作", createdAt: "2026-07-19T00:00:00.000Z" }
];

const DEFAULT_SENSITIVE_CONFIG = {
  categories: [
    { key: "politics", name: "政治敏感", handling: "intercept" },
    { key: "violence", name: "暴力血腥", handling: "rewrite" },
    { key: "adult", name: "涉黄低俗", handling: "intercept" },
    { key: "abuse", name: "侮辱及不良引导", handling: "rewrite" }
  ],
  sensitiveWords: [
    { word: "暴乱", category: "politics" },
    { word: "政权", category: "politics" },
    { word: "罢工", category: "politics" },
    { word: "杀人", category: "violence" },
    { word: "砍死", category: "violence" },
    { word: "手枪", category: "violence" },
    { word: "自杀", category: "violence" },
    { word: "流血", category: "violence" },
    { word: "打架", category: "violence" },
    { word: "尸体", category: "violence" },
    { word: "毁灭", category: "violence" },
    { word: "裸体", category: "adult" },
    { word: "色情", category: "adult" },
    { word: "黄色", category: "adult" },
    { word: "笨蛋", category: "abuse" },
    { word: "白痴", category: "abuse" },
    { word: "去死", category: "abuse" },
    { word: "垃圾", category: "abuse" },
    { word: "滚开", category: "abuse" }
  ],
  auditLogs: [
    {
      id: "audit_1",
      timestamp: "2026-07-19T01:05:00.000Z",
      type: "input_check",
      originalInput: "让故事里的怪兽砍死小鸟",
      processedInput: "让故事里的怪兽和小鸟进行跳绳比赛",
      actionTaken: "rewrite",
      category: "violence",
      categoryName: "暴力血腥",
      triggeredWord: "砍死",
      status: "pending_review",
      message: "检测到输入『砍死』，属于暴力血腥类别，系统自动进行儿童友好情景改写建议。"
    }
  ]
};

const DEFAULT_STATS = {
  todayNewUsers: 0,
  todayActiveUsers: 0,
  profileCompletedCount: 0,
  voiceClonedCount: 0,
  textStoriesGenerated: 0,
  audioStoriesGenerated: 0,
  storiesPlayedCount: 0,
  storiesSavedCount: 0,
  cdkeysRedeemedCount: 0,
  vipsActivatedCount: 0,
  invitesBoundCount: 0,
  invitesCompletedCount: 0
};

const DEFAULT_CONFIG = {
  themes: ["睡前安抚", "勇敢与自信", "习惯养成", "分享与友爱", "想象力开发"],
  educationalGoals: {},
  scenes: ["静谧森林", "彩虹山谷", "温馨卧室", "孩子的幼儿园", "蓝色海洋深处", "浩瀚太空港", "神奇魔法城堡"]
};

// 管理员密码：sha256(ADMIN_SALT + ":" + password)，绝不存明文。
const ADMIN_SALT = process.env.ADMIN_SALT || "bd_dream_admin_salt_v1";
const ADMIN_DEFAULT_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

function hashPassword(password) {
  return "sha256:" + crypto.createHash("sha256").update(ADMIN_SALT + ":" + password).digest("hex");
}

function getSeedAdmin() {
  return {
    username: "admin",
    password: hashPassword(ADMIN_DEFAULT_PASSWORD),
    createdAt: new Date().toISOString(),
  };
}

module.exports = {
  LEGACY_TEMPLATES,
  DEFAULT_TEMPLATES,
  DEFAULT_CDKEYS,
  DEFAULT_SENSITIVE_CONFIG,
  DEFAULT_STATS,
  DEFAULT_CONFIG,
  ADMIN_SALT,
  hashPassword,
  getSeedAdmin,
};
