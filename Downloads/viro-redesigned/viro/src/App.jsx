import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { CartProvider } from './context/CartContext'
import TopBar from './components/TopBar'
import Navbar from './components/Navbar'
import WhatsAppButton from './components/WhatsAppButton'
import Footer from './components/Footer'
import Home from './pages/Home'
import Shop from './pages/Shop'
import ProductDetail from './pages/ProductDetail'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import Admin from './pages/Admin'

export default function App() {
  return (
    <CartProvider>
      <div className="min-h-screen" style={{ background: '#0F172A' }}>
        <TopBar />
        <Navbar />
        <main className="md:ml-20 min-h-screen">
          <Routes>
            <Route path="/"           element={<Home />} />
            <Route path="/shop"       element={<Shop />} />
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="/cart"       element={<Cart />} />
            <Route path="/checkout"   element={<Checkout />} />
            <Route path="/admin"      element={<Admin />} />
          </Routes>
          <Footer />
        </main>
        <WhatsAppButton />
      </div>
    </CartProvider>
  )
}
