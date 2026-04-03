import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Morph — LLM Business OS',
  description:
    'Type natural language, generate SQL, and manage your data on a visual canvas.',
  icons: {
    icon: [{ url: '/morph.png', type: 'image/png' }],
    apple: '/morph.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="h-screen overflow-hidden bg-[#0a0a0a] text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  );
}
