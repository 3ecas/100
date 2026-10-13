window.Game = window.Game || {};

/* =============================================================================
   ROUND VIEW
   -----------------------------------------------------------------------------
   The piece in hand, the card at the end of a run, and the two buttons at the
   top left that belong to the run: how to play, and start over, which takes
   two taps mid-run — the first arms it and says under it what the second
   will do. (The third button there, sound, is painted by js/ui/sound.js, and
   the fourth, about, by js/ui/about.js.)
   ============================================================================= */

(function () {
    var handHost = null;
    var overHost = null;
    var restartBtn = null;
    var pendingOver = null;

    var ARM_MS = 2600;
    var armed = null;

    // a finger still on the board as the run ends must not start the next one
    var SETTLE_MS = 600;
    var overAt = 0;

    function waiting(on) {
        if (!handHost) return;
        handHost.classList.toggle("is-waiting", !!on);
    }

    function renderHand() {
        var round = Game.Round.get();
        if (!handHost || !round) return;

        var piece = round.hand[0];
        handHost.innerHTML = piece
            ? '<span class="slot is-picked ' +
              piece.tint +
              '" title="' +
              piece.name +
              '">' +
              Game.Icons.svg(piece.icon) +
              "</span>"
            : "";
    }

    function showOver(detail) {
        if (!overHost) return;

        if (Game.BoardView.isBusy()) {
            pendingOver = detail;
            return;
        }
        pendingOver = null;

        // Game over — or the 100 blown up, which is the run won — the run's
        // score, and the best under it. Nothing else: a tap anywhere is the
        // next run.
        var won = detail.reason === "won";
        var label = won ? "You blew up the 100" : "Game over";
        overHost.innerHTML =
            '<div class="over__card' + (won ? " over__card--won" : "") + '" role="dialog" aria-label="' +
            label + '. Tap to play again.">' +
            '<span class="over__label words">' + Game.Icons.words(label) + "</span>" +
            '<span class="over__score">' + Game.Icons.number(detail.score) + "</span>" +
            '<span class="over__best">' +
            Game.Icons.number(detail.best, "Best " + detail.best) + "</span>" +
            "</div>";
        // how many ems wide the score runs, so it can shrink to fit a narrow
        // screen: a run deep past 35 scores in the billions
        var digits = overHost.querySelector(".over__score svg");
        if (digits) {
            digits.parentNode.style.setProperty("--wide", parseFloat(digits.style.width));
        }

        overHost.classList.add("is-open");
        overAt = Date.now();
    }

    function hideOver() {
        if (!overHost) return;
        overHost.classList.remove("is-open");
        overHost.innerHTML = "";
    }

    /* Starting over throws the run away, so mid-run it takes a second tap: the
       first one only arms the button and says so. A run that is over, or has
       not had a drop yet, has nothing to lose and goes at once. */
    function disarm() {
        if (!restartBtn) return;
        window.clearTimeout(armed);
        armed = null;
        restartBtn.classList.remove("is-armed");
        restartBtn.setAttribute("aria-label", "Start over");
    }

    function startOver() {
        var round = Game.Round.get();
        var worth = round && round.running && round.placed > 0;

        if (!worth || armed) {
            disarm();
            Game.Round.start();
            return;
        }

        restartBtn.classList.add("is-armed");
        restartBtn.setAttribute("aria-label", restartBtn.getAttribute("data-confirm"));
        armed = window.setTimeout(disarm, ARM_MS);
    }

    Game.RoundView = {
        init: function () {
            handHost = document.getElementById("hand");
            overHost = document.getElementById("over");
            restartBtn = document.getElementById("restartBtn");

            var howBtn = document.getElementById("howBtn");
            if (howBtn) {
                howBtn.addEventListener("click", function () {
                    disarm();
                    Game.HowTo.open();
                });
            }

            if (restartBtn) {
                // what the second tap does, shown under the button once armed
                restartBtn.insertAdjacentHTML("beforeend",
                    '<span class="tool__say words" aria-hidden="true">' +
                    Game.Icons.words(restartBtn.getAttribute("data-confirm")) + "</span>");
                restartBtn.addEventListener("click", startOver);
            }

            Game.Events.on("game:started", function () {
                disarm();
                hideOver();
                waiting(false);
                renderHand();
            });

            Game.Events.on("game:hand", renderHand);

            Game.Events.on("game:choosing", function () {
                waiting(true);
            });
            Game.Events.on("game:chosen", function () {
                waiting(false);
            });

            Game.Events.on("game:over", showOver);
            Game.Events.on("board:settled", function () {
                if (pendingOver) showOver(pendingOver);
            });

            if (overHost) {
                overHost.addEventListener("click", function () {
                    if (Date.now() - overAt < SETTLE_MS) return;
                    Game.Round.start();
                });
            }
        }
    };
})();
