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
