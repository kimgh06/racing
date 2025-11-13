export type Vec2 = { x: number; y: number };

export interface KartState {
  pos: Vec2; // planar position (maps to world x,z)
  vel: Vec2; // planar velocity (maps to world x,z)
  yaw: number; // heading (radians)
  yawRate: number;
  drift: boolean;
  driftDir: number; // -1/0/1
  driftYawOffset: number;
}

export interface KartInput {
  throttle: number; // 0..1
  brake: number; // 0..1
  steer: number; // -1..1
  drift: boolean;
}

export interface KartParams {
  accel: number;
  brake: number;
  maxSpeed: number;
  drag: number;
  roll: number;
  steerMax: number;
  steerSpeed: number;
  wheelBase: number;
  grip: number;
  driftGripScale: number;
  driftYawMax: number;
  surfaceFriction: number;
}

export function stepKart(
  state: KartState,
  input: KartInput,
  p: KartParams,
  dt: number
) {
  const speed = len(state.vel);
  const steerAtten = 1 / (1 + 0.02 * speed);
  const targetSteer = input.steer * p.steerMax * steerAtten;

  // Start drift only if there's meaningful steer to avoid perpetual spin
  if (input.drift && !state.drift && speed > 2 && Math.abs(input.steer) > 0.1) {
    state.drift = true;
    state.driftDir = Math.sign(targetSteer) || state.driftDir || 1;
  } else if (!input.drift) {
    state.drift = false;
    state.driftDir = 0;
  }

  const driftScale = state.drift ? p.driftGripScale : 1.0;
  const driftYawTarget = state.drift ? state.driftDir * p.driftYawMax : 0;
  state.driftYawOffset +=
    (driftYawTarget - state.driftYawOffset) * Math.min(1, p.steerSpeed * dt);

  const steerAngle = targetSteer + state.driftYawOffset;
  state.yawRate = (speed / p.wheelBase) * Math.sin(steerAngle);
  // When there is no steer and no drift, damp yaw to prevent lingering spin
  if (!state.drift && Math.abs(input.steer) < 0.05) {
    state.yawRate *= 0.2;
  }
  state.yaw += state.yawRate * dt;

  const velLocal = rot(state.vel, -state.yaw);
  const slipAngle = Math.atan2(velLocal.y, Math.abs(velLocal.x) + 1e-4);

  const gripBase = p.grip * driftScale * p.surfaceFriction;
  const cornerStiff = gripBase;
  const Fy = (-cornerStiff * slipAngle) / (1 + Math.abs(slipAngle) * 2);

  let ax = input.throttle * p.accel - input.brake * p.brake;
  const dragFx = -p.drag * velLocal.x * Math.abs(velLocal.x);
  const rollFx = -p.roll * velLocal.x;
  const latDamp = -2.0 * velLocal.y;

  const axLocal = ax + dragFx + rollFx;
  const ayLocal = Fy + latDamp;

  const accWorld = rot({ x: axLocal, y: ayLocal }, state.yaw);
  state.vel = add(state.vel, mul(accWorld, dt));
  const sp = len(state.vel);
  if (sp > p.maxSpeed) state.vel = mul(state.vel, p.maxSpeed / sp);
  if (sp < 0.02) state.vel = { x: 0, y: 0 };

  state.pos = add(state.pos, mul(state.vel, dt));
}

export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}
export function mul(a: Vec2, s: number): Vec2 {
  return { x: a.x * s, y: a.y * s };
}
export function len(a: Vec2): number {
  return Math.hypot(a.x, a.y);
}
export function rot(a: Vec2, ang: number): Vec2 {
  const c = Math.cos(ang),
    s = Math.sin(ang);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
}
