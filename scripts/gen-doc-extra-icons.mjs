// One-off generator: emit 10 new line-style SVG icons into the doc's icons/ folder
// so the relative ![name](icons/xxx.svg) references in icon-document-local.md resolve.
// Style matches existing assets: viewBox 0 0 24 24, stroke="currentColor",
// fill="none" for outlines, round caps/joins, stroke-width 1.8–2.

import fs from 'node:fs'
import path from 'node:path'

const ICONS_DIR = '/Users/zhangkai/Documents/Codex/2026-08-05/ru-h/outputs/deepseek-icons/icons'

const ICONS = {
  sun: `<circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/>
<path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 7l2.1-2.1M4.9 19.1l2.1-2.1M17 17l2.1 2.1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,
  calendar: `<rect x="3" y="5" width="18" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/>
<line x1="3" y1="9.5" x2="21" y2="9.5" stroke="currentColor" stroke-width="1.8"/>
<line x1="8" y1="3" x2="8" y2="6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
<line x1="16" y1="3" x2="16" y2="6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
<circle cx="12" cy="14.5" r="1.3" fill="currentColor"/>`,
  download: `<path d="M12 3v10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
<path d="m8 11 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M5 19h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,
  lock: `<rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/>
<path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
<circle cx="12" cy="15.5" r="1.3" fill="currentColor"/>`,
  bookmark: `<path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>`,
  image: `<rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/>
<circle cx="8.5" cy="9" r="1.6" fill="currentColor"/>
<path d="m4 18 4.5-4.5 3 3L15 12l5 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
  'chevron-up': `<path d="m6 14 6-6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  'chevron-down': `<path d="m6 10 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  more: `<circle cx="5" cy="12" r="1.6" fill="currentColor"/>
<circle cx="12" cy="12" r="1.6" fill="currentColor"/>
<circle cx="19" cy="12" r="1.6" fill="currentColor"/>`,
  eye: `<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
<circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" stroke-width="1.8"/>`,
}

const header = (name) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-labelledby="title">
  <title id="title">${name}</title>
`

fs.mkdirSync(ICONS_DIR, { recursive: true })
let count = 0
for (const [name, inner] of Object.entries(ICONS)) {
  const svg = `${header(name)}${inner}\n</svg>\n`
  fs.writeFileSync(path.join(ICONS_DIR, `${name}.svg`), svg)
  count++
}
console.log(`OK: wrote ${count} new icon SVGs to ${ICONS_DIR}`)
