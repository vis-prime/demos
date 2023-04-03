import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader"
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader"
import bobaUrl from "./boba_comp.glb?url"
import wallUrl from "./thickness_wall_comp.glb?url"
import horseUrl from "./horse_comp.glb?url"
import aztecUrl from "./aztec_pole_2k_comp.glb?url"

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
    url: horseUrl,
  },
  aztec: {
    url: aztecUrl,
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
