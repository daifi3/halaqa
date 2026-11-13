/**
 * TeX → SVG for the whiteboard, using MathJax's TeX input and SVG output with the
 * DOM-free "lite" adaptor, so it runs in React Native and on the web alike.
 *
 * `fontCache: 'none'` makes MathJax write every glyph as a plain <path> instead
 * of <use> references, which Skia's SVG renderer and PDF export both handle.
 */
// Keep first: it defines a global MathJax reads while loading.
import './mathjax-setup';
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor';
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html';
import { TeX } from 'mathjax-full/js/input/tex';
import 'mathjax-full/js/input/tex/ams/AmsConfiguration';
import 'mathjax-full/js/input/tex/base/BaseConfiguration';
import { mathjax } from 'mathjax-full/js/mathjax';
import { SVG } from 'mathjax-full/js/output/svg';

export interface MathSvg {
  /** Inner SVG markup (no outer <svg>), drawn in `currentColor`. */
  body: string;
  /** viewBox origin and size, in MathJax units (1000 = 1em). */
  vb: [number, number, number, number];
}

type Doc = ReturnType<typeof mathjax.document>;
let doc: Doc | null = null;
const adaptor = liteAdaptor();

function document() {
  if (!doc) {
    RegisterHTMLHandler(adaptor);
    const input = new TeX({
      packages: ['base', 'ams'],
      // Throw instead of rendering a red error box, so the editor can say what's wrong.
      formatError: (_jax: unknown, err: Error) => { throw err; },
    });
    doc = mathjax.document('', { InputJax: input, OutputJax: new SVG({ fontCache: 'none' }) });
  }
  return doc;
}

const cache = new Map<string, MathSvg>();

/** Typesets `tex`. Throws an Error with a readable message when the TeX is invalid. */
export function renderTex(tex: string): MathSvg {
  const hit = cache.get(tex);
  if (hit) return hit;
  const svg = adaptor.innerHTML(document().convert(tex, { display: true }) as never);
  const vb = svg.match(/viewBox="([^"]+)"/)?.[1]?.split(/\s+/).map(Number);
  const body = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  if (!vb || vb.length !== 4 || vb.some((n) => !Number.isFinite(n))) throw new Error('Could not lay out this expression');
  const out: MathSvg = { body, vb: vb as MathSvg['vb'] };
  if (cache.size > 200) cache.clear();
  cache.set(tex, out);
  return out;
}

/** Size in px when the expression is set at `fontPx` per em. */
export const mathSize = (m: MathSvg, fontPx: number) => ({ width: (m.vb[2] / 1000) * fontPx, height: (m.vb[3] / 1000) * fontPx });

const tint = (body: string, color: string) => body.replace(/currentColor/g, color);

/** A standalone SVG document — what Skia draws on the board. */
export function mathDocument(m: MathSvg, color: string, width: number, height: number) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${m.vb.join(' ')}">${tint(m.body, color)}</svg>`;
}

/** The same expression as a group placed at (x, y), for embedding in the exported board SVG. */
export function mathGroup(m: MathSvg, color: string, x: number, y: number, fontPx: number) {
  const k = fontPx / 1000;
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${k.toFixed(5)}) translate(${-m.vb[0]} ${-m.vb[1]})">${tint(m.body, color)}</g>`;
}

/** Snippets for the editor's quick-insert row; `|` marks where the cursor lands. */
export const MATH_SNIPPETS: { label: string; tex: string }[] = [
  { label: 'a⁄b', tex: '\\frac{|}{}' },
  { label: '√', tex: '\\sqrt{|}' },
  { label: 'xⁿ', tex: '^{|}' },
  { label: 'xₙ', tex: '_{|}' },
  { label: 'π', tex: '\\pi ' },
  { label: '∑', tex: '\\sum_{i=1}^{n} |' },
  { label: '∫', tex: '\\int_{a}^{b} |\\,dx' },
  { label: 'lim', tex: '\\lim_{x \\to |} ' },
  { label: '∞', tex: '\\infty ' },
  { label: '±', tex: '\\pm ' },
  { label: '×', tex: '\\times ' },
  { label: '÷', tex: '\\div ' },
  { label: '≤', tex: '\\leq ' },
  { label: '≥', tex: '\\geq ' },
  { label: '≠', tex: '\\neq ' },
  { label: '≈', tex: '\\approx ' },
  { label: '→', tex: '\\to ' },
  { label: 'α', tex: '\\alpha ' },
  { label: 'β', tex: '\\beta ' },
  { label: 'θ', tex: '\\theta ' },
  { label: 'Δ', tex: '\\Delta ' },
  { label: '( )', tex: '\\left( | \\right)' },
  { label: 'matrix', tex: '\\begin{pmatrix} | & \\\\  & \\end{pmatrix}' },
];
