import type { Metadata, Viewport } from 'next';
import { Pixelify_Sans } from 'next/font/google';
import './globals.css';

const pixel = Pixelify_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-pixel' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://harvestia-one.vercel.app'),
  title: 'Harvestia',
  description: 'Grow your farm. Trade the markets. Build your empire. A pixel-art Web3 farming economy.',
  icons: { icon: '/assets/favicon-32.png', apple: '/assets/apple-touch-icon.png' },
  openGraph: { title: 'Harvestia', description: 'Grow your farm. Trade the markets. Build your empire.', images: ['/assets/og-image.png'] },
  twitter: { card: 'summary_large_image', images: ['/assets/og-image.png'] },
};
export const viewport: Viewport = { themeColor: '#0b0e13', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={pixel.variable}>
      <body>{children}</body>
    </html>
  );
}
