import { isStandaloneDisplay } from './displayMode';

const PLATFORM = {
  INSTALLED: 'installed',
  IOS_SAFARI: 'ios-safari',
  IOS_OTHER: 'ios-other',
  ANDROID_CHROME: 'android-chrome',
  ANDROID_OTHER: 'android-other',
  WINDOWS_DESKTOP: 'windows-desktop',
  MAC_DESKTOP: 'mac-desktop',
  LINUX_DESKTOP: 'linux-desktop',
  DESKTOP_OTHER: 'desktop-other',
};

export function detectInstallPlatform() {
  if (typeof window === 'undefined') {
    return { platform: PLATFORM.DESKTOP_OTHER, label: 'Desktop', installed: false };
  }

  const ua = navigator.userAgent || '';
  const isStandalone = isStandaloneDisplay();
  const isIOS =
    /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
  const isEdge = /Edg/i.test(ua);
  const isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);

  if (isStandalone) {
    return { platform: PLATFORM.INSTALLED, label: 'Installed app', installed: true };
  }

  if (isIOS) {
    return {
      platform: isSafari ? PLATFORM.IOS_SAFARI : PLATFORM.IOS_OTHER,
      label: isSafari ? 'iPhone / iPad (Safari)' : 'iPhone / iPad',
      installed: false,
    };
  }

  if (isAndroid) {
    return {
      platform: isChrome ? PLATFORM.ANDROID_CHROME : PLATFORM.ANDROID_OTHER,
      label: isChrome ? 'Android (Chrome)' : 'Android',
      installed: false,
    };
  }

  if (/Windows/i.test(ua)) {
    const browser = isEdge ? 'Edge' : isChrome ? 'Chrome' : 'Browser';
    return {
      platform: PLATFORM.WINDOWS_DESKTOP,
      label: `${browser} on Windows`,
      installed: false,
      browser,
    };
  }

  if (/Mac OS X|Macintosh/i.test(ua)) {
    const browser = isChrome ? 'Chrome' : isSafari ? 'Safari' : isEdge ? 'Edge' : 'Browser';
    return {
      platform: PLATFORM.MAC_DESKTOP,
      label: `${browser} on Mac`,
      installed: false,
      browser,
    };
  }

  if (/Linux/i.test(ua)) {
    return {
      platform: PLATFORM.LINUX_DESKTOP,
      label: 'Linux desktop',
      installed: false,
    };
  }

  return { platform: PLATFORM.DESKTOP_OTHER, label: 'Desktop browser', installed: false };
}

export function getInstallGuideSteps(platformInfo) {
  const { platform } = platformInfo;

  if (platform === PLATFORM.INSTALLED) {
    return {
      title: 'CoreKnot is installed',
      subtitle: 'You are running CoreKnot from your home screen or desktop.',
      steps: [
        { text: 'Open CoreKnot from your home screen or app launcher anytime.' },
        { text: 'Enable notifications in Settings → Notifications for task and inbox alerts.' },
        { text: 'Pull down to refresh if data looks stale after being offline.' },
      ],
    };
  }

  if (platform === PLATFORM.IOS_SAFARI || platform === PLATFORM.IOS_OTHER) {
    return {
      title: 'Install on iPhone or iPad',
      subtitle: 'Add CoreKnot to your home screen for a full-screen app experience.',
      steps: [
        { text: 'Open tsccoreknot.com in Safari (recommended).' },
        { text: 'Tap the Share button at the bottom of the screen.' },
        { text: 'Scroll down and tap Add to Home Screen.' },
        { text: 'Tap Add — CoreKnot appears on your home screen like a native app.' },
        { text: 'Launch from the icon for push alerts and faster access.' },
      ],
    };
  }

  if (platform === PLATFORM.ANDROID_CHROME) {
    return {
      title: 'Install on Android',
      subtitle: 'Install CoreKnot as an app from Chrome.',
      steps: [
        { text: 'Open tsccoreknot.com in Chrome.' },
        { text: 'Tap the menu (⋮) in the top-right corner.' },
        { text: 'Tap Install app or Add to Home screen.' },
        { text: 'Confirm Install — CoreKnot opens in its own window.' },
        { text: 'Allow notifications when prompted for inbox and task alerts.' },
      ],
    };
  }

  if (platform === PLATFORM.ANDROID_OTHER) {
    return {
      title: 'Install on Android',
      subtitle: 'Use Chrome for the best install experience.',
      steps: [
        { text: 'Open tsccoreknot.com in Google Chrome.' },
        { text: 'From the browser menu, choose Install app or Add to Home screen.' },
        { text: 'If install is unavailable, bookmark the site to your home screen.' },
      ],
    };
  }

  if (platform === PLATFORM.WINDOWS_DESKTOP || platform === PLATFORM.MAC_DESKTOP || platform === PLATFORM.LINUX_DESKTOP) {
    const browserHint =
      platformInfo.browser === 'Edge'
        ? 'Click the App available icon in the address bar, then Install.'
        : platformInfo.browser === 'Chrome'
          ? 'Click the Install icon (⊕ or computer) in the address bar, then Install.'
          : 'Use Chrome or Edge for one-click install from the address bar.';

    return {
      title: 'Install on desktop',
      subtitle: 'Run CoreKnot in its own window with notifications.',
      steps: [
        { text: 'Sign in at tsccoreknot.com.' },
        { text: browserHint },
        { text: 'Alternatively, open the browser menu → Install CoreKnot / Save and share → Install.' },
        { text: 'Pin CoreKnot to your taskbar or dock for quick access.' },
        { text: 'Allow notifications when prompted to get alerts when the app is closed.' },
      ],
    };
  }

  return {
    title: 'Install CoreKnot',
    subtitle: 'Get the app experience on your device.',
    steps: [
      { text: 'Visit tsccoreknot.com in Chrome, Edge, or Safari.' },
      { text: 'Look for Install or Add to Home Screen in the browser menu or address bar.' },
      { text: 'Sign in after installing to sync your session.' },
    ],
  };
}

export { PLATFORM };
