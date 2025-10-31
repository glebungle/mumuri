// app.config.ts
import 'dotenv/config';
import { ConfigContext, ExpoConfig } from 'expo/config';
import type { WithAndroidWidgetsParams } from 'react-native-android-widget';

const kakaoNativeAppKey = process.env.EXPO_PUBLIC_NATIVE_APP_KEY;

// 1) 위젯 설정
const widgetConfig: WithAndroidWidgetsParams = {
  widgets: [
    {
      name: 'CoupleDDayWidget',          // JS에서 export default 로 쓸 이름
      label: '무무리 디데이',             // 위젯 선택창에 보이는 이름
      description: '우리 기념일 디데이',  // 선택창 설명
      minWidth: '150dp',
      minHeight: '80dp',
      updatePeriodMillis: 1800000,       // 30분
    },
  ],
};

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  owner: 'starsam',
  name: 'mumuri',
  slug: 'mumuri',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'mumuri',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  splash: {
    image: './assets/images/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  ios: {
    supportsTablet: true,
    infoPlist: {
      NSCameraUsageDescription: '미션 사진 촬영을 위해 카메라 접근이 필요합니다.',
      NSPhotoLibraryAddUsageDescription: '촬영한 사진을 앨범에 저장합니다.',
    },
  },
  android: {
    package: 'mumuri.test',
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    edgeToEdgeEnabled: true,
    softwareKeyboardLayoutMode: 'resize',
    predictiveBackGestureEnabled: false,
    permissions: [
      'android.permission.CAMERA',
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ],
  },
  extra: {
    eas: {
      projectId: '92184daa-ec19-4fe6-af1a-f26a1f94be39',
    },
  },
  plugins: [
    'expo-router',
    [
      'expo-build-properties',
      {
        android: {
          extraMavenRepos: ['https://devrepo.kakao.com/nexus/content/groups/public/'],
        },
      },
    ],
    [
      '@react-native-kakao/core',
      {
        nativeAppKey: kakaoNativeAppKey,
        android: {
          authCodeHandlerActivity: true,
        },
        ios: {
          handleKakaoOpenUrl: true,
        },
      },
    ],
    // 🔥 여기 위젯 플러그인
    ['react-native-android-widget', widgetConfig],
  ],
  experiments: {
    typedRoutes: true,
  },
});
