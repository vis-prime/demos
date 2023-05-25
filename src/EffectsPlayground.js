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
} from "postprocessing"

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
  selectiveBloom: null,
  depthOfField: null,
  vignette: null,
}

let renderPass
const allPasses = {
  n8ao: null,
}

const allParams = {
  n8ao: {},
}

const enabledEffects = []
const enabledPasses = []

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
  camera = new PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    150
  )
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

  // sceneGui.add(transformControls, "mode", ["translate", "rotate", "scale"])
  bg_env = new BG_ENV(scene, renderer)
  bg_env.sunEnabled = true
  bg_env.shadowFloorEnabled = true
  bg_env.setEnvType("HDRI")
  bg_env.addGui(sceneGui)

  await setupModels()

  animate()

  let lastClickTime = 0
  let lastPointerEvent = null

  function handlePointerDown(event) {
    const clickTime = new Date().getTime()
    const timeDiff = clickTime - lastClickTime
    if (
      lastPointerEvent !== null &&
      timeDiff < 500 &&
      calculateDistance(
        lastPointerEvent.clientX,
        lastPointerEvent.clientY,
        event.clientX,
        event.clientY
      ) < 10
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
    transformControls.detach()
    return
  }

  transformControls.attach(intersects[0].object)

  intersects.length = 0
}

function onPointerMove(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1
}

async function setupModels() {
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

  const floor = new Mesh(
    new CircleGeometry(40, 64).rotateX(-Math.PI / 2),
    new MeshStandardMaterial()
  )
  floor.receiveShadow = true
  scene.add(floor)

  addParticles()
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

  endPos.lerpVectors(
    center,
    shiftedCameraPos,
    1 / (center.distanceTo(camera.position) / distance)
  )

  console.log(endPos.distanceTo(center), distance)
  endTar.copy(center)

  new Tween(camera.position)
    .to(endPos)
    .duration(1000)
    .easing(Easing.Quadratic.InOut)
    .start()

  new Tween(controls.target)
    .to(endTar)
    .duration(1000)
    .easing(Easing.Quadratic.InOut)
    .start()
}

let instancedParticles, particleTween

const addParticles = () => {
  const spread = 50

  const geo = new SphereGeometry(0.01, 8, 8)
  const mat = new MeshBasicMaterial()
  mat.color.setRGB(10, 10, 10)

  instancedParticles = new InstancedMesh(geo, mat, 1000)
  const matrix = new Matrix4()
  const randomScale = new Vector3()
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

    instancedParticles.setMatrixAt(index, matrix)
    particleTween = new Tween(instancedParticles.rotation)
      .to({
        y: Math.PI * 4,
      })
      .duration(1200000)
  }

  particleTween.start()
  scene.add(instancedParticles)
}

function setupEffects() {
  composer = new EffectComposer(renderer)

  renderPass = new RenderPass(scene, camera)
  composer.addPass(renderPass)

  allPasses.n8ao = new N8AOPostPass(scene, camera)

  allEffects.bloom = new BloomEffect()
  allEffects.chromaticAberration = new ChromaticAberrationEffect({
    modulationOffset: 1,
    offset: new Vector2(0.1, 0.1),
    radialModulation: true,
  })
  allEffects.depthOfField = new DepthOfFieldEffect(camera)
  allEffects.selectiveBloom = new SelectiveBloomEffect(scene, camera)
  allEffects.vignette = new VignetteEffect()

  // aoFol.open()
  // aoFol.addColor(n8aopass.configuration, "color")
  // aoFol.add(n8aopass.configuration, "aoSamples", 1.0, 64.0, 1.0)
  // aoFol.add(n8aopass.configuration, "denoiseSamples", 1.0, 64.0, 1.0)
  // aoFol.add(n8aopass.configuration, "denoiseRadius", 0.0, 24.0, 0.01)
  // aoFol.add(n8aopass.configuration, "aoRadius", 0.01, 10.0, 0.01)
  // aoFol.add(n8aopass.configuration, "distanceFalloff", 0.0, 10.0, 0.01)
  // aoFol.add(n8aopass.configuration, "intensity", 0.0, 20.0, 0.01)

  // aoFol
  //   .add(obj, "displayMode", ["Combined", "AO", "No AO", "Split", "Split AO"])
  //   .onChange((v) => {
  //     n8aopass.setDisplayMode(v)
  //   })
  const effectsFol = gui.addFolder("POST PROCESSING")
  const createToggle = (gui, folder, enabledItems, name, effect) => {
    const guiToggle = {
      enabled: false,
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
        updateEffects(enabledItems, effect)
        if (v) {
          guiToggle.editFolder = folder.addFolder(name)
        } else {
          destroy()
        }
      })
  }

  for (const [name, effect] of Object.entries(allPasses)) {
    createToggle(effectsFol, effectsFol, enabledPasses, name, effect)
  }

  for (const [name, effect] of Object.entries(allEffects)) {
    createToggle(effectsFol, effectsFol, enabledEffects, name, effect)
  }
}

/**
 * Edit effect/pass
 * @param {Array} array
 * @param {Effect|Pass} item
 */
function updateEffects(array, item) {
  const index = array.indexOf(item)

  if (index === -1) {
    // Item doesn't exist in the array, so add it
    array.push(item)
    console.log(array)
  } else {
    // Item exists in the array, so remove it
    array.splice(index, 1)
    console.log(array)
  }

  const oldPasses = [...composer.passes]
  composer.removeAllPasses()

  oldPasses.forEach((pass) => pass.dispose())

  composer.addPass(renderPass)
  if (enabledPasses.includes(allPasses.n8ao)) {
    composer.addPass(allPasses.n8ao, 1)
  }

  if (enabledEffects.length)
    composer.addPass(new EffectPass(camera, ...enabledEffects))
}
