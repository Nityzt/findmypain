// Sprite-stacked human body built from the real 3D model.
//
// scripts/build-body-slices.mjs cuts public/human_body.glb into ~700
// horizontal cross-sections (public/body/slices.bin). Each slice is a set of
// closed contour loops, and every loop vertex carries the mesh's surface
// normal. Here each loop becomes a cached Path2D plus a cached conic gradient
// whose colour stops come from those normals, so the stacked slices carry the
// model's full surface definition (muscles, face, hands) while a frame is only
// a transform and a fill per loop.
//
// Sprite space is centimetre-ish: y = 0 at the soles, `top` at the crown, the
// figure faces +z, +x is the patient's LEFT. Points handed to the rest of the
// app (markers, regions) are converted to the R3F scene's world space, so the
// sprite body and the 3D model share pain markers.

import { getBodyRegion } from './bodyRegions.js'

export const DEFAULT_PITCH = 0.24 // radians the camera looks down by
export const PITCH_MIN = 0.1
export const PITCH_MAX = 0.6
const BODY_DEPTH = 18 // max |z| used for fitting the view (toes)
const BODY_HALF_WIDTH = 72 // A-pose fingertips
const TAU = Math.PI * 2

// ── Loading ────────────────────────────────────────────────────────────────

let bodyPromise = null

export function loadBody(url = '/body/slices.bin') {
  if (!bodyPromise) {
    bodyPromise = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`body slices: ${r.status}`)
        return r.arrayBuffer()
      })
      .then(parseBody)
      .catch((err) => { bodyPromise = null; throw err })
  }
  return bodyPromise
}

function parseBody(ab) {
  const dv = new DataView(ab)
  const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3))
  if (magic !== 'FMPS') throw new Error('body slices: bad file')
  let o = 8
  const step = dv.getFloat32(o, true); o += 4
  const K = dv.getFloat32(o, true); o += 4
  const r3fMinY = dv.getFloat32(o, true); o += 4
  const top = dv.getFloat32(o, true); o += 4
  const count = dv.getUint32(o, true); o += 4
  const slices = []
  for (let i = 0; i < count; i++) {
    const nLoops = dv.getUint16(o, true); o += 2
    const loops = []
    for (let l = 0; l < nLoops; l++) {
      const n = dv.getUint16(o, true); o += 2
      const pts = new Float32Array(n * 2)
      const nrm = new Float32Array(n * 3)
      for (let k = 0; k < n; k++) {
        pts[k * 2] = dv.getInt16(o, true) / 200; o += 2
        pts[k * 2 + 1] = dv.getInt16(o, true) / 200; o += 2
        nrm[k * 3] = dv.getInt8(o++) / 127
        nrm[k * 3 + 1] = dv.getInt8(o++) / 127
        nrm[k * 3 + 2] = dv.getInt8(o++) / 127
      }
      loops.push(makeLoop(pts, nrm))
    }
    slices.push({ y: (i + 0.5) * step, loops })
  }
  return { slices, step, K, r3fMinY, top }
}

function makeLoop(pts, nrm) {
  const n = pts.length / 2
  // Area-weighted centroid (falls back to the vertex mean for slivers).
  let a = 0, cx = 0, cz = 0, mx = 0, mz = 0
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
  for (let i = 0; i < n; i++) {
    const x0 = pts[i * 2], z0 = pts[i * 2 + 1]
    const j = (i + 1) % n
    const x1 = pts[j * 2], z1 = pts[j * 2 + 1]
    const c = x0 * z1 - x1 * z0
    a += c; cx += (x0 + x1) * c; cz += (z0 + z1) * c
    mx += x0; mz += z0
    minX = Math.min(minX, x0); maxX = Math.max(maxX, x0)
    minZ = Math.min(minZ, z0); maxZ = Math.max(maxZ, z0)
  }
  if (Math.abs(a) > 1e-4) { cx /= 3 * a; cz /= 3 * a } else { cx = mx / n; cz = mz / n }
  const path = new Path2D()
  path.moveTo(pts[0], pts[1])
  for (let i = 1; i < n; i++) path.lineTo(pts[i * 2], pts[i * 2 + 1])
  path.closePath()
  return { pts, nrm, n, cx, cz, minX, maxX, minZ, maxZ, path, grad: null, zr: 0, winding: a >= 0 ? 1 : -1 }
}

// ── Lighting ───────────────────────────────────────────────────────────────
// Lights are fixed to the body (as in any baked sprite stack): a key from the
// front-upper-left, a softer key from the back-upper-right so the back reads
// as well as the front, sky light from above and a little ambient.

const norm3 = (x, y, z) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l] }
const KEY = norm3(-0.55, 0.62, 0.72)
const BACK = norm3(0.55, 0.62, -0.72)
const FILL = norm3(0.9, 0.1, 0.2)

const SKIN = {
  deep: [128, 66, 46],
  shadow: [196, 124, 96],
  base: [236, 178, 146],
  light: [255, 222, 200],
  spec: [255, 244, 234],
}

const wrap = (d, w) => Math.max(0, (d + w) / (1 + w))
function lum(nx, ny, nz) {
  const key = wrap(nx * KEY[0] + ny * KEY[1] + nz * KEY[2], 0.12)
  const back = wrap(nx * BACK[0] + ny * BACK[1] + nz * BACK[2], 0.12)
  const fill = wrap(nx * FILL[0] + ny * FILL[1] + nz * FILL[2], 0.2)
  const sky = (1 + ny) / 2
  const v = 0.14 + 0.72 * key + 0.62 * back + 0.16 * fill + 0.26 * sky
  return 0.92 + (v - 0.92) * 1.25 // steeper curve around the mid tone
}
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
function skinColor(v) {
  let c
  if (v < 0.55) c = mixc(SKIN.deep, SKIN.shadow, v / 0.55)
  else if (v < 0.95) c = mixc(SKIN.shadow, SKIN.base, (v - 0.55) / 0.4)
  else if (v < 1.25) c = mixc(SKIN.base, SKIN.light, (v - 0.95) / 0.3)
  else c = mixc(SKIN.light, SKIN.spec, Math.min(1, (v - 1.25) / 0.2))
  return `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`
}

// Conic gradient around the loop centroid: each vertex's shade at its angle.
function loopGradient(ctx, loop) {
  const { pts, nrm, n, cx, cz, winding } = loop
  const stops = []
  for (let i = 0; i < n; i++) {
    let t = Math.atan2(pts[i * 2 + 1] - cz, pts[i * 2] - cx) / TAU
    if (t < 0) t += 1
    // Cavity: reflex (inward-turning) vertices sit in grooves between
    // muscles, so they get less light — a cheap ambient-occlusion stand-in.
    const pi = (i - 1 + n) % n, ni = (i + 1) % n
    const ax = pts[i * 2] - pts[pi * 2], az = pts[i * 2 + 1] - pts[pi * 2 + 1]
    const bx = pts[ni * 2] - pts[i * 2], bz = pts[ni * 2 + 1] - pts[i * 2 + 1]
    const turn = Math.atan2(ax * bz - az * bx, ax * bx + az * bz) * winding
    stops.push([t, lum(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]), Math.min(1, Math.max(0, -turn / 0.9))])
  }
  // Spread the cavity over neighbours so single noisy vertices don't scratch.
  for (let i = 0; i < n; i++) {
    const c = (stops[(i - 1 + n) % n][2] + 2 * stops[i][2] + stops[(i + 1) % n][2]) / 4
    stops[i][1] *= 1 - 0.3 * c
  }
  stops.sort((p, q) => p[0] - q[0])
  // Smooth neighbouring stops a touch so quantised normals don't sparkle.
  const sm = stops.map((s, i) => {
    const a = stops[(i - 1 + stops.length) % stops.length][1], b = stops[(i + 1) % stops.length][1]
    return [s[0], s[1] * 0.6 + (a + b) * 0.2]
  })
  const g = ctx.createConicGradient(0, cx, cz)
  const first = sm[0], last = sm[sm.length - 1]
  const span = first[0] + 1 - last[0]
  const wrapV = span > 1e-6 ? last[1] + (first[1] - last[1]) * ((1 - last[0]) / span) : first[1]
  g.addColorStop(0, skinColor(wrapV))
  let prev = 0
  for (const [t, v] of sm) {
    const tt = Math.min(1, Math.max(prev, t))
    g.addColorStop(tt, skinColor(v))
    prev = tt
  }
  g.addColorStop(1, skinColor(wrapV))
  return g
}

// ── View ───────────────────────────────────────────────────────────────────
// view = { yaw, pitch, zoom, panX, panY }; size = { w, h } in CSS pixels.
// Screen = (ox + xr*s, oy + (-y*cp + zr*sp)*s).

export function project(body, size, view) {
  const top = body?.top ?? 174
  const { w, h } = size
  const cp = Math.cos(view.pitch), sp = Math.sin(view.pitch)
  const span = top * cp + 2 * BODY_DEPTH * sp
  const pad = h * 0.05
  const bs = Math.max(0.1, Math.min((h - pad * 2) / span, (w * 0.96) / (BODY_HALF_WIDTH * 2)))
  const bx = w / 2
  const by = (h - span * bs) / 2 + (top * cp + BODY_DEPTH * sp) * bs
  const z = view.zoom
  return {
    s: bs * z, bs, bx, by, top,
    ox: w / 2 + (bx - w / 2) * z + view.panX,
    oy: h / 2 + (by - h / 2) * z + view.panY,
    cp, sp,
    cy: Math.cos(view.yaw), sy: Math.sin(view.yaw),
    yaw: view.yaw,
  }
}

export function toScreen(p, { x, y, z }) {
  const xr = x * p.cy + z * p.sy
  const zr = -x * p.sy + z * p.cy
  return { x: p.ox + xr * p.s, y: p.oy + (-y * p.cp + zr * p.sp) * p.s, depth: zr }
}

function strideFor(body, p, target) {
  return Math.max(1, Math.round(target / (body.step * p.cp * p.s)))
}

// Far-to-near order within a slice, into a reused buffer.
const ORDER = []
function sortedLoops(loops, p) {
  ORDER.length = 0
  for (const lp of loops) {
    lp.zr = -lp.cx * p.sy + lp.cz * p.cy
    let j = ORDER.length
    while (j > 0 && ORDER[j - 1].zr > lp.zr) { ORDER[j] = ORDER[j - 1]; j-- }
    ORDER[j] = lp
  }
  return ORDER
}

// Screen transform of one slice: translate(ox, oy - y*cp*s) · scale(s, s*sp) · rotate(-yaw)
function sliceMatrix(m, p, y, dpr) {
  const a = dpr * p.s, d = dpr * p.s * p.sp
  m.a = a * p.cy; m.b = -d * p.sy; m.c = a * p.sy; m.d = d * p.cy
  m.e = dpr * p.ox; m.f = dpr * (p.oy - y * p.cp * p.s)
  return m
}

// Draws the body into ctx (already sized for dpr).
// opts: { dpr, hover, fast, height } — fast uses coarser slices while moving.
export function drawBody(ctx, body, p, { dpr = 1, hover = false, fast = false, height = Infinity } = {}) {
  const { slices } = body
  // Slice spacing in device pixels: ~1 when settled, ~2 while dragging.
  const stride = strideFor(body, p, (fast ? 2 : 1) / dpr)
  const margin = BODY_DEPTH * p.sp * p.s + 40
  const onScreen = (y) => {
    const sy = p.oy - y * p.cp * p.s
    return sy > -margin && sy < height + margin
  }
  const m = new DOMMatrix()

  // Ground shadow
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.save()
  ctx.translate(p.ox, p.oy)
  ctx.scale(1, Math.max(0.12, p.sp))
  const ground = ctx.createRadialGradient(0, 0, 0, 0, 0, 30 * p.s)
  ground.addColorStop(0, 'rgba(150, 90, 50, 0.24)')
  ground.addColorStop(1, 'rgba(150, 90, 50, 0)')
  ctx.fillStyle = ground
  ctx.beginPath(); ctx.arc(0, 0, 30 * p.s, 0, TAU); ctx.fill()
  ctx.restore()

  // Pass 1: silhouette outline, stroked once in screen space. Pass 2 covers
  // every interior edge, leaving only the outer silhouette.
  const outline = new Path2D()
  for (let i = 0; i < slices.length; i += stride) {
    const { y, loops } = slices[i]
    if (!onScreen(y)) continue
    sliceMatrix(m, p, y, dpr)
    for (const lp of loops) outline.addPath(lp.path, m)
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.lineWidth = Math.min(3, Math.max(1.6, p.s * 0.5)) * dpr
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#9A5C45'
  ctx.stroke(outline)

  // Pass 2: shaded fills, bottom to top, far to near.
  for (let i = 0; i < slices.length; i += stride) {
    const { y, loops } = slices[i]
    if (!onScreen(y)) continue
    ctx.setTransform(sliceMatrix(m, p, y, dpr))
    for (const lp of sortedLoops(loops, p)) {
      if (!lp.grad) lp.grad = loopGradient(ctx, lp)
      ctx.fillStyle = lp.grad
      ctx.fill(lp.path)
    }
  }

  if (hover) {
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalCompositeOperation = 'source-atop'
    ctx.fillStyle = 'rgba(255, 246, 236, 0.12)'
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    ctx.globalCompositeOperation = 'source-over'
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

// ── Picking ────────────────────────────────────────────────────────────────

function insideLoop(lp, x, z) {
  if (x < lp.minX || x > lp.maxX || z < lp.minZ || z > lp.maxZ) return false
  const { pts, n } = lp
  let inside = false
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = pts[i * 2], zi = pts[i * 2 + 1], xj = pts[j * 2], zj = pts[j * 2 + 1]
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}

// Returns the visible surface point (sprite space) under a screen position.
export function pick(body, p, px, py) {
  const { slices } = body
  const stride = strideFor(body, p, 0.85)
  const last = Math.floor((slices.length - 1) / stride) * stride
  const xr = (px - p.ox) / p.s
  for (let i = last; i >= 0; i -= stride) {
    const { y, loops } = slices[i]
    if (!loops.length) continue
    const zr = (py - p.oy + y * p.cp * p.s) / (p.sp * p.s)
    const x = xr * p.cy - zr * p.sy
    const z = xr * p.sy + zr * p.cy
    const ordered = sortedLoops(loops, p)
    for (let j = ordered.length - 1; j >= 0; j--) {
      if (insideLoop(ordered[j], x, z)) return { x, y, z }
    }
  }
  return null
}

// ── Space conversion (sprite <-> R3F world) ────────────────────────────────

export const toModel = (body, { x, y, z }) => ({ x: x / body.K, y: y / body.K + body.r3fMinY, z: z / body.K })
export const fromModel = (body, { x, y, z }) => ({ x: x * body.K, y: (y - body.r3fMinY) * body.K, z: z * body.K })

export function regionFor(body, hit) {
  return getBodyRegion(toModel(body, hit))
}

// A marker is visible when the surface under its projected point is itself.
export function isVisible(body, p, point) {
  const s = toScreen(p, point)
  const hit = pick(body, p, s.x, s.y)
  if (!hit) return false
  return Math.hypot(hit.x - point.x, hit.y - point.y, hit.z - point.z) < 4
}
