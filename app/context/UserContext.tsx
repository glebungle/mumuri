import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React, { createContext, useContext, useState } from "react";

const BASE_URL = "https://mumuri.shop";

// --- [1] 타입 정의 ---
export interface MainPhoto {
  photoId: number;
  imageUrl: string;
  uploaderType: string;
  uploaderNickname: string;
  createdAt: string;
}

interface MyPageResponse {
  name: string;
  birthday: string;
  anniversary: string;
  birthdayCouple: string;
  dDay: number;
}

export interface HomeData {
  anniversary: string;
  date: number;
  roomId: number;
  userId: number;
  coupleId: number;
  missionCompletedCount: number;
  mainPhoto: MainPhoto | null;
  myProfileImageUrl: string | null;
  partnerProfileImageUrl: string | null;
  myName: string | null;
  partnerName: string | null;
  birthday: string | null;
  partnerBirthday: string | null;
}

export interface TodayMission {
  missionId: number;
  title: string;
  description: string | null;
  difficulty: string;
  reward: number;
  status: string;
  missionDate: string;
  progresses: any[];
  myDone: boolean;
  myCompletedAt: string | null;
}

interface UserContextType {
  userData: HomeData | null;
  todayMissions: TodayMission[];
  setUserData: (data: HomeData | null) => void;
  setTodayMissions: (missions: TodayMission[]) => void;
  refreshUserData: () => Promise<void>;
}

const UserContext = createContext<UserContextType>({
  userData: null,
  todayMissions: [],
  setUserData: () => {},
  setTodayMissions: () => {},
  refreshUserData: async () => {},
});

export const useUser = () => useContext(UserContext);

// --- [2] 토큰 갱신  ---

/**
 * 리프레시 토큰
 */
async function getNewToken() {
  try {
    const refreshToken = await AsyncStorage.getItem("refreshToken");
    if (!refreshToken) return null;

    const res = await fetch(
      `${BASE_URL}/api/auth/refresh?refreshToken=${encodeURIComponent(refreshToken)}`,
      {
        method: "POST",
      },
    );

    if (res.ok) {
      const data = await res.json();
      await AsyncStorage.setItem("token", data.accessToken);
      if (data.refreshToken) {
        await AsyncStorage.setItem("refreshToken", data.refreshToken);
      }
      console.log("✅ [Token Refresh] 새로운 토큰 발급 성공");
      return data.accessToken;
    }
    return null;
  } catch (e) {
    console.error("❌ [Token Refresh] 에러:", e);
    return null;
  }
}

/**
 * 자동 재발급
 */
async function authenticatedFetch(url: string, options: any = {}) {
  let token = await AsyncStorage.getItem("token");

  const executeFetch = (t: string | null) =>
    fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${t}`,
      },
    });

  let res = await executeFetch(token);

  // 401 발생 시 토큰 갱신 후 재시도
  if (res.status === 401) {
    console.log("🔄 [Auth] 토큰 만료 감지. 재발급 시도 중...");
    const newToken = await getNewToken();

    if (newToken) {
      res = await executeFetch(newToken);
    } else {
      console.warn("⚠️ [Auth] 세션 만료. 로그인 화면으로 이동합니다.");
      await AsyncStorage.multiRemove(["token", "refreshToken", "userId"]);
      router.replace("/");
    }
  }

  return res;
}

// --- [3] API 호출 함수들 ---

async function fetchHomeMain() {
  try {
    const res = await authenticatedFetch(`${BASE_URL}/home/main`);
    if (!res.ok) throw new Error(`Home Main Error: ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error("❌ fetchHomeMain 실패:", error);
    return null;
  }
}

async function fetchUserInfo() {
  try {
    const res = await authenticatedFetch(`${BASE_URL}/user/getuser`);
    if (!res.ok) throw new Error(`User Info Error: ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error("❌ fetchUserInfo 실패:", error);
    return null;
  }
}

async function fetchMyPage() {
  try {
    const res = await authenticatedFetch(`${BASE_URL}/api/mypage`);
    if (!res.ok) throw new Error(`MyPage Error: ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error("❌ fetchMyPage 실패:", error);
    return null;
  }
}

async function fetchTodayMissions(coupleId: number) {
  if (!coupleId || coupleId <= 0) return [];
  try {
    const res = await authenticatedFetch(
      `${BASE_URL}/api/couples/missions/today`,
    );
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`Today Mission Error: ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error("❌ fetchTodayMissions 실패:", error);
    return [];
  }
}

// --- [4] Provider ---

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [userData, setUserData] = useState<HomeData | null>(null);
  const [todayMissions, setTodayMissions] = useState<TodayMission[]>([]);

  const refreshUserData = async () => {
    try {
      const [homeResponse, userInfo, myPageResponse] = await Promise.all([
        fetchHomeMain(),
        fetchUserInfo(),
        fetchMyPage(),
      ]);

      let missionResponse: TodayMission[] = [];
      if (homeResponse?.coupleId > 0) {
        missionResponse = await fetchTodayMissions(homeResponse.coupleId);
      }

      // 데이터 조립 로직
      let extractedUserId: number | null = null;
      if (typeof userInfo === "number") {
        extractedUserId = userInfo;
      } else if (userInfo && typeof userInfo === "object") {
        extractedUserId =
          userInfo.userId ?? userInfo.id ?? userInfo.memberId ?? null;
      }

      if (homeResponse && extractedUserId !== null) {
        const myPageData = myPageResponse as MyPageResponse | null;

        const mergedData: HomeData = {
          anniversary: homeResponse.anniversary,
          date: homeResponse.dDay || 0,
          roomId: homeResponse.roomId,
          coupleId: homeResponse.coupleId,
          userId: extractedUserId,
          missionCompletedCount: homeResponse.missionCompletedCount || 0,
          mainPhoto: homeResponse.mainPhoto || null,
          myProfileImageUrl: homeResponse.myProfileImageUrl || null,
          partnerProfileImageUrl: homeResponse.partnerProfileImageUrl || null,
          myName: homeResponse.myName || null,
          partnerName: homeResponse.partnerName || null,
          birthday: myPageData?.birthday || null,
          partnerBirthday: myPageData?.birthdayCouple || null,
        };
        setUserData(mergedData);
      }
      setTodayMissions(missionResponse);
    } catch (e) {
      console.warn("[UserContext] 전체 새로고침 실패:", e);
    }
  };

  return (
    <UserContext.Provider
      value={{
        userData,
        todayMissions,
        setUserData,
        setTodayMissions,
        refreshUserData,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};
