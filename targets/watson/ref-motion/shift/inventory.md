# The Shift motion study for the 20-round game

Reference: https://theshift.tokyo/en/ at 1280 × 720 desktop, with a 390 × 844 mobile check.

| Element | Trigger | Measured movement | Timing | Game adaptation |
| --- | --- | --- | --- | --- |
| Featured project image | Pointer enters project title | Image begins as a thin horizontal slit behind the title, opens vertically into a wide rectangle, and stays behind the black type | Substantially open by 300 ms, settled by about 500 ms; fast ease out | Each round image opens from its center as the round arrives; it closes to a slit on Next |
| Featured project words | Scroll enters project list | Each word rises from under an overflow mask while the title line remains in place | First word's y translation was 75 px at entry, 44 px at 80 ms, 25 px at 160 ms, 9 px at 300 ms, and under 1 px at 500 ms | Hint words enter through masks with a short stagger; answer uses the same reveal |
| Project row | Scroll/hover | Hairline separators frame oversized, thin serif titles over the floating image | Image and text overlap | Use thin lines, pale gray background, high-contrast serif, and image/text layering |
| Mobile project list | Scroll | Serif project titles stack between hairlines; hover-only image is absent | No pointer hover | Keep the clue image visible through an automatic slit reveal on touch screens |
| “GET IN TOUCH” words | Scroll enters footer | Three words sit inside nested overflow masks; each word slides up into place, and the next follows shortly after | CSS transition 1.2 s with cubic-bezier(.26,1,.48,1); 0.1 s word stagger | Hint and answer words use masked 1.2 s entrances; title, image, rules, and button enter together and all leave before the next round |
| Dark mode | Footer control click | The whole page shifts from pale gray/black to near-black/light text; circular controls reverse their contrast | Root background transition is 0.6 s; dark background samples near #050505 | Revealing an answer changes the game palette over 0.6 s; advancing restores the light palette while the current round exits |

Visual notes: the sampled light project surface is RGB (240, 240, 240) and dark text is near RGB (20, 20, 20). Desktop featured titles are about 93 px at 1280 px wide. The site uses a high-contrast display serif with a plain grotesk for supporting controls. The game needs a Vietnamese-capable display face and must keep document images legible after the reveal.
