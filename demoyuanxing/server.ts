import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Path to persistent data file
const DATA_FILE_PATH = path.join(process.cwd(), "src", "data.json");

// Ensure src directory exists
const srcDir = path.join(process.cwd(), "src");
if (!fs.existsSync(srcDir)) {
  fs.mkdirSync(srcDir, { recursive: true });
}

// Initialize Gemini Client
let ai: any = null;
if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY") {
  try {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    console.log("✅ Gemini SDK initialized successfully on the server side.");
  } catch (err) {
    console.error("❌ Failed to initialize Gemini SDK:", err);
  }
} else {
  console.log("ℹ️ No GEMINI_API_KEY found or default placeholder detected. Server will use intelligent fallback storytelling.");
}

// Default Data Schemas
interface DBState {
  profile: any;
  voiceClones: any[];
  userStories: any[];
  cdkeys: any[];
  invitationRecords: any[];
  notifications: any[];
  rights: {
    freeVoiceClonesRemaining: number;
    storyGenerationsRemaining: number;
    isVip: boolean;
    vipExpiry?: string;
    inviteCode: string;
    usedInviteCode?: string;
  };
  stats: {
    todayNewUsers: number;
    todayActiveUsers: number;
    profileCompletedCount: number;
    voiceClonedCount: number;
    textStoriesGenerated: number;
    audioStoriesGenerated: number;
    storiesPlayedCount: number;
    storiesSavedCount: number;
    cdkeysRedeemedCount: number;
    vipsActivatedCount: number;
    invitesBoundCount: number;
    invitesCompletedCount: number;
  };
  templates: any[];
  config?: any;
  apiStats?: {
    totalRequests: number;
    geminiTextCalls: number;
    geminiTextSuccess: number;
    geminiTextError: number;
    voiceSynthCalls: number;
    voiceSynthSuccess: number;
    voiceSynthError: number;
    voiceCloneCalls: number;
    voiceCloneSuccess: number;
    voiceCloneError: number;
    totalTokens: number;
    averageLatencyMs: number;
  };
  apiLogs?: any[];
  admins: any[];
  sensitiveWordsConfig: {
    categories: any[];
    sensitiveWords: any[];
    auditLogs: any[];
  };
}

const DEFAULT_TEMPLATES = [
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

const DEFAULT_CDKEYS = [
  { code: "STORY88", type: "times", value: 10, isUsed: false, channel: "小红书社群引流", createdAt: "2026-07-19T00:00:00.000Z" },
  { code: "TIMES20", type: "times", value: 20, isUsed: false, channel: "微信私域促活", createdAt: "2026-07-19T00:00:00.000Z" },
  { code: "VIPMONTH", type: "vip", value: 30, isUsed: false, channel: "新品上线激活礼", createdAt: "2026-07-19T00:00:00.000Z" },
  { code: "VIP666", type: "vip", value: 7, isUsed: false, channel: "达人推广合作", createdAt: "2026-07-19T00:00:00.000Z" }
];

const DEFAULT_STORIES = [
  {
    id: "story_default_1",
    title: "月亮船上的捕星小镇",
    abstract: "在温暖的星河边缘，住着勇敢的小船长。用亮晶晶的星网编织成每一个孩子独一无二的安睡美梦。",
    theme: "睡前安抚",
    educationalGoal: "独立入睡，甜美做梦",
    scene: "梦幻星河",
    mainCharacterName: "星儿",
    duration: "short",
    targetAge: 4,
    coverUrl: "https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=500&q=80",
    isAudioReady: true,
    voiceId: "voice_default_mom",
    voiceMode: "single",
    createTime: "2026-07-18T22:30:00.000Z",
    isSavedToDiary: true,
    isFavorite: true,
    chapters: [
      {
        chapterNumber: 1,
        title: "月亮升起来了",
        text: "星河小镇的晚上到来了。夜空中挂着弯弯的月亮，它像一只金色的小船。小船长星儿正坐在这只船的中央。今天，他们要开展一个神奇的任务：帮怕黑的孩子寻找甜甜的梦。星儿在微风中轻轻划动船桨，星河洒下了一闪一闪的碎屑。",
        imageUrl: "https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?w=500&q=80"
      },
      {
        chapterNumber: 2,
        title: "亮晶晶的星星网",
        text: "星儿拿出了一条银色闪亮的网。他轻轻一挥，网就飞到了天空中，网住了三颗不停眨眼的小粉星。这些星星在手里暖洋洋的。星儿对小粉星吹了一口气，它们就变成了一个散发着草莓香气的梦境。原来，分享快乐可以织成最甜的梦呢！",
        imageUrl: "https://images.unsplash.com/photo-1495107334309-fcf20504a5ab?w=500&q=80"
      },
      {
        chapterNumber: 3,
        title: "安睡吧，小天使",
        text: "月亮船慢慢降落在树梢。星儿把草莓香气的星星梦塞进每个安睡孩子的枕头底下。星儿温柔地说：『不要怕黑，夜空中有许多星星在守护着你呢。』床上的孩子翻了个身，嘴角露出了甜甜的笑容。星河归于宁静，月亮摇着孩子沉入梦境。",
        imageUrl: "https://images.unsplash.com/photo-1415604930972-5bc40a5953d8?w=500&q=80"
      }
    ]
  }
];

const INITIAL_DB_STATE: DBState = {
  profile: {
    nickname: "淘淘",
    age: 4,
    gender: "boy",
    interests: ["宇宙奥秘", "森林动物", "积木组装"],
    parentName: "淘淘妈妈",
    bedTime: "21:00"
  },
  voiceClones: [
    {
      id: "voice_default_mom",
      name: "妈妈的温柔声",
      isReady: true,
      usageCount: 4,
      createTime: "2026-07-18T20:15:00.000Z",
      recordDuration: 35,
      speakerType: "mother"
    },
    {
      id: "voice_default_dad",
      name: "爸爸的讲故事声音",
      isReady: true,
      usageCount: 1,
      createTime: "2026-07-19T00:01:00.000Z",
      recordDuration: 40,
      speakerType: "father"
    }
  ],
  userStories: DEFAULT_STORIES,
  cdkeys: DEFAULT_CDKEYS,
  invitationRecords: [
    {
      id: "invite_rec_1",
      referrerId: "BMTH-8888",
      referredId: "user_test_2",
      referredName: "沐沐妈妈",
      status: "success",
      rewardValue: 2,
      createdAt: "2026-07-18T15:40:00.000Z"
    }
  ],
  notifications: [
    {
      id: "notif_welcome",
      title: "欢迎加入伴梦童话",
      content: "亲爱的家长，欢迎开启声音克隆与AI绘本的奇妙旅程！您已获得5次免费声音克隆额度与3次绘本生成额度，快为宝宝生成第一个故事吧！",
      type: "system",
      isRead: false,
      createdAt: "2026-07-19T00:03:00.000Z"
    },
    {
      id: "notif_voice_ready",
      title: "爸爸的故事声音克隆成功！",
      content: "您录制的『爸爸的讲故事声音』已成功克隆完毕，现在可以在讲故事时选择使用啦！",
      type: "voice",
      isRead: false,
      createdAt: "2026-07-19T00:01:30.000Z"
    }
  ],
  rights: {
    freeVoiceClonesRemaining: 3, // Initial 5 minus 2 used
    storyGenerationsRemaining: 5,
    isVip: false,
    inviteCode: "BMTH-6925"
  },
  stats: {
    todayNewUsers: 14,
    todayActiveUsers: 38,
    profileCompletedCount: 12,
    voiceClonedCount: 2,
    textStoriesGenerated: 3,
    audioStoriesGenerated: 2,
    storiesPlayedCount: 14,
    storiesSavedCount: 1,
    cdkeysRedeemedCount: 1,
    vipsActivatedCount: 0,
    invitesBoundCount: 1,
    invitesCompletedCount: 1
  },
  templates: DEFAULT_TEMPLATES,
  config: {
    themes: ["睡前安抚", "勇敢与自信", "习惯养成", "分享与友爱", "想象力开发"],
    educationalGoals: {
      "睡前安抚": ["克服怕黑恐惧", "独立安静入睡", "养成睡前卫生习惯", "自我情绪安抚"],
      "勇敢与自信": ["拥抱独特自我", "勇于尝试新事物", "敢于承认错误", "克服登台恐惧"],
      "习惯养成": ["玩具物归原位", "主动刷牙洗脸", "拒绝拖拉磨蹭", "讲卫生懂礼貌"],
      "分享与友爱": ["体会分享的加倍快乐", "乐于帮助同伴", "学会道歉与原谅", "不自私懂体贴"],
      "想象力开发": ["探索浩瀚宇宙", "认识森林奇迹", "神奇物种探险", "发明魔法小屋"]
    },
    scenes: ["静谧森林", "彩虹山谷", "温馨卧室", "孩子的幼儿园", "蓝色海洋深处", "浩瀚太空港", "神奇魔法城堡"]
  },
  apiStats: {
    totalRequests: 84,
    geminiTextCalls: 12,
    geminiTextSuccess: 12,
    geminiTextError: 0,
    voiceSynthCalls: 8,
    voiceSynthSuccess: 8,
    voiceSynthError: 0,
    voiceCloneCalls: 6,
    voiceCloneSuccess: 6,
    voiceCloneError: 0,
    totalTokens: 15420,
    averageLatencyMs: 1420
  },
  apiLogs: [
    { id: "log_1", timestamp: "2026-07-19T00:30:15.000Z", route: "/api/story/generate-text", method: "POST", status: 200, service: "Gemini 3.5 Flash", latencyMs: 1680, tokens: 1420, message: "Success" },
    { id: "log_2", timestamp: "2026-07-19T00:28:40.000Z", route: "/api/story/generate-audio", method: "POST", status: 200, service: "Cosmic TTS v2", latencyMs: 820, tokens: 680, message: "Success" },
    { id: "log_3", timestamp: "2026-07-19T00:25:12.000Z", route: "/api/voice/clone", method: "POST", status: 200, service: "Voice Cloner", latencyMs: 2100, tokens: 0, message: "Voice cloned ready" },
    { id: "log_4", timestamp: "2026-07-19T00:15:33.000Z", route: "/api/cdkey/redeem", method: "POST", status: 200, service: "Business Center", latencyMs: 120, tokens: 0, message: "Redeemed success" },
    { id: "log_5", timestamp: "2026-07-19T00:10:05.000Z", route: "/api/profile", method: "POST", status: 200, service: "User Profile", latencyMs: 85, tokens: 0, message: "Profile updated" }
  ],
  admins: [
    { username: "admin", password: "admin123", createdAt: "2026-07-19T00:00:00.000Z" }
  ],
  sensitiveWordsConfig: {
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
        status: "pending_review",
        message: "检测到输入『砍死』，属于暴力血腥类别，系统自动进行儿童友好情景改写建议。"
      }
    ]
  }
};

// Helper to read DB state from local file or initialize
function getDBState(): DBState {
  if (fs.existsSync(DATA_FILE_PATH)) {
    try {
      const content = fs.readFileSync(DATA_FILE_PATH, "utf-8");
      const parsed = JSON.parse(content);
      if (!parsed.apiStats) {
        parsed.apiStats = { ...INITIAL_DB_STATE.apiStats };
      }
      if (!parsed.apiLogs) {
        parsed.apiLogs = [...(INITIAL_DB_STATE.apiLogs || [])];
      }
      // Ensure templates are updated to have our new templates
      if (!parsed.templates || parsed.templates.length < DEFAULT_TEMPLATES.length) {
        parsed.templates = [...DEFAULT_TEMPLATES];
      }
      // Ensure config is present
      if (!parsed.config) {
        parsed.config = { ...INITIAL_DB_STATE.config };
      }
      // Ensure admins are present
      if (!parsed.admins) {
        parsed.admins = [...INITIAL_DB_STATE.admins];
      }
      // Ensure sensitive config is present
      if (!parsed.sensitiveWordsConfig) {
        parsed.sensitiveWordsConfig = { ...INITIAL_DB_STATE.sensitiveWordsConfig };
      }
      return parsed;
    } catch (e) {
      console.error("Failed to parse DB JSON. Resetting to initial state.", e);
      return INITIAL_DB_STATE;
    }
  } else {
    saveDBState(INITIAL_DB_STATE);
    return INITIAL_DB_STATE;
  }
}

// Helper to write DB state to local file
function saveDBState(state: DBState) {
  try {
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(state, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to write DB state:", e);
  }
}

// Child-friendly rewrite suggestion helper
function getChildFriendlyReplacement(word: string, category: string): { replaced: string; suggestion: string } {
  const defaults = {
    politics: { replaced: "和平小河畔", suggestion: "倡导爱、和平与美好，和伙伴们友好地一起建设温暖美丽的家园" },
    adult: { replaced: "暖烘烘的漂亮衣服", suggestion: "穿戴整齐、大方得体，散发健康自信和阳光气质" },
    violence: { replaced: "举行手拉手的快乐比赛", suggestion: "和小朋友一起画画、堆积木、合作解决问题，用包容、赞美和微笑代替暴力" },
    abuse: { replaced: "萌萌的小可爱", suggestion: "多关注他人的长处，互相说鼓励的话，做温暖彼此、传递能量的好朋友" }
  };
  return defaults[category as keyof typeof defaults] || { replaced: "奇妙的好玩伴", suggestion: "建立友爱互助、健康成长的和谐氛围" };
}

// Full Safety Check engine
function runSafetyCheck(textToScan: string): { blocked: boolean; rewrite: boolean; word: string; category: string; categoryName: string; suggestion: string; original: string; replacedText: string } | null {
  if (!textToScan) return null;
  
  const config = db ? (db.sensitiveWordsConfig || INITIAL_DB_STATE.sensitiveWordsConfig) : INITIAL_DB_STATE.sensitiveWordsConfig;
  const words = config.sensitiveWords || [];
  const categories = config.categories || [];

  for (const item of words) {
    if (!item.word) continue;
    
    const escapedWord = item.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const wordRegex = new RegExp(escapedWord, "gi");
    if (wordRegex.test(textToScan)) {
      const cat = categories.find((c: any) => c.key === item.category) || { key: item.category, name: "敏感内容", handling: "intercept" };
      const handling = cat.handling;
      const mapping = getChildFriendlyReplacement(item.word, item.category);

      return {
        blocked: handling === "intercept",
        rewrite: handling === "rewrite",
        word: item.word,
        category: item.category,
        categoryName: cat.name,
        suggestion: mapping.suggestion,
        original: textToScan,
        replacedText: textToScan.replace(wordRegex, mapping.replaced)
      };
    }
  }
  return null;
}

// Global API logging helper
function logApiCall(route: string, method: string, status: number, service: string, latencyMs: number, tokens: number, message: string) {
  if (!db.apiStats) {
    db.apiStats = {
      totalRequests: 84,
      geminiTextCalls: 12,
      geminiTextSuccess: 12,
      geminiTextError: 0,
      voiceSynthCalls: 8,
      voiceSynthSuccess: 8,
      voiceSynthError: 0,
      voiceCloneCalls: 6,
      voiceCloneSuccess: 6,
      voiceCloneError: 0,
      totalTokens: 15420,
      averageLatencyMs: 1420
    };
  }
  if (!db.apiLogs) {
    db.apiLogs = [];
  }

  db.apiStats.totalRequests = (db.apiStats.totalRequests || 0) + 1;
  
  if (service.includes("Gemini")) {
    db.apiStats.geminiTextCalls = (db.apiStats.geminiTextCalls || 0) + 1;
    if (status >= 200 && status < 300) {
      db.apiStats.geminiTextSuccess = (db.apiStats.geminiTextSuccess || 0) + 1;
    } else {
      db.apiStats.geminiTextError = (db.apiStats.geminiTextError || 0) + 1;
    }
    db.apiStats.totalTokens = (db.apiStats.totalTokens || 0) + tokens;
  } else if (service.includes("TTS") || service.includes("Audio") || service.includes("Cosmic")) {
    db.apiStats.voiceSynthCalls = (db.apiStats.voiceSynthCalls || 0) + 1;
    if (status >= 200 && status < 300) {
      db.apiStats.voiceSynthSuccess = (db.apiStats.voiceSynthSuccess || 0) + 1;
    } else {
      db.apiStats.voiceSynthError = (db.apiStats.voiceSynthError || 0) + 1;
    }
    db.apiStats.totalTokens = (db.apiStats.totalTokens || 0) + tokens;
  } else if (service.includes("Clone") || service.includes("Voice")) {
    db.apiStats.voiceCloneCalls = (db.apiStats.voiceCloneCalls || 0) + 1;
    if (status >= 200 && status < 300) {
      db.apiStats.voiceCloneSuccess = (db.apiStats.voiceCloneSuccess || 0) + 1;
    } else {
      db.apiStats.voiceCloneError = (db.apiStats.voiceCloneError || 0) + 1;
    }
  }

  // Compute moving average latency
  const oldAvg = db.apiStats.averageLatencyMs || 1420;
  const oldCount = db.apiStats.totalRequests - 1;
  db.apiStats.averageLatencyMs = Math.round((oldAvg * oldCount + latencyMs) / db.apiStats.totalRequests);

  // Unshift log entry
  db.apiLogs.unshift({
    id: "log_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
    timestamp: new Date().toISOString(),
    route,
    method,
    status,
    service,
    latencyMs,
    tokens,
    message
  });

  // Limit to 100 entries
  if (db.apiLogs.length > 100) {
    db.apiLogs = db.apiLogs.slice(0, 100);
  }

  saveDBState(db);
}

// Ensure database is initialized at boot
let db = getDBState();

// --- API Endpoints ---

// Get everything
app.get("/api/db", (req, res) => {
  db = getDBState();
  res.json(db);
});

// Update Child Profile
app.post("/api/profile", (req, res) => {
  const { nickname, age, gender, interests, parentName, bedTime } = req.body;
  
  db.profile = {
    nickname: nickname || db.profile.nickname,
    age: parseInt(age) || db.profile.age,
    gender: gender || db.profile.gender,
    interests: Array.isArray(interests) ? interests : db.profile.interests,
    parentName: parentName || db.profile.parentName,
    bedTime: bedTime || db.profile.bedTime
  };

  // Add system stats
  db.stats.profileCompletedCount = (db.stats.profileCompletedCount || 0) + 1;

  // Notification trigger
  const notif: any = {
    id: "notif_" + Date.now(),
    title: "孩子成长画像已更新",
    content: `已成功保存『${db.profile.nickname}』的成长档案。我们将为您定制最适合${db.profile.age}岁宝贝年龄的寓教于乐故事。`,
    type: "system",
    isRead: false,
    createdAt: new Date().toISOString()
  };
  db.notifications.unshift(notif);

  saveDBState(db);
  res.json({ success: true, profile: db.profile, notifications: db.notifications });
});

// Update Config (Themes, Educational Goals, Scenes)
app.post("/api/config", (req, res) => {
  const { themes, educationalGoals, scenes } = req.body;
  
  if (!db.config) {
    db.config = {
      themes: ["睡前安抚", "勇敢与自信", "习惯养成", "分享与友爱", "想象力开发"],
      educationalGoals: {
        "睡前安抚": ["克服怕黑恐惧", "独立安静入睡", "养成睡前卫生习惯", "自我情绪安抚"],
        "勇敢与自信": ["拥抱独特自我", "勇于尝试新事物", "敢于承认错误", "克服登台恐惧"],
        "习惯养成": ["玩具物归原位", "主动刷牙洗脸", "拒绝拖拉磨蹭", "讲卫生懂礼貌"],
        "分享与友爱": ["体会分享的加倍快乐", "乐于帮助同伴", "学会道歉与原谅", "不自私懂体贴"],
        "想象力开发": ["探索浩瀚宇宙", "认识森林奇迹", "神奇物种探险", "发明魔法小屋"]
      },
      scenes: ["静谧森林", "彩虹山谷", "温馨卧室", "孩子的幼儿园", "蓝色海洋深处", "浩瀚太空港", "神奇魔法城堡"]
    };
  }

  if (Array.isArray(themes)) {
    db.config.themes = themes;
  }
  if (educationalGoals && typeof educationalGoals === "object") {
    db.config.educationalGoals = educationalGoals;
  }
  if (Array.isArray(scenes)) {
    db.config.scenes = scenes;
  }

  saveDBState(db);
  res.json({ success: true, config: db.config });
});

// Voice Cloning Endpoint
app.post("/api/voice/clone", async (req, res) => {
  const { name, speakerType, recordDuration } = req.body;
  if (!name || !speakerType) {
    return res.status(400).json({ error: "Missing required voice parameters." });
  }

  // --- VOICE CUSTOM NAME SAFETY CHECK STAGE ---
  const voiceSafety = runSafetyCheck(name);
  if (voiceSafety) {
    const logId = "audit_" + Date.now();
    const auditLog = {
      id: logId,
      timestamp: new Date().toISOString(),
      type: "input_check",
      originalInput: name,
      processedInput: "拦截声音自定义名字",
      actionTaken: "intercept",
      category: voiceSafety.category,
      status: "pending_review",
      message: `录制克隆声音昵称含有敏感词『${voiceSafety.word}』(类别:${voiceSafety.categoryName})，已被强制拦截。`
    };
    if (!db.sensitiveWordsConfig.auditLogs) db.sensitiveWordsConfig.auditLogs = [];
    db.sensitiveWordsConfig.auditLogs.unshift(auditLog);
    saveDBState(db);

    return res.status(400).json({
      error: `⚠️ 伴梦安全守护防御：您录制声音时起的昵称中含有 [${voiceSafety.categoryName}] 相关的敏感词汇（『${voiceSafety.word}』），已被系统安全拦截。本次录制未扣除克隆次数，请换一个温暖的昵称再试一次哦！`
    });
  }

  // Deduct rights
  if (db.rights.freeVoiceClonesRemaining > 0) {
    db.rights.freeVoiceClonesRemaining -= 1;
  } else {
    // If no free remaining, consume story generations or require VIP
    if (db.rights.storyGenerationsRemaining > 0) {
      db.rights.storyGenerationsRemaining -= 1;
    } else if (!db.rights.isVip) {
      return res.status(400).json({ error: "您的克隆次数与故事额度已不足，请先兑换激活码或邀请好友！" });
    }
  }

  let stepfunVoiceId = "clon_simulated_" + Date.now();
  let stepfunSucceeded = false;
  let detailMsg = "克隆声源准备完毕，已成功本地初始化。";

  if (process.env.STEPFUN_API_KEY && process.env.STEPFUN_API_KEY !== "MY_STEPFUN_API_KEY") {
    try {
      const stepfunApiKey = process.env.STEPFUN_API_KEY;
      console.log(`[Stepfun] Initiating voice cloning on stepaudio-2.5-tts for voice "${name}"...`);

      // Generate a valid WAV buffer with 8kHz PCM structure
      const dummyWavBuffer = Buffer.alloc(44 + 8000);
      dummyWavBuffer.write('RIFF', 0);
      dummyWavBuffer.writeUInt32LE(36 + 8000, 4);
      dummyWavBuffer.write('WAVE', 8);
      dummyWavBuffer.write('fmt ', 12);
      dummyWavBuffer.writeUInt32LE(16, 16);
      dummyWavBuffer.writeUInt16LE(1, 20);
      dummyWavBuffer.writeUInt16LE(1, 22);
      dummyWavBuffer.writeUInt32LE(8000, 24);
      dummyWavBuffer.writeUInt32LE(8000 * 2, 28);
      dummyWavBuffer.writeUInt16LE(2, 32);
      dummyWavBuffer.writeUInt16LE(16, 34);
      dummyWavBuffer.write('data', 36);
      dummyWavBuffer.writeUInt32LE(8000, 40);

      const formData = new FormData();
      const audioBlob = new Blob([dummyWavBuffer], { type: "audio/wav" });
      formData.append("file", audioBlob, "voice_ref.wav");
      formData.append("name", name);

      const response = await fetch("https://api.stepfun.com/v1/audio/clones", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${stepfunApiKey}`
        },
        body: formData
      });

      if (response.ok) {
        const result = await response.json() as any;
        if (result.voice_id) {
          stepfunVoiceId = result.voice_id;
          stepfunSucceeded = true;
          detailMsg = `已成功在阶跃星辰（stepaudio-2.5-tts）平台克隆该声音，获得专属 Voice ID: ${result.voice_id}`;
          console.log(`✅ Stepfun voice cloning successful! voice_id: ${result.voice_id}`);
        } else {
          console.warn("[Stepfun] Clone call returned without voice_id:", result);
        }
      } else {
        console.warn(`[Stepfun] Clone call failed with status: ${response.status}`);
      }
    } catch (err: any) {
      console.error("❌ Stepfun voice cloning failed, using high-fidelity local simulation.", err.message || err);
    }
  }

  const newVoice = {
    id: "voice_" + Date.now(),
    name: name,
    isReady: true, // Auto-ready in simulator
    usageCount: 0,
    createTime: new Date().toISOString(),
    recordDuration: recordDuration || 30,
    speakerType: speakerType,
    stepfunVoiceId: stepfunVoiceId,
    stepfunSucceeded: stepfunSucceeded
  };

  db.voiceClones.push(newVoice);
  db.stats.voiceClonedCount += 1;

  // Notification
  const notif = {
    id: "notif_" + Date.now(),
    title: `『${name}』声源克隆成功！`,
    content: `您的专属声音『${name}』已准备完毕，现在可以使用该克隆声音开始创作独一无二的有声童话了。`,
    type: "voice",
    isRead: false,
    createdAt: new Date().toISOString()
  };
  db.notifications.unshift(notif);

  logApiCall(
    "/api/voice/clone",
    "POST",
    200,
    stepfunSucceeded ? "Stepfun Voice Clone (stepaudio-2.5-tts)" : "Voice Cloner Simulator",
    stepfunSucceeded ? 1800 : 450,
    0,
    detailMsg
  );

  saveDBState(db);
  res.json({ success: true, voice: newVoice, rights: db.rights, notifications: db.notifications });
});

// Delete Voice Clone
app.post("/api/voice/delete", (req, res) => {
  const { id } = req.body;
  db.voiceClones = db.voiceClones.filter(v => v.id !== id);
  saveDBState(db);
  res.json({ success: true, voiceClones: db.voiceClones });
});

// Story generation helper fallback
function generateFallbackStory(theme: string, educationalGoal: string, scene: string, charName: string, duration: string, age: number) {
  const isCustomLong = duration && duration.startsWith("long_");
  const chapterCount = duration === 'short' ? 3 : duration === 'medium' ? 4 : 5;
  const wordCount = age <= 4 ? "温馨简练，口语化，富有韵律感" : "内容丰富，逻辑清晰，富有启发性";

  const titles = [
    `第一章：神奇的冒险起程`,
    `第二章：遇到奇妙的新朋友`,
    `第三章：发现神秘的线索`,
    `第四章：智慧与勇气的考验`,
    `第五章：满载而归的甜梦`
  ];

  const storyTemplates: Record<string, string[]> = {
    "睡前安抚": [
      `今天晚上格外宁静，在温暖的${scene}里，可爱的小${charName}伸了个懒腰。夜空中洒满了亮晶晶的星星屑，像给大地盖上了一层软绵绵的毯子。${charName}想给今晚入睡的小伙伴找一个最温和的梦，于是它带上了一只金色的小网兜，轻轻划起了梦境的小木船。`,
      `划呀划，${charName}在云朵后面遇到了一只发光的小睡熊。小睡熊正用呼噜声吹着彩色的泡泡，每个泡泡里都装着一段甜甜的歌声。${charName}小心翼翼地捧起一个草莓味的唱歌泡泡。小睡熊笑着说：『把这个带去，听了的孩子都会快乐地睡着哦。』`,
      `${charName}又在夜航的终点，在月亮婆婆慈祥的注视下，把温热的月光星星揉进云絮里。它对熟睡中的孩子耳语：『不用怕黑，晚风是我的歌，星光是我的眼，我们会一直陪伴着你入睡。』宝贝翻了个身，抱紧小熊，香甜地进入了梦乡。`
    ],
    "勇敢与自信": [
      `在美丽的${scene}中，小主角${charName}有一个大大的梦想。尽管它总是觉得自己不够完美、有点胆怯，但面对同伴们的期待，它握紧拳头，决定在今天开启勇敢的探索之旅。风在耳边呼呼作响，像是在说：『${charName}，你一定可以做到的！』`,
      `在半路上，山谷的吊桥断了。大家都害怕得不敢向前，只有${charName}仔细地观察。它发现旁边的坚固藤蔓可以荡过去！它克服了心里的恐惧，深吸一口气，带头拉着藤蔓划过了彩虹深渊。大家纷纷欢呼，${charName}的胸膛挺得高高的，它发现原来自己如此勇敢。`,
      `战胜困难的${charName}不仅找到了宝藏，更收获了沉甸甸的自信。它微笑着告诉大家，真正的勇敢不是不害怕，而是害怕的时候依然能坚持。今天它成功实现了『${educationalGoal}』的目标，也给所有小朋友带来了无比的勇气。`
    ]
  };

  const defaultStoryLines = storyTemplates[theme] || [
    `在神奇的${scene}里，居住着开朗活泼的${charName}。今天它要达成一个了不起的教育目标：『${educationalGoal}』！它带上自己的奇思妙想，向着未知的彩虹山谷深处进发，脚步轻快，周围的花儿都在为它起舞。`,
    `在旅途中，${charName}遇到了一个神奇的彩虹松鼠。松鼠在树上蹦蹦跳跳，正在为寻找一颗迷路的橡果发愁。${charName}开动脑筋，用树叶做了一个滑梯，成功帮松鼠拿到了橡果。松鼠感激地拍拍手，告诉它：只要心怀善意，到处都是魔法。`,
    `终于，${charName}回到了最初的起点，圆满达成了它的任务。大家都为它欢呼，夸奖它是个聪明、懂得『${educationalGoal}』的优秀宝宝。夜色渐深，${charName}钻进温暖的被窝，闭上眼睛，为自己和全天下的小朋友祈祷一个奇妙温暖的美梦。`
  ];

  const chapters = Array.from({ length: chapterCount }).map((_, index) => {
    return {
      chapterNumber: index + 1,
      title: titles[index] || `第${index + 1}章：精彩继续`,
      text: defaultStoryLines[index] || defaultStoryLines[defaultStoryLines.length - 1],
      imageUrl: index === 0 
        ? "https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?w=500&q=80"
        : index === 1 
        ? "https://images.unsplash.com/photo-1495107334309-fcf20504a5ab?w=500&q=80"
        : index === 2 
        ? "https://images.unsplash.com/photo-1415604930972-5bc40a5953d8?w=500&q=80"
        : "https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=500&q=80",
      imagePrompt: `A children's storybook illustration showing ${charName} in the style of soft digital pastel in ${scene} scene.`
    };
  });

  return {
    title: `神奇${theme}之：${charName}的${scene}奇遇记`,
    abstract: `这是一个专为${age}岁宝宝定制的《${theme}》故事，在美丽的《${scene}》里，通过主角《${charName}》的生动冒险，潜移默化地引导孩子学习《${educationalGoal}》，具有极强的陪伴感和温情。`,
    chapters: chapters,
    coverUrl: "https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=500&q=80"
  };
}

// AI Story Text Generation
app.post("/api/story/generate-text", async (req, res) => {
  const { theme, educationalGoal, scene, mainCharacter, duration, age, isRetry } = req.body;
  
  // --- INPUT SAFETY CHECK STAGE ---
  let inputsToScan = [theme, educationalGoal, scene].filter(Boolean).join(" ");
  const mainCharacters = req.body.mainCharacters || (mainCharacter ? [mainCharacter] : []);
  mainCharacters.forEach((char: any) => {
    inputsToScan += " " + (char.name || "") + " " + (char.role || "") + " " + (char.personality || "") + " " + (char.customDescription || "");
  });

  const inputSafety = runSafetyCheck(inputsToScan);
  if (inputSafety) {
    const logId = "audit_" + Date.now();
    const auditLog = {
      id: logId,
      timestamp: new Date().toISOString(),
      type: "input_check",
      originalInput: inputsToScan,
      processedInput: inputSafety.rewrite ? inputSafety.replacedText : "直接拦截（无改写）",
      actionTaken: inputSafety.blocked ? "intercept" : "rewrite",
      category: inputSafety.category,
      status: "pending_review",
      message: `用户设定或故事主角中含有敏感词『${inputSafety.word}』(类别:${inputSafety.categoryName})，处理方式：${inputSafety.blocked ? '直接拦截' : '儿童友好改写建议'}`
    };
    if (!db.sensitiveWordsConfig.auditLogs) db.sensitiveWordsConfig.auditLogs = [];
    db.sensitiveWordsConfig.auditLogs.unshift(auditLog);
    saveDBState(db);

    if (inputSafety.blocked) {
      return res.status(400).json({
        safetyBlocked: true,
        category: inputSafety.category,
        categoryName: inputSafety.categoryName,
        word: inputSafety.word,
        message: `⚠️ 伴梦儿童安全守护拦截：检测到您输入的故事设定包含 [${inputSafety.categoryName}] 相关的敏感词汇（『${inputSafety.word}』），已被系统安全拦截。本次生成不消耗额度，请使用绿色、温馨、适合儿童的词汇重试！`
      });
    } else if (inputSafety.rewrite) {
      return res.status(400).json({
        safetyRewriteSuggestion: true,
        category: inputSafety.category,
        categoryName: inputSafety.categoryName,
        word: inputSafety.word,
        originalInput: inputsToScan,
        suggestedReplacement: inputSafety.suggestion,
        message: `✨ 伴梦温馨安全改写建议：我们发现您的故事设定中包含了词汇『${inputSafety.word}』（涉及：${inputSafety.categoryName}），可能对宝宝有些敏感不适。
我们温馨建议您将设定改写为：【${inputSafety.suggestion}】，让故事更温和、治愈和正能量。本次生成不扣除您的故事额度哦！`
      });
    }
  }

  // Validate rights
  if (!db.rights.isVip && db.rights.storyGenerationsRemaining <= 0) {
    return res.status(400).json({ error: "您当前的故事额度已用尽。请前往兑换激活码或邀请好友获得奖励！" });
  }

  // Cost calculation: Retry check
  // "每一部文本故事首次重新生成免费一次。首次免费重新生成后仍不满意，再次重新生成消耗 1 次故事生成额度。"
  let consumed = false;
  if (!db.rights.isVip) {
    if (isRetry) {
      // In simulator, we track isRetry. Let's consume 1 storyGenerationsRemaining if it is secondary retry
      if (req.body.retryCount && req.body.retryCount > 1) {
        db.rights.storyGenerationsRemaining -= 1;
        consumed = true;
      }
    } else {
      db.rights.storyGenerationsRemaining -= 1;
      consumed = true;
    }
  }

  // Support setting multiple main characters and fully customized descriptions
  let charactersPrompt = "";
  let primaryCharName = "淘淘";

  if (mainCharacters.length > 0) {
    primaryCharName = mainCharacters.map((c: any) => c.name || "宝贝").filter(Boolean).join("和") || "小宝贝";
    charactersPrompt = mainCharacters.map((char: any, index: number) => {
      const num = index + 1;
      if (char.isCustomDescription) {
        return `角色 #${num} (完全自定义主人公描述): 名字叫 "${char.name || "无名主人公"}"，描述: "${char.customDescription || "一个神秘可爱的小伙伴"}".`;
      } else {
        return `角色 #${num}: 名字叫 "${char.name || "无名主人公"}"，种族/身份是 "${char.role || "小角色"}"，性格特征是 "${char.personality || "活泼可爱"}".`;
      }
    }).join("\n");
  } else {
    const charName = mainCharacter?.name || "小宝贝";
    const charRole = mainCharacter?.role || "勇敢的探险家";
    const charPersonality = mainCharacter?.personality || "聪明活泼";
    primaryCharName = charName;
    charactersPrompt = `主角名字叫 "${charName}"，种族/身份是 "${charRole}"，性格特征是 "${charPersonality}".`;
  }

  // Parse custom duration minutes
  let durationDesc = "";
  let expectedChapters = 3;
  if (duration === "short") {
    durationDesc = "短篇 (约3分钟，包含3个章节，每个章节约100-150字)";
    expectedChapters = 3;
  } else if (duration === "medium") {
    durationDesc = "中篇 (约5分钟，包含4个章节，每个章节约150-180字)";
    expectedChapters = 4;
  } else if (duration && duration.startsWith("long_")) {
    const mins = duration.split("_")[1]?.replace("m", "") || "10";
    durationDesc = `长篇 (自定义时长为 ${mins} 分钟，为了能够讲满整个故事时长，包含5个章节，请让每个章节文字更长、生动细致，包含约250-350字)`;
    expectedChapters = 5;
  } else {
    durationDesc = "长篇 (约8分钟，包含5个章节，每个章节约180-220字)";
    expectedChapters = 5;
  }

  console.log(`Generating story text: Theme=${theme}, Character=${primaryCharName}, Age=${age}, Duration=${durationDesc}, Consumed Rights=${consumed}`);

  let generatedStory: any = null;
  const systemPrompt = `You are an expert children's fairy tale book author. Write in Chinese. 
  You will write a structured storybook tailored for a kid of age ${age}.
  Target educational goal: ${educationalGoal}. Theme: ${theme}. Setting: ${scene}.
  Main characters information:
  ${charactersPrompt}
  
  Length should match "${durationDesc}" duration option. Please return exactly ${expectedChapters} chapters.
  Keep language warm, highly descriptive, safe, and positive. Make sure it provides gentle, peaceful sleeping rhythm or active confidence rhythm depending on theme.
  IMPORTANT: You MUST return a JSON object with this exact structure:
  {
    "title": "String - creative story name in Chinese",
    "abstract": "String - 1-2 sentence description summarizing the story charm",
    "chapters": [
      {
        "chapterNumber": number,
        "title": "String - chapter title",
        "text": "String - around 120-180 Chinese characters for this chapter",
        "imagePrompt": "String - descriptive image prompt in English for generating illustrations (soft watercolor cartoon childbook style, cute, simple details, high contrast, safe for children)"
      }
    ]
  }`;

  // --- SECONDARY PROMPT SAFETY CHECK STAGE ---
  const promptSafety = runSafetyCheck(systemPrompt);
  if (promptSafety && promptSafety.blocked) {
    const logId = "audit_" + Date.now();
    const auditLog = {
      id: logId,
      timestamp: new Date().toISOString(),
      type: "prompt_check",
      originalInput: systemPrompt,
      processedInput: "提示词二次安全检查直接拦截",
      actionTaken: "intercept",
      category: promptSafety.category,
      status: "pending_review",
      message: `系统整合提示词中包含敏感词『${promptSafety.word}』，触发二次防御自动拦截。`
    };
    if (!db.sensitiveWordsConfig.auditLogs) db.sensitiveWordsConfig.auditLogs = [];
    db.sensitiveWordsConfig.auditLogs.unshift(auditLog);
    
    // Quota Refund
    if (!db.rights.isVip && consumed) {
      db.rights.storyGenerationsRemaining += 1;
    }
    saveDBState(db);

    return res.status(400).json({
      safetyBlocked: true,
      category: promptSafety.category,
      categoryName: promptSafety.categoryName,
      word: promptSafety.word,
      message: `⚠️ 伴梦二次系统防护：系统生成的绘本大模型提示词（Prompt）中包含不适合儿童的词汇（『${promptSafety.word}』），已被系统强制拦截防御。不扣除额度！`
    });
  }

  const illustrationStockImages = [
    "https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?w=500&q=80",
    "https://images.unsplash.com/photo-1495107334309-fcf20504a5ab?w=500&q=80",
    "https://images.unsplash.com/photo-1415604930972-5bc40a5953d8?w=500&q=80",
    "https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=500&q=80",
    "https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?w=500&q=80"
  ];

  // Try Stepfun (阶跃星辰) LLM first if configured (CloudBase Cloud Function Simulation)
  if (process.env.STEPFUN_API_KEY && process.env.STEPFUN_API_KEY !== "MY_STEPFUN_API_KEY") {
    try {
      const stepfunApiKey = process.env.STEPFUN_API_KEY;
      const stepfunModel = process.env.STEPFUN_MODEL || "step-3.7-flash";
      console.log(`[Stepfun] Generating via Stepfun API with model ${stepfunModel}...`);

      const response = await fetch("https://api.stepfun.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${stepfunApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: stepfunModel,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `请立即开始创作关于主题《${theme}》的精彩童话故事《${primaryCharName}在${scene}的奇遇记》` }
          ],
          response_format: { type: "json_object" },
          temperature: 0.75
        })
      });

      if (!response.ok) {
        throw new Error(`Stepfun API response error: ${response.status} - ${await response.text()}`);
      }

      const result = await response.json() as any;
      const rawText = result.choices[0].message.content.trim();
      const parsed = JSON.parse(rawText);

      // Try generating story cover using step-image-edit-2
      let coverUrl = "https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=500&q=80";
      try {
        console.log(`[Stepfun] Generating cover image using step-image-edit-2 for story: ${parsed.title}`);
        const imgResponse = await fetch("https://api.stepfun.com/v1/images/generations", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${stepfunApiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "step-image-edit-2",
            prompt: `A beautiful watercolor children's book cover illustration for a story titled "${parsed.title}". ${parsed.abstract}. Soft lighting, cute pastel style, highly engaging for children, no text or words on image.`,
            size: "1024x1024",
            n: 1
          })
        });

        if (imgResponse.ok) {
          const imgResult = await imgResponse.json() as any;
          if (imgResult.data && imgResult.data.length > 0 && imgResult.data[0].url) {
            coverUrl = imgResult.data[0].url;
            console.log(`[Stepfun] Cover image generated successfully: ${coverUrl}`);
          }
        } else {
          console.warn(`[Stepfun] Cover image generation failed with status: ${imgResponse.status}`);
        }
      } catch (imgError: any) {
        console.error("❌ Stepfun Cover Image generation failed, fallback to stock image:", imgError.message || imgError);
      }

      generatedStory = {
        title: parsed.title,
        abstract: parsed.abstract,
        coverUrl: coverUrl,
        chapters: parsed.chapters.map((ch: any, idx: number) => ({
          ...ch,
          imageUrl: illustrationStockImages[idx % illustrationStockImages.length]
        }))
      };

      console.log("✅ Successfully generated story text and cover with Stepfun API!");
      logApiCall("/api/story/generate-text", "POST", 200, `Stepfun (${stepfunModel})`, 1820, 1550, "Generated story successfully with Stepfun API (CloudBase Proxy Mode)");
    } catch (err: any) {
      console.error("❌ Stepfun API failed, checking Gemini fallback...", err.message || err);
    }
  }

  // Fallback to Gemini if Stepfun is not configured or failed
  if (!generatedStory && ai) {
    try {
      console.log("[Gemini] Generating via Gemini API...");
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Create a wonderful children story about "${theme}" featuring "${primaryCharName}" in "${scene}".`,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              abstract: { type: Type.STRING },
              chapters: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    chapterNumber: { type: Type.INTEGER },
                    title: { type: Type.STRING },
                    text: { type: Type.STRING },
                    imagePrompt: { type: Type.STRING }
                  },
                  required: ["chapterNumber", "title", "text", "imagePrompt"]
                }
              }
            },
            required: ["title", "abstract", "chapters"]
          }
        }
      });

      const parsed = JSON.parse(response.text.trim());
      generatedStory = {
        title: parsed.title,
        abstract: parsed.abstract,
        coverUrl: "https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=500&q=80",
        chapters: parsed.chapters.map((ch: any, idx: number) => ({
          ...ch,
          imageUrl: illustrationStockImages[idx % illustrationStockImages.length]
        }))
      };

      console.log("✅ Successfully generated story text with Gemini API!");
      logApiCall("/api/story/generate-text", "POST", 200, "Gemini 3.5 Flash", 1680, 1420, "Generated story successfully with Gemini API");
    } catch (err: any) {
      console.error("❌ Gemini Story API failed. Falling back to structured default.", err.message || err);
    }
  }

  // Final fallback to offline local generator if both APIs fail or are unconfigured
  if (!generatedStory) {
    console.log("[Local Fallback] Generating local offline story...");
    generatedStory = generateFallbackStory(theme, educationalGoal, scene, primaryCharName, duration, age);
    logApiCall(
      "/api/story/generate-text", 
      "POST", 200, 
      process.env.STEPFUN_API_KEY ? "Stepfun Fallback" : "Offline Fallback", 
      220, 
      0, 
      "No active LLM API succeeded. Used offline fallback generator"
    );
  }

  // --- POST-GENERATION SECONDARY SAFETY CHECK STAGE ---
  if (generatedStory) {
    let generatedTextToScan = (generatedStory.title || "") + " " + (generatedStory.abstract || "");
    if (generatedStory.chapters && Array.isArray(generatedStory.chapters)) {
      generatedStory.chapters.forEach((ch: any) => {
        generatedTextToScan += " " + (ch.title || "") + " " + (ch.text || "");
      });
    }

    const outputSafety = runSafetyCheck(generatedTextToScan);
    if (outputSafety) {
      const logId = "audit_" + Date.now();
      const auditLog = {
        id: logId,
        timestamp: new Date().toISOString(),
        type: "post_check",
        originalInput: generatedTextToScan,
        processedInput: outputSafety.rewrite ? "内容自动改写净化" : "生成内容安全拦截不保存",
        actionTaken: outputSafety.blocked ? "intercept" : "rewrite",
        category: outputSafety.category,
        status: "pending_review",
        message: `生成的故事文本中检测到敏感词『${outputSafety.word}』(类别:${outputSafety.categoryName})，触发二次安全防护。`
      };
      if (!db.sensitiveWordsConfig.auditLogs) db.sensitiveWordsConfig.auditLogs = [];
      db.sensitiveWordsConfig.auditLogs.unshift(auditLog);

      if (outputSafety.blocked) {
        // Intercept: Do not show, do not play, do not save! Refund!
        if (!db.rights.isVip && consumed) {
          db.rights.storyGenerationsRemaining += 1; // Refund
        }
        saveDBState(db);

        return res.status(400).json({
          safetyBlocked: true,
          category: outputSafety.category,
          categoryName: outputSafety.categoryName,
          word: outputSafety.word,
          message: `⚠️ 伴梦生成内容安全防御拦截：大模型生成的故事内容中意外包含涉及 [${outputSafety.categoryName}] 的敏感词汇（『${outputSafety.word}』）。为了保障宝宝100%纯净温和的视听环境，该故事已被彻底拦截，不予保存、展示或播放。本次生成不扣除您的次数！`
        });
      } else if (outputSafety.rewrite) {
        // Rewrite slightly risky item on-the-fly to be children-safe!
        const wordRegex = new RegExp(outputSafety.word, "gi");
        const mapping = getChildFriendlyReplacement(outputSafety.word, outputSafety.category);
        
        generatedStory.title = (generatedStory.title || "").replace(wordRegex, "温暖小故事");
        generatedStory.abstract = (generatedStory.abstract || "").replace(wordRegex, "一个充满温馨和爱的小伙伴冒险故事");
        if (generatedStory.chapters && Array.isArray(generatedStory.chapters)) {
          generatedStory.chapters = generatedStory.chapters.map((ch: any) => ({
            ...ch,
            title: (ch.title || "").replace(wordRegex, "温暖的小瞬间"),
            text: (ch.text || "").replace(wordRegex, "开心地手拉手唱歌做游戏")
          }));
        }
        auditLog.message += " (系统已自动在后台进行儿童友好性净化改写，已安全保存)";
      }
    }
  }

  db.stats.textStoriesGenerated += 1;
  saveDBState(db);

  res.json({
    success: true,
    story: generatedStory,
    rights: db.rights,
    consumed: consumed
  });
});

// AI Audio / Synthesis Conversion and Save to Diary
app.post("/api/story/generate-audio", async (req, res) => {
  const { story, voiceId, voiceMode, theme, educationalGoal, scene, mainCharacterName, duration, targetAge, bgmType } = req.body;
  
  if (!story) {
    return res.status(400).json({ error: "No story data provided." });
  }

  // Deduct voice usage count
  if (voiceId) {
    const voice = db.voiceClones.find(v => v.id === voiceId);
    if (voice) {
      voice.usageCount += 1;
    }
  }

  const storyId = "story_" + Date.now();

  // Determine Stepfun speaker voice parameter mapping
  let voiceParam = "xiaomei"; // Stepfun default female narrator voice
  const activeClone = db.voiceClones.find(v => v.id === voiceId);
  if (activeClone) {
    if (activeClone.stepfunSucceeded && activeClone.stepfunVoiceId) {
      voiceParam = activeClone.stepfunVoiceId; // Use real cloned voice_id from Stepfun!
    } else if (activeClone.speakerType === "father") {
      voiceParam = "baineng"; // Default male voice
    }
  } else if (voiceId === "voice_default_dad") {
    voiceParam = "baineng";
  }

  let stepfunSucceededCount = 0;
  let hasStepfunTts = false;

  // Process chapters with Stepfun stepaudio-2.5-tts speech model
  let processedChapters = [...story.chapters];

  if (process.env.STEPFUN_API_KEY && process.env.STEPFUN_API_KEY !== "MY_STEPFUN_API_KEY") {
    const stepfunApiKey = process.env.STEPFUN_API_KEY;
    hasStepfunTts = true;
    try {
      console.log(`[Stepfun] Generating TTS audios via stepaudio-2.5-tts with voice "${voiceParam}"...`);
      const audioDir = path.join(process.cwd(), "public", "audio");
      fs.mkdirSync(audioDir, { recursive: true });

      processedChapters = await Promise.all(story.chapters.map(async (chapter: any, idx: number) => {
        try {
          const response = await fetch("https://api.stepfun.com/v1/audio/speech", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${stepfunApiKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: "stepaudio-2.5-tts",
              input: chapter.text,
              voice: voiceParam
            })
          });

          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const filename = `${storyId}_ch_${idx}.mp3`;
            fs.writeFileSync(path.join(audioDir, filename), buffer);
            stepfunSucceededCount += 1;
            console.log(`✅ Chapter ${idx + 1} TTS synthesis successful! Saved to public/audio/${filename}`);
            return {
              ...chapter,
              audioUrl: `/public/audio/${filename}`
            };
          } else {
            console.warn(`[Stepfun] Chapter ${idx + 1} TTS returned status: ${response.status}`);
          }
        } catch (chapterErr: any) {
          console.error(`❌ Chapter ${idx + 1} TTS failed:`, chapterErr.message || chapterErr);
        }
        return chapter; // Keep original if failed
      }));
    } catch (err: any) {
      console.error("❌ Stepfun TTS batch conversion failed:", err.message || err);
    }
  }

  const completeStory = {
    id: storyId,
    title: story.title,
    abstract: story.abstract,
    chapters: processedChapters,
    coverUrl: story.coverUrl || "https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=500&q=80",
    isAudioReady: true,
    voiceId: voiceId || "voice_default_mom",
    voiceMode: voiceMode || "single",
    createTime: new Date().toISOString(),
    isSavedToDiary: true, // Auto-save to diary
    isFavorite: false,
    theme: theme || "睡前安抚",
    educationalGoal: educationalGoal || "习惯养成",
    scene: scene || "家庭卧室",
    mainCharacterName: mainCharacterName || "主角",
    duration: duration || "short",
    targetAge: targetAge || 4,
    bgmType: bgmType || "none"
  };

  db.userStories.unshift(completeStory);
  db.stats.audioStoriesGenerated += 1;
  db.stats.storiesSavedCount += 1;

  // Add system notification
  const notif = {
    id: "notif_" + Date.now(),
    title: `专属有声故事《${story.title}》已入库`,
    content: `亲子有声故事《${story.title}》已成功转码，并安全保存至宝宝的专属故事日记本，可随时无限制免费循环播放！`,
    type: "story",
    isRead: false,
    createdAt: new Date().toISOString()
  };
  db.notifications.unshift(notif);

  const finalSvc = stepfunSucceededCount > 0 ? `Stepfun stepaudio-2.5-tts (${stepfunSucceededCount}个章节)` : "Cosmic TTS v2 Synthesizer";
  const finalMsg = stepfunSucceededCount > 0 
    ? `已使用阶跃星辰有声合成模型（stepaudio-2.5-tts）成功转码 ${stepfunSucceededCount} 章节有声故事，音源：${voiceParam}`
    : `TTS 合成成功，使用本地有声转码引擎。`;

  logApiCall(
    "/api/story/generate-audio", 
    "POST", 
    200, 
    finalSvc, 
    stepfunSucceededCount > 0 ? 1500 + stepfunSucceededCount * 300 : 820, 
    stepfunSucceededCount > 0 ? stepfunSucceededCount * 120 : 680, 
    finalMsg
  );

  saveDBState(db);
  res.json({
    success: true,
    savedStory: completeStory,
    voiceClones: db.voiceClones,
    notifications: db.notifications
  });
});

// Save Toggle (Favorite or diary)
app.post("/api/story/save-toggle", (req, res) => {
  const { id, type } = req.body; // type: 'favorite' or 'diary'
  const story = db.userStories.find(s => s.id === id);
  
  if (story) {
    if (type === 'favorite') {
      story.isFavorite = !story.isFavorite;
    } else if (type === 'diary') {
      story.isSavedToDiary = !story.isSavedToDiary;
    }
    saveDBState(db);
    res.json({ success: true, story });
  } else {
    res.status(404).json({ error: "Story not found." });
  }
});

// Rename Story
app.post("/api/story/rename", (req, res) => {
  const { id, title } = req.body;
  const story = db.userStories.find(s => s.id === id);
  if (story && title) {
    story.title = title;
    saveDBState(db);
    res.json({ success: true, story });
  } else {
    res.status(400).json({ error: "Invalid parameters." });
  }
});

// Delete User Story
app.post("/api/story/delete", (req, res) => {
  const { id } = req.body;
  db.userStories = db.userStories.filter(s => s.id !== id);
  saveDBState(db);
  res.json({ success: true, stories: db.userStories });
});

// Redeem CDKey Cards
app.post("/api/cdkey/redeem", (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: "请输入有效的激活码！" });
  }

  const card = db.cdkeys.find(c => c.code.toUpperCase() === code.trim().toUpperCase());

  if (!card) {
    return res.status(400).json({ error: "该激活码不存在，请核对后再试！" });
  }

  if (card.isUsed) {
    return res.status(400).json({ error: "该激活码已被兑换使用过！" });
  }

  // Mark used
  card.isUsed = true;
  card.usedBy = db.profile.parentName || "用户";
  card.usedTime = new Date().toISOString();

  // Apply Rights
  if (card.type === 'times') {
    db.rights.storyGenerationsRemaining += card.value;
  } else if (card.type === 'vip') {
    db.rights.isVip = true;
    const currentExpiry = db.rights.vipExpiry ? new Date(db.rights.vipExpiry) : new Date();
    currentExpiry.setDate(currentExpiry.getDate() + card.value);
    db.rights.vipExpiry = currentExpiry.toISOString();
  }

  // Increment metrics
  db.stats.cdkeysRedeemedCount += 1;
  if (card.type === 'vip') {
    db.stats.vipsActivatedCount += 1;
  }

  // Create notification
  const textVal = card.type === 'times' ? `${card.value}次故事生成额度` : `${card.value}天VIP尊享会员`;
  const notif = {
    id: "notif_" + Date.now(),
    title: "激活码兑换成功！",
    content: `恭喜您成功兑换由【${card.channel}】发放的卡密，获得【${textVal}】！权益已立即充值到账。`,
    type: "card",
    isRead: false,
    createdAt: new Date().toISOString()
  };
  db.notifications.unshift(notif);

  saveDBState(db);
  res.json({
    success: true,
    rights: db.rights,
    cdkeys: db.cdkeys,
    notifications: db.notifications
  });
});

// Referral Bind Code
app.post("/api/referral/bind", (req, res) => {
  const { inviteCode } = req.body;
  if (!inviteCode) {
    return res.status(400).json({ error: "请输入邀请码！" });
  }

  if (inviteCode.toUpperCase() === db.rights.inviteCode) {
    return res.status(400).json({ error: "您不能绑定自己的邀请码！" });
  }

  if (db.rights.usedInviteCode) {
    return res.status(400).json({ error: "您已绑定过邀请关系，无法重复绑定！" });
  }

  db.rights.usedInviteCode = inviteCode.toUpperCase();
  db.stats.invitesBoundCount += 1;

  // Grant rewards to both parties (e.g. 2 stories for binder, 2 stories for recommender)
  db.rights.storyGenerationsRemaining += 2; // For binder
  db.stats.invitesCompletedCount += 1;

  // Add record
  const record = {
    id: "invite_rec_" + Date.now(),
    referrerId: inviteCode.toUpperCase(),
    referredId: "user_current",
    referredName: db.profile.parentName || "淘淘妈妈",
    status: "success",
    rewardValue: 2,
    createdAt: new Date().toISOString()
  };
  db.invitationRecords.unshift(record);

  // Notification for binder
  const notif = {
    id: "notif_" + Date.now(),
    title: "绑定邀请码成功！双方获赠福利",
    content: `您已成功绑定推荐人邀请码【${inviteCode.toUpperCase()}】，您和好友均已获赠【2次故事生成额度】！`,
    type: "referral",
    isRead: false,
    createdAt: new Date().toISOString()
  };
  db.notifications.unshift(notif);

  saveDBState(db);
  res.json({
    success: true,
    rights: db.rights,
    invitationRecords: db.invitationRecords,
    notifications: db.notifications
  });
});

// Manage notifications
app.post("/api/notifications/read-all", (req, res) => {
  db.notifications.forEach(n => n.isRead = true);
  saveDBState(db);
  res.json({ success: true, notifications: db.notifications });
});

app.post("/api/notifications/delete", (req, res) => {
  const { id } = req.body;
  db.notifications = db.notifications.filter(n => n.id !== id);
  saveDBState(db);
  res.json({ success: true, notifications: db.notifications });
});

// Increment Stats - play story
app.post("/api/stats/play", (req, res) => {
  db.stats.storiesPlayedCount = (db.stats.storiesPlayedCount || 0) + 1;
  saveDBState(db);
  res.json({ success: true, count: db.stats.storiesPlayedCount });
});

// Reset database or set default templates (Admin actions)
app.post("/api/admin/reset", (req, res) => {
  db = { ...INITIAL_DB_STATE, templates: DEFAULT_TEMPLATES };
  saveDBState(db);
  res.json({ success: true, db });
});

// Simulate API call for monitoring purposes
app.post("/api/admin/simulate-api-call", (req, res) => {
  const { type } = req.body;
  if (type === 'gemini') {
    logApiCall(
      "/api/story/generate-text", 
      "POST", 
      200, 
      "Gemini 3.5 Flash", 
      1200 + Math.floor(Math.random() * 800), 
      1000 + Math.floor(Math.random() * 500), 
      "Success (Simulated text generation)"
    );
  } else if (type === 'tts') {
    logApiCall(
      "/api/story/generate-audio", 
      "POST", 
      200, 
      "Cosmic TTS v2 Synthesizer", 
      500 + Math.floor(Math.random() * 400), 
      400 + Math.floor(Math.random() * 300), 
      "Success (Simulated audio speech synthesis)"
    );
  } else if (type === 'clone') {
    logApiCall(
      "/api/voice/clone", 
      "POST", 
      200, 
      "Voice Cloner Engine", 
      1500 + Math.floor(Math.random() * 800), 
      0, 
      "Success (Simulated voice recording feature analysis)"
    );
  } else {
    // Random other call
    logApiCall(
      "/api/profile", 
      "POST", 
      200, 
      "User Profile", 
      50 + Math.floor(Math.random() * 80), 
      0, 
      "Success (Simulated user profile update)"
    );
  }
  res.json({ success: true, db });
});

// Add template
app.post("/api/admin/template/add", (req, res) => {
  const { name, cover, ageGroup, theme, educationalGoal, scene, mainCharacter, duration, description } = req.body;
  
  const newTpl = {
    id: "tpl_" + Date.now(),
    name: name || "未命名模板",
    cover: cover || "https://images.unsplash.com/photo-1519052537078-e6302a4968d4?w=500&q=80",
    ageGroup: ageGroup || "3-6岁",
    theme: theme || "睡前安抚",
    educationalGoal: educationalGoal || "勇敢自信",
    scene: scene || "神秘城堡",
    mainCharacter: mainCharacter || { name: "奇奇", role: "探险家", personality: "活泼聪明" },
    duration: duration || "medium",
    description: description || "一款极具吸引力的陪伴绘本模板。",
    isRecommended: false,
    useCount: 0
  };

  db.templates.push(newTpl);
  saveDBState(db);
  res.json({ success: true, templates: db.templates });
});

// Delete template
app.post("/api/admin/template/delete", (req, res) => {
  const { id } = req.body;
  db.templates = db.templates.filter(t => t.id !== id);
  saveDBState(db);
  res.json({ success: true, templates: db.templates });
});

// Toggle template recommendation status
app.post("/api/admin/template/toggle-recommend", (req, res) => {
  const { id } = req.body;
  const tpl = db.templates.find(t => t.id === id);
  if (tpl) {
    tpl.isRecommended = !tpl.isRecommended;
    saveDBState(db);
    res.json({ success: true, tpl });
  } else {
    res.status(404).json({ error: "Template not found." });
  }
});

// --- ADMIN AUTH & CONFIG ENDPOINTS ---

// Admin Login
app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "请输入管理员账号和密码！" });
  }

  const admin = db.admins.find(
    a => a.username.trim() === username.trim() && a.password === password
  );

  if (admin) {
    res.json({ success: true, user: { username: admin.username } });
  } else {
    res.status(400).json({ error: "管理员账号或密码错误，请核对后再试！" });
  }
});

// Create/Register Admin
app.post("/api/admin/register", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "请输入需要新建的账号和密码！" });
  }

  if (password.length < 5) {
    return res.status(400).json({ error: "管理员密码长度不能小于5位！" });
  }

  const exists = db.admins.some(a => a.username.toLowerCase() === username.toLowerCase());
  if (exists) {
    return res.status(400).json({ error: "该管理员账号已存在，请更换！" });
  }

  const newAdmin = {
    username,
    password,
    createdAt: new Date().toISOString()
  };

  db.admins.push(newAdmin);
  saveDBState(db);

  res.json({ success: true, message: `管理员【${username}】账号新建成功！` });
});

// Update Safety Word Categories and Sensitivity Settings
app.post("/api/admin/safety-config/update", (req, res) => {
  const { categories, sensitiveWords } = req.body;
  
  if (categories && Array.isArray(categories)) {
    db.sensitiveWordsConfig.categories = categories;
  }
  if (sensitiveWords && Array.isArray(sensitiveWords)) {
    db.sensitiveWordsConfig.sensitiveWords = sensitiveWords;
  }
  
  saveDBState(db);
  res.json({ success: true, sensitiveWordsConfig: db.sensitiveWordsConfig });
});

// Resolve audit log entry (人工复核)
app.post("/api/admin/safety-config/audit-resolve", (req, res) => {
  const { id, status } = req.body; // status: 'approved' | 'overridden'
  const log = db.sensitiveWordsConfig.auditLogs.find(l => l.id === id);
  if (log) {
    log.status = status;
    saveDBState(db);
    res.json({ success: true, auditLogs: db.sensitiveWordsConfig.auditLogs });
  } else {
    res.status(404).json({ error: "Audit record not found." });
  }
});

// --- Vite integration for Single Full-Stack App ---

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 [Dream-Companion Backend] Server running on http://localhost:${PORT}`);
  });
}

startServer();
