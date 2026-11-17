// Anatomical region lookup shared by both body renderers (the R3F model in
// components/3d and the sprite-stacked body in components/body). Points are in
// the R3F scene's world space; the sprite body converts to it before asking.

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
