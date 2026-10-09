import type { AnchorHTMLAttributes, ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;
const classes = (...names: (string | undefined)[]) => names.filter(Boolean).join(' ');

/** Native button semantics, including keyboard activation and disabled behavior. */
export function Pressable({ className, type = 'button', ...props }: ButtonProps) {
  return <button {...props} type={type} className={classes('v8-press', className)} />;
}

export function Button({ variant = 'secondary', workout = false, className, ...props }: ButtonProps & {
  variant?: 'primary' | 'secondary'; workout?: boolean;
}) {
  return <Pressable {...props} className={classes('v8-control', `v8-button-${variant}`, workout && variant === 'primary' ? 'v8-button-workout' : undefined, className)} />;
}

export function IconButton({ className, ...props }: ButtonProps & { 'aria-label': string }) {
  return <Pressable {...props} className={classes('v8-control', 'v8-icon-button', className)} />;
}

export function Chip({ selected, className, ...props }: Omit<ButtonProps, 'aria-pressed'> & { selected: boolean }) {
  return <Pressable {...props} aria-pressed={selected} className={classes('v8-control', 'v8-chip', className)} />;
}

export function Link({ className, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return <a {...props} className={classes('v8-press', 'v8-link', className)} />;
}

export function Sheet({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={classes('v8-sheet', className)} />;
}

export function Row({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={classes('v8-row', className)} />;
}

export function Stat({ label, value, description }: { label: string; value: ReactNode; description?: string }) {
  return <dl className="v8-stat"><dt>{label}</dt><dd>{value}</dd>{description && <dd className="v8-stat-description">{description}</dd>}</dl>;
}

export function Toggle({ checked, onCheckedChange, children, className, onClick, ...props }: Omit<ButtonProps, 'role' | 'aria-checked'> & {
  checked: boolean; onCheckedChange: (checked: boolean) => void;
}) {
  return <Pressable {...props} role="switch" aria-checked={checked} className={classes('v8-control', 'v8-toggle', className)}
    onClick={event => { onClick?.(event); if (!event.defaultPrevented) onCheckedChange(!checked); }}>
    <span>{children}</span><span className="v8-toggle-mark" aria-hidden="true">{checked ? '✓' : '−'}</span>
  </Pressable>;
}

export function Segmented({ label, options, value, onChange, disabled = false }: {
  label: string; options: readonly { value: string; label: string }[];
  value: string; onChange: (value: string) => void; disabled?: boolean;
}) {
  return <fieldset className="v8-segmented" disabled={disabled}><legend>{label}</legend>
    <div>{options.map(option => <Chip key={option.value} selected={value === option.value}
      disabled={disabled} onClick={() => onChange(option.value)}>{option.label}</Chip>)}</div>
  </fieldset>;
}
