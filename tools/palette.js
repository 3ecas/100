/* The colours of the numbers, for css/numbers.css.

   The ladder goes up in sets of four — 1 to 4, 5 to 8, and so on — and each
   set wears one colour: the lowest of the four in a light shade of it, the
   highest in a deep one, the two between in the steps between. Every set
   starts a little darker than the one before, so the run walks the wheel
   from a fresh green through yellow, orange, red, pink, purple, violet and blue
   to a deep teal, lightest at the bottom of the ladder and darkest at 33 to
   36. Past 36 the numbers walk the same 36 colours round again
   (js/data/pieces.js). The 100 alone wears every colour round the clock (the
   conic gradient in the CSS; the app icon draws the same wheel) and is not
   made here.

   The shades are set in OKLCH — the lightness and chroma numbers below mean
   what they say to the eye — and turned into the hex the CSS carries, with
   the chroma pulled in only as far as the screen's gamut makes it.

       node tools/palette.js            prints the rules
       node tools/palette.js --write    puts them into css/numbers.css */

const fs = require("fs");
const path = require("path");

// The warm colours turn brown as soon as they are muted, so yellow, orange
// and red keep more chroma than the rest; and yellow only reads as yellow
// when it is light, so that set sits a little higher than its place in the
// walk would put it.
const SETS = [
    { name: "green", hue: 148 },
    { name: "yellow", hue: 94, chroma: 0.16, lift: 0.06 },
    { name: "orange", hue: 55, chroma: 0.16, lift: 0.02 },
    { name: "red", hue: 24, chroma: 0.16, lift: 0.01 },
    { name: "pink", hue: 352 },
    { name: "purple", hue: 322 },
    { name: "violet", hue: 292 },
    { name: "blue", hue: 260 },
    { name: "teal", hue: 196 }
];

const TOP = 36;         // the last rung with a colour of its own: nine sets of four
const PER_SET = 4;
const LIGHT = 0.77;     // lightness of the 1, the lightest tile on the board
const STEP = 0.03;      // each rung in a set is this much darker than the last
const DROP = 0.045;     // and each set starts this much darker than the last
const CHROMA = 0.11;    // soft: well inside what the screen could show,
                        // unless a set above says otherwise

/* ---- OKLCH to sRGB --------------------------------------------------------- */

function oklchToLinear(L, C, h) {
    const a = C * Math.cos(h * Math.PI / 180);
    const b = C * Math.sin(h * Math.PI / 180);
    const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
    const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
    const s = Math.pow(L - 0.0894841775 * a - 1.2914855480 * b, 3);
    return [
        4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    ];
}

function channel(v) {
    const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    const byte = Math.max(0, Math.min(255, Math.round(c * 255)));
    return ("0" + byte.toString(16)).slice(-2);
}

// the nearest colour the screen can show: the same lightness and hue, with
// the chroma pulled in until every channel is in range
function hex(L, C, h) {
    for (let c = C; c >= 0; c -= 0.001) {
        const lin = oklchToLinear(L, c, h);
        if (lin.every(v => v >= -0.0005 && v <= 1.0005)) {
            return "#" + lin.map(v => channel(Math.max(0, Math.min(1, v)))).join("");
        }
    }
    return "#" + oklchToLinear(L, 0, h).map(channel).join("");
}

/* ---- the ladder ------------------------------------------------------------ */

function shade(n) {
    const set = Math.floor((n - 1) / PER_SET);
    let step = (n - 1) % PER_SET;

    // the last set is short by two rungs: they take the middle of its ramp,
    // so the top of the ladder is its darkest without dropping off it
    const short = TOP - set * PER_SET;
    if (short < PER_SET) step += Math.floor((PER_SET - short) / 2);

    const own = SETS[set];
    return {
        set: own,
        L: LIGHT + (own.lift || 0) - DROP * set - STEP * step,
        C: own.chroma || CHROMA
    };
}

function rules() {
    const lines = [];
    for (let n = 1; n <= TOP; n++) {
        const s = shade(n);
        if ((n - 1) % PER_SET === 0) {
            lines.push((n > 1 ? "\n" : "") + "/* " + s.set.name + " */");
        }
        lines.push(".num-" + n + " { --num: " + hex(s.L, s.C, s.set.hue) + "; }");
    }
    return lines.join("\n");
}

const START = "/* palette:start — written by tools/palette.js */";
const END = "/* palette:end */";

const out = rules();

if (process.argv.indexOf("--write") !== -1) {
    const file = path.join(__dirname, "..", "css", "numbers.css");
    const css = fs.readFileSync(file, "utf8");
    const from = css.indexOf(START);
    const to = css.indexOf(END);
    if (from === -1 || to === -1 || to < from) {
        console.error("css/numbers.css has no palette markers");
        process.exit(1);
    }
    fs.writeFileSync(file,
        css.slice(0, from) + START + "\n" + out + "\n" + css.slice(to));
    console.log("wrote " + TOP + " colours into css/numbers.css");
} else {
    console.log(out);
}
