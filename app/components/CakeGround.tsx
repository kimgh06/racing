import { useRef, useEffect } from "react";
import { usePhysicsEngineContext } from "./Scene";
import * as THREE from "three";

export function CakeGround() {
  const meshRefs = useRef<THREE.Mesh[]>([]);
  const physicsEngine = usePhysicsEngineContext();

  // 케이크 스타일 다층 지형 정의 (위에서부터 점점 커짐)
  const tiers = [
    { id: "tier_top", y: 3, size: [12, 0.8, 12], color: "#d7d7d7" },
    { id: "tier_upper", y: 1.5, size: [20, 0.8, 20], color: "#cfcfcf" },
    { id: "tier_middle", y: -1, size: [30, 1, 30], color: "#bfbfbf" },
    { id: "tier_lower", y: -2.5, size: [40, 1, 40], color: "#a9a9a9" },
    { id: "tier_base", y: -4, size: [50, 1, 50], color: "#909090" },
  ] as const;

  useEffect(() => {
    // Rapier 엔진이 초기화될 때까지 기다림
    const timer = setTimeout(() => {
      tiers.forEach((tier) => {
        const position = new THREE.Vector3(0, tier.y, 0);
        const size = new THREE.Vector3(...tier.size);
        
        const groundObject = physicsEngine.createStaticGround(tier.id, position, size);
        
        // 메시와 연결
        if (groundObject) {
          const meshIndex = tiers.findIndex((t) => t.id === tier.id);
          if (meshIndex !== -1 && meshRefs.current[meshIndex]) {
            groundObject.mesh = meshRefs.current[meshIndex];
          }
        }
      });
    }, 100);

    return () => {
      tiers.forEach((tier) => {
        physicsEngine.removeObject(tier.id);
      });
      clearTimeout(timer);
    };
  }, []);

  return (
    <group>
      {tiers.map((tier, index) => (
        <mesh
          key={tier.id}
          ref={(el) => {
            if (el) meshRefs.current[index] = el;
          }}
          position={[0, tier.y, 0]}
        >
          <boxGeometry args={[...tier.size]} />
          <meshStandardMaterial color={tier.color} />
        </mesh>
      ))}
    </group>
  );
}
