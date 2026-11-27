import { useEffect, useState } from 'react';
import {
  classifyDeviceFormFactor,
  readDeviceEnvInfo,
  type DeviceFormFactor,
} from './deviceFormFactor';

/**
 * React hook returning the live device form factor ('mobile' | 'tablet' | 'desktop')
 * and updating automatically on viewport resize or pointer media-query changes.
 */
export function useDeviceFormFactor(): DeviceFormFactor {
  const [formFactor, setFormFactor] = useState<DeviceFormFactor>(() =>
    classifyDeviceFormFactor(readDeviceEnvInfo()),
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const sync = () => {
      const next = classifyDeviceFormFactor(readDeviceEnvInfo());
      setFormFactor((prev) => (prev === next ? prev : next));
    };

    sync();

    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', sync);

    const mediaQueries: MediaQueryList[] = [];
    if (typeof window.matchMedia === 'function') {
      for (const query of [
        '(pointer: coarse)',
        '(any-pointer: coarse)',
        '(pointer: fine)',
      ]) {
        const mq = window.matchMedia(query);
        mq.addEventListener('change', sync);
        mediaQueries.push(mq);
      }
    }

    return () => {
      window.removeEventListener('resize', sync);
      window.removeEventListener('orientationchange', sync);
      for (const mq of mediaQueries) {
        mq.removeEventListener('change', sync);
      }
    };
  }, []);

  return formFactor;
}
