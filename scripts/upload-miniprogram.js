/**
 * 小程序前端上传脚本（miniprogram-ci，无需开发者工具 GUI）
 * 用法:
 *   NODE_PATH=/Users/zhangkai/.workbuddy/binaries/node/workspace/node_modules \
 *   node scripts/upload-miniprogram.js /path/to/upload.key
 *
 * 注意:
 * - appid 取 project.config.json 中的 wx231962cec75efb9e
 * - miniprogramRoot 为 dist/（Taro 构建产物），已对接云函数
 * - 云函数本身由 CloudBase MCP 单独部署，这里只传前端包
 */
const ci = require('miniprogram-ci');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..', 'miniprogram');
const APPID = 'wx231962cec75efb9e';
const VERSION = '1.2.32';
const DESC = '隐私合规改造：新增政策页(用户协议/儿童信息保护政策)可点击跳转；微信登录弹窗增加"已阅读并同意"勾选，未勾选禁止授权';

function main() {
  const keyPath = process.argv[2];
  if (!keyPath) {
    console.error('❌ 用法: node scripts/upload-miniprogram.js /绝对路径/upload.key');
    process.exit(2);
  }

  const project = new ci.Project({
    appid: APPID,
    type: 'miniProgram',
    projectPath: PROJECT_ROOT,
    privateKeyPath: keyPath,
    ignores: [
      'node_modules/**/*',
      'src/**/*',
      'cloudfunctions/**/*',
      '.workbuddy/**/*',
      'scripts/**/*',
      'upload.key',
    ],
  });

  console.log(`📦 开始上传前端 -> appid=${APPID} version=${VERSION}`);
  console.log(`   项目根: ${PROJECT_ROOT}`);
  console.log(`   密钥:   ${keyPath}`);

  ci.upload({
    project,
    version: VERSION,
    desc: DESC,
    setting: {
      urlCheck: false,
      es6: false,
      minified: false,
      // 保留 sourceMap 便于真机排错
      useIsolateContext: true,
    },
    onProgressUpdate(info) {
      if (info && info._msg) console.log('   ·', info._msg);
    },
  })
    .then((res) => {
      console.log('✅ 上传成功!');
      console.log('   返回:', JSON.stringify(res));
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ 上传失败:');
      console.error('   code:', err.code);
      console.error('   message:', err.message);
      if (err.stack) console.error('   stack:', err.stack.split('\n').slice(0, 4).join('\n'));
      process.exit(1);
    });
}

main();
