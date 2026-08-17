'use client'
import React from 'react'
import Image from 'next/image'
import { getThumb } from '../context/CartContext'
import { useImageFallback } from '../lib/useImageFallback'

const BLUR_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

export default function ProductImage({
  images,
  alt = 'Product',
  className = '',
  style = {},
  width = 200,
  height = 200,
  fill = false,
  sizes = '(max-width: 640px) 96px, (max-width: 1024px) 128px, 200px',
  priority = false,
  quality = 75,
}) {
  const thumb = getThumb(images, '')
  const { src, unoptimized, failed, handleError } = useImageFallback(thumb, { width, quality })

  const commonProps = {
    alt,
    className,
    placeholder: 'blur',
    blurDataURL: BLUR_DATA_URL,
    quality,
    priority,
    sizes,
  }

  if (!thumb || failed) {
    return (
      <div className={className} style={{
        ...style,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--viro-bgDeep, #1e293b)',
        width: fill ? '100%' : width,
        height: fill ? '100%' : height,
        position: fill ? 'absolute' : 'relative',
        inset: fill ? 0 : undefined,
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" opacity="0.25">
          <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5"/>
          <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
          <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      fill={fill}
      style={style}
      onError={handleError}
      unoptimized={unoptimized}
      {...commonProps}
    />
  )
}
