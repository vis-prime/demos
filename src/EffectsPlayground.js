import Stats from "three/examples/jsm/libs/stats.module"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"
import { TransformControls } from "three/examples/jsm/controls/TransformControls"
import {
  ACESFilmicToneMapping,
  PerspectiveCamera,
  Scene,
  sRGBEncoding,
  WebGLRenderer,
  Vector2,
  Raycaster,
  Group,
  VSMShadowMap,
  Box3,
  Vector3,
  MathUtils,
  SphereGeometry,
  MeshBasicMaterial,
  Mesh,
  InstancedMesh,
  Matrix4,
  BoxGeometry,
  MeshStandardMaterial,
  CircleGeometry,
  DirectionalLight,
  EquirectangularReflectionMapping,
  CanvasTexture,
  Color,
} from "three"

// Model and Env
import { BG_ENV } from "../helpers/BG_ENV"
import { Easing, Tween, update } from "@tweenjs/tween.js"
import { HDRI_LIST } from "../hdri/HDRI_LIST"
import { N8AOPostPass } from "n8ao"
import {
  EffectComposer,
  RenderPass,
  BloomEffect,
  ChromaticAberrationEffect,
  EffectPass,
  SelectiveBloomEffect,
  VignetteEffect,
  DepthOfFieldEffect,
  TiltShiftEffect,
  SMAAEffect,
  FXAAEffect,
} from "postprocessing"
import { MODEL_LIST, MODEL_LOADER } from "./MODEL_LIST"

let stats,
  renderer,
  /**
   * @type {EffectComposer}
   */
  composer,
  raf,
  camera,
  scene,
  controls,
  gui,
  pointer = new Vector2()

const mainObjects = new Group()

/**
 * @type {TransformControls}
 */
let transformControls

const raycaster = new Raycaster()
const intersects = [] //raycast
let sceneGui
/**
 * @type {BG_ENV}
 */
let bg_env

const allEffects = {
  bloom: null,
  chromaticAberration: null,

  depthOfField: null,
  vignette: null,
  tiltShift: null,
  smaa: null,
  fxaa: null,
}

let renderPass
const allPasses = {
  n8ao: null,
}

const allGui = {
  n8ao: () => {},
  bloom: () => {},
  chromaticAberration: () => {},

  depthOfField: () => {},
  vignette: () => {},
  tiltShift: () => {},
}

const enabledEffects = []
const enabledPasses = []
const focusPoint = new Vector3()
const dummyObj = {
  toFocus: new Vector3(),
  fromFocus: new Vector3(),
  val: 0,
}
const focusTween = new Tween(dummyObj).to({ val: 1 }, 1e6)
export default async function EffectsPlayground(mainGui) {
  gui = mainGui
  sceneGui = gui.addFolder("Scene")
  stats = new Stats()
  app.appendChild(stats.dom)
  // renderer
  renderer = new WebGLRenderer({ antialias: false })
  renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio))
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = VSMShadowMap
  renderer.outputEncoding = sRGBEncoding
  renderer.toneMapping = ACESFilmicToneMapping

  app.appendChild(renderer.domElement)

  // camera
  camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 150)
  camera.position.set(25, 20, 25)
  // scene
  scene = new Scene()
  scene.add(mainObjects)

  // custom vector to perform focus
  scene.focus = new Vector3()

  // controls
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true // an animation loop is required when either damping or auto-rotation are enabled
  controls.dampingFactor = 0.05
  controls.minDistance = 0.1
  controls.maxDistance = 100
  controls.maxPolarAngle = Math.PI / 1.5
  controls.target.set(0, 1, 0)

  transformControls = new TransformControls(camera, renderer.domElement)
  transformControls.addEventListener("dragging-changed", (event) => {
    controls.enabled = !event.value
    if (!event.value) {
    }
  })
  transformControls.showY = false
  transformControls.addEventListener("change", () => {
    if (transformControls.object) {
      if (transformControls.object.position.y < 0) {
        transformControls.object.position.y = 0
      }
    }
  })
  scene.add(transformControls)

  window.addEventListener("resize", onWindowResize)
  document.addEventListener("pointermove", onPointerMove)

  let downTime = Date.now()
  app.addEventListener("pointerdown", () => {
    downTime = Date.now()
  })
  app.addEventListener("pointerup", (e) => {
    if (Date.now() - downTime < 200) {
      onPointerMove(e)
      raycast()
    }
  })

  setupEffects()
  setupBackground()

  // sceneGui.add(transformControls, "mode", ["translate", "rotate", "scale"])

  // await setupModels()

  animate()

  let lastClickTime = 0
  let lastPointerEvent = null

  function handlePointerDown(event) {
    const clickTime = new Date().getTime()
    const timeDiff = clickTime - lastClickTime
    if (
      lastPointerEvent !== null &&
      timeDiff < 500 &&
      calculateDistance(lastPointerEvent.clientX, lastPointerEvent.clientY, event.clientX, event.clientY) < 10
    ) {
      // Double click detected
      console.log("Double click detected!")
      fitModelInViewport(mainObjects)
    }
    lastPointerEvent = event
    lastClickTime = clickTime
  }

  function calculateDistance(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2))
  }

  const targetElement = app
  targetElement.addEventListener("pointerdown", handlePointerDown)
  randomDist()

  focusTween.onUpdate(() => {
    focusPoint.lerp(dummyObj.toFocus, 0.1)
  })
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  composer.setSize(window.innerWidth, window.innerHeight)
}

function render() {
  stats.update()
  update()
  controls.update()
  // renderer.render(scene, camera)
  composer.render()
}

function animate() {
  raf = requestAnimationFrame(animate)
  render()
}

function raycast() {
  // update the picking ray with the camera and pointer position
  raycaster.setFromCamera(pointer, camera)

  // calculate objects intersecting the picking ray
  raycaster.intersectObject(mainObjects, true, intersects)

  if (!intersects.length) {
    // transformControls.detach()
    return
  }
  focusTween.stop()
  dummyObj.toFocus.copy(intersects[0].point)

  focusTween.start()
  // focusPoint.copy(intersects[0].point)
  // transformControls.attach(intersects[0].object)

  intersects.length = 0
}

function onPointerMove(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1
}

async function setupModels() {
  const geo = new BoxGeometry().translate(0, 0.5, 0)
  for (let index = 0; index < 500; index++) {
    const mesh = new Mesh(
      geo,
      new MeshStandardMaterial({
        color: 0x111111 * Math.random(),
        roughness: MathUtils.randFloat(0.1, 0.9),
        metalness: MathUtils.randFloat(0.1, 0.9),
      })
    )
    mesh.castShadow = mesh.receiveShadow = true
    mesh.scale.x = MathUtils.randFloat(0.6, 1.5)
    mesh.scale.y = MathUtils.randFloat(2, 10)
    mesh.scale.z = MathUtils.randFloat(0.6, 1.5)

    mesh.position.x = MathUtils.randFloatSpread(50)
    mesh.position.z = MathUtils.randFloatSpread(50)

    mainObjects.add(mesh)
  }
}

async function setupBackground() {
  bg_env = new BG_ENV(scene, renderer)
  bg_env.sunEnabled = true
  bg_env.shadowFloorEnabled = true
  bg_env.setEnvType("HDRI")
  bg_env.addGui(sceneGui)
  bg_env.preset = HDRI_LIST.round_platform
  bg_env.setBGType("None")
  await bg_env.updateAll()
  bg_env.sunLight.visible = false
  bg_env.shadowFloor.visible = false

  const gltf = await MODEL_LOADER(MODEL_LIST.mourner.url)
  gltf.scene.scale.setScalar(10)
  gltf.scene.traverse((node) => {
    if (node.material) {
      const orgMat = node.material
      node.material = new MeshBasicMaterial({
        color: 0x00ff00,
        aoMap: orgMat.aoMap,
        // normalMap: orgMat.normalMap,
      })
    }
  })
  gltf.scene.scale.setScalar(0.001)

  mainObjects.add(gltf.scene)

  new Tween(gltf.scene.scale).to({ x: 10, y: 10, z: 10 }).easing(Easing.Quadratic.Out).delay(1200).start()

  const floor = new Mesh(new CircleGeometry(40, 64).rotateX(-Math.PI / 2), new MeshBasicMaterial({ color: 0x00ff00 }))
  floor.receiveShadow = true
  mainObjects.add(floor)

  addParticles()

  // Create a canvas element
  const canvas = document.createElement("canvas")
  canvas.width = 256
  canvas.height = 128
  // Get the 2D rendering context
  const ctx = canvas.getContext("2d")

  // Define the gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
  gradient.addColorStop(0.2, "#FF4500") // Deep orange
  gradient.addColorStop(0.4, "#FFD700") // Gold
  gradient.addColorStop(0.7, "#FF1493") // Deep pink

  // Apply the gradient to the canvas
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Create a texture from the canvas
  const gTexture = new CanvasTexture(canvas)
  gTexture.mapping = EquirectangularReflectionMapping
  scene.background = gTexture

  console.log(scene.background)

  //   0xffffeb
  const sunLight = new DirectionalLight("red", 4)
  sunLight.name = "sun"
  sunLight.position.set(25, 25, 25)
  sunLight.castShadow = true
  sunLight.shadow.camera.near = 1
  sunLight.shadow.camera.far = 100
  const size = 35
  sunLight.shadow.camera.right = size
  sunLight.shadow.camera.left = -size
  sunLight.shadow.camera.top = size
  sunLight.shadow.camera.bottom = -size
  sunLight.shadow.mapSize.width = 1024
  sunLight.shadow.mapSize.height = 1024
  sunLight.shadow.radius = 1.95
  sunLight.shadow.blurSamples = 6
  sunLight.shadow.bias = -0.0005
  scene.add(sunLight)

  gui.add(sunLight, "intensity", 0.1, 20)

  const twObj = {
    val: 0,
  }
  const radius = 25
  new Tween(twObj)
    .to({ val: 1 })
    .duration(12e4)
    .repeat(1e4)
    .onUpdate((e) => {
      // Calculate the new position using sine and cosine functions

      const fullRot = MathUtils.mapLinear(e.val, 0, 1, 0, 2 * Math.PI)
      const x = Math.cos(fullRot) * radius
      const z = Math.sin(fullRot) * radius

      // Set the new position of the object
      sunLight.position.x = x
      sunLight.position.z = z
    })
    .start()
}

const bbox = new Box3()
const center = new Vector3()
const size = new Vector3()
const endPos = new Vector3()
const endTar = new Vector3()
const shiftedCameraPos = new Vector3()

function fitModelInViewport(model) {
  bbox.setFromObject(model, true)
  bbox.getCenter(center)
  bbox.getSize(size)

  let distance = size.length() / Math.tan(MathUtils.degToRad(camera.fov) / 2)
  distance -= distance * 0.3
  // move the camera to look at the center of the mesh

  shiftedCameraPos.copy(camera.position)
  shiftedCameraPos.y = center.y

  endPos.lerpVectors(center, shiftedCameraPos, 1 / (center.distanceTo(camera.position) / distance))

  console.log(endPos.distanceTo(center), distance)
  endTar.copy(center)

  new Tween(camera.position).to(endPos).duration(1000).easing(Easing.Quadratic.InOut).start()

  new Tween(controls.target).to(endTar).duration(1000).easing(Easing.Quadratic.InOut).start()
}

let instancedParticles, particleTween

const addParticles = () => {
  const spread = 50

  const geo = new SphereGeometry(0.02, 8, 8)
  const mat = new MeshBasicMaterial()
  mat.color.setRGB(10, 10, 10)

  instancedParticles = new InstancedMesh(geo, mat, 1000)
  const matrix = new Matrix4()
  const randomScale = new Vector3()
  const randColor = new Color()
  console.log(instancedParticles)
  for (let index = 0; index < instancedParticles.count; index++) {
    matrix.identity()

    matrix.setPosition(
      MathUtils.randFloatSpread(spread),
      MathUtils.randFloat(0, spread / 2),
      MathUtils.randFloatSpread(spread)
    )

    randomScale.setScalar(MathUtils.randFloat(1, 3))
    matrix.scale(randomScale)

    randColor.setHSL(MathUtils.randFloat(0, 1), 1, 0.1)
    randColor.multiplyScalar(10)
    instancedParticles.setColorAt(index, randColor)
    instancedParticles.setMatrixAt(index, matrix)
  }

  particleTween = new Tween(instancedParticles.rotation)
    .to({
      y: Math.PI * 4,
    })
    .duration(1200000)

  particleTween.start()
  scene.add(instancedParticles)
}

function setupEffects() {
  composer = new EffectComposer(renderer)

  renderPass = new RenderPass(scene, camera)

  composer.addPass(renderPass)

  allPasses.n8ao = new N8AOPostPass(scene, camera)
  composer.addPass(allPasses.n8ao)
  enabledPasses.push(allPasses.n8ao)
  // const color = new Color()
  allPasses.n8ao.configuration.color.set(0x342e84).convertLinearToSRGB()
  allGui.n8ao = (aoFol) => {
    aoFol.addColor(allPasses.n8ao.configuration, "color")
    aoFol.add(allPasses.n8ao.configuration, "aoSamples", 1.0, 64.0, 1.0)
    aoFol.add(allPasses.n8ao.configuration, "denoiseSamples", 1.0, 64.0, 1.0)
    aoFol.add(allPasses.n8ao.configuration, "denoiseRadius", 0.0, 24.0, 0.01)
    aoFol.add(allPasses.n8ao.configuration, "aoRadius", 0.01, 10.0, 0.01)
    aoFol.add(allPasses.n8ao.configuration, "distanceFalloff", 0.0, 10.0, 0.01)
    aoFol.add(allPasses.n8ao.configuration, "intensity", 0.0, 20.0, 0.01)
  }

  allEffects.bloom = new BloomEffect({
    mipmapBlur: true,
    intensity: 15,
    resolutionScale: 0.5,
  })
  allGui.bloom = (folder) => {
    folder.open()
    folder.add(allEffects.bloom, "intensity", 1.0, 64.0, 1.0)
  }

  allEffects.chromaticAberration = new ChromaticAberrationEffect({
    modulationOffset: 0.5,
    offset: new Vector2(0.01, 0.01),
    radialModulation: true,
  })
  allGui.chromaticAberration = (folder) => {
    folder.open()
    folder.add(allEffects.chromaticAberration, "modulationOffset", 0, 1)
    folder.add(allEffects.chromaticAberration.offset, "x", 0, 1)
    folder.add(allEffects.chromaticAberration.offset, "y", 0, 1)
  }

  allEffects.depthOfField = new DepthOfFieldEffect(camera, {
    resolutionScale: 0.5,
    bokehScale: 15,
    worldFocusRange: 30,
  })

  allEffects.depthOfField.target = focusPoint
  allGui.depthOfField = (folder) => {
    folder.open()
    folder.add(allEffects.depthOfField, "bokehScale", 1, 20)
    folder.add(allEffects.depthOfField.cocMaterial, "worldFocusRange", 5, 30)

    folder.add(focusPoint, "x", -5, 5)
    folder.add(focusPoint, "y", -5, 5)
    folder.add(focusPoint, "z", -5, 5)
  }

  allEffects.vignette = new VignetteEffect({ eskil: true })
  allEffects.tiltShift = new TiltShiftEffect()

  // allEffects.smaa = new SMAAEffect()
  // allEffects.fxaa = new FXAAEffect()

  const effectsFol = gui.addFolder("POST PROCESSING")
  effectsFol.open()
  const createToggle = (gui, folder, enabledItems, name, effect) => {
    const guiToggle = {
      enabled: composer.passes.includes(effect),
      editFolder: null,
    }

    const destroy = () => {
      if (guiToggle.editFolder) {
        guiToggle.editFolder.destroy()
        guiToggle.editFolder = null
      }
    }

    gui
      .add(guiToggle, "enabled")
      .name(name)
      .onChange((v) => {
        updateEffects(enabledItems, effect, v)
        if (v) {
          guiToggle.editFolder = folder.addFolder(name)
          if (allGui[name]) allGui[name](guiToggle.editFolder)
        } else {
          destroy()
        }
      })
  }

  for (const [name, pass] of Object.entries(allPasses)) {
    if (pass) createToggle(effectsFol, effectsFol, enabledPasses, name, pass)
  }

  for (const [name, effect] of Object.entries(allEffects)) {
    if (effect) createToggle(effectsFol, effectsFol, enabledEffects, name, effect)
  }
}

/**
 * Edit effect/pass
 * @param {Array} array
 * @param {Effect|Pass} item
 */
function updateEffects(array, item, add = true) {
  if (add) {
    // Item doesn't exist in the array, so add it
    array.push(item)
  } else {
    const index = array.indexOf(item)
    // Item exists in the array, so remove it
    if (index !== -1) {
      array.splice(index, 1)
    }
  }
  console.log(array)
  const oldPasses = [...composer.passes]
  composer.removeAllPasses()

  oldPasses.forEach((pass) => pass.dispose())

  composer.addPass(renderPass)
  if (enabledPasses.includes(allPasses.n8ao)) {
    composer.addPass(allPasses.n8ao, 1)
  }

  if (enabledEffects.length) composer.addPass(new EffectPass(camera, ...enabledEffects))
}

function randomDist() {
  // Constants
  const radius = 40 // Radius of the circular area
  const numBoxes = 1000 // Number of boxes
  const boxSize = 1 // Size of each box
  const fixedY = 0 // Fixed Y position for all boxes

  // Create box geometry
  const boxGeometry = new BoxGeometry(boxSize, boxSize, boxSize).translate(0, 0.5, 0)

  // Create instance matrix attribute
  const instanceMatrix = new Matrix4()

  // Create instanced mesh
  const instancedMesh = new InstancedMesh(boxGeometry, new MeshBasicMaterial({ color: 0x00ff00 }), numBoxes)

  mainObjects.add(instancedMesh)
  instancedMesh.scale.setScalar(0.001)

  new Tween(instancedMesh.scale).to({ x: 1, y: 1, z: 1 }).easing(Easing.Quadratic.Out).delay(2000).start()

  // Array to store box positions
  const boxPositions = []

  // Function to check if a new box position intersects with existing boxes
  function intersectsExistingBoxes(position) {
    for (let i = 0; i < boxPositions.length; i++) {
      const existingPosition = boxPositions[i]
      const dx = existingPosition.x - position.x
      const dz = existingPosition.z - position.z
      const distanceSquared = dx * dx + dz * dz

      if (distanceSquared < boxSize * boxSize) {
        return true
      }
    }
    return false
  }

  // Function to generate a random position within the circular area
  function generateRandomPosition() {
    const angle = Math.random() * Math.PI * 2
    let x = Math.cos(angle) * (Math.random() * radius)
    let z = Math.sin(angle) * (Math.random() * radius)

    if (Math.abs(x) < 5 && Math.abs(z) < 5) {
      x += Math.random() > 0.5 ? MathUtils.randFloat(4, 5) : MathUtils.randFloat(-4, -5)
      z += Math.random() > 0.5 ? MathUtils.randFloat(4, 5) : MathUtils.randFloat(-4, -5)
    }
    return new Vector3(x, fixedY, z)
  }

  // Create and position boxes randomly
  for (let i = 0; i < numBoxes; i++) {
    let position
    let attempts = 0
    do {
      position = generateRandomPosition()

      attempts++
      if (attempts > 1000) {
        console.log(
          "Failed to find a suitable position for a box. Consider increasing the circular area or reducing the number of boxes."
        )
        break
      }
    } while (intersectsExistingBoxes(position))

    if (attempts <= 1000) {
      instanceMatrix.identity()
      instanceMatrix.makeRotationY(MathUtils.randFloat(-Math.PI * 0.05, Math.PI * 0.05))
      instanceMatrix.setPosition(position)
      instanceMatrix.scale(new Vector3(1, MathUtils.randFloat(1, 5), 1))

      instancedMesh.setMatrixAt(i, instanceMatrix)

      boxPositions.push(position)
    }
  }

  instancedMesh.instanceMatrix.needsUpdate = true // Update instance matrix
}
