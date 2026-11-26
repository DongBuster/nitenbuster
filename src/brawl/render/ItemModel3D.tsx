import * as THREE from 'three';
import type { HeldWeaponKind, ItemKind } from '../sim/types';

interface ItemModel3DProps {
  kind: ItemKind;
  nowSec: number;
  color: string;
}

interface CachedItemGeometries {
  swordBlade: THREE.ExtrudeGeometry;
  swordGuard: THREE.ExtrudeGeometry;
  shovelBlade: THREE.ExtrudeGeometry;
  shovelGrip: THREE.TorusGeometry;
  shieldDome: THREE.LatheGeometry;
  shieldStar: THREE.ExtrudeGeometry;
  bombFuse: THREE.TubeGeometry;
  skateBoot: THREE.ExtrudeGeometry;
  skateBlade: THREE.ExtrudeGeometry;
  cardOuter: THREE.ExtrudeGeometry;
  cardInner: THREE.ExtrudeGeometry;
  lightningBolt: THREE.ExtrudeGeometry;
}

let cachedGeos: CachedItemGeometries | null = null;

function createRoundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const hw = w / 2;
  const hh = h / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-hw + r, -hh);
  shape.lineTo(hw - r, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
  shape.lineTo(hw, hh - r);
  shape.quadraticCurveTo(hw, hh, hw - r, hh);
  shape.lineTo(-hw + r, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
  shape.lineTo(-hw, -hh + r);
  shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  return shape;
}

function getItemGeometries(): CachedItemGeometries {
  if (cachedGeos) return cachedGeos;

  // 1. Ice Sword blade (tapered beveled double-edge + sharp diamond tip)
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(-0.085, 0);
  bladeShape.lineTo(0.085, 0);
  bladeShape.lineTo(0.068, 0.72);
  bladeShape.lineTo(0, 0.94);
  bladeShape.lineTo(-0.068, 0.72);
  bladeShape.closePath();
  const swordBlade = new THREE.ExtrudeGeometry(bladeShape, {
    depth: 0.022,
    bevelEnabled: true,
    bevelThickness: 0.018,
    bevelSize: 0.016,
    bevelSegments: 2,
  });
  swordBlade.translate(0, 0, -0.011);
  swordBlade.computeVertexNormals();

  // 2. Sword curved crossguard
  const guardShape = new THREE.Shape();
  guardShape.moveTo(-0.24, -0.02);
  guardShape.quadraticCurveTo(0, 0.06, 0.24, -0.02);
  guardShape.lineTo(0.21, 0.075);
  guardShape.quadraticCurveTo(0, 0.13, -0.21, 0.075);
  guardShape.closePath();
  const swordGuard = new THREE.ExtrudeGeometry(guardShape, {
    depth: 0.055,
    bevelEnabled: true,
    bevelThickness: 0.014,
    bevelSize: 0.012,
    bevelSegments: 2,
  });
  swordGuard.translate(0, 0, -0.0275);
  swordGuard.computeVertexNormals();

  // 3. Snow Shovel rounded scoop blade
  const scoopShape = new THREE.Shape();
  scoopShape.moveTo(-0.18, 0.22);
  scoopShape.quadraticCurveTo(0, 0.26, 0.18, 0.22);
  scoopShape.lineTo(0.22, -0.12);
  scoopShape.quadraticCurveTo(0.21, -0.24, 0, -0.26);
  scoopShape.quadraticCurveTo(-0.21, -0.24, -0.22, -0.12);
  scoopShape.closePath();
  const shovelBlade = new THREE.ExtrudeGeometry(scoopShape, {
    depth: 0.032,
    bevelEnabled: true,
    bevelThickness: 0.016,
    bevelSize: 0.014,
    bevelSegments: 3,
  });
  shovelBlade.translate(0, 0, -0.016);
  shovelBlade.computeVertexNormals();

  const shovelGrip = new THREE.TorusGeometry(0.11, 0.032, 8, 16, Math.PI * 1.45);

  // 4. Domed buckler shield (LatheGeometry)
  const shieldPoints = [
    new THREE.Vector2(0.0, 0.13),
    new THREE.Vector2(0.16, 0.11),
    new THREE.Vector2(0.32, 0.065),
    new THREE.Vector2(0.43, 0.015),
    new THREE.Vector2(0.45, -0.02),
    new THREE.Vector2(0.39, -0.035),
    new THREE.Vector2(0.0, -0.02),
  ];
  const shieldDome = new THREE.LatheGeometry(shieldPoints, 24);
  shieldDome.rotateX(Math.PI / 2);
  shieldDome.computeVertexNormals();

  // Shield 5-point star boss
  const starShape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI) / 5 + Math.PI / 2;
    const r = i % 2 === 0 ? 0.16 : 0.072;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) starShape.moveTo(x, y);
    else starShape.lineTo(x, y);
  }
  starShape.closePath();
  const shieldStar = new THREE.ExtrudeGeometry(starShape, {
    depth: 0.03,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.008,
    bevelSegments: 2,
  });
  shieldStar.computeVertexNormals();

  // 5. Curved bomb fuse (TubeGeometry)
  const fuseCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.34, 0),
    new THREE.Vector3(0.04, 0.45, 0.02),
    new THREE.Vector3(0.12, 0.54, 0.01),
    new THREE.Vector3(0.17, 0.58, -0.02),
  ]);
  const bombFuse = new THREE.TubeGeometry(fuseCurve, 12, 0.028, 7, false);

  // 6. Sculpted Ice Skate boot + curved runner blade
  const bootShape = new THREE.Shape();
  bootShape.moveTo(-0.22, -0.1);
  bootShape.lineTo(0.24, -0.1);
  bootShape.quadraticCurveTo(0.35, -0.09, 0.35, 0.0);
  bootShape.quadraticCurveTo(0.34, 0.09, 0.18, 0.1);
  bootShape.lineTo(0.06, 0.15);
  bootShape.lineTo(0.03, 0.34);
  bootShape.lineTo(-0.2, 0.34);
  bootShape.quadraticCurveTo(-0.25, 0.12, -0.22, -0.1);
  const skateBoot = new THREE.ExtrudeGeometry(bootShape, {
    depth: 0.18,
    bevelEnabled: true,
    bevelThickness: 0.035,
    bevelSize: 0.025,
    bevelSegments: 3,
  });
  skateBoot.translate(0, 0, -0.09);
  skateBoot.computeVertexNormals();

  const runnerShape = new THREE.Shape();
  runnerShape.moveTo(-0.26, -0.22);
  runnerShape.lineTo(0.29, -0.22);
  runnerShape.quadraticCurveTo(0.41, -0.21, 0.44, -0.11);
  runnerShape.lineTo(0.39, -0.1);
  runnerShape.quadraticCurveTo(0.36, -0.16, 0.27, -0.165);
  runnerShape.lineTo(-0.26, -0.165);
  runnerShape.closePath();
  const skateBlade = new THREE.ExtrudeGeometry(runnerShape, {
    depth: 0.028,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.006,
    bevelSegments: 2,
  });
  skateBlade.translate(0, 0, -0.014);
  skateBlade.computeVertexNormals();

  // 7. Rounded beveled PAWS card shells
  const cardOuter = new THREE.ExtrudeGeometry(createRoundedRectShape(0.62, 0.86, 0.09), {
    depth: 0.045,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.014,
    bevelSegments: 3,
  });
  cardOuter.translate(0, 0, -0.0225);
  cardOuter.computeVertexNormals();

  const cardInner = new THREE.ExtrudeGeometry(createRoundedRectShape(0.51, 0.75, 0.065), {
    depth: 0.056,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.008,
    bevelSegments: 2,
  });
  cardInner.translate(0, 0, -0.028);
  cardInner.computeVertexNormals();

  // 8. Tapered 3D lightning bolt emblem
  const boltShape = new THREE.Shape();
  boltShape.moveTo(0.05, 0.26);
  boltShape.lineTo(-0.14, 0.01);
  boltShape.lineTo(-0.01, 0.01);
  boltShape.lineTo(-0.07, -0.26);
  boltShape.lineTo(0.14, -0.01);
  boltShape.lineTo(0.01, -0.01);
  boltShape.closePath();
  const lightningBolt = new THREE.ExtrudeGeometry(boltShape, {
    depth: 0.036,
    bevelEnabled: true,
    bevelThickness: 0.009,
    bevelSize: 0.007,
    bevelSegments: 2,
  });
  lightningBolt.translate(0, 0, -0.018);
  lightningBolt.computeVertexNormals();

  cachedGeos = {
    swordBlade,
    swordGuard,
    shovelBlade,
    shovelGrip,
    shieldDome,
    shieldStar,
    bombFuse,
    skateBoot,
    skateBlade,
    cardOuter,
    cardInner,
    lightningBolt,
  };
  return cachedGeos;
}

function SwordMesh() {
  const g = getItemGeometries();
  return (
    <group>
      {/* Ice-steel beveled blade */}
      <mesh geometry={g.swordBlade} position={[0, 0.04, 0]} castShadow>
        <meshStandardMaterial
          color="#E0F2FE"
          emissive="#38BDF8"
          emissiveIntensity={0.35}
          metalness={0.78}
          roughness={0.18}
        />
      </mesh>
      {/* Glowing fuller core stripe */}
      <mesh position={[0, 0.42, 0]}>
        <boxGeometry args={[0.026, 0.62, 0.062]} />
        <meshStandardMaterial
          color="#7DD3FC"
          emissive="#0EA5E9"
          emissiveIntensity={0.85}
          roughness={0.2}
        />
      </mesh>
      {/* Golden winged crossguard */}
      <mesh geometry={g.swordGuard} position={[0, -0.01, 0]} castShadow>
        <meshStandardMaterial
          color="#F59E0B"
          metalness={0.68}
          roughness={0.25}
        />
      </mesh>
      {/* Leather-wrapped grip */}
      <mesh position={[0, -0.19, 0]} castShadow>
        <cylinderGeometry args={[0.042, 0.048, 0.3, 10]} />
        <meshStandardMaterial color="#78350F" roughness={0.78} />
      </mesh>
      {/* Pommel gem */}
      <mesh position={[0, -0.37, 0]} castShadow>
        <octahedronGeometry args={[0.072]} />
        <meshStandardMaterial
          color="#38BDF8"
          emissive="#0284C7"
          emissiveIntensity={0.65}
          metalness={0.4}
          roughness={0.2}
        />
      </mesh>
    </group>
  );
}

function ShovelMesh() {
  const g = getItemGeometries();
  return (
    <group>
      {/* Wooden shaft */}
      <mesh position={[0, 0.08, 0]} castShadow>
        <cylinderGeometry args={[0.044, 0.048, 0.92, 10]} />
        <meshStandardMaterial color="#B45309" roughness={0.65} />
      </mesh>
      {/* Steel collar joining shaft & blade */}
      <mesh position={[0, -0.34, 0]} castShadow>
        <cylinderGeometry args={[0.062, 0.072, 0.14, 10]} />
        <meshStandardMaterial color="#64748B" metalness={0.65} roughness={0.35} />
      </mesh>
      {/* Rounded D-grip handle */}
      <mesh
        geometry={g.shovelGrip}
        position={[0, 0.59, 0]}
        rotation={[0, 0, -Math.PI * 0.22]}
        castShadow
      >
        <meshStandardMaterial color="#F59E0B" roughness={0.4} metalness={0.25} />
      </mesh>
      {/* Sculpted curved snow shovel blade */}
      <mesh
        geometry={g.shovelBlade}
        position={[0, -0.54, 0.025]}
        rotation={[0.16, 0, 0]}
        castShadow
      >
        <meshStandardMaterial
          color="#CBD5E1"
          metalness={0.72}
          roughness={0.25}
        />
      </mesh>
      {/* Reinforced golden tip strip */}
      <mesh position={[0, -0.76, 0.06]} rotation={[0.16, 0, 0]}>
        <boxGeometry args={[0.3, 0.065, 0.062]} />
        <meshStandardMaterial
          color="#F59E0B"
          emissive="#F59E0B"
          emissiveIntensity={0.35}
          metalness={0.55}
          roughness={0.28}
        />
      </mesh>
    </group>
  );
}

function CandyBombMesh({ nowSec }: { nowSec: number }) {
  const g = getItemGeometries();
  const sparkPulse = 0.8 + Math.sin(nowSec * 18) * 0.35;
  return (
    <group>
      {/* Glossy crimson bomb sphere */}
      <mesh castShadow>
        <sphereGeometry args={[0.33, 18, 16]} />
        <meshStandardMaterial
          color="#F43F5E"
          emissive="#BE123C"
          emissiveIntensity={0.32}
          roughness={0.24}
          metalness={0.15}
        />
      </mesh>
      {/* Criss-cross candy cane stripes */}
      <mesh rotation={[Math.PI / 2, 0.35, 0]}>
        <torusGeometry args={[0.315, 0.042, 8, 22]} />
        <meshStandardMaterial color="#FFF1F2" roughness={0.32} />
      </mesh>
      <mesh rotation={[Math.PI / 2, -0.35, 0]}>
        <torusGeometry args={[0.315, 0.036, 8, 22]} />
        <meshStandardMaterial color="#FDA4AF" roughness={0.32} />
      </mesh>
      {/* Iron fuse cap */}
      <mesh position={[0, 0.32, 0]} castShadow>
        <cylinderGeometry args={[0.105, 0.13, 0.1, 12]} />
        <meshStandardMaterial color="#1E293B" metalness={0.6} roughness={0.35} />
      </mesh>
      {/* Organic curved fuse rope */}
      <mesh geometry={g.bombFuse}>
        <meshStandardMaterial color="#FDE68A" roughness={0.82} />
      </mesh>
      {/* Pulsing star spark */}
      <mesh position={[0.17, 0.59, -0.02]} scale={sparkPulse}>
        <octahedronGeometry args={[0.095]} />
        <meshStandardMaterial
          color="#FEF08A"
          emissive="#F59E0B"
          emissiveIntensity={1.7}
        />
      </mesh>
    </group>
  );
}

function PawsCardBase({
  color,
  children,
}: {
  color: string;
  children: React.ReactNode;
}) {
  const g = getItemGeometries();
  return (
    <group>
      {/* Rounded beveled white frame */}
      <mesh geometry={g.cardOuter} castShadow>
        <meshStandardMaterial color="#F8FAFC" roughness={0.25} metalness={0.12} />
      </mesh>
      {/* Colored inner card panel */}
      <mesh geometry={g.cardInner}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.38}
          roughness={0.22}
        />
      </mesh>
      {/* Raised 3D emblem on both front & back */}
      <group position={[0, 0, 0.048]}>{children}</group>
      <group position={[0, 0, -0.048]} rotation={[0, Math.PI, 0]}>
        {children}
      </group>
    </group>
  );
}

/**
 * Shared sculpted held weapon mesh mounted in a fighter's hand.
 */
export function HeldWeapon3D({
  kind,
  nowSec,
}: {
  kind: Exclude<HeldWeaponKind, null>;
  nowSec: number;
}) {
  switch (kind) {
    case 'sword':
      return (
        <group scale={1.15}>
          <SwordMesh />
        </group>
      );
    case 'shovel':
      return (
        <group rotation={[Math.PI, 0, 0]} scale={1.08}>
          <ShovelMesh />
        </group>
      );
    case 'snowball':
      return (
        <mesh castShadow>
          <sphereGeometry args={[0.29, 16, 14]} />
          <meshStandardMaterial
            color="#E0F2FE"
            emissive="#38BDF8"
            emissiveIntensity={0.2}
            roughness={0.38}
          />
        </mesh>
      );
    case 'candy_bomb':
      return (
        <group scale={0.92}>
          <CandyBombMesh nowSec={nowSec} />
        </group>
      );
  }
}

export function ItemModel3D({ kind, nowSec, color }: ItemModel3DProps) {
  const g = getItemGeometries();
  const spinY = nowSec * 1.6;
  const bobY = Math.sin(nowSec * 3.4) * 0.075;

  switch (kind) {
    case 'snowball':
      return (
        <group position={[0, bobY, 0]} rotation={[0.15, spinY, 0]}>
          <mesh position={[-0.08, -0.05, 0]} castShadow>
            <sphereGeometry args={[0.31, 16, 14]} />
            <meshStandardMaterial
              color="#E0F2FE"
              emissive="#38BDF8"
              emissiveIntensity={0.22}
              roughness={0.38}
            />
          </mesh>
          <mesh position={[0.24, -0.1, 0.12]} castShadow>
            <sphereGeometry args={[0.21, 14, 12]} />
            <meshStandardMaterial color="#F0F9FF" roughness={0.35} />
          </mesh>
          <mesh position={[0.1, 0.21, -0.06]} castShadow>
            <sphereGeometry args={[0.19, 14, 12]} />
            <meshStandardMaterial color="#BAE6FD" roughness={0.32} />
          </mesh>
          {/* Orbiting frost sparkles */}
          <mesh position={[-0.36, 0.24, 0.16]} rotation={[0.4, nowSec * 2, 0.4]}>
            <octahedronGeometry args={[0.07]} />
            <meshStandardMaterial
              color="#E0F2FE"
              emissive="#38BDF8"
              emissiveIntensity={1.1}
            />
          </mesh>
        </group>
      );

    case 'sword':
      return (
        <group position={[0, bobY + 0.05, 0]} rotation={[0.22, spinY, -0.38]}>
          <SwordMesh />
        </group>
      );

    case 'shovel':
      return (
        <group position={[0, bobY + 0.06, 0]} rotation={[0.26, spinY, -0.4]}>
          <ShovelMesh />
        </group>
      );

    case 'skates':
      return (
        <group position={[0, bobY, 0]} rotation={[0.14, spinY, 0.08]}>
          <mesh geometry={g.skateBoot} castShadow>
            <meshStandardMaterial color="#06B6D4" roughness={0.34} />
          </mesh>
          {/* Fluffy white ankle collar */}
          <mesh position={[-0.085, 0.34, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.115, 0.048, 8, 16]} />
            <meshStandardMaterial color="#F8FAFC" roughness={0.72} />
          </mesh>
          {/* White lace straps */}
          {[0.08, 0.16, 0.24].map((y, idx) => (
            <mesh key={idx} position={[0.05, y, 0]}>
              <boxGeometry args={[0.09, 0.025, 0.23]} />
              <meshStandardMaterial color="#F8FAFC" roughness={0.5} />
            </mesh>
          ))}
          {/* Blade struts */}
          <mesh position={[-0.14, -0.14, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 0.09, 8]} />
            <meshStandardMaterial color="#94A3B8" metalness={0.75} roughness={0.25} />
          </mesh>
          <mesh position={[0.18, -0.14, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 0.09, 8]} />
            <meshStandardMaterial color="#94A3B8" metalness={0.75} roughness={0.25} />
          </mesh>
          {/* Sculpted steel ice runner */}
          <mesh geometry={g.skateBlade} castShadow>
            <meshStandardMaterial
              color="#E2E8F0"
              metalness={0.9}
              roughness={0.14}
            />
          </mesh>
        </group>
      );

    case 'shield':
      return (
        <group position={[0, bobY, 0]} rotation={[0.18, spinY, 0]}>
          <mesh geometry={g.shieldDome} castShadow>
            <meshStandardMaterial
              color="#F59E0B"
              metalness={0.62}
              roughness={0.24}
            />
          </mesh>
          {/* Polished metallic rim */}
          <mesh position={[0, 0, 0.01]}>
            <torusGeometry args={[0.43, 0.05, 10, 26]} />
            <meshStandardMaterial
              color="#FEF08A"
              emissive="#F59E0B"
              emissiveIntensity={0.28}
              metalness={0.75}
              roughness={0.18}
            />
          </mesh>
          {/* Raised star boss on front & back */}
          <mesh geometry={g.shieldStar} position={[0, 0, 0.1]} castShadow>
            <meshStandardMaterial
              color="#F8FAFC"
              emissive="#FEF08A"
              emissiveIntensity={0.25}
              metalness={0.72}
              roughness={0.2}
            />
          </mesh>
          <mesh
            geometry={g.shieldStar}
            position={[0, 0, -0.055]}
            rotation={[0, Math.PI, 0]}
          >
            <meshStandardMaterial color="#E2E8F0" metalness={0.7} roughness={0.25} />
          </mesh>
        </group>
      );

    case 'candy_bomb':
      return (
        <group position={[0, bobY, 0]} rotation={[0.12, spinY, 0.1]}>
          <CandyBombMesh nowSec={nowSec} />
        </group>
      );

    case 'card_freeze':
      return (
        <group position={[0, bobY, 0]} rotation={[0.16, spinY, 0]}>
          <PawsCardBase color={color}>
            {[0, Math.PI / 3, (Math.PI * 2) / 3].map((rot, idx) => (
              <group key={idx} rotation={[0, 0, rot]}>
                <mesh>
                  <boxGeometry args={[0.38, 0.062, 0.04]} />
                  <meshStandardMaterial
                    color="#E0F2FE"
                    emissive="#38BDF8"
                    emissiveIntensity={0.9}
                    roughness={0.15}
                  />
                </mesh>
                <mesh position={[0.14, 0, 0]} rotation={[0, 0, Math.PI / 4]}>
                  <boxGeometry args={[0.09, 0.04, 0.036]} />
                  <meshStandardMaterial
                    color="#F0F9FF"
                    emissive="#7DD3FC"
                    emissiveIntensity={0.8}
                  />
                </mesh>
                <mesh position={[-0.14, 0, 0]} rotation={[0, 0, Math.PI / 4]}>
                  <boxGeometry args={[0.09, 0.04, 0.036]} />
                  <meshStandardMaterial
                    color="#F0F9FF"
                    emissive="#7DD3FC"
                    emissiveIntensity={0.8}
                  />
                </mesh>
              </group>
            ))}
          </PawsCardBase>
        </group>
      );

    case 'card_taser':
      return (
        <group position={[0, bobY, 0]} rotation={[0.16, spinY, 0]}>
          <PawsCardBase color={color}>
            <mesh geometry={g.lightningBolt}>
              <meshStandardMaterial
                color="#FEF9C3"
                emissive="#FACC15"
                emissiveIntensity={1.2}
                roughness={0.18}
              />
            </mesh>
          </PawsCardBase>
        </group>
      );
  }
}
