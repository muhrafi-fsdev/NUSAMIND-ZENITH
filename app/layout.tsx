import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'NusaMind Apex R13.38',
  description: 'NusaMind Apex — asisten AI lokal performa tinggi untuk pekerjaan kompleks.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="id"><body>{children}</body></html>;
}
