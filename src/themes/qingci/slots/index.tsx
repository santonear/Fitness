import { useId } from 'react';
import type { BrandMarkProps, FeatureCardProps, NavIconProps, StartHeroProps } from '../../contract';
import { FeatureCard as BaseFeatureCard, NavIcon as BaseNavIcon } from '../../base/slots';
import { Button } from '../../../ui/components/common';

export function BrandMark({ label }: BrandMarkProps) {
  return <span className="v8-brand v8-qingci-brand"><svg viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="32" cy="43" rx="27" ry="12" /><ellipse cx="32" cy="43" rx="18" ry="7" /><path d="M32 43V29m0 5C16 34 17 18 17 18s16-1 15 16m0-5C32 14 48 13 48 13s1 16-16 16" /></svg><span>{label}</span></span>;
}
export function StartHero({ name, templateId, startLabel, disabled, onStart }: StartHeroProps) { return <div className="v8-qingci-start v8-start" data-template-id={templateId}><Button variant="primary" aria-label={startLabel} disabled={disabled} onClick={onStart}><span className="v8-hero-name">{name}</span><span>{startLabel}</span></Button></div>; }
export function FeatureCard(props: FeatureCardProps) { return <div className="v8-qingci-feature"><BaseFeatureCard {...props} /></div>; }
export function NavIcon(props: NavIconProps) {
  const id = useId();
  return <span className="v8-qingci-nav"><svg width="0" height="0" aria-hidden="true"><defs><linearGradient id={id} x2="0" y2="1"><stop stopColor="var(--c-surface)" /><stop offset="1" stopColor="var(--c-signature)" /></linearGradient></defs></svg><span style={{ '--nav-glaze': `url(#${id})` } as import('react').CSSProperties}><BaseNavIcon {...props} /></span></span>;
}
export const qingciSlots = { BrandMark, StartHero, FeatureCard, NavIcon };
