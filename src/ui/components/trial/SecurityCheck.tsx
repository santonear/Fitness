import { useEffect, useRef } from 'react';

type Turnstile = { render(element: HTMLElement, options: Record<string, unknown>): string; remove(id: string): void };
export function SecurityCheck({ siteKey, onProof }: { siteKey: string; onProof: (proof: string) => void }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let disposed = false,
      id: string | undefined;
    const api = () => (window as unknown as { turnstile?: Turnstile }).turnstile;
    const render = () => {
      if (!disposed && host.current && api())
        id = api()!.render(host.current, {
          sitekey: siteKey,
          size: 'compact',
          action: 'trial_application',
          callback: onProof,
          'expired-callback': () => onProof(''),
          'error-callback': () => onProof(''),
        });
    };
    let script = document.querySelector<HTMLScriptElement>('script[data-trial-turnstile]');
    if (api()) render();
    else {
      if (!script) {
        script = document.createElement('script');
        script.dataset.trialTurnstile = 'true';
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        document.head.append(script);
      }
      script.addEventListener('load', render);
    }
    return () => {
      disposed = true;
      script?.removeEventListener('load', render);
      if (id) api()?.remove(id);
    };
  }, [siteKey, onProof]);
  return <div ref={host} />;
}
