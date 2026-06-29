import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cabiniq.mobile',
  appName: 'CabinIQ',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 0,
      backgroundColor: '#070c16',
      showSpinner: false,
      launchFadeOutDuration: 0,
    },
  },
};

export default config;
