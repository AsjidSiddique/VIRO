'use client'
import Image from 'next/image'
import React from 'react'
import { useSite } from '../context/SiteSettingsContext'
import { SOCIAL_LINKS } from './socialLinks'

const LOGO_URL = '/logo.jpg'


export default function Footer() {
  const { contact, deliveryRules } = useSite()
  return (
    <footer className="mt-12 pb-24 md:pb-0 border-t"
      style={{ borderColor:'var(--viro-border)', background:'var(--viro-bgDeep)', transition:'background 0.35s,border-color 0.35s' }}>
      <div className="max-w-6xl mx-auto px-5 pt-10">


        {/* Main grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">

          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-3 mb-3">
              <Image src={LOGO_URL || '/icon-192.png'} alt="Viro" width={48} height={48} className="w-12 h-12 rounded-xl object-cover" style={{objectFit:'cover', background:'white'}} />
              <div>
                <p className="font-extrabold text-base" style={{color:'var(--viro-text)'}}>Viro</p>
                <p className="text-xs" style={{color:'var(--viro-textSub)'}}>viro.pk</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed" style={{color:'var(--viro-textMuted)'}}>
              Smart Shopping, Better Living.
            </p>
            <p className="text-xs mt-1" style={{color:'var(--viro-textSub)'}}>
              Your trusted online store in Punjab, Pakistan.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-sm font-bold mb-4" style={{color:'var(--viro-text)'}}>Quick Links</h4>
            <ul className="space-y-2.5">
              {[['🏠','Home','/'],['🛍️','Shop','/shop'],['🛒','Cart','/cart'],['📋','Orders','/orders'],['ℹ️','About','/about']].map(([icon,label,path]) => (
                <li key={path}>
                  <a href={path} className="text-sm flex items-center gap-2 hover:text-purple-400 transition-colors"
                    style={{color:'var(--viro-textMuted)'}}>
                    <span>{icon}</span>{label}
                  </a>
                </li>
              ))}
            </ul>

            {/* Policy links */}
            <h4 className="text-sm font-bold mt-6 mb-3" style={{color:'var(--viro-text)'}}>Policies</h4>
            <ul className="space-y-2">
              {[['📦','Return Policy','/return-policy'],['🔒','Privacy Policy','/privacy-policy'],['📋','Terms','/terms']].map(([icon,label,path]) => (
                <li key={path}>
                  <a href={path} className="text-xs flex items-center gap-1.5 hover:text-orange-400 transition-colors"
                    style={{color:'var(--viro-textSub)'}}>
                    <span>{icon}</span>{label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-sm font-bold mb-4" style={{color:'var(--viro-text)'}}>Contact Us</h4>
            <ul className="space-y-2.5">
              <li>
                <a href={`tel:${contact.phone}`} className="text-sm flex items-center gap-2 hover:text-blue-400 transition-colors"
                  style={{color:'var(--viro-textMuted)'}}>
                  <span className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{background:'#00BFFF15',border:'1px solid #00BFFF30'}}>📞</span>
                  {contact.phone}
                </a>
              </li>
              <li>
                <a href={`mailto:${contact.email}`} className="text-sm flex items-center gap-2 hover:text-purple-400 transition-colors"
                  style={{color:'var(--viro-textMuted)'}}>
                  <span className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{background:'#8B5CF615',border:'1px solid #8B5CF630'}}>✉️</span>
                  {contact.email}
                </a>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{background:'var(--viro-bgCard)',border:'1px solid var(--viro-border)'}}>📍</span>
                <span className="text-sm" style={{color:'var(--viro-textSub)'}}>{contact.address}</span>
              </li>
              <li>
                <a href="https://viro.pk" target="_blank" rel="noopener" className="text-sm flex items-center gap-2 hover:text-orange-400 transition-colors"
                  style={{color:'var(--viro-textMuted)'}}>
                  <span className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{background:'#F9731615',border:'1px solid #F9731630'}}>🌐</span>
                  viro.pk
                </a>
              </li>
            </ul>
          </div>

          {/* Delivery */}
          <div>
            <h4 className="text-sm font-bold mb-4" style={{color:'var(--viro-text)'}}>Delivery Cities</h4>
            <div className="space-y-2">
              {(deliveryRules || [{label:'Burewala',freeThreshold:550,charge:150},{label:'Other Cities',freeThreshold:2500,charge:150}]).map((r,i) => {
                const color = i === 0 ? '#00BFFF' : '#8B5CF6'
                return (
                  <div key={r.label} className="flex items-center gap-2 p-2 rounded-lg"
                    style={{background:color+'10',border:`1px solid ${color}30`}}>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{background:color}}/>
                    <span className="text-xs font-semibold" style={{color:'var(--viro-text)'}}>{r.label}</span>
                    <span className="text-xs ml-auto font-bold" style={{color}}>Free ≥ Rs.{r.freeThreshold}</span>
                  </div>
                )
              })}
              <p className="text-xs" style={{color:'var(--viro-textSub)'}}>
                Otherwise Rs.{(deliveryRules?.find(r => r.cities?.includes('*'))?.charge ?? deliveryRules?.[0]?.charge ?? 150)} charge
              </p>
            </div>
          </div>
        </div>

        {/* Social row */}
        <div className="border-t border-b py-6 mb-6" style={{borderColor:'var(--viro-border)'}}>
          <p className="text-xs font-bold uppercase tracking-widest text-center mb-4" style={{color:'var(--viro-textSub)'}}>
            Follow Us For Updates
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {SOCIAL_LINKS.map(s => {
              const href   = s.name === 'WhatsApp' ? `https://wa.me/${contact.whatsapp}` : s.href
              const handle = s.name === 'WhatsApp' ? (contact.phone || contact.whatsapp) : s.handle
              return (
                <a key={s.name} href={href} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl transition-all hover:scale-105 active:scale-95"
                  style={{background:'var(--viro-bgCard)',border:'1px solid var(--viro-border)'}}>
                  <span className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-white" style={{background:s.gradient}}>
                    {s.icon}
                  </span>
                  <div>
                    <p className="text-xs font-bold leading-tight" style={{color:'var(--viro-text)'}}>{s.name}</p>
                    <p className="text-xs leading-tight" style={{color:s.color}}>{handle}</p>
                  </div>
                </a>
              )
            })}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="text-center pb-8">
          <p className="font-display font-bold tracking-widest text-sm gradient-text mb-1">
            VIRO — VALUE | VARIETY | VISION
          </p>
          <p className="text-xs" style={{color:'var(--viro-textSub)'}}>
            {`© ${new Date().getFullYear()} Viro. All rights reserved. · viro.pk · ${contact?.address || 'Mandi Burewala, Punjab, Pakistan'}`}
          </p>
        </div>
      </div>
    </footer>
  )
}
