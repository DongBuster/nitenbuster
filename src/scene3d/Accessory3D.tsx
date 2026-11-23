import type { AnimalId } from '../engine/types';

export interface Accessory3DProps {
  accessory?: string | null;
  animal?: AnimalId;
}

interface AnchorPoint {
  y: number;
  z: number;
  scale: number;
}

interface AnimalAccessoryAnchors {
  scarf: AnchorPoint;
  glasses: AnchorPoint;
  hat: AnchorPoint;
}

const ACCESSORY_ANCHORS: Record<AnimalId, AnimalAccessoryAnchors> = {
  shark: {
    scarf: { y: 0.62, z: 0.05, scale: 1.38 },
    glasses: { y: 1.06, z: 0.44, scale: 1.22 },
    hat: { y: 1.56, z: 0.0, scale: 0.92 },
  },
  dino: {
    scarf: { y: 0.64, z: 0.06, scale: 1.18 },
    glasses: { y: 1.12, z: 0.56, scale: 1.08 },
    hat: { y: 1.56, z: -0.04, scale: 0.95 },
  },
  chicken: {
    scarf: { y: 0.58, z: 0.03, scale: 1.16 },
    glasses: { y: 0.96, z: 0.41, scale: 0.92 },
    hat: { y: 1.48, z: -0.1, scale: 0.92 },
  },
  duck: {
    scarf: { y: 0.62, z: 0.03, scale: 1.08 },
    glasses: { y: 1.1, z: 0.42, scale: 0.95 },
    hat: { y: 1.52, z: -0.02, scale: 0.95 },
  },
  panda: {
    scarf: { y: 0.78, z: 0.06, scale: 1.24 },
    glasses: { y: 1.15, z: 0.49, scale: 1.08 },
    hat: { y: 1.56, z: 0.02, scale: 1.0 },
  },
  dog: {
    scarf: { y: 0.68, z: 0.04, scale: 1.05 },
    glasses: { y: 1.12, z: 0.46, scale: 1.0 },
    hat: { y: 1.52, z: 0.02, scale: 1.0 },
  },
  cat: {
    scarf: { y: 0.68, z: 0.04, scale: 1.04 },
    glasses: { y: 1.12, z: 0.46, scale: 1.0 },
    hat: { y: 1.52, z: 0.02, scale: 1.0 },
  },
  bunny: {
    scarf: { y: 0.68, z: 0.04, scale: 1.02 },
    glasses: { y: 1.1, z: 0.45, scale: 0.98 },
    hat: { y: 1.52, z: 0.06, scale: 0.95 },
  },
};

export function Accessory3D({ accessory, animal = 'dog' }: Accessory3DProps) {
  if (!accessory) return null;

  const anchors = ACCESSORY_ANCHORS[animal] ?? ACCESSORY_ANCHORS.dog;

  if (accessory === 'scarf') {
    const a = anchors.scarf;
    return (
      <group
        name="accessory-scarf"
        position={[0, a.y, a.z]}
        scale={a.scale}
      >
        {/* Cozy red knit collar wrap around neck */}
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[0.38, 0.085, 16, 32]} />
          <meshStandardMaterial color="#DC2626" roughness={0.85} />
        </mesh>
        {/* Cream accent stripe ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.39, 0.025, 10, 32]} />
          <meshStandardMaterial color="#FEF3C7" roughness={0.85} />
        </mesh>
        {/* Front left hanging scarf tail */}
        <group position={[-0.08, -0.2, 0.38]} rotation={[0.14, 0, -0.14]}>
          <mesh castShadow>
            <boxGeometry args={[0.13, 0.32, 0.055]} />
            <meshStandardMaterial color="#DC2626" roughness={0.85} />
          </mesh>
          <mesh position={[0, -0.1, 0.004]}>
            <boxGeometry args={[0.134, 0.04, 0.058]} />
            <meshStandardMaterial color="#FEF3C7" roughness={0.85} />
          </mesh>
        </group>
        {/* Front right hanging scarf tail */}
        <group position={[0.09, -0.17, 0.38]} rotation={[0.12, 0, 0.16]}>
          <mesh castShadow>
            <boxGeometry args={[0.12, 0.26, 0.052]} />
            <meshStandardMaterial color="#B91C1C" roughness={0.85} />
          </mesh>
          <mesh position={[0, -0.075, 0.004]}>
            <boxGeometry args={[0.124, 0.036, 0.056]} />
            <meshStandardMaterial color="#FEF3C7" roughness={0.85} />
          </mesh>
        </group>
      </group>
    );
  }

  if (accessory === 'glasses') {
    const a = anchors.glasses;
    return (
      <group
        name="accessory-glasses"
        position={[0, a.y, a.z]}
        scale={a.scale}
      >
        {/* Left aviator lens + gold rim */}
        <group position={[-0.17, 0, 0]}>
          <mesh scale={[1.15, 0.9, 0.35]} castShadow>
            <sphereGeometry args={[0.115, 20, 16]} />
            <meshStandardMaterial
              color="#111827"
              roughness={0.08}
              metalness={0.72}
            />
          </mesh>
          <mesh scale={[1.15, 0.9, 1]}>
            <torusGeometry args={[0.116, 0.015, 10, 24]} />
            <meshStandardMaterial
              color="#F59E0B"
              roughness={0.2}
              metalness={0.85}
            />
          </mesh>
        </group>

        {/* Right aviator lens + gold rim */}
        <group position={[0.17, 0, 0]}>
          <mesh scale={[1.15, 0.9, 0.35]} castShadow>
            <sphereGeometry args={[0.115, 20, 16]} />
            <meshStandardMaterial
              color="#111827"
              roughness={0.08}
              metalness={0.72}
            />
          </mesh>
          <mesh scale={[1.15, 0.9, 1]}>
            <torusGeometry args={[0.116, 0.015, 10, 24]} />
            <meshStandardMaterial
              color="#F59E0B"
              roughness={0.2}
              metalness={0.85}
            />
          </mesh>
        </group>

        {/* Gold nose bridge */}
        <mesh position={[0, 0.03, 0.01]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.013, 0.013, 0.14, 10]} />
          <meshStandardMaterial
            color="#F59E0B"
            roughness={0.2}
            metalness={0.85}
          />
        </mesh>

        {/* Side temples */}
        {[-1, 1].map((side) => (
          <mesh
            key={side}
            position={[side * 0.31, 0.02, -0.18]}
            rotation={[Math.PI / 2, 0, side * 0.15]}
          >
            <cylinderGeometry args={[0.012, 0.012, 0.38, 8]} />
            <meshStandardMaterial
              color="#F59E0B"
              roughness={0.22}
              metalness={0.85}
            />
          </mesh>
        ))}
      </group>
    );
  }

  if (accessory === 'party_hat') {
    const a = anchors.hat;
    return (
      <group
        name="accessory-party-hat"
        position={[0, a.y, a.z]}
        scale={a.scale}
        rotation={[0.05, 0, -0.08]}
      >
        {/* Festive cone body */}
        <mesh position={[0, 0.2, 0]} castShadow>
          <coneGeometry args={[0.24, 0.48, 24]} />
          <meshStandardMaterial color="#EC4899" roughness={0.55} />
        </mesh>
        {/* Festive stripe bands */}
        <mesh position={[0, 0.14, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.17, 0.022, 10, 24]} />
          <meshStandardMaterial color="#38BDF8" roughness={0.45} />
        </mesh>
        <mesh position={[0, 0.28, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.105, 0.018, 10, 24]} />
          <meshStandardMaterial color="#FACC15" roughness={0.45} />
        </mesh>
        {/* Fluffy cream trim ring at base */}
        <mesh position={[0, -0.03, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.24, 0.042, 12, 24]} />
          <meshStandardMaterial color="#FFFBEB" roughness={0.85} />
        </mesh>
        {/* Golden pom-pom on tip */}
        <mesh position={[0, 0.46, 0]} castShadow>
          <sphereGeometry args={[0.075, 16, 16]} />
          <meshStandardMaterial
            color="#FACC15"
            emissive="#F59E0B"
            emissiveIntensity={0.25}
            roughness={0.5}
          />
        </mesh>
      </group>
    );
  }

  if (accessory === 'crown') {
    const a = anchors.hat;
    const jewelColors = ['#EF4444', '#3B82F6', '#10B981', '#EC4899', '#38BDF8'];
    return (
      <group
        name="accessory-crown"
        position={[0, a.y, a.z]}
        scale={a.scale}
      >
        {/* Gold crown base band */}
        <mesh position={[0, 0.04, 0]} castShadow>
          <cylinderGeometry args={[0.24, 0.21, 0.14, 24, 1, false]} />
          <meshStandardMaterial
            color="#FACC15"
            metalness={0.85}
            roughness={0.18}
          />
        </mesh>
        {/* Lower rim ring */}
        <mesh position={[0, -0.025, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.215, 0.022, 10, 28]} />
          <meshStandardMaterial
            color="#EAB308"
            metalness={0.88}
            roughness={0.16}
          />
        </mesh>
        {/* 5 golden crown spikes + jewels */}
        {[0, 1, 2, 3, 4].map((i) => {
          const angle = (i / 5) * Math.PI * 2;
          const x = Math.sin(angle) * 0.21;
          const z = Math.cos(angle) * 0.21;
          return (
            <group key={i}>
              <mesh position={[x, 0.18, z]} castShadow>
                <coneGeometry args={[0.068, 0.16, 10]} />
                <meshStandardMaterial
                  color="#FACC15"
                  metalness={0.85}
                  roughness={0.18}
                />
              </mesh>
              <mesh position={[x, 0.265, z]}>
                <sphereGeometry args={[0.028, 12, 12]} />
                <meshStandardMaterial
                  color="#FEF08A"
                  metalness={0.85}
                  roughness={0.15}
                />
              </mesh>
              <mesh position={[x * 1.12, 0.04, z * 1.12]}>
                <octahedronGeometry args={[0.036, 0]} />
                <meshStandardMaterial
                  color={jewelColors[i]}
                  emissive={jewelColors[i]}
                  emissiveIntensity={0.35}
                  roughness={0.15}
                  metalness={0.25}
                />
              </mesh>
            </group>
          );
        })}
      </group>
    );
  }

  return null;
}
