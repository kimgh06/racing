import { useFrame, useThree } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import Car, { CarHandle } from "~/src/entities/car";
import { useEffect, useRef, useMemo } from "react";
import {
  Vector3,
  Quaternion,
  Euler,
  GridHelper,
  Object3D,
  Mesh,
  DoubleSide,
  MeshStandardMaterial,
} from "three";
import { Box, Html, Plane } from "@react-three/drei";
import PlaneWall from "~/src/entities/wall";

// ===============================
// 카메라 설정 상수
// ===============================
const CAMERA_CONFIG = {
  DISTANCE: {
    DEFAULT: 3.1, // 기본 카메라 거리
    MIN: 0.3, // 최소 거리 (마우스 휠)
    MAX: 4, // 최대 거리 (마우스 휠)
  },
  ROTATION: {
    PITCH: -0.3, // 카메라 기울기 고정값 (약간 아래를 보도록)
    MOUSE_SENSITIVITY: 0.002, // 마우스 이동 감도
  },
  WHEEL: {
    SENSITIVITY: 0.005, // 마우스 휠 스크롤 감도
  },
  FOLLOW: {
    POSITION_SPEED: 20, // 카메라 위치 따라가기 속도
    ROTATION_SPEED: 15, // 카메라 회전 따라가기 속도
  },
} as const;

function Scene() {
  const { camera } = useThree();
  const keyQueue = useRef<Record<string, boolean>>({});
  const carRef = useRef<CarHandle>(null);
  const boxRef = useRef<Mesh>(null);
  const boxPositionRef = useRef(new Vector3());
  const htmlContentRef = useRef<HTMLDivElement>(null);

  // Material 인스턴스 메모이제이션 (매 렌더링마다 재생성 방지)
  const greenMaterial = useMemo(
    () => new MeshStandardMaterial({ side: DoubleSide, color: "green" }),
    []
  );

  // useFrame에서 재사용할 객체들 (가비지 컬렉션 방지)
  const tempVector = useRef(new Vector3());
  const tempQuaternion = useRef(new Quaternion());
  const tempEuler = useRef(new Euler());

  // HTML 코드: Follow cam 구조 - pivot, yaw, pitch
  const pivot = useMemo(() => new Object3D(), []);
  const yaw = useMemo(() => new Object3D(), []);
  const pitch = useMemo(() => new Object3D(), []);

  // HTML 코드: 카메라 계층 구조 설정
  useEffect(() => {
    pivot.add(yaw);
    yaw.add(pitch);
    pitch.add(camera);
    camera.position.z = CAMERA_CONFIG.DISTANCE.DEFAULT;
  }, [pivot, yaw, pitch, camera]);

  // HTML 코드: Mouse controls
  const yawRotation = useRef(0);
  const pitchRotation = useRef(CAMERA_CONFIG.ROTATION.PITCH);
  const cameraDistance = useRef<number>(CAMERA_CONFIG.DISTANCE.DEFAULT);

  const onDocumentMouseMove = (e: MouseEvent) => {
    if (e.buttons === 0) return;
    yawRotation.current -=
      e.movementX * CAMERA_CONFIG.ROTATION.MOUSE_SENSITIVITY;

    // 카메라 기울기는 고정 (마우스로 변경 불가)
    // pitchRotation.current는 고정값 유지
  };

  const onDocumentMouseWheel = (e: WheelEvent) => {
    e.preventDefault();
    const v =
      cameraDistance.current + e.deltaY * CAMERA_CONFIG.WHEEL.SENSITIVITY;
    if (v >= CAMERA_CONFIG.DISTANCE.MIN && v <= CAMERA_CONFIG.DISTANCE.MAX) {
      cameraDistance.current = v;
    }
  };

  useEffect(() => {
    document.addEventListener("mousemove", onDocumentMouseMove);
    document.addEventListener("wheel", onDocumentMouseWheel);

    return () => {
      document.removeEventListener("mousemove", onDocumentMouseMove);
      document.removeEventListener("wheel", onDocumentMouseWheel);
    };
  }, []);
  const handleKeyDown = (event: KeyboardEvent) =>
    (keyQueue.current[event.key] = true);

  const handleKeyUp = (event: KeyboardEvent) =>
    delete keyQueue.current[event.key];

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useFrame((state, delta) => {
    // R 키를 누르면 차량 위치/회전/속도를 초기화
    if (keyQueue.current["r"] || keyQueue.current["R"]) {
      const rigidBody = carRef.current?.rigidBodyRef.current;
      if (rigidBody) {
        // 초기 위치 (Car에 넘긴 position과 동일하게 맞춰야 함)
        const resetPosition = { x: 0, y: 0, z: 0 };

        rigidBody.setTranslation(resetPosition, true);
        rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
        rigidBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
        rigidBody.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      }
    }

    // HTML 코드: Follow cam 업데이트
    // this.followTarget.getWorldPosition(this.v)
    if (carRef.current?.followTarget) {
      carRef.current.followTarget.getWorldPosition(tempVector.current);

      // 카메라가 조금 느리게 카트를 따라가도록 lerp 속도 조정
      pivot.position.lerp(
        tempVector.current,
        delta * CAMERA_CONFIG.FOLLOW.POSITION_SPEED
      );
    }

    // 카트의 직진 방향에 따라 시점 고정
    if (carRef.current?.rigidBodyRef.current) {
      const carRotation = carRef.current.rigidBodyRef.current.rotation();
      tempQuaternion.current.set(
        carRotation.x,
        carRotation.y,
        carRotation.z,
        carRotation.w
      );

      // Quaternion을 Euler로 변환하여 Y축 회전 각도 추출
      tempEuler.current.setFromQuaternion(tempQuaternion.current, "YXZ");

      // 카트의 Y축 회전에 카메라 yaw를 맞춤
      const targetYaw = tempEuler.current.y;

      // 360도 회전 시 휙 돌아가는 현상을 완화하기 위해
      // 현재 yaw와 목표 yaw의 차이를 -PI ~ PI 범위로 정규화하여
      // 가장 짧은 방향으로만 회전하도록 함
      let deltaYaw = targetYaw - yawRotation.current;
      while (deltaYaw > Math.PI) deltaYaw -= Math.PI * 2;
      while (deltaYaw < -Math.PI) deltaYaw += Math.PI * 2;

      // 부드럽게 회전
      yawRotation.current +=
        deltaYaw * CAMERA_CONFIG.FOLLOW.ROTATION_SPEED * delta;
    }

    yaw.rotation.y = yawRotation.current;
    pitch.rotation.x = pitchRotation.current;

    camera.position.z = cameraDistance.current;

    if (boxRef.current && htmlContentRef.current) {
      boxRef.current.getWorldPosition(boxPositionRef.current);
      htmlContentRef.current.textContent = `${boxPositionRef.current.x.toFixed(
        2
      )}, ${boxPositionRef.current.y.toFixed(
        2
      )}, ${boxPositionRef.current.z.toFixed(2)}`;
    }
  });

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <primitive object={pivot} /> {/* camera */}
      <Car ref={carRef} position={[0, 0, 0]} keyQueue={keyQueue} />
      {/* moving box */}
      <RigidBody position={[0, 0.5, 25]}>
        <Box ref={boxRef}>
          <Html position={[0, 1, 0]}>
            <div ref={htmlContentRef}>0.00, 0.00, 0.00</div>
          </Html>
        </Box>
      </RigidBody>
      {/* 일반 경사면 */}
      <RigidBody type={"fixed"}>
        <Plane
          rotation={[(-Math.PI * 7) / 16, 0, 0]}
          position={[0, 1.9, -55]}
          args={[4, 25]}
          material={greenMaterial}
        />
      </RigidBody>
      {/* Guide Lane */}
      <RigidBody type={"fixed"}>
        <PlaneWall position={[-2, 0, -26]} args={[55, 1]} />
        <PlaneWall position={[2, 0, -26]} args={[55, 1]} />
        <PlaneWall position={[5, 0, -85]} args={[10, 1]} />
        <PlaneWall position={[-5, 0, -85]} args={[10, 1]} />
        <PlaneWall position={[0, 0, -80]} args={[10, 1]} rotateY={0} />
        <PlaneWall
          position={[0, 0, -95]}
          args={[10 * Math.sqrt(2), 1]}
          rotateY={Math.PI / 4}
        />
        <PlaneWall position={[10, 0, -90]} args={[10, 1]} rotateY={0} />
        <PlaneWall position={[10, 0, -100]} args={[10, 1]} rotateY={0} />
        <PlaneWall position={[30, 0, -90]} args={[40, 1]} rotateY={0} />
        <PlaneWall position={[30, 0, -100]} args={[40, 1]} rotateY={0} />
        <PlaneWall
          position={[55, 0, -95]}
          args={[10 * Math.sqrt(2), 1]}
          rotateY={-Math.PI / 4}
        />
        <PlaneWall position={[60, 0, -85]} args={[10, 1]} />
        <PlaneWall position={[50, 0, -85]} args={[10, 1]} />
        <PlaneWall position={[50, 0, 20]} args={[200, 1]} />
        <PlaneWall position={[60, 0, 20]} args={[200, 1]} />
        <PlaneWall
          position={[55, 0, 125]}
          args={[10 * Math.sqrt(2), 1]}
          rotateY={Math.PI / 4}
        />
        <PlaneWall position={[0, 0, 120]} args={[100, 1]} rotateY={0} />
        <PlaneWall position={[0, 0, 130]} args={[100, 1]} rotateY={0} />
        <PlaneWall
          position={[-55, 0, 125]}
          args={[10 * Math.sqrt(2), 1]}
          rotateY={-Math.PI / 4}
        />
        <PlaneWall position={[-60, 0, 61.25]} args={[120.5, 1]} />
        <PlaneWall position={[-50, 0, 62.75]} args={[114.5, 1]} />
        <PlaneWall position={[-26, 0, 1.5]} args={[48, 1]} rotateY={0} />
        <PlaneWall position={[-26, 0, 5.5]} args={[48, 1]} rotateY={0} />
        <PlaneWall position={[-55, 0, 1.5]} args={[10, 1]} rotateY={0} />
        <PlaneWall
          position={[0, 0, 3.5]}
          args={[4 * Math.sqrt(2), 1]}
          rotateY={Math.PI / 4}
        />
      </RigidBody>
      {/* 바닥 */}
      <gridHelper position={[0, -0.5, 0]} args={[2000, 2000]} />
      <CuboidCollider
        position={[0, -1, 0]}
        args={[1000, 0.5, 1000]}
      ></CuboidCollider>
    </>
  );
}

export default Scene;
