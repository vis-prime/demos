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
  Mesh,
  InstancedMesh,
  Matrix4,
  TextureLoader,
  RepeatWrapping,
} from "three"

// Model and Env
import { MODEL_LIST, MODEL_LOADER } from "./MODEL_LIST"
import { BG_ENV } from "../helpers/BG_ENV"
import { Easing, Tween, update } from "@tweenjs/tween.js"
import { HDRI_LIST } from "../hdri/HDRI_LIST"
import { CurveHandler } from "../helpers/CurveHandler"
const blender_docs = "https://docs.blender.org/manual/en/3.5/addons/import_export/scene_gltf2.html"
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
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 0

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
  controls.maxDistance = 50
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
  sceneGui.add(camera, "fov", 1, 179).onChange(() => camera.updateProjectionMatrix())
  curveHandler = new CurveHandler(scene, camera, controls, renderer)
  // curveHandler.addGui(gui)
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
    Pots: {
      name: MODEL_LIST.pots.name,
      url: MODEL_LIST.pots.url,
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
    if (camera.aspect < 1) {
      gui.close()
    }
    curveHandler.stop()
    const data = params.model
    let model, modelPromise

    if (!data.model) {
      modelPromise = MODEL_LOADER(data.url).then((gltf) => {
        data.model = gltf.scene
      })
    }
    await blackout()
    mainObjects.clear()

    let bgEnvPromise

    if (data.hdri) {
      bg_env.preset = data.hdri
      bgEnvPromise = bg_env.updateAll()
    }

    const texloader = new TextureLoader()
    const anisoTexPromise = texloader.loadAsync("./textures/aniso.png")

    const [anisoTexture] = await Promise.all([anisoTexPromise, modelPromise, bgEnvPromise])
    anisoTexture.wrapS = anisoTexture.wrapT = RepeatWrapping
    model = data.model

    mainObjects.add(model)

    await renderer.compile(scene, camera)

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
      console.log("mat", mat)

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
        iFol.add(mat, "iridescenceIOR", 0, 3)
        // iFol.add(mat.iridescenceThicknessRange, "0")
        iFol.add(mat.iridescenceThicknessRange, "1", 0, 1000).name("Range[1]")

        const aFol = mFol.addFolder("Anisotropy stuff")
        aFol.add(mat, "anisotropy", 0, 1)
        aFol.add(mat, "anisotropyRotation", 0, 2 * Math.PI)
        if (!mat.anisotropyMap) {
          mat.anisotropyMap = anisoTexture
          mat.needsUpdate = true
          texDict.anisotropyMap = mat.anisotropyMap
          texParams.anisotropyMap = true
        }
        const anisoTween = new Tween(mat).to({ anisotropyRotation: Math.PI * 10 }, 1e4)
        aFol.add(anisoTween, "start")
        aFol
          .add(anisoTexture.repeat, "x", 1, 10)
          .name("texture repeat")
          .onChange((v) => {
            anisoTexture.repeat.setScalar(v)
          })
        console.log("ANISO", mat.anisotropyMap)
        makeTextureToggleButton(aFol, "anisotropyMap")
      }
    }
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
      position: [3.3071321443089925, 1.388944390019785, 3.307132144799106],
      target: [-1.4641092949130297e-8, 1.3889443900197849, -1.942840813229374e-8],
      fov: 50,
      focus: [0, 0, 0],
    },
    {
      position: [-1.7303892445874622, 1.3344887086602903, 2.200999081476231],
      target: [-1.4641092949130297e-8, 1.3889443900197849, -1.942840813229374e-8],
      fov: 90,
      focus: [0, 0, 0],
    },
    {
      position: [-1.6896684397735617, 3.5239462707277447, -2.79920023168043],
      target: [-1.4641092949130297e-8, 1.3889443900197849, -1.942840813229374e-8],
      fov: 40,
      focus: [0, 0, 0],
    },
    {
      position: [2.4755038102622025, 1.761564273787293, -2.545411150778058],
      target: [-1.4641092949130297e-8, 1.3889443900197849, -1.942840813229374e-8],
      fov: 20,
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
      position: [-0.266634896037906, 0.42199497158512944, -0.24539424865135415],
      target: [0.027214537757725255, 0.34758996128067343, -0.02477326451882255],
      fov: 149,
      focus: [0, 0, 0],
    },
    {
      position: [-0.5886024054583632, 1.0464453715126747, 0.9545603661211215],
      target: [0.027214537757725255, 0.34758996128067343, -0.02477326451882255],
      fov: 61,
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
      position: [-14.426923092458672, 18.216836497152695, 13.817454932177636],
      target: [0.012018844485282898, 0.2759282495826483, 0.07137548923492432],
      fov: 40,
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
      position: [-1.645632273331322, 3.5122442610375155, 3.0459753702566763],
      target: [-0.06061215623379156, 0.5492753703728687, 0.3785231856811201],
      fov: 6,
      focus: [0, 0, 0],
    },
    {
      position: [2.4011512714399372, 1.6907156315557115, 4.119389452751478],
      target: [0.037644224795048455, 0.8720645238701967, 0.1402132755680808],
      fov: 13,
      focus: [0, 0, 0],
    },
    {
      position: [-1.8346955593615164, 1.4382798598126947, 3.214418876318874],
      target: [-0.054762280552704205, 1.0616501794008093, 0.06541819498620187],
      fov: 10,
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
