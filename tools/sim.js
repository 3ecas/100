/* =============================================================================
   35 — a bot that plays the game, many runs over, to measure the climb
   -----------------------------------------------------------------------------
   Loads the game's own rules — the ladder, the board, the round, the bomb
   dial — into a sandbox with no screen, and plays run after run with a
   simple, steady strategy: drop where three would meet; failing that, next
   to the same number, low down; name the most numerous number when infinity
   asks; spend the bomb on the most crowded spot once the board is half full.
   It is no better than a decent player and no worse, and it plays the same
   way under every setting, which is what makes the settings comparable.

   Each setting is a change to the live config, applied to a fresh copy of
   the game. For every setting it reports how many runs reached 35, where
   the others died, and how long runs lasted.

     node tools/sim.js                 200 runs of every setting
     node tools/sim.js 500             500 runs of every setting
     node tools/sim.js 300 base,withinf only those settings

   The end game is measured apart: `after` starts every run with a 35
   already made — the deal at its top, the seam at full strength, the score
   past infinity's threshold — and plays on until the board fills, or until
   AFTER_CAP more drops, which is called endless.

     node tools/sim.js after 300 base,win4
   ============================================================================= */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const AFTER = process.argv[2] === "after";
const RUNS = Number(process.argv[AFTER ? 3 : 2]) || 200;
const ONLY = process.argv[AFTER ? 4 : 3] ? process.argv[AFTER ? 4 : 3].split(",") : null;

const PEAK = 35;
const MOST_DROPS = 6000;         // a run that long is called a reach
const AFTER_CAP = 800;           // drops after a 35 that are called endless
const CROWDED = 14;              // free squares at or under this: spend the bomb

/* ---- the settings to try ----------------------------------------------- */
const SETTINGS = {
    base: {
        note: "as the game is: the ladder to 100, old numbers merging in pairs, the dial at 12, the seam stopping at 20",
        uncap: true,
        apply: function () {}
    },
    withinf: {
        note: "as it was before: infinity from 6,250 points every 80 drops (65 from 25), the dial at 20",
        apply: function (Game) {
            Game.Config.game.infinityFrom = 6250;
            Game.Config.game.late.infinityEvery = 65;
            Game.Config.game.bombPace = 20;
            Game.Config.game.late.bombPace = 20;
        }
    },
    bomb20: {
        note: "no infinity, the dial at 20",
        apply: function (Game) { Game.Config.game.bombPace = 20; Game.Config.game.late.bombPace = 20; }
    },
    bomb12: {
        note: "no infinity, the dial at 12",
        apply: function (Game) { Game.Config.game.bombPace = 12; Game.Config.game.late.bombPace = 12; }
    },
    before: {
        note: "as it first was: infinity, the dial at 20, the seam stepping up to 3 every 2 at 30, 34 never dealt",
        apply: function (Game) {
            SETTINGS.withinf.apply(Game);
            Game.Config.game.falls.push({ from: 30, count: 3, every: 2 });
            dealTo(Game, PEAK - 2);
        }
    },
    "6x8": {
        note: "as the game is, 35 capped, on a board 6 across and 8 high",
        apply: function (Game) { Game.Config.game.rows = 8; }
    },
    room16: {
        note: "a fall takes at most a sixth of the free squares, not a quarter",
        apply: function (Game) { Game.Config.game.fallRoom = 1 / 6; }
    },

    // ---- the end game: what could close a run that has made its 35 ----------
    win4: {
        note: "four numbers in the deal instead of three, the whole run through",
        apply: function (Game) { dealWindow(Game, 4, 0); }
    },
    win4late: {
        note: "four numbers in the deal from 25 on",
        apply: function (Game) { dealWindow(Game, 4, 25); }
    },
    tighten: {
        note: "after a 35 the seam tightens every 40 drops: 2 every 3, 2 every 2, 3 every 2, 3 every 1, 4 every 1",
        apply: function () {},
        tick: function (Game, after) {
            const steps = [[2, 3], [2, 2], [3, 2], [3, 1], [4, 1]];
            const k = Math.min(steps.length - 1, Math.floor(after / 40));
            const table = Game.Config.game.falls;
            table[table.length - 1].count = steps[k][0];
            table[table.length - 1].every = steps[k][1];
        }
    },
    "win4+tighten": {
        note: "four in the deal from 25, and the seam tightening after a 35",
        apply: function (Game) { dealWindow(Game, 4, 25); },
        tick: function (Game, after) { SETTINGS.tighten.tick(Game, after); }
    },
    win4after: {
        note: "four numbers in the deal only once a 35 is made",
        apply: function (Game) { dealWindow(Game, 4, PEAK); }
    },
    "win4after+tighten": {
        note: "four in the deal once a 35 is made, and the seam tightening after it",
        apply: function (Game) { dealWindow(Game, 4, PEAK); },
        tick: function (Game, after) { SETTINGS.tighten.tick(Game, after); }
    },
    "tighten+room": {
        note: "the seam tightening after a 35, and a fall allowed more of the free squares as it goes: half after 100 drops, all after 200",
        apply: function () {},
        tick: function (Game, after) {
            SETTINGS.tighten.tick(Game, after);
            Game.Config.game.fallRoom = Math.min(1, 0.25 + 0.75 * after / 200);
        }
    },
    stay35: {
        note: "35s never cash out: they stay, and the board shrinks by a square for every 35 made",
        apply: function (Game) { Game.Config.game.cashAt = Infinity; }
    },
    "stay35+tighten": {
        note: "35s stay, and the seam tightens every 40 drops after a 35",
        apply: function (Game) { Game.Config.game.cashAt = Infinity; },
        tick: function (Game, after) { SETTINGS.tighten.tick(Game, after); }
    },
    cash4: {
        note: "four 35s together cash out, not three",
        apply: function (Game) { Game.Config.game.cashAt = 4; }
    },
    cash5: {
        note: "five 35s together cash out, not three",
        apply: function (Game) { Game.Config.game.cashAt = 5; }
    },
    cash6: {
        note: "six 35s together cash out, not three",
        apply: function (Game) { Game.Config.game.cashAt = 6; }
    },
    "cash5+tighten": {
        note: "five 35s to cash out, and the seam tightening every 40 drops after a 35",
        apply: function (Game) { Game.Config.game.cashAt = 5; },
        tick: function (Game, after) { SETTINGS.tighten.tick(Game, after); }
    },
    room1: {
        note: "after a 35 a fall may take every free square, not a quarter",
        apply: function (Game) { Game.Config.game.fallRoom = 1; }
    },
    "tighten+room1": {
        note: "the seam tightening every 40 drops after a 35, and falls taking every free square",
        apply: function (Game) { Game.Config.game.fallRoom = 1; },
        tick: function (Game, after) { SETTINGS.tighten.tick(Game, after); }
    },
    "tightenfast+room1": {
        note: "the seam tightening every 20 drops after a 35, and falls taking every free square",
        apply: function (Game) { Game.Config.game.fallRoom = 1; },
        tick: function (Game, after) { SETTINGS.tighten.tick(Game, after * 2); }
    },
    nobomb: {
        note: "after a 35 the dial never fills again",
        apply: function (Game) { Game.Config.game.bombPace = 1e9; Game.Config.game.late.bombPace = 1e9; }
    },
    uncap: {
        note: "no cap: 35 merges into 36 and on up; the deal follows the top as it does below 35",
        uncap: true,
        apply: function () {}
    },
    "uncap+linear": {
        note: "no cap, and every number pays its own value: 1 pays 1, 35 pays 35, 46 pays 46",
        uncap: true,
        apply: function (Game) { Game.Pieces.list.forEach(p => { p.points = p.tier; }); }
    },
    "uncap+6x8": {
        note: "no cap, on a board 6 across and 8 high",
        uncap: true,
        apply: function (Game) { Game.Config.game.rows = 8; }
    },
    "uncap+6x8+linear": {
        note: "no cap, 6 by 8, and every number paying its own value",
        uncap: true,
        apply: function (Game) { Game.Config.game.rows = 8; Game.Pieces.list.forEach(p => { p.points = p.tier; }); }
    },
    "u-seam20": {
        note: "no cap; the seam stops growing at 20 (2 every 5)",
        uncap: true,
        apply: function (Game) { Game.Config.game.falls.pop(); }
    },
    "u-seam15": {
        note: "no cap; the seam stops growing at 15 (1 every 3)",
        uncap: true,
        apply: function (Game) { Game.Config.game.falls.splice(2); }
    },
    "u-seam10": {
        note: "no cap; the seam never grows past 1 every 5",
        uncap: true,
        apply: function (Game) { Game.Config.game.falls.splice(1); }
    },
    "u-noseam": {
        note: "no cap; nothing ever falls in",
        uncap: true,
        apply: function (Game) { Game.Config.game.falls = []; }
    },
    "u-hand2": {
        note: "no cap; the hand deals only the top two numbers",
        uncap: true,
        apply: function (Game) { dealWidth(Game, 2); }
    },
    "u-bomb8": {
        note: "no cap; the bomb dial fills in 8 merges",
        uncap: true,
        apply: function (Game) { Game.Config.game.bombPace = 8; Game.Config.game.late.bombPace = 8; }
    },
    "u-hand2+seam15": {
        note: "no cap; the top two dealt, and the seam stopping at 1 every 3",
        uncap: true,
        apply: function (Game) { dealWidth(Game, 2); Game.Config.game.falls.splice(2); }
    },
    "u-bomb8+seam10": {
        note: "no cap; the dial at 8, the seam never past 1 every 5",
        uncap: true,
        apply: function (Game) { SETTINGS["u-bomb8"].apply(Game); Game.Config.game.falls.splice(1); }
    },
    "u-bomb5+seam10": {
        note: "no cap; the dial at 5, the seam never past 1 every 5",
        uncap: true,
        apply: function (Game) { Game.Config.game.bombPace = 5; Game.Config.game.late.bombPace = 5; Game.Config.game.falls.splice(1); }
    },
    "u-bomb5+seam20": {
        note: "no cap; the dial at 5, the seam stopping at 2 every 5",
        uncap: true,
        apply: function (Game) { Game.Config.game.bombPace = 5; Game.Config.game.late.bombPace = 5; Game.Config.game.falls.pop(); }
    },
    "u-bomb8+noseam": {
        note: "no cap; the dial at 8, nothing falls in",
        uncap: true,
        apply: function (Game) { SETTINGS["u-bomb8"].apply(Game); Game.Config.game.falls = []; }
    },
    "u-bomb8+seam20": {
        note: "no cap; the dial at 8, the seam stopping at 2 every 5",
        uncap: true,
        apply: function (Game) { SETTINGS["u-bomb8"].apply(Game); Game.Config.game.falls.pop(); }
    },
    "u-bomb10+seam20": {
        note: "no cap; the dial at 10, the seam stopping at 2 every 5",
        uncap: true,
        apply: function (Game) { Game.Config.game.bombPace = 10; Game.Config.game.late.bombPace = 10; Game.Config.game.falls.pop(); }
    },
    "u-bomb10": {
        note: "no cap; the dial at 10, the seam as it is",
        uncap: true,
        apply: function (Game) { Game.Config.game.bombPace = 10; Game.Config.game.late.bombPace = 10; }
    },
    "old2": {
        note: "numbers below the deal merge in pairs instead of threes",
        uncap: true,
        apply: function (Game) { Game.Config.game.oldMergeAt = 2; }
    },
    "blast2": {
        note: "the bomb takes the 5 x 5 around it instead of 3 x 3",
        uncap: true,
        apply: function (Game) { Game.Config.game.blastReach = 2; }
    },
    "old2+blast2": {
        note: "both",
        uncap: true,
        apply: function (Game) { Game.Config.game.oldMergeAt = 2; Game.Config.game.blastReach = 2; }
    },
    "blast2+dial15": {
        note: "blast2, with the dial at 15",
        uncap: true,
        apply: function (Game) { Game.Config.game.blastReach = 2; Game.Config.game.bombPace = 15; Game.Config.game.late.bombPace = 15; }
    },
    "blast2+dial20": {
        note: "blast2, with the dial at 20",
        uncap: true,
        apply: function (Game) { Game.Config.game.blastReach = 2; Game.Config.game.bombPace = 20; Game.Config.game.late.bombPace = 20; }
    },
    "old2+dial15": {
        note: "old2, with the dial at 15",
        uncap: true,
        apply: function (Game) { Game.Config.game.oldMergeAt = 2; Game.Config.game.bombPace = 15; Game.Config.game.late.bombPace = 15; }
    },
    "old2+dial20": {
        note: "old2, with the dial at 20",
        uncap: true,
        apply: function (Game) { Game.Config.game.oldMergeAt = 2; Game.Config.game.bombPace = 20; Game.Config.game.late.bombPace = 20; }
    },
    "dial10": {
        note: "the test build with the dial at 10",
        uncap: true,
        apply: function (Game) { Game.Config.game.bombPace = 10; Game.Config.game.late.bombPace = 10; }
    },
    "old2+dial10": {
        note: "old numbers merge in pairs, the dial at 10",
        uncap: true,
        apply: function (Game) { Game.Config.game.oldMergeAt = 2; Game.Config.game.bombPace = 10; Game.Config.game.late.bombPace = 10; }
    },
    "blast2+dial10": {
        note: "the bomb takes 5 x 5, the dial at 10",
        uncap: true,
        apply: function (Game) { Game.Config.game.blastReach = 2; Game.Config.game.bombPace = 10; Game.Config.game.late.bombPace = 10; }
    },
    "mult-alt20": {
        note: "the dial at 20 gives bomb, x2, bomb, x3 in turn",
        uncap: true,
        mult: { cycle: ["bomb", "x2", "bomb", "x3"], protect: false },
        apply: function (Game) { Game.Config.game.bombPace = 20; Game.Config.game.late.bombPace = 20; }
    },
    "mult-alt15": {
        note: "the dial at 15 gives bomb, x2, bomb, x3 in turn",
        uncap: true,
        mult: { cycle: ["bomb", "x2", "bomb", "x3"], protect: false },
        apply: function (Game) { Game.Config.game.bombPace = 15; Game.Config.game.late.bombPace = 15; }
    },
    "mult-only20": {
        note: "the dial at 20 gives x2 and x3 in turn, no bomb",
        uncap: true,
        mult: { cycle: ["x2", "x3"], protect: false },
        apply: function (Game) { Game.Config.game.bombPace = 20; Game.Config.game.late.bombPace = 20; }
    },
    "mult-old20": {
        note: "as mult-alt20, but x2 and x3 spare the numbers the hand still deals",
        uncap: true,
        mult: { cycle: ["bomb", "x2", "bomb", "x3"], protect: true },
        apply: function (Game) { Game.Config.game.bombPace = 20; Game.Config.game.late.bombPace = 20; }
    },
    "mult-old15": {
        note: "as mult-alt15, but x2 and x3 spare the numbers the hand still deals",
        uncap: true,
        mult: { cycle: ["bomb", "x2", "bomb", "x3"], protect: true },
        apply: function (Game) { Game.Config.game.bombPace = 15; Game.Config.game.late.bombPace = 15; }
    },
    "dial15": {
        note: "the test build with the dial at 15, the plain bomb only",
        uncap: true,
        apply: function (Game) { Game.Config.game.bombPace = 15; Game.Config.game.late.bombPace = 15; }
    },
    "dial20": {
        note: "the test build with the dial at 20, the plain bomb only",
        uncap: true,
        apply: function (Game) { Game.Config.game.bombPace = 20; Game.Config.game.late.bombPace = 20; }
    },
    "mult-alt10": {
        note: "the dial at 10 gives bomb, x2, bomb, x3 in turn",
        uncap: true,
        mult: { cycle: ["bomb", "x2", "bomb", "x3"], protect: false },
        apply: function (Game) { Game.Config.game.bombPace = 10; Game.Config.game.late.bombPace = 10; }
    },
    "mult-alt12": {
        note: "the dial at 12 gives bomb, x2, bomb, x3 in turn",
        uncap: true,
        mult: { cycle: ["bomb", "x2", "bomb", "x3"], protect: false },
        apply: function (Game) { Game.Config.game.bombPace = 12; Game.Config.game.late.bombPace = 12; }
    },
    "grid6x8": {
        note: "the test build on a board 6 across and 8 high",
        uncap: true,
        apply: function (Game) { Game.Config.game.cols = 6; Game.Config.game.rows = 8; }
    },
    "grid7x7": {
        note: "the test build on a board 7 across and 7 high",
        uncap: true,
        apply: function (Game) { Game.Config.game.cols = 7; Game.Config.game.rows = 7; }
    },
    "grid8x8": {
        note: "the test build on a board 8 across and 8 high",
        uncap: true,
        apply: function (Game) { Game.Config.game.cols = 8; Game.Config.game.rows = 8; }
    },
    "grid9x9": {
        note: "the test build on a board 9 across and 9 high",
        uncap: true,
        apply: function (Game) { Game.Config.game.cols = 9; Game.Config.game.rows = 9; }
    },
    "mult-alt8": {
        note: "bomb, x2, bomb, x3 from the dial at 8",
        uncap: true,
        mult: { cycle: ["bomb", "x2", "bomb", "x3"], protect: false },
        apply: function (Game) { Game.Config.game.bombPace = 8; Game.Config.game.late.bombPace = 8; }
    },
    "mult-alt10+old2": {
        note: "bomb, x2, bomb, x3 from the dial at 10, old numbers merging in pairs",
        uncap: true,
        mult: { cycle: ["bomb", "x2", "bomb", "x3"], protect: false },
        apply: function (Game) { Game.Config.game.bombPace = 10; Game.Config.game.late.bombPace = 10; Game.Config.game.oldMergeAt = 2; }
    },
    "mult-alt12+old2": {
        note: "bomb, x2, bomb, x3 from the dial at 12, old numbers merging in pairs",
        uncap: true,
        mult: { cycle: ["bomb", "x2", "bomb", "x3"], protect: false },
        apply: function (Game) { Game.Config.game.bombPace = 12; Game.Config.game.late.bombPace = 12; Game.Config.game.oldMergeAt = 2; }
    },
    "mult-alt15+old2": {
        note: "bomb, x2, bomb, x3 from the dial at 15, old numbers merging in pairs",
        uncap: true,
        mult: { cycle: ["bomb", "x2", "bomb", "x3"], protect: false },
        apply: function (Game) { Game.Config.game.bombPace = 15; Game.Config.game.late.bombPace = 15; Game.Config.game.oldMergeAt = 2; }
    },
    "old2+dial12": {
        note: "old numbers merge in pairs, the dial at 12",
        uncap: true,
        apply: function (Game) { Game.Config.game.bombPace = 12; Game.Config.game.late.bombPace = 12; Game.Config.game.oldMergeAt = 2; }
    },
    "blast2+dial18": {
        note: "the bomb takes 5 x 5, the dial at 18",
        uncap: true,
        apply: function (Game) { Game.Config.game.bombPace = 18; Game.Config.game.late.bombPace = 18; Game.Config.game.blastReach = 2; }
    },
    "uncap+deal34": {
        note: "no cap, but the deal stops at 32-34: everything above is only built",
        uncap: true,
        apply: function (Game) { dealCap(Game, PEAK - 1); }
    },
    "uncap+seam30": {
        note: "no cap, and the seam steps up to 2 every 2 from 30, 3 every 2 from 35",
        uncap: true,
        apply: function (Game) {
            Game.Config.game.falls.push({ from: 30, count: 2, every: 2 }, { from: 35, count: 3, every: 2 });
        }
    },
    "uncap+deal34+seam30": {
        note: "no cap, the deal stopping at 34, and the seam stepping up from 30",
        uncap: true,
        apply: function (Game) {
            dealCap(Game, PEAK - 1);
            Game.Config.game.falls.push({ from: 30, count: 2, every: 2 }, { from: 35, count: 3, every: 2 });
        }
    },
    widen: {
        note: "once a 35 is made the deal widens downward, one more number every 60 drops: 32-34, then 31-34, 30-34...",
        apply: function (Game) { dealWindow(Game, () => 3 + Math.floor(after / 60), PEAK); },
        tick: function (Game, drops) { after = drops; }
    },
    "widen+tighten": {
        note: "the deal widening and the seam tightening after a 35",
        apply: function (Game) { dealWindow(Game, () => 3 + Math.floor(after / 60), PEAK); },
        tick: function (Game, drops) { after = drops; SETTINGS.tighten.tick(Game, drops); }
    }
};

/* `width` numbers in the deal instead of three (a number, or a function
   giving one) — from `fromTier` on, or the whole run through when that is
   0. The bag keeps the game's shares for the top three, 1, 3 and 4 from the
   top down, and every number below them goes in twice. */
function dealWindow(Game, width, fromTier) {
    const ladder = Game.Pieces.list;
    const was = Game.Pieces.dealing;
    Game.Pieces.dealing = function (highestTier) {
        const made = highestTier || 1;
        if (fromTier && made < fromTier) return was.call(Game.Pieces, highestTier);
        const top = Math.max(1, Math.min(made, PEAK - 1));
        const w = typeof width === "function" ? width() : width;
        return ladder.slice(Math.max(0, top - w), top);
    };
    Game.Pieces.bagFor = function (highestTier) {
        const deal = this.dealing(highestTier);
        const out = [];
        deal.forEach((piece, i) => {
            const fromTop = deal.length - 1 - i;
            const share = fromTop === 0 ? 1 : fromTop === 1 ? 3 : fromTop === 2 ? 4 : 2;
            for (let n = 0; n < share; n++) out.push(piece.id);
        });
        return out;
    };
}

// how far a run is past its 35, for the settings that change with it
let after = 0;

/* the deal's window reaches up to `upTo` until the peak is made */
// the top `width` numbers made are dealt, with the bag's shares for them
function dealWidth(Game, width) {
    const ladder = Game.Pieces.list;
    Game.Pieces.dealing = function (highestTier) {
        const top = Math.max(1, Math.min(highestTier || 1, ladder.length - 1));
        return ladder.slice(Math.max(0, top - width), top);
    };
}

// the deal never climbs past `upTo`, whatever is made
function dealCap(Game, upTo) {
    const ladder = Game.Pieces.list;
    Game.Pieces.dealing = function (highestTier) {
        const top = Math.max(1, Math.min(highestTier || 1, upTo));
        return ladder.slice(Math.max(0, top - 3), top);
    };
}

function dealTo(Game, upTo) {
    var ladder = Game.Pieces.list;
    var WINDOW = 3;
    Game.Pieces.dealing = function (highestTier) {
        var made = highestTier || 1;
        var top = made >= PEAK ? PEAK : Math.max(1, Math.min(made, upTo));
        return ladder.slice(Math.max(0, top - WINDOW), top);
    };
}

/* ---- the game, with no screen ---------------------------------------------- */
/* the ladder past 35, for the uncapped settings: 36 to TOP, each paying
   1.4 times the one under it, as the top of the ladder already does */
const TOP = 120;
function uncapped(src) {
    let extra = "";
    let points = 132000;
    for (let n = 36; n <= TOP; n++) {
        points = Math.round(points * 1.4);
        extra += ',\n        { id: "n' + n + '", name: "' + n + '", icon: "n35", tint: "num num-35", points: ' + points + ' }';
    }
    if (/var TOP = \d+/.test(src)) return src;           // the game has no cap of its own now
    return src.replace(/(\{ id: "n35"[^}]*\})/, "$1" + extra);
}

function boot(apply, setting) {
    const store = {};
    const win = {
        localStorage: {
            getItem: k => (k in store ? store[k] : null),
            setItem: (k, v) => { store[k] = String(v); },
            removeItem: k => { delete store[k]; }
        },
        setTimeout: fn => { fn(); return 0; },
        clearTimeout: () => {},
        addEventListener: () => {},
        matchMedia: () => ({ matches: false })
    };
    win.window = win;
    win.Game = {};
    const ctx = vm.createContext(Object.assign(win, { document: { addEventListener: () => {} }, console }));
    ["core/config", "core/events", "core/storage", "data/pieces",
     "systems/board", "systems/round", "systems/charges"].forEach(f => {
        let src = fs.readFileSync(path.join(root, "js", f + ".js"), "utf8");
        if (f === "data/pieces" && setting && setting.uncap) src = uncapped(src);
        vm.runInContext(src, ctx, { filename: f });
    });
    const Game = ctx.Game;
    Game.Charges.init();
    apply(Game);
    return Game;
}

/* x2 or x3 going off: every number that is a multiple of `k` leaves the
   board (sparing the hand's numbers if `protect`), and the columns settle */
function multiples(Game, k, protect) {
    const s = Game.Config.game;
    const floor = Game.Pieces.dealing(Game.Round.get().highest)[0].tier;
    const board = Game.Board.snapshot().map(id => {
        const p = id && Game.Pieces.byId(id);
        if (!p || !p.tier || p.tier % k) return id;
        if (protect && p.tier >= floor) return id;
        return null;
    });
    const out = board.slice();
    for (let x = 0; x < s.cols; x++) {
        const kept = [];
        for (let y = 0; y < s.rows; y++) if (board[y * s.cols + x]) kept.push(board[y * s.cols + x]);
        const shift = s.rows - kept.length;
        for (let y = 0; y < s.rows; y++) out[y * s.cols + x] = y >= shift ? kept[y - shift] : null;
    }
    Game.Board.load(out);
}

/* ---- the bot ---------------------------------------------------------------- */
function around(Game, cell, far) {
    const near = [];
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            if (!dx && !dy) continue;
            if (!far && dx && dy) continue;          // the four sides only
            const other = Game.Board.at ? Game.Board.at(cell.x + dx, cell.y + dy) : null;
            if (other) near.push(other);
        }
    }
    return near;
}

// the board does not expose at(x, y): find cells by coordinates once
function index(Game) {
    const byXY = {};
    Game.Board.cells().forEach(c => { byXY[c.x + "," + c.y] = c; });
    Game.Board.at = (x, y) => byXY[x + "," + y] || null;
}

function tierOf(Game, id) {
    const p = id && Game.Pieces.byId(id);
    return p ? p.tier : 0;
}

function bestColumn(Game, pieceId) {
    const cols = Game.Board.size().cols;
    const rows = Game.Board.size().rows;
    let best = -1;
    let bestScore = -Infinity;
    for (let x = 0; x < cols; x++) {
        const spot = Game.Board.landing(x);
        if (!spot) continue;
        let score = 0;
        if (Game.Board.wouldJoin(x, pieceId)) score += 100;
        around(Game, spot, false).forEach(n => {
            if (n.piece === pieceId) score += 12;
            else if (n.piece && n.piece === Game.Pieces.bomb.id) score += 2;
        });
        score += spot.y;                                // the lower the landing, the emptier the column
        if (spot.y === 0) score -= 30;                  // never top a column off if it can be helped
        score += Math.random();                         // a tie-breaker
        if (score > bestScore) { bestScore = score; best = x; }
    }
    return best;
}

function nameToSweep(Game) {
    const count = {};
    Game.Board.snapshot().forEach(id => {
        if (!id) return;
        const t = tierOf(Game, id);
        if (!t) return;                                 // not the bomb, not infinity
        count[id] = (count[id] || 0) + 1;
    });
    const highest = Game.Round.get().highest;
    const ids = Object.keys(count).sort((a, b) => {
        // the most pieces, keeping the top two rungs if anything else is there
        const pa = tierOf(Game, a) >= highest - 1 ? -1 : 1;
        const pb = tierOf(Game, b) >= highest - 1 ? -1 : 1;
        if (pa !== pb) return pb - pa;
        if (count[b] !== count[a]) return count[b] - count[a];
        return tierOf(Game, a) - tierOf(Game, b);
    });
    return ids[0] || null;
}

function bombSpot(Game) {
    const cols = Game.Board.size().cols;
    let best = null;
    let bestScore = -1;
    for (let x = 0; x < cols; x++) {
        const spot = Game.Board.landing(x);
        if (!spot) continue;
        let score = 0;
        around(Game, spot, true).forEach(n => {
            if (!n.piece) return;
            const t = tierOf(Game, n.piece);
            score += t ? 1 + (PEAK - t) / PEAK : 0.5;   // clutter is worth more than progress
        });
        if (score > bestScore) { bestScore = score; best = spot; }
    }
    return best;
}

function playRun(Game, setting) {
    let over = false;
    const off = Game.Events.on("game:over", () => { over = true; });
    if (AFTER) {
        // a run with its 35 made: an empty board, the deal at its top, the
        // score past infinity's threshold, infinity not due at once
        Game.Storage.write(Game.Config.game.saveKey, { best: 0, found: [], game: {
            score: 150000, bomb: 0, placed: 400, tally: 0, highest: PEAK, sinceFall: 0,
            runId: null, runLen: 0, lastInfinity: 380, hand: [], bag: [],
            board: new Array(Game.Config.game.cols * Game.Config.game.rows).fill(null)
        } });
        if (!Game.Round.resume()) throw new Error("the end game would not resume");
    } else {
        Game.Round.start();
    }
    index(Game);

    let drops = 0;
    let stuck = 0;
    let made35 = 0;
    let uses = 0;
    let third35 = null;
    after = 0;
    const count = e => e.steps.forEach(st => {
        if ((st.type === "merge" || st.type === "cash") && st.piece === "n35") {
            made35++;
            if (made35 === 3 && third35 === null) third35 = drops;
        }
    });
    Game.Events.on("board:steps", count);
    Game.Events.on("game:rain", count);
    const most = AFTER ? AFTER_CAP : MOST_DROPS;
    while (!over && drops < most) {
        const state = Game.Round.get();
        if (!state || !state.running) break;
        if (!AFTER && !setting.uncap && state.highest >= PEAK) break;
        if (setting.tick) setting.tick(Game, drops);

        if (Game.Board.owes() > 0) {
            const name = nameToSweep(Game);
            if (!name || !Game.Round.choose(name)) { stuck++; if (stuck > 5) break; }
            continue;
        }

        if (setting.mult && Game.Charges.bomb.ready() && Game.Board.empties().length <= CROWDED) {
            const kind = setting.mult.cycle[uses % setting.mult.cycle.length];
            if (kind !== "bomb") {
                uses++;
                multiples(Game, kind === "x2" ? 2 : 3, setting.mult.protect);
                Game.Charges.bomb.reset(0);
                continue;
            }
        }
        if (Game.Charges.bomb.ready() && Game.Board.empties().length <= CROWDED) {
            if (setting.mult) uses++;
            const spot = bombSpot(Game);
            if (spot && Game.Charges.toggle("bomb")) {
                if (!Game.Charges.aim(spot)) Game.Charges.disarm();
                continue;
            }
        }

        const piece = state.hand[0];
        if (!piece) break;
        const col = bestColumn(Game, piece.id);
        if (col < 0 || !Game.Round.play(col)) { stuck++; if (stuck > 5) break; continue; }
        stuck = 0;
        drops++;
    }

    const state = Game.Round.get();
    if (off && typeof off === "function") off();
    return { highest: state.highest, drops: drops, score: state.score, made35: made35, third35: third35,
             reached: AFTER ? drops >= AFTER_CAP : state.highest >= PEAK };
}

/* ---- the report ------------------------------------------------------------- */
function quantile(sorted, q) {
    return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

function pad(s, n, left) {
    s = String(s);
    return left ? s.padStart(n) : s.padEnd(n);
}

const names = Object.keys(SETTINGS).filter(n => !ONLY || ONLY.indexOf(n) !== -1);
console.log(RUNS + " runs a setting" + (AFTER ? ", each starting with a 35 made; endless is " + AFTER_CAP + " more drops" : "") + "\n");
if (AFTER) {
    console.log(pad("setting", 18) + pad("endless", 10, true) + pad("median drops", 14, true) + pad("p90 drops", 11, true) + pad("shortest", 10, true) + pad("35s made", 10, true) + pad("to 3rd 35", 11, true));
} else {
    console.log(pad("setting", 15) + pad("reach 35", 10, true) + pad("median top", 12, true) + pad("p90 top", 9, true) + pad("best", 6, true) + pad("median drops", 14, true) + "  died at (top rung: runs)");
}

names.forEach(name => {
    const setting = SETTINGS[name];
    const results = [];
    const t0 = Date.now();
    for (let i = 0; i < RUNS; i++) {
        const Game = boot(setting.apply, setting);
        results.push(playRun(Game, setting));
    }
    const tops = results.map(r => r.highest).sort((a, b) => a - b);
    const drops = results.map(r => r.drops).sort((a, b) => a - b);
    const reached = results.filter(r => r.reached).length;
    if (AFTER) {
        const made = results.map(r => r.made35).sort((a, b) => a - b);
        const thirds = results.map(r => r.third35).filter(v => v !== null).sort((a, b) => a - b);
        console.log(pad(name, 18) + pad((100 * reached / RUNS).toFixed(0) + "%", 10, true) + pad(quantile(drops, 0.5), 14, true) +
            pad(quantile(drops, 0.9), 11, true) + pad(drops[0], 10, true) + pad(quantile(made, 0.5), 10, true) +
            pad(thirds.length ? quantile(thirds, 0.5) + " (" + (100 * thirds.length / RUNS).toFixed(0) + "%)" : "never", 11, true) +
            "   (" + ((Date.now() - t0) / 1000).toFixed(0) + "s)");
        return;
    }
    const died = {};
    results.forEach(r => { if (!r.reached) died[r.highest] = (died[r.highest] || 0) + 1; });
    if (setting.uncap) {
        const scores = results.map(r => r.score).sort((a, b) => a - b);
        const endless = results.filter(r => r.drops >= MOST_DROPS).length;
        const big = v => v >= 1e9 ? (v / 1e9).toFixed(1) + "B" : v >= 1e6 ? (v / 1e6).toFixed(1) + "M" : v >= 1e3 ? (v / 1e3).toFixed(0) + "k" : String(v);
        const past = results.filter(r => r.highest >= PEAK).length;
        console.log(pad(name, 22) + "  reach 35 " + pad((100 * past / RUNS).toFixed(0) + "%", 4, true) +
            " | top median " + quantile(tops, 0.5) + ", p90 " + quantile(tops, 0.9) + ", best " + tops[tops.length - 1] +
            " | score median " + big(quantile(scores, 0.5)) + ", p90 " + big(quantile(scores, 0.9)) + ", best " + big(scores[scores.length - 1]) +
            " | reach 58 " + (100 * results.filter(r => r.highest >= 58).length / RUNS).toFixed(0) + "%" +
            " | reach 100 " + (100 * results.filter(r => r.highest >= 100).length / RUNS).toFixed(0) + "%" +
            " | drops median " + quantile(drops, 0.5) + ", p90 " + quantile(drops, 0.9) + " | endless " + (100 * endless / RUNS).toFixed(0) + "%" +
            "   (" + ((Date.now() - t0) / 1000).toFixed(0) + "s)");
        return;
    }
    const where = Object.keys(died).sort((a, b) => a - b).map(k => k + ":" + died[k]).join(" ");
    console.log(pad(name, 15) + pad((100 * reached / RUNS).toFixed(0) + "%", 10, true) + pad(quantile(tops, 0.5), 12, true) +
        pad(quantile(tops, 0.9), 9, true) + pad(tops[tops.length - 1], 6, true) + pad(quantile(drops, 0.5), 14, true) + "  " + where +
        "   (" + ((Date.now() - t0) / 1000).toFixed(0) + "s)");
});

console.log("\n" + names.map(n => pad(n, 15) + SETTINGS[n].note).join("\n"));
