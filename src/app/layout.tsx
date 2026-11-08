import type { Metadata, Viewport } from 'next'
import { Mukta, Noto_Serif_Devanagari, Tiro_Devanagari_Marathi } from 'next/font/google'
import './globals.css'

/* Tiro is a Marathi-specific editorial serif — headlines and covers. Noto
   Serif carries long reading; Mukta the interface, kickers and captions. */
const tiro = Tiro_Devanagari_Marathi({
  weight: '400',
  subsets: ['devanagari', 'latin'],
  variable: '--font-tiro',
  display: 'swap',
})
const notoSerif = Noto_Serif_Devanagari({
  subsets: ['devanagari', 'latin'],
  weight: ['400', '600', '700'],
  variable: '--font-noto-serif',
  display: 'swap',
})
const mukta = Mukta({
  subsets: ['devanagari', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mukta',
  display: 'swap',
})

export const metadata: Metadata = {
  title: { default: 'महासंवाद ई-पुस्तके', template: '%s · महासंवाद ई-पुस्तके' },
  description: 'माहिती व जनसंपर्क महासंचालनालय, महाराष्ट्र शासन — बातम्या, विशेषांक आणि संग्रह, पुस्तकाच्या रूपात.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'),
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f3f1ec',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mr" className={`${tiro.variable} ${notoSerif.variable} ${mukta.variable}`}>
      <body>{children}</body>
    </html>
  )
}
