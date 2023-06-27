import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader"
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader"

const gltfLoader = new GLTFLoader()
const draco = new DRACOLoader()
draco.setDecoderPath("https://www.gstatic.com/draco/v1/decoders/")
gltfLoader.setDRACOLoader(draco)

/**
 * List of models used
 * @enum
 */
export const MODEL_LIST = {
  boba: {
    url: "./models/boba_comp.glb",
  },
  thick: {
    url: "./models/thickness_wall_comp.glb",
  },
  horse: {
    name: "Horse",
    url: "./models/horse_comp.glb",
  },
  aztec: {
    name: "Aztec",
    url: "./models/aztec_pole_2k_comp.glb",
    attribution: `"Aztec Statue Sculpt" (https://skfb.ly/6SIEP) by POLYCOSM is licensed under Creative Commons Attribution (http://creativecommons.org/licenses/by/4.0/).`,
  },
  cat: {
    name: "Cat",
    url: "./models/cat_2k_comp.glb",
  },
  mourner: {
    name: "Mourner",
    url: "./models/mourner_2k_comp.glb",
  },
  crowned_demon: {
    name: "Crowned Demon bust",
    url: "./models/crowned_demon_2k_comp.glb",
  },
  platform: {
    name: "Material display platform",
    url: "./models/mats_platform_2k_comp.glb",
  },
  mercedes_project_one: {
    name: "Project One",
    url: "./models/mercedes_project_one_2k_comp.glb",
  },
  pots: {
    name: "Copper pots",
    url: "./models/copper_pots_2k_comp.glb",
    attribution: `"3DDecember 2021 - Copper Pots and Pans" (https://skfb.ly/orIyR) by Jack Kelly is licensed under Creative Commons Attribution (http://creativecommons.org/licenses/by/4.0/).`,
  },
  angel: {
    name: "Angel wings",
    url: "./models/aniso_angel_2k_comp.glb",
    attribution: `Parts used from: "Angel Wings" (https://skfb.ly/6uVyU) by Boooooop is licensed under Creative Commons Attribution (http://creativecommons.org/licenses/by/4.0/).`,
  },
  garage: {
    name: "Garage",
    url: "./models/garage_2k_comp.glb",
    attribution: `"Garage/Showroom Vr ready" (https://skfb.ly/o9V8Y) by matteo.pascale is licensed under Creative Commons Attribution (http://creativecommons.org/licenses/by/4.0/).`,
  },
}

/**
 * Gltf Draco Loader
 * @param {String} url
 * @returns {Object}
 * @enum
 */
export const MODEL_LOADER = async (url) => {
  return await gltfLoader.loadAsync(url)
}
