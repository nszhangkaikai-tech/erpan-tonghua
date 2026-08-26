# 管理后台部署说明（admin/）

耳畔童话管理后台已构建并部署到 CloudBase 云静态网站。

## 访问地址
**https://blacke-d7g0wczgza0632d5a-1456150005.tcloudbaseapp.com**

登录账号：`admin` / `admin123`（上线前务必改密）

## 技术栈
- React 18 + Vite 5 + Ant Design 5 + @cloudbase/js-sdk 2.x + react-router-dom 6
- 鉴权：mp-admin 云函数签发**无状态 HMAC 令牌**（`username.ts.sig`，8 小时过期）
- 调用：浏览器端匿名登录后 `app.callFunction({ name:'mp-admin', data:{action, adminToken, ...} })`

## 本地开发 / 重新构建
```bash
cd admin
npm install
npm run dev        # 本地开发 http://localhost:5173
npm run build      # 产物输出到 admin/dist/
```

## 重新部署到云静态网站
```bash
cd admin
npm run build
tcb hosting deploy ./dist -e blacke-d7g0wczgza0632d5a
```
（tcb CLI 为 workbuddy 连接器自带，已认证当前环境）

## 云函数改动（mp-admin）
- 鉴权由「adminSessions 集合」改为「无状态 HMAC 签名令牌」（本环境 `.add()` 偶发丢字段，集合方案不可靠）
- 新增查询/管理 action：users/list、stories/list、stories/delete、voice/list、voice/delete、cdkeys/list、notif/list、stats/dashboard
- 新增读端点：templates/list、safety-config/get
- 部署：`manageFunctions.updateFunctionCode`（functionRootPath 顶层 + isWaitInstall + force）

## 前置配置（已开启）
- CloudBase 环境 `blacke-d7g0wczgza0632d5a` 已开启「匿名登录」（ModifyLoginStrategy）
- 同环境静态托管域名默认加入 WEB 安全域名 allowlist；若登录报安全域名错误，在控制台→环境→登录授权/安全配置手动添加 `blacke-d7g0wczgza0632d5a-1456150005.tcloudbaseapp.com`

## 已知问题 / 待办
1. ⚠️ 默认管理员 admin/admin123 必须改密（生产前）
2. ⚠️ cdkeys 集合字段丢失（本环境 `.add()` 丢字段怪病），Cdkeys 页已做兜底提示；完整数据需重跑 mp-cdkey 生成
3. 前端枚举（themes/scenes/educationalGoals）与后端 config 仍不一致，待对齐
