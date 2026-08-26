// 一次性修正所有 stepfun.js 的 StepFun base URL
// 真实路径：文本/图片/语音/克隆音色 走 https://api.stepfun.com/step_plan/v1
//          文件上传（克隆前置）走 https://api.stepfun.com/v1/files
const fs = require('fs');

const FILES = [
  'cloudfunctions/common/stepfun.js',
  'cloudfunctions/mp-admin/common/stepfun.js',
  'cloudfunctions/mp-story/common/stepfun.js',
  'cloudfunctions/mp-cdkey/common/stepfun.js',
  'cloudfunctions/mp-user/common/stepfun.js',
  'cloudfunctions/mp-voice/common/stepfun.js',
  'cloudfunctions/mp-seed/common/stepfun.js',
];

const REPLACEMENTS = [
  [
    "const API_BASE = 'https://api.stepfun.com/v1';",
    "const STEP_PLAN_BASE = 'https://api.stepfun.com/step_plan/v1';\nconst FILE_BASE = 'https://api.stepfun.com/v1';",
  ],
  ['${API_BASE}/chat/completions', '${STEP_PLAN_BASE}/chat/completions'],
  ['${API_BASE}/images/generations', '${STEP_PLAN_BASE}/images/generations'],
  ['${API_BASE}/audio/speech', '${STEP_PLAN_BASE}/audio/speech'],
  ['${API_BASE}/audio/voices', '${STEP_PLAN_BASE}/audio/voices'],
  ['${API_BASE}/audio/clones', '${STEP_PLAN_BASE}/audio/voices'],
  ['${API_BASE}/files', '${FILE_BASE}/files'],
];

let totalChanged = 0;
for (const f of FILES) {
  if (!fs.existsSync(f)) {
    console.log('SKIP (not found):', f);
    continue;
  }
  let content = fs.readFileSync(f, 'utf8');
  let changed = 0;
  for (const [from, to] of REPLACEMENTS) {
    const before = content.length;
    content = content.split(from).join(to);
    if (content.length !== before) changed++;
  }
  // 安全校验：不应再有裸 ${API_BASE} 残留（除非是定义行，已被替换）
  const leftover = (content.match(/\$\{API_BASE\}/g) || []).length;
  if (leftover > 0) {
    console.error('WARN leftover ${API_BASE} in', f, '->', leftover);
  }
  fs.writeFileSync(f, content);
  totalChanged += changed;
  console.log(`FIXED ${f} (${changed} patterns)`);
}
console.log('TOTAL patterns replaced:', totalChanged);
