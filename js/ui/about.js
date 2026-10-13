window.Game = window.Game || {};

/* =============================================================================
   ABOUT
   -----------------------------------------------------------------------------
   The fourth button at the top left, on the web only, opens this: what the
   game is, where to get the app, and the privacy page — what a landing page
   would say, over the game dimmed. The apps do not show it: you are already
   there, and a store would rather not be shown the other one; their listings
   carry the privacy link. The words are the game's own square capitals, and
   the 100 at the top is the top of the ladder.
   ============================================================================= */

(function () {
    var host = null;
    var open = false;

    function native() {
        var cap = window.Capacitor;
        return !!(cap && cap.isNativePlatform && cap.isNativePlatform());
    }

    function all(selector, fn) {
        Array.prototype.forEach.call(host.querySelectorAll(selector), fn);
    }

    function fill() {
        all("[data-words]", function (el) {
            el.innerHTML = Game.Icons.words(el.getAttribute("data-words"));
        });
        all("[data-number]", function (el) {
            el.innerHTML = Game.Icons.number(el.getAttribute("data-number"));
        });

        // the stores: live only once there is somewhere to go
        var links = Game.Config.links || {};
        all("[data-store]", function (el) {
            var url = links[el.getAttribute("data-store")];
            if (!url) return;
            el.href = url;
            el.removeAttribute("aria-disabled");
        });
        all("[data-link=source]", function (el) {
            if (links.source) el.href = links.source;
        });
    }

    function keys(event) {
        if (event.key === "Escape") Game.About.close();
    }

    Game.About = {
        init: function () {
            host = document.getElementById("about");
            var button = document.getElementById("aboutBtn");
            if (!host || !button) return;

            // not in the apps
            if (native()) {
                button.hidden = true;
                return;
            }

            fill();
            Game.Icons.hydrate(host);

            button.addEventListener("click", Game.About.open);

            host.addEventListener("click", function (event) {
                // the cross, or a tap on the dark around the card, closes it
                if (event.target.closest("#aboutShut") || event.target === host) {
                    Game.About.close();
                }
            });
        },

        open: function () {
            if (!host || open) return;
            open = true;
            host.classList.add("is-open");
            host.setAttribute("aria-hidden", "false");
            document.addEventListener("keydown", keys);
        },

        close: function () {
            if (!host || !open) return;
            open = false;
            host.classList.remove("is-open");
            host.setAttribute("aria-hidden", "true");
            document.removeEventListener("keydown", keys);
        },

        isOpen: function () {
            return open;
        }
    };
})();
