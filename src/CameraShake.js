import { Clock } from "three"
import { SimplexNoise } from "three/examples/jsm/math/SimplexNoise"

export const CameraShake = (
  camera,
  defaultControls,
  prop = {
    intensity: 0,
    decay: false,
    decayRate: 0.9,
    maxYaw: 0.1,
    maxPitch: 0.1,
    maxRoll: 0.2,
    yawFrequency: 0.1,
    pitchFrequency: 0.1,
    rollFrequency: 0.1,
  }
) => {
  console.log({ prop })
  let initialRotation = camera.rotation.clone()
  const yawNoise = new SimplexNoise()
  const pitchNoise = new SimplexNoise()
  const rollNoise = new SimplexNoise()

  const constrainIntensity = () => {
    if (prop.intensity < 0 || prop.intensity > 1) {
      prop.intensity = prop.intensity < 0 ? 0 : 1
    }
  }

  const addGui = (gui) => {
    const folder = gui.addFolder("cam shake")

    folder.add(prop, "intensity", 0, 5).listen()
    folder.add(prop, "decay").listen()
    folder.add(prop, "decayRate", 0, 1)
    folder.add(prop, "maxYaw", -5, 5).listen()
    folder.add(prop, "maxPitch", -5, 5).listen()
    folder.add(prop, "maxRoll", -5, 5).listen()
    folder.add(prop, "yawFrequency", -5, 5).listen()
    folder.add(prop, "pitchFrequency", -5, 5).listen()
    folder.add(prop, "rollFrequency", -5, 5).listen()
  }

  /**
   * Set int
   * @param {Number} val
   */
  const setIntensity = (val) => {
    prop.intensity = val
    // constrainIntensity()
    console.log("int", prop.intensity)
  }
  const callback = () => void (initialRotation = camera.rotation.clone())

  const disable = () => {
    if (defaultControls) {
      defaultControls.removeEventListener("change", callback)
    }
  }

  if (defaultControls) {
    defaultControls.addEventListener("change", callback)
    callback()
  }
  //  [camera, defaultControls]

  /**
   * On RAF
   * @param {Clock} clock
   * @param {Number} delta
   */
  const update = (clock, delta) => {
    if (!prop.intensity) return
    const shake = Math.pow(prop.intensity, 2)
    const yaw = prop.maxYaw * shake * yawNoise.noise(clock.elapsedTime * prop.yawFrequency, 1)
    const pitch = prop.maxPitch * shake * pitchNoise.noise(clock.elapsedTime * prop.pitchFrequency, 1)
    const roll = prop.maxRoll * shake * rollNoise.noise(clock.elapsedTime * prop.rollFrequency, 1)

    camera.rotation.set(initialRotation.x + pitch, initialRotation.y + yaw, initialRotation.z + roll)

    if (prop.decay && prop.intensity > 0) {
      prop.intensity -= prop.decayRate * delta
      constrainIntensity()
    }
  }

  return {
    prop,
    addGui,
    update,
    setIntensity,
  }
}
