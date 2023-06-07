import Stats from "three/examples/jsm/libs/stats.module"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"
import { TransformControls } from "three/examples/jsm/controls/TransformControls"
import {
  ACESFilmicToneMapping,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
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
  IcosahedronGeometry,
  MeshPhongMaterial,
  Clock,
  AnimationMixer,
  MeshPhysicalMaterial,
  LoopOnce,
  TextureLoader,
  RepeatWrapping,
  ClampToEdgeWrapping,
  Fog,
  TetrahedronGeometry,
  AnimationAction,
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
  GodRaysEffect,
  KernelSize,
} from "postprocessing"
import { MODEL_LIST, MODEL_LOADER } from "./MODEL_LIST"

let stats,
  /**
   * @type {WebGLRenderer}
   */
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
  godRays: null,
}

let renderPass
const allPasses = {
  n8ao: null,
}

const divs = {
  text: null,
}

const allGui = {
  n8ao: () => {},
  bloom: () => {},
  chromaticAberration: () => {},
  depthOfField: () => {},
  vignette: () => {},
  tiltShift: () => {},
  godRays: () => {},
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
let clock, mixer

const maxTarget = new Vector3(0, 2, 0)
const minTarget = new Vector3(0, 10, 0)

export default async function AnisotropyAngel(mainGui) {
  createDivs()

  clock = new Clock()
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
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping

  app.appendChild(renderer.domElement)

  // camera
  camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 150)
  camera.position.set(0, 5, 25)
  // scene
  scene = new Scene()
  scene.add(mainObjects)

  // custom vector to perform focus
  scene.focus = new Vector3()

  scene.fog = new Fog(0xff0000, 1, 100)
  sceneGui.addColor(scene.fog, "color")
  sceneGui.add(scene.fog, "near")
  sceneGui.add(scene.fog, "far")

  // controls
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true // an animation loop is required when either damping or auto-rotation are enabled
  controls.enablePan = false
  controls.dampingFactor = 0.05
  controls.minDistance = 10
  controls.maxDistance = 40
  controls.minPolarAngle = Math.PI / 4
  controls.maxPolarAngle = Math.PI / 2
  controls.minAzimuthAngle = -Math.PI / 2.5
  controls.maxAzimuthAngle = -controls.minAzimuthAngle

  const cameraMotionLock = () => {
    const lerpAlpha = MathUtils.mapLinear(controls.getDistance(), controls.minDistance, controls.maxDistance, 0, 1)
    controls.target.lerpVectors(minTarget, maxTarget, lerpAlpha)
  }

  controls.addEventListener("change", cameraMotionLock)
  cameraMotionLock()

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

  console.log("loading...")
  setupEffects()

  await Promise.all([setupBackground(), setupModels()])
  console.log("loading done!")
  setupParticles()
  setupCity()

  divs.text.remove()

  // sceneGui.add(transformControls, "mode", ["translate", "rotate", "scale"])

  // await setupModels()

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
      // fitModelInViewport(mainObjects)
    }
    lastPointerEvent = event
    lastClickTime = clickTime
  }

  function calculateDistance(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2))
  }

  const targetElement = app
  targetElement.addEventListener("pointerdown", handlePointerDown)

  focusTween.onUpdate(() => {
    focusPoint.lerp(dummyObj.toFocus, 0.1)
  })

  animate()
}

function createDivs() {
  const textDiv = document.createElement("div")
  divs.text = textDiv
  textDiv.textContent = "Be Not Afraid"
  textDiv.id = "text"
  textDiv.style.position = "fixed"
  textDiv.style.top = "50%"
  textDiv.style.left = "50%"
  textDiv.style.transform = "translate(-50%, -50%)"
  textDiv.style.textAlign = "center"
  textDiv.style.color = "white"
  textDiv.style.textShadow = "8px 8px 8px grey"
  textDiv.style.fontSize = "10vw" // Use viewport units instead of pixels
  textDiv.style.fontFamily = "Arial, sans-serif"
  textDiv.style.width = "100%"
  document.body.appendChild(textDiv)
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
  mixer?.update(clock.getDelta())
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
  if (intersects[0].object.onRaycast) {
    intersects[0].object.onRaycast()
  }

  intersects.length = 0
}

function onPointerMove(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1
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
  sunLight.position.set(0, 25, -25)
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

let instancedParticles, particleTween

function setupEffects() {
  composer = new EffectComposer(renderer)

  renderPass = new RenderPass(scene, camera)

  composer.addPass(renderPass)

  allPasses.n8ao = new N8AOPostPass(scene, camera)
  composer.addPass(allPasses.n8ao)
  allPasses.n8ao.configuration.color.set(0x342e84).convertLinearToSRGB()
  allPasses.n8ao.configuration.intensity = 20
  allPasses.n8ao.configuration.halfResolution = true
  const n8Params = {
    renderMode: "combined",
  }
  allGui.n8ao = (aoFol) => {
    aoFol.addColor(allPasses.n8ao.configuration, "color")
    aoFol.add(allPasses.n8ao.configuration, "aoSamples", 1.0, 64.0, 1.0)
    aoFol.add(allPasses.n8ao.configuration, "denoiseSamples", 1.0, 64.0, 1.0)
    aoFol.add(allPasses.n8ao.configuration, "denoiseRadius", 0.0, 24.0, 0.01)
    aoFol.add(allPasses.n8ao.configuration, "aoRadius", 0.01, 10.0, 0.01)
    aoFol.add(allPasses.n8ao.configuration, "distanceFalloff", 0.0, 10.0, 0.01)
    aoFol.add(allPasses.n8ao.configuration, "intensity", 0.0, 20.0, 0.01)

    aoFol.add(n8Params, "renderMode", ["Combined", "AO", "No AO", "Split", "Split AO"]).onChange((v) => {
      allPasses.n8ao.configuration.renderMode = ["Combined", "AO", "No AO", "Split", "Split AO"].indexOf(v)
    })
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
    folder.add(allEffects.depthOfField.resolution, "scale", 0.01, 1)
    folder.add(focusPoint, "x", -5, 5)
    folder.add(focusPoint, "y", -5, 5)
    folder.add(focusPoint, "z", -5, 5)
  }

  allEffects.vignette = new VignetteEffect({ eskil: true })
  allEffects.tiltShift = new TiltShiftEffect()

  // allEffects.smaa = new SMAAEffect()
  // allEffects.fxaa = new FXAAEffect()

  const sun = new Mesh(
    new IcosahedronGeometry(1, 3),
    new MeshBasicMaterial({
      color: 0xffddaa,
      transparent: true,
      fog: false,
    })
  )

  sun.position.set(0, 25, -50)
  sun.scale.setScalar(30)
  sun.updateMatrix()
  sun.frustumCulled = false

  allEffects.godRays = new GodRaysEffect(camera, sun, {
    kernelSize: KernelSize.SMALL,
    density: 0.45,
    decay: 0.9,
    weight: 0.15,
    exposure: 0.54,
    samples: 32,
    resolutionScale: 0.5,
  })

  allGui.godRays = (gui) => {
    const effect = allEffects.godRays
    const godRaysMaterial = effect.godRaysMaterial
    const folder = gui
    folder.add(effect.resolution, "scale", 0.1, 1, 0.05)
    folder.add(effect, "blur")
    folder.add(effect.blurPass, "kernelSize", KernelSize)
    folder.add(godRaysMaterial, "density", 0, 1, 0.01)
    folder.add(godRaysMaterial, "decay", 0, 1, 0.01)
    folder.add(godRaysMaterial, "weight", 0, 1, 0.01)
    folder.add(godRaysMaterial, "exposure", 0, 1, 0.01)
    folder.add(godRaysMaterial, "maxIntensity", 0, 1, 0.01)
    folder.add(godRaysMaterial, "samples", 16, 128, 1)
    folder.addColor(sun.material, "color").onChange((e) => sun.material.color.convertSRGBToLinear())
    folder.add(effect.blendMode.opacity, "value", 0, 1, 0.01)
    folder
      .add(sun.position, "y", 0, 50)
      .name("sun pos y")
      .onChange(() => {
        sun.updateMatrix()
      })
    folder
      .add(sun.position, "z", -100, 0)
      .name("sun pos z")
      .onChange(() => {
        sun.updateMatrix()
      })

    folder
      .add(sun.scale, "y", 0, 60)
      .name("sun scale")
      .onChange((v) => {
        sun.scale.setScalar(v)
        sun.updateMatrix()
      })
  }

  updateEffects(enabledPasses, allPasses.n8ao, true)
  updateEffects(enabledEffects, allEffects.godRays, true)
  updateEffects(enabledEffects, allEffects.bloom, true)
  updateEffects(enabledEffects, allEffects.chromaticAberration, true)
  updateEffects(enabledEffects, allEffects.vignette, true)

  const effectsFol = gui.addFolder("POST PROCESSING")
  effectsFol.open()
  const createToggle = (gui, folder, enabledItems, name, effect) => {
    const guiToggle = {
      enabled: enabledPasses.includes(effect) || enabledEffects.includes(effect),
      editFolder: null,
    }

    const destroy = () => {
      if (guiToggle.editFolder) {
        guiToggle.editFolder.destroy()
        guiToggle.editFolder = null
      }
    }

    const create = () => {
      guiToggle.editFolder = folder.addFolder(name)
      if (allGui[name]) allGui[name](guiToggle.editFolder)
    }

    gui
      .add(guiToggle, "enabled")
      .name(name)
      .onChange((v) => {
        updateEffects(enabledItems, effect, v)
        if (v) {
          create()
        } else {
          destroy()
        }
      })

    if (guiToggle.enabled) create()
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

  if (enabledEffects.includes(allEffects.depthOfField)) {
    const index = enabledEffects.indexOf(allEffects.depthOfField)
    if (index > 0) {
      enabledEffects.splice(index, 1)
      enabledEffects.unshift(allEffects.depthOfField)
    }
  }

  if (enabledEffects.length) composer.addPass(new EffectPass(camera, ...enabledEffects))
}

function setupCity() {
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
  const instancedMesh = new InstancedMesh(boxGeometry, new MeshStandardMaterial({ color: 0x0000ff }), numBoxes)

  mainObjects.add(instancedMesh)
  instancedMesh.scale.y = 0.001

  new Tween(instancedMesh.scale).to({ x: 1, y: 1, z: 1 }).easing(Easing.Back.Out).duration(2000).delay(100).start()

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
  const vec = new Vector3()
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
      instanceMatrix.scale(vec.set(1, MathUtils.randFloat(0.1, 5), 1))

      instancedMesh.setMatrixAt(i, instanceMatrix)

      boxPositions.push(position)
    }
  }
  instancedMesh.castShadow = true
  instancedMesh.receiveShadow = true
  instancedMesh.instanceMatrix.needsUpdate = true // Update instance matrix
}

const setupParticles = () => {
  const spread = 50

  const geo = new TetrahedronGeometry(0.02)
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

async function setupModels() {
  const gltfPromise = MODEL_LOADER(MODEL_LIST.angel.url)
  const texLoader = new TextureLoader()
  const anisoTexPromise = texLoader.loadAsync("./textures/aniso.png")

  const [anisoTexture, gltf] = await Promise.all([anisoTexPromise, gltfPromise])
  const model = gltf.scene
  let featherMesh

  anisoTexture.wrapS = anisoTexture.wrapT = RepeatWrapping

  let anisoMat

  let idleAction, raiseAction, coverAction

  model.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = true
      node.receiveShadow = true

      if (node.material.name === "Feather") {
        featherMesh = node
      }

      if (node.material.isMeshPhysicalMaterial) {
        node.material.anisotropy = 1
        node.material.anisotropyMap = anisoTexture
        anisoMat = node.material
      }
    }

    if (node.material && node.material.transparent) {
      node.material.depthWrite = true
      node.material.depthTest = true
      // node.material.transparent = false
      node.material.alphaTest = 0.5
    }
  })

  const anisoMesh = model.getObjectByName("eyeball")
  const eyelidBot = model.getObjectByName("eyelid_bottom")
  const eyelidTop = model.getObjectByName("eyelid_top")
  const ring1Mesh = model.getObjectByName("ring_1")
  const ring2Mesh = model.getObjectByName("ring_2")

  const eyeLidTopOpenRot = eyelidTop.rotation.clone()
  const eyeLidBotOpenRot = eyelidBot.rotation.clone()

  eyelidTop.rotation.set(0, 0, 0)
  eyelidBot.rotation.set(0, 0, 0)

  const normalMap = anisoMat.normalMap
  normalMap.wrapS = normalMap.wrapT = ClampToEdgeWrapping
  normalMap.needsUpdate = true

  if (gltf.animations) {
    const animations = gltf.animations
    console.log({ animations })
    mixer = new AnimationMixer(gltf.scene)
    idleAction = mixer.clipAction(animations[0])

    raiseAction = mixer.clipAction(animations[1])
    raiseAction.loop = LoopOnce

    coverAction = mixer.clipAction(animations[2])
    coverAction.loop = LoopOnce

    // gui.add(idleAction, "time", 0, idleAction.getClip().duration).listen().disable()
    // gui.add(raiseAction, "time", 0, raiseAction.getClip().duration).listen().disable()

    mixer.addEventListener("finished", (e) => {
      console.log("finished", e)
      if (e.action === raiseAction || e.action === coverAction) {
        idleAction.reset()
        idleAction.fadeIn(1)
        idleAction.play()
      }
    })

    featherMesh.onRaycast = () => {
      if (raiseAction.isRunning()) {
        return
      }

      if (coverAction.isRunning()) {
        coverAction.fadeOut(0.1)
      }
      raiseAction.reset()
      raiseAction.crossFadeFrom(idleAction, 0.5)
      raiseAction.play()
    }

    anisoMesh.onRaycast = () => {
      if (coverAction.isRunning()) {
        return
      }
      if (raiseAction.isRunning()) {
        raiseAction.fadeOut(0.1)
      }
      coverAction.reset()
      coverAction.crossFadeFrom(idleAction, 0.5)
      coverAction.play()
      closeEyes(1500, 500)
      anisoRotateTw.startFromCurrentValues()
    }
  }

  // Aniso tweens

  const anisoRotateTw = new Tween(anisoMat)
    .to({ anisotropyRotation: Math.PI * 10 }, 1e4)
    .easing(Easing.Quadratic.InOut)
    .onComplete(() => {
      closeEyes()
    })
  const anisoRepeatTw = new Tween(anisoTexture.repeat)
    .to({ x: 10, y: 10 }, 500)
    .repeat(1)
    .repeatDelay(200)
    .yoyo(true)
    .easing(Easing.Quadratic.InOut)
    .onComplete(() => {
      closeEyes()
    })

  // Eye ball look around randomly

  const eyeBallTw = new Tween(anisoMesh.rotation)
    .to({ y: 0 })
    .onEveryStart(() => {
      eyeBallTw._valuesStart = { x: anisoMesh.rotation.x, y: anisoMesh.rotation.y, z: anisoMesh.rotation.z }
      if (eyeBallTw._repeat === 0) {
        eyeBallTw._valuesEnd = { x: 0, y: 0 }
      } else {
        eyeBallTw._valuesEnd = {
          x: MathUtils.randFloatSpread(Math.PI / 4),
          y: MathUtils.randFloatSpread(Math.PI / 4),
        }
      }
      console.log(eyeBallTw._repeat)
    })
    .repeat(3)
    .duration(500)
    .easing(Easing.Back.Out)
    .onComplete(() => {
      setTimeout(() => {
        eyeBallTw._repeat = MathUtils.randInt(1, 5)
        eyeBallTw.delay(MathUtils.randInt(100, 1000))
        eyeBallTw.startFromCurrentValues()
        anisoRotateTw.startFromCurrentValues()
      }, MathUtils.randInt(2000, 8000))
    })

  // rings tweens
  const ring1Reset = new Tween(ring1Mesh.rotation)
    .to({ x: -Math.PI / 3, y: 0, z: 0 })
    .easing(Easing.Back.Out)
    .duration(4000)
    .onComplete(() => {
      ring1Tween.start()
    })
  const ring2Reset = new Tween(ring2Mesh.rotation)
    .to({ x: Math.PI / 3, y: 0, z: 0 })
    .easing(Easing.Back.Out)
    .duration(4000)
    .onComplete(() => {
      ring2Tween.start()
    })
  const ring1Tween = new Tween(ring1Mesh.rotation)
    .to({ x: 0, y: 0, z: 0 })
    .duration(4e4)
    .easing(Easing.Quadratic.InOut)
    .onEveryStart(() => {
      ring1Tween._valuesStart = {
        x: ring1Mesh.rotation.x,
        y: ring1Mesh.rotation.y,
        z: ring1Mesh.rotation.z,
      }

      ring1Tween._valuesEnd = {
        x: MathUtils.randFloatSpread(4 * Math.PI),
        y: MathUtils.randInt(-10, 10) * Math.PI,
        z: MathUtils.randFloatSpread(4 * Math.PI),
      }
    })
    .repeat(1000)

  const ring2Tween = new Tween(ring2Mesh.rotation)
    .to({ x: 0, y: 0, z: 0 })
    .duration(4e4)
    .easing(Easing.Quadratic.InOut)
    .onEveryStart(() => {
      ring2Tween._valuesStart = {
        x: ring2Mesh.rotation.x,
        y: ring2Mesh.rotation.y,
        z: ring2Mesh.rotation.z,
      }

      ring2Tween._valuesEnd = {
        x: MathUtils.randFloatSpread(4 * Math.PI),
        y: MathUtils.randInt(-10, 10) * Math.PI,
        z: MathUtils.randFloatSpread(4 * Math.PI),
      }
    })
    .repeat(1000)

  ring1Mesh.children.forEach((mesh) => {
    mesh.onRaycast = () => {
      console.log("ring1Mesh")
      ring1Tween.stop()
      ring1Reset.startFromCurrentValues()
    }
  })

  ring2Mesh.children.forEach((mesh) => {
    mesh.onRaycast = () => {
      console.log("ring2Mesh")
      ring2Tween.stop()
      ring2Reset.startFromCurrentValues()
    }
  })

  const eyelidTween = new Tween(eyelidTop.rotation)
    .to({ x: 0 })
    .duration(900)
    .yoyo(true)
    .repeat(1)
    .easing(Easing.Back.Out)

  const eyelidBTween = new Tween(eyelidBot.rotation)
    .to({ x: 0 })
    .duration(1200)
    .yoyo(true)
    .repeat(1)
    .easing(Easing.Back.Out)

  const closeEyes = (duration = 500, delay = 200) => {
    eyelidTween.repeatDelay(delay + 100 * (Math.random() < 0.5 ? -1 : 1))
    eyelidBTween.repeatDelay(delay + 100 * (Math.random() < 0.5 ? -1 : 1))
    eyelidTween.duration(duration + 100 * (Math.random() < 0.5 ? -1 : 1))
    eyelidBTween.duration(duration + 100 * (Math.random() < 0.5 ? -1 : 1))
    eyelidTween.startFromCurrentValues()
    eyelidBTween.startFromCurrentValues()

    anisoRepeatTw.startFromCurrentValues()
  }

  eyelidTop.onRaycast = closeEyes
  eyelidBot.onRaycast = closeEyes

  model.scale.setScalar(0.001)
  model.position.set(0, 15, -100)

  mainObjects.add(model)

  ring1Tween.startFromCurrentValues()
  ring2Tween.startFromCurrentValues()
  const posTween = new Tween(model.position)
    .to({ x: 0, y: 10, z: 0 })
    .easing(Easing.Back.Out)
    .delay(5000)
    .duration(10000)
    .onComplete(() => {
      anisoMesh.getWorldPosition(minTarget)

      idleAction.fadeIn(1)
      idleAction.play()

      new Tween(eyelidBot.rotation).to({ x: eyeLidBotOpenRot.x }).easing(Easing.Back.Out).start()

      new Tween(eyelidTop.rotation)
        .to({ x: eyeLidTopOpenRot.x })
        .easing(Easing.Back.Out)
        .onComplete(() => {
          eyeBallTw.startFromCurrentValues()
        })
        .start()
    })
    .start()
  new Tween(model.scale).to({ x: 10, y: 10, z: 10 }).duration(8000).easing(Easing.Quadratic.Out).delay(3000).start()

  const floor = new Mesh(
    new CircleGeometry(40, 64).rotateX(-Math.PI / 2),
    new MeshStandardMaterial({ color: 0x0000ff })
  )
  floor.receiveShadow = true
  mainObjects.add(floor)

  renderer.toneMappingExposure = 0
  renderer.compile(scene, camera)
  render()
  new Tween(renderer).to({ toneMappingExposure: 1 }).duration(8000).easing(Easing.Quadratic.Out).start()
}
