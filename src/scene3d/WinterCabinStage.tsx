import {
  ContactShadows,
  Environment,
  Lightformer,
  Sparkles,
} from '@react-three/drei';

export interface WinterCabinStageProps {
  mode?: 'table' | 'turntable';
}

export function WinterCabinStage({ mode = 'turntable' }: WinterCabinStageProps) {
  return (
    <group>
      {/* Offline Procedural Environment Map for Velvet Plush Sheen & Soft Reflections */}
      <Environment resolution={256} frames={1}>
        {/* Warm cabin ceiling glow */}
        <Lightformer
          form="ring"
          intensity={1.8}
          color="#FFE7C2"
          position={[0, 6, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={10}
        />
        {/* Warm sunset / fireplace side lightformer */}
        <Lightformer
          form="circle"
          intensity={2.4}
          color="#FFB878"
          position={[-6, 3, 4]}
          rotation={[0, Math.PI / 3, 0]}
          scale={6}
        />
        {/* Golden-hour back rim lightformer for fuzzy plush halo */}
        <Lightformer
          form="rect"
          intensity={2.6}
          color="#FFD6A5"
          position={[4, 3.5, -6]}
          rotation={[0, -Math.PI / 5, 0]}
          scale={[10, 5, 1]}
        />
        {/* Cool snowy window fill */}
        <Lightformer
          form="rect"
          intensity={1.5}
          color="#CFE8FF"
          position={[-4, 4, -6]}
          rotation={[0, Math.PI / 6, 0]}
          scale={[8, 4, 1]}
        />
      </Environment>

      {/* Cozy Winter Cabin Lighting */}
      <ambientLight intensity={0.62} color="#FFF4E6" />
      <hemisphereLight args={['#FFF7ED', '#5C3A21', 0.65]} />

      {/* Warm Cabin Overhead Key Light */}
      <directionalLight
        position={[4.5, 7.5, 5]}
        intensity={1.55}
        color="#FFE8CC"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={1}
        shadow-camera-far={22}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-bias={-0.0004}
      />

      {/* Fireplace Warm Amber Accent */}
      <pointLight
        position={[-4.2, 2.6, 2.5]}
        intensity={18}
        distance={14}
        decay={2}
        color="#FF944D"
      />

      {/* Snowy Window Cool Rim Light */}
      <directionalLight
        position={[-3.2, 4.5, -5.5]}
        intensity={0.95}
        color="#BAE6FD"
      />

      {/* Warm Golden-Hour Plush Rim Light (highlights MeshPhysicalMaterial velvet sheen) */}
      <directionalLight
        position={[3.0, 3.6, -5.2]}
        intensity={1.35}
        color="#FFD6A5"
      />

      {/* Stage Surface (top surface always rests at y = 0, no coplanar overlap) */}
      {mode === 'table' ? (
        <group name="winter-cabin-card-table">
          {/* Outer wooden table rim (top at y = -0.02) */}
          <mesh position={[0, -0.16, 0]} receiveShadow castShadow>
            <cylinderGeometry args={[3.95, 4.05, 0.28, 64]} />
            <meshStandardMaterial color="#7F4F24" roughness={0.68} metalness={0.05} />
          </mesh>

          {/* Rounded lip bevel ring */}
          <mesh position={[0, -0.03, 0]} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
            <torusGeometry args={[3.86, 0.11, 16, 64]} />
            <meshStandardMaterial color="#936639" roughness={0.58} metalness={0.06} />
          </mesh>

          {/* Cozy forest-green felt tabletop (top cleanly at y = 0.000) */}
          <mesh position={[0, -0.01, 0]} receiveShadow>
            <cylinderGeometry args={[3.76, 3.76, 0.02, 64]} />
            <meshStandardMaterial color="#2D6A4F" roughness={0.92} metalness={0.0} />
          </mesh>

          {/* Subtle golden inlay ring on felt */}
          <mesh position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[2.45, 2.5, 64]} />
            <meshStandardMaterial
              color="#EAB308"
              roughness={0.45}
              metalness={0.3}
              transparent
              opacity={0.45}
            />
          </mesh>

          {/* Sturdy cabin pedestal base under table */}
          <mesh position={[0, -1.25, 0]} receiveShadow>
            <cylinderGeometry args={[0.75, 1.35, 2.0, 24]} />
            <meshStandardMaterial color="#582F0E" roughness={0.78} />
          </mesh>
        </group>
      ) : (
        <group name="winter-cabin-turntable-pedestal">
          {/* Main wooden display pedestal (top at y = -0.015) */}
          <mesh position={[0, -0.165, 0]} receiveShadow castShadow>
            <cylinderGeometry args={[1.45, 1.62, 0.3, 48]} />
            <meshStandardMaterial color="#8D5B34" roughness={0.62} metalness={0.05} />
          </mesh>

          {/* Warm cream felt inlay disc (top cleanly at y = 0.000) */}
          <mesh position={[0, -0.007, 0]} receiveShadow>
            <cylinderGeometry args={[1.28, 1.28, 0.014, 48]} />
            <meshStandardMaterial color="#F5EBE0" roughness={0.88} />
          </mesh>

          {/* Decorative brass trim ring */}
          <mesh position={[0, -0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.36, 0.028, 12, 48]} />
            <meshStandardMaterial color="#D97706" roughness={0.35} metalness={0.45} />
          </mesh>

          {/* Lower stepped plinth */}
          <mesh position={[0, -0.415, 0]} receiveShadow>
            <cylinderGeometry args={[1.72, 1.82, 0.22, 48]} />
            <meshStandardMaterial color="#6B4226" roughness={0.75} />
          </mesh>
        </group>
      )}

      {/* Soft Ground Contact Shadows (baked once for 60fps performance) */}
      <ContactShadows
        position={[0, 0.007, 0]}
        frames={1}
        resolution={256}
        opacity={0.42}
        scale={mode === 'table' ? 10 : 5}
        blur={2.1}
        far={4}
        color="#3B2314"
      />

      {/* Subtle Floating Winter Cabin Snow/Dust Sparkles */}
      <Sparkles
        count={28}
        scale={mode === 'table' ? [10, 5.5, 10] : [6, 4.5, 6]}
        position={[0, 2.2, 0]}
        size={2.4}
        speed={0.32}
        opacity={0.48}
        color="#FFF7ED"
      />
    </group>
  );
}
