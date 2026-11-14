import type { Metadata, Viewport } from 'next';
import './globals.css';
import { THEME_INIT_SCRIPT } from '@/lib/theme';

export const metadata: Metadata = {
  title: 'Akshara (अक्षर) • Learn to Read & Write Nepali',
  description:
    'A playful, open-source studio for kids to learn Nepali Devanagari — trace letters on a Pati slate, add matras, and build words and sentences.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fff8ec' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1120' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The theme class is set before paint by THEME_INIT_SCRIPT, so the server markup
    // intentionally differs from the live <html> attributes.
    <html lang="ne" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
