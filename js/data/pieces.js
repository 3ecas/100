window.Game = window.Game || {};

(function () {
    // One to thirty-five. The number on a piece is its rung, not its worth:
    // the points are the ones the ladder always paid.
    var ladder = [
        { id: "n1", name: "One", icon: "n1", tint: "num num-1", points: 1 },
        { id: "n2", name: "Two", icon: "n2", tint: "num num-2", points: 2 },
        { id: "n3", name: "Three", icon: "n3", tint: "num num-3", points: 3 },
        { id: "n4", name: "Four", icon: "n4", tint: "num num-4", points: 4 },
        { id: "n5", name: "Five", icon: "n5", tint: "num num-5", points: 6 },
        { id: "n6", name: "Six", icon: "n6", tint: "num num-6", points: 8 },
        { id: "n7", name: "Seven", icon: "n7", tint: "num num-7", points: 11 },
        { id: "n8", name: "Eight", icon: "n8", tint: "num num-8", points: 15 },
        { id: "n9", name: "Nine", icon: "n9", tint: "num num-9", points: 21 },
        { id: "n10", name: "Ten", icon: "n10", tint: "num num-10", points: 30 },
        { id: "n11", name: "Eleven", icon: "n11", tint: "num num-11", points: 42 },
        { id: "n12", name: "Twelve", icon: "n12", tint: "num num-12", points: 59 },
        { id: "n13", name: "Thirteen", icon: "n13", tint: "num num-13", points: 82 },
        { id: "n14", name: "Fourteen", icon: "n14", tint: "num num-14", points: 115 },
        { id: "n15", name: "Fifteen", icon: "n15", tint: "num num-15", points: 160 },
        { id: "n16", name: "Sixteen", icon: "n16", tint: "num num-16", points: 225 },
        { id: "n17", name: "Seventeen", icon: "n17", tint: "num num-17", points: 315 },
        { id: "n18", name: "Eighteen", icon: "n18", tint: "num num-18", points: 440 },
        { id: "n19", name: "Nineteen", icon: "n19", tint: "num num-19", points: 615 },
        { id: "n20", name: "Twenty", icon: "n20", tint: "num num-20", points: 860 },
        { id: "n21", name: "Twenty-one", icon: "n21", tint: "num num-21", points: 1200 },
        { id: "n22", name: "Twenty-two", icon: "n22", tint: "num num-22", points: 1700 },
        { id: "n23", name: "Twenty-three", icon: "n23", tint: "num num-23", points: 2350 },
        { id: "n24", name: "Twenty-four", icon: "n24", tint: "num num-24", points: 3300 },
        { id: "n25", name: "Twenty-five", icon: "n25", tint: "num num-25", points: 4600 },
        { id: "n26", name: "Twenty-six", icon: "n26", tint: "num num-26", points: 6450 },
        { id: "n27", name: "Twenty-seven", icon: "n27", tint: "num num-27", points: 9000 },
        { id: "n28", name: "Twenty-eight", icon: "n28", tint: "num num-28", points: 12600 },
        { id: "n29", name: "Twenty-nine", icon: "n29", tint: "num num-29", points: 17600 },
        { id: "n30", name: "Thirty", icon: "n30", tint: "num num-30", points: 24700 },
        { id: "n31", name: "Thirty-one", icon: "n31", tint: "num num-31", points: 34500 },
        { id: "n32", name: "Thirty-two", icon: "n32", tint: "num num-32", points: 48300 },
        { id: "n33", name: "Thirty-three", icon: "n33", tint: "num num-33", points: 67600 },
        { id: "n34", name: "Thirty-four", icon: "n34", tint: "num num-34", points: 94600 },

        { id: "n35", name: "Thirty-five", icon: "n35", tint: "num num-35", points: 132000 }
    ];

    // Past 35 the ladder goes on to 100, the summit, each rung paying 1.4
    // times the one under it as the top rungs always have. 36 to 99 walk the
    // palette round again — 36 to 39 in the greens of 1 to 4, and so on —
    // and the 100 wears the rainbow, as 35 does. Blowing the 100 up is how a
    // run is won (js/systems/round.js).
    var TOP = 100;
    for (var n = 36; n <= TOP; n++) {
        ladder.push({
            id: "n" + n, name: String(n), icon: "n" + n,
            tint: "num num-" + (n === TOP ? 35 : (n - 36) % 34 + 1),
            points: Math.round(ladder[ladder.length - 1].points * 1.4)
        });
    }

    ladder.forEach(function (piece, index) {
        var above = ladder[index + 1];
        piece.tier = index + 1;
        piece.next = above ? above.id : null;
    });

    // the 0: never dealt, only ever placed off the bomb dial
    var bomb = {
        id: "bomb",
        name: "Bomb",
        icon: "bomb",
        tint: "num num-0",
        tier: 0,
        next: null,
        points: 0
    };

    // falls in with the seam; set off, it takes every piece of the kind you name
    var infinity = {
        id: "infinity",
        name: "Infinity",
        icon: "infinity",
        tint: "num num-inf",
        tier: 0,
        next: null,
        points: 0
    };

    var index = { bomb: bomb, infinity: infinity };
    ladder.forEach(function (piece) {
        index[piece.id] = piece;
    });

    var WINDOW = 3;
    var CHANCE = [46, 34, 20];

    // The hand is dealt from a bag (js/systems/round.js): every number in
    // the window goes in, this many times each, lowest first — so in a bag
    // of eight the lowest comes four times, the middle three and the highest
    // once, and none of them can stay away for longer than a bag.
    var SHARE = [4, 3, 1];

    function windowTop(highestTier) {
        var peak = ladder.length;
        var made = highestTier || 1;

        // No floor of a full window: a run starts on 1 alone and every rung
        // it makes joins the deal, until there are three and the bottom one
        // drops off — making a 4 is what takes the 1 out of the hand. There
        // is no cap: the deal follows the best number made all the way up.
        return Math.max(1, Math.min(made, peak - 1));
    }

    Game.Pieces = {
        list: ladder,
        bomb: bomb,
        infinity: infinity,

        byId: function (id) {
            return index[id] || null;
        },

        // the top of the ladder: the 100
        top: function () {
            return ladder[ladder.length - 1];
        },

        dealing: function (highestTier) {
            var top = windowTop(highestTier);
            return ladder.slice(Math.max(0, top - WINDOW), top);
        },

        bagFor: function (highestTier) {
            var out = [];
            this.dealing(highestTier).forEach(function (piece, i) {
                for (var n = 0; n < (SHARE[i] || 1); n++) out.push(piece.id);
            });
            return out;
        },

        // one at random, weighted: what falls in from the seam
        randomFor: function (highestTier) {
            var options = this.dealing(highestTier);
            var total = options.reduce(function (sum, piece, i) {
                return sum + (CHANCE[i] || 10);
            }, 0);

            var roll = Math.random() * total;
            for (var i = 0; i < options.length; i++) {
                roll -= CHANCE[i] || 10;
                if (roll <= 0) return options[i];
            }
            return options[0];
        }
    };
})();
