/** aphes.ist runtime: window.Aphesis (plain JavaScript, no framework). */
type Pt = [number, number];
interface FogZone { el?: Element; pad?: number; left?: number; top?: number; width?: number; height?: number }
interface FogProps { density?: number; light?: number }
interface SimulacrumSource { src: string | HTMLImageElement | HTMLCanvasElement; gain?: number; scatter?: number; erosion?: number; ceiling?: number }
interface SimulacrumProps { sound?: boolean; source?: string | HTMLImageElement | HTMLCanvasElement | SimulacrumSource; scatter?: number; erosion?: number; ceiling?: number; fit?: 'contain' | 'cover'; gain?: number; cell?: number; accent?: number; margin?: number; ground?: boolean }
interface IconsProps { name: 'eye' | 'sol' | 'luna' | 'terminator' | 'threshold' | 'ear'; state?: 0 | 1 }
interface BrushProps { points: Pt[]; width: number; seed: number; taper?: number; wobble?: number }
interface SealProps { boil?: boolean }
interface TypistProps { el: Element; caret?: Element }
interface TooltipProps { 'data-tip': string }
interface CursorProps { 'data-cursor'?: string }
interface LetterWaveProps { el: Element }
/** the screens that have a voice */
type SoundVoice = 'home' | 'book' | 'experimental' | 'archive' | 'laboratory' | 'works' | 'wall' | 'forum' | 'music';
/** experimental's chambers: 0 the door, 1-9 in their order, 9 the ending (the darkest) */
type SoundChamber = number | 'door' | 'ouroboros' | 'hands' | 'scholar' | 'tablet' | 'fortune' | 'veil' | 'alchemist' | 'sky' | 'ending';
type SoundEvent = 'swell' | 'door' | 'coalesce' | 'dissolve' | 'impact' | 'turn' | 'shift' | 'passage';
interface SoundProps { scene?: SoundVoice; chamber?: SoundChamber; transition?: number }
interface SoundTimelineItem { at: number; scene?: SoundVoice; chamber?: SoundChamber; transition?: number; event?: SoundEvent; mute?: boolean; duck?: number; ms?: number }
interface Sound {
  /** call once at load. Runs and fades in over `fade` ms (default 7000, the φ's drawing) where the browser allows it,
      otherwise at the first gesture of any kind. A visitor who muted it stays muted and nothing is created. */
  start(opts?: { fade?: number; scene?: SoundVoice; chamber?: SoundChamber }): Sound;
  /** crossfade to a screen's voice over `transition` ms (duration-voice, 3.6 s) */
  scene(name: SoundVoice, opts?: { transition?: number; chamber?: SoundChamber }): Sound;
  /** a soft swell or impact in the key of the voice playing */
  event(kind: SoundEvent): Sound;
  /** lower everything to `level` (0..1) over `ms`; duck(1) restores. Playing <audio>/<video> ducks to .05 by itself. */
  duck(level: number, ms?: number): Sound;
  /** fade out or in over duration-hush (1.2 s); no argument toggles. Remembered in localStorage ('aphesis.sound'). */
  mute(muted?: boolean): Sound;
  readonly muted: boolean;
  /** 'none' before anything was created, then the AudioContext's state */
  readonly state: 'none' | AudioContextState | 'interrupted';
  readonly context: AudioContext | null;
  /** what is playing now, for a meter */
  level(): { rms: number; peak: number };
  /** mount the ear: in this <button>, or in a new button inside el */
  ear(el: Element): HTMLButtonElement;
  readonly voices: SoundVoice[];
  readonly chambers: string[];
  /** the same engine on an OfflineAudioContext, for analysis (levels, spectra, clicks) */
  render(seconds: number, opts?: SoundProps & { sampleRate?: number; timeline?: SoundTimelineItem[] }): Promise<AudioBuffer>;
}
interface Aphesis {
  brush(points: Pt[], width: number, seed: number, taper?: number, wobble?: number): string;
  arc(cx: number, cy: number, r: number, a0: number, a1: number, n?: number, ry?: number): Pt[];
  line(x0: number, y0: number, x1: number, y1: number, n?: number): Pt[];
  stipple(test: (x: number, y: number) => boolean, seed: number, count: number, size?: number, box?: number): string;
  icon(name: IconsProps['name'], state?: 0 | 1): string;
  seal(el: Element, opts?: SealProps): { stop(): void };
  Fog(canvas: HTMLCanvasElement, opts?: FogProps): { zones(list: (Element | FogZone)[]): void; set(o: FogProps): void; stop(): void; start(): void };
  Simulacrum(canvas: HTMLCanvasElement, opts?: SimulacrumProps): { show(src?: SimulacrumProps['source'], done?: () => void): void; hide(done?: () => void): void; set(src: SimulacrumProps['source'], done?: () => void): void; stop(): void; start(): void; drawn(cb: () => void): void };
  Typist: new (el: Element, caret?: Element) => { type(text: string, done?: () => void): void; erase(done?: () => void): void; loop(lines: (string | { text: string })[], hold?: number, onLine?: (l: any, i: number) => void): void; stop(): void };
  tooltip(root?: Element): void;
  cursor(root?: Element): void;
  letters(el: Element): void;
  MJ(t: number): number;
  cellPx(cell?: number): number;
  themeShift(apply: () => void, opts?: { origin?: [number, number]; duration?: number; done?: () => void }): boolean;
  reducedMotion: boolean;
  Sound: Sound;
}
declare const Aphesis: Aphesis;
