import type { BackAnchor, ScarfAnchor } from '../accessoryAnchors';

interface NeckProps {
  anchor: ScarfAnchor;
  hasOutfit?: boolean;
}

interface BackProps {
  anchor: BackAnchor;
  hasOutfit?: boolean;
}

export function ScarfMesh({ anchor, hasOutfit = false }: NeckProps) {
  const [sx, sy, sz] = anchor.scale;
  const tailZ = (anchor.tailZ ?? 0.41) + (hasOutfit ? 0.085 : 0);
  const tailPitch = (anchor.tailPitch ?? -0.28) + (hasOutfit ? -0.07 : 0);
  const tailLen = anchor.tailLen ?? 0.23;

  return (
    <group
      name="accessory-scarf"
      position={[0, anchor.y + (hasOutfit ? 0.016 : 0), anchor.z]}
      rotation={[anchor.rotX ?? 0.1, 0, 0]}
      scale={[sx * (hasOutfit ? 1.03 : 1), sy, sz * (hasOutfit ? 1.04 : 1)]}
    >
      {/* Cozy red knit collar wrap around neck */}
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.37, 0.08, 16, 32]} />
        <meshStandardMaterial color="#DC2626" roughness={0.85} />
      </mesh>
      {/* Cream accent stripe ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.382, 0.022, 10, 32]} />
        <meshStandardMaterial color="#FEF3C7" roughness={0.85} />
      </mesh>
      {/* Front knit knot keeping tails cleanly anchored outside chest */}
      <mesh position={[0, -0.015, tailZ - 0.02]} scale={[1.2, 0.9, 0.9]} castShadow>
        <sphereGeometry args={[0.072, 16, 14]} />
        <meshStandardMaterial color="#B91C1C" roughness={0.85} />
      </mesh>
      {/* Front left hanging scarf tail */}
      <group position={[-0.065, -0.04, tailZ]} rotation={[tailPitch, 0, -0.16]}>
        <group position={[0, -tailLen * 0.5, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.115, tailLen, 0.046]} />
            <meshStandardMaterial color="#DC2626" roughness={0.85} />
          </mesh>
          <mesh position={[0, -tailLen * 0.3, 0.004]}>
            <boxGeometry args={[0.119, 0.036, 0.05]} />
            <meshStandardMaterial color="#FEF3C7" roughness={0.85} />
          </mesh>
        </group>
      </group>
      {/* Front right hanging scarf tail */}
      <group position={[0.075, -0.04, tailZ]} rotation={[tailPitch - 0.03, 0, 0.18]}>
        <group position={[0, -tailLen * 0.42, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.105, tailLen * 0.84, 0.044]} />
            <meshStandardMaterial color="#B91C1C" roughness={0.85} />
          </mesh>
          <mesh position={[0, -tailLen * 0.24, 0.004]}>
            <boxGeometry args={[0.109, 0.032, 0.048]} />
            <meshStandardMaterial color="#FEF3C7" roughness={0.85} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

export function BowtieMesh({ anchor, hasOutfit = false }: NeckProps) {
  const [sx, sy, sz] = anchor.scale;
  const frontZ = (anchor.tailZ ?? 0.42) + (hasOutfit ? 0.055 : 0);

  return (
    <group
      name="accessory-bowtie"
      position={[0, anchor.y, anchor.z]}
      rotation={[anchor.rotX ?? 0.1, 0, 0]}
      scale={[sx * (hasOutfit ? 1.01 : 0.95), sy, sz * (hasOutfit ? 1.02 : 0.96)]}
    >
      {/* Sleek black ribbon band around neck */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.355, 0.022, 10, 32]} />
        <meshStandardMaterial color="#18181B" roughness={0.65} />
      </mesh>
      {/* Dapper front bow */}
      <group position={[0, -0.02, frontZ + 0.015]} rotation={[-0.12, 0, 0]}>
        {([-1, 1] as const).map((side) => (
          <mesh
            key={side}
            position={[side * 0.095, 0, 0]}
            rotation={[0, 0, side * (Math.PI / 2)]}
            scale={[1.05, 1.0, 0.55]}
            castShadow
          >
            <coneGeometry args={[0.092, 0.17, 16]} />
            <meshStandardMaterial color="#1F2937" roughness={0.55} />
          </mesh>
        ))}
        {/* Gold-trimmed center knot */}
        <mesh scale={[1.15, 1.05, 0.85]} castShadow>
          <sphereGeometry args={[0.042, 16, 14]} />
          <meshStandardMaterial
            color="#F59E0B"
            metalness={0.75}
            roughness={0.25}
          />
        </mesh>
      </group>
    </group>
  );
}

export function GoldChainMesh({ anchor, hasOutfit = false }: NeckProps) {
  const [sx, sy, sz] = anchor.scale;
  const frontZ = (anchor.tailZ ?? 0.42) + (hasOutfit ? 0.04 : 0);

  return (
    <group
      name="accessory-gold-chain"
      position={[0, anchor.y, anchor.z]}
      rotation={[anchor.rotX ?? 0.12, 0, 0]}
      scale={[sx * (hasOutfit ? 1.02 : 1), sy, sz * (hasOutfit ? 1.03 : 1)]}
    >
      {/* Chunky metallic gold chain collar */}
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.385, 0.036, 14, 36]} />
        <meshStandardMaterial
          color="#FACC15"
          metalness={0.9}
          roughness={0.16}
        />
      </mesh>
      {/* Hanging medallion pendant resting on upper chest */}
      <group position={[0, -0.11, frontZ + 0.01]} rotation={[-0.2, 0, 0]}>
        <mesh position={[0, 0.06, -0.01]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.024, 0.008, 8, 16]} />
          <meshStandardMaterial color="#EAB308" metalness={0.9} roughness={0.18} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.085, 0.085, 0.024, 24]} />
          <meshStandardMaterial
            color="#FACC15"
            metalness={0.9}
            roughness={0.15}
          />
        </mesh>
        <mesh position={[0, 0, 0.016]}>
          <octahedronGeometry args={[0.04, 0]} />
          <meshStandardMaterial
            color="#38BDF8"
            emissive="#0284C7"
            emissiveIntensity={0.4}
            metalness={0.3}
            roughness={0.12}
          />
        </mesh>
      </group>
    </group>
  );
}

export function BackpackMesh({ anchor, hasOutfit = false }: BackProps) {
  const zOffset = hasOutfit ? -0.045 : 0;

  return (
    <group
      name="accessory-backpack"
      position={[0, anchor.y, anchor.z + zOffset]}
      rotation={[anchor.rotX ?? -0.15, 0, 0]}
      scale={anchor.scale}
    >
      {/* Main rounded explorer pack */}
      <mesh position={[0, 0, -0.08]} scale={[1.1, 1.25, 0.72]} castShadow>
        <sphereGeometry args={[0.24, 22, 18]} />
        <meshStandardMaterial color="#B45309" roughness={0.78} />
      </mesh>
      {/* Top flap */}
      <mesh position={[0, 0.14, -0.1]} scale={[1.05, 0.55, 0.75]} castShadow>
        <sphereGeometry args={[0.21, 18, 14]} />
        <meshStandardMaterial color="#D97706" roughness={0.75} />
      </mesh>
      {/* Front pocket */}
      <mesh position={[0, -0.1, -0.22]} scale={[0.92, 0.65, 0.45]} castShadow>
        <sphereGeometry args={[0.17, 16, 14]} />
        <meshStandardMaterial color="#92400E" roughness={0.8} />
      </mesh>
      {/* Gold buckle clasp */}
      <mesh position={[0, 0.04, -0.25]}>
        <boxGeometry args={[0.075, 0.055, 0.03]} />
        <meshStandardMaterial color="#FACC15" metalness={0.85} roughness={0.2} />
      </mesh>
      {/* Rolled forest-green sleeping pad strapped on top */}
      <mesh position={[0, 0.27, -0.06]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.072, 0.072, 0.42, 16]} />
        <meshStandardMaterial color="#15803D" roughness={0.82} />
      </mesh>
    </group>
  );
}

export function AngelWingsMesh({ anchor, hasOutfit = false }: BackProps) {
  const zOffset = hasOutfit ? -0.045 : 0;

  return (
    <group
      name="accessory-angel-wings"
      position={[0, anchor.y + 0.06, anchor.z + 0.03 + zOffset]}
      rotation={[anchor.rotX ?? -0.1, 0, 0]}
      scale={anchor.scale}
    >
      {([-1, 1] as const).map((side) => (
        <group
          key={side}
          position={[side * 0.16, 0.04, -0.04]}
          rotation={[0.08, -side * 0.22, side * 0.16]}
        >
          {/* Upper primary feather plume */}
          <mesh
            position={[side * 0.25, 0.16, -0.02]}
            rotation={[0, 0, -side * 0.42]}
            scale={[1.78, 0.72, 0.3]}
            castShadow
          >
            <sphereGeometry args={[0.18, 18, 14]} />
            <meshStandardMaterial
              color="#FFFDF9"
              emissive="#FEF3C7"
              emissiveIntensity={0.12}
              roughness={0.65}
            />
          </mesh>
          {/* Mid secondary feather plume */}
          <mesh
            position={[side * 0.22, 0.03, -0.01]}
            rotation={[0, 0, -side * 0.22]}
            scale={[1.5, 0.62, 0.28]}
            castShadow
          >
            <sphereGeometry args={[0.16, 16, 14]} />
            <meshStandardMaterial color="#FEF9EF" roughness={0.7} />
          </mesh>
          {/* Lower tip feather plume */}
          <mesh
            position={[side * 0.15, -0.09, 0]}
            rotation={[0, 0, -side * 0.06]}
            scale={[1.18, 0.52, 0.25]}
            castShadow
          >
            <sphereGeometry args={[0.13, 14, 12]} />
            <meshStandardMaterial color="#FDE68A" roughness={0.65} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function RoyalCapeMesh({ anchor, hasOutfit = false }: BackProps) {
  const zOffset = hasOutfit ? -0.045 : 0;

  return (
    <group
      name="accessory-royal-cape"
      position={[0, anchor.y + 0.15, anchor.z - 0.01 + zOffset]}
      scale={anchor.scale}
    >
      {/* Fluffy white ermine shoulder mantle */}
      <mesh
        position={[0, 0.04, 0.02]}
        rotation={[Math.PI / 2 - 0.15, 0, 0]}
        scale={[1.18, 0.85, 1]}
        castShadow
      >
        <torusGeometry args={[0.25, 0.055, 12, 24, Math.PI]} />
        <meshStandardMaterial color="#FFFDF9" roughness={0.88} />
      </mesh>
      {/* Twin gold cape clasps */}
      {([-1, 1] as const).map((side) => (
        <mesh key={side} position={[side * 0.21, 0.02, 0.05]} castShadow>
          <sphereGeometry args={[0.04, 12, 12]} />
          <meshStandardMaterial color="#FACC15" metalness={0.85} roughness={0.2} />
        </mesh>
      ))}
      {/* Flowing crimson velvet cape flaring cleanly past round hips and outfits */}
      <group position={[0, -0.02, -0.06]} rotation={[0.42, 0, 0]}>
        <mesh position={[0, -0.22, -0.02]} scale={[1.32, 1.0, 0.28]} castShadow>
          <cylinderGeometry args={[0.22, 0.35, 0.48, 18, 1, false, Math.PI * 0.65, Math.PI * 0.7]} />
          <meshStandardMaterial color="#991B1B" roughness={0.78} />
        </mesh>
        <mesh position={[0, -0.22, -0.05]} scale={[1.28, 1.0, 0.18]} castShadow>
          <boxGeometry args={[0.44, 0.48, 0.1]} />
          <meshStandardMaterial color="#B91C1C" roughness={0.8} />
        </mesh>
        {/* Gold lower cape trim */}
        <mesh position={[0, -0.45, -0.05]}>
          <boxGeometry args={[0.56, 0.036, 0.044]} />
          <meshStandardMaterial color="#FACC15" metalness={0.75} roughness={0.25} />
        </mesh>
      </group>
    </group>
  );
}
