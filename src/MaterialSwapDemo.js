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
const gltfLoader = new GLTFLoader()
const draco = new DRACOLoader()
let transformControls
draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.5/")
gltfLoader.setDRACOLoader(draco)
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
 * Object representing a mesh for different channels.
 * @typedef {Object} MeshForChannels
 * @property {Group} diffuse - The mesh for the diffuse channel.
 * @property {Group} rough - The mesh for the roughness channel.
 * @property {Group} metal - The mesh for the metalness channel.
 * @property {Group} emit - The mesh for the emissive channel.
 * @property {Group} normal - The mesh for the normal channel.
 * @property {Group} ao - The mesh for the ambient occlusion channel.
 * @property {Group} displace - The mesh for the displacement channel.
 */

const texMeshGeometry = new PlaneGeometry()

/**
 * Object representing meshes for different channels.
 * @type {MeshForChannels}
 */
const meshForChannels = {
  diffuse: null,
  rough: null,
  metal: null,
  normal: null,
  emit: null,
  ao: null,
  displace: null,
}

/**
 * Material used for display.
 * @type {THREE.MeshPhysicalMaterial & { vis_materialPreset: MaterialPreset }}
 */
const displayMaterial = new MeshPhysicalMaterial()
displayMaterial.vis_materialPreset = new MaterialPreset()

/**
 * Object representing meshes for display.
 * @typedef {Object} MeshForDisplay
 * @property {Mesh} box - The mesh representing a box.
 * @property {Mesh} sphere - The mesh representing a sphere.
 * @property {Mesh} cylinder - The mesh representing a cylinder.
 * @property {Mesh} torus - The mesh representing a torus.
 * @property {Mesh} torusKnot - The mesh representing a torus knot.
 * @property {Mesh} plane - The mesh representing a plane.
 * @property {Mesh} octahedron - The mesh representing a octahedron.
 */

/**
 * Object containing meshes for display.
 * @type {MeshForDisplay}
 */
const meshForDisplay = {
  box: null,
  sphere: null,
  cylinder: null,
  torus: null,
  torusKnot: null,
  plane: null,
  octahedron: null,
}

function setupStage() {
  const platform = new Mesh(
    new CylinderGeometry(2.5, 3, 0.1, 48).translate(0, 0.05, 0),
    new MeshStandardMaterial({ color: "grey", roughness: 0.5 })
  )
  scene.add(platform)

  const names = Object.keys(meshForChannels)

  const count = names.length,
    width = 1,
    padding = 0.4

  for (let index = 0; index < count; index++) {
    const name = names[index]
    const grp = new Group()
    meshForChannels[name] = grp
    grp.vis_textureMesh = new Mesh(
      texMeshGeometry,
      new MeshBasicMaterial({ color: 0x000000 })
    )

    const sdfText = new Text()

    sdfText.anchorY = "50%"
    sdfText.anchorX = "center"

    sdfText.text = name.toUpperCase()
    sdfText.fontSize = 0.15
    sdfText.material.side = FrontSide
    sdfText.position.set(0, 0, 0.01)
    sdfText.color = 0xff0000
    sdfText.outlineWidth = "5%"
    sdfText.sync()
    grp.vis_textMesh = sdfText
    grp.add(grp.vis_textureMesh, sdfText)

    const paddedWidth = width + padding
    const X = paddedWidth * index - (paddedWidth * count) / 2 + padding
    grp.position.set(X, 1.5, -5)
  }

  scene.add(...Object.values(meshForChannels))

  meshForDisplay.box = new Mesh(
    new BoxGeometry(width, width, width, 10, 10, 10),
    displayMaterial
  )
  meshForDisplay.sphere = new Mesh(
    new SphereGeometry(width / 2),
    displayMaterial
  )
  meshForDisplay.cylinder = new Mesh(
    new CylinderGeometry(width / 2, width / 2, width),
    displayMaterial
  )
  meshForDisplay.torus = new Mesh(
    new TorusGeometry(width / 3, width / 8),
    displayMaterial
  )
  meshForDisplay.torusKnot = new Mesh(
    new TorusKnotGeometry(width / 4, width / 8),
    displayMaterial
  )
  meshForDisplay.plane = new Mesh(
    new PlaneGeometry(width, width, 10, 10)
      .rotateX(-Math.PI / 2)
      .translate(0, -width / 2, 0),
    displayMaterial
  )
  meshForDisplay.octahedron = new Mesh(
    new OctahedronGeometry(width / 2),
    displayMaterial
  )

  const meshes = Object.values(meshForDisplay)

  const meshCount = meshes.length,
    meshPadding = 0.4

  for (let index = 0; index < meshCount; index++) {
    const m = meshes[index]
    m.geometry.translate(0, width / 2, 0)

    const paddedWidth = width + meshPadding
    const X = paddedWidth * index - (paddedWidth * count) / 2 + meshPadding
    m.position.set(X, 0, 3)
  }

  mainObjects.add(...meshes)
}

async function setupAssets() {
  const folder = gui.addFolder("Swap")
  folder.open()

  bg_env.preset = HDRI_LIST.skidpan
  bg_env.updateAll()

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
}

/**
 * Update repeat
 * @param { * @type {THREE.MeshPhysicalMaterial & { vis_materialPreset: MaterialPreset }}}
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
   * @type {MaterialPreset}
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

  await Promise.allSettled(promiseArray)

  mat.map = promiseDict.diffuse ? promiseDict.diffuse : null
  mat.metalnessMap = promiseDict.metal ? promiseDict.metal : null
  mat.roughnessMap = promiseDict.rough ? promiseDict.rough : null
  mat.normalMap = promiseDict.normal ? promiseDict.normal : null
  mat.displacementMap = promiseDict.disp ? promiseDict.disp : null

  let delayInc = 0
  for (const [name, group] of Object.entries(meshForChannels)) {
    const mat = group.vis_textureMesh.material
    const wasActive = mat.map ? true : false
    const text = group.vis_textMesh
    mat.map = promiseDict[name] ? promiseDict[name] : null

    // text.position.y = mat.map ? 0.5 : 0
    // text.color = mat.map ? 0x00ff00 : 0xff0000

    text.sync()
    mat.needsUpdate = true

    const startY = text.position.y
    const endY = mat.map ? 0.5 : 0
    const startCol = colorAny.copy(mat.color)
    const endCol = mat.map ? colorWhite : colorBlack

    const startTextCol = wasActive ? colorGreen : colorRed
    const endTextColor = mat.map ? colorGreen : colorRed

    // TODO : animate all to empty state at the beginning
    if (text.position.y !== endY) {
      const dummyObj = { val: 0 }
      new Tween(dummyObj)
        .to({ val: 1 })
        .duration(1000)
        .delay(500 + delayInc)
        .easing(Easing.Quadratic.InOut)
        .onUpdate(() => {
          text.position.y = MathUtils.lerp(startY, endY, dummyObj.val)
          mat.color.lerpColors(startCol, endCol, dummyObj.val)
          text.color = colorAny
            .lerpColors(startTextCol, endTextColor, dummyObj.val)
            .getHex()
        })
        .start()
      delayInc += 200
    }
  }

  updateMasterRepeat(mat)

  mat.needsUpdate = true

  addMaterialGui(mesh)
}
