import AppleLoginButton from "@/components/AppleLoginButton";
import KakaoLoginButton from "@/components/KakaoLoginButton";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator, // 로딩 표시용
  Dimensions,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AppText from "../../components/AppText";

const { width, height } = Dimensions.get("window");

export default function StartScreen() {
  const [isChecking, setIsChecking] = useState(true);

  // 자동 로그인 체크
  useEffect(() => {
    const checkLogin = async () => {
      try {
        const [token, refreshToken] = await Promise.all([
          AsyncStorage.getItem("token"),
          AsyncStorage.getItem("refreshToken"),
        ]);

        // 토큰이 하나라도 있다면 로그인된 사용자로 간주하고 홈으로
        if (token || refreshToken) {
          router.replace("/(tabs)/home");
        } else {
          setIsChecking(false);
        }
      } catch (e) {
        setIsChecking(false);
      }
    };
    checkLogin();
  }, []);

  const handleOnboarding = () => {
    router.replace("/onboarding/intro");
  };

  if (isChecking) {
    return (
      <View
        style={[s.wrap, { justifyContent: "center", alignItems: "center" }]}
      >
        <ActivityIndicator color="#FF9191" size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={s.wrap}>
      {/* 배경 거품 애니메이션/디자인 */}
      <View pointerEvents="none" style={s.bubbles}>
        <View
          style={[
            s.bubble,
            { left: 32, top: height * 0.18, backgroundColor: "#49DC95" },
          ]}
        />
        <View
          style={[
            s.bubble,
            {
              left: width * 0.65,
              top: height * 0.35,
              backgroundColor: "#6198FF",
            },
          ]}
        />
        <View
          style={[
            s.bubble,
            {
              left: width * 0.45,
              top: height * 0.58,
              backgroundColor: "#FF9191",
            },
          ]}
        />
      </View>

      <View style={s.center}>
        <AppText style={s.title}>m</AppText>
      </View>

      <Pressable onPress={handleOnboarding} style={s.onboardingButton}>
        <AppText type="regular" style={s.skipButtonText}>
          온보딩 보기 (임시)
        </AppText>
      </Pressable>

      <View style={s.bottom}>
        <KakaoLoginButton />
        <AppleLoginButton />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: "#FFF8E9",
  },
  bubbles: {
    position: "absolute",
    inset: 0,
  },
  bubble: {
    position: "absolute",
    width: 45,
    height: 45,
    borderRadius: 28,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 100, color: "#444444", letterSpacing: 0 },
  bottom: {
    paddingHorizontal: 20,
    paddingBottom: 70,
    alignItems: "center",
  },
  skipButton: {
    margin: 10,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#75787B",
  },
  skipButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
  },
  onboardingButton: {
    margin: 10,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#75787B",
  },
  signupLink: { color: "#606060", fontSize: 10, marginTop: 14 },
});
