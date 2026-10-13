window.Game = window.Game || {};

(function () {
    // One to thirty-five. A number is worth its face value: a merge of 1s
    // pays 1, a merge of 40s pays 40 (js/systems/board.js).
    var ladder = [
        { id: "n1", name: "One", icon: "n1", tint: "num num-1" },
        { id: "n2", name: "Two", icon: "n2", tint: "num num-2" },
        { id: "n3", name: "Three", icon: "n3", tint: "num num-3" },
        { id: "n4", name: "Four", icon: "n4", tint: "num num-4" },
        { id: "n5", name: "Five", icon: "n5", tint: "num num-5" },
        { id: "n6", name: "Six", icon: "n6", tint: "num num-6" },
        { id: "n7", name: "Seven", icon: "n7", tint: "num num-7" },
        { id: "n8", name: "Eight", icon: "n8", tint: "num num-8" },
        { id: "n9", name: "Nine", icon: "n9", tint: "num num-9" },
        { id: "n10", name: "Ten", icon: "n10", tint: "num num-10" },
        { id: "n11", name: "Eleven", icon: "n11", tint: "num num-11" },
        { id: "n12", name: "Twelve", icon: "n12", tint: "num num-12" },
        { id: "n13", name: "Thirteen", icon: "n13", tint: "num num-13" },
        { id: "n14", name: "Fourteen", icon: "n14", tint: "num num-14" },
        { id: "n15", name: "Fifteen", icon: "n15", tint: "num num-15" },
        { id: "n16", name: "Sixteen", icon: "n16", tint: "num num-16" },
        { id: "n17", name: "Seventeen", icon: "n17", tint: "num num-17" },
        { id: "n18", name: "Eighteen", icon: "n18", tint: "num num-18" },
        { id: "n19", name: "Nineteen", icon: "n19", tint: "num num-19" },
        { id: "n20", name: "Twenty", icon: "n20", tint: "num num-20" },
        { id: "n21", name: "Twenty-one", icon: "n21", tint: "num num-21" },
        { id: "n22", name: "Twenty-two", icon: "n22", tint: "num num-22" },
        { id: "n23", name: "Twenty-three", icon: "n23", tint: "num num-23" },
        { id: "n24", name: "Twenty-four", icon: "n24", tint: "num num-24" },
        { id: "n25", name: "Twenty-five", icon: "n25", tint: "num num-25" },
        { id: "n26", name: "Twenty-six", icon: "n26", tint: "num num-26" },
        { id: "n27", name: "Twenty-seven", icon: "n27", tint: "num num-27" },
        { id: "n28", name: "Twenty-eight", icon: "n28", tint: "num num-28" },
        { id: "n29", name: "Twenty-nine", icon: "n29", tint: "num num-29" },
        { id: "n30", name: "Thirty", icon: "n30", tint: "num num-30" },
        { id: "n31", name: "Thirty-one", icon: "n31", tint: "num num-31" },
        { id: "n32", name: "Thirty-two", icon: "n32", tint: "num num-32" },
        { id: "n33", name: "Thirty-three", icon: "n33", tint: "num num-33" },
        { id: "n34", name: "Thirty-four", icon: "n34", tint: "num num-34" },

        { id: "n35", name: "Thirty-five", icon: "n35", tint: "num num-35" }
    ];

    // Past 35 the ladder goes on to 100, the summit. The palette has 36
    // colours — nine sets of four — so from 37 the numbers walk it round
    // again, 37 to 40 in the greens of 1 to 4 and so on, and the 100 alone
    // wears the rainbow. Blowing the 100 up is how a run is won
    // (js/systems/round.js).
    var TOP = 100;
    for (var n = 36; n <= TOP; n++) {
        ladder.push({
            id: "n" + n, name: String(n), icon: "n" + n,
            tint: "num num-" + (n === TOP ? 100 : (n - 1) % 36 + 1)
        });
    }

    ladder.forEach(function (piece, index) {
        var above = ladder[index + 1];
        piece.tier = index + 1;
        piece.points = piece.tier;
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
