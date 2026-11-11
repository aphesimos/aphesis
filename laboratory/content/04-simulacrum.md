---
slug: the-simulacrum
title: the simulacrum
gloss: εἴδωλον
order: 4
module: simulacrum
summary: turn a picture of yours into fog, and measure what is left of it.
---

## hypothesis

the site never shows a picture. it turns it into a density field, grey, white where it is dense, and the fog's
square cells light wherever the field passes a hashed threshold. if the threshold is spread evenly, the share of
cells that light should follow the map's density, but never reach it: the engine caps every area, opens holes in
the figure and lets some of it drift loose, so a simulacrum is never picture-perfect.

## method

the bench runs the site's own engine, *Aphesis.Simulacrum*, on one canvas. give it a picture: choose a file, drop
one on the canvas or paste it. or start from one of the design system's own maps. the picture is read here, in your
browser, and nothing is sent anywhere.

*the map* turns the picture into density: a crop, an inversion for engravings, the black and white points, gamma,
blur and contrast. *the render* takes the engine's own options, the ones the site sets: gain, scatter (the lost
points), erosion, ceiling, the cell, the fit, the margin, the red cells and the ground. what you see is what the
site would draw.

once the picture has settled, the bench reads the canvas back, cell by cell. inside the picture, away from its
feathered edge, every cell is sorted by the map's density under it into ten bins, and the share of each bin that lit
is set against it. the line of single cells is the map itself; the brush line is what lit; the red ring is the
densest bin.

## result

{state}. inside the picture the map asks for a mean density of {mean}, and {lit} of its cells lit: {ratio} what the
map asks. outside the picture, {stray} of the cells lit as lost points and mist. in the map's densest tenth, {top}
of the cells lit, so {verdict}.

## notes

*εἴδωλον* is the Greek for a likeness that is not the thing: the image in a mirror, a phantom, the copy of a copy
in Plato. Lucretius translated it as *simulacra*, the thin films he believed peel off every body and drift to the
eye. that is the engine's name, and what it does: a picture peeling off into fog.

"copy settings" gives the picture's own settings in the form the site reads, {src, gain, scatter, erosion,
ceiling}; the cell, the fit, the margin, the red cells and the ground belong to the canvas, not to the picture.
"download the map" gives the density map as it is prepared here, ready to stand beside the site's other simulacra.
