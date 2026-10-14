window.Game = window.Game || {};

/* =============================================================================
   CHARGE VIEW
   -----------------------------------------------------------------------------
   The bomb beside the hand. A small square that fills like a glass: a level
   that rises as the charge does, with dust in every colour of the wheel
   rising through it so the thing is visibly alive, and a pulse that never
   stops — a square stroke born on the dial's edge in a flash, going out past
   it and fading as it goes. White, faint and slow while the dial is filling,
   and the fuller the clearer. Once it is worth pressing it wears the bomb's
   own light (js/ui/pulse.js): the rainbow edge, turning and pulsing, strokes
   going out in it, and the dust blowing out from the centre — the same the
   bomb has on the board. It is
   meant to be read out of the corner of the eye — the piece sitting on top is
   what you are actually looking at.

   Any [data-charge] button gets this renderer, so a second dial would only
   need its markup.
   ============================================================================= */

(function () {
    var PAD = 15;              // room around the square for the pulses to go
    var GREY = "#aeb6c0";      // what a dial looks like while it is still filling

    var dials = [];

    function make(host) {
        var canvas = host.querySelector(".dial__ink");
        if (!canvas || !canvas.getContext) return null;

        var one = {
            name: host.getAttribute("data-charge"),
            host: host,
            lit: host.getAttribute("data-lit") || "#ffd873",
            charge: 0,
            shown: 0,
            ready: false
        };
        one.light = Game.Pulse.make(canvas, false, function (light, gap) {
            draw(one, light, gap);
        });
        return one;
    }

    function draw(one, light, gap) {
        var ctx = light.ctx;
        var w = light.wide;
        var h = light.tall;
        var cx = w / 2;
        var cy = h / 2;
        var r = Math.min(w, h) / 2 - PAD;           // half the square itself
        var top = cy - r;
        var span = r * 2;

        one.shown += (one.charge - one.shown) * Math.min(1, gap * 5);
        ctx.clearRect(0, 0, w, h);

        // While it is filling a dial is grey — the colour is the reward, and it
        // only arrives when the thing is worth pressing.
        var level = top + span * (1 - Math.max(0, Math.min(1, one.shown)));

        ctx.save();
        ctx.beginPath();
        ctx.rect(cx - r, cy - r, span, span);
        ctx.clip();

        ctx.globalAlpha = one.ready ? 0.92 : 0.5;
        ctx.fillStyle = one.ready ? one.lit : GREY;
        ctx.fillRect(cx - r, level, span, cy + r - level);
        ctx.globalAlpha = 1;

        ctx.restore();

        // white strokes while filling, the fuller the clearer; the bomb's own
        // light once it is ready
        var paint = "#ffffff";
        var seen = 0.35 + 0.45 * Math.max(0, Math.min(1, one.shown));
        if (one.ready) {
            paint = Game.Pulse.edge(light, cx, cy, r, gap);
            seen = 1;
        }
        Game.Pulse.pulses(light, cx, cy, r, PAD - 2, gap, one.ready, paint, seen);
    }

    function find(name) {
        for (var i = 0; i < dials.length; i++) {
            if (dials[i].name === name) return dials[i];
        }
        return null;
    }

    /* a short shudder, so a dial visibly reacts to being fed */
    function react(one, hard) {
        one.host.classList.remove("is-fed", "is-filled");
        void one.host.offsetWidth;                   // restart the animation
        one.host.classList.add(hard ? "is-filled" : "is-fed");
        window.clearTimeout(one.settle);
        one.settle = window.setTimeout(function () {
            one.host.classList.remove("is-fed", "is-filled");
        }, hard ? 620 : 340);
    }

    function show(detail) {
        var one = find(detail.name);
        if (!one) return;

        var grew = detail.charge > one.charge + 0.0001;
        var filled = detail.ready && !one.ready;

        one.charge = detail.charge;
        one.ready = detail.ready;

        // filling up is announced: a pulse at once, not after the next wait
        if (filled) Game.Pulse.now(one.light);

        if (!Game.Pulse.still() && (grew || filled)) react(one, filled);
        one.host.classList.toggle("is-ready", detail.ready);
        one.host.disabled = !detail.ready;
        Game.Pulse.touch(one.light);
    }

    Game.ChargeView = {
        init: function () {
            var hosts = document.querySelectorAll("[data-charge]");
            if (!hosts.length) return;

            Array.prototype.forEach.call(hosts, function (host) {
                var one = make(host);
                if (!one) return;
                dials.push(one);

                host.addEventListener("click", function () {
                    Game.Charges.toggle(one.name);
                });
            });

            Game.Icons.hydrate(document);

            Game.Events.on("charge:change", show);

            Game.Events.on("charge:armed", function (detail) {
                dials.forEach(function (one) {
                    one.host.classList.toggle("is-armed", detail.name === one.name);
                });
            });
        }
    };
})();
