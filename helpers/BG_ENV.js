import GUI from "lil-gui"
import {
  DirectionalLight,
  EquirectangularReflectionMapping,
  Vector3,
  Group,
  Mesh,
  ShadowMaterial,
  PlaneGeometry,
  Color,
  FloatType,
  HalfFloatType,
  TextureLoader,
  SRGBColorSpace,
  LinearFilter,
  DirectionalLightHelper,
  MeshStandardMaterial,
  AxesHelper,
  CanvasTexture,
} from "three"
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader"
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader"
import { GroundProjectedSkybox } from "three/examples/jsm/objects/GroundProjectedSkybox"
import { HDRI_LIST } from "../hdri/HDRI_LIST"

const textureLoader = new TextureLoader()
const exrLoader = new EXRLoader()
const rgbeLoader = new RGBELoader()

/**
 * @typedef {Object} BgOptions
 * @property {null} None
 * @property {string} Color
 * @property {string} Default
 * @property {string} GroundProjection
 * @property {string} Gradient
 * @property {string} GradientProj
 */

/** @type {BgOptions} */
export const BG_OPTIONS = {
  None: null,
  Color: "color",
  Default: "default",
  GroundProjection: "gp",
  Gradient: "grad",
  GradientProj: "gradProj",
}

/**
 * @typedef {Object} EnvOptions
 * @property {null} None
 * @property {string} HDRI
 */

/** @type {EnvOptions} */
const ENV_OPTIONS = {
  None: null,
  HDRI: "hdri",
}

export class BG_ENV {
  constructor(scene, renderer) {
    this.scene = scene
    this.renderer = renderer

    this.preset = Object.values(HDRI_LIST)[0]

    /**
     * The type of environment to use.
     * @type {EnvOptions}
     */
    this.environmentType = ENV_OPTIONS.None
    this.backgroundType = BG_OPTIONS.GroundProjection

    this.gpRadius = 10
    this.gpHeight = 1

    this.bgColor = new Color("#ffffff")

    this.sunEnabled = false
    this.sunPivot = new Group()
    this.sunLight = new DirectionalLight(0xffffeb, 1)
    this.sunLightIntensity = 1
    this.sunPos = new Vector3(1, 1, 1)
    this.sunColor = new Color("#ffffff")

    this.shadowFloorEnabled
    this.shadowFloor
    this.shadowOpacity = 1

    this.envTexture
    this.bgTexture

    this.groundProjectedSkybox

    this.envCache = {}
    this.bgCache = {}

    this.canvas
    this.gradientTexture
    this.gradientColors = [
      "#FF4500", // Deep orange
      "#FFD700", // Gold
      "#FF1493", // Deep pink
    ]
    this.gradientStops = [0.3, 0.5, 0.7]

    /**
     * gui
     * @type {GUI} gui
     */
    this.guiFolder = null
  }

  init() {
    // sun light
    if (this.sunEnabled && !this.sunPivot) {
      this.sunPivot.name = "sun_pivot"
      this.sunLight.name = "sun"
      this.sunLight.color = this.sunColor
      this.sunLight.castShadow = true
      this.sunLight.shadow.camera.near = 0.1
      this.sunLight.shadow.camera.far = 50
      const size = 10
      this.sunLight.shadow.camera.right = size
      this.sunLight.shadow.camera.left = -size
      this.sunLight.shadow.camera.top = size
      this.sunLight.shadow.camera.bottom = -size
      this.sunLight.shadow.mapSize.width = 1024
      this.sunLight.shadow.mapSize.height = 1024
      this.sunLight.shadow.radius = 1.95
      this.sunLight.shadow.blurSamples = 6
      this.sunLight.shadow.bias = -0.0005
      this.sunPivot.add(this.sunLight)
    }

    //   floor
    if (this.shadowFloorEnabled && !this.shadowFloor) {
      this.shadowFloor = new Mesh(
        new PlaneGeometry(20, 20).rotateX(-Math.PI / 2),
        new ShadowMaterial({ opacity: this.shadowOpacity })
      )
      this.shadowFloor.name = "shadow_floor"
      this.shadowFloor.receiveShadow = true
      this.shadowFloor.position.set(0, 0.001, 0)
    }
  }

  /**
   * Set env type
   * @param {keyof ENV_OPTIONS} key
   */
  setEnvType(key) {
    this.environmentType = ENV_OPTIONS[key]
  }

  /**
   * Set BG type
   * @param {keyof BG_OPTIONS} key
   */
  setBGType(key) {
    this.backgroundType = BG_OPTIONS[key]
  }

  useFullFloat() {
    exrLoader.setDataType(FloatType)
    rgbeLoader.setDataType(FloatType)
  }

  /**
   * Add gui
   * @param {GUI} gui
   */
  addGui(gui) {
    const folder = gui.addFolder("BG & ENV")
    this.guiFolder = folder
    folder.add(this, "preset", HDRI_LIST).onChange((v) => {
      this.preset = v
      this.updateAll()
    })

    folder.add(this, "environmentType", ENV_OPTIONS).onChange(() => {
      this.updateAll()
    })

    const addBgGui = () => {
      this.bgColorPicker?.destroy()
      this.bgColorPicker = null

      if (this.backgroundType === BG_OPTIONS.Color) {
        this.bgColorPicker = folder.addColor(this, "bgColor")
      } else if (this.backgroundType === BG_OPTIONS.Gradient || this.backgroundType === BG_OPTIONS.GradientProj) {
        this.bgColorPicker = folder.addFolder("Gradient Colors")
        this.gradientColors.forEach((i, index) => {
          this.bgColorPicker.addColor(this.gradientColors, index).onChange(() => {
            this.updateAll()
          })
          this.bgColorPicker.add(this.gradientStops, index, 0, 1).onChange(() => {
            this.updateAll()
          })
        })
      }
    }
    folder.add(this, "backgroundType", BG_OPTIONS).onChange((v) => {
      this.updateAll()
      addBgGui()
    })

    if (this.sunEnabled) {
      folder.add(this, "sunLightIntensity", 0, 10).onChange((v) => {
        if (this.sunLight) this.sunLight.intensity = v
      })
    }
    addBgGui()
    return folder
  }

  /**
   * Download if needed
   * @param {HDRI_LIST} data
   */
  async updateAll() {
    return new Promise(async (resolve) => {
      const data = this.preset
      this.init()

      await Promise.all([this.downloadEnvironment(data), this.downloadBackground(data)])

      this.scene.environment = this.envTexture

      if (!this.bgTexture) {
        this.scene.background = null
        if (this.backgroundType === BG_OPTIONS.Color) {
          this.scene.background = this.bgColor
        }
      }

      if (this.backgroundType === BG_OPTIONS.GroundProjection && this.bgTexture) {
        this.scene.background = null

        this.initSkyBox()

        if (data.groundProj.radius) this.gpRadius = data.groundProj.radius

        if (data.groundProj.height) this.gpHeight = data.groundProj.height
        this.groundProjectedSkybox.material.uniforms.map.value = this.bgTexture
        this.groundProjectedSkybox.radius = this.gpRadius
        this.groundProjectedSkybox.height = this.gpHeight

        this.scene.add(this.groundProjectedSkybox)
      } else {
        if (this.backgroundType === BG_OPTIONS.Gradient || this.backgroundType === BG_OPTIONS.GradientProj) {
          if (!this.canvas) {
            this.canvas = document.createElement("canvas")
          }
          // Create a canvas element
          const canvas = this.canvas
          canvas.width = 256
          canvas.height = 128
          // Get the 2D rendering context
          const ctx = canvas.getContext("2d")

          // Define the gradient
          const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
          gradient.addColorStop(this.gradientStops[0], this.gradientColors[0]) // Deep orange
          gradient.addColorStop(this.gradientStops[1], this.gradientColors[1]) // Gold
          gradient.addColorStop(this.gradientStops[2], this.gradientColors[2]) // Deep pink

          // Apply the gradient to the canvas
          ctx.fillStyle = gradient
          ctx.fillRect(0, 0, canvas.width, canvas.height)

          // Create a texture from the canvas
          this.gradientTexture = new CanvasTexture(canvas)
          this.gradientTexture.mapping = EquirectangularReflectionMapping
          this.gradientTexture.minFilter = LinearFilter
          this.gradientTexture.needsUpdate = true
        }
        if (this.groundProjectedSkybox?.parent) {
          this.groundProjectedSkybox.removeFromParent()
        }

        switch (this.backgroundType) {
          case BG_OPTIONS.Default: {
            this.scene.background = this.bgTexture
            break
          }

          case BG_OPTIONS.Color: {
            this.scene.background = this.bgColor
            break
          }

          case BG_OPTIONS.Gradient: {
            this.scene.background = this.gradientTexture
            break
          }

          case BG_OPTIONS.GradientProj: {
            this.initSkyBox()
            this.groundProjectedSkybox.height = 2
            this.groundProjectedSkybox.radius = 100
            this.groundProjectedSkybox.material.uniforms.map.value = this.gradientTexture
            this.scene.background = null
            this.scene.add(this.groundProjectedSkybox)

            break
          }

          default: {
            this.scene.background = null
            break
          }
        }
      }

      if (this.sunEnabled) {
        if (!this.sunPivot.parent) {
          this.scene.add(this.sunPivot)
        }

        if (data.sunPos) {
          this.sunLight.position.fromArray(data.sunPos)
        } else {
          this.sunLight.position.set(3, 3, 3)
        }

        if (!data.sunColor) {
          this.sunLight.color.set(data.sunColor)
        } else {
          this.sunLight.color.set("white")
        }
      } else {
        if (this.sunPivot.parent) {
          this.sunPivot.removeFromParent()
        }
      }

      if (this.shadowFloorEnabled) {
        if (!this.shadowFloor.parent) {
          this.scene.add(this.shadowFloor)
        }
        if (!data.shadowOpacity) {
          this.shadowFloor.material.opacity = data.shadowOpacity
        } else {
          this.shadowFloor.material.opacity = 0.5
        }
      } else {
        if (this.shadowFloor.parent) {
          this.shadowFloor.removeFromParent()
        }
      }

      resolve()
    })
  }

  initSkyBox() {
    if (!this.groundProjectedSkybox) {
      this.groundProjectedSkybox = new GroundProjectedSkybox(this.gradientTexture || this.bgTexture)
      this.groundProjectedSkybox.scale.setScalar(100)
    }
  }

  /**
   * Download Env
   * @param {Object} param0
   */
  async downloadEnvironment({ exr, hdr } = {}) {
    const key = exr || hdr

    if (this.environmentType === ENV_OPTIONS.None) {
      this.envTexture = null
      return
    }

    let texture = this.envCache[key]
    if (!texture) {
      texture = exr ? await exrLoader.loadAsync(key) : await rgbeLoader.loadAsync(key)
      this.envCache[key] = texture
      texture.mapping = EquirectangularReflectionMapping
      this.renderer.initTexture(texture)
    }

    this.envTexture = texture
  }

  async downloadBackground({ webP, avif } = {}) {
    const key = webP || avif
    if (!(this.backgroundType === BG_OPTIONS.Default || this.backgroundType === BG_OPTIONS.GroundProjection)) {
      this.bgTexture = null
      return
    }

    if (key) {
      let texture = this.bgCache[key]
      if (!texture) {
        texture = await textureLoader.loadAsync(key)
        this.bgCache[key] = texture
        texture.mapping = EquirectangularReflectionMapping
        texture.colorSpace = SRGBColorSpace
        texture.minFilter = LinearFilter
        this.renderer.initTexture(texture)
      }

      this.bgTexture = texture
    }
  }

  async setupEnvironment() {
    // light

    //   scene.add(this.shadowFloor)

    loadEnv(this.environmentType)
  }

  /**
   * Update env
   * @param {HDRI_LIST} envDict
   * @returns
   * @deprecated
   */
  async loadEnv(envDict) {
    if (!envDict) {
      scene.background = null
      scene.environment = null
      return
    }

    if (envDict.exr) {
      const texture = await exrLoader.loadAsync(envDict.exr)
      texture.mapping = EquirectangularReflectionMapping
      scene.environment = texture
      env = texture
    }

    if (envDict.hdr) {
      const texture = await rgbeLoader.loadAsync(envDict.hdr)
      texture.mapping = EquirectangularReflectionMapping
      scene.environment = texture
      bg = texture
    }

    if (envDict.webP || envDict.avif) {
      const texture = await textureLoader.loadAsync(envDict.webP || envDict.avif)
      texture.mapping = EquirectangularReflectionMapping
      texture.colorSpace = SRGBColorSpace
      scene.background = texture

      if (params.groundProjection) loadGroundProj(params.environment)
    }

    if (envDict.sunPos) {
      sunLight.visible = true
      sunLight.position.fromArray(envDict.sunPos)
    } else {
      sunLight.visible = false
    }

    if (envDict.sunColor) {
      sunLight.color.set(envDict.sunColor)
    } else {
      sunLight.color.set(0xffffff)
    }

    // if (envDict.shadowOpacity) {
    //   shadowFloor.material.opacity = envDict.shadowOpacity
    // }
  }
}
