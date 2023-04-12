import { Easing, Tween } from "@tweenjs/tween.js"
import {
  AxesHelper,
  BufferGeometry,
  CatmullRomCurve3,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  Vector3,
  Group,
  Mesh,
  SphereGeometry,
} from "three"
import { TransformControls } from "three/examples/jsm/controls/TransformControls"

/**
 * @enum
 */
let preset = [
  {
    position: [3.3071321443089925, 1.388944390019785, 3.307132144799106],
    target: [-1.4641092949130297e-8, 1.3889443900197849, -1.942840813229374e-8],
    fov: 50,
    focus: [0, 0, 0],
  },
  {
    position: [-1.7303892445874622, 1.3344887086602903, 2.200999081476231],
    target: [-1.4641092949130297e-8, 1.3889443900197849, -1.942840813229374e-8],
    fov: 50,
    focus: [0, 0, 0],
  },
  {
    position: [-1.6896684397735617, 3.5239462707277447, -2.79920023168043],
    target: [-1.4641092949130297e-8, 1.3889443900197849, -1.942840813229374e-8],
    fov: 50,
    focus: [0, 0, 0],
  },
  {
    position: [2.4755038102622025, 1.761564273787293, -2.545411150778058],
    target: [-1.4641092949130297e-8, 1.3889443900197849, -1.942840813229374e-8],
    fov: 50,
    focus: [0, 0, 0],
  },
  {
    position: [0.5324308158242546, 1.3889240952517157, 4.527657651483493],
    target: [-1.4641092949130297e-8, 1.3889443900197849, -1.942840813229374e-8],
    fov: 50,
    focus: [0, 0, 0],
  },
]

export class CurveHandler {
  constructor(scene, camera, controls, renderer) {
    this.renderer = renderer
    this.scene = scene
    this.camera = camera
    this.controls = controls

    this.timeline = 0

    this.keyFrames = []

    this.listCamera = []
    this.listTarget = []
    this.listFocus = []
    this.listFov = []

    this.tension = 1

    this.lineCamera
    this.lineTarget
    this.lineFocus

    this.cameraCurve = new CatmullRomCurve3()
    this.targetCurve = new CatmullRomCurve3()
    this.fovCurve = new CatmullRomCurve3()
    this.fovVector = new Vector3()
    this.focusCurve = new CatmullRomCurve3()

    this.shouldShowCurve = false

    this.gui
    this.keyFramesGui

    this.keyFrameMeshes = []

    this.playBackTween = new Tween(this)
      .to({ timeline: 1 })
      .duration(10000)
      .easing(Easing.Quadratic.InOut)

    this.init()
    this.loadPreset()
  }
  init() {
    this.playBackTween.onUpdate(() => {
      this.scrub()
    })

    //Line
    const camGeometry = new BufferGeometry()
    const camLineMaterial = new LineBasicMaterial({
      color: 0x0000ff,
      //   scale: 1,
      //   dashSize: 3,
      //   gapSize: 1,
      //   vertexColors: true,
    })
    this.lineCamera = new Line(camGeometry, camLineMaterial)

    //////////////
    // target line
    const targetGeometry = new BufferGeometry()
    const targetLineMaterial = new LineBasicMaterial({
      color: 0x00ffff,
      //   scale: 1,
      //   dashSize: 3,
      //   gapSize: 1,
      //   vertexColors: true,
    })
    this.lineTarget = new Line(targetGeometry, targetLineMaterial)

    const focusGeometry = new BufferGeometry()
    const focusLineMaterial = new LineBasicMaterial({
      color: 0xff00ff,
      //   scale: 1,
      //   dashSize: 3,
      //   gapSize: 1,
      //   vertexColors: true,
    })
    this.lineFocus = new Line(focusGeometry, focusLineMaterial)
  }

  loadPreset(presetArray = preset) {
    for (let index = 0; index < presetArray.length; index++) {
      let data = presetArray[index]
      const keyFrame = new KeyFrame()

      //   const localKeyframe = JSON.parse(localStorage.getItem(index))
      //   if (Object.values(localKeyframe).length) {
      //     console.log("local keyframe", localKeyframe)
      //     data = this.loadPreset
      //   }

      keyFrame.fov = data.fov
      keyFrame.position = data.position
      keyFrame.target = data.target
      keyFrame.focus = data.focus
      this.keyFrames[index] = keyFrame
    }
    this.updateCurve()
    this.guiKeyframesUpdate()
  }

  addKeyFrame() {
    const keyFrame = new KeyFrame()
    this.updateKeyframe(keyFrame)
    this.keyFrames.push(keyFrame)

    this.updateCurve()
    this.guiKeyframesUpdate()
  }

  updateLine() {
    if (this.keyFrames.length < 2) return
    const camPoints = this.cameraCurve.getPoints(100)
    this.lineCamera.geometry.setFromPoints(camPoints)
    this.lineCamera.computeLineDistances()

    // update the lines with current points
    const targetPoints = this.targetCurve.getPoints(100)
    this.lineTarget.geometry.setFromPoints(targetPoints)
    this.lineTarget.computeLineDistances()

    // update the lines with current points
    const focusPoints = this.focusCurve.getPoints(100)
    this.lineFocus.geometry.setFromPoints(focusPoints)
    this.lineFocus.computeLineDistances()
  }

  updateCurve() {
    if (this.keyFrames.length < 2) return
    // empty all the arrays
    this.listCamera.splice(0, this.listCamera.length)
    this.listTarget.splice(0, this.listTarget.length)
    this.listFov.splice(0, this.listFov.length)
    this.listFocus.splice(0, this.listFocus.length)
    // this.listCamera.push(new Vector3().set(5, 5, 5))
    // this.listTarget.push(new Vector3().set(1, 1, 1))
    // this.listFov.push(new Vector3().setX(50))

    for (const keyFrame of this.keyFrames) {
      const position = new Vector3().fromArray(keyFrame.position)
      const target = new Vector3().fromArray(keyFrame.target)
      const fov = new Vector3().setX(keyFrame.fov)
      const focus = new Vector3().fromArray(keyFrame.focus)

      this.listCamera.push(position)
      this.listTarget.push(target)
      this.listFov.push(fov)
      this.listFocus.push(focus)
    }

    this.cameraCurve.points = this.listCamera
    this.cameraCurve.curveType = "catmullrom"
    this.cameraCurve.tension = this.tension

    this.targetCurve.points = this.listTarget
    this.targetCurve.curveType = "catmullrom"
    this.targetCurve.tension = this.tension

    this.fovCurve.points = this.listFov
    this.fovCurve.curveType = "catmullrom"
    this.fovCurve.tension = this.tension

    this.focusCurve.points = this.listFocus
    this.focusCurve.curveType = "catmullrom"
    this.focusCurve.tension = this.tension
  }

  scrub() {
    if (this.keyFrames.length < 2) return
    const pointOnCurve = this.timeline
    this.cameraCurve.getPoint(pointOnCurve, this.camera.position)
    this.targetCurve.getPoint(pointOnCurve, this.controls.target)
    this.fovCurve.getPoint(pointOnCurve, this.fovVector)
    this.focusCurve.getPoint(pointOnCurve, this.scene.focus)
    this.camera.fov = this.fovVector.x
    this.camera.updateProjectionMatrix()
  }

  showCurve() {
    if (this.keyFrames.length < 2) return
    this.shouldShowCurve = !this.shouldShowCurve

    // meshes
    const geo = new SphereGeometry(0.1)
    for (const [index, keyFrame] of this.keyFrames.entries()) {
      if (!this.keyFrameMeshes[index]) {
        this.keyFrameMeshes[index] = new Mesh(geo)
        this.keyFrameMeshes[index].name = index
      }
      this.keyFrameMeshes[index].position.fromArray(keyFrame.position)
    }

    if (!this.transformControls) {
      this.transformControls = new TransformControls(
        this.camera,
        this.renderer.domElement
      )

      this.transformControls.addEventListener("dragging-changed", (event) => {
        this.controls.enabled = !event.value

        if (!event.value) {
          const index = this.transformControls.object.name
          this.keyFrameMeshes[index].position.toArray(
            this.keyFrames[index].position
          )

          console.log(this.keyFrames[index])
          this.updateCurve()
          this.updateLine()
        }
      })
    }

    if (this.shouldShowCurve) {
      this.updateLine()
      this.scene.add(
        this.lineCamera,
        this.lineTarget,
        this.lineFocus,
        ...this.keyFrameMeshes,
        this.transformControls
      )
    } else {
      this.scene.remove(
        this.lineCamera,
        this.lineTarget,
        this.lineFocus,
        ...this.keyFrameMeshes,
        this.transformControls
      )
    }
  }

  /**
   * Go to keyFrame
   * @param {KeyFrame} keyFrame
   */
  gotoKeyframe(keyFrame) {
    this.camera.position.fromArray(keyFrame.position)
    this.controls.target.fromArray(keyFrame.target)
    this.camera.fov = keyFrame.fov
    this.scene.focus.fromArray(keyFrame.focus)
    this.camera.updateProjectionMatrix()
    console.log(keyFrame, this.camera.position)
  }
  /**
   * Update keyFrame
   * @param {KeyFrame} keyFrame
   */
  updateKeyframe(keyFrame) {
    keyFrame.update(
      this.camera.position,
      this.controls.target,
      this.camera.fov,
      this.scene.focus
    )
    this.updateCurve()
  }

  print() {
    console.log(JSON.stringify(this.keyFrames))
    for (let index = 0; index < this.keyFrames.length; index++) {
      localStorage.setItem(index, JSON.stringify(this.keyFrames[index]))
    }
    navigator.clipboard.writeText(JSON.stringify(this.keyFrames))
    console.log("saved")
  }

  addGui(gui) {
    const folder = gui.addFolder("Curves")
    this.gui = folder
    folder
      .add(this, "timeline", 0, 1, 0.001)
      .listen()
      .onChange(() => {
        this.scrub()
      })

    folder.add(this, "addKeyFrame")
    folder.add(this, "showCurve")
    folder.add(this, "play")
    folder.add(this, "print")
    this.guiKeyframesUpdate()
  }

  guiKeyframesUpdate() {
    if (!this.gui) return

    if (this.keyFramesGui) {
      this.keyFramesGui.destroy()
      this.keyFramesGui = null
    }
    const folder = this.gui.addFolder("Keyframes")
    folder.add(this, "deleteAll")
    this.keyFramesGui = folder
    for (let index = 0; index < this.keyFrames.length; index++) {
      const element = this.keyFrames[index]
      const subFolder = folder.addFolder(String(index))
      subFolder.close()
      const guiParams = {
        goTo: () => {
          this.gotoKeyframe(element)
        },
        update: () => {
          this.updateKeyframe(element)
        },
        attach: () => {
          this.transformControls.attach(this.keyFrameMeshes[index])
        },
      }
      subFolder.add(guiParams, "goTo")

      subFolder.add(guiParams, "update")

      subFolder.add(guiParams, "attach")
    }
  }

  deleteAll() {
    this.keyFrames.splice(0, this.keyFrames.length)
    this.guiKeyframesUpdate()
  }

  play() {
    if (this.playBackTween.isPlaying()) {
      this.playBackTween.stop()
    } else {
      this.playBackTween.start()
    }
  }
}

class KeyFrame {
  constructor() {
    this.position = [0, 0, 0]
    this.target = [0, 0, 0]
    this.fov = 0
    this.focus = [0, 0, 0]
  }

  /**
   * update vals
   * @param {Vector3} camPos
   * @param {Vector3} tarPos
   * @param {Number} fov
   * @param {Vector3} focus
   */
  update(camPos, tarPos, fov, focus) {
    camPos.toArray(this.position)
    tarPos.toArray(this.target)
    focus.toArray(this.focus)
    this.fov = fov
  }
}
