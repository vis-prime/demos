import {
  BloomEffect,
  CopyPass,
  DepthOfFieldEffect,
  DepthPickingPass,
  EffectComposer,
  EffectPass,
  OutlineEffect,
  RenderPass,
} from "postprocessing"
import { MathUtils, Mesh, MeshBasicMaterial, SphereGeometry, Vector3 } from "three"
import { ThreeAssets } from "./ThreeAssets"
import { Easing, Tween } from "@tweenjs/tween.js"
import { SSGIEffect, TRAAEffect, MotionBlurEffect, VelocityDepthNormalPass } from "realism-effects"
import { SSGIDebugGUI } from "../src old/utils/SSGIDebugGUI"

export class EffectsEditor {
  /**
   * A
   * @param {ThreeAssets} threeAssets
   */
  constructor(threeAssets) {
    this.enabled = true

    /**
     * @type {ThreeAssets}
     */
    this.threeAssets = threeAssets

    const renderer = threeAssets.renderer

    this.composer = new EffectComposer(renderer, {
      multisampling: Math.min(4, renderer.capabilities.maxSamples),
    })
    this.renderPass = new RenderPass(this.threeAssets.scene, this.threeAssets.camera)

    this.focusPoint = new Vector3()

    this.passStack = []
    this.init()
  }

  init() {
    const bloom = new BloomEffect()
    bloom.intensity = 1

    const dof = new DepthOfFieldEffect(this.threeAssets.camera, {
      bokehScale: 6,
      worldFocusRange: 0.5,
    })

    const outline = new OutlineEffect(this.threeAssets.scene, this.threeAssets.camera)

    dof.target = this.focusPoint
    this.dof = dof
    console.log(this.dof)
    this.effects = new EffectPass(this.threeAssets.camera, bloom, dof)

    this.addDepthPicking()
    this.passStack.push(this.renderPass, this.effects)

    this.toggle(true)
  }

  addDepthPicking() {
    const depthPickingPass = new DepthPickingPass()

    this.passStack.push(depthPickingPass, new CopyPass())

    const ndc = new Vector3()
    const cursor = new Mesh(
      new SphereGeometry(0.005, 8, 8),
      new MeshBasicMaterial({
        color: 0xa9a9a9,
        transparent: true,
        depthWrite: false,
        opacity: 0.1,
      })
    )

    cursor.name = "depth_picking_cursor"

    const pickDepth = async (useCenter = false) => {
      if (useCenter) {
        ndc.set(0, 0)
      } else {
        ndc.copy(this.threeAssets.pointer)
      }

      ndc.z = await depthPickingPass.readDepth(ndc)
      ndc.z = ndc.z * 2.0 - 1.0

      // Convert from NDC to world position.
      cursor.position.copy(ndc.unproject(this.threeAssets.camera))

      if (cursor.position.distanceTo(this.threeAssets.camera.position) > 10) {
        return
      }

      focusTween._valuesStart.x = this.focusPoint.x
      focusTween._valuesStart.y = this.focusPoint.y
      focusTween._valuesStart.z = this.focusPoint.z

      focusTween.to({
        x: cursor.position.x,
        y: cursor.position.y,
        z: cursor.position.z,
      })

      focusTween.stop()
      focusTween.start()
    }

    let prevPointerDown = performance.now()

    const focusTween = new Tween(this.focusPoint).duration(500).easing(Easing.Quadratic.Out)

    const onPointerUp = (event) => {
      this.threeAssets.pointer.x = (event.offsetX / this.threeAssets.resolution.x) * 2 - 1
      this.threeAssets.pointer.y = -(event.offsetY / this.threeAssets.resolution.y) * 2 + 1

      const time = performance.now()

      if (event.which === 1 && time - prevPointerDown < 200) {
        pickDepth()
      }
    }

    let timeout, distance
    const controls = this.threeAssets.controls
    controls.addEventListener("change", () => {
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        pickDepth(true)
      }, 50)

      distance = controls.getDistance()

      this.dof.bokehScale = MathUtils.clamp(MathUtils.mapLinear(distance, 0, 10, 10, 0), 0, 10)
      this.dof.cocMaterial.worldFocusRange = distance / 4

      if (this.threeAssets.scene.fog) {
        this.threeAssets.scene.fog.density = MathUtils.clamp(MathUtils.mapLinear(distance, 0, 5, 0.1, 0), 0, 1)
      }

      console.log({ distance })
    })

    const onPointerDown = () => {
      prevPointerDown = performance.now()
    }

    const container = app // document.getElementById("three")

    container.addEventListener("pointerdown", onPointerDown)
    container.addEventListener("pointerup", onPointerUp)
  }

  addSSGI() {
    const scene = this.threeAssets.scene
    const camera = this.threeAssets.camera
    const composer = this.composer

    const velocityDepthNormalPass = new VelocityDepthNormalPass(scene, camera)
    const options = {
      distance: 1,
      thickness: 1,
      autoThickness: false,
      maxRoughness: 1,
      blend: 0.9,
      denoiseIterations: 1,
      denoiseKernel: 2,
      denoiseDiffuse: 10,
      denoiseSpecular: 10,
      depthPhi: 2,
      normalPhi: 50,
      roughnessPhi: 1,
      envBlur: 0.5,
      importanceSampling: true,
      directLightMultiplier: 1,
      maxEnvLuminance: 50,
      steps: 20,
      refineSteps: 5,
      spp: 1,
      resolutionScale: 1,
      missedRays: false,
    }

    // TRAA
    const traaEffect = new TRAAEffect(scene, camera, velocityDepthNormalPass)
    // SSGI
    const ssgiEffect = new SSGIEffect(scene, camera, velocityDepthNormalPass, options)
    this.effects = new EffectPass(camera, ssgiEffect)

    // Motion Blur
    const motionBlurEffect = new MotionBlurEffect(velocityDepthNormalPass, {
      jitter: 1,
    })

    // const ssrEffect = new SSREffect(scene, camera, velocityDepthNormalPass, options)

    // const ssdgiEffect = new SSDGIEffect(scene, camera, velocityDepthNormalPass, options)

    // this.effects = new EffectPass(camera, new GridEffect())
    this.effects = new EffectPass(camera, ssgiEffect)

    // this.effects = new EffectPass(camera, ssdgiEffect)
    // this.effects = new EffectPass(camera, ssrEffect)
    // this.effects = new EffectPass(camera, ssdgiEffect)

    this.passStack = [velocityDepthNormalPass, ssgiEffect]

    this.toggle(true)

    if (!this.ssgiGuiAdded) {
      new SSGIDebugGUI(this.threeAssets.gui, ssgiEffect, options)
      // new SSGIDebugGUI(this.threeAssets.gui, ssrEffect, options)
      // new SSGIDebugGUI(this.threeAssets.gui, ssdgiEffect, options)

      this.ssgiGuiAdded = true
    }
  }

  toggle(state) {
    this.enabled = state
    if (state) {
      this.composer.removeAllPasses()
      for (const pass of this.passStack) {
        this.composer.addPass(pass)
      }
      console.log(this.composer.passes)
    } else {
      this.composer.removeAllPasses()
      this.composer.addPass(this.renderPass)
    }
  }

  addGui(gui) {
    const folder = gui.addFolder("Post")

    folder.add(this, "enabled").onChange((v) => {
      this.toggle(v)
    })

    folder.add(this.dof, "bokehScale", 0, 12, 0.01)
    folder.add(this.dof.circleOfConfusionMaterial, "worldFocusRange", 0, 2, 0.01)
    folder.add(this, "addSSGI")
  }
}
