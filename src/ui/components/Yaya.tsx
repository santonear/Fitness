import type { YayaPose } from '../../themes/contract';
import { getTheme } from '../../themes/registry';
import { useOptionalTheme } from '../../themes/ThemeProvider';
import { YayaFigure, type YayaFigureProps } from '../../themes/YayaFigure';

export type { YayaPose };
export { yayaPoses, yayaFullMin, yayaSource } from '../../themes/YayaFigure';

export interface YayaProps extends YayaFigureProps {
  /** Theme whose costume to show; defaults to the active theme. */
  theme?: string;
}

/** 芽芽 mascot: per-theme costume image, full figure or head disc, token-driven ring and glow. */
export function Yaya({ theme, ...props }: YayaProps) {
  const context = useOptionalTheme();
  const manifest = getTheme(theme ?? context?.theme);
  return <YayaFigure mascot={manifest.mascot ?? 'pop'} {...props} />;
}
