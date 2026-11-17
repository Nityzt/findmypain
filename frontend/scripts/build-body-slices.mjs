#!/usr/bin/env node
// Slices public/human_body.glb into horizontal cross-sections for the
// sprite-stacked body (src/lib/spriteBody.js).
//
// Output: public/body/slices.bin. The mesh is placed exactly as the R3F scene
// places it (HumanBodyModel: rotation [π/2, 0, 0], scale 2.113, inside drei's
// <Center>), so points can be converted to that scene's world space and back.
// Sprite space is the same figure in centimetre-ish units: y = 0 at the soles,
// BODY_TOP at the crown, facing +z.
//
// Each slice holds closed contour loops; each loop vertex carries the mesh's
// interpolated surface normal, which the renderer uses for shading.
//
// Usage: node scripts/build-body-slices.mjs

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = resolve(root, 'public/human_body.glb')
const OUT = resolve(root, 'public/body/slices.bin')

const BODY_TOP = 174 // sprite-space height
const STEP = 0.2 // sprite-space slice spacing
const SIMPLIFY = 0.045 // Douglas-Peucker tolerance (sprite units)
const POS_Q = 200 // position quantisation: units per sprite unit
const R3F_SCALE = 2.113
const RIM_SCALE = 1.007 // the rim mesh inside <Center> is slightly larger

// ── GLB parsing ────────────────────────────────────────────────────────────
const buf = readFileSync(SRC)
const jsonLen = buf.readUInt32LE(12)
const gltf = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'))
const binStart = 20 + jsonLen + 8
const bin = buf.subarray(binStart)

function accessor(i) {
  const a = gltf.accessors[i]
  const bv = gltf.bufferViews[a.bufferView]
  const off = (bv.byteOffset || 0) + (a.byteOffset || 0)
  const comps = { SCALAR: 1, VEC2: 2, VEC3: 3 }[a.type]
  const n = a.count * comps
  const ab = bin.buffer.slice(bin.byteOffset + off, bin.byteOffset + off + n * (a.componentType === 5126 ? 4 : a.componentType === 5125 ? 4 : 2))
  if (a.componentType === 5126) return new Float32Array(ab)
  if (a.componentType === 5125) return new Uint32Array(ab)
  if (a.componentType === 5123) return new Uint16Array(ab)
  throw new Error(`unsupported component type ${a.componentType}`)
}

const prim = gltf.meshes[0].primitives[0]
const posRaw = accessor(prim.attributes.POSITION)
const nrmRaw = accessor(prim.attributes.NORMAL)
const idx = accessor(prim.indices)
const nv = posRaw.length / 3

// Rotation about X by +π/2: (x, y, z) -> (x, -z, y); then scale.
const P = new Float64Array(nv * 3)
const N = new Float64Array(nv * 3)
for (let i = 0; i < nv; i++) {
  const x = posRaw[i * 3], y = posRaw[i * 3 + 1], z = posRaw[i * 3 + 2]
  P[i * 3] = x * R3F_SCALE
  P[i * 3 + 1] = -z * R3F_SCALE
  P[i * 3 + 2] = y * R3F_SCALE
  const nx = nrmRaw[i * 3], ny = nrmRaw[i * 3 + 1], nz = nrmRaw[i * 3 + 2]
  N[i * 3] = nx
  N[i * 3 + 1] = -nz
  N[i * 3 + 2] = ny
}

// drei <Center> centres the bounding box of the group (body + rim mesh).
const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
for (let i = 0; i < nv; i++) for (let c = 0; c < 3; c++) {
  min[c] = Math.min(min[c], P[i * 3 + c]); max[c] = Math.max(max[c], P[i * 3 + c])
}
const center = [0, 1, 2].map((c) => ((min[c] + max[c]) / 2) * RIM_SCALE)
for (let i = 0; i < nv; i++) for (let c = 0; c < 3; c++) P[i * 3 + c] -= center[c]
const r3fMinY = min[1] - center[1]
const r3fHeight = max[1] - min[1]
const K = BODY_TOP / r3fHeight // sprite units per R3F unit

// Sprite space
const S = new Float64Array(nv * 3)
for (let i = 0; i < nv; i++) {
  S[i * 3] = P[i * 3] * K
  S[i * 3 + 1] = (P[i * 3 + 1] - r3fMinY) * K
  S[i * 3 + 2] = P[i * 3 + 2] * K
}

// Weld duplicate vertices (UV seams) so contours chain across them.
const weld = new Int32Array(nv)
{
  const map = new Map()
  for (let i = 0; i < nv; i++) {
    const key = `${Math.round(S[i * 3] * 1e4)},${Math.round(S[i * 3 + 1] * 1e4)},${Math.round(S[i * 3 + 2] * 1e4)}`
    if (!map.has(key)) map.set(key, i)
    weld[i] = map.get(key)
  }
}

// ── Slicing ────────────────────────────────────────────────────────────────
const sliceCount = Math.floor(BODY_TOP / STEP)
const segs = Array.from({ length: sliceCount }, () => [])

const tri = idx.length / 3
for (let t = 0; t < tri; t++) {
  const v = [idx[t * 3], idx[t * 3 + 1], idx[t * 3 + 2]]
  const ys = v.map((i) => S[i * 3 + 1])
  const lo = Math.min(...ys), hi = Math.max(...ys)
  const k0 = Math.max(0, Math.ceil(lo / STEP - 0.5)), k1 = Math.min(sliceCount - 1, Math.floor(hi / STEP - 0.5))
  for (let k = k0; k <= k1; k++) {
    const y = (k + 0.5) * STEP + 1e-7
    const pts = []
    for (let e = 0; e < 3; e++) {
      const a = v[e], b = v[(e + 1) % 3]
      const ya = S[a * 3 + 1], yb = S[b * 3 + 1]
      if ((ya - y) * (yb - y) >= 0) continue
      const f = (y - ya) / (yb - ya)
      const wa = weld[a], wb = weld[b]
      pts.push({
        key: wa < wb ? `${wa}_${wb}` : `${wb}_${wa}`,
        x: S[a * 3] + (S[b * 3] - S[a * 3]) * f,
        z: S[a * 3 + 2] + (S[b * 3 + 2] - S[a * 3 + 2]) * f,
        nx: N[a * 3] + (N[b * 3] - N[a * 3]) * f,
        ny: N[a * 3 + 1] + (N[b * 3 + 1] - N[a * 3 + 1]) * f,
        nz: N[a * 3 + 2] + (N[b * 3 + 2] - N[a * 3 + 2]) * f,
      })
    }
    if (pts.length === 2) segs[k].push(pts)
  }
}

function chain(list) {
  const byKey = new Map()
  list.forEach((s, i) => {
    for (const p of s) {
      if (!byKey.has(p.key)) byKey.set(p.key, [])
      byKey.get(p.key).push(i)
    }
  })
  const used = new Uint8Array(list.length)
  const loops = []
  for (let i = 0; i < list.length; i++) {
    if (used[i]) continue
    used[i] = 1
    const loop = [list[i][0], list[i][1]]
    const startKey = list[i][0].key
    let cur = list[i][1].key
    let guard = 0
    while (cur !== startKey && guard++ < 100000) {
      const next = (byKey.get(cur) || []).find((j) => !used[j])
      if (next === undefined) break
      used[next] = 1
      const s = list[next]
      const other = s[0].key === cur ? s[1] : s[0]
      if (other.key !== startKey) loop.push(other)
      cur = other.key
    }
    if (loop.length >= 4) loops.push(loop)
  }
  return loops
}

function perimeter(loop) {
  let p = 0
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i], b = loop[(i + 1) % loop.length]
    p += Math.hypot(b.x - a.x, b.z - a.z)
  }
  return p
}

function simplify(loop, tol) {
  // Douglas-Peucker on a closed loop: split at the two farthest-apart points.
  if (loop.length < 8) return loop
  let far = 0, fd = -1
  for (let i = 1; i < loop.length; i++) {
    const d = Math.hypot(loop[i].x - loop[0].x, loop[i].z - loop[0].z)
    if (d > fd) { fd = d; far = i }
  }
  const dp = (pts) => {
    if (pts.length < 3) return pts
    const a = pts[0], b = pts[pts.length - 1]
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz) || 1e-9
    let idxMax = 0, dMax = 0
    for (let i = 1; i < pts.length - 1; i++) {
      const d = Math.abs((pts[i].x - a.x) * dz - (pts[i].z - a.z) * dx) / len
      if (d > dMax) { dMax = d; idxMax = i }
    }
    if (dMax <= tol) return [a, b]
    const left = dp(pts.slice(0, idxMax + 1))
    const right = dp(pts.slice(idxMax))
    return left.slice(0, -1).concat(right)
  }
  const first = dp(loop.slice(0, far + 1))
  const second = dp(loop.slice(far).concat([loop[0]]))
  return first.slice(0, -1).concat(second.slice(0, -1))
}

// ── Star-shaped pieces ─────────────────────────────────────────────────────
// The renderer shades a loop with a conic gradient around its centroid, which
// is only right when every boundary point is "visible" from that centroid.
// Where the arm meets the torso (or the legs meet the pelvis) one loop has two
// lobes, so split it along the narrowest vertical neck between them.

function centroid(loop) {
  let a = 0, cx = 0, cz = 0
  for (let i = 0; i < loop.length; i++) {
    const p = loop[i], q = loop[(i + 1) % loop.length]
    const c = p.x * q.z - q.x * p.z
    a += c; cx += (p.x + q.x) * c; cz += (p.z + q.z) * c
  }
  if (Math.abs(a) < 1e-6) return { x: loop[0].x, z: loop[0].z }
  return { x: cx / (3 * a), z: cz / (3 * a) }
}

function isStar(loop) {
  const c = centroid(loop)
  let total = 0
  let prev = Math.atan2(loop[0].z - c.z, loop[0].x - c.x)
  for (let i = 1; i <= loop.length; i++) {
    const p = loop[i % loop.length]
    const ang = Math.atan2(p.z - c.z, p.x - c.x)
    let d = ang - prev
    while (d > Math.PI) d -= 2 * Math.PI
    while (d < -Math.PI) d += 2 * Math.PI
    total += Math.abs(d)
    prev = ang
  }
  return total < 2 * Math.PI * 1.06
}

// Vertical chord thickness of the loop at x.
function chordAt(loop, x) {
  const zs = []
  for (let i = 0; i < loop.length; i++) {
    const p = loop[i], q = loop[(i + 1) % loop.length]
    if ((p.x - x) * (q.x - x) < 0) zs.push(p.z + ((x - p.x) / (q.x - p.x)) * (q.z - p.z))
  }
  if (zs.length < 2) return Infinity
  zs.sort((a, b) => a - b)
  let t = 0
  for (let i = 0; i + 1 < zs.length; i += 2) t += zs[i + 1] - zs[i]
  return t
}

function clipX(loop, xc, keepLeft) {
  const inside = (p) => (keepLeft ? p.x <= xc : p.x >= xc)
  const out = []
  for (let i = 0; i < loop.length; i++) {
    const p = loop[i], q = loop[(i + 1) % loop.length]
    const pi = inside(p), qi = inside(q)
    if (pi) out.push(p)
    if (pi !== qi) {
      const f = (xc - p.x) / (q.x - p.x)
      const lerp = (a, b) => a + (b - a) * f
      out.push({ x: xc, z: lerp(p.z, q.z), nx: lerp(p.nx, q.nx), ny: lerp(p.ny, q.ny), nz: lerp(p.nz, q.nz) })
    }
  }
  return out
}

function splitStar(loop, depth = 0) {
  if (depth > 3 || loop.length < 12 || isStar(loop)) return [loop]
  let minX = Infinity, maxX = -Infinity
  for (const p of loop) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x) }
  const w = maxX - minX
  if (w < 1.5) return [loop]
  let best = null, bestT = Infinity
  for (let k = 1; k < 40; k++) {
    const x = minX + w * (0.12 + 0.76 * (k / 40))
    const t = chordAt(loop, x)
    if (t < bestT) { bestT = t; best = x }
  }
  if (best === null) return [loop]
  const left = clipX(loop, best, true), right = clipX(loop, best, false)
  if (left.length < 3 || right.length < 3) return [loop]
  return [...splitStar(left, depth + 1), ...splitStar(right, depth + 1)]
}

const slices = segs.map((list) => chain(list)
  .filter((l) => perimeter(l) > 0.6)
  .map((l) => simplify(l, SIMPLIFY))
  .flatMap((l) => splitStar(l))
  .filter((l) => l.length >= 3))

// ── Binary output ──────────────────────────────────────────────────────────
// Header: 'FMPS', u32 version, f32 step, f32 K, f32 r3fMinY, f32 bodyTop, u32 slices
// Per slice: u16 loops; per loop: u16 points; per point: i16 x, i16 z, i8 nx, i8 ny, i8 nz
let size = 4 + 4 + 4 * 4 + 4
let points = 0, loopsTotal = 0
for (const sl of slices) {
  size += 2
  for (const l of sl) { size += 2 + l.length * 7; points += l.length; loopsTotal++ }
}
const out = Buffer.alloc(size)
let o = 0
out.write('FMPS', o); o += 4
out.writeUInt32LE(1, o); o += 4
out.writeFloatLE(STEP, o); o += 4
out.writeFloatLE(K, o); o += 4
out.writeFloatLE(r3fMinY, o); o += 4
out.writeFloatLE(BODY_TOP, o); o += 4
out.writeUInt32LE(slices.length, o); o += 4
const q8 = (v) => Math.max(-127, Math.min(127, Math.round(v * 127)))
for (const sl of slices) {
  out.writeUInt16LE(sl.length, o); o += 2
  for (const l of sl) {
    out.writeUInt16LE(l.length, o); o += 2
    for (const p of l) {
      const len = Math.hypot(p.nx, p.ny, p.nz) || 1
      out.writeInt16LE(Math.round(p.x * POS_Q), o); o += 2
      out.writeInt16LE(Math.round(p.z * POS_Q), o); o += 2
      out.writeInt8(q8(p.nx / len), o++)
      out.writeInt8(q8(p.ny / len), o++)
      out.writeInt8(q8(p.nz / len), o++)
    }
  }
}
mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, out)
console.log(`slices ${slices.length}, loops ${loopsTotal}, points ${points}, bytes ${size}, K ${K.toFixed(4)}, r3fMinY ${r3fMinY.toFixed(4)}`)
