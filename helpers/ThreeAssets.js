import {
  ACESFilmicToneMapping,
  Clock,
  Color,
  FogExp2,
  PerspectiveCamera,
  Raycaster,
  Scene,
  sRGBEncoding,
  Vector2,
  WebGLRenderer,
} from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"
// import { FPS_STATS } from "../src old/utils/FPS_STATS"
import GUI from "lil-gui"
import { update } from "@tweenjs/tween.js"
import { EffectsEditor } from "./EffectsEditor"
import { fitCameraToCenteredObject } from "./CameraUtils"
import { BG_ENV } from "./BG_ENV"

const container = app
const guiButton = document.getElementById("guiButton")

export class ThreeAssets {
  /**
   * Scene Editor
   */
  constructor() {
    let url_string = window.location.href
    let url = new URL(url_string)
    this.urlParams = {
      scene: url.searchParams.get("scene") || "",
      debug: url.searchParams.get("debug") === "true" ? true : false,
    }

    this.params = {
      isAnimating: true,
      pixelRatio: Math.min(2, window.devicePixelRatio),
    }
    // this.stats = new FPS_STATS()
    this.resolution = new Vector2()
    this.camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 150)

    this.scene = new Scene()
    /**
     * renderer
     * @type {WebGLRenderer}
     */
    this.renderer = new WebGLRenderer({
      powerPreference: "high-performance",
      premultipliedAlpha: false,
      stencil: false,
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: true,
    })
    this.renderer.autoClear = false

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)

    this.effectsEditor = new EffectsEditor(this)

    this.raycaster = new Raycaster()

    this.pointer = new Vector2()

    /**
     * Gui
     * @type {GUI}
     */
    this.gui

    /**
     * Gui
     * @type {GUI}
     */
    this.guiScene

    /**
     * Mixers
     * @type {Array<>Mixer}
     */
    this.mixers = {}

    this.clock = new Clock()

    this.bgEnv = new BG_ENV(this.scene)

    this.init()

    if (guiButton)
      guiButton.onclick = () => {
        if (this.gui) {
          this.gui.destroy()
          this.gui = null
        } else {
          this.addGui()
        }
      }
  }

  init() {
    this.renderer.setPixelRatio(this.params.pixelRatio)
    this.renderer.toneMapping = ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1
    this.renderer.outputEncoding = sRGBEncoding
    this.renderer.shadowMap.enabled = true
    // this.renderer.shadowMap.type = VSMShadowMap

    // document.body.appendChild(this.renderer.domElement)
    container.appendChild(this.renderer.domElement)

    this.scene.background = new Color(0xff0000)
    this.scene.environmentIntensity = 0
    this.scene.fog = new FogExp2(0xfce6c7, 0.2)
    this.controls.autoRotateSpeed = 1

    this.controls.maxDistance = 50
    this.controls.target.set(0, 0, 0)
    this.controls.update()
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.1

    this.camera.position.set(1, 1, 1)

    const onResize = () => {
      this.resolution.set(window.innerWidth, window.innerHeight)
      this.camera.aspect = this.resolution.x / this.resolution.y
      this.camera.updateProjectionMatrix()

      // fitCameraToCenteredObject(this.camera, this.scene, 0, this.controls)
      this.effectsEditor.composer.setSize(this.resolution.x, this.resolution.y)
      console.log("Resize", {
        w: this.resolution.x,
        h: this.resolution.y,
        fov: this.camera.fov,
        asp: this.camera.aspect,
      })
    }
    window.addEventListener("resize", onResize)
    onResize()
  }

  log() {
    console.log(this)
  }

  addGui(gui) {
    this.gui = gui
    this.guiScene = this.gui.addFolder("Scene")
    // this.stats.addGui(this.guiScene)
    this.guiScene.add(this, "log")
    this.guiScene.add(this.params, "pixelRatio", 0.25, window.devicePixelRatio, 0.01).onChange((v) => {
      this.renderer.setPixelRatio(v)
    })
    this.guiScene.add(this, "fitContent")
    this.guiScene.add(this.controls, "autoRotate").onChange((v) => {
      if (v) this.controls.autoRotateSpeed *= -1 // invert direction on each click
    })
    this.guiScene.addColor(this.scene.fog, "color")
    this.guiScene.add(this.scene.fog, "density", 0, 1, 0.001)
    this.guiScene
      .add(this.scene, "environmentIntensity", 0, 1.5, 0.001)
      .listen()
      .onChange(() => {
        this.updateEnvIntensity()
      })

    this.effectsEditor.addGui(this.guiScene)
    this.bgEnv.addGui(this.guiScene)
  }

  render() {
    const delta = this.clock.getDelta()
    // this.stats.update()
    update(performance.now())
    this.controls.update()
    for (const mixer of Object.values(this.mixers)) {
      mixer.update(delta)
    }
    // if (this.effectsEditor.enabled) {
    this.effectsEditor.composer.render()
    // } else {
    // this.renderer.render(this.scene, this./camera)
    // }
  }

  animate() {
    this.params.isAnimating = true
    this.renderer.setAnimationLoop(this.render.bind(this))
  }

  stopAnimate() {
    this.params.isAnimating = false
    this.renderer.setAnimationLoop(null)
  }

  updateEnvIntensity = () => {
    this.scene.backgroundIntensity = this.scene.environmentIntensity
    this.scene.traverse((node) => {
      if (node?.material?.envMapIntensity !== undefined) {
        node.material.envMapIntensity = this.scene.environmentIntensity
        node.material.needsUpdate = true
      }
    })
  }

  raycast() {
    this.raycaster.setFromCamera(this.pointer, this.camera)

    const intersects = raycaster.intersectObjects(this.scene.children, false)

    if (intersects.length > 0) {
      //   if (INTERSECTED != intersects[0].object) {
      //   }
    } else {
    }
  }

  fitContent(obj = this.scene, offset = 0) {
    fitCameraToCenteredObject(this.camera, obj, offset, this.controls)
  }
}
