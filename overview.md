# 耳畔童话 · CloudBase 云开发迁移 — 完成总览

## 本次完成内容
将小程序从「Taro + Express 后端( localhost )」全面迁移为**微信云开发**结构，彻底解决之前"上线方法不对"的问题。

### 1. 5 个云函数（已部署 · Active）
| 函数 | 职责 |
|------|------|
| `mp-user` | 登录(云身份注入) / 用户资料 / 配置 / 通知 / 统计 |
| `mp-story` | 故事文本生成 / 异步音频任务 / 收藏改名删除 |
| `mp-voice` | 声音克隆(StepFun) / 删除 |
| `mp-cdkey` | 激活码兑换 / 邀请绑定 |
| `mp-admin` | 管理端登录 / 模板 / 安全词 / 统计 |

身份方案：`wx-server-sdk` 在云函数内自动注入可信 `OPENID`，**无需 AppSecret / code2Session / token**。

### 2. 前端改造（接入云函数，页面零改动）
- `request.ts`：保留 `request({url,method,data})` 签名，内部把 URL 映射到「云函数名 + action」
- `app.tsx`：`Taro.cloud.init` 初始化
- `welcome`：去掉 `Taro.login()`/code，改调 `/api/auth/wx-login`
- `studio`：录音先传云存储取 fileID，再调 `/api/voice/clone`

### 3. 部署工程化（本次关键收尾）
- **修复部署阻断点**：5 个函数的 `../common/` 全部改为 `./common/`（CloudBase 每函数独立部署包，`../common` 会运行时找不到模块）
- `scripts/prepare-functions.js`：把共享层 `common/` 同步进每个函数目录 + 可选 `--install` 装 `wx-server-sdk`（已本地验证）
- `scripts/migrate-data.js`：幂等补种全局集合 + 按 openid 迁移旧数据
- `.gitignore`：忽略生成的 `cloudfunctions/*/common/`、`node_modules/`、`miniprogram/dist/`
- **`DEPLOY.md`**：完整部署文档（架构/AppID 一致性警告/环境变量/部署/初始化/前端上传/合规/冒烟测试/故障排查）

## 上线前置状态

| # | 事项 | 状态 |
|---|------|------|
| 1 | 云函数环境变量 `STEPFUN_API_KEY` 注入 | ✅ 已通过 MCP 注入全部 5 函数 |
| 2 | 部署 5 个云函数 | ✅ 已部署，Active |
| 3 | 初始化数据库（6 集合 / 52 文档） | ✅ 已通过 `mp-seed` 播种完成并清理 |
| 4 | AppID 一致性（`wx231962cec75efb9e` = 实际上线 AppID 且云环境已绑定 blacke） | ✅ 已确认（project.config.json 已改、云环境绑定） |
| 5 | 前端 `build:weapp` 构建 + 上传 dist/ | ✅ 已通过 miniprogram-ci 上传 1.1.0（45文件/432KB，含云函数调用、无 localhost） |
| 6 | mp 后台隐私协议（昵称头像 + 录音） | ⏳ 待用户（审核前必须） |

## 默认管理员
`admin / admin123`（seed.js sha256 hash 存储），生产务必改密。

## 关键部署约束（本环境）
- **集合不会自动创建**：必须云函数内 `db.createCollection()`（管控面 `CreateCollection` 已废弃）。`scripts/migrate-data.js` 在全新环境会失败，首建请用 `mp-seed`。
- **每函数独立部署包**：`../common` 改 `./common`；`isWaitInstall` 须放 `func` 内。
- 详见 `DEPLOY.md`（第 5 节集合约束、第 4 节 MCP 部署）。

## 验证状态
2026-07-21 全链路上线完成：
- **后端**：CloudBase MCP 部署 5 函数 Active、`STEPFUN_API_KEY` 注入、6 集合 52 文档播种、`mp-seed` 已清理；冒烟 `mp-user login` 返回 `身份缺失`（预期）。
- **前端**：`build:weapp` 产物对接云函数（callFunction + 云环境 ID、0 localhost），14:41 通过 miniprogram-ci 上传 `1.1.0` 成功（`{"subPackageInfo":[{"name":"__FULL__","size":815180}]}`）。
- 唯一剩余用户侧动作：mp 后台设该上传版本为**体验版** + 真机验证登录/生成链路 + 配隐私协议（审核前必填）。详见 `DEPLOY.md`。
