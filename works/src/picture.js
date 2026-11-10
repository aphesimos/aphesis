/* picture: the one simulacrum canvas of the section, reused for every work. It lies over the fog with no ground
   of its own (ground: false), so only its cells show. The canvas stays invisible until its first frame is drawn,
   and rests (stop) once it has dissolved, so the fog is the only thing drawing while the list is shown.

   show(work, src): coalesce the work out of the fog (2.6 s). If another work is still on the canvas, it dissolves
   first and the new one gathers in its place (Simulacrum.set), so two pictures never mix.
   hide(): dissolve back into the fog (1.8 s). */

const A = window.Aphesis;

export function createPicture(canvas, caption) {
  const s = A.Simulacrum(canvas, { ground: false, fit: 'contain', margin: 0.04, accent: 0.03 });
  s.stop();
  let onCanvas = null;     /* the work whose density map is loaded */
  let gathered = false;    /* any of it still on the canvas (shown, gathering or dissolving) */
  let token = 0, rest = 0;

  function reveal(t) { s.drawn(() => { if (t === token) canvas.classList.add('on'); }); }

  return {
    show(work, src) {
      const t = ++token; clearTimeout(rest);
      const source = Object.assign({ src }, work.map.settings || {});
      caption.classList.remove('on');
      s.start(); reveal(t);
      /* the caption arrives once the picture has begun to gather: at once, or after the old one has dissolved */
      const swap = onCanvas !== work.id && gathered;
      if (onCanvas === work.id) s.show(null); else if (swap) s.set(source); else s.show(source);
      onCanvas = work.id; gathered = true;
      setTimeout(() => { if (t !== token) return; caption.textContent = work.map.caption || ''; caption.classList.add('on'); }, swap ? 2100 : 600);
    },
    hide() {
      const t = ++token; clearTimeout(rest);
      caption.classList.remove('on');
      s.hide(() => {
        if (t !== token) return;
        gathered = false;
        canvas.classList.remove('on');
        rest = setTimeout(() => { if (t === token) s.stop(); }, 1400);
      });
    },
  };
}
