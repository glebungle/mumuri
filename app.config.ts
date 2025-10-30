import { ConfigContext, ExpoConfig } from '@expo/config';
import 'dotenv/config';

const kakaoNativeAppKey = process.env.EXPO_PUBLIC_NATIVE_APP_KEY;


export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  owner: 'starsam', 
  name: 'mumuri',
  slug: 'mumuri',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'mumuri',            // (앱 자체 스킴: 딥링크 등에 사용)
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
    // bundleIdentifier 필요 시 여기에 지정
  },
  android: {
    package:'mumuri.test',
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    edgeToEdgeEnabled: true,
    softwareKeyboardLayoutMode: "resize",
    predictiveBackGestureEnabled: false,
    permissions: [
      'android.permission.CAMERA',
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ],
    // package 필요 시 여기에 지정
  },
  extra: {
    eas: {
      projectId: '92184daa-ec19-4fe6-af1a-f26a1f94be39',
    },
    // (옵션) 공개 환경변수 노출
    // EXPO_PUBLIC_KAKAO_REST_KEY: process.env.EXPO_PUBLIC_KAKAO_REST_KEY,
    // EXPO_PUBLIC_KAKAO_NATIVE_KEY: process.env.EXPO_PUBLIC_NATIVE_APP_KEY,
  },
  
  plugins: [
    // expo-router는 그대로 유지
    'expo-router',
    // 빌드 설정(카카오 저장소 등)을 위한 build-properties
    [
      'expo-build-properties',
      {
        android: {
          extraMavenRepos: [
            'https://devrepo.kakao.com/nexus/content/groups/public/',
          ],
        },
      },
    ],
    // 카카오 네이티브 SDK 플러그인
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
    // 🚨 위젯 플러그인 추가
    [
        'expo-widget',
        {
            target: 'CoupleDDayWidget',
            widgetName: 'CoupleDDayWidget',
            label: '무무리 디데이', // 위젯 목록에 표시될 이름
            renderWidget: './CoupleDDayWidget.js', // 위젯 로직 파일 경로
            backgroundColor: '#FFFAFA', // 위젯의 기본 배경색 (테스트용)
        },
    ],
  ],
  experiments: { typedRoutes: true },
});
