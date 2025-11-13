import * as THREE from "three";

export interface PlayerProps {
  position?: [number, number, number];
  mass?: number;
  weight?: number;
}

export interface PlayerState {
  rotation: number;
  wheelRotation: number;
  wheelRotationSpeed: number;
  driveSpeedCurrent?: number;
  steerAngle: number;
  steerAngleTarget: number;
  tiltX: number;
  tiltZ: number;
  tiltVelocityX: number;
  tiltVelocityZ: number;
  headTilt: number;
  headTiltVelocity: number;
  centerOfMass: THREE.Vector3;
  supportPoint: THREE.Vector3;
}
