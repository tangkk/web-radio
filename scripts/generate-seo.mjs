import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stations = JSON.parse(await fs.readFile(path.join(root, 'stations.json'), 'utf8'));
const lastmod = new Date().toISOString().slice(0, 10);

const escapeHtml = value => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const regions = new Map();
for (const station of stations) {
  const region = station.region || '其他地區';
  if (!regions.has(region)) regions.set(region, []);
  regions.get(region).push(station);
}

const regionSections = [...regions.entries()].map(([region, items]) => `
      <section>
        <h2>${escapeHtml(region)}</h2>
        <ul>${items.map(station => `
          <li>
            <a href="${escapeHtml(station.official)}" rel="external noreferrer">${escapeHtml(station.name)}</a>
            <span>${escapeHtml(station.broadcaster)} · ${escapeHtml(station.language)} · ${escapeHtml(station.frequency)}</span>
          </li>`).join('')}
        </ul>
      </section>`).join('');

const itemList = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Web Radio 電台目錄',
  numberOfItems: stations.length,
  itemListElement: stations.map((station, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: station.name,
    url: station.official
  }))
};

const html = `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>全球網絡電台目錄｜Web Radio</title>
  <meta name="description" content="按地區瀏覽 Web Radio 收錄的全球音樂、新聞與綜合網絡電台，並前往播放器直接收聽公開直播。">
  <meta name="robots" content="index,follow,max-image-preview:large">
  <link rel="canonical" href="https://tangkk.github.io/web-radio/stations.html">
  <link rel="icon" href="./favicon.svg" type="image/svg+xml">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Web Radio">
  <meta property="og:title" content="全球網絡電台目錄｜Web Radio">
  <meta property="og:description" content="按地區瀏覽全球音樂、新聞與綜合網絡電台。">
  <meta property="og:url" content="https://tangkk.github.io/web-radio/stations.html">
  <meta property="og:image" content="https://tangkk.github.io/web-radio/og-image.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <script type="application/ld+json">${JSON.stringify(itemList).replaceAll('<', '\\u003c')}</script>
  <style>
    :root{color-scheme:light;--ink:#111;--muted:#666;--line:#c8c8c8;--accent:#e4332a}*{box-sizing:border-box}body{margin:0;background:#fff;color:var(--ink);font:15px/1.5 system-ui,sans-serif}.page{width:min(1000px,calc(100% - 32px));margin:auto;padding:40px 0 80px}a{color:inherit}header{border-bottom:2px solid var(--ink);padding-bottom:24px}h1{margin:0;font-size:clamp(32px,6vw,56px);letter-spacing:-.045em}header p{max-width:720px;color:var(--muted)}.back{display:inline-block;margin-bottom:20px;color:var(--accent)}section{padding:24px 0;border-bottom:1px solid var(--line)}h2{margin:0 0 12px;font-size:20px}ul{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 28px;margin:0;padding:0;list-style:none}li{display:flex;justify-content:space-between;gap:18px;border-top:1px solid #eee;padding:10px 0}li span{color:var(--muted);font-size:12px;text-align:right}@media(max-width:700px){ul{grid-template-columns:1fr}}
  </style>
</head>
<body><main class="page">
  <a class="back" href="./">← 返回 Web Radio 播放器</a>
  <header><h1>全球網絡電台目錄</h1><p>按地區瀏覽本站收錄的 ${stations.length} 個公開直播頻道。音訊由瀏覽器直接連接廣播機構或其分發服務。</p></header>
  ${regionSections}
</main></body>
</html>
`;

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://tangkk.github.io/web-radio/</loc><lastmod>${lastmod}</lastmod><priority>1.0</priority></url>
  <url><loc>https://tangkk.github.io/web-radio/stations.html</loc><lastmod>${lastmod}</lastmod><priority>0.8</priority></url>
</urlset>
`;

await fs.writeFile(path.join(root, 'stations.html'), html);
await fs.writeFile(path.join(root, 'sitemap.xml'), sitemap);
console.log(`Generated stations.html and sitemap.xml for ${stations.length} stations`);
