import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Button, Chip, IconButton, Link, Pressable, Segmented, Toggle } from '../../src/ui/components/common';

describe('V8 native control contracts', () => {
  it('defaults to non-submit and preserves explicit submit, disabled and accessible names', () => {
    expect(renderToStaticMarkup(createElement(Pressable, { children: 'Go' }))).toContain('type="button"');
    const html = renderToStaticMarkup(createElement(Button, { type: 'submit', disabled: true, variant: 'primary', workout: true, children: 'Go' }));
    expect(html).toContain('type="submit"'); expect(html).toContain('disabled=""'); expect(html).toContain('v8-button-workout');
    expect(renderToStaticMarkup(createElement(IconButton, { 'aria-label': 'Settings' }))).toContain('aria-label="Settings"');
  });
  it('exposes controlled selection, switch state and native links', () => {
    expect(renderToStaticMarkup(createElement(Chip, { selected: true, children: 'A' }))).toContain('aria-pressed="true"');
    const toggle = renderToStaticMarkup(createElement(Toggle, { checked: false, onCheckedChange() {}, children: 'Reminders' }));
    expect(toggle).toContain('v8-toggle-track'); expect(toggle).toContain('v8-toggle-thumb'); expect(toggle).not.toMatch(/[✓−]/);
    expect(toggle).toContain('role="switch"'); expect(toggle).toContain('aria-checked="false"');
    expect(renderToStaticMarkup(createElement(Link, { href: '#plan', children: 'Plan' }))).toContain('href="#plan"');
  });
  it('labels segmented choices and disables the group and its controls', () => {
    const html = renderToStaticMarkup(createElement(Segmented, { label: 'Period', options: [{ value: 'week', label: 'Week' }], value: 'week', disabled: true, onChange() {} }));
    expect(html).toContain('<legend>Period</legend>'); expect(html.match(/disabled=""/g)).toHaveLength(2);
  });
});
