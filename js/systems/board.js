window.Game = window.Game || {};

(function () {
    var cells = [];
    var cols = 0;
    var rows = 0;

    function at(x, y) {
        if (x < 0 || y < 0 || x >= cols || y >= rows) return null;
        return cells[y * cols + x];
    }

    function snapshot() {
        return cells.map(function (cell) {
            return cell.piece;
        });
    }

    /* How recently a piece arrived where it is, which decides where a merge
       it is part of happens: 2 for the piece just dropped, fallen in, or made
       by a merge; 1 for a piece the last settling moved; 0 for the rest. */
    var LANDED = 2;
    var MOVED = 1;

    function unmark() {
        cells.forEach(function (cell) {
            cell.fresh = 0;
        });
    }

    function fall() {
        var moves = [];

        for (var x = 0; x < cols; x++) {
            var stack = [];
            for (var y = rows - 1; y >= 0; y--) {
                var cell = at(x, y);
                if (cell.piece) {
                    stack.push({
                        piece: cell.piece,
                        fuse: cell.fuse || 0,
                        fresh: cell.fresh || 0,
                        id: cell.id,
                        y: cell.y
                    });
                }
            }

            var i = 0;
            for (var y2 = rows - 1; y2 >= 0; y2--, i++) {
                var target = at(x, y2);
                var item = i < stack.length ? stack[i] : null;
                var moved = !!item && item.id !== target.id;

                target.piece = item ? item.piece : null;
                target.fuse = item ? item.fuse : 0;
                target.fresh = item ? Math.max(item.fresh, moved ? MOVED : 0) : 0;

                if (moved) {
                    moves.push({
                        to: target.id,
                        distance: target.y - item.y
                    });
                }
            }
        }

        return moves;
    }

    // Touching means one of the four sides — for a merge, and for everything
    // a merge sets off beside it.
    var SIDES = [[0, -1], [-1, 0], [1, 0], [0, 1]];

    /* every piece like `start` joined to it, nearest first, each with how
       many steps it is from `start` in `steps` */
    function reach(start, need) {
        var found = [start];
        var steps = {};
        var queue = [start];
        steps[start.id] = 0;

        while (queue.length) {
            var cell = queue.shift();

            var around = SIDES.map(function (step) {
                return at(cell.x + step[0], cell.y + step[1]);
            });

            for (var i = 0; i < around.length; i++) {
                var other = around[i];
                if (!other || steps[other.id] !== undefined) continue;
                if (other.piece !== start.piece) continue;

                steps[other.id] = steps[cell.id] + 1;
                found.push(other);
                queue.push(other);
            }
        }

        if (found.length < need) return null;
        found.steps = steps;
        return found;
    }

    /* The next group of three or more to merge, and where. The merge starts
       at the piece that arrived last — the one just dropped, or just made by
       the merge before — and runs through the rest to the far end, and the
       new number appears on the far one: the piece most steps away, the
       lowest and then leftmost of those if several are. A group with a newer
       piece in it goes first. `eat` comes back far end first. */
    function oldMergeAt() {
        return Game.Config.game.oldMergeAt || 0;
    }

    // the lowest rung the hand deals right now
    function dealFloor() {
        var round = Game.Round && Game.Round.get && Game.Round.get();
        var deal = Game.Pieces.dealing(round ? round.highest : 1);
        return deal.length ? deal[0].tier : 1;
    }

    function nextGroup() {
        var need = Game.Config.game.mergeAt || 3;
        var best = null;
        var done = {};

        for (var y = rows - 1; y >= 0; y--) {
            for (var x = 0; x < cols; x++) {
                var cell = at(x, y);
                if (!cell.piece || done[cell.id]) continue;

                var piece = Game.Pieces.byId(cell.piece);
                if (!piece || !piece.tier) continue;

                // the top of the ladder has nothing to become: cashAt of it
                // together cash in and leave (never, if that is Infinity)
                var want = piece.next ? need : (Game.Config.game.cashAt || need);
                // an old number, one the hand no longer deals, may need fewer
                if (piece.next && oldMergeAt() && piece.tier < dealFloor()) want = oldMergeAt();
                if (want === Infinity) continue;

                var taking = reach(cell, want);
                if (!taking) continue;

                var lead = taking[0];
                taking.forEach(function (one) {
                    done[one.id] = true;
                    if ((one.fresh || 0) > (lead.fresh || 0)) lead = one;
                });

                if (!best || (lead.fresh || 0) > (best.keep.fresh || 0)) {
                    best = { keep: lead, piece: piece, need: want };
                }
            }
        }

        if (!best) return null;

        var eat = reach(best.keep, best.need);
        eat.sort(function (a, b) {
            return (eat.steps[b.id] - eat.steps[a.id]) || (b.y - a.y) || (a.x - b.x);
        });
        return { keep: eat[0], eat: eat, piece: best.piece };
    }

    /* the cells on the four sides of any of `cells` holding `pieceId`, once each */
    function beside(cells, pieceId) {
        var hit = [];
        var seen = {};

        cells.forEach(function (cell) {
            SIDES.forEach(function (step) {
                var near = at(cell.x + step[0], cell.y + step[1]);
                if (!near || seen[near.id] || near.piece !== pieceId) return;

                seen[near.id] = true;
                hit.push(near);
            });
        });

        return hit;
    }

    function blast(bombs) {
        var gone = {};
        var fired = {};
        var queue = bombs.slice();

        while (queue.length) {
            var bomb = queue.shift();
            if (fired[bomb.id]) continue;
            fired[bomb.id] = true;
            gone[bomb.id] = bomb;

            // A square, not a cross: every cell within `blastReach` of the
            // bomb, corners included. At 1 that is the eight squares around
            // it and nothing further out.
            var far = Math.max(1, Game.Config.game.blastReach || 1);

            for (var dy = -far; dy <= far; dy++) {
                for (var dx = -far; dx <= far; dx++) {
                    if (!dx && !dy) continue;

                    var near = at(bomb.x + dx, bomb.y + dy);
                    if (!near || !near.piece) continue;

                    gone[near.id] = near;
                    if (near.piece === Game.Pieces.bomb.id && !fired[near.id]) {
                        queue.push(near);
                    }
                }
            }
        }

        return Object.keys(gone).map(function (id) {
            return gone[id];
        });
    }

    /* A blast as a step: everything in reach goes, paid at its worth, and
       every infinity caught in it owes the board a sweep — the player names a
       number and every one of them goes. */
    function wreck(lit) {
        var infinity = Game.Pieces.infinity.id;
        var salvage = 0;
        var gone = blast(lit).map(function (cell) {
            var was = Game.Pieces.byId(cell.piece);
            salvage += (was && was.points) || 0;
            if (cell.piece === infinity) owed += 1;
            cell.piece = null;
            cell.fuse = 0;
            return cell.id;
        });

        return {
            type: "blast",
            cells: gone,
            points: Math.round(salvage * (Game.Config.game.blastPays || 0)),
            board: snapshot()
        };
    }

    /* Infinity beside a merge goes off: it leaves the board, and the board is
       owed a sweep, the same as when a blast catches it. */
    function touchOff(cells) {
        var hit = beside(cells, Game.Pieces.infinity.id);
        if (!hit.length) return null;

        owed += hit.length;
        return {
            type: "clear",
            cells: hit.map(function (cell) {
                cell.piece = null;
                cell.fuse = 0;
                return cell.id;
            }),
            points: 0,
            board: snapshot()
        };
    }

    var owed = 0;

    function resolve(steps) {
        var guard = 0;

        var chain = 0;

        var first = fall();
        if (first.length) {
            steps.push({ type: "fall", moves: first, board: snapshot() });
        }

        while (guard++ < 200) {
            var pair = nextGroup();
            if (!pair) break;

            chain++;

            var lit = snapshot();
            var fuse = pair.eat
                .slice()
                .reverse()
                .map(function (cell) {
                    return cell.id;
                });

            var over = Game.Config.game;
            var times = Math.min(
                over.chainMost,
                1 + (chain - 1) * over.chainStep
            );

            var sparked;

            if (!pair.piece.next) {
                var haul = Math.round(
                    (pair.piece.points || 0) *
                        pair.eat.length *
                        over.cashBonus *
                        times
                );

                unmark();
                pair.eat.forEach(function (cell) {
                    cell.piece = null;
                });

                steps.push({
                    type: "cash",
                    cells: [pair.keep.id],
                    piece: pair.piece.id,
                    took: pair.eat.length,
                    fuse: fuse,
                    lit: lit,
                    chain: chain,
                    times: times,
                    points: haul,
                    board: snapshot()
                });

                sparked = touchOff(pair.eat);
                if (sparked) steps.push(sparked);
            } else {
                // every full three that join make one of the next number:
                // three, four or five make one, six make two — on the far
                // ones, farthest first
                var grown = Game.Pieces.byId(pair.piece.next);
                var makes = Math.floor(pair.eat.length / (over.mergeAt || 3));

                unmark();
                pair.eat.forEach(function (cell, i) {
                    cell.piece = i < makes ? grown.id : null;
                    cell.fresh = i < makes ? LANDED : 0;
                });

                steps.push({
                    type: "merge",
                    cell: pair.keep,
                    cells: pair.eat.slice(0, makes).map(function (cell) {
                        return cell.id;
                    }),
                    piece: grown.id,
                    from: pair.piece.id,
                    took: pair.eat.length,
                    fuse: fuse,
                    lit: lit,
                    chain: chain,
                    times: times,
                    points: Math.round(
                        (pair.piece.points || 0) * pair.eat.length * times
                    ),
                    board: snapshot()
                });

                sparked = touchOff(pair.eat);
                if (sparked) steps.push(sparked);

                var bombs = beside(pair.eat, Game.Pieces.bomb.id);
                if (bombs.length) steps.push(wreck(bombs));
            }

            var after = fall();
            if (after.length) {
                steps.push({ type: "fall", moves: after, board: snapshot() });
            }
        }

        return steps;
    }

    function report(steps) {
        var made = steps.filter(function (step) {
            return step.type === "merge";
        });

        var points = steps.reduce(function (sum, step) {
            return sum + (step.points || 0);
        }, 0);

        return { steps: steps, made: made, points: points };
    }

    /* bombs going off outside a merge: the blast, then the board settles */
    function setOff(lit) {
        unmark();
        return report(resolve([wreck(lit)]));
    }

    Game.Board = {
        size: function () {
            return { cols: cols, rows: rows };
        },

        cells: function () {
            return cells;
        },

        byId: function (id) {
            return cells[id] || null;
        },

        at: at,
        snapshot: snapshot,

        empties: function () {
            return cells.filter(function (cell) {
                return !cell.piece;
            });
        },

        isFull: function () {
            return this.empties().length === 0;
        },

        landing: function (column) {
            if (column < 0 || column >= cols) return null;
            for (var y = rows - 1; y >= 0; y--) {
                var cell = at(column, y);
                if (!cell.piece) return cell;
            }
            return null;
        },

        build: function (width, height) {
            cols = width;
            rows = height;
            owed = 0;
            cells = [];
            for (var y = 0; y < rows; y++) {
                for (var x = 0; x < cols; x++) {
                    cells.push({
                        id: cells.length,
                        x: x,
                        y: y,
                        piece: null,
                        fuse: 0,
                        fresh: 0
                    });
                }
            }
            return cells;
        },

        // Sweeps still to be named. A board with nothing left on it has nothing
        // to name, so a debt that finds it empty is dropped rather than left to
        // wait on a tap that can never come.
        owes: function () {
            if (owed > 0 && !cells.some(function (cell) { return cell.piece; })) {
                owed = 0;
            }
            return owed;
        },

        sweep: function (pieceId) {
            if (owed <= 0) return null;
            owed -= 1;
            unmark();

            var worth = 0;
            var pulled = [];

            cells.forEach(function (cell) {
                if (cell.piece !== pieceId) return;
                var was = Game.Pieces.byId(cell.piece);
                worth += (was && was.points) || 0;
                cell.piece = null;
                cell.fuse = 0;
                pulled.push(cell.id);
            });

            if (!pulled.length) return report(resolve([]));

            return report(
                resolve([
                    {
                        type: "clear",
                        cells: pulled,
                        points: Math.round(
                            worth * (Game.Config.game.blastPays || 0)
                        ),
                        board: snapshot()
                    }
                ])
            );
        },

        burn: function () {
            var limit = Game.Config.game.bombFuse || 0;
            if (!limit) return null;

            var bomb = Game.Pieces.bomb.id;
            var lit = [];

            cells.forEach(function (cell) {
                if (cell.piece !== bomb) return;
                cell.fuse = (cell.fuse || 0) + 1;
                if (cell.fuse >= limit) lit.push(cell);
            });

            return lit.length ? setOff(lit) : null;
        },

        // Every bomb on the board at once, fuse or no fuse. A full board
        // does this before it ends the run.
        detonate: function () {
            var bomb = Game.Pieces.bomb.id;
            var lit = cells.filter(function (cell) {
                return cell.piece === bomb;
            });

            return lit.length ? setOff(lit) : null;
        },

        fuseAt: function (id) {
            var limit = Game.Config.game.bombFuse || 0;
            var cell = cells[id];
            if (!limit || !cell || cell.piece !== Game.Pieces.bomb.id) return 0;
            return Math.min(1, (cell.fuse || 0) / limit);
        },

        /* turns a bomb has left before it goes off on its own; Infinity for
           anything that is not a bomb on a fuse */
        fuseLeft: function (id) {
            var limit = Game.Config.game.bombFuse || 0;
            var cell = cells[id];
            if (!limit || !cell || cell.piece !== Game.Pieces.bomb.id) return Infinity;
            return Math.max(0, limit - (cell.fuse || 0));
        },

        wouldJoin: function (column, pieceId) {
            var spot = this.landing(column);
            if (!spot) return false;

            var piece = Game.Pieces.byId(pieceId);
            if (!piece || !piece.tier) return false;

            var was = spot.piece;
            spot.piece = pieceId;
            var joined = reach(spot, Game.Config.game.mergeAt || 3);
            spot.piece = was;

            return !!joined;
        },

        load: function (snapshot) {
            if (!Array.isArray(snapshot) || snapshot.length !== cells.length) {
                return false;
            }
            cells.forEach(function (cell, i) {
                var id = snapshot[i];
                cell.piece = id && Game.Pieces.byId(id) ? id : null;
                cell.fresh = 0;
            });
            return true;
        },

        drop: function (column, pieceId) {
            var spot = this.landing(column);
            if (!spot) return null;

            unmark();
            spot.piece = pieceId;
            spot.fuse = 0;
            spot.fresh = LANDED;

            var steps = [
                {
                    type: "fall",
                    moves: [{ to: spot.id, distance: spot.y + 1 }],
                    board: snapshot()
                }
            ];

            var out = report(resolve(steps));
            out.cell = spot;
            return out;
        }
    };
})();
