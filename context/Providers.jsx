'use client'
import { CartProvider } from './CartContext'
import { WishlistProvider } from './WishlistContext'
import { ThemeProvider } from './ThemeContext'
import { SiteSettingsProvider } from './SiteSettingsContext'
import { UserAuthProvider } from './UserAuthContext'

export default function Providers({ children }) {
  return (
    <ThemeProvider>
      <SiteSettingsProvider>
        <UserAuthProvider>
          <CartProvider>
            <WishlistProvider>
              {children}
            </WishlistProvider>
          </CartProvider>
        </UserAuthProvider>
      </SiteSettingsProvider>
    </ThemeProvider>
  )
}
