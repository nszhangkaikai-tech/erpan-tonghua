# 伴梦童话 · CloudBase 迁移方案（Express → 云开发）

> 生成时间：2026-07-21
> 背景：当前代码是「Taro 小程序 + Express 后端（自建服务器）」，
> 但微信小程序正确的服务端应该是 **CloudBase 云开发**（云函数 + 云数据库 + 云存储 + wx.cloud）。
> 之前上线方法不对，根因就是代码没有按云开发结构整理。本方案给出完整迁移蓝图。

---

## 一、为什么之前的方法不对（根因）

| 维度 | 当前做法（错误） | 正确做法（云开发） |
|------|------------------|---------------------|
| 后端 | Express 跑在自建/云服务器，监听 3000 端口 | 云函数（`wx.cloud.callFunction` 调用） |
| 网络 | 前端 `wx.request` 到 `https://域名`，需配**域名白名单** | 前端 `wx.cloud.callFunction`，**无需域名白名单** |
| 认证 | `wx.login` → code → 后端 code2Session（需 **AppSecret**）→ 自建 token | `wx.cloud` 原生身份，`openid` 在云函数里**自动注入且可信** |
| 数据库 | `data.json` 文件（单文件、易丢、无并发） | 云数据库（NoSQL 集合，自动备份） |
| 存储 | 服务器本地 `public/storage`、`public/audio` | 云存储（`wx.cloud.uploadFile`） |
| HTTPS | 自己搞 SSL / 反代 | 云函数与存储**默认 HTTPS** |

**关键结论**：迁移到云开发后，诊断报告里的 #1（BASE_URL=localhost）、#2（AppSecret 空）、#4（域名白名单）、#8（HTTPS）几个阻塞项会**自动消失**——因为根本不再需要自建服务器、域名和 AppSecret。

---

## 二、目标架构

```
┌─────────────────────────────────────────────────────────┐
│                  Taro 微信小程序（front-end）             │
│  app.tsx: wx.cloud.init({ env: 'blacke-...' })           │
│  utils/request.ts → 改为 wx.cloud.callFunction           │
└───────────────┬─────────────────────────────────────────┘
                │  wx.cloud.callFunction / wx.cloud.uploadFile
                ▼
┌─────────────────────────────────────────────────────────┐
│              CloudBase 云开发环境                          │
│  envId: blacke-d7g0wczgza0632d5a                          │
│                                                           │
│  云函数（cloudfunctions/）：                              │
│    mp-user    mp-story    mp-voice    mp-cdkey   mp-admin │
│                                                           │
│  云数据库集合（collections）：                            │
│    users / userStories / voiceClones / cdkeys /           │
│    notifications / rights / stats / templates / ...       │
│                                                           │
│  云存储路径：                                             │
│    voice/{openid}/  audio/{openid}/  images/{openid}/     │
└─────────────────────────────────────────────────────────┘
                │  wx-server-sdk 内部调用
                ▼
        StepFun API（密钥只在云函数里，安全）
```

---

## 三、认证重构（最大的简化点，必须做）

### 删除的接口
- `POST /api/auth/wx-login`（依赖 AppSecret + code2Session）→ **整个删除**
- `POST /api/auth/login`（DEV mock 登录）→ 删除
- `GET /api/auth/verify`（自建 token 校验）→ 删除
- 自建 HMAC token 体系（`createHmacToken` / `userAuth` 中间件 / `adminSessions`）→ **删除**

### 新的身份模型
云函数里统一用：
```js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()  // 微信验过的可信 openid
  // 用 OPENID 当作用户主键，替代原来的 user.id / _ownerId
}
```

前端**不再需要** login 流程，也不需要存 token。`wx.cloud.init` 之后直接调云函数，openid 自动带上。

> 注意：原代码用 `user.id`（如 `user_xxx`）当主键、`db.users` 数组存储。
> 迁移到云数据库后，**主键改为 `OPENID`**，原 `_ownerId` 全部替换为 `OPENID`。
> 历史数据（data.json 里的 `users` + `userStories` 等）需做一次迁移脚本，把 `openid` 字段设为 owner 键。

---

## 四、路由 → 云函数映射

把 server.ts 里 ~30 个路由按业务域拆成 **5 个云函数**。每个云函数用 `event.action` 分发，
保留原业务逻辑（StepFun 调用、安全词校验、额度扣减等），只改「取身份」和「读写数据」两层。

| 云函数名 | 原路由 | 说明 |
|----------|--------|------|
| **mp-user** | `GET /api/db` | 拉取当前用户全部数据（按 OPENID 过滤） |
| | `POST /api/profile` | 更新昵称/头像 |
| | `POST /api/config` | 用户配置 |
| | `POST /api/notifications/read-all` | 标记已读 |
| | `POST /api/notifications/delete` | 删除通知 |
| | `POST /api/stats/play` | 播放统计 |
| **mp-story** | `POST /api/story/generate-text` | StepFun 生成故事文本 |
| | `POST /api/story/generate-audio` | StepFun TTS + 混音（异步 job） |
| | `GET /api/story/audio-status/:jobId` | 轮询音频任务状态 |
| | `POST /api/story/save-toggle` | 收藏切换 |
| | `POST /api/story/rename` | 重命名 |
| | `POST /api/story/delete` | 删除 |
| **mp-voice** | `POST /api/voice/clone` | StepFun 声音克隆 |
| | `POST /api/voice/delete` | 删除声纹 |
| **mp-cdkey** | `POST /api/cdkey/redeem` | 兑换码 |
| | `POST /api/referral/bind` | 邀请绑定 |
| **mp-admin** | `POST /api/admin/login` | 管理员登录（保留，用云函数内哈希校验） |
| | `POST /api/admin/reset` | 重置用户数据 |
| | `POST /api/admin/template/add` | 模板管理 |
| | `POST /api/admin/template/delete` | 模板删除 |
| | `POST /api/admin/template/toggle-recommend` | 模板推荐 |
| | `POST /api/admin/safety-config/update` | 安全词配置 |
| | `POST /api/admin/safety-config/audit-resolve` | 安全审计处理 |
| | `POST /api/admin/simulate-api-call` | 调试用（可保留） |

### 云函数骨架（以 mp-story 为例）
```js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { action } = event

  switch (action) {
    case 'generate-text':
      return await generateText(OPENID, event)
    case 'generate-audio':
      return await generateAudio(OPENID, event)
    case 'audio-status':
      return await getAudioStatus(OPENID, event.jobId)
    case 'save-toggle':
      return await toggleSave(OPENID, event)
    case 'rename':
      return await renameStory(OPENID, event)
    case 'delete':
      return await deleteStory(OPENID, event)
    default:
      return { error: 'unknown action' }
  }
}
```

---

## 五、数据模型 → 云数据库集合

`data.json` 的 18 个顶层 key **直接映射为集合**。每用户数据用 `openid` 字段做归属，
集合权限规则用「仅创建者可读写」（admin 集合设为「仅管理端可写」）。

| 集合名 | 来源 key | 权限建议 | 备注 |
|--------|----------|----------|------|
| `users` | users | 仅创建者读写 | 用 openid 当 `_id` |
| `userStories` | userStories | 仅创建者读写 | 加 `openid` 字段 |
| `voiceClones` | voiceClones | 仅创建者读写 | 加 `openid` 字段 |
| `cdkeys` | cdkeys | 仅管理端写 | 兑换码全局表 |
| `invitationRecords` | invitationRecords | 仅创建者读写 | |
| `notifications` | notifications | 仅创建者读写 | |
| `rights` | rights | 仅创建者读写 | 用户权益 |
| `stats` | stats | 仅创建者读写 | |
| `templates` | templates | 所有人可读、管理端写 | 故事模板库 |
| `config` | config | 所有人可读 | 全局配置 |
| `apiStats` | apiStats | 仅管理端写 | |
| `apiLogs` | apiLogs | 仅管理端写 | |
| `admins` | admins | 仅管理端写 | 管理员账号 |
| `sensitiveWordsConfig` | sensitiveWordsConfig | 仅管理端写 | 安全词 |
| `assets` | assets | 仅创建者读写 | 加 `openid` 字段 |
| `generationJobs` | generationJobs | 仅创建者读写 | 异步音频任务 |
| `quotaLedger` | quotaLedger | 仅创建者读写 | 额度流水 |
| `adminSessions` | adminSessions | 仅管理端写 | 管理登录态 |

> 原逻辑里 `db.xxx = users` 这种「直接替换整个数组」的写法要改成
> 云数据库的 `doc().update()` / `collection().where().update()`，避免并发覆盖。

---

## 六、文件存储 → 云存储

原 `public/storage/{key}`、`public/audio` 全部改为云存储路径：

| 用途 | 云存储路径（cloudPath） |
|------|------------------------|
| 录音上传（声音克隆源） | `voice/{OPENID}/{timestamp}.mp3` |
| 生成的故事音频 | `audio/{OPENID}/{storyId}/{chapter}.mp3` |
| 生成的章节插图 | `images/{OPENID}/{storyId}/{chapter}.png` |

前端上传改用 `wx.cloud.uploadFile({ cloudPath, filePath })`，
下载/播放用 `wx.cloud.downloadFile` 或 `cloud.getTempFileURL` 拿临时 URL。

---

## 七、前端改造清单（miniprogram/）

1. **`src/app.tsx`**：`useLaunch` 里加
   ```ts
   Taro.cloud.init({ env: 'blacke-d7g0wczgza0632d5a', traceUser: true })
   ```
   同时把隐私协议授权（`requirePrivacyAuthorize`）一起接上（原诊断 #5）。

2. **`src/utils/request.ts`**：删除 `wx.request` + BASE_URL + token 逻辑，
   改为统一 `callFunction` 封装：
   ```ts
   export const callApi = (name: string, action: string, data: any = {}) =>
     Taro.cloud.callFunction({ name, data: { action, ...data } })
   ```
   所有页面里的 `request({ url: '/api/...' })` 调用相应改为 `callApi('mp-story', 'generate-text', {...})`。

3. **录音/音频上传**：`uploadFile` 改用 `Taro.cloud.uploadFile`。

4. **删除**：所有 token 存取（`access_token`/`refresh_token`）、`/api/auth/wx-login` 调用。

---

## 八、删除 / 不迁移清单（重要，避免重蹈覆辙）

- ❌ **`prototype_temp/`** —— 旧原型，禁止部署
- ❌ **`demoyuanxing/`** —— 旧原型，禁止部署
- ❌ **`backend/src/App.tsx`、`main.tsx`、`components/`** —— 旧的 React 管理后台/模拟器（AdminDashboard、WeChatSimulator），属于开发演示工具，**不是小程序的一部分**，不迁移
- ❌ 后端 `vite.config.ts`、`index.html`、`server.ts` 里的 Vite 集成代码
- ❌ Gemini 残留（`@google/genai` 依赖、import、初始化）
- ❌ 自建 HMAC token 体系、Session_key 概念

---

## 九、分阶段执行计划

**Phase 1 — 工程脚手架**
- 新建 `cloudfunctions/{mp-user,mp-story,mp-voice,mp-cdkey,mp-admin}/index.js` + `package.json`
- 前端 `app.tsx` 加 `cloud.init`、隐私授权
- 写 `request.ts` 的 `callApi` 封装

**Phase 2 — 数据库**
- 在 CloudBase 控制台创建 18 个集合（或写初始化脚本）
- 写迁移脚本：读 `data.json` → 按 openid 拆分写入各集合（含历史用户归属修复）
- 配置各集合权限规则

**Phase 3 — 云函数业务逻辑**
- 5 个云函数逐个实现，移植原 server.ts 的 handler 逻辑（StepFun 调用、安全词、额度）
- 身份层统一用 `cloud.getWXContext().OPENID`

**Phase 4 — 前端对接**
- 全局替换 `request(...)` 为 `callApi(...)`
- 上传/下载走 `wx.cloud.uploadFile` / `getTempFileURL`

**Phase 5 — 存储迁移**
- 历史 `public/storage`、`public/audio` 文件上传到云存储对应路径
- 前端播放/展示改用云存储临时 URL

**Phase 6 — 部署与验证**
- `tcb fn deploy` / 控制台上传云函数
- Taro `npm run build:weapp` → 微信开发者工具上传
- 真机走通：登录→生成故事→录音克隆→播放全流程

---

## 十、用户需在 mp 后台配合的操作（Codex 替代不了）

1. **确认 AppID 并绑定云环境**：
   - 小程序 AppID 以 `project.config.json` 的 `wx268d1063ab9d6f2f` 为准
   - 到微信公众平台 → 云开发 → 绑定到环境 `blacke-d7g0wczgza0632d5d5a` 对应的环境（确认 envId 与小程序一致）
2. **隐私协议**：设置 → 服务内容声明 → 勾选麦克风、手机号等（原诊断 #5）
3. **StepFun API Key**：配置到云函数环境变量（不再写前端、不写公开仓库）
4. （可选）若仍保留某个自建 HTTP 域名，才需要配白名单；纯云开发路径不需要。

---

## 十一、迁移后「原诊断报告」阻塞项的状态

| 原 P0 项 | 迁移后状态 |
|----------|-----------|
| #1 BASE_URL=localhost | ✅ 自动解决（改 callFunction） |
| #2 WECHAT_APP_SECRET 空 | ✅ 自动解决（不再需要 code2Session） |
| #3 AppID 不一致 | ⚠️ 仍需确认，但不再影响登录；按 Phase 1 注释统一 |
| #4 域名白名单 | ✅ 自动解决（callFunction 同源） |
| #5 隐私协议 | 🟡 仍需在 mp 后台配置（用户操作） |
| #6 弱密码 | 🟡 改为云函数环境变量/密钥管理，强密码 |
| #7 Gemini 残留 | ✅ 随后端重写一并删除 |
| #8 HTTPS | ✅ 自动解决（云函数默认 HTTPS） |
| #9 JSON 文件 DB | ✅ 改为云数据库 |
| #10 Vite 残留 | ✅ 随后端重写删除 |

---

## 十二、给 Codex / 执行者的优先级建议

**P0（必做，否则跑不起来）**：
- 目标架构（第二节）、认证重构（第三节，删 token）、路由映射（第四节）、
  前端 init + callApi 封装（第七节 1/2）

**P1（强烈建议）**：
- 数据集合创建 + 迁移脚本（第五、Phase 2）
- 5 个云函数业务逻辑移植（Phase 3）
- 存储迁移（第六、Phase 5）

**P2（收尾）**：
- 历史文件上传云存储
- 删除 prototype_temp / demoyuanxing / 旧 React 后台（第八节）
- 真机全流程验证（Phase 6）
