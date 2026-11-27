import { useId } from 'react';
import { getAnimalAvatarTheme } from '../../components/animalAvatarMeta.ts';
import type { AnimalId } from '../../engine/types.ts';
import { getGearSpec, getWeaponSpec } from '../sim/catalog.ts';
import type { GearId, SkillId, WeaponId } from '../sim/types.ts';

interface IconProps {
  className?: string;
}

/**
 * Handcrafted SVG illustrations for the 6 primary PAWS Survival weapons.
 */
export function WeaponArt({
  weaponId,
  className = 'h-12 w-12',
}: IconProps & { weaponId: WeaponId }) {
  const uid = useId().replace(/:/g, '');

  switch (weaponId) {
    case 'candy_smg':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
          <defs>
            <linearGradient id={`smg-${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f9a8d4" />
              <stop offset="100%" stopColor="#db2777" />
            </linearGradient>
          </defs>
          {/* Glow */}
          <circle cx="32" cy="34" r="24" fill="#f472b6" opacity="0.14" />
          {/* Muzzle flash */}
          <path
            d="M52 24 L61 20 L56 26 L62 30 L53 29 Z"
            fill="#fde047"
            stroke="#f59e0b"
            strokeWidth="1.2"
          />
          {/* Stock */}
          <rect
            x="6"
            y="24"
            width="11"
            height="12"
            rx="3"
            fill="#9d174d"
            stroke="#1e1b2e"
            strokeWidth="2"
          />
          {/* Body */}
          <rect
            x="14"
            y="20"
            width="31"
            height="14"
            rx="4"
            fill={`url(#smg-${uid})`}
            stroke="#1e1b2e"
            strokeWidth="2.2"
          />
          {/* Candy stripes */}
          <path
            d="M21 21 L25 33 M29 21 L33 33 M37 21 L41 33"
            stroke="#fff1f2"
            strokeWidth="2.4"
            opacity="0.7"
          />
          {/* Barrel */}
          <rect
            x="44"
            y="23"
            width="10"
            height="6"
            rx="2"
            fill="#e2e8f0"
            stroke="#1e1b2e"
            strokeWidth="2"
          />
          {/* Sight */}
          <rect
            x="24"
            y="14"
            width="10"
            height="6"
            rx="2"
            fill="#38bdf8"
            stroke="#1e1b2e"
            strokeWidth="1.8"
          />
          {/* Magazine & Grip */}
          <path
            d="M32 34 L36 49 L42 47 L38 34 Z"
            fill="#fef08a"
            stroke="#1e1b2e"
            strokeWidth="2"
          />
          <path
            d="M17 34 L14 47 L21 48 L24 34 Z"
            fill="#831843"
            stroke="#1e1b2e"
            strokeWidth="2"
          />
        </svg>
      );

    case 'chestnut_shotgun':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
          <defs>
            <linearGradient id={`sg-${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fdba74" />
              <stop offset="100%" stopColor="#c2410c" />
            </linearGradient>
          </defs>
          <circle cx="32" cy="34" r="24" fill="#fb923c" opacity="0.14" />
          {/* Pellet blast cone */}
          <path
            d="M52 24 L62 15 M53 26 L63 26 M52 28 L61 36"
            stroke="#fde047"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          {/* Wooden stock */}
          <path
            d="M5 36 L19 27 L23 35 L10 46 Z"
            fill={`url(#sg-${uid})`}
            stroke="#1e1b2e"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          {/* Double barrel */}
          <rect
            x="21"
            y="20"
            width="31"
            height="6.5"
            rx="2"
            fill="#94a3b8"
            stroke="#1e1b2e"
            strokeWidth="2"
          />
          <rect
            x="21"
            y="26.5"
            width="29"
            height="6"
            rx="2"
            fill="#64748b"
            stroke="#1e1b2e"
            strokeWidth="2"
          />
          {/* Foregrip */}
          <rect
            x="27"
            y="30"
            width="14"
            height="7"
            rx="3"
            fill="#ea580c"
            stroke="#1e1b2e"
            strokeWidth="2"
          />
          {/* Brass shell accents */}
          <rect x="19" y="23" width="6" height="8" rx="1.5" fill="#facc15" stroke="#1e1b2e" strokeWidth="1.6" />
        </svg>
      );

    case 'frost_bow':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
          <defs>
            <linearGradient id={`bow-${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#bae6fd" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>
          </defs>
          <circle cx="32" cy="32" r="24" fill="#38bdf8" opacity="0.14" />
          {/* Bowstring */}
          <path
            d="M21 10 L14 32 L21 54"
            fill="none"
            stroke="#e0f2fe"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Ice bow limb */}
          <path
            d="M21 10 C42 12 46 24 44 32 C46 40 42 52 21 54 C33 46 37 39 36 32 C37 25 33 18 21 10 Z"
            fill={`url(#bow-${uid})`}
            stroke="#0c4a6e"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          {/* Arrow shaft */}
          <line
            x1="14"
            y1="32"
            x2="52"
            y2="32"
            stroke="#f0f9ff"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* Ice arrowhead */}
          <polygon
            points="59,32 47,25 50,32 47,39"
            fill="#7dd3fc"
            stroke="#0369a1"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          {/* Fletching */}
          <path d="M13 32 L8 27 M13 32 L8 37" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );

    case 'lightning_staff':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
          <defs>
            <linearGradient id={`stf-${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="100%" stopColor="#eab308" />
            </linearGradient>
          </defs>
          <circle cx="40" cy="22" r="19" fill="#facc15" opacity="0.18" />
          {/* Staff shaft */}
          <line
            x1="12"
            y1="54"
            x2="38"
            y2="26"
            stroke="#92400e"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <line
            x1="12"
            y1="54"
            x2="38"
            y2="26"
            stroke="#d97706"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          {/* Golden collar */}
          <circle cx="38" cy="26" r="5" fill="#f59e0b" stroke="#1e1b2e" strokeWidth="2" />
          {/* Crystal prism head */}
          <polygon
            points="44,8 54,20 44,31 35,19"
            fill={`url(#stf-${uid})`}
            stroke="#854d0e"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* Crackling bolts */}
          <path
            d="M27 14 L32 18 L29 22 M54 11 L59 15 L55 19 M51 31 L56 35 L52 39"
            fill="none"
            stroke="#fef9c3"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'candy_launcher':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
          <defs>
            <linearGradient id={`lnch-${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#d8b4fe" />
              <stop offset="100%" stopColor="#7e22ce" />
            </linearGradient>
          </defs>
          <circle cx="34" cy="34" r="24" fill="#c084fc" opacity="0.16" />
          {/* Candy bomb warhead */}
          <circle
            cx="50"
            cy="24"
            r="9"
            fill="#f472b6"
            stroke="#1e1b2e"
            strokeWidth="2.2"
          />
          <path d="M46 18 Q52 24 46 30" stroke="#fef08a" strokeWidth="2.5" fill="none" />
          {/* Heavy mortar tube */}
          <g transform="rotate(-24 30 34)">
            <rect
              x="10"
              y="22"
              width="38"
              height="20"
              rx="6"
              fill={`url(#lnch-${uid})`}
              stroke="#1e1b2e"
              strokeWidth="2.4"
            />
            <rect
              x="40"
              y="20"
              width="9"
              height="24"
              rx="3"
              fill="#facc15"
              stroke="#1e1b2e"
              strokeWidth="2.2"
            />
            <rect
              x="18"
              y="26"
              width="15"
              height="5"
              rx="2.5"
              fill="#f3e8ff"
              opacity="0.55"
            />
          </g>
          {/* Handle */}
          <rect
            x="22"
            y="40"
            width="8"
            height="14"
            rx="3"
            fill="#4c1d95"
            stroke="#1e1b2e"
            strokeWidth="2"
          />
        </svg>
      );

    case 'snow_boomerang':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
          <defs>
            <linearGradient id={`boom-${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#cffafe" />
              <stop offset="100%" stopColor="#0891b2" />
            </linearGradient>
          </defs>
          {/* Spin trails */}
          <path
            d="M12 22 A24 24 0 0 1 46 12"
            fill="none"
            stroke="#67e8f9"
            strokeWidth="2.2"
            strokeDasharray="4 4"
            opacity="0.7"
          />
          <path
            d="M52 40 A24 24 0 0 1 20 52"
            fill="none"
            stroke="#a5f3fc"
            strokeWidth="2.2"
            strokeDasharray="4 4"
            opacity="0.7"
          />
          {/* Curved boomerang blade */}
          <path
            d="M15 47 C13 24 24 13 48 15 C53 15.5 54 22 48 23 C32 23 24 31 24 47 C24 53 16 53 15 47 Z"
            fill={`url(#boom-${uid})`}
            stroke="#0e7490"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          {/* Crystal stripes */}
          <path
            d="M27 24 L33 20 M20 35 L25 32"
            stroke="#ffffff"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <circle cx="24" cy="24" r="2.6" fill="#fef08a" />
        </svg>
      );
  }
}

/**
 * Handcrafted SVG illustrations for the 4 starting Support Gears.
 */
export function GearArt({
  gearId,
  className = 'h-11 w-11',
}: IconProps & { gearId: GearId }) {
  const uid = useId().replace(/:/g, '');

  switch (gearId) {
    case 'ice_skates':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
          <defs>
            <linearGradient id={`sk-${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#7dd3fc" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>
          </defs>
          <circle cx="34" cy="34" r="23" fill="#38bdf8" opacity="0.14" />
          {/* Speed wind lines */}
          <path
            d="M6 26 H16 M4 34 H14 M8 42 H15"
            stroke="#bae6fd"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          {/* Skate boot */}
          <path
            d="M22 14 H36 V30 C36 33 40 34 48 35 C52 36 53 42 48 43 H22 Z"
            fill={`url(#sk-${uid})`}
            stroke="#0c4a6e"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          {/* Fluffy cuff */}
          <rect
            x="20"
            y="12"
            width="18"
            height="6"
            rx="3"
            fill="#f8fafc"
            stroke="#0c4a6e"
            strokeWidth="1.8"
          />
          {/* Steel blade */}
          <path
            d="M19 50 H52 C55 50 57 47 56 44"
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <line x1="27" y1="43" x2="27" y2="50" stroke="#cbd5e1" strokeWidth="2.5" />
          <line x1="44" y1="43" x2="44" y2="50" stroke="#cbd5e1" strokeWidth="2.5" />
        </svg>
      );

    case 'plush_armor':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
          <defs>
            <linearGradient id={`arm-${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fde68a" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
          </defs>
          <circle cx="32" cy="32" r="23" fill="#f59e0b" opacity="0.14" />
          {/* Shield chestplate */}
          <path
            d="M32 8 L52 16 V32 C52 44 43 52 32 56 C21 52 12 44 12 32 V16 Z"
            fill={`url(#arm-${uid})`}
            stroke="#78350f"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          <path
            d="M32 13 L47 19 V32 C47 41 40 47 32 51 C24 47 17 41 17 32 V19 Z"
            fill="#fef3c7"
            opacity="0.32"
          />
          {/* Cute paw crest */}
          <ellipse cx="32" cy="37" rx="6.5" ry="5" fill="#78350f" />
          <circle cx="24.5" cy="29" r="2.7" fill="#78350f" />
          <circle cx="30" cy="26" r="2.7" fill="#78350f" />
          <circle cx="36" cy="26" r="2.7" fill="#78350f" />
          <circle cx="40.5" cy="29.5" r="2.5" fill="#78350f" />
        </svg>
      );

    case 'crystal_magnet':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
          <defs>
            <linearGradient id={`mag-${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#e879f9" />
              <stop offset="100%" stopColor="#7e22ce" />
            </linearGradient>
          </defs>
          <circle cx="32" cy="34" r="23" fill="#a855f7" opacity="0.16" />
          {/* U-magnet */}
          <path
            d="M16 24 V36 C16 46 23 53 32 53 C41 53 48 46 48 36 V24 H39 V36 C39 40 36 44 32 44 C28 44 25 40 25 36 V24 Z"
            fill={`url(#mag-${uid})`}
            stroke="#3b0764"
            strokeWidth="2.2"
          />
          {/* Metal tips */}
          <rect x="16" y="18" width="9" height="7" rx="1.5" fill="#e2e8f0" stroke="#3b0764" strokeWidth="1.8" />
          <rect x="39" y="18" width="9" height="7" rx="1.5" fill="#e2e8f0" stroke="#3b0764" strokeWidth="1.8" />
          {/* Magnetic wave + XP diamond */}
          <path d="M23 12 Q32 6 41 12" fill="none" stroke="#c084fc" strokeWidth="2" strokeLinecap="round" />
          <polygon points="32,12 36,18 32,24 28,18" fill="#4ade80" stroke="#15803d" strokeWidth="1.5" />
        </svg>
      );

    case 'golden_scope':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
          <defs>
            <linearGradient id={`scp-${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="100%" stopColor="#ca8a04" />
            </linearGradient>
          </defs>
          <circle cx="32" cy="32" r="23" fill="#eab308" opacity="0.15" />
          {/* Outer golden ring */}
          <circle cx="32" cy="32" r="19" fill="#0f172a" stroke={`url(#scp-${uid})`} strokeWidth="5" />
          {/* Glowing lens */}
          <circle cx="32" cy="32" r="13" fill="#0ea5e9" opacity="0.28" />
          {/* Crosshair */}
          <path
            d="M32 9 V23 M32 41 V55 M9 32 H23 M41 32 H55"
            stroke="#fde047"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <circle cx="32" cy="32" r="4" fill="#ef4444" stroke="#fef08a" strokeWidth="1.6" />
          {/* Crit sparkle */}
          <path d="M47 13 L49 17 L53 19 L49 21 L47 25 L45 21 L41 19 L45 17 Z" fill="#fef08a" />
        </svg>
      );
  }
}

/**
 * 14 distinctive abstract SVG emblems for Level-Up Skill Cards & HUD skill chips.
 * Designed for instant visual recognition so players remember each skill at a glance.
 */
export function SkillArt({
  skillId,
  className = 'h-12 w-12',
}: IconProps & { skillId: SkillId }) {
  const uid = useId().replace(/:/g, '');

  switch (skillId) {
    case 'multishot':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
          <circle cx="32" cy="32" r="28" fill="#f472b6" opacity="0.16" />
          {/* 3 fanning beams */}
          <path d="M12 32 L50 14 M12 32 L54 32 M12 32 L50 50" stroke="#f9a8d4" strokeWidth="2.8" strokeLinecap="round" opacity="0.65" />
          <polygon points="56,12 43,12 48,22" fill="#f472b6" stroke="#fff1f2" strokeWidth="1.6" />
          <polygon points="59,32 47,26 47,38" fill="#fb7185" stroke="#fff1f2" strokeWidth="1.6" />
          <polygon points="56,52 48,42 43,52" fill="#f472b6" stroke="#fff1f2" strokeWidth="1.6" />
          <circle cx="14" cy="32" r="5" fill="#fdf2f8" />
        </svg>
      );

    case 'fire_rate':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
          <circle cx="32" cy="32" r="28" fill="#fb7185" opacity="0.16" />
          {/* Triple speed chevrons */}
          <path d="M12 18 L24 32 L12 46" fill="none" stroke="#fda4af" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
          <path d="M25 16 L39 32 L25 48" fill="none" stroke="#fb7185" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M39 14 L54 32 L39 50" fill="none" stroke="#fde047" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );

    case 'damage_up':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
          <defs>
            <radialGradient id={`dmg-${uid}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="60%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#991b1b" />
            </radialGradient>
          </defs>
          <circle cx="32" cy="32" r="28" fill="#ef4444" opacity="0.16" />
          {/* Starburst shockwave */}
          <polygon
            points="32,6 39,22 57,17 45,32 57,47 39,42 32,58 25,42 7,47 19,32 7,17 25,22"
            fill={`url(#dmg-${uid})`}
            stroke="#fef2f2"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <circle cx="32" cy="32" r="7" fill="#fef9c3" />
        </svg>
      );

    case 'pierce_up':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
          <circle cx="32" cy="32" r="28" fill="#38bdf8" opacity="0.16" />
          {/* Pierced rings */}
          <ellipse cx="22" cy="38" rx="6" ry="13" fill="none" stroke="#7dd3fc" strokeWidth="3" transform="rotate(-35 22 38)" />
          <ellipse cx="34" cy="30" rx="6" ry="14" fill="none" stroke="#38bdf8" strokeWidth="3" transform="rotate(-35 34 30)" />
          {/* Piercing lance */}
          <line x1="10" y1="52" x2="50" y2="14" stroke="#f0f9ff" strokeWidth="4.5" strokeLinecap="round" />
          <polygon points="56,8 42,13 51,22" fill="#38bdf8" stroke="#f0f9ff" strokeWidth="1.8" />
        </svg>
      );

    case 'ricochet':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
          <circle cx="32" cy="32" r="28" fill="#facc15" opacity="0.16" />
          {/* Zigzag bounce path */}
          <polyline
            points="10,48 25,18 41,44 54,14"
            fill="none"
            stroke="#facc15"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Bounce nodes */}
          <circle cx="25" cy="18" r="5" fill="#fef08a" stroke="#b45309" strokeWidth="2" />
          <circle cx="41" cy="44" r="5" fill="#fef08a" stroke="#b45309" strokeWidth="2" />
          <polygon points="57,10 47,15 55,21" fill="#fde047" />
        </svg>
      );

    case 'orbital_ice':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
          <circle cx="32" cy="32" r="28" fill="#67e8f9" opacity="0.15" />
          <circle cx="32" cy="32" r="19" fill="none" stroke="#67e8f9" strokeWidth="2.5" strokeDasharray="6 5" />
          <circle cx="32" cy="32" r="6" fill="#0e7490" stroke="#cffafe" strokeWidth="2" />
          {/* 3 orbiting ice spheres */}
          <circle cx="32" cy="13" r="6.5" fill="#a5f3fc" stroke="#0891b2" strokeWidth="2" />
          <circle cx="48.5" cy="41.5" r="6.5" fill="#67e8f9" stroke="#0891b2" strokeWidth="2" />
          <circle cx="15.5" cy="41.5" r="6.5" fill="#67e8f9" stroke="#0891b2" strokeWidth="2" />
        </svg>
      );

    case 'warm_aura':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
          <circle cx="32" cy="32" r="28" fill="#fb923c" opacity="0.16" />
          <circle cx="32" cy="32" r="22" fill="none" stroke="#f97316" strokeWidth="3.5" strokeDasharray="9 5" />
          <circle cx="32" cy="32" r="15" fill="#fb923c" opacity="0.28" stroke="#fdba74" strokeWidth="2" />
          {/* Abstract flame */}
          <path
            d="M32 16 C39 24 43 30 40 39 C38 44 35 46 32 46 C27 46 23 42 23 36 C23 30 27 25 32 16 Z"
            fill="#fb923c"
            stroke="#fff7ed"
            strokeWidth="1.8"
          />
          <path
            d="M32 27 C35 31 36 35 35 39 C34 41 30 41 29 38 C28 35 29 31 32 27 Z"
            fill="#fef08a"
          />
        </svg>
      );

    case 'candy_meteor':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
          <circle cx="32" cy="32" r="28" fill="#c084fc" opacity="0.16" />
          {/* Fiery tail */}
          <path
            d="M52 10 L36 34 L28 26 Z"
            fill="#f59e0b"
            opacity="0.75"
          />
          <path d="M56 8 L33 31" stroke="#fde047" strokeWidth="3.5" strokeLinecap="round" />
          {/* Impact ring */}
          <ellipse cx="26" cy="44" rx="18" ry="7" fill="none" stroke="#e879f9" strokeWidth="2.5" strokeDasharray="5 4" />
          {/* Meteor core */}
          <circle cx="28" cy="36" r="11" fill="#a855f7" stroke="#fdf4ff" strokeWidth="2.2" />
          <circle cx="25" cy="33" r="3" fill="#f9a8d4" />
          <circle cx="32" cy="39" r="2.2" fill="#fde047" />
        </svg>
      );

    case 'plush_drone':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
          <circle cx="32" cy="32" r="28" fill="#34d399" opacity="0.16" />
          {/* Laser beam */}
          <line x1="32" y1="38" x2="32" y2="56" stroke="#6ee7b7" strokeWidth="3.5" strokeLinecap="round" />
          {/* Rotor wings */}
          <ellipse cx="14" cy="24" rx="8" ry="3" fill="#a7f3d0" />
          <ellipse cx="50" cy="24" rx="8" ry="3" fill="#a7f3d0" />
          {/* Drone hull */}
          <rect x="18" y="21" width="28" height="18" rx="9" fill="#10b981" stroke="#ecfdf5" strokeWidth="2.2" />
          {/* Visor & eyes */}
          <rect x="23" y="26" width="18" height="8" rx="4" fill="#064e3b" />
          <circle cx="28" cy="30" r="2.2" fill="#fde047" />
          <circle cx="36" cy="30" r="2.2" fill="#fde047" />
        </svg>
      );

    case 'max_hp':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
          <circle cx="32" cy="32" r="28" fill="#4ade80" opacity="0.16" />
          {/* Heart */}
          <path
            d="M32 52 C32 52 12 40 12 24 C12 16 18 12 24 12 C28 12 30.5 14.5 32 17 C33.5 14.5 36 12 40 12 C46 12 52 16 52 24 C52 40 32 52 32 52 Z"
            fill="#22c55e"
            stroke="#dcfce7"
            strokeWidth="2.2"
          />
          {/* Plus sign */}
          <path d="M32 23 V39 M24 31 H40" stroke="#ffffff" strokeWidth="4.2" strokeLinecap="round" />
        </svg>
      );

    case 'vampirism':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
          <circle cx="32" cy="32" r="28" fill="#f43f5e" opacity="0.16" />
          {/* Abstract wings */}
          <path
            d="M28 32 C20 22 10 22 8 30 C13 31 15 36 12 41 C18 39 24 38 28 35 Z"
            fill="#be123c"
          />
          <path
            d="M36 32 C44 22 54 22 56 30 C51 31 49 36 52 41 C46 39 40 38 36 35 Z"
            fill="#be123c"
          />
          {/* Vitality droplet */}
          <path
            d="M32 13 C39 24 43 32 43 38 C43 44.5 38 49 32 49 C26 49 21 44.5 21 38 C21 32 25 24 32 13 Z"
            fill="#f43f5e"
            stroke="#ffe4e6"
            strokeWidth="2.2"
          />
          <path d="M27 36 C27 33 28.5 30 30 28" stroke="#fecdd3" strokeWidth="2.4" strokeLinecap="round" fill="none" />
        </svg>
      );

    case 'magnet_range':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
          <circle cx="32" cy="32" r="28" fill="#a855f7" opacity="0.16" />
          {/* Pulse rings */}
          <circle cx="32" cy="32" r="22" fill="none" stroke="#c084fc" strokeWidth="2" strokeDasharray="4 4" />
          <circle cx="32" cy="32" r="14" fill="none" stroke="#e879f9" strokeWidth="2" opacity="0.75" />
          {/* 3 pulled XP gems */}
          <polygon points="14,18 19,23 14,28 9,23" fill="#4ade80" stroke="#ffffff" strokeWidth="1.2" />
          <polygon points="50,18 55,23 50,28 45,23" fill="#38bdf8" stroke="#ffffff" strokeWidth="1.2" />
          <polygon points="32,44 38,50 32,56 26,50" fill="#facc15" stroke="#ffffff" strokeWidth="1.2" />
          {/* Core magnet */}
          <circle cx="32" cy="31" r="7" fill="#a855f7" stroke="#f5d0fe" strokeWidth="2.2" />
        </svg>
      );

    case 'agility':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
          <circle cx="32" cy="32" r="28" fill="#22d3ee" opacity="0.16" />
          {/* Wind trails */}
          <path d="M9 28 H23 M7 36 H20 M11 44 H25" stroke="#a5f3fc" strokeWidth="3" strokeLinecap="round" />
          {/* Sweeping wing */}
          <path
            d="M22 44 C26 24 38 14 55 15 C48 22 47 26 52 27 C44 32 42 36 47 37 C37 42 30 45 22 44 Z"
            fill="#22d3ee"
            stroke="#ecfeff"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'team_aura':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
          <circle cx="32" cy="32" r="28" fill="#fbbf24" opacity="0.16" />
          {/* Golden halo */}
          <circle cx="32" cy="32" r="21" fill="none" stroke="#fbbf24" strokeWidth="2.8" strokeDasharray="7 4" />
          {/* Triangle links */}
          <polygon points="32,17 45,41 19,41" fill="rgba(74,222,128,0.22)" stroke="#fef08a" strokeWidth="2" />
          {/* 3 comrade nodes */}
          <circle cx="32" cy="17" r="6" fill="#fde047" stroke="#78350f" strokeWidth="2" />
          <circle cx="45" cy="41" r="6" fill="#4ade80" stroke="#14532d" strokeWidth="2" />
          <circle cx="19" cy="41" r="6" fill="#38bdf8" stroke="#0c4a6e" strokeWidth="2" />
        </svg>
      );
  }
}

/**
 * Live visual loadout preview stage showing the selected PAWS plush animal
 * holding the selected weapon with an ambient gear aura ring.
 */
export function HeroLoadoutPreview({
  animal,
  weaponId,
  gearId,
}: {
  animal: AnimalId;
  weaponId: WeaponId;
  gearId: GearId;
}) {
  const uid = useId().replace(/:/g, '');
  const theme = getAnimalAvatarTheme(animal);
  const weapon = getWeaponSpec(weaponId);
  const gear = getGearSpec(gearId);

  return (
    <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-amber-400/35 bg-[#0c1220] bg-[radial-gradient(circle_at_50%_42%,_rgba(251,191,36,0.16)_0%,_rgba(12,18,32,0.96)_72%)] p-4 shadow-xl">
      {/* Live Character + Weapon + Gear Visual Stage */}
      <div className="relative flex h-32 w-full max-w-[14rem] items-center justify-center">
        <svg
          viewBox="0 0 156 132"
          role="img"
          aria-label={`Xem trước ${theme.label} cầm ${weapon.name} và đeo ${gear.name}`}
          className="h-32 w-40"
        >
          <defs>
            <radialGradient id={`hero-body-${uid}`} cx="38%" cy="32%" r="68%">
              <stop offset="0%" stopColor={theme.bgStart} />
              <stop offset="100%" stopColor={theme.bgEnd} />
            </radialGradient>
          </defs>

          {/* Gear Aura Floor Ring */}
          <ellipse
            cx="78"
            cy="104"
            rx="50"
            ry="16"
            fill={gear.color}
            opacity="0.18"
          />
          <ellipse
            cx="78"
            cy="104"
            rx="50"
            ry="16"
            fill="none"
            stroke={gear.color}
            strokeWidth="2.4"
            strokeDasharray="8 6"
            opacity="0.78"
          />

          {/* Character Ground Shadow */}
          <ellipse cx="78" cy="102" rx="28" ry="10" fill="rgba(0,0,0,0.45)" />

          {/* Animal-specific Ears / Crest */}
          {animal === 'bunny' && (
            <g stroke="#1e1b18" strokeWidth="2.4">
              <ellipse cx="64" cy="26" rx="8" ry="20" fill={theme.bgStart} transform="rotate(-12 64 26)" />
              <ellipse cx="92" cy="26" rx="8" ry="20" fill={theme.bgStart} transform="rotate(12 92 26)" />
              <ellipse cx="64" cy="28" rx="4" ry="12" fill="#fda4af" stroke="none" transform="rotate(-12 64 28)" />
              <ellipse cx="92" cy="28" rx="4" ry="12" fill="#fda4af" stroke="none" transform="rotate(12 92 28)" />
            </g>
          )}
          {animal === 'cat' && (
            <g stroke="#1e1b18" strokeWidth="2.4" strokeLinejoin="round">
              <polygon points="52,52 54,24 72,42" fill={theme.bgEnd} />
              <polygon points="104,52 102,24 84,42" fill={theme.bgEnd} />
              <polygon points="56,47 57,31 68,42" fill="#fda4af" stroke="none" />
              <polygon points="100,47 99,31 88,42" fill="#fda4af" stroke="none" />
            </g>
          )}
          {animal === 'dog' && (
            <g stroke="#1e1b18" strokeWidth="2.4">
              <ellipse cx="47" cy="60" rx="10" ry="18" fill={theme.bgEnd} transform="rotate(18 47 60)" />
              <ellipse cx="109" cy="60" rx="10" ry="18" fill={theme.bgEnd} transform="rotate(-18 109 60)" />
            </g>
          )}
          {animal === 'panda' && (
            <g stroke="#1e1b18" strokeWidth="2.4">
              <circle cx="55" cy="40" r="11" fill="#1e293b" />
              <circle cx="101" cy="40" r="11" fill="#1e293b" />
            </g>
          )}
          {animal === 'shark' && (
            <polygon
              points="78,16 66,44 92,44"
              fill={theme.bgEnd}
              stroke="#1e1b18"
              strokeWidth="2.4"
              strokeLinejoin="round"
            />
          )}
          {animal === 'dino' && (
            <g fill="#facc15" stroke="#1e1b18" strokeWidth="2" strokeLinejoin="round">
              <polygon points="64,34 72,20 78,34" />
              <polygon points="76,32 85,18 92,34" />
            </g>
          )}
          {(animal === 'duck' || animal === 'chicken') && (
            <g stroke="#1e1b18" strokeWidth="2">
              <circle cx="74" cy="34" r="6" fill={animal === 'chicken' ? '#f43f5e' : '#fef08a'} />
              <circle cx="83" cy="32" r="7" fill={animal === 'chicken' ? '#e11d48' : '#facc15'} />
            </g>
          )}

          {/* Plush Round Body */}
          <circle
            cx="78"
            cy="68"
            r="33"
            fill={`url(#hero-body-${uid})`}
            stroke="#1e1b18"
            strokeWidth="3"
          />

          {/* Panda eye patches */}
          {animal === 'panda' && (
            <g fill="#1e293b">
              <ellipse cx="66" cy="64" rx="7.5" ry="6" transform="rotate(-14 66 64)" />
              <ellipse cx="90" cy="64" rx="7.5" ry="6" transform="rotate(14 90 64)" />
            </g>
          )}

          {/* Cute Eyes & Cheeks */}
          <circle cx="67" cy="64" r="4.2" fill={animal === 'panda' ? '#ffffff' : '#1e1b18'} />
          <circle cx="89" cy="64" r="4.2" fill={animal === 'panda' ? '#ffffff' : '#1e1b18'} />
          <circle cx="68.5" cy="62.5" r="1.5" fill={animal === 'panda' ? '#1e1b18' : '#ffffff'} />
          <circle cx="90.5" cy="62.5" r="1.5" fill={animal === 'panda' ? '#1e1b18' : '#ffffff'} />
          <ellipse cx="58" cy="73" rx="5" ry="3" fill="#fb7185" opacity="0.55" />
          <ellipse cx="98" cy="73" rx="5" ry="3" fill="#fb7185" opacity="0.55" />

          {/* Beak or Snout */}
          {animal === 'duck' || animal === 'chicken' ? (
            <ellipse cx="78" cy="73" rx="8" ry="4.5" fill="#fb923c" stroke="#9a3412" strokeWidth="1.6" />
          ) : (
            <path
              d="M73 73 Q78 78 83 73"
              fill="none"
              stroke="#1e1b18"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          )}
        </svg>

        {/* Equipped Weapon Floating Right Beside Paw */}
        <div
          className="pointer-events-none absolute -right-1 top-6 flex h-16 w-16 items-center justify-center rounded-2xl border bg-[#121826]/90 shadow-lg"
          style={{ borderColor: `${weapon.color}66` }}
        >
          <WeaponArt weaponId={weaponId} className="h-14 w-14" />
        </div>

        {/* Equipped Gear Floating Left Badge */}
        <div
          className="pointer-events-none absolute -left-1 bottom-2 flex h-12 w-12 items-center justify-center rounded-2xl border bg-[#121826]/90 shadow-lg"
          style={{ borderColor: `${gear.color}66` }}
        >
          <GearArt gearId={gearId} className="h-10 w-10" />
        </div>
      </div>

      {/* Compact Loadout Strip */}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 text-center">
        <span className="font-display text-sm font-black text-white">
          {theme.label}
        </span>
        <span className="text-white/25" aria-hidden="true">·</span>
        <span className="text-xs font-black" style={{ color: weapon.color }}>
          {weapon.shortName}
        </span>
        <span className="text-white/25" aria-hidden="true">·</span>
        <span className="text-xs font-black" style={{ color: gear.color }}>
          {gear.name}
        </span>
      </div>
    </div>
  );
}
