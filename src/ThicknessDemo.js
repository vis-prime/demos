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
  Box3,
  Vector3,
  MathUtils,
} from "three"

// Model and Env
import { MODEL_LIST, MODEL_LOADER } from "../models/MODEL_LIST"
import { BG_ENV } from "../helpers/BG_ENV"
import { Easing, Tween, update } from "@tweenjs/tween.js"
import { TextureLoader } from "three"
import { TEXTURES_LIST } from "../textures/TEXTURES_LIST"
import { HDRI_LIST } from "../hdri/HDRI_LIST"
import { CurveHandler } from "../helpers/CurveHandler"
const blender_docs =
  "https://docs.blender.org/manual/en/3.5/addons/import_export/scene_gltf2.html"
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

  sceneGui.add(transformControls, "mode", ["translate", "rotate", "scale"])
  bg_env = new BG_ENV(scene)
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

async function setupModels() {
  const curveHandler = new CurveHandler(scene, camera, controls, renderer)
  // curveHandler.addGui(gui)
  const ModelData = {
    Aztec: {
      name: MODEL_LIST.aztec.name,
      url: MODEL_LIST.aztec.url,
      model: null,
      hdri: HDRI_LIST.wide_street2,
    },
    Demon: {
      name: MODEL_LIST.crowned_demon.name,
      url: MODEL_LIST.crowned_demon.url,
      model: null,
      hdri: HDRI_LIST.wide_street1,
    },
    Cat: {
      name: MODEL_LIST.cat.name,
      url: MODEL_LIST.cat.url,
      model: null,
      hdri: HDRI_LIST.dancing_hall,
    },
    Mourner: {
      name: MODEL_LIST.mourner.name,
      url: MODEL_LIST.mourner.url,
      model: null,
      hdri: HDRI_LIST.round_platform,
    },
  }

  const params = {
    model: ModelData.Aztec,
  }

  const folder = gui.addFolder("Thiccccc")
  folder.open()
  let modelFolder

  async function loadModel() {
    mainObjects.clear()
    const data = params.model
    let model, modelPromise
    if (!data.model) {
      modelPromise = MODEL_LOADER(data.url).then((gltf) => {
        data.model = gltf.scene
      })
    }

    let bgEnvPromise
    if (data.hdri) {
      bg_env.preset = data.hdri
      bgEnvPromise = bg_env.updateAll()
    }

    await Promise.all([modelPromise, bgEnvPromise])
    model = data.model
    console.log({ modelPromise, bgEnvPromise })
    mainObjects.add(model)

    await renderer.compile(scene, camera)

    setTimeout(() => {
      if (IntroCurves[data.name]) {
        //first camera use current pos
        camera.position.toArray(IntroCurves[data.name][0].position)
        controls.target.toArray(IntroCurves[data.name][0].target)
        IntroCurves[data.name][0].fov = camera.fov
        curveHandler.loadPreset(IntroCurves[data.name])
        curveHandler.play()
      } else {
        fitModelInViewport(mainObjects)
      }
    }, 100)

    if (modelFolder) modelFolder.destroy()
    modelFolder = folder.addFolder(data.name)
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

    const test = {
      fit: () => {
        fitModelInViewport(model)
      },
    }
    modelFolder.add(test, "fit")

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
            console.log(channel, v)
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

  folder.add(params, "model", ModelData).onChange(loadModel)

  loadModel()
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

const IntroCurves = {
  [MODEL_LIST.aztec.name]: [
    {
      position: [3.3071321443089925, 1.388944390019785, 3.307132144799106],
      target: [
        -1.4641092949130297e-8, 1.3889443900197849, -1.942840813229374e-8,
      ],
      fov: 50,
      focus: [0, 0, 0],
    },
    {
      position: [-1.7303892445874622, 1.3344887086602903, 2.200999081476231],
      target: [
        -1.4641092949130297e-8, 1.3889443900197849, -1.942840813229374e-8,
      ],
      fov: 90,
      focus: [0, 0, 0],
    },
    {
      position: [-1.6896684397735617, 3.5239462707277447, -2.79920023168043],
      target: [
        -1.4641092949130297e-8, 1.3889443900197849, -1.942840813229374e-8,
      ],
      fov: 40,
      focus: [0, 0, 0],
    },
    {
      position: [2.4755038102622025, 1.761564273787293, -2.545411150778058],
      target: [
        -1.4641092949130297e-8, 1.3889443900197849, -1.942840813229374e-8,
      ],
      fov: 20,
      focus: [0, 0, 0],
    },
    {
      position: [0.5324308158242546, 1.3889240952517157, 4.527657651483493],
      target: [
        -1.4641092949130297e-8, 1.3889443900197849, -1.942840813229374e-8,
      ],
      fov: 50,
      focus: [0, 0, 0],
    },
  ],
}
