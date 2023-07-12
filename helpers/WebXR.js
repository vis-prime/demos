import {
  Camera,
  CylinderGeometry,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhongMaterial,
  Object3D,
  RingGeometry,
  WebGLRenderer,
} from "three"
/**
 * @type {Mesh}
 */
let reticle

let hitTestSource = null
let hitTestSourceRequested = false
export default class WebXR {
  /**
   * web xr helper
   * @param {WebGLRenderer} renderer
   * @param {Camera} camera
   * @param {Object3D} object
   * @param {Function} originalRenderFunction
   */
  constructor(renderer, scene, camera, object, originalRenderFunction, bgEnv, { onStart, onEnd }) {
    this.renderer = renderer
    this.scene = scene
    this.camera = camera
    this.originalRenderFunction = originalRenderFunction
    this.xrReady = false
    this.xrObject = object
    this.bgEnv = bgEnv
    this.onStart = onStart
    this.onEnd = onEnd
    this.init()
  }

  init() {
    const renderer = this.renderer
    const scene = this.scene

    const geometry = new CylinderGeometry(0.1, 0.1, 0.2, 32).translate(0, 0.1, 0)
    const dummyMesh = new Mesh()
    const onSelect = () => {
      if (reticle.visible) {
        // const material = new MeshPhongMaterial({ color: 0xffffff * Math.random() })
        // const mesh = new Mesh(geometry, material)
        const mesh = this.xrObject
        reticle.matrix.decompose(mesh.position, dummyMesh.quaternion, dummyMesh.scale)

        // mesh.scale.y = Math.random() * 2 + 1

        // scene.add(mesh)
      }
    }

    const controller = renderer.xr.getController(0)
    controller.addEventListener("select", onSelect)
    scene.add(controller)

    reticle = new Mesh(new RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2), new MeshBasicMaterial())
    reticle.matrixAutoUpdate = false
    reticle.visible = false

    const sessionInit = { requiredFeatures: ["hit-test"] }
    const button = document.createElement("button")
    const showStartAR = (/*device*/) => {
      console.log("button", button)
      renderer.xr.enabled = true

      if (sessionInit.domOverlay === undefined) {
        const overlay = document.createElement("div")
        overlay.style.display = "none"
        document.body.appendChild(overlay)

        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
        svg.setAttribute("width", 38)
        svg.setAttribute("height", 38)
        svg.style.position = "absolute"
        svg.style.right = "20px"
        svg.style.top = "20px"
        svg.addEventListener("click", function () {
          currentSession.end()
        })
        overlay.appendChild(svg)

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
        path.setAttribute("d", "M 12,12 L 28,28 M 28,12 12,28")
        path.setAttribute("stroke", "#fff")
        path.setAttribute("stroke-width", 2)
        svg.appendChild(path)

        if (sessionInit.optionalFeatures === undefined) {
          sessionInit.optionalFeatures = []
        }

        sessionInit.optionalFeatures.push("dom-overlay")
        sessionInit.domOverlay = { root: overlay }
      }

      //

      let currentSession = null

      let gpParent
      const onSessionStarted = async (session) => {
        if (this.bgEnv.groundProjectedSkybox.parent) {
          gpParent = this.bgEnv.groundProjectedSkybox.parent
          this.bgEnv.groundProjectedSkybox.removeFromParent()
        }

        if (this.onStart) this.onStart()

        session.addEventListener("end", onSessionEnded)

        renderer.xr.setReferenceSpaceType("local")

        await renderer.xr.setSession(session)

        button.textContent = "STOP AR"
        sessionInit.domOverlay.root.style.display = ""
        scene.add(reticle)
        currentSession = session
      }

      const onSessionEnded = (/*event*/) => {
        currentSession.removeEventListener("end", onSessionEnded)

        button.textContent = "START AR"
        sessionInit.domOverlay.root.style.display = "none"
        if (this.onEnd) this.onEnd()
        currentSession = null
        scene.remove(reticle)
        if (gpParent) {
          gpParent.add(this.bgEnv.groundProjectedSkybox)
          gpParent = null
        }
      }

      //
      button.style.position = "fixed"
      button.style.display = ""
      button.id = "ar_button"
      button.style.zIndex = 1000
      button.style.cursor = "pointer"
      button.style.left = "calc(50% - 50px)"
      button.style.width = "100px"

      button.textContent = "START AR"

      button.onmouseenter = () => {
        button.style.opacity = "1.0"
      }

      button.onmouseleave = () => {
        button.style.opacity = "0.5"
      }

      button.onclick = () => {
        if (currentSession === null) {
          navigator.xr.requestSession("immersive-ar", sessionInit).then(onSessionStarted)
        } else {
          currentSession.end()
        }
      }

      document.body.appendChild(button)
      stylizeElement(button)
    }

    function disableButton() {
      button.style.display = ""

      button.style.cursor = "auto"
      button.style.left = "calc(50% - 75px)"
      button.style.width = "150px"

      button.onmouseenter = null
      button.onmouseleave = null

      button.onclick = null
    }

    function showARNotSupported() {
      disableButton()

      button.textContent = "AR NOT SUPPORTED"
    }

    function showARNotAllowed(exception) {
      disableButton()

      console.warn("Exception when trying to call xr.isSessionSupported", exception)

      button.textContent = "AR NOT ALLOWED"
    }

    function stylizeElement(element) {
      element.style.position = "absolute"
      element.style.bottom = "20px"
      element.style.padding = "12px 6px"
      element.style.border = "1px solid #fff"
      element.style.borderRadius = "4px"
      element.style.background = "rgba(0,0,0,0.1)"
      element.style.color = "#fff"
      element.style.font = "normal 13px sans-serif"
      element.style.textAlign = "center"
      element.style.opacity = "0.5"
      element.style.outline = "none"
      element.style.zIndex = "999"
    }

    if ("xr" in navigator) {
      navigator.xr
        .isSessionSupported("immersive-ar")
        .then((supported) => {
          if (supported) {
            this.xrReady = true
            showStartAR()
            console.log("webXR-AR SUPPORTED")
          }
        })
        .catch((err) => {
          this.xrReady = false
          console.warn(err)
        })
    }
  }

  start() {
    navigator.xr.requestSession("immersive-ar", {})
  }

  onFrame(frame) {
    if (frame) {
      const renderer = this.renderer
      const referenceSpace = renderer.xr.getReferenceSpace()
      const session = renderer.xr.getSession()

      if (hitTestSourceRequested === false) {
        session.requestReferenceSpace("viewer").then((referenceSpace) => {
          session.requestHitTestSource({ space: referenceSpace }).then((source) => {
            hitTestSource = source
          })
        })

        session.addEventListener("end", () => {
          hitTestSourceRequested = false
          hitTestSource = null
        })

        hitTestSourceRequested = true
      }

      if (hitTestSource) {
        const hitTestResults = frame.getHitTestResults(hitTestSource)

        if (hitTestResults.length) {
          const hit = hitTestResults[0]

          reticle.visible = true
          reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix)
        } else {
          reticle.visible = false
        }
      }
    }
  }

  addGui(gui) {
    const folder = gui.addFolder("XR")
    folder.add(this, "start")
  }
}
