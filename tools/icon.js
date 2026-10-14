/* =============================================================================
   35 — the app icon, everywhere it is needed, drawn by a browser
   -----------------------------------------------------------------------------
   The icon is the top of the ladder: 100, in the game's own face (fonts/
   Nunito.ttf), white, on the wheel of every colour the 100 wears — the same
   stops as .num-100 in css/numbers.css, round the clock from twelve, with a
   soft white pool over the heart so the colours mix at the centre. Drawn on
   a canvas in headless Chromium, so the face is the real one, and written
   out as PNGs by hand.

   It writes:
     ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png
                                             the iOS icon, 1024, no alpha
     ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732*.png
                                             the launch screen: the page's grey
     android/app/src/main/res/mipmap-*dpi/ic_launcher.png             square, 48 to 192
     android/app/src/main/res/mipmap-*dpi/ic_launcher_round.png       round, on nothing
     android/app/src/main/res/mipmap-*dpi/ic_launcher_foreground.png  adaptive: the 100 alone
     android/app/src/main/res/mipmap-*dpi/ic_launcher_background.png  adaptive: the wheel
     store/play/icon-512.png                 the Play listing icon (the site's too)
     store/play/feature-1024x500.png         the Play feature graphic

   It needs Playwright with Chromium: `npm install -g playwright && npx
   playwright install chromium` once, or PLAYWRIGHT_PATH pointing at an
   install. The PNGs are committed, so this only runs when the icon changes.

     npm run icons        (from the project root)
   ============================================================================= */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const root = path.join(__dirname, "..");
const res = path.join(root, "android", "app", "src", "main", "res");
const assets = path.join(root, "ios", "App", "App", "Assets.xcassets");
const store = path.join(root, "store", "play");

const WHEEL = ["#df676b", "#d97230", "#bd8700", "#989900", "#5ba84a", "#00ab86",
               "#00a6ad", "#00a0d3", "#5991ed", "#927fe7", "#ba71cb", "#d4679f"];
const POOL = 0.42;          // the soft centre reaches this far to the corner
const MIX = 0.55;           // and is this white at its heart
const SPAN = 0.74;          // the 100 spans this much of a square icon
const GREY = "#eef0f3";     // --bg in css/theme.css: the launch screen

function playwright() {
    const tries = ["playwright", process.env.PLAYWRIGHT_PATH, "/opt/node22/lib/node_modules/playwright"].filter(Boolean);
    for (const name of tries) {
        try { return require(name); } catch (e) { /* the next */ }
    }
    console.error("Playwright is not installed: npm install -g playwright && npx playwright install chromium");
    process.exit(1);
}

/* ---- PNG, written by hand: RGB or RGBA, rows unfiltered -------------------- */
const CRC = new Int32Array(256).map((_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c;
});

function crc32(buf) {
    let c = -1;
    for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
}

function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
}

function png(width, height, rgba, alpha) {
    const bpp = alpha ? 4 : 3;
    const raw = Buffer.alloc((width * bpp + 1) * height);
    for (let y = 0; y < height; y++) {
        const at = y * (width * bpp + 1);
        raw[at] = 0;
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const o = at + 1 + x * bpp;
            raw[o] = rgba[i]; raw[o + 1] = rgba[i + 1]; raw[o + 2] = rgba[i + 2];
            if (alpha) raw[o + 3] = rgba[i + 3];
        }
    }
    const head = Buffer.alloc(13);
    head.writeUInt32BE(width, 0); head.writeUInt32BE(height, 4);
    head[8] = 8; head[9] = alpha ? 6 : 2; head[10] = 0; head[11] = 0; head[12] = 0;
    return Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        chunk("IHDR", head), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))
    ]);
}

function save(file, width, height, rgba, alpha) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, png(width, height, rgba, alpha));
    console.log("wrote " + width + "×" + height + "  " + path.relative(root, file));
}

function plain(width, height, hex) {
    const v = parseInt(hex.slice(1), 16);
    const px = Buffer.alloc(width * height * 4);
    for (let i = 0; i < px.length; i += 4) {
        px[i] = (v >> 16) & 255; px[i + 1] = (v >> 8) & 255; px[i + 2] = v & 255; px[i + 3] = 255;
    }
    return px;
}

/* ---- the drawing, in the browser ------------------------------------------------ */
// spec: { w, h, rings, text, round, span } — the wheel and the text each
// on or off, round clips to the inscribed circle, span is how wide the 100 runs
function draw(spec) {
    const c = document.createElement("canvas");
    c.width = spec.w; c.height = spec.h;
    const g = c.getContext("2d");
    const cx = spec.w / 2, cy = spec.h / 2;

    if (spec.round) {
        g.beginPath(); g.arc(cx, cy, Math.min(cx, cy), 0, Math.PI * 2); g.clip();
    }
    if (spec.rings) {
        // the wheel from twelve, clockwise — as the CSS conic gradient
        const wheel = g.createConicGradient(-Math.PI / 2, cx, cy);
        spec.wheel.forEach((hex, i) => wheel.addColorStop(i / 12, hex));
        wheel.addColorStop(1, spec.wheel[0]);
        g.fillStyle = wheel;
        g.fillRect(0, 0, spec.w, spec.h);

        // the soft pool over the heart, where the colours mix
        const far = Math.hypot(cx, cy);
        const pool = g.createRadialGradient(cx, cy, 0, cx, cy, far * spec.pool);
        pool.addColorStop(0, "rgba(255,255,255," + spec.mix + ")");
        pool.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = pool;
        g.fillRect(0, 0, spec.w, spec.h);
    }
    if (spec.text) {
        let size = 100;
        g.font = "900 " + size + "px Nunito";
        const wide = g.measureText(spec.text).width;
        size = size * spec.span / wide;
        g.font = "900 " + size + "px Nunito";
        g.fillStyle = "#fff";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(spec.text, cx, cy + size * 0.06);
    }
    const data = g.getImageData(0, 0, spec.w, spec.h).data;
    let s = "";
    for (let i = 0; i < data.length; i += 8192) s += String.fromCharCode.apply(null, data.subarray(i, i + 8192));
    return btoa(s);
}

async function main() {
    const { chromium } = playwright();
    const browser = await chromium.launch();
    const page = await browser.newPage();
    // the face goes in as data: a blank page may load nothing from disk
    const font = "data:font/ttf;base64," + fs.readFileSync(path.join(root, "fonts", "Nunito.ttf")).toString("base64");
    await page.setContent('<style>@font-face{font-family:"Nunito";src:url("' + font + '") format("truetype");font-weight:200 1000}</style>' +
        '<span style="font:900 40px Nunito">100</span>');
    await page.evaluate(() => document.fonts.load("900 40px Nunito"));
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => document.fonts.check("900 40px Nunito"));

    const render = async (spec) => Buffer.from(await page.evaluate(draw, Object.assign({ wheel: WHEEL, pool: POOL, mix: MIX }, spec)), "base64");
    const icon = (size, round) => render({ w: size, h: size, rings: true, text: "100", span: size * SPAN, round: !!round });

    // iOS: the icon with no alpha channel — App Store Connect rejects one — and the launch screen
    save(path.join(assets, "AppIcon.appiconset", "AppIcon-512@2x.png"), 1024, 1024, await icon(1024), false);
    const launch = plain(2732, 2732, GREY);
    for (const name of ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]) {
        save(path.join(assets, "Splash.imageset", name), 2732, 2732, launch, false);
    }

    // Android: the square and round icons, and the adaptive layers. An adaptive
    // icon shows the middle 72 of its 108, so the 100 is drawn at the size it
    // has on the square icon, as seen through that window.
    const DENSITY = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
    for (const name of Object.keys(DENSITY)) {
        const dir = path.join(res, "mipmap-" + name);
        const legacy = Math.round(48 * DENSITY[name]);
        const layer = Math.round(108 * DENSITY[name]);
        save(path.join(dir, "ic_launcher.png"), legacy, legacy, await icon(legacy), true);
        save(path.join(dir, "ic_launcher_round.png"), legacy, legacy, await icon(legacy, true), true);
        save(path.join(dir, "ic_launcher_foreground.png"), layer, layer,
             await render({ w: layer, h: layer, rings: false, text: "100", span: layer * 72 / 108 * SPAN }), true);
        save(path.join(dir, "ic_launcher_background.png"), layer, layer,
             await render({ w: layer, h: layer, rings: true, text: "" }), true);
    }

    // Google Play: the listing icon (the website's icon too) and the feature graphic
    save(path.join(store, "icon-512.png"), 512, 512, await icon(512), true);
    save(path.join(store, "feature-1024x500.png"), 1024, 500,
         await render({ w: 1024, h: 500, rings: true, text: "100", span: 500 * SPAN }), true);

    await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
