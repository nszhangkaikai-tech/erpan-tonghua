# 耳畔童话 · 后台管理系统（Admin Console）实施方案

> 目标：基于 CloudBase + React + Ant Design 搭建**带登录验证**的可视化后台，
> 管理 `docs/sql.md` 定义的集合，接口对齐 `docs/api.md` 第 10 节「可视化后台接口」。
> 部署形态：微信云**静态网站托管**（CloudBase Static Hosting）。

## 一、后台要管理的对象（来自 sql.md 集合分类）

| 分类 | 集合 | 后台操作 | 读写 |
|------|------|----------|------|
| 全局配置 | `templates` | 列表 / 新增 / 删除 / 推荐开关 | **写** |
| 全局配置 | `config` | 查看主题/场景/教育目标（注意前后端枚举不一致 bug） | 读+谨慎写 |
| 全局配置 | `sensitiveWordsConfig` | 查看 / 编辑敏感词 / 处理审核审计 | **写** |
| 权益运营 | `cdkeys` | 列表 / 新增 / 禁用 | **写** |
| 权益运营 | `invitationRecords` | 列表查看 | 读 |
| 权益运营 | `quotaLedger` | 额度流水查看 | 读 |
| 用户业务 | `users` | 列表 / 查看孩子档案与权益（VIP 状态） | 读 |
| 用户业务 | `userStories` | 列表 / 查看 / 删除违规内容 | 读+删 |
| 用户业务 | `voiceClones` | 列表 / 查看 / 删除 | 读+删 |
| 用户业务 | `notifications` | 列表 / 查看 | 读 |
| 管理与观测 | `admins` / `adminSessions` | 管理员账号、会话查看 | 读 |
| 管理与观测 | `stats` / `apiStats` | 统计仪表盘 | 读 |
| 生成资源 | `generationJobs` / `assets` | 任务状态、资源元数据查看 | 读 |

## 二、接口现状（来自 mp-admin/index.js + api.md §10）

**已实现（可直接调）：**
- `mp-admin.login` / `register` / `reset` / `simulate-api-call`
- `mp-admin.template/add` / `template/delete` / `template/toggle-recommend`
- `mp-admin.safety-config/update` / `safety-config/audit-resolve`

**缺口（api.md §10.9 明确要求、当前缺失）：**
- 后台分页查询 action：用户、故事、声纹、兑换码、通知等列表查询
- 当前不能依赖用户端 `getUserData` 当管理接口

> 方案：给 `mp-admin` 新增 `query` 类 action（如 `users/list`、`stories/list`、`voice/list`、`cdkeys/list`、`notif/list`、`stats/dashboard`），
> 统一走分页 + 管理员鉴权（读取 `adminSessions` 校验登录态）。前端不直接用 Web SDK 查用户集合，避免越权。

## 三、前端架构（新建 `admin/` 目录，独立 SPA）

```
admin/
├── package.json            # React 18 + Vite + Ant Design 5 + @cloudbase/js-sdk
├── vite.config.ts          # 构建到 dist/，base 设为静态网站路径
├── src/
│   ├── main.tsx
│   ├── App.tsx             # 路由 + 登录守卫
│   ├── cloud.ts            # 初始化 @cloudbase/js-sdk（env: blacke-d7g0wczgza0632d5a）
│   ├── auth.ts             # 登录态（调用 mp-admin.login，存 sessionToken）
│   ├── pages/
│   │   ├── Login.tsx       # 账号密码登录（mp-admin.login）
│   │   ├── Dashboard.tsx   # 统计概览（stats / apiStats）
│   │   ├── Templates.tsx   # 模板 CRUD + 推荐开关
│   │   ├── SafetyConfig.tsx# 敏感词配置 + 审核处理
│   │   ├── Cdkeys.tsx      # 兑换码管理
│   │   ├── Users.tsx       # 用户/孩子档案/VIP
│   │   ├── Stories.tsx     # 故事查看/删除
│   │   └── VoiceClones.tsx # 声纹查看/删除
│   └── components/         # 表格、分页、Modal 封装
```

**鉴权流程：**
1. 登录页提交账号密码 → `mp-admin.login` 校验 `admins` 集合 → 返回 `sessionToken`
2. 前端存 `sessionToken`（localStorage），每次请求带在 `action` 上下文
3. `mp-admin` 所有写/查 action 先校验 `sessionToken` 对应 `adminSessions` 有效性，无效返回 401
4. 路由守卫：未登录强制跳 `/login`

**技术选型依据：**
- Ant Design 5：表格/表单/Modal 开箱即用，最适合后台 CRUD
- Vite：比 CRA 快，构建产物小
- `@cloudbase/js-sdk`：Web 端直连云环境，无需自建 Node 服务

## 四、部署

1. 本地 `npm run build` 产出 `admin/dist/`
2. CloudBase 静态网站托管：在 `cloudbaserc.json` 增加 `hosting` 配置（目录 `admin/dist`）
3. 用 `tcb` CLI 或云开发控制台「静态网站托管」上传
4. 配置「环境静态网站」域名（微信给的 `*.tcb.qcloud.la` 或自定义绑定）
5. 默认管理员：`admin / admin123`（来自 seed.js，上线前改密）

## 五、待确认 / 注意

1. **查询接口补齐**：需给 `mp-admin` 加 ~6 个 `query` action（写代码 + 重新部署）。是否同意我一并补？
2. **前后端枚举不一致**：`config.themes/scenes/educationalGoals` 与前端写死值对不上，后台编辑时需先对齐文案。
3. **静态网站托管开通**：当前环境未开通静态托管，首次需控制台手动开一次（MCP 可能受限）。
4. **默认管理员密码**：`admin123` 上线前务必改。

## 六、执行顺序（确认后）

1. 建 `admin/` 前端工程骨架 + 登录 + 路由守卫
2. 补 `mp-admin` 查询 action 并重新部署
3. 逐页实现：模板 → 安全词 → 兑换码 → 用户/故事/声纹 → 仪表盘
4. 构建 + 静态托管上传 + 真机验证登录与各页
