'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { PHASES } from '@/contexts/SessionContext'
import {
  loadBody, project, drawBody, pick, isVisible, regionFor, toScreen, toModel, fromModel,
  DEFAULT_PITCH, PITCH_MIN, PITCH_MAX,
} from '@/lib/spriteBody'

const TAU = Math.PI * 2
const PAIN = '#C9364F'
const TEAL = '#08665E'
const CREAM = '#FFF9F0'
const ZOOM_MIN = 1
const ZOOM_MAX = 2.4
const DRAG_THRESHOLD = 6

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

function prefersReducedMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

// Keep the body roughly on screen when zoomed in.
function clampPan(view, size) {
  const mx = (view.zoom - 1) * size.w * 0.5 + 24
  const my = (view.zoom - 1) * size.h * 0.5 + 24
  view.panX = clamp(view.panX, -mx, mx)
  view.panY = clamp(view.panY, -my, my)
}

function zoomAbout(body, view, size, nextZoom, px, py) {
  const z = clamp(nextZoom, ZOOM_MIN, ZOOM_MAX)
  const p = project(body, size, view)
  const k = z / view.zoom
  const ox = px - (px - p.ox) * k
  const oy = py - (py - p.oy) * k
  view.zoom = z
  view.panX = ox - size.w / 2 - (p.bx - size.w / 2) * z
  view.panY = oy - size.h / 2 - (p.by - size.h / 2) * z
  if (z <= ZOOM_MIN + 0.001) { view.panX = 0; view.panY = 0 }
  clampPan(view, size)
}

function drawMarker(ctx, pt, visible, t, still, k = 1) {
  ctx.save()
  ctx.translate(pt.x, pt.y)
  ctx.scale(k, k)
  pt = { x: 0, y: 0 }
  if (!visible) {
    // On the far side: a dashed ring so the patient knows it is there.
    ctx.save()
    ctx.setLineDash([3, 3])
    ctx.lineWidth = 1.5
    ctx.strokeStyle = PAIN
    ctx.beginPath(); ctx.arc(pt.x, pt.y, 7, 0, TAU); ctx.stroke()
    ctx.restore()
    ctx.restore()
    return
  }
  ctx.fillStyle = '#fff'
  ctx.beginPath(); ctx.arc(pt.x, pt.y, 12, 0, TAU); ctx.fill()

  if (!still) {
    const ph = (t % 1.6) / 1.6
    ctx.strokeStyle = PAIN
    ctx.lineWidth = 2.5
    ctx.beginPath(); ctx.arc(pt.x, pt.y, 9 + ph * 14, 0, TAU); ctx.stroke()
  }
  ctx.fillStyle = '#fff'
  ctx.beginPath(); ctx.arc(pt.x, pt.y, 8, 0, TAU); ctx.fill()
  ctx.fillStyle = PAIN
  ctx.beginPath(); ctx.arc(pt.x, pt.y, 6, 0, TAU); ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.beginPath(); ctx.arc(pt.x - 2, pt.y - 2, 1.8, 0, TAU); ctx.fill()
  ctx.restore()
}

// Markers shrink with small figures (e.g. the compact chat view).
const markerScale = (p) => clamp(p.s / 3.2, 0.55, 1)

function drawReticle(ctx, x, y, t) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(t * 0.8)
  ctx.strokeStyle = TEAL
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.arc(0, 0, 13, 0, TAU); ctx.stroke()
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2)
    ctx.beginPath(); ctx.moveTo(0, -17); ctx.lineTo(0, -21); ctx.stroke()
  }
  ctx.restore()
  ctx.fillStyle = TEAL
  ctx.beginPath(); ctx.arc(x, y, 2.5, 0, TAU); ctx.fill()
}

function drawVoiceBars(ctx, x, y, t) {
  const colors = ['#F5B928', '#D94A32', '#08665E', '#D94A32', '#F5B928']
  ctx.lineCap = 'round'
  ctx.lineWidth = 4
  for (let i = 0; i < 5; i++) {
    const h = 6 + Math.abs(Math.sin(t * 7 + i * 0.9)) * 14
    const bx = x + (i - 2) * 9
    ctx.strokeStyle = colors[i]
    ctx.beginPath(); ctx.moveTo(bx, y - h / 2); ctx.lineTo(bx, y + h / 2); ctx.stroke()
  }
}

export default function SpriteBody({ phase, painPoints = [], onRegionClick, captureRef, isSpeaking = false }) {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const [body, setBody] = useState(null)
  const [loadError, setLoadError] = useState(false)
  const [attempt, setAttempt] = useState(0)

  // The body's cross-sections are a small binary asset sliced from the 3D model.
  useEffect(() => {
    let alive = true
    loadBody()
      .then((b) => { if (alive) { setBody(b); setLoadError(false) } })
      .catch((err) => {
        console.warn('[SpriteBody] could not load body slices', err)
        if (alive) setLoadError(true)
      })
    return () => { alive = false }
  }, [attempt])

  const clickable = phase === PHASES.PAIN_SELECT
  const autoRotate = phase === PHASES.LANDING

  // Everything the animation loop reads lives in refs.
  const live = useRef({
    view: { yaw: 0, pitch: DEFAULT_PITCH, zoom: 1, panX: 0, panY: 0 },
    size: { w: 1, h: 1, dpr: 1 },
    bodyCanvas: null,
    bodyDirty: true,
    bodyKey: '',
    markerVis: [],
    snap: null, // { yaw } target to ease towards
    velocity: 0,
    lastInteraction: 0,
    hover: null,
    pointers: new Map(),
    drag: null,
    pinch: null,
    reduced: false,
    body: null,
  })
  const props = useRef({ painPoints, onRegionClick, clickable, autoRotate, isSpeaking })
  useLayoutEffect(() => {
    props.current = { painPoints, onRegionClick, clickable, autoRotate, isSpeaking }
  })

  const markDirty = () => { live.current.bodyDirty = true }

  // Face the patient front-on when they start marking pain.
  useEffect(() => {
    const L = live.current
    if (phase === PHASES.PAIN_SELECT || phase === PHASES.INTAKE) {
      const target = Math.round(L.view.yaw / TAU) * TAU
      L.snap = { yaw: target, pitch: DEFAULT_PITCH, zoom: 1 }
      L.velocity = 0
    }
    L.hover = null
    markDirty()
  }, [phase])

  useEffect(() => { markDirty() }, [painPoints])
  useEffect(() => { live.current.body = body; markDirty() }, [body])

  // Capture a front-on picture with markers for the PDF.
  useEffect(() => {
    if (!captureRef) return
    captureRef.current = () => {
      const body = live.current.body
      if (!body) return null
      const w = 540, h = 600, dpr = 2
      const c = document.createElement('canvas')
      c.width = w * dpr; c.height = h * dpr
      const ctx = c.getContext('2d')
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = CREAM
      ctx.fillRect(0, 0, w, h)
      const p = project(body, { w, h }, { yaw: 0, pitch: DEFAULT_PITCH, zoom: 1, panX: 0, panY: 0 })
      drawBody(ctx, body, p, { dpr, height: h })
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      for (const pp of props.current.painPoints) {
        if (!pp.point3D) continue
        const pt = fromModel(body, pp.point3D)
        drawMarker(ctx, toScreen(p, pt), isVisible(body, p, pt), 0, true, markerScale(p))
      }
      return c.toDataURL('image/png')
    }
    return () => { captureRef.current = null }
  }, [captureRef])

  // Size, input and the render loop.
  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    const L = live.current
    L.reduced = prefersReducedMotion()
    L.bodyCanvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    const resize = () => {
      const r = wrap.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      L.size = { w: Math.max(1, r.width), h: Math.max(1, r.height), dpr }
      for (const c of [canvas, L.bodyCanvas]) {
        c.width = Math.round(L.size.w * dpr)
        c.height = Math.round(L.size.h * dpr)
      }
      canvas.style.width = `${L.size.w}px`
      canvas.style.height = `${L.size.h}px`
      clampPan(L.view, L.size)
      L.bodyDirty = true
    }
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    resize()

    const local = (e) => {
      const r = canvas.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }

    const onDown = (e) => {
      try { canvas.setPointerCapture(e.pointerId) } catch { /* pointer already gone */ }
      const pt = local(e)
      L.pointers.set(e.pointerId, pt)
      L.snap = null
      L.velocity = 0
      L.lastInteraction = performance.now()
      if (L.pointers.size === 2) {
        const [a, b] = [...L.pointers.values()]
        L.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: L.view.zoom }
        L.drag = null
      } else {
        L.drag = { start: pt, last: pt, t: performance.now(), moved: false }
      }
    }

    const onMove = (e) => {
      const pt = local(e)
      const now = performance.now()
      if (L.pointers.has(e.pointerId)) L.pointers.set(e.pointerId, pt)

      if (L.pinch && L.pointers.size === 2) {
        const [a, b] = [...L.pointers.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        if (L.body) zoomAbout(L.body, L.view, L.size, L.pinch.zoom * (d / Math.max(1, L.pinch.dist)), (a.x + b.x) / 2, (a.y + b.y) / 2)
        L.bodyDirty = true
        return
      }

      if (L.drag) {
        const dx = pt.x - L.drag.last.x
        const dy = pt.y - L.drag.last.y
        if (!L.drag.moved && Math.hypot(pt.x - L.drag.start.x, pt.y - L.drag.start.y) > DRAG_THRESHOLD) {
          L.drag.moved = true
          L.hover = null
        }
        if (L.drag.moved) {
          L.view.yaw += dx * 0.011
          L.view.pitch = clamp(L.view.pitch + dy * 0.004, PITCH_MIN, PITCH_MAX)
          const dt = Math.max(1, now - L.drag.t)
          L.velocity = (dx * 0.011) / dt * 16
          L.bodyDirty = true
        }
        L.drag.last = pt
        L.drag.t = now
        L.lastInteraction = now
        return
      }

      // Hover feedback while marking.
      if (props.current.clickable && e.pointerType !== 'touch' && L.body) {
        const p = project(L.body, L.size, L.view)
        const hit = pick(L.body, p, pt.x, pt.y)
        const wasHover = Boolean(L.hover)
        L.hover = hit ? pt : null
        if (wasHover !== Boolean(hit)) L.bodyDirty = true
        canvas.style.cursor = hit ? 'pointer' : 'grab'
      } else {
        canvas.style.cursor = 'grab'
      }
    }

    const onUp = (e) => {
      const pt = local(e)
      const drag = L.drag
      L.pointers.delete(e.pointerId)
      if (L.pointers.size < 2) L.pinch = null
      if (L.pointers.size === 1) {
        const [only] = [...L.pointers.values()]
        L.drag = { start: only, last: only, t: performance.now(), moved: true }
        return
      }
      L.drag = null
      L.lastInteraction = performance.now()
      if (drag && !drag.moved && props.current.clickable && L.body) {
        const p = project(L.body, L.size, L.view)
        const hit = pick(L.body, p, pt.x, pt.y)
        if (hit) {
          // Markers are stored in the R3F model's space so both renderers share them.
          props.current.onRegionClick?.(regionFor(L.body, hit), toModel(L.body, hit))
        }
      }
      if (L.reduced) L.velocity = 0
    }

    const onLeave = () => {
      if (L.hover) { L.hover = null; L.bodyDirty = true }
    }

    const onWheel = (e) => {
      e.preventDefault()
      if (!L.body) return
      const pt = local(e)
      zoomAbout(L.body, L.view, L.size, L.view.zoom * Math.exp(-e.deltaY * 0.0015), pt.x, pt.y)
      L.lastInteraction = performance.now()
      L.bodyDirty = true
    }

    const onKey = (e) => {
      const step = 0.35
      if (e.key === 'ArrowLeft') L.snap = { yaw: (L.snap?.yaw ?? L.view.yaw) - step }
      else if (e.key === 'ArrowRight') L.snap = { yaw: (L.snap?.yaw ?? L.view.yaw) + step }
      else if (e.key === 'ArrowUp') L.view.pitch = clamp(L.view.pitch + 0.06, PITCH_MIN, PITCH_MAX)
      else if (e.key === 'ArrowDown') L.view.pitch = clamp(L.view.pitch - 0.06, PITCH_MIN, PITCH_MAX)
      else if ((e.key === '+' || e.key === '=') && L.body) zoomAbout(L.body, L.view, L.size, L.view.zoom * 1.2, L.size.w / 2, L.size.h / 2)
      else if (e.key === '-' && L.body) zoomAbout(L.body, L.view, L.size, L.view.zoom / 1.2, L.size.w / 2, L.size.h / 2)
      else return
      e.preventDefault()
      L.lastInteraction = performance.now()
      L.bodyDirty = true
    }

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)
    canvas.addEventListener('pointerleave', onLeave)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('keydown', onKey)

    let raf = 0
    let prev = performance.now()
    const frame = (now) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.05, (now - prev) / 1000)
      prev = now
      const P = props.current
      const v = L.view
      let moving = false

      // Snap / keyboard easing
      if (L.snap) {
        const k = L.reduced ? 1 : 1 - Math.pow(0.0008, dt)
        v.yaw += (L.snap.yaw - v.yaw) * k
        if (L.snap.pitch != null) v.pitch += (L.snap.pitch - v.pitch) * k
        if (L.snap.zoom != null) {
          v.zoom += (L.snap.zoom - v.zoom) * k
          v.panX *= 1 - k; v.panY *= 1 - k
        }
        if (Math.abs(L.snap.yaw - v.yaw) < 0.002 && (L.snap.zoom == null || Math.abs(v.zoom - L.snap.zoom) < 0.002)) {
          v.yaw = L.snap.yaw
          L.snap = null
        }
        moving = true
      } else if (!L.drag && Math.abs(L.velocity) > 0.0004) {
        v.yaw += L.velocity
        L.velocity *= Math.pow(0.04, dt)
        moving = true
      } else if (P.autoRotate && !L.reduced && !L.drag && now - L.lastInteraction > 2200) {
        v.yaw += dt * 0.45
        moving = true
      }
      if (moving) L.bodyDirty = true

      const body = L.body
      if (!body) return
      const { dpr } = L.size
      const p = project(body, L.size, v)
      const hoverOn = Boolean(L.hover) && P.clickable
      // Coarser slices only while the patient drags, flings or pinches; slow
      // steady motion (auto-rotate, snapping to the front) stays full detail.
      const flinging = !L.snap && !L.drag && Math.abs(L.velocity) > 0.004
      const fast = Boolean(L.drag?.moved) || Boolean(L.pinch) || flinging
      const key = `${hoverOn}|${fast}`
      if (L.bodyDirty || key !== L.bodyKey) {
        const bctx = L.bodyCanvas.getContext('2d')
        bctx.setTransform(1, 0, 0, 1, 0, 0)
        bctx.clearRect(0, 0, L.bodyCanvas.width, L.bodyCanvas.height)
        drawBody(bctx, body, p, { dpr, hover: hoverOn, fast, height: L.size.h })
        L.markerVis = P.painPoints.map((pp) => (pp.point3D ? isVisible(body, p, fromModel(body, pp.point3D)) : false))
        L.bodyKey = key
        L.bodyDirty = false
        L.needsComposite = true
      }

      const animating = P.painPoints.length > 0 || P.isSpeaking || hoverOn
      if (!animating && !L.needsComposite) return
      L.needsComposite = false

      const t = now / 1000
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(L.bodyCanvas, 0, 0)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      P.painPoints.forEach((pp, i) => {
        if (!pp.point3D) return
        drawMarker(ctx, toScreen(p, fromModel(body, pp.point3D)), L.markerVis[i], t, L.reduced, markerScale(p))
      })
      if (hoverOn && !L.drag) drawReticle(ctx, L.hover.x, L.hover.y, L.reduced ? 0 : t)
      if (P.isSpeaking) {
        const crown = toScreen(p, { x: 0, y: body.top, z: 0 })
        drawVoiceBars(ctx, crown.x, Math.max(18, crown.y - 22), t)
      }
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      canvas.removeEventListener('pointerleave', onLeave)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <div ref={wrapRef} className="absolute inset-0">
      {!body && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {loadError ? (
            <button
              type="button"
              onClick={() => setAttempt((n) => n + 1)}
              className="pointer-events-auto rounded-full bg-white px-4 py-2 text-sm font-medium text-ink"
            >
              Couldn’t load the body. Tap to retry
            </button>
          ) : (
            <span aria-label="Loading body" className="size-8 animate-[spin_0.9s_linear_infinite] rounded-full border-[3px] border-teal-soft border-t-teal" />
          )}
        </div>
      )}
      <canvas
        ref={canvasRef}
        tabIndex={0}
        aria-label={clickable
          ? 'Body figure. Click or tap where it hurts. Drag, or use the arrow keys, to turn it.'
          : 'Body figure. Drag, or use the arrow keys, to turn it.'}
        className="block h-full w-full cursor-grab touch-none rounded-3xl outline-none focus-visible:ring-4 focus-visible:ring-teal"
      />
    </div>
  )
}
