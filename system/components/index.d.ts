/** aphes.ist runtime: window.Aphesis (plain JavaScript, no framework). */
type Pt = [number, number];
interface FogZone { el?: Element; pad?: number; left?: number; top?: number; width?: number; height?: number }
interface FogProps { density?: number; light?: number }
interface SimulacrumSource { src: string | HTMLImageElement | HTMLCanvasElement; gain?: number; scatter?: number; erosion?: number; ceiling?: number }
interface SimulacrumProps { source?: string | HTMLImageElement | HTMLCanvasElement | SimulacrumSource; scatter?: number; erosion?: number; ceiling?: number; fit?: 'contain' | 'cover'; gain?: number; cell?: number; accent?: number; margin?: number; ground?: boolean }
interface IconsProps { name: 'eye' | 'sol' | 'luna' | 'terminator' | 'threshold'; state?: 0 | 1 }
interface BrushProps { points: Pt[]; width: number; seed: number; taper?: number; wobble?: number }
interface SealProps { boil?: boolean }
interface TypistProps { el: Element; caret?: Element }
interface TooltipProps { 'data-tip': string }
interface CursorProps { 'data-cursor'?: string }
interface LetterWaveProps { el: Element }
interface Aphesis {
  brush(points: Pt[], width: number, seed: number, taper?: number, wobble?: number): string;
  arc(cx: number, cy: number, r: number, a0: number, a1: number, n?: number, ry?: number): Pt[];
  line(x0: number, y0: number, x1: number, y1: number, n?: number): Pt[];
  stipple(test: (x: number, y: number) => boolean, seed: number, count: number, size?: number, box?: number): string;
  icon(name: IconsProps['name'], state?: 0 | 1): string;
  seal(el: Element, opts?: SealProps): { stop(): void };
  Fog(canvas: HTMLCanvasElement, opts?: FogProps): { zones(list: (Element | FogZone)[]): void; set(o: FogProps): void; stop(): void; start(): void; destroy(): void };
  Simulacrum(canvas: HTMLCanvasElement, opts?: SimulacrumProps): { show(src?: SimulacrumProps['source'], done?: () => void): void; hide(done?: () => void): void; set(src: SimulacrumProps['source'], done?: () => void): void; stop(): void; start(): void; drawn(cb: () => void): void; destroy(): void };
  Typist: new (el: Element, caret?: Element) => { type(text: string, done?: () => void): void; erase(done?: () => void): void; loop(lines: (string | { text: string })[], hold?: number, onLine?: (l: any, i: number) => void): void; stop(): void };
  tooltip(root?: Element): void;
  cursor(root?: Element): void;
  letters(el: Element): void;
  MJ(t: number): number;
  cellPx(cell?: number): number;
  themeShift(apply: () => void, opts?: { origin?: [number, number]; duration?: number; done?: () => void }): boolean;
  reducedMotion: boolean;
}
declare const Aphesis: Aphesis;
