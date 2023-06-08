import { Clock } from "three"
import { SimplexNoise } from "three/examples/jsm/math/SimplexNoise"

export const CameraShake = (
  camera,
  defaultControls,
  {
    intensity = 1,
    decay,
    decayRate = 0.65,
    maxYaw = 0.1,
    maxPitch = 0.1,
    maxRoll = 0.1,
    yawFrequency = 0.1,
    pitchFrequency = 0.1,
    rollFrequency = 0.1,
  } = {}
) => {
  let initialRotation = camera.rotation.clone()
  const yawNoise = new SimplexNoise()
  const pitchNoise = new SimplexNoise()
  const rollNoise = new SimplexNoise()

  const constrainIntensity = () => {
    if (intensity < 0 || intensity > 1) {
      intensity = intensity < 0 ? 0 : 1
    }
  }

  /**
   * Set int
   * @param {Number} val
   */
  const setIntensity = (val) => {
    intensity = val
    constrainIntensity()
  }

  if (defaultControls) {
    const callback = () => void (initialRotation = camera.rotation.clone())
    defaultControls.addEventListener("change", callback)
    callback()
    return () => void defaultControls.removeEventListener("change", callback)
  }
  //  [camera, defaultControls]

  /**
   * On RAF
   * @param {Clock} clock
   * @param {Number} delta
   */
  const update = (clock, delta) => {
    const shake = Math.pow(intensity, 2)
    const yaw = maxYaw * shake * yawNoise.noise(clock.elapsedTime * yawFrequency, 1)
    const pitch = maxPitch * shake * pitchNoise.noise(clock.elapsedTime * pitchFrequency, 1)
    const roll = maxRoll * shake * rollNoise.noise(clock.elapsedTime * rollFrequency, 1)

    camera.rotation.set(initialRotation.x + pitch, initialRotation.y + yaw, initialRotation.z + roll)

    if (decay && intensity > 0) {
      intensity -= decayRate * delta
      constrainIntensity()
    }
  }

  return {
    update,
    setIntensity,
  }
}
