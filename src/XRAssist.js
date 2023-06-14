import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter"

export class XrAssist {
  constructor(arGroup, renderer) {
    this.arGroup = arGroup
    this.renderer = renderer

    this.gltfExporter = new GLTFExporter()
  }

  exportGLB() {
    const options = {
      trs: true,
      onlyVisible: true,
      binary: true,
      maxTextureSize: 2048,
    }
    this.gltfExporter.parse(
      this.arGroup,
      (result) => {
        saveArrayBuffer(result, "scene.glb")
      },
      (error) => {
        console.log("An error happened during parsing", error)
      },
      options
    )
  }

  addGui(gui) {
    const folder = gui.addFolder("XR")
    folder.add(this, "exportGLB")
  }
}

function save(blob, filename) {
  const link = document.createElement("a")

  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()

  URL.revokeObjectURL(link.href)
}

function saveArrayBuffer(buffer, filename) {
  save(new Blob([buffer], { type: "application/octet-stream" }), filename)
}
