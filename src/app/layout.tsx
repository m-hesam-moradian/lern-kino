import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const sansFont = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const monoFont = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: '#00FFFF',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: {
    default: 'LernKino — Learn German Through Cinema',
    template: '%s | LernKino',
  },
  description:
    'Stream German-dubbed series and cinema with synchronized dual subtitles, interactive dictionary word lookups, and spaced-repetition vocabulary learning.',
  icons: {
    icon: '/icon.svg',
  },
  keywords: [
    'Learn German',
    'German subtitles',
    'Dual subtitles',
    'Friends German Dub',
    'Leitner Box',
    'German Cinema',
    'Language learning video',
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const stored = localStorage.getItem('lernkino_theme') || localStorage.getItem('subsync_theme');
                if (stored === 'light') {
                  document.documentElement.classList.remove('dark');
                  document.documentElement.classList.add('light');
                } else {
                  document.documentElement.classList.add('dark');
                  document.documentElement.classList.remove('light');
                }
              } catch(e) {
                document.documentElement.classList.add('dark');
              }
            `,
          }}
        />
      </head>
      <body className={`${sansFont.variable} ${monoFont.variable} font-sans relative min-h-screen flex flex-col justify-between selection:bg-cyan-500/20 selection:text-cyan-400`}>
        <ThemeProvider>
          {/* ── Ambient Background Glow Orbs ──────────────────────────── */}
          <div className="fixed inset-0 overflow-hidden pointer-events-none z-[-1]">
            <div className="absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full bg-cyan-500/10 dark:bg-cyan-400/8 blur-[130px]" />
            <div className="absolute top-1/4 -right-32 w-[520px] h-[520px] rounded-full bg-slate-400/10 dark:bg-indigo-500/8 blur-[150px]" />
            <div className="absolute bottom-10 left-1/3 w-[600px] h-[600px] rounded-full bg-cyan-400/5 blur-[160px]" />
          </div>

          {/* ── Sticky Frosted Glass Navbar ───────────────────────────── */}
          <Navbar />

          {/* ── Main Page Content ─────────────────────────────────────── */}
          <div className="pt-20 flex-1">
            {children}
          </div>

          {/* ── Minimalist Glassmorphic Footer ────────────────────────── */}
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
