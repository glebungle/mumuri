import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import AppText from "./../components/AppText";

const REST_API_KEY = process.env.EXPO_PUBLIC_KAKAO_REST_KEY || "";
const BACKEND_CALLBACK_URL = "https://mumuri.shop/api/auth/kakao/callback";
const REDIRECT_URI = BACKEND_CALLBACK_URL;

// 기본 인증 URL 구성
const BASE_AUTH_URL =
  "https://kauth.kakao.com/oauth/authorize" +
  `?response_type=code` +
  `&client_id=${encodeURIComponent(REST_API_KEY)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

export default function KakaoLoginButton() {
  const [webViewVisible, setWebViewVisible] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(BASE_AUTH_URL);
  const isHandled = useRef(false);

  /**
   * 로그인 시작
   */
  const startLogin = async () => {
    if (!REST_API_KEY) {
      Alert.alert(
        "설정 오류",
        "카카오 REST API 키가 환경 변수에 설정되지 않았습니다.",
      );
      return;
    }

    isHandled.current = false;

    // 로그아웃 했던 기록이 있는지 확인
    const wasLoggedOut = await AsyncStorage.getItem("isLoggingOut");

    if (wasLoggedOut === "true") {
      setCurrentUrl(`${BASE_AUTH_URL}&prompt=login`);
    } else {
      setCurrentUrl(BASE_AUTH_URL);
    }

    setWebViewVisible(true);
  };

  /**
   * WebView URL 변경 감지
   */
  const handleWebViewChange = async (url: string) => {
    if (url.startsWith("mumuri:")) {
      if (isHandled.current) return false;
      isHandled.current = true;

      // URL 스키마 교정 (mumuri:/// -> mumuri://)
      const fixedUrl = url.replace(/^mumuri:\/+/, "mumuri://");

      // 로그아웃 플래그 제거
      await AsyncStorage.removeItem("isLoggingOut");
      setWebViewVisible(false);

      // Linking을 통해 DeepLinkHandler로 데이터 전달
      Linking.openURL(fixedUrl).catch((err) => {
        console.error("❌ Linking Error:", err);
        Alert.alert("오류", "앱으로 돌아가는 중 문제가 발생했습니다.");
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
        <SafeAreaView style={styles.webViewContainer}>
          <View style={styles.webViewHeader}>
            <Pressable
              onPress={() => setWebViewVisible(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={28} color="#333" />
            </Pressable>
            <AppText type="semibold" style={styles.headerTitle}>
              카카오 로그인
            </AppText>
            <View style={{ width: 28 }} />
          </View>

          {webViewVisible && (
            <WebView
              style={styles.webView}
              source={{ uri: currentUrl }}
              sharedCookiesEnabled={true}
              thirdPartyCookiesEnabled={true}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              originWhitelist={["*"]}
              onShouldStartLoadWithRequest={(req) => {
                const shouldLoad = !req.url.startsWith("mumuri:");
                if (!shouldLoad) handleWebViewChange(req.url);
                return shouldLoad;
              }}
              onNavigationStateChange={(e) => {
                if (e.url.startsWith("mumuri:")) handleWebViewChange(e.url);
              }}
              startInLoadingState={true}
              renderLoading={() => (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color="#FAE100" />
                </View>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  buttonImage: { height: 55, width: 335, resizeMode: "contain" },
  webViewContainer: { flex: 1, backgroundColor: "white" },
  webViewHeader: {
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  headerTitle: { fontSize: 16, color: "#333" },
  closeButton: { padding: 5 },
  webView: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
});
