import type {Metadata} from 'next';
import {GeistSans, GeistMono} from 'geist/font'; // Updated import for Geist
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { Providers } from './providers';

const geistSans = GeistSans; // Using GeistSans directly
const geistMono = GeistMono; // Using GeistMono directly

export const metadata: Metadata = {
  title: 'CryptoCrash Game',
  description: 'A thrilling crypto crash game MVP.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
