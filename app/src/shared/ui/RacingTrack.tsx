import { useEffect, useRef } from "react";
import { usePhysicsEngineContext } from "~/src/widgets/scene/Scene";
import * as THREE from "three";

interface TrackConfig {
  innerRadiusX?: number;
  innerRadiusZ?: number;
  trackWidth?: number;
  height?: number;
  segments?: number; // how many pieces to approximate the loop
  colorRoad?: string;
  colorBorder?: string;
}

export function RacingTrack({
  innerRadiusX = 70,
  innerRadiusZ = 40,
  trackWidth = 15,
  height = 0.6,
  segments = 64,
  colorRoad = "#2b2b2b",
  colorBorder = "#666",
}: TrackConfig) {
  const physics = usePhysicsEngineContext();
  const roadMeshRefs = useRef<THREE.Mesh[]>([]);
  const borderMeshRefs = useRef<THREE.Mesh[]>([]);
  const railMeshRefs = useRef<THREE.Mesh[]>([]);
  const startLineRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      // Build an oval by placing short rectangular road segments around an ellipse.
      for (let i = 0; i < segments; i++) {
        const t = (i / segments) * Math.PI * 2;
        const tNext = ((i + 1) / segments) * Math.PI * 2;

        // Ellipse center points for current and next segment
        const cx = Math.cos(t) * (innerRadiusX + trackWidth / 2);
        const cz = Math.sin(t) * (innerRadiusZ + trackWidth / 2);
        const nx = Math.cos(tNext) * (innerRadiusX + trackWidth / 2);
        const nz = Math.sin(tNext) * (innerRadiusZ + trackWidth / 2);

        // Segment center and length
        const midX = (cx + nx) / 2;
        const midZ = (cz + nz) / 2;
        const dx = nx - cx;
        const dz = nz - cz;
        const segLen = Math.max(1, Math.hypot(dx, dz));

        // Create road piece
        const roadId = `track_road_${i}`;
        const roadSize = new THREE.Vector3(segLen, height, trackWidth);
        const roadPos = new THREE.Vector3(midX, -height / 2, midZ);
        const road = physics.createStaticGround(roadId, roadPos, roadSize);
        if (road && roadMeshRefs.current[i]) {
          road.mesh = roadMeshRefs.current[i];
        }

        // Optional inner border (thin curb)
        const curbThickness = 0.3;
        const curbHeight = height * 0.5;
        const innerWidth = curbThickness;
        const outerWidth = curbThickness;

        const innerId = `track_inner_${i}`;
        const innerSize = new THREE.Vector3(segLen, curbHeight, innerWidth);
        const innerRadX = innerRadiusX + innerWidth / 2;
        const innerRadZ = innerRadiusZ + innerWidth / 2;
        const icx = Math.cos(t) * innerRadX;
        const icz = Math.sin(t) * innerRadZ;
        const inx = Math.cos(tNext) * innerRadX;
        const inz = Math.sin(tNext) * innerRadZ;
        const imx = (icx + inx) / 2;
        const imz = (icz + inz) / 2;
        const innerPos = new THREE.Vector3(imx, -(curbHeight / 2), imz);
        const inner = physics.createStaticGround(innerId, innerPos, innerSize);
        if (inner && borderMeshRefs.current[i * 2]) {
          inner.mesh = borderMeshRefs.current[i * 2];
        }

        // Optional outer border
        const outerId = `track_outer_${i}`;
        const outerSize = new THREE.Vector3(segLen, curbHeight, outerWidth);
        const orx = Math.cos(t) * (innerRadiusX + trackWidth - outerWidth / 2);
        const orz = Math.sin(t) * (innerRadiusZ + trackWidth - outerWidth / 2);
        const onx =
          Math.cos(tNext) * (innerRadiusX + trackWidth - outerWidth / 2);
        const onz =
          Math.sin(tNext) * (innerRadiusZ + trackWidth - outerWidth / 2);
        const omx = (orx + onx) / 2;
        const omz = (orz + onz) / 2;
        const outerPos = new THREE.Vector3(omx, -(curbHeight / 2), omz);
        const outer = physics.createStaticGround(outerId, outerPos, outerSize);
        if (outer && borderMeshRefs.current[i * 2 + 1]) {
          outer.mesh = borderMeshRefs.current[i * 2 + 1];
        }
        // Guardrails (static obstacles) slightly above road surface
        const railHeight = 1.2;
        const railThickness = 0.2;
        const halfW = trackWidth / 2;

        // Rail offset outward normal (per segment direction)
        const len = Math.hypot(dx, dz) || 1;
        const nxn = -dz / len; // outward normal x
        const nzn = dx / len; // outward normal z

        // Inner rail (slightly inside)
        const innerRailCenterX = midX - nxn * (halfW - railThickness * 1.5);
        const innerRailCenterZ = midZ - nzn * (halfW - railThickness * 1.5);
        const innerRailId = `rail_inner_${i}`;
        const innerRailSize = new THREE.Vector3(
          segLen,
          railHeight,
          railThickness
        );
        const innerRailPos = new THREE.Vector3(
          innerRailCenterX,
          railHeight / 2 - height / 2,
          innerRailCenterZ
        );
        const innerRail = physics.createStaticObstacle(
          innerRailId,
          innerRailPos,
          innerRailSize
        );
        if (innerRail && railMeshRefs.current[i * 2]) {
          innerRail.mesh = railMeshRefs.current[i * 2];
        }

        // Outer rail (outside)
        const outerRailCenterX = midX + nxn * (halfW - railThickness * 1.5);
        const outerRailCenterZ = midZ + nzn * (halfW - railThickness * 1.5);
        const outerRailId = `rail_outer_${i}`;
        const outerRailSize = new THREE.Vector3(
          segLen,
          railHeight,
          railThickness
        );
        const outerRailPos = new THREE.Vector3(
          outerRailCenterX,
          railHeight / 2 - height / 2,
          outerRailCenterZ
        );
        const outerRail = physics.createStaticObstacle(
          outerRailId,
          outerRailPos,
          outerRailSize
        );
        if (outerRail && railMeshRefs.current[i * 2 + 1]) {
          outerRail.mesh = railMeshRefs.current[i * 2 + 1];
        }
      }

      // Start/finish line (visual)
      if (startLineRef.current) {
        startLineRef.current.position.set(
          innerRadiusX + trackWidth / 2,
          0.01,
          0
        );
      }
    }, 50);

    return () => {
      for (let i = 0; i < segments; i++) {
        physics.removeObject(`track_road_${i}`);
        physics.removeObject(`track_inner_${i}`);
        physics.removeObject(`track_outer_${i}`);
        physics.removeObject(`rail_inner_${i}`);
        physics.removeObject(`rail_outer_${i}`);
      }
      clearTimeout(timer);
    };
  }, [innerRadiusX, innerRadiusZ, segments, trackWidth, height]);

  return (
    <group>
      {/* Road meshes */}
      {Array.from({ length: segments }).map((_, i) => {
        const t = (i / segments) * Math.PI * 2;
        const tNext = ((i + 1) / segments) * Math.PI * 2;
        const cx = Math.cos(t) * (innerRadiusX + trackWidth / 2);
        const cz = Math.sin(t) * (innerRadiusZ + trackWidth / 2);
        const nx = Math.cos(tNext) * (innerRadiusX + trackWidth / 2);
        const nz = Math.sin(tNext) * (innerRadiusZ + trackWidth / 2);
        const midX = (cx + nx) / 2;
        const midZ = (cz + nz) / 2;
        const segLen = Math.max(1, Math.hypot(nx - cx, nz - cz));
        return (
          <mesh
            key={`road_${i}`}
            ref={(el) => {
              if (el) roadMeshRefs.current[i] = el;
            }}
            position={[midX, -height / 2, midZ]}
          >
            <boxGeometry args={[segLen, height, trackWidth]} />
            <meshStandardMaterial color={colorRoad} />
          </mesh>
        );
      })}

      {/* Borders */}
      {Array.from({ length: segments }).map((_, i) => {
        const t = (i / segments) * Math.PI * 2;
        const tNext = ((i + 1) / segments) * Math.PI * 2;

        const innerWidth = 0.3;
        const curbHeight = height * 0.5;

        const innerRadX = innerRadiusX + innerWidth / 2;
        const innerRadZ = innerRadiusZ + innerWidth / 2;
        const icx = Math.cos(t) * innerRadX;
        const icz = Math.sin(t) * innerRadZ;
        const inx = Math.cos(tNext) * innerRadX;
        const inz = Math.sin(tNext) * innerRadZ;
        const imx = (icx + inx) / 2;
        const imz = (icz + inz) / 2;
        const innerLen = Math.max(1, Math.hypot(inx - icx, inz - icz));

        const outerWidth = 0.3;
        const orx = Math.cos(t) * (innerRadiusX + trackWidth - outerWidth / 2);
        const orz = Math.sin(t) * (innerRadiusZ + trackWidth - outerWidth / 2);
        const onx =
          Math.cos(tNext) * (innerRadiusX + trackWidth - outerWidth / 2);
        const onz =
          Math.sin(tNext) * (innerRadiusZ + trackWidth - outerWidth / 2);
        const omx = (orx + onx) / 2;
        const omz = (orz + onz) / 2;
        const outerLen = Math.max(1, Math.hypot(onx - orx, onz - orz));

        return (
          <group key={`borders_${i}`}>
            <mesh
              ref={(el) => {
                if (el) borderMeshRefs.current[i * 2] = el;
              }}
              position={[imx, -(curbHeight / 2), imz]}
            >
              <boxGeometry args={[innerLen, curbHeight, innerWidth]} />
              <meshStandardMaterial color={colorBorder} />
            </mesh>
            <mesh
              ref={(el) => {
                if (el) borderMeshRefs.current[i * 2 + 1] = el;
              }}
              position={[omx, -(curbHeight / 2), omz]}
            >
              <boxGeometry args={[outerLen, curbHeight, outerWidth]} />
              <meshStandardMaterial color={colorBorder} />
            </mesh>
          </group>
        );
      })}

      {/* Guardrails */}
      {Array.from({ length: segments }).map((_, i) => {
        const t = (i / segments) * Math.PI * 2;
        const tNext = ((i + 1) / segments) * Math.PI * 2;
        const cx = Math.cos(t) * (innerRadiusX + trackWidth / 2);
        const cz = Math.sin(t) * (innerRadiusZ + trackWidth / 2);
        const nx = Math.cos(tNext) * (innerRadiusX + trackWidth / 2);
        const nz = Math.sin(tNext) * (innerRadiusZ + trackWidth / 2);
        const midX = (cx + nx) / 2;
        const midZ = (cz + nz) / 2;
        const dx = nx - cx;
        const dz = nz - cz;
        const segLen = Math.max(1, Math.hypot(dx, dz));
        const railHeight = 1.2;
        const railThickness = 0.2;
        const halfW = trackWidth / 2;
        const len = Math.hypot(dx, dz) || 1;
        const nxn = -dz / len;
        const nzn = dx / len;

        const innerRailCenterX = midX - nxn * (halfW - railThickness * 1.5);
        const innerRailCenterZ = midZ - nzn * (halfW - railThickness * 1.5);
        const outerRailCenterX = midX + nxn * (halfW - railThickness * 1.5);
        const outerRailCenterZ = midZ + nzn * (halfW - railThickness * 1.5);

        return (
          <group key={`rails_${i}`}>
            <mesh
              ref={(el) => {
                if (el) railMeshRefs.current[i * 2] = el;
              }}
              position={[
                innerRailCenterX,
                railHeight / 2 - height / 2,
                innerRailCenterZ,
              ]}
            >
              <boxGeometry args={[segLen, railHeight, railThickness]} />
              <meshStandardMaterial color="#999" />
            </mesh>
            <mesh
              ref={(el) => {
                if (el) railMeshRefs.current[i * 2 + 1] = el;
              }}
              position={[
                outerRailCenterX,
                railHeight / 2 - height / 2,
                outerRailCenterZ,
              ]}
            >
              <boxGeometry args={[segLen, railHeight, railThickness]} />
              <meshStandardMaterial color="#999" />
            </mesh>
          </group>
        );
      })}

      {/* Start/Finish line moved to dedicated component */}
    </group>
  );
}
