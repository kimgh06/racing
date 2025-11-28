import { useFrame, useThree } from "@react-three/fiber";
import {
  CuboidCollider,
  RigidBody,
  RapierRigidBody,
  ConvexHullCollider,
} from "@react-three/rapier";
import Car, { CarHandle } from "~/src/entities/car";
import { useEffect, useRef, useState, useMemo } from "react";
import { Vector3, Quaternion, Euler, GridHelper, Object3D } from "three";
import { Box } from "@react-three/drei";

function Scene() {
  const { camera } = useThree();
  const keyQueue = useRef<Record<string, boolean>>({});
  const carRef = useRef<CarHandle>(null);

  // HTML 코드: Follow cam 구조 - pivot, yaw, pitch
  const pivot = useMemo(() => new Object3D(), []);
  const yaw = useMemo(() => new Object3D(), []);
  const pitch = useMemo(() => new Object3D(), []);

  // HTML 코드: 카메라 계층 구조 설정
  useEffect(() => {
    pivot.add(yaw);
    yaw.add(pitch);
    pitch.add(camera);
    camera.position.z = 4; // HTML 코드: camera.position.set(0, 0, 4)
  }, [pivot, yaw, pitch, camera]);

  // HTML 코드: Mouse controls
  const yawRotation = useRef(0);
  const pitchRotation = useRef(-0.3); // 카메라 기울기 고정값 (약간 아래를 보도록)
  const cameraDistance = useRef(4);

  const onDocumentMouseMove = (e: MouseEvent) => {
    // HTML 코드: yaw.rotation.y -= e.movementX * 0.002
    if (e.buttons === 0) return;
    yawRotation.current -= e.movementX * 0.002;

    // 카메라 기울기는 고정 (마우스로 변경 불가)
    // pitchRotation.current는 고정값 유지
  };

  const onDocumentMouseWheel = (e: WheelEvent) => {
    e.preventDefault();
    // HTML 코드: const v = camera.position.z + e.deltaY * 0.005
    const v = cameraDistance.current + e.deltaY * 0.005;
    // HTML 코드: if (v >= 0.5 && v <= 5) { camera.position.z = v }
    if (v >= 0.5 && v <= 5) {
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
    // 차량 입력 처리는 나중에 직접 제어 방식으로 구현 예정

    // HTML 코드: Follow cam 업데이트
    // this.followTarget.getWorldPosition(this.v)
    if (carRef.current?.followTarget) {
      const v = new Vector3();
      carRef.current.followTarget.getWorldPosition(v);

      // 카메라가 조금 느리게 카트를 따라가도록 lerp 속도 조정
      pivot.position.lerp(v, delta * 15); // 조금 느리게 따라가기
    }

    // 카트의 직진 방향에 따라 시점 고정
    if (carRef.current?.rigidBodyRef.current) {
      const carRotation = carRef.current.rigidBodyRef.current.rotation();
      const carQuat = new Quaternion(
        carRotation.x,
        carRotation.y,
        carRotation.z,
        carRotation.w
      );

      // Quaternion을 Euler로 변환하여 Y축 회전 각도 추출
      const euler = new Euler().setFromQuaternion(carQuat, "YXZ");

      // 카트의 Y축 회전에 카메라 yaw를 맞춤
      const targetYaw = euler.y;

      // 360도 회전 시 휙 돌아가는 현상을 완화하기 위해
      // 현재 yaw와 목표 yaw의 차이를 -PI ~ PI 범위로 정규화하여
      // 가장 짧은 방향으로만 회전하도록 함
      let deltaYaw = targetYaw - yawRotation.current;
      while (deltaYaw > Math.PI) deltaYaw -= Math.PI * 2;
      while (deltaYaw < -Math.PI) deltaYaw += Math.PI * 2;

      // 부드럽게 회전 (회전 속도 계수는 필요에 따라 조절)
      const followSpeed = 5;
      yawRotation.current += deltaYaw * followSpeed * delta;
    }

    yaw.rotation.y = yawRotation.current;
    pitch.rotation.x = pitchRotation.current;

    camera.position.z = cameraDistance.current;
  });
  return (
    <>
      <primitive object={pivot} />

      <Car ref={carRef} position={[0, 0, 0]} keyQueue={keyQueue} />

      <RigidBody>
        <Box position={[0, -1, 10]} />
      </RigidBody>

      {/* 일반 경사면 */}
      <RigidBody type={"fixed"}>
        <Box
          rotation={[Math.PI / 16, 0, 0]}
          position={[0, 0, -10]}
          args={[3, 0.1, 25]}
        />
      </RigidBody>

      {/* 바닥 */}
      <gridHelper position={[0, -1.5, 0]} args={[200, 200]} />
      <CuboidCollider
        position={[0, -2, 0]}
        args={[100, 0.5, 100]}
      ></CuboidCollider>
    </>
  );
}

export default Scene;
