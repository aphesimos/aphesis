/* seeds: the lines the local preview shows when no wall is connected. They are examples, and the page says so:
   each carries `example: true`, and the Latin ones carry their English for the tooltip. */

export const SEEDS = [
  { text: 'festina lente', tip: 'make haste slowly' },
  { text: 'i left a door open in a dream and the fog came in' },
  { text: 'omnia mutantur, nihil interit', tip: 'everything changes, nothing is lost' },
  { text: 'the fog was kinder to me than the morning' },
  { text: 'i keep knocking on doors that were never locked' },
  { text: 'nosce te ipsum', tip: 'know thyself' },
  { text: 'somewhere in here is the sentence i never said' },
  { text: 'i forgive the year that took so long to end' },
  { text: 'lux in tenebris lucet', tip: 'the light shines in the darkness' },
  { text: 'i walked until the streetlights became stars' },
  { text: 'let it go, said the door, and closed softly' },
  { text: 'dum spiro spero', tip: 'while i breathe, i hope' },
].map((s, i) => Object.assign({ id: 'example-' + i, at: 0, example: true }, s));
