import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

export default function Gate() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      // 1. 필요한 정보를 한꺼번에 가져옵니다.
      const [token, refreshToken, hasSeenOnboarding] = await Promise.all([
        AsyncStorage.getItem("token"),
        AsyncStorage.getItem("refreshToken"),
        AsyncStorage.getItem("hasSeenOnboarding"),
      ]);

      // 2. 로그인 여부 판단: 액세스 토큰이나 리프레시 토큰 중 하나라도 있으면 로그인 상태로 간주합니다.
      if (token || refreshToken) {
        router.replace("/(tabs)/home");
      } else {
        // 3. 비로그인 상태일 때
        if (hasSeenOnboarding === "true") {
          // 온보딩을 이미 봤다면 로그인/회원가입 화면으로
          router.replace("/(auth)");
        } else {
          router.replace("/onboarding/intro");
        }
      }
    })();
  }, [router]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FFFCF5",
      }}
    >
      {/* 로더 */}
      <ActivityIndicator size="large" color="#FF9191" />
    </View>
  );
}
