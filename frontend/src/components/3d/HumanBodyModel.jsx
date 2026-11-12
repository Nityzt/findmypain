'use client'

import React, { useState, useMemo, useRef } from 'react'
import { useGLTF, Center, Billboard } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
// NOTE: do NOT call useVapi() here — HumanBodyModel runs inside R3F's Canvas
// which has its own React renderer and cannot read DOM-tree React context.
// isSpeaking is passed as a plain prop from BodyScene instead.

// Maps a world-space hit point to an anatomical region. Thresholds come from
// slicing the centred model (scale 2.113): it is ~4.47 units tall, from
// y=-2.23 (soles) to y=+2.23 (crown), faces +z, and stands in an A-pose with
// the arms leaving the torso at |x|≈0.5 between y≈0.3 and y≈1.1.
// The model faces the viewer, so the patient's right side is at -x.
// Front/back split plane (z) per height band: the lower legs sit further back.
function frontBackMidline(y) {
  if (y > 1.7) return -0.04
  if (y > 1.1) return -0.1
  if (y > -0.9) return -0.03
  if (y > -1.9) return -0.14
  return -0.2 // feet: almost everything is the top of the foot
}

export function getBodyRegion({ x, y, z }) {
  const ax = Math.abs(x)
  const side = x < 0 ? 'Right' : 'Left'
  const front = z > frontBackMidline(y)

  if (y > 1.80) return front ? 'Head / Face' : 'Back of Head'
  if (y > 1.62) return front ? 'Neck' : 'Back of Neck'

  // Arms: anything well outside the torso width above the hips.
  if (y > 0.25 && y <= 1.2 && ax > 0.5) {
    if (ax > 1.5) return `${side} Hand / Wrist`
    if (ax > 1.22) return `${side} Forearm`
    if (ax > 0.98) return `${side} Elbow`
    return `${side} Upper Arm`
  }
  if (y > 1.12 && ax > 0.32) return `${side} Shoulder`

  // Torso
  const torsoSide = ax > 0.12 ? `${side} ` : ''
  if (y > 0.75) return front ? `${torsoSide}Chest` : `${torsoSide}Upper Back`
  if (y > 0.45) return front ? `${torsoSide}Upper Abdomen` : `${torsoSide}Mid Back`
  if (y > -0.12) {
    if (ax > 0.33) return `${side} Hip`
    return front ? `${torsoSide}Lower Abdomen` : `${torsoSide}Lower Back`
  }
  if (y > -0.42) {
    if (ax > 0.33) return `${side} Hip`
    return front ? `${side} Groin` : `${side} Buttock`
  }

  // Legs
  if (y > -0.95) return front ? `${side} Thigh` : `${side} Back of Thigh`
  if (y > -1.35) return front ? `${side} Knee` : `${side} Back of Knee`
  if (y > -1.85) return front ? `${side} Shin` : `${side} Calf`
  return `${side} Ankle / Foot`
}

// ── Grid reticle cursor ────────────────────────────────────────────────────
function GridCursor({ positionRef, visible }) {
  const groupRef  = useRef()
  const planeRef  = useRef()
  const matRef    = useRef()

  const texture = useMemo(() => {
    const S = 256, cx = 128, cy = 128, R = 116
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = S
    const c = canvas.getContext('2d')
    c.save()
    c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.clip()
    c.strokeStyle = 'rgba(0,215,255,0.35)'; c.lineWidth = 0.9
    for (let i = 0; i <= S; i += S / 9) {
      c.beginPath(); c.moveTo(i, 0); c.lineTo(i, S); c.stroke()
      c.beginPath(); c.moveTo(0, i); c.lineTo(S, i); c.stroke()
    }
    c.restore()
    ;[[R, 0.9, 1.5], [R * 0.62, 0.65, 1.0], [R * 0.3, 0.65, 1.0]].forEach(([r, a, lw]) => {
      c.strokeStyle = `rgba(0,228,255,${a})`; c.lineWidth = lw
      c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke()
    })
    c.strokeStyle = 'rgba(0,255,255,1)'; c.lineWidth = 1.5
    const g = 10, arm = 30
    c.beginPath(); c.moveTo(cx, cy-g);     c.lineTo(cx, cy-g-arm); c.stroke()
    c.beginPath(); c.moveTo(cx, cy+g);     c.lineTo(cx, cy+g+arm); c.stroke()
    c.beginPath(); c.moveTo(cx-g, cy);     c.lineTo(cx-g-arm, cy); c.stroke()
    c.beginPath(); c.moveTo(cx+g, cy);     c.lineTo(cx+g+arm, cy); c.stroke()
    c.strokeStyle = 'rgba(0,255,255,0.85)'; c.lineWidth = 1.5
    const bR = R * 0.62 * 0.82, bL = 15
    ;[[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([sx, sy]) => {
      const bx = cx + sx * bR * 0.72, by = cy + sy * bR * 0.72
      c.beginPath(); c.moveTo(bx + sx*bL, by); c.lineTo(bx, by); c.lineTo(bx, by + sy*bL); c.stroke()
    })
    c.fillStyle = 'rgba(0,255,255,1)'
    c.beginPath(); c.arc(cx, cy, 3, 0, Math.PI * 2); c.fill()
    return new THREE.CanvasTexture(canvas)
  }, [])

  useFrame(({ clock }, delta) => {
    if (!visible) return
    if (groupRef.current && positionRef.current)
      groupRef.current.position.copy(positionRef.current)
    if (planeRef.current) planeRef.current.rotation.z += delta * 0.42
    if (matRef.current)
      matRef.current.opacity = 0.5 + Math.sin(clock.elapsedTime * 5) * 0.22
  })

  if (!visible) return null
  return (
    <group ref={groupRef}>
      <Billboard>
        <mesh ref={planeRef}>
          <planeGeometry args={[0.44, 0.44]} />
          <meshBasicMaterial ref={matRef} map={texture} transparent opacity={0.7}
            depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} />
        </mesh>
      </Billboard>
    </group>
  )
}

// ── Pain indicator: pulsing core + rings + targeting brackets ──────────────
function PainIndicator({ position }) {
  const coreRef    = useRef()
  const bracketRef = useRef()
  const ringRefs   = useRef([null, null, null])

  const ringMaterials = useMemo(
    () => [0, 1, 2].map(() => new THREE.MeshBasicMaterial({
      color: new THREE.Color('#ff3300'),
      transparent: true, opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false, depthTest: false,
      blending: THREE.AdditiveBlending,
    })), []
  )

  const glowInnerMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: new THREE.Color('#ff3300'), transparent: true, opacity: 0.28,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }), [])

  const glowOuterMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: new THREE.Color('#ff1100'), transparent: true, opacity: 0.09,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }), [])

  const bracketTex = useMemo(() => {
    const S = 128
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = S
    const c = canvas.getContext('2d')
    c.strokeStyle = 'rgba(255,90,0,0.92)'; c.lineWidth = 2
    const m = 18, l = 22
    c.beginPath(); c.moveTo(m+l, m);     c.lineTo(m,   m);   c.lineTo(m,   m+l);   c.stroke()
    c.beginPath(); c.moveTo(S-m-l, m);   c.lineTo(S-m, m);   c.lineTo(S-m, m+l);   c.stroke()
    c.beginPath(); c.moveTo(m+l, S-m);   c.lineTo(m,   S-m); c.lineTo(m,   S-m-l); c.stroke()
    c.beginPath(); c.moveTo(S-m-l, S-m); c.lineTo(S-m, S-m); c.lineTo(S-m, S-m-l); c.stroke()
    c.strokeStyle = 'rgba(255,140,0,0.6)'; c.lineWidth = 1
    const mid = S/2, tk = 8
    c.beginPath(); c.moveTo(mid-tk, m);   c.lineTo(mid+tk, m);   c.stroke()
    c.beginPath(); c.moveTo(mid-tk, S-m); c.lineTo(mid+tk, S-m); c.stroke()
    c.beginPath(); c.moveTo(m,   mid-tk); c.lineTo(m,   mid+tk); c.stroke()
    c.beginPath(); c.moveTo(S-m, mid-tk); c.lineTo(S-m, mid+tk); c.stroke()
    return new THREE.CanvasTexture(canvas)
  }, [])

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime
    if (coreRef.current)
      coreRef.current.scale.setScalar(1 + Math.sin(t * Math.PI * 2.5) * 0.22)
    if (bracketRef.current)
      bracketRef.current.rotation.z += delta * 0.55
    glowInnerMat.opacity = 0.18 + Math.sin(t * Math.PI * 2.5) * 0.13
    const SPEED = 1.25
    ringMaterials.forEach((mat, i) => {
      const phase = ((t * SPEED) + i / 3) % 1
      const r = ringRefs.current[i]
      if (r) r.scale.setScalar(0.03 + phase * 0.32)
      mat.opacity = Math.pow(1 - phase, 2) * 0.88
    })
  })

  return (
    <group position={position}>
      <mesh material={glowOuterMat}><sphereGeometry args={[0.17, 16, 16]} /></mesh>
      <mesh material={glowInnerMat}><sphereGeometry args={[0.085, 16, 16]} /></mesh>
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.038, 16, 16]} />
        <meshStandardMaterial color="#ff1100" emissive="#ff4400"
          emissiveIntensity={5.0} roughness={0} metalness={0} toneMapped={false} />
      </mesh>
      <Billboard>
        <mesh ref={bracketRef}>
          <planeGeometry args={[0.24, 0.24]} />
          <meshBasicMaterial map={bracketTex} transparent opacity={0.88}
            depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} />
        </mesh>
        {ringMaterials.map((mat, i) => (
          <mesh key={i} ref={el => { ringRefs.current[i] = el }} material={mat}>
            <ringGeometry args={[0.82, 1.0, 56]} />
          </mesh>
        ))}
      </Billboard>
    </group>
  )
}

// ── Voice visualizer: 5-bar waveform near chest while AI is speaking ──────
function VoiceVisualizer({ isSpeaking }) {
  const barsRef = useRef([])
  const BAR_COUNT = 5

  useFrame(({ clock }) => {
    if (!isSpeaking) {
      barsRef.current.forEach((bar) => {
        if (bar) bar.scale.y += (0.15 - bar.scale.y) * 0.1
      })
      return
    }
    const t = clock.elapsedTime
    barsRef.current.forEach((bar, i) => {
      if (!bar) return
      const freq = 3.5 + i * 1.2
      const offset = (i / BAR_COUNT) * Math.PI * 2
      const target = 0.3 + Math.abs(Math.sin(t * freq + offset)) * 0.85
      bar.scale.y += (target - bar.scale.y) * 0.25
    })
  })

  return (
    <Billboard position={[0, 2.55, 0]}>
      <group>
        {Array.from({ length: BAR_COUNT }).map((_, i) => {
          const x = (i - (BAR_COUNT - 1) / 2) * 0.055
          return (
            <mesh key={i} ref={el => { barsRef.current[i] = el }} position={[x, 0, 0]}>
              <planeGeometry args={[0.03, 0.18]} />
              <meshBasicMaterial
                color="#00d0ff"
                transparent
                opacity={isSpeaking ? 0.85 : 0}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
              />
            </mesh>
          )
        })}
      </group>
    </Billboard>
  )
}

// ── Main body component ────────────────────────────────────────────────────
export default function HumanBodyModel({ onRegionClick, painPoints = [], clickable = true, isSpeaking = false }) {
  const { nodes, materials } = useGLTF('/human_body.glb')
  const [hovered, setHovered]   = useState(false)
  const hoveredRef               = useRef(false)
  const hoverPointRef            = useRef(new THREE.Vector3())
  const pointerDownPos           = useRef(null)

  const bodyMat = useMemo(() => {
    const mat = materials['Material.001'].clone()
    mat.color             = new THREE.Color(0x00aadd)
    mat.emissive          = new THREE.Color(0x003355)
    mat.emissiveIntensity = 0.55
    mat.roughness         = 0.22
    mat.metalness         = 0.08
    mat.transparent       = true
    mat.opacity           = 0.88
    return mat
  }, [materials])

  const rimMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: new THREE.Color('#00eeff'),
    transparent: true, opacity: 0.12,
    side: THREE.BackSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const h = hoveredRef.current
    const flicker = Math.pow(Math.max(0, Math.sin(t * 11.3)), 10) * 0.12
    const speakPulse = isSpeaking ? Math.sin(t * 8) * 0.1 : 0
    const base = h ? 0.9 : (0.45 + Math.sin(t * Math.PI * 0.7) * 0.15 + flicker + speakPulse)
    bodyMat.emissiveIntensity += (base - bodyMat.emissiveIntensity) * 0.08
    const rimTarget = h ? 0.28 : (isSpeaking ? 0.22 : 0.08) + Math.sin(t * Math.PI * 0.7 + 0.4) * 0.05
    rimMat.opacity += (rimTarget - rimMat.opacity) * 0.08
  })

  const handlePointerMove = (e) => {
    e.stopPropagation()
    hoverPointRef.current.copy(e.point)
  }

  const handlePointerDown = (e) => {
    pointerDownPos.current = { x: e.clientX, y: e.clientY }
  }

  const handleClick = (e) => {
    if (!clickable) return
    if (pointerDownPos.current) {
      const dx = e.clientX - pointerDownPos.current.x
      const dy = e.clientY - pointerDownPos.current.y
      if (Math.sqrt(dx * dx + dy * dy) > 6) return
    }
    e.stopPropagation()
    onRegionClick?.(getBodyRegion(e.point), e.point.clone())
  }

  return (
    <group dispose={null}>
      <Center>
        <mesh geometry={nodes.Object_4.geometry} material={rimMat}
          rotation={[Math.PI / 2, 0, 0]} scale={2.113 * 1.007} />
        <mesh
          castShadow receiveShadow
          geometry={nodes.Object_4.geometry}
          material={bodyMat}
          rotation={[Math.PI / 2, 0, 0]}
          scale={2.113}
          onClick={handleClick}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerOver={(e) => { e.stopPropagation(); setHovered(true);  hoveredRef.current = true  }}
          onPointerOut={()   => {                      setHovered(false); hoveredRef.current = false }}
        />
      </Center>

      {/* Voice waveform visualizer, floating above the head (world coords) */}
      <VoiceVisualizer isSpeaking={isSpeaking} />

      <GridCursor positionRef={hoverPointRef} visible={hovered && clickable} />

      {/* Render all pain point indicators */}
      {painPoints.map((p) =>
        p.point3D ? (
          <PainIndicator key={p.region} position={[p.point3D.x, p.point3D.y, p.point3D.z]} />
        ) : null
      )}

      {/* Red light at first pain point */}
      {painPoints[0]?.point3D && (
        <pointLight
          position={[painPoints[0].point3D.x, painPoints[0].point3D.y, painPoints[0].point3D.z]}
          intensity={4.0} distance={1.6} decay={2} color="#ff2200"
        />
      )}
    </group>
  )
}

useGLTF.preload('/human_body.glb')
