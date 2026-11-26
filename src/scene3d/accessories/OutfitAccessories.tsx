import * as THREE from 'three';
import type { OutfitAnchor } from '../accessoryAnchors';
import {
  computeJerseyChestMount,
  getCurvedBadgeGeometry,
  getMuCrestTexture,
  getMuKitMarkTexture,
} from './muCrestGeometry';

let cachedShirtShellGeo: THREE.LatheGeometry | null = null;

/**
 * Closed thick-walled pear torso shell normalized around y in [-0.44, +0.46]
 * and max outer radius ~1.06 so outfits hug plush bellies cleanly without Z-fighting.
 */
function getShirtShellGeometry(): THREE.LatheGeometry {
  if (cachedShirtShellGeo) return cachedShirtShellGeo;

  const outerPts: Array<[number, number]> = [
    [0.98, -0.44],
    [1.05, -0.26],
    [1.06, -0.05],
    [1.02, 0.14],
    [0.94, 0.3],
    [0.84, 0.41],
    [0.74, 0.46],
  ];
  const innerPts: Array<[number, number]> = [
    [0.7, 0.46],
    [0.8, 0.41],
    [0.9, 0.3],
    [0.98, 0.14],
    [1.02, -0.05],
    [1.01, -0.26],
    [0.94, -0.44],
    [0.98, -0.44],
  ];

  const allPts = [...outerPts, ...innerPts].map(
    ([r, y]) => new THREE.Vector2(r, y),
  );
  const geo = new THREE.LatheGeometry(allPts, 36);
  geo.computeVertexNormals();
  cachedShirtShellGeo = geo;
  return geo;
}

function ShoulderSleeveCap({
  side,
  anchor,
  sleeveColor,
  cuffColor,
  stripeColor,
}: {
  side: -1 | 1;
  anchor: OutfitAnchor;
  sleeveColor: string;
  cuffColor: string;
  stripeColor?: string;
}) {
  return (
    <group
      position={[side * anchor.shoulderX, anchor.shoulderY, anchor.shoulderZ]}
      rotation={[0.08, 0, side * 0.42]}
    >
      <mesh position={[0, -0.03, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.145, 0.16, 18, 1, true]} />
        <meshStandardMaterial
          color={sleeveColor}
          roughness={0.78}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, -0.105, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.14, 0.018, 10, 20]} />
        <meshStandardMaterial color={cuffColor} roughness={0.65} />
      </mesh>
      {stripeColor &&
        ([-0.032, 0, 0.032] as const).map((zOff) => (
          <mesh
            key={zOff}
            position={[side * 0.133, -0.025, zOff]}
            rotation={[0, 0, -side * 0.15]}
          >
            <boxGeometry args={[0.012, 0.145, 0.014]} />
            <meshStandardMaterial color={stripeColor} roughness={0.55} />
          </mesh>
        ))}
    </group>
  );
}

export function MuJerseyMesh({ anchor }: { anchor: OutfitAnchor }) {
  const shellGeo = getShirtShellGeometry();
  const [sx, sy, sz] = anchor.scale;
  const backZ = anchor.z - 1.068 * sz;

  const crestMount = computeJerseyChestMount(anchor, 1, 0.155, 0.018);
  const crestGeo = getCurvedBadgeGeometry(0.185, 0.195, 0.95);
  const crestTex = getMuCrestTexture();

  const kitMarkMount = computeJerseyChestMount(anchor, -1, 0.165, 0.017);
  const kitMarkGeo = getCurvedBadgeGeometry(0.115, 0.115, 0.95);
  const kitMarkTex = getMuKitMarkTexture();

  return (
    <group name="accessory-mu-jersey">
      {/* Main Manchester United crimson jersey shell */}
      <mesh
        geometry={shellGeo}
        position={[0, anchor.y, anchor.z]}
        scale={[sx, sy, sz]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#DA291C" roughness={0.76} />
      </mesh>

      {/* Crisp white ribbed V-neck collar trim */}
      <mesh
        position={[0, anchor.y + 0.45 * sy, anchor.z]}
        rotation={[Math.PI / 2 + 0.1, 0, 0]}
        scale={[0.75 * sx, 0.75 * sz, 1]}
      >
        <torusGeometry args={[1.0, 0.045, 12, 32]} />
        <meshStandardMaterial color="#F8FAFC" roughness={0.7} />
      </mesh>
      {/* Black inner collar piping */}
      <mesh
        position={[0, anchor.y + 0.465 * sy, anchor.z]}
        rotation={[Math.PI / 2 + 0.1, 0, 0]}
        scale={[0.73 * sx, 0.73 * sz, 1]}
      >
        <torusGeometry args={[1.0, 0.022, 10, 32]} />
        <meshStandardMaterial color="#111827" roughness={0.65} />
      </mesh>

      {/* White bottom hem stripe */}
      <mesh
        position={[0, anchor.y - 0.43 * sy, anchor.z]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[0.98 * sx, 0.98 * sz, 1]}
      >
        <torusGeometry args={[1.0, 0.026, 10, 32]} />
        <meshStandardMaterial color="#F8FAFC" roughness={0.7} />
      </mesh>

      {/* Short red-and-white shoulder sleeve cuffs with 3 athletic stripes */}
      {([-1, 1] as const).map((side) => (
        <ShoulderSleeveCap
          key={side}
          side={side}
          anchor={anchor}
          sleeveColor="#DA291C"
          cuffColor="#F8FAFC"
          stripeColor="#F8FAFC"
        />
      ))}

      {/* Front-left curved Manchester United club crest badge */}
      {crestTex && (
        <mesh
          name="mu-jersey-club-crest"
          geometry={crestGeo}
          position={crestMount.position}
          rotation={crestMount.rotation}
        >
          <meshStandardMaterial
            map={crestTex}
            transparent
            alphaTest={0.18}
            roughness={0.34}
            metalness={0.12}
            polygonOffset
            polygonOffsetFactor={-1}
          />
        </mesh>
      )}

      {/* Front-right curved 3-bar white athletic kit emblem */}
      {kitMarkTex && (
        <mesh
          name="mu-jersey-kit-mark"
          geometry={kitMarkGeo}
          position={kitMarkMount.position}
          rotation={kitMarkMount.rotation}
        >
          <meshStandardMaterial
            map={kitMarkTex}
            transparent
            alphaTest={0.18}
            roughness={0.45}
            metalness={0.05}
            polygonOffset
            polygonOffsetFactor={-1}
          />
        </mesh>
      )}

      {/* Iconic #7 white numeral accent on upper-mid back of jersey */}
      <group
        position={[0, anchor.y + 0.095 * sy, backZ + 0.008]}
        rotation={[0, Math.PI, 0]}
      >
        <group rotation={[-0.14, 0, 0]}>
          <mesh position={[0, 0.065, 0]}>
            <boxGeometry args={[0.125, 0.03, 0.022]} />
            <meshStandardMaterial color="#F8FAFC" roughness={0.55} />
          </mesh>
          <mesh position={[0.015, -0.008, 0]} rotation={[0, 0, -0.32]}>
            <boxGeometry args={[0.032, 0.16, 0.022]} />
            <meshStandardMaterial color="#F8FAFC" roughness={0.55} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

export function CozyHoodieMesh({ anchor }: { anchor: OutfitAnchor }) {
  const shellGeo = getShirtShellGeometry();
  const [sx, sy, sz] = anchor.scale;
  const frontZ = anchor.z + 1.03 * sz;
  const chestZ = anchor.z + 0.91 * sz;
  const backZ = anchor.z - 0.85 * sz;

  return (
    <group name="accessory-cozy-hoodie">
      {/* Main warm slate-navy plush hoodie shell */}
      <mesh
        geometry={shellGeo}
        position={[0, anchor.y, anchor.z]}
        scale={[sx, sy, sz]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#1E3A5F" roughness={0.88} />
      </mesh>

      {/* Ribbed cream waist cuff */}
      <mesh
        position={[0, anchor.y - 0.43 * sy, anchor.z]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[0.98 * sx, 0.98 * sz, 1]}
      >
        <torusGeometry args={[1.0, 0.03, 10, 32]} />
        <meshStandardMaterial color="#F1F5F9" roughness={0.85} />
      </mesh>

      {/* Short navy-and-cream shoulder sleeves */}
      {([-1, 1] as const).map((side) => (
        <ShoulderSleeveCap
          key={side}
          side={side}
          anchor={anchor}
          sleeveColor="#1E3A5F"
          cuffColor="#F1F5F9"
        />
      ))}

      {/* Front cream kangaroo pocket */}
      <mesh
        position={[0, anchor.y - 0.15 * sy, frontZ]}
        rotation={[0.05, 0, 0]}
        castShadow
      >
        <boxGeometry args={[0.32, 0.16, 0.045]} />
        <meshStandardMaterial color="#E2E8F0" roughness={0.85} />
      </mesh>

      {/* Twin cream hoodie drawstrings hanging at chest */}
      {([-1, 1] as const).map((side) => (
        <group
          key={side}
          position={[side * 0.055, anchor.y + 0.25 * sy, chestZ + 0.03]}
          rotation={[-0.22, 0, side * 0.06]}
        >
          <mesh>
            <capsuleGeometry args={[0.012, 0.11, 6, 10]} />
            <meshStandardMaterial color="#F8FAFC" roughness={0.75} />
          </mesh>
          <mesh position={[0, -0.068, 0]}>
            <sphereGeometry args={[0.018, 10, 10]} />
            <meshStandardMaterial color="#F59E0B" roughness={0.4} />
          </mesh>
        </group>
      ))}

      {/* Folded plush hood resting around back of shoulders */}
      <mesh
        position={[0, anchor.y + 0.39 * sy, backZ]}
        rotation={[-0.45, 0, 0]}
        scale={[0.28, 0.16, 0.18]}
        castShadow
      >
        <sphereGeometry args={[1, 20, 16]} />
        <meshStandardMaterial color="#172E4D" roughness={0.9} />
      </mesh>
    </group>
  );
}
