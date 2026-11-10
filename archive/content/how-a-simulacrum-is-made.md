---
title: how a simulacrum is made
date: 2026-10-14
stage: citrinitas
summary: no picture is shown here as itself. this is how one becomes fog.
example: true
---

there are no photographs on this site. when a picture is needed, it is remade from the same square cells as the fog, and it arrives the way weather does.

## the density map

it starts as a density map: a grayscale image, 480 to 640 pixels on its long side, where white means dense. the source is cropped to the figure and its levels are set so the dark ground falls away: the black point at the 30th percentile, the white at the 97.5th. what works is a lit mass on a dark ground. thin lines and flat color do not survive.

![hermes mercurius trismegistus · Giovanni di Stefano, 1488](simulacrum:trismegistus)

## never picture-perfect

a shader reads the map, and each cell lights where the picture is dense enough, against a threshold that mixes an even noise with a random one, so tones read as tones. three settings keep it from looking printed. erosion opens holes in the figure in the shape of the fog. the ceiling keeps even the brightest areas from filling completely. scatter lets some of the picture drift loose around it, read from a blurred copy of the map, so the figure thins into the fog instead of stopping at an edge.

## arriving

a simulacrum coalesces over 2.6 seconds and dissolves over 1.8. before it settles, the fog pushes its cells around; as it settles, they hold still. the pointer brings nearby cells forward.

the figure above is from the pavement of Siena Cathedral, inlaid in marble in 1488. it is already what a simulacrum wants: pale figures on a dark floor.
