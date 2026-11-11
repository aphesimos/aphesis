---
slug: autopoiesis
title: autopoiesis
gloss: αὐτοποίησις
order: 1
example: true
module: autopoiesis
summary: a rule that rewrites itself, and keeps a change only if it scores no worse.
---

## hypothesis

a machine that may change its own rule, and keeps a change only when a fixed test says it did not get worse, will
climb from a random rule to one that does a hard job far better than chance, without anyone writing the rule.

## method

the organism is a ring of 59 cells, each 0 or 1. every step, each cell reads itself and two neighbours on each side
and looks up its next state in a table of 32 entries: that table is the whole organism. its job is the *density
classification task*: from any first row, end with every cell 1 if the row held more 1s than 0s, and every cell 0
otherwise. no cell can see the whole ring, so the decision has to travel.

the benchmark is 64 first rows drawn once for each lineage. a row counts as decided only if, after 118 steps, the
whole ring is uniform and right. each generation the machine flips one to three entries of its own table, runs the
benchmark again, and keeps the new table if its score is not lower. after every rise it is also tested on 256 fresh
rows it never trained on, to see whether it learned the task or only its benchmark. a run lasts 300 generations.

on the left, the current rule run from one first row close to half 1s (the hard cases), time going down. on the right, the score of the kept rule (the
brush line) and of every proposed rewrite (the grains).

## result

{state}. after {gen} generations the machine had proposed {tried} rewrites of itself and kept {kept} that raised its
score, plus {neutral} that held it level. its score on the 64 trials went from {first} to {best}. on 256 fresh rows it
never trained on, the current rule decides {fresh} of them right. its table now reads {rule}.

each lineage starts from a different random rule and a different benchmark, so each run ends somewhere else: some
stall on a plateau, often near half, where a rule that always answers 0 or always 1 sits. that is part of the result.

## notes

this is a miniature of the loop behind the Darwin–Gödel Machine: propose a change to yourself, measure it on a
benchmark, keep what measures better, and keep an archive of where you have been. here the archive is one rule
deep, and the change is blind.
