import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { WebView } from "react-native-webview";

const REST_API_KEY = process.env.EXPO_PUBLIC_KAKAO_REST_KEY || "";
const BACKEND_CALLBACK_URL = "https://mumuri.shop/api/auth/kakao/callback";
const REDIRECT_URI = BACKEND_CALLBACK_URL;

// 기본 URL
const BASE_AUTH_URL =
  "https://kauth.kakao.com/oauth/authorize" +
  `?response_type=code` +
  `&client_id=${encodeURIComponent(REST_API_KEY)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

export default function KakaoLoginButton() {
  const [webViewVisible, setWebViewVisible] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(BASE_AUTH_URL);
  const isHandled = useRef(false);

  const startLogin = async () => {
    if (!REST_API_KEY) {
      Alert.alert("설정 오류", "카카오 키가 없습니다.");
      return;
    }

    isHandled.current = false;

    // 로그아웃 했었는지 확인
    const wasLoggedOut = await AsyncStorage.getItem("isLoggingOut");

    if (wasLoggedOut === "true") {
      console.log(
        "🔒 [LoginButton] 로그아웃 기록 확인 -> 아이디/비번 입력 강제",
      );
      setCurrentUrl(`${BASE_AUTH_URL}&prompt=login`);
    } else {
      console.log("⚡️ [LoginButton] 일반 로그인 (자동 로그인 허용)");
      setCurrentUrl(BASE_AUTH_URL);
    }

    setWebViewVisible(true);
  };

  const handleWebViewChange = async (url: string) => {
    if (url.startsWith("mumuri:")) {
      if (isHandled.current) return false;

      const fixedUrl = url.replace(/^mumuri:\/+/, "mumuri://");

      console.log("🚀 [WebView] 교정된 URL:", fixedUrl);
      isHandled.current = true;

      await AsyncStorage.removeItem("isLoggingOut");

      setWebViewVisible(false);

      // 교정된 URL로 실행
      Linking.openURL(fixedUrl).catch((err) => {
        console.error("❌ Linking Error:", err);
        Alert.alert("오류", "앱으로 돌아올 수 없습니다. 설정을 확인해주세요.");
      });

      return false;
    }
    return true;
  };

  return (
    <>
      <Pressable onPress={startLogin}>
        <Image
          source={require("../assets/images/kakao_login.png")}
          style={styles.buttonImage}
        />
      </Pressable>

      <Modal
        visible={webViewVisible}
        animationType="slide"
        onRequestClose={() => setWebViewVisible(false)}
      >
        <View style={styles.webViewContainer}>
          {webViewVisible && (
            <WebView
              style={styles.webView}
              source={{ uri: currentUrl }}
              sharedCookiesEnabled={true}
              thirdPartyCookiesEnabled={true}
              incognito={false}
              javaScriptEnabled
              domStorageEnabled
              originWhitelist={["*"]}
              onShouldStartLoadWithRequest={(req) => {
                const shouldLoad = !req.url.startsWith("mumuri:");
                if (!shouldLoad) handleWebViewChange(req.url);
                return shouldLoad;
              }}
              onNavigationStateChange={(e) => handleWebViewChange(e.url)}
              startInLoadingState={true}
              renderLoading={() => (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color="#FAE100" />
                </View>
              )}
            />
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  buttonImage: { height: 55, width: 330, resizeMode: "contain" },
  webViewContainer: { flex: 1, paddingTop: 40, backgroundColor: "white" },
  webView: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
  },
});
