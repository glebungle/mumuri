import React, { createContext, useCallback, useContext, useState } from "react";
import { authFetch } from "../utils/apiClient";

// --- 타입 정의  ---
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

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [userData, setUserData] = useState<HomeData | null>(null);
  const [todayMissions, setTodayMissions] = useState<TodayMission[]>([]);

  const refreshUserData = useCallback(async () => {
    try {
      const responses = await Promise.all([
        authFetch("/home/main"),
        authFetch("/user/getuser"),
        authFetch("/api/mypage"),
      ]);

      // 모든 필수 데이터가 ok일 때만 진행
      if (responses.some((r) => !r.ok)) return;

      const dataList = await Promise.all(
        responses.map(async (res) => {
          const text = await res.text();
          return text ? JSON.parse(text) : null;
        }),
      );

      const [homeData, userInfo, myPageData] = dataList;
      if (!homeData || !userInfo) return;

      // 미션 데이터는 선택적으로 가져옴
      let missions = [];
      if (homeData.coupleId > 0) {
        const mRes = await authFetch("/api/couples/missions/today");
        if (mRes.ok) missions = await mRes.json();
      }

      setUserData({
        ...homeData,
        userId: userInfo.userId ?? userInfo.id ?? userInfo,
        birthday: myPageData?.birthday,
        partnerBirthday: myPageData?.birthdayCouple,
      });
      setTodayMissions(Array.isArray(missions) ? missions : []);
    } catch (e) {
      console.error("UserContext Refresh Error:", e);
    }
  }, []);

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
