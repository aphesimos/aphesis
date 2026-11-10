/** aphes.ist runtime: window.Aphesis (plain JavaScript, no framework). */
type Pt = [number, number];
interface FogZone { el?: Element; pad?: number; left?: number; top?: number; width?: number; height?: number }
interface FogProps {
  density?: number; light?: number;
  /** the clearing, 0..1 (home 0, a section 1): the fog drifts out of a central band to the sides, leaving a sparse residue. Eased with minimum jerk over 1.8 s. */
  clear?: number;
  /** the band's width as a share of the screen's width; null or left out follows the screen (.66 wide, .94 on a phone) */
  clearWidth?: number | null;
}
type EyeBlink = 'open' | 'half' | 'closed' | 'squint' | 'wide';
type EyeGaze = 'centre' | 'left' | 'right' | 'up' | 'down' | 'up-left' | 'up-right' | 'down-left' | 'down-right' | 'narrow' | 'dilated';
interface EyeProps { size?: number; gaze?: 'auto' | 'pointer' | Element; follow?: Element | (() => [number, number] | null); blink?: boolean; drawIn?: boolean; start?: boolean }
interface EyeHandle { el: Element; blink(): void; close(ticks?: number): void; open(): void; wide(ticks?: number): void; squint(ticks?: number): void; look(x: number, y: number): void; typed(): void; on(fn: (s: { blink: EyeBlink; gaze: EyeGaze; frame: number; tick: number }) => void): void; readonly state: { blink: EyeBlink; gaze: EyeGaze; frame: number; tick: number }; readonly drawn: boolean; start(): void; stop(): void; destroy(): void }
interface SimulacrumSource { src: string | HTMLImageElement | HTMLCanvasElement; gain?: number; scatter?: number; erosion?: number; ceiling?: number }
interface SimulacrumProps { sound?: boolean; source?: string | HTMLImageElement | HTMLCanvasElement | SimulacrumSource; scatter?: number; erosion?: number; ceiling?: number; fit?: 'contain' | 'cover'; gain?: number; cell?: number; accent?: number; margin?: number; ground?: boolean; legible?: boolean | number }
type SectionIcon = 'book' | 'descent' | 'archive' | 'laboratory' | 'works' | 'wall' | 'forum' | 'music';
/** state: 0 at rest, 1 the second drawing (for a section icon: chosen, its stipple gathered) */
interface IconsProps { name: 'eye' | 'sol' | 'luna' | 'terminator' | 'threshold' | 'ear' | SectionIcon; state?: 0 | 1 }
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
  /** true while the ear is closed; the stored choice from an earlier visit counts from the first moment */
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
  /** the eight sections in the home's order, each also an icon name */
  SECTIONS: SectionIcon[];
  seal(el: Element, opts?: SealProps): { stop(): void };
  Fog(canvas: HTMLCanvasElement, opts?: FogProps): { zones(list: (Element | FogZone)[]): void; set(o: FogProps): void; stop(): void; start(): void; destroy(): void };
  Simulacrum(canvas: HTMLCanvasElement, opts?: SimulacrumProps): { show(src?: SimulacrumProps['source'], done?: () => void): void; hide(done?: () => void): void; set(src: SimulacrumProps['source'], done?: () => void): void; stop(): void; start(): void; drawn(cb: () => void): void; destroy(): void };
  /** the eye, alive: drawn in, then trembling at 8 fps with hard-cut blinks and saccadic gaze (components/Eye) */
  Eye(el: Element, opts?: EyeProps): EyeHandle;
  Typist: new (el: Element, caret?: Element) => { type(text: string, done?: () => void): void; erase(done?: () => void): void; loop(lines: (string | { text: string })[], hold?: number, onLine?: (l: any, i: number) => void): void; stop(): void };
  tooltip(root?: Element): void;
  cursor(root?: Element): void;
  letters(el: Element): void;
  MJ(t: number): number;
  cellPx(cell?: number): number;
  themeShift(apply: () => void, opts?: { origin?: [number, number]; duration?: number; done?: () => void }): boolean;
  /** sets <meta name="theme-color"> to the current theme's bg; runs by itself at load, on every theme change and when a themeShift wave ends */
  themeColor(): void;
  reducedMotion: boolean;
  Sound: Sound;
}
declare const Aphesis: Aphesis;
/** fired on window by Sound.start() and on every change of the mute, so anything else that sounds can follow the ear */
interface WindowEventMap { 'aph:sound': CustomEvent<{ muted: boolean }> }
