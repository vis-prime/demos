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
  MeshPhysicalMaterial,
} from "three"

// Model and Env
import { MODEL_LIST, MODEL_LOADER } from "../models/MODEL_LIST"
import { BG_ENV } from "../helpers/BG_ENV"
import { update } from "@tweenjs/tween.js"
import { TextureLoader } from "three"
import { TEXTURES_LIST } from "../textures/TEXTURES_LIST"
import { HDRI_LIST } from "../hdri/HDRI_LIST"

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

export default async function ThicknessDemo(mainGui) {
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
  app.appendChild(renderer.domElement)

  // camera
  camera = new PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    150
  )
  camera.position.set(3, 2, 3)
  camera.name = "Camera"
  // scene
  scene = new Scene()
  scene.add(mainObjects)

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

  sceneGui.add(transformControls, "mode", ["translate", "rotate", "scale"])
  const bg_env = new BG_ENV(scene)
  bg_env.preset = HDRI_LIST.dry_cracked_lake
  bg_env.sunEnabled = true
  bg_env.shadowFloorEnabled = true

  // bg_env.setBGType("Color")
  bg_env.setEnvType("HDRI")
  bg_env.updateAll()
  bg_env.addGui(sceneGui)

  transformControls.attach(bg_env.sunLight)
  await setupModels()

  animate()
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
  return
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

  intersects.length = 0
}

function onPointerMove(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1
}

async function setupBoba() {
  const gltf = await gltfLoader.loadAsync(MODEL_LIST.boba.url)
  const model = gltf.scene

  model.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true
      child.receiveShadow = true
      child.selectOnRaycast = model
    }
  })

  const meshes = {
    /**
     * @type {Mesh}
     */
    milkMat: model.getObjectByName("milk"),
    glassMat: model.getObjectByName("glass"),
  }

  const texLoader = new TextureLoader()

  /**
   * @type {MeshPhysicalMaterial}
   */
  const mat = meshes.milkMat.material
  mat.thicknessMap = await texLoader.loadAsync(TEXTURES_LIST.boba_thickness.url)
  mat.thicknessMap.flipY = false
  mat.transmissionMap = mat.thicknessMap
  mat.roughnessMap = mat.thicknessMap

  mainObjects.add(model)
  mat.color.set("#cd42ff")
  mat.thickness = 0.2
  mat.attenuationColor.set("#fb5b5b")
  mat.attenuationDistance = 0.0246

  const folder = gui.addFolder("boba")

  for (const mesh of Object.values(meshes)) {
    if (!mesh) continue
    const mat = mesh.material

    const f = folder.addFolder(mat.name)
    f.addColor(mat, "color")
    f.add(mat, "roughness", 0, 1)
    if (mat.transparent) {
      f.add(mat, "opacity", 0, 1)
    }

    if (mat.isMeshPhysicalMaterial) {
      f.add(mat, "transmission", 0, 1)
      f.add(mat, "thickness", 0, 0.4)
      f.addColor(mat, "attenuationColor")
      f.add(mat, "attenuationDistance", 0, 0.2)
    }
  }
}

async function setupWall() {
  const gltf = await gltfLoader.loadAsync(MODEL_LIST.aztec.url)
  const model = gltf.scene

  model.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true
      child.receiveShadow = true
      child.selectOnRaycast = model
    }
  })

  const meshes = {
    /**
     * @type {Mesh}
     */

    glassMat: model.getObjectByName("glass"),
  }

  const texLoader = new TextureLoader()

  /**
   * @type {MeshPhysicalMaterial}
   */
  const mat = meshes.glassMat.material
  // mat.thicknessMap = await texLoader.loadAsync(TEXTURES_LIST.wall_thickness.url)
  // mat.thicknessMap.flipY = false
  // mat.transmissionMap = mat.thicknessMap
  // mat.roughnessMap = mat.thicknessMap

  mainObjects.add(model)
  // mat.color.set("#cd42ff")
  // mat.thickness = 0.2
  // mat.attenuationColor.set("#fb5b5b")
  // mat.attenuationDistance = 0.0246

  const folder = gui.addFolder("Wall")

  for (const mesh of Object.values(meshes)) {
    if (!mesh) continue
    /**
     * @type {MeshPhysicalMaterial}
     */
    const mat = mesh.material

    const params = {
      useAoMap: true,
      aoMap: mat.aoMap,
      useRoughnessMap: true,
      roughnessMap: mat.roughnessMap,
      useNormalMap: true,
      normalMap: mat.normalMap,
      useTransmissionMap: true,
      transmissionMap: mat.transmissionMap,
      useThicknessMap: true,
      thicknessMap: mat.thicknessMap,
    }

    const f = folder.addFolder(mat.name)
    f.addColor(mat, "color")
    f.add(mat, "roughness", 0, 1)
    if (mat.aoMap) f.add(mat, "aoMapIntensity", 0, 1)

    if (mat.transparent) f.add(mat, "opacity", 0, 1)

    if (mat.isMeshPhysicalMaterial) {
      f.add(mat, "transmission", 0, 1)
      f.add(mat, "thickness", 0, 5)
      f.addColor(mat, "attenuationColor")
      f.add(mat, "attenuationDistance", 0, 1)
    }
  }
}

async function setupModels() {
  const ModelList = {
    Aztec: MODEL_LIST.aztec,
    Horse: MODEL_LIST.horse,
  }
  const params = {
    model: ModelList.Aztec,
  }
  const folder = gui.addFolder("Thiccccc")
  folder.open()
  let modelFolder

  async function loadModel() {
    const disposeItems = {}
    mainObjects.traverse((node) => {
      if (node.geometry) {
        disposeItems[node.uuid] = node.geometry
      }
      if (node.material) {
        disposeItems[node.material.uuid] = node.material
        for (const val of Object.values(node.material)) {
          if (val?.isTexture) {
            disposeItems[val.uuid] = val
          }
        }
      }
    })
    console.log("reload", disposeItems)
    for (const garbage of Object.values(disposeItems)) {
      garbage.dispose()
    }

    mainObjects.clear()

    const gltf = await MODEL_LOADER(params.model.url)
    mainObjects.add(gltf.scene)
    const model = gltf.scene

    if (modelFolder) modelFolder.destroy()
    modelFolder = folder.addFolder(params.model.name)
    modelFolder.open()
    let transmissionMaterials = {}
    model.traverse((node) => {
      if (node.isMesh) {
        node.receiveShadow = true
        node.castShadow = true
      }
      if (node.material && !transmissionMaterials[node.material.uuid]) {
        transmissionMaterials[node.material.uuid] = node.material
      }
    })

    for (const mat of Object.values(transmissionMaterials)) {
      const mFol = modelFolder.addFolder(mat.name)

      const texParams = {}
      const texDict = {}
      for (const key of Object.keys(mat)) {
        if (mat[key]?.isTexture) {
          texDict[key] = mat[key]
          texParams[key] = true
        }
      }

      function makeTextureToggleButton(gui, channel) {
        if (texParams[channel])
          gui.add(texParams, channel).onChange((v) => {
            mat[channel] = v ? texDict[channel] : null
            mat.needsUpdate = true
            console.log(channel, mat[channel])
          })
      }

      console.log({ texParams, texDict })

      mFol.addColor(mat, "color")

      mFol.add(mat, "roughness", 0, 1)
      makeTextureToggleButton(mFol, "roughnessMap")
      mFol.add(mat, "metalness", 0, 1)
      makeTextureToggleButton(mFol, "metalnessMap")

      mFol.add(mat, "aoMapIntensity", 0, 1)
      makeTextureToggleButton(mFol, "aoMap")
      makeTextureToggleButton(mFol, "normalMap")

      if (mat.isMeshPhysicalMaterial) {
        console.log({ mat })
        mFol.open()
        const tFol = mFol.addFolder("Transmission stuff")
        tFol.add(mat, "transmission", 0, 1)
        makeTextureToggleButton(tFol, "transmissionMap")
        tFol.add(mat, "thickness", 0, 10)
        makeTextureToggleButton(tFol, "thicknessMap")
        tFol.addColor(mat, "attenuationColor")
        tFol.add(mat, "attenuationDistance", 0, 1)
        tFol.add(mat, "reflectivity", 0, 1)
        const cFol = mFol.addFolder("Clearcoat stuff")
        cFol.add(mat, "clearcoat", 0, 1)
        cFol.add(mat, "clearcoatRoughness", 0, 1)

        const sFol = mFol.addFolder("Sheen stuff")
        sFol.add(mat, "sheen", 0, 1)
        sFol.add(mat, "sheenRoughness", 0, 1)
        sFol.addColor(mat, "sheenColor")

        const spFol = mFol.addFolder("Specular stuff")
        spFol.add(mat, "specularIntensity", 0, 1)
        spFol.addColor(mat, "specularColor")

        const iFol = mFol.addFolder("Iridescence stuff")
        iFol.add(mat, "iridescence", 0, 1)
        iFol.add(mat, "iridescenceIOR", 0, 1)
        // iFol.add(mat.iridescenceThicknessRange, "0")
        iFol.add(mat.iridescenceThicknessRange, "1", 0, 1000).name("Range[1]")
      }
    }
  }

  folder.add(params, "model", ModelList).onChange(loadModel)

  loadModel()
}
