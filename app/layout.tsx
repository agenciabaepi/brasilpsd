import type { Metadata } from 'next'
import { Titillium_Web } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'

const titillium = Titillium_Web({ 
  subsets: ['latin'],
  weight: ['200', '300', '400', '600', '700', '900'],
  variable: '--font-titillium',
})

export const metadata: Metadata = {
  title: 'BrasilPSD - Recursos Digitais Premium',
  description: 'Baixe imagens, vídeos, fontes, PSD, AI e muito mais. Recursos digitais de alta qualidade para seus projetos.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className={titillium.variable}>
      <body className="antialiased">
        {children}
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#87E64C',
                secondary: '#fff',
              },
            },
            error: {
              duration: 4000,
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
      </body>
    </html>
  )
}
