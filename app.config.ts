// app.config.ts
import "dotenv/config";
import { ConfigContext, ExpoConfig } from "expo/config";

const kakaoNativeAppKey = process.env.EXPO_PUBLIC_NATIVE_APP_KEY;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  owner: "starsam",
  name: "mumuri",
  slug: "mumuri",
  version: "1.0.1",
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
    buildNumber: "5",
    infoPlist: {
      CFBundleURLTypes: [
        {
          CFBundleURLSchemes: ["mumuri", `kakao${kakaoNativeAppKey}`],
        },
      ],
      NSCameraUsageDescription:
        "미션 사진 촬영을 위해 카메라 접근이 필요합니다.",
      NSPhotoLibraryAddUsageDescription: "촬영한 사진을 앨범에 저장합니다.",
      usesAppleSignIn: true,
      UIBackgroundModes: ["remote-notification"],
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: "com.growdy.mumuri",
    versionCode: 9,
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
