---
slug: the-fog-itself
title: the fog itself
gloss: nebula
order: 2
example: true
module: fog
summary: does the fog light as many cells as its density says? measured on the fog's own hash.
---

## hypothesis

the fog lights a cell when a hash of the cell's place falls below the density there. if that hash is spread evenly
between 0 and 1, the share of lit cells equals the density: at density .3, three cells in ten.

## method

the bench compiles the fog's own hash, taken from the site's runtime when this page is built, on a WebGL canvas in
your browser. it lays a ramp of density from 0 at the left edge to 1 at the right, draws one patch of cells, and
reads every cell back. the ramp is cut into 20 bins; for each, the share of lit cells is set against the mean density
of the bin.

each patch sits at a random place in a grid of 1,400 by 800 cells, as the fog's cells sit at different places on
different screens. 24 patches are measured, one after another. dragging the patch moves it through the grid, and
letting it go measures it where it rests.

the expectation is the line of single cells; each patch's bins are the grains; their mean is the brush line. the
red ring marks the bin furthest from its density.

## result

{state}. over {patches} patches and {cells} cells, the lit share follows {slope} times the density. the mean error
across the 20 bins is {mae}; the largest is {worst}, at density {at}. with an error under one hundredth as the bar,
the hypothesis {verdict} on this machine.

the hash is computed by your graphics card in floating point, so another device can measure something slightly
different. that is why it runs here and not on mine.
