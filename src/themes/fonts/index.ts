import type { BuiltinThemeId } from '../contract';
const sans = new URL('./notosanssc.woff2', import.meta.url).href;
const numeric = new URL('./archivo.woff2', import.meta.url).href;
const serif = new URL('./notoserifsc.woff2', import.meta.url).href;
export const themeFonts: Record<BuiltinThemeId, readonly string[]> = {
 qingci: [sans, serif, numeric],
 liubai: [sans, serif, numeric],
 jingshe: [sans, new URL('./jost.woff2', import.meta.url).href, numeric],
 zhuangse: [sans, new URL('./archivo.woff2', import.meta.url).href],
};

export const compactThemeFonts = {
 ...themeFonts,
 qingci: [new URL('./notosanssc-compact.woff2', import.meta.url).href, new URL('./notoserifsc-compact.woff2', import.meta.url).href, themeFonts.qingci[2]],
 liubai: [new URL('./notosanssc-compact.woff2', import.meta.url).href, new URL('./notoserifsc-compact.woff2', import.meta.url).href, numeric],
 jingshe: [new URL('./notosanssc-compact.woff2', import.meta.url).href, themeFonts.jingshe[1], numeric],
};
