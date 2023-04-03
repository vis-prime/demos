import GUI from "lil-gui"
import { Object3D } from "three"

export class MaterialEditor {
  /**
   * Material edit
   * @param {GUI} gui
   * @param {Object3D} object
   */
  constructor(gui, object) {
    this.object = object

    this.select = null
    this.folder = gui.addFolder("Materials")

    this.folder.add(this, "refresh")
    this.dropDown = this.folder.add(this, "select", { NONE: null })

    this.matFolder = null

    this.uniqueMats = {}
  }

  printMapsFactors() {
    if (!this.select) return
    const mapList = {}
    for (const [key, value] of Object.entries(this.select)) {
      if (key.toLowerCase().includes("map") && value && value.isTexture) {
        mapList[key] = value
      }
    }

    console.log(mapList)
  }

  refresh() {
    this.uniqueMats = {}
    const uniqueMats = this.uniqueMats,
      materials = { NONE: null }
    let count = 0
    this.object.traverse((node) => {
      if (node.material) {
        uniqueMats[node.material.uuid] = node.material
      }
    })
    for (const mat of Object.values(uniqueMats)) {
      materials[`${count}: ${mat.name}`] = mat
      count++
    }
    // old dropdown is deleted with options() ,so update this.dropdown ref
    this.dropDown = this.dropDown.options(materials)

    this.dropDown.onChange((v) => {
      this.load()
    })
  }

  load() {
    if (this.matFolder) {
      this.matFolder.destroy()
    }
    if (!this.select) return

    const mat = this.select

    this.matFolder = this.folder.addFolder(mat.name)

    console.log(mat.name, { mat })
    const mFol = this.matFolder
    mFol.add(this, "printMapsFactors")
    mFol.addColor(mat, "color")
    mFol.add(mat, "metalness", 0, 1, 0.01)
    mFol.add(mat, "roughness", 0, 1, 0.01)
    mFol.add(mat, "emissiveIntensity", 0, 150, 0.01)
    if (mat.isMeshPhysicalMaterial) {
      mFol.add(mat, "reflectivity", 0, 1, 0.01)
      mFol.add(mat, "thickness", 0, 1, 0.01)
      mFol.add(mat, "transmission", 0, 1, 0.01)
    }
  }
}
