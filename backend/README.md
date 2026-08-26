# 伴梦童话 — 后端服务（Node + Express）

本服务为「伴梦童话」亲子故事小程序提供后端能力：故事文本生成、配音合成（StepFun 阶跃星辰，唯一模型供应商）、声音克隆、激活码、邀请裂变、通知与本地持久化（`data.json`）。

> 模型供应商说明：已**全量移除 Google Gemini**，文本与语音能力统一走 StepFun（阶跃星辰）API。

## 本地运行

**前置条件：** Node.js 18+

1. 安装依赖：
   `npm install`
2. 配置密钥：复制 `.env.example` 为 `.env.local`，填入
   `STEPFUN_API_KEY`（阶跃星辰 API Key）
   —— 不填则自动进入**离线兜底模式**（仍可用，仅不联网调用真实模型）。
3. 启动服务：
   `npm run dev`（默认监听 `http://localhost:3000`）
4. 行为测试（TDD，需先 `npm install`）：
   `npm test`

## 目录说明
- `server.ts`：Express 入口（端口 3000）
- `src/`：业务模块、`data.json` 持久化
- `test/`：`node --test` 行为测试 + 编排器（自动起服务、隔离开发数据）
