// utils/apiClient.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { Alert } from "react-native";

const BASE_URL = "https://mumuri.shop";
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

/**
 * 1. 토큰 갱신 로직 (Atomic)
 */
async function getNewToken() {
  if (isRefreshing) {
    return new Promise((resolve, reject) => {
      failedQueue.push({ resolve, reject });
    });
  }

  isRefreshing = true;
  try {
    const refreshToken = await AsyncStorage.getItem("refreshToken");
    if (!refreshToken) throw new Error("NO_REFRESH_TOKEN");

    console.log("🔄 [apiClient] 토큰 갱신 시도...");
    const res = await fetch(
      `${BASE_URL}/auth/refresh?refreshToken=${encodeURIComponent(refreshToken)}`,
      { method: "POST", headers: { Accept: "*/*" } },
    );

    if (res.ok) {
      const data = await res.json();
      await AsyncStorage.multiSet([
        ["token", String(data.accessToken)],
        ["refreshToken", String(data.refreshToken)],
      ]);
      console.log("✅ [apiClient] 토큰 갱신 성공");
      processQueue(null, data.accessToken);
      return data.accessToken;
    }

    // 400~499 사이의 에러는 세션 만료로 간주
    if (res.status >= 400 && res.status < 500) {
      throw new Error("SESSION_EXPIRED");
    }
    throw new Error("SERVER_TEMPORARY_ERROR");
  } catch (e: any) {
    if (e.message === "SESSION_EXPIRED" || e.message === "NO_REFRESH_TOKEN") {
      processQueue(e, null);
      console.error("❌ 세션 만료: 데이터 삭제 및 로그아웃");
      await AsyncStorage.multiRemove([
        "token",
        "refreshToken",
        "userData",
        "coupleId",
        "roomId",
      ]);
      Alert.alert("로그인 세션 만료", "다시 로그인해주세요.");
      router.replace("/(auth)");
    } else {
      // 일시적 서버 에러 시 대기열에 에러 전달하여 무한 대기 방지
      processQueue(e, null);
    }
    return null;
  } finally {
    isRefreshing = false;
  }
}

/**
 * 2. 공통 인증 Fetch 함수
 */
export async function authFetch(url: string, options: any = {}) {
  const fullUrl = url.startsWith("http") ? url : `${BASE_URL}${url}`;

  const execute = async (t: string | null) => {
    const headers: any = {
      ...options.headers,
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    };
    if (!(options.body instanceof FormData))
      headers["Content-Type"] = "application/json";
    if (t) headers["Authorization"] = `Bearer ${t}`;
    return fetch(fullUrl, { ...options, headers });
  };

  // [보강] 앱 재시작 시 토큰이 없으면 즉시 갱신부터 시도 (Proactive)
  let token = await AsyncStorage.getItem("token");
  if (!token) {
    const refreshToken = await AsyncStorage.getItem("refreshToken");
    if (refreshToken) {
      token = (await getNewToken()) as string;
    }
  }

  if (isRefreshing && !token) {
    token = (await new Promise((resolve, reject) => {
      failedQueue.push({ resolve, reject });
    })) as string;
  }

  let res = await execute(token);

  if (res.status === 401) {
    const newToken = await getNewToken();
    if (newToken) {
      return await execute(newToken as string);
    }
  }

  return res;
}
