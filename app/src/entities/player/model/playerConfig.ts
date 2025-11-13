const PLAYER_TUNING = {
  vehicle: {
    car: {
      baseWheelSpeed: 10000,
      baseTurnSpeed: 0.3,
      baseJumpForce: 10,
      wheelRadius: 0.28,
      tiltRestore: 1,
      wheelbase: 1.8,
      maxSteerAngle: Math.PI / 20,
      steerSpeed: 8,
    },
    bike: {
      baseWheelSpeed: 90,
      baseTurnSpeed: 0.5,
      baseJumpForce: 12,
      wheelRadius: 0.35,
      tiltRestore: 0.2,
      wheelbase: 1.2,
      maxSteerAngle: Math.PI / 19,
      steerSpeed: 8,
    },
    mono: {
      baseWheelSpeed: 70,
      baseTurnSpeed: 0.8,
      baseJumpForce: 13,
      wheelRadius: 0.35,
      tiltRestore: 0.2,
      wheelbase: 0.7,
      maxSteerAngle: Math.PI / 18,
      steerSpeed: 12,
    },
  },
  motor: {
    ev: { maxRPM: 800, accelRPM: 800, decelRPM: 300 },
    ice: { maxRPM: 1200, accelRPM: 500, decelRPM: 200 },
  },
  gripCoeff: { car: 1.0, bike: 0.95, mono: 0.9 },
  airGripScale: 0.8,
  wheelVisualAccelRPM: 150,
  wheelVisualDecelRPM: 200,
  collisionEnergyLoss: 0.01, // 충돌 시 에너지 손실 (0.01 = 1%만 유지, 99% 손실)
} as const;

export type VehicleTypeKey = keyof typeof PLAYER_TUNING.vehicle;
export type MotorTypeKey = keyof typeof PLAYER_TUNING.motor;

export { PLAYER_TUNING };
