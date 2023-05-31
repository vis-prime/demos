import Stats from "three/examples/jsm/libs/stats.module"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"
import { TransformControls } from "three/examples/jsm/controls/TransformControls"
import { mergeGroups } from "three/examples/jsm/utils/BufferGeometryUtils"

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
  MeshBasicMaterial,
  Mesh,
  BoxGeometry,
  MeshStandardMaterial,
  BufferGeometry,
} from "three"

// Model and Env
import { BG_ENV } from "../helpers/BG_ENV"
import { update } from "@tweenjs/tween.js"
import { HDRI_LIST } from "../hdri/HDRI_LIST"
import { N8AOPostPass } from "n8ao"
import { BloomEffect, EffectComposer, EffectPass, RenderPass } from "postprocessing"
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter"
import { SUBTRACTION, Brush, Evaluator } from "three-bvh-csg"

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
let bg_env,
  brushA,
  brushB,
  resultMesh,
  csgEvaluator,
  splitCSGResult = new Group()

const params = {
  useGroups: true,
  operation: SUBTRACTION,
  export: () => {
    exportGLTF()
  },

  updateCSG: updateCSG,
}

const exportGroup = new Group()

export default async function CSGPlayground(mainGui) {
  gui = mainGui
  sceneGui = gui.addFolder("Scene")
  gui.add(params, "export")
  gui.add(params, "updateCSG")

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

  composer = new EffectComposer(renderer)
  // N8AOPass replaces RenderPass
  const renderPass = new RenderPass(scene, camera)
  const n8aopass = new N8AOPostPass(scene, camera)
  n8aopass.configuration.aoRadius = 0.35
  n8aopass.configuration.denoiseRadius = 6.8
  composer.addPass(renderPass)

  const obj = {
    n8ao: true,
    displayMode: "Combined",
  }
  const aoFol = gui.addFolder("n8ao")

  aoFol.add(obj, "n8ao").onChange((v) => {
    if (v) {
      composer.addPass(n8aopass)
    } else {
      composer.removePass(n8aopass)
    }
  })
  aoFol.open()
  aoFol.add(n8aopass.configuration, "aoSamples", 1.0, 64.0, 1.0)
  aoFol.add(n8aopass.configuration, "denoiseSamples", 1.0, 64.0, 1.0)
  aoFol.add(n8aopass.configuration, "denoiseRadius", 0.0, 24.0, 0.01)
  aoFol.add(n8aopass.configuration, "aoRadius", 0.01, 10.0, 0.01)
  aoFol.add(n8aopass.configuration, "distanceFalloff", 0.0, 10.0, 0.01)
  aoFol.add(n8aopass.configuration, "intensity", 0.0, 20.0, 0.01)

  aoFol.add(obj, "displayMode", ["Combined", "AO", "No AO", "Split", "Split AO"]).onChange((v) => {
    n8aopass.setDisplayMode(v)
  })

  // sceneGui.add(transformControls, "mode", ["translate", "rotate", "scale"])
  bg_env = new BG_ENV(scene, renderer)
  bg_env.sunEnabled = true
  bg_env.shadowFloorEnabled = true
  bg_env.setEnvType("HDRI")
  bg_env.addGui(sceneGui)

  scene.add(exportGroup)

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

  console.log("CSG")
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  // renderer.setSize(window.innerWidth, window.innerHeight)
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

  setupCSG()
}

async function setupCSG() {
  console.log("Loading gltf")

  brushA = new Brush(
    new BoxGeometry(),
    new MeshStandardMaterial({
      color: 0xffffff * Math.random(),
      roughness: 0.3,
    })
  )
  brushB = new Brush(
    new BoxGeometry(),
    new MeshStandardMaterial({
      color: 0xffffff * Math.random(),
      roughness: 0.3,
    })
  )

  brushB.scale.setScalar(0.75)
  brushB.position.set(-0.75, 0.75, 0)

  transformControls = new TransformControls(camera, renderer.domElement)
  transformControls.setSize(0.75)
  transformControls.addEventListener("dragging-changed", (e) => {
    controls.enabled = !e.value
  })
  transformControls.addEventListener("objectChange", () => {
    updateCSG()
  })
  scene.add(transformControls)

  transformControls.attach(brushB)

  resultMesh = new Mesh(new BufferGeometry(), new MeshBasicMaterial())

  resultMesh.position.set(0, 0, 3)

  csgEvaluator = new Evaluator()
  csgEvaluator.attributes = ["position", "normal", "uv"]
  csgEvaluator.useGroups = true

  exportGroup.add(brushA, brushB, resultMesh)

  exportGroup.add(splitCSGResult)
}

function updateCSG() {
  brushA.updateMatrixWorld()
  brushB.updateMatrixWorld()

  csgEvaluator.useGroups = params.useGroups

  if (params.useGroups) {
    // resultMesh.material = resultObject.material.map((m) => materialMap.get(m))
  } else {
    resultMesh.material = brushA.material
  }

  csgEvaluator.evaluate(brushA, brushB, params.operation, resultMesh)
  separateCSGResult(resultMesh)
}

const gltfExporter = new GLTFExporter()
async function exportGLTF() {
  const options = {
    trs: true,
    onlyVisible: true,
    binary: true,
    maxTextureSize: 1024,
  }
  gltfExporter.parse(
    exportGroup,
    function (result) {
      console.log()
      if (result instanceof ArrayBuffer) {
        saveArrayBuffer(result, "scene.glb")
      }
    },
    function (error) {
      console.log("An error happened during parsing", error)
    },
    options
  )
}
const link = document.createElement("a")
link.style.display = "none"
document.body.appendChild(link) // Firefox workaround, see #6594

function saveArrayBuffer(buffer, filename) {
  save(new Blob([buffer], { type: "application/octet-stream" }), filename)
}

function save(blob, filename) {
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()

  // URL.revokeObjectURL( url ); breaks Firefox...
}

function separateCSGResult(originalMesh) {
  /**
   * @type {BufferGeometry}
   */
  const originalGeo = originalMesh.geometry
  const mats = originalMesh.material

  /**
   * @typedef {Object} MaterialDictionaryEntry
   * @property {Object} material - The material object.
   * @property {Array} materialIndices - The indices of the material in the original array.
   * @property {Object|null} geometry - The geometry associated with the material (optional).
   */

  /**
   * @type {Object.<string, MaterialDictionaryEntry>}
   */
  const matsDict = {}

  for (const [index, mat] of mats.entries()) {
    if (!matsDict[mat.uuid]) {
      matsDict[mat.uuid] = {
        material: mat,
        materialIndices: [],
        geometry: null,
      }
    }
    matsDict[mat.uuid].materialIndices.push(index)
  }

  for (const item of Object.values(matsDict)) {
    const indices = item.materialIndices

    const geo = originalGeo.clone()
    item.geometry = geo

    const groups = geo.groups
    const indicesToDelete = []
    for (let index = 0; index < groups.length; index++) {
      const element = groups[index]

      if (!indices.includes(element.materialIndex)) {
        indicesToDelete.push(index)
      }
    }

    for (let i = indicesToDelete.length - 1; i >= 0; i--) {
      geo.groups.splice(indicesToDelete[i], 1)
    }
  }

  let i = 0
  for (const item of Object.values(matsDict)) {
    const geo = mergeGroups(item.geometry)
    const mat = item.material

    let mesh = splitCSGResult.children[i]

    if (!mesh) {
      mesh = new Mesh(geo, mat)
      splitCSGResult.add(mesh)
    } else {
      mesh.geometry = geo
      mesh.material = mat
    }

    mesh.position.set(3, 0, -3)

    i++
  }
}
