export type DeviceFormFactor = 'mobile' | 'tablet' | 'desktop';

export interface DeviceEnvInfo {
  width: number;
  height: number;
  coarsePointer: boolean;
  anyCoarsePointer: boolean;
  finePointer: boolean;
  maxTouchPoints: number;
}

const MOBILE_SHORT_SIDE_THRESHOLD_PX = 600;

/**
 * Classifies the runtime device into 'mobile' (blocked), 'tablet' (playable with
 * touch D-pad + skill controls), or 'desktop' (keyboard + mouse).
 */
export function classifyDeviceFormFactor(env: DeviceEnvInfo): DeviceFormFactor {
  const isPrimaryTouch =
    env.coarsePointer ||
    (!env.finePointer && (env.anyCoarsePointer || env.maxTouchPoints > 0));

  if (!isPrimaryTouch) {
    return 'desktop';
  }

  const shortSide = Math.min(env.width, env.height);
  if (shortSide < MOBILE_SHORT_SIDE_THRESHOLD_PX) {
    return 'mobile';
  }

  return 'tablet';
}

export function readDeviceEnvInfo(): DeviceEnvInfo {
  if (typeof window === 'undefined') {
    return {
      width: 1280,
      height: 800,
      coarsePointer: false,
      anyCoarsePointer: false,
      finePointer: true,
      maxTouchPoints: 0,
    };
  }

  const matchMedia =
    typeof window.matchMedia === 'function' ? window.matchMedia.bind(window) : null;

  return {
    width: window.innerWidth || document.documentElement?.clientWidth || 1280,
    height: window.innerHeight || document.documentElement?.clientHeight || 800,
    coarsePointer: matchMedia ? matchMedia('(pointer: coarse)').matches : false,
    anyCoarsePointer: matchMedia ? matchMedia('(any-pointer: coarse)').matches : false,
    finePointer: matchMedia ? matchMedia('(pointer: fine)').matches : true,
    maxTouchPoints:
      typeof navigator !== 'undefined' ? navigator.maxTouchPoints ?? 0 : 0,
  };
}
