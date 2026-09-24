import { gameStorage } from "./storage";

export const GRAPHICS_QUALITIES = [
  "performance",
  "balanced",
  "high",
  "ultra",
] as const;
export type GraphicsQuality = (typeof GRAPHICS_QUALITIES)[number];
const STORAGE_KEY = "junk-magnet-graphics";
let selectedQuality: GraphicsQuality | undefined;

export function getGraphicsQuality(): GraphicsQuality {
  if (selectedQuality) return selectedQuality;
  try {
    const saved = gameStorage()?.getItem(STORAGE_KEY);
    if (GRAPHICS_QUALITIES.includes(saved as GraphicsQuality))
      return saved as GraphicsQuality;
  } catch {
    /* Storage can be unavailable in embedded/private browsers. */
  }
  return "balanced";
}

export function setGraphicsQuality(quality: GraphicsQuality) {
  selectedQuality = quality;
  try {
    gameStorage()?.setItem(STORAGE_KEY, quality);
  } catch {
    /* Keep the live setting usable. */
  }
}

/** One resolution for both the canvas and post-processing, including retina displays. */
export function graphicsProfile(
  quality: GraphicsQuality,
  devicePixelRatio = 1,
) {
  const ratio =
    Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
      ? devicePixelRatio
      : 1;
  const profiles = {
    performance: {
      pixelRatio: Math.min(ratio * 0.75, 1),
      shadowMapSize: 1024,
      ambientOcclusion: false,
      samples: 0,
    },
    balanced: {
      pixelRatio: Math.min(ratio, 1.5),
      shadowMapSize: 1024,
      ambientOcclusion: false,
      samples: 0,
    },
    high: {
      pixelRatio: Math.min(ratio, 2),
      shadowMapSize: 2048,
      ambientOcclusion: true,
      samples: 4,
    },
    ultra: {
      pixelRatio: Math.min(ratio * 1.5, 3),
      shadowMapSize: 4096,
      ambientOcclusion: true,
      samples: 4,
    },
  };
  return profiles[quality];
}
