// Proof renderer: node proof.js <spec.json>
// spec = { out, width, bg, fg, fonts: {name: path}, rows: [ {font, text, size, wght, slnt, label, feat} ], scale }
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const faces = Object.entries(spec.fonts).map(([name, p]) => {
    const b64 = fs.readFileSync(p).toString('base64');
    const fmt = p.endsWith('.woff2') ? 'woff2' : 'truetype';
    return `@font-face{font-family:"${name}";src:url(data:font/${fmt};base64,${b64}) format("${fmt}");font-weight:300 800;}`;
  }).join('\n');
  const rows = spec.rows.map(r => {
    const feat = r.feat ? `font-feature-settings:${r.feat};` : '';
    const ls = r.ls ? `letter-spacing:${r.ls};` : '';
    const lab = r.label ? `<div class="lab">${r.label}</div>` : '';
    return `<div class="row">${lab}<div class="t" style="font-family:'${r.font}';font-size:${r.size}px;font-variation-settings:'wght' ${r.wght ?? 400},'slnt' ${r.slnt ?? 0};${feat}${ls}${r.style || ''}">${r.text}</div></div>`;
  }).join('\n');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  ${faces}
  html,body{margin:0;background:${spec.bg || '#fff'};color:${spec.fg || '#000'};}
  body{padding:${spec.pad ?? 24}px;width:${spec.width || 1600}px;box-sizing:border-box;}
  .row{margin:0 0 ${spec.gap ?? 10}px 0;}
  .lab{font:12px/1.4 monospace;opacity:.6;margin-bottom:2px;}
  .t{line-height:${spec.lh ?? 1.25};white-space:nowrap;font-kerning:normal;}
  </style></head><body>${rows}</body></html>`;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: spec.width || 1600, height: 600 }, deviceScaleFactor: spec.scale || 1 });
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  await page.screenshot({ path: spec.out, fullPage: true });
  await browser.close();
})();
