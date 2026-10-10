import type { ThemeId } from '../contract';
const sans = new URL('./notosanssc.woff2', import.meta.url).href;
const serif = new URL('./notoserifsc.woff2', import.meta.url).href;
export const themeFonts: Record<ThemeId, readonly string[]> = {
 qingci: [sans, serif, new URL('./cormorantgaramond.woff2', import.meta.url).href],
 liubai: [sans, serif],
 jingshe: [sans, new URL('./jost.woff2', import.meta.url).href],
 zhuangse: [sans, new URL('./archivo.woff2', import.meta.url).href],
};
