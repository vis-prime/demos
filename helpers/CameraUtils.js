import { Box3, Vector3 } from "three"

const boundingBox = new Box3()
var middle = new Vector3()
var size = new Vector3()
var cam = new Vector3()

export const fitCameraToCenteredObject = function (
  camera,
  object,
  offset,
  orbitControls
) {
  boundingBox.setFromObject(object, true)

  boundingBox.getSize(size)
  boundingBox.getCenter(middle)

  if (!Math.max(...size.toArray())) return
  if (Math.max(...size.toArray()) > 100) return

  console.log({ size })
  const fov = camera.fov * (Math.PI / 180)
  const fovh = 2 * Math.atan(Math.tan(fov / 2) * camera.aspect)
  let dx = size.z / 2 + Math.abs(size.x / 2 / Math.tan(fovh / 2))
  let dy = size.z / 2 + Math.abs(size.y / 2 / Math.tan(fov / 2))
  let cameraZ = Math.max(dx, dy)

  // offset the camera, if desired (to avoid filling the whole canvas)
  if (offset !== undefined && offset !== 0) cameraZ *= offset

  const distance = camera.position.distanceTo(middle)

  cam.lerpVectors(orbitControls.target, camera.position, cameraZ / distance)

  camera.position.copy(cam)
  orbitControls.target.copy(middle)

  console.log(camera.position.distanceTo(orbitControls.target), {
    lerpA: 1 / distance,
  })
}
