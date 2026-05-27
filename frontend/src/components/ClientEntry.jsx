'use client'

import dynamic from 'next/dynamic'

// Isolate all 3D/VoiceAI/WebGL code to client-side only
const FindMyPain = dynamic(() => import('./FindMyPain'), {
  ssr: false,
  loading: () => (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#040d1a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        border: '2px solid rgba(0,208,255,0.15)',
        borderTop: '2px solid #00d0ff',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }} />
    </div>
  ),
})

export default function ClientEntry() {
  return <FindMyPain />
}
