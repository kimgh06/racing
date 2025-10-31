import { useRef, useCallback, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import * as RAPIER from "@dimforge/rapier3d-compat";

// 물리 오브젝트 인터페이스
export interface PhysicsObject {
  id: string;
  rigidBody: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  mesh?: THREE.Mesh;
  type: "player" | "ground" | "obstacle";
  weight?: number; // kg 단위
  onGround?: boolean;
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
    this.world = new RAPIER.World(new RAPIER.Vector3(0, -config.gravity, 0));
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

  // 맵 경계 체크
  checkMapBounds(id: string) {
    const obj = this.objects.get(id);
    if (!obj) return;

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

  // 바닥 충돌 감지 (간단한 거리 기반)
  checkGroundCollision() {
    for (const obj of this.objects.values()) {
      if (obj.type === "player") {
        obj.onGround = false;

        const playerPos = this.getPosition(obj.id);
        const playerVelocity = this.getVelocity(obj.id);

        // 모든 바닥 오브젝트와의 거리 체크
        for (const groundObj of this.objects.values()) {
          if (groundObj.type === "ground") {
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
    // Rapier 물리 시뮬레이션
    this.world.step();

    // 바닥 충돌 감지
    this.checkGroundCollision();

    // 맵 경계 체크
    for (const obj of this.objects.values()) {
      if (obj.type === "player") {
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
  ): PhysicsObject {
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

    const obj: PhysicsObject = {
      id,
      rigidBody,
      collider,
      type: "ground",
      onGround: false,
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
  ): PhysicsObject {
    const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic();
    const rigidBody = this.world.createRigidBody(rigidBodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.cuboid(
      size.x / 2,
      size.y / 2,
      size.z / 2
    );
    colliderDesc.setMass(mass);
    colliderDesc.setRestitution(0.1);
    colliderDesc.setFriction(0.98);
    const collider = this.world.createCollider(colliderDesc, rigidBody);

    rigidBody.setTranslation(
      new RAPIER.Vector3(position.x, position.y, position.z),
      true
    );

    const obj: PhysicsObject = {
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
  ): PhysicsObject {
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

    const obj: PhysicsObject = {
      id,
      rigidBody,
      collider,
      type: "obstacle",
      onGround: false,
    };

    this.addObject(id, obj);
    return obj;
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
  };
}
