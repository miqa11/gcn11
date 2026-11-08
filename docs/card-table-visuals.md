# Card table artwork and phone layouts

Poker, joker and blackjack share `card-tables.css`, a small felt texture, and a cached SVG deck in `card-table-art.js`. The deck includes corner ranks, traditional pip layouts, mirrored court illustrations, two joker colours, and patterned card backs. The styles add woven felt, padded rails, warm metal trim, player plaques, and quieter controls.

This is a presentation change. Each page loads the shared assets and calls the artwork painter from its existing card renderer. The original game scripts were compared with the base revision: the only addition inside them is that artwork call. Rules, payouts, bets, matchmaking, timers, turn restrictions, legal-card checks, socket messages and server code are unchanged.

On phones in landscape, poker and blackjack place their controls in a separate right column. Blackjack shows the player's own hand first, with a horizontally scrollable row for the other hands. Joker reserves a bottom strip for the hand and player details. Safe areas, narrow portrait screens, score sheets, bidding, joker choices, invitations and chat retain their existing controls.

Validation: all 122 existing automated tests pass. Optional browser QA renders the real pages with controlled Socket.IO snapshots, exercises the original action payloads and disabled/illegal controls, and checks element bounds and overlaps at 1440×960, 844×390, 667×375, 568×320, 390×844 and 320×568. It covers full tables, betting, bidding, joker choices, lobbies, setup screens and isolation from the saved chat theme. This fixture does not run real matches or spend real coins.

Run `node scripts/check-card-table-layout.cjs` with Playwright, Express and Socket.IO available. `NODE_PATH` can point to a separate QA dependency directory; `CITY_QA_CHROME` can select an installed Chrome executable. `CARD_QA_OUTPUT` selects the screenshot directory (otherwise the operating system's temporary directory is used).
