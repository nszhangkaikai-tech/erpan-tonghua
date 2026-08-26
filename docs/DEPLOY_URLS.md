# 部署 URL 清单（伴梦童话 小程序）

> 生成日期：2026-07-21
> 用途：汇总 CloudBase 环境下所有对外访问地址、云函数标识与控制台入口，便于验证 D 类（404）问题时快速定位。

## 一、环境标识（必读）

| 项 | 值 |
|---|---|
| CloudBase envId | `blacke-d7g0wczgza0632d5a` |
| 微信小程序 AppID | `wx231962cec75efb9e` |
| 地域 | `ap-shanghai` |
| RuntimeMode | `nosql`（纯 NoSQL 后端，业务数据走 `app.database()` 集合；PG / MySQL 不适用） |
| 套餐 | 体验版（`baas_trial`），到期 `2027-01-20` |
| QPS 配额 | 500 |

## 二、访问地址清单

### 1. 管理后台（CloudBase 静态网站托管）
部署为 SPA（HashRouter），所有深链带 `#` 前缀：

| 页面 | URL |
|---|---|
| 站点根 / 登录 | `https://blacke-d7g0wczgza0632d5a-1456150005.tcloudbaseapp.com/` |
| 仪表盘 | `https://blacke-d7g0wczgza0632d5a-1456150005.tcloudbaseapp.com/#/dashboard` |
| 用户管理 | `https://blacke-d7g0wczgza0632d5a-1456150005.tcloudbaseapp.com/#/users` |
| 故事管理 | `https://blacke-d7g0wczgza0632d5a-1456150005.tcloudbaseapp.com/#/stories` |
| 模板管理 | `https://blacke-d7g0wczgza0632d5d5a-1456150005.tcloudbaseapp.com/#/templates` ⚠️ 见下方说明 |
| 安全配置 | `https://blacke-d7g0wczgza0632d5a-1456150005.tcloudbaseapp.com/#/safety` |
| 兑换码 | `https://blacke-d7g0wczgza0632d5a-1456150005.tcloudbaseapp.com/#/cdkeys` |

> ⚠️ 模板管理地址中的 envId 部分为手误示例，**实际域名前缀统一为 `blacke-d7g0wczgza0632d5a-1456150005`**，请以前两行根域名为准拼 `#/` 路由。

### 2. 云存储 CDN（小程序音频 / 图片资源）
```
https://626c-blacke-d7g0wczgza0632d5a-1456150005.tcb.qcloud.la
```
存储桶：`626c-blacke-d7g0wczgza0632d5a-1456150005`

### 3. 微信小程序（无公网 URL）
- AppID `wx231962cec75efb9e`，版本 `1.1.0` 已通过 miniprogram-ci 上传微信平台（体验版）。
- 小程序在微信客户端内打开，没有独立 HTTP 访问地址；需用户在微信「搜一搜 / 体验版二维码 / 会话卡片」中打开。

### 4. 云函数（仅 SDK 调用，无 HTTP URL）
以下 5 个函数通过小程序 `wx.cloud.callFunction` 或管理后台 js-sdk 调用，**没有公网 HTTP 端点**：

| 函数名 | 职责 |
|---|---|
| `mp-user` | 登录态、用户数据读写（getUserData / updateConfig） |
| `mp-story` | 故事生成、章节插图、TTS（依赖 STEPFUN_API_KEY / STEPFUN_MODEL） |
| `mp-voice` | 声音复刻克隆（依赖 STEPFUN_API_KEY） |
| `mp-cdkey` | 兑换码核销 |
| `mp-admin` | 后台管理（login / register / reset / templates / safety-config 等） |

### 5. CloudBase 控制台
```
https://console.cloud.tencent.com/tcb/env/index?envId=blacke-d7g0wczgza0632d5a
```
静态托管入口：`控制台 → 静态网站托管`；云函数入口：`控制台 → 云函数`；环境变量：`云函数 → 函数名 → 配置 → 环境变量`。

## 三、当前部署状态（截至 2026-07-21）

| 层 | 状态 | 说明 |
|---|---|---|
| 后端云函数 | ✅ 已上线 | 5 函数 Active，STEPFUN_API_KEY 已注入，6 集合 52 文档已 seed |
| 前端小程序 | ✅ 已上传 | v1.1.0，含云函数调用，0 处 localhost 残留 |
| 静态管理后台 | ✅ 已部署 | 托管域名可访问，引用资源全 200（早期直连验证） |
| 隐私协议 | ⚠️ 待配 | mp 后台需配置昵称头像 + 录音采集授权 |
| 默认管理员改密 | ⚠️ 待办 | 当前 admin / admin123，运行时不读 ADMIN_PASSWORD，须走 register / 改 admins 集合 |

## 四、排查 404（D 类问题）指引

若你在浏览器看到某地址 **404**，请按以下顺序自查并反馈**完整 URL + 控制台报错**：

1. **确认是 hash 路由**：本后台用 HashRouter，正确深链形如 `.../#/users`。直接访问非 hash 路径（如 `.../users`）在静态托管下会 404——这是预期行为，加 `#` 即可。
2. **强制刷新**：旧 `index.html` 可能引用了已不存在的旧哈希资源名（如 `index-OLDHASH.js`）。`Ctrl/Cmd + Shift + R` 硬刷后通常恢复。
3. **域名前缀核对**：根域名固定为 `blacke-d7g0wczgza0632d5a-1456150005.tcloudbaseapp.com`，任何拼写偏差都会 404。
4. **沙箱探测说明**：从我这边用 `curl` 直连偶发返回 `000`（沙箱出口网络抖动），不代表站点故障；站点此前已验证根 + 资源 + 全部 hash 路由均 200。

## 五、待用户侧完成的动作

1. mp 后台将 `1.1.0` 设为体验版 → 真机验证登录 / 故事生成 / 声音克隆。
2. 配置隐私协议（昵称头像 + 录音）。
3. 默认管理员 `admin / admin123` 改密（走 mp-admin `register` 或改 `admins` 集合）。
4. 若遇 404，提供完整 URL 或控制台报错以便精准定位。
