window.Game = window.Game || {};

(function () {
    var config = null;
    var state = null;
    var held = null;

    function settings() {
        return config || (config = Game.Config.game);
    }

    // the scoring in force: a save from an older one keeps its best number
    // and its run, but its scores belonged to another scale and are let go
    var SCORING = 2;

    function readSave() {
        var save = Game.Storage.read(settings().saveKey) || {};
        var same = save.scoring === SCORING;
        if (!same && save.game) save.game.score = 0;
        return {
            best: same ? save.best || 0 : 0,
            bestTop: save.bestTop || 0,
            found: Array.isArray(save.found) ? save.found : [],
            game: save.game || null
        };
    }

    function writeSave(game) {
        Game.Storage.write(settings().saveKey, {
            scoring: SCORING,
            best: state.best,
            bestTop: state.bestTop,
            found: state.found,
            game: typeof game === "undefined" ? held : game
        });
    }

    function snapshotGame() {
        return {
            score: state.score,
            bomb: state.bomb,
            placed: state.placed,
            tally: state.tally,
            highest: state.highest,
            sinceFall: state.sinceFall,
            runId: state.runId,
            runLen: state.runLen,
            lastInfinity: state.lastInfinity,
            lastColumn: state.lastColumn,
            hand: state.hand.map(function (piece) { return piece.id; }),
            bag: state.bag.slice(),
            board: Game.Board.snapshot()
        };
    }

    function keep() {
        if (!state || !state.running) return;
        held = snapshotGame();
        writeSave(held);
    }

    function drop() {
        held = null;
        writeSave(null);
    }

    // the bomb dial's charge goes wherever the run goes, so a run picked up
    // again has the charge it was put down with
    Game.Events.on("charge:change", function (detail) {
        if (state && detail.name === "bomb") state.bomb = detail.charge;
    });

    /* The hand is dealt from a bag, not by the roll of a die. Every number
       in the deal goes into the bag in its share — the lowest most often, the
       top once (Game.Pieces.bagFor) — and the hand takes from the bag at
       random until it is empty and a new one is made. So no number can stay
       away for longer than a bag, and a run of one number is never long: the
       same number may come twice running, never sameInRow + 1 times. When
       the deal moves (raise), the bag is thrown away, so the new number is
       in the next one. */
    function draw(blocked) {
        var open = [];
        state.bag.forEach(function (id, i) {
            if (id !== blocked) open.push(i);
        });
        return open.length ? open[Math.floor(Math.random() * open.length)] : -1;
    }

    function nextDeal() {
        var most = settings().sameInRow || 0;
        var blocked = most > 0 && state.runLen >= most ? state.runId : null;

        if (!state.bag.length) state.bag = Game.Pieces.bagFor(state.highest);

        var at = draw(blocked);
        if (at === -1) {
            // nothing is left but the number just dealt twice: the next bag
            // comes forward, and what is left of this one is dealt from it
            state.bag = state.bag.concat(Game.Pieces.bagFor(state.highest));
            at = draw(blocked);
        }
        if (at === -1) at = draw(null);     // a deal of one number: it repeats

        var piece = Game.Pieces.byId(state.bag.splice(at, 1)[0]);

        if (piece.id === state.runId) state.runLen += 1;
        else { state.runId = piece.id; state.runLen = 1; }

        return piece;
    }

    /* With infinity out of the game (config: infinityFrom is Infinity), a
       board saved while it was still in loses its infinities, and what stood
       on them settles down the column. Any other board comes back as it was. */
    function withoutInfinity(board) {
        var s = settings();
        var id = Game.Pieces.infinity.id;
        if (s.infinityFrom < Infinity || board.indexOf(id) === -1) return board;

        var out = board.slice();
        for (var x = 0; x < s.cols; x++) {
            var kept = [];
            for (var y = 0; y < s.rows; y++) {
                var piece = board[y * s.cols + x];
                if (piece && piece !== id) kept.push(piece);
            }
            var shift = s.rows - kept.length;
            for (var row = 0; row < s.rows; row++) {
                out[row * s.cols + x] = row >= shift ? kept[row - shift] : null;
            }
        }
        return out;
    }

    /* whether `id` is in the deal of a run whose best number is `highest` */
    function dealt(id, highest) {
        return Game.Pieces.dealing(highest || 1).some(function (piece) {
            return piece.id === id;
        });
    }

    function fillHand() {
        while (state.hand.length < settings().handSize) {
            state.hand.push(nextDeal());
        }
    }

    /* the late game (config: late): from that rung on, room is made oftener;
       null before it */
    function late() {
        var s = settings();
        return s.late && state && state.highest >= s.late.from ? s.late : null;
    }

    /* infinity's turn: past infinityFrom points, none on the board, and
       none yet this run or infinityEvery drops since the last one fell —
       fewer in the late game */
    function infinityDue() {
        var s = settings();
        var every = (late() && late().infinityEvery) || s.infinityEvery;
        if (state.score < s.infinityFrom) return false;
        if (Game.Board.snapshot().indexOf(Game.Pieces.infinity.id) !== -1) return false;
        return state.lastInfinity === null ||
            state.placed - state.lastInfinity >= every;
    }

    function seam() {
        var table = settings().falls;
        var found = null;

        for (var i = 0; i < table.length; i++) {
            if (state.highest >= table[i].from) found = table[i];
        }

        return found;
    }

    function fallGap() {
        var level = seam();
        return level ? Math.max(1, level.every) : Infinity;
    }

    function fallCount() {
        var level = seam();
        return level ? level.count : 0;
    }

    function open() {
        if (!state || !state.opening) return;

        var steps = [];
        var wide = Game.Board.size().cols;

        // The opening is 1s and nothing else. It stops short rather than let
        // one merge before the first move, which would put a 2 on the board
        // that the run has not made yet.
        var first = Game.Pieces.list[0];

        for (var i = 0; i < settings().seedPieces; i++) {
            var free = [];
            for (var col = 0; col < wide; col++) {
                if (Game.Board.landing(col)) free.push(col);
            }

            var calm = free.filter(function (col) {
                return !Game.Board.wouldJoin(col, first.id);
            });
            if (!calm.length) break;

            var where = calm[Math.floor(Math.random() * calm.length)];
            var result = Game.Board.drop(where, first.id);
            if (result) steps = steps.concat(result.steps);
        }

        steps.forEach(function (step) {
            step.points = 0;
        });

        state.opening = false;
        Game.Events.emit("board:steps", { steps: steps });
        keep();
    }

    function roomFor(count) {
        var s = settings();
        var free = Game.Board.empties().length;
        var allowed = Math.max(s.fallLeast || 1, Math.ceil(free * s.fallRoom));
        return Math.min(count, allowed);
    }

    function evened(pool) {
        if (!settings().fallEven || pool.length < 3) return pool;

        var most = 0;
        var depth = pool.map(function (col) {
            var spot = Game.Board.landing(col);
            var room = spot ? spot.y + 1 : 0;
            if (room > most) most = room;
            return { col: col, room: room };
        });

        var roomy = depth.filter(function (item) {
            return item.room >= most - 1;
        });

        return (roomy.length ? roomy : depth).map(function (item) {
            return item.col;
        });
    }

    /* the column bomb's turn: once the best number made reaches columnFrom,
       one falls in every columnEvery drops — the first a full gap after */
    function columnDue() {
        var s = settings();
        if (!s.columnEvery || state.highest < (s.columnFrom || 1)) return false;
        if (state.lastColumn === null) {
            state.lastColumn = state.placed;
            return false;
        }
        return state.placed - state.lastColumn >= s.columnEvery;
    }

    function rain() {
        var count = roomFor(fallCount());
        var made = [];
        var steps = [];
        var points = 0;
        var infinities = 0;
        var columns = 0;

        for (var i = 0; i < count; i++) {
            var open = [];
            for (var col = 0; col < Game.Board.size().cols; col++) {
                if (Game.Board.landing(col)) open.push(col);
            }
            if (!open.length) break;

            // one infinity at most in a fall, when it is due
            var special = !infinities && infinityDue();
            if (special) {
                infinities++;
                state.lastInfinity = state.placed;
            }

            // one column bomb at most in a fall, when it is due
            var line = !special && !columns && columnDue();
            if (line) {
                columns++;
                state.lastColumn = state.placed;
            }

            var piece = special
                ? Game.Pieces.infinity
                : line ? Game.Pieces.column
                : Game.Pieces.randomFor(state.highest);

            var pool = evened(open);

            var where = pool[Math.floor(Math.random() * pool.length)];
            var result = Game.Board.drop(where, piece.id);
            if (!result) continue;

            steps = steps.concat(result.steps);
            made = made.concat(result.made);
            points += result.points;
        }

        if (!steps.length) return;

        Game.Events.emit("game:rain", { steps: steps, count: count });
        absorb({ made: made, points: points });
    }

    function absorb(result) {
        state.score += result.points;
        state.tally += result.made.length;
        record(result.made);
        raise(result.made);
    }

    /* What a move costs, either side of the pieces settling: it counts as a
       move of the run, and it brings the next fall closer. Anything that
       does not spend a turn skips both halves. */
    function openTurn() {
        state.placed += 1;
    }

    function closeTurn() {
        // no count kept before the falls begin, so the first comes a full
        // gap after they do, not at once
        if (!seam()) return;
        state.sinceFall += 1;
        if (state.sinceFall >= fallGap()) {
            state.sinceFall = 0;
            rain();
        }
    }

    /* Whether a blast in these steps took the top of the ladder: blowing
       the 100 up is the run won. */
    function blown(result) {
        var top = Game.Pieces.list[Game.Pieces.list.length - 1].id;
        return !!result && (result.steps || []).some(function (step) {
            return step.type === "blast" && (step.took || []).indexOf(top) !== -1;
        });
    }

    /* A full board ends the run, but not while a bomb is standing on it:
       every bomb goes off first, and the run carries on in the room that
       makes. Nor while infinity's sweep is still owed — naming a number makes
       room too. True only when there is no way left to go on. */
    function stuck() {
        if (!Game.Board.isFull()) return false;

        var fired = Game.Board.detonate();
        if (fired && fired.steps.length) {
            Game.Events.emit("game:rain", { steps: fired.steps, count: 0 });
            absorb(fired);
            if (blown(fired)) won = true;
        }
        return Game.Board.isFull() && Game.Board.owes() <= 0;
    }

    // set when a blast takes the 100, read once the turn's steps are in
    var won = false;

    /* Everything that happens after a piece lands, whoever put it there.
       `free` is for a piece that arrives without costing the player a move. */
    function turn(result, free) {
        if (!free) openTurn();

        Game.Events.emit("board:steps", { steps: result.steps });

        absorb(result);
        fillHand();

        if (!free) closeTurn();

        won = blown(result);

        var fired = Game.Board.burn();
        if (fired && fired.steps.length) {
            Game.Events.emit("game:rain", { steps: fired.steps, count: 0 });
            absorb(fired);
            if (blown(fired)) won = true;
        }

        // before the sweep is asked for: infinity caught in a full board's last
        // blast is owed like any other
        var over = stuck();

        Game.Events.emit("game:placed", { result: result });
        Game.Events.emit("game:hand", {});

        if (Game.Board.owes() > 0) {
            Game.Events.emit("game:choosing", { owed: Game.Board.owes() });
        }

        // the 100 blown up is the run won, whatever else the turn did
        if (won) finish("won");
        else if (over) finish("full");
        else keep();

        return result;
    }

    function raise(made) {
        var was = Game.Pieces.dealing(state.highest);

        made.forEach(function (step) {
            var piece = Game.Pieces.byId(step.piece);
            if (piece.tier > state.highest) state.highest = piece.tier;
        });

        // The window moves at either end. Early on it only grows at the top,
        // with the 1 still at the bottom, and that is a new deal all the same.
        var now = Game.Pieces.dealing(state.highest);
        if (now[0] === was[0] && now.length === was.length) return;

        state.bag = [];
        Game.Events.emit("game:dealing", { lowest: now[0] });
    }

    function record(made) {
        var fresh = [];

        made.forEach(function (step) {
            if (state.found.indexOf(step.piece) !== -1) return;
            state.found.push(step.piece);
            fresh.push(step.piece);
        });

        if (!fresh.length) return;
        writeSave();
        Game.Events.emit("game:found", { pieces: fresh });
    }

    function finish(reason) {
        if (!state.running) return;
        state.running = false;

        var record = state.score > state.best;
        if (record) state.best = state.score;
        if (state.highest > (state.bestTop || 0)) state.bestTop = state.highest;
        drop();

        Game.Events.emit("game:over", {
            reason: reason,
            score: state.score,
            best: state.best,
            record: record,
            made: state.tally,
            moves: state.placed
        });
    }

    Game.Round = {
        get: function () {
            return state;
        },

        // the late game's settings once the run is in it, else null
        late: function () {
            return late();
        },

        found: function (pieceId) {
            return !!state && state.found.indexOf(pieceId) !== -1;
        },

        /* A new run. Its opening — the first 1 dropped in — follows after a
           short pause; started with { hold: true } it waits for release(),
           which is how to play closing the first time the game is played. */
        start: function (options) {
            var save = state ? state : readSave();

            Game.Board.build(settings().cols, settings().rows);

            state = {
                running: true,
                opening: true,
                held: !!(options && options.hold),
                score: 0,
                placed: 0,
                tally: 0,
                highest: 1,
                sinceFall: 0,
                hand: [],
                bag: [],
                runId: null,
                runLen: 0,
                lastInfinity: null,
                lastColumn: null,
                bomb: 0,
                best: save.best,
                bestTop: save.bestTop,
                found: save.found
            };
            fillHand();

            Game.Events.emit("game:started", {});
            if (!state.held) window.setTimeout(open, settings().introPause);
        },

        release: function () {
            if (!state || !state.held) return;
            state.held = false;
            window.setTimeout(open, settings().introPause);
        },

        resume: function () {
            var save = readSave();
            var game = save.game;
            if (!game || !Array.isArray(game.board)) return false;

            Game.Board.build(settings().cols, settings().rows);
            if (!Game.Board.load(withoutInfinity(game.board))) return false;

            state = {
                running: true,
                opening: false,
                score: game.score || 0,
                placed: game.placed || 0,
                tally: game.tally || 0,
                highest: game.highest || 1,
                sinceFall: game.sinceFall || 0,
                // the hand and the bag come back only as far as they are still
                // in the deal: a run saved under an older deal (one that held
                // 35, say) is dealt afresh from the current one
                hand: (game.hand || [])
                    .map(function (id) { return Game.Pieces.byId(id); })
                    .filter(function (piece) { return piece && dealt(piece.id, game.highest); }),
                bag: (game.bag || []).filter(function (id) {
                    return dealt(id, game.highest);
                }),
                runId: game.runId || null,
                runLen: game.runLen || 0,
                lastInfinity: typeof game.lastInfinity === "number" ? game.lastInfinity : null,
                lastColumn: typeof game.lastColumn === "number" ? game.lastColumn : null,
                bomb: game.bomb || 0,
                best: save.best,
                bestTop: save.bestTop,
                found: save.found
            };
            fillHand();
            keep();

            Game.Events.emit("game:started", { bomb: state.bomb });
            return true;
        },

        play: function (column) {
            if (!state || !state.running || state.opening) return null;
            if (Game.Board.owes() > 0) return null;

            var piece = state.hand[0];
            if (!piece) return null;

            var result = Game.Board.drop(column, piece.id);
            if (!result) return null;

            state.hand.shift();
            return turn(result);
        },

        /* A piece put on the board by something other than the hand — the bomb
           dial. It is free: the bomb is the reward, and making the player pay
           a move for it as well would mean the sky gets a fall out of the very
           thing it gave you for being buried. */
        place: function (column, pieceId) {
            if (!state || !state.running || state.opening) return null;
            if (Game.Board.owes() > 0) return null;

            var result = Game.Board.drop(column, pieceId);
            return result ? turn(result, true) : null;
        },

        choose: function (pieceId) {
            if (!state || !state.running) return null;
            if (Game.Board.owes() <= 0) return null;

            var out = Game.Board.sweep(pieceId);
            if (!out) return null;

            Game.Events.emit("board:steps", { steps: out.steps });
            absorb(out);

            if (Game.Board.owes() > 0) {
                Game.Events.emit("game:choosing", { owed: Game.Board.owes() });
            } else {
                // a sweep is the move: clearing a whole kind off the board is
                // worth a turn, and the falls close in the same as any other
                openTurn();
                closeTurn();
                Game.Events.emit("game:chosen", {});
            }

            if (stuck()) finish("full");
            else keep();
            return out;
        }
    };
})();
