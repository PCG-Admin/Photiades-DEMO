import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { ToastProvider } from '@/components/providers/ToastProvider';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'PCG | MindRift Workflow Portal',
  description: 'Invoice and document workflow portal for PCG | MindRift.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

// Apply persisted theme before paint to avoid a flash of the default theme.
const themeScript = `(function(){try{var s=localStorage.getItem('pcg-theme');if(!s)return;var t=JSON.parse(s);var r=document.documentElement;if(t.accentHue!=null)r.style.setProperty('--accent-h',String(t.accentHue));if(t.density)r.style.setProperty('--density',t.density==='compact'?'0.85':t.density==='comfortable'?'1':'1.12');r.setAttribute('data-theme',t.dark?'dark':'light');if(t.lang)r.lang=t.lang==='el'?'el':'en';}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning className={inter.variable}>
      <body>
        <Script id="theme-init" strategy="beforeInteractive">{themeScript}</Script>
        <ThemeProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
