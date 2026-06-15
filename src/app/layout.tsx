import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { ToastProvider } from '@/components/providers/ToastProvider';

const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-sans',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Photiades Workflow Portal',
  description: 'Invoice and document workflow portal for Photiades Group.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

// Apply persisted theme before paint to avoid a flash of the default theme.
const themeScript = `(function(){try{var s=localStorage.getItem('photiades-theme');if(!s)return;var t=JSON.parse(s);var r=document.documentElement;if(t.accentHue!=null)r.style.setProperty('--accent-h',String(t.accentHue));if(t.density)r.style.setProperty('--density',t.density==='compact'?'0.85':t.density==='comfortable'?'1':'1.12');r.setAttribute('data-theme',t.dark?'dark':'light');}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning className={`${plexSans.variable} ${plexMono.variable}`}>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <ThemeProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
