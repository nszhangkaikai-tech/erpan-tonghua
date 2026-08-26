# backend（Express）vs cloudfunctions（CloudBase）差异报告

> 生成时间：2026-07-21
> 目的：逐项核对用户关注的 6 个能力点在两端（旧 Express `backend/` 与新 CloudBase `cloudfunctions/`）是否存在、逻辑是否对齐。
> 结论先行：**6 项里 4 项对齐（getUserData / updateConfig / jobId / AI），2 项存在实质差异（FFmpeg·BGM 混音、.webp 真实转码）。**

---

## 0. 架构总览（差异根因）

| 维度 | backend（Express / `backend/server.ts`） | cloudfunctions（CloudBase） |
|---|---|---|
| 运行形态 | 单进程 Node 服务（端口 3000） | 6 个无状态云函数：mp-user / mp-story / mp-voice / mp-cdkey / mp-admin / mp-seed |
| 存储 | 本地文件 `data.json` + `users.json`（fs 读写） | 云数据库集合（users / userStories / voiceClones / notifications / quotaLedger / config / templates / sensitiveWordsConfig / cdkeys / invitationRecords / stats / apiStats / generationJobs / assets / admins / adminSessions） |
| 媒体 | 本地磁盘 `public/storage` + `public/audio` | 云存储（cloud:// fileID + 临时 URL） |
| 鉴权 | HMAC token（`base64url`，7 天）+ 内存 admin session Map | wx-server-sdk 自动注入 OPENID；admin 用无状态 HMAC 签名令牌（8h，username.ts.sig） |
| 系统二进制 | **sharp（图片）、ffmpeg（音频）可用** | **无 sharp、无 ffmpeg**（serverless 环境无系统二进制） |

> 关键根因：CloudBase 云端无 ffmpeg / sharp 系统库，因此所有「需要本地二进制处理」的能力（音频混音、图片真实转码）都被改写或降级。

---

## 1. getUserData（用户维度聚合数据）

| | backend | CloudBase |
|---|---|---|
| 位置 | `GET /api/db`（带 `userAuth` 中间件）→ `getUserState(ownerId)` | `mp-user` action `getUserData(openid)` → `getUserState(openid)` |
| 返回内容 | profile / voiceClones / userStories / cdkeys(脱敏) / invitations / notifications / rights / stats / templates / config / apiStats / **admins(脱敏)** / **sensitiveWordsConfig** / assets / generationJobs / quotaLedger | profile / voiceClones / userStories / invitationRecords / notifications / rights / stats / templates / config / assets / generationJobs / quotaLedger |
| 差异 | 返回里**携带了脱敏后的 admins 与 sensitiveWordsConfig**（虽脱敏，仍属管理端数据） | **硬规则剥离** admins / adminSessions / sensitiveWordsConfig / apiStats / cdkeys（见 `mp-user/index.js:35` 注释） |

**结论：对齐，且 CloudBase 侧更安全**（普通用户响应不再含任何管理端数据）。功能无缺口。

---

## 2. updateConfig（全局配置：themes / educationalGoals / scenes）

| | backend | CloudBase |
|---|---|---|
| 位置 | `POST /api/config`（仅 `userAuth`） | `mp-user` action `updateConfig(openid, body)` |
| 鉴权 | **任意登录用户**即可改全局配置（功能上存在、但鉴权偏弱） | **强制 requireAdmin**（管理员令牌）；普通用户调用直接返回「管理员令牌缺失」（`mp-user/index.js:94-97`） |
| 写入目标 | `db.config`（内存 + 落盘 data.json） | 云数据库 `config` 集合（单文档 upsert） |

**结论：两端均实现；鉴权语义不同——CloudBase 把全局配置变更收敛为管理员操作，比 backend 更正确。** 前端「配置枚举（themes/scenes/educationalGoals）」来自 `getUserData` 的 `config` 字段；后台无独立编辑 UI（Templates / SafetyConfig 页只管模板与敏感词），管理端如需改枚举须以 admin token 调 `mp-user.updateConfig`（见 `docs/ADMIN_DEPLOY.md` 已知问题）。

---

## 3. jobId（异步生成任务状态机）

| | backend | CloudBase |
|---|---|---|
| 数据模型 | `GenerationJob` 接口 + `db.generationJobs`（含 queued/tts_generating/compressing/mixing/ready/failed） | 云数据库 `generationJobs` 集合；`common/db.js` 提供 `addJob / getJob / getJobRaw / updateJob` |
| 触发 | 故事文本生成端点为**同步**（`/api/story/generate-text` 内联 await Stepfun）；job 基础设施存在但主链路未驱动 | `mp-story.generateAudio` **显式建 job**（`queued`→`compressing`→`tts_generating`→`ready/failed`），并暴露 `audioStatus` 轮询端点（`mp-story/index.js:346`） |
| `mixing` 状态 | 枚举含 `mixing` | `progressByStatus` 仍定义 `mixing:90`（`audioStatus`），但 `generateAudio` **从未置为 mixing**（因无 FFmpeg，见 §4），属预留占位 |

**结论：jobId 异步流水线在 CloudBase 端已完整落地（建 job + 状态推进 + 轮询），比 backend 更彻底；`mixing` 状态为“已定义未使用”的占位，待 §4 的 FFmpeg 补齐后启用。**

---

## 4. FFmpeg / BGM 混音 ⚠️ 实质差异

| | backend | CloudBase |
|---|---|---|
| 代码 | `transcodeAudioToMP3` / `getAudioDuration` / `mixBgmWithVoice`（FFmpeg `amix` + `volume=0.15` + `afade`）/ `ffmpegAvailable`（`server.ts:1029-1116`） | **全仓库 0 处 ffmpeg 引用**（grep 确认无匹配） |
| 行为 | 有声故事在**服务端**把 TTS 与 BGM 混为单条 MP3（mono 24kHz 96k） | `generateAudio` 逐章 TTS → 各自上传云存储（`audio/{openid}/...mp3`）；`bgmType` 字段**仅落库、从不参与合成**（`mp-story/index.js:264,321`） |
| BGM 体验 | 成品即“带 BGM 的已混音 MP3” | BGM 由**前端播放器双轨叠加**（TTS + 白噪音联动，见项目 MEMORY「BGM 双轨播放」） |

**结论：重大差异。** 旧 backend 在服务端烘焙 BGM；CloudBase 因无 ffmpeg 改为「客户端双轨播放」，服务端只产出纯 TTS 音频。`bgmType` 已存但流程未消费，属已知待补项（MEMORY 待补：`FFmpeg 后端混音`）。
**影响**：① 离线/分享场景无“已混音”单文件；② 若未来需要服务端混音（如导出、转发），需引入云函数自定义运行时或 CloudBase 自定义容器（带 ffmpeg）。

---

## 5. .webp 图片处理 ⚠️ 实质差异（伪 webp）

| | backend | CloudBase |
|---|---|---|
| 代码 | `compressImageToWebP` 用 **sharp** 真实转码：resize(≤768px) → webp(quality 逐档下调) → 字节上限（封面 ≤220KB / 章节 ≤320KB），并写 metadata + SHA256 | `common/storage.js` 的 `processCoverImage/processChapterImage`：**仅 `safeFetch` 下载源字节 → 直接以 `.webp` 文件名 `uploadBuffer` 上传**，无任何转码/压缩/resize |
| 产物 | 真·WebP（体积受控、尺寸受控） | **文件名是 .webp，内容仍是源站原格式**（Unsplash/Pexels 多为 jpg/png，StepFun 返回 jpg）——实质是“改名不转码” |
| mimeType | `image/webp`（真实） | 存储记录里写 `image/webp`，但字节并非 webp（若下游按 webp 解码会失败） |

**结论：重大差异（实现层面）。** CloudBase 侧为规避 serverless 无 sharp 的限制，用“改名上传”代替真实转码——**省了依赖、但丢失了体积/尺寸优化，且扩展名与真实格式不一致**。
**风险点**：前端若依赖 `cloud://` 文件直接当 webp 解码（尤其跨端 <image> 组件按扩展名推断类型），可能异常；建议要么在存储时按真实格式命名（`.jpg/.png`），要么后续用 CloudBase 图像处理（CDN 实时转 webp）替代。
**取舍**：对小程序内 `<image>` 展示影响不大（微信按实际字节识别），但 SEO/分享图与体积控制会弱于 backend。

---

## 6. AI 模型调用

| | backend | CloudBase |
|---|---|---|
| 供应商 | **StepFun（主）+ Gemini（兜底）** | **StepFun 唯一**（设计如此，MEMORY 明确「StepFun 为唯一 AI 供应商，已移除 Gemini」） |
| 文本 | `step-3.7-flash`；失败/未配置则回落 `gemini-3.5-flash` | `stepfun.generateText`（`step-3.7-flash`），失败回 `generateFallbackStory`（模板离线兜底） |
| 图片 | `step-image-edit-2`（封面）；失败回 stock 图 | `stepfun.generateImage`（`step-image-edit-2`）；**失败则 coverUrl 留空**（不伪装 AI，比 backend 更严谨，`mp-story/index.js:178`） |
| 语音 | `stepaudio-2.5-tts`（synthesizeSpeech）+ `audio/clones`（克隆） | 同 `stepfun.synthesizeSpeech` / `cloneVoice`（模型完全一致） |
| 密钥 | 环境变量 `STEPFUN_API_KEY` / `GEMINI_API_KEY`（服务端） | 云函数环境变量（绝不下发前端，符合安全规范） |

**结论：模型与端点完全对齐（step-3.7-flash / step-image-edit-2 / stepaudio-2.5-tts）。唯一差异是 backend 多一层 Gemini 兜底——CloudBase 用「离线模板兜底 + 不伪造 AI 图」替代，是刻意的单供应商策略，非缺陷。**

---

## 7. 其他值得注意的差异

1. **安全校验（敏感词）**：两端都有 `runSafetyCheck`（输入/提示词/输出三段式）与审计日志。CloudBase 的 `runSafetyCheck(text, sensitive)` 传入配置对象，backend 从 `db.sensitiveWordsConfig` 读——逻辑一致。
2. **配额流水**：两端都有 `quotaLedger`（扣减/退款可审计）。CloudBase 用云数据库写入；backend 用 JSON 文件。
3. **统计**：backend `apiStats` 有 token/延迟聚合；CloudBase `apiStats` 仅由 `mp-admin.simulate-api-call` 模拟写入（真实调用走 `incrStats` 计数，不记 token/延迟明细）——监控粒度比 backend 弱。
4. **管理员会话**：backend 用内存 Map（重启失效）；CloudBase 用 `adminSessions` 集合（但因该环境 `.add()` 偶发丢字段，mp-admin 改用无状态签名令牌，见 `mp-admin/index.js:38`）。
5. **SSRF 防护**：两端 `safeFetch` 都做了私有网段拦截 + 协议白名单 + 大小/超时限制，逻辑一致。

---

## 8. 行动建议

| 优先级 | 项 | 建议 |
|---|---|---|
| 🔴 高 | §4 FFmpeg/BGM | 确认产品是否接受「客户端双轨 BGM」为终态；若要服务端混音，规划带 ffmpeg 的自定义容器/云函数 |
| 🟡 中 | §5 伪 webp | 二选一：① 存储按真实格式命名；② 接入 CloudBase 图像处理做真实 webp 转码；并补齐 mimeType |
| 🟢 低 | §1 管理数据 | CloudBase 已正确处理，无需改动 |
| 🟢 低 | §2 配置编辑 UI | 后台补一个「全局枚举配置」编辑页（调 mp-user.updateConfig + admin token），对齐需求 |
| 🟢 低 | §3 mixing 占位 | FFmpeg 补齐后，在 `generateAudio` 插入 `mixing` 阶段 |

---

## 附：原生小程序项目 env 核对（Documents 下两个工程）

- **`Documents/微信小程序项目`**：`miniprogram/app.js` 第 9 行 `env: 'blacke-d7g0wczgza0632d5a'` ✅ 已正确（前轮已替换你的占位符）。但 `project.config.json` **缺少 `appid` 字段**——若要正式上传到 CloudBase 对应账号，建议补 `"appid": "wx231962cec75efb9e"`（云开发 AppID）。
- **`Documents/x工作/伴梦童话`**：`app.js` 用 `wx.cloud.init({ traceUser: true })` **无 env**，且依赖本地 `./miniprogram/utils/state`；`project.config.json` 为 `appid: "touristappid"` + `libVersion: 3.4.8`。这是**本地 demo 克隆**，刻意不接真实环境，**无需改 env**（改了反而会拉取真实数据）。
