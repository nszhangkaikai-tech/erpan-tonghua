# 伴梦童话 · 前端架构设计方案

> **文档版本**：v1.0
> **更新日期**：2026-07-19
> **适用范围**：`miniprogram/`（Taro v4.2.1 + React + TypeScript 微信小程序）
> **关联文档**：`README.md`、`backend/PRD.md`、`backend/src/types.ts`

---

## 一、设计目标与原则

### 1.1 项目定位
伴梦童话是一款面向 3–10 岁亲子家庭的"定制化童话故事"小程序。家长通过简单的向导式输入（主题、教育目标、角色、时长），即可为孩子生成专属的图文+语音故事，支持克隆家长声音进行配音。

### 1.2 五项核心原则

| 原则 | 落地策略 |
|------|----------|
| **首屏优先** | 主包 ≤ 1.5MB，关键页（welcome/home/wizard）进主包；重资源页走分包 + preloadRule |
| **离线友好** | 关键数据本地缓存（含 TTL），断网时仍可浏览已生成故事 |
| **单一数据源** | 后端 `DBState` 为权威源，前端缓存仅作展示与离线兜底，禁止本地写入业务态 |
| **模块化扩展** | services/ 按业务域拆分，新增业务模块不触碰 request/auth/store 基础设施 |
| **隐私合规** | 敏感 API（getPhoneNumber/getUserInfo/location）按需触发，提前展示用途说明 |

### 1.3 技术栈基线

- **框架**：Taro v4.2.1（React 18 + TypeScript 5.8）
- **构建**：webpack5，designWidth 750，pxtransform 自动适配
- **样式**：Sass + CSS 变量（design token）
- **状态**：app.globalData + 自研轻量 Store（避免引入 Mobx 增包体积）
- **后端**：Node/Express（本地开发），生产可迁移 CloudBase 云函数
- **AI 模型**：StepFun 单一供应商（step-3.7-flash 文本 / step-image-edit-2 图片 / stepaudio-2.5-tts 语音）

---

## 二、整体架构分层

```
┌────────────────────────────────────────────────────────────┐
│                       Pages（页面层）                        │
│  welcome / home / studio / my / wizard / story / record /   │
│  diary / player / notify / redeem / invite / about          │
└──────────────────────────┬─────────────────────────────────┘
                           │ 调用
┌──────────────────────────▼─────────────────────────────────┐
│                  Components（组件层）                         │
│  基础组件: Button/Card/Tag/Loading/Empty/Avatar/Sheet       │
│  业务组件: StoryCard/CharacterPicker/DurationPicker/        │
│           VoiceCloneCard/ChapterList/AudioPlayer/           │
│           StatCard/ProfileEditor                            │
└──────────────────────────┬─────────────────────────────────┘
                           │ 调用
┌──────────────────────────▼─────────────────────────────────┐
│                   Services（业务服务层）                      │
│  auth.service / story.service / voice.service /             │
│  notify.service / redeem.service / invite.service /         │
│  profile.service                                            │
└──────────────────────────┬─────────────────────────────────┘
                           │ 依赖
┌──────────────────────────▼─────────────────────────────────┐
│              Infrastructure（基础设施层）                    │
│  utils/request.ts   - 统一请求 + 拦截器 + 401 刷新           │
│  utils/auth.ts      - 微信登录态生命周期管理                 │
│  utils/storage.ts   - 本地缓存命名空间 + TTL                │
│  utils/eventBus.ts  - 跨页通信                              │
│  utils/audio.ts     - InnerAudioContext 封装                │
│  utils/recorder.ts  - RecorderManager 封装                  │
│  store/index.ts     - 全局 Store（用户/权限/草稿）           │
│  types/index.ts     - 领域模型 TS 类型                      │
└──────────────────────────┬─────────────────────────────────┘
                           │ HTTPS
┌──────────────────────────▼─────────────────────────────────┐
│              Backend（后端 API · Express）                  │
│  /auth/*  /story/*  /voice/*  /notify/*  /redeem/*  /invite/*│
└────────────────────────────────────────────────────────────┘
```

**分层纪律**：
- 上层可依赖下层，下层禁止反向依赖上层
- Pages 之间不直接 import，跨页数据走 Store 或 EventBus
- Services 之间可组合，但禁止在 Services 中调用 `Taro.xxx` UI API（仅 utils/audio/recorder 等设备封装除外）

---

## 三、前端页面结构与组件划分方案

### 3.1 目标态页面清单（共 13 页）

| 页面路径 | 职责 | 包归属 | 状态 |
|----------|------|--------|------|
| `pages/welcome/index` | 登录闸：微信授权 + 手机号绑定 + 游客入口 | 主包 | ✅ 已完成 |
| `pages/home/index` | 首页：数据概览 + CTA + 最近故事 | 主包 | ✅ 已完成（待完善） |
| `pages/studio/index` | 故事屋：故事列表 + 筛选 | 主包 | ✅ 占位（待完善） |
| `pages/my/index` | 我的：资料 + 入口聚合 | 主包 | ✅ 占位（待完善） |
| `pages/wizard/index` | 故事定制向导：5 步表单 | 主包 | ✅ 已完成 |
| `pages/story/index` | 故事预览：章节列表 + 试听 | 主包 | ✅ 已完成 |
| `pages/record/index` | 声音复刻录音：6 段跟读 + 上传 | **分包 A**（voice） | ⏳ 待补 |
| `pages/diary/index` | 故事日记本：按时间归档 | **分包 B**（library） | ⏳ 待补 |
| `pages/player/index` | 沉浸式播放器：章节连播 + 进度 | **分包 B**（library） | ⏳ 待补 |
| `pages/notify/index` | 通知中心：系统/订阅消息归档 | **分包 C**（user-center） | ⏳ 待补 |
| `pages/redeem/index` | 兑换激活码：输入 + 校验 | **分包 C**（user-center） | ⏳ 待补 |
| `pages/invite/index` | 邀请好友：分享 + 记录 | **分包 C**（user-center） | ⏳ 待补 |
| `pages/about/index` | 关于：版本/协议/反馈 | **分包 C**（user-center） | ⏳ 待补 |

### 3.2 分包策略（包体积预算）

```
主包（≤ 1.5MB）
├── 6 个核心页 + 基础组件 + 基础设施 + 设计 token
└── 目标体积：~1.2MB（含 Taro 运行时 ~400KB）

分包 A：voice（声音复刻，~300KB）
├── pages/record/
└── 录音相关业务组件

分包 B：library（故事宝库，~400KB）
├── pages/diary/
├── pages/player/
└── 播放器/列表业务组件

分包 C：user-center（用户中心附属，~250KB）
├── pages/notify/
├── pages/redeem/
├── pages/invite/
└── pages/about/
```

**preloadRule 配置**（在 `app.config.ts`）：

```typescript
preloadRule: {
  'pages/home/index': {
    network: 'wifi',
    packages: ['voice', 'library']
  },
  'pages/my/index': {
    network: 'all',
    packages: ['user-center']
  }
}
```

- 首页在 WiFi 下预加载声音复刻和故事宝库分包（用户最可能进入的次级流）
- 我的页在所有网络下预加载 user-center 分包（低频但体积小）

### 3.3 组件三层划分

#### 基础组件层 `components/base/`
- **职责**：纯 UI、无业务、可跨项目复用
- **目录**：`components/base/{Button,Card,Tag,Loading,Empty,Avatar,Sheet,Divider}/`
- **规范**：
  - 只接收 props，不发业务请求
  - 样式通过 design token 实现，不硬编码颜色
  - 必须支持 `className` 透传以便页面覆写

#### 业务组件层 `components/business/`
- **职责**：承载单一业务语义，可跨页复用
- **目录**：`components/business/{StoryCard,CharacterPicker,DurationPicker,VoiceCloneCard,ChapterList,AudioPlayer,StatCard,ProfileEditor}/`
- **规范**：
  - 可调用 services 层，但调用入口由父页面注入（依赖反转）
  - 对外暴露 `onXxx` 事件回调，不直接 navigateTo

#### 页面级组件 `components/page/`
- **职责**：特定页面专属、不可复用
- **命名**：`components/page/{pageName}-*/`
- **示例**：`components/page/wizard-step-theme/`、`components/page/wizard-step-characters/`

### 3.4 组件通信规范

| 场景 | 方案 |
|------|------|
| 父→子 | props 传值（推荐） |
| 子→父 | 回调函数 `onXxx`（推荐） |
| 兄弟组件 | 提升到父组件 state 或通过 Store |
| 跨页通信 | `utils/eventBus.ts`（发布订阅） |
| 全局状态变更 | `store/index.ts` + EventBus 广播 |

**EventBus 使用纪律**：
- 仅用于"跨页"且"无强时序要求"的场景（如：录音完成通知列表刷新）
- 强时序场景必须用 Promise 串联或 Store 同步读取
- 事件名以 `{domain}:{action}` 命名（如 `voice:clone-created`、`story:audio-ready`）

---

## 四、数据层设计

### 4.1 数据流模型

```
┌──────────┐  setData   ┌──────────┐
│  View    │ ◀───────── │   Page   │
│ (WXML)   │            │  State   │
└──────────┘            └────┬─────┘
                             │ 读写
                             ▼
                      ┌─────────────┐
                      │    Store    │  ◀── 全局状态（用户态/权限/草稿）
                      │  (内存)     │
                      └──────┬──────┘
                             │ 同步
                             ▼
                      ┌─────────────┐
                      │  Storage    │  ◀── 本地缓存（持久化 + TTL）
                      │ (Taro API)  │
                      └──────┬──────┘
                             │ 命中失效
                             ▼
                      ┌─────────────┐
                      │  Services   │  ◀── 业务服务（封装 API 调用）
                      └──────┬──────┘
                             │ HTTPS
                             ▼
                      ┌─────────────┐
                      │   Backend   │
                      │  (DBState)  │
                      └─────────────┘
```

### 4.2 本地缓存策略（`utils/storage.ts`）

#### 命名空间设计

所有 key 统一前缀 `bm_`，避免与其他小程序污染。按业务域划分二级前缀：

| Key 命名 | 含义 | TTL | 清理时机 |
|----------|------|-----|----------|
| `bm_token` | 用户会话 token | 永久（后端控制过期） | 401 时清除 |
| `bm_refresh_token` | 刷新 token | 30 天 | 刷新失败时清除 |
| `bm_user_profile` | 用户基本信息缓存 | 1 小时 | 退出登录时清除 |
| `bm_logged_in` | 是否完成登录闸 | 永久 | 用户主动退出 |
| `bm_phone_bound` | 是否已绑手机号 | 永久 | — |
| `bm_draft_story` | 当前故事草稿（wizard→story 传递） | 24 小时 | story 页消费后清除 |
| `bm_recent_stories` | 最近故事列表缓存（首页用） | 5 分钟 | — |
| `bm_voice_clones` | 声音克隆列表缓存 | 10 分钟 | 新增克隆后失效 |
| `bm_notifications_unread` | 未读通知数 | 5 分钟 | 进入通知中心后失效 |
| `bm_wizard_form` | 向导表单暂存（防丢失） | 7 天 | 提交成功后清除 |
| `bm_tourist` | 游客模式标记 | 永久 | 完成登录后清除 |

#### 存储封装 API

```typescript
// utils/storage.ts 设计草案
export interface CacheOptions {
  ttl?: number;          // 过期时间（毫秒），0 表示永久
  namespace?: string;    // 二级前缀，默认 'bm'
}

export const storage = {
  get<T>(key: string, defaultValue?: T): T | undefined;
  set<T>(key: string, value: T, options?: CacheOptions): void;
  remove(key: string): void;
  has(key: string): boolean;
  clearByPrefix(prefix: string): void;     // 批量清理某业务域
  clearAll(): void;                         // 仅用于退出登录
  isExpired(key: string): boolean;
};
```

#### 过期机制
- 写入时记录 `__expires_at` 字段
- 读取时校验，过期自动清除并返回 `undefined`
- 启动时执行一次"惰性清理"：扫描所有 `bm_` 前缀 key，清除已过期项

#### 容量管理
- 微信小程序本地存储上限 10MB
- 监听 `Taro.getStorageInfoSync()`，当剩余空间 < 1MB 时按 LRU 清理非关键缓存（保留 `bm_token` / `bm_logged_in` / `bm_draft_story`）

### 4.3 服务端数据交互策略

#### 拉取模式

| 场景 | 策略 |
|------|------|
| 首页数据 | **缓存优先** + 后台静默刷新（先展示缓存，请求回来后 diff 更新） |
| 故事列表 | **网络优先**，失败回退缓存 |
| 故事详情 | **网络优先**，离线时读缓存 |
| 用户资料 | **缓存优先**，进入 my 页强制刷新一次 |
| 声音克隆列表 | **网络优先** + 短缓存（10 分钟） |
| 通知未读数 | **缓存优先** + 5 分钟 TTL |

#### 同步与冲突
- 前端**不主动写入业务数据**（写操作一律走后端 API）
- 后端写入成功后，前端**主动失效相关缓存**（如新建声音克隆后 `storage.remove('bm_voice_clones')`）
- 列表数据使用 `updatedAt` 时间戳做增量更新（后续迭代支持）

#### 离线兜底
- 关键页（home/story/diary）在请求失败时读缓存展示
- 显示"离线模式"提示条，引导用户重试
- 故事音频文件采用**断点续传 + 本地路径缓存**（`Taro.downloadFile` + `Taro.saveFile`）

### 4.4 全局 Store 设计（`store/index.ts`）

```typescript
// store/index.ts 设计草案
interface AppState {
  user: {
    isLoggedIn: boolean;
    isTourist: boolean;
    phoneBound: boolean;
    profile: UserProfile | null;
  };
  rights: AppUserRights | null;          // 卡密兑换的权益
  draftStory: StoryDraft | null;          // 当前故事草稿
  recentStories: UserStory[];             // 最近故事
  voiceClones: VoiceClone[];              // 声音克隆列表
  unreadNotifyCount: number;              // 未读通知数
}

// 使用 React Context + useReducer 实现，避免引入 Mobx
// 暴露 useAppStore() Hook 供页面消费
```

**Store 使用纪律**：
- 仅放"跨页共享"的状态，页面私有状态保留在 Page 的 state
- Store 更新必须通过 `dispatch(action)`，禁止直接修改
- Store 变更同步写入 Storage（持久化关键状态）

---

## 五、用户登录与鉴权机制

### 5.1 登录态生命周期

```
启动小程序
    │
    ▼
┌─────────────────────────┐
│ 1. 读取 bm_logged_in     │
└────────┬────────────────┘
         │
    ┌────┴────┐
    │         │
   true     false
    │         │
    ▼         ▼
进入 home   进入 welcome
    │         │
    │         ▼
    │    welcome 三步态：
    │    ① wx.login → code
    │    ② POST /auth/wechat-login {code}
    │       → 后端返回 bm_token + refresh_token
    │    ③ getPhoneNumber → POST /auth/bind-phone
    │       → 完成绑定
    │         │
    │         ▼
    └─────────┴──→ reLaunch /pages/home/index
```

### 5.2 wx.login → 后端会话兑换

**前端流程**（`utils/auth.ts`）：

```typescript
export async function ensureLogin(): Promise<LoginResult> {
  // 1. 检查本地 token 是否有效
  const token = storage.get<string>('bm_token');
  if (token && !storage.isExpired('bm_token')) {
    return { token, fromCache: true };
  }

  // 2. 调用 wx.login 获取 code
  const { code } = await Taro.login();
  if (!code) throw new Error('wx.login 失败');

  // 3. 用 code 换取后端会话
  const result = await request<LoginResponse>({
    url: '/auth/wechat-login',
    method: 'POST',
    data: { code },
    skipAuth: true,   // 标记此请求不需要带 token
  });

  // 4. 持久化
  storage.set('bm_token', result.accessToken);
  storage.set('bm_refresh_token', result.refreshToken, { ttl: 30 * 24 * 3600 * 1000 });
  storage.set('bm_user_profile', result.user, { ttl: 3600 * 1000 });
  storage.set('bm_logged_in', true);

  return { token: result.accessToken, fromCache: false };
}
```

**后端契约**（待补端点）：

```
POST /auth/wechat-login
Body: { code: string }
Response: {
  accessToken: string;
  refreshToken: string;
  user: UserProfile;
  rights: AppUserRights;
}
```

后端实现要点：
- 用 `code` 调用微信 `code2Session` 接口换取 `openid` + `session_key`
- 生成自有 `bm_token`（JWT，有效期 2 小时）+ `refresh_token`（30 天）
- `session_key` 仅存后端，**绝不返回前端**（微信安全规范）

### 5.3 401 自动刷新机制

```typescript
// utils/request.ts 中的响应拦截器
let isRefreshing = false;
let pendingQueue: Array<() => void> = [];

async function handle401(originalOptions: RequestOptions) {
  // 已在刷新中：排队等待
  if (isRefreshing) {
    return new Promise((resolve, reject) => {
      pendingQueue.push(() => {
        request(originalOptions).then(resolve).catch(reject);
      });
    });
  }

  isRefreshing = true;
  try {
    const refreshToken = storage.get<string>('bm_refresh_token');
    if (!refreshToken) throw new Error('无 refresh_token');

    const result = await request<RefreshResponse>({
      url: '/auth/refresh',
      method: 'POST',
      data: { refreshToken },
      skipAuth: true,
    });

    storage.set('bm_token', result.accessToken);
    if (result.refreshToken) {
      storage.set('bm_refresh_token', result.refreshToken, { ttl: 30 * 24 * 3600 * 1000 });
    }

    // 释放队列
    pendingQueue.forEach(cb => cb());
    pendingQueue = [];

    // 重试原请求
    return request(originalOptions);
  } catch (err) {
    // 刷新失败：清空登录态，跳回 welcome
    storage.clearAll();
    Taro.reLaunch({ url: '/pages/welcome/index' });
    throw err;
  } finally {
    isRefreshing = false;
  }
}
```

**关键设计点**：
- **并发锁**：`isRefreshing` 防止多个 401 同时触发多次刷新
- **请求队列**：刷新期间的请求挂起到队列，刷新成功后依次重放
- **失败兜底**：刷新失败清空所有登录态，避免脏数据残留

### 5.4 权限分级

| 等级 | 标识 | 可访问功能 |
|------|------|-----------|
| 游客 | `bm_tourist=true` | 仅可浏览首页/故事屋列表（只读），不可生成/克隆/兑换 |
| 已登录 | `bm_logged_in=true` 且 `bm_phone_bound=true` | 全部功能 |
| 已购卡密 | `rights.storyQuota > 0` 或 `rights.voiceCloneQuota > 0` | 解锁对应配额 |

**权限校验位置**：
- 页面级：在 `onLoad` 中通过 `authService.checkAccess('feature')` 校验，不通过则跳转 welcome 或 redeem
- 操作级：在按钮点击时校验，弹出引导（去登录 / 去兑换）

```typescript
// services/auth.service.ts
export const authService = {
  checkAccess(feature: 'story' | 'voice' | 'redeem'): { allowed: boolean; reason?: string } {
    const { isLoggedIn, isTourist, rights } = useAppStore().state.user;

    if (isTourist) {
      return { allowed: false, reason: '游客模式不可使用此功能，请先登录' };
    }
    if (!isLoggedIn) {
      return { allowed: false, reason: '请先登录' };
    }

    if (feature === 'story' && rights?.storyQuota <= 0) {
      return { allowed: false, reason: '故事配额已用完，请兑换激活码' };
    }
    if (feature === 'voice' && rights?.voiceCloneQuota <= 0) {
      return { allowed: false, reason: '声音克隆配额已用完，请兑换激活码' };
    }

    return { allowed: true };
  }
};
```

### 5.5 隐私合规要点

| API | 触发时机 | 用途说明（必须在页面上展示） |
|-----|----------|---------------------------|
| `getPhoneNumber` | welcome 页"绑定手机号"按钮 | "用于账号关联与权益发放" |
| `getUserProfile` | my 页"完善资料"按钮 | "用于个性化故事角色定制" |
| `getLocation` | 暂不使用 | — |
| `getRecorderManager` | record 页"开始录音"按钮 | "用于克隆您的声音为故事配音" |

**隐私协议前置**：
- 首次进入小程序时弹出隐私协议弹窗
- 用户同意后才可继续操作
- 在 `app.tsx` 的 `onLaunch` 中调用 `Taro.requirePrivacyAuthorize()`（基础库 2.32.3+）
- 在 `app.json` 中通过 `requiredPrivateInfos` 显式声明使用的敏感 API（基础库 2.32.3+）

---

## 六、页面路由规划与状态管理方案

### 6.1 完整路由表

```typescript
// app.config.ts 目标态
export default {
  pages: [
    'pages/welcome/index',
    'pages/home/index',
    'pages/studio/index',
    'pages/my/index',
    'pages/wizard/index',
    'pages/story/index',
  ],
  subPackages: [
    {
      root: 'subpackages/voice',
      pages: ['pages/record/index'],
    },
    {
      root: 'subpackages/library',
      pages: ['pages/diary/index', 'pages/player/index'],
    },
    {
      root: 'subpackages/user-center',
      pages: ['pages/notify/index', 'pages/redeem/index', 'pages/invite/index', 'pages/about/index'],
    },
  ],
  preloadRule: {
    'pages/home/index': { network: 'wifi', packages: ['voice', 'library'] },
    'pages/my/index': { network: 'all', packages: ['user-center'] },
  },
  // ...window/tabBar 配置
};
```

### 6.2 路由跳转规范

| API | 使用场景 | 示例 |
|-----|----------|------|
| `Taro.navigateTo` | 普通页跳转（保留返回栈） | home → wizard |
| `Taro.redirectTo` | 替换当前页（不增加栈深度） | welcome → home（登录后） |
| `Taro.reLaunch` | 重启到某页（清空栈） | 退出登录 → welcome |
| `Taro.switchTab` | 切换 tabBar 页 | home ↔ studio ↔ my |
| `Taro.navigateBack` | 返回上一页 | wizard → home |

**参数传递**：
- 简单参数：URL query（`?id=xxx&type=yyy`）
- 复杂对象：写入 Store 或 Storage 后跳转（避免 URL 过长）

```typescript
// utils/router.ts 推荐封装
type RouteName =
  | 'welcome' | 'home' | 'studio' | 'my' | 'wizard' | 'story'
  | 'record' | 'diary' | 'player'
  | 'notify' | 'redeem' | 'invite' | 'about';

const ROUTE_PATHS: Record<RouteName, string> = {
  welcome: '/pages/welcome/index',
  home: '/pages/home/index',
  studio: '/pages/studio/index',
  my: '/pages/my/index',
  wizard: '/pages/wizard/index',
  story: '/pages/story/index',
  record: '/subpackages/voice/pages/record/index',
  diary: '/subpackages/library/pages/diary/index',
  player: '/subpackages/library/pages/player/index',
  notify: '/subpackages/user-center/pages/notify/index',
  redeem: '/subpackages/user-center/pages/redeem/index',
  invite: '/subpackages/user-center/pages/invite/index',
  about: '/subpackages/user-center/pages/about/index',
};

export function navigateTo(route: RouteName, params?: Record<string, any>) {
  const path = ROUTE_PATHS[route];
  const query = params && Object.keys(params).length
    ? '?' + Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
    : '';
  return Taro.navigateTo({ url: path + query });
}
```

### 6.3 全局状态管理（Store）

**技术选型**：React Context + useReducer（自研轻量方案）

**理由**：
- 不引入 Mobx/Pinia 等第三方库，节省包体积
- 业务复杂度尚未到需要状态机
- 与 React 生态契合度高

**Store 结构**：

```typescript
// store/index.ts
import { createContext, useContext, useReducer, useEffect } from 'react';

interface AppState { /* 见 4.4 */ }

type Action =
  | { type: 'HYDRATE'; payload: Partial<AppState> }
  | { type: 'SET_USER'; payload: Partial<AppState['user']> }
  | { type: 'SET_RIGHTS'; payload: AppUserRights }
  | { type: 'SET_DRAFT_STORY'; payload: StoryDraft | null }
  | { type: 'SET_RECENT_STORIES'; payload: UserStory[] }
  | { type: 'SET_VOICE_CLONES'; payload: VoiceClone[] }
  | { type: 'SET_UNREAD_COUNT'; payload: number }
  | { type: 'LOGOUT' };

const AppContext = createContext<{ state: AppState; dispatch: Dispatch<Action> } | null>(null);

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // 启动时从 Storage 恢复关键状态
  useEffect(() => {
    const persisted = storage.get<Partial<AppState>>('bm_app_state');
    if (persisted) dispatch({ type: 'HYDRATE', payload: persisted });
  }, []);

  // 状态变更时持久化
  useEffect(() => {
    storage.set('bm_app_state', state);
  }, [state]);

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useAppStore() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppStore must be used within AppProvider');
  return ctx;
}
```

### 6.4 跨页通信（EventBus）

```typescript
// utils/eventBus.ts
type EventHandler = (payload?: any) => void;

class EventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map();

  on(event: string, handler: EventHandler): () => void {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler);
    return () => this.off(event, handler);  // 返回取消订阅函数
  }

  off(event: string, handler: EventHandler): void {
    this.handlers.get(event)?.delete(handler);
  }

  emit(event: string, payload?: any): void {
    this.handlers.get(event)?.forEach(h => h(payload));
  }
}

export const eventBus = new EventBus();

// 事件名规范：{domain}:{action}
export const Events = {
  VOICE_CLONE_CREATED: 'voice:clone-created',
  STORY_AUDIO_READY: 'story:audio-ready',
  STORY_DRAFT_SAVED: 'story:draft-saved',
  NOTIFY_UNREAD_UPDATED: 'notify:unread-updated',
  USER_LOGOUT: 'user:logout',
} as const;
```

**使用示例**：

```typescript
// record 页录音完成后
eventBus.emit(Events.VOICE_CLONE_CREATED, { id: 'xxx', name: '爸爸的声音' });

// my 页监听刷新
useEffect(() => {
  const unsubscribe = eventBus.on(Events.VOICE_CLONE_CREATED, () => {
    refreshVoiceClones();
  });
  return unsubscribe;  // 页面卸载时自动取消订阅
}, []);
```

---

## 七、接口层封装与错误处理机制

### 7.1 升级后的 `utils/request.ts`

```typescript
// utils/request.ts 升级方案
import Taro from '@tarojs/taro';
import { storage } from './storage';

const BASE_URL = process.env.TARO_API_BASE || 'http://localhost:3000';

export interface RequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: Record<string, any>;
  header?: Record<string, string>;
  skipAuth?: boolean;          // 跳过 token 注入（用于登录/刷新接口）
  skipErrorHandler?: boolean;   // 跳过全局错误处理（用于自定义 toast）
  retry?: number;               // 重试次数，默认 0
  cacheKey?: string;            // 启用缓存时的 key
  cacheTTL?: number;            // 缓存有效期（毫秒）
}

export interface ApiResponse<T = any> {
  code: number;                 // 业务码：0 成功，非 0 失败
  data: T;
  message: string;
  requestId?: string;
}

export function request<T = any>(options: RequestOptions): Promise<T> {
  // 1. 缓存命中检查
  if (options.cacheKey) {
    const cached = storage.get<T>(options.cacheKey);
    if (cached && !storage.isExpired(options.cacheKey)) {
      // 后台静默刷新
      doRequest<T>(options).catch(() => {});
      return Promise.resolve(cached);
    }
  }

  return doRequest<T>(options);
}

async function doRequest<T>(options: RequestOptions): Promise<T> {
  const token = storage.get<string>('bm_token');
  const header: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.header,
  };
  if (!options.skipAuth && token) {
    header['Authorization'] = `Bearer ${token}`;
  }

  return new Promise<T>((resolve, reject) => {
    Taro.request({
      url: BASE_URL + options.url,
      method: options.method || 'GET',
      data: options.data,
      header,
      timeout: 15000,
      success: (res) => {
        // HTTP 状态码处理
        if (res.statusCode === 401) {
          return handle401(options).then(resolve).catch(reject);
        }
        if (res.statusCode >= 500) {
          return reject({
            type: 'server',
            statusCode: res.statusCode,
            message: '服务器开小差了'
          });
        }
        if (res.statusCode >= 400) {
          return reject({
            type: 'client',
            statusCode: res.statusCode,
            message: res.data?.message || '请求失败'
          });
        }

        // 业务码处理
        const body = res.data as ApiResponse<T>;
        if (body.code !== 0) {
          return reject({
            type: 'business',
            code: body.code,
            message: body.message,
            requestId: body.requestId
          });
        }

        // 缓存写入
        if (options.cacheKey) {
          storage.set(options.cacheKey, body.data, {
            ttl: options.cacheTTL || 60000
          });
        }

        resolve(body.data);
      },
      fail: (err) => {
        reject({
          type: 'network',
          message: '网络异常，请检查后重试',
          detail: err
        });
      },
    });
  });
}
```

### 7.2 拦截器分层

```
请求拦截链：
  1. 注入 Authorization header（除 skipAuth 外）
  2. 注入 requestId（用于链路追踪）
  3. 注入 platform/version（埋点用）

响应拦截链：
  1. HTTP 状态码分流（401 / 4xx / 5xx）
  2. 业务码分流（code !== 0）
  3. 缓存写入（如启用）

错误拦截链：
  1. 网络错误 → Toast + 重试按钮
  2. 401 → 自动刷新 → 失败跳 welcome
  3. 5xx → Toast "服务器异常"
  4. 业务错误 → 按 code 映射到具体提示
```

### 7.3 业务码映射表

| 业务码 | 含义 | 前端处理 |
|--------|------|----------|
| 0 | 成功 | — |
| 1001 | 未登录 | 触发 401 流程 |
| 1002 | token 已过期 | 触发 401 流程 |
| 1003 | 权限不足 | 引导去兑换页 |
| 2001 | 故事配额已用完 | 引导去兑换页 |
| 2002 | 声音克隆配额已用完 | 引导去兑换页 |
| 3001 | 卡密无效 | Toast 提示 |
| 3002 | 卡密已被使用 | Toast 提示 |
| 4001 | 故事生成中 | 轮询查询 |
| 4002 | 故事生成失败 | Toast + 重试按钮 |
| 5001 | 内容违规 | Toast "请调整后重试" |
| 9999 | 系统异常 | Toast "请稍后重试" |

### 7.4 统一错误处理

```typescript
// utils/error-handler.ts
const BIZ_ERROR_HANDLERS: Record<number, (error: any) => void> = {
  2001: () => Taro.showModal({
    title: '配额不足',
    content: '故事生成配额已用完，是否前往兑换激活码？',
    success: (res) => { if (res.confirm) navigateTo('redeem'); }
  }),
  2002: () => Taro.showModal({
    title: '配额不足',
    content: '声音克隆配额已用完，是否前往兑换激活码？',
    success: (res) => { if (res.confirm) navigateTo('redeem'); }
  }),
  3001: () => Taro.showToast({ title: '激活码无效', icon: 'none' }),
  3002: () => Taro.showToast({ title: '该激活码已被使用', icon: 'none' }),
  5001: () => Taro.showToast({ title: '内容包含敏感信息，请调整后重试', icon: 'none' }),
};

export function handleError(error: any, options?: { silent?: boolean }) {
  if (options?.silent) return;

  // 网络错误
  if (error.type === 'network') {
    Taro.showToast({ title: '网络异常，请检查后重试', icon: 'none' });
    return;
  }

  // 服务器错误
  if (error.type === 'server') {
    Taro.showToast({ title: '服务器开小差了，请稍后重试', icon: 'none' });
    return;
  }

  // 业务错误
  if (error.type === 'business') {
    const handler = BIZ_ERROR_HANDLERS[error.code];
    if (handler) {
      handler(error);
    } else {
      Taro.showToast({ title: error.message || '操作失败', icon: 'none' });
    }
    return;
  }
}
```

### 7.5 Services 业务域拆分

```
services/
├── auth.service.ts        # 登录/刷新/退出/权限校验
├── profile.service.ts     # 用户资料增删改查
├── story.service.ts       # 故事生成/查询/删除
├── voice.service.ts       # 声音克隆/列表/删除
├── notify.service.ts      # 通知列表/已读/未读数
├── redeem.service.ts      # 卡密兑换
├── invite.service.ts      # 邀请记录/分享
└── index.ts               # 统一导出
```

**Service 设计规范**：
- 每个 service 只负责一个业务域
- 方法返回 Promise，不处理 UI（不调 Taro.showToast）
- 错误向上抛，由调用方决定是否 handleError

```typescript
// services/story.service.ts 示例
import { request } from '@/utils/request';

export const storyService = {
  generate(payload: StoryGeneratePayload) {
    return request<StoryGenerateResult>({
      url: '/api/story/generate-text',
      method: 'POST',
      data: payload,
    });
  },

  generateAudio(storyId: string) {
    return request<{ jobId: string }>({
      url: '/api/story/generate-audio',
      method: 'POST',
      data: { storyId },
    });
  },

  list(params?: { page?: number; pageSize?: number }) {
    return request<UserStory[]>({
      url: '/api/story/list',
      data: params,
      cacheKey: 'bm_recent_stories',
      cacheTTL: 5 * 60 * 1000,
    });
  },

  getById(id: string) {
    return request<UserStory>({ url: `/api/story/${id}` });
  },

  pollAudioJob(jobId: string) {
    return request<AudioJobStatus>({
      url: `/api/story/audio-status/${jobId}`,
    });
  },
};
```

### 7.6 请求重试与降级

```typescript
// 带重试的请求（仅对网络错误和 5xx 重试）
async function requestWithRetry<T>(
  options: RequestOptions, maxRetry = 2
): Promise<T> {
  let lastError: any;
  for (let i = 0; i <= maxRetry; i++) {
    try {
      return await doRequest<T>(options);
    } catch (err) {
      lastError = err;
      // 仅网络错误和服务器错误可重试
      if (err.type === 'network' || err.type === 'server') {
        if (i < maxRetry) {
          await new Promise(r => setTimeout(r, 1000 * (i + 1)));
          continue;
        }
      }
      throw err;
    }
  }
  throw lastError;
}
```

**降级策略**：
- 故事生成失败：展示 `generateFallbackStory` 的本地兜底内容（已在后端实现）
- 音频生成失败：提供"仅文本阅读"模式
- 声音克隆失败：标记为 `failed` 状态，展示"重新录制"入口
- 网络异常：所有页面增加"重试"交互 + 缓存回退

---

## 八、约束条件落实对照

| 约束 | 落实方案 | 对应章节 |
|------|----------|----------|
| 微信小程序官方开发规范 | 分层架构、命名空间设计、隐私合规前置 | 二、五 |
| 包体积限制 | 主包 ≤ 1.5MB + 三个分包 + preloadRule | 三.2 |
| 分包加载策略 | voice/library/user-center 三个分包，按页面访问路径预加载 | 三.2、六.1 |
| 首屏加载性能 | 主包仅含核心6页 + 基础组件；缓存优先渲染 | 三.2、四.3 |
| 模块化扩展接口 | services/ 按业务域拆分，新增模块不触基础设施；Store action 可扩展 | 七.5、四.4 |

---

## 九、目标态目录结构

```
miniprogram/
├── app.config.ts              # 全局配置（含分包）
├── app.tsx                    # App 入口 + 微信登录态初始化
├── app.scss                   # 全局样式
├── config/
│   ├── index.ts               # Taro 构建配置
│   ├── dev.ts                 # 开发环境变量
│   └── prod.ts                # 生产环境变量
│
├── src/
│   ├── pages/
│   │   ├── welcome/           # 登录闸（✅）
│   │   ├── home/              # 首页（✅ 待完善）
│   │   ├── studio/            # 故事屋（✅ 待完善）
│   │   ├── my/                # 我的（✅ 待完善）
│   │   ├── wizard/            # 故事定制向导（✅）
│   │   └── story/             # 故事预览（✅）
│   │
│   ├── subpackages/
│   │   ├── voice/
│   │   │   └── pages/
│   │   │       └── record/    # 声音复刻录音（⏳）
│   │   ├── library/
│   │   │   └── pages/
│   │   │       ├── diary/     # 故事日记本（⏳）
│   │   │       └── player/    # 沉浸式播放器（⏳）
│   │   └── user-center/
│   │       └── pages/
│   │           ├── notify/    # 通知中心（⏳）
│   │           ├── redeem/    # 兑换激活码（⏳）
│   │           ├── invite/    # 邀请好友（⏳）
│   │           └── about/     # 关于（⏳）
│   │
│   ├── components/
│   │   ├── base/              # 基础组件（Button/Card/Tag/Loading/Empty/Avatar/Sheet）
│   │   ├── business/          # 业务组件（StoryCard/CharacterPicker/DurationPicker/...）
│   │   └── page/              # 页面级组件（wizard-step-*/record-step-*）
│   │
│   ├── services/              # 业务服务层
│   │   ├── auth.service.ts
│   │   ├── story.service.ts
│   │   ├── voice.service.ts
│   │   ├── notify.service.ts
│   │   ├── redeem.service.ts
│   │   ├── invite.service.ts
│   │   ├── profile.service.ts
│   │   └── index.ts
│   │
│   ├── store/
│   │   └── index.ts           # 全局 Store（Context + useReducer）
│   │
│   ├── utils/
│   │   ├── request.ts         # 统一请求 + 拦截器 + 缓存 + 401 刷新
│   │   ├── auth.ts            # 微信登录态管理
│   │   ├── storage.ts         # 本地缓存命名空间 + TTL
│   │   ├── eventBus.ts        # 跨页通信
│   │   ├── router.ts          # 路由跳转封装
│   │   ├── audio.ts           # InnerAudioContext 封装
│   │   ├── recorder.ts        # RecorderManager 封装
│   │   └── error-handler.ts   # 统一错误处理
│   │
│   ├── styles/
│   │   ├── design-tokens.scss # 设计 token（颜色/间距/字号/圆角）
│   │   ├── mixins.scss        # Sass mixins（flex-center/ellipsis/safe-area）
│   │   └── reset.scss         # 样式重置
│   │
│   └── types/
│       └── index.ts           # TS 类型声明
│
├── package.json
├── tsconfig.json
├── project.config.json
└── babel.config.js
```

---

## 十、实施路线图（对应 Task 清单）

| Task | 内容 | 依赖 | 产出 |
|------|------|------|------|
| #1 | 编写架构设计方案文档 | — | ✅ `docs/ARCHITECTURE.md` |
| #2 | 建立设计 token 与全局样式系统 | #1 | `src/styles/` + `app.scss` 升级 |
| #3 | 升级基础设施层 | #1 | `utils/` 全部模块 + `store/` + `services/` + `types/` |
| #4 | 实现声音复刻录音页 | #2, #3 | `subpackages/voice/pages/record/` |
| #5 | 实现故事日记本与沉浸式播放器 | #2, #3 | `subpackages/library/pages/diary/` + `player/` |
| #6 | 实现通知中心/兑换码/邀请/关于附属页 | #2, #3 | `subpackages/user-center/pages/*` |
| #7 | 完善首页与故事屋，串通业务流 | #3, #4, #5 | `pages/home/` + `pages/studio/` + `pages/my/` |
| #8 | 配置分包加载与构建验证 | #4, #5, #6 | `app.config.ts` 分包 + `npm run build:weapp` |
| #9 | 更新 README 与项目记忆 | #1-#8 | `README.md` + `.workbuddy/memory/` |

---

> **下一步**：开始 Task #2 — 建立设计 token 与全局样式系统。

---
