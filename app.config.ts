import 'dotenv/config';
import { ConfigContext, ExpoConfig } from 'expo/config';

const kakaoNativeAppKey = process.env.EXPO_PUBLIC_NATIVE_APP_KEY;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  owner: 'starsam',
  name: 'mumuri', // 스토어에 표시될 이름
  slug: 'mumuri',
  version: '1.0.0',
  orientation: 'portrait', // 세로 모드 고정
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
    supportsTablet: false, 
    bundleIdentifier: 'com.growdy.mumuri', 
    googleServicesFile: "./GoogleService-Info.plist",
    infoPlist: {
      CFBundleURLTypes: [
        {
          CFBundleURLSchemes: [`kakao${kakaoNativeAppKey}`],
        },
      ],
      ITSAppUsesNonExemptEncryption: false,
      NSCameraUsageDescription: '미션 사진 촬영을 위해 카메라 접근이 필요합니다.',
      NSPhotoLibraryAddUsageDescription: '촬영한 사진을 앨범에 저장합니다.',
      NSLocationWhenInUseUsageDescription: '사진 촬영 시 촬영 장소를 기록하기 위해 위치 정보가 필요합니다.',
      UIBackgroundModes: ['remote-notification'], 
    },
  },
  android: {
    package: 'com.growdy.mumuri',
    googleServicesFile: './google-services.json', 
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
        ios: {
          useFrameworks: 'static',
        }
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/images/logo.png', 
        color: '#FFFCF5', 
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