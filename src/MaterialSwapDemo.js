import Stats from "three/examples/jsm/libs/stats.module"

import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"
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
  BoxGeometry,
  CylinderGeometry,
  PlaneGeometry,
  MeshPhysicalMaterial,
  TorusGeometry,
  TorusKnotGeometry,
  FrontSide,
  OctahedronGeometry,
  Color,
} from "three"

// Model and Env
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader"
import { BG_ENV } from "../helpers/BG_ENV"
import { Easing, Tween, update } from "@tweenjs/tween.js"
import { HDRI_LIST } from "../hdri/HDRI_LIST"
import { MATERIAL_LIST } from "./MATERIAL_LIST"
import { MeshBasicMaterial } from "three"
import { Text } from "troika-three-text"
import { MODEL_LIST, MODEL_LOADER } from "./MODEL_LIST"
import {
  channelParams,
  showcaseMeshes,
} from "./constants/MaterialSwapConstants"

let stats,
  /**
   * @type {WebGLRenderer}
   */
  renderer,
  raf,
  camera,
  scene,
  controls,
  gui,
  pointer = new Vector2()

const mainObjects = new Group()

const raycaster = new Raycaster()
const intersects = [] //raycast

const colorWhite = new Color("white")
const colorBlack = new Color("black")
const colorRed = new Color("red")
const colorGreen = new Color("green")
const colorAny = new Color()

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

const TEXTURE_CACHE = {}

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
  camera.position.set(5, 2, 5)
  // scene
  scene = new Scene()
  scene.environmentIntensity = 1
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

  bg_env = new BG_ENV(scene, renderer)
  bg_env.sunEnabled = true
  bg_env.shadowFloorEnabled = true
  bg_env.setEnvType("HDRI")
  bg_env.setBGType("Color")
  bg_env.bgColor.set("#3a4573")
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
    return
  }
  const mesh = intersects[0].object
  if (mesh.vis_positionBackup) toggleFocusMesh(intersects[0].object)

  if (mesh.vis_channel) {
    console.log(mesh)
  }

  intersects.length = 0
}

function onPointerMove(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1
}

/**
 * Represents a material preset.
 * @class
 */
class MaterialPreset {
  /**
   * Create a MaterialPreset instance.
   * @constructor
   */
  constructor() {
    /**
     * The selected material.
     * @type {null}
     */
    this.pbrPreset = null

    /**
     * The format of the preset (webP or ktx).
     * @type {string}
     * @default "webP"
     */
    this.format = "webP"

    /**
     * The repeat for all channels
     * @type {Number}
     */
    this.masterRepeat = 1
  }
}

/**
 * Material used for display.
 * @type {THREE.MeshPhysicalMaterial & { vis_materialPreset: MaterialPreset }}
 */
const displayMaterial = new MeshPhysicalMaterial()
displayMaterial.vis_materialPreset = new MaterialPreset()
const twObj = { val: 0 }
displayMaterial.vis_tween = new Tween(twObj).to({ val: 1 })

const channelMeshesGroup = new Group()

async function setupStage() {
  const gltf = await MODEL_LOADER(MODEL_LIST.platform.url)

  scene.add(gltf.scene)

  const names = Object.keys(channelParams)
  const count = names.length,
    width = 1,
    padding = 0.4
  let index = 0
  const planeGeometry = new PlaneGeometry()
  for (const [name, item] of Object.entries(channelParams)) {
    item.group = new Group()
    item.mesh = new Mesh(
      planeGeometry,
      new MeshBasicMaterial({ color: 0x000000 })
    )
    item.mesh.name = name
    item.mesh.vis_channel = name
    item.text = new Text()

    item.text.name = name
    item.text.vis_channel = name
    item.text.anchorY = "50%"
    item.text.anchorX = "center"
    item.text.text = name.toUpperCase()
    item.text.fontSize = 0.15
    item.text.material.side = FrontSide
    item.text.position.set(0, 0, 0.01)
    item.text.color = 0xff0000
    item.text.outlineWidth = "5%"
    item.text.sync()
    item.group.add(item.mesh, item.text)

    const paddedWidth = width + padding
    const X = paddedWidth * index - (paddedWidth * count) / 2 + padding
    item.group.position.set(X, 1.5, 0)

    item.tween = new Tween(item)
      .to({ lerpValue: 1 })
      .easing(Easing.Quadratic.InOut)

    channelMeshesGroup.add(item.group)
    index++
  }
  channelMeshesGroup.position.set(0, 0, -1.95)
  mainObjects.add(channelMeshesGroup)

  // Meshes for material display

  showcaseMeshes.box.mesh = new Mesh(
    new BoxGeometry(width, width, width, 10, 10, 10),
    displayMaterial
  )
  showcaseMeshes.sphere.mesh = new Mesh(
    new SphereGeometry(width / 2),
    displayMaterial
  )
  showcaseMeshes.cylinder.mesh = new Mesh(
    new CylinderGeometry(width / 2, width / 2, width),
    displayMaterial
  )
  showcaseMeshes.torus.mesh = new Mesh(
    new TorusGeometry(width / 3, width / 8),
    displayMaterial
  )
  showcaseMeshes.torusKnot.mesh = new Mesh(
    new TorusKnotGeometry(width / 4, width / 8),
    displayMaterial
  )
  showcaseMeshes.plane.mesh = new Mesh(
    new PlaneGeometry(width, width, 10, 10)
      .rotateX(-Math.PI / 2)
      .translate(0, -width / 2, 0),
    displayMaterial
  )
  showcaseMeshes.octahedron.mesh = new Mesh(
    new OctahedronGeometry(width / 2),
    displayMaterial
  )

  const dat = Object.values(showcaseMeshes)

  const meshCount = dat.length,
    meshPadding = 0.4

  for (let index = 0; index < meshCount; index++) {
    const m = dat[index].mesh
    m.geometry.translate(0, width / 2, 0)

    const paddedWidth = width + meshPadding
    const X = paddedWidth * index - (paddedWidth * count) / 2 + meshPadding
    m.position.set(X, 0, 3)
    m.vis_positionBackup = m.position.clone()
    mainObjects.add(m)
  }
}

async function setupAssets() {
  const folder = gui.addFolder("Swap")
  folder.open()

  bg_env.preset = HDRI_LIST.skidpan
  bg_env.updateAll()
  bg_env.sunLight.intensity = 0.1

  setupStage()
}

/**
 * Create mat gui
 * @param {Mesh} mesh
 */
function addMaterialGui(mesh) {
  if (matGui) {
    for (const child of matGui.children) {
      child.updateDisplay()
    }

    return
  }

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
    .add(mat.vis_materialPreset, "pbrPreset", MATERIAL_LIST)
    .onChange(() => {
      applyMaterial(mesh)
    })
  matGui.add(mat.vis_materialPreset, "format", ["webP", "ktx"]).onChange(() => {
    applyMaterial(mesh)
  })

  matGui.add(mat.vis_materialPreset, "masterRepeat", 0.1, 5).onChange(() => {
    updateMasterRepeat(mat)
  })

  const test = {
    togOn: async () => {
      await toggleTextureMeshes(true, {}, true)
      console.log("complete!")
    },

    togOff: async () => {
      await toggleTextureMeshes(false, {}, true)
      console.log("complete!")
    },
  }

  // matGui.add(test, "off")
  // matGui.add(test, "on")
  matGui.add(test, "togOn")
  matGui.add(test, "togOff")
}

/**
 * Update repeat
 * @param {THREE.MeshPhysicalMaterial & { vis_materialPreset: MaterialPreset }}
 */
function updateMasterRepeat(material) {
  for (const tex of Object.values(material)) {
    if (tex && tex.isTexture) {
      tex.repeat.setScalar(material.vis_materialPreset.masterRepeat)
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

  const sizeLength = size.length()

  if (sizeLength === 0) return

  let distance = sizeLength / Math.tan(MathUtils.degToRad(camera.fov) / 2)

  distance -= distance * 0.3
  // move the camera to look at the center of the mesh

  shiftedCameraPos.copy(camera.position)
  shiftedCameraPos.y = center.y

  endPos.lerpVectors(
    center,
    shiftedCameraPos,
    1 / (center.distanceTo(camera.position) / distance)
  )

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
   * @type { {THREE.MeshPhysicalMaterial & { vis_materialPreset: MaterialPreset }} }
   */
  const presetData = mat.vis_materialPreset

  const pbrPreset = presetData.pbrPreset

  if (!pbrPreset) return

  const texturesDict =
    presetData.format === "webP"
      ? presetData.pbrPreset.textures_org
      : presetData.pbrPreset.textures

  const loader = presetData.format === "webP" ? textureLoader : ktxTextureLoader

  const promiseArray = []
  const promiseDict = {}
  if (texturesDict) {
    for (const [key, relativePath] of Object.entries(texturesDict)) {
      const url = relativePath

      if (TEXTURE_CACHE[url]) {
        promiseDict[key] = TEXTURE_CACHE[url]
      } else {
        promiseArray.push(
          loader.loadAsync(url).then((texture) => {
            promiseDict[key] = texture
            TEXTURE_CACHE[url] = texture

            texture.name = presetData.pbrPreset.name + "_" + key
            if (key === "diffuse") {
              texture.encoding = sRGBEncoding
              // texture.colorSpace = SRGBColorSpace
            }

            texture.flipY = false
            texture.wrapS = RepeatWrapping
            texture.wrapT = RepeatWrapping

            renderer.initTexture(texture)
          })
        )
      }
    }
  }

  promiseArray.push(toggleTextureMeshes(false))

  await Promise.allSettled(promiseArray)

  mat.map = promiseDict.diffuse ? promiseDict.diffuse : null
  mat.metalnessMap = promiseDict.metal ? promiseDict.metal : null
  mat.roughnessMap = promiseDict.rough ? promiseDict.rough : null
  mat.normalMap = promiseDict.normal ? promiseDict.normal : null
  mat.displacementMap = promiseDict.displace ? promiseDict.displace : null

  await toggleTextureMeshes(true, promiseDict)

  updateMasterRepeat(mat)

  mat.needsUpdate = true

  addMaterialGui(mesh)
}

async function toggleTextureMeshes(state, textureDict = {}, test) {
  console.log("TOGGLE", state)
  let delayInc = 0
  const promiseArray = []

  for (const [name, item] of Object.entries(channelParams)) {
    if (state === item.isActive) continue

    item.isActive = state

    const channelTexture = textureDict[name] || (test && state)

    const mat = item.mesh.material

    if (!test) {
      if (state) {
        // if texture exists , apply and tween
        if (channelTexture) {
          mat.map = channelTexture
          mat.needsUpdate = true
        } else if (!mat.map) {
          // if no texture to be applied and there's no texture on mat, continue
          continue
        }
      }

      if (!state && !mat.map) {
        // when disabling if texture does not exist no need to tween
        continue
      }
    }

    const text = item.text
    const tween = item.tween

    const meshStartColor = item.tweenABvalues.meshStartColor
    const meshEndColor = item.tweenABvalues.meshEndColor
    meshStartColor.copy(mat.color)
    meshEndColor.copy(channelTexture ? colorWhite : colorBlack)

    const textStartColor = item.tweenABvalues.textStartColor
    const textEndColor = item.tweenABvalues.textEndColor
    textStartColor.setHex(text.color)
    textEndColor.copy(channelTexture ? colorGreen : colorRed)

    const textStartPos = item.tweenABvalues.textStartPos
    const textEndPos = item.tweenABvalues.textEndPos
    textStartPos.copy(text.position)
    textEndPos.copy(text.position)
    textEndPos.y = channelTexture ? -0.65 : 0

    tween.stop()
    tween.onUpdate(() => {
      // console.log(state, item.lerpValue.toFixed(2))
      text.position.lerpVectors(textStartPos, textEndPos, item.lerpValue)
      mat.color.lerpColors(meshStartColor, meshEndColor, item.lerpValue)
      text.color = colorAny
        .lerpColors(textStartColor, textEndColor, item.lerpValue)
        .getHex()
    })

    tween.delay(delayInc)
    tween.duration(1000)
    delayInc += 200

    promiseArray.push(
      new Promise((resolve) =>
        tween.onComplete(() => {
          if (!state) {
            mat.map = null
            mat.needsUpdate = true
          }
          resolve()
        })
      )
    )

    tween.start()
  }

  console.log({ state, promiseArray })
  return Promise.all(promiseArray)
}

async function toggleDisplayMaterial(state, textureDict = {}) {
  return new Promise((resolve) => {})
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const pedestalPos = new Vector3(0, 1, 0)
function toggleFocusMesh(selectedMesh) {
  addMaterialGui(selectedMesh)

  for (const [key, val] of Object.entries(showcaseMeshes)) {
    if (!val.tween) {
      val.tween = new Tween(val.mesh.position).easing(Easing.Quadratic.Out)
      val.spinTween = new Tween(val.mesh.rotation)
        // .easing(Easing.Quadratic.InOut)
        .repeat(1000)
        .duration(20000)
    }

    const { tween, spinTween, mesh } = val

    console.log({ key, val })

    if (selectedMesh === mesh) {
      // selected mesh

      //check if already active
      if (!val.isActive) {
        val.isActive = true
        console.log("active", mesh.name)
        tween.to(pedestalPos)
        tween.onUpdate((e, elapsed) => {
          mesh.scale.setScalar(MathUtils.lerp(1, 2, elapsed))
        })
        tween.startFromCurrentValues()
        spinTween.to({ y: 2 * Math.PI })
        spinTween.startFromCurrentValues()
      }
    }
    // other meshes

    // check if active and deactivate
    else if (val.isActive) {
      val.isActive = false
      tween.stop()
      spinTween.stop()
      tween.to(mesh.vis_positionBackup)
      const startScale = mesh.scale.x
      const startRotY = mesh.rotation.y
      tween.onUpdate((e, elapsed) => {
        mesh.scale.setScalar(MathUtils.lerp(startScale, 1, elapsed))
        mesh.rotation.y = MathUtils.lerp(startRotY, 0, elapsed)
      })
      tween.startFromCurrentValues()
    }
  }
}
