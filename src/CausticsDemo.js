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
  InstancedMesh,
  Matrix4,
  TextureLoader,
  RepeatWrapping,
  DirectionalLight,
  Color,
  DoubleSide,
} from "three"

// Model and Env
import { MODEL_LIST, MODEL_LOADER } from "./MODEL_LIST"
import { BG_ENV } from "../helpers/BG_ENV"
import { Easing, Tween, update } from "@tweenjs/tween.js"
import { HDRI_LIST } from "../hdri/HDRI_LIST"
import { CurveHandler } from "../helpers/CurveHandler"
import { Caustics } from "@pmndrs/vanilla"
import WebXR from "../helpers/webXR"
import { PlaneGeometry } from "three"
import { Texture } from "three"
import { AxesHelper } from "three"
let stats,
  renderer,
  raf,
  camera,
  scene,
  controls,
  gui,
  pointer = new Vector2()

const mainObjects = new Group()

let transformControls

const raycaster = new Raycaster()
const intersects = [] //raycast
let sceneGui
/**
 * @type {BG_ENV}
 */
let bg_env

/**
 * @type {CurveHandler}
 */
let curveHandler

/**
 * @type {import("@pmndrs/vanilla").CausticsType}
 */
let caustics

let webXR

const ModelData = {
  Aztec: {
    name: MODEL_LIST.aztec.name,
    url: MODEL_LIST.aztec.url,
    object3d: null,
    hdri: HDRI_LIST.wide_street2,
  },
  Demon: {
    name: MODEL_LIST.crowned_demon.name,
    url: MODEL_LIST.crowned_demon.url,
    object3d: null,
    hdri: HDRI_LIST.wide_street1,
  },
  Cat: {
    name: MODEL_LIST.cat.name,
    url: MODEL_LIST.cat.url,
    object3d: null,
    hdri: HDRI_LIST.dancing_hall,
  },
  Mourner: {
    name: MODEL_LIST.mourner.name,
    url: MODEL_LIST.mourner.url,
    object3d: null,
    hdri: HDRI_LIST.round_platform,
  },
}
const params = {
  model: ModelData.Aztec,
  pixelRatio: 1,
}
let sunLight
let causticsImagePlane

export default async function CausticsDemo(mainGui) {
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
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 0
  params.pixelRatio = renderer.getPixelRatio()
  app.appendChild(renderer.domElement)

  // camera
  camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 150)
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
  controls.maxDistance = 45
  controls.maxPolarAngle = Math.PI / 1.5
  controls.target.set(0, 1, 0)

  transformControls = new TransformControls(camera, renderer.domElement)
  transformControls.addEventListener("dragging-changed", (event) => {
    controls.enabled = !event.value
    if (!event.value) {
    }
  })

  const clampMin = new Vector3(-2, 0.5, -2)
  const clampMax = new Vector3(2, 3, 2)
  transformControls.addEventListener("change", () => {
    if (transformControls.object) {
      transformControls.object.position.clamp(clampMin, clampMax)
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
  bg_env.sunEnabled = false
  bg_env.shadowFloorEnabled = true
  bg_env.setEnvType("HDRI")
  bg_env.setBGType("GradientProj")
  bg_env.bgColor.set("#0d111c")
  bg_env.bgColor.convertLinearToSRGB()
  bg_env.addGui(sceneGui)
  sceneGui.add(camera, "fov", 1, 179).onChange(() => camera.updateProjectionMatrix())
  sceneGui.add(renderer, "toneMappingExposure", 0, 1)

  curveHandler = new CurveHandler(scene, camera, controls, renderer)
  curveHandler.playBackTween.duration(2000)
  curveHandler.playBackTween.easing(Easing.Exponential.Out)
  curveHandler.addGui(gui)
  await setupModels()

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

  webXR = new WebXR(renderer, scene, camera, mainObjects, render, bg_env, {
    onStart: async () => {
      xrState(true)
    },
    onEnd: () => {
      xrState(false)
    },
  })
  webXR.addGui(gui)

  gui.add(webXR, "onStart")
  gui.add(webXR, "onEnd")

  gui
    .add(params, "pixelRatio", 0.3, window.devicePixelRatio * 4)
    .onChange((v) => {
      renderer.setPixelRatio(v)
    })
    .name("Pixel Ratio")

  animate()
}
const xrState = async (state) => {
  if (state) {
    caustics.group.removeFromParent()
    let orgPlane
    caustics.group.traverse((n) => {
      if (n.geometry) {
        if (n.geometry instanceof PlaneGeometry) {
          causticsImagePlane = n.clone()
          orgPlane = n
        }
      }
    })
    const img = await saveCausticsAsImage(caustics)
    const tex = new Texture(img)
    // tex.flipY = false
    tex.needsUpdate = true
    causticsImagePlane.material = new MeshBasicMaterial({ map: tex, side: DoubleSide })
    causticsImagePlane.scale.y *= -1
    mainObjects.add(causticsImagePlane)

    orgPlane.getWorldPosition(causticsImagePlane.position)
    mainObjects.add(params.model.object3d)
    mainObjects.scale.setScalar(0.1)

    transformControls.detach()
  } else {
    mainObjects.add(caustics.group)
    caustics.scene.add(params.model.object3d)
    mainObjects.position.set(0, 0, 0)
    mainObjects.rotation.set(0, 0, 0)
    mainObjects.scale.set(1, 1, 1)
    mainObjects.remove(causticsImagePlane)
    transformControls.attach(sunLight)
  }
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}

function render(timestamp, frame) {
  stats.update()

  update()
  controls.update()
  webXR.onFrame(frame)
  renderer.render(scene, camera)
}

function animate() {
  renderer.setAnimationLoop(render)
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
  const folder = gui.addFolder("Caus")
  folder.open()
  let modelFolder

  sunLight = new DirectionalLight()
  sunLight.name = "sun"
  sunLight.castShadow = true
  sunLight.shadow.camera.near = 0.01
  sunLight.shadow.camera.far = 50
  const size = 10
  sunLight.shadow.camera.right = size
  sunLight.shadow.camera.left = -size
  sunLight.shadow.camera.top = size
  sunLight.shadow.camera.bottom = -size
  sunLight.shadow.mapSize.width = 1024
  sunLight.shadow.mapSize.height = 1024
  sunLight.shadow.radius = 1.95
  sunLight.shadow.blurSamples = 6
  sunLight.shadow.bias = -0.0005
  sunLight.position.set(2, 3, 2)
  mainObjects.add(sunLight)
  sunLight.add(new AxesHelper(0.1))
  mainObjects.add(sunLight.target)

  scene.add(transformControls)
  transformControls.attach(sunLight)

  let updateTimeout
  transformControls.addEventListener("change", () => {
    clearTimeout(updateTimeout)
    updateTimeout = setTimeout(() => {
      caustics.update()
    }, 50)
  })

  caustics = Caustics(renderer, {
    frames: Infinity,
    resolution: 2048, // 128,
    worldRadius: 0.003,
    ior: 1.01,
    lightSource: sunLight,
  })
  gui.add(sunLight.position, "x", -5, 5)
  gui.add(sunLight.position, "y", -5, 5)
  gui.add(sunLight.position, "z", -5, 5)

  // caustics.helper.visible = false // start hidden
  scene.add(caustics.group, caustics.helper)
  caustics.group.position.y = 0.003 // to prevent z-fighting with groundProjectedSkybox
  caustics.scene.add(mainObjects)

  addCausticsGui(caustics)

  async function loadModel() {
    if (camera.aspect < 1) {
      gui.close()
    }
    curveHandler.stop()
    const data = params.model
    let model, modelPromise

    if (!data.object3d) {
      modelPromise = MODEL_LOADER(data.url).then((gltf) => {
        data.object3d = gltf.scene
      })
    }

    await blackout()

    let bgEnvPromise

    if (data.hdri) {
      bg_env.preset = data.hdri
      bgEnvPromise = bg_env.updateAll()
    }

    const texLoader = new TextureLoader()
    const anisoTexPromise = texLoader.loadAsync("./textures/aniso.png")
    Object.values(ModelData).forEach((dat) => {
      if (dat.object3d && dat.object3d.parent) {
        dat.object3d.removeFromParent()
      }
    })

    const [anisoTexture] = await Promise.all([anisoTexPromise, modelPromise, bgEnvPromise])
    anisoTexture.wrapS = anisoTexture.wrapT = RepeatWrapping
    model = data.object3d

    mainObjects.add(model)
    scene.add(bg_env.shadowFloor)

    console.log({ data })
    renderer.compile(scene, camera)
    setTimeout(() => {
      if (IntroCurves[data.name]) {
        //first camera use current pos
        // camera.position.toArray(IntroCurves[data.name][0].position)
        // controls.target.toArray(IntroCurves[data.name][0].target)
        // IntroCurves[data.name][0].fov = camera.fov
        curveHandler.loadPreset(IntroCurves[data.name])

        curveHandler.play()
      } else {
        fitModelInViewport(mainObjects)
      }

      if (IntroExtras[data.name]) {
        IntroExtras[data.name]()
      }

      exposureEntryTween.start()
    }, 1000)

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

    // three times the charm
    caustics.update()
    caustics.update()
    caustics.update()
  }

  const exposureEntryTween = new Tween(renderer)
    .to({ toneMappingExposure: 1 })
    .duration(2000)
    .easing(Easing.Quadratic.Out)

  const exposureExitTween = new Tween(renderer)
    .to({ toneMappingExposure: 0 })
    .duration(1000)
    .easing(Easing.Quadratic.Out)

  const blackout = () => {
    return new Promise((resolve, reject) => {
      if (renderer.toneMappingExposure === 0) {
        resolve()
        return
      }

      exposureExitTween._valuesStart.toneMappingExposure = renderer.toneMappingExposure
      exposureExitTween.onComplete(resolve)
      exposureExitTween.start()
    })
  }

  loadModel()
  folder.add(params, "model", ModelData).onChange(loadModel)
}

function addCausticsGui(caustics) {
  const folder = gui.addFolder("Caustics")
  folder.open()
  folder.onChange(() => {
    caustics.update()
  })
  folder.addColor(caustics.params, "color")
  folder.add(caustics.params, "ior", 1 - 0.1, 1 + 0.1)
  folder.add(caustics.params, "far", 0, 15).name("Caustics Far")

  folder.add(caustics.helper, "visible").name("helper")

  folder.add(caustics.params, "backside").onChange((v) => {
    if (!v) {
      // to prevent last frame from persisting
      caustics.causticsTargetB.dispose()
    }
  })
  folder.add(caustics.params, "backsideIOR", 0, Math.PI)
  folder.add(caustics.params, "worldRadius", 0.001, 0.2)
  folder.add(caustics.params, "intensity", 0, 0.1)
  folder.add(caustics.params, "causticsOnly")

  // params.lightSource can be vector3 or an object3d
  if (caustics.params.lightSource instanceof Vector3) {
    folder.add(caustics.params.lightSource, "x", -1, 1).name("lightSource X")
    folder.add(caustics.params.lightSource, "y", 0.1, 1).name("lightSource Y")
    folder.add(caustics.params.lightSource, "z", -1, 1).name("lightSource Z")
  }

  const dd = {
    save: () => {
      saveCausticsAsImage(caustics)
    },
  }
  folder.add(dd, "save")
}

const bbox = new Box3()
const center = new Vector3()
const size = new Vector3()
const endPos = new Vector3()
const endTar = new Vector3()
const shiftedCameraPos = new Vector3()

function fitModelInViewport(model) {
  curveHandler.playBackTween.stop()

  bbox.setFromObject(model, true)
  bbox.getCenter(center)
  bbox.getSize(size)

  let distance = size.length() / Math.tan(MathUtils.degToRad(camera.fov) / 2)
  distance -= distance * 0.3
  // move the camera to look at the center of the mesh

  shiftedCameraPos.copy(camera.position)
  shiftedCameraPos.y = center.y

  endPos.lerpVectors(center, shiftedCameraPos, 1 / (center.distanceTo(camera.position) / distance))

  endTar.copy(center)

  if (camera.position.distanceTo(endPos) < 0.1) {
    return
  }

  new Tween(camera.position).to(endPos).duration(1000).easing(Easing.Quadratic.InOut).start()

  new Tween(controls.target).to(endTar).duration(1000).easing(Easing.Quadratic.InOut).start()
}

const IntroCurves = {
  [MODEL_LIST.aztec.name]: [
    {
      position: [3.492476212598207, 1.7745950899766019, 3.0546168261189015],
      target: [1.2047652721505173, -1.8582742974919984, 0.645046189318744],
      fov: 90,
      focus: [0, 0, 0],
    },
    {
      position: [0.5324308158242546, 1.3889240952517157, 4.527657651483493],
      target: [-1.4641092949130297e-8, 1.3889443900197849, -1.942840813229374e-8],
      fov: 50,
      focus: [0, 0, 0],
    },
  ],

  [MODEL_LIST.crowned_demon.name]: [
    {
      position: [0.266634896037906, 0.42199497158512944, 0.24539424865135415],
      target: [0.027214537757725255, 0.34758996128067343, -0.02477326451882255],
      fov: 149,
      focus: [0, 0, 0],
    },

    {
      position: [-1.9692589714105266, 0.8619989021216289, 11.444596023855219],
      target: [0.027214537757725255, 0.34758996128067343, -0.02477326451882255],
      fov: 4,
      focus: [0, 0, 0],
    },
  ],

  [MODEL_LIST.cat.name]: [
    {
      position: [-0.0462548695526149, 49.909485490411235, 0.12685289929020782],
      target: [0.012018844485282898, 0.2759282495826483, 0.07137548923492432],
      fov: 4,
      focus: [0, 0, 0],
    },

    {
      position: [-0.6983884127570257, 0.4383567898365339, 0.7654766425209693],
      target: [0.012018844485282898, 0.2759282495826483, 0.07137548923492432],
      fov: 80,
      focus: [0, 0, 0],
    },
  ],

  [MODEL_LIST.mourner.name]: [
    {
      position: [-0.7435876099939764, 0.5767087582050929, -0.33410177905734206],
      target: [-0.0880950190926897, 0.4785560280754207, 0.5282091171035755],
      fov: 6,
      focus: [0, 0, 0],
    },

    {
      position: [-0.08180431919328181, 0.9374016935960667, 1.7785125019886479],
      target: [-0.045845938474812026, 0.6331712508335492, 0.12170537744696061],
      fov: 60,
      focus: [0, 0, 0],
    },
  ],
}

let instancedParticles, particleTween
const IntroExtras = {
  [MODEL_LIST.mourner.name]: () => {
    if (!instancedParticles) {
      const geo = new SphereGeometry(0.01, 8, 8)
      const mat = new MeshBasicMaterial()
      mat.color.setRGB(10, 10, 10)

      instancedParticles = new InstancedMesh(geo, mat, 1000)
      const matrix = new Matrix4()
      const randomScale = new Vector3()
      console.log(instancedParticles)
      for (let index = 0; index < instancedParticles.count; index++) {
        matrix.identity()

        matrix.setPosition(MathUtils.randFloatSpread(10), MathUtils.randFloat(0, 10), MathUtils.randFloatSpread(10))

        randomScale.setScalar(MathUtils.randFloat(0.6, 1.5))
        matrix.scale(randomScale)

        instancedParticles.setMatrixAt(index, matrix)
        particleTween = new Tween(instancedParticles.rotation)
          .to({
            y: Math.PI * 4,
          })
          .duration(1200000)
      }
    }
    particleTween.start()
    scene.add(instancedParticles)
  },
}

let canvas
let uint8ClampedArray
let color
/**
 * Save Shadows as As Image
 * @param {import("@pmndrs/vanilla").CausticsType} caustics
 */
function saveCausticsAsImage(caustics) {
  return new Promise(async (resolve, reject) => {
    if (!canvas) {
      canvas = document.createElement("canvas")
      color = new Color()
    }

    const renderTarget = caustics.causticsTarget
    const width = renderTarget.width
    const height = renderTarget.height
    console.log(renderTarget)
    const pixels = new Float32Array(width * height * 4)
    renderer.readRenderTargetPixels(renderTarget, 0, 0, width, height, pixels)
    const shadowColor = caustics.params.color

    let min = 100000,
      max = 0
    for (let i = 0; i < pixels.length; i += 4) {
      min = Math.min(min, pixels[i])
      max = Math.max(max, pixels[i])
    }

    const range = max - min
    const alphaScale = 1 / range
    console.log({ min, max })
    for (let i = 0; i < pixels.length; i += 4) {
      color.fromArray(pixels, i)
      const diffuse = color.r

      // const alphaValue = invertedValue * alphaScale

      color.setRGB(diffuse * shadowColor.r, diffuse * shadowColor.g, diffuse * shadowColor.b)
      color.convertLinearToSRGB()
      color.toArray(pixels, i)
      pixels[i + 3] = 1 //MathUtils.mapLinear(diffuse, min, max, 0, 1)
    }

    if (!uint8ClampedArray || uint8ClampedArray.length !== pixels.length) {
      uint8ClampedArray = new Uint8ClampedArray(pixels.length)
    }

    for (let i = 0; i < pixels.length; i++) {
      uint8ClampedArray[i] = Math.round(pixels[i] * 255)
    }

    console.log({ uint8ClampedArray })
    // setup canvas to draw the image data onto
    canvas.width = width
    canvas.height = height

    // Draw the image data onto the canvas
    const context = canvas.getContext("2d")
    const imageData = new ImageData(uint8ClampedArray, width, height)
    context.putImageData(imageData, 0, 0)

    // Create a data URL for the image
    const pngUrl = canvas.toDataURL("image/png")

    // Create a new anchor element
    // const link = document.createElement("a")

    // Set the href attribute of the anchor element to the PNG data URL
    // link.href = pngUrl

    // Set the download attribute of the anchor element to the desired file name
    // link.download = "caustics.png"

    // Simulate a click on the anchor element to download the image
    // link.click()
    const imag = new Image()
    imag.src = pngUrl
    await imag.decode()
    resolve(imag)
  })
}
