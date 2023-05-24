export const MATERIAL_LIST = {
  brown_planks_03: {
    name: "brown planks 03",
    textures: {
      diffuse: "./materials/brown_planks_03_diff_1k.ktx2",
      displace: "./materials/brown_planks_03_disp_1k.ktx2",
      rough: "./materials/brown_planks_03_rough_1k.ktx2",
      normal: "./materials/brown_planks_03_nor_gl_1k.ktx2",
    },
    textures_org: {
      diffuse: "./materials/brown_planks_03_diff_1k.webp",
      displace: "./materials/brown_planks_03_disp_1k.webp",
      rough: "./materials/brown_planks_03_rough_1k.webp",
      normal: "./materials/brown_planks_03_nor_gl_1k.webp",
    },
    ktx_cmds: {
      diffuse: " --genmipmap --resize 1024x1024 --encode etc1s",
      displace:
        " --genmipmap --assign_oetf linear --assign_primaries none --resize 1024x1024 --encode etc1s",
      rough:
        " --genmipmap --assign_oetf linear --assign_primaries none --resize 1024x1024 --encode etc1s",
      normal:
        " --genmipmap --resize 1024x1024 --assign_oetf linear --assign_primaries none --input_swizzle rgb1 --normal_mode --encode uastc",
    },
  },
  blue_painted_planks: {
    name: "blue painted planks",
    textures: {
      diffuse: "./materials/blue_painted_planks_diff_1k.ktx2",
      normal: "./materials/blue_painted_planks_nor_gl_1k.ktx2",
      rough: "./materials/blue_painted_planks_rough_1k.ktx2",
      displace: "./materials/blue_painted_planks_disp_1k.ktx2",
    },
    textures_org: {
      diffuse: "./materials/blue_painted_planks_diff_1k.webp",
      normal: "./materials/blue_painted_planks_nor_gl_1k.webp",
      rough: "./materials/blue_painted_planks_rough_1k.webp",
      displace: "./materials/blue_painted_planks_disp_1k.webp",
    },
    ktx_cmds: {
      diffuse: " --genmipmap --resize 1024x1024 --encode etc1s",
      normal:
        " --genmipmap --resize 1024x1024 --assign_oetf linear --assign_primaries none --input_swizzle rgb1 --normal_mode --encode uastc",
      rough:
        " --genmipmap --assign_oetf linear --assign_primaries none --resize 1024x1024 --encode etc1s",
      displace:
        " --genmipmap --assign_oetf linear --assign_primaries none --resize 1024x1024 --encode etc1s",
    },
  },
  brown_planks_05: {
    name: "brown planks 05",
    textures: {
      displace: "./materials/brown_planks_05_disp_1k.ktx2",
      normal: "./materials/brown_planks_05_nor_gl_1k.ktx2",
      rough: "./materials/brown_planks_05_rough_1k.ktx2",
      diffuse: "./materials/brown_planks_05_diff_1k.ktx2",
    },
    textures_org: {
      displace: "./materials/brown_planks_05_disp_1k.webp",
      normal: "./materials/brown_planks_05_nor_gl_1k.webp",
      rough: "./materials/brown_planks_05_rough_1k.webp",
      diffuse: "./materials/brown_planks_05_diff_1k.webp",
    },
    ktx_cmds: {
      displace:
        " --genmipmap --assign_oetf linear --assign_primaries none --resize 1024x1024 --encode etc1s",
      normal:
        " --genmipmap --resize 1024x1024 --assign_oetf linear --assign_primaries none --input_swizzle rgb1 --normal_mode --encode uastc",
      rough:
        " --genmipmap --assign_oetf linear --assign_primaries none --resize 1024x1024 --encode etc1s",
      diffuse: " --genmipmap --resize 1024x1024 --encode etc1s",
    },
  },
  green_rough_planks: {
    name: "green rough planks",
    textures: {
      normal: "./materials/green_rough_planks_nor_gl_1k.ktx2",
      diffuse: "./materials/green_rough_planks_diff_1k.ktx2",
      displace: "./materials/green_rough_planks_disp_1k.ktx2",
      rough: "./materials/green_rough_planks_rough_1k.ktx2",
    },
    textures_org: {
      normal: "./materials/green_rough_planks_nor_gl_1k.webp",
      diffuse: "./materials/green_rough_planks_diff_1k.webp",
      displace: "./materials/green_rough_planks_disp_1k.webp",
      rough: "./materials/green_rough_planks_rough_1k.webp",
    },
    ktx_cmds: {
      normal:
        " --genmipmap --resize 1024x1024 --assign_oetf linear --assign_primaries none --input_swizzle rgb1 --normal_mode --encode uastc",
      diffuse: " --genmipmap --resize 1024x1024 --encode etc1s",
      displace:
        " --genmipmap --assign_oetf linear --assign_primaries none --resize 1024x1024 --encode etc1s",
      rough:
        " --genmipmap --assign_oetf linear --assign_primaries none --resize 1024x1024 --encode etc1s",
    },
  },
  laminate_floor: {
    name: "laminate floor",
    textures: {
      displace: "./materials/laminate_floor_disp_1k.ktx2",
      diffuse: "./materials/laminate_floor_diff_1k.ktx2",
      rough: "./materials/laminate_floor_rough_1k.ktx2",
      normal: "./materials/laminate_floor_nor_gl_1k.ktx2",
    },
    textures_org: {
      displace: "./materials/laminate_floor_disp_1k.webp",
      diffuse: "./materials/laminate_floor_diff_1k.webp",
      rough: "./materials/laminate_floor_rough_1k.webp",
      normal: "./materials/laminate_floor_nor_gl_1k.webp",
    },
    ktx_cmds: {
      displace:
        " --genmipmap --assign_oetf linear --assign_primaries none --resize 1024x1024 --encode etc1s",
      diffuse: " --genmipmap --resize 1024x1024 --encode etc1s",
      rough:
        " --genmipmap --assign_oetf linear --assign_primaries none --resize 1024x1024 --encode etc1s",
      normal:
        " --genmipmap --resize 1024x1024 --assign_oetf linear --assign_primaries none --input_swizzle rgb1 --normal_mode --encode uastc",
    },
  },
  laminate_floor_02: {
    name: "laminate floor 02",
    textures: {
      displace: "./materials/laminate_floor_02_disp_1k.ktx2",
      diffuse: "./materials/laminate_floor_02_diff_1k.ktx2",
      rough: "./materials/laminate_floor_02_rough_1k.ktx2",
      normal: "./materials/laminate_floor_02_nor_gl_1k.ktx2",
    },
    textures_org: {
      displace: "./materials/laminate_floor_02_disp_1k.webp",
      diffuse: "./materials/laminate_floor_02_diff_1k.webp",
      rough: "./materials/laminate_floor_02_rough_1k.webp",
      normal: "./materials/laminate_floor_02_nor_gl_1k.webp",
    },
    ktx_cmds: {
      displace:
        " --genmipmap --assign_oetf linear --assign_primaries none --resize 1024x1024 --encode etc1s",
      diffuse: " --genmipmap --resize 1024x1024 --encode etc1s",
      rough:
        " --genmipmap --assign_oetf linear --assign_primaries none --resize 1024x1024 --encode etc1s",
      normal:
        " --genmipmap --resize 1024x1024 --assign_oetf linear --assign_primaries none --input_swizzle rgb1 --normal_mode --encode uastc",
    },
  },
  moss_wood: {
    name: "moss wood",
    textures: {
      normal: "./materials/moss_wood_nor_gl_1k.ktx2",
      diffuse: "./materials/moss_wood_diff_1k.ktx2",
      displace: "./materials/moss_wood_disp_1k.ktx2",
      rough: "./materials/moss_wood_rough_1k.ktx2",
    },
    textures_org: {
      normal: "./materials/moss_wood_nor_gl_1k.webp",
      diffuse: "./materials/moss_wood_diff_1k.webp",
      displace: "./materials/moss_wood_disp_1k.webp",
      rough: "./materials/moss_wood_rough_1k.webp",
    },
    ktx_cmds: {
      normal:
        " --genmipmap --resize 1024x1024 --assign_oetf linear --assign_primaries none --input_swizzle rgb1 --normal_mode --encode uastc",
      diffuse: " --genmipmap --resize 1024x1024 --encode etc1s",
      displace:
        " --genmipmap --assign_oetf linear --assign_primaries none --resize 1024x1024 --encode etc1s",
      rough:
        " --genmipmap --assign_oetf linear --assign_primaries none --resize 1024x1024 --encode etc1s",
    },
  },
  raw_plank_wall: {
    name: "raw plank wall",
    textures: {
      displace: "./materials/raw_plank_wall_disp_1k.ktx2",
      diffuse: "./materials/raw_plank_wall_diff_1k.ktx2",
      rough: "./materials/raw_plank_wall_rough_1k.ktx2",
      normal: "./materials/raw_plank_wall_nor_gl_1k.ktx2",
    },
    textures_org: {
      displace: "./materials/raw_plank_wall_disp_1k.webp",
      diffuse: "./materials/raw_plank_wall_diff_1k.webp",
      rough: "./materials/raw_plank_wall_rough_1k.webp",
      normal: "./materials/raw_plank_wall_nor_gl_1k.webp",
    },
    ktx_cmds: {
      displace:
        " --genmipmap --assign_oetf linear --assign_primaries none --resize 1024x1024 --encode etc1s",
      diffuse: " --genmipmap --resize 1024x1024 --encode etc1s",
      rough:
        " --genmipmap --assign_oetf linear --assign_primaries none --resize 1024x1024 --encode etc1s",
      normal:
        " --genmipmap --resize 1024x1024 --assign_oetf linear --assign_primaries none --input_swizzle rgb1 --normal_mode --encode uastc",
    },
  },
  synthetic_wood: {
    name: "synthetic wood",
    textures: {
      displace: "./materials/synthetic_wood_disp_1k.ktx2",
      diffuse: "./materials/synthetic_wood_diff_1k.ktx2",
      rough: "./materials/synthetic_wood_rough_1k.ktx2",
      normal: "./materials/synthetic_wood_nor_gl_1k.ktx2",
    },
    textures_org: {
      displace: "./materials/synthetic_wood_disp_1k.webp",
      diffuse: "./materials/synthetic_wood_diff_1k.webp",
      rough: "./materials/synthetic_wood_rough_1k.webp",
      normal: "./materials/synthetic_wood_nor_gl_1k.webp",
    },
    ktx_cmds: {
      displace:
        " --genmipmap --assign_oetf linear --assign_primaries none --resize 1024x1024 --encode etc1s",
      diffuse: " --genmipmap --resize 1024x1024 --encode etc1s",
      rough:
        " --genmipmap --assign_oetf linear --assign_primaries none --resize 1024x1024 --encode etc1s",
      normal:
        " --genmipmap --resize 1024x1024 --assign_oetf linear --assign_primaries none --input_swizzle rgb1 --normal_mode --encode uastc",
    },
  },
  weathered_brown_planks: {
    name: "weathered brown planks",
    textures: {
      displace: "./materials/weathered_brown_planks_disp_1k.ktx2",
      diffuse: "./materials/weathered_brown_planks_diff_1k.ktx2",
      rough: "./materials/weathered_brown_planks_rough_1k.ktx2",
      normal: "./materials/weathered_brown_planks_nor_gl_1k.ktx2",
    },
    textures_org: {
      displace: "./materials/weathered_brown_planks_disp_1k.webp",
      diffuse: "./materials/weathered_brown_planks_diff_1k.webp",
      rough: "./materials/weathered_brown_planks_rough_1k.webp",
      normal: "./materials/weathered_brown_planks_nor_gl_1k.webp",
    },
    ktx_cmds: {
      displace:
        " --genmipmap --assign_oetf linear --assign_primaries none --resize 1024x1024 --encode etc1s",
      diffuse: " --genmipmap --resize 1024x1024 --encode etc1s",
      rough:
        " --genmipmap --assign_oetf linear --assign_primaries none --resize 1024x1024 --encode etc1s",
      normal:
        " --genmipmap --resize 1024x1024 --assign_oetf linear --assign_primaries none --input_swizzle rgb1 --normal_mode --encode uastc",
    },
  },
  weathered_planks: {
    name: "weathered planks",
    textures: {
      displace: "./materials/weathered_planks_disp_1k.ktx2",
      diffuse: "./materials/weathered_planks_diff_1k.ktx2",
      rough: "./materials/weathered_planks_rough_1k.ktx2",
      normal: "./materials/weathered_planks_nor_gl_1k.ktx2",
    },
    textures_org: {
      displace: "./materials/weathered_planks_disp_1k.webp",
      diffuse: "./materials/weathered_planks_diff_1k.webp",
      rough: "./materials/weathered_planks_rough_1k.webp",
      normal: "./materials/weathered_planks_nor_gl_1k.webp",
    },
    ktx_cmds: {
      displace:
        " --genmipmap --assign_oetf linear --assign_primaries none --resize 1024x1024 --encode etc1s",
      diffuse: " --genmipmap --resize 1024x1024 --encode etc1s",
      rough:
        " --genmipmap --assign_oetf linear --assign_primaries none --resize 1024x1024 --encode etc1s",
      normal:
        " --genmipmap --resize 1024x1024 --assign_oetf linear --assign_primaries none --input_swizzle rgb1 --normal_mode --encode uastc",
    },
  },
  wood_floor_deck: {
    name: "wood floor deck",
    textures: {
      displace: "./materials/wood_floor_deck_disp_1k.ktx2",
      diffuse: "./materials/wood_floor_deck_diff_1k.ktx2",
      rough: "./materials/wood_floor_deck_rough_1k.ktx2",
      normal: "./materials/wood_floor_deck_nor_gl_1k.ktx2",
    },
    textures_org: {
      displace: "./materials/wood_floor_deck_disp_1k.webp",
      diffuse: "./materials/wood_floor_deck_diff_1k.webp",
      rough: "./materials/wood_floor_deck_rough_1k.webp",
      normal: "./materials/wood_floor_deck_nor_gl_1k.webp",
    },
    ktx_cmds: {
      displace:
        " --genmipmap --assign_oetf linear --assign_primaries none --resize 1024x1024 --encode etc1s",
      diffuse: " --genmipmap --resize 1024x1024 --encode etc1s",
      rough:
        " --genmipmap --assign_oetf linear --assign_primaries none --resize 1024x1024 --encode etc1s",
      normal:
        " --genmipmap --resize 1024x1024 --assign_oetf linear --assign_primaries none --input_swizzle rgb1 --normal_mode --encode uastc",
    },
  },
  wooden_planks: {
    name: "wooden planks",
    textures: {
      displace: "./materials/wooden_planks_disp_1k.ktx2",
      diffuse: "./materials/wooden_planks_diff_1k.ktx2",
      rough: "./materials/wooden_planks_rough_1k.ktx2",
      normal: "./materials/wooden_planks_nor_gl_1k.ktx2",
    },
    textures_org: {
      displace: "./materials/wooden_planks_disp_1k.webp",
      diffuse: "./materials/wooden_planks_diff_1k.webp",
      rough: "./materials/wooden_planks_rough_1k.webp",
      normal: "./materials/wooden_planks_nor_gl_1k.webp",
    },
    ktx_cmds: {
      displace:
        " --genmipmap --assign_oetf linear --assign_primaries none --resize 1024x1024 --encode etc1s",
      diffuse: " --genmipmap --resize 1024x1024 --encode etc1s",
      rough:
        " --genmipmap --assign_oetf linear --assign_primaries none --resize 1024x1024 --encode etc1s",
      normal:
        " --genmipmap --resize 1024x1024 --assign_oetf linear --assign_primaries none --input_swizzle rgb1 --normal_mode --encode uastc",
    },
  },
  wooden_rough_planks: {
    name: "wooden rough planks",
    textures: {
      diffuse: "./materials/wooden_rough_planks_diff_1k.ktx2",
      displace: "./materials/wooden_rough_planks_disp_1k.ktx2",
      rough: "./materials/wooden_rough_planks_rough_1k.ktx2",
      normal: "./materials/wooden_rough_planks_nor_gl_1k.ktx2",
    },
    textures_org: {
      diffuse: "./materials/wooden_rough_planks_diff_1k.webp",
      displace: "./materials/wooden_rough_planks_disp_1k.webp",
      rough: "./materials/wooden_rough_planks_rough_1k.webp",
      normal: "./materials/wooden_rough_planks_nor_gl_1k.webp",
    },
    ktx_cmds: {
      diffuse: " --genmipmap --resize 1024x1024 --encode etc1s",
      displace:
        " --genmipmap --assign_oetf linear --assign_primaries none --resize 1024x1024 --encode etc1s",
      rough:
        " --genmipmap --assign_oetf linear --assign_primaries none --resize 1024x1024 --encode etc1s",
      normal:
        " --genmipmap --resize 1024x1024 --assign_oetf linear --assign_primaries none --input_swizzle rgb1 --normal_mode --encode uastc",
    },
  },
  blank: {
    name: "Blank",
    textures: {},
  },
}
