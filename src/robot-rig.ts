import * as THREE from "three";

// Moving parts authored in Blender (scripts/robot_rig.py): `wheel_*` spin about their axle,
// `tread_<L|R>_<nn>` links run round each track in belt order, and `body` rocks on the suspension.
const TREAD = /^tread_([LR])_(\d+)$/;
// Links sit ~0.09 apart, so a belt moving at true ground speed steps more than half a link per
// frame and strobes backwards (the wagon-wheel effect). Gear it down and cap the per-frame step.
const GEARING = 0.25;
const MAX_LINK_STEP = 1 / 3;
// Anything further in one frame is a respawn or robot swap, not driving.
const MAX_TRAVEL = 1.5;
// Base driving speed (simulation.ts) at which the body settles into its full forward lean.
const DRIVE_SPEED = 6.2;
const LEAN = 0.035;
// Radians per second of body tilt per unit/s change in forward or sideways velocity.
const PITCH_KICK = 0.28;
const ROLL_KICK = 0.16;
const SPRING = 170;
const DAMPING = 9;
const MAX_TILT = 0.16;

type Pose = { position: THREE.Vector3; quaternion: THREE.Quaternion };
type Belt = { links: Pose[]; left: boolean; offset: number; first: number };
type Wheel = Pose & { left: boolean; angle: number };

const spinAxis = new THREE.Vector3(1, 0, 0);
const spin = new THREE.Quaternion();
const position = new THREE.Vector3();
const quaternion = new THREE.Quaternion();
const unit = new THREE.Vector3(1, 1, 1);
const matrix = new THREE.Matrix4();

/** One InstancedMesh per sub-mesh of `parts`, which share geometry as Blender linked duplicates. */
function instanced(model: THREE.Object3D, parts: THREE.Object3D[]) {
  const meshes: THREE.Mesh[] = [];
  // GLTFLoader leaves primitives untransformed under their node, so a part's pose is its mesh's.
  parts[0].traverse((o) => {
    if (o instanceof THREE.Mesh) meshes.push(o);
  });
  for (const part of parts) part.removeFromParent();
  return meshes.map((mesh) => {
    const batch = new THREE.InstancedMesh(
      mesh.geometry,
      mesh.material,
      parts.length,
    );
    batch.name = `${parts[0].name.split("_")[0]}-${batch.id}`;
    batch.castShadow = mesh.castShadow;
    batch.receiveShadow = mesh.receiveShadow;
    batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    model.add(batch);
    return batch;
  });
}

const pose = (o: THREE.Object3D): Pose => ({
  position: o.position.clone(),
  quaternion: o.quaternion.clone(),
});

/** Drives a playable robot's wheels, tread belts and body suspension from its motion each frame. */
export class RobotRig {
  private body?: THREE.Object3D;
  private bodyHeight = 0;
  private belts: Belt[] = [];
  private treads: THREE.InstancedMesh[] = [];
  private wheels: Wheel[] = [];
  private wheelBatches: THREE.InstancedMesh[] = [];
  private batches: THREE.InstancedMesh[] = [];
  private wheelRadius = 0.14;
  private linkPitch = 0.09;
  // Signed centre-line offsets of the tracks, used for the pivot-turn speed of each side.
  private trackX = { left: 0.59, right: -0.59 };
  private primed = false;
  private lastX = 0;
  private lastZ = 0;
  private lastYaw = 0;
  private speed = 0;
  private pitch = 0;
  private pitchVelocity = 0;
  private roll = 0;
  private rollVelocity = 0;
  private clock = 0;

  constructor(model: THREE.Object3D) {
    this.body = model.getObjectByName("body");
    this.bodyHeight = this.body?.position.y ?? 0;
    const links = new Map<string, THREE.Object3D[]>();
    const wheels: THREE.Object3D[] = [];
    model.traverse((o) => {
      const tread = TREAD.exec(o.name);
      if (tread) links.set(tread[1], [...(links.get(tread[1]) ?? []), o]);
      else if (o.name.startsWith("wheel_")) wheels.push(o);
    });
    const allLinks: THREE.Object3D[] = [];
    for (const [side, parts] of links) {
      const index = (o: THREE.Object3D) => Number(TREAD.exec(o.name)![2]);
      parts.sort((a, b) => index(a) - index(b));
      this.belts.push({
        links: parts.map(pose),
        left: side === "L",
        offset: 0,
        first: allLinks.length,
      });
      this.trackX[side === "L" ? "left" : "right"] = parts[0].position.x;
      allLinks.push(...parts);
    }
    if (allLinks.length) {
      const [a, b] = this.belts[0].links;
      this.linkPitch = a.position.distanceTo(b.position);
      this.treads = instanced(model, allLinks);
    }
    if (wheels.length) {
      const bounds = new THREE.Box3().setFromObject(wheels[0], true);
      this.wheelRadius = (bounds.max.y - bounds.min.y) / 2;
      this.wheels = wheels.map((o) => ({
        ...pose(o),
        left: o.position.x > 0,
        angle: 0,
      }));
      this.wheelBatches = instanced(model, wheels);
    }
    this.batches = [...this.treads, ...this.wheelBatches];
    this.pose();
    for (const batch of this.batches) batch.computeBoundingSphere();
  }

  /** Follow the robot to its latest ground position and heading. */
  update(x: number, z: number, yaw: number, dt: number, reduced: boolean) {
    if (dt <= 0) return;
    let dx = x - this.lastX;
    let dz = z - this.lastZ;
    let turn = Math.atan2(
      Math.sin(yaw - this.lastYaw),
      Math.cos(yaw - this.lastYaw),
    );
    this.lastX = x;
    this.lastZ = z;
    this.lastYaw = yaw;
    if (!this.primed || Math.hypot(dx, dz) > MAX_TRAVEL) dx = dz = turn = 0;
    this.primed = true;
    const forward = dx * Math.sin(yaw) + dz * Math.cos(yaw);
    // Pivot turns run the tracks in opposite directions, like a real tank.
    const cap = this.linkPitch * MAX_LINK_STEP;
    const track = (offset: number) =>
      Math.max(-cap, Math.min(cap, (forward - turn * offset) * GEARING));
    this.pose(track(this.trackX.left), track(this.trackX.right));
    this.suspend(forward / dt, turn, dt, reduced);
  }

  /** Advance each side's belt and wheels by that track's surface travel. */
  private pose(left = 0, right = 0) {
    for (const belt of this.belts) {
      belt.offset += (belt.left ? left : right) / this.linkPitch;
      // Links are identical, so only the fraction of a link travelled matters.
      const f = belt.offset - Math.floor(belt.offset);
      const n = belt.links.length;
      for (let i = 0; i < n; i++) {
        const from = belt.links[i];
        const to = belt.links[(i + 1) % n];
        position.lerpVectors(from.position, to.position, f);
        quaternion.slerpQuaternions(from.quaternion, to.quaternion, f);
        matrix.compose(position, quaternion, unit);
        for (const batch of this.treads)
          batch.setMatrixAt(belt.first + i, matrix);
      }
    }
    for (let i = 0; i < this.wheels.length; i++) {
      const wheel = this.wheels[i];
      // Spin about the robot's axle line so mirrored right-hand wheels turn the same way.
      wheel.angle += (wheel.left ? left : right) / this.wheelRadius;
      spin.setFromAxisAngle(spinAxis, wheel.angle);
      quaternion.multiplyQuaternions(spin, wheel.quaternion);
      matrix.compose(wheel.position, quaternion, unit);
      for (const batch of this.wheelBatches) batch.setMatrixAt(i, matrix);
    }
    for (const batch of this.batches) batch.instanceMatrix.needsUpdate = true;
  }

  private suspend(speed: number, turn: number, dt: number, reduced: boolean) {
    const body = this.body;
    if (!body) return;
    // Smooth obstacle slides and network jitter before they kick the springs.
    const smoothed = this.speed + (speed - this.speed) * Math.min(1, dt * 30);
    const change = smoothed - this.speed;
    this.speed = smoothed;
    this.clock += dt;
    if (reduced) {
      body.position.y = this.bodyHeight;
      body.rotation.set(0, 0, 0);
      return;
    }
    // Pulling away rocks the nose up and braking dips it; turning throws the body outward.
    this.pitchVelocity -= change * PITCH_KICK;
    this.rollVelocity += smoothed * turn * ROLL_KICK;
    const lean = Math.max(-1, Math.min(1, smoothed / DRIVE_SPEED)) * LEAN;
    this.pitchVelocity +=
      (-SPRING * (this.pitch - lean) - DAMPING * this.pitchVelocity) * dt;
    this.rollVelocity +=
      (-SPRING * this.roll - DAMPING * this.rollVelocity) * dt;
    this.pitch = Math.max(
      -MAX_TILT,
      Math.min(MAX_TILT, this.pitch + this.pitchVelocity * dt),
    );
    this.roll = Math.max(
      -MAX_TILT,
      Math.min(MAX_TILT, this.roll + this.rollVelocity * dt),
    );
    const driving = Math.min(1, Math.abs(smoothed) / 2);
    body.position.y =
      this.bodyHeight +
      Math.sin(this.clock * 8) * 0.012 * (1 - driving) +
      Math.abs(Math.sin(this.clock * 19)) * 0.014 * driving;
    body.rotation.set(this.pitch, 0, this.roll);
  }
}
