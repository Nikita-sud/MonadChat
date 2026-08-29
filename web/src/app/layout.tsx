import type { Metadata } from 'next'
import { Geist_Mono } from 'next/font/google'
import localFont from 'next/font/local'
import './globals.css'

const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

/** The user's own hand-drawn display face — wordmark and headlines only. */
const alsina = localFont({
  src: '../fonts/AlsinaUltrajada.ttf',
  variable: '--font-alsina',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'MonadChat — chat where words cost money',
  description:
    'Pay-per-message stream chat on Monad: every message is a transaction and the streamer is paid instantly.',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${geistMono.variable} ${alsina.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-paper">{children}</body>
    </html>
  )
}
