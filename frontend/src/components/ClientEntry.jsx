'use client'

import dynamic from 'next/dynamic'

// Isolate all canvas/VoiceAI code to client-side only
const FindMyPain = dynamic(() => import('./FindMyPain'), {
  ssr: false,
  loading: () => (
    <div className="flex h-dvh w-full items-center justify-center bg-cream">
      <span className="size-10 animate-[spin_0.9s_linear_infinite] rounded-full border-[3px] border-teal-soft border-t-teal" />
    </div>
  ),
})

export default function ClientEntry() {
  return <FindMyPain />
}
