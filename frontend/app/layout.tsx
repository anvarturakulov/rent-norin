import type { Metadata } from 'next'
import { Roboto } from 'next/font/google'
import './styles/globals.css'
import { AppProvider } from './context/app.context'
import { WebSocketProvider } from './context/websocket.context'
import { InlineReferenceModal } from './components/reference/inlineReferenceModal/inlineReferenceModal'
import { PereodicsListWindow } from './components/windows/pereodicsListWindow/pereodicsListWindow'
import { APP_LOCALE } from './config/locale'
import { theme } from './theme/theme'

const roboto = Roboto({ subsets: ['cyrillic', 'latin'], weight: ['300', '400', '500', '700'] })

export const metadata: Metadata = {
  title: theme.instanceName,
  description: 'Kord ERP - Mebers',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cssVars = {
    ['--primary' as any]: theme.primary,
    ['--header-bg' as any]: theme.headerBg,
    ['--header-text' as any]: theme.headerText,
  } as React.CSSProperties
  return (
    <html lang={APP_LOCALE}>
        <body className={roboto.className} style={cssVars}>
          <AppProvider>
            <WebSocketProvider>
              {children}
              <InlineReferenceModal />
              <PereodicsListWindow />
            </WebSocketProvider>
          </AppProvider>
        </body>
    </html>
  )
}

