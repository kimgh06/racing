import { useRef, useCallback, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import * as RAPIER from "@dimforge/rapier3d-compat";

// 기본 물리 오브젝트 인터페이스 (공통 속성)
export interface BasePhysicsObject {
  id: string;
  rigidBody: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  mesh?: THREE.Mesh;
}

// 정적 물리 오브젝트 (움직이지 않는 객체)
export interface StaticPhysicsObject extends BasePhysicsObject {
  type: "ground" | "obstacle";
}

// 동적 물리 오브젝트 (움직이는 객체 - 플레이어 등)
export interface DynamicPhysicsObject extends BasePhysicsObject {
  type: "player";
  weight: number; // kg 단위
  onGround: boolean;
}

// 물리 오브젝트 타입 (union type)
export type PhysicsObject = StaticPhysicsObject | DynamicPhysicsObject;

// 타입 가드: 동적 객체인지 확인
export function isDynamicObject(
  obj: PhysicsObject
): obj is DynamicPhysicsObject {
  return obj.type === "player";
}

// 타입 가드: 정적 객체인지 확인
export function isStaticObject(obj: PhysicsObject): obj is StaticPhysicsObject {
  return obj.type === "ground" || obj.type === "obstacle";
}

// 물리 엔진 설정
export interface PhysicsConfig {
  gravity: number;
  mapBounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    fallHeight: number;
  };
}

// RapierJS 물리 엔진 클래스
export class PhysicsEngine {
  private world: RAPIER.World;
  private objects: Map<string, PhysicsObject> = new Map();
  private config: PhysicsConfig;
  private groundCollisionCallback?: (
    objectId: string,
    impactVelocity: number
  ) => void;

  constructor(config: PhysicsConfig) {
    this.config = config;
    // World 생성 시 고정 timestep 설정 (60fps 기준: 1/60초)
    // Rapier 3D에서는 World 생성 시 timestep을 두 번째 인자로 전달할 수 있습니다
    const timestep = 1 / 60;
    try {
      // Rapier 3D compat 버전의 World 생성자 확인
      // 일부 버전에서는 (gravity, timestep) 형태를 지원합니다
      this.world = new RAPIER.World(new RAPIER.Vector3(0, -config.gravity, 0));
      // timestep 속성이 있는 경우 설정
      if (
        "timestep" in this.world &&
        typeof (this.world as any).timestep === "number"
      ) {
        (this.world as any).timestep = timestep;
      }
    } catch (e) {
      // 폴백: 기본 생성자만 사용
      this.world = new RAPIER.World(new RAPIER.Vector3(0, -config.gravity, 0));
    }
  }

  // 오브젝트 추가
  addObject(id: string, object: PhysicsObject) {
    this.objects.set(id, object);
  }

  // 오브젝트 제거
  removeObject(id: string) {
    const obj = this.objects.get(id);
    if (obj) {
      this.world.removeRigidBody(obj.rigidBody);
      this.objects.delete(id);
    }
  }

  // 오브젝트 가져오기
  getObject(id: string): PhysicsObject | null {
    return this.objects.get(id) || null;
  }

  // 모든 오브젝트 가져오기
  getObjects(): Map<string, PhysicsObject> {
    return this.objects;
  }

  // 바닥 충돌 콜백 설정
  setGroundCollisionCallback(
    callback: (objectId: string, impactVelocity: number) => void
  ) {
    this.groundCollisionCallback = callback;
  }

  // 위치 설정
  setPosition(id: string, position: THREE.Vector3) {
    const obj = this.objects.get(id);
    if (obj) {
      obj.rigidBody.setTranslation(
        new RAPIER.Vector3(position.x, position.y, position.z),
        true
      );
    }
  }

  // 위치 가져오기
  getPosition(id: string): THREE.Vector3 {
    const obj = this.objects.get(id);
    if (obj) {
      const pos = obj.rigidBody.translation();
      return new THREE.Vector3(pos.x, pos.y, pos.z);
    }
    return new THREE.Vector3(0, 0, 0);
  }

  // 속도 설정
  setVelocity(id: string, velocity: THREE.Vector3) {
    const obj = this.objects.get(id);
    if (obj) {
      obj.rigidBody.setLinvel(
        new RAPIER.Vector3(velocity.x, velocity.y, velocity.z),
        true
      );
    }
  }

  // 속도 가져오기
  getVelocity(id: string): THREE.Vector3 {
    const obj = this.objects.get(id);
    if (obj) {
      const vel = obj.rigidBody.linvel();
      return new THREE.Vector3(vel.x, vel.y, vel.z);
    }
    return new THREE.Vector3(0, 0, 0);
  }

  // 회전 설정
  setRotation(id: string, rotation: THREE.Euler) {
    const obj = this.objects.get(id);
    if (obj) {
      const quaternion = new THREE.Quaternion().setFromEuler(rotation);
      obj.rigidBody.setRotation(
        new RAPIER.Quaternion(
          quaternion.x,
          quaternion.y,
          quaternion.z,
          quaternion.w
        ),
        true
      );
    }
  }

  // 회전 가져오기
  getRotation(id: string): THREE.Euler {
    const obj = this.objects.get(id);
    if (obj) {
      const rot = obj.rigidBody.rotation();
      const euler = new THREE.Euler();
      euler.setFromQuaternion(new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w));
      return euler;
    }
    return new THREE.Euler();
  }

  // 맵 경계 체크 (동적 객체만)
  checkMapBounds(id: string) {
    const obj = this.objects.get(id);
    if (!obj || !isDynamicObject(obj)) return;

    const position = this.getPosition(id);
    const bounds = this.config.mapBounds;

    if (
      position.x < bounds.minX ||
      position.x > bounds.maxX ||
      position.z < bounds.minZ ||
      position.z > bounds.maxZ ||
      position.y < bounds.fallHeight
    ) {
      this.setPosition(id, new THREE.Vector3(0, 10, 0));
      this.setVelocity(id, new THREE.Vector3(0, 0, 0));
    }
  }

  // 바닥 통과 방지: 플레이어가 바닥 아래로 떨어졌는지 확인
  preventGroundPenetration() {
    for (const obj of this.objects.values()) {
      if (isDynamicObject(obj)) {
        const playerPos = this.getPosition(obj.id);

        // 모든 바닥 오브젝트와의 거리 체크
        for (const groundObj of this.objects.values()) {
          if (isStaticObject(groundObj) && groundObj.type === "ground") {
            const groundPos = this.getPosition(groundObj.id);
            const groundSize = groundObj.collider.halfExtents();

            // 바닥의 상단 Y 위치
            const groundTopY = groundPos.y + groundSize.y;
            // 플레이어의 하단 Y 위치 (collider의 halfExtents를 고려)
            const playerHalfExtents = obj.collider.halfExtents();
            const playerBottomY = playerPos.y - playerHalfExtents.y;

            // X, Z 범위 내에 있는지 확인
            const distanceX = Math.abs(playerPos.x - groundPos.x);
            const distanceZ = Math.abs(playerPos.z - groundPos.z);

            // 바닥 위에 있어야 하는데 아래로 떨어진 경우
            // onGround 체크를 제거하여 항상 감지하도록 함
            if (
              distanceX < groundSize.x &&
              distanceZ < groundSize.z &&
              playerBottomY < groundTopY
            ) {
              // 플레이어를 바닥 위로 올리기
              const correctionY = groundTopY + playerHalfExtents.y + 0.01; // 약간의 여유 공간
              this.setPosition(
                obj.id,
                new THREE.Vector3(playerPos.x, correctionY, playerPos.z)
              );

              // 수직 속도를 0으로 설정 (땅에 떨어뜨림)
              const currentVelocity = this.getVelocity(obj.id);
              this.setVelocity(
                obj.id,
                new THREE.Vector3(currentVelocity.x, 0, currentVelocity.z)
              );

              // 바닥에 있다고 표시
              obj.onGround = true;
              break;
            }
          }
        }
      }
    }
  }

  // 바닥 충돌 감지 (간단한 거리 기반)
  checkGroundCollision() {
    for (const obj of this.objects.values()) {
      if (isDynamicObject(obj)) {
        obj.onGround = false;

        const playerPos = this.getPosition(obj.id);
        const playerVelocity = this.getVelocity(obj.id);

        // 모든 바닥 오브젝트와의 거리 체크
        for (const groundObj of this.objects.values()) {
          if (isStaticObject(groundObj) && groundObj.type === "ground") {
            const groundPos = this.getPosition(groundObj.id);
            const groundSize = groundObj.collider.halfExtents();

            // 플레이어가 바닥 위에 있는지 체크
            const distanceY = Math.abs(playerPos.y - groundPos.y);
            const distanceX = Math.abs(playerPos.x - groundPos.x);
            const distanceZ = Math.abs(playerPos.z - groundPos.z);

            if (
              distanceY < 1.5 && // 플레이어 높이 + 바닥 높이
              distanceX < groundSize.x &&
              distanceZ < groundSize.z &&
              playerPos.y > groundPos.y // 플레이어가 바닥 위에 있음
            ) {
              obj.onGround = true;
              if (
                this.groundCollisionCallback &&
                Math.abs(playerVelocity.y) > 0.1
              ) {
                this.groundCollisionCallback(
                  obj.id,
                  Math.abs(playerVelocity.y)
                );
              }
              break;
            }
          }
        }
      }
    }
  }

  // 물리 시뮬레이션 스텝
  step(deltaTime: number) {
    // deltaTime을 제한하여 매우 큰 프레임 드롭 시에도 안정성 유지
    // (60fps 기준으로 약 16.67ms, 최대 50ms로 제한)
    const maxDeltaTime = 0.05; // 50ms
    const clampedDeltaTime = Math.min(deltaTime, maxDeltaTime);

    // Rapier 3D에서 World.step()은 timestep을 매개변수로 받지 않습니다
    // 대신 고정 timestep으로 여러 번 호출하여 서브스텝을 구현합니다
    const fixedTimeStep = 1 / 60; // 60fps 기준 고정 timestep
    let remainingTime = clampedDeltaTime;
    const maxSubSteps = 5; // 최대 서브스텝 수 제한
    let subStepCount = 0;

    // 서브스텝 처리: 큰 deltaTime을 고정 timestep 단위로 나누어 처리
    while (remainingTime > fixedTimeStep && subStepCount < maxSubSteps) {
      this.world.step();
      remainingTime -= fixedTimeStep;
      subStepCount++;
    }

    // 남은 시간이 있으면 마지막 스텝 실행
    if (remainingTime > 0 && subStepCount < maxSubSteps) {
      this.world.step();
    }

    // 바닥 충돌 감지
    this.checkGroundCollision();

    // 바닥 통과 방지: 플레이어가 바닥 아래로 떨어졌는지 확인하고 강제로 올리기
    this.preventGroundPenetration();

    // 맵 경계 체크 (동적 객체만)
    for (const obj of this.objects.values()) {
      if (isDynamicObject(obj)) {
        this.checkMapBounds(obj.id);
      }
    }

    // Three.js 메시와 Rapier RigidBody 동기화
    for (const obj of this.objects.values()) {
      if (obj.mesh) {
        const position = this.getPosition(obj.id);
        const rotation = this.getRotation(obj.id);

        obj.mesh.position.copy(position);
        obj.mesh.rotation.copy(rotation);
      }
    }
  }

  // 정적 바닥 생성
  createStaticGround(
    id: string,
    position: THREE.Vector3,
    size: THREE.Vector3
  ): StaticPhysicsObject {
    const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed();
    const rigidBody = this.world.createRigidBody(rigidBodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.cuboid(
      size.x / 2,
      size.y / 2,
      size.z / 2
    );
    const collider = this.world.createCollider(colliderDesc, rigidBody);

    rigidBody.setTranslation(
      new RAPIER.Vector3(position.x, position.y, position.z),
      true
    );

    const obj: StaticPhysicsObject = {
      id,
      rigidBody,
      collider,
      type: "ground",
    };

    this.addObject(id, obj);
    return obj;
  }

  // 동적 플레이어 생성
  createPlayer(
    id: string,
    position: THREE.Vector3,
    size: THREE.Vector3,
    mass: number = 1,
    weight: number = 70
  ): DynamicPhysicsObject {
    const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic();
    // CCD(연속 충돌 감지) 활성화 - 빠른 속도로 이동할 때 바닥을 통과하는 것을 방지
    rigidBodyDesc.setCcdEnabled(true);
    // 최대 속도 제한을 위한 설정 (선택적)
    // rigidBodyDesc.setLinearDamping(0.0); // 공기 저항은 0으로 유지

    const rigidBody = this.world.createRigidBody(rigidBodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.cuboid(
      size.x / 2,
      size.y / 2,
      size.z / 2
    );
    colliderDesc.setMass(mass);
    colliderDesc.setRestitution(0.1);
    colliderDesc.setFriction(0.98);
    // Collider에도 활성화된 상태에서 추가
    const collider = this.world.createCollider(colliderDesc, rigidBody);

    rigidBody.setTranslation(
      new RAPIER.Vector3(position.x, position.y, position.z),
      true
    );

    const obj: DynamicPhysicsObject = {
      id,
      rigidBody,
      collider,
      type: "player",
      onGround: false,
      weight,
    };

    this.addObject(id, obj);
    return obj;
  }

  // 정적 장애물 생성
  createStaticObstacle(
    id: string,
    position: THREE.Vector3,
    size: THREE.Vector3
  ): StaticPhysicsObject {
    const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed();
    const rigidBody = this.world.createRigidBody(rigidBodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.cuboid(
      size.x / 2,
      size.y / 2,
      size.z / 2
    );
    const collider = this.world.createCollider(colliderDesc, rigidBody);

    rigidBody.setTranslation(
      new RAPIER.Vector3(position.x, position.y, position.z),
      true
    );

    const obj: StaticPhysicsObject = {
      id,
      rigidBody,
      collider,
      type: "obstacle",
    };

    this.addObject(id, obj);
    return obj;
  }

  // 센서 타입 체크포인트 생성 (물리 반응 없음, 충돌 감지만)
  createSensorCheckpoint(
    id: string,
    position: THREE.Vector3,
    size: THREE.Vector3,
    rotationZ: number = 0
  ): StaticPhysicsObject {
    const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed();
    const rigidBody = this.world.createRigidBody(rigidBodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.cuboid(
      size.x / 2,
      size.y / 2,
      size.z / 2
    );
    // 센서로 설정: 물리 반응 없고 충돌 감지만
    colliderDesc.setSensor(true);
    const collider = this.world.createCollider(colliderDesc, rigidBody);

    rigidBody.setTranslation(
      new RAPIER.Vector3(position.x, position.y, position.z),
      true
    );

    // Z축 회전 적용
    if (rotationZ !== 0) {
      const quaternion = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0, rotationZ, 0)
      );
      rigidBody.setRotation(
        new RAPIER.Quaternion(
          quaternion.x,
          quaternion.y,
          quaternion.z,
          quaternion.w
        ),
        true
      );
    }

    const obj: StaticPhysicsObject = {
      id,
      rigidBody,
      collider,
      type: "obstacle", // 타입은 obstacle이지만 센서로 작동
    };

    this.addObject(id, obj);
    return obj;
  }

  // 두 오브젝트 간 접촉 여부 확인 (AABB 검사)
  hasContact(id1: string, id2: string): boolean {
    const obj1 = this.objects.get(id1);
    const obj2 = this.objects.get(id2);
    if (!obj1 || !obj2) return false;

    // 각 rigidBody의 위치 가져오기
    const pos1 = obj1.rigidBody.translation();
    const pos2 = obj2.rigidBody.translation();

    // 각 collider의 halfExtents 가져오기
    const halfExtents1 = obj1.collider.halfExtents();
    const halfExtents2 = obj2.collider.halfExtents();

    // AABB 간 교차 확인
    return (
      Math.abs(pos1.x - pos2.x) < halfExtents1.x + halfExtents2.x &&
      Math.abs(pos1.y - pos2.y) < halfExtents1.y + halfExtents2.y &&
      Math.abs(pos1.z - pos2.z) < halfExtents1.z + halfExtents2.z
    );
  }

  // 엔진 정리
  destroy() {
    this.world.free();
    this.objects.clear();
  }
}

// React Hook
export function usePhysicsEngine(config: PhysicsConfig) {
  const engineRef = useRef<PhysicsEngine | null>(null);

  useEffect(() => {
    // Rapier 초기화
    RAPIER.init().then(() => {
      engineRef.current = new PhysicsEngine(config);
    });

    return () => {
      if (engineRef.current) {
        engineRef.current.destroy();
      }
    };
  }, []);

  useFrame((state, delta) => {
    if (engineRef.current) {
      engineRef.current.step(delta);
    }
  });

  const addObject = useCallback((id: string, object: PhysicsObject) => {
    return engineRef.current?.addObject(id, object);
  }, []);

  const removeObject = useCallback((id: string) => {
    return engineRef.current?.removeObject(id);
  }, []);

  const getObject = useCallback((id: string) => {
    return engineRef.current?.getObject(id) || null;
  }, []);

  const getObjects = useCallback(() => {
    return engineRef.current?.getObjects() || new Map();
  }, []);

  const setGroundCollisionCallback = useCallback(
    (callback: (objectId: string, impactVelocity: number) => void) => {
      return engineRef.current?.setGroundCollisionCallback(callback);
    },
    []
  );

  const setPosition = useCallback((id: string, position: THREE.Vector3) => {
    return engineRef.current?.setPosition(id, position);
  }, []);

  const getPosition = useCallback((id: string) => {
    return engineRef.current?.getPosition(id) || new THREE.Vector3(0, 0, 0);
  }, []);

  const setVelocity = useCallback((id: string, velocity: THREE.Vector3) => {
    return engineRef.current?.setVelocity(id, velocity);
  }, []);

  const getVelocity = useCallback((id: string) => {
    return engineRef.current?.getVelocity(id) || new THREE.Vector3(0, 0, 0);
  }, []);

  const setRotation = useCallback((id: string, rotation: THREE.Euler) => {
    return engineRef.current?.setRotation(id, rotation);
  }, []);

  const getRotation = useCallback((id: string) => {
    return engineRef.current?.getRotation(id) || new THREE.Euler();
  }, []);

  const createStaticGround = useCallback(
    (id: string, position: THREE.Vector3, size: THREE.Vector3) => {
      return engineRef.current?.createStaticGround(id, position, size);
    },
    []
  );

  const createPlayer = useCallback(
    (
      id: string,
      position: THREE.Vector3,
      size: THREE.Vector3,
      mass: number = 1,
      weight: number = 70
    ) => {
      return engineRef.current?.createPlayer(id, position, size, mass, weight);
    },
    []
  );

  const createStaticObstacle = useCallback(
    (id: string, position: THREE.Vector3, size: THREE.Vector3) => {
      return engineRef.current?.createStaticObstacle(id, position, size);
    },
    []
  );

  const createSensorCheckpoint = useCallback(
    (
      id: string,
      position: THREE.Vector3,
      size: THREE.Vector3,
      rotationZ: number = 0
    ) => {
      return engineRef.current?.createSensorCheckpoint(
        id,
        position,
        size,
        rotationZ
      );
    },
    []
  );

  const hasContact = useCallback((id1: string, id2: string) => {
    return engineRef.current?.hasContact(id1, id2) || false;
  }, []);

  return {
    addObject,
    removeObject,
    getObject,
    getObjects,
    setGroundCollisionCallback,
    setPosition,
    getPosition,
    setVelocity,
    getVelocity,
    setRotation,
    getRotation,
    createStaticGround,
    createPlayer,
    createStaticObstacle,
    createSensorCheckpoint,
    hasContact,
  };
}
