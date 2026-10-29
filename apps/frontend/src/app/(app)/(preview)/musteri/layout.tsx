import { ReactNode } from 'react';
import { Metadata, Viewport } from 'next';
import { PreviewWrapper } from '@gitroom/frontend/components/preview/preview.wrapper';

// added to the home screen of the customer's phone, it opens like an app
export const metadata: Metadata = {
  title: 'Müşteri paneli',
  description: 'Projelerinizi, planlanan paylaşımları ve onayınızı bekleyen tasarımları takip edin.',
  manifest: '/musteri.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Müşteri paneli',
    statusBarStyle: 'default',
  },
  icons: {
    apple: '/musteri-icon-192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#612BD3',
};

export default async function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-newBgColor min-h-screen text-newTextColor">
      <PreviewWrapper>{children}</PreviewWrapper>
    </div>
  );
}
