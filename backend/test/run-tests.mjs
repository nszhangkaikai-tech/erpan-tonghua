// 测试编排脚本：拉起 server（无 STEPFUN_API_KEY → 离线兜底）→ 等待就绪 → 跑 node --test → 关闭服务
// 服务日志同时落盘到 /tmp/server.log，便于崩溃取证
//
// 数据安全策略（P0 修复 —— 绝不再因测试 runner 丢生产数据）：
//   1. 每次 run 用唯一时间戳+pid 备份名，绝不覆盖其他 run 的备份
//   2. 双保险：copyFileSync 备份 + renameSync "parked" 文件
//   3. 还原只在 PARKED 文件存在时执行（验证过的备份）
//   4. 绝不在没有验证过的备份时 rm data.json
//   5. 启动时检测遗留 parked 文件（上次崩溃未还原），报告并退出，绝不自动操作
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import {
  openSync, writeSync, closeSync,
  existsSync, renameSync, copyFileSync, rmSync, readdirSync,
} from "node:fs";
import { join } from "node:path";

const PORT = 3000;
const BASE = `http://localhost:${PORT}`;
const ROOT = process.cwd();
const SRC_DIR = join(ROOT, "src");
const DATA_FILE = join(SRC_DIR, "data.json");
const LOG = openSync("/tmp/server.log", "w");

// 唯一标识：时间戳 + pid，确保不同 run 不互相覆盖
const RUN_ID = `${Date.now()}.${process.pid}`;
const BACKUP_COPY = join(SRC_DIR, `data.json.backup.${RUN_ID}.json`);
const PARKED = join(SRC_DIR, `data.json.parked.${RUN_ID}.json`);

// ─── 启动前安全检查：检测上次 run 崩溃遗留的 parked 文件 ───
// parked 文件存在 = 上次 run 把生产 data.json 移走后没还原
// 此时绝不启动测试（否则 server 会用 INITIAL_DB_STATE 覆盖），必须先让用户手动还原
const staleParked = readdirSync(SRC_DIR)
  .filter((f) => /^data\.json\.parked\.\d+\.\d+\.json$/.test(f));
if (staleParked.length > 0) {
  console.error("❌ 检测到上次测试 run 未还原的 parked 文件，拒绝启动：");
  for (const f of staleParked) {
    console.error(`   ${join(SRC_DIR, f)}`);
  }
  console.error("");
  console.error("这表示上次测试中途崩溃，原 data.json 被移走但未还原。");
  console.error("当前 src/data.json 可能是测试残留的 INITIAL 状态，请手动确认并还原：");
  console.error(`  1. 检查当前 data.json 是否为测试残留（INITIAL 状态、只有 1 个默认 story）`);
  console.error(`  2. 若是残留，rm "${DATA_FILE}"`);
  console.error(`  3. mv 上方列出的 parked 文件 → "${DATA_FILE}"`);
  console.error(`  4. 删除所有遗留 parked 文件后重新运行测试`);
  process.exit(1);
}

// 清理遗留的 backup copy（这些只是 copy，安全删除，不会丢生产数据）
const staleBackups = readdirSync(SRC_DIR)
  .filter((f) => /^data\.json\.backup\.\d+\.\d+\.json$/.test(f));
for (const f of staleBackups) {
  try { rmSync(join(SRC_DIR, f)); } catch {}
}

// ─── 双保险备份 ───
// copy 备份：原文件不动，作为兜底
// rename parked：把原文件移走，让 server 从 INITIAL_DB_STATE 干净启动
// 两个文件都用唯一 RUN_ID 命名，不会覆盖其他 run 的备份
let hasBackup = false;
if (existsSync(DATA_FILE)) {
  copyFileSync(DATA_FILE, BACKUP_COPY);   // copy：原文件仍在
  renameSync(DATA_FILE, PARKED);           // park：原文件移走，data.json 不存在 → server 用 INITIAL
  hasBackup = true;
  console.log(`📦 已备份 data.json（双保险）：`);
  console.log(`   copy:  ${BACKUP_COPY}`);
  console.log(`   parked:${PARKED}`);
} else {
  console.log("⚠️  src/data.json 不存在，server 将从 INITIAL_DB_STATE 启动（无备份可还原）");
}

function logServer(fd, label, d) {
  writeSync(fd, `[${label}] ${d}`);
}

const server = spawn("npx", ["tsx", "server.ts"], {
  cwd: ROOT,
  env: { ...process.env, STEPFUN_API_KEY: "", DEV_AUTH_MOCK: "true", NODE_ENV: "development" },
  stdio: ["ignore", "pipe", "pipe"],
  detached: true, // 独立进程组组长，便于整组回收，避免 npx→tsx→node 孙进程泄漏占用端口
});
server.stdout.on("data", (d) => { process.stdout.write(`[server] ${d}`); logServer(LOG, "OUT", d); });
server.stderr.on("data", (d) => { process.stderr.write(`[server:err] ${d}`); logServer(LOG, "ERR", d); });
server.on("exit", (code, signal) => {
  logServer(LOG, "EXIT", `code=${code} signal=${signal}\n`);
  process.stderr.write(`\n[runner] server exited code=${code} signal=${signal}\n`);
});

async function waitReady(timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      // /api/db requires auth, so use /api/auth/login to check server readiness
      const res = await fetch(BASE + "/api/auth/login", { method: "POST" });
      // 只要拿到非 5xx 响应，就说明 server 已启动；410 是正常行为（DEV_AUTH_MOCK 未开启）
      if (res.status < 500) return true;
    } catch {
      // 还没起来，继续等
    }
    await sleep(400);
  }
  throw new Error("服务在超时时间内未就绪");
}

async function runTests() {
  return new Promise((resolve) => {
    const t = spawn("node", ["--test", "test/smoke.test.mjs"], {
      cwd: ROOT,
      stdio: "inherit",
    });
    t.on("close", (code) => resolve(code ?? 1));
  });
}

let exitCode = 1;
try {
  console.log("⏳ 等待服务就绪 ...");
  await waitReady();
  console.log("✅ 服务就绪，开始跑行为测试\n");
  exitCode = await runTests();
} catch (e) {
  console.error("❌ 编排失败:", e.message);
  exitCode = 1;
} finally {
  // 整组回收
  try { process.kill(-server.pid, "SIGTERM"); } catch {}
  await sleep(300);
  try { process.kill(-server.pid, "SIGKILL"); } catch {}
  closeSync(LOG);

  // ─── 安全还原 ───
  // 核心规则：只在 PARKED 文件存在时才 rm DATA_FILE。
  // PARKED 是验证过的备份（双保险之一），没有它绝不删 data.json。
  let restoredData = false;
  const parkedExists = existsSync(PARKED);
  const copyExists = existsSync(BACKUP_COPY);
  try {
    if (parkedExists) {
      // 有验证过的备份：安全删除测试生成的 data.json，还原 parked
      if (existsSync(DATA_FILE)) rmSync(DATA_FILE);
      renameSync(PARKED, DATA_FILE);
      restoredData = true;
      console.log(`✅ 已从 parked 还原 src/data.json`);
      // 清理本次 run 的 copy 备份（parked 已成功还原，copy 不再需要）
      if (copyExists) rmSync(BACKUP_COPY);
    } else if (hasBackup && copyExists) {
      // 异常：hasBackup=true 但 PARKED 不存在（被外部删除？）
      // 退回到 copy 备份还原。注意：copy 是 copyFileSync 产生的，还原时也要用 copy 覆盖
      if (existsSync(DATA_FILE)) rmSync(DATA_FILE);
      copyFileSync(BACKUP_COPY, DATA_FILE);
      restoredData = true;
      console.log(`⚠️  PARKED 丢失，已从 copy 备份还原 src/data.json`);
      rmSync(BACKUP_COPY);
    } else if (hasBackup) {
      // 最糟：两个备份都没了
      console.error("❌ 严重：备份丢失（PARKED 和 BACKUP_COPY 都不存在），无法还原。");
      console.error("   当前 src/data.json 是测试残留状态。");
      console.error("   请从 Trash（~/.Trash/data.json*）或其他备份手动恢复，然后重新运行测试。");
    } else {
      // hasBackup=false：启动时就没有 data.json，无需还原
      console.log("ℹ️  启动时无 data.json，跳过还原");
    }
  } catch (e) {
    console.error("[runner] 还原 data.json 失败:", e.message);
    console.error(`   PARKED: ${PARKED} (exists: ${parkedExists})`);
    console.error(`   BACKUP_COPY: ${BACKUP_COPY} (exists: ${copyExists})`);
    console.error(`   DATA_FILE: ${DATA_FILE} (exists: ${existsSync(DATA_FILE)})`);
    console.error("   请手动检查并还原。PARKED 是首选还原源，BACKUP_COPY 是兜底。");
  }
  console.log(`\n🔚 测试退出码: ${exitCode}${restoredData ? "（已还原 src/data.json）" : "（⚠️ 未还原，请手动检查）"}`);
  process.exit(exitCode);
}
