/**
 * 입력 처리기
 * 입력 큐의 이벤트를 처리하여 플레이어 움직임을 계산합니다.
 */

import { InputQueue, InputAction, InputEvent } from "./inputQueue";
import * as THREE from "three";

export interface MovementState {
  rotation: number;
  angularVelocity: number;
  moveForward: boolean;
  moveBackward: boolean;
  turnLeft: boolean;
  turnRight: boolean;
  jump: boolean;
}

export interface MovementParams {
  moveSpeed: number;
  turnSpeed: number;
  jumpForce: number;
  weightFactor: number;
}

/**
 * 입력 처리기 클래스
 * 고정 타임스텝으로 입력을 처리하여 결정론적 움직임을 보장합니다.
 */
export class InputProcessor {
  private movementState: MovementState = {
    rotation: 0,
    angularVelocity: 0,
    moveForward: false,
    moveBackward: false,
    turnLeft: false,
    turnRight: false,
    jump: false,
  };

  /**
   * 입력 이벤트를 처리하여 움직임 상태를 업데이트합니다.
   */
  processInput(event: InputEvent, deltaTime: number): MovementState {
    switch (event.action) {
      case "forward":
        this.movementState.moveForward = event.pressed;
        break;
      case "backward":
        this.movementState.moveBackward = event.pressed;
        break;
      case "turnLeft":
        this.movementState.turnLeft = event.pressed;
        break;
      case "turnRight":
        this.movementState.turnRight = event.pressed;
        break;
      case "jump":
        this.movementState.jump = event.pressed;
        break;
    }

    return { ...this.movementState };
  }

  /**
   * 활성 입력을 기반으로 움직임을 계산합니다.
   */
  computeMovement(
    activeInputs: Set<InputAction>,
    deltaTime: number,
    params: MovementParams
  ): {
    rotation: number;
    angularVelocity: number;
    velocity: THREE.Vector3;
    shouldJump: boolean;
  } {
    let angularVelocity = this.movementState.angularVelocity;

    // 회전 입력 처리
    if (activeInputs.has("turnLeft")) {
      angularVelocity = params.turnSpeed;
    } else if (activeInputs.has("turnRight")) {
      angularVelocity = -params.turnSpeed;
    } else {
      // 회전 입력이 없으면 각속도를 매우 빠르게 감소
      angularVelocity *= 0.05;
    }

    // 각속도가 매우 작을 때 완전히 멈춤
    if (Math.abs(angularVelocity) < 0.1) {
      angularVelocity = 0;
    }

    // 회전 업데이트
    let rotation = this.movementState.rotation + angularVelocity * deltaTime;

    // 속도 계산
    let velocityX = 0;
    let velocityZ = 0;

    if (activeInputs.has("forward")) {
      velocityX = -Math.sin(rotation) * params.moveSpeed;
      velocityZ = -Math.cos(rotation) * params.moveSpeed;
    } else if (activeInputs.has("backward")) {
      velocityX = Math.sin(rotation) * params.moveSpeed;
      velocityZ = Math.cos(rotation) * params.moveSpeed;
    }

    // 상태 업데이트
    this.movementState.rotation = rotation;
    this.movementState.angularVelocity = angularVelocity;

    return {
      rotation,
      angularVelocity,
      velocity: new THREE.Vector3(velocityX, 0, velocityZ),
      shouldJump: activeInputs.has("jump"),
    };
  }

  /**
   * 이동 상태를 반환합니다.
   */
  getMovementState(): MovementState {
    return { ...this.movementState };
  }

  /**
   * 이동 상태를 설정합니다.
   */
  setMovementState(state: Partial<MovementState>) {
    this.movementState = { ...this.movementState, ...state };
  }

  /**
   * 상태를 리셋합니다.
   */
  reset(rotation: number = 0) {
    this.movementState = {
      rotation,
      angularVelocity: 0,
      moveForward: false,
      moveBackward: false,
      turnLeft: false,
      turnRight: false,
      jump: false,
    };
  }
}
