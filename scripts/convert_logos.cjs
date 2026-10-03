const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const platformsDir = path.resolve(__dirname, '../artifacts/streaming/assets/images/platforms');
if (!fs.existsSync(platformsDir)) {
  fs.mkdirSync(platformsDir, { recursive: true });
}

// 1. Roku SVG
const rokuSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 65" width="200" height="65">
  <path fill="#662D91" d="M136.2 23.4l-18.8 18.8v-18.8h-16.3v47.9h16.3V41.8l19.6 19.4h20.5l-24.9-24.9 20.6-20.6v28.4c0 9.4 5.7 18.1 19.9 18.1 6.8 0 13-3.8 16-7.3l7.3 6.3h16.2V23.4h-16.3v31c-1.8 3.2-4.4 5.2-8.3 5.2-4 0-5.9-2.4-5.9-10V23.4h-26.2zm-38.3 23.9c0 14.8-11.2 25-25 25s-25.1-10.2-25.1-25 11.2-25 25.1-25 25 10.2 25 25zm-25.1-13.1c-4.3 0-8 5.9-8 13.1 0 7.2 3.6 13.1 8 13.1 4.4 0 8.1-5.9 8.1-13.1 0-7.2-3.7-13.1-8.1-13.1zm-18.4 37.1H36l-14.7-20.8h-5v20.8H0V10.1h23.3c13.5 0 24.5 9.2 24.5 20.4 0 6.9-4.2 13-10.6 16.8l17.2 24zm-22.9-40.7c0-4.1-3.6-7.4-8-7.4h-5v14.7h5c4.4 0 8-3.3 8-7.3z"/>
</svg>`;

// 2. Apple TV SVG
const appleTvSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 70" width="200" height="70">
  <!-- Apple TV White -->
  <g fill="#FFFFFF">
    <path d="M171.4 59.1h-15.1l-27.8-76.7h13.6l16.8 49.9c.6 1.9 2.3 7.5 4.9 16.8l2.5-8.3 2.7-8.4 17.5-50h14.5l-29.6 76.7zm-44.5-.5c-3.9 1.1-8.1 1.7-12.9 1.7-10.3 0-15.3-5.8-15.3-17.4V25.2H89.8V15.9h9.3V3.8l12.3-5v17.2h14.2v9.3h-14.2v48.4c0 3.7.6 6.3 1.8 7.8 1.2 1.5 3.3 2.2 6.3 2.2 1.7 0 4.1-.3 7.4-1l-1.3 17.1zM66.1 14.1c.1 14.7 12.9 19.6 13.1 19.7-.1.3-2.1 7-6.7 13.8-4.1 5.9-8.3 11.8-14.9 12-6.5.1-8.6-3.8-16.1-3.8-7.4 0-9.8 3.7-15.9 4-6.3.2-11.2-6.5-15.3-12.4-8.3-12.1-14.7-34.1-6.1-49 4.3-7.4 11.9-12.1 20.1-12.2 6.3-.1 12.2 4.3 16.1 4.3 3.8 0 11.1-5.2 18.6-4.5 3.2.1 12.1 1.3 17.8 9.6-.5.3-10.6 6.2-10.6 18.5zm1.5-33.8c3.4-4.1 5.7-9.8 5.1-15.5-4.9.2-10.8 3.2-14.4 7.4-3.2 3.6-5.9 9.5-5.2 15 5.4.4 11.1-2.8 14.5-6.9z" transform="translate(10, 15) scale(0.7)"/>
  </g>
</svg>`;

// 3. Samsung White Oval Badge SVG
const samsungBadgeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 70" width="200" height="70">
  <g transform="translate(10, 5)">
    <ellipse cx="90" cy="30" rx="88" ry="26" transform="rotate(-6 90 30)" fill="#FFFFFF" />
    <!-- Samsung Black Wordmark -->
    <g fill="#000000" transform="translate(26, 17) scale(5.3)">
      <path d="M19.8166 10.2808l.0459 2.6934h-.023l-.7793-2.6934h-1.2837v3.3925h.8481l-.0458-2.785h.023l.8366 2.785h1.2264v-3.3925zm-16.149 0l-.6418 3.427h.9284l.4699-3.1175h.0229l.4585 3.1174h.9169l-.6304-3.4269zm5.1805 0l-.424 2.6132h-.023l-.424-2.6132H6.5788l-.0688 3.427h.8596l.023-3.0832h.0114l.573 3.0831h.8711l.5731-3.083h.023l.0228 3.083h.8596l-.0802-3.4269zm-7.2664 2.4527c.0343.0802.0229.1949.0114.2522-.0229.1146-.1031.2292-.3324.2292-.2177 0-.3438-.126-.3438-.3095v-.3323H0v.2636c0 .7679.6074.9971 1.2493.9971.6189 0 1.1346-.2178 1.2149-.7794.0458-.298.0114-.4928 0-.5616-.1605-.722-1.467-.9283-1.5588-1.3295-.0114-.0688-.0114-.1375 0-.1834.023-.1146.1032-.2292.3095-.2292.2063 0 .321.126.321.3095v.2063h.8595v-.2407c0-.745-.6762-.8596-1.1576-.8596-.6074 0-1.1117.2063-1.2034.7564-.023.149-.0344.2866.0114.4585.1376.7106 1.364.9169 1.5358 1.3524m11.152 0c.0343.0803.0228.1834.0114.2522-.023.1146-.1032.2292-.3324.2292-.2178 0-.3438-.126-.3438-.3095v-.3323h-.917v.2636c0 .7564.596.9857 1.2379.9857.6189 0 1.1232-.2063 1.2034-.7794.0459-.298.0115-.4814 0-.5616-.1375-.7106-1.4327-.9284-1.5243-1.318-.0115-.0688-.0115-.1376 0-.1835.0229-.1146.1031-.2292.3094-.2292.1948 0 .321.126.321.3095v.2063h.848v-.2407c0-.745-.6647-.8596-1.146-.8596-.6075 0-1.1004.1948-1.192.7564-.023.149-.023.2866.0114.4585.1376.7106 1.341.9054 1.513 1.3524m2.8882.4585c.2407 0 .3094-.1605.3323-.2522.0115-.0343.0115-.0917.0115-.126v-2.533h.871v2.4642c0 .0688 0 .1948-.0114.2292-.0573.6419-.5616.8482-1.192.8482-.6303 0-1.1346-.2063-1.192-.8482 0-.0344-.0114-.1604-.0114-.2292v-2.4642h.871v2.533c0 .0458 0 .0916.0115.126 0 .0917.0688.2522.3095.2522m7.1518-.0344c.2522 0 .3324-.1605.3553-.2522.0115-.0343.0115-.0917.0115-.126v-.4929h-.3553v-.5043H24v.917c0 .0687 0 .1145-.0115.2292-.0573.6303-.596.8481-1.2034.8481-.6075 0-1.1461-.2178-1.2034-.8481-.0115-.1147-.0115-.1605-.0115-.2293v-1.444c0-.0574.0115-.172.0115-.2293.0802-.6419.596-.8482 1.2034-.8482s1.1347.2063 1.2034.8482c.0115.1031.0115.2292.0115.2292v.1146h-.8596v-.1948s0-.0803-.0115-.1261c-.0114-.0802-.0802-.2521-.3438-.2521-.2521 0-.321.1604-.3438.2521-.0115.0458-.0115.1032-.0115.1605v1.5702c0 .0458 0 .0916.0115.126 0 .0917.0917.2522.3323.2522"/>
    </g>
  </g>
</svg>`;

// 4. LG webOS Lockup SVG
const lgWebOsSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 65" width="200" height="65">
  <!-- LG Circle -->
  <g transform="translate(10, 7) scale(2.0)">
    <circle cx="12" cy="12" r="12" fill="#A50034"/>
    <circle cx="7" cy="9.5" r="1.5" fill="#FFFFFF"/>
    <path fill="none" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M12 7.5v8h5 M19 12a7 7 0 1 1-1.8-4.7"/>
  </g>
  <!-- LG Text -->
  <text x="68" y="34" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="28" fill="#FFFFFF">LG</text>
  <!-- webOS Text -->
  <text x="68" y="52" font-family="Arial, Helvetica, sans-serif" font-weight="600" font-size="16" fill="#c30036">web<tspan fill="#A0A5AA">OS</tspan></text>
</svg>`;

fs.writeFileSync(path.join(platformsDir, 'roku_badge.svg'), rokuSvg);
fs.writeFileSync(path.join(platformsDir, 'appletv_badge.svg'), appleTvSvg);
fs.writeFileSync(path.join(platformsDir, 'samsung_badge.svg'), samsungBadgeSvg);
fs.writeFileSync(path.join(platformsDir, 'lg_webos_badge.svg'), lgWebOsSvg);

console.log('SVGs created successfully.');

// Now render each to a transparent PNG using Microsoft Edge Headless
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const renderSvgToPng = (svgContent, width, height, outName) => {
  const htmlContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  html, body {
    margin: 0;
    padding: 0;
    background: transparent !important;
    overflow: hidden;
  }
  .container {
    width: ${width}px;
    height: ${height}px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
</head>
<body>
  <div class="container">
    ${svgContent}
  </div>
</body>
</html>`;

  const htmlPath = path.join(platformsDir, `${outName}.html`);
  const pngPath = path.join(platformsDir, `${outName}.png`);
  fs.writeFileSync(htmlPath, htmlContent);

  try {
    const cmd = `"${edgePath}" --headless --default-background-color=00000000 --screenshot="${pngPath}" --window-size=${width},${height} "${htmlPath}"`;
    execSync(cmd, { stdio: 'ignore' });
    console.log(`Rendered ${outName}.png (${width}x${height})`);
  } catch (err) {
    console.error(`Failed to render ${outName}:`, err.message);
  } finally {
    try { fs.unlinkSync(htmlPath); } catch (_) {}
  }
};

renderSvgToPng(rokuSvg, 240, 80, 'roku');
renderSvgToPng(appleTvSvg, 240, 80, 'appletv');
renderSvgToPng(samsungBadgeSvg, 240, 80, 'samsung');
renderSvgToPng(lgWebOsSvg, 240, 80, 'lg_webos');

console.log('Finished rendering PNGs.');
