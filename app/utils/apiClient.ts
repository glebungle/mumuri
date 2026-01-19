// utils/apiClient.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { Alert } from "react-native";

const BASE_URL = "https://mumuri.shop";

// 토큰 갱신 상태 관리
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: string) => void;
  reject: (error: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token!);
  });
  failedQueue = [];
};

/**
 * 토큰 갱신 로직
 * - 리프레시 토큰이 유효하면 계속 갱신
 * - 리프레시 토큰마저 만료되었을 때만 로그아웃
 */
async function refreshAccessToken(): Promise<string | null> {
  // 이미 갱신 중이면 대기열에 추가
  if (isRefreshing) {
    return new Promise((resolve, reject) => {
      failedQueue.push({ resolve, reject });
    });
  }

  isRefreshing = true;

  try {
    const refreshToken = await AsyncStorage.getItem("refreshToken");
    if (!refreshToken) {
      console.error("❌ [apiClient] refreshToken이 없음");
      throw new Error("NO_REFRESH_TOKEN");
    }

    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: {
        Accept: "*/*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");

      if (res.status === 401 || res.status === 403) {
        throw new Error("REFRESH_TOKEN_EXPIRED");
      }
      throw new Error(`SERVER_ERROR: ${res.status}`);
    }

    const data = await res.json();

    if (!data.accessToken || !data.refreshToken) {
      throw new Error("INVALID_RESPONSE");
    }

    // 새 토큰 저장
    await AsyncStorage.multiSet([
      ["token", data.accessToken],
      ["refreshToken", data.refreshToken],
    ]);

    processQueue(null, data.accessToken);
    return data.accessToken;
  } catch (error: any) {
    if (
      error.message === "REFRESH_TOKEN_EXPIRED" ||
      error.message === "NO_REFRESH_TOKEN"
    ) {
      await handleLogout();
      processQueue(error, null);
      return null;
    }

    processQueue(error, null);
    throw error;
  } finally {
    isRefreshing = false;
  }
}

/**
 * 로그아웃 처리
 */
async function handleLogout() {
  console.log("[apiClient] 로그아웃 처리");

  await AsyncStorage.multiRemove([
    "token",
    "refreshToken",
    "userData",
    "coupleId",
    "roomId",
  ]);

  setTimeout(() => {
    Alert.alert(
      "로그인 만료",
      "다시 로그인해주세요.",
      [
        {
          text: "확인",
          onPress: () => {
            router.replace("/(auth)");
          },
        },
      ],
      { cancelable: false },
    );
  }, 100);
}

/**
 * 공통 인증 Fetch 함수
 */
export async function authFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const fullUrl = url.startsWith("http") ? url : `${BASE_URL}${url}`;

  const executeRequest = async (token: string | null): Promise<Response> => {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    };
    if (!(options.body instanceof FormData))
      headers["Content-Type"] = "application/json";
    if (token) headers["Authorization"] = `Bearer ${token}`;

    return fetch(fullUrl, { ...options, headers });
  };

  let token = await AsyncStorage.getItem("token");
  let response = await executeRequest(token);

  if (response.status === 401 || response.status === 403) {
    try {
      const newToken = await refreshAccessToken();

      if (newToken) {
        response = await executeRequest(newToken);
      } else {
      }
    } catch (error: any) {}
  }

  return response;
}

/**
 * 앱 시작 시 토큰 상태 확인
 */
export async function validateTokenOnStartup(): Promise<boolean> {
  try {
    const token = await AsyncStorage.getItem("token");
    const refreshToken = await AsyncStorage.getItem("refreshToken");

    // 둘 다 없으면 로그인 필요
    if (!token && !refreshToken) {
      return false;
    }

    // 액세스 토큰만 없으면 리프레시 시도
    if (!token && refreshToken) {
      const newToken = await refreshAccessToken();
      return !!newToken;
    }

    return true;
  } catch (error) {
    return false;
  }
}
