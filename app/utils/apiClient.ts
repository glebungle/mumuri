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
  console.log(
    `🔔 [apiClient] 대기열 처리: ${failedQueue.length}개 요청, error=${!!error}`,
  );
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
    console.log("⏳ [apiClient] 토큰 갱신 대기 중... (대기열 추가)");
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

    console.log("🔄 [apiClient] 토큰 갱신 요청 중...");
    const res = await fetch(
      `${BASE_URL}/auth/refresh?refreshToken=${encodeURIComponent(refreshToken)}`,
      {
        method: "POST",
        headers: {
          Accept: "*/*",
          "Content-Type": "application/json",
        },
      },
    );

    console.log(`📡 [apiClient] 리프레시 응답: ${res.status}`);

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      console.error(
        `❌ [apiClient] 리프레시 실패: ${res.status} - ${errorText}`,
      );

      // 리프레시 토큰도 만료
      if (res.status === 401 || res.status === 403) {
        throw new Error("REFRESH_TOKEN_EXPIRED");
      }

      // 서버 에러 (500번대)
      throw new Error(`SERVER_ERROR: ${res.status}`);
    }

    const data = await res.json();
    console.log("📦 [apiClient] 리프레시 응답 데이터:", {
      hasAccessToken: !!data.accessToken,
      hasRefreshToken: !!data.refreshToken,
    });

    if (!data.accessToken || !data.refreshToken) {
      console.error("❌ [apiClient] 응답에 토큰 없음:", data);
      throw new Error("INVALID_RESPONSE");
    }

    // 새 토큰 저장
    await AsyncStorage.multiSet([
      ["token", data.accessToken],
      ["refreshToken", data.refreshToken],
    ]);

    console.log("✅ [apiClient] 토큰 갱신 성공 및 저장 완료");
    processQueue(null, data.accessToken);
    return data.accessToken;
  } catch (error: any) {
    console.error("💥 [apiClient] 토큰 갱신 에러:", error.message);

    // 리프레시 토큰까지 만료된 경우에만 로그아웃
    if (
      error.message === "REFRESH_TOKEN_EXPIRED" ||
      error.message === "NO_REFRESH_TOKEN"
    ) {
      console.log("🚪 [apiClient] 리프레시 토큰 만료 - 로그아웃 처리");
      await handleLogout();
      processQueue(error, null);
      return null;
    }

    console.warn("⚠️ [apiClient] 일시적 에러 - 대기열 전달");
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
  console.log("🔐 [apiClient] 로그아웃 처리 시작");

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

    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    console.log(`📤 [authFetch] ${url} (token: ${token ? "있음" : "없음"})`);
    return fetch(fullUrl, { ...options, headers });
  };

  // 현재 저장된 토큰 가져오기
  let token = await AsyncStorage.getItem("token");

  // 첫 번째 요청 시도
  let response = await executeRequest(token);
  console.log(`📥 [authFetch] ${url} 응답: ${response.status}`);

  // 401 에러 = 액세스 토큰 만료
  if (response.status === 401) {
    console.log(`🔓 [authFetch] ${url} 401 에러 - 토큰 갱신 시도`);

    try {
      // 토큰 갱신 시도
      const newToken = await refreshAccessToken();

      if (newToken) {
        console.log(`🔁 [authFetch] ${url} 갱신된 토큰으로 재시도`);
        response = await executeRequest(newToken);
        console.log(`📥 [authFetch] ${url} 재시도 응답: ${response.status}`);
      } else {
        console.log(`❌ [authFetch] ${url} 토큰 갱신 실패 - 로그인 필요`);
      }
    } catch (error: any) {
      console.error(`💥 [authFetch] ${url} 토큰 갱신 중 에러:`, error.message);
    }
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

    console.log("[Startup] 토큰 상태:", {
      hasToken: !!token,
      hasRefreshToken: !!refreshToken,
    });

    // 둘 다 없으면 로그인 필요
    if (!token && !refreshToken) {
      return false;
    }

    // 액세스 토큰만 없으면 리프레시 시도
    if (!token && refreshToken) {
      console.log("🔄 [Startup] 액세스 토큰 없음 - 리프레시 시도");
      const newToken = await refreshAccessToken();
      return !!newToken;
    }

    return true;
  } catch (error) {
    console.error("❌ [Startup] 토큰 검증 에러:", error);
    return false;
  }
}
