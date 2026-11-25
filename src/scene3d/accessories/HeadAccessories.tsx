import { useMemo } from 'react';
import * as THREE from 'three';
import type {
  GlassesAnchor,
  HatAnchor,
  HeadphonesAnchor,
} from '../accessoryAnchors';

const Y_UP = new THREE.Vector3(0, 1, 0);

function CylinderSegment({
  start,
  end,
  radius,
  color,
  roughness = 0.2,
  metalness = 0.85,
}: {
  start: [number, number, number];
  end: [number, number, number];
  radius: number;
  color: string;
  roughness?: number;
  metalness?: number;
}) {
  const { position, quaternion, length } = useMemo(() => {
    const a = new THREE.Vector3(...start);
    const b = new THREE.Vector3(...end);
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = Math.max(0.001, dir.length());
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    const quat = new THREE.Quaternion().setFromUnitVectors(
      Y_UP,
      dir.clone().normalize(),
    );
    return {
      position: [mid.x, mid.y, mid.z] as [number, number, number],
      quaternion: quat,
      length: len,
    };
  }, [start, end]);

  return (
    <mesh position={position} quaternion={quaternion}>
      <cylinderGeometry args={[radius, radius, length, 8]} />
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={metalness}
      />
    </mesh>
  );
}

interface EyewearStyle {
  name: string;
  lensColor: string;
  lensOpacity: number;
  rimColor: string;
  rimTube: number;
  lensScale: [number, number, number];
}

function EyewearMesh({
  anchor,
  style,
}: {
  anchor: GlassesAnchor;
  style: EyewearStyle;
}) {
  const s = anchor.scale;
  const spread = anchor.spread;
  const lensAngleY = anchor.lensAngleY ?? 0;
  const lensBackZ = anchor.lensBackZ ?? 0;
  const bridgeY = anchor.bridgeY ?? 0.035;
  const bridgeZ = anchor.bridgeZ ?? 0.015;
  const templeX = anchor.templeX ?? spread + 0.14 * s;
  const templeLength = anchor.templeLength ?? 0.34;

  const lensRadiusX = 0.116 * style.lensScale[0] * s;
  const cosA = Math.cos(lensAngleY);
  const sinA = Math.sin(lensAngleY);

  return (
    <group name={style.name} position={[0, anchor.y, anchor.z]}>
      {([-1, 1] as const).map((side) => {
        const cx = side * spread;
        const innerRim: [number, number, number] = [
          cx - side * lensRadiusX * cosA * 0.85,
          0.02 * s,
          lensBackZ + lensRadiusX * sinA * 0.85,
        ];
        const outerRim: [number, number, number] = [
          cx + side * lensRadiusX * cosA * 0.92,
          0.015 * s,
          lensBackZ - lensRadiusX * sinA * 0.92,
        ];
        const templeEnd: [number, number, number] = [
          side * templeX,
          0.02 * s,
          lensBackZ - templeLength,
        ];
        const bridgeCenter: [number, number, number] = [0, bridgeY, bridgeZ];

        return (
          <group key={side}>
            <group
              position={[cx, 0, lensBackZ]}
              rotation={[0, side * lensAngleY, 0]}
              scale={s}
            >
              <mesh scale={style.lensScale} castShadow>
                <sphereGeometry args={[0.115, 20, 16]} />
                <meshStandardMaterial
                  color={style.lensColor}
                  roughness={0.08}
                  metalness={0.55}
                  transparent
                  opacity={style.lensOpacity}
                />
              </mesh>
              <mesh scale={[style.lensScale[0], style.lensScale[1], 1]}>
                <torusGeometry args={[0.116, style.rimTube, 10, 24]} />
                <meshStandardMaterial
                  color={style.rimColor}
                  roughness={0.2}
                  metalness={0.85}
                />
              </mesh>
            </group>

            <CylinderSegment
              start={bridgeCenter}
              end={innerRim}
              radius={0.011 * s}
              color={style.rimColor}
            />

            <CylinderSegment
              start={outerRim}
              end={templeEnd}
              radius={0.01 * s}
              color={style.rimColor}
              roughness={0.22}
            />
          </group>
        );
      })}
    </group>
  );
}

export function GlassesMesh({ anchor }: { anchor: GlassesAnchor }) {
  return (
    <EyewearMesh
      anchor={anchor}
      style={{
        name: 'accessory-glasses',
        lensColor: '#0F172A',
        lensOpacity: 0.86,
        rimColor: '#F59E0B',
        rimTube: 0.015,
        lensScale: [1.15, 0.9, 0.35],
      }}
    />
  );
}

export function RoundGlassesMesh({ anchor }: { anchor: GlassesAnchor }) {
  return (
    <EyewearMesh
      anchor={anchor}
      style={{
        name: 'accessory-round-glasses',
        lensColor: '#FEF3C7',
        lensOpacity: 0.3,
        rimColor: '#B45309',
        rimTube: 0.013,
        lensScale: [1.0, 1.0, 0.25],
      }}
    />
  );
}

export function PixelShadesMesh({ anchor }: { anchor: GlassesAnchor }) {
  const s = anchor.scale;
  const spread = anchor.spread;
  const lensAngleY = anchor.lensAngleY ?? 0;
  const lensBackZ = anchor.lensBackZ ?? 0;
  const bridgeY = anchor.bridgeY ?? 0.035;
  const bridgeZ = anchor.bridgeZ ?? 0.015;
  const templeX = anchor.templeX ?? spread + 0.14 * s;
  const templeLength = anchor.templeLength ?? 0.34;
  const cosA = Math.cos(lensAngleY);
  const sinA = Math.sin(lensAngleY);

  return (
    <group name="accessory-pixel-shades" position={[0, anchor.y, anchor.z]}>
      {([-1, 1] as const).map((side) => {
        const cx = side * spread;
        const innerRim: [number, number, number] = [
          cx - side * 0.1 * s * cosA,
          0.03 * s,
          lensBackZ + 0.1 * s * sinA,
        ];
        const outerRim: [number, number, number] = [
          cx + side * 0.12 * s * cosA,
          0.03 * s,
          lensBackZ - 0.12 * s * sinA,
        ];
        const templeEnd: [number, number, number] = [
          side * templeX,
          0.03 * s,
          lensBackZ - templeLength,
        ];

        return (
          <group key={side}>
            <group
              position={[cx, 0, lensBackZ]}
              rotation={[0, side * lensAngleY, 0]}
              scale={s}
            >
              {/* Stepped 8-bit black pixel blocks */}
              <mesh position={[0, 0.025, 0]} castShadow>
                <boxGeometry args={[0.25, 0.075, 0.04]} />
                <meshStandardMaterial color="#09090B" roughness={0.3} />
              </mesh>
              <mesh position={[0, -0.028, 0]} castShadow>
                <boxGeometry args={[0.2, 0.055, 0.04]} />
                <meshStandardMaterial color="#09090B" roughness={0.3} />
              </mesh>
              <mesh position={[0, -0.068, 0]} castShadow>
                <boxGeometry args={[0.13, 0.038, 0.04]} />
                <meshStandardMaterial color="#09090B" roughness={0.3} />
              </mesh>
              {/* Iconic white 8-bit specular glint pixels */}
              <mesh position={[-0.055, 0.025, 0.023]}>
                <boxGeometry args={[0.042, 0.036, 0.01]} />
                <meshBasicMaterial color="#FFFFFF" />
              </mesh>
              <mesh position={[-0.025, -0.012, 0.023]}>
                <boxGeometry args={[0.036, 0.036, 0.01]} />
                <meshBasicMaterial color="#FFFFFF" />
              </mesh>
            </group>

            <CylinderSegment
              start={[0, bridgeY, bridgeZ]}
              end={innerRim}
              radius={0.015 * s}
              color="#09090B"
              metalness={0.2}
              roughness={0.35}
            />
            <CylinderSegment
              start={outerRim}
              end={templeEnd}
              radius={0.014 * s}
              color="#09090B"
              metalness={0.2}
              roughness={0.35}
            />
          </group>
        );
      })}
    </group>
  );
}

export function PartyHatMesh({ anchor }: { anchor: HatAnchor }) {
  return (
    <group
      name="accessory-party-hat"
      position={[anchor.x ?? 0, anchor.y, anchor.z]}
      scale={anchor.scale}
      rotation={[anchor.rotX ?? 0.04, 0, anchor.rotZ ?? -0.06]}
    >
      <mesh position={[0, 0.2, 0]} castShadow>
        <coneGeometry args={[0.24, 0.48, 24]} />
        <meshStandardMaterial color="#EC4899" roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.14, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.17, 0.022, 10, 24]} />
        <meshStandardMaterial color="#38BDF8" roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.28, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.105, 0.018, 10, 24]} />
        <meshStandardMaterial color="#FACC15" roughness={0.45} />
      </mesh>
      <mesh position={[0, -0.03, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.24, 0.042, 12, 24]} />
        <meshStandardMaterial color="#FFFBEB" roughness={0.85} />
      </mesh>
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

export function BeanieMesh({ anchor }: { anchor: HatAnchor }) {
  return (
    <group
      name="accessory-beanie"
      position={[anchor.x ?? 0, anchor.y, anchor.z]}
      scale={anchor.scale}
      rotation={[anchor.rotX ?? 0, 0, anchor.rotZ ?? 0]}
    >
      {/* Knit pine-green beanie dome */}
      <mesh position={[0, 0.05, 0]} castShadow>
        <sphereGeometry args={[0.26, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
        <meshStandardMaterial color="#15803D" roughness={0.88} />
      </mesh>
      {/* Cream folded knit cuff */}
      <mesh position={[0, 0.01, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.245, 0.052, 14, 28]} />
        <meshStandardMaterial color="#FEF3C7" roughness={0.86} />
      </mesh>
      {/* Fluffy white pom-pom on top */}
      <mesh position={[0, 0.33, 0]} castShadow>
        <sphereGeometry args={[0.088, 16, 16]} />
        <meshStandardMaterial color="#FFFDF9" roughness={0.9} />
      </mesh>
    </group>
  );
}

export function HeadphonesMesh({ anchor }: { anchor: HeadphonesAnchor }) {
  const s = anchor.scale ?? 0.9;
  const radiusX = anchor.earSpread;
  const radiusY = anchor.bandHeight;

  return (
    <group
      name="accessory-headphones"
      position={[0, anchor.y, anchor.z]}
    >
      {/* Over-head cushioned headband arc */}
      <mesh scale={[radiusX, radiusY, 0.9]} position={[0, anchor.earY, 0]} castShadow>
        <torusGeometry args={[1.0, 0.045, 12, 32, Math.PI]} />
        <meshStandardMaterial color="#1E293B" roughness={0.45} metalness={0.35} />
      </mesh>

      {/* Left & right RGB cushioned earcups */}
      {([-1, 1] as const).map((side) => (
        <group
          key={side}
          position={[side * radiusX, anchor.earY, 0]}
          scale={s}
        >
          {/* Plush ear cushion */}
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.135, 0.135, 0.09, 20]} />
            <meshStandardMaterial color="#0F172A" roughness={0.7} />
          </mesh>
          {/* Outer metallic shell */}
          <mesh position={[side * 0.045, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.115, 0.13, 0.045, 20]} />
            <meshStandardMaterial color="#334155" metalness={0.65} roughness={0.3} />
          </mesh>
          {/* Glowing cyan LED ring */}
          <mesh position={[side * 0.068, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.085, 0.015, 10, 24]} />
            <meshStandardMaterial
              color="#38BDF8"
              emissive="#0EA5E9"
              emissiveIntensity={1.1}
              roughness={0.2}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function CrownMesh({ anchor }: { anchor: HatAnchor }) {
  const jewelColors = ['#EF4444', '#3B82F6', '#10B981', '#EC4899', '#38BDF8'];
  return (
    <group
      name="accessory-crown"
      position={[anchor.x ?? 0, anchor.y, anchor.z]}
      scale={anchor.scale}
      rotation={[anchor.rotX ?? 0, 0, anchor.rotZ ?? 0]}
    >
      <mesh position={[0, 0.04, 0]} castShadow>
        <cylinderGeometry args={[0.24, 0.21, 0.14, 24, 1, false]} />
        <meshStandardMaterial color="#FACC15" metalness={0.85} roughness={0.18} />
      </mesh>
      <mesh position={[0, -0.025, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.215, 0.022, 10, 28]} />
        <meshStandardMaterial color="#EAB308" metalness={0.88} roughness={0.16} />
      </mesh>
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
