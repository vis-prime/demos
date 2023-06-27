import Stats from "three/examples/jsm/libs/stats.module"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"
import { TransformControls } from "three/examples/jsm/controls/TransformControls"
import {
  ACESFilmicToneMapping,
  PerspectiveCamera,
  Scene,
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
  MeshStandardMaterial,
  CircleGeometry,
  DirectionalLight,
  EquirectangularReflectionMapping,
  CanvasTexture,
  Color,
  SRGBColorSpace,
  PMREMGenerator,
  CubeCamera,
  WebGLCubeRenderTarget,
  IcosahedronGeometry,
  LightProbe,
} from "three"
import { RapierPhysics } from "three/examples/jsm/physics/RapierPhysics"

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
  TiltShiftEffect,
  SMAAEffect,
} from "postprocessing"
import { SSGIEffect, VelocityDepthNormalPass } from "realism-effects"
import { MODEL_LIST, MODEL_LOADER } from "./MODEL_LIST"
import { WebGLRenderTarget } from "three"
import { LightProbeHelper } from "three/examples/jsm/helpers/LightProbeHelper"
import { LightProbeGenerator } from "three/examples/jsm/lights/LightProbeGenerator"
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
let bg_env, pmremGenerator

const allEffects = {
  bloom: null,
  chromaticAberration: null,

  depthOfField: null,
  vignette: null,
  tiltShift: null,
  smaa: null,
  fxaa: null,
}

const allPasses = {
  n8ao: null,
}

const allExtraPasses = {
  renderPass: null,
  smaaPass: null,
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

/**
 * @type {CubeCamera}
 */
let cubeCamera,
  /**
   * @type {WebGLRenderTarget}
   */
  cubeRenderTarget,
  lightProbe

let physics, updateENV
const focusTween = new Tween(dummyObj).to({ val: 1 }, 1e6)
export default async function VehicleShowcase(mainGui) {
  physics = await RapierPhysics()

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
  // renderer.outputColorSpace = SRGBColorSpace
  // renderer.toneMapping = ACESFilmicToneMapping

  app.appendChild(renderer.domElement)

  // camera
  camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 150)
  camera.position.set(2, 2, 5)
  // scene
  scene = new Scene()
  scene.add(mainObjects)

  // custom vector to perform focus
  scene.focus = new Vector3()

  lightProbe = new LightProbe()
  lightProbe.position.y = 2
  // scene.add(lightProbe)
  const lightProbeHelper = new LightProbeHelper(lightProbe, 0.1)
  // scene.add(lightProbeHelper)
  lightProbeHelper.position.y = 2
  gui.add(lightProbe, "intensity", 0, 100).name("lightProbe intensity")
  gui.add(lightProbe, "visible").name("lightProbe visible")

  const P = {
    toggleCubeEnv: () => {
      scene.environment = scene.environment ? null : cubeRenderTarget.texture
    },
    updateE: () => {
      updateENV()
    },
    useCubeMapDirectly: true,
  }
  gui.add(P, "toggleCubeEnv")
  gui.add(P, "updateE")
  gui.add(P, "useCubeMapDirectly")
  // controls
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true // an animation loop is required when either damping or auto-rotation are enabled
  controls.dampingFactor = 0.05
  controls.minDistance = 0.1
  controls.maxDistance = 100
  controls.maxPolarAngle = Math.PI / 1.5
  controls.target.set(0, 1, 0)

  pmremGenerator = new PMREMGenerator(renderer)

  cubeRenderTarget = new WebGLCubeRenderTarget(512)
  cubeCamera = new CubeCamera(0.01, 100, cubeRenderTarget)
  scene.add(cubeCamera)
  cubeCamera.position.set(0, 1, 1)
  gui.add(cubeCamera.position, "x")
  gui.add(cubeCamera.position, "y")
  gui.add(cubeCamera.position, "z")
  cubeCamera.yoNear = 0.1
  cubeCamera.yoFar = 100

  const material = new MeshStandardMaterial({
    envMap: cubeRenderTarget.texture,
    roughness: 0.05,
    metalness: 1,
  })

  const sphere = new Mesh(new IcosahedronGeometry(0.1, 8), material)
  cubeCamera.add(sphere)
  scene.environment = cubeRenderTarget.texture

  transformControls = new TransformControls(camera, renderer.domElement)
  let isDragging
  transformControls.addEventListener("dragging-changed", (event) => {
    controls.enabled = !event.value
    isDragging = event.value
    if (!event.value) {
      // scene.environment = pmremGenerator.fromScene(scene).texture
      // scene.background = scene.environment
    }
  })
  transformControls.attach(cubeCamera)

  updateENV = () => {
    cubeRenderTarget.dispose()
    scene.environment = null
    transformControls.visible = false
    sphere.visible = false
    cubeCamera.update(renderer, scene)

    // if (lightProbe.visible) lightProbe.copy(LightProbeGenerator.fromCubeRenderTarget(renderer, cubeRenderTarget))
    if (P.useCubeMapDirectly) {
      scene.environment = cubeRenderTarget.texture
    } else {
      scene.environment = pmremGenerator.fromCubemap(cubeRenderTarget.texture).texture
    }
    transformControls.visible = true
    sphere.visible = true
  }

  gui.add(cubeCamera, "yoNear", 0.1, 20, 0.5).onChange((v) => {
    cubeCamera.children.forEach((cam) => {
      if (cam.isPerspectiveCamera) {
        cam.near = v
        cam.updateProjectionMatrix()
        updateENV()
      }
    })
  })
  gui.add(cubeCamera, "yoFar", 1, 100, 1).onChange((v) => {
    cubeCamera.children.forEach((cam) => {
      if (cam.isPerspectiveCamera) {
        cam.far = v
        cam.updateProjectionMatrix()
        updateENV()
      }
    })
  })

  gui.add(scene, "backgroundIntensity", 0, 1).onChange(updateENV)

  transformControls.addEventListener("change", () => {
    if (transformControls.object && isDragging) {
      updateENV()
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
  await setupGarage()
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

async function setupGarage() {
  const [carGltf, garageGLTF] = await Promise.all([
    MODEL_LOADER(MODEL_LIST.mercedes_project_one.url),
    MODEL_LOADER(MODEL_LIST.garage.url),
  ])

  function isMesh(node) {
    if (node.isMesh) {
      node.castShadow = true
      node.receiveShadow = true
    }
  }

  carGltf.scene.traverse((node) => {
    isMesh(node)
  })
  garageGLTF.scene.traverse((node) => {
    isMesh(node)
  })
  carGltf.scene.scale.setScalar(0.001)

  mainObjects.add(carGltf.scene)
  mainObjects.add(garageGLTF.scene)

  const overHeadLights = garageGLTF.scene.getObjectByName("overhead_lights")
  // overHeadLights.material = new MeshBasicMaterial({ toneMapped: false, fog: false })
  overHeadLights.material.toneMapped = false
  overHeadLights.material.needsUpdate = true
  gui
    .add(overHeadLights.material.color, "r", 0, 100)
    .name("overhead_lights color")
    .onChange((v) => {
      overHeadLights.material.color.setScalar(v)
      updateENV()
      console.log("material.color", overHeadLights.material.color)
    })

  gui
    .add(overHeadLights.material.emissive, "r", 0, 100)
    .name("overhead_lights emissive")
    .onChange((v) => {
      overHeadLights.material.emissive.setScalar(v)
      updateENV()
      console.log("material.emissive", overHeadLights.material.emissive)
    })

  gui
    .add(overHeadLights.material, "emissiveIntensity", 0, 100)
    .name("overhead_lights emissiveIntensity")
    .onChange((v) => {
      updateENV()
      console.log("material.emissiveIntensity", overHeadLights.material.emissiveIntensity)
    })

  // const light_glass = carGltf.scene.getObjectByName("light_glass")
  // gui.add(light_glass.material, "emissiveIntensity", 0, 100)
  // const headlights = carGltf.scene.getObjectByName("headlights")
  // gui.add(headlights.material, "emissiveIntensity", 0, 100)

  new Tween(carGltf.scene.scale).to({ x: 1, y: 1, z: 1 }).easing(Easing.Quadratic.Out).delay(1200).start()

  // addParticles()
}

async function setupBackground() {
  // bg_env = new BG_ENV(scene, renderer)
  // bg_env.sunEnabled = true
  // bg_env.shadowFloorEnabled = true
  // bg_env.setEnvType("HDRI")
  // bg_env.addGui(sceneGui)
  // bg_env.preset = HDRI_LIST.round_platform
  // bg_env.setBGType("None")
  // await bg_env.updateAll()
  // bg_env.sunLight.visible = false
  // bg_env.shadowFloor.visible = false

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
  const sunLight = new DirectionalLight("white", 4)
  sunLight.name = "sun"
  sunLight.position.set(25, 5, 25)
  sunLight.castShadow = true
  sunLight.shadow.camera.near = 1
  sunLight.shadow.camera.far = 100
  const size = 26
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

  gui.add(sunLight, "intensity", 0, 20).name("Dir Intensity")

  const twObj = {
    val: 0,
  }
  const radius = 25
  // new Tween(twObj)
  //   .to({ val: 1 })
  //   .duration(12e4)
  //   .repeat(1e4)
  //   .onUpdate((e) => {
  //     // Calculate the new position using sine and cosine functions

  //     const fullRot = MathUtils.mapLinear(e.val, 0, 1, 0, 2 * Math.PI)
  //     const x = Math.cos(fullRot) * radius
  //     const z = Math.sin(fullRot) * radius

  //     // Set the new position of the object
  //     sunLight.position.x = x
  //     sunLight.position.z = z
  //   })
  //   .start()

  // transformControls.attach(sunLight)
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
  const spread = 20

  const geo = new SphereGeometry(0.005, 8, 8)
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

  const renderPass = new RenderPass(scene, camera)

  allPasses.n8ao = new N8AOPostPass(scene, camera)
  // allPasses.n8ao.configuration.color.set(0x000000).convertLinearToSRGB()
  allPasses.n8ao.configuration.intensity = 5
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
    // intensity: 2,
    // resolutionScale: 0.5,
  })
  allGui.bloom = (folder) => {
    folder.add(allEffects.bloom.luminanceMaterial, "threshold", 0, 2)
    folder.add(allEffects.bloom, "intensity", 1.0, 64.0, 1.0)
    folder.add(allEffects.bloom.resolution, "scale", 0.01, 1).name("resolutionScale")
  }

  const chromaticAberrationOffset = new Vector2()
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

  // composer.addPass(allPasses.n8ao)
  const options = {
    distance: 3,
    thickness: 3,
    autoThickness: false,
    maxRoughness: 1,
    blend: 0.95,
    denoiseIterations: 3,
    denoiseKernel: 3,
    denoiseDiffuse: 25,
    denoiseSpecular: 25.54,
    depthPhi: 5,
    normalPhi: 28,
    roughnessPhi: 18.75,
    envBlur: 0.55,
    importanceSampling: true,
    directLightMultiplier: 1,
    maxEnvLuminance: 50,
    steps: 20,
    refineSteps: 4,
    spp: 1,
    resolutionScale: 1,
    missedRays: false,
  }

  const velocityDepthNormalPass = new VelocityDepthNormalPass(scene, camera)
  const ssgiEffect = new SSGIEffect(scene, camera, velocityDepthNormalPass, options)

  composer.addPass(renderPass)

  // composer.addPass(velocityDepthNormalPass)

  // composer.addPass(new EffectPass(camera, ssgiEffect))
  // composer.addPass(allPasses.n8ao)

  composer.addPass(
    new EffectPass(
      camera,
      allEffects.bloom
      // allEffects.chromaticAberration,
      // allEffects.vignette
    )
  )

  // composer.addPass(new EffectPass(camera, allEffects.depthOfField))

  const effectsFol = gui.addFolder("POST PROCESSING")
  effectsFol.open()

  allGui.bloom(effectsFol.addFolder("BLOOM"))
  // const createToggle = (folder, name) => {
  //   const editFolder = folder.addFolder(name)
  //   if (allGui[name]) allGui[name](editFolder)
  // }

  // for (const [name, pass] of Object.entries(allPasses)) {
  //   if (pass) createToggle(effectsFol, name)
  // }

  // for (const [name, effect] of Object.entries(allEffects)) {
  //   if (effect) createToggle(effectsFol, name)
  // }

  console.log(composer.passes)
}
