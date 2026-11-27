import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyDeviceFormFactor,
  type DeviceEnvInfo,
} from '../deviceFormFactor.ts';

function env(overrides: Partial<DeviceEnvInfo> = {}): DeviceEnvInfo {
  return {
    width: 1280,
    height: 800,
    coarsePointer: false,
    anyCoarsePointer: false,
    finePointer: true,
    maxTouchPoints: 0,
    ...overrides,
  };
}

describe('classifyDeviceFormFactor', () => {
  it('classifies standard desktop mouse/keyboard viewports as desktop even when resized narrow', () => {
    assert.equal(classifyDeviceFormFactor(env()), 'desktop');
    assert.equal(
      classifyDeviceFormFactor(env({ width: 390, height: 844 })),
      'desktop',
    );
  });

  it('classifies touch-capable laptops with primary fine pointer as desktop', () => {
    assert.equal(
      classifyDeviceFormFactor(
        env({
          width: 1440,
          height: 900,
          coarsePointer: false,
          anyCoarsePointer: true,
          finePointer: true,
          maxTouchPoints: 10,
        }),
      ),
      'desktop',
    );
  });

  it('blocks touch phones in both portrait and landscape orientations', () => {
    // iPhone portrait
    assert.equal(
      classifyDeviceFormFactor(
        env({
          width: 390,
          height: 844,
          coarsePointer: true,
          anyCoarsePointer: true,
          finePointer: false,
          maxTouchPoints: 5,
        }),
      ),
      'mobile',
    );
    // iPhone / Android Pro Max landscape (short side < 600)
    assert.equal(
      classifyDeviceFormFactor(
        env({
          width: 932,
          height: 430,
          coarsePointer: true,
          anyCoarsePointer: true,
          finePointer: false,
          maxTouchPoints: 5,
        }),
      ),
      'mobile',
    );
  });

  it('classifies touch tablets (iPad, iPad Mini, Android Tablet) in portrait and landscape as tablet', () => {
    // iPad portrait
    assert.equal(
      classifyDeviceFormFactor(
        env({
          width: 768,
          height: 1024,
          coarsePointer: true,
          anyCoarsePointer: true,
          finePointer: false,
          maxTouchPoints: 5,
        }),
      ),
      'tablet',
    );
    // iPad Mini portrait
    assert.equal(
      classifyDeviceFormFactor(
        env({
          width: 744,
          height: 1133,
          coarsePointer: true,
          anyCoarsePointer: true,
          finePointer: false,
          maxTouchPoints: 5,
        }),
      ),
      'tablet',
    );
    // iPad Pro landscape
    assert.equal(
      classifyDeviceFormFactor(
        env({
          width: 1366,
          height: 1024,
          coarsePointer: true,
          anyCoarsePointer: true,
          finePointer: false,
          maxTouchPoints: 5,
        }),
      ),
      'tablet',
    );
  });
});
