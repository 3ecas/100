/* The smarter bot, shared by the simulator test and the watch page. Every
   move is tried on the real board, scored, and undone; the best is kept. */
function SmartBot(Game, W) {
    var B = Game.Board;
    W = W || {};
    var OLD = W.old || 15, PAIR = W.pair || 5, EMPTY = W.empty || 8, HEIGHT = W.height || 1.5, MADE = W.made || 3;

    function save() {
        return { snap: B.snapshot(), fuse: B.cells().map(function (c) { return c.fuse || 0; }) };
    }
    function restore(s) {
        B.load(s.snap);
        B.cells().forEach(function (c, i) { c.fuse = s.fuse[i]; });
    }
    function tier(id) { var p = id && Game.Pieces.byId(id); return p ? p.tier : 0; }
    function floor() {
        var r = Game.Round.get(); var d = Game.Pieces.dealing(r ? r.highest : 1);
        return d.length ? d[0].tier : 1;
    }

    // how good a board is to be left with
    function value(made, low) {
        var size = B.size(), cols = size.cols, rows = size.rows, snap = B.snapshot();
        var v = 0, empties = 0, highest = 0;
        for (var i = 0; i < snap.length; i++) {
            var id = snap[i];
            if (!id) { empties++; continue; }
            var t = tier(id);
            if (t && t < low) v -= OLD;                     // an old number, stranded
            var x = i % cols, y = Math.floor(i / cols);
            if (x + 1 < cols && snap[i + 1] === id && t) v += PAIR;
            if (y + 1 < rows && snap[i + cols] === id && t) v += PAIR;
        }
        v += empties * EMPTY;
        for (var x2 = 0; x2 < cols; x2++) {
            var spot = B.landing(x2);
            var h = spot ? rows - 1 - spot.y : rows;
            if (h > highest) highest = h;
            if (!spot) v -= 25;
        }
        v -= highest * highest * HEIGHT;
        made.forEach(function (id) { v += tier(id) * MADE; });
        return v;
    }

    function bestColumn(id) {
        var low = floor(), best = -1, bestV = -Infinity, cols = B.size().cols;
        for (var x = 0; x < cols; x++) {
            if (!B.landing(x)) continue;
            var s = save();
            var res = B.drop(x, id);
            var v = res ? value(res.made || [], low) + (res.points || 0) * 0.05 : -1e9;
            restore(s);
            v += Math.random() * 0.5;
            if (v > bestV) { bestV = v; best = x; }
        }
        return best;
    }

    // where the bomb does most good: beside the 100 to win; else on old numbers
    function bombSpot() {
        var low = floor(), top = Game.Pieces.top().id, cols = B.size().cols, best = null, bestV = -Infinity;
        for (var x = 0; x < cols; x++) {
            var spot = B.landing(x);
            if (!spot) continue;
            var v = 0;
            for (var dx = -1; dx <= 1; dx++) for (var dy = -1; dy <= 1; dy++) {
                if (!dx && !dy) continue;
                var c = B.at(spot.x + dx, spot.y + dy);
                if (!c || !c.piece) continue;
                if (c.piece === top) { v += 1000; continue; }
                var t = tier(c.piece);
                v += t && t < low ? 3 : t ? -1.5 : 0.5;
            }
            if (v > bestV) { bestV = v; best = spot; }
        }
        return { spot: best, value: bestV };
    }

    function wantsBomb() {
        if (!Game.Charges.bomb.ready()) return null;
        var pick = bombSpot();
        if (!pick.spot) return null;
        if (pick.value >= 1000) return pick.spot;                    // the 100 is there: go for the win
        if (pick.value >= 6 || B.empties().length <= 12) return pick.spot;
        return null;
    }

    return { bestColumn: bestColumn, wantsBomb: wantsBomb };
}
if (typeof module !== "undefined") module.exports = SmartBot;
