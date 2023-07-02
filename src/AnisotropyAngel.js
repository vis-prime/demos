import Stats from "three/examples/jsm/libs/stats.module"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"
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
  Vector3,
  MathUtils,
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
  Clock,
  AnimationMixer,
  LoopOnce,
  TextureLoader,
  RepeatWrapping,
  ClampToEdgeWrapping,
  Fog,
  TetrahedronGeometry,
  AnimationAction,
  AudioListener,
  Audio as THREEAudio,
  AudioAnalyser,
  Euler,
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
  VignetteEffect,
  DepthOfFieldEffect,
  GodRaysEffect,
  KernelSize,
} from "postprocessing"
import { MODEL_LIST, MODEL_LOADER } from "./MODEL_LIST"
import { CameraShake } from "./CameraShake"

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

let enableRaycast = false
const raycaster = new Raycaster()
const intersects = [] //raycast
const chromaticAberrationOffset = new Vector2(0.01, 0.01)
/**
 * @type {BG_ENV}
 */
let bg_env

const allEffects = {
  bloom: null,
  chromaticAberration: null,

  depthOfField: null,
  vignette: null,
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
  enterButton: null,
}

const allGui = {
  n8ao: () => {},
  bloom: () => {},
  chromaticAberration: () => {},
  depthOfField: () => {},
  vignette: () => {},
  godRays: () => {},
}

const focusPoint = new Vector3()
const dummyObj = {
  toFocus: new Vector3(),
  fromFocus: new Vector3(),
  val: 0,
}
let focusTween
let clock, mixer

const maxTarget = new Vector3(0, 2, 0)
const minTarget = new Vector3(0, 10, 0)
const unalteredCameraPos = new Vector3(0, 2, 0)

let analyser, audioArrayBuffer

let angelStartTw
let cameraShake, shakeTween
let wingRoot
let basicOverrideMaterial
let instancedParticles, particleTween

export default async function AnisotropyAngel(mainGui) {
  focusTween = new Tween(dummyObj).to({ val: 1 }, 1e6)
  createDivs()
  basicOverrideMaterial = new MeshBasicMaterial()
  clock = new Clock()
  gui = mainGui
  gui.close()
  stats = new Stats()
  app.appendChild(stats.dom)
  // renderer
  renderer = new WebGLRenderer({ powerPreference: "high-performance", antialias: false, stencil: false, depth: false })
  renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio))
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = VSMShadowMap
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 0

  app.appendChild(renderer.domElement)

  // camera
  camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 150)
  camera.position.set(0, 8, 30)
  // scene
  scene = new Scene()
  scene.add(mainObjects)

  // custom vector to perform focus
  scene.focus = focusPoint

  scene.fog = new Fog(0xff0000, 1, 100)

  // controls
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.enablePan = false
  controls.dampingFactor = 0.05
  controls.minDistance = 10
  controls.maxDistance = 44
  controls.minPolarAngle = Math.PI / 4
  controls.maxPolarAngle = Math.PI / 2
  controls.minAzimuthAngle = -Math.PI / 2.5
  controls.maxAzimuthAngle = -controls.minAzimuthAngle

  cameraShake = CameraShake(camera, controls)
  // cameraShake.addGui(gui)

  let shakeTimeout
  shakeTween = new Tween(cameraShake.prop).to({ intensity: 1 }, 2e3).easing(Easing.Quadratic.InOut)
  const cameraMotionLock = () => {
    unalteredCameraPos.copy(camera.position)
    const dist = controls.getDistance()
    cameraShake.prop.decay = true
    const lerpAlpha = MathUtils.mapLinear(dist, controls.minDistance, controls.maxDistance, 0, 1)
    controls.target.lerpVectors(minTarget, maxTarget, lerpAlpha)
    scene.fog.far = MathUtils.mapLinear(dist, controls.minDistance, controls.maxDistance, 30, 150)

    clearTimeout(shakeTimeout)
    shakeTimeout = setTimeout(() => {
      cameraShake.prop.decay = false
      shakeTween.startFromCurrentValues()
    }, 200)
  }

  controls.addEventListener("change", cameraMotionLock)
  cameraMotionLock()

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
  setupParticles()
  setupCity()
  await Promise.all([setupBackground(), setupModels(), loadAudioBuffer()])

  document.body.appendChild(divs.button)

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
      // console.log("Double click detected!")
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

  // compile
  renderer.compile(scene, camera)
  render()

  const fogGui = gui.addFolder("Fog")
  fogGui.addColor(scene.fog, "color")
  fogGui.add(scene.fog, "near", 0, 150)
  fogGui.add(scene.fog, "far", 2, 150)
}

function createDivs() {
  const textDiv = document.createElement("div")
  divs.text = textDiv
  textDiv.textContent = ""
  const textList = [
    "Be",
    "Be Not",
    "Be Not Afraid",
    "Be Not Afraid.",
    "Be Not Afraid..",
    "Be Not Afraid...",
    "Loading.",
    "Loading..",
    "Loading...",
    "umm...",
    "Still Loading...",
    "Should've added a loading bar",
    "Yeah, this is taking a while...",
  ]
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
  textDiv.style.fontFamily = "Courier New , monospace"
  textDiv.style.width = "100%"
  document.body.appendChild(textDiv)

  let currentIndex = 0

  const changeText = () => {
    textDiv.textContent = textList[currentIndex]
    currentIndex = (currentIndex + 1) % textList.length // Move to the next text in the array

    // Uncomment the line below if you want to stop after cycling through all texts
    if (button.parentNode) {
      clearInterval(interval)
      textDiv.textContent = `B̶̓e̸̡̓̄ N̴̦͉̓ö̶͓́̃t̴̕ Å̶͓̼͛f̵̹͑r̶̚a̶̪̾i̷d`
    }
  }

  const interval = setInterval(changeText, 2000)

  const button = document.createElement("button")
  divs.button = button
  button.textContent = "Begin"
  button.style.position = "fixed"
  button.style.top = "60%"
  button.style.left = "50%"
  button.style.transform = "translate(-50%, -50%)"
  button.style.padding = "10px 20px"
  button.style.fontSize = "1.5rem"
  button.style.backgroundColor = "blue"
  button.style.color = "white"
  button.style.border = "none"
  button.style.borderRadius = "5px"
  button.onclick = async () => {
    button.remove()
    textDiv.remove()

    startShow()
  }
  // textDiv.appendChild(button)
}

// Function to load and set the audio buffer
const loadAudioBuffer = async () => {
  const file = "./audio/watr-fluid-10149.mp3"

  try {
    const response = await fetch(file)
    audioArrayBuffer = await response.arrayBuffer()
  } catch (error) {
    console.error("Error loading audio:", error)
  }
}

async function setupAudio() {
  const listener = new AudioListener()

  const audio = new THREEAudio(listener)
  const audioFiltered = new THREEAudio(listener)
  // const file = "./audio/watr-fluid-10149.mp3"

  // const loader = new AudioLoader()
  // const buffer = await loader.loadAsync(file)
  const buffer = await listener.context.decodeAudioData(audioArrayBuffer)

  audio.setLoop(true)
  audioFiltered.setLoop(true)
  audio.setBuffer(buffer)
  audioFiltered.setBuffer(buffer)

  // Create a low-pass filter
  const context = listener.context
  const filter = context.createBiquadFilter()
  filter.type = "lowpass"
  filter.frequency.value = 100 // Adjust the cutoff frequency as needed
  // gui.add(filter.frequency, "value", 0, 255)
  audioFiltered.setFilter(filter)

  const fftSize = 32
  analyser = new AudioAnalyser(audioFiltered, fftSize)

  audio.play()
  audioFiltered.play()
}

function startShow() {
  animate()
  angelStartTw.start()
  new Tween(renderer).to({ toneMappingExposure: 1 }).duration(8000).easing(Easing.Quadratic.Out).start()
  setupAudio()
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  composer.setSize(window.innerWidth, window.innerHeight)
}

function render() {
  const delta = clock.getDelta()
  stats.update()
  update()
  controls.update()
  cameraShake.update(clock, delta)

  mixer?.update(delta)
  // renderer.render(scene, camera)
  composer.render()
}

function animate() {
  renderer.setAnimationLoop(render)
}

function raycast() {
  if (!enableRaycast) {
    return
  }
  // update the picking ray with the camera and pointer position
  raycaster.setFromCamera(pointer, camera)

  // calculate objects intersecting the picking ray
  raycaster.intersectObject(mainObjects, true, intersects)

  if (!intersects.length) {
    // n8ao change view
    if (allPasses.n8ao.configuration.renderMode === 0) {
      allPasses.n8ao.configuration.renderMode = 1
      allEffects.bloom.intensity = 0
      scene.overrideMaterial = basicOverrideMaterial
    } else {
      allPasses.n8ao.configuration.renderMode = 0
      allEffects.bloom.intensity = 15
      scene.overrideMaterial = null
    }

    if (wingRoot) {
      const array = ["x", "y", "z"]
      const randomValue = array[Math.floor(Math.random() * array.length)]

      new Tween(wingRoot.rotation)
        .to({ [randomValue]: 2 * Math.PI })
        .start()
        .easing(Easing.Back.Out)
        .onComplete(() => {
          wingRoot.rotation.set(0, 0, 0)
        })
    }
    return
  }
  focusTween.stop()
  dummyObj.toFocus.copy(intersects[0].point)

  focusTween.start()

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

  //   0xffffeb
  const sunLight = new DirectionalLight("yellow", 8)
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

  const lightFolder = gui.addFolder("Light")
  lightFolder.add(sunLight, "intensity", 0.1, 20)
  lightFolder.addColor(sunLight, "color")

  const twObj = {
    val: 0,
  }
  const radius = 25
  const startAngle = MathUtils.degToRad(-180 + 45)
  const endAngle = MathUtils.degToRad(0 - 45)

  new Tween(twObj)
    .to({ val: 1 })
    .duration(5e3)
    .yoyo(true)
    .repeatDelay(200)
    .easing(Easing.Quadratic.InOut)
    .repeat(1e4)
    .onUpdate((e) => {
      const angle = MathUtils.lerp(startAngle, endAngle, e.val) // Calculate the angle based on the current progress

      // Calculate the new position using sine and cosine functions
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius

      // Set the new position of the light
      sunLight.position.x = x
      sunLight.position.z = z
    })
    .start()
}

function setupEffects() {
  composer = new EffectComposer(renderer)

  renderPass = new RenderPass(scene, camera)

  allPasses.n8ao = new N8AOPostPass(scene, camera)
  allPasses.n8ao.configuration.color.set(0x342e84).convertLinearToSRGB()
  allPasses.n8ao.configuration.intensity = 20
  allPasses.n8ao.setQualityMode("Medium")
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
    aoFol.add(allPasses.n8ao.configuration, "halfRes")
    aoFol.add(n8Params, "renderMode", ["Combined", "AO", "No AO", "Split", "Split AO"]).onChange((v) => {
      allPasses.n8ao.configuration.renderMode = ["Combined", "AO", "No AO", "Split", "Split AO"].indexOf(v)
    })
  }

  allEffects.bloom = new BloomEffect({
    luminanceThreshold: 1,
    mipmapBlur: true,
    intensity: 15,
    resolutionScale: 0.3,
  })
  allGui.bloom = (folder) => {
    folder.add(allEffects.bloom.luminanceMaterial, "threshold", 0, 2)
    folder.add(allEffects.bloom, "intensity", 1.0, 64.0, 1.0)
    folder.add(allEffects.bloom.resolution, "scale", 0.01, 1).name("resolutionScale")
  }

  allEffects.chromaticAberration = new ChromaticAberrationEffect({
    modulationOffset: 0.5,
    offset: chromaticAberrationOffset,
    radialModulation: true,
  })
  allGui.chromaticAberration = (folder) => {
    folder.add(allEffects.chromaticAberration, "radialModulation")
    folder.add(allEffects.chromaticAberration, "modulationOffset", 0, 1)
    folder.add(allEffects.chromaticAberration.offset, "x", 0, 1)
    folder.add(allEffects.chromaticAberration.offset, "y", 0, 1)
  }

  allEffects.depthOfField = new DepthOfFieldEffect(camera, {
    resolutionScale: 0.4,
    bokehScale: 15,
    worldFocusRange: 40,
  })

  allEffects.depthOfField.target = focusPoint
  allGui.depthOfField = (folder) => {
    folder.add(allEffects.depthOfField, "bokehScale", 1, 20)
    folder.add(allEffects.depthOfField.cocMaterial, "worldFocusRange", 5, 120)
    folder.add(allEffects.depthOfField.resolution, "scale", 0.01, 1).name("resolutionScale")
  }

  allEffects.vignette = new VignetteEffect({ eskil: true, darkness: 0.5 })
  allGui.vignette = (folder) => {
    folder.add(allEffects.vignette, "eskil")
    folder.add(allEffects.vignette, "darkness", 0, 1)
    folder.add(allEffects.vignette, "offset", 0, 1)
  }

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
    weight: 0.35,
    exposure: 0.54,
    samples: 32,
    resolutionScale: 0.3,
  })

  allGui.godRays = (gui) => {
    const effect = allEffects.godRays
    const godRaysMaterial = effect.godRaysMaterial
    const folder = gui
    folder.add(effect.resolution, "scale", 0.1, 1, 0.05).name("resolutionScale")
    folder.add(effect, "blur")
    folder.add(effect.blurPass, "kernelSize", KernelSize)
    folder.add(godRaysMaterial, "density", 0, 1, 0.01)
    folder.add(godRaysMaterial, "decay", 0, 1, 0.01)
    folder.add(godRaysMaterial, "weight", 0, 1, 0.01)
    folder.add(godRaysMaterial, "exposure", 0, 1, 0.01)
    folder.add(godRaysMaterial, "maxIntensity", 0, 1, 0.01)
    folder.add(godRaysMaterial, "samples", 16, 128, 1)
    folder.addColor(sun.material, "color").onChange((e) => sun.material.color.convertSRGBToLinear())
  }

  composer.addPass(renderPass)
  composer.addPass(allPasses.n8ao)

  composer.addPass(
    new EffectPass(
      camera,

      // allEffects.depthOfField,
      allEffects.godRays,
      allEffects.bloom,
      allEffects.chromaticAberration,
      allEffects.vignette
    )
  )

  composer.addPass(
    new EffectPass(
      camera,

      allEffects.depthOfField
    )
  )

  const effectsFol = gui.addFolder("POST PROCESSING")
  effectsFol.open()
  const createToggle = (folder, name) => {
    const editFolder = folder.addFolder(name)
    if (allGui[name]) allGui[name](editFolder)
  }

  for (const [name, pass] of Object.entries(allPasses)) {
    if (pass) createToggle(effectsFol, name)
  }

  for (const [name, effect] of Object.entries(allEffects)) {
    if (effect) createToggle(effectsFol, name)
  }
}

function setupCity() {
  // Constants
  const radius = 40 // Radius of the circular area
  const numBoxes = 900 // Number of boxes
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
  function refreshPosScale() {
    boxPositions.length = 0

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
        instanceMatrix.scale(vec.set(1, MathUtils.randFloat(0.1, 5) + position.length() / (radius / 2), 1))

        instancedMesh.setMatrixAt(i, instanceMatrix)

        boxPositions.push(position)
      }
    }

    instancedMesh.instanceMatrix.needsUpdate = true
  }

  refreshPosScale()

  instancedMesh.castShadow = true
  instancedMesh.receiveShadow = true
  instancedMesh.onRaycast = () => {
    shiftHue()
  }

  setInterval(() => {
    if (analyser) {
      analyser.getFrequencyData()

      // Get the bass frequency range (e.g., index 0 to 10)
      const bassData = analyser.data.slice(0, 10)
      // Calculate the average value of the bass range
      const averageBass = bassData.reduce((a, b) => a + b, 0) / bassData.length
      // Map the average bass value to the scale of the mesh
      const scale = MathUtils.mapLinear(averageBass, 30, 70, 0.01, 1)

      instancedMesh.scale.y = scale
      // cameraShake.prop.maxPitch = MathUtils.clamp(MathUtils.mapLinear(averageBass, 60, 70, 0.1, 0.2), 0.1, 0.2)
    }
  }, 80)

  const floor = new Mesh(new CircleGeometry(40, 64).rotateX(-Math.PI / 2), instancedMesh.material)
  floor.receiveShadow = true
  mainObjects.add(floor)
  const hsl = {}
  const shiftHue = () => {
    floor.material.color.getHSL(hsl)
    hsl.h += 0.1 % 1
    hsl.l = 0.5
    floor.material.color.setHSL(hsl.h, hsl.s, hsl.l)
    instancedMesh.material.color.copy(floor.material.color)

    scene.fog.color.getHSL(hsl)
    hsl.h += 0.1 % 1
    scene.fog.color.setHSL(hsl.h, hsl.s, hsl.l)

    allPasses.n8ao.configuration.color.getHSL(hsl)
    hsl.h += 0.1 % 1
    allPasses.n8ao.configuration.color.setHSL(hsl.h, hsl.s, hsl.l)
  }
  floor.onRaycast = () => {
    refreshPosScale()
  }

  const fol = gui.addFolder("Boxes")
  fol.addColor(floor.material, "color")
}

const setupParticles = () => {
  const spread = 70

  const geo = new TetrahedronGeometry(0.05)
  const mat = new MeshBasicMaterial()
  mat.color.setRGB(10, 10, 10)

  instancedParticles = new InstancedMesh(geo, mat, 800)
  const matrix = new Matrix4()
  const randomScale = new Vector3()
  const randColor = new Color()
  const radius = spread / 2
  const euler = new Euler()
  const spreadAngle = Math.PI * 2 // Adjust the spread angle
  for (let index = 0; index < instancedParticles.count; index++) {
    matrix.identity()

    matrix.makeRotationFromEuler(
      euler.set(
        MathUtils.randFloatSpread(2 * Math.PI),
        MathUtils.randFloatSpread(2 * Math.PI),
        MathUtils.randFloatSpread(2 * Math.PI)
      )
    )

    const randomRadius = Math.sqrt(MathUtils.randFloat(0, 1)) * radius // Randomize the radius within the circular region
    const angle = MathUtils.randFloat(0, spreadAngle)
    const xPos = Math.cos(angle) * randomRadius
    const zPos = Math.sin(angle) * randomRadius

    matrix.setPosition(xPos, MathUtils.randFloat(0, radius / 2), zPos)

    randomScale.set(MathUtils.randFloat(1, 3), MathUtils.randFloat(1, 3), MathUtils.randFloat(1, 3))
    matrix.scale(randomScale)

    randColor.setHSL(MathUtils.randFloat(0, 1), 1, 0.1)
    randColor.multiplyScalar(100)
    instancedParticles.setColorAt(index, randColor)
    instancedParticles.setMatrixAt(index, matrix)
  }

  instancedParticles.instanceMatrix.needsUpdate = true

  particleTween = new Tween(instancedParticles.rotation)
    .to({
      y: Math.PI * 4,
    })
    .repeat(1000)
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

  let anisoMat, wingMat

  /**
   * @type {AnimationAction}
   */
  let idleAction,
    /**
     * @type {AnimationAction}
     */ raiseAction,
    /**
     * @type {AnimationAction}
     */
    coverAction

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
      wingMat = node.material
    }
  })
  wingMat.depthWrite = true
  wingMat.depthTest = true
  wingMat.transparent = false
  // wingMat.alphaTest = 0.5
  wingMat.alphaHash = true
  // gui.add(wingMat, "transparent").onChange((v) => {
  //   wingMat.needsUpdate = true
  // })

  // gui.add(wingMat, "alphaHash").onChange((v) => {
  //   wingMat.alphaHash = v

  //   wingMat.needsUpdate = true
  // })

  const anisoMesh = model.getObjectByName("eyeball")
  const eyelidBot = model.getObjectByName("eyelid_bottom")
  const eyelidTop = model.getObjectByName("eyelid_top")
  const ring1Mesh = model.getObjectByName("ring_1")
  const ring2Mesh = model.getObjectByName("ring_2")
  wingRoot = model.getObjectByName("wing_rig")

  const eyeLidTopOpenRot = eyelidTop.rotation.clone()
  const eyeLidBotOpenRot = eyelidBot.rotation.clone()

  eyelidTop.rotation.set(0, 0, 0)
  eyelidBot.rotation.set(0, 0, 0)

  const normalMap = anisoMat.normalMap
  normalMap.wrapS = normalMap.wrapT = ClampToEdgeWrapping
  normalMap.needsUpdate = true

  if (gltf.animations) {
    const animations = gltf.animations
    mixer = new AnimationMixer(gltf.scene)
    idleAction = mixer.clipAction(animations[0])

    raiseAction = mixer.clipAction(animations[1])
    raiseAction.loop = LoopOnce

    coverAction = mixer.clipAction(animations[2])
    coverAction.loop = LoopOnce
    coverAction.play()
    coverAction.halt()
    coverAction.time = 0.425

    mixer.addEventListener("finished", (e) => {
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
        return
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
      anisoRotateTw.start()
      redEyeTw.start()
    }
  }

  // Aniso tweens

  const anisoRotateTw = new Tween(anisoMat)
    .to({ anisotropyRotation: Math.PI * 10 }, 5e3)
    .easing(Easing.Quadratic.InOut)
    .repeat(1)
    .yoyo(true)
    .onComplete(() => {
      closeEyes()
    })
  const anisoRepeatTw = new Tween(anisoTexture.repeat)
    .to({ x: 10, y: 10 }, 1e3)
    .repeat(1)
    .repeatDelay(200)
    .yoyo(true)
    .easing(Easing.Quadratic.InOut)

  // Eye ball look around randomly
  const colObj = { val: 0 }

  const redCol = new Color("#f7a8a8")
  const originalColor = anisoMesh.material.color.clone()
  const orgWingColor = featherMesh.material.color.clone()
  const startCA = chromaticAberrationOffset.x
  const endCA = startCA + 0.01

  const redEyeTw = new Tween(colObj)
    .to({ val: 1 }, 1e3)
    .yoyo(true)
    .repeat(1)
    .easing(Easing.Sinusoidal.InOut)
    .repeatDelay(2e3)
    .onUpdate(() => {
      anisoMesh.material.color.lerpColors(originalColor, redCol, colObj.val)
      featherMesh.material.color.lerpColors(orgWingColor, redCol, colObj.val)
      chromaticAberrationOffset.x = MathUtils.lerp(startCA, endCA, colObj.val)
      chromaticAberrationOffset.y = MathUtils.lerp(startCA, endCA, colObj.val)
      allEffects.chromaticAberration.modulationOffset = MathUtils.lerp(0.5, 0, colObj.val)
    })

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
    })
    .repeat(3)
    .duration(500)
    .easing(Easing.Back.Out)
    .onComplete(() => {
      setTimeout(() => {
        eyeBallTw._repeat = MathUtils.randInt(1, 5)
        eyeBallTw.delay(MathUtils.randInt(100, 1000))
        eyeBallTw.startFromCurrentValues()
        anisoRotateTw.start()
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
      ring1Tween.stop()
      ring1Reset.startFromCurrentValues()
    }
  })

  ring2Mesh.children.forEach((mesh) => {
    mesh.onRaycast = () => {
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

    eyeLidColorTw.stop()
    eyeLidColorTw.start()
  }
  const hsl = {}

  const eyeLidObj = { val: 0 }
  const eyeLidColorTw = new Tween(eyeLidObj).to({ val: 1 }, 1000).easing(Easing.Quadratic.Out)
  const startCol = new Color()
  const endColor = new Color()
  eyeLidColorTw
    .onStart(() => {
      startCol.copy(eyelidBot.material.color)

      eyelidBot.material.color.getHSL(hsl)
      hsl.h += 0.2 % 1
      hsl.l = 0.5
      endColor.setHSL(hsl.h, hsl.s, hsl.l)
    })
    .onUpdate(() => {
      eyelidBot.material.color.lerpColors(startCol, endColor, eyeLidObj.val)
    })

  eyelidTop.onRaycast = closeEyes
  eyelidBot.onRaycast = closeEyes

  model.scale.setScalar(0.001)
  model.position.set(0, 15, -30)

  mainObjects.add(model)

  ring1Tween.startFromCurrentValues()
  ring2Tween.startFromCurrentValues()

  angelStartTw = new Tween(model.position)
    .to({ x: 0, y: 10, z: 0 })
    .easing(Easing.Back.Out)
    .duration(15000)
    .onStart(() => {
      angelStartTw._valuesStart = { x: 0, y: 15, z: -100 }
      new Tween(model.scale).to({ x: 10, y: 10, z: 10 }).duration(15000).easing(Easing.Quadratic.Out).start()
    })
    .onUpdate((v, elapsed) => {
      anisoMesh.getWorldPosition(focusPoint)
      if (elapsed >= 0.4) {
        if (idleAction.isRunning()) {
          return
        }
        idleAction.fadeIn(1)
        coverAction.crossFadeTo(idleAction, 1)
        idleAction.play()
      }
    })
    .onComplete(() => {
      anisoMesh.getWorldPosition(minTarget)

      new Tween(eyelidBot.rotation).to({ x: eyeLidBotOpenRot.x }).easing(Easing.Back.Out).start()

      new Tween(eyelidTop.rotation)
        .to({ x: eyeLidTopOpenRot.x })
        .easing(Easing.Back.Out)
        .onComplete(() => {
          eyeBallTw.startFromCurrentValues()
          enableRaycast = true
        })
        .start()
    })

  model.position.set(0, 0, 0) // for compile to work correctly
}
