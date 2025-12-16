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
    // bundleIdentifier: 'com.starsam.mumuri', // ✅ [활성화] 푸시 인증서를 위해 필수
    infoPlist: {
      NSCameraUsageDescription: '미션 사진 촬영을 위해 카메라 접근이 필요합니다.',
      NSPhotoLibraryAddUsageDescription: '촬영한 사진을 앨범에 저장합니다.',
      NSLocationWhenInUseUsageDescription: '사진 촬영 시 촬영 장소를 기록하기 위해 위치 정보가 필요합니다.',
      // UIBackgroundModes: ['remote-notification'], // ✅ [활성화] 백그라운드 알림 수신
    },
  },
  android: {
    package: 'mumuri.test',
    // googleServicesFile: './google-services.json', // ✅ [활성화] 안드로이드 푸시(FCM)를 위해 필수 (파일이 루트 경로에 있어야 함)
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
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_FINE_LOCATION',
      // ✅ [활성화] 푸시 알림 및 관련 권한
      'android.permission.RECORD_AUDIO',
      'android.permission.RECEIVE_BOOT_COMPLETED',
      'android.permission.VIBRATE',
      'android.permission.WAKE_LOCK',
      'android.permission.POST_NOTIFICATIONS', 
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
    // // ✅ [활성화] 푸시 알림 플러그인 설정
    // [
    //   'expo-notifications',
    //   {
    //     icon: './assets/images/logo.png', // 알림바 아이콘 (투명 배경의 단색 아이콘 권장)
    //     color: '#FFFCF5', // 알림 아이콘 색상
    //     sounds: [], // 커스텀 사운드 필요 시 경로 추가
    //   },
    // ],
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