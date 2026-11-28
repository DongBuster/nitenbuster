import type { ReactNode } from 'react';
import type { StageThemeId } from '../engine/stages.ts';

interface StageFrameOrnamentsProps {
  stageId: StageThemeId;
}

interface CornerTransform {
  readonly key: string;
  readonly posClass: string;
  readonly svgTransform: string;
}

const CORNERS: readonly CornerTransform[] = [
  { key: 'tl', posClass: '-left-[3px] -top-[3px] sm:-left-[4px] sm:-top-[4px]', svgTransform: '' },
  {
    key: 'tr',
    posClass: '-right-[3px] -top-[3px] sm:-right-[4px] sm:-top-[4px]',
    svgTransform: 'translate(36,0) scale(-1,1)',
  },
  {
    key: 'bl',
    posClass: '-left-[3px] -bottom-[3px] sm:-left-[4px] sm:-bottom-[4px]',
    svgTransform: 'translate(0,36) scale(1,-1)',
  },
  {
    key: 'br',
    posClass: '-right-[3px] -bottom-[3px] sm:-right-[4px] sm:-bottom-[4px]',
    svgTransform: 'translate(36,36) scale(-1,-1)',
  },
];

function renderCornerArtwork(stageId: StageThemeId): ReactNode {
  switch (stageId) {
    case 'timber':
      return (
        <>
          <path
            d="M4 28 V8 Q4 4 8 4 H28"
            fill="none"
            stroke="#E2A863"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M8 22 V9 Q8 8 9 8 H22"
            fill="none"
            stroke="#FDE68A"
            strokeOpacity="0.45"
            strokeWidth="1"
          />
          <circle cx="8" cy="8" r="2.2" fill="#FDE68A" stroke="#78350F" strokeWidth="1" />
          <circle cx="20" cy="6.5" r="1.3" fill="#E2A863" />
          <circle cx="6.5" cy="20" r="1.3" fill="#E2A863" />
        </>
      );
    case 'aurora':
      return (
        <>
          <path
            d="M4 28 V9 L9 4 H28"
            fill="none"
            stroke="#7DD3FC"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M6 19 L11 11 L19 6"
            fill="none"
            stroke="#5EEAD4"
            strokeWidth="1.3"
            strokeOpacity="0.8"
          />
          <polygon points="10,4 13,10 10,16 7,10" fill="#BAE6FD" fillOpacity="0.85" />
          <polygon points="4,10 10,7 16,10 10,13" fill="#5EEAD4" fillOpacity="0.75" />
          <circle cx="10" cy="10" r="1.8" fill="#FFFFFF" />
        </>
      );
    case 'sakura':
      return (
        <>
          <path
            d="M5 30 Q4 12 10 8 Q14 4 30 5"
            fill="none"
            stroke="#F9A8D4"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <g transform="translate(11,11)">
            <circle cx="0" cy="-4.5" r="3.1" fill="#FBCFE8" />
            <circle cx="4.3" cy="-1.4" r="3.1" fill="#F472B6" />
            <circle cx="2.7" cy="3.6" r="3.1" fill="#FBCFE8" />
            <circle cx="-2.7" cy="3.6" r="3.1" fill="#F472B6" />
            <circle cx="-4.3" cy="-1.4" r="3.1" fill="#FBCFE8" />
            <circle cx="0" cy="0" r="1.9" fill="#FEF08A" />
          </g>
          <ellipse
            cx="23"
            cy="6"
            rx="2.8"
            ry="1.4"
            transform="rotate(-18 23 6)"
            fill="#F9A8D4"
            fillOpacity="0.85"
          />
          <ellipse
            cx="6"
            cy="23"
            rx="1.4"
            ry="2.8"
            transform="rotate(18 6 23)"
            fill="#F9A8D4"
            fillOpacity="0.85"
          />
        </>
      );
    case 'royal':
      return (
        <>
          <path
            d="M4 31 V12 C4 6 6 4 12 4 H31"
            fill="none"
            stroke="#FDE047"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M9 26 V13 C9 10 10 9 13 9 H26"
            fill="none"
            stroke="#FACC15"
            strokeWidth="1.2"
            strokeOpacity="0.75"
          />
          <path
            d="M12 18 C16 18 18 16 18 12 C18 8 14 7 12 10 C10 7 7 8 7 12 C7 16 9 18 12 18 Z"
            fill="none"
            stroke="#FEF08A"
            strokeWidth="1.2"
          />
          <polygon points="10,4 16,10 10,16 4,10" fill="#E11D48" stroke="#FEF08A" strokeWidth="1.2" />
          <circle cx="10" cy="10" r="1.4" fill="#FFE4E6" />
        </>
      );
    case 'celestial':
      return (
        <>
          <path
            d="M4 31 V10 L10 4 H31"
            fill="none"
            stroke="#C4B5FD"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M7 22 Q12 12 22 7"
            fill="none"
            stroke="#22D3EE"
            strokeWidth="1.1"
            strokeDasharray="2 2.5"
          />
          <polygon
            points="10,1 12.2,7.8 19,10 12.2,12.2 10,19 7.8,12.2 1,10 7.8,7.8"
            fill="#FEF3C7"
            stroke="#A78BFA"
            strokeWidth="0.9"
          />
          <circle cx="23" cy="6.5" r="1.6" fill="#67E8F9" />
          <circle cx="6.5" cy="23" r="1.6" fill="#67E8F9" />
          <circle cx="10" cy="10" r="1.8" fill="#FFFFFF" />
        </>
      );
    case 'inferno':
      return (
        <>
          <path
            d="M4 31 V11 L11 4 H31"
            fill="none"
            stroke="#FB923C"
            strokeWidth="2.3"
            strokeLinecap="round"
          />
          <path
            d="M7 23 C7 14 10 10 15 8 C12 13 13 16 17 14 C15 18 11 20 7 23 Z"
            fill="#F43F5E"
            stroke="#FED7AA"
            strokeWidth="1"
          />
          <polygon points="10,4 14,10 10,15 6,10" fill="#FDE68A" />
          <circle cx="23" cy="6.5" r="1.5" fill="#FB7185" />
          <circle cx="6.5" cy="23" r="1.5" fill="#FB7185" />
        </>
      );
    case 'emerald_jade':
      return (
        <>
          <path
            d="M4 31 V10 C4 6 6 4 10 4 H31"
            fill="none"
            stroke="#34D399"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M9 25 V12 C9 10 10 9 12 9 H25"
            fill="none"
            stroke="#FCD34D"
            strokeWidth="1.2"
          />
          <polygon
            points="10,3 15.5,6.2 15.5,12.8 10,16 4.5,12.8 4.5,6.2"
            fill="#10B981"
            stroke="#FEF3C7"
            strokeWidth="1.2"
          />
          <circle cx="10" cy="9.5" r="1.8" fill="#D1FAE5" />
        </>
      );
    case 'cyber_neon':
      return (
        <>
          <path
            d="M4 31 V12 L12 4 H31"
            fill="none"
            stroke="#22D3EE"
            strokeWidth="2.2"
            strokeLinecap="square"
          />
          <path
            d="M9 27 V15 L15 9 H27"
            fill="none"
            stroke="#EC4899"
            strokeWidth="1.4"
          />
          <rect x="7" y="7" width="6" height="6" fill="#06B6D4" stroke="#ECFEFF" strokeWidth="1" />
          <circle cx="24" cy="9" r="1.6" fill="#F472B6" />
          <circle cx="9" cy="24" r="1.6" fill="#F472B6" />
        </>
      );
    case 'eclipse':
      return (
        <>
          <path
            d="M4 31 V11 C4 6 6 4 11 4 H31"
            fill="none"
            stroke="#FB923C"
            strokeWidth="2.1"
            strokeLinecap="round"
          />
          <circle cx="11" cy="11" r="6" fill="#1E1038" stroke="#FDBA74" strokeWidth="1.6" />
          <circle cx="13" cy="9.5" r="4.5" fill="#0B0517" />
          <circle cx="23" cy="6.5" r="1.5" fill="#DDD6FE" />
          <circle cx="6.5" cy="23" r="1.5" fill="#DDD6FE" />
        </>
      );
    case 'prism_eternal':
      return (
        <>
          <path
            d="M4 32 V10 L10 4 H32"
            fill="none"
            stroke="#FDE047"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M8 26 V13 L13 8 H26"
            fill="none"
            stroke="#67E8F9"
            strokeWidth="1.3"
          />
          <polygon
            points="11,1 13.8,8.2 21,11 13.8,13.8 11,21 8.2,13.8 1,11 8.2,8.2"
            fill="#FAF5FF"
            stroke="#D946EF"
            strokeWidth="1.1"
          />
          <polygon points="11,5.5 16.5,11 11,16.5 5.5,11" fill="#FACC15" fillOpacity="0.85" />
          <circle cx="11" cy="11" r="2" fill="#FFFFFF" />
        </>
      );
    case 'abyss_ocean':
      return (
        <>
          <path d="M4 31 C4 14 14 4 31 4" fill="none" stroke="#38BDF8" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M9 24 Q12 12 24 9" fill="none" stroke="#5EEAD4" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="11" cy="11" r="4.5" fill="#0284C7" stroke="#CCFBF1" strokeWidth="1.2" />
          <circle cx="11" cy="11" r="1.8" fill="#5EEAD4" />
        </>
      );
    case 'golden_pharaoh':
      return (
        <>
          <path d="M4 31 V8 H8 V4 H31" fill="none" stroke="#FBBF24" strokeWidth="2.3" strokeLinecap="square" />
          <polygon points="11,4 18,16 4,16" fill="#D97706" stroke="#FEF3C7" strokeWidth="1.2" />
          <circle cx="11" cy="12" r="2" fill="#2563EB" stroke="#93C5FD" strokeWidth="0.9" />
        </>
      );
    case 'crimson_samurai':
      return (
        <>
          <path d="M4 31 V10 L10 4 H31" fill="none" stroke="#FB7185" strokeWidth="2.3" strokeLinecap="round" />
          <path d="M6 20 L18 8 M8 6 L20 18" stroke="#FDE68A" strokeWidth="1.4" strokeLinecap="round" />
          <polygon points="11,6 16,11 11,16 6,11" fill="#DC2626" stroke="#FEF9C3" strokeWidth="1.2" />
        </>
      );
    case 'frost_valkyrie':
      return (
        <>
          <path d="M4 31 V10 L10 4 H31" fill="none" stroke="#BAE6FD" strokeWidth="2.1" strokeLinecap="round" />
          <path d="M11 3 V19 M3 11 H19 M5.5 5.5 L16.5 16.5 M16.5 5.5 L5.5 16.5" stroke="#E0F2FE" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="11" cy="11" r="2.2" fill="#818CF8" stroke="#FFFFFF" strokeWidth="1" />
        </>
      );
    case 'solar_phoenix':
      return (
        <>
          <path d="M4 32 V11 Q4 4 11 4 H32" fill="none" stroke="#FB923C" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M5 24 C5 12 10 6 20 5 C14 11 15 15 21 13 C16 19 11 21 5 24 Z" fill="#FACC15" stroke="#EA580C" strokeWidth="1.1" />
          <circle cx="11" cy="11" r="2.1" fill="#FFFFFF" />
        </>
      );
    case 'void_nebula':
      return (
        <>
          <path d="M4 31 V10 L10 4 H31" fill="none" stroke="#C084FC" strokeWidth="2.1" strokeLinecap="round" />
          <circle cx="11" cy="11" r="6" fill="#2E1065" stroke="#F472B6" strokeWidth="1.3" strokeDasharray="3 2" />
          <circle cx="11" cy="11" r="2.6" fill="#F9A8D4" />
        </>
      );
    case 'jade_dragon':
      return (
        <>
          <path d="M4 31 C4 14 14 4 31 4" fill="none" stroke="#34D399" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M8 22 Q12 12 22 8" fill="none" stroke="#67E8F9" strokeWidth="1.6" />
          <polygon points="11,4 17,9 15,16 7,16 5,9" fill="#059669" stroke="#D1FAE5" strokeWidth="1.2" />
          <circle cx="11" cy="10.5" r="1.8" fill="#67E8F9" />
        </>
      );
    case 'arcane_clockwork':
      return (
        <>
          <path d="M4 31 V10 H10 V4 H31" fill="none" stroke="#F59E0B" strokeWidth="2.2" />
          <circle cx="11" cy="11" r="6" fill="none" stroke="#FCD34D" strokeWidth="2" strokeDasharray="2.5 2" />
          <circle cx="11" cy="11" r="2.8" fill="#6D28D9" stroke="#EDE9FE" strokeWidth="1" />
        </>
      );
    case 'supernova_core':
      return (
        <>
          <path d="M4 32 V10 L10 4 H32" fill="none" stroke="#FB7185" strokeWidth="2.3" strokeLinecap="round" />
          <polygon points="11,1 13.5,8.5 21,11 13.5,13.5 11,21 8.5,13.5 1,11 8.5,8.5" fill="#67E8F9" stroke="#F43F5E" strokeWidth="1.1" />
          <circle cx="11" cy="11" r="2.4" fill="#FFFFFF" />
        </>
      );
    case 'astral_sovereign':
      return (
        <>
          <path d="M3 32 V10 L10 3 H32" fill="none" stroke="#FEF08A" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M8 27 V13 L13 8 H27" fill="none" stroke="#6EE7B7" strokeWidth="1.5" />
          <polygon points="11,1 14,8 21,11 14,14 11,21 8,14 1,11 8,8" fill="#FEF08A" stroke="#10B981" strokeWidth="1.1" />
          <circle cx="11" cy="11" r="2.6" fill="#FFFFFF" />
          <circle cx="24" cy="6.5" r="1.7" fill="#6EE7B7" />
          <circle cx="6.5" cy="24" r="1.7" fill="#6EE7B7" />
        </>
      );
  }
}

function renderCrestSvg(stageId: StageThemeId): ReactNode {
  switch (stageId) {
    case 'timber':
      return (
        <svg className="h-[14px] w-[70px] sm:h-[16px] sm:w-[82px]" viewBox="0 0 64 14" overflow="visible">
          <rect x="6" y="4" width="52" height="5" rx="2.5" fill="#78350F" stroke="#E2A863" strokeWidth="1.2" />
          <circle cx="16" cy="6.5" r="1.3" fill="#FDE68A" />
          <circle cx="32" cy="6.5" r="1.7" fill="#FDE68A" />
          <circle cx="48" cy="6.5" r="1.3" fill="#FDE68A" />
        </svg>
      );
    case 'aurora':
      return (
        <svg className="h-[16px] w-[86px] sm:h-[18px] sm:w-[100px]" viewBox="0 0 80 16" overflow="visible">
          <path d="M4 8 Q24 2 40 8 Q56 14 76 8" fill="none" stroke="#5EEAD4" strokeWidth="2" strokeLinecap="round" />
          <polygon points="40,2 44,8 40,14 36,8" fill="#E0F2FE" stroke="#38BDF8" strokeWidth="1" />
        </svg>
      );
    case 'sakura':
      return (
        <svg className="h-[18px] w-[92px] sm:h-[20px] sm:w-[108px]" viewBox="0 0 84 18" overflow="visible">
          <path
            d="M8 9 C24 3 32 14 42 9 C52 4 60 15 76 9"
            fill="none"
            stroke="#F9A8D4"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="42" cy="6" r="2.3" fill="#FBCFE8" />
          <circle cx="45" cy="8.5" r="2.3" fill="#F472B6" />
          <circle cx="43.5" cy="11.5" r="2.3" fill="#FBCFE8" />
          <circle cx="40.5" cy="11.5" r="2.3" fill="#F472B6" />
          <circle cx="39" cy="8.5" r="2.3" fill="#FBCFE8" />
          <circle cx="42" cy="9" r="1.4" fill="#FEF08A" />
        </svg>
      );
    case 'royal':
      return (
        <svg className="h-[20px] w-[104px] sm:h-[22px] sm:w-[122px]" viewBox="0 0 96 20" overflow="visible">
          <path
            d="M8 12 H34 L40 4 L48 11 L56 4 L62 12 H88"
            fill="none"
            stroke="#FDE047"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <polygon points="48,5 53,10 48,15 43,10" fill="#E11D48" stroke="#FEF08A" strokeWidth="1.2" />
          <circle cx="30" cy="12" r="1.8" fill="#FDE047" />
          <circle cx="66" cy="12" r="1.8" fill="#FDE047" />
        </svg>
      );
    case 'celestial':
      return (
        <svg className="h-[20px] w-[112px] sm:h-[22px] sm:w-[132px]" viewBox="0 0 104 20" overflow="visible">
          <line x1="8" y1="10" x2="38" y2="10" stroke="#67E8F9" strokeWidth="1.2" strokeDasharray="3 2" />
          <line x1="66" y1="10" x2="96" y2="10" stroke="#67E8F9" strokeWidth="1.2" strokeDasharray="3 2" />
          <circle cx="52" cy="10" r="6" fill="#1E1B4B" stroke="#C4B5FD" strokeWidth="1.4" />
          <ellipse
            cx="52"
            cy="10"
            rx="11"
            ry="3.2"
            fill="none"
            stroke="#22D3EE"
            strokeWidth="1.1"
            transform="rotate(-14 52 10)"
          />
          <polygon
            points="52,4 53.5,8.5 58,10 53.5,11.5 52,16 50.5,11.5 46,10 50.5,8.5"
            fill="#FEF3C7"
          />
        </svg>
      );
    case 'inferno':
      return (
        <svg className="h-[22px] w-[116px] sm:h-[24px] sm:w-[136px]" viewBox="0 0 108 22" overflow="visible">
          <path
            d="M8 13 L36 13 L44 6 L54 14 L64 6 L72 13 L100 13"
            fill="none"
            stroke="#FB923C"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M54 3 C58 8 60 11 54 18 C48 11 50 8 54 3 Z"
            fill="#F43F5E"
            stroke="#FED7AA"
            strokeWidth="1.2"
          />
          <circle cx="54" cy="11" r="2" fill="#FEF08A" />
        </svg>
      );
    case 'emerald_jade':
      return (
        <svg className="h-[22px] w-[118px] sm:h-[24px] sm:w-[138px]" viewBox="0 0 108 22" overflow="visible">
          <path
            d="M8 11 Q26 4 42 11 M66 11 Q82 4 100 11"
            fill="none"
            stroke="#FCD34D"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <polygon
            points="54,3 61,7 61,15 54,19 47,15 47,7"
            fill="#10B981"
            stroke="#FEF3C7"
            strokeWidth="1.4"
          />
          <polygon points="54,6 58,11 54,16 50,11" fill="#D1FAE5" />
        </svg>
      );
    case 'cyber_neon':
      return (
        <svg className="h-[22px] w-[122px] sm:h-[24px] sm:w-[142px]" viewBox="0 0 112 22" overflow="visible">
          <path
            d="M6 11 H34 L40 5 H72 L78 11 H106"
            fill="none"
            stroke="#22D3EE"
            strokeWidth="2"
            strokeLinecap="square"
          />
          <path
            d="M22 15 H42 L48 11 H64 L70 15 H90"
            fill="none"
            stroke="#EC4899"
            strokeWidth="1.4"
          />
          <polygon points="56,3 63,11 56,19 49,11" fill="#06B6D4" stroke="#FCE7F3" strokeWidth="1.3" />
          <circle cx="56" cy="11" r="2.2" fill="#FFFFFF" />
        </svg>
      );
    case 'eclipse':
      return (
        <svg className="h-[22px] w-[124px] sm:h-[24px] sm:w-[144px]" viewBox="0 0 112 22" overflow="visible">
          <line x1="8" y1="11" x2="40" y2="11" stroke="#FB923C" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="72" y1="11" x2="104" y2="11" stroke="#FB923C" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="56" cy="11" r="7.5" fill="#130826" stroke="#FDBA74" strokeWidth="2" />
          <circle cx="56" cy="11" r="5" fill="#07030F" stroke="#A78BFA" strokeWidth="1" />
          <circle cx="34" cy="11" r="2" fill="#DDD6FE" />
          <circle cx="78" cy="11" r="2" fill="#DDD6FE" />
        </svg>
      );
    case 'prism_eternal':
      return (
        <svg className="h-[24px] w-[132px] sm:h-[26px] sm:w-[154px]" viewBox="0 0 120 24" overflow="visible">
          <path
            d="M6 12 H36 L44 5 L52 12 H68 L76 5 L84 12 H114"
            fill="none"
            stroke="#FDE047"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M16 16 H42 M78 16 H104"
            fill="none"
            stroke="#67E8F9"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <polygon
            points="60,1 64.5,8.5 72,12 64.5,15.5 60,23 55.5,15.5 48,12 55.5,8.5"
            fill="#FAF5FF"
            stroke="#D946EF"
            strokeWidth="1.3"
          />
          <polygon points="60,6 66,12 60,18 54,12" fill="#FACC15" />
          <circle cx="60" cy="12" r="2.2" fill="#FFFFFF" />
        </svg>
      );
    case 'abyss_ocean':
      return (
        <svg className="h-[22px] w-[126px] sm:h-[24px] sm:w-[148px]" viewBox="0 0 116 22" overflow="visible">
          <path d="M6 12 Q24 4 42 12 Q58 18 74 12 Q92 4 110 12" fill="none" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
          <circle cx="58" cy="11" r="6" fill="#0284C7" stroke="#5EEAD4" strokeWidth="1.6" />
          <circle cx="58" cy="11" r="2.2" fill="#CCFBF1" />
        </svg>
      );
    case 'golden_pharaoh':
      return (
        <svg className="h-[22px] w-[126px] sm:h-[24px] sm:w-[148px]" viewBox="0 0 116 22" overflow="visible">
          <path d="M8 15 H42 L58 3 L74 15 H108" fill="none" stroke="#FBBF24" strokeWidth="2.1" strokeLinejoin="round" />
          <polygon points="58,5 68,17 48,17" fill="#D97706" stroke="#FEF3C7" strokeWidth="1.2" />
          <circle cx="58" cy="13" r="2.3" fill="#2563EB" stroke="#93C5FD" strokeWidth="0.9" />
        </svg>
      );
    case 'crimson_samurai':
      return (
        <svg className="h-[22px] w-[126px] sm:h-[24px] sm:w-[148px]" viewBox="0 0 116 22" overflow="visible">
          <path d="M8 11 H44 M72 11 H108" stroke="#FB7185" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M44 5 L72 17 M72 5 L44 17" stroke="#FDE68A" strokeWidth="1.6" strokeLinecap="round" />
          <polygon points="58,3 65,11 58,19 51,11" fill="#DC2626" stroke="#FEF9C3" strokeWidth="1.3" />
        </svg>
      );
    case 'frost_valkyrie':
      return (
        <svg className="h-[22px] w-[128px] sm:h-[24px] sm:w-[150px]" viewBox="0 0 116 22" overflow="visible">
          <path d="M8 11 L38 11 L48 5 L58 11 L68 5 L78 11 L108 11" fill="none" stroke="#BAE6FD" strokeWidth="1.9" strokeLinecap="round" />
          <polygon points="58,2 64,11 58,20 52,11" fill="#E0F2FE" stroke="#818CF8" strokeWidth="1.3" />
          <circle cx="58" cy="11" r="2" fill="#FFFFFF" />
        </svg>
      );
    case 'solar_phoenix':
      return (
        <svg className="h-[24px] w-[134px] sm:h-[26px] sm:w-[156px]" viewBox="0 0 120 24" overflow="visible">
          <path d="M8 14 Q28 4 46 12 Q60 18 74 12 Q92 4 112 14" fill="none" stroke="#FB923C" strokeWidth="2.3" strokeLinecap="round" />
          <path d="M60 2 C66 8 68 13 60 21 C52 13 54 8 60 2 Z" fill="#FACC15" stroke="#EA580C" strokeWidth="1.3" />
          <circle cx="60" cy="12" r="2.3" fill="#FFFFFF" />
        </svg>
      );
    case 'void_nebula':
      return (
        <svg className="h-[24px] w-[134px] sm:h-[26px] sm:w-[156px]" viewBox="0 0 120 24" overflow="visible">
          <line x1="8" y1="12" x2="44" y2="12" stroke="#C084FC" strokeWidth="1.6" strokeDasharray="4 2.5" />
          <line x1="76" y1="12" x2="112" y2="12" stroke="#C084FC" strokeWidth="1.6" strokeDasharray="4 2.5" />
          <ellipse cx="60" cy="12" rx="14" ry="5" fill="none" stroke="#F472B6" strokeWidth="1.5" transform="rotate(-14 60 12)" />
          <circle cx="60" cy="12" r="5" fill="#2E1065" stroke="#F3E8FF" strokeWidth="1.3" />
        </svg>
      );
    case 'jade_dragon':
      return (
        <svg className="h-[24px] w-[134px] sm:h-[26px] sm:w-[156px]" viewBox="0 0 120 24" overflow="visible">
          <path d="M8 12 Q28 5 46 12 M74 12 Q92 5 112 12" fill="none" stroke="#34D399" strokeWidth="2.1" strokeLinecap="round" />
          <polygon points="60,2 68,8 66,18 54,18 52,8" fill="#059669" stroke="#67E8F9" strokeWidth="1.4" />
          <circle cx="60" cy="11" r="2.4" fill="#D1FAE5" />
        </svg>
      );
    case 'arcane_clockwork':
      return (
        <svg className="h-[24px] w-[134px] sm:h-[26px] sm:w-[156px]" viewBox="0 0 120 24" overflow="visible">
          <path d="M8 12 H44 M76 12 H112" stroke="#F59E0B" strokeWidth="2" />
          <circle cx="60" cy="12" r="8" fill="#1B1209" stroke="#FCD34D" strokeWidth="2.2" strokeDasharray="3 2" />
          <circle cx="60" cy="12" r="3.5" fill="#6D28D9" stroke="#EDE9FE" strokeWidth="1.2" />
        </svg>
      );
    case 'supernova_core':
      return (
        <svg className="h-[24px] w-[138px] sm:h-[26px] sm:w-[160px]" viewBox="0 0 124 24" overflow="visible">
          <path d="M6 12 H44 M80 12 H118" stroke="#67E8F9" strokeWidth="2" strokeLinecap="round" />
          <polygon points="62,1 66.5,8.5 74,12 66.5,15.5 62,23 57.5,15.5 50,12 57.5,8.5" fill="#F43F5E" stroke="#E0F2FE" strokeWidth="1.3" />
          <circle cx="62" cy="12" r="2.6" fill="#FFFFFF" />
        </svg>
      );
    case 'astral_sovereign':
      return (
        <svg className="h-[26px] w-[144px] sm:h-[28px] sm:w-[168px]" viewBox="0 0 128 26" overflow="visible">
          <path d="M6 14 H38 L48 5 L56 12 L64 2 L72 12 L80 5 L90 14 H122" fill="none" stroke="#FEF08A" strokeWidth="2.3" strokeLinejoin="round" strokeLinecap="round" />
          <path d="M18 19 H48 M80 19 H110" stroke="#6EE7B7" strokeWidth="1.5" strokeLinecap="round" />
          <polygon points="64,6 70,13 64,20 58,13" fill="#10B981" stroke="#FFFFFF" strokeWidth="1.3" />
          <circle cx="64" cy="13" r="2.4" fill="#FEF08A" />
        </svg>
      );
  }
}

/**
 * Pure decorative SVG frame ornaments (4 mirrored filigree corners + top/bottom crests)
 * rendered around the 8x8 Block Blast board bezel without intersecting interactive cells.
 */
export function StageFrameOrnaments({ stageId }: StageFrameOrnamentsProps) {
  const cornerArt = renderCornerArtwork(stageId);
  const crest = renderCrestSvg(stageId);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-20 overflow-visible"
    >
      {CORNERS.map((corner) => (
        <div
          key={corner.key}
          className={`absolute h-7 w-7 sm:h-10 sm:w-10 ${corner.posClass}`}
        >
          <svg
            className="h-full w-full"
            viewBox="0 0 36 36"
            overflow="visible"
          >
            <g transform={corner.svgTransform}>{cornerArt}</g>
          </svg>
        </div>
      ))}

      <div className="absolute -top-[8px] left-1/2 -translate-x-1/2 sm:-top-[9px]">
        {crest}
      </div>
      <div className="absolute -bottom-[8px] left-1/2 -translate-x-1/2 rotate-180 opacity-85 sm:-bottom-[9px]">
        {crest}
      </div>
    </div>
  );
}
