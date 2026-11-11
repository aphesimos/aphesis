/* owner: the owner's mark, in place of a sigil. A post the server marked `owner` (only the owner's desk can make one:
   the content service passes it on with the forum's admin secret; nothing a visitor sends can claim it) shows a small
   Aphesis.Eye in rubedo, alive, and the name, aphesist, in Aphesis Script, like a capcode.

   ownerMark()       -> the markup for a post's header: the eye's place, the name, and words for assistive technology
   wakeOwners(root)  -> brings every eye under root to life, once: shared eyes (one tick for the page, still while off
                        screen, one set of drawings for one size; SVG only, no canvas), so a thread full of the owner's
                        posts is still light. Without the runtime's Eye (an older design system) a still eye stands in.
   ownerEye(el)      -> the live eye of a post's header, if any, for a moment of impact (a quote leading to it)
   ownerIcon()       -> a still eye, for the quote preview */

export const OWNER = 'aphesist';
const EYE_PX = 40;
const live = new WeakMap();

export function ownerMark() {
  return '<span class="owner-eye aph-red" aria-hidden="true"></span>' +
    '<span class="owner-name aph-display">' + OWNER + '</span><span class="sr">, the owner</span>';
}

export function wakeOwners(root) {
  const A = window.Aphesis;
  root.querySelectorAll('.owner-eye:not([data-live])').forEach((el) => {
    el.dataset.live = '1';
    if (A && typeof A.Eye === 'function') live.set(el, A.Eye(el, { size: EYE_PX, shared: true, drawIn: false, gaze: 'auto', blink: true }));
    else if (A && A.icon) el.innerHTML = A.icon('eye', 0);
  });
}

export function ownerEye(post) {
  const el = post && post.querySelector('.owner-eye');
  return el ? live.get(el) || null : null;
}

export function ownerIcon() {
  const A = window.Aphesis;
  return A && A.icon ? A.icon('eye', 0) : '';
}
