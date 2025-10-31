// app.config.ts
import 'dotenv/config';
import { ConfigContext, ExpoConfig } from 'expo/config';

const kakaoNativeAppKey = process.env.EXPO_PUBLIC_NATIVE_APP_KEY;


export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  owner: 'starsam',
  name: 'mumuri',
  slug: 'mumuri',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/logo.png',
  scheme: 'mumuri',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  splash: {
    image: './assets/images/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#FFFCF5',
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
      foregroundImage: './assets/images/logo.png',
      backgroundColor: '#FFFCF5',
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
    ['react-native-android-widget', {
      widgets: [
        {
          name: 'CoupleDDayWidget',
          label: '무무리 디데이!',
          renderWidget: 'widgets/CoupleDDayWidget.tsx',
          minWidth: '80dp',
          minHeight: '80dp',
        },
      ],
    }]
  ],
  experiments: {
    typedRoutes: true,
  },
});
