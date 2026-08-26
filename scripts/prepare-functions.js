// 云函数部署准备脚本
// -------------------------------------------------------------
// CloudBase 每个云函数都是独立部署包，无法引用部署目录之外的 ../common。
// 因此本脚本把共享层 cloudfunctions/common 复制进每一个函数目录（作为 ./common），
// 并安装 wx-server-sdk，使每个函数自包含、可直接部署。
//
// 用法：
//   node scripts/prepare-functions.js            # 仅复制 common + 检查依赖
//   node scripts/prepare-functions.js --install  # 额外执行 npm install（生产依赖）
//
// 复制出的 cloudfunctions/<fn>/common 与 node_modules 已在 .gitignore 忽略，不会污染仓库。

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const FUNC_ROOT = path.join(ROOT, 'cloudfunctions');
const COMMON_SRC = path.join(FUNC_ROOT, 'common');

const FUNCTIONS = ['mp-user', 'mp-story', 'mp-voice', 'mp-cdkey', 'mp-admin'];

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function hasWxServerSdk(fnDir) {
  return fs.existsSync(path.join(fnDir, 'node_modules', 'wx-server-sdk'));
}

function main() {
  const doInstall = process.argv.includes('--install');
  if (!fs.existsSync(COMMON_SRC)) {
    console.error('[prepare] 未找到 cloudfunctions/common，请确认目录结构');
    process.exit(1);
  }

  for (const fn of FUNCTIONS) {
    const fnDir = path.join(FUNC_ROOT, fn);
    if (!fs.existsSync(fnDir)) {
      console.warn(`[prepare] 跳过不存在的函数目录: ${fn}`);
      continue;
    }

    // 1) 复制共享层为 ./common
    const commonDest = path.join(fnDir, 'common');
    fs.rmSync(commonDest, { recursive: true, force: true });
    copyDir(COMMON_SRC, commonDest);
    console.log(`[prepare] ${fn}: 已同步 ./common (${fs.readdirSync(commonDest).length} 个文件)`);

    // 2) 安装依赖（可选）
    if (doInstall) {
      if (!fs.existsSync(path.join(fnDir, 'package.json'))) {
        console.warn(`[prepare] ${fn}: 缺少 package.json，跳过 npm install`);
      } else if (hasWxServerSdk(fnDir)) {
        console.log(`[prepare] ${fn}: wx-server-sdk 已存在，跳过安装`);
      } else {
        console.log(`[prepare] ${fn}: 安装依赖中...`);
        execSync('npm install --production', { cwd: fnDir, stdio: 'inherit' });
      }
    }
  }

  console.log('\n[prepare] 完成 ✅ 现在可部署：tcb fn deploy <函数名> 或微信开发者工具右键上传');
  if (!doInstall) {
    console.log('提示：首次部署建议加 --install 参数预装 wx-server-sdk（或用云端安装依赖）。');
  }
}

main();
