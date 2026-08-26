// Generates a self-contained icon preview HTML at docs/图标 SVG 预览.html
// - Embeds the REAL svg source files from docs/icons-svg/ (so you literally see the artwork)
// - Embeds the actual bm-icons font glyph (base64 extracted from iconfont.scss) for 1:1
//   comparison with what ships in the mini-program component
// - Controls: size, color, light/dark bg, search, drag-drop / file import preview
// - No server, no network: open the file directly (file://) in any browser.
//
// Run: node scripts/gen-icon-preview.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SVG_DIR = path.join(ROOT, 'docs', 'icons-svg')
const FONT_SCSS = path.join(ROOT, 'miniprogram', 'src', 'components', 'Icon', 'iconfont.scss')
const GLYPHS_TS = path.join(ROOT, 'miniprogram', 'src', 'components', 'Icon', 'glyphs.ts')
const OUT = path.join(ROOT, 'docs', '图标 SVG 预览.html')

// ---- 1. read svg sources ----
const svgFiles = fs.readdirSync(SVG_DIR).filter((f) => f.endsWith('.svg')).sort()
const svgMap = {}
for (const f of svgFiles) {
  const raw = fs.readFileSync(path.join(SVG_DIR, f), 'utf8')
  // strip xml decl + <title> so it embeds cleanly as inline svg
  const clean = raw
    .replace(/<\?xml[^>]*\?>/i, '')
    .replace(/<title[\s\S]*?<\/title>/i, '')
    .trim()
  svgMap[path.basename(f, '.svg')] = clean
}

// ---- 2. extract font base64 from iconfont.scss ----
const scss = fs.readFileSync(FONT_SCSS, 'utf8')
const b64 = (scss.match(/base64,([A-Za-z0-9+/=]+)/) || [])[1]
if (!b64) throw new Error('font base64 not found in iconfont.scss')

// ---- 3. parse glyphs.ts name -> unicode char ----
const glyphsSrc = fs.readFileSync(GLYPHS_TS, 'utf8')
const glyphMap = {}
const re = /"([\w-]+)":\s*"\\u([0-9a-fA-F]+)"/g
let m
while ((m = re.exec(glyphsSrc))) {
  glyphMap[m[1]] = String.fromCharCode(parseInt(m[2], 16))
}

// ---- 4. group (matches 图标清单.md / the app's 36 icons) ----
const GROUPS = [
  { title: '基础形状（8）', keys: ['play', 'pause', 'chevron-left', 'chevron-right', 'arrow-right', 'plus', 'check', 'x'] },
  { title: '内容 / 对象（11）', keys: ['book-open', 'library', 'folder', 'home', 'star', 'heart', 'heart-filled', 'moon', 'gift', 'award', 'copy'] },
  { title: '操作 / 功能（17）', keys: ['bell', 'mic', 'volume', 'search', 'edit', 'trash', 'refresh', 'share', 'settings', 'info', 'logout', 'compass', 'user', 'headphones', 'message-circle', 'sparkles', 'clock'] },
]

const icons = []
for (const g of GROUPS) {
  for (const key of g.keys) {
    if (!svgMap[key]) continue
    const glyph = glyphMap[key] || ''
    icons.push({
      name: key,
      svg: svgMap[key],
      glyph,
      codepoint: glyph ? 'U+' + glyph.charCodeAt(0).toString(16).toUpperCase() : '',
    })
  }
}

const ICONS_JSON = JSON.stringify(icons)

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>伴梦童话 · 图标 SVG 预览</title>
<style>
@font-face {
  font-family: "bm-icons";
  src: url("data:font/ttf;base64,${b64}") format("truetype");
  font-weight: normal; font-style: normal; font-display: block;
}
* { box-sizing: border-box; }
body {
  margin: 0; padding: 28px 22px 64px;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
  background: #f4f4f5; color: #18181b;
  --ic-size: 56px; --ic-color: #6C8EEF;
}
body.dark { background: #18181b; color: #e4e4e7; }
.header { max-width: 1100px; margin: 0 auto 18px; }
.header h1 { font-size: 23px; margin: 0 0 6px; }
.header p { font-size: 13px; line-height: 1.7; color: #71717a; margin: 4px 0; }
body.dark .header p { color: #a1a1aa; }
.swatch { display:inline-block; width:13px; height:13px; border-radius:3px; vertical-align:-2px; margin:0 3px; }

.toolbar {
  max-width: 1100px; margin: 0 auto 22px; display: flex; flex-wrap: wrap; gap: 14px;
  align-items: center; background: #fff; padding: 14px 16px; border-radius: 14px;
  box-shadow: 0 1px 3px rgba(0,0,0,.06);
}
body.dark .toolbar { background: #232327; box-shadow: none; }
.tool { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #52525b; }
body.dark .tool { color: #d4d4d8; }
.tool input[type=range] { width: 140px; }
.tool input[type=color] { width: 38px; height: 30px; border: none; background: none; padding: 0; cursor: pointer; }
.btn {
  border: 1px solid #d4d4d8; background: #fafafa; color: #18181b; border-radius: 9px;
  padding: 7px 14px; font-size: 13px; cursor: pointer; transition: all .15s;
}
.btn:hover { background: #f4f4f5; }
body.dark .btn { background: #2c2c30; border-color: #3f3f46; color: #e4e4e7; }
.search { flex: 1; min-width: 180px; }
.search input {
  width: 100%; height: 34px; border: 1px solid #d4d4d8; border-radius: 9px;
  padding: 0 12px; font-size: 13px; background: #fff; color: #18181b;
}
body.dark .search input { background: #2c2c30; border-color: #3f3f46; color: #e4e4e7; }

.drop {
  max-width: 1100px; margin: 0 auto 22px; border: 2px dashed #c4c4c8; border-radius: 14px;
  padding: 18px; text-align: center; color: #71717a; font-size: 13px; transition: all .15s;
}
.drop.over { border-color: #6C8EEF; background: rgba(108,142,239,.06); color: #6C8EEF; }
body.dark .drop { border-color: #3f3f46; color: #a1a1aa; }

.section { max-width: 1100px; margin: 0 auto 28px; }
.section h2 { font-size: 15px; color: #3f3f46; margin: 0 0 12px; padding-left: 10px; border-left: 4px solid #6C8EEF; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 14px; }
.card {
  background: #fff; border-radius: 12px; padding: 14px 10px 10px; text-align: center;
  box-shadow: 0 1px 3px rgba(0,0,0,.06); position: relative; transition: transform .15s;
}
.card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,.1); }
body.dark .card { background: #232327; }
.icon-box { height: 78px; display: flex; align-items: center; justify-content: center; gap: 14px; margin-bottom: 8px; color: var(--ic-color); }
.svg-ic { width: var(--ic-size); height: var(--ic-size); }
.glyph {
  display: inline-flex; align-items: center; justify-content: center;
  font-family: "bm-icons"; font-size: var(--ic-size); color: var(--ic-color); line-height: 1;
}
.glyph-label { font-size: 10px; color: #a1a1aa; align-self: flex-end; margin-bottom: 4px; }
.name { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: #18181b; word-break: break-all; }
body.dark .name { color: #e4e4e7; }
.cp { font-size: 10px; color: #71717a; margin-top: 3px; min-height: 14px; }
.copy-row { display: flex; gap: 6px; justify-content: center; margin-top: 7px; }
.copy-btn {
  font-size: 11px; color: #6C8EEF; background: rgba(108,142,239,.1); border: none;
  border-radius: 7px; padding: 4px 9px; cursor: pointer;
}
.copy-btn:hover { background: rgba(108,142,239,.2); }
.imported { outline: 2px solid #6C8EEF; }
.footer { max-width: 1100px; margin: 24px auto 0; font-size: 12px; color: #a1a1aa; }
.toast {
  position: fixed; left: 50%; bottom: 32px; transform: translateX(-50%);
  background: #18181b; color: #fff; padding: 8px 16px; border-radius: 999px; font-size: 13px;
  opacity: 0; pointer-events: none; transition: opacity .2s;
}
.toast.show { opacity: 1; }
</style>
</head>
<body>
<div class="header">
  <h1>伴梦童话 · 图标 SVG 预览</h1>
  <p>本页直接渲染 <b>真实 SVG 源文件</b>（与 <code>docs/icons-svg/</code> 一一对应），并并排展示小程序内实际使用的 <b>bm-icons 字体字形</b>（base64 内联，离线可用）。</p>
  <p>演示色 <span class="swatch" style="background:#6C8EEF"></span><code>#6C8EEF</code>；颜色与尺寸由下方控件实时调整（SVG 用 <code>currentColor</code>，字体字形同样随色变化）。</p>
  <p>支持 <b>拖拽 / 选择 SVG 文件</b> 到下方虚线框，即时预览任意外部图标。</p>
</div>

<div class="toolbar">
  <label class="tool">尺寸 <input id="size" type="range" min="16" max="96" value="56"><span id="sizeVal">56</span>px</label>
  <label class="tool">颜色 <input id="color" type="color" value="#6C8EEF"></label>
  <button class="btn" id="bgToggle">切换深色背景</button>
  <label class="tool search">搜索 <input id="search" type="text" placeholder="按名称过滤…"></label>
  <label class="btn">导入 SVG<input id="file" type="file" accept=".svg,image/svg+xml" multiple hidden></label>
</div>

<div class="drop" id="drop">把 SVG 文件拖到这里，或点击右上角「导入 SVG」</div>

<div id="app"></div>

<div class="footer">共 <span id="total">0</span> 个图标 · 左为 SVG 源（可复用于 Web / 文档），右为小程序字体字形（bm-icons）。</div>

<div class="toast" id="toast"></div>

<script>
const ICONS = ${ICONS_JSON};
const GROUPS = ${JSON.stringify(GROUPS)};

const app = document.getElementById('app');
const sizeEl = document.getElementById('size');
const sizeVal = document.getElementById('sizeVal');
const colorEl = document.getElementById('color');
const bgToggle = document.getElementById('bgToggle');
const searchEl = document.getElementById('search');
const fileEl = document.getElementById('file');
const dropEl = document.getElementById('drop');
const toastEl = document.getElementById('toast');
document.getElementById('total').textContent = ICONS.length;

function p(n){ return n + 'px'; }
function div(cls, style){ const d = document.createElement('div'); if(cls) d.className = cls; if(style) Object.assign(d.style, style); return d; }

function toast(msg){
  toastEl.textContent = msg; toastEl.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(()=>toastEl.classList.remove('show'), 1200);
}
function copyText(text){
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(()=>toast('已复制')).catch(()=>fallbackCopy(text));
  } else { fallbackCopy(text); }
}
function fallbackCopy(text){
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position='fixed'; ta.style.opacity='0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); toast('已复制'); } catch(e){ toast('复制失败'); }
  document.body.removeChild(ta);
}

function buildCard(ic){
  const card = div('card');
  const box = div('icon-box');
  const wrap = document.createElement('div');
  wrap.innerHTML = ic.svg;
  const svg = wrap.firstElementChild;
  if (svg) svg.setAttribute('class', 'svg-ic');
  box.appendChild(svg || div(''));
  if (ic.glyph){
    const g = div('glyph'); g.textContent = ic.glyph;
    box.appendChild(g);
    box.appendChild(div('glyph-label', null)).textContent = '字体';
  }
  card.appendChild(box);
  const nm = div('name'); nm.textContent = ic.name; card.appendChild(nm);
  const cp = div('cp'); cp.textContent = ic.codepoint || (ic.imported ? '' : '未入字体'); card.appendChild(cp);
  const row = div('copy-row');
  const b1 = document.createElement('button'); b1.className='copy-btn'; b1.textContent='复制SVG';
  b1.onclick = ()=> copyText(ic.svg);
  const b2 = document.createElement('button'); b2.className='copy-btn'; b2.textContent='复制名';
  b2.onclick = ()=> copyText(ic.name);
  row.appendChild(b1); row.appendChild(b2);
  card.appendChild(row);
  return card;
}

function render(){
  const q = (searchEl.value || '').trim().toLowerCase();
  app.innerHTML = '';
  let shown = 0;
  for (const g of GROUPS){
    const items = ICONS.filter(ic => ic.group === g.title && (!q || ic.name.toLowerCase().includes(q)));
    if (!items.length) continue;
    const sec = div('section');
    const h2 = document.createElement('h2'); h2.textContent = g.title; sec.appendChild(h2);
    const grid = div('grid');
    items.forEach(ic => { grid.appendChild(buildCard(ic)); shown++; });
    sec.appendChild(grid); app.appendChild(sec);
  }
  if (!shown){
    const empty = div('section'); empty.textContent = '没有匹配的图标'; app.appendChild(empty);
  }
}

// tag each icon with its group for filtering
GROUPS.forEach(g => g.keys.forEach(k => { const ic = ICONS.find(x=>x.name===k); if(ic) ic.group = g.title; }));

// controls
sizeEl.oninput = ()=>{ document.documentElement.style.setProperty('--ic-size', p(+sizeEl.value)); sizeVal.textContent = sizeEl.value; };
colorEl.oninput = ()=>{ document.documentElement.style.setProperty('--ic-color', colorEl.value); };
bgToggle.onclick = ()=>{ document.body.classList.toggle('dark'); };
searchEl.oninput = render;

// import / drag-drop
function importFiles(files){
  Array.from(files).forEach(f => {
    if (!f.name.toLowerCase().endsWith('.svg')) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      const raw = reader.result;
      const clean = raw.replace(/<\\?xml[^>]*\\?>/i,'').replace(/<title[\\s\\S]*?<\\/title>/i,'').trim();
      const ic = { name: f.name.replace(/\\.svg$/i,''), svg: clean, glyph: '', codepoint: '', imported: true, group: '导入预览' };
      ICONS.push(ic);
      const card = buildCard(ic); card.classList.add('imported');
      let sec = document.getElementById('importSec');
      if (!sec){ sec = div('section'); sec.id='importSec'; const h2=document.createElement('h2'); h2.textContent='导入预览'; sec.appendChild(h2); const grid=div('grid'); grid.id='importGrid'; sec.appendChild(grid); app.appendChild(sec); }
      document.getElementById('importGrid').appendChild(card);
      document.getElementById('total').textContent = ICONS.length;
      toast('已导入 ' + ic.name);
    };
    reader.readAsText(f);
  });
}
fileEl.onchange = (e)=> importFiles(e.target.files);
['dragenter','dragover'].forEach(ev=> dropEl.addEventListener(ev, e=>{ e.preventDefault(); dropEl.classList.add('over'); }));
['dragleave','drop'].forEach(ev=> dropEl.addEventListener(ev, e=>{ e.preventDefault(); dropEl.classList.remove('over'); }));
dropEl.addEventListener('drop', e=>{ if(e.dataTransfer && e.dataTransfer.files) importFiles(e.dataTransfer.files); });

// init
document.documentElement.style.setProperty('--ic-size', p(+sizeEl.value));
document.documentElement.style.setProperty('--ic-color', colorEl.value);
render();
</script>
</body>
</html>
`

fs.writeFileSync(OUT, html)
console.log(`OK: wrote ${icons.length} icons (svg + font glyph) to ${OUT}`)
console.log(`font base64: ${(b64.length/1024).toFixed(1)}KB`)
