'use client'
import React from 'react'
import { DEFAULT_CONTACT } from '../context/SiteSettingsContext'

export default class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) { console.error('Viro ErrorBoundary:', error, info) }
  render() {
    if (this.state.error) return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: 32,
        textAlign: 'center', background: 'var(--viro-bg)', color: 'var(--viro-text)'
      }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>😕</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Something went wrong</h2>
        <p style={{ color: '#94A3B8', fontSize: 14, marginBottom: 28, maxWidth: 340 }}>
          We hit an unexpected error. Please tap below to go back to the homepage.
        </p>
        <button
          onClick={() => { this.setState({ error: null }); window.location.href = '/' }}
          style={{
            padding: '12px 32px', borderRadius: 14, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg,#00BFFF,#8B5CF6,#F97316)',
            color: '#fff', fontWeight: 700, fontSize: 15
          }}>
          🏠 Go to Homepage
        </button>
        <a href={`https://wa.me/${DEFAULT_CONTACT.whatsapp}`} style={{ marginTop: 16, color: '#10B981', fontSize: 13 }}>
          💬 Contact Support on WhatsApp
        </a>
      </div>
    )
    return this.props.children
  }
}
