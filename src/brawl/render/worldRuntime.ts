import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { playSfx } from '../../audio/soundEngine';
import {
  getNextCollapseInfo,
  getSafeRadiusAt,
  getSpawnPoints,
} from '../sim/arenaLayout';
import {
  computeBotInput,
  createInitialBotMemory,
  type BotEntityView,
  type BotMemory,
} from '../sim/botBrain';
import {
  computeHitOutcome,
  createInitialFighterStatus,
  ITEM_META,
  pickRandomItemKind,
} from '../sim/combat';
import {
  BALANCE_REGEN_PER_SEC,
  BOMB_BALANCE_DMG,
  BOMB_FUSE_SEC,
  BOMB_KNOCKBACK,
  BOMB_RADIUS,
  BOMB_UP_BOOST,
  CARD_BOOMERANG_RANGE,
  CARD_BOOMERANG_SEC,
  CARD_FREEZE_RANGE,
  CARD_FREEZE_SEC,
  CARD_TASER_RADIUS,
  CARD_TASER_STUN_SEC,
  DROPKICK_BALANCE_DMG,
  DROPKICK_COOLDOWN,
  DROPKICK_DURATION,
  DROPKICK_KNOCKBACK,
  DROPKICK_RANGE,
  DROPKICK_SLIDE_DURATION,
  DROPKICK_SPEED,
  DROPKICK_UP_BOOST,
  FALL_OUT_Y,
  GRAB_MAX_DURATION,
  GRAB_RANGE,
  GRAVITY,
  HEADBUTT_BALANCE_DMG,
  HEADBUTT_COOLDOWN,
  HEADBUTT_DURATION,
  HEADBUTT_KNOCKBACK,
  HEADBUTT_LUNGE_SPEED,
  HEADBUTT_RANGE,
  HEADBUTT_UP_BOOST,
  HIT_STOP_SEC,
  ITEM_SPAWN_INTERVAL_SEC,
  JUMP_VELOCITY,
  MAX_WORLD_ITEMS,
  MOVE_SPEED,
  PUNCH_ARC_COS,
  PUNCH_BALANCE_DMG,
  PUNCH_COOLDOWN,
  PUNCH_KNOCKBACK,
  PUNCH_LUNGE_SPEED,
  PUNCH_RANGE,
  PUNCH_UP_BOOST,
  RING_SCHEDULE,
  ROLL_COOLDOWN,
  ROLL_DURATION,
  ROLL_SPEED,
  SHOVEL_AMMO,
  SHOVEL_BALANCE_DMG,
  SHOVEL_KNOCKBACK,
  SHOVEL_RANGE,
  SHOVEL_UP_BOOST,
  SKATES_DURATION,
  SKATES_MULTIPLIER,
  SNOWBALL_AMMO,
  SNOWBALL_BALANCE_DMG,
  SNOWBALL_KNOCKBACK,
  SNOWBALL_SPEED,
  SHIELD_DURATION,
  SPRINT_MULTIPLIER,
  SUDDEN_DEATH_INTERVAL_SEC,
  SUDDEN_DEATH_START_SEC,
  THROW_IMPULSE,
  THROW_UP_IMPULSE,
  WAKEUP_ANIM_SEC,
  WAKEUP_IMMUNITY_SEC,
} from '../sim/constants';
import { getCooldownState } from '../sim/cooldowns';
import {
  pruneExpiredKoFeed,
  pushKoFeedEntry,
  type TimedKoFeedItem,
} from '../sim/koFeed';
import {
  createPartyMotionState,
  stepPartyMotion,
  type PartyMotionState,
} from '../sim/partyMotion';
import type {
  BrawlDifficulty,
  FighterConfig,
  FighterInput,
  FighterStatus,
  HexTileSpec,
  HitEffect,
  HudSnapshot,
  ItemKind,
  KnockoutPopup,
  Projectile,
  WorldItem,
} from '../sim/types';

export interface FighterRuntime {
  config: FighterConfig;
  status: FighterStatus;
  body: RapierRigidBody | null;
  pos: THREE.Vector3;
  yaw: number;
  prevYaw: number;
  prevVelX: number;
  prevVelZ: number;
  speedNorm: number;
  walkPhase: number;
  grounded: boolean;
  wasGrounded: boolean;
  rollUntil: number;
  rollDirX: number;
  rollDirZ: number;
  punchAnimUntil: number;
  punchHand: 'left' | 'right';
  headbuttUntil: number;
  headbuttDirX: number;
  headbuttDirZ: number;
  headbuttHitIds: Set<string>;
  dropkickUntil: number;
  dropkickSlideUntil: number;
  dropkickDirX: number;
  dropkickDirZ: number;
  dropkickHitIds: Set<string>;
  wakeupUntil: number;
  knockbackGraceUntil: number;
  wasGrabHeld: boolean;
  wasStunned: boolean;
  partyMotion: PartyMotionState;
  botMemory: BotMemory;
}

export class BrawlWorldRuntime {
  fighters = new Map<string, FighterRuntime>();
  items: WorldItem[] = [];
  projectiles: Projectile[] = [];
  hitEffects: HitEffect[] = [];
  koPopups: KnockoutPopup[] = [];
  tiles: HexTileSpec[];
  collapsedTileIds = new Set<string>();
  announcedRings = new Set<number>();
  eliminatedThisRound = new Set<string>();

  nowSec = 0;
  roundElapsedSec = 0;
  nextItemSpawnAt = 3.2;
  nextSuddenBombAt = SUDDEN_DEATH_START_SEC;
  hitStopUntil = 0;
  shakeIntensity = 0;
  bannerText: string | null = null;
  bannerUntil = 0;
  koFeed: TimedKoFeedItem[] = [];
  difficulty: BrawlDifficulty;

  private uidSeq = 1;

  constructor(
    configs: FighterConfig[],
    tiles: HexTileSpec[],
    difficulty: BrawlDifficulty,
  ) {
    this.tiles = tiles;
    this.difficulty = difficulty;
    const spawns = getSpawnPoints(configs.length);

    configs.forEach((cfg, idx) => {
      const sp = spawns[idx % spawns.length];
      this.fighters.set(cfg.id, {
        config: cfg,
        status: createInitialFighterStatus(cfg.id),
        body: null,
        pos: new THREE.Vector3(sp.x, sp.y, sp.z),
        yaw: sp.yaw,
        prevYaw: sp.yaw,
        prevVelX: 0,
        prevVelZ: 0,
        speedNorm: 0,
        walkPhase: Math.random() * Math.PI * 2,
        grounded: true,
        wasGrounded: true,
        rollUntil: 0,
        rollDirX: 0,
        rollDirZ: 1,
        punchAnimUntil: 0,
        punchHand: 'right',
        headbuttUntil: 0,
        headbuttDirX: 0,
        headbuttDirZ: 1,
        headbuttHitIds: new Set<string>(),
        dropkickUntil: 0,
        dropkickSlideUntil: 0,
        dropkickDirX: 0,
        dropkickDirZ: 1,
        dropkickHitIds: new Set<string>(),
        wakeupUntil: 0,
        knockbackGraceUntil: 0,
        wasGrabHeld: false,
        wasStunned: false,
        partyMotion: createPartyMotionState(),
        botMemory: createInitialBotMemory(),
      });
    });
  }

  private nextId(prefix: string): string {
    this.uidSeq += 1;
    return `${prefix}_${this.uidSeq}`;
  }

  setBanner(text: string, durationSec = 2.6): void {
    this.bannerText = text;
    this.bannerUntil = this.nowSec + durationSec;
  }

  private pushKoFeed(text: string): void {
    const id = this.nextId('ko');
    this.koFeed = pushKoFeedEntry(this.koFeed, {
      id,
      text,
      nowSec: this.nowSec,
    });
  }

  private spawnHitEffect(
    x: number,
    y: number,
    z: number,
    color: string,
    kind: HitEffect['kind'],
  ): void {
    this.hitEffects.push({
      id: this.nextId('fx'),
      x,
      y,
      z,
      color,
      kind,
      createdAt: this.nowSec,
    });
  }

  private applyKnockbackHit(
    target: FighterRuntime,
    dirX: number,
    dirZ: number,
    baseKnockback: number,
    upBoost: number,
    balanceDmg: number,
    fxColor: string,
    fxKind: HitEffect['kind'],
  ): void {
    const outcome = computeHitOutcome({
      dirX,
      dirZ,
      baseKnockback,
      upBoost,
      balanceDmg,
      target: target.status,
      nowSec: this.nowSec,
    });

    target.status.balance = outcome.nextBalance;
    target.status.stunnedUntil = outcome.nextStunnedUntil;
    target.knockbackGraceUntil = this.nowSec + 0.24;

    if (outcome.justStunned && target.status.grabbingTargetId) {
      this.releaseGrab(target, false);
    }

    if (target.body) {
      const curVel = target.body.linvel();
      target.body.setLinvel(
        {
          x: curVel.x * 0.2 + outcome.impulseX,
          y: Math.max(curVel.y, 0) + outcome.impulseY,
          z: curVel.z * 0.2 + outcome.impulseZ,
        },
        true,
      );
    }

    this.spawnHitEffect(
      target.pos.x,
      target.pos.y + 0.75,
      target.pos.z,
      fxColor,
      fxKind,
    );
  }

  private releaseGrab(grabber: FighterRuntime, doThrow: boolean): void {
    const targetId = grabber.status.grabbingTargetId;
    grabber.status.grabbingTargetId = null;
    if (!targetId) return;

    const target = this.fighters.get(targetId);
    if (!target) return;
    target.status.grabbedById = null;

    if (doThrow && target.status.alive && target.body) {
      const fwdX = Math.sin(grabber.yaw);
      const fwdZ = Math.cos(grabber.yaw);
      let yawDiff = grabber.yaw - grabber.prevYaw;
      while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
      while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
      const tangX = Math.cos(grabber.yaw) * THREE.MathUtils.clamp(yawDiff * 18, -3.5, 3.5);
      const tangZ = -Math.sin(grabber.yaw) * THREE.MathUtils.clamp(yawDiff * 18, -3.5, 3.5);
      target.knockbackGraceUntil = this.nowSec + 0.45;
      target.status.balance = Math.max(0, target.status.balance - 22);
      target.body.setLinvel(
        {
          x: fwdX * THROW_IMPULSE + tangX,
          y: THROW_UP_IMPULSE,
          z: fwdZ * THROW_IMPULSE + tangZ,
        },
        true,
      );
      this.spawnHitEffect(
        target.pos.x,
        target.pos.y + 0.7,
        target.pos.z,
        '#FBBF24',
        'punch',
      );
      playSfx('grab');
    }
  }

  private tryPickUpItem(fighter: FighterRuntime): void {
    const now = this.nowSec;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      if (item.y > 1.9) continue;
      const dist = Math.hypot(item.x - fighter.pos.x, item.z - fighter.pos.z);
      if (dist > 1.28 || Math.abs(item.y - fighter.pos.y) > 1.8) continue;

      this.items.splice(i, 1);
      this.activatePickedItem(fighter, item.kind, now);
      return;
    }
  }

  private activatePickedItem(
    fighter: FighterRuntime,
    kind: ItemKind,
    now: number,
  ): void {
    const meta = ITEM_META[kind];
    this.spawnHitEffect(
      fighter.pos.x,
      fighter.pos.y + 0.8,
      fighter.pos.z,
      meta.color,
      'pickup',
    );

    if (kind === 'snowball') {
      fighter.status.heldItem = 'snowball';
      fighter.status.heldAmmo = SNOWBALL_AMMO;
      playSfx('pickup');
      return;
    }
    if (kind === 'shovel') {
      fighter.status.heldItem = 'shovel';
      fighter.status.heldAmmo = SHOVEL_AMMO;
      playSfx('pickup');
      return;
    }
    if (kind === 'candy_bomb') {
      fighter.status.heldItem = 'candy_bomb';
      fighter.status.heldAmmo = 1;
      playSfx('pickup');
      return;
    }
    if (kind === 'cocoa') {
      fighter.status.balance = fighter.status.maxBalance;
      playSfx('potion');
      if (!fighter.config.isBot) {
        this.setBanner('☕ Uống Ca Cao nóng! Hồi đầy thăng bằng!');
      }
      return;
    }
    if (kind === 'skates') {
      fighter.status.speedBoostUntil = now + SKATES_DURATION;
      playSfx('pickup');
      if (!fighter.config.isBot) {
        this.setBanner('⛸️ Giày Trượt Băng! Tăng tốc 6 giây!');
      }
      return;
    }
    if (kind === 'shield') {
      fighter.status.shieldUntil = now + SHIELD_DURATION;
      playSfx('pickup');
      if (!fighter.config.isBot) {
        this.setBanner('🛡️ Khiên Nắp Thùng! Giảm đẩy lùi 5 giây!');
      }
      return;
    }

    // PAWS Link Cards dropped from the sky!
    if (kind === 'card_freeze') {
      const target = this.findNearestEnemy(fighter, CARD_FREEZE_RANGE);
      playSfx('freeze');
      if (target) {
        target.status.frozenUntil = now + CARD_FREEZE_SEC;
        this.releaseGrab(target, false);
        this.spawnHitEffect(
          target.pos.x,
          target.pos.y + 0.85,
          target.pos.z,
          '#60A5FA',
          'freeze',
        );
        this.setBanner(`🧊 ${fighter.config.name} kích hoạt Thẻ Kem Đá lên ${target.config.name}!`);
      } else {
        this.setBanner(`🧊 ${fighter.config.name} nhặt Thẻ Kem Đá!`);
      }
      return;
    }

    if (kind === 'card_taser') {
      playSfx('taser');
      this.spawnHitEffect(
        fighter.pos.x,
        fighter.pos.y + 0.85,
        fighter.pos.z,
        '#FACC15',
        'taser',
      );
      let hitAny = false;
      for (const other of this.fighters.values()) {
        if (other.config.id === fighter.config.id || !other.status.alive) continue;
        const d = Math.hypot(
          other.pos.x - fighter.pos.x,
          other.pos.z - fighter.pos.z,
        );
        if (d <= CARD_TASER_RADIUS) {
          hitAny = true;
          other.status.stunnedUntil = Math.max(
            other.status.stunnedUntil,
            now + CARD_TASER_STUN_SEC,
          );
          this.applyKnockbackHit(
            other,
            other.pos.x - fighter.pos.x,
            other.pos.z - fighter.pos.z,
            5.6,
            2.4,
            45,
            '#FACC15',
            'taser',
          );
        }
      }
      this.shakeIntensity = Math.max(this.shakeIntensity, 0.35);
      this.setBanner(
        hitAny
          ? `⚡ ${fighter.config.name} giật Thẻ Tia Chớp quanh bàn!`
          : `⚡ ${fighter.config.name} phát Tia Chớp nhưng trượt hết!`,
      );
      return;
    }

    if (kind === 'card_boomerang') {
      const target = this.findNearestEnemy(fighter, CARD_BOOMERANG_RANGE);
      playSfx('boomerang');
      if (target) {
        target.status.invertedUntil = now + CARD_BOOMERANG_SEC;
        this.spawnHitEffect(
          target.pos.x,
          target.pos.y + 0.9,
          target.pos.z,
          '#C084FC',
          'boomerang',
        );
        this.setBanner(
          `🪃 ${fighter.config.name} ném Vòng Xoay! ${target.config.name} bị đảo phím 5s!`,
        );
      } else {
        this.setBanner(`🪃 ${fighter.config.name} nhặt Thẻ Vòng Xoay!`);
      }
    }
  }

  private findNearestEnemy(
    source: FighterRuntime,
    maxRange: number,
  ): FighterRuntime | null {
    let best: FighterRuntime | null = null;
    let bestDist = maxRange;
    for (const other of this.fighters.values()) {
      if (other.config.id === source.config.id || !other.status.alive) continue;
      const d = Math.hypot(
        other.pos.x - source.pos.x,
        other.pos.z - source.pos.z,
      );
      if (d <= bestDist) {
        bestDist = d;
        best = other;
      }
    }
    return best;
  }

  private performPunchOrUseItem(fighter: FighterRuntime): void {
    const now = this.nowSec;
    if (fighter.status.punchCooldownUntil > now) return;
    fighter.status.punchCooldownUntil = now + PUNCH_COOLDOWN;
    fighter.punchAnimUntil = now + 0.24;
    fighter.punchHand = fighter.punchHand === 'left' ? 'right' : 'left';

    const fwdX = Math.sin(fighter.yaw);
    const fwdZ = Math.cos(fighter.yaw);

    // Held ranged items: snowball or candy bomb
    if (fighter.status.heldItem === 'snowball' && fighter.status.heldAmmo > 0) {
      fighter.status.heldAmmo -= 1;
      if (fighter.status.heldAmmo <= 0) fighter.status.heldItem = null;
      this.projectiles.push({
        id: this.nextId('proj'),
        kind: 'snowball',
        ownerId: fighter.config.id,
        x: fighter.pos.x + fwdX * 0.95,
        y: fighter.pos.y + 0.85,
        z: fighter.pos.z + fwdZ * 0.95,
        vx: fwdX * SNOWBALL_SPEED,
        vy: 1.8,
        vz: fwdZ * SNOWBALL_SPEED,
        fuseSec: 2.2,
        createdAt: now,
      });
      playSfx('play');
      return;
    }

    if (fighter.status.heldItem === 'candy_bomb' && fighter.status.heldAmmo > 0) {
      fighter.status.heldAmmo -= 1;
      if (fighter.status.heldAmmo <= 0) fighter.status.heldItem = null;
      this.projectiles.push({
        id: this.nextId('proj'),
        kind: 'candy_bomb',
        ownerId: fighter.config.id,
        x: fighter.pos.x + fwdX * 0.95,
        y: fighter.pos.y + 0.95,
        z: fighter.pos.z + fwdZ * 0.95,
        vx: fwdX * 10.5,
        vy: 5.5,
        vz: fwdZ * 10.5,
        fuseSec: BOMB_FUSE_SEC,
        createdAt: now,
      });
      playSfx('play');
      return;
    }

    // Subtle forward punch step like Party Animals
    if (fighter.body) {
      const v = fighter.body.linvel();
      fighter.body.setLinvel(
        {
          x: v.x + fwdX * PUNCH_LUNGE_SPEED * 0.55,
          y: v.y,
          z: v.z + fwdZ * PUNCH_LUNGE_SPEED * 0.55,
        },
        true,
      );
    }

    // Melee attack: regular punch or Snow Shovel swing
    const usingShovel =
      fighter.status.heldItem === 'shovel' && fighter.status.heldAmmo > 0;
    const range = usingShovel ? SHOVEL_RANGE : PUNCH_RANGE;
    const knockback = usingShovel ? SHOVEL_KNOCKBACK : PUNCH_KNOCKBACK;
    const upBoost = usingShovel ? SHOVEL_UP_BOOST : PUNCH_UP_BOOST;
    const balanceDmg = usingShovel ? SHOVEL_BALANCE_DMG : PUNCH_BALANCE_DMG;

    let hitCount = 0;
    for (const target of this.fighters.values()) {
      if (target.config.id === fighter.config.id || !target.status.alive) continue;
      const dx = target.pos.x - fighter.pos.x;
      const dz = target.pos.z - fighter.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > range || Math.abs(target.pos.y - fighter.pos.y) > 1.7) continue;

      const dot = dist > 0.05 ? (dx * fwdX + dz * fwdZ) / dist : 1;
      if (dot < PUNCH_ARC_COS && dist > 0.9) continue;

      hitCount += 1;
      this.applyKnockbackHit(
        target,
        dist > 0.05 ? dx : fwdX,
        dist > 0.05 ? dz : fwdZ,
        knockback,
        upBoost,
        balanceDmg,
        usingShovel ? '#F59E0B' : '#FFF7ED',
        'punch',
      );
    }

    if (hitCount > 0) {
      if (usingShovel) {
        fighter.status.heldAmmo -= 1;
        if (fighter.status.heldAmmo <= 0) fighter.status.heldItem = null;
        playSfx('shovel');
      } else {
        playSfx('punch');
      }
      this.hitStopUntil = now + HIT_STOP_SEC;
      this.shakeIntensity = Math.max(
        this.shakeIntensity,
        usingShovel ? 0.36 : 0.2,
      );
    } else {
      playSfx('draw');
    }
  }

  private performHeadbutt(fighter: FighterRuntime): void {
    const now = this.nowSec;
    if (
      fighter.status.headbuttCooldownUntil > now ||
      now < fighter.dropkickUntil ||
      now < fighter.rollUntil
    ) {
      return;
    }

    fighter.status.headbuttCooldownUntil = now + HEADBUTT_COOLDOWN;
    fighter.headbuttUntil = now + HEADBUTT_DURATION;
    fighter.headbuttDirX = Math.sin(fighter.yaw);
    fighter.headbuttDirZ = Math.cos(fighter.yaw);
    fighter.headbuttHitIds.clear();
    playSfx('roll');
  }

  private performDropkick(fighter: FighterRuntime): void {
    const now = this.nowSec;
    if (
      fighter.status.dropkickCooldownUntil > now ||
      now < fighter.dropkickUntil ||
      now < fighter.rollUntil
    ) {
      return;
    }

    fighter.status.dropkickCooldownUntil = now + DROPKICK_COOLDOWN;
    fighter.dropkickUntil = now + DROPKICK_DURATION;
    fighter.dropkickDirX = Math.sin(fighter.yaw);
    fighter.dropkickDirZ = Math.cos(fighter.yaw);
    fighter.dropkickHitIds.clear();

    if (fighter.body) {
      const v = fighter.body.linvel();
      fighter.body.setLinvel(
        {
          x: fighter.dropkickDirX * DROPKICK_SPEED,
          y: Math.max(v.y, 2.7),
          z: fighter.dropkickDirZ * DROPKICK_SPEED,
        },
        true,
      );
    }
    playSfx('roll');
  }

  private stepActiveLungeHits(fighter: FighterRuntime): void {
    const now = this.nowSec;
    const isDropkicking = now < fighter.dropkickUntil;
    const isHeadbutting = !isDropkicking && now < fighter.headbuttUntil;
    if (!isDropkicking && !isHeadbutting) return;

    const dirX = isDropkicking ? fighter.dropkickDirX : fighter.headbuttDirX;
    const dirZ = isDropkicking ? fighter.dropkickDirZ : fighter.headbuttDirZ;
    const range = isDropkicking ? DROPKICK_RANGE : HEADBUTT_RANGE;
    const knockback = isDropkicking ? DROPKICK_KNOCKBACK : HEADBUTT_KNOCKBACK;
    const upBoost = isDropkicking ? DROPKICK_UP_BOOST : HEADBUTT_UP_BOOST;
    const balanceDmg = isDropkicking ? DROPKICK_BALANCE_DMG : HEADBUTT_BALANCE_DMG;
    const hitSet = isDropkicking ? fighter.dropkickHitIds : fighter.headbuttHitIds;

    let hitAny = false;
    for (const target of this.fighters.values()) {
      if (
        target.config.id === fighter.config.id ||
        !target.status.alive ||
        hitSet.has(target.config.id)
      ) {
        continue;
      }

      const dx = target.pos.x - fighter.pos.x;
      const dz = target.pos.z - fighter.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > range || Math.abs(target.pos.y - fighter.pos.y) > 1.7) continue;

      const dot = dist > 0.05 ? (dx * dirX + dz * dirZ) / dist : 1;
      if (dot < 0.05 && dist > 0.95) continue;

      hitSet.add(target.config.id);
      hitAny = true;
      this.applyKnockbackHit(
        target,
        dist > 0.05 ? dx : dirX,
        dist > 0.05 ? dz : dirZ,
        knockback,
        upBoost,
        balanceDmg,
        isDropkicking ? '#38BDF8' : '#FBBF24',
        'punch',
      );
    }

    if (hitAny) {
      playSfx('punch');
      this.hitStopUntil = now + HIT_STOP_SEC;
      this.shakeIntensity = Math.max(
        this.shakeIntensity,
        isDropkicking ? 0.42 : 0.3,
      );
    }
  }

  private syncFighterPartyMotion(
    fighter: FighterRuntime,
    sprinting: boolean,
    dt: number,
  ): void {
    const v = fighter.body ? fighter.body.linvel() : { x: 0, y: 0, z: 0 };
    const now = this.nowSec;

    stepPartyMotion(
      fighter.partyMotion,
      {
        nowSec: now,
        vx: v.x,
        vy: v.y,
        vz: v.z,
        prevVx: fighter.prevVelX,
        prevVz: fighter.prevVelZ,
        yaw: fighter.yaw,
        prevYaw: fighter.prevYaw,
        grounded: fighter.grounded,
        wasGrounded: fighter.wasGrounded,
        sprinting,
        isStunned: fighter.status.stunnedUntil > now,
        isFrozen: fighter.status.frozenUntil > now,
        isGrabbing: Boolean(fighter.status.grabbingTargetId),
        isGrabbed: Boolean(fighter.status.grabbedById),
        rollUntil: fighter.rollUntil,
        rollDuration: ROLL_DURATION,
        punchUntil: fighter.punchAnimUntil,
        punchDuration: 0.24,
        punchHand: fighter.punchHand,
        headbuttUntil: fighter.headbuttUntil,
        headbuttDuration: HEADBUTT_DURATION,
        dropkickUntil: fighter.dropkickUntil,
        dropkickDuration: DROPKICK_DURATION,
        dropkickSlideUntil: fighter.dropkickSlideUntil,
        wakeupUntil: fighter.wakeupUntil,
        wakeupDuration: WAKEUP_ANIM_SEC,
      },
      dt,
    );

    fighter.prevVelX = v.x;
    fighter.prevVelZ = v.z;
    fighter.prevYaw = fighter.yaw;
    fighter.wasGrounded = fighter.grounded;
    fighter.speedNorm = fighter.partyMotion.speedNorm;
    fighter.walkPhase = fighter.partyMotion.walkPhase;
  }

  private detonateBomb(x: number, y: number, z: number): void {
    playSfx('bomb');
    this.shakeIntensity = Math.max(this.shakeIntensity, 0.55);
    this.hitStopUntil = this.nowSec + HIT_STOP_SEC;
    this.spawnHitEffect(x, y + 0.4, z, '#FB7185', 'bomb');

    for (const target of this.fighters.values()) {
      if (!target.status.alive) continue;
      const dx = target.pos.x - x;
      const dz = target.pos.z - z;
      const dist = Math.hypot(dx, dz);
      if (dist > BOMB_RADIUS) continue;

      const falloff = Math.max(0.45, 1 - dist / BOMB_RADIUS);
      this.applyKnockbackHit(
        target,
        dist > 0.08 ? dx : Math.random() - 0.5,
        dist > 0.08 ? dz : Math.random() - 0.5,
        BOMB_KNOCKBACK * falloff,
        BOMB_UP_BOOST * falloff,
        BOMB_BALANCE_DMG * falloff,
        '#FB7185',
        'bomb',
      );
    }
  }

  stepFrame(params: {
    dt: number;
    phase: 'countdown' | 'fighting' | 'roundOver' | 'matchOver' | 'setup';
    humanInput: FighterInput;
    onEliminateBatch: (ids: string[]) => void;
  }): void {
    const dt = Math.min(0.05, params.dt);
    this.nowSec += dt;
    this.shakeIntensity = Math.max(0, this.shakeIntensity - dt * 1.9);

    // Expire banner, KO feed entries, & transient effects cleanly
    if (this.bannerText && this.nowSec > this.bannerUntil) {
      this.bannerText = null;
    }
    if (this.koFeed.length > 0) {
      this.koFeed = pruneExpiredKoFeed(this.koFeed, this.nowSec);
    }
    this.hitEffects = this.hitEffects.filter(
      (fx) => this.nowSec - fx.createdAt < 0.55,
    );
    this.koPopups = this.koPopups.filter(
      (kp) => this.nowSec - kp.createdAt < 1.85,
    );

    // Sync cached fighter world positions from Rapier even during countdown
    for (const fighter of this.fighters.values()) {
      if (!fighter.body) continue;
      const t = fighter.body.translation();
      fighter.pos.set(t.x, t.y, t.z);
      const v = fighter.body.linvel();
      fighter.grounded = t.y >= -0.35 && t.y <= 0.35 && Math.abs(v.y) < 1.25;
    }

    if (params.phase !== 'fighting') {
      // Keep fighters locked upright during countdown
      if (params.phase === 'countdown') {
        for (const fighter of this.fighters.values()) {
          if (!fighter.body) continue;
          const v = fighter.body.linvel();
          fighter.body.setEnabledRotations(false, false, false, true);
          fighter.body.setLinvel({ x: 0, y: v.y, z: 0 }, true);
        }
      }
      return;
    }

    // Crunchy hit-stop pause on big punches / explosions
    if (this.nowSec < this.hitStopUntil) {
      return;
    }

    this.roundElapsedSec += dt;

    // Check ring warning announcements
    for (const [ringStr, sched] of Object.entries(RING_SCHEDULE)) {
      const ringNum = Number(ringStr);
      if (
        this.roundElapsedSec >= sched.warnAt &&
        !this.announcedRings.has(ringNum)
      ) {
        this.announcedRings.add(ringNum);
        this.setBanner(`⚠️ Vòng ngoài số ${ringNum} sắp sụp trong 2 giây!`, 2.2);
      }
      if (
        this.roundElapsedSec >= sched.collapseAt &&
        !this.announcedRings.has(ringNum + 100)
      ) {
        this.announcedRings.add(ringNum + 100);
        playSfx('tileFall');
      }
    }

    // Spawn pickups / PAWS cards from the sky
    if (
      this.roundElapsedSec >= this.nextItemSpawnAt &&
      this.items.length < MAX_WORLD_ITEMS
    ) {
      this.nextItemSpawnAt = this.roundElapsedSec + ITEM_SPAWN_INTERVAL_SEC;
      const safeR = Math.max(1.2, getSafeRadiusAt(this.roundElapsedSec) * 0.72);
      const angle = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * safeR;
      this.items.push({
        id: this.nextId('item'),
        kind: pickRandomItemKind(),
        x: Math.cos(angle) * r,
        y: 10.5,
        z: Math.sin(angle) * r,
        spawnedAt: this.nowSec,
      });
    }

    // Parachute fall for world items
    for (const item of this.items) {
      if (item.y > 0.65) {
        item.y = Math.max(0.65, item.y - dt * 5.2);
      }
    }

    // Sudden death candy bombs at 82s+ to ensure round finishes cleanly
    if (this.roundElapsedSec >= this.nextSuddenBombAt) {
      this.nextSuddenBombAt = this.roundElapsedSec + SUDDEN_DEATH_INTERVAL_SEC;
      this.setBanner('💣 Mưa Bom Kẹo! Nhanh tay đẩy đối thủ khỏi đảo!', 2.5);
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * 1.6;
      this.projectiles.push({
        id: this.nextId('sdbomb'),
        kind: 'candy_bomb',
        ownerId: 'arena',
        x: Math.cos(angle) * r,
        y: 10,
        z: Math.sin(angle) * r,
        vx: 0,
        vy: -2,
        vz: 0,
        fuseSec: 1.8,
        createdAt: this.nowSec,
      });
    }

    // Build bot views once per frame
    const botViews: BotEntityView[] = [];
    for (const f of this.fighters.values()) {
      botViews.push({
        id: f.config.id,
        x: f.pos.x,
        y: f.pos.y,
        z: f.pos.z,
        status: f.status,
      });
    }

    // Step every living fighter
    const newlyEliminated: string[] = [];

    for (const fighter of this.fighters.values()) {
      if (!fighter.status.alive) continue;

      if (fighter.pos.y < FALL_OUT_Y) {
        fighter.status.alive = false;
        this.releaseGrab(fighter, false);
        if (fighter.status.grabbedById) {
          const holder = this.fighters.get(fighter.status.grabbedById);
          if (holder) this.releaseGrab(holder, false);
        }
        if (!this.eliminatedThisRound.has(fighter.config.id)) {
          this.eliminatedThisRound.add(fighter.config.id);
          newlyEliminated.push(fighter.config.id);
          this.koPopups.push({
            id: this.nextId('out'),
            name: fighter.config.name,
            animal: fighter.config.animal,
            x: THREE.MathUtils.clamp(fighter.pos.x, -8, 8),
            y: 0.6,
            z: THREE.MathUtils.clamp(fighter.pos.z, -8, 8),
            createdAt: this.nowSec,
          });
          this.pushKoFeed(`${fighter.config.name} rơi khỏi sàn!`);
          playSfx('ko');
        }
        continue;
      }

      if (!fighter.body) continue;

      // Clear expired emote
      if (fighter.status.emote && this.nowSec > fighter.status.emoteUntil) {
        fighter.status.emote = null;
      }

      // Regenerate balance gradually when not stunned
      const isStunned = fighter.status.stunnedUntil > this.nowSec;
      const isFrozen = fighter.status.frozenUntil > this.nowSec;

      if (!isStunned) {
        fighter.status.balance = Math.min(
          fighter.status.maxBalance,
          fighter.status.balance + BALANCE_REGEN_PER_SEC * dt,
        );
      }

      // Toggle ragdoll-lite capsule rotation lock on stun transitions
      if (isStunned && !fighter.wasStunned) {
        fighter.wasStunned = true;
        fighter.body.setEnabledRotations(true, true, true, true);
        fighter.body.applyTorqueImpulse(
          {
            x: (Math.random() - 0.5) * 1.8,
            y: (Math.random() - 0.5) * 1.0,
            z: (Math.random() - 0.5) * 1.8,
          },
          true,
        );
      } else if (!isStunned && fighter.wasStunned) {
        fighter.wasStunned = false;
        fighter.wakeupUntil = this.nowSec + WAKEUP_ANIM_SEC;
        fighter.status.stunImmuneUntil = this.nowSec + WAKEUP_IMMUNITY_SEC;
        fighter.body.setEnabledRotations(false, false, false, true);
        fighter.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
        fighter.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
        const curV = fighter.body.linvel();
        fighter.body.setLinvel(
          { x: curV.x * 0.35, y: Math.max(curV.y, 2.15), z: curV.z * 0.35 },
          true,
        );
        // Gentle wake-up shockwave push so enemies camping right on top give breathing room to counter
        for (const other of this.fighters.values()) {
          if (other.config.id === fighter.config.id || !other.status.alive || !other.body) continue;
          const dx = other.pos.x - fighter.pos.x;
          const dz = other.pos.z - fighter.pos.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 1.35) {
            const nx = dist > 0.05 ? dx / dist : 1;
            const nz = dist > 0.05 ? dz / dist : 0;
            const ov = other.body.linvel();
            other.body.setLinvel(
              { x: ov.x + nx * 2.8, y: Math.max(ov.y, 1.2), z: ov.z + nz * 2.8 },
              true,
            );
          }
        }
      }

      // If being held by another player, skip self control
      if (fighter.status.grabbedById) {
        this.syncFighterPartyMotion(fighter, false, dt);
        continue;
      }

      // Pick input source
      let input: FighterInput;
      if (fighter.config.isBot) {
        const selfView = botViews.find((v) => v.id === fighter.config.id)!;
        input = computeBotInput({
          self: selfView,
          others: botViews,
          items: this.items,
          elapsedSec: this.roundElapsedSec,
          nowSec: this.nowSec,
          difficulty: this.difficulty,
          memory: fighter.botMemory,
        });
      } else {
        input = params.humanInput;
        if (fighter.status.invertedUntil > this.nowSec) {
          input = {
            ...input,
            moveX: -input.moveX,
            moveZ: -input.moveZ,
          };
        }
      }

      // Trigger emote anytime while alive
      if (input.emote) {
        fighter.status.emote = input.emote;
        fighter.status.emoteUntil = this.nowSec + 1.6;
      }

      const curVel = fighter.body.linvel();

      if (isFrozen) {
        fighter.body.setLinvel({ x: 0, y: curVel.y, z: 0 }, true);
        this.syncFighterPartyMotion(fighter, false, dt);
        continue;
      }

      if (isStunned) {
        // Apply strong ground friction while tumbling so capsules stop naturally instead of rolling off the whole map
        fighter.speedNorm = 0;
        if (fighter.pos.y <= 0.55) {
          const linDrag = Math.max(0, 1 - dt * 5.2);
          const angDrag = Math.max(0, 1 - dt * 6.5);
          const av = fighter.body.angvel();
          fighter.body.setLinvel(
            { x: curVel.x * linDrag, y: curVel.y, z: curVel.z * linDrag },
            true,
          );
          fighter.body.setAngvel(
            { x: av.x * angDrag, y: av.y * angDrag, z: av.z * angDrag },
            true,
          );
        }
        this.syncFighterPartyMotion(fighter, false, dt);
        continue;
      }

      // Transition airborne dropkick into belly slide on touchdown
      if (
        this.nowSec < fighter.dropkickUntil &&
        fighter.grounded &&
        !fighter.wasGrounded &&
        this.nowSec > fighter.dropkickUntil - DROPKICK_DURATION + 0.08
      ) {
        fighter.dropkickUntil = 0;
        fighter.dropkickSlideUntil = this.nowSec + DROPKICK_SLIDE_DURATION;
      }

      // Check item pickups
      this.tryPickUpItem(fighter);

      // Update facing yaw smoothly (approx 1/3 sec for 180 deg) with momentum slowdown on sharp turns
      const moveLen = Math.hypot(input.moveX, input.moveZ);
      let turnSpeedFactor = 1;
      const inLockedLunge =
        this.nowSec <= fighter.rollUntil ||
        this.nowSec <= fighter.dropkickUntil ||
        this.nowSec <= fighter.dropkickSlideUntil ||
        this.nowSec <= fighter.headbuttUntil;

      if (moveLen > 0.08 && !inLockedLunge) {
        const targetYaw = Math.atan2(input.moveX, input.moveZ);
        let diff = targetYaw - fighter.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const turnRate = fighter.grounded ? (input.sprint ? 7.8 : 9.5) : 3.5;
        fighter.yaw += diff * Math.min(1, dt * turnRate);
        // Slow down briefly when reversing direction sharply
        const alignment = Math.cos(diff);
        turnSpeedFactor = THREE.MathUtils.clamp(0.5 + 0.5 * alignment, 0.42, 1);
      }

      // Roll dodge activation
      if (
        input.roll &&
        fighter.status.rollCooldownUntil <= this.nowSec &&
        !fighter.status.grabbingTargetId &&
        this.nowSec > fighter.dropkickUntil
      ) {
        fighter.status.rollCooldownUntil = this.nowSec + ROLL_COOLDOWN;
        fighter.rollUntil = this.nowSec + ROLL_DURATION;
        const dirX = moveLen > 0.08 ? input.moveX / moveLen : Math.sin(fighter.yaw);
        const dirZ = moveLen > 0.08 ? input.moveZ / moveLen : Math.cos(fighter.yaw);
        fighter.rollDirX = dirX;
        fighter.rollDirZ = dirZ;
        fighter.yaw = Math.atan2(dirX, dirZ);
        playSfx('roll');
      }

      // Horizontal movement with weighty Party Animals inertia (sprint boost + skid on sharp turns)
      const isSprinting = Boolean(input.sprint && moveLen > 0.08 && !fighter.status.grabbingTargetId);
      const speedMult =
        (fighter.status.speedBoostUntil > this.nowSec ? SKATES_MULTIPLIER : 1) *
        (isSprinting ? SPRINT_MULTIPLIER : 1) *
        (fighter.status.grabbingTargetId ? 0.72 : 1) *
        turnSpeedFactor;

      let nextVx = curVel.x;
      let nextVz = curVel.z;

      if (this.nowSec <= fighter.dropkickUntil) {
        const kickAlpha = Math.min(1, dt * 16);
        nextVx = THREE.MathUtils.lerp(curVel.x, fighter.dropkickDirX * DROPKICK_SPEED, kickAlpha);
        nextVz = THREE.MathUtils.lerp(curVel.z, fighter.dropkickDirZ * DROPKICK_SPEED, kickAlpha);
      } else if (this.nowSec <= fighter.dropkickSlideUntil) {
        const slideDrag = Math.max(0, 1 - dt * 5.8);
        nextVx = curVel.x * slideDrag;
        nextVz = curVel.z * slideDrag;
      } else if (this.nowSec <= fighter.headbuttUntil) {
        const headAlpha = Math.min(1, dt * 16);
        nextVx = THREE.MathUtils.lerp(curVel.x, fighter.headbuttDirX * HEADBUTT_LUNGE_SPEED, headAlpha);
        nextVz = THREE.MathUtils.lerp(curVel.z, fighter.headbuttDirZ * HEADBUTT_LUNGE_SPEED, headAlpha);
      } else if (this.nowSec <= fighter.rollUntil) {
        const rollAlpha = Math.min(1, dt * 18);
        nextVx = THREE.MathUtils.lerp(curVel.x, fighter.rollDirX * ROLL_SPEED, rollAlpha);
        nextVz = THREE.MathUtils.lerp(curVel.z, fighter.rollDirZ * ROLL_SPEED, rollAlpha);
      } else if (this.nowSec < fighter.knockbackGraceUntil) {
        const drag = fighter.grounded ? Math.max(0, 1 - dt * 4.5) : 1;
        nextVx = curVel.x * drag;
        nextVz = curVel.z * drag;
      } else {
        const desiredVx = input.moveX * MOVE_SPEED * speedMult;
        const desiredVz = input.moveZ * MOVE_SPEED * speedMult;
        const isAccelerating = moveLen > 0.08;
        const rate = fighter.grounded
          ? isAccelerating
            ? isSprinting
              ? 6.8
              : 8.2
            : 5.8
          : 1.7;
        const alpha = Math.min(1, dt * rate);
        nextVx = THREE.MathUtils.lerp(curVel.x, desiredVx, alpha);
        nextVz = THREE.MathUtils.lerp(curVel.z, desiredVz, alpha);
      }

      let nextVy = curVel.y;
      if (input.jump && fighter.grounded && this.nowSec > fighter.dropkickSlideUntil) {
        nextVy = JUMP_VELOCITY;
        fighter.grounded = false;
      }

      fighter.body.setLinvel({ x: nextVx, y: nextVy, z: nextVz }, true);

      // Update waddle walk animation speed & phase
      const horizSpeed = Math.hypot(nextVx, nextVz);
      fighter.speedNorm = fighter.grounded
        ? THREE.MathUtils.clamp(horizSpeed / MOVE_SPEED, 0, 1.35)
        : 0;
      if (fighter.speedNorm > 0.08) {
        fighter.walkPhase += dt * (9.5 + fighter.speedNorm * 4.5);
      }

      // Grab / throw state machine
      if (input.grabHeld) {
        if (!fighter.wasGrabHeld && !fighter.status.grabbingTargetId) {
          const target = this.findNearestEnemy(fighter, GRAB_RANGE);
          if (
            target &&
            !target.status.grabbedById &&
            !target.status.grabbingTargetId
          ) {
            fighter.status.grabbingTargetId = target.config.id;
            fighter.status.grabStartedAt = this.nowSec;
            target.status.grabbedById = fighter.config.id;
            playSfx('grab');
          }
        }
        fighter.wasGrabHeld = true;

        if (fighter.status.grabbingTargetId) {
          const held = this.fighters.get(fighter.status.grabbingTargetId);
          if (
            !held ||
            !held.status.alive ||
            !held.body ||
            this.nowSec - fighter.status.grabStartedAt > GRAB_MAX_DURATION
          ) {
            this.releaseGrab(fighter, false);
          } else {
            const anchorX = fighter.pos.x + Math.sin(fighter.yaw) * 1.15;
            const anchorY = fighter.pos.y + 0.55;
            const anchorZ = fighter.pos.z + Math.cos(fighter.yaw) * 1.15;
            held.body.setEnabledRotations(false, false, false, true);
            held.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
            held.body.setLinvel(
              {
                x: (anchorX - held.pos.x) * 14,
                y: (anchorY - held.pos.y) * 14,
                z: (anchorZ - held.pos.z) * 14,
              },
              true,
            );
          }
        }
      } else {
        if (fighter.wasGrabHeld && fighter.status.grabbingTargetId) {
          this.releaseGrab(fighter, true);
        }
        fighter.wasGrabHeld = false;
      }

      // Punch / Airborne Dropkick / Headbutt / Weapon attack
      if (input.headbutt && !fighter.status.grabbingTargetId) {
        this.performHeadbutt(fighter);
      }

      if (input.punch && !fighter.status.grabbingTargetId) {
        const holdingRanged =
          fighter.status.heldItem === 'snowball' ||
          fighter.status.heldItem === 'candy_bomb';
        if (
          !fighter.grounded &&
          !holdingRanged &&
          this.nowSec >= fighter.status.dropkickCooldownUntil
        ) {
          this.performDropkick(fighter);
        } else {
          this.performPunchOrUseItem(fighter);
        }
      }

      // Check active lunge hitboxes (Headbutt & Dropkick)
      this.stepActiveLungeHits(fighter);

      // Step spring-physics PartyMotionState
      this.syncFighterPartyMotion(fighter, isSprinting, dt);
    }

    // Step projectiles (snowballs + candy bombs)
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.fuseSec -= dt;
      p.vy += GRAVITY * 0.55 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      // Floor bounce inside arena safe radius
      const safeR = getSafeRadiusAt(this.roundElapsedSec);
      if (p.y <= 0.3 && Math.hypot(p.x, p.z) <= safeR + 1.2) {
        if (p.kind === 'snowball') {
          this.spawnHitEffect(p.x, 0.35, p.z, '#7DD3FC', 'punch');
          this.projectiles.splice(i, 1);
          continue;
        }
        p.y = 0.3;
        p.vy = Math.abs(p.vy) * 0.35;
        p.vx *= 0.82;
        p.vz *= 0.82;
      }

      // Snowball direct hit test
      if (p.kind === 'snowball') {
        let hit = false;
        for (const target of this.fighters.values()) {
          if (target.config.id === p.ownerId || !target.status.alive) continue;
          const dist = Math.hypot(target.pos.x - p.x, target.pos.z - p.z);
          if (dist < 0.85 && Math.abs(target.pos.y + 0.65 - p.y) < 1.0) {
            this.applyKnockbackHit(
              target,
              p.vx,
              p.vz,
              SNOWBALL_KNOCKBACK,
              3.4,
              SNOWBALL_BALANCE_DMG,
              '#38BDF8',
              'punch',
            );
            playSfx('punch');
            hit = true;
            break;
          }
        }
        if (hit || p.fuseSec <= 0 || p.y < FALL_OUT_Y) {
          this.projectiles.splice(i, 1);
        }
        continue;
      }

      // Candy bomb detonation
      if (p.fuseSec <= 0 || p.y < FALL_OUT_Y) {
        if (p.y > FALL_OUT_Y + 2) {
          this.detonateBomb(p.x, p.y, p.z);
        }
        this.projectiles.splice(i, 1);
      }
    }

    if (newlyEliminated.length > 0) {
      params.onEliminateBatch(newlyEliminated);
    }
  }

  getHudSnapshot(): HudSnapshot {
    const human = this.fighters.get('human');
    const st = human?.status;
    const now = this.nowSec;
    const collapseInfo = getNextCollapseInfo(this.roundElapsedSec);

    let aliveCount = 0;
    for (const f of this.fighters.values()) {
      if (f.status.alive) aliveCount += 1;
    }

    const playerGrounded = Boolean(human?.grounded);
    const holdingRanged =
      st?.heldItem === 'snowball' || st?.heldItem === 'candy_bomb';
    const useDropkickCd = !playerGrounded && !holdingRanged;
    const punchCd = useDropkickCd
      ? getCooldownState(st?.dropkickCooldownUntil ?? 0, now, DROPKICK_COOLDOWN)
      : getCooldownState(st?.punchCooldownUntil ?? 0, now, PUNCH_COOLDOWN);
    const headbuttCd = getCooldownState(
      st?.headbuttCooldownUntil ?? 0,
      now,
      HEADBUTT_COOLDOWN,
    );
    const rollCd = getCooldownState(
      st?.rollCooldownUntil ?? 0,
      now,
      ROLL_COOLDOWN,
    );
    const grabbedTarget = st?.grabbingTargetId
      ? this.fighters.get(st.grabbingTargetId)?.config.name ?? null
      : null;

    return {
      aliveCount,
      totalFighters: this.fighters.size,
      roundElapsedSec: this.roundElapsedSec,
      nextCollapseRing: collapseInfo.ring,
      nextCollapseInSec: collapseInfo.inSec,
      isRingWarning: collapseInfo.warning,
      playerAlive: Boolean(st?.alive),
      playerGrounded,
      playerBalance: st?.balance ?? 0,
      playerMaxBalance: st?.maxBalance ?? 100,
      playerStunned: Boolean(st && st.stunnedUntil > now),
      playerFrozen: Boolean(st && st.frozenUntil > now),
      playerInverted: Boolean(st && st.invertedUntil > now),
      playerSpeedLeft: st ? Math.max(0, st.speedBoostUntil - now) : 0,
      playerShieldLeft: st ? Math.max(0, st.shieldUntil - now) : 0,
      playerRollReadyPct: rollCd.readyPct,
      playerRollCooldownLeft: rollCd.remainingSec,
      playerPunchReadyPct: punchCd.readyPct,
      playerPunchCooldownLeft: punchCd.remainingSec,
      playerHeadbuttReadyPct: headbuttCd.readyPct,
      playerHeadbuttCooldownLeft: headbuttCd.remainingSec,
      playerHeldItem: st?.heldItem ?? null,
      playerHeldAmmo: st?.heldAmmo ?? 0,
      playerGrabbingName: grabbedTarget,
      bannerText: this.bannerText,
      koFeed: this.koFeed.map(({ id, text }) => ({ id, text })),
    };
  }
}
