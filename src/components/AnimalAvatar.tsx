import { useId } from 'react';
import type { AnimalId } from '../engine/types';
import {
  getAvatarFrameMeta,
  type AvatarFrameId,
} from '../blockblast/engine/avatarFrames';
import { getAnimalAvatarTheme } from './animalAvatarMeta';

export type AnimalAvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export interface AnimalAvatarProps {
  animal: AnimalId;
  size?: AnimalAvatarSize;
  frameId?: AvatarFrameId | null;
  className?: string;
  /** Pass a label only when the avatar is standalone without adjacent text. */
  label?: string;
}

const SIZE_CLASSES: Record<AnimalAvatarSize, string> = {
  xs: 'h-5 w-5',
  sm: 'h-6 w-6',
  md: 'h-9 w-9',
  lg: 'h-11 w-11',
  xl: 'h-14 w-14',
  '2xl': 'h-24 w-24',
};

function PlushEyes({
  y = 33,
  spread = 9.5,
  r = 3.1,
}: {
  y?: number;
  spread?: number;
  r?: number;
}) {
  return (
    <g>
      <circle cx={32 - spread} cy={y} r={r} fill="#1F1815" />
      <circle cx={32 - spread - r * 0.32} cy={y - r * 0.34} r={r * 0.36} fill="#FFFFFF" />
      <circle cx={32 + spread} cy={y} r={r} fill="#1F1815" />
      <circle cx={32 + spread - r * 0.32} cy={y - r * 0.34} r={r * 0.36} fill="#FFFFFF" />
    </g>
  );
}

function renderAnimalFace(animal: AnimalId) {
  switch (animal) {
    case 'dog':
      return (
        <g>
          {/* Pointy Corgi ears */}
          <path
            d="M14 29 L11 11 Q11 8 15 10 L25 19 Z"
            fill="#E89541"
            stroke="#9A5316"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M15.5 24 L14 13.5 L22 19.5 Z" fill="#FDE4C8" />
          <path
            d="M50 29 L53 11 Q53 8 49 10 L39 19 Z"
            fill="#E89541"
            stroke="#9A5316"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M48.5 24 L50 13.5 L42 19.5 Z" fill="#FDE4C8" />
          {/* Head & cream Corgi blaze/muzzle */}
          <ellipse
            cx="32"
            cy="35.5"
            rx="19.5"
            ry="17.5"
            fill="#E89541"
            stroke="#9A5316"
            strokeWidth="1.4"
          />
          <path
            d="M32 19 Q35 28 45 35 Q49 43 42 49 Q32 53 22 49 Q15 43 19 35 Q29 28 32 19 Z"
            fill="#FAF1E2"
          />
          {/* Red collar + gold charm peek */}
          <path
            d="M21 51.5 Q32 55.5 43 51.5 L44 56 Q32 59.5 20 56 Z"
            fill="#D43628"
          />
          <circle cx="32" cy="54.5" r="2.4" fill="#FACC15" stroke="#92400E" strokeWidth="0.9" />
          {/* Cheeks, eyes, nose & happy smile */}
          <ellipse cx="18.5" cy="39.5" rx="3.4" ry="2.1" fill="#F48C8C" opacity="0.6" />
          <ellipse cx="45.5" cy="39.5" rx="3.4" ry="2.1" fill="#F48C8C" opacity="0.6" />
          <PlushEyes y={33.5} spread={9} r={3.1} />
          <ellipse cx="32" cy="39" rx="3.2" ry="2.3" fill="#2A1D17" />
          <path
            d="M27.5 42.5 Q32 46.5 36.5 42.5"
            fill="none"
            stroke="#3B2416"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </g>
      );

    case 'cat':
      return (
        <g>
          {/* Pointed grey cat ears with dusty-pink interior */}
          <path
            d="M14 29 L13 11 Q13 9 16 11 L26 20 Z"
            fill="#777A84"
            stroke="#3F424B"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M16 25 L15.5 14 L23 20.5 Z" fill="#EFA8B2" />
          <path
            d="M50 29 L51 11 Q51 9 48 11 L38 20 Z"
            fill="#777A84"
            stroke="#3F424B"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M48 25 L48.5 14 L41 20.5 Z" fill="#EFA8B2" />
          {/* Plush grey head */}
          <ellipse
            cx="32"
            cy="36"
            rx="19.5"
            ry="17"
            fill="#777A84"
            stroke="#3F424B"
            strokeWidth="1.4"
          />
          {/* Forehead tabby marks */}
          <path
            d="M28 20.5 L28.5 25 M32 19.5 L32 25.5 M36 20.5 L35.5 25"
            stroke="#4E515C"
            strokeWidth="2.1"
            strokeLinecap="round"
          />
          {/* White lower muzzle */}
          <ellipse cx="32" cy="43.5" rx="12" ry="8" fill="#F5F1E9" />
          {/* Whiskers */}
          <path
            d="M11 37.5 L20 39 M11.5 42 L20 42 M53 37.5 L44 39 M52.5 42 L44 42"
            stroke="#ECEAE5"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          {/* Cheeks, eyes, pink triangle nose & :3 mouth */}
          <ellipse cx="19" cy="40.5" rx="3" ry="1.8" fill="#F4A3B1" opacity="0.65" />
          <ellipse cx="45" cy="40.5" rx="3" ry="1.8" fill="#F4A3B1" opacity="0.65" />
          <PlushEyes y={34} spread={8.8} r={3.1} />
          <path d="M29.5 38.5 L34.5 38.5 L32 41.3 Z" fill="#E8919C" />
          <path
            d="M27.5 43.2 Q30 45.8 32 43.2 Q34 45.8 36.5 43.2"
            fill="none"
            stroke="#3F424B"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      );

    case 'duck':
      return (
        <g>
          {/* Cute top feather tuft */}
          <path
            d="M28 19 Q26 11 31 13 Q34 9 36 15 Q39 13 37 19 Z"
            fill="#FAF5EC"
            stroke="#B47818"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          {/* Round fluffy white duck head */}
          <ellipse
            cx="32"
            cy="36"
            rx="19.5"
            ry="18"
            fill="#FAF5EC"
            stroke="#C28624"
            strokeWidth="1.4"
          />
          {/* Rosy cheeks & bright eyes */}
          <ellipse cx="18.5" cy="37.5" rx="3.5" ry="2.2" fill="#FDA4AF" opacity="0.72" />
          <ellipse cx="45.5" cy="37.5" rx="3.5" ry="2.2" fill="#FDA4AF" opacity="0.72" />
          <PlushEyes y={31.5} spread={9.2} r={3.1} />
          {/* Iconic wide orange duck bill */}
          <ellipse
            cx="32"
            cy="41.5"
            rx="10.5"
            ry="5.8"
            fill="#F58B16"
            stroke="#B45309"
            strokeWidth="1.4"
          />
          <ellipse cx="32" cy="39.5" rx="7.5" ry="2.3" fill="#FFA93A" />
          <path
            d="M24 41.8 Q32 45.2 40 41.8"
            fill="none"
            stroke="#9A3412"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </g>
      );

    case 'shark':
      return (
        <g>
          {/* Iconic shark dorsal fin on crown */}
          <path
            d="M26 20 Q29 7 39 10 Q35 16 37 21 Z"
            fill="#5275A1"
            stroke="#274060"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          {/* Round steel-blue plush shark head */}
          <ellipse
            cx="32"
            cy="36.5"
            rx="20"
            ry="17.5"
            fill="#678BB8"
            stroke="#274060"
            strokeWidth="1.4"
          />
          {/* White lower jaw / belly curve */}
          <path
            d="M14.5 41.5 Q32 34 49.5 41.5 Q45 53.5 32 54 Q19 53.5 14.5 41.5 Z"
            fill="#F6F4F0"
          />
          {/* Playful shark smile with cute little teeth */}
          <path
            d="M21.5 41.2 Q32 49.5 42.5 41.2 Q32 43.2 21.5 41.2 Z"
            fill="#243447"
          />
          <path
            d="M25.5 42 L27.5 45 L29.5 42.2 M30.2 42.4 L32 45.6 L33.8 42.4 M34.5 42.2 L36.5 45 L38.5 42"
            fill="#FFFFFF"
          />
          {/* Cheeks & bright eyes */}
          <ellipse cx="18.5" cy="38.5" rx="3" ry="1.8" fill="#F48C8C" opacity="0.55" />
          <ellipse cx="45.5" cy="38.5" rx="3" ry="1.8" fill="#F48C8C" opacity="0.55" />
          <PlushEyes y={33} spread={9.5} r={3.1} />
        </g>
      );

    case 'dino':
      return (
        <g>
          {/* Cute dino dorsal crest plates */}
          <path
            d="M22 20 L21 13 L27 17 Z M30 18 L32 10 L35 17 Z M38 19 L43 13 L43 21 Z"
            fill="#EFE9BE"
            stroke="#4D7426"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          {/* Plush green head */}
          <ellipse
            cx="32"
            cy="36.5"
            rx="19.5"
            ry="17.5"
            fill="#86B850"
            stroke="#4D7426"
            strokeWidth="1.4"
          />
          {/* Soft cream lower snout/belly */}
          <ellipse cx="32" cy="45.5" rx="13.5" ry="7.2" fill="#F7F1D8" />
          {/* Tiny dino nostrils */}
          <circle cx="29" cy="37.5" r="1.2" fill="#3F621E" />
          <circle cx="35" cy="37.5" r="1.2" fill="#3F621E" />
          {/* Cheeks, eyes & cheerful wide grin */}
          <ellipse cx="18.5" cy="39.5" rx="3.4" ry="2.1" fill="#F59E9E" opacity="0.65" />
          <ellipse cx="45.5" cy="39.5" rx="3.4" ry="2.1" fill="#F59E9E" opacity="0.65" />
          <PlushEyes y={32} spread={9.5} r={3.1} />
          <path
            d="M24.5 42.2 Q32 47.2 39.5 42.2"
            fill="none"
            stroke="#3F621E"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </g>
      );

    case 'panda':
      return (
        <g>
          {/* Round charcoal panda ears */}
          <circle cx="16.5" cy="19.5" r="7.2" fill="#332E2C" />
          <circle cx="47.5" cy="19.5" r="7.2" fill="#332E2C" />
          {/* Soft warm-white panda head */}
          <ellipse
            cx="32"
            cy="36.5"
            rx="19.5"
            ry="17.2"
            fill="#F6F3EC"
            stroke="#475569"
            strokeWidth="1.4"
          />
          {/* Iconic tilted charcoal eye patches */}
          <ellipse
            cx="22.5"
            cy="34.5"
            rx="6.2"
            ry="7.4"
            transform="rotate(18 22.5 34.5)"
            fill="#332E2C"
          />
          <ellipse
            cx="41.5"
            cy="34.5"
            rx="6.2"
            ry="7.4"
            transform="rotate(-18 41.5 34.5)"
            fill="#332E2C"
          />
          {/* Bright crisp eyes inside dark patches */}
          <circle cx="23.2" cy="34" r="2.6" fill="#FFFFFF" />
          <circle cx="23.4" cy="34.2" r="1.6" fill="#111827" />
          <circle cx="22.5" cy="33.2" r="0.8" fill="#FFFFFF" />
          <circle cx="40.8" cy="34" r="2.6" fill="#FFFFFF" />
          <circle cx="40.6" cy="34.2" r="1.6" fill="#111827" />
          <circle cx="39.7" cy="33.2" r="0.8" fill="#FFFFFF" />
          {/* Pink cheeks, little nose & smile */}
          <ellipse cx="17.5" cy="42.2" rx="3.1" ry="1.8" fill="#E8A2AE" opacity="0.75" />
          <ellipse cx="46.5" cy="42.2" rx="3.1" ry="1.8" fill="#E8A2AE" opacity="0.75" />
          <ellipse cx="32" cy="40.2" rx="3" ry="2" fill="#2A2422" />
          <path
            d="M28 43.8 Q32 46.8 36 43.8"
            fill="none"
            stroke="#2A2422"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </g>
      );

    case 'chicken':
      return (
        <g>
          {/* Bright red 3-lobed chicken comb on top */}
          <path
            d="M23.5 21 C21.5 14 27 11 29.5 15 C31 9.5 37.5 10.5 37 16 C40.5 13 44.5 16.5 41 21.5 Z"
            fill="#EF4444"
            stroke="#991B1B"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          {/* Fluffy cream-white head */}
          <ellipse
            cx="32"
            cy="37"
            rx="19.2"
            ry="17.2"
            fill="#FAF4E8"
            stroke="#B45353"
            strokeWidth="1.4"
          />
          {/* Cute red wattle drops beneath beak */}
          <ellipse cx="29.6" cy="45.2" rx="2.6" ry="3.4" fill="#EF4444" />
          <ellipse cx="34.4" cy="45.2" rx="2.6" ry="3.4" fill="#EF4444" />
          {/* Bright orange triangular beak */}
          <path
            d="M26.5 38.5 L37.5 38.5 L32 44.8 Z"
            fill="#FF9329"
            stroke="#B45309"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          <path d="M27.5 38.5 L32 35.5 L36.5 38.5 Z" fill="#FFB347" />
          {/* Cheeks & glossy eyes */}
          <ellipse cx="18.5" cy="39.5" rx="3.4" ry="2.1" fill="#FDA4AF" opacity="0.72" />
          <ellipse cx="45.5" cy="39.5" rx="3.4" ry="2.1" fill="#FDA4AF" opacity="0.72" />
          <PlushEyes y={33} spread={9.2} r={3.1} />
        </g>
      );

    case 'bunny':
      return (
        <g>
          {/* Tall iconic upright bunny ears with soft rose-pink interior */}
          <ellipse
            cx="23.5"
            cy="17"
            rx="5.4"
            ry="12.5"
            transform="rotate(-11 23.5 17)"
            fill="#FAF5F0"
            stroke="#BE5B85"
            strokeWidth="1.4"
          />
          <ellipse
            cx="23.7"
            cy="17.5"
            rx="2.8"
            ry="8.5"
            transform="rotate(-11 23.7 17.5)"
            fill="#F4B2BE"
          />
          <ellipse
            cx="40.5"
            cy="17"
            rx="5.4"
            ry="12.5"
            transform="rotate(11 40.5 17)"
            fill="#FAF5F0"
            stroke="#BE5B85"
            strokeWidth="1.4"
          />
          <ellipse
            cx="40.3"
            cy="17.5"
            rx="2.8"
            ry="8.5"
            transform="rotate(11 40.3 17.5)"
            fill="#F4B2BE"
          />
          {/* Plump cream-white bunny head */}
          <ellipse
            cx="32"
            cy="39"
            rx="18.5"
            ry="15.5"
            fill="#FAF5F0"
            stroke="#BE5B85"
            strokeWidth="1.4"
          />
          {/* Rosy cheeks, shiny eyes, tiny pink nose & cute w-mouth */}
          <ellipse cx="19" cy="42.5" rx="3.4" ry="2" fill="#F9A8D4" opacity="0.75" />
          <ellipse cx="45" cy="42.5" rx="3.4" ry="2" fill="#F9A8D4" opacity="0.75" />
          <PlushEyes y={36.5} spread={8.5} r={3} />
          <path d="M29.6 40.5 L34.4 40.5 L32 43.2 Z" fill="#EC4899" />
          <path
            d="M27.8 45 Q30 47.4 32 45 Q34 47.4 36.2 45"
            fill="none"
            stroke="#7A3555"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      );
  }
}

/**
 * Reusable chibi plush SVG portrait avatar for all 8 playable 3D animals.
 * Zero WebGL contexts, instant first paint, and crisp at every UI scale.
 */
function renderAvatarFrameOverlay(frameId: AvatarFrameId, uid: string) {
  const gradId = `${uid}-frame-grad`;
  switch (frameId) {
    case 'frame_stage_5':
      return (
        <svg
          viewBox="0 0 80 80"
          className="pointer-events-none absolute -inset-[14%] h-[128%] w-[128%] overflow-visible"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#67E8F9" />
              <stop offset="50%" stopColor="#A78BFA" />
              <stop offset="100%" stopColor="#38BDF8" />
            </linearGradient>
          </defs>
          <circle cx="40" cy="40" r="33.5" fill="none" stroke={`url(#${gradId})`} strokeWidth="3.8" />
          <circle cx="40" cy="40" r="36.5" fill="none" stroke="#E0F2FE" strokeWidth="1" strokeDasharray="3 4" opacity="0.85" />
          <polygon points="40,1 42.2,6.4 47.6,8.6 42.2,10.8 40,16.2 37.8,10.8 32.4,8.6 37.8,6.4" fill="#FEF3C7" stroke="#6366F1" strokeWidth="0.8" />
          <circle cx="13" cy="18" r="2.2" fill="#67E8F9" />
          <circle cx="67" cy="18" r="2.2" fill="#C4B5FD" />
          <circle cx="14" cy="63" r="1.8" fill="#C4B5FD" />
          <circle cx="66" cy="63" r="1.8" fill="#67E8F9" />
        </svg>
      );
    case 'frame_stage_10':
      return (
        <svg
          viewBox="0 0 80 80"
          className="pointer-events-none absolute -inset-[15%] h-[130%] w-[130%] overflow-visible"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FEF08A" />
              <stop offset="35%" stopColor="#67E8F9" />
              <stop offset="70%" stopColor="#E879F9" />
              <stop offset="100%" stopColor="#FACC15" />
            </linearGradient>
          </defs>
          <circle cx="40" cy="40" r="33.5" fill="none" stroke={`url(#${gradId})`} strokeWidth="4.4" />
          <circle cx="40" cy="40" r="37.2" fill="none" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.7" />
          <polygon points="40,0 45,7.5 40,14 35,7.5" fill="#FEF08A" stroke="#D946EF" strokeWidth="1.1" />
          <polygon points="10,40 5,36 1,40 5,44" fill="#67E8F9" />
          <polygon points="70,40 75,36 79,40 75,44" fill="#F0ABFC" />
          <polygon points="40,70 43.5,74.5 40,79 36.5,74.5" fill="#FFFFFF" />
        </svg>
      );
    case 'frame_stage_15':
      return (
        <svg
          viewBox="0 0 80 80"
          className="pointer-events-none absolute -inset-[16%] h-[132%] w-[132%] overflow-visible"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#DC2626" />
              <stop offset="50%" stopColor="#FB923C" />
              <stop offset="100%" stopColor="#FEF08A" />
            </linearGradient>
          </defs>
          <circle cx="40" cy="40" r="33.5" fill="none" stroke={`url(#${gradId})`} strokeWidth="4.6" />
          <path d="M12 52 C2 44 2 28 14 20 C9 30 11 40 16 47 Z" fill="#FB923C" stroke="#FEF08A" strokeWidth="1" />
          <path d="M68 52 C78 44 78 28 66 20 C71 30 69 40 64 47 Z" fill="#FB923C" stroke="#FEF08A" strokeWidth="1" />
          <path d="M40 0 C45 6 47 10 40 16 C33 10 35 6 40 0 Z" fill="#FACC15" stroke="#FFF7ED" strokeWidth="1.1" />
          <circle cx="40" cy="74" r="2.6" fill="#FDE047" />
        </svg>
      );
    case 'frame_stage_20':
      return (
        <svg
          viewBox="0 0 80 80"
          className="pointer-events-none absolute -inset-[18%] h-[136%] w-[136%] overflow-visible"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FEF08A" />
              <stop offset="45%" stopColor="#34D399" />
              <stop offset="75%" stopColor="#A855F7" />
              <stop offset="100%" stopColor="#FACC15" />
            </linearGradient>
          </defs>
          <circle cx="40" cy="40" r="33.5" fill="none" stroke={`url(#${gradId})`} strokeWidth="5" />
          <circle cx="40" cy="40" r="38" fill="none" stroke="#FEF08A" strokeWidth="1.4" strokeDasharray="5 3" opacity="0.9" />
          <path d="M27 11 L32 2 L40 8 L48 2 L53 11 Z" fill="#FACC15" stroke="#FFFFFF" strokeWidth="1.1" strokeLinejoin="round" />
          <circle cx="40" cy="7.5" r="2" fill="#34D399" />
          <polygon points="4,40 9,37 12,40 9,43" fill="#FEF08A" />
          <polygon points="76,40 71,37 68,40 71,43" fill="#6EE7B7" />
          <polygon points="40,79 43,74 40,69 37,74" fill="#FEF08A" />
        </svg>
      );
  }
}

/**
 * High-contrast, friendly 2D plush animal portrait avatar built on a unified 64x64 viewBox.
 */
export function AnimalAvatar({
  animal,
  size = 'md',
  frameId = null,
  className = '',
  label,
}: AnimalAvatarProps) {
  const uid = useId();
  const theme = getAnimalAvatarTheme(animal);
  const frameMeta = getAvatarFrameMeta(frameId);
  const bgGradId = `${uid}-bg`;
  const clipId = `${uid}-clip`;
  const sheenId = `${uid}-sheen`;

  return (
    <span
      className={`pointer-events-none relative inline-flex shrink-0 items-center justify-center rounded-full shadow-md ${
        frameMeta ? 'overflow-visible' : 'overflow-clip ring-2 ring-white/35'
      } ${SIZE_CLASSES[size]} ${className}`}
      style={
        frameMeta
          ? { boxShadow: `0 0 14px ${frameMeta.glowRgba}` }
          : undefined
      }
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <span className="block h-full w-full overflow-clip rounded-full">
        <svg
          viewBox="0 0 64 64"
          className="block h-full w-full"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <radialGradient id={bgGradId} cx="32%" cy="24%" r="76%">
              <stop offset="0%" stopColor={theme.bgStart} />
              <stop offset="100%" stopColor={theme.bgEnd} />
            </radialGradient>
            <linearGradient id={sheenId} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.28" />
              <stop offset="48%" stopColor="#FFFFFF" stopOpacity="0" />
            </linearGradient>
            <clipPath id={clipId}>
              <circle cx="32" cy="32" r="31" />
            </clipPath>
          </defs>

          <g clipPath={`url(#${clipId})`}>
            <circle cx="32" cy="32" r="32" fill={`url(#${bgGradId})`} />
            {renderAnimalFace(animal)}
            <ellipse cx="32" cy="14" rx="24" ry="12" fill={`url(#${sheenId})`} />
          </g>
        </svg>
      </span>
      {frameMeta && renderAvatarFrameOverlay(frameMeta.id, uid)}
    </span>
  );
}
