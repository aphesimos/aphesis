---
title: how the fog is made
date: 2026-10-28
stage: rubedo
summary: three layers of noise, a threshold, and square cells that never blur.
example: true
---

the ground of every screen here is a fog of small square cells. nothing in it is drawn by hand: it is a field of numbers, and a cell lights where the field is dense enough.

## the field

the field is fractal noise: one soft noise added to itself five times, each time finer and fainter. three such layers are stacked, each turned by the golden angle[^golden] from the one before and scaled by φ, and each drifts φ times faster than the last. the noise also bends its own coordinates before it is read, which is what makes the fog curl instead of slide.

## the threshold

each cell compares the field with a number of its own, fixed by a hash of where it sits. where the field wins, the cell lights in the fog's color; where it loses, the ground shows through.

```
float m = smoothstep(.44, .74, d);
float dens = (m * .8 + .012) * vin * D;
```

`D` is the density: 1 at the center of the site, .62 inside a section like this one. `vin` is a vignette that thins the fog toward the edges of the screen.

## why the cells stay square

the canvas holds one pixel per cell, not one per screen pixel, and the browser scales it up with hard edges. a cell is two css pixels, rounded to whole device pixels, so it stays a crisp square on any screen, and the shader runs once per cell instead of once per pixel.

## calm zones

text never sits on a box. every block of text is handed to the fog as a calm zone, up to twelve at a time, and the fog thins around it. the column you are reading has one now: the fog keeps its distance behind these lines and gathers again at the margins.

[^golden]: the golden angle is 360° × (1 − 1/φ), about 137.5°, or 2.39996 radians: the number written into the shader. it is also the angle between one seed and the next in a sunflower head.
