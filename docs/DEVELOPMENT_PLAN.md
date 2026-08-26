# 伴梦童话 · Vibe Coding 开发计划

> 基准：PRD 14 大页面 + 原型 `WeChatSimulator.tsx`（3635 行完整实现）+ 交付包现状
> 方式：Vibe Coding —— 前后端并行推进，每完成一个模块立即编译验证

---

## 一、现状盘点

### 前端（Taro 小程序）

| 模块 | 状态 | 说明 |
|------|------|------|
| Taro 工程脚手架 | ✅ | Taro v4.2.1 + React 18 + TS，可编译导入微信开发者工具 |
| 欢迎页 welcome | ✅ 基础 | 微信授权 + 手机号绑定 + 游客模式，缺品牌视觉 |
| 首页 home | ⚠️ 简化 | 仅 4 个数字卡片 + CTA，缺会员卡/功能入口/模板推荐 |
| 故事屋 studio | ⚠️ 占位 | 仅标题 + 提示 + CTA |
| 向导页 wizard | ⚠️ 基础 | 单页表单，原型是 9 步分步向导 |
| 故事页 story | ⚠️ 基础 | 章节列表 + 播放，缺封面/插图/沉浸式体验 |
| 我的 my | ⚠️ 占位 | 仅文字提示 |

### 后端（Express 服务）

| 端点 | 状态 | 说明 |
|------|------|------|
| `GET /api/db` | ✅ | 全量数据读取 |
| `POST /api/profile` | ✅ | 资料保存 |
| `POST /api/config` | ✅ | 主题/目标/场景配置 |
| `POST /api/voice/clone` | ⚠️ 半成品 | 有 StepFun 调用但用 dummy WAV，未接收真实录音文件 |
| `POST /api/voice/delete` | ✅ | 声音删除 |
| `POST /api/story/generate-text` | ✅ | StepFun step-3.7-flash 文本生成 + 安全拦截 |
| `POST /api/story/generate-audio` | ⚠️ 半成品 | 同步 TTS 合成，缺异步任务状态机 + BGM 混音 |
| `POST /api/story/save-toggle` | ✅ | 收藏/保存 |
| `POST /api/story/rename` | ✅ | 重命名 |
| `POST /api/story/delete` | ✅ | 删除 |
| `POST /api/cdkey/redeem` | ✅ | 兑换码 |
| `POST /api/referral/bind` | ✅ | 邀请绑定 |
| `POST /api/notifications/*` | ✅ | 通知已读/删除 |
| `POST /api/admin/*` | ✅ | 管理后台全套 |
| `POST /api/stats/play` | ✅ | 播放统计 |

### 后端缺失（需新建）

| 缺失项 | 优先级 | 说明 |
|--------|--------|------|
| **用户认证体系** | P0 | `POST /api/auth/wx-login`（code → openid + token），当前无登录态 |
| **手机号解密** | P0 | `POST /api/auth/bind-phone`（getPhoneNumber code → 解密） |
| **多用户支持** | P0 | 当前 data.json 是全局单用户，需按 openid 分用户存储 |
| **Token 中间件** | P0 | 所有业务 API 需验证 Authorization header |
| **封面/插图生成** | P1 | step-image-edit-2 真实调用，当前 fallback 用 Unsplash 假图 |
| **录音文件上传** | P1 | 声音克隆需接收 multipart/form-data 录音文件 |
| **异步音频任务** | P1 | jobId + 状态机（queued/tts_generating/mixing/ready/failed） |
| **白噪音音频** | P2 | 4 种白噪音静态文件（soft_noise/rain/waves/wind） |
| **BGM 混音** | P2 | FFmpeg 混音（TTS 音频 + 白噪音背景） |

### 原型完整功能（目标）

| 页面状态 | 对应 PRD | 功能 |
|----------|----------|------|
| welcome | 8.1 欢迎/登录 | 品牌页 + 微信授权弹窗（头像选择） |
| profile_setup | 8.2 资料完善 | 孩子昵称/年龄/性别/兴趣/家长称呼/ bedtime |
| tab_home | 8.3 首页 | 会员卡 + 功能入口 + 最近播放 + 推荐模板 + 通知铃铛 |
| wizard (9步) | 8.5 定制向导 | 主题→教育目标→场景→主角→时长→年龄→声音模式→确认 |
| text_wait | 8.6 文本等待 | 加载动画 + 进度提示 |
| text_preview | 8.7 文本预览 | 章节展示 + 重新生成 + 确认合成 |
| audio_wait | 8.8 音频等待 | TTS 合成进度 |
| player | 8.9 沉浸播放 | 封面 + 章节音频 + 白噪音 + 收藏 |
| diary | 8.10 日记本 | 故事列表 + 筛选 + 重命名 + 删除 |
| template_list | 8.11 模板库 | 分类浏览 + 使用模板 |
| tab_my | 8.12 我的 | 孩子资料 + 声音克隆 + 通知 + 兑换码 + 邀请 + 关于 |
| config_maintenance | 8.13 配置维护 | 主题/目标/场景 增删改 |

---

## 二、技术替换映射（Vite+React 原型 → Taro 小程序）

| 原型技术 | Taro 替代 | 说明 |
|----------|-----------|------|
| `lucide-react` 图标 | 自定义 SVG 组件 / 小程序 icon | 封装 Icon 组件，内联 SVG |
| `motion/react` 动画 | CSS transition/animation | 小程序不支持 motion 库 |
| Web Audio API 白噪音 | `Taro.createInnerAudioContext` | 需后端提供白噪音音频文件 |
| `<audio>` 标签 | `Taro.createInnerAudioContext` | 已在 story 页实现 |
| `localStorage` | `Taro.getStorageSync/setStorageSync` | 统一 `bm_` 前缀 |
| `fetch` | `Taro.request`（已封装 request.ts） | 需加 loading 态和错误处理 |
| React Router | Taro 页面路由 `Taro.navigateTo` | 页面跳转 + 参数传递 |
| CSS Modules | SCSS + BEM 命名 | Taro 支持 SCSS |
| HTML5 录音 | `Taro.getRecorderManager()` | 录音 + 上传后端 |
| `setTimeout` 模拟延迟 | 真实异步 API + loading | 替换原型 mock |

---

## 三、分阶段开发计划

### Phase 0 · 地基（前端 + 后端并行）

> 目标：统一全局基建，前后端同步铺路

#### 前端（4 项）

| # | 任务 | 输出 |
|---|------|------|
| F0.1 | 全局 Store（Context + useReducer） | `src/store/index.tsx` — user/db/loading 全局状态 |
| F0.2 | 设计 Token 体系 | `src/styles/tokens.scss` — 中性灰色板 + 间距 + 圆角 |
| F0.3 | Icon 组件库 | `src/components/Icon/index.tsx` — 30+ 内联 SVG 图标 |
| F0.4 | 通用组件 | Modal / Toast / Loading / EmptyState / Card / Skeleton |

#### 后端（3 项）

| # | 任务 | 输出 |
|---|------|------|
| B0.1 | **用户认证体系** | `POST /api/auth/wx-login` — wx.login code → 微信 API 换 openid + session_key → 生成自定义 token（JWT 或随机串），返回 token + user 信息 |
| B0.2 | **Token 认证中间件** | Express middleware — 验证 Authorization header，解析 openid，注入 req.userId |
| B0.3 | **多用户数据隔离** | 重构 data.json → 按 openid 分用户存储：`{ users: { [openid]: { profile, voiceClones, userStories, rights, notifications } } }` |

> B0.1 需调用微信 `jscode2session` API（AppID + AppSecret），开发期可用 mock openid 先行联调

---

### Phase 1 · 核心用户流（前端 5 步 + 后端 3 步并行）

> 目标：从打开小程序到听完故事，完整走通

#### Step 1 — 欢迎页 + 资料完善 + 登录闭环

| 端 | 任务 | 说明 |
|----|------|------|
| 前端 | 欢迎页品牌视觉 | Logo + 渐变背景 + 动画入场，参考原型行 1067-1100 |
| 前端 | 微信授权弹窗 | 6 个预设头像（🧸🦊🐰🐱🐥🌟）+ 自定义昵称 |
| 前端 | 资料完善表单 | 孩子昵称/年龄/性别/兴趣标签/家长称呼/睡觉时间 |
| 前端 | 登录流程串联 | wx.login → `POST /api/auth/wx-login` → 存 token → getPhoneNumber → `POST /api/auth/bind-phone` |
| **后端** | **手机号解密** | `POST /api/auth/bind-phone` — getPhoneNumber code → 微信 API 解密手机号 → 绑定到用户 |

#### Step 2 — 首页重做

| 端 | 任务 | 说明 |
|----|------|------|
| 前端 | 首页完整 UI | 问候语 + 通知铃铛（未读红点）+ 黑色会员卡 + 4 功能入口 + 最近播放横滚 + 推荐模板网格 |
| 前端 | 数据接入 | `GET /api/db` → 全局 Store，stale-while-revalidate 缓存策略 |
| **后端** | **用户数据接口** | 改造 `GET /api/db` → 按 token 返回当前用户的 profile/stories/rights/notifications/templates |

#### Step 3 — 故事向导 9 步

| 端 | 任务 | 说明 |
|----|------|------|
| 前端 | 9 步分步向导 | 进度条 + 每步独立卡片（主题→目标→场景→主角→时长→年龄→声音模式→选声音→确认） |
| 前端 | 预设标签 + 自定义 | 主题/目标/场景支持预设标签选择 + 自定义输入切换 |
| 前端 | 多主角支持 | 姓名/角色/性格，可增删 |
| 前端 | 声音模式选择 | 单一克隆/多角色/旁白+AI 三种卡片 |
| 前端 | 提交 → 等待页 | 调 `POST /api/story/generate-text` → 跳文本等待页 |

#### Step 4 — 文本等待 + 预览

| 端 | 任务 | 说明 |
|----|------|------|
| 前端 | 等待页动画 | 渐进式提示语 + 加载动画 |
| 前端 | 预览页章节展示 | 折叠/展开章节 + 重新生成按钮（扣额度逻辑）+ 确认合成 |
| 前端 | 安全拦截处理 | safetyBlocked → 提示修改；safetyRewriteSuggestion → 显示建议文案 |
| **后端** | **封面/插图生成** | step-image-edit-2 真实调用：为故事生成封面图 + 每章插图，替换 Unsplash 假图 |

#### Step 5 — 音频等待 + 沉浸播放器

| 端 | 任务 | 说明 |
|----|------|------|
| 前端 | 音频等待页 | 轮询任务状态（jobId → ready），进度提示 |
| 前端 | 沉浸播放器 | 封面图 + 章节列表 + 逐章播放 + 白噪音选择 + 收藏/保存 |
| 前端 | 白噪音混音 | 4 种白噪音选择（soft_noise/rain/waves/wind） |
| **后端** | **异步音频任务** | 改造 `POST /api/story/generate-audio` → 返回 jobId → 后台异步 TTS 合成 → `GET /api/story/audio-status/:jobId` 查询状态（queued/tts_generating/ready/failed） |
| **后端** | **白噪音音频文件** | 生成或集成 4 种白噪音 MP3 到 `public/bgm/` |

---

### Phase 2 · 辅助功能页（前端 4 步 + 后端 2 步并行）

#### Step 6 — 故事日记本 + 模板库

| 端 | 任务 | 说明 |
|----|------|------|
| 前端 | 日记本 | 故事卡片列表 + 筛选 + 重命名 + 删除 + 点击播放 |
| 前端 | 模板库 | 分类浏览 + 模板卡片 + 使用模板（跳向导预填） |

#### Step 7 — 我的页完整版

| 端 | 任务 | 说明 |
|----|------|------|
| 前端 | 我的页完整 UI | 孩子资料卡 + 声音克隆列表 + 通知入口 + 兑换码弹窗 + 邀请好友 + 关于 |
| **后端** | **录音文件上传** | 改造 `POST /api/voice/clone` → 支持 multipart/form-data 接收真实录音文件（multer/busboy），上传 StepFun 声音克隆 |

#### Step 8 — 声音复刻录音页

| 端 | 任务 | 说明 |
|----|------|------|
| 前端 | 录音页 | RecorderManager 录音 + 时长显示（≥5s）+ 试听 + 类型选择 + 提交（Taro.uploadFile） |

#### Step 9 — 通知中心 + 配置维护

| 端 | 任务 | 说明 |
|----|------|------|
| 前端 | 通知中心 | 列表 + 全部已读 + 删除 |
| 前端 | 配置维护 | 主题/目标/场景 增删改（管理员入口） |

---

### Phase 3 · 打磨与部署（2 步）

#### Step 10 — BGM 混音 + 性能优化

| 端 | 任务 | 说明 |
|----|------|------|
| **后端** | **BGM 混音** | FFmpeg 混音 worker（TTS 音频 + 白噪音背景音轨），CloudBase 部署时用云函数 |
| 前端 | 骨架屏 + 包体积优化 | 关键页面骨架屏、图片懒加载、主包 ≤1.5MB 检查 |

#### Step 11 — 部署上线

| 端 | 任务 | 说明 |
|----|------|------|
| **后端** | **CloudBase 部署** | 云函数（API）+ 云存储（音频/图片）+ 云数据库（用户数据迁移） |
| **后端** | **域名配置** | request 合法域名、uploadFile 合法域名、downloadFile 合法域名 |
| 前端 | 真机测试 | iOS + Android 微信真机预览 + 体验版提交 |

---

## 四、页面路由规划

```
主包（≤1.5MB）
├── pages/welcome/index        # 8.1 欢迎/登录
├── pages/profile/index        # 8.2 资料完善
├── pages/home/index           # 8.3 首页（tab）
├── pages/studio/index         # 故事屋（tab）→ 模板库入口
├── pages/my/index             # 8.12 我的（tab）
├── pages/wizard/index         # 8.5 定制向导（9步）
├── pages/story-preview/index  # 8.6+8.7 文本等待+预览
├── pages/story-player/index   # 8.8+8.9 音频等待+沉浸播放
├── pages/diary/index          # 8.10 故事日记本
└── pages/template/index       # 8.11 模板库

分包 voice（声音复刻）
└── pages/voice-record/index   # 8.4 录音页

分包 user-center（用户中心附属）
├── pages/notification/index   # 8.14 通知中心
├── pages/config/index         # 8.13 配置维护
└── pages/about/index          # 关于页
```

---

## 五、执行顺序总览

```
Phase 0  地基（前后端并行）
  ├─ 前端：Store / Token / Icon / 组件
  └─ 后端：认证体系 / Token 中间件 / 多用户隔离
    ↓
Phase 1  核心流（前端 5 步 + 后端 3 步并行）
  ├─ Step 1  欢迎+资料+登录闭环（后端：手机号解密）
  ├─ Step 2  首页重做（后端：用户数据接口改造）
  ├─ Step 3  向导 9 步
  ├─ Step 4  文本预览（后端：封面/插图生成）
  └─ Step 5  播放器（后端：异步音频任务 + 白噪音）
    ↓
Phase 2  辅助页（前端 4 步 + 后端 2 步并行）
  ├─ Step 6  日记本 + 模板库
  ├─ Step 7  我的页（后端：录音文件上传）
  ├─ Step 8  录音页
  └─ Step 9  通知中心 + 配置维护
    ↓
Phase 3  打磨与部署
  ├─ Step 10 BGM 混音 + 性能优化
  └─ Step 11 CloudBase 部署 + 真机测试
```

**后端工作量汇总**：

| 优先级 | 后端任务 | 所属步骤 |
|--------|----------|----------|
| P0 | 用户认证（wx-login + token） | Phase 0 · B0.1 |
| P0 | Token 中间件 | Phase 0 · B0.2 |
| P0 | 多用户数据隔离 | Phase 0 · B0.3 |
| P0 | 手机号解密 | Phase 1 · Step 1 |
| P0 | 用户数据接口改造 | Phase 1 · Step 2 |
| P1 | 封面/插图生成（step-image-edit-2） | Phase 1 · Step 4 |
| P1 | 异步音频任务状态机 | Phase 1 · Step 5 |
| P1 | 录音文件上传（multer） | Phase 2 · Step 7 |
| P2 | 白噪音音频文件 | Phase 1 · Step 5 |
| P2 | BGM 混音（FFmpeg） | Phase 3 · Step 10 |
| P2 | CloudBase 部署 | Phase 3 · Step 11 |

**每步完成后**：前端 `npm run build:weapp` 编译 → 微信开发者工具验证；后端 `npm test` 跑行为测试 → 确认后再进行下一步
