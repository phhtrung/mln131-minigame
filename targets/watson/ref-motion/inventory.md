# Watson homepage motion observed at 1728 × 982

Source: `live/0.png` through `live/7.png` and `live/states.json`, after an 8 second load dwell. Each following frame applies a 480 px wheel step and waits 900 ms.

| Element | Trigger | Observed movement | Timing |
| --- | --- | --- | --- |
| Header/nav | Wheel | Stays at the top while content moves behind it | Immediate position lock |
| Hero letters | Load | Rise separately from 110% below their masks to 0 | First starts near 985 ms, 60 ms stagger, exponential approach about 190 ms |
| Main text lines | Load | Rise from 110% below their masks to 0 | First starts near 1285 ms, 100 ms stagger, exponential approach about 190 ms |
| Two inline image stacks | Load | Rise from 110% below their masks to 0 | Starts near 1500 and 1600 ms, exponential approach about 190 ms |
| Hero | Wheel | Moves from 0 to about -478 px after the first step, then stops at about -582 px | Exponential approach about 178 ms |
| Main copy, About link, footer | Wheel | Move together from 0 to about -478 px, then -958 px, then stop near -971 px | Exponential approach about 178 ms |
| About link | Scroll entry | Masked text moves from 110% below its line to 0 when the section enters the viewport | Exponential approach about 190 ms |
| Footer copy | Scroll entry | Text lines move from 110% below their masks to 0 | First line starts about 65 ms after wheel; 27 ms stagger, exponential approach about 190 ms |
| Footer photo | Scroll entry | Container opacity 0→1 with quadratic ease out; image opacity 0→1 with quadratic ease in and out | Container: 50 ms delay, 1 s; image: 150 ms delay, 1 s |
| Two inline image stacks | Time | Each cycles through three images, one opaque image per stack | Alternating cuts every 600 ms; each stack advances every 1.2 s (see `carousel.json`) |

The browser's `scrollY` remains zero and `body.scrollHeight` equals the viewport height throughout. This page uses transforms for scrolling rather than document scroll. The footer's final position is the viewport bottom.

At 652 × 884, the hero starts 124 px below the top and stops near -312 px of transform; the other sections stop near -714 px. The footer's right column has no top margin, its first paragraph reflows into three different lines, and its `LA` mark is visible after the footer reveal (`mobile-live/3.png`).
