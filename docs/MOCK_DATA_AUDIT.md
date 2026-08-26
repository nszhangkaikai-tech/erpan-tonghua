# 前端 Mock / 硬编码假数据排查报告

> 排查范围：`miniprogram/src` 下全部 `.tsx` / `.ts`（页面 + store + utils）
> 结论先行：本项目**主数据已接入后端**（store 通过 `GET /api/db` 拉取 `mp-user.getUserData` 返回完整 `DBState`），
> 真正的"假数据"集中在 **5 个页面的静态枚举/选项列表** 与 **播放器的演示模式/假交互**。下表逐页列出。

---

## 一、哪些页面使用了假数据（含文件路径与行号）

| # | 页面 | 文件路径 | 假数据 / 硬编码内容 | 行号 | 类型 | 性质 |
|---|------|----------|---------------------|------|------|------|
| 1 | 模板列表 | `src/pages/template/index.tsx` | `THEME_OPTIONS`（主题筛选枚举） | 11 | `string[]` | 静态枚举，应来自后端 `config.themes` |
| 2 | 故事向导 | `src/pages/wizard/index.tsx` | `THEME_OPTIONS`（同模板页） | 11 | `string[]` | 同上 |
| 3 | 故事向导 | `src/pages/wizard/index.tsx` | `GOAL_MAP`（主题→教育目标映射） | 12-19 | `Record<string,string[]>` | 静态映射，应来自 `config.educationalGoals` |
| 4 | 故事向导 | `src/pages/wizard/index.tsx` | `SCENE_OPTIONS`（场景枚举） | 20 | `string[]` | 静态枚举，应来自 `config.scenes` |
| 5 | 故事向导 | `src/pages/wizard/index.tsx` | `BGM_OPTIONS`（向导页背景音选项） | 21-27 | `{key,label}[]` | 静态选项，建议纳入 `config.bgmOptions` |
| 6 | 孩子档案 | `src/pages/profile/index.tsx` | `INTERESTS`（兴趣枚举） | 10 | `string[]` | 静态枚举，后端暂无对应字段，建议扩展 `config.interests` 或保留常量 |
| 7 | 播放器 | `src/pages/story-player/index.tsx` | `BGM_LIST`（含资源 url 的背景音列表） | 11-17 | `{key,label,url,icon}[]` | 静态资源配置（url 指向 `/public/bgm/*.mp3`，需部署到静态托管/云存储） |
| 8 | 播放器 | `src/pages/story-player/index.tsx` | `TIMER_OPTIONS`（睡眠定时选项） | 18 | `string[]` | 纯 UI 常量，可保留 |
| 9 | 首页 | `src/pages/home/index.tsx` | `'淘淘妈妈'`（parentName 兜底） | 58 | `string` | 展示兜底文案，真实值来自 `db.profile.parentName` |
| 10 | 首页 | `src/pages/home/index.tsx` | `'专属有声故事《神奇冒险》已准备好…'`（通知兜底） | 93 | `string` | 展示兜底文案，真实值来自 `db.notifications[].title` |
| 11 | 播放器 | `src/pages/story-player/index.tsx` | `simulateProgress()` 演示模式（无 audioUrl 时模拟进度） | 105, 139 | 逻辑 | 演示兜底，应随后端音频就绪自然消失 |
| 12 | 播放器 | `src/pages/story-player/index.tsx` | `toggleFav()` 仅 `showToast`，**未调后端** | 219 | 行为 | 假交互（收藏未落库） |
| 13 | 播放器 | `src/pages/story-player/index.tsx` | 分享按钮仅 `showToast('分享卡片已复制')` | 420 | 行为 | 假交互（未接 `wx` 转发） |

> 说明：以下页面的主数据均来自 store（真实后端），**未使用假数据**：`diary`、`notification`、`my`、`studio`、`story-preview`、`welcome`。
> 其中 `wizard / story-preview / studio` 之间的草稿、套用模板通过 `Taro.setStorageSync('bm_*')` 跨页传参，属真实业务数据流转，非 mock。

---

## 二、每个页面需要的数据 + 对应后端接口

### 表 A：含假数据的页面（替换目标）

| 页面 | 数据字段 | 类型 | 用途 | 当前来源 | 应替换的后端接口 |
|------|----------|------|------|----------|------------------|
| template | `themes` | `string[]` | 主题筛选标签 | 硬编码 `THEME_OPTIONS` | `GET /api/db` → `db.config.themes` |
| wizard | `themes` | `string[]` | 主题选择 | 硬编码 `THEME_OPTIONS` | `GET /api/db` → `db.config.themes` |
| wizard | `educationalGoals` | `Record<string,string[]>` | 主题→教育目标联动 | 硬编码 `GOAL_MAP` | `GET /api/db` → `db.config.educationalGoals` |
| wizard | `scenes` | `string[]` | 场景选择 | 硬编码 `SCENE_OPTIONS` | `GET /api/db` → `db.config.scenes` |
| wizard | `bgmOptions` | `{key,label}[]` | 背景音选项 | 硬编码 `BGM_OPTIONS` | 建议扩展 `config.bgmOptions`，随 `GET /api/db` 返回 |
| profile | `interests` | `string[]` | 兴趣多选 | 硬编码 `INTERESTS` | 建议扩展 `config.interests`；或保留前端常量 |
| story-player | `bgmList` | `{key,label,url,icon}[]` | 播放器背景音+资源 | 硬编码 `BGM_LIST` | 同上 `config.bgmOptions`（url 走云存储/静态托管） |
| story-player | `timerOptions` | `string[]` | 睡眠定时 | 硬编码 `TIMER_OPTIONS` | 纯 UI 常量，**保留** |
| home | `profile.parentName` | `string` | 欢迎语称呼 | 兜底 `'淘淘妈妈'` | 已真实：`GET /api/db` → `db.profile.parentName` |
| home | `notifications[].title` | `string` | 最新消息文案 | 兜底字符串 | 已真实：`GET /api/db` → `db.notifications` |
| story-player | 收藏状态 `isFavorite` | `boolean` | 收藏切换 | 仅 toast | `POST /api/story/save-toggle` |
| story-player | 分享 | — | 转发故事 | 仅 toast | `wx` 转发（`onShareAppMessage` / `onShareTimeline`） |

### 表 B：主数据已接后端的页面（供对照，无需改）

| 页面 | 主数据字段 | 后端接口（云函数 action） |
|------|------------|---------------------------|
| home | `profile / templates / userStories / notifications / rights` | `GET /api/db` → `mp-user.getUserData` |
| template | `templates`（列表本身） | `GET /api/db` → `db.templates` |
| diary | `userStories` | `GET /api/db` → `db.userStories` |
| notification | `notifications` + 已读/删除 | `GET /api/db`；`POST /api/notifications/read-all`；`DELETE /api/notifications/:id` |
| my | `rights` + 兑换/邀请 | `GET /api/db`；`POST /api/cdkey/redeem`；`POST /api/referral/bind` |
| studio | `voiceClones` + 克隆 | `GET /api/db`；`POST /api/voice/clone`；`DELETE /api/voice/delete` |
| wizard | 生成故事 | `POST /api/story/generate-text`；`POST /api/story/generate-audio` |
| story-preview | 草稿/音频状态 | storage 草稿 + `POST /api/story/generate-*`；`GET /api/story/audio-status/:jobId` |
| profile | 档案读写 | `GET /api/db` → `db.profile`；`POST /api/profile` |
| welcome | 登录态 | `POST /api/auth/wx-login` |

---

## 三、关键发现：前端枚举与后端 config 已不一致 ⚠️

替换成后端 `config` 前必须先对齐，否则选项会错位：

| 字段 | 前端硬编码（wizard/template） | 后端 `config` 实际值（seed.js） | 差异 |
|------|------------------------------|----------------------------------|------|
| `themes` | 睡前安抚 / 勇敢自信 / **友情人际** / **情绪管理** / 习惯养成 / **认知启蒙** | 睡前安抚 / **勇敢与自信** / 习惯养成 / **分享与友爱** / **想象力开发** | 5 项中 4 项不同名 |
| `scenes` | 静谧森林 / 温馨家庭 / 太空星球 / 海底世界 / 魔法城堡 / 恐龙乐园 | 静谧森林 / 彩虹山谷 / 温馨卧室 / 孩子的幼儿园 / 蓝色海洋深处 / 浩瀚太空港 / 神奇魔法城堡 | 完全不同 |
| `educationalGoals` | 前端 `GOAL_MAP` 写死 6 主题各自的子项 | 后端 `educationalGoals: {}`（空对象） | 后端未初始化 |

**建议**：以**后端 `config` 为唯一真源**，前端删除 `THEME_OPTIONS/GOAL_MAP/SCENE_OPTIONS`，改为读取 `db.config`；如希望保留前端默认值，先把后端 `config` 的 `themes/scenes/educationalGoals` 用正确文案补种（可经管理端 `/api/admin/*` 或 `mp-seed` 重播种）。

---

## 四、替换优先级建议

1. **P0（功能错误，必须改）**：`story-player` 的 `toggleFav` 假收藏 → 接 `POST /api/story/save-toggle`；分享假 toast → 接 `wx` 转发。
2. **P1（数据不一致）**：wizard/template/profile 的 `themes/scenes/educationalGoals/interests` 改读 `db.config`；先对齐后端 seed 文案。
3. **P2（体验/资源）**：`BGM_LIST` 的 url 确保部署到静态托管/云存储；`simulateProgress` 演示模式保留为离线兜底但加明确标识。
4. **保留项**：`TIMER_OPTIONS` 等纯 UI 常量无需后端化。

---

## 附：统一的"读配置"改造示例

store 已返回 `db.config`，前端只需把常量替换为读取：

```tsx
// 之前
const THEME_OPTIONS = ['睡前安抚', '勇敢自信', '友情人际', '情绪管理', '习惯养成', '认知启蒙']

// 之后（来自 GET /api/db → db.config）
const { db } = useStore().state
const THEME_OPTIONS = db?.config?.themes ?? []
const SCENE_OPTIONS = db?.config?.scenes ?? []
const GOAL_MAP = db?.config?.educationalGoals ?? {}
```
