# CloudBase 环境变量映射（ADMIN_PASSWORD / ADMIN_SALT / STEPFUN_API_KEY / STEPFUN_MODEL）

> 生成时间：2026-07-21
> 目的：澄清 4 个环境变量在 CloudBase 云函数里的读取位置、默认值、当前云端注入状态，以及「改密码/改 salt」的正确姿势。
> 源码依据：`cloudfunctions/**`（grep `process.env` 全量扫描）。

---

## 0. 概览表

| 变量 | 运行时是否必需 | 读取位置（代码） | 默认值 | 当前云端状态 |
|---|---|---|---|---|
| `STEPFUN_API_KEY` | ✅ 是（故事/语音生成） | 所有 `common/stepfun.js:9` → `getKey()` | 无（getKey 返回 null → AI 静默降级离线兜底） | ✅ 已注入 5 个生产函数 |
| `STEPFUN_MODEL` | ❌ 否（仅文本模型可配） | 所有 `common/stepfun.js:6` → `TEXT_MODEL` | `step-3.7-flash` | ⚠️ 未设置 → 用默认 |
| `ADMIN_SALT` | ⚠️ 否（有默认，但强烈建议显式） | `mp-admin/index.js:20` + 所有 `common/seed.js:195` | `bd_dream_admin_salt_v1` | ⚠️ 未显式设置 → 用代码默认 |
| `ADMIN_PASSWORD` | ❌ **否（运行时根本不读！）** | **仅** `common/seed.js:196`（`ADMIN_DEFAULT_PASSWORD`） | `admin123` | ⚠️ 未设置 → 默认管理员仍是 admin/admin123 |

> 一句话：**只有 `STEPFUN_API_KEY` 是云端已正确注入且运行时必需的**；`ADMIN_PASSWORD` 在 CloudBase 里不控制线上登录。

---

## 1. STEPFUN_API_KEY（AI 密钥，必需）

- **读取点**：`common/stepfun.js` 的 `getKey()`（`process.env.STEPFUN_API_KEY`）。
- **运行时真正需要它的函数**：
  - `mp-story`：`generateText`（文本）/ `generateImage`（封面+章节图）/ `synthesizeSpeech`（TTS）
  - `mp-voice`：`cloneVoice`（声音克隆）
  - 其余函数（mp-user / mp-cdkey / mp-admin）拷贝了 `common/stepfun.js` 但**运行时不调用** StepFun，注入无害。
- **缺失后果**：`getKey()` 返回 null → `generateText/Image/Speech` 全部返回 null → 文本回退离线模板、图片 coverUrl 留空、语音生成失败（story 仍可存但音频缺失）。
- **当前状态**：部署时已注入 5 个生产函数（mp-user/mp-story/mp-voice/mp-cdkey/mp-admin），从 `backend/.env` 取的真实密钥。✅

---

## 2. STEPFUN_MODEL（文本模型，可选）

- **读取点**：`common/stepfun.js:6` `TEXT_MODEL = process.env.STEPFUN_MODEL || 'step-3.7-flash'`，**仅用于 `generateText`**。
- **不影响**：图片模型硬编码 `step-image-edit-2`、语音模型硬编码 `stepaudio-2.5-tts`，均不读此变量。
- **默认值**：`step-3.7-flash`。
- **当前状态**：未设置 → 用默认。如需升级文本模型（如 `step-3.7-pro` / `step-4`）再设，不影响图片/语音。

---

## 3. ADMIN_SALT（管理员盐值，建议显式设置）⚠️ 一致性约束

- **读取点**：
  - `mp-admin/index.js:20`：`signToken` / `verifyToken` / `verifyPassword`（**运行时令牌签名 + 密码校验都用它**）
  - 所有 `common/seed.js:195`：seed 时哈希默认管理员密码
- **默认值**：`bd_dream_admin_salt_v1`。
- **当前状态**：未显式设置 → 用代码默认 `bd_dream_admin_salt_v1`。
- **⚠️ 关键约束**：`admins` 集合里存储的密码哈希，是 **seed 时刻按当时 `ADMIN_SALT` 计算的**。一旦日后改 `ADMIN_SALT`：
  1. 已签发的 admin 令牌 `verifyToken` 失效（HMAC 对不上）；
  2. 已存在管理员的密码哈希校验失败 → **登录不进去**。
  → 必须先重 seed `admins`（用新 salt）才能恢复。
- **建议**：显式设为 `bd_dream_admin_salt_v1`（与代码默认一致），避免将来代码常量漂移导致意外不一致。

---

## 4. ADMIN_PASSWORD（默认管理员密码，运行时不读！）⚠️ 重要误区

- **读取点**：**仅** `common/seed.js:196` `ADMIN_DEFAULT_PASSWORD = process.env.ADMIN_PASSWORD || "admin123"`。
- **运行时登录根本不读它**：`mp-admin.login` 走 `getAdmin(username)` 取 `admins` 集合里的文档，再用 `verifyPassword(password, admin.password)` 校验 DB 内存储的哈希。
- **默认值**：`admin123`（仅决定 seed 时写入 `admins` 的密码）。
- **当前状态**：未设置 → 默认管理员 `admin / admin123` 仍存在。
- **❌ 设 `ADMIN_PASSWORD` 环境变量不会改线上密码**。改密码的正确方式（任选）：
  1. **重 seed**：同时设 `ADMIN_PASSWORD` + 同 `ADMIN_SALT`，跑 `mp-seed`（或 `mp-admin reset`，但 reset 仅重置配置不碰 admins，需 mp-seed/admin 创建）；
  2. **新建管理员**：调 `mp-admin` 的 `register` action（需先用现有 admin 令牌鉴权）；
  3. **直接改库**：在云数据库 `admins` 集合把目标文档的 `password` 改为 `sha256:<salt:新密码>`（salt 取当前 `ADMIN_SALT`）。
- **生产前务必**：改掉默认 `admin/admin123`（见上任一方式）。

---

## 5. 各函数环境变量需求矩阵

| 函数 | STEPFUN_API_KEY | STEPFUN_MODEL | ADMIN_SALT | ADMIN_PASSWORD |
|---|---|---|---|---|
| `mp-user` | ✅ 已注入（无害，运行时不调 AI） | — | — | — |
| `mp-story` | ✅ 已注入（**必需**） | 建议设 | — | — |
| `mp-voice` | ✅ 已注入（**必需**） | — | — | — |
| `mp-cdkey` | ✅ 已注入（无害） | — | — | — |
| `mp-admin` | ✅ 已注入（无害） | — | ⚠️ 建议显式 | — |
| `mp-seed`（维护） | — | — | ⚠️ 建议显式 | ⚠️ 若重 seed 才需 |

---

## 6. 如何在 CloudBase 设置这些变量

- **控制台**：云开发控制台 → 云函数 → 选函数 → 「配置」→「环境变量」→ 新增/编辑 → 保存后**函数会自动重新部署**（或手动触发一次部署生效）。
- **tcb CLI**：`tcb fn env set <functionName> -e ADMIN_SALT=bd_dream_admin_salt_v1`（逐个函数设，注意 mp-admin 与 seed 类函数需覆盖）。
- **建议补充**：
  - `ADMIN_SALT=bd_dream_admin_salt_v1`（mp-admin 及所有 seed 脚本所在函数）
  - `STEPFUN_MODEL=step-3.7-flash`（mp-story，可选，锁版本）

---

## 7. 安全提醒

1. `ADMIN_PASSWORD` **不可用于线上改密**（仅 seed 期有效）——改密走 §4 三种方式之一。
2. `ADMIN_SALT` 改动有破坏性（§3），务必同步重 seed `admins`。
3. `STEPFUN_API_KEY` 是密钥，绝不入库、绝不下发前端（当前仅在云函数环境变量，合规 ✅）。
4. 上线前改默认管理员 `admin/admin123`。
