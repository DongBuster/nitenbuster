import type { RefObject } from 'react';
import type * as THREE from 'three';
import type { Emotion } from '../engine/types';
import { getPawPadGeometry, getSharedStarEyeGeometry } from './plushCurves';
import {
  CatchlightMaterial,
  DetailMaterial,
  GlossyMaterial,
  PlushMaterial,
} from './plushMaterial';

export interface PlushEyePairProps {
  eyesRef: RefObject<THREE.Group | null>;
  emotion: Emotion;
  spread: number;
  y: number;
  z: number;
  rotY?: number;
  scale?: number;
  variant?: 'bead' | 'tallBead' | 'catAmber' | 'dinoChill';
  happyColor?: string;
  browColor?: string;
  lidColor?: string;
  shockScleraColor?: string;
}

/**
 * Shared glass-bead plush eye pair anchored at local y = `y` so periodic blink
 * Y-scaling compresses cleanly around the eye center without shifting vertically.
 * All meshes skip shadow passes for minimal GPU overhead on 8-player tables.
 */
export function PlushEyePair({
  eyesRef,
  emotion,
  spread,
  y,
  z,
  rotY = 0,
  scale = 1,
  variant = 'bead',
  happyColor = '#211915',
  browColor = '#4A3525',
  lidColor = '#777A84',
  shockScleraColor = '#FFFFFF',
}: PlushEyePairProps) {
  const starGeo = getSharedStarEyeGeometry();

  return (
    <group ref={eyesRef} position={[0, y, 0]}>
      {([-1, 1] as const).map((side) => {
        const ex = side * spread;
        const ry = side * rotY;

        if (emotion === 'happy') {
          return (
            <group key={side} position={[ex, 0, z]} rotation={[0, ry, 0]} scale={scale}>
              <mesh>
                <torusGeometry args={[0.048, 0.014, 10, 18, Math.PI]} />
                <DetailMaterial color={happyColor} roughness={0.32} />
              </mesh>
            </group>
          );
        }

        if (emotion === 'win') {
          return (
            <group key={side} position={[ex, 0.008, z + 0.012]} rotation={[0, ry, 0]} scale={scale}>
              <mesh geometry={starGeo}>
                <DetailMaterial
                  color="#FACC15"
                  emissive="#F59E0B"
                  emissiveIntensity={0.48}
                  roughness={0.2}
                  metalness={0.28}
                />
              </mesh>
            </group>
          );
        }

        if (emotion === 'shock') {
          return (
            <group key={side} position={[ex, 0.008, z]} rotation={[0, ry, 0]} scale={scale}>
              <mesh scale={[1.0, 1.08, 0.6]}>
                <sphereGeometry args={[0.068, 16, 14]} />
                <DetailMaterial color="#211915" roughness={0.38} />
              </mesh>
              <mesh position={[0, 0, 0.01]} scale={[1.0, 1.08, 0.6]}>
                <sphereGeometry args={[0.058, 16, 14]} />
                <DetailMaterial color={shockScleraColor} roughness={0.22} />
              </mesh>
              <mesh position={[0, 0, 0.044]}>
                <sphereGeometry args={[0.019, 12, 10]} />
                <GlossyMaterial color="#181311" />
              </mesh>
            </group>
          );
        }

        if (emotion === 'sad') {
          return (
            <group key={side} position={[ex, -0.008, z]} rotation={[0, ry, 0]} scale={scale}>
              {variant === 'catAmber' ? (
                <>
                  <mesh scale={[0.056, 0.048, 0.036]}>
                    <sphereGeometry args={[1, 16, 14]} />
                    <GlossyMaterial color="#DFB848" roughness={0.14} clearcoat={0.9} />
                  </mesh>
                  <mesh position={[0, 0, 0.019]} scale={[0.035, 0.035, 0.025]}>
                    <sphereGeometry args={[1, 14, 12]} />
                    <GlossyMaterial color="#191412" />
                  </mesh>
                </>
              ) : (
                <mesh scale={[0.044, 0.052, 0.036]}>
                  <sphereGeometry args={[1, 16, 14]} />
                  <GlossyMaterial color="#191412" />
                </mesh>
              )}
              <mesh position={[-0.013, 0.016, 0.032]}>
                <sphereGeometry args={[0.013, 10, 8]} />
                <CatchlightMaterial />
              </mesh>
              <mesh position={[0.011, -0.014, 0.032]}>
                <sphereGeometry args={[0.006, 8, 8]} />
                <CatchlightMaterial />
              </mesh>
              <mesh position={[0, 0.064, 0.014]} rotation={[0, 0, side * 0.34]}>
                <capsuleGeometry args={[0.011, 0.054, 4, 8]} />
                <DetailMaterial color={browColor} roughness={0.55} />
              </mesh>
              <mesh position={[side * 0.02, -0.06, 0.022]} scale={[0.68, 1.18, 0.68]}>
                <sphereGeometry args={[0.018, 10, 8]} />
                <DetailMaterial
                  color="#7DD3FC"
                  emissive="#38BDF8"
                  emissiveIntensity={0.28}
                  roughness={0.1}
                />
              </mesh>
            </group>
          );
        }

        // Idle: glass-bead plush eye with crisp dual specular catchlights
        if (variant === 'catAmber') {
          return (
            <group key={side} position={[ex, 0, z]} rotation={[0, ry, 0]} scale={scale}>
              <mesh scale={[0.064, 0.048, 0.038]}>
                <sphereGeometry args={[1, 18, 14]} />
                <GlossyMaterial color="#E2BA4A" roughness={0.14} clearcoat={0.95} />
              </mesh>
              <mesh position={[0, -0.004, 0.019]} scale={[0.039, 0.035, 0.024]}>
                <sphereGeometry args={[1, 14, 12]} />
                <GlossyMaterial color="#171311" />
              </mesh>
              <mesh position={[-0.015, 0.006, 0.039]}>
                <sphereGeometry args={[0.011, 10, 8]} />
                <CatchlightMaterial />
              </mesh>
              <mesh position={[0.014, -0.014, 0.039]}>
                <sphereGeometry args={[0.0055, 8, 8]} />
                <CatchlightMaterial />
              </mesh>
              <mesh
                position={[0, 0.033, 0.018]}
                rotation={[0.08, 0, -side * 0.08]}
                scale={[0.074, 0.032, 0.044]}
              >
                <sphereGeometry args={[1, 14, 10]} />
                <PlushMaterial color={lidColor} />
              </mesh>
            </group>
          );
        }

        if (variant === 'dinoChill') {
          return (
            <group key={side} position={[ex, 0, z]} rotation={[0, ry, 0]} scale={scale}>
              <mesh position={[0, -0.008, -0.004]} scale={[1.06, 1.0, 0.56]}>
                <sphereGeometry args={[0.064, 16, 14]} />
                <DetailMaterial color="#F8F9FA" roughness={0.24} />
              </mesh>
              <mesh position={[0, 0.004, 0.01]} scale={[0.92, 0.96, 0.58]}>
                <sphereGeometry args={[0.056, 16, 14]} />
                <GlossyMaterial color="#1B1612" />
              </mesh>
              <mesh position={[-0.016, 0.022, 0.042]}>
                <sphereGeometry args={[0.014, 10, 8]} />
                <CatchlightMaterial />
              </mesh>
              <mesh position={[0.014, -0.016, 0.042]}>
                <sphereGeometry args={[0.0065, 8, 8]} />
                <CatchlightMaterial />
              </mesh>
              <mesh
                position={[0, 0.044, 0.018]}
                rotation={[0, 0, -side * 0.14]}
                scale={[1.18, 0.42, 0.72]}
              >
                <sphereGeometry args={[0.058, 14, 10]} />
                <PlushMaterial color={lidColor} />
              </mesh>
            </group>
          );
        }

        const rx = variant === 'tallBead' ? 0.038 : 0.044;
        const ryScale = variant === 'tallBead' ? 0.062 : 0.056;
        const rz = 0.036;

        return (
          <group key={side} position={[ex, 0, z]} rotation={[0, ry, 0]} scale={scale}>
            <mesh scale={[rx, ryScale, rz]}>
              <sphereGeometry args={[1, 18, 16]} />
              <GlossyMaterial color="#181311" />
            </mesh>
            <mesh position={[-0.012, 0.021, 0.03]}>
              <sphereGeometry args={[0.013, 10, 8]} />
              <CatchlightMaterial />
            </mesh>
            <mesh position={[0.011, -0.017, 0.031]}>
              <sphereGeometry args={[0.006, 8, 8]} />
              <CatchlightMaterial />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

export interface PlushSmileMouthProps {
  emotion: Emotion;
  position: [number, number, number];
  stitchColor?: string;
  scale?: number;
  bunnyTooth?: boolean;
}

/**
 * Stitched `:3` / `w` plush smile in idle, rosy open smile in happy/win,
 * gentle frown in sad, and surprised `o` mouth in shock.
 */
export function PlushSmileMouth({
  emotion,
  position,
  stitchColor = '#4E3B31',
  scale = 1,
  bunnyTooth = false,
}: PlushSmileMouthProps) {
  return (
    <group position={position} scale={scale}>
      {emotion === 'idle' && (
        <group>
          {/* Short philtrum stem */}
          <mesh position={[0, 0.022, 0]}>
            <capsuleGeometry args={[0.0055, 0.024, 4, 6]} />
            <DetailMaterial color={stitchColor} roughness={0.62} />
          </mesh>
          {/* Left & right soft curved `:3` smile arcs */}
          <mesh position={[-0.026, 0.004, 0]} rotation={[0, 0, Math.PI]}>
            <torusGeometry args={[0.026, 0.0075, 8, 14, Math.PI]} />
            <DetailMaterial color={stitchColor} roughness={0.62} />
          </mesh>
          <mesh position={[0.026, 0.004, 0]} rotation={[0, 0, Math.PI]}>
            <torusGeometry args={[0.026, 0.0075, 8, 14, Math.PI]} />
            <DetailMaterial color={stitchColor} roughness={0.62} />
          </mesh>
        </group>
      )}

      {(emotion === 'happy' || emotion === 'win') && (
        <group position={[0, -0.02, 0]}>
          <mesh scale={[1.1, emotion === 'win' ? 0.96 : 0.84, 0.45]}>
            <sphereGeometry args={[0.044, 14, 12]} />
            <DetailMaterial color="#F26B7A" roughness={0.42} />
          </mesh>
          <mesh position={[0, 0.012, 0.012]} rotation={[0, 0, Math.PI]}>
            <torusGeometry args={[0.044, 0.009, 8, 16, Math.PI]} />
            <DetailMaterial color={stitchColor} roughness={0.48} />
          </mesh>
          {bunnyTooth && (
            <mesh position={[0, 0.014, 0.016]}>
              <boxGeometry args={[0.024, 0.02, 0.01]} />
              <DetailMaterial color="#FFFFFF" roughness={0.25} />
            </mesh>
          )}
        </group>
      )}

      {emotion === 'sad' && (
        <mesh position={[0, -0.032, 0]}>
          <torusGeometry args={[0.034, 0.0085, 8, 14, Math.PI]} />
          <DetailMaterial color={stitchColor} roughness={0.55} />
        </mesh>
      )}

      {emotion === 'shock' && (
        <group position={[0, -0.024, 0]}>
          <mesh>
            <torusGeometry args={[0.033, 0.0095, 8, 16]} />
            <DetailMaterial color="#2C2019" roughness={0.45} />
          </mesh>
          <mesh position={[0, 0, -0.005]} scale={[0.92, 0.92, 0.35]}>
            <sphereGeometry args={[0.03, 12, 10]} />
            <DetailMaterial color="#E04F5F" roughness={0.48} />
          </mesh>
        </group>
      )}
    </group>
  );
}

/** Delicate soft pastel blush pads on both cheeks (zero shadow cost). */
export function PlushCheekBlush({
  emotion,
  spread,
  y,
  z,
  rotY = 0.25,
  color = '#FF9EB0',
  scale = 1,
}: {
  emotion: Emotion;
  spread: number;
  y: number;
  z: number;
  rotY?: number;
  color?: string;
  scale?: number;
}) {
  const opacity = emotion === 'sad' ? 0.22 : emotion === 'happy' || emotion === 'win' ? 0.56 : 0.38;
  return (
    <group>
      {([-1, 1] as const).map((side) => (
        <mesh
          key={side}
          position={[side * spread, y, z]}
          rotation={[0, side * rotY, 0]}
          scale={[0.068 * scale, 0.038 * scale, 0.018 * scale]}
        >
          <sphereGeometry args={[1, 12, 10]} />
          <DetailMaterial color={color} roughness={0.85} opacity={opacity} />
        </mesh>
      ))}
    </group>
  );
}

/** Shared shock sweat drop positioned on upper temple. */
export function PlushSweatDrop({
  position,
  scale = 1,
}: {
  position: [number, number, number];
  scale?: number;
}) {
  return (
    <mesh
      position={position}
      scale={[0.7 * scale, 1.25 * scale, 0.7 * scale]}
    >
      <sphereGeometry args={[0.027, 10, 10]} />
      <DetailMaterial
        color="#7DD3FC"
        emissive="#38BDF8"
        emissiveIntensity={0.28}
        roughness={0.12}
      />
    </mesh>
  );
}

/** Single draw-call merged plush paw pads (main cushion + 3 toe beans). */
export function PlushPawPad({
  position,
  rotation = [0, 0, 0],
  scale = 1,
  color = '#F3B4BE',
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  color?: string;
}) {
  return (
    <mesh
      geometry={getPawPadGeometry()}
      position={position}
      rotation={rotation}
      scale={scale}
    >
      <DetailMaterial color={color} roughness={0.72} />
    </mesh>
  );
}
