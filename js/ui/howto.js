window.Game = window.Game || {};

/* =============================================================================
   HOW TO PLAY
   -----------------------------------------------------------------------------
   One idea a page, played out on a small grid of the game's own pieces over
   the game dimmed behind it: dropping, three making one, chains, numbers
   falling in, the bomb, and the climb to 35. Whatever merges or
   blows up breaks apart exactly as it does in the game (js/ui/shatter.js).
   A few words a page, in the game's square letters: the grid shows the rest.

   Tap anywhere, or Next, to go on; Skip, the cross, or Play on the last
   page, to leave. It opens by itself the first time the game is ever played
   — before the run's opening, which waits for it to close (js/pages/game.js)
   — and after that only from the ? button.

   The boards are frames of real piece ids drawn with the real art, so the
   tutorial cannot drift away from the game — change a piece and this changes
   with it.
   ============================================================================= */

(function () {
    var SEEN = "thirtyfive.tutorial";

    var host = null;
    var stage = null;
    var titleEl = null;
    var lineEl = null;
    var stepsEl = null;
    var nextEl = null;
    var skipEl = null;
    var cells = [];
    var shown = null;

    var at = 0;
    var frame = 0;
    var timer = null;

    /* A board is { index: pieceId }; anything absent is an empty square.
       `lit` rings pieces arriving or being tapped; `go` rings pieces about to
       go — and whatever is ringed to go breaks apart as the next frame comes.
       A frame holds for the page's `hold` unless it brings its own. */
    function board(map, lit, go, hold) {
        return { map: map || {}, lit: lit || [], go: go || [], hold: hold || 0 };
    }

    function plus(map, extra) {
        var out = {};
        Object.keys(map).forEach(function (k) { out[k] = map[k]; });
        Object.keys(extra).forEach(function (k) { out[k] = extra[k]; });
        return out;
    }

    // the whole ladder, one number at a time, up to the 100 — then the 100
    // alone, a bomb dropped beside it, and the blast that wins the run
    function ladder() {
        var frames = [board()];
        var map = {};
        for (var n = 1; n <= 100; n++) {
            map = plus(map, {});
            map[n - 1] = "n" + n;
            frames.push(board(map, [n - 1]));
        }
        frames.push(board(map, [], [], 1100));
        var top = { 44: "n100" };
        frames.push(board(top, [44], [], 900));
        frames.push(board(plus(top, { 45: "bomb" }), [45], [], 900));
        frames.push(board(plus(top, { 45: "bomb" }), [], [44, 45], 700));
        frames.push(board({}));
        return frames;
    }

    // Every merge runs from the piece that arrived last to the far one, and
    // the new number lands there — as it does in the game
    var FLOOR_2 = { 16: "n1", 17: "n1" };
    var CHAIN = { 15: "n2", 16: "n2", 17: "n1", 18: "n1" };
    var BOMB = { 13: "n2", 14: "n2", 15: "n1", 16: "n1", 18: "bomb", 19: "n3" };

    var PAGES = [
        {
            title: "Drop",
            line: "Tap a column to drop your number.",
            hold: 480,
            frames: [
                board(),
                board({ 2: "n1" }, [2]),
                board({ 7: "n1" }, [7]),
                board({ 12: "n1" }, [12]),
                board({ 17: "n1" }),
                board({ 17: "n1", 4: "n2" }, [4]),
                board({ 17: "n1", 9: "n2" }, [9]),
                board({ 17: "n1", 14: "n2" }, [14]),
                board({ 17: "n1", 19: "n2" }),
                board({ 17: "n1", 19: "n2" })
            ]
        },
        {
            title: "Merge",
            line: "Three alike make the next number.",
            hold: 520,
            frames: [
                board(FLOOR_2),
                board(plus(FLOOR_2, { 3: "n1" }), [3]),
                board(plus(FLOOR_2, { 8: "n1" }), [8]),
                board(plus(FLOOR_2, { 13: "n1" }), [13]),
                board(plus(FLOOR_2, { 18: "n1" })),
                board(plus(FLOOR_2, { 18: "n1" }), [], [16, 17, 18]),
                board({ 16: "n2" }, [16]),
                board({ 16: "n2" })
            ]
        },
        {
            title: "Chain",
            line: "Merges can chain. Each link scores more.",
            hold: 520,
            frames: [
                board(CHAIN),
                board(plus(CHAIN, { 4: "n1" }), [4]),
                board(plus(CHAIN, { 9: "n1" }), [9]),
                board(plus(CHAIN, { 14: "n1" }), [14]),
                board(plus(CHAIN, { 19: "n1" })),
                board(plus(CHAIN, { 19: "n1" }), [], [17, 18, 19]),
                board({ 15: "n2", 16: "n2", 17: "n2" }, [17]),
                board({ 15: "n2", 16: "n2", 17: "n2" }, [], [15, 16, 17]),
                board({ 15: "n3" }, [15]),
                board({ 15: "n3" })
            ]
        },
        {
            title: "Incoming",
            line: "Numbers drop in on their own. Keep room.",
            hold: 520,
            frames: [
                board({ 16: "n1", 18: "n2" }),
                board({ 1: "n3", 3: "n1", 16: "n1", 18: "n2" }, [1, 3]),
                board({ 6: "n3", 8: "n1", 16: "n1", 18: "n2" }, [6, 8]),
                board({ 11: "n3", 13: "n1", 16: "n1", 18: "n2" }, [11, 13]),
                board({ 11: "n3", 13: "n1", 16: "n1", 18: "n2" }),
                board({ 11: "n3", 13: "n1", 16: "n1", 18: "n2" })
            ]
        },
        {
            title: "Bomb",
            line: "Merges charge the 0. Drop it. Merge next to it.",
            hold: 540,
            frames: [
                board(BOMB),
                board(plus(BOMB, { 2: "n1" }), [2]),
                board(plus(BOMB, { 7: "n1" }), [7]),
                board(plus(BOMB, { 12: "n1" }), [12]),
                board(plus(BOMB, { 17: "n1" })),
                board(plus(BOMB, { 17: "n1" }), [18], [15, 16, 17]),
                board({ 13: "n2", 14: "n2", 15: "n2", 18: "bomb", 19: "n3" }, [18]),
                board({ 13: "n2", 14: "n2", 15: "n2", 18: "bomb", 19: "n3" }, [], [13, 14, 18, 19]),
                board({ 15: "n2" }),
                board({ 15: "n2" })
            ]
        },
        {
            title: "Blow up the 100",
            line: "The ladder goes to 100. Blow the 100 up with a bomb to win. Grid full, game over.",
            cols: 10,
            rows: 10,
            hold: 60,
            last: 2600,
            frames: ladder()
        }
    ];

    function build() {
        host = document.getElementById("how");
        if (!host) return false;

        host.innerHTML =
            '<button type="button" class="how__shut" id="howShut" data-icon="close" ' +
            'aria-label="Close"></button>' +
            '<div class="how__card" role="dialog" aria-modal="true" aria-label="How to play">' +
            '<div class="how__stage" id="howStage"></div>' +
            '<h2 class="how__title words" id="howTitle"></h2>' +
            '<p class="how__line words" id="howLine"></p>' +
            '<div class="how__acts">' +
            '<button type="button" class="how__skip words" id="howSkip"></button>' +
            '<button type="button" class="how__next words" id="howNext"></button>' +
            "</div>" +
            '<div class="how__steps" id="howSteps"></div>' +
            "</div>";

        Game.Icons.hydrate(host);

        stage = document.getElementById("howStage");
        titleEl = document.getElementById("howTitle");
        lineEl = document.getElementById("howLine");
        stepsEl = document.getElementById("howSteps");
        nextEl = document.getElementById("howNext");
        skipEl = document.getElementById("howSkip");
        skipEl.innerHTML = Game.Icons.words("Skip");

        for (var d = 0; d < PAGES.length; d++) {
            var step = document.createElement("button");
            step.type = "button";
            step.className = "how__step";
            step.setAttribute("aria-label", "Page " + (d + 1));
            step.dataset.to = d;
            stepsEl.appendChild(step);
        }

        host.addEventListener("click", function (event) {
            if (event.target.closest("#howShut")) return Game.HowTo.close();
            if (event.target.closest("#howSkip")) return Game.HowTo.close();

            var step = event.target.closest(".how__step");
            if (step) return show(Number(step.dataset.to));

            // Next, or a tap anywhere else, moves on; the last page lets go
            if (at === PAGES.length - 1) return Game.HowTo.close();
            show(at + 1);
        });

        return true;
    }

    /* the grid for a page: as many squares as it asks for */
    function lay(page) {
        var cols = page.cols || 5;
        var count = cols * (page.rows || 4);

        stage.style.setProperty("--how-cols", cols);
        if (cells.length === count) return;

        stage.innerHTML = "";
        cells = [];
        for (var i = 0; i < count; i++) {
            var cell = document.createElement("span");
            cell.className = "how__cell";
            stage.appendChild(cell);
            cells.push(cell);
        }
        shown = null;
    }

    function tintOf(id) {
        var piece = Game.Pieces.byId(id);
        return piece ? piece.tint : "";
    }

    function paint(state) {
        // whatever was ringed to go, and has gone, breaks apart first — while
        // its square still wears its colour
        if (shown) {
            shown.go.forEach(function (i) {
                var was = shown.map[i];
                if (was && state.map[i] !== was && Game.Shatter) {
                    Game.Shatter.tile(cells[i], was, 0.55);
                }
            });
        }

        for (var i = 0; i < cells.length; i++) {
            var id = state.map[i];
            var cell = cells[i];
            var next = "how__cell" +
                (id ? " is-full " + tintOf(id) : "") +
                (state.go.indexOf(i) !== -1 ? " is-going" : "") +
                (state.lit.indexOf(i) !== -1 ? " is-lit" : "");

            if (cell.className !== next) cell.className = next;

            var want = id || "";
            if (cell.dataset.piece !== want) {
                cell.dataset.piece = want;
                var piece = id && Game.Pieces.byId(id);
                cell.innerHTML = piece ? Game.Icons.svg(piece.icon) : "";
            }
        }
        shown = state;
    }

    function run() {
        window.clearTimeout(timer);
        var page = PAGES[at];
        paint(page.frames[frame]);

        var last = frame === page.frames.length - 1;
        var own = page.frames[frame].hold;
        timer = window.setTimeout(function () {
            frame = (frame + 1) % page.frames.length;
            if (frame === 0) shown = null;
            run();
        }, last ? (page.last || page.hold * 3) : (own || page.hold));
    }

    function show(index) {
        at = index;
        frame = 0;

        var page = PAGES[at];
        lay(page);
        shown = null;

        titleEl.innerHTML = Game.Icons.words(page.title);
        lineEl.innerHTML = Game.Icons.words(page.line);
        // the last page's Next is Play, and Skip has nothing left to skip
        nextEl.innerHTML = Game.Icons.words(at === PAGES.length - 1 ? "Play" : "Next");
        skipEl.classList.toggle("is-gone", at === PAGES.length - 1);

        var steps = stepsEl.children;
        for (var i = 0; i < steps.length; i++) {
            steps[i].classList.toggle("is-here", i === at);
        }
        run();
    }

    function keys(event) {
        if (!host || !host.classList.contains("is-open")) return;
        if (event.key === "Escape") return Game.HowTo.close();
        if (event.key === "ArrowRight") return show(Math.min(PAGES.length - 1, at + 1));
        if (event.key === "ArrowLeft") return show(Math.max(0, at - 1));
    }

    Game.HowTo = {
        open: function () {
            if (!host && !build()) return;
            host.classList.add("is-open");
            show(0);
            document.addEventListener("keydown", keys);
        },

        // closed, skipped, or played out: all the same, and seen either way
        close: function () {
            if (!host || !host.classList.contains("is-open")) return;
            window.clearTimeout(timer);
            host.classList.remove("is-open");
            document.removeEventListener("keydown", keys);
            Game.Storage.write(SEEN, { seen: true });
            Game.Events.emit("howto:closed", {});
        },

        // whether the game has explained itself before
        seen: function () {
            return !!Game.Storage.read(SEEN);
        }
    };
})();
