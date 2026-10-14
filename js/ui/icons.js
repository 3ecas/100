window.Game = window.Game || {};

(function () {
    /* The buttons, drawn like the face: round ends, round corners, a curve
       where a curve reads better (css/theme.css: svg.icon). */
    var line = {
        // a speaker, and two waves of sound off it
        sound:
            '<path d="M5 9.5h3l4-3.5v12l-4-3.5H5z"/>' +
            '<path d="M15.5 9.5a3.5 3.5 0 0 1 0 5"/>' +
            '<path d="M18 7a7 7 0 0 1 0 10"/>',
        mute:
            '<path d="M5 9.5h3l4-3.5v12l-4-3.5H5z"/>' +
            '<path d="M16 10l4 4M20 10l-4 4"/>',
        // start over: a circular arrow, going round again
        restart:
            '<path d="M15.5 5.9A7 7 0 1 1 8.5 5.9"/>' +
            '<path d="M5.3 5.6L8.5 5.9L7.2 8.8"/>',
        help:
            '<path d="M9 9.3a3 3 0 1 1 4.7 2.5c-1.2.8-1.7 1.5-1.7 2.9"/>' +
            '<circle cx="12" cy="18.6" r="1.2" fill="currentColor" stroke="none"/>',
        close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
        // about the game, on the web: three sliders, each with its round knob
        settings:
            '<path d="M4 7h16M4 12h16M4 17h16"/>' +
            '<circle cx="9" cy="7" r="2.3" fill="currentColor" stroke="none"/>' +
            '<circle cx="15" cy="12" r="2.3" fill="currentColor" stroke="none"/>' +
            '<circle cx="10" cy="17" r="2.3" fill="currentColor" stroke="none"/>'
    };

    /* ---- the numbers ------------------------------------------------------

       Every number — on a piece, in the score, in the words — is set in the
       one face (css/theme.css: --face). On a piece it is white text in the
       24-unit box; the colour is the tile's, not the art's: see
       css/numbers.css. */
    function round(v) {
        return Math.round(v * 1000) / 1000;
    }

    // the face every number and word is set in (css/theme.css: --face), and
    // how big a number is on a piece, in the 24-unit box, by how many digits
    var FACE = 'ui-rounded, "SF Pro Rounded", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    var SIZES = { 1: 15, 2: 14, 3: 11 };

    function sizeOf(digits) {
        return SIZES[String(digits).length] || 9;
    }

    /* a number on a piece: text in the face, centred in the box; `mark` is
       the class the bomb's 0 wears */
    function numeral(n, mark) {
        var digits = String(n);
        return '<text class="digits' + (mark ? " mark" : "") + '" x="12" y="12.6" ' +
            'text-anchor="middle" dominant-baseline="central" font-size="' + sizeOf(digits) + '">' +
            digits + "</text>";
    }

    function escape(text) {
        return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;");
    }

    /* ---- the bomb and infinity ---------------------------------------------

       Neither is a number. The bomb is the black square with the 0 on it in
       white, and rainbow dust drifting over it on the board (js/ui/pulse.js).
       Infinity stands on a point: a white diamond with a black edge, and one
       unbroken figure of eight on it in the same black. The edge, which no
       number has, is what shows the white piece on the white grid; the
       diamond fills the tile's box from corner to corner. */
    var INK = "#2d2a2e";
    var EDGE = 1.5;                     // infinity's frame, measured across it
    var LOOP_WIDTH = 1.9;

    var LOOP =
        "M12 12C10.88 10.29 9.76 9.44 8.64 9.44A2.24 2.56 0 1 0 8.64 14.56" +
        "C9.76 14.56 10.88 13.71 12 12C13.12 10.29 14.24 9.44 15.36 9.44" +
        "A2.24 2.56 0 1 1 15.36 14.56C14.24 14.56 13.12 13.71 12 12Z";

    // a diamond on the 24-unit box, its points pulled in from the edges by
    // `inset` — a frame `inset` wide along the axis is inset / √2 across
    function diamond(inset) {
        var near = round(inset);
        var far = round(24 - inset);
        return "M12 " + near + "L" + far + " 12L12 " + far + "L" + near + " 12Z";
    }

    var DIAMOND = diamond(0);
    var INNER = diamond(EDGE * Math.SQRT2);

    // the colours 35 wears, read off the stylesheet the first time they are
    // asked for, so the one list in css/numbers.css is the only one
    var wheel = null;

    function readWheel() {
        var probe = document.createElement("span");
        probe.className = "num num-100";
        probe.hidden = true;
        document.body.appendChild(probe);
        var found = getComputedStyle(probe).getPropertyValue("--wheel");
        document.body.removeChild(probe);

        var stops = [];
        var stop = /(#[0-9a-f]{6})\s+([\d.]+)deg/gi;
        var hit;
        while ((hit = stop.exec(found))) stops.push({ at: +hit[2], hex: hit[1] });
        return stops.length ? stops : [{ at: 0, hex: INK }, { at: 360, hex: INK }];
    }

    var art = {
        // the 0 alone: the tile is black (css/numbers.css), as a number's is
        // its colour, and the mark winks (the class)
        bomb: numeral(0, true),

        // the column bomb: a bold white arrow pointing up and down on the black
        // tile — it takes the whole column. It stands still; nothing about it
        // winks.
        column: '<path d="M12 3.2L16.6 8.6H13.4V15.4H16.6L12 20.8L7.4 15.4H10.6V8.6H7.4Z" style="fill:#fff;stroke:none"/>',

        infinity:
            '<path d="' + DIAMOND + '" fill="' + INK + '"/>' +
            '<path d="' + INNER + '" fill="#fff"/>' +
            '<path d="' + LOOP + '" fill="none" stroke="' + INK + '" ' +
            'stroke-width="' + LOOP_WIDTH + '"/>'
    };

    // the numbers, 0 to 35 ready; any higher one is drawn the first time it
    // is asked for. The plain 0 is the mark the bomb dial wears.
    for (var n = 0; n <= 35; n++) art["n" + n] = numeral(n);

    function artFor(name) {
        if (!art[name] && /^n\d+$/.test(name)) art[name] = numeral(+name.slice(1));
        return art[name];
    }

    function wrap(body, isArt) {
        return (
            '<svg class="icon' +
            (isArt ? " icon--art" : "") +
            '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
            body +
            "</svg>"
        );
    }

    Game.Icons = {
        has: function (name) {
            return !!(artFor(name) || line[name]);
        },

        /* Any number in the same blocks — the score, the best, the points in
           flight. One em tall and as wide as it runs, in the colour of the
           text around it, and read out as the number it is, or as `label`. */
        number: function (text, label) {
            return '<span class="num-text" role="img" aria-label="' + escape(label || text) + '">' +
                escape(String(text)) + "</span>";
        },

        /* Words in the square letters: one em tall, in the colour of the text
           around them. Each word is a picture of its own, so a line breaks
           between words the way text does (the holder lays them out — see
           .words in css/theme.css); the words themselves are there too,
           unseen, for anyone listening rather than looking. */
        words: function (text) {
            return '<span class="word">' + escape(String(text)) + "</span>";
        },

        svg: function (name) {
            if (artFor(name)) return wrap(art[name], true);
            if (line[name]) return wrap(line[name], false);
            return "";
        },

        /* The same drawing on a canvas, in the 24-unit box the art is made in,
           for js/ui/shatter.js to cut into pieces. A number, and the bomb, are
           painted on whatever ground the canvas already has; infinity brings
           its own. */
        paint: function (ctx, name) {
            if (name === "infinity") {
                ctx.fillStyle = INK;
                ctx.fill(new Path2D(DIAMOND));
                ctx.fillStyle = "#fff";
                ctx.fill(new Path2D(INNER));
                ctx.lineWidth = LOOP_WIDTH;
                ctx.strokeStyle = INK;
                ctx.stroke(new Path2D(LOOP));
                return;
            }

            if (name === "column") {
                ctx.fillStyle = "#fff";
                ctx.fill(new Path2D("M12 3.2L16.6 8.6H13.4V15.4H16.6L12 20.8L7.4 15.4H10.6V8.6H7.4Z"));
                return;
            }

            var digits = name === "bomb" ? "0"
                : /^n\d+$/.test(name) ? name.slice(1) : null;
            if (digits === null) return;

            ctx.fillStyle = "#fff";
            ctx.font = "800 " + sizeOf(digits) + "px " + FACE;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(digits, 12, 12.6);
        },

        /* the piece whose art is its own shape and ground — a number, and
           the bomb, are white on whatever colour the tile wears */
        ownGround: function (name) {
            return name === "infinity";
        },

        // the black of the bomb, and of infinity's edge and sign
        ink: INK,

        /* the rainbow only 35 wears, as [{ at: degrees from twelve, hex }],
           round the clock — for anything that wants to paint it */
        wheel: function () {
            return wheel || (wheel = readWheel());
        },

        hydrate: function (root) {
            var host = root || document;
            var slots = host.querySelectorAll("[data-icon]");
            Array.prototype.forEach.call(slots, function (slot) {
                var name = slot.getAttribute("data-icon");
                if (!name || slot.firstElementChild) return;
                slot.innerHTML = Game.Icons.svg(name);
            });
        }
    };
})();
