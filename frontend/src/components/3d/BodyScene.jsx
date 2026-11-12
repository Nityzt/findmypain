'use client'

import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'
import { Suspense, useRef, useEffect } from 'react'
import HumanBodyModel from './HumanBodyModel'
import { PHASES } from '@/contexts/SessionContext'
import { useVapi } from '@/contexts/VapiContext'

const FRONT_CAMERA = [0, 0, 9]

function SmartOrbitControls({ phase, controlsRef }) {
  const timerRef  = useRef(null)
  const isLanding = phase === PHASES.LANDING
  const camera    = useThree((s) => s.camera)

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return

    controls.autoRotate = isLanding

    // Auto-rotate leaves the body at an arbitrary angle. Face the patient
    // front-on once they start marking pain, so left/right reads naturally.
    if (phase === PHASES.PAIN_SELECT) {
      camera.position.set(...FRONT_CAMERA)
      controls.target.set(0, 0, 0)
      controls.update()
    }

    if (!isLanding) return

    const onStart = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      controls.autoRotate = false
    }
    const onEnd = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        if (controlsRef.current) controlsRef.current.autoRotate = true
      }, 2200)
    }

    controls.addEventListener('start', onStart)
    controls.addEventListener('end',   onEnd)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      controls.removeEventListener('start', onStart)
      controls.removeEventListener('end',   onEnd)
    }
  }, [phase, isLanding, camera, controlsRef])

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      minDistance={5}
      maxDistance={18}
      minPolarAngle={Math.PI / 6}
      maxPolarAngle={Math.PI * 5 / 6}
      autoRotate={isLanding}
      autoRotateSpeed={0.65}
      enableDamping
      dampingFactor={0.06}
      enableZoom
      zoomSpeed={1.2}
      enableRotate={phase !== PHASES.REPORT}
    />
  )
}

// Registers a capture() function that renders one front-on frame and returns
// a cropped PNG data URL for the PDF report.
function CaptureBridge({ captureRef, controlsRef }) {
  const { gl, scene, camera } = useThree()

  useEffect(() => {
    captureRef.current = () => {
      const saved = camera.position.clone()
      camera.position.set(...FRONT_CAMERA)
      camera.lookAt(0, 0, 0)
      gl.render(scene, camera)

      const src = gl.domElement
      const h = src.height
      const w = Math.min(src.width, Math.round(h * 0.9))
      const out = document.createElement('canvas')
      out.width = w
      out.height = h
      const ctx = out.getContext('2d')
      ctx.fillStyle = '#061426'
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(src, (src.width - w) / 2, 0, w, h, 0, 0, w, h)
      const url = out.toDataURL('image/png')

      camera.position.copy(saved)
      controlsRef.current?.update()
      gl.render(scene, camera)
      return url
    }
    return () => { captureRef.current = null }
  }, [gl, scene, camera, captureRef, controlsRef])

  return null
}

export default function BodyScene({ phase, painPoints = [], onRegionClick, captureRef }) {
  const clickable = phase === PHASES.PAIN_SELECT
  // Read isSpeaking here (DOM tree) and pass it as a prop into Canvas
  // — context cannot cross the R3F renderer boundary
  const { isSpeaking } = useVapi()
  const controlsRef = useRef()

  return (
    <Canvas
      camera={{ position: FRONT_CAMERA, fov: 42 }}
      style={{ background: 'transparent' }}
      gl={{ powerPreference: 'high-performance', antialias: true, alpha: true, preserveDrawingBuffer: true }}
      shadows
      onCreated={({ gl }) => {
        gl.domElement.addEventListener('webglcontextlost', (e) => e.preventDefault())
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
        castShadow shadow-mapSize={[1024, 1024]} shadow-camera-far={20}
        shadow-bias={-0.0005} shadow-normalBias={0.04} />
      <directionalLight intensity={1.3} position={[-3, 0.5, -2.5]} color="#0044cc" />
      <pointLight intensity={1.1} position={[0, 0, 6]} color="#00ccff" distance={12} />

      <Environment preset="night" />
      <SmartOrbitControls phase={phase} controlsRef={controlsRef} />
      {captureRef && <CaptureBridge captureRef={captureRef} controlsRef={controlsRef} />}
    </Canvas>
  )
}
