/**
 * The version the app reports must be the APK's, not the OTA bundle's.
 *
 * The bug this pins: after every OTA, `Constants.expoConfig.version` is the
 * version inside the manifest the Worker served — so restarting into a fresh JS
 * update made the install report a version the server did not consider current,
 * and the full-screen "ye update purana ho gaya hai" wall came back.
 */
import { installedAppVersion } from '../src/lib/appVersion';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { version: '9.9.9-ota-manifest' },
    executionEnvironment: 'bare',
  },
}));

describe('installedAppVersion', () => {
  afterEach(() => jest.resetModules());

  it('prefers the native APK version over the running manifest', () => {
    jest.doMock('expo-application', () => ({ nativeApplicationVersion: '2.16.0' }));
    expect(installedAppVersion()).toBe('2.16.0');
  });

  it('falls back to expoConfig only when the native module has no version', () => {
    jest.doMock('expo-application', () => ({ nativeApplicationVersion: null }));
    expect(installedAppVersion()).toBe('9.9.9-ota-manifest');
  });

  it('never throws when the native module is missing entirely', () => {
    jest.doMock('expo-application', () => {
      throw new Error('native module unavailable');
    });
    expect(installedAppVersion()).toBe('9.9.9-ota-manifest');
  });
});
