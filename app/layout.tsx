import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'SEC EDGAR Explorer',
  description: 'Interactive 10-K company relationship graph and topic cluster explorer',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>
        {children}
      </body>
    </html>
  )
}
