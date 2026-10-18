import type { BuiltinThemeId } from '../contract';
const sans = new URL('./notosanssc.woff2', import.meta.url).href;
const serif = new URL('./notoserifsc.woff2', import.meta.url).href;
const jost = new URL('./jost.woff2', import.meta.url).href;
const archivo = new URL('./archivo.woff2', import.meta.url).href;
const cormorant = new URL('./cormorantgaramond.woff2', import.meta.url).href;
/** V9 reuses the bundled OFL faces; design-only families (Fraunces, Nunito, Sora, Anton) map to the closest local face. */
export const themeFonts: Record<BuiltinThemeId, readonly string[]> = {
 pop: [sans, jost],
 vivid: [sans, serif, cormorant],
 gentle: [sans, jost],
 data: [sans, jost],
 fire: [sans, archivo],
};

/** V9 themes use heavier weights than the compact Sans subset (200–400) carries, so the full faces stay in use. */
export const compactThemeFonts = themeFonts;
