/* eye: the gate's eye is the design system's Aphesis.Eye (components/Eye): the theme switch's eye drawn large, drawn
   in stroke by stroke, then trembling at 8 fps, with blinks and gaze as discrete drawings on two independent tracks,
   cut to and held for whole ticks, never tweened. This module only says what the gate asks of it:
     a refusal  a hard cut to the closed lid, held nine ticks (then a narrowed pupil)
     the key    a hard cut to wide open with a dilated pupil, held ten ticks
   and it glances at the line's caret as the owner types (`follow`). */

const A = window.Aphesis;
export const TICK = 125;

export function createEye(host, { follow } = {}) {
  const e = A.Eye(host, { start: false, gaze: 'auto', follow, blink: true });
  return {
    el: host,
    start: () => e.start(),
    stop: () => e.stop(),
    destroy: () => e.destroy(),
    get drawn() { return e.drawn; },
    get state() { return e.state; },
    /* every drawing it can show, for checks: the cuts never leave this set */
    get drawings() { return e.drawings; },
    hit(kind) { if (kind === 'wrong') e.close(9); else if (kind === 'right') e.wide(10); },
    typed: () => e.typed(),
    look: (x, y) => e.look(x, y),
    on: (f) => e.on(f),
  };
}
