/**
 * All hdri are from https://polyhaven.com/
 * @enum
 */
export const HDRI_LIST = {
  ulmer_muenster: {
    exr: "./hdri/ulmer_muenster_1k.exr",
    webP: "./hdri/ulmer_muenster.webp",
    sunPos: [17, 14, 12],
    sunColor: "#ffffeb",
    shadowOpacity: 0.72,
    groundProj: { radius: 25, height: 2 },
  },

  wide_street1: {
    exr: "./hdri/wide_street_01_1k.exr",
    webP: "./hdri/wide_street_01.webp",
    sunPos: [15, 24, 11],
    sunColor: "#ffffeb",
    shadowOpacity: 0.85,
    groundProj: { radius: 12, height: 2 },
  },

  wide_street2: {
    exr: "./hdri/wide_street_02_1k.exr",
    webP: "./hdri/wide_street_02.webp",
    sunPos: [16, 8, 12],
    sunColor: "#ffffeb",
    shadowOpacity: 0.55,
    groundProj: { radius: 25, height: 2 },
  },
  kloppenheim: {
    exr: "./hdri/kloppenheim_02_1k.exr",
    webP: "./hdri/kloppenheim_02.webp",
    groundProj: { radius: 25, height: 2 },
  },
  dry_cracked_lake: {
    hdr: "./hdri/dry_cracked_lake_1k.hdr",
    avif: "./hdri/dry_cracked_lake.avif",
    groundProj: { radius: 20, height: 2 },
  },

  round_platform: {
    exr: "./hdri/round_platform_1k.exr",
    avif: "./hdri/round_platform.avif",
    groundProj: { radius: 10, height: 2.5 },
    sunPos: [0, 8, 0],
    sunColor: "#ffffeb",
    shadowOpacity: 0.7,
  },

  skidpan: {
    hdr: "./hdri/skidpan_1k.hdr",
    avif: "./hdri/skidpan.avif",
    groundProj: { radius: 50, height: 4.5 },
  },

  dancing_hall: {
    avif: "./hdri/dancing_hall.avif",
    exr: "./hdri/dancing_hall_1k.exr",
    groundProj: { radius: 20, height: 3 },
    sunPos: [0, 8, 0],
    sunColor: "#ffffeb",
    shadowOpacity: 0.55,
  },
  empty_warehouse: {
    avif: "./hdri/empty_warehouse_01.avif",
    exr: "./hdri/empty_warehouse_01_1k.exr",
    groundProj: { radius: 19, height: 6 },
  },
  old_hall: {
    avif: "./hdri/old_hall.avif",
    exr: "./hdri/old_hall_1k.exr",
    groundProj: { radius: 13, height: 4 },
  },
}
