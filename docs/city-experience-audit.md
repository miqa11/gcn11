# City experience fixes

This audit targets reproducible controls, rendering and connection failures; it is not a claim that the entire City has no remaining bugs.

| Problem | Changed behavior |
| --- | --- |
| Status updates removed match HUD buttons during a press or keyboard focus. | Controls keep their DOM identity while clocks, health and counters update in place. Structural/result changes still update the view. |
| Full-stamina idle frames repeatedly changed identical attributes/text, triggering unrelated panel scans. | Ability UI writes only changed values. Minimize controls observe relevant panel changes and batch mounting instead of scanning every window for unrelated text/status updates. |
| Movement continued behind the three-dot menu. Resident/street-life movement flags were not checked consistently. | Opening More clears held movement, and these windows block fresh world movement inputs until closed. |
| Tetris soft drop varied with display refresh rate. | Fixed 45 ms steps with bounded catch-up give matching progression at 30 and 144 Hz. |
| Releasing one input canceled a different held input; blur/minimizing could leave controls active. | Keyboard/touch sources are tracked independently and cleared on focus loss, rotation and hidden game views. Hidden games and forms ignore game movement keys. Match deadlines continue normally. |
| Tetris could not rotate at spawn and keyboard repeat could hard-drop several pieces unintentionally. | Above-board rotation is permitted, top-out is checked on locking, and rotate/hard-drop are single-press actions. Controls have Georgian accessibility labels. |
| Snake rejected legal moves into the departing tail and full-board food generation could loop forever. | Collision excludes the departing tail unless eating; food is selected from a bounded free-cell list, and filling the board completes the run. |
| A delayed bar response could overwrite a reopened menu; disconnected callbacks affected a new session. | State responses are scoped to the current view/session; timed-out requests release busy UI and report the connection problem. Payments are not automatically retried. |
| Reconnecting from an interior kept the old local scene after the server spawned the player outside. | The join packet resets the interior, exit button, district label and stale casino/arcade panel from authoritative state. |
| Missing records acknowledgements could permanently block arcade record loading after reconnect. An old score could update another attempt. | Records requests time out and reset on disconnect, obsolete callbacks are ignored, and score callbacks are scoped to the attempt. |

Validation: seven deterministic tests run the production arcade script against a recording canvas/clock, covering 30/144 Hz drop speed, held inputs, hidden/form input, spawn rotation/repeat, a legal Snake tail move, all 280 Snake cells and keyboard/touch rotation cancellation. Five finite regression cases also fail against the previous implementation with equivalent initial conditions. The full suite has 113 passing tests.

`node scripts/check-city-experience.cjs` runs an isolated multiplayer browser fixture. It checks More-menu movement blocking/resumption, zero idle stamina mutations during an 800 ms sample, delayed bar menu responses, authoritative interior reset and reconnect after a dropped records acknowledgement, and a 600 ms press on a stable match button across multiple server updates. Use the optional Playwright setup and `CITY_QA_CHROME` described in [city-mobile-layout.md](city-mobile-layout.md). Existing mobile-layout and bar/arcade/boss browser regressions cover the previous features. These local checks do not substitute for production-network or physical-device playtesting.
