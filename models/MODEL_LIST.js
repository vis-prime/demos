import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader"
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader"
import bobaUrl from "./boba_comp.glb?url"
import wallUrl from "./thickness_wall_comp.glb?url"
import horseUrl from "./horse_comp.glb?url"
import aztecUrl from "./aztec_pole_2k_comp.glb?url"
import catUrl from "./cat_2k_comp.glb?url"
import mournerUrl from "./mourner_2k_comp.glb?url"
import demonUrl from "./crowned_demon_2k_comp.glb?url"

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
    url: bobaUrl,
  },
  thick: {
    url: wallUrl,
  },
  horse: {
    name: "Horse",
    url: horseUrl,
  },
  aztec: {
    name: "Aztec",
    url: aztecUrl,
    attribution: `"Aztec Statue Sculpt" (https://skfb.ly/6SIEP) by POLYCOSM is licensed under Creative Commons Attribution (http://creativecommons.org/licenses/by/4.0/).`,
  },
  cat: {
    name: "Cat",
    url: catUrl,
  },
  mourner: {
    name: "Mourner",
    url: mournerUrl,
  },
  crowned_demon: {
    name: "Crowned Demon bust",
    url: demonUrl,
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
