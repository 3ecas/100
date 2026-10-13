window.Game = window.Game || {};

Game.Config = {
    // Where the about panel points (js/ui/about.js). The store links are
    // empty until the apps are published — the badges stay dim until then.
    links: {
        ios: "",
        android: "",
        source: "https://github.com/3ecas/35"
    },

    game: {
        saveKey: "thirtyfive.save",

        cols: 6,
        rows: 6,
        seedPieces: 1,   // a lone 1 to drop onto, so the first merge teaches itself
        handSize: 1,

        introPause: 500,

        // three that touch, on the four sides, become one of the next rung
        mergeAt: 3,

        // the same piece is dealt at most this many times in a row
        sameInRow: 2,

        // The seam, paced by how far the run has climbed rather than by how
        // long it has lasted: once the best number made reaches `from`,
        // `count` pieces fall in every `every` drops. Nothing falls in below
        // the first row; the last holds from 20 to the end of the run, however
        // high it climbs. (Steps at 25 and 30 kept every run in the twenties;
        // tools/sim.js measured it.)
        falls: [
            { from: 10, count: 1, every: 5 },
            { from: 15, count: 1, every: 3 },
            { from: 20, count: 2, every: 5 }
        ],

        // a fall never takes more than this share of the free squares, and
        // never less than fallLeast pieces
        fallRoom: 0.25,
        fallLeast: 1,

        // falling pieces go to the columns with the most room
        fallEven: true,

        // The top of the ladder has nowhere to go: cashAt of them together
        // cash in for cashBonus times their worth and leave the board. At
        // Infinity they never leave — the 100 stands until it is blown up,
        // which is how a run is won.
        cashAt: Infinity,
        cashBonus: 2,

        // each link of a chain pays chainStep more, up to chainMost times
        chainStep: 1,
        chainMost: 5,

        shakeForce: 0.6,

        // a blast pays this share of what it destroys
        blastPays: 1,

        // turns a bomb sits before it goes off, if no merge lights it first
        bombFuse: 5,

        // how far the blast reaches from the bomb, corners included. At 1 it
        // takes the eight squares around it and nothing further out.
        blastReach: 1,

        // merges that fill the bomb dial: each merge your own moves make
        // counts one, chains link by link; merges set off by pieces falling
        // in, or by a blast, do not count. The dial fills in twelve.
        bombPace: 12,

        // Infinity is out of the game. The piece and its sweep are still
        // here — set infinityFrom to a score and it falls in again with the
        // seam once a run passes it, then one every infinityEvery drops,
        // never while one is still on the board; a merge beside it or a
        // blast over it sets it off, and then you name a number and every
        // one of them goes.
        infinityFrom: Infinity,
        infinityEvery: 80,

        // The late game: from the rung the seam reaches its full strength
        // at, the dial and infinity's cadence can be set apart from the
        // rest of the run. Both the same as below for now.
        late: {
            from: 25,
            bombPace: 12,
            infinityEvery: 80
        }
    }
};
