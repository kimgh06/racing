import { useRef, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export interface GravityObject {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  mass: number;
  restitution: number; // 탄성 계수 (0-1)
  friction: number; // 마찰 계수 (0-1)
  onGround: boolean;
  size?: THREE.Vector3; // 오브젝트 크기 (width, height, depth)
  groundOffset?: number; // 바닥으로부터의 오프셋
  isStatic?: boolean; // 정적 오브젝트인지 여부
  type?: "player" | "ground" | "obstacle"; // 오브젝트 타입
}

export interface GravityEngineConfig {
  gravity: number;
  groundY: number;
  airResistance: number;
  bounceThreshold?: number; // 반발 임계값
  frictionMultiplier?: number; // 마찰 배수
}

export class GravityEngine {
  private objects: Map<string, GravityObject> = new Map();
  private config: GravityEngineConfig;
  private groundCollisionCallback?: (
    objectId: string,
    impactVelocity: number
  ) => void;

  constructor(config: GravityEngineConfig) {
    this.config = {
      bounceThreshold: 0.1,
      frictionMultiplier: 10,
      ...config,
    };
  }

  addObject(id: string, object: GravityObject) {
    this.objects.set(id, object);
  }

  removeObject(id: string) {
    this.objects.delete(id);
  }

  getObject(id: string): GravityObject | undefined {
    return this.objects.get(id);
  }

  setGroundCollisionCallback(
    callback: (objectId: string, impactVelocity: number) => void
  ) {
    this.groundCollisionCallback = callback;
  }

  update(deltaTime: number) {
    // 정적 오브젝트가 아닌 오브젝트들만 물리 업데이트
    this.objects.forEach((object, id) => {
      if (object.isStatic) return;

      // 중력 적용
      object.velocity.y -= this.config.gravity * deltaTime;

      // 공기 저항 적용 (수직 속도에만)
      object.velocity.y *= 1 - this.config.airResistance * deltaTime;

      // 위치 업데이트
      const newPosition = object.position
        .clone()
        .add(object.velocity.clone().multiplyScalar(deltaTime));

      // 바닥 충돌을 먼저 체크하고 위치 보정
      this.checkGroundCollisionFirst(object, newPosition, deltaTime);

      // 다른 오브젝트와의 충돌 검사
      this.checkCollisions(object, newPosition, deltaTime);

      // 위치 업데이트 (충돌 검사 후)
      object.position.copy(newPosition);
    });
  }

  private checkGroundCollisionFirst(
    object: GravityObject,
    newPosition: THREE.Vector3,
    deltaTime: number
  ) {
    // 바닥 오브젝트 찾기
    const ground = this.objects.get("ground");
    if (!ground) return;

    const objectSize = object.size || new THREE.Vector3(1, 1, 1);
    const groundSize = ground.size || new THREE.Vector3(20, 1, 20);

    // 바닥과의 거리 계산 (y축만 고려)
    const objectBottom = newPosition.y - objectSize.y / 2;
    const groundTop = ground.position.y + groundSize.y / 2;

    // 바닥과의 충돌 검사 - 더 엄격한 조건
    if (objectBottom <= groundTop) {
      const impactVelocity = Math.abs(object.velocity.y);
      const wasOnGround = object.onGround;

      // 바닥에 정확히 착지 (오브젝트 하단이 바닥 상단에 닿도록)
      newPosition.y = groundTop + objectSize.y / 2;

      // 수직 속도 처리 - 바닥 아래로 빠지지 않도록 강제로 멈춤
      if (object.velocity.y <= 0) {
        // 바닥에 닿으면 수직 속도를 0으로 설정 (아래로 떨어지는 것 완전 차단)
        object.velocity.y = 0;
      }

      // 강한 마찰 적용 (바닥에 있을 때 지속적으로)
      const frictionFactor = 1 - object.friction * deltaTime * 5; // 마찰 배수 증가
      object.velocity.x *= frictionFactor;
      object.velocity.z *= frictionFactor;

      object.onGround = true;

      // 충돌 콜백 호출
      if (!wasOnGround && this.groundCollisionCallback) {
        this.groundCollisionCallback("player", impactVelocity);
      }
    } else {
      object.onGround = false;
    }
  }

  private checkCollisions(
    object: GravityObject,
    newPosition: THREE.Vector3,
    deltaTime: number
  ) {
    this.objects.forEach((otherObject, otherId) => {
      if (object === otherObject) return;
      if (otherObject.type === "ground") return; // 바닥은 이미 처리됨

      // 다른 오브젝트와의 거리 기반 충돌 검사
      this.checkObjectCollision(object, newPosition, otherObject, deltaTime);
    });
  }

  private checkObjectCollision(
    object1: GravityObject,
    newPosition: THREE.Vector3,
    object2: GravityObject,
    deltaTime: number
  ) {
    const size1 = object1.size || new THREE.Vector3(1, 1, 1);
    const size2 = object2.size || new THREE.Vector3(1, 1, 1);

    // 두 오브젝트 간의 거리 계산
    const distance = newPosition.distanceTo(object2.position);

    // 충돌 반경 계산 (각 오브젝트의 반지름의 합)
    const radius1 = Math.max(size1.x, size1.z) / 2;
    const radius2 = Math.max(size2.x, size2.z) / 2;
    const collisionDistance = radius1 + radius2;

    if (distance < collisionDistance) {
      // 충돌 발생 - 겹침 해결
      const direction = newPosition.clone().sub(object2.position);

      // 거리가 0인 경우 (완전히 겹침) 랜덤 방향으로 분리
      if (direction.length() === 0) {
        direction
          .set((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2)
          .normalize();
      } else {
        direction.normalize();
      }

      // 겹침 정도 계산
      const overlap = collisionDistance - distance;

      // 위치 보정 (겹침 해결)
      const correction = direction.multiplyScalar(overlap * 0.5);
      object1.position.add(correction);
      object2.position.add(correction.multiplyScalar(-1));

      // 속도 반발 (약한 반발력)
      const relativeVelocity = object1.velocity.clone().sub(object2.velocity);
      const velocityAlongNormal = relativeVelocity.dot(direction);

      if (velocityAlongNormal > 0) return; // 이미 분리 중

      // 약한 반발력 적용
      const restitution =
        Math.min(object1.restitution, object2.restitution) * 0.3;
      const impulse = -(1 + restitution) * velocityAlongNormal;
      const impulseVector = direction.multiplyScalar(impulse);

      // 질량에 따른 속도 조정
      const mass1 = object1.mass;
      const mass2 = object2.mass;
      const totalMass = mass1 + mass2;

      object1.velocity.add(impulseVector.multiplyScalar(mass2 / totalMass));
      object2.velocity.add(impulseVector.multiplyScalar(-mass1 / totalMass));
    }
  }

  applyForce(id: string, force: THREE.Vector3) {
    const object = this.objects.get(id);
    if (object) {
      object.velocity.add(force.clone().multiplyScalar(1 / object.mass));
    }
  }

  setVelocity(id: string, velocity: THREE.Vector3) {
    const object = this.objects.get(id);
    if (object) {
      object.velocity.copy(velocity);
    }
  }
}

// React Hook for using gravity engine
export function useGravityEngine(config: GravityEngineConfig) {
  const engineRef = useRef<GravityEngine | null>(null);

  if (!engineRef.current) {
    engineRef.current = new GravityEngine(config);
  }

  useFrame((state, delta) => {
    if (engineRef.current) {
      engineRef.current.update(delta);
    }
  });

  const addObject = useCallback((id: string, object: GravityObject) => {
    if (engineRef.current) {
      engineRef.current.addObject(id, object);
    }
  }, []);

  const removeObject = useCallback((id: string) => {
    if (engineRef.current) {
      engineRef.current.removeObject(id);
    }
  }, []);

  const getObject = useCallback((id: string) => {
    return engineRef.current?.getObject(id);
  }, []);

  const applyForce = useCallback((id: string, force: THREE.Vector3) => {
    if (engineRef.current) {
      engineRef.current.applyForce(id, force);
    }
  }, []);

  const setVelocity = useCallback((id: string, velocity: THREE.Vector3) => {
    if (engineRef.current) {
      engineRef.current.setVelocity(id, velocity);
    }
  }, []);

  const setGroundCollisionCallback = useCallback(
    (callback: (objectId: string, impactVelocity: number) => void) => {
      if (engineRef.current) {
        engineRef.current.setGroundCollisionCallback(callback);
      }
    },
    []
  );

  return {
    addObject,
    removeObject,
    getObject,
    applyForce,
    setVelocity,
    setGroundCollisionCallback,
  };
}
