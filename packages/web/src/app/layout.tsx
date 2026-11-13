import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Akshara (अक्षर) • Interactive Nepali Devanagari Literacy Engine',
  description:
    'Interactive open-source engine teaching Nepali Devanagari reading, pronunciation, and writing through parametric Pati-chalk stroke tracing, Barakhari Matra fusion, and SOV sentence construction.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ne" className="dark">
      <body className="min-h-screen bg-[#090d16] text-slate-100 antialiased selection:bg-amber-500/30 selection:text-amber-200">
        {children}
      </body>
    </html>
  );
}
