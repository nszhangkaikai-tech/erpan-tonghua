import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { execSync, spawnSync } from "child_process";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import {
  buildChapterImagePrompt,
  buildCoverImagePrompt,
  buildStoryTextPrompt,
  getStorybookTemplate,
  STORYBOOK_TEMPLATE_CATALOG,
  StoryPromptInput,
} from "./src/storybookTemplates";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const DEV_AUTH_MOCK = process.env.DEV_AUTH_MOCK === "true";
const WECHAT_APP_ID = process.env.WECHAT_APP_ID || process.env.WX_APP_ID || "";
const WECHAT_APP_SECRET = process.env.WECHAT_APP_SECRET || process.env.WX_APP_SECRET || "";

if (IS_PRODUCTION && (!process.env.ADMIN_PASSWORD || !process.env.ADMIN_SALT)) {
  throw new Error("生产环境必须配置 ADMIN_PASSWORD 和 ADMIN_SALT");
}
if (IS_PRODUCTION && DEV_AUTH_MOCK) {
  throw new Error("生产环境禁止启用 DEV_AUTH_MOCK");
}

// P0: Limit JSON body size to mitigate DoS via oversized payloads
app.use(express.json({ limit: "2mb" }));

// Path to persistent data file
const DATA_FILE_PATH = process.env.DATA_FILE_PATH
  ? path.resolve(process.env.DATA_FILE_PATH)
  : path.join(process.cwd(), "src", "data.json");

// Persistent storage directory for compressed media assets. Keep generated files
// outside the frontend dist when deploying a real service.
const STORAGE_DIR = process.env.STORAGE_DIR
  ? path.resolve(process.env.STORAGE_DIR)
  : path.join(process.cwd(), "public", "storage");
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

// Serve compressed media assets from storage directory
app.use("/public/storage", express.static(STORAGE_DIR));
app.use("/public/audio", express.static(path.join(process.cwd(), "public", "audio")));

// Host secret for HMAC token signing (persisted or generated on boot)
const HOST_SECRET_FILE = process.env.HOST_SECRET_FILE
  ? path.resolve(process.env.HOST_SECRET_FILE)
  : path.join(process.cwd(), "src", ".host_secret");
let HOST_SECRET: string;
if (fs.existsSync(HOST_SECRET_FILE)) {
  HOST_SECRET = fs.readFileSync(HOST_SECRET_FILE, "utf-8").trim();
} else {
  HOST_SECRET = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(HOST_SECRET_FILE, HOST_SECRET, "utf-8");
}

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
  // P0 persistent schemas
  assets: AssetRecord[];
  generationJobs: GenerationJob[];
  quotaLedger: QuotaLedgerEntry[];
  adminSessions: AdminSession[];
  users: UserAccount[];
}

// P0 Asset record: persistent metadata for every stored media file
interface AssetRecord {
  id: string;
  ownerId: string;
  kind: "image" | "audio";
  storageKey: string;       // relative path under public/storage/
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  duration?: number;        // seconds, for audio
  sha256: string;
  status: "ready" | "compressing" | "failed";
  createdAt: string;
  updatedAt: string;
  sourceUrl?: string;       // original URL before compression
}

// P0 Generation job: deduplicated & restart-recoverable audio pipeline
interface GenerationJob {
  id: string;
  ownerId: string;
  inputHash: string;
  storyTitle: string;
  storyAbstract: string;
  coverUrl: string;
  chapters: any[];
  voiceId: string;
  voiceMode: string;
  bgmType: string;
  theme: string;
  educationalGoal: string;
  scene: string;
  mainCharacterName: string;
  duration: string;
  targetAge: number;
  status: "queued" | "tts_generating" | "compressing" | "mixing" | "ready" | "failed";
  progress?: number;
  resultStoryId?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

// P0 Quota ledger entry: every credit/debit is auditable
interface QuotaLedgerEntry {
  id: string;
  userId: string;
  resourceType: "story_generation" | "voice_clone" | "cdkey_times" | "cdkey_vip" | "invite_reward" | "refund";
  amount: number;          // positive=credit, negative=debit
  reason: string;
  balanceAfter: number;
  createdAt: string;
}

// P0 Admin session
interface AdminSession {
  token: string;
  username: string;
  createdAt: string;
  expiresAt: string;
}

// P0 User account (multi-user support)
interface UserAccount {
  id: string;
  openid: string;
  nickname: string;
  rights: {
    freeVoiceClonesRemaining: number;
    storyGenerationsRemaining: number;
    isVip: boolean;
    vipExpiry?: string;
    inviteCode: string;
    usedInviteCode?: string;
  };
  avatar?: string;
  profile?: any;
  voiceClones?: any[];
  notifications?: any[];
  createdAt: string;
}

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

const DEFAULT_STORIES = [
  {
    id: "story_default_1",
    ownerId: "user_default", // P0: Track ownership
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

// --- P0 Admin password hashing (sha256 + per-deploy salt) ---
// Moved before INITIAL_DB_STATE so the seed admin password can be stored as a hash,
// never as plaintext. Salt is overridable via ADMIN_SALT env for per-deploy uniqueness.
const ADMIN_SALT = process.env.ADMIN_SALT || "bd_dream_admin_salt_v1";
// P0: Admin password sourced from env (ADMIN_PASSWORD), falls back to a known weak
// default ONLY for local dev. Production MUST set ADMIN_PASSWORD.
const ADMIN_DEFAULT_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(ADMIN_SALT + ":" + password).digest("hex");
}
function verifyPassword(password: string, stored: string): boolean {
  // Support both "sha256:<hash>" format and raw hash format
  const hashPart = stored.startsWith("sha256:") ? stored.slice(7) : stored;
  const expected = hashPassword(password);
  if (hashPart.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(hashPart));
}

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
    storyGenerationsRemaining: 15,
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
    // P0: Store seed admin password as sha256+salt hash, never plaintext.
    // Password comes from ADMIN_PASSWORD env (fallback "admin123" for dev only).
    { username: "admin", password: "sha256:" + hashPassword(ADMIN_DEFAULT_PASSWORD), createdAt: "2026-07-19T00:00:00.000Z" }
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
  },
  // P0 new schema collections
  assets: [],
  generationJobs: [],
  quotaLedger: [],
  adminSessions: [],
  users: [
    {
      id: "user_default",
      openid: "default_user",
      nickname: "淘淘妈妈",
      rights: {
        freeVoiceClonesRemaining: 3,
        storyGenerationsRemaining: 15,
        isVip: false,
        inviteCode: "BMTH-6925"
      },
      createdAt: "2026-07-19T00:00:00.000Z"
    }
  ]
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
      // Add newly shipped templates without deleting or rewriting user/admin data.
      const existingTemplates = Array.isArray(parsed.templates) ? parsed.templates : [];
      const existingTemplateIds = new Set(existingTemplates.map((template: any) => template?.id).filter(Boolean));
      for (const template of DEFAULT_TEMPLATES) {
        if (!existingTemplateIds.has(template.id)) {
          existingTemplates.push({ ...template });
          existingTemplateIds.add(template.id);
        }
      }
      parsed.templates = existingTemplates;
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
      // P0: migrate missing collections
      if (!parsed.assets) parsed.assets = [];
      if (!parsed.generationJobs) parsed.generationJobs = [];
      if (!parsed.quotaLedger) parsed.quotaLedger = [];
      if (!parsed.adminSessions) parsed.adminSessions = [];
      if (!parsed.users || parsed.users.length === 0) parsed.users = [...INITIAL_DB_STATE.users];

      // P0 security migration: re-hash any admin passwords still stored as plaintext.
      // Older data.json seeds stored "admin123" in cleartext — verifyPassword could never
      // match those. Migrate them to sha256+salt on load and persist.
      let adminsChanged = false;
      for (const admin of parsed.admins) {
        if (admin.password && !admin.password.startsWith("sha256:")) {
          admin.password = "sha256:" + hashPassword(admin.password);
          adminsChanged = true;
        }
      }
      if (adminsChanged) saveDBState(parsed);

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

// 微信账号单独存放，避免把 openid 和会话数据写回原型 data.json。
const USER_ACCOUNTS_FILE = process.env.USER_ACCOUNTS_FILE
  ? path.resolve(process.env.USER_ACCOUNTS_FILE)
  : path.join(process.cwd(), "src", "users.json");

function readUserAccounts(): UserAccount[] {
  if (fs.existsSync(USER_ACCOUNTS_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(USER_ACCOUNTS_FILE, "utf-8"));
      if (Array.isArray(parsed)) return parsed;
    } catch (error) {
      console.error("Failed to parse users.json:", error);
    }
  }
  return Array.isArray(db?.users) ? db.users : [];
}

function saveUserAccounts(users: UserAccount[]) {
  fs.writeFileSync(USER_ACCOUNTS_FILE, JSON.stringify(users, null, 2), "utf-8");
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

// --- P0 Crypto helpers ---
function sha256Hex(data: Buffer | string): string {
  const buf = typeof data === "string" ? Buffer.from(data, "utf-8") : data;
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function computeInputHash(chapters: any[], voiceId: string): string {
  const textBlob = chapters.map((c: any) => c.text || "").join("\n");
  // Background noise is mixed by the player, not generated on the server.
  return sha256Hex(textBlob + "|" + voiceId);
}

// --- P0 Quota ledger ---
function recordQuotaEntry(userId: string, resourceType: QuotaLedgerEntry["resourceType"], amount: number, reason: string, balanceAfter: number) {
  db.quotaLedger.push({
    id: "qle_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
    userId,
    resourceType,
    amount,
    reason,
    balanceAfter,
    createdAt: new Date().toISOString()
  });
  saveDBState(db);
}

// --- P0 HMAC token system (replaces forgeable base64 openid:timestamp) ---
function createHmacToken(userId: string): string {
  const timestamp = Date.now();
  const payload = `${userId}:${timestamp}`;
  const sig = crypto.createHmac("sha256", HOST_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

function verifyHmacToken(token: string): { userId: string; valid: boolean } {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const [userId, tsStr, sig] = decoded.split(":");
    if (!userId || !tsStr || !sig) return { userId: "", valid: false };
    // Reject tokens older than 7 days
    const ts = parseInt(tsStr, 10);
    if (ts > Date.now() + 5 * 60 * 1000 || Date.now() - ts > 7 * 24 * 60 * 60 * 1000) return { userId: userId, valid: false };
    const expected = crypto.createHmac("sha256", HOST_SECRET).update(`${userId}:${tsStr}`).digest("hex");
    if (sig !== expected) return { userId: userId, valid: false };
    return { userId, valid: true };
  } catch {
    return { userId: "", valid: false };
  }
}

// --- P0 Admin session token ---
// 管理员 token 只存在内存中，服务重启后全部失效，不再写入 data.json。
const ADMIN_SESSIONS = new Map<string, AdminSession>();

function createAdminSession(username: string): string {
  const token = crypto.randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(); // 8h
  ADMIN_SESSIONS.set(token, { token, username, createdAt: new Date().toISOString(), expiresAt });
  return token;
}

function verifyAdminSession(token: string): { username: string; valid: boolean } {
  const session = ADMIN_SESSIONS.get(token);
  if (!session) return { username: "", valid: false };
  if (new Date(session.expiresAt) < new Date()) {
    ADMIN_SESSIONS.delete(token);
    return { username: session.username, valid: false };
  }
  return { username: session.username, valid: true };
}

// --- P0 Auth middleware ---
function userAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = req.headers["authorization"]?.replace(/^Bearer\s+/i, "") || req.body?.token;
  if (!token) return res.status(401).json({ error: "认证令牌缺失" });
  const { userId, valid } = verifyHmacToken(token);
  if (!valid) return res.status(401).json({ error: "认证令牌无效或已过期" });
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) req.body = {};
  req.body._ownerId = userId;
  next();
}

function adminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = req.headers["authorization"]?.replace(/^Bearer\s+/i, "") || req.body?.adminToken;
  if (!token) return res.status(401).json({ error: "管理员令牌缺失" });
  const { valid } = verifyAdminSession(token);
  if (!valid) return res.status(401).json({ error: "管理员令牌无效或已过期" });
  next();
}

// --- P0 Asset storage helpers ---
function assetStoragePath(key: string): string {
  const base = path.resolve(STORAGE_DIR);
  const target = path.resolve(base, key);
  if (target !== base && !target.startsWith(base + path.sep)) {
    throw new Error("Invalid asset storage key");
  }
  return target;
}

function assetPublicUrl(key: string): string {
  return `/public/storage/${key}`;
}

function saveAssetFile(filename: string, data: Buffer): string {
  const filePath = assetStoragePath(filename);
  fs.writeFileSync(filePath, data);
  return filename;
}

function deleteAssetFile(filename: string) {
  const filePath = assetStoragePath(filename);
  if (fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath); } catch { /* ignore */ }
  }
}

// --- P0 SSRF-safe fetch (blocks private IPs, enforces protocol + size + timeout) ---
const SAFE_FETCH_MAX_BYTES = 20 * 1024 * 1024; // 20MB cap for source images
const SAFE_FETCH_TIMEOUT_MS = 15_000;
const COVER_OUTPUT_MAX_BYTES = 220 * 1024;
const COVER_OUTPUT_MAX_EDGE = 768;
const CHAPTER_OUTPUT_MAX_BYTES = 320 * 1024;
const CHAPTER_OUTPUT_MAX_EDGE = 768;

function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  // IPv4
  const ipParts = h.split(".").map(Number);
  if (ipParts.length === 4 && ipParts.every(n => Number.isInteger(n) && n >= 0 && n <= 255)) {
    if (ipParts[0] === 10) return true;                          // 10.0.0.0/8
    if (ipParts[0] === 127) return true;                         // 127.0.0.0/8 (loopback)
    if (ipParts[0] === 0) return true;                            // 0.0.0.0/8
    if (ipParts[0] === 169 && ipParts[1] === 254) return true;   // 169.254.0.0/16 (link-local)
    if (ipParts[0] === 172 && ipParts[1] >= 16 && ipParts[1] <= 31) return true; // 172.16.0.0/12
    if (ipParts[0] === 192 && ipParts[1] === 168) return true;   // 192.168.0.0/16
    if (ipParts[0] === 100 && ipParts[1] >= 64 && ipParts[1] <= 127) return true; // 100.64.0.0/10 (CGNAT)
  }
  // IPv6 / names
  if (h === "::1" || h === "localhost" || h === "[::1]") return true;
  if (h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80")) return true; // ULA / link-local
  if (h.startsWith("[")) return true; // bracketed IPv6 — block to be safe
  return false;
}

async function safeFetch(sourceUrl: string): Promise<Response> {
  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    throw new Error("Invalid source URL");
  }
  // Only allow http/https
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Blocked non-http(s) protocol: ${parsed.protocol}`);
  }
  // Block private/internal hosts (SSRF protection)
  if (isPrivateHost(parsed.hostname)) {
    throw new Error(`Blocked private/internal host: ${parsed.hostname}`);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SAFE_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(sourceUrl, { signal: controller.signal });
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);
    // Cap response size to prevent memory exhaustion (DoS)
    const contentLength = parseInt(response.headers.get("content-length") || "0", 10);
    if (contentLength > SAFE_FETCH_MAX_BYTES) {
      throw new Error(`Response too large: ${contentLength} bytes (max ${SAFE_FETCH_MAX_BYTES})`);
    }
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function compressImageToWebP(sourceBuf: Buffer, maxBytes: number, maxEdge: number, initialQuality: number): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  let edge = maxEdge;
  let quality = initialQuality;
  let lastBuffer = Buffer.alloc(0);

  // Reduce quality first, then dimensions, so the byte limit remains enforceable
  // even for high-detail source images.
  for (let pass = 0; pass < 8; pass += 1) {
    lastBuffer = await sharp(sourceBuf)
      .resize(edge, edge, { fit: "inside", withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();
    if (lastBuffer.length <= maxBytes) return lastBuffer;
    if (quality > 35) quality -= 10;
    else {
      edge = Math.max(160, Math.floor(edge * 0.72));
      quality = 65;
    }
  }

  if (lastBuffer.length > maxBytes) {
    throw new Error(`Unable to compress image below ${maxBytes} bytes`);
  }
  return lastBuffer;
}

// --- P0 Image processing (Sharp → WebP) ---
async function processCoverImage(sourceUrl: string, ownerId: string): Promise<AssetRecord> {
  const assetId = "img_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
  const filename = `${assetId}.webp`;

  try {
    // Download source image (P0: SSRF-safe fetch)
    const response = await safeFetch(sourceUrl);
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);
    const sourceBuf = Buffer.from(await response.arrayBuffer());

    // Cap downloaded buffer to SAFE_FETCH_MAX_BYTES (defense in depth)
    if (sourceBuf.length > SAFE_FETCH_MAX_BYTES) {
      throw new Error(`Source image too large: ${sourceBuf.length} bytes`);
    }

    // Keep the mini-program cover light: max 768px edge and about 220KB.
    const webpBuf = await compressImageToWebP(sourceBuf, COVER_OUTPUT_MAX_BYTES, COVER_OUTPUT_MAX_EDGE, 75);

    // Get metadata
    const sharp = (await import("sharp")).default;
    const meta = await sharp(webpBuf).metadata();

    // Compute output hash (not input hash)
    const outputHash = sha256Hex(webpBuf);

    // Save
    saveAssetFile(filename, webpBuf);

    const record: AssetRecord = {
      id: assetId,
      ownerId,
      kind: "image",
      storageKey: filename,
      mimeType: "image/webp",
      sizeBytes: webpBuf.length,
      width: meta.width || 0,
      height: meta.height || 0,
      sha256: outputHash,
      status: "ready",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sourceUrl
    };
    db.assets.push(record);
    saveDBState(db);
    return record;
  } catch (err: any) {
    console.error(`[Image] Cover processing failed for ${sourceUrl}:`, err.message);
    // P0: Do NOT expose sourceUrl in failed records
    const fallbackRecord: AssetRecord = {
      id: assetId,
      ownerId,
      kind: "image",
      storageKey: "",
      mimeType: "image/webp",
      sizeBytes: 0,
      sha256: "",
      status: "failed",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.assets.push(fallbackRecord);
    saveDBState(db);
    return fallbackRecord;
  }
}

async function processChapterImage(sourceUrl: string, ownerId: string): Promise<AssetRecord> {
  const assetId = "img_ch_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
  const filename = `${assetId}.webp`;

  try {
    // P0: SSRF-safe fetch
    const response = await safeFetch(sourceUrl);
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);
    const sourceBuf = Buffer.from(await response.arrayBuffer());
    if (sourceBuf.length > SAFE_FETCH_MAX_BYTES) {
      throw new Error(`Source image too large: ${sourceBuf.length} bytes`);
    }

    const webpBuf = await compressImageToWebP(sourceBuf, CHAPTER_OUTPUT_MAX_BYTES, CHAPTER_OUTPUT_MAX_EDGE, 78);

    const sharp = (await import("sharp")).default;
    const meta = await sharp(webpBuf).metadata();

    // P0: Compute output hash (not input hash)
    const outputHash = sha256Hex(webpBuf);
    saveAssetFile(filename, webpBuf);

    const record: AssetRecord = {
      id: assetId,
      ownerId,
      kind: "image",
      storageKey: filename,
      mimeType: "image/webp",
      sizeBytes: webpBuf.length,
      width: meta.width || 0,
      height: meta.height || 0,
      sha256: outputHash,
      status: "ready",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sourceUrl
    };
    db.assets.push(record);
    saveDBState(db);
    return record;
  } catch (err: any) {
    console.error(`[Image] Chapter processing failed for ${sourceUrl}:`, err.message);
    // P0: Do NOT expose sourceUrl in failed records
    return {
      id: assetId,
      ownerId,
      kind: "image",
      storageKey: "",
      mimeType: "image/webp",
      sizeBytes: 0,
      sha256: "",
      status: "failed",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }
}

// --- P0 Audio processing (FFmpeg → MP3 mono 24kHz) ---
function transcodeAudioToMP3(inputPath: string, outputPath: string): boolean {
  try {
    const result = spawnSync("ffmpeg", [
      "-y", "-i", inputPath,
      "-ac", "1", "-ar", "24000", "-b:a", "96k",
      "-f", "mp3", outputPath
    ], { timeout: 30_000, stdio: "pipe" });
    if (result.status !== 0) {
      console.error("[Audio] FFmpeg transcode failed:", result.stderr?.toString().slice(0, 200));
      return false;
    }
    return true;
  } catch {
    console.error("[Audio] FFmpeg not available for transcoding");
    return false;
  }
}

function getAudioDuration(filePath: string): number {
  // P0: Use spawnSync with array args (no shell) to avoid command injection via filePath.
  // ffprobe is the primary tool; if absent (common in stripped ffmpeg builds), fall back
  // to ffmpeg stderr parsing, then to a file-size-based estimate. Returning 0 here was the
  // root cause of generate-audio allReady=false even when the MP3 file was valid.

  // 1) ffprobe
  try {
    const result = spawnSync("ffprobe", [
      "-v", "error", "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1", filePath
    ], { timeout: 5_000, encoding: "utf-8" });
    if (result.status === 0 && result.stdout) {
      const dur = parseFloat(result.stdout.trim());
      if (dur > 0) return dur;
    }
  } catch { /* ffprobe not installed — fall through */ }

  // 2) ffmpeg stderr ("Duration: 00:00:12.34")
  try {
    const result = spawnSync("ffmpeg", ["-i", filePath], { timeout: 5_000, encoding: "utf-8" });
    const stderr = result.stderr || "";
    const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (match) {
      return parseInt(match[1], 10) * 3600 + parseInt(match[2], 10) * 60 + parseFloat(match[3]);
    }
  } catch { /* ffmpeg also unavailable — fall through */ }

  // 3) Estimate from file size. MP3 @ 96kbps mono 24kHz → 12000 bytes/sec.
  try {
    if (fs.existsSync(filePath)) {
      const size = fs.statSync(filePath).size;
      if (size > 0) return Math.max(1, Math.round(size / 12000));
    }
  } catch { /* ignore */ }

  return 0;
}

function mixBgmWithVoice(voicePath: string, bgmPath: string, outputPath: string): boolean {
  try {
    const result = spawnSync("ffmpeg", [
      "-y",
      "-i", voicePath, "-i", bgmPath,
      "-filter_complex",
      "[0:a]volume=1.0[voice];[1:a]volume=0.15,afade=t=in:st=0:d=2,afade=t=out:st=30:d=3[bgm];[voice][bgm]amix=inputs=2:duration=longest:dropout_transition=3[aout]",
      "-map", "[aout]",
      "-ac", "1", "-ar", "24000", "-b:a", "96k",
      "-f", "mp3", outputPath
    ], { timeout: 60_000, stdio: "pipe" });
    if (result.status !== 0) {
      console.error("[Audio] FFmpeg mix failed:", result.stderr?.toString().slice(0, 200));
      return false;
    }
    return true;
  } catch {
    console.error("[Audio] FFmpeg not available for mixing");
    return false;
  }
}

function ffmpegAvailable(): boolean {
  try {
    execSync("ffmpeg -version", { timeout: 3_000, stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

// P0: Validate raw audio bytes before treating them as MP3 — prevents writing garbage .mp3 files
function isValidAudioBuffer(buf: Buffer): boolean {
  if (!buf || buf.length < 4) return false;
  // MP3: ID3 tag (ID3) or MPEG sync word 0xFF 0xFB / 0xFF 0xF3 / 0xFF 0xFA
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return true; // ID3
  if (buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0) return true; // MPEG frame sync
  // RIFF/WAV
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return true;
  // OGG
  if (buf[0] === 0x4F && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) return true;
  // AAC ADTS
  if (buf[0] === 0xFF && (buf[1] & 0xF6) === 0xF0) return true;
  return false;
}

// P0: Verify an MP3 file on disk is valid (non-zero size + valid header)
function isValidMp3File(filePath: string): boolean {
  try {
    if (!fs.existsSync(filePath)) return false;
    const stat = fs.statSync(filePath);
    if (stat.size === 0) return false;
    const fd = fs.openSync(filePath, "r");
    const header = Buffer.alloc(4);
    fs.readSync(fd, header, 0, 4, 0);
    fs.closeSync(fd);
    return isValidAudioBuffer(header);
  } catch {
    return false;
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

// P0: On boot, mark any non-terminal jobs as "failed (interrupted by restart)"
// and preserve their metadata so users can retry with the same input.
(function resumeJobsOnBoot() {
  const nonTerminalStatuses = ["queued", "compressing", "tts_generating", "mixing"];
  let resumedCount = 0;
  for (const job of db.generationJobs) {
    if (nonTerminalStatuses.includes(job.status)) {
      job.status = "failed";
      job.errorMessage = "Server restarted — job interrupted. Please retry.";
      job.updatedAt = new Date().toISOString();
      resumedCount++;
    }
  }
  if (resumedCount > 0) {
    console.log(`[Jobs] Marked ${resumedCount} interrupted generation jobs as failed on boot.`);
    saveDBState(db);
  }
})();

// P0: Migrate admin passwords from plaintext to sha256+salt hashes on boot
(function migrateAdminPasswords() {
  let migrated = false;
  for (const admin of db.admins) {
    // If password doesn't start with "sha256:", it's plaintext — hash it
    if (admin.password && !admin.password.startsWith("sha256:")) {
      admin.password = "sha256:" + hashPassword(admin.password);
      migrated = true;
    }
  }
  if (migrated) {
    console.log("[Security] Migrated admin passwords to salted SHA-256 hashes.");
    saveDBState(db);
  }
})();

// P0: Migrate existing stories to have ownerId (default to "user_default")
(function migrateStoryOwners() {
  let migrated = false;
  for (const story of db.userStories) {
    if (!story.ownerId) {
      story.ownerId = "user_default";
      migrated = true;
    }
  }
  if (migrated) {
    console.log("[Security] Migrated existing stories with ownerId.");
    saveDBState(db);
  }
})();

// User-facing data is kept per account. The legacy data.json remains the source
// for the default demo account, while new accounts are written to users.json.
function getUserState(ownerId: string): UserAccount {
  const users = readUserAccounts();
  let account = users.find(user => user.id === ownerId);
  let changed = false;

  if (!account) {
    account = {
      id: ownerId,
      openid: "internal_" + ownerId,
      nickname: "淘淘家长",
      rights: getDefaultUserRights(),
      profile: {
        nickname: "",
        age: 4,
        gender: "boy",
        interests: [],
        parentName: "淘淘家长",
        bedTime: "21:00",
      },
      voiceClones: [],
      notifications: [],
      createdAt: new Date().toISOString(),
    };
    users.push(account);
    changed = true;
  }

  if (!account.profile) {
    account.profile = ownerId === "user_default"
      ? cloneValue(db.profile)
      : { nickname: "", age: 4, gender: "boy", interests: [], parentName: account.nickname || "淘淘家长", bedTime: "21:00" };
    changed = true;
  }
  if (!account.voiceClones) {
    account.voiceClones = ownerId === "user_default" ? cloneValue(db.voiceClones) : [];
    changed = true;
  }
  if (!account.notifications) {
    account.notifications = ownerId === "user_default" ? cloneValue(db.notifications) : [];
    changed = true;
  }
  if (changed) saveUserAccounts(users);
  db.users = users;
  return account;
}

function persistUserState(account: UserAccount) {
  const users = readUserAccounts();
  const index = users.findIndex(user => user.id === account.id);
  if (index >= 0) users[index] = account;
  else users.push(account);
  saveUserAccounts(users);
  db.users = users;
}

// --- API Endpoints ---

// Get everything (P0: requires userAuth; redacted — hides admin passwords, full cdkeys, sensitive words, apiLogs)
app.get("/api/db", userAuth, (req, res) => {
  db = getDBState();
  const ownerId = req.body._ownerId;
  const userState = getUserState(ownerId);

  const redactedAdmins = (db.admins || []).map(a => ({ username: a.username, createdAt: a.createdAt }));
  const redactedCdkeys = (db.cdkeys || []).map(c => ({
    channel: c.channel,
    type: c.type,
    value: c.type === "vip" ? c.value : undefined,
    isUsed: c.isUsed,
    code: c.isUsed ? c.code : "***" + c.code.slice(-3)
  }));
  const redactedSensitiveWords = (db.sensitiveWordsConfig?.sensitiveWords || []).map(w => ({
    category: w.category
  }));

  // P0: Strict owner filtering. Legacy default records are visible only to user_default.
  const userScopedStories = db.userStories.filter(s => s.ownerId === ownerId);

  res.json({
    profile: userState.profile,
    voiceClones: userState.voiceClones,
    userStories: userScopedStories,
    cdkeys: redactedCdkeys,
    invitationRecords: db.invitationRecords.filter(record => record.referredId === ownerId),
    notifications: userState.notifications,
    rights: userState.rights,
    stats: db.stats,
    templates: db.templates,
    config: db.config,
    apiStats: db.apiStats,
    admins: redactedAdmins,
    sensitiveWordsConfig: {
      categories: db.sensitiveWordsConfig?.categories || [],
      sensitiveWords: redactedSensitiveWords,
      auditLogs: (db.sensitiveWordsConfig?.auditLogs || []).slice(0, 3)
    },
    assets: (db.assets || []).filter((a: any) => a.ownerId === ownerId),
    generationJobs: (db.generationJobs || []).filter((job: any) => job.ownerId === ownerId).slice(0, 5),
    quotaLedger: (db.quotaLedger || []).filter((entry: any) => entry.userId === ownerId).slice(0, 5)
  });
});

// Update Child Profile (P0: requires userAuth)
app.post("/api/profile", userAuth, (req, res) => {
  const { nickname, age, gender, interests, parentName, bedTime } = req.body;
  const ownerId = req.body._ownerId;
  const userState = getUserState(ownerId);
  
  userState.profile = {
    nickname: nickname || userState.profile.nickname,
    age: parseInt(age) || userState.profile.age,
    gender: gender || userState.profile.gender,
    interests: Array.isArray(interests) ? interests : userState.profile.interests,
    parentName: parentName || userState.profile.parentName,
    bedTime: bedTime || userState.profile.bedTime
  };

  // Add system stats
  db.stats.profileCompletedCount = (db.stats.profileCompletedCount || 0) + 1;

  // Notification trigger
  const notif: any = {
    id: "notif_" + Date.now(),
    title: "孩子成长画像已更新",
    content: `已成功保存『${userState.profile.nickname}』的成长档案。我们将为您定制最适合${userState.profile.age}岁宝贝年龄的寓教于乐故事。`,
    type: "system",
    isRead: false,
    createdAt: new Date().toISOString()
  };
  userState.notifications.unshift(notif);

  persistUserState(userState);
  res.json({ success: true, profile: userState.profile, notifications: userState.notifications });
});

// Update Config (P0: requires userAuth)
app.post("/api/config", userAuth, (req, res) => {
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

// Voice Cloning Endpoint (P0: requires userAuth)
app.post("/api/voice/clone", userAuth, async (req, res) => {
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
  const ownerId = req.body._ownerId;
  const userState = getUserState(ownerId);
  if (userState.rights.freeVoiceClonesRemaining > 0) {
    userState.rights.freeVoiceClonesRemaining -= 1;
    recordQuotaEntry(ownerId, "voice_clone", -1, "声音克隆", userState.rights.freeVoiceClonesRemaining);
  } else {
    // If no free remaining, consume story generations or require VIP
    if (userState.rights.storyGenerationsRemaining > 0) {
      userState.rights.storyGenerationsRemaining -= 1;
      recordQuotaEntry(ownerId, "story_generation", -1, "声音克隆(消耗故事额度)", userState.rights.storyGenerationsRemaining);
    } else if (!userState.rights.isVip) {
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

  userState.voiceClones!.push(newVoice);
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
  userState.notifications!.unshift(notif);

  logApiCall(
    "/api/voice/clone",
    "POST",
    200,
    stepfunSucceeded ? "Stepfun Voice Clone (stepaudio-2.5-tts)" : "Voice Cloner Simulator",
    stepfunSucceeded ? 1800 : 450,
    0,
    detailMsg
  );

  persistUserState(userState);
  saveDBState(db);
  res.json({ success: true, voice: newVoice, rights: userState.rights, notifications: userState.notifications });
});

// Delete Voice Clone (P0: requires userAuth)
app.post("/api/voice/delete", userAuth, (req, res) => {
  const { id } = req.body;
  const userState = getUserState(req.body._ownerId);
  userState.voiceClones = (userState.voiceClones || []).filter(v => v.id !== id);
  persistUserState(userState);
  res.json({ success: true, voiceClones: userState.voiceClones });
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

// AI Story Text Generation (P0: requires userAuth)
app.post("/api/story/generate-text", userAuth, async (req, res) => {
  const { theme, educationalGoal, scene, mainCharacter, duration, age, isRetry, templateId } = req.body;
  const ownerId = req.body._ownerId;
  const userState = getUserState(ownerId);
  
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
  if (!userState.rights.isVip && userState.rights.storyGenerationsRemaining <= 0) {
    return res.status(400).json({ error: "您当前的故事额度已用尽。请前往兑换激活码或邀请好友获得奖励！" });
  }

  // Cost calculation: Retry check
  let consumed = false;
  if (!userState.rights.isVip) {
    if (isRetry) {
      if (req.body.retryCount && req.body.retryCount > 1) {
        userState.rights.storyGenerationsRemaining -= 1;
        consumed = true;
        recordQuotaEntry(ownerId, "story_generation", -1, "文本故事生成(重试)", userState.rights.storyGenerationsRemaining);
      }
    } else {
      userState.rights.storyGenerationsRemaining -= 1;
      consumed = true;
      recordQuotaEntry(ownerId, "story_generation", -1, "文本故事生成", userState.rights.storyGenerationsRemaining);
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

  const storyPromptInput: StoryPromptInput = {
    templateId,
    theme: theme || "睡前安抚",
    educationalGoal: educationalGoal || "情绪放松",
    scene: scene || "温馨家庭",
    age: Number(age) || 4,
    duration: duration || "short",
    characters: mainCharacters,
  };
  const storybookTemplate = getStorybookTemplate(storyPromptInput);

  console.log(`Generating story text: Theme=${theme}, Character=${primaryCharName}, Age=${age}, Duration=${durationDesc}, Consumed Rights=${consumed}`);

  let generatedStory: any = null;
  const systemPrompt = buildStoryTextPrompt(storyPromptInput, storybookTemplate, expectedChapters, durationDesc);

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
    if (!userState.rights.isVip && consumed) {
      userState.rights.storyGenerationsRemaining += 1;
      recordQuotaEntry(ownerId, "refund", 1, "安全拦截退款(提示词)", userState.rights.storyGenerationsRemaining);
    }
    persistUserState(userState);
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
            prompt: buildCoverImagePrompt(storyPromptInput, { title: parsed.title, abstract: parsed.abstract }, storybookTemplate),
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
          imagePrompt: buildChapterImagePrompt(storyPromptInput, ch, storybookTemplate),
          imageUrl: illustrationStockImages[idx % illustrationStockImages.length]
        })),
        coverPrompt: buildCoverImagePrompt(storyPromptInput, { title: parsed.title, abstract: parsed.abstract }, storybookTemplate),
        templateId: storybookTemplate.id,
        visualStyle: storybookTemplate.visualStyle,
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
                  required: ["chapterNumber", "title", "text"]
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
          imagePrompt: buildChapterImagePrompt(storyPromptInput, ch, storybookTemplate),
          imageUrl: illustrationStockImages[idx % illustrationStockImages.length]
        })),
        coverPrompt: buildCoverImagePrompt(storyPromptInput, { title: parsed.title, abstract: parsed.abstract }, storybookTemplate),
        templateId: storybookTemplate.id,
        visualStyle: storybookTemplate.visualStyle,
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

  // Normalize every provider's result through the same independent visual strategy.
  // The cover prompt describes the whole book; chapter prompts describe only the
  // current interior scene, so an LLM cannot accidentally reuse one as the other.
  if (generatedStory) {
    generatedStory.coverPrompt = buildCoverImagePrompt(
      storyPromptInput,
      { title: generatedStory.title || '温暖的小故事', abstract: generatedStory.abstract || '' },
      storybookTemplate,
    );
    // Never hand the mini-program an uncompressed provider image. Keep the
    // original URL only as a fallback when the provider asset cannot be fetched.
    if (typeof generatedStory.coverUrl === 'string' && /^https?:\/\//i.test(generatedStory.coverUrl)) {
      const coverAsset = await processCoverImage(generatedStory.coverUrl, ownerId);
      if (coverAsset.status === 'ready') {
        generatedStory.coverUrl = assetPublicUrl(coverAsset.storageKey);
      }
    }
    generatedStory.templateId = storybookTemplate.id;
    generatedStory.visualStyle = storybookTemplate.visualStyle;
    generatedStory.chapters = (generatedStory.chapters || []).map((chapter: any, index: number) => ({
      ...chapter,
      chapterNumber: chapter.chapterNumber || index + 1,
      imagePrompt: buildChapterImagePrompt(storyPromptInput, {
        chapterNumber: chapter.chapterNumber || index + 1,
        title: chapter.title || `第${index + 1}章`,
        text: chapter.text || '',
      }, storybookTemplate),
    }));
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
        if (!userState.rights.isVip && consumed) {
          userState.rights.storyGenerationsRemaining += 1; // Refund
          recordQuotaEntry(ownerId, "refund", 1, "安全拦截退款(生成内容)", userState.rights.storyGenerationsRemaining);
        }
        persistUserState(userState);
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
  persistUserState(userState);
  saveDBState(db);

  res.json({
    success: true,
    story: generatedStory,
    rights: userState.rights,
    consumed: consumed
  });
});

// P0 AI Audio / Synthesis with compressed images and background narration jobs
app.post("/api/story/generate-audio", userAuth, async (req, res) => {
  const { story, voiceId, voiceMode, theme, educationalGoal, scene, mainCharacterName, duration, targetAge, bgmType } = req.body;
  
  if (!story) {
    return res.status(400).json({ error: "No story data provided." });
  }

  // P0: ownerId strictly from auth context, never from body or default
  const ownerId = req.body._ownerId;
  if (!ownerId) {
    return res.status(401).json({ error: "用户身份缺失" });
  }
  const userState = getUserState(ownerId);
  const storyTitle = story.title || "未命名故事";
  const inputHash = computeInputHash(story.chapters || [], voiceId || "");

  // P0 Deduplication: check existing job with same inputHash
  // ready jobs → return cached story; failed jobs → also deduplicate (same input = same result)
  const existingReadyJob = db.generationJobs.find(
    j => j.inputHash === inputHash && j.ownerId === ownerId && j.status === "ready"
  );
  const existingFailedJob = db.generationJobs.find(
    j => j.inputHash === inputHash && j.ownerId === ownerId && j.status === "failed"
  );

  if ((existingReadyJob || existingFailedJob) && (existingReadyJob?.resultStoryId || existingFailedJob?.resultStoryId)) {
    const jobToUse = existingReadyJob || existingFailedJob;
    const cachedStory = db.userStories.find(s => s.id === jobToUse!.resultStoryId);
    if (cachedStory) {
      return res.json({
        success: true,
        deduplicated: true,
        savedStory: cachedStory,
        voiceClones: userState.voiceClones,
        notifications: userState.notifications
      });
    }
  }

  // Check if there's a running/incomplete job — return its progress
  const runningJob = db.generationJobs.find(
    j => j.inputHash === inputHash && j.ownerId === ownerId && !["ready", "failed"].includes(j.status)
  );
  if (runningJob) {
    return res.json({
      success: true,
      inProgress: true,
      jobStatus: runningJob.status,
      jobId: runningJob.id
    });
  }

  // Deduct voice usage count
  if (voiceId) {
    const voice = userState.voiceClones?.find(v => v.id === voiceId);
    if (voice) {
      voice.usageCount += 1;
    }
  }

  const storyId = "story_" + Date.now();

  // Create generation job
  const job: GenerationJob = {
    id: "job_" + Date.now(),
    ownerId,
    inputHash,
    storyTitle,
    storyAbstract: story.abstract || "",
    coverUrl: story.coverUrl || "",
    chapters: [...(story.chapters || [])],
    voiceId: voiceId || "voice_default_mom",
    voiceMode: voiceMode || "single",
    bgmType: bgmType || "none",
    theme: theme || "睡前安抚",
    educationalGoal: educationalGoal || "习惯养成",
    scene: scene || "家庭卧室",
    mainCharacterName: mainCharacterName || "主角",
    duration: duration || "short",
    targetAge: targetAge || 4,
    status: "queued",
    progress: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  db.generationJobs.push(job);
  saveDBState(db);

  // Return the job immediately. TTS and media preparation continue in the
  // background; white noise is played separately by the mini-program player.
  res.status(202).json({
    success: true,
    inProgress: true,
    jobId: job.id,
    jobStatus: job.status,
    audioMode: "narration_plus_client_noise"
  });

  try {
    // 1. Process cover image → WebP
    job.status = "compressing";
    job.progress = 10;
    job.updatedAt = new Date().toISOString();
    saveDBState(db);

    let coverAssetRecord: AssetRecord | null = null;
    let finalCoverUrl = story.coverUrl || "https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=500&q=80";
    if (typeof story.coverUrl === "string" && /^https?:\/\//i.test(story.coverUrl)) {
      try {
        coverAssetRecord = await processCoverImage(story.coverUrl, ownerId);
        if (coverAssetRecord.status === "ready") {
          finalCoverUrl = assetPublicUrl(coverAssetRecord.storageKey);
        }
      } catch {
        console.log("[Image] Cover processing skipped, using original URL");
      }
    }

    // 2. Process chapter images → WebP
    const processedChapters = await Promise.all((story.chapters || []).map(async (chapter: any) => {
      let chapterImageUrl = chapter.imageUrl || "";
      let imageAssetId: string | undefined;
      if (/^https?:\/\//i.test(chapterImageUrl)) {
        try {
          const imgAsset = await processChapterImage(chapterImageUrl, ownerId);
          imageAssetId = imgAsset.id;
          if (imgAsset.status === "ready") {
            chapterImageUrl = assetPublicUrl(imgAsset.storageKey);
          }
        } catch {
          console.log(`[Image] Chapter ${chapter.chapterNumber} image processing skipped`);
        }
      }
      return { ...chapter, imageUrl: chapterImageUrl, imageAssetId };
    }));
    job.progress = 25;
    job.updatedAt = new Date().toISOString();
    saveDBState(db);

    // 3. Determine Stepfun speaker voice parameter
    let voiceParam = "xiaomei";
    const activeClone = userState.voiceClones?.find(v => v.id === voiceId);
    if (activeClone) {
      if (activeClone.stepfunSucceeded && activeClone.stepfunVoiceId) {
        voiceParam = activeClone.stepfunVoiceId;
      } else if (activeClone.speakerType === "father") {
        voiceParam = "baineng";
      }
    } else if (voiceId === "voice_default_dad") {
      voiceParam = "baineng";
    }

    let stepfunSucceededCount = 0;

    // 4. Narration TTS runs in the background. No FFmpeg or server-side BGM
    // mixing is needed for the narration-only path.
    if (process.env.STEPFUN_API_KEY && process.env.STEPFUN_API_KEY !== "MY_STEPFUN_API_KEY") {
      job.status = "tts_generating";
      job.progress = 40;
      job.updatedAt = new Date().toISOString();
      saveDBState(db);

      const stepfunApiKey = process.env.STEPFUN_API_KEY;
      fs.mkdirSync(STORAGE_DIR, { recursive: true });

      const audioChapters = await Promise.all(processedChapters.map(async (chapter: any, idx: number) => {
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
            const rawBuffer = Buffer.from(arrayBuffer);
            // Narration-only path: keep the provider's already-compressed audio.
            // Do not invoke FFmpeg here; white noise is a separate player track.
            if (!isValidAudioBuffer(rawBuffer) || rawBuffer.length > 12 * 1024 * 1024) {
              console.error(`[Audio] Chapter ${idx + 1} raw data has no valid audio header, discarding`);
              return chapter; // chapter has no audioUrl
            }

            const audioFormat = rawBuffer[0] === 0x49 && rawBuffer[1] === 0x44 && rawBuffer[2] === 0x33
              ? { extension: "mp3", mimeType: "audio/mpeg" }
              : rawBuffer[0] === 0xFF && (rawBuffer[1] & 0xE0) === 0xE0
                ? { extension: "mp3", mimeType: "audio/mpeg" }
                : rawBuffer[0] === 0x52 && rawBuffer[1] === 0x49
                  ? { extension: "wav", mimeType: "audio/wav" }
                  : rawBuffer[0] === 0x4F && rawBuffer[1] === 0x67
                    ? { extension: "ogg", mimeType: "audio/ogg" }
                    : { extension: "aac", mimeType: "audio/aac" };
            const filename = `${storyId}_ch_${idx}.${audioFormat.extension}`;
            saveAssetFile(filename, rawBuffer);
            const audioAsset: AssetRecord = {
              id: "aud_" + Date.now() + "_" + idx,
              ownerId,
              kind: "audio",
              storageKey: filename,
              mimeType: audioFormat.mimeType,
              sizeBytes: rawBuffer.length,
              sha256: sha256Hex(rawBuffer),
              status: "ready",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            db.assets.push(audioAsset);
            stepfunSucceededCount++;
            return {
              ...chapter,
              audioUrl: assetPublicUrl(filename),
              audioAssetId: audioAsset.id,
              audioSizeBytes: rawBuffer.length
            };
          }
        } catch (chapterErr: any) {
          console.error(`[Audio] Chapter ${idx + 1} TTS failed:`, chapterErr.message);
        }
        return chapter;
      }));

      processedChapters.length = 0;
      processedChapters.push(...audioChapters);
      job.progress = 75;
      job.updatedAt = new Date().toISOString();
      saveDBState(db);
    }

    // 5. Background noise is a separate player track. Never mix it into the
    // narration file on the server, and never make it part of job completion.
    const mixedChapters = [...processedChapters];
    job.progress = 90;
    job.updatedAt = new Date().toISOString();
    saveDBState(db);

    // P0: Build final story — ready if ALL chapters have a valid audioUrl + non-zero file size.
    // Duration is metadata (best-effort), NOT a readiness gate: ffprobe/ffmpeg may be absent
    // and the duration estimate can be 0 in edge cases. Requiring duration>0 caused false
    // "failed" status even when the MP3 file was valid and playable.
    const allReady = mixedChapters.length > 0 && mixedChapters.every((ch: any) =>
      !!ch.audioUrl
      && typeof ch.audioSizeBytes === "number" && ch.audioSizeBytes > 0
    );

    const completeStory: any = {
      id: storyId,
      ownerId, // P0: Track story ownership for cross-user 403 enforcement
      title: storyTitle,
      abstract: story.abstract,
      chapters: mixedChapters,
      coverUrl: finalCoverUrl,
      coverAssetId: coverAssetRecord?.id || undefined,
      isAudioReady: allReady,
      voiceId: voiceId || "voice_default_mom",
      voiceMode: voiceMode || "single",
      createTime: new Date().toISOString(),
      isSavedToDiary: true,
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

    // Update job status
    job.status = allReady ? "ready" : "failed";
    job.resultStoryId = storyId;
    job.updatedAt = new Date().toISOString();

    // Notification
    const notif = {
      id: "notif_" + Date.now(),
      title: `专属有声故事《${storyTitle}》已入库`,
      content: allReady
        ? `已成功生成所有章节音频，保存在宝宝的故事日记本中。`
        : `部分章节音频生成失败，可稍后重试。`,
      type: "story",
      isRead: false,
      createdAt: new Date().toISOString()
    };
    userState.notifications!.unshift(notif);

    const finalSvc = stepfunSucceededCount > 0
      ? `Stepfun stepaudio-2.5-tts (${stepfunSucceededCount}个章节)`
      : "Cosmic TTS v2 Synthesizer";

    logApiCall("/api/story/generate-audio", "POST", 200, finalSvc,
      stepfunSucceededCount > 0 ? 1500 + stepfunSucceededCount * 300 : 820,
      stepfunSucceededCount > 0 ? stepfunSucceededCount * 120 : 680,
      `TTS合成完成，配音章节数: ${stepfunSucceededCount}`
    );

    persistUserState(userState);
    job.progress = 100;
    saveDBState(db);
  } catch (err: any) {
    console.error("[Audio] Generation job failed:", err);
    job.status = "failed";
    job.errorMessage = err.message || "Unknown error";
    job.progress = 100;
    job.updatedAt = new Date().toISOString();
    saveDBState(db);
  }
});

// Poll background narration jobs. White-noise selection is client-side and is
// intentionally not part of this server job.
app.get("/api/story/audio-status/:jobId", userAuth, (req, res) => {
  const ownerId = req.body._ownerId;
  const job = db.generationJobs.find(item => item.id === req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: "音频任务不存在" });
  }
  if (job.ownerId !== ownerId) {
    return res.status(403).json({ error: "无权查看该音频任务" });
  }

  const progressByStatus: Record<string, number> = {
    queued: 0,
    compressing: 25,
    tts_generating: 60,
    mixing: 90,
    ready: 100,
    failed: 100,
  };
  const savedStory = job.resultStoryId
    ? db.userStories.find(story => story.id === job.resultStoryId)
    : undefined;

  return res.json({
    success: true,
    jobId: job.id,
    status: job.status,
    progress: job.progress ?? progressByStatus[job.status] ?? 0,
    error: job.errorMessage,
    story: job.status === "ready" ? savedStory : undefined,
  });
});

// Save Toggle (Favorite or diary) (P0: requires userAuth + cross-user 403)
app.post("/api/story/save-toggle", userAuth, (req, res) => {
  const { id, type } = req.body; // type: 'favorite' or 'diary'
  const story = db.userStories.find(s => s.id === id);
  
  if (story) {
    // P0: Cross-user enforcement — only owner can modify
    if (story.ownerId !== req.body._ownerId) {
      return res.status(403).json({ error: "无权操作该故事" });
    }
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

// Rename Story (P0: requires userAuth + cross-user 403)
app.post("/api/story/rename", userAuth, (req, res) => {
  const { id, title } = req.body;
  const story = db.userStories.find(s => s.id === id);
  if (story && title) {
    if (story.ownerId !== req.body._ownerId) {
      return res.status(403).json({ error: "无权操作该故事" });
    }
    story.title = title;
    saveDBState(db);
    res.json({ success: true, story });
  } else {
    res.status(400).json({ error: "Invalid parameters." });
  }
});

// Delete User Story (P0: requires userAuth + cross-user 403)
app.post("/api/story/delete", userAuth, (req, res) => {
  const { id } = req.body;
  const story = db.userStories.find(s => s.id === id);
  if (story && story.ownerId !== req.body._ownerId) {
    return res.status(403).json({ error: "无权删除该故事" });
  }
  db.userStories = db.userStories.filter(s => s.id !== id);
  saveDBState(db);
  res.json({ success: true, stories: db.userStories });
});

// Redeem CDKey Cards (P0: requires userAuth + quota ledger)
app.post("/api/cdkey/redeem", userAuth, (req, res) => {
  const { code } = req.body;
  const ownerId = req.body._ownerId;
  const userState = getUserState(ownerId);
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
  card.usedBy = userState.profile.parentName || "用户";
  card.usedTime = new Date().toISOString();

  // Apply Rights
  if (card.type === 'times') {
    userState.rights.storyGenerationsRemaining += card.value;
    recordQuotaEntry(ownerId, "cdkey_times", card.value, `CDKey兑换:${code}`, userState.rights.storyGenerationsRemaining);
  } else if (card.type === 'vip') {
    userState.rights.isVip = true;
    const currentExpiry = userState.rights.vipExpiry ? new Date(userState.rights.vipExpiry) : new Date();
    currentExpiry.setDate(currentExpiry.getDate() + card.value);
    userState.rights.vipExpiry = currentExpiry.toISOString();
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
  userState.notifications!.unshift(notif);

  persistUserState(userState);
  saveDBState(db);
  res.json({
    success: true,
    rights: userState.rights,
    cdkeys: db.cdkeys,
    notifications: userState.notifications
  });
});

// Referral Bind Code (P0: requires userAuth + quota ledger)
app.post("/api/referral/bind", userAuth, (req, res) => {
  const { inviteCode } = req.body;
  const ownerId = req.body._ownerId;
  const userState = getUserState(ownerId);
  if (!inviteCode) {
    return res.status(400).json({ error: "请输入邀请码！" });
  }

  if (inviteCode.toUpperCase() === userState.rights.inviteCode) {
    return res.status(400).json({ error: "您不能绑定自己的邀请码！" });
  }

  if (userState.rights.usedInviteCode) {
    return res.status(400).json({ error: "您已绑定过邀请关系，无法重复绑定！" });
  }

  userState.rights.usedInviteCode = inviteCode.toUpperCase();
  db.stats.invitesBoundCount += 1;

  // Grant rewards to both parties (e.g. 2 stories for binder, 2 stories for recommender)
  userState.rights.storyGenerationsRemaining += 2; // For binder
  recordQuotaEntry(ownerId, "invite_reward", 2, "邀请绑定奖励", userState.rights.storyGenerationsRemaining);
  db.stats.invitesCompletedCount += 1;

  // Add record
  const record = {
    id: "invite_rec_" + Date.now(),
    referrerId: inviteCode.toUpperCase(),
    referredId: ownerId,
    referredName: userState.profile.parentName || "淘淘妈妈",
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
  userState.notifications!.unshift(notif);

  persistUserState(userState);
  saveDBState(db);
  res.json({
    success: true,
    rights: userState.rights,
    invitationRecords: db.invitationRecords.filter(record => record.referredId === ownerId),
    notifications: userState.notifications
  });
});

// Manage notifications (P0: requires userAuth)
app.post("/api/notifications/read-all", userAuth, (req, res) => {
  const userState = getUserState(req.body._ownerId);
  userState.notifications!.forEach(n => n.isRead = true);
  persistUserState(userState);
  res.json({ success: true, notifications: userState.notifications });
});

app.post("/api/notifications/delete", userAuth, (req, res) => {
  const { id } = req.body;
  const userState = getUserState(req.body._ownerId);
  userState.notifications = (userState.notifications || []).filter(n => n.id !== id);
  persistUserState(userState);
  res.json({ success: true, notifications: userState.notifications });
});

// Increment Stats - play story (P0: requires userAuth)
app.post("/api/stats/play", userAuth, (req, res) => {
  db.stats.storiesPlayedCount = (db.stats.storiesPlayedCount || 0) + 1;
  saveDBState(db);
  res.json({ success: true, count: db.stats.storiesPlayedCount });
});

// Reset database or set default templates (P0: requires admin session; does NOT return full db)
app.post("/api/admin/reset", adminAuth, (req, res) => {
  // P0: Deep-clone INITIAL_DB_STATE so nested objects (profile, rights, config, etc.)
  // are NOT shared references. A raw { ...spread } only copies the top-level keys.
  const state = JSON.parse(JSON.stringify(INITIAL_DB_STATE));
  db = { ...state, templates: JSON.parse(JSON.stringify(DEFAULT_TEMPLATES)) };
  // P0: Re-hash admin passwords after reset (safety net — INITIAL_DB_STATE already hashed)
  for (const admin of db.admins) {
    if (admin.password && !admin.password.startsWith("sha256:")) {
      admin.password = "sha256:" + hashPassword(admin.password);
    }
  }
  saveDBState(db);
  res.json({ success: true, message: "数据库已重置" });
});

// Simulate API call for monitoring purposes
app.post("/api/admin/simulate-api-call", adminAuth, (req, res) => {
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
  // P0: Do NOT return full db — return redacted summary
  res.json({ success: true, type, apiStats: db.apiStats });
});

// Add template
app.post("/api/admin/template/add", adminAuth, (req, res) => {
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
app.post("/api/admin/template/delete", adminAuth, (req, res) => {
  const { id } = req.body;
  db.templates = db.templates.filter(t => t.id !== id);
  saveDBState(db);
  res.json({ success: true, templates: db.templates });
});

// Toggle template recommendation status
app.post("/api/admin/template/toggle-recommend", adminAuth, (req, res) => {
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

async function exchangeWechatCode(code: string): Promise<{ openid: string }> {
  if (!WECHAT_APP_ID || !WECHAT_APP_SECRET) {
    throw new Error("微信登录服务未配置");
  }

  const query = new URLSearchParams({
    appid: WECHAT_APP_ID,
    secret: WECHAT_APP_SECRET,
    js_code: code,
    grant_type: "authorization_code",
  });
  const response = await safeFetch(`https://api.weixin.qq.com/sns/jscode2session?${query.toString()}`);
  const payload: any = await response.json();
  if (!payload?.openid || payload.errcode) {
    throw new Error(payload?.errmsg || "微信登录凭证无效");
  }
  return { openid: payload.openid };
}

function sanitizeNickname(value: unknown): string {
  return String(value || "淘淘家长")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 20) || "淘淘家长";
}

function sanitizeAvatar(value: unknown): string {
  const avatar = String(value || "parent").trim().slice(0, 32);
  return /^[a-z-]+$/.test(avatar) ? avatar : "parent";
}

function getDefaultUserRights(): UserAccount["rights"] {
  return {
    freeVoiceClonesRemaining: 5,
    storyGenerationsRemaining: 3,
    isVip: false,
    inviteCode: "BMTH-" + crypto.randomBytes(2).toString("hex").toUpperCase(),
  };
}

// 微信登录：生产环境必须通过 code2Session，开发环境只能显式开启 DEV_AUTH_MOCK。
app.post("/api/auth/wx-login", async (req, res) => {
  const code = String(req.body?.code || "").trim();
  if (!code || code.length > 512) {
    return res.status(400).json({ error: "微信登录凭证无效" });
  }

  try {
    const openid = DEV_AUTH_MOCK
      ? "dev_" + sha256Hex(code).slice(0, 24)
      : (await exchangeWechatCode(code)).openid;
    const users = readUserAccounts();
    let user = users.find(account => account.openid === openid);
    let changed = false;

    if (!user) {
      user = {
        id: "user_" + sha256Hex(openid).slice(0, 24),
        openid,
        nickname: sanitizeNickname(req.body?.nickname),
        avatar: sanitizeAvatar(req.body?.avatar),
        rights: getDefaultUserRights(),
        createdAt: new Date().toISOString(),
      };
      users.push(user);
      changed = true;
    } else if (req.body?.nickname && user.nickname === "淘淘家长") {
      user.nickname = sanitizeNickname(req.body.nickname);
      changed = true;
    }

    if (changed) saveUserAccounts(users);
    db.users = users;
    const token = createHmacToken(user.id);
    res.json({ success: true, user, token });
  } catch (error: any) {
    const message = error?.message || "微信登录失败";
    const status = message === "微信登录服务未配置" ? 503 : 401;
    res.status(status).json({ error: message });
  }
});

// 原型默认登录仅供显式 DEV_AUTH_MOCK 调试，避免被误当成生产登录接口。
app.post("/api/auth/login", (req, res) => {
  if (!DEV_AUTH_MOCK) {
    return res.status(410).json({ error: "请使用微信登录接口" });
  }
  const defaultUser = db.users[0] || { id: "user_default", nickname: "淘淘妈妈" };
  const token = createHmacToken(defaultUser.id);
  const ownerId = defaultUser.id;
  // P0: Return the full default user payload so the client can bootstrap in one round-trip
  // without a follow-up /api/db call. Assets are owner-scoped (no cross-user leak).
  res.json({
    success: true,
    user: defaultUser,
    token,
    profile: db.profile,
    rights: db.rights,
    voiceClones: db.voiceClones,
    notifications: db.notifications,
    assets: (db.assets || []).filter((a: any) => a.ownerId === ownerId)
  });
});

// P0 Verify token endpoint (uses userAuth middleware — rejects forged tokens)
app.get("/api/auth/verify", userAuth, (req, res) => {
  res.json({ success: true, userId: req.body._ownerId });
});

// Admin Login (P0: returns HMAC-signed admin session token)
app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "请输入管理员账号和密码！" });
  }

  const admin = db.admins.find(a => a.username.trim() === username.trim());
  if (!admin || !admin.password) {
    return res.status(400).json({ error: "管理员账号或密码错误，请核对后再试！" });
  }

  // P0: Verify against hashed password
  if (!verifyPassword(password, admin.password)) {
    return res.status(400).json({ error: "管理员账号或密码错误，请核对后再试！" });
  }

  const token = createAdminSession(admin.username);
  res.json({ success: true, user: { username: admin.username }, adminToken: token });
});

// Create/Register Admin
app.post("/api/admin/register", adminAuth, (req, res) => {
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
    password: "sha256:" + hashPassword(password), // P0: Hash password on registration
    createdAt: new Date().toISOString()
  };

  db.admins.push(newAdmin);
  saveDBState(db);

  res.json({ success: true, message: `管理员【${username}】账号新建成功！` });
});

// Update Safety Word Categories and Sensitivity Settings
app.post("/api/admin/safety-config/update", adminAuth, (req, res) => {
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

// Resolve audit log entry
app.post("/api/admin/safety-config/audit-resolve", adminAuth, (req, res) => {
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
