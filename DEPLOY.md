# 耳畔童话 · CloudBase 云开发部署指南

> 本文档说明如何把「耳畔童话」从 **Taro 小程序 + Express 后端（localhost）** 迁移上线为 **微信云开发（CloudBase）** 结构，
> 即 `cloudfunctions/`（云函数）+ 云数据库（NoSQL 集合）+ 云存储。
>
> 这是之前"上线方法不对"的根因修复：前端不再请求 localhost 后端，全部走云函数 + 云数据库。

---

## 0. 架构总览

```
小程序前端 (Taro 编译 → dist/)
        │  Taro.cloud.callFunction
        ▼
┌─────────────────────────────────────────────────┐
│  CloudBase 云函数（5 个，按 event.action 分发）      │
│   mp-user    用户资料/配置/通知/统计                  │
│   mp-story   故事生成(文本/音频)/收藏改名删除          │
│   mp-voice   声音克隆(StepFun)/删除                  │
│   mp-cdkey   激活码兑换/邀请绑定                      │
│   mp-admin   管理端：登录/模板/安全词/统计            │
└───────────┬───────────────────────┬───────────────┘
            │                        │
            ▼                        ▼
     云数据库(NoSQL)            云存储(录音/图片)
     users / userStories         voice/ / images/
     voiceClones / cdkeys
     templates / config / stats
     sensitiveWordsConfig / admins
     generationJobs / quotaLedger / invitationRecords
```

**身份方案**：云函数内用 `wx-server-sdk` 的 `cloud.getWXContext().OPENID` 自动获得可信 openid，
**无需** AppSecret / code2Session / token。前端 `request.ts` 保留 `request({url, method, data})` 签名不变，
内部把 URL 映射到「云函数名 + action」，页面代码零改动。

**云环境 ID**：`blacke-d7g0wczgza0632d5a`（与 `cloudbaserc.json` 一致）

### ✅ 当前部署状态（2026-07-21 已实际上线）

> 以下 5 个云函数**已全部部署并 Active**，数据库已初始化，可直接进入前端上传与真机验证阶段。

| 项目 | 状态 |
|------|------|
| `mp-user` / `mp-story` / `mp-voice` / `mp-cdkey` / `mp-admin` | ✅ 已部署，Nodejs18.15 / Event / Active |
| `STEPFUN_API_KEY` 环境变量 | ✅ 已注入全部 5 个函数（密钥来自 `backend/.env`） |
| 云数据库集合 | ✅ 已建 6 个：`templates`(44) / `cdkeys`(4) / `config`(1) / `sensitiveWordsConfig`(1) / `stats`(1) / `admins`(1)，共 52 文档 |
| 临时 `mp-seed` 播种函数 | 🧹 已建并调用后删除（仅留本地 `cloudfunctions/mp-seed/` 作维护工具，见第 5 节） |
| 默认管理员 | `admin` / `admin123`（sha256 hash，生产务必改） |

**冒烟验证**：invoke `mp-user login` 返回 `{"error":"身份缺失"}`（冷启动 602ms / 执行 4ms）—— 函数加载、wx-server-sdk 与 `./common` 解析、执行链路均正常（MCP 直调无 openid 属预期，见第 10 节）。

---

## 1. 前置条件

| 项目 | 要求 |
|------|------|
| Node | ≥ 16（本机已装 22.x，可用） |
| tcb CLI | 已安装：`/Users/zhangkai/.workbuddy/binaries/node/cli-connector-packages/bin/tcb`（或 `npm i -g @cloudbase/cli`） |
| 微信开发者工具 | 最新稳定版（用于上传前端 dist） |
| CloudBase 环境 | 已创建：`blacke-d7g0wczgza0632d5a` |
| Taro | 4.2.1（前端 `miniprogram/`） |

### ⚠️ AppID 一致性（最重要，先核对！）

- 当前 `project.config.json` 与 `miniprogram/project.config.json` 的 `appid` 已改为 **`wx268d1063ab9d6f2f`**（与云环境文档一致）。
- **旧 Express 原型**用的是 `wx231962cec75efb9e`，**不要复用它**。
- 请确认你微信公众平台里**真正要上线的那个小程序 AppID** 就是 `wx268d1063ab9d6f2f`：
  - 若实际 AppID 不同 → 必须二选一：
    1. 把两个 `project.config.json` 的 `appid` 改成你的真实 AppID；**并且**
    2. 在 CloudBase 控制台把云环境 `blacke-d7g0wczgza0632d5a` **绑定到同一 AppID**。
  - 云环境绑定的 AppID 与小程序 AppID 不一致时，前端调用云函数会报 `env not found` / 无权限。

---

## 2. 配置云函数环境变量（必做，部署前）

云函数运行需要以下环境变量（在 **CloudBase 控制台 → 云函数 → 环境变量** 配置，或用 tcb CLI 批量设置）。
**所有函数建议统一配置**（它们共享同一套密钥）：

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `STEPFUN_API_KEY` | ✅ 必填 | 阶跃星辰 API Key（声音克隆 / TTS / 文生图依赖它）。缺失时相关能力会降级为本地模拟，但**生产必须配真值**。 |
| `ADMIN_PASSWORD` | 可选 | 管理端默认管理员密码，默认 `admin123`（见 `cloudfunctions/common/seed.js`）。生产建议改。 |
| `ADMIN_SALT` | 可选 | 管理员密码加盐，默认 `bd_dream_admin_salt_v1`。 |

> **本环境已于 2026-07-21 通过 CloudBase MCP 把 `STEPFUN_API_KEY` 注入全部 5 个函数**，无需再手动配置即可真克隆/真生成。若需更换密钥，到控制台逐函数更新环境变量后重新部署，或重跑部署脚本。

> 环境变量在云函数内通过 `process.env.STEPFUN_API_KEY` 读取，无需写进代码，避免密钥泄露。

tcb CLI 设置示例（在控制台设更直观）：
```bash
tcb env --envId blacke-d7g0wczgza0632d5a
# 或在控制台逐函数/全局配置环境变量
```

---

## 3. 构建自包含云函数（关键步骤）

CloudBase **每个云函数独立部署**，无法引用部署包之外的 `../common`。
`scripts/prepare-functions.js` 会把共享层 `cloudfunctions/common` 复制进每个函数（作为 `./common`），
并安装 `wx-server-sdk`，使函数自包含。

```bash
# 仅同步 common（已验证可跑）
node scripts/prepare-functions.js

# 首次部署：额外安装依赖（wx-server-sdk）
node scripts/prepare-functions.js --install
```

执行后每个函数目录会出现 `cloudfunctions/<fn>/common/`（已被 `.gitignore` 忽略，不污染仓库）。
> 重新改了 `common/` 下的代码后，需**重跑本脚本**再部署，否则云上还是旧副本。

---

## 4. 部署云函数

方式 A —— tcb CLI（推荐，可脚本化）：
```bash
export CLOUD_ENV=blacke-d7g0wczgza0632d5a
tcb fn deploy mp-user
tcb fn deploy mp-story
tcb fn deploy mp-voice
tcb fn deploy mp-cdkey
tcb fn deploy mp-admin
```

方式 B —— 微信开发者工具：
1. 打开项目（根目录 `miniprogramRoot=miniprogram/dist/`，`cloudfunctionRoot=cloudfunctions/` 已配置）。
2. 在 `cloudfunctions/` 下对每个函数目录**右键 → 上传并部署（云端安装依赖）**。

方式 C —— CloudBase MCP（本次实际上线所用）：
- `manageFunctions.createFunction`：`functionRootPath` 指向 `cloudfunctions/`（SDK 自动拼接函数名子目录），`force:true` 覆盖，`func.isWaitInstall:true` 云端安装依赖，**注意 `isWaitInstall` 必须放在 `func` 对象内**（放顶层会触发 schema 校验失败），`func.runtime:"Nodejs18.15"`，`func.handler:"index.main"`，`func.envVariables` 注入 `STEPFUN_API_KEY`。
- 改了 `common/` 后需 `updateFunctionCode` 或重跑 `createFunction(force:true)` 再部署。

> 函数内用 `cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })`，会自动绑定当前环境，无需硬编码 envId。
>
> ⚠️ **部署前置**：每个函数目录需有 `package.json`（含 `wx-server-sdk` 依赖），否则云端 `npm install` 失败。本次已为 `mp-story` 补建 `package.json`（原本缺失）。`scripts/prepare-functions.js --install` 会在本地装好依赖。

---

## 5. 初始化云数据库集合（种子数据）

### ⚠️ 本环境集合不会自动创建（重要）

当前环境（NoSQL 后端）**不会因首次写入而自动建集合**。以下方式在集合不存在时都会报 `Db or Table not exist`：
- server SDK `db.collection('x').add(...)` / `.where().get()`
- `writeNoSqlDatabaseContent`（管控面写接口）
- 管控面 `CreateCollection` API（**已废弃**，返回"该接口不再使用"）

**唯一可靠建集合方式**：在**云函数内**用 `db.createCollection(name)`（admin 权限）。因此播种必须借助一个云函数完成。

### 方式 A —— `mp-seed` 播种函数（本次实际上线所用，推荐）

本地保留 `cloudfunctions/mp-seed/` 作为**维护工具**（注意：它不在 5 个生产函数之列，**不要常驻生产**）。其 `exports.main` 先对每个集合 `db.createCollection()`，再幂等补种。

```bash
# 1) 部署临时播种函数（需先 prepare-functions 复制 common）
node scripts/prepare-functions.js
tcb fn deploy mp-seed            # 或 CloudBase MCP manageFunctions.createFunction
# 2) 调用播种
tcb fn invoke mp-seed --data '{"action":"run"}'
# 3) 确认 added=52 后删除
tcb fn delete mp-seed            # 或 MCP deleteFunction(confirm=true)
```

本次部署即按此流程完成：invoke 返回 `{"success":true,"added":52}`，建立 6 集合 52 文档，随后删除 `mp-seed` 云函数，列表恢复 5 个生产函数。

### 方式 B —— `mp-admin` 的 `reset` action（仅重置全局配置，需集合已存在）

`reset` 会重建 `templates` / `stats` / `sensitiveWordsConfig.auditLogs`，**不动用户数据**，但**不创建集合、不补 cdkeys/admins/config**。仅在集合已存在时可用（首次建库请用方式 A）。

### 方式 C —— `scripts/migrate-data.js`（数据迁移，非首建）

> ⚠️ 该脚本依赖集合已存在（其内部 `.add()` 不会自动建表）。**全新环境直接跑会失败**（报 `Db or Table not exist`）。
> 正确用法：先用方式 A 建好集合，再跑它做旧数据迁移：
```bash
export CLOUD_ENV=blacke-d7g0wczgza0632d5a
node scripts/migrate-data.js backend/data.json   # 按 openid 迁移 users/voiceClones/userStories/notifications
```

### 种子内容（`cloudfunctions/common/seed.js`）
- 模板：`LEGACY_TEMPLATES`（8 个旧模板）+ `STORYBOOK_TEMPLATE_CATALOG`
- 兑换码：`STORY88`(10次) / `TIMES20`(20次) / `VIPMONTH`(30天VIP) / `VIP666`(7天VIP)
- 安全词：4 类别 + 19 敏感词 + 1 条示例审计日志
- 管理员：账号 `admin` / 密码 `admin123`（sha256 hash 存储，生产请改）

---

## 6. 构建并上传前端

```bash
cd miniprogram
npm install
npm run build:weapp     # 输出到 miniprogram/dist/
```

然后在**微信开发者工具**中上传 `miniprogram/dist/`：
- `project.config.json` 已设 `"miniprogramRoot": "miniprogram/dist/"`，工具会直接识别。
- 上传前确认 AppID（见第 1 节）。
- 前端 `miniprogram/src/utils/request.ts` 中 `CLOUD_ENV = 'blacke-d7g0wczgza0632d5a'`，与环境一致。

> 前端**不再依赖任何后端域名白名单**：所有业务走云函数；展示用的第三方图片（unsplash）通过 `<image src>` 渲染，
> 不触发 `wx.request` 域名校验。仅当代码里出现 `wx.request` / `wx.downloadFile` 到外部域名时才需配白名单。

---

## 7. 微信公众平台后台配置（过审 & 合规）

1. **绑定云环境 AppID**（见第 1 节）：云环境必须绑定到上线用的小程序 AppID。
2. **隐私协议**：
   - 在「设置 → 服务内容声明 / 用户隐私保护指引」中填写隐私政策。
   - 本应用采集：**微信昵称头像**（欢迎页）、**录音**（声音克隆）。需在隐私说明中明示用途。
   - 前端 `welcome` 页已在同意隐私后才请求 `wx.login`/头像昵称，符合平台要求。
3. **类目**：选择"工具-实用工具"或"教育"类目，确保与"亲子童话"内容一致，避免审核驳回。
4. **服务器域名**：因全面切到云函数，**无需配置 request 合法域名**；如审核提示，可忽略或填写云函数相关（云函数不需要）。

---

## 8. 冒烟测试

部署完成后，用开发者工具"云开发 → 云函数 → 测试"或前端真机：

1. 欢迎页同意 → 触发 `request({url:'/api/auth/wx-login'})` → 应返回 `{ success:true, token:'cloud', openid }`。
2. 首页拉取 `GET /api/db` → 应返回 templates / rights / stories 等。
3. 声音克隆：录音上传云存储取 fileID → `POST /api/voice/clone` → 返回 `voice`；控制台查看 StepFun 是否真调用（配了 `STEPFUN_API_KEY` 即真克隆）。
4. 管理端：`POST /api/admin/login`（admin/admin123）→ 拿到 `adminToken` → 调 `template/add` 等需鉴权接口。

---

## 9. 安全与运维

- **默认管理员密码务必改**：登录后用 `mp-admin` 的 `register` 建新管理员，或改 `ADMIN_PASSWORD` 环境变量后重跑 `migrate-data.js` 重置（注意 `migrate-data.js` 对 admins 是幂等补种，不会覆盖已存在的 admin；改密需走管理端或数据库直接改）。
- **密钥不入代码**：`STEPFUN_API_KEY` 等只在环境变量配置。
- **安全词三级防护**：输入校验 → 提示词二次校验 → 生成内容二次校验 + 儿童友好改写（`cloudfunctions/common/util.js` 的 `runSafetyCheck` / `getChildFriendlyReplacement`），审计日志写入 `sensitiveWordsConfig.auditLogs`。
- **录音安全**：云函数仅下载本环境 `cloud://` 前缀的 fileID，防 SSRF（`mp-voice` 的 `downloadRecording`）。

---

## 10. 常见故障排查

| 现象 | 原因 / 解决 |
|------|------------|
| `Cannot find module './common/db'` | 没跑 `scripts/prepare-functions.js`，或改了 common 后没重跑再部署。 |
| `Cannot find module 'wx-server-sdk'` | 部署前未在函数目录 `npm install`；加 `--install` 重跑，或云端安装依赖。 |
| 云函数返回 `env not found` | 云环境未绑定到小程序 AppID（第 1 节）。 |
| openid 为空 / `身份缺失` | 在**本地 Node**直接跑云函数拿不到 openid（需微信上下文）；用开发者工具/真机/云函数测试调用。 |
| 声音克隆/图片生成走模拟 | `STEPFUN_API_KEY` 未配置或无效；到控制台查云函数日志。 |
| 前端调用云函数报无权限 | 小程序 AppID 与云环境绑定 AppID 不一致；或 `request.ts` 的 `CLOUD_ENV` 写错。 |

---

## 11. 归档说明

- `backend/`（原 Express 内存态服务）已不再被前端调用，可保留作参考或归档，但不要再用它上线。
- `prototype_temp/`、`demoyuanxing/` 为旧原型，禁止用于部署。
- 上线以本文档的 **cloudfunctions + 云数据库 + 云存储** 结构为准。
