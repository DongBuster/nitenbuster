import { memo, Suspense, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type {
  AnimalId,
  BombState,
  CardData,
  Color,
  GameState,
  Player,
} from '../engine/types';
import { CARD_META, COLOR_THEME } from '../components/Card/cardMeta';
import { WinterCabinStage } from './WinterCabinStage';
import { Character3D } from './Character3D';
import { Card3D } from './Card3D';
import { CardFan3D } from './CardFan3D';

export interface GameTableScene3DProps {
  state: GameState;
  humanPlayerId?: string;
  isHumanTurn?: boolean;
  targetPickingMode?: boolean;
  playableCardIds?: string[];
  equippedAccessory?: Partial<Record<AnimalId, string | null>>;
  hideHtmlOverlays?: boolean;
  onDrawCard?: () => void;
  onPlayCard?: (card: CardData) => void;
  onSelectTarget?: (playerId: string) => void;
  onCatchPaws?: (targetPlayerId: string) => void;
  className?: string;
}

interface SeatTransform {
  player: Player;
  playerIndex: number;
  position: [number, number, number];
  rotY: number;
  scale: number;
  isHuman: boolean;
}

function hashYaw(id: string, index: number): number {
  let h = index * 37;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) % 997;
  }
  return ((h % 21) - 10) * 0.022;
}

/**
 * Animated 3D Active Color & Direction Ring around the center card piles.
 */
const DirectionColorRing = memo(function DirectionColorRing({
  color,
  direction,
}: {
  color: Color;
  direction: 1 | -1;
}) {
  const spinnerRef = useRef<THREE.Group>(null);
  const theme = COLOR_THEME[color];

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    if (spinnerRef.current) {
      // direction === 1 => clockwise when viewed from above (-Y rotation)
      spinnerRef.current.rotation.y -= direction * dt * 0.65;
    }
  });

  const chevronAngles = [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3];

  return (
    <group position={[0, 0.022, 0]}>
      {/* Glowing active-color felt ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.64, 0.042, 16, 72]} />
        <meshStandardMaterial
          color={theme.primary}
          emissive={theme.primary}
          emissiveIntensity={0.65}
          roughness={0.35}
          metalness={0.1}
        />
      </mesh>

      {/* 3 spinning directional arrow cones along the ring */}
      <group ref={spinnerRef}>
        {chevronAngles.map((ang, idx) => {
          const r = 1.64;
          const x = Math.cos(ang) * r;
          const z = Math.sin(ang) * r;
          const yaw = -ang + (direction === 1 ? 0 : Math.PI);
          return (
            <mesh
              key={idx}
              position={[x, 0.055, z]}
              rotation={[Math.PI / 2, 0, yaw]}
              castShadow
            >
              <coneGeometry args={[0.09, 0.24, 12]} />
              <meshStandardMaterial
                color="#FFFDF9"
                emissive={theme.primary}
                emissiveIntensity={0.45}
                roughness={0.3}
              />
            </mesh>
          );
        })}
      </group>
    </group>
  );
});

/**
 * Ticking 3D Candy Bomb floating over the table when state.activeBomb is active.
 */
const ActiveBomb3D = memo(function ActiveBomb3D({ bomb }: { bomb: BombState }) {
  const bombRef = useRef<THREE.Group>(null);
  const sparkRef = useRef<THREE.Mesh>(null);
  const theme = COLOR_THEME[bomb.color];

  useFrame((clockState) => {
    const t = clockState.clock.elapsedTime;
    const urgency = bomb.fuse <= 1 ? 9 : bomb.fuse === 2 ? 5.5 : 3;
    if (bombRef.current) {
      bombRef.current.position.y = 1.05 + Math.sin(t * 2.8) * 0.08;
      const pulse = 1 + Math.sin(t * urgency) * (bomb.fuse <= 1 ? 0.11 : 0.05);
      bombRef.current.scale.setScalar(pulse);
    }
    if (sparkRef.current) {
      sparkRef.current.rotation.z = t * 6;
    }
  });

  return (
    <group ref={bombRef} position={[0, 1.05, -0.55]}>
      <mesh castShadow>
        <sphereGeometry args={[0.26, 24, 24]} />
        <meshStandardMaterial color="#1E1B4B" roughness={0.28} metalness={0.35} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.255, 0.028, 12, 32]} />
        <meshStandardMaterial
          color={theme.primary}
          emissive={theme.primary}
          emissiveIntensity={0.7}
        />
      </mesh>
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.075, 0.095, 0.08, 16]} />
        <meshStandardMaterial color="#475569" roughness={0.4} metalness={0.4} />
      </mesh>
      <mesh ref={sparkRef} position={[0.07, 0.36, 0]}>
        <octahedronGeometry args={[0.085, 0]} />
        <meshStandardMaterial
          color="#FBBF24"
          emissive="#EF4444"
          emissiveIntensity={1.6}
        />
      </mesh>
    </group>
  );
});

/**
 * Interactive 3D Draw Pile on the left side of the center table.
 */
const DrawPile3D = memo(function DrawPile3D({
  count,
  canDraw,
  onDrawCard,
}: {
  count: number;
  canDraw: boolean;
  onDrawCard?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const topCardRef = useRef<THREE.Group>(null);
  const layers = Math.min(Math.max(count, 1), 6);

  useFrame((clockState, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const lerp = 1 - Math.exp(-10 * dt);
    if (topCardRef.current) {
      const idleBob =
        canDraw ? Math.sin(clockState.clock.elapsedTime * 3.2) * 0.025 + 0.03 : 0;
      const targetY = (layers - 1) * 0.042 + (canDraw && hovered ? 0.14 : idleBob);
      topCardRef.current.position.y = THREE.MathUtils.lerp(
        topCardRef.current.position.y,
        targetY,
        lerp,
      );
    }
  });

  return (
    <group position={[-0.78, 0.025, 0]}>
      {canDraw && (
        <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.62, 0.8, 36]} />
          <meshStandardMaterial
            color="#FCD34D"
            emissive="#F59E0B"
            emissiveIntensity={0.85}
            transparent
            opacity={hovered ? 0.9 : 0.5}
          />
        </mesh>
      )}

      {Array.from({ length: Math.max(layers - 1, 0) }).map((_, i) => (
        <Card3D
          key={`draw-layer-${i}`}
          faceDown
          hoverLift={false}
          scale={0.82}
          position={[0, i * 0.042, 0]}
          rotation={[-Math.PI / 2, 0, 0.04 - i * 0.012]}
        />
      ))}

      <group
        ref={topCardRef}
        position={[0, (layers - 1) * 0.042, 0]}
        onPointerOver={(e) => {
          if (!canDraw) return;
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'auto';
        }}
        onClick={(e) => {
          if (!canDraw || !onDrawCard) return;
          e.stopPropagation();
          onDrawCard();
        }}
      >
        <Card3D
          faceDown
          hoverLift={false}
          scale={0.82}
          rotation={[-Math.PI / 2, 0, -0.02]}
        />
      </group>
    </group>
  );
});

/**
 * 3D Discard Pile showing up to the last 4 played cards stacked flat on table.
 */
const DiscardPile3D = memo(function DiscardPile3D({
  discardPile,
  currentColor,
}: {
  discardPile: CardData[];
  currentColor: Color;
}) {
  const visibleCards = useMemo(() => discardPile.slice(-4), [discardPile]);

  return (
    <group position={[0.78, 0.025, 0]}>
      {visibleCards.map((card, i) => {
        const isTop = i === visibleCards.length - 1;
        const isWild = CARD_META[card.type].isWild || !card.color;
        const yaw = hashYaw(card.id, i);
        return (
          <Card3D
            key={card.id}
            type={card.type}
            color={card.color}
            value={card.value}
            activeWildColor={isTop && isWild ? currentColor : undefined}
            hoverLift={false}
            scale={0.96}
            position={[0, i * 0.042 + 0.018, 0]}
            rotation={[-Math.PI / 2, 0, yaw]}
          />
        );
      })}
    </group>
  );
});

/**
 * Lightweight 60fps world-to-screen projector driving pure React DOM overlays
 * outside <Canvas> (zero drei <Html> portals, zero React 19 unmount crashes).
 */
function OverlayProjector({
  botSeats,
  badgeRefs,
  drawBadgeRef,
  discardBadgeRef,
  bombBadgeRef,
  hasDiscardBadge,
  hasBomb,
}: {
  botSeats: SeatTransform[];
  badgeRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;
  drawBadgeRef: MutableRefObject<HTMLDivElement | null>;
  discardBadgeRef: MutableRefObject<HTMLDivElement | null>;
  bombBadgeRef: MutableRefObject<HTMLDivElement | null>;
  hasDiscardBadge: boolean;
  hasBomb: boolean;
}) {
  const tempVec = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera, size }) => {
    const applyProjection = (
      el: HTMLDivElement | null,
      wx: number,
      wy: number,
      wz: number,
    ) => {
      if (!el) return;
      tempVec.set(wx, wy, wz).project(camera);
      if (tempVec.z > 1) {
        el.style.opacity = '0';
        el.style.visibility = 'hidden';
        return;
      }
      const px = (tempVec.x * 0.5 + 0.5) * size.width;
      const py = (-tempVec.y * 0.5 + 0.5) * size.height;
      el.style.opacity = '1';
      el.style.visibility = 'visible';
      el.style.transform = `translate(-50%, -100%) translate3d(${px}px, ${py}px, 0)`;
    };

    for (let i = 0; i < botSeats.length; i++) {
      const seat = botSeats[i];
      // Stagger alternating badge heights on crowded 6-8 player tables so pills never collide
      const yAnchor =
        botSeats.length >= 5 && i % 2 === 1
          ? 2.22 * seat.scale
          : 1.78 * seat.scale;
      applyProjection(
        badgeRefs.current[seat.player.id] ?? null,
        seat.position[0],
        yAnchor,
        seat.position[2],
      );
    }

    applyProjection(drawBadgeRef.current, -0.78, 0.34, 0.78);

    if (hasDiscardBadge) {
      applyProjection(discardBadgeRef.current, 0.78, 0.42, 0.72);
    }

    if (hasBomb) {
      applyProjection(bombBadgeRef.current, 0, 1.55, -0.55);
    }
  });

  return null;
}

export function GameTableScene3D({
  state,
  humanPlayerId,
  isHumanTurn,
  targetPickingMode = false,
  playableCardIds,
  equippedAccessory,
  hideHtmlOverlays = false,
  onDrawCard,
  onPlayCard,
  onSelectTarget,
  onCatchPaws,
  className = '',
}: GameTableScene3DProps) {
  const showOverlays = !hideHtmlOverlays && state.winnerId === null;
  const resolvedHumanId = humanPlayerId ?? state.players[0]?.id;
  const resolvedIsHumanTurn =
    isHumanTurn ??
    (state.players[state.currentIndex]?.id === resolvedHumanId &&
      state.winnerId === null);
  const humanPlayer = useMemo(
    () => state.players.find((p) => p.id === resolvedHumanId) ?? state.players[0],
    [state.players, resolvedHumanId],
  );

  const badgeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const drawBadgeRef = useRef<HTMLDivElement | null>(null);
  const discardBadgeRef = useRef<HTMLDivElement | null>(null);
  const bombBadgeRef = useRef<HTMLDivElement | null>(null);

  const topDiscard = state.discardPile[state.discardPile.length - 1];
  const showBananaColorBadge =
    Boolean(topDiscard?.color && topDiscard.color !== state.currentColor) ||
    Boolean(state.lastEffectBanner?.includes('Vỏ Chuối'));
  const activeColorTheme = COLOR_THEME[state.currentColor];

  const seats = useMemo<SeatTransform[]>(() => {
    const result: SeatTransform[] = [];
    const humanIdx = Math.max(
      0,
      state.players.findIndex((p) => p.id === resolvedHumanId),
    );
    const botIndices: number[] = [];

    for (let offset = 1; offset < state.players.length; offset++) {
      botIndices.push((humanIdx + offset) % state.players.length);
    }

    const human = state.players[humanIdx];
    if (human) {
      result.push({
        player: human,
        playerIndex: humanIdx,
        position: [-2.38, 0, 2.28],
        rotY: Math.PI * 0.78,
        scale: 0.86,
        isHuman: true,
      });
    }

    const botCount = botIndices.length;
    const isCrowded = botCount >= 5;
    const radius = isCrowded ? 3.22 : 3.05;
    const startAngle = isCrowded ? Math.PI * 0.96 : Math.PI * 0.84;
    const endAngle = isCrowded ? -Math.PI * 0.06 : Math.PI * 0.16;

    botIndices.forEach((pIdx, bIdx) => {
      const t = botCount === 1 ? 0.5 : bIdx / (botCount - 1);
      const angle = startAngle - t * (startAngle - endAngle);
      const x = -Math.cos(angle) * radius;
      const z = -Math.sin(angle) * radius;
      const rotY = Math.atan2(-x, -z);
      result.push({
        player: state.players[pIdx],
        playerIndex: pIdx,
        position: [x, 0, z],
        rotY,
        scale: botCount >= 6 ? 0.78 : botCount >= 5 ? 0.86 : 0.94,
        isHuman: false,
      });
    });

    return result;
  }, [state.players, resolvedHumanId]);

  const botSeats = useMemo(() => seats.filter((s) => !s.isHuman), [seats]);
  const isDenseTable = state.players.length >= 7;

  return (
    <div className={`relative h-full w-full ${className}`}>
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{
          position: isDenseTable ? [0, 4.75, 8.35] : [0, 4.4, 7.6],
          fov: 44,
        }}
        gl={{ alpha: false, antialias: true, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={['#261810']} />
        <Suspense fallback={null}>
          <WinterCabinStage mode="table" />

          <OrbitControls
            enablePan={false}
            minDistance={4.8}
            maxDistance={11.5}
            minPolarAngle={Math.PI * 0.15}
            maxPolarAngle={Math.PI * 0.43}
            target={[0, 0.35, 0]}
          />

          {/* Center of Table */}
          <DirectionColorRing
            color={state.currentColor}
            direction={state.direction}
          />
          <DrawPile3D
            count={state.drawPile.length}
            canDraw={resolvedIsHumanTurn}
            onDrawCard={onDrawCard}
          />
          <DiscardPile3D
            discardPile={state.discardPile}
            currentColor={state.currentColor}
          />
          {state.activeBomb && <ActiveBomb3D bomb={state.activeBomb} />}

          {/* Human Player's 3D Horizontal Row Hand directly in foreground */}
          {humanPlayer && humanPlayer.hand.length > 0 && (
            <CardFan3D
              cards={humanPlayer.hand}
              layout="row"
              interactive={resolvedIsHumanTurn}
              playableIds={resolvedIsHumanTurn ? playableCardIds : undefined}
              onSelectCard={(card) => {
                if (resolvedIsHumanTurn && playableCardIds?.includes(card.id)) {
                  onPlayCard?.(card);
                }
              }}
              position={[0, 1.02, 3.65]}
              rotation={[-0.36, 0, 0]}
              scale={0.76}
            />
          )}

          {/* Seated 3D Characters */}
          {seats.map((seat) => {
            const isActive =
              state.winnerId === null && state.currentIndex === seat.playerIndex;
            const isTargetable = targetPickingMode && !seat.isHuman;

            return (
              <group key={seat.player.id} position={seat.position}>
                <Character3D
                  animal={seat.player.animal}
                  emotion={seat.player.emotion}
                  isActive={isActive}
                  accessory={equippedAccessory?.[seat.player.animal] ?? null}
                  rotation={[0, seat.rotY, 0]}
                  scale={seat.scale}
                  onClick={
                    isTargetable && onSelectTarget
                      ? () => onSelectTarget(seat.player.id)
                      : undefined
                  }
                />

                {isTargetable && (
                  <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[0.62, 0.78, 32]} />
                    <meshStandardMaterial
                      color="#F43F5E"
                      emissive="#F43F5E"
                      emissiveIntensity={0.95}
                    />
                  </mesh>
                )}
              </group>
            );
          })}

          {showOverlays && (
            <OverlayProjector
              botSeats={botSeats}
              badgeRefs={badgeRefs}
              drawBadgeRef={drawBadgeRef}
              discardBadgeRef={discardBadgeRef}
              bombBadgeRef={bombBadgeRef}
              hasDiscardBadge={showBananaColorBadge}
              hasBomb={Boolean(state.activeBomb)}
            />
          )}
        </Suspense>
      </Canvas>

      {/* Pure React DOM Projected Overlays (sibling outside Canvas) */}
      {showOverlays && (
        <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
          {/* Draw Pile Count Pill */}
          <div
            ref={drawBadgeRef}
            className="absolute top-0 left-0 will-change-transform"
            style={{ opacity: 0 }}
          >
            <button
              type="button"
              disabled={!resolvedIsHumanTurn || !onDrawCard}
              onClick={() => resolvedIsHumanTurn && onDrawCard?.()}
              className={`whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold shadow-md transition ${
                resolvedIsHumanTurn
                  ? 'pointer-events-auto cursor-pointer border-amber-300 bg-amber-500/95 text-slate-950 hover:bg-amber-400'
                  : 'pointer-events-none border-white/25 bg-slate-900/80 text-slate-200'
              }`}
            >
              {(() => {
                if (!resolvedIsHumanTurn) {
                  return `📥 Chồng bài (${state.drawPile.length})`;
                }
                const base =
                  state.pending?.kind === 'draw' ? state.pending.count : 1;
                const bombExtra =
                  state.activeBomb && state.activeBomb.fuse <= 1 ? 4 : 0;
                const guaranteed = base + bombExtra;
                return guaranteed > 1
                  ? `📥 Nhận +${guaranteed} lá (${state.drawPile.length})`
                  : `📥 Rút 1 lá (${state.drawPile.length})`;
              })()}
            </button>
          </div>

          {/* Banana Color Override Pill on Discard Pile */}
          {showBananaColorBadge && (
            <div
              ref={discardBadgeRef}
              className="absolute top-0 left-0 will-change-transform"
              style={{ opacity: 0 }}
            >
              <div
                className="flex items-center gap-1 whitespace-nowrap rounded-full border-2 border-white px-2.5 py-0.5 text-[11px] font-black shadow-lg"
                style={{
                  backgroundColor: activeColorTheme.primary,
                  color: activeColorTheme.cornerText,
                }}
              >
                <span>🍌 Vỏ Chuối →</span>
                <span>{activeColorTheme.shapeSymbol}</span>
                <span>{activeColorTheme.label}</span>
              </div>
            </div>
          )}

          {/* Active Bomb Fuse Pill */}
          {state.activeBomb && (
            <div
              ref={bombBadgeRef}
              className="absolute top-0 left-0 will-change-transform"
              style={{ opacity: 0 }}
            >
              <div className="whitespace-nowrap rounded-full border border-red-300/80 bg-red-600/95 px-2.5 py-0.5 text-xs font-extrabold text-white shadow-lg">
                💣 Nổ sau {state.activeBomb.fuse} lượt
              </div>
            </div>
          )}

          {/* Floating Bot Badges */}
          {botSeats.map((seat) => {
            const isActive =
              state.winnerId === null && state.currentIndex === seat.playerIndex;
            const isTargetable = targetPickingMode && !seat.isHuman;
            const hasPaws = seat.player.hand.length === 1;
            const missedPaws = hasPaws && !seat.player.calledPaws;

            return (
              <div
                key={seat.player.id}
                ref={(el) => {
                  badgeRefs.current[seat.player.id] = el;
                }}
                className="absolute top-0 left-0 will-change-transform"
                style={{ opacity: 0 }}
              >
                <div className="flex flex-col items-center gap-1 select-none">
                  {seat.player.quip && (
                    <div className="max-w-[160px] animate-bounce rounded-2xl border border-amber-200/80 bg-white/95 px-2.5 py-1 text-center text-[11px] font-bold text-slate-900 shadow-lg">
                      “{seat.player.quip}”
                    </div>
                  )}

                  {missedPaws && onCatchPaws ? (
                    <button
                      type="button"
                      onClick={() => onCatchPaws(seat.player.id)}
                      className="pointer-events-auto cursor-pointer whitespace-nowrap rounded-full border-2 border-white bg-rose-600 px-2.5 py-0.5 text-[11px] font-black text-white shadow-lg transition hover:scale-105 hover:bg-rose-500"
                    >
                      🚨 Bắt lỗi PAWS! (+2)
                    </button>
                  ) : (
                    hasPaws && (
                      <span className="rounded-full border border-amber-200 bg-gradient-to-r from-amber-400 to-orange-500 px-2 py-0.5 text-[10px] font-black tracking-wide text-slate-950 shadow-md">
                        🐾 PAWS!
                      </span>
                    )
                  )}

                  <div
                    className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border shadow-md backdrop-blur-sm ${
                      isDenseTable
                        ? 'px-2 py-0.5 text-[11px] font-extrabold'
                        : 'px-2.5 py-0.5 text-xs font-extrabold'
                    } ${
                      isActive
                        ? 'border-amber-300 bg-amber-500/95 text-slate-950'
                        : 'border-white/25 bg-slate-900/82 text-white'
                    }`}
                  >
                    <span>{seat.player.name}</span>
                    <span className="rounded-full bg-black/25 px-1.5 py-0.2 text-[11px]">
                      🎴 {seat.player.hand.length}
                    </span>
                  </div>

                  {isTargetable && onSelectTarget && (
                    <button
                      type="button"
                      onClick={() => onSelectTarget(seat.player.id)}
                      className="pointer-events-auto cursor-pointer whitespace-nowrap rounded-full border-2 border-white bg-rose-500 px-3 py-1 text-xs font-black text-white shadow-lg transition hover:scale-105 hover:bg-rose-400"
                    >
                      🎯 Bắn Nỏ Thần!
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
