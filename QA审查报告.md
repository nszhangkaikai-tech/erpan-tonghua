# 伴梦童话 — QA 审查报告

> 审查时间：2026-07-20  
> 审查范围：miniprogram（welcome 页）、backend（server.ts / WeChatSimulator / data.json）、构建链、CloudBase 集成评估  
> 严重级别：🔴 P0（阻断/安全） · 🟠 P1（重要缺陷） · 🟡 P2（改进建议）

---

## 一、构建与类型检查

| 检查项 | 命令 | 结果 |
|---|---|---|
| 小程序类型检查 | `npm run type-check` | ✅ 通过 |
| 后端类型检查 | `npm run lint` (tsc --noEmit) | ✅ 通过 |
| 小程序 weapp 构建 | `npm run build:weapp` | ⚠️ 超时未完成（>4分钟），需手动确认。dist/ 已有历史构建产物（21:14 时间戳）。 |
| 后端构建 | `npm run build` | ❌ **失败** |

### 🔴 P0：后端构建失败 — dist/storage 冲突

```
[safe-delete][SAFE_DELETE_BULK_CONFIRM_REQUIRED]
{"count":103,"threshold":50,"scope":"turn",
 "targets":[".../backend/dist/storage"]}
```

**根因**：`vite build` 默认 `emptyOutDir: true`，会清空 `dist/` 目录。而 `dist/storage/` 下有 87 个媒体文件（webp），触发批量删除保护。

**深层原因**：`STORAGE_DIR = path.join(process.cwd(), "public", "storage")`，运行时媒体资产写入 `public/storage`，但 vite 构建时 `public/` 下的文件会被复制到 `dist/`，导致 `dist/storage` 存在大量文件。每次 build 都会尝试清空，形成冲突。

**修复**：
```ts
// vite.config.ts
export default defineConfig(() => ({
  // ...existing
  build: { emptyOutDir: false }, // 方案 A：禁止自动清空
}));
```
或更彻底地：将媒体存储目录移到 `dist/` 之外（如 `./storage/`），与构建输出隔离。

---

## 二、AVATARS / Emoji / Icon 审查

### AVATARS 数组一致性 ✅

| 来源 | 位置 | 值 |
|---|---|---|
| 小程序 | `welcome/index.tsx:8` | `['🧸', '🦊', '🐰', '🐱', '🐥', '🌟']` |
| 原型 | `WeChatSimulator.tsx:1241` | `["🧸", "🦊", "🐰", "🐱", "🐥", "🌟"]` |

两端一致，无差异。

### 🟡 P2：Emoji 跨平台渲染风险

功能卡片使用 `✨`、`🎙️`、`💤`，头像使用 `🧸🦊🐰🐱🐥🌟`。这些 emoji 在 iOS/Android/微信内置浏览器中渲染样式不同（部分设备可能显示为黑白文字而非彩色 emoji）。建议在真机预览确认视觉效果，关键品牌图标考虑用 Icon 组件的 CSS Vector 方案替代。

### Icon 组件 ✅

`miniprogram/src/components/Icon/index.tsx`（426 行）：
- 28+ 种 IconName 联合类型
- EMOJI_ICONS 映射（bell/mic/volume 等）+ CSS Vector 渲染器（Heart/Star/Search/Clock/User/Home/Folder/Trash/Edit/Refresh/Moon）
- ICON_REGISTRY 注册表区分 emoji/css 类型
- ✅ React.memo 优化，displayName='Icon'

**🟡 P2**：Icon 类型中 emoji 和 css 混合，调用方需知道每个 icon 是哪种渲染方式，缺少文档注释。建议在 IconName 类型上标注。

---

## 三、滚动 / 布局 / 表单交互

### 🟠 P1：auth-modal 缺 max-height / overflow-y

`welcome/index.scss` 中 `auth-modal__sheet` 已有 safe-area 适配：
```scss
padding-bottom: calc(32rpx + env(safe-area-inset-bottom));
```

但**缺少 max-height 和 overflow-y**。在小屏设备（iPhone SE / 安卓小屏）上，弹窗内容（头部 + 说明 + 头像选择 + 昵称输入 + 按钮 + 协议提示）可能超出可视区域，底部按钮无法点击。

**修复**：
```scss
.auth-modal__sheet {
  max-height: 85vh;
  overflow-y: auto;
  // ...existing
}
```

### 🟠 P1：Input 缺 maxlength / focus / error

`welcome/index.tsx:161-166` 昵称 Input 组件：

| 属性 | 现状 | 建议 |
|---|---|---|
| `maxlength` | ❌ 缺失（默认140） | 添加 `maxlength={20}` |
| `focus` | ❌ 缺失 | 弹窗打开后自动聚焦：`focus={showAuth}` |
| `error` | ❌ 缺失 | 昵称为空时显示错误提示 |
| `onConfirm` | ❌ 缺失 | 支持键盘确认直接提交 |

### 🟠 P1：handleAccept 缺 loading 防重复

`welcome/index.tsx:32-73`：`handleAccept` 是 async 函数，调用 `Taro.login()` + `request()` 均为异步，但**没有 loading 状态**。用户可在请求过程中连续点击"允许"按钮，触发多次 wx.login 和重复请求。

**修复**：
```tsx
const [loading, setLoading] = useState(false)

const handleAccept = async () => {
  if (loading) return
  setLoading(true)
  try {
    // ...existing logic
  } finally {
    setLoading(false)
  }
}

// Button
<Button onClick={handleAccept} loading={loading}>允许</Button>
```

### 🟡 P2：游客模式与登录模式未区分

`handleTourist`（line 75）设置 `bm_tourist = true`，但需确认 home 页是否检查此标志。如果游客和登录用户看到相同界面，可能导致游客误以为已登录。

---

## 四、/api/auth/wx-login 接口对接

### 🔴 P0：后端不存在 /api/auth/wx-login 端点

**这是最严重的阻断性问题。**

小程序两处调用 `POST /api/auth/wx-login`：
1. `welcome/index.tsx:39-43` — 首次登录
2. `request.ts:52-57` — 401 自动刷新

但后端 `server.ts` 中**根本没有注册这个路由**。后端实际的 auth 端点是：

| 端点 | 行号 | 说明 |
|---|---|---|
| `POST /api/auth/login` | 2532 | 默认用户登录，直接返回 HMAC token，**不接收 code，不调用 code2Session** |
| `GET /api/auth/verify` | 2539 | token 验证（userAuth 保护） |
| `POST /api/admin/login` | 2544 | 管理员登录 |
| `POST /api/admin/register` | 2565 | 管理员注册（adminAuth 保护） |

**影响链**：
1. 小程序 `wx.login()` 获取 code → POST `/api/auth/wx-login` → **404**
2. `welcome/index.tsx` catch 块捕获错误，降级为"本地游客模式"（line 47-50）
3. `bm_token` 从未成功写入 → 所有后续 API 请求无 Authorization header
4. `request.ts` 的 401 刷新逻辑调用 `/api/auth/wx-login` 也 **404** → 刷新永远失败 → 用户被踢回登录页

**结论**：当前所有小程序用户实际上都在"游客模式"运行，token 从未获取成功。后端 `/api/db`、`/api/profile` 等需要 userAuth 的端点全部会返回 401。

**修复方案（二选一）**：

**方案 A（推荐）**：后端新增 `POST /api/auth/wx-login` 端点
```ts
app.post("/api/auth/wx-login", async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: "缺少 code" });
  // 调用微信 code2Session 获取 openid
  const session = await code2Session(code); // 需配置 AppID + AppSecret
  // 查找或创建用户
  let user = db.users.find(u => u.openid === session.openid);
  if (!user) {
    user = { id: "user_" + Date.now(), openid: session.openid, /* ... */ };
    db.users.push(user);
    saveDBState(db);
  }
  const token = createHmacToken(user.id);
  res.json({ success: true, user, token });
});
```

**方案 B**：小程序改调 `/api/auth/login`（仅适用于原型阶段，无真实微信身份）

---

## 五、bm_logged_in 登录态一致性

### 🔴 P0：小程序与原型登录态 key 完全不一致

| 存储 key | 小程序 (welcome/index.tsx) | 原型 (WeChatSimulator.tsx) |
|---|---|---|
| 登录态 | `bm_logged_in` | `banmeng_is_logged_in` |
| token | `bm_token` | 无（原型不走 token 体系） |
| 头像 | `bm_wx_avatar` | 无 |
| 昵称 | `bm_wx_nickname` | 无 |
| 游客 | `bm_tourist` | 无 |
| wx code | `bm_wx_code` | 无 |

原型 `WeChatSimulator.tsx:1286` 直接 `localStorage.setItem("banmeng_is_logged_in", "true")`，**无 wx.login 流程，无 token 获取**，纯本地标记。

### 登录态流程分析

**小程序流程**（welcome/index.tsx）：
```
useDidShow → 检查 bm_logged_in → 跳 home
handleAccept → wx.login → POST /api/auth/wx-login（404失败）→ catch降级 → 设 bm_logged_in=true → 跳转
handleTourist → 设 bm_logged_in=true + bm_tourist=true → 跳 home
```

**问题**：
- 🟠 P1：`bm_wx_code` 存储 wx.login code 到本地（line 54），但 code 是一次性的，存储后已失效，无意义且浪费存储
- 🟠 P1：handleAccept 中 wx-login 失败后仍设置 `bm_logged_in = true`（line 53），导致"登录成功"但实际无 token，后续所有需要认证的 API 请求都会 401

---

## 六、dev-only 逻辑

### server.ts dev/prod 分支 ✅

```ts
// server.ts:2687-2700
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // dev: Vite middleware (HMR)
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    // prod: 静态文件
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }
  app.listen(PORT, "0.0.0.0", ...);
}
```

标准做法，无问题。

### 🟡 P2：DISABLE_HMR 环境变量未定义

`vite.config.ts:17-19` 引用 `process.env.DISABLE_HMR`，但 `.env` 和 `.env.example` 中均未定义此变量。需确认是否依赖外部注入。

### 🟡 P2：PORT 硬编码

```ts
const PORT = 3000; // server.ts:13
```

端口硬编码，未使用 `process.env.PORT`。部署到 CloudBase CloudRun 时需要端口灵活性。

---

## 七、backend/src/data.json 和 admin/reset

### data.json 结构

53KB JSON 文件，包含以下顶层字段：

```
profile · voiceClones · userStories · cdkeys · invitationRecords ·
notifications · rights · stats · templates · config · apiStats ·
apiLogs · admins · sensitiveWordsConfig · assets · generationJobs ·
quotaLedger · adminSessions · users
```

### 🔴 P0：data.json 存储敏感信息

1. **adminSessions 明文 token**（line 1364）：
   ```json
   { "token": "17OW24Moh_pKso2hboYmx6xb7PBBBaeO", "username": "admin", "expiresAt": "2026-07-20T18:32:59.398Z" }
   ```
   Token 明文存储在 JSON 文件中，任何能读取 data.json 的人都能冒充管理员。

2. **admin 密码哈希**（line 833）：
   ```json
   { "username": "admin", "password": "sha256:6bff609c959a6c5847380a1e0f0c3f49669585fb2d8ec80dcc67145fa1681ea0" }
   ```
   虽然已 sha256 哈希（不是明文），但 salt 是全局固定的（`ADMIN_SALT` 环境变量），且 data.json 文件本身无访问控制。

3. **真实用户数据**：userStories 包含生成的故事内容、voiceClones 包含声音克隆记录，属于用户隐私数据。

### admin/reset 端点审查 ✅

```ts
// server.ts:2423-2434
app.post("/api/admin/reset", adminAuth, (req, res) => {
  db = { ...INITIAL_DB_STATE, templates: DEFAULT_TEMPLATES };
  // P0: Re-hash admin passwords after reset
  for (const admin of db.admins) {
    if (admin.password && !admin.password.startsWith("sha256:")) {
      admin.password = "sha256:" + hashPassword(admin.password);
    }
  }
  saveDBState(db);
  res.json({ success: true, message: "数据库已重置" });
});
```

- ✅ 受 `adminAuth` 中间件保护（需管理员 session token）
- ✅ 重置后重新 hash 管理员密码
- ✅ 不返回完整 db
- ⚠️ **P1**：重置不可逆，无二次确认机制。恶意管理员或有泄露 token 的人可一键清空所有用户数据
- ⚠️ **P2**：`{ ...INITIAL_DB_STATE, templates: DEFAULT_TEMPLATES }` — 需确认 INITIAL_DB_STATE 是否覆盖所有 DBState 字段，避免遗漏字段导致后续 `undefined` 访问

---

## 八、安全问题汇总

### 🔴 P0：.env 文件未被 gitignore 保护

- `backend/` 目录下**无 .gitignore 文件**
- 项目根目录**无 .gitignore 文件**
- `backend/.env` 包含明文 `STEPFUN_API_KEY="qpWEwTj2xfswZvldGJmgXCYAhbXF5VFkqqzT9L4EpFcNDKpeqWHhao9HJjitj8KI"`
- `backend/.env.bak` 同样包含密钥（备份文件）
- `backend/src/.host_secret` 包含 HMAC 签名密钥
- `backend/src/data.json` 包含用户数据、admin token、密码哈希

**如果执行 `git add .`，以上所有敏感文件都会被提交。**

**修复**：在 `backend/` 下创建 `.gitignore`：
```
.env
.env.bak
.env.local
src/.host_secret
src/data.json
node_modules/
dist/
uploads/
```

### 🔴 P0：API Key 泄露风险

`.env` 中的 `STEPFUN_API_KEY` 是真实密钥（非占位符），一旦提交到 Git 历史将永久泄露。建议：
1. 立即在 StepFun 控制台轮换 API Key
2. 添加 .gitignore 后检查 git 历史是否有泄露

### 🟠 P1：GEMINI_API_KEY 未配置但代码依赖

`server.ts:49` 检查 `process.env.GEMINI_API_KEY`，但 `.env` 中只有 `STEPFUN_API_KEY`。导致：
- GoogleGenAI 未初始化（`ai = null`）
- 故事文本生成走 "intelligent fallback storytelling"（非 AI 生成）
- PRD 声称 StepFun 是唯一模型供应商，但代码中仍保留 Gemini 逻辑，两者不一致

**建议**：明确模型供应商策略 — 要么配置 GEMINI_API_KEY，要么移除 Gemini 相关代码，将文本生成也接入 StepFun。

---

## 九、CloudBase 集成评估

### 当前架构 vs CloudBase 对照

| 维度 | 当前实现 | CloudBase 对应能力 | 迁移难度 |
|---|---|---|---|
| **后端框架** | Express + Vite 单文件（server.ts 103KB，2700+行） | CloudBase 云函数 / CloudRun | 高 — 需拆分路由为独立函数或容器化 |
| **数据存储** | data.json 文件存储（53KB，读写整个文件） | CloudBase 数据库（NoSQL / MySQL） | 高 — 需重写整个数据层 |
| **用户认证** | 自建 HMAC token + /api/auth/login（无 wx.login） | CloudBase 微信登录（内置 code2Session） | 中 — 替换认证层 |
| **wx-login** | ❌ 后端未实现 | CloudBase SDK 内置 | 低 — 直接用 SDK |
| **文件存储** | 本地 public/storage（vite build 冲突） | CloudBase 云存储 | 中 — 替换存储 API |
| **AI 能力** | GoogleGenAI（未配置）+ StepFun（仅声音克隆） | CloudBase AI 模型接入 | 中 |
| **部署方式** | `npm run build` + `node dist/server.cjs` | CloudBase 部署（CLI / 控制台） | 中 |
| **环境变量** | .env 文件（无 gitignore） | CloudBase 环境变量管理 | 低 — 更安全 |
| **管理后台** | adminAuth session token（明文存 data.json） | CloudBase 权限体系 | 中 |

### 迁移建议（优先级排序）

**1. 认证层（优先级最高）**  
当前 /api/auth/wx-login 缺失是 P0 阻断问题。迁移到 CloudBase 微信登录可直接解决：
- 小程序端：`wx.cloud.init()` → CloudBase 匿名登录 / 微信登录
- 后端：CloudBase SDK 自动处理 code2Session，无需手动实现
- 登录态由 CloudBase 管理，无需自建 HMAC token

**2. 数据存储层**  
data.json → CloudBase NoSQL 数据库：
- 每个顶层 key 对应一个 collection（users、stories、voiceClones、templates...）
- `saveDBState` / `loadDBState` 替换为 CloudBase SDK 的 CRUD 操作
- 解决文件并发写入问题（当前 data.json 全量读写，高并发会丢数据）

**3. 文件存储层**  
public/storage → CloudBase 云存储：
- 上传：`wx.cloud.uploadFile()`
- 下载：`wx.cloud.getTempFileURL()`
- 解决 vite build 与 storage 冲突问题

**4. 后端服务**  
Express 路由 → CloudBase 云函数：
- `/api/story/generate-text` → 独立云函数
- `/api/voice/clone` → 独立云函数
- `/api/admin/*` → 独立云函数（管理员权限）
- 或整体容器化部署到 CloudRun（改动最小）

**5. 环境变量**  
.env → CloudBase 环境变量：
- 在 CloudBase 控制台配置 STEPFUN_API_KEY、GEMINI_API_KEY
- 代码中通过 `process.env` 读取（CloudBase 自动注入）
- 不再有 .env 文件泄露风险

### 迁移收益

- ✅ 解决 /api/auth/wx-login 缺失（CloudBase 内置微信登录）
- ✅ 解决 data.json 并发写入问题（数据库事务）
- ✅ 解决 vite build / storage 冲突（云存储独立）
- ✅ 解决 .env 泄露风险（环境变量管理）
- ✅ 解决 adminSessions 明文存储（CloudBase 权限体系）
- ✅ 域名配置简化（CloudBase 自动提供 HTTPS 域名，无需服务器域名备案）

---

## 十、问题汇总

| # | 级别 | 模块 | 问题 |
|---|---|---|---|
| 1 | 🔴 P0 | 接口对接 | 后端不存在 /api/auth/wx-login 端点，小程序登录流程完全失效 |
| 2 | 🔴 P0 | 安全 | backend 无 .gitignore，.env 含真实 API Key 可被提交 |
| 3 | 🔴 P0 | 安全 | data.json 明文存储 adminSessions token |
| 4 | 🔴 P0 | 构建 | 后端 vite build 因 dist/storage 冲突失败 |
| 5 | 🟠 P1 | 登录态 | 小程序与原型登录态 key 不一致（bm_logged_in vs banmeng_is_logged_in） |
| 6 | 🟠 P1 | 登录态 | wx-login 失败后仍设 bm_logged_in=true，导致假登录 |
| 7 | 🟠 P1 | 表单 | Input 缺 maxlength/focus/error |
| 8 | 🟠 P1 | 交互 | handleAccept 缺 loading 防重复点击 |
| 9 | 🟠 P1 | 布局 | auth-modal 缺 max-height/overflow-y |
| 10 | 🟠 P1 | 数据 | bm_wx_code 存储一次性 code 无意义 |
| 11 | 🟠 P1 | 安全 | GEMINI_API_KEY 未配置但代码依赖，AI 故事生成走 fallback |
| 12 | 🟡 P2 | 布局 | Emoji 跨平台渲染风险 |
| 13 | 🟡 P2 | dev-only | DISABLE_HMR 环境变量未定义 |
| 14 | 🟡 P2 | 部署 | PORT 硬编码 3000，未用 process.env.PORT |
| 15 | 🟡 P2 | 组件 | Icon emoji/css 混合类型缺文档 |
| 16 | 🟡 P2 | 交互 | 游客模式与登录模式未区分 |
| 17 | 🟡 P2 | admin/reset | 重置不可逆，无二次确认 |
| 18 | 🟡 P2 | 架构 | PRD 声称 StepFun 唯一供应商，但代码保留 Gemini 逻辑 |

---

## 附：文件清单

| 文件 | 行数 | 说明 |
|---|---|---|
| `miniprogram/src/pages/welcome/index.tsx` | 182 | 登录闸页，核心入口 |
| `miniprogram/src/pages/welcome/index.scss` | 357 | 登录页样式 |
| `miniprogram/src/utils/request.ts` | 255 | 请求封装 + 401 刷新锁 |
| `miniprogram/src/store/index.tsx` | 308 | 全局状态管理 |
| `miniprogram/src/components/Icon/index.tsx` | 426 | 图标组件 |
| `backend/server.ts` | 2708 | 后端主文件（Express + Vite + GoogleGenAI） |
| `backend/src/data.json` | 1384 | 数据存储（JSON 文件） |
| `backend/src/components/WeChatSimulator.tsx` | 1390+ | 原型模拟器 |
| `backend/vite.config.ts` | 22 | Vite 配置 |
| `backend/.env` | 5 | 环境变量（含真实密钥） |
| `backend/.env.example` | 23 | 环境变量模板 |
