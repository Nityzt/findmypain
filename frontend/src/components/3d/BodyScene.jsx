'use client'

import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'
import { Suspense, useRef, useEffect } from 'react'
import * as THREE from 'three'
import HumanBodyModel from './HumanBodyModel'
import { PHASES } from '@/contexts/SessionContext'
import { useVapi } from '@/contexts/VapiContext'

function SmartOrbitControls({ phase }) {
  const controlsRef = useRef()
  const timerRef    = useRef(null)
  const isLanding   = phase === PHASES.LANDING

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return

    // Disable auto-rotate immediately when leaving landing
    controls.autoRotate = isLanding

    if (!isLanding) return

    const onStart = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      controls.autoRotate = false
    }
    const onEnd = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        if (controlsRef.current && phase === PHASES.LANDING)
          controlsRef.current.autoRotate = true
      }, 2200)
    }

    controls.addEventListener('start', onStart)
    controls.addEventListener('end',   onEnd)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      controls.removeEventListener('start', onStart)
      controls.removeEventListener('end',   onEnd)
    }
  }, [phase, isLanding])

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      minDistance={3}
      maxDistance={9}
      minPolarAngle={Math.PI / 6}
      maxPolarAngle={Math.PI * 5 / 6}
      autoRotate={isLanding}
      autoRotateSpeed={0.65}
      enableDamping
      dampingFactor={0.04}
      enableRotate={phase !== PHASES.REPORT}
    />
  )
}

export default function BodyScene({ phase, painPoints = [], onRegionClick, onCreated }) {
  const clickable = phase === PHASES.PAIN_SELECT
  // Read isSpeaking here (DOM tree) and pass it as a prop into Canvas
  // — context cannot cross the R3F renderer boundary
  const { isSpeaking } = useVapi()

  return (
    <Canvas
      camera={{ position: [0, 0, 5.5], fov: 50 }}
      style={{ background: 'transparent' }}
      gl={{ powerPreference: 'high-performance', antialias: true, alpha: true }}
      shadows
      onCreated={({ gl, ...rest }) => {
        gl.domElement.addEventListener('webglcontextlost', (e) => e.preventDefault())
        onCreated?.({ gl, ...rest })
      }}
    >
      <Suspense fallback={null}>
        <HumanBodyModel
          onRegionClick={onRegionClick}
          painPoints={painPoints}
          clickable={clickable}
          isSpeaking={isSpeaking}
        />
      </Suspense>

      <ambientLight intensity={0.15} color="#001832" />
      <directionalLight intensity={2.2} position={[2, 5, 4]} color="#c8e8ff"
        castShadow shadow-mapSize={[1024, 1024]} shadow-camera-far={20} />
      <directionalLight intensity={1.3} position={[-3, 0.5, -2.5]} color="#0044cc" />
      <pointLight intensity={1.1} position={[0, 0, 6]} color="#00ccff" distance={12} />

      <Environment preset="night" />
      <SmartOrbitControls phase={phase} />
    </Canvas>
  )
}
