import test from "node:test";
import assert from "node:assert/strict";
import { CHUNK_SIZE, getChunkProps, getObstacles } from "./world";

test("streamed terrain is deterministic after old chunks leave the cache", () => {
  const original = structuredClone(getChunkProps(-4, 9));
  for (let i = 0; i < 150; i++) getChunkProps(i, -i);
  assert.deepEqual(getChunkProps(-4, 9), original);
});

test("terrain stays sparse and finite at positive, negative and distant coordinates", () => {
  for (const cx of [-50000, -1, 0, 1, 50000]) {
    for (const cz of [-50000, -1, 0, 1, 50000]) {
      const props = getChunkProps(cx, cz);
      assert.ok(props.length <= 3);
      for (const prop of props) {
        assert.ok(Number.isFinite(prop.x) && Number.isFinite(prop.z));
        assert.ok(prop.radius > 0 && prop.radius < CHUNK_SIZE / 4);
        assert.ok(Math.abs(prop.x - cx * CHUNK_SIZE) < CHUNK_SIZE / 2);
        assert.ok(Math.abs(prop.z - cz * CHUNK_SIZE) < CHUNK_SIZE / 2);
        assert.ok(Math.hypot(prop.x, prop.z) >= 8, "Spawn area stays open");
      }
    }
  }
});

test("collision queries include visual prop footprints on both sides of chunk seams", () => {
  for (const cx of [-2, 0, 2]) {
    const seam = cx * CHUNK_SIZE + CHUNK_SIZE / 2;
    const left = getObstacles(seam - 0.01, 0);
    const right = getObstacles(seam + 0.01, 0);
    assert.ok(left.length <= 27 && right.length <= 27);
    for (const prop of [...getChunkProps(cx, 0), ...getChunkProps(cx + 1, 0)]) {
      assert.ok(left.some(o => o.x === prop.x && o.z === prop.z && o.radius === prop.radius));
      assert.ok(right.some(o => o.x === prop.x && o.z === prop.z && o.radius === prop.radius));
    }
  }
});
