import type { ItemKind } from '../sim/types';

interface ItemModel3DProps {
  kind: ItemKind;
  nowSec: number;
  color: string;
}

function PawsCardBase({
  color,
  children,
}: {
  color: string;
  children: React.ReactNode;
}) {
  return (
    <group>
      {/* White outer card border */}
      <mesh castShadow>
        <boxGeometry args={[0.64, 0.88, 0.07]} />
        <meshStandardMaterial color="#F8FAFC" roughness={0.28} metalness={0.1} />
      </mesh>
      {/* Colored inner card face */}
      <mesh position={[0, 0, 0.01]}>
        <boxGeometry args={[0.54, 0.78, 0.075]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.4}
          roughness={0.25}
        />
      </mesh>
      {/* Raised 3D emblem on both front & back */}
      <group position={[0, 0, 0.065]}>{children}</group>
      <group position={[0, 0, -0.065]} rotation={[0, Math.PI, 0]}>
        {children}
      </group>
    </group>
  );
}

export function ItemModel3D({ kind, nowSec, color }: ItemModel3DProps) {
  const spinY = nowSec * 1.6;
  const bobY = Math.sin(nowSec * 3.4) * 0.07;

  switch (kind) {
    case 'snowball':
      return (
        <group position={[0, bobY, 0]} rotation={[0.15, spinY, 0]}>
          {/* Main snowball */}
          <mesh position={[-0.08, -0.04, 0]} castShadow>
            <sphereGeometry args={[0.32, 16, 14]} />
            <meshStandardMaterial
              color="#E0F2FE"
              emissive="#38BDF8"
              emissiveIntensity={0.18}
              roughness={0.45}
            />
          </mesh>
          {/* Second stacked snowball */}
          <mesh position={[0.24, -0.1, 0.14]} castShadow>
            <sphereGeometry args={[0.21, 14, 12]} />
            <meshStandardMaterial color="#F0F9FF" roughness={0.4} />
          </mesh>
          {/* Third top snowball */}
          <mesh position={[0.12, 0.2, -0.06]} castShadow>
            <sphereGeometry args={[0.19, 14, 12]} />
            <meshStandardMaterial color="#BAE6FD" roughness={0.35} />
          </mesh>
        </group>
      );

    case 'shovel':
      return (
        <group position={[0, bobY, 0]} rotation={[0.35, spinY, -0.42]}>
          {/* Wooden shaft */}
          <mesh position={[0, 0.05, 0]} castShadow>
            <cylinderGeometry args={[0.048, 0.048, 0.96, 10]} />
            <meshStandardMaterial color="#B45309" roughness={0.65} />
          </mesh>
          {/* D-grip handle at top */}
          <mesh position={[0, 0.56, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.045, 0.045, 0.28, 8]} />
            <meshStandardMaterial color="#F59E0B" roughness={0.45} />
          </mesh>
          {/* Metal shovel blade */}
          <mesh position={[0, -0.46, 0.03]} rotation={[0.18, 0, 0]} castShadow>
            <boxGeometry args={[0.42, 0.44, 0.06]} />
            <meshStandardMaterial
              color="#CBD5E1"
              metalness={0.65}
              roughness={0.28}
            />
          </mesh>
          {/* Gold blade edge highlight */}
          <mesh position={[0, -0.66, 0.05]}>
            <boxGeometry args={[0.43, 0.07, 0.07]} />
            <meshStandardMaterial
              color="#F59E0B"
              emissive="#F59E0B"
              emissiveIntensity={0.35}
              metalness={0.5}
              roughness={0.3}
            />
          </mesh>
        </group>
      );

    case 'cocoa':
      return (
        <group position={[0, bobY, 0]} rotation={[0.18, spinY, 0.08]}>
          {/* Warm ceramic mug body */}
          <mesh castShadow>
            <cylinderGeometry args={[0.28, 0.24, 0.46, 16]} />
            <meshStandardMaterial color="#DC2626" roughness={0.3} />
          </mesh>
          {/* Cream decorative stripe */}
          <mesh position={[0, -0.02, 0]}>
            <cylinderGeometry args={[0.275, 0.26, 0.12, 16]} />
            <meshStandardMaterial color="#FEF3C7" roughness={0.35} />
          </mesh>
          {/* Mug handle */}
          <mesh position={[0.29, 0.02, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow>
            <torusGeometry args={[0.13, 0.04, 8, 14, Math.PI]} />
            <meshStandardMaterial color="#DC2626" roughness={0.3} />
          </mesh>
          {/* Hot cocoa liquid surface */}
          <mesh position={[0, 0.22, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.25, 16]} />
            <meshStandardMaterial color="#451A03" roughness={0.2} />
          </mesh>
          {/* Marshmallows */}
          <mesh position={[-0.08, 0.25, 0.05]}>
            <cylinderGeometry args={[0.065, 0.065, 0.08, 10]} />
            <meshStandardMaterial color="#FFFBEB" roughness={0.5} />
          </mesh>
          <mesh position={[0.09, 0.25, -0.04]} rotation={[0.2, 0.4, 0.1]}>
            <cylinderGeometry args={[0.06, 0.06, 0.08, 10]} />
            <meshStandardMaterial color="#FFFBEB" roughness={0.5} />
          </mesh>
          {/* Rising steam puff */}
          <mesh position={[0, 0.42 + Math.sin(nowSec * 5) * 0.05, 0]}>
            <sphereGeometry args={[0.08, 10, 8]} />
            <meshBasicMaterial color="#FFFFFF" transparent opacity={0.55} />
          </mesh>
        </group>
      );

    case 'skates':
      return (
        <group position={[0, bobY, 0]} rotation={[0.15, spinY, 0.1]}>
          {/* Boot ankle cuff */}
          <mesh position={[-0.08, 0.14, 0]} castShadow>
            <cylinderGeometry args={[0.16, 0.17, 0.36, 12]} />
            <meshStandardMaterial color="#06B6D4" roughness={0.38} />
          </mesh>
          {/* Fluffy white trim */}
          <mesh position={[-0.08, 0.32, 0]}>
            <torusGeometry args={[0.15, 0.045, 8, 14]} />
            <meshStandardMaterial color="#F8FAFC" roughness={0.7} />
          </mesh>
          {/* Boot foot */}
          <mesh position={[0.08, -0.04, 0]} castShadow>
            <boxGeometry args={[0.46, 0.2, 0.24]} />
            <meshStandardMaterial color="#22D3EE" roughness={0.35} />
          </mesh>
          {/* Front toe cap */}
          <mesh position={[0.28, -0.05, 0]} castShadow>
            <sphereGeometry args={[0.115, 12, 10]} />
            <meshStandardMaterial color="#ECFEFF" roughness={0.3} />
          </mesh>
          {/* Steel ice blade */}
          <mesh position={[0.08, -0.22, 0]} castShadow>
            <boxGeometry args={[0.56, 0.07, 0.04]} />
            <meshStandardMaterial
              color="#E2E8F0"
              metalness={0.85}
              roughness={0.15}
            />
          </mesh>
          {/* Curved front blade tip */}
          <mesh position={[0.37, -0.17, 0]} rotation={[0, 0, 0.65]}>
            <boxGeometry args={[0.13, 0.05, 0.04]} />
            <meshStandardMaterial color="#E2E8F0" metalness={0.85} roughness={0.15} />
          </mesh>
        </group>
      );

    case 'shield':
      return (
        <group position={[0, bobY, 0]} rotation={[0.2, spinY, 0]}>
          {/* Round golden trash-lid / buckler shield */}
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.44, 0.44, 0.1, 20]} />
            <meshStandardMaterial
              color="#F59E0B"
              metalness={0.55}
              roughness={0.28}
            />
          </mesh>
          {/* Metallic outer rim */}
          <mesh>
            <torusGeometry args={[0.43, 0.055, 10, 24]} />
            <meshStandardMaterial
              color="#FEF08A"
              emissive="#F59E0B"
              emissiveIntensity={0.25}
              metalness={0.7}
              roughness={0.2}
            />
          </mesh>
          {/* Center dome boss */}
          <mesh position={[0, 0, 0.06]} castShadow>
            <sphereGeometry args={[0.16, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#F8FAFC" metalness={0.75} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0, -0.06]} rotation={[Math.PI, 0, 0]}>
            <sphereGeometry args={[0.16, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#F8FAFC" metalness={0.75} roughness={0.2} />
          </mesh>
        </group>
      );

    case 'candy_bomb': {
      const sparkPulse = 0.8 + Math.sin(nowSec * 18) * 0.35;
      return (
        <group position={[0, bobY, 0]} rotation={[0.12, spinY, 0.12]}>
          {/* Bomb sphere */}
          <mesh castShadow>
            <sphereGeometry args={[0.34, 16, 14]} />
            <meshStandardMaterial
              color="#F43F5E"
              emissive="#BE123C"
              emissiveIntensity={0.35}
              roughness={0.3}
            />
          </mesh>
          {/* Candy white stripe belt */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.32, 0.045, 8, 20]} />
            <meshStandardMaterial color="#FFF1F2" roughness={0.35} />
          </mesh>
          {/* Fuse collar */}
          <mesh position={[0, 0.33, 0]} castShadow>
            <cylinderGeometry args={[0.11, 0.13, 0.1, 12]} />
            <meshStandardMaterial color="#1E293B" metalness={0.5} roughness={0.4} />
          </mesh>
          {/* Fuse rope */}
          <mesh position={[0.04, 0.46, 0]} rotation={[0, 0, -0.25]}>
            <cylinderGeometry args={[0.032, 0.032, 0.22, 8]} />
            <meshStandardMaterial color="#FDE68A" roughness={0.8} />
          </mesh>
          {/* Glowing spark */}
          <mesh position={[0.09, 0.58, 0]} scale={sparkPulse}>
            <octahedronGeometry args={[0.095]} />
            <meshStandardMaterial
              color="#FEF08A"
              emissive="#F59E0B"
              emissiveIntensity={1.6}
            />
          </mesh>
        </group>
      );
    }

    case 'card_freeze':
      return (
        <group position={[0, bobY, 0]} rotation={[0.16, spinY, 0]}>
          <PawsCardBase color={color}>
            {/* 3D Snowflake crystal (3 intersecting ice bars) */}
            {[0, Math.PI / 3, (Math.PI * 2) / 3].map((rot, idx) => (
              <mesh key={idx} rotation={[0, 0, rot]}>
                <boxGeometry args={[0.38, 0.075, 0.05]} />
                <meshStandardMaterial
                  color="#E0F2FE"
                  emissive="#38BDF8"
                  emissiveIntensity={0.85}
                  roughness={0.15}
                />
              </mesh>
            ))}
          </PawsCardBase>
        </group>
      );

    case 'card_taser':
      return (
        <group position={[0, bobY, 0]} rotation={[0.16, spinY, 0]}>
          <PawsCardBase color={color}>
            {/* 3D Lightning bolt zig-zag */}
            <mesh position={[0.03, 0.13, 0]} rotation={[0, 0, -0.42]}>
              <boxGeometry args={[0.11, 0.28, 0.05]} />
              <meshStandardMaterial
                color="#FEF9C3"
                emissive="#FACC15"
                emissiveIntensity={1.1}
              />
            </mesh>
            <mesh position={[-0.03, -0.11, 0]} rotation={[0, 0, -0.42]}>
              <boxGeometry args={[0.11, 0.28, 0.05]} />
              <meshStandardMaterial
                color="#FEF9C3"
                emissive="#FACC15"
                emissiveIntensity={1.1}
              />
            </mesh>
          </PawsCardBase>
        </group>
      );

    case 'card_boomerang':
      return (
        <group position={[0, bobY, 0]} rotation={[0.16, spinY, 0]}>
          <PawsCardBase color={color}>
            {/* 3D Boomerang V-wing */}
            <mesh position={[-0.07, 0.08, 0]} rotation={[0, 0, 0.55]}>
              <boxGeometry args={[0.28, 0.085, 0.05]} />
              <meshStandardMaterial
                color="#FDE047"
                emissive="#F59E0B"
                emissiveIntensity={0.65}
              />
            </mesh>
            <mesh position={[-0.07, -0.08, 0]} rotation={[0, 0, -0.55]}>
              <boxGeometry args={[0.28, 0.085, 0.05]} />
              <meshStandardMaterial
                color="#FDE047"
                emissive="#F59E0B"
                emissiveIntensity={0.65}
              />
            </mesh>
          </PawsCardBase>
        </group>
      );
  }
}
