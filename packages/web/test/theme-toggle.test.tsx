import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeToggle } from '@/components/ThemeToggle';
import { THEME_STORAGE_KEY } from '@/lib/theme';

function mockSystemDark(dark: boolean) {
  const listeners = new Set<() => void>();
  const mq = {
    matches: dark,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: (_: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  };
  vi.spyOn(window, 'matchMedia').mockImplementation(() => mq as unknown as MediaQueryList);
  return {
    flip(next: boolean) {
      mq.matches = next;
      listeners.forEach((cb) => cb());
    },
  };
}

const root = () => document.documentElement;

describe('ThemeToggle', () => {
  beforeEach(() => {
    window.localStorage.clear();
    root().classList.remove('dark');
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to Auto and follows the system preference', () => {
    mockSystemDark(true);
    render(<ThemeToggle />);
    expect(screen.getByRole('radio', { name: 'Auto theme' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(root()).toHaveClass('dark');
  });

  it('switches to Light and Dark and remembers the choice', async () => {
    mockSystemDark(true);
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole('radio', { name: 'Light theme' }));
    expect(root()).not.toHaveClass('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(screen.getByRole('radio', { name: 'Light theme' })).toHaveAttribute(
      'aria-checked',
      'true'
    );

    await user.click(screen.getByRole('radio', { name: 'Dark theme' }));
    expect(root()).toHaveClass('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('restores a saved preference on mount', () => {
    mockSystemDark(true);
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    render(<ThemeToggle />);
    expect(screen.getByRole('radio', { name: 'Light theme' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(root()).not.toHaveClass('dark');
  });

  it('reacts live to OS changes only while on Auto', async () => {
    const system = mockSystemDark(false);
    const user = userEvent.setup();
    render(<ThemeToggle />);
    expect(root()).not.toHaveClass('dark');

    system.flip(true);
    expect(root()).toHaveClass('dark');

    await user.click(screen.getByRole('radio', { name: 'Light theme' }));
    system.flip(true);
    expect(root()).not.toHaveClass('dark');
  });
});
