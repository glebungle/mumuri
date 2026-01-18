import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef } from "react";
import { ActivityIndicator, View } from "react-native";

const BASE_URL = "https://mumuri.shop";

/**
 * 로그인 직후 유저 ID를 조회
 */
async function fetchUserId(token: string) {
  try {
    const res = await fetch(`${BASE_URL}/user/getuser`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const text = await res.text();
    if (text.startsWith("{") || text.startsWith("[")) {
      const data = JSON.parse(text);
      return data.userId ?? data.id ?? data.memberId;
    }
    return text;
  } catch (e) {
    console.log("User ID 조회 실패:", e);
    return null;
  }
}

export default function KakaoDeepLinkHandler() {
  const params = useLocalSearchParams<{
    accessToken?: string;
    refreshToken?: string;
    nickname?: string;
    email?: string;
    isNew?: string;
    status?: string;
    roomId?: string;
  }>();

  const isProcessing = useRef(false);

  useEffect(() => {
    if (params.accessToken) {
      handleLoginSuccess();
    }
  }, [params.accessToken]);

  const handleLoginSuccess = async () => {
    if (!params.accessToken || isProcessing.current) return;

    isProcessing.current = true;

    // 1. 좀비 토큰 방지 체크
    const logoutFlag = await AsyncStorage.getItem("isLoggingOut");
    if (logoutFlag === "true") {
      console.log("[Login Handler] 로그아웃 직후 진입 차단");
      router.replace("/");
      return;
    }

    try {
      console.log("🚀 [Login Handler] 토큰 저장 및 유저 정보 확인 중...");

      // 2. 일괄 저장을 위한 데이터 준비 (multiSet)
      const storageItems: [string, string][] = [
        ["token", String(params.accessToken)],
        ["refreshToken", String(params.refreshToken || "")],
      ];

      if (params.nickname) storageItems.push(["name", String(params.nickname)]);
      if (params.email) storageItems.push(["email", String(params.email)]);
      if (params.roomId && params.roomId !== "0")
        storageItems.push(["roomId", String(params.roomId)]);

      // 3. 유저 ID 추가 조회
      const userId = await fetchUserId(String(params.accessToken));
      if (userId) storageItems.push(["userId", String(userId)]);

      // 4. 저장소에 한꺼번에 반영
      await AsyncStorage.multiSet(storageItems);
      await AsyncStorage.removeItem("isLoggingOut");

      console.log("✅ [Login Handler] 모든 정보 저장 완료");

      // 5. 페이지 이동
      if (params.isNew === "true") {
        router.replace("/signup");
      } else {
        router.replace("/(tabs)/home");
      }
    } catch (e) {
      console.error("❌ [Login Handler] 처리 중 에러:", e);
      router.replace("/");
    }
  };

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FFFCF5",
      }}
    >
      <ActivityIndicator size="large" color="#FF9E9E" />
    </View>
  );
}
