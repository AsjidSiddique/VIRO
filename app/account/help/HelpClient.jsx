'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import AccountShell from '../../../components/AccountShell'
import { useSite } from '../../../context/SiteSettingsContext'

const FAQS = [
  { q:'How long does delivery take?',           a:'Burewala: 1-2 days. Other cities: 3-5 working days. Remote areas may take longer.' },
  { q:'Can I cancel my order?',                  a:'Yes! You can cancel before the order is shipped. Contact us on WhatsApp with your order number.' },
  { q:'What is your return policy?',             a:'We accept returns within 7 days of delivery for defective or wrong items. Contact us with photos.' },
  { q:'Do you offer Cash on Delivery?',          a:'Yes, all orders are COD. No payment required until your order arrives at your door.' },
  { q:'How do I track my order?',                a:'Sign in with Google on the Orders page to see live status. Or call/WhatsApp us with your order number.' },
  { q:'Can I change my delivery address?',       a:'Yes, contact us before the order is shipped and we will update it for you.' },
  { q:'What if I receive a damaged product?',    a:'Take a photo immediately and contact us on WhatsApp. We will replace or refund within 48 hours.' },
  { q:'Do you ship to all cities in Pakistan?',  a:'Yes! We ship nationwide. Free delivery available on qualifying orders in Burewala and other cities.' },
]

export default function HelpClient() {
  const { contact } = useSite()
  const [openFaq, setOpenFaq] = useState(null)

  const waLink = (msg) => `https://wa.me/92${(contact?.whatsapp||'03290081469').replace(/^0/,'')}?text=${encodeURIComponent(msg)}`

  return (
    <AccountShell title="Help & Support">
      <div style={{ padding:'14px' }}>

        {/* Contact buttons */}
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:20 }}>
          <a href={waLink('Hi! I need help with my Viro.pk order.')} target="_blank" rel="noopener"
            style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:8,padding:'18px 12px',borderRadius:16,background:'#25D36615',border:'1.5px solid #25D36630',textDecoration:'none' }}>
            <span style={{ fontSize:32 }}>💬</span>
            <span style={{ fontSize:13,fontWeight:800,color:'#25D366' }}>WhatsApp</span>
            <span style={{ fontSize:11,color:'var(--viro-textSub)',textAlign:'center' }}>Fastest response</span>
          </a>
          <a href={`tel:${contact?.phone||'03290081469'}`}
            style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:8,padding:'18px 12px',borderRadius:16,background:'#00BFFF15',border:'1.5px solid #00BFFF30',textDecoration:'none' }}>
            <span style={{ fontSize:32 }}>📞</span>
            <span style={{ fontSize:13,fontWeight:800,color:'#00BFFF' }}>Call Us</span>
            <span style={{ fontSize:11,color:'var(--viro-textSub)',textAlign:'center' }}>9am – 9pm daily</span>
          </a>
        </div>

        {/* Quick help topics */}
        <p style={{ fontSize:13,fontWeight:800,color:'var(--viro-text)',marginBottom:10,textTransform:'uppercase',letterSpacing:'0.05em' }}>Quick Help</p>
        <div style={{ display:'flex',flexDirection:'column',gap:6,marginBottom:20 }}>
          {[
            { icon:'📦', label:'Track my order',     msg:'Hi! I want to track my order.' },
            { icon:'❌', label:'Cancel my order',     msg:'Hi! I want to cancel my order.' },
            { icon:'↩️', label:'Return a product',    msg:'Hi! I want to return a product.' },
            { icon:'💰', label:'Refund status',       msg:'Hi! I want to check my refund status.' },
            { icon:'🔄', label:'Wrong item received', msg:'Hi! I received the wrong item.' },
            { icon:'📍', label:'Change address',      msg:'Hi! I want to change my delivery address.' },
          ].map(h => (
            <a key={h.label} href={waLink(h.msg)} target="_blank" rel="noopener"
              style={{ display:'flex',alignItems:'center',gap:12,padding:'12px 16px',borderRadius:14,background:'var(--viro-bgCard)',border:'1px solid var(--viro-border)',textDecoration:'none' }}
              onMouseEnter={e=>e.currentTarget.style.background='var(--viro-bgDeep)'}
              onMouseLeave={e=>e.currentTarget.style.background='var(--viro-bgCard)'}>
              <span style={{ fontSize:22,flexShrink:0 }}>{h.icon}</span>
              <span style={{ fontSize:14,fontWeight:700,color:'var(--viro-text)',flex:1 }}>{h.label}</span>
              <span style={{ fontSize:16,color:'#25D366' }}>›</span>
            </a>
          ))}
        </div>

        {/* FAQ */}
        <p style={{ fontSize:13,fontWeight:800,color:'var(--viro-text)',marginBottom:10,textTransform:'uppercase',letterSpacing:'0.05em' }}>FAQs</p>
        <div style={{ display:'flex',flexDirection:'column',gap:6,marginBottom:20 }}>
          {FAQS.map((faq,i) => (
            <div key={i} style={{ borderRadius:14,border:'1px solid var(--viro-border)',background:'var(--viro-bgCard)',overflow:'hidden' }}>
              <button onClick={()=>setOpenFaq(openFaq===i?null:i)}
                style={{ width:'100%',display:'flex',alignItems:'center',gap:12,padding:'13px 16px',background:'transparent',border:'none',cursor:'pointer',textAlign:'left' }}>
                <span style={{ fontSize:14,fontWeight:700,color:'var(--viro-text)',flex:1 }}>{faq.q}</span>
                <span style={{ fontSize:18,color:'var(--viro-textSub)',transition:'transform 0.2s',transform:openFaq===i?'rotate(180deg)':'none' }}>▾</span>
              </button>
              {openFaq===i && (
                <div style={{ padding:'0 16px 14px',fontSize:13,color:'var(--viro-textSub)',lineHeight:1.6,borderTop:'1px solid var(--viro-border)' }}>
                  <p style={{ margin:'10px 0 0' }}>{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Policy links */}
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8 }}>
          {[
            { href:'/return-policy', icon:'↩️', label:'Return Policy' },
            { href:'/privacy-policy',icon:'🔒', label:'Privacy Policy' },
            { href:'/terms',         icon:'📋', label:'Terms of Use'  },
            { href:'/about',         icon:'ℹ️',  label:'About Viro'   },
          ].map(p => (
            <Link key={p.href} href={p.href} style={{ display:'flex',alignItems:'center',gap:10,padding:'12px 14px',borderRadius:14,background:'var(--viro-bgCard)',border:'1px solid var(--viro-border)',textDecoration:'none' }}>
              <span style={{ fontSize:18 }}>{p.icon}</span>
              <span style={{ fontSize:13,fontWeight:700,color:'var(--viro-text)' }}>{p.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </AccountShell>
  )
}
