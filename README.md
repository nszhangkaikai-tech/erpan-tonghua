# 伴梦童话 · 微信小程序

面向 3-10 岁亲子家庭的「定制化童话故事」微信小程序。家长通过向导式输入生成专属图文+语音故事，支持克隆家长声音配音，并配套管理后台与返佣体系。

![微信小程序](https://img.shields.io/badge/微信小程序-CloudBase%20%E4%BA%91%E5%BC%80%E5%8F%91-brightgreen)
![前端](https://img.shields.io/badge/Taro%204.2.1%20%2B%20React%2018%20%2B%20TypeScript-2f74c0)
![后端](https://img.shields.io/badge/Node%20Express%20%2F%20CloudBase%20%E4%BA%91%E5%87%BD%E6%95%B0-339933)

---

## 项目说明

**伴梦童话** 是一款 AI 驱动的儿童有声绘本定制小程序。核心流程：家长填写宝宝资料 → 选择/定制故事主题、场景、教育目标 → AI 生成图文故事 → 自动合成语音朗读 → 播放时叠加 BGM。此外还支持声音克隆、故事模板、邀请返佣、兑换码等运营能力。

> 已上线版本采用 **微信云开发（CloudBase）** 架构，前端通过 `wx.cloud.callFunction` 调用 5 个云函数，数据持久化到云数据库与云存储。

---

## 功能概览

### 主系统

| 模块 | 功能 |
|------|------|
| 登录授权 | 微信一键登录 + 隐私协议 + 头像/昵称授权 |
| 资料管理 | 孩子昵称、年龄、性别、兴趣、家长信息、 bedtime |
| 故事定制 | 5 步向导：主题 → 场景/教育目标 → 主角 → 时长/年龄 → 声音/BGM/确认 |
| 模板库 | 精选故事模板一键套用，后台可增删改 |
| 生成引擎 | 文本生成（StepFun）、章节插图生成、TTS 语音合成 |
| 播放器 | 逐章播放、进度控制、BGM 双轨混音、睡眠定时关闭 |
| 故事日记 | 搜索/筛选/收藏/重命名/删除已生成故事 |
| 声音复刻 | 录音上传 → StepFun 声音克隆 → 播放时使用 |
| 通知中心 | 系统通知、故事就绪、活动提醒 |
| 我的 | 额度展示、兑换码激活、邀请返佣、设置菜单 |

### 返佣子系统

| 模块 | 功能 |
|------|------|
| 兑换码 | `cdkey/redeem`：激活故事生成次数或 VIP 天数 |
| 邀请绑定 | `referral/bind`：新老用户双向奖励 |
| 额度管理 | 免费次数、VIP 状态、邀请码追踪 |
| 管理后台 | 兑换码 CRUD、用户额度调整、邀请记录查看 |

---

## 技术栈

### 前端（小程序）

| 技术 | 说明 |
|------|------|
| Taro 4.2.1 | 多端框架，编译为微信小程序 |
| React 18 + TypeScript | 组件化开发 |
| Sass / SCSS | Design tokens + 页面样式 |
| React Context + useReducer | 轻量全局状态管理 |
| Taro.cloud / wx.cloud | 云函数调用与云存储上传 |

### 后端（云函数）

| 技术 | 说明 |
|------|------|
| Node.js 18.15 | 云函数运行时 |
| wx-server-sdk | 微信云开发 SDK |
| CloudBase 云数据库 | NoSQL 集合（users、templates、cdkeys 等 8+ 集合） |
| CloudBase 云存储 | 录音、封面、章节图存储 |
| StepFun API | step-3.7-flash（文本）、step-image-edit-2（图片）、stepaudio-2.5-tts（语音） |

### 管理后台

| 技术 | 说明 |
|------|------|
| React 19 + TypeScript | 单页应用 |
| Vite 6 | 构建工具 |
| Tailwind CSS 4 | 样式方案 |
| CloudBase Web SDK | 直接读写云数据库/云存储 |

### 报表与自动化

| 技术 | 说明 |
|------|------|
| 云数据库统计 | `stats` 集合记录日活、生成数、播放数等 |
| 审计日志 | `sensitiveWordsConfig.auditLogs` 记录安全干预 |
| 配额台账 | `quotaLedger` 记录每次额度变动 |
| 定时任务 | 云函数异步任务处理长文本 TTS 生成 |

---

## 部署说明

### 系统要求

- Node.js >= 16（推荐 18.x/20.x）
- 微信开发者工具（最新稳定版）
- 微信小程序 AppID（需已开通云开发）
- CloudBase 环境 ID

### 开发环境

#### 1. 前端编译

```bash
cd miniprogram
npm install
npm run build:weapp    # 输出到 miniprogram/dist/
```

#### 2. 初始化 CloudBase

```bash
# 安装 tcb CLI
npm install -g @cloudbase/cli

# 配置环境变量
export CLOUD_ENV=blacke-d7g0wczgza0632d5a
```

#### 3. 准备云函数

```bash
# 复制公共模块到各函数目录
node scripts/prepare-functions.js --install

# 部署 5 个云函数
tcb fn deploy mp-user
tcb fn deploy mp-story
tcb fn deploy mp-voice
tcb fn deploy mp-cdkey
tcb fn deploy mp-admin
```

#### 4. 初始化数据库

```bash
# 部署临时播种函数
tcb fn deploy mp-seed
tcb fn invoke mp-seed --data '{"action":"run"}'

# 确认 added=52 后删除
tcb fn delete mp-seed
```

#### 5. 上传前端

在微信开发者工具中导入 `miniprogram/dist/`，上传代码即可。

### 生产环境

| 项目 | 说明 |
|------|------|
| 云环境 | `blacke-d7g0wczgza0632d5a`（需与小程序 AppID 绑定） |
| 环境变量 | `STEPFUN_API_KEY`、`ADMIN_PASSWORD`、`ADMIN_SALT` |
| 管理员账号 | 默认 `admin` / `admin123`（生产环境必须修改） |
| 域名白名单 | 无需配置 request 域名（全部走云函数） |

---

## 项目结构

```
新项目/
├── miniprogram/              # 微信小程序前端
│   ├── dist/                 # ★ 编译产物，直接导入微信开发者工具
│   ├── src/
│   │   ├── pages/            # 11 个页面
│   │   │   ├── welcome/      # 欢迎页 + 微信授权
│   │   │   ├── profile/      # 资料完善
│   │   │   ├── home/         # 首页
│   │   │   ├── wizard/       # 故事向导（5 步）
│   │   │   ├── story-preview/# 文本预览
│   │   │   ├── story-player/ # 沉浸式播放器
│   │   │   ├── diary/        # 故事日记本
│   │   │   ├── template/     # 模板库
│   │   │   ├── studio/       # 声音复刻
│   │   │   ├── notification/ # 通知中心
│   │   │   ├── my/           # 我的
│   │   │   └── policy/       # 隐私政策
│   │   ├── components/       # SafeImage / Icon / BottomNav / NavBar
│   │   ├── store/            # React Context + useReducer
│   │   ├── utils/            # request（云函数路由）、uploadFile、storyConfig
│   │   └── styles/           # design tokens（zinc 色板 + orange 强调）
│   ├── project.config.json   # AppID: wx268d1063ab9d6f2f
│   └── package.json
├── cloudfunctions/           # CloudBase 云函数（5 个生产 + 工具）
│   ├── mp-user/              # 用户资料/配置/通知/统计
│   ├── mp-story/             # 故事生成/章节插图/TTS/收藏删除
│   ├── mp-voice/             # 声音克隆/删除
│   ├── mp-cdkey/             # 兑换码/邀请绑定
│   ├── mp-admin/             # 管理端登录/模板/安全词/统计
│   └── common/               # 共享模块（db/stepfun/storage/bgm/util）
├── backend/                  # 原 Express 后端（参考/归档）
│   ├── server.ts             # Express 入口（含全部 API 路由）
│   ├── src/
│   │   ├── types.ts          # 领域模型
│   │   ├── storybookTemplates.ts # 故事模板与提示词
│   │   └── data.json         # 初始数据
│   ├── public/
│   │   ├── storage/          # 压缩后的媒体资源
│   │   └── audio/            # BGM 白噪音
│   └── package.json
├── admin/                    # 管理后台（React + Vite）
│   ├── src/
│   │   ├── pages/            # Dashboard/Users/Stories/Templates/Cdkeys 等
│   │   ├── api.ts            # CloudBase API 封装
│   │   ├── auth.ts           # 登录态管理
│   │   └── cloud.ts          # 云开发初始化
│   └── package.json
├── docs/                     # 架构文档与部署指南
│   ├── ARCHITECTURE.md
│   ├── DEPLOY.md
│   ├── CLOUDBASE_ENV_VARS.md
│   └── BACKEND_VS_CLOUDBASE.md
├── scripts/                  # 构建/部署/迁移脚本
│   ├── prepare-functions.js  # 云函数公共模块同步
│   └── migrate-data.js       # 数据迁移工具
├── generated-images/         # AI 生成的封面/插图
├── bgm_preview/              # BGM 预览文件
└── README.md                 # ★ 本文件
```

### 架构说明

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

---

## 快速开始

### 1. 准备基础服务

- 注册微信小程序账号，获取 AppID
- 在微信公众平台开通云开发，创建环境
- 安装 Node.js >= 16、微信开发者工具

### 2. 创建服务配置

```bash
# 克隆项目
git clone <your-repo-url>
cd 新项目

# 安装依赖
cd miniprogram && npm install && cd ..
cd admin && npm install && cd ..

# 配置 CloudBase 环境
cp cloudbaserc.json cloudbaserc.local.json  # 按实际环境修改
```

### 3. 启动前端

```bash
cd miniprogram
npm run dev:weapp    # 监听模式编译
# 用微信开发者工具打开 miniprogram/dist/ 目录
```

### 4. 启动管理后台（可选）

```bash
cd admin
npm run dev          # Vite 开发服务器，默认 http://localhost:5173
```

---

## 配置说明

| 环境变量 | 必填 | 说明 |
|----------|------|------|
| `STEPFUN_API_KEY` | ✅ | 阶跃星辰 API Key（文本/图片/语音生成） |
| `ADMIN_PASSWORD` | 生产必填 | 管理端密码，默认 `admin123` |
| `ADMIN_SALT` | 可选 | 密码加盐，默认 `bd_dream_admin_salt_v1` |
| `WECHAT_APP_ID` | 可选 | 微信 AppID（本地调试用） |
| `WECHAT_APP_SECRET` | 可选 | 微信 AppSecret（本地调试用） |

> **注意**：云函数的环境变量在 CloudBase 控制台配置，不要写进代码仓库。

---

## 安全说明

### 生产环境建议

1. **修改默认管理员密码**：登录后通过管理后台或直接修改 `ADMIN_PASSWORD` 环境变量
2. **启用安全词防护**：`sensitiveWordsConfig` 已内置 4 类 19 个敏感词 + 三级拦截/改写机制
3. **密钥隔离**：`STEPFUN_API_KEY` 仅存在于云函数环境变量，绝不下发前端
4. **录音安全**：云函数仅下载本环境 `cloud://` 前缀的 fileID，防止 SSRF
5. **密码哈希**：管理员密码使用 SHA256 + Salt 存储，不存明文

### 合规要求

- 在微信公众平台配置隐私政策（采集昵称、头像、录音）
- 类目选择「工具-实用工具」或「教育」
- 前端在同意隐私后才调用 `wx.login` 和头像接口

---

## 常见问题

### Q1: 云函数返回 `env not found`

**原因**：小程序 AppID 与 CloudBase 环境绑定的 AppID 不一致。

**解决**：确认 `project.config.json` 的 `appid` 与云环境绑定的 AppID 相同。

### Q2: 声音克隆/图片生成走模拟模式

**原因**：`STEPFUN_API_KEY` 未配置或无效。

**解决**：到 CloudBase 控制台检查云函数环境变量，确认 key 有效且有对应模型权限。

### Q3: 前端调用云函数报 `parameter.data should be object`

**原因**：Taro 4.x 封装层在真机上存在 data 参数丢失 bug。

**解决**：`request.ts` 已使用原生 `wx.cloud.callFunction`，确保代码是最新版本。

### Q4: `Cannot find module './common/db'`

**原因**：没跑 `scripts/prepare-functions.js`，或改了 `common/` 后没重跑。

**解决**：
```bash
node scripts/prepare-functions.js --install
# 重新部署云函数
```

### Q5: 本地 Express 后端已废弃？

**回答**：是的。上线版已全面切换到 CloudBase 云函数架构。`backend/` 目录保留作参考，不再被前端调用。

---

## 相关文档

- [CloudBase 迁移方案](CloudBase迁移方案.md)
- [部署指南](docs/DEPLOY.md)
- [架构说明](docs/ARCHITECTURE.md)
- [后端 vs CloudBase 对比](docs/BACKEND_VS_CLOUDBASE.md)
- [环境变量映射](docs/CLOUDBASE_ENV_VARS.md)

---

## License

MIT
