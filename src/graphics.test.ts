import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getGraphicsQuality,
  graphicsProfile,
  setGraphicsQuality,
} from "./graphics";

test("quality defaults, persistence and session choices survive blocked storage", () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalStorage = Object.getOwnPropertyDescriptor(
    globalThis,
    "localStorage",
  );
  let saved: string | null = "unrecognized";
  try {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("Blocked storage");
      },
    });
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { matchMedia: () => ({ matches: false }) },
    });
    assert.equal(getGraphicsQuality(), "balanced");
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { matchMedia: () => ({ matches: true }) },
    });
    assert.equal(getGraphicsQuality(), "balanced");
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { matchMedia: () => ({ matches: false }) },
    });
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: () => saved,
        setItem: (_: string, value: string) => {
          saved = value;
        },
      },
    });
    assert.equal(getGraphicsQuality(), "balanced");
    saved = "high";
    assert.equal(getGraphicsQuality(), "high");
    saved = "performance";
    assert.equal(getGraphicsQuality(), "performance");
    setGraphicsQuality("ultra");
    assert.equal(getGraphicsQuality(), "ultra");
    assert.equal(saved, "ultra");
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("Blocked storage");
      },
    });
    assert.doesNotThrow(() => setGraphicsQuality("balanced"));
    assert.equal(getGraphicsQuality(), "balanced");
  } finally {
    if (originalWindow)
      Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (originalStorage)
      Object.defineProperty(globalThis, "localStorage", originalStorage);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("high retains retina resolution and ultra supersamples standard displays", () => {
  assert.equal(graphicsProfile("high", 2).pixelRatio, 2);
  assert.equal(graphicsProfile("ultra", 1).pixelRatio, 1.5);
  assert.equal(graphicsProfile("ultra", 4).pixelRatio, 3);
  assert.equal(graphicsProfile("balanced", 3).pixelRatio, 1.5);
  assert.equal(graphicsProfile("performance", 1).pixelRatio, 0.75);
  assert.equal(graphicsProfile("high", NaN).pixelRatio, 1);
});
