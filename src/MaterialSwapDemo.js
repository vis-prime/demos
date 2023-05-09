import Stats from "three/examples/jsm/libs/stats.module"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader"
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader"
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
  Mesh,
  RepeatWrapping,
  MeshStandardMaterial,
  TextureLoader,
  SRGBColorSpace,
} from "three"

// Model and Env
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader"
import { BG_ENV } from "../helpers/BG_ENV"
import { Easing, Tween, update } from "@tweenjs/tween.js"
import { HDRI_LIST } from "../hdri/HDRI_LIST"
import { MATERIAL_LIST } from "../materials/MATERIAL_LIST"

let stats,
  renderer,
  raf,
  camera,
  scene,
  controls,
  gui,
  pointer = new Vector2()

const mainObjects = new Group()
const gltfLoader = new GLTFLoader()
const draco = new DRACOLoader()
let transformControls
draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.5/")
gltfLoader.setDRACOLoader(draco)
const raycaster = new Raycaster()
const intersects = [] //raycast
let sceneGui
/**
 * @type {BG_ENV}
 */
let bg_env

let matGui

/**
 * @type {KTX2Loader}
 */
let ktxTextureLoader

export default async function MaterialSwapDemo(mainGui) {
  gui = mainGui
  sceneGui = gui.addFolder("Scene")
  stats = new Stats()
  app.appendChild(stats.dom)
  // renderer
  renderer = new WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio))
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = VSMShadowMap
  renderer.outputEncoding = sRGBEncoding
  renderer.toneMapping = ACESFilmicToneMapping

  ktxTextureLoader = new KTX2Loader()
    .setTranscoderPath("./basis/")
    .detectSupport(renderer)

  app.appendChild(renderer.domElement)

  // camera
  camera = new PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    150
  )
  camera.position.set(3, 2, 3)
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

  // sceneGui.add(transformControls, "mode", ["translate", "rotate", "scale"])
  bg_env = new BG_ENV(scene, renderer)
  bg_env.sunEnabled = true
  bg_env.shadowFloorEnabled = true
  bg_env.setEnvType("HDRI")
  bg_env.addGui(sceneGui)

  await setupAssets()

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
}

function render() {
  stats.update()
  update()
  controls.update()
  renderer.render(scene, camera)
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

  if (intersects[0].object.selectOnRaycast) {
    transformControls.attach(intersects[0].object.selectOnRaycast)
  } else {
    transformControls.attach(intersects[0].object)
  }
  addMaterialGui(intersects[0].object)
  intersects.length = 0
}

function onPointerMove(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1
}

async function setupAssets() {
  const folder = gui.addFolder("Swap")
  folder.open()

  bg_env.preset = HDRI_LIST.skidpan
  bg_env.updateAll()

  const count = 10,
    width = 1

  for (let index = 0; index < count; index++) {
    const mesh = new Mesh(
      new SphereGeometry(width / 2).translate(0, width / 2, 0),
      new MeshStandardMaterial({
        color: 0xffffff * Math.random(),
        name: "mat_" + index,
      })
    )
    mesh.material.materialPreset = new MaterialPreset()
    mesh.name = "mesh_" + index

    mesh.position.x = width * index - (width * count) / 2
    mainObjects.add(mesh)

    console.log(mesh.position.x)
  }
}

/**
 * Create mat gui
 * @param {Mesh} mesh
 */
function addMaterialGui(mesh) {
  console.log(mesh.name, { mesh })
  matGui?.destroy()
  matGui = gui.addFolder(mesh.name)
  matGui.open()

  /**
   * @type {MeshStandardMaterial}
   */
  const mat = mesh.material
  matGui.addColor(mat, "color")
  matGui.add(mat, "roughness", 0, 1)
  matGui.add(mat, "metalness", 0, 1)
  matGui.add(mat, "displacementBias", 0, 1)
  matGui.add(mat, "displacementScale", 0, 1)

  matGui
    .add(mat.materialPreset, "selectedMaterial", MATERIAL_LIST)
    .onChange(() => {
      applyMaterial(mesh)
    })
  matGui.add(mat.materialPreset, "format", ["webP", "ktx"]).onChange(() => {
    applyMaterial(mesh)
  })

  for (const value of Object.values(mat)) {
    if (value?.isTexture) {
      value.wrapS = RepeatWrapping
      value.wrapT = RepeatWrapping

      matGui.add(value.repeat, "x", 0.1, 5)
      matGui.add(value.repeat, "y", 0.1, 5)
    }
  }
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

const textureLoader = new TextureLoader()

/**
 * Apply mat
 * @param {Mesh} mesh
 */
const applyMaterial = async (mesh) => {
  /**
   * @type {MeshStandardMaterial}
   */
  const mat = mesh.material

  /**
   * @type {MaterialPreset}
   */
  const presetData = mat.materialPreset

  const selectedMaterial = presetData.selectedMaterial

  if (!selectedMaterial) return

  const texturesDict =
    presetData.format === "webP"
      ? presetData.selectedMaterial.textures_org
      : presetData.selectedMaterial.textures

  // TODO store repeat values separately somewhere
  //

  console.log({ texturesDict })

  const loader = presetData.format === "webP" ? textureLoader : ktxTextureLoader

  const promiseArray = []
  const promiseDict = {}
  for (const [key, relativePath] of Object.entries(texturesDict)) {
    const url = getImageUrl(relativePath)

    console.log(key, relativePath, url)

    promiseArray.push(
      loader.loadAsync(url).then((texture) => {
        promiseDict[key] = texture
        texture.name = presetData.selectedMaterial.name + "_" + key
        if (key === "diffuse" && presetData.format === "webP") {
          texture.encoding = sRGBEncoding
          // texture.colorSpace = SRGBColorSpace
        }
        texture.flipY = false
        texture.wrapS = RepeatWrapping
        texture.wrapT = RepeatWrapping
      })
    )
  }

  console.log(promiseArray, promiseDict)
  await Promise.allSettled(promiseArray)
  console.log(promiseDict)

  mat.map = promiseDict.diffuse ? promiseDict.diffuse : null
  mat.metalnessMap = promiseDict.metal ? promiseDict.metal : null
  mat.roughnessMap = promiseDict.rough ? promiseDict.rough : null
  mat.displacementMap = promiseDict.disp ? promiseDict.disp : null
  mat.needsUpdate = true

  addMaterialGui(mesh)
}

function getImageUrl(name) {
  return new URL(`../materials/${name}`, import.meta.url).href
}

class MaterialPreset {
  constructor() {
    this.selectedMaterial = null
    this.format = "webP" // webP || ktx
  }
}
