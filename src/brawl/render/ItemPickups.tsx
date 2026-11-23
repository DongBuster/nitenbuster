import { useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { ITEM_META } from '../sim/combat';
import type {
  HitEffect,
  KnockoutPopup,
  Projectile,
  WorldItem,
} from '../sim/types';
import { ItemModel3D } from './ItemModel3D';
import type { BrawlWorldRuntime } from './worldRuntime';

export function ItemPickups({ runtime }: { runtime: BrawlWorldRuntime }) {
  const [items, setItems] = useState<WorldItem[]>([]);
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const [effects, setEffects] = useState<HitEffect[]>([]);
  const [popups, setPopups] = useState<KnockoutPopup[]>([]);
  const lastSyncRef = useRef<number>(0);

  useFrame(({ clock }) => {
    // Sync every ~2 frames (30Hz) for crisp projectile & parachute positions
    if (clock.elapsedTime - lastSyncRef.current < 0.03) return;
    lastSyncRef.current = clock.elapsedTime;

    setItems(runtime.items.map((item) => ({ ...item })));
    setProjectiles(runtime.projectiles.map((p) => ({ ...p })));
    setEffects([...runtime.hitEffects]);
    setPopups([...runtime.koPopups]);
  });

  return (
    <group>
      {/* Parachuting / Grounded Items & PAWS Cards */}
      {items.map((item) => {
        const meta = ITEM_META[item.kind];
        const parachuting = item.y > 1.05;
        return (
          <group key={item.id} position={[item.x, item.y, item.z]}>
            {/* Parachute canopy + cords while falling */}
            {parachuting && (
              <group position={[0, 1.2, 0]}>
                <mesh>
                  <sphereGeometry args={[0.64, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
                  <meshStandardMaterial color={meta.color} roughness={0.5} side={2} />
                </mesh>
                {[
                  [0.24, -0.45, 0.24, -0.32, 0.32],
                  [-0.24, -0.45, 0.24, -0.32, -0.32],
                  [0.24, -0.45, -0.24, 0.32, 0.32],
                  [-0.24, -0.45, -0.24, 0.32, -0.32],
                ].map(([cx, cy, cz, rx, rz], idx) => (
                  <mesh key={idx} position={[cx, cy, cz]} rotation={[rx, 0, rz]}>
                    <cylinderGeometry args={[0.012, 0.012, 0.95, 5]} />
                    <meshBasicMaterial color="#F8FAFC" transparent opacity={0.75} />
                  </mesh>
                ))}
              </group>
            )}

            {/* Glow ring beneath */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.35, 0]}>
              <ringGeometry args={[0.42, 0.58, 24]} />
              <meshBasicMaterial color={meta.color} transparent opacity={0.75} />
            </mesh>

            {/* Distinct 3D item mesh */}
            <ItemModel3D
              kind={item.kind}
              nowSec={runtime.nowSec}
              color={meta.color}
            />

            <Html position={[0, 0.82, 0]} center distanceFactor={14} style={{ pointerEvents: 'none' }}>
              <div className="rounded-full border border-white/30 bg-[#1B110B]/90 px-2 py-0.5 text-[10px] font-black text-white whitespace-nowrap shadow-lg">
                {meta.emoji} {meta.label}
              </div>
            </Html>
          </group>
        );
      })}

      {/* Flying Snowballs & Candy Bombs */}
      {projectiles.map((proj) => (
        <group key={proj.id} position={[proj.x, proj.y, proj.z]}>
          {proj.kind === 'snowball' ? (
            <mesh castShadow>
              <sphereGeometry args={[0.28, 12, 10]} />
              <meshStandardMaterial color="#E0F2FE" roughness={0.35} />
            </mesh>
          ) : (
            <group>
              <mesh castShadow>
                <sphereGeometry args={[0.35, 14, 12]} />
                <meshStandardMaterial
                  color="#F43F5E"
                  emissive={proj.fuseSec < 0.7 ? '#EF4444' : '#9F1239'}
                  emissiveIntensity={proj.fuseSec < 0.7 ? 1.4 : 0.45}
                />
              </mesh>
              <mesh position={[0, 0.36, 0]}>
                <cylinderGeometry args={[0.04, 0.04, 0.2, 8]} />
                <meshStandardMaterial color="#FACC15" emissive="#F59E0B" emissiveIntensity={1} />
              </mesh>
            </group>
          )}
        </group>
      ))}

      {/* Transient Impact Bursts */}
      {effects.map((fx) => {
        const age = Math.max(0, runtime.nowSec - fx.createdAt);
        const scale = fx.kind === 'bomb' ? 1 + age * 8 : 0.7 + age * 3.5;
        const opacity = Math.max(0, 1 - age / 0.5);
        return (
          <mesh key={fx.id} position={[fx.x, fx.y, fx.z]} scale={scale}>
            <sphereGeometry args={[0.55, 14, 12]} />
            <meshBasicMaterial
              color={fx.color}
              transparent
              opacity={opacity * 0.65}
              wireframe={fx.kind === 'taser' || fx.kind === 'boomerang'}
            />
          </mesh>
        );
      })}

      {/* Floating "OUT!" Knockouts */}
      {popups.map((kp) => (
        <Html
          key={kp.id}
          position={[kp.x, kp.y + (runtime.nowSec - kp.createdAt) * 1.4, kp.z]}
          center
          distanceFactor={16}
          style={{ pointerEvents: 'none' }}
        >
          <div className="animate-bounce rounded-2xl border-2 border-rose-200 bg-rose-600 px-3 py-1 text-xs font-black text-white shadow-2xl whitespace-nowrap">
            💥 OUT! {kp.name}
          </div>
        </Html>
      ))}
    </group>
  );
}
