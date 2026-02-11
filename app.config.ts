// app.config.ts
import "dotenv/config";
import { ConfigContext, ExpoConfig } from "expo/config";

const kakaoNativeAppKey = process.env.EXPO_PUBLIC_NATIVE_APP_KEY;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  owner: "starsam",
  name: "mumuri",
  slug: "mumuri",
  version: "1.0.2",
  orientation: "portrait",
  icon: "./assets/images/logo.png",
  scheme: "mumuri",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  splash: {
    image: "./assets/images/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#FFFCF5",
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.growdy.mumuri",
    googleServicesFile: "./GoogleService-Info.plist",
    buildNumber: "8",
    infoPlist: {
      CFBundleURLTypes: [
        {
          CFBundleURLSchemes: ["mumuri", `kakao${kakaoNativeAppKey}`],
        },
      ],
      NSCameraUsageDescription:
        "커플 미션 수행을 위한 사진 촬영 및 프로필 이미지 설정을 위해 카메라 접근 권한이 필요합니다. 촬영된 사진은 커플끼리 공유됩니다.",

      NSPhotoLibraryUsageDescription:
        "갤러리에 있는 사진을 선택하여 미션 인증샷으로 게시하거나 커플 프로필 이미지를 설정하기 위해 사진 라이브러리 접근 권한을 사용합니다.",

      NSPhotoLibraryAddUsageDescription:
        "앱에서 촬영한 미션 인증 사진을 사용자의 기기 앨범에 안전하게 저장하기 위해 권한이 필요합니다.",
      usesAppleSignIn: true,
      UIBackgroundModes: ["remote-notification"],
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: "com.growdy.mumuri",
    versionCode: 13,
    googleServicesFile: "./google-services.json",
    blockedPermissions: [
      "android.permission.READ_MEDIA_VIDEO",
      "android.permission.READ_MEDIA_AUDIO",
      "android.permission.ACCESS_COARSE_LOCATION",
      "android.permission.ACCESS_FINE_LOCATION",
    ],
    adaptiveIcon: {
      foregroundImage: "./assets/images/logo.png",
      backgroundColor: "#FFFCF5",
    },
    edgeToEdgeEnabled: true,
    softwareKeyboardLayoutMode: "resize",
    predictiveBackGestureEnabled: false,
    permissions: [
      "android.permission.CAMERA",
      "android.permission.READ_MEDIA_IMAGES",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      "android.permission.RECORD_AUDIO",
      "android.permission.RECEIVE_BOOT_COMPLETED",
      "android.permission.VIBRATE",
      "android.permission.WAKE_LOCK",
      "android.permission.POST_NOTIFICATIONS",
    ],
  },
  extra: {
    eas: {
      projectId: "92184daa-ec19-4fe6-af1a-f26a1f94be39",
    },
  },
  plugins: [
    "expo-router",
    [
      "expo-build-properties",
      {
        android: {
          extraMavenRepos: [
            "https://devrepo.kakao.com/nexus/content/groups/public/",
          ],
        },
      },
    ],
    [
      "expo-notifications",
      {
        icon: "./assets/images/logo.png",
        color: "#FF9191",
        sounds: [],
      },
    ],
    [
      "@react-native-kakao/core",
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
  ],
  experiments: {
    typedRoutes: true,
  },
  // EAS Update 설정 유지
  updates: {
    url: "https://u.expo.dev/92184daa-ec19-4fe6-af1a-f26a1f94be39",
  },
  runtimeVersion: {
    policy: "appVersion",
  },
});
