import './globals.css';
import type { Metadata } from 'next';
import { AppProviders } from '@/components/site/app-providers';
import { playfair_display, pt_sans } from './fonts';
import { cn } from '@/lib/utils';
import { DEFAULT_ORG_NAME } from '@/lib/constants';


export const metadata: Metadata = {
  title: {
    default: DEFAULT_ORG_NAME,
    template: `%s | ${DEFAULT_ORG_NAME}`,
  },
  description: 'En bevegelse for vakrere arkitektur i Bergen.',
  keywords: ['Arkitekturopprøret', 'Bergen', 'Arkitektur', 'Byutvikling', 'Klassisk arkitektur'],
  openGraph: {
    title: DEFAULT_ORG_NAME,
    description: 'En bevegelse for vakrere arkitektur i Bergen.',
    type: 'website',
    locale: 'nb_NO',
  },
  manifest: '/manifest.json',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ff9c63',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn(
          "font-body antialiased min-h-screen flex flex-col",
          playfair_display.variable,
          pt_sans.variable
      )}>
        <AppProviders>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
