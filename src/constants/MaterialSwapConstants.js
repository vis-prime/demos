import { Tween } from "@tweenjs/tween.js"
import { Vector3, Color, Mesh, Group } from "three"
import { Text } from "troika-three-text"

/**
 * Object representing meshes for display.
 * @typedef {Object} ShowcaseMeshes
 * @property {showcaseMeshesProperties} box - The params representing a box.
 * @property {showcaseMeshesProperties} sphere - The params representing a sphere.
 * @property {showcaseMeshesProperties} cylinder - The params representing a cylinder.
 * @property {showcaseMeshesProperties} torus - The params representing a torus.
 * @property {showcaseMeshesProperties} torusKnot - The params representing a torus knot.
 * @property {showcaseMeshesProperties} plane - The params representing a plane.
 * @property {showcaseMeshesProperties} octahedron - The params representing a octahedron.
 */

/**
 * Object representing meshes for display.
 * @typedef {Object} showcaseMeshesProperties
 * @property {boolean} isActive - Status
 * @property {Mesh} mesh - Mesh
 * @property {Tween} tween - tween for animation
 * @property {Tween} spinTween tween for continuous spin
 */

/**
 * Creates a new showcase mesh parameters entry.
 * @returns {showcaseMeshesProperties} The newly created showcase mesh parameters entry.
 */
function createShowcaseMeshesParamsEntries() {
  return {
    isActive: false,
    mesh: null,
    tween: null,
    spinTween: null,
  }
}

/**
 * Object containing meshes for display.
 * @type {ShowcaseMeshes}
 */
const showcaseMeshes = {
  box: createShowcaseMeshesParamsEntries(),
  sphere: createShowcaseMeshesParamsEntries(),
  cylinder: createShowcaseMeshesParamsEntries(),
  torus: createShowcaseMeshesParamsEntries(),
  torusKnot: createShowcaseMeshesParamsEntries(),
  plane: createShowcaseMeshesParamsEntries(),
  octahedron: createShowcaseMeshesParamsEntries(),
}

/**
 * Represents the parameters for a specific channel.
 * @typedef {Object} ChannelParams
 * @property {Group} group - The group associated with the channel.
 * @property {Mesh} mesh - The mesh associated with the channel.
 * @property {Text} text - The text element associated with the channel.
 * @property {Tween} tween - The tween object associated with the channel.
 * @property {number} lerpValue - The lerp value of the channel.
 * @property {boolean} isActive - State of this channel
 * @property {Object} tweenABvalues - The start and end values for the tween.
 * @property {Vector3} tweenABvalues.meshStartPos - The starting position of the mesh.
 * @property {Vector3} tweenABvalues.meshEndPos - The ending position of the mesh.
 * @property {Vector3} tweenABvalues.textStartPos - The starting position of the text.
 * @property {Vector3} tweenABvalues.textEndPos - The ending position of the text.
 * @property {Color} tweenABvalues.meshStartColor - The starting color of the mesh.
 * @property {Color} tweenABvalues.meshEndColor - The ending color of the mesh.
 * @property {Color} tweenABvalues.textStartColor - The starting color of the text.
 * @property {Color} tweenABvalues.textEndColor - The ending color of the text.
 */

/**
 * Creates a new channel parameters entry.
 * @returns {ChannelParams} The newly created channel parameters entry.
 */
function createChannelParamsEntry() {
  return {
    group: null,
    mesh: null,
    text: null,
    tween: null,
    lerpValue: 0,
    isActive: false,
    tweenABvalues: {
      meshStartPos: new Vector3(),
      meshEndPos: new Vector3(),
      textStartPos: new Vector3(),
      textEndPos: new Vector3(),

      meshStartColor: new Color(),
      meshEndColor: new Color(),
      textStartColor: new Color(),
      textEndColor: new Color(),
    },
  }
}

/**
 * Represents the channel parameters.
 * @typedef {Object} ChannelParamsObject
 * @property {ChannelParams} diffuse - The parameters for the diffuse channel.
 * @property {ChannelParams} rough - The parameters for the rough channel.
 * @property {ChannelParams} metal - The parameters for the metal channel.
 * @property {ChannelParams} normal - The parameters for the normal channel.
 * @property {ChannelParams} emit - The parameters for the emit channel.
 * @property {ChannelParams} ao - The parameters for the ao channel.
 * @property {ChannelParams} displace - The parameters for the displace channel.
 */

/**
 * Represents the channel parameters for a set of channels.
 * @type {ChannelParamsObject}
 */
const channelParams = {
  diffuse: createChannelParamsEntry(),
  rough: createChannelParamsEntry(),
  metal: createChannelParamsEntry(),
  normal: createChannelParamsEntry(),
  emit: createChannelParamsEntry(),
  ao: createChannelParamsEntry(),
  displace: createChannelParamsEntry(),
}

export { channelParams, showcaseMeshes }
