import { useEffect, useRef, useState } from 'react';

/** Width of a container, for components that take a pixel width (AnatomyMap). */
export function useWidth<T extends HTMLElement>(fallback = 343) {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const update = () => { const next = Math.round(node.getBoundingClientRect().width); if (next > 0) setWidth(next); };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}
