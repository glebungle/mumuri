import React, { createContext, useContext, useState } from "react";
import { authFetch } from "../utils/apiClient"; // 위에서 만든 파일 연결

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

// --- [2] Provider ---

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [userData, setUserData] = useState<HomeData | null>(null);
  const [todayMissions, setTodayMissions] = useState<TodayMission[]>([]);

  const refreshUserData = async () => {
    try {
      const [homeRes, userRes, myPageRes] = await Promise.all([
        authFetch("/home/main"),
        authFetch("/user/getuser"),
        authFetch("/api/mypage"),
      ]);

      const homeResponse = homeRes.ok ? await homeRes.json() : null;
      const userInfo = userRes.ok ? await userRes.json() : null;
      const myPageResponse = myPageRes.ok ? await myPageRes.json() : null;

      let missionResponse: TodayMission[] = [];
      if (homeResponse?.coupleId > 0) {
        const tRes = await authFetch("/api/couples/missions/today");
        if (tRes.ok) {
          missionResponse = await tRes.json();
        }
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
      setTodayMissions(Array.isArray(missionResponse) ? missionResponse : []);
    } catch (e) {
      console.warn("[UserContext] 새로고침 실패:", e);
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
