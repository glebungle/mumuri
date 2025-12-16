import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useState } from 'react';

const BASE_URL = 'https://mumuri.shop';

// [1] MainPhoto 타입 정의
export interface MainPhoto {
  photoId: number;
  imageUrl: string;
  uploaderType: string; // 'ME' | 'PARTNER'
  uploaderNickname: string;
  createdAt: string;
}

// [2] 홈 메인 데이터 타입 수정 (mainPhoto 추가)
export interface HomeData {
  anniversary: string;
  name: string | null;
  date: number; // dDay
  roomId: number;
  userId: number; 
  coupleId: number;
  missionCompletedCount: number;
  mainPhoto: MainPhoto | null; 
  myProfileImageUrl: string | null;
  partnerProfileImageUrl: string | null;
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

// --- API 호출 함수들 ---

async function fetchHomeMain(token: string) {
  try {
    const res = await fetch(`${BASE_URL}/home/main`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Home Main Fetch Error: ${res.status}`);
    return res.json();
  } catch (error) {
    console.error('❌ fetchHomeMain 실패:', error);
    return null; 
  }
}

async function fetchUserInfo(token: string) {
  try {
    const res = await fetch(`${BASE_URL}/user/getuser`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`User Info Fetch Error: ${res.status}`);
    return res.json();
  } catch (error) {
    console.error('❌ fetchUserInfo 실패:', error);
    return null;
  }
}

async function fetchTodayMissions(token: string) {
  try {
    const res = await fetch(`${BASE_URL}/api/couples/missions/today`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 404) return []; 
    if (!res.ok) throw new Error(`Today Mission Fetch Error: ${res.status}`);
    return res.json();
  } catch (error) {
    console.error('❌ fetchTodayMissions 실패:', error);
    return [];
  }
}

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [userData, setUserData] = useState<HomeData | null>(null);
  const [todayMissions, setTodayMissions] = useState<TodayMission[]>([]);

  const refreshUserData = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        console.log('토큰이 없습니다.');
        return;
      }

      const [homeResponse, userInfo, missionResponse] = await Promise.all([
        fetchHomeMain(token),
        fetchUserInfo(token),
        fetchTodayMissions(token),
      ]);

      let mergedData: HomeData | null = null;
      let extractedUserId = null;

      if (typeof userInfo === 'number') {
        extractedUserId = userInfo;
      } else if (typeof userInfo === 'object' && userInfo !== null) {
        extractedUserId = userInfo.userId ?? userInfo.id ?? userInfo.memberId ?? null;
      }

      if (homeResponse && extractedUserId !== null) {
        mergedData = {
          anniversary: homeResponse.anniversary,
          name: homeResponse.name,
          date: homeResponse.dDay || 0,
          roomId: homeResponse.roomId,
          coupleId: homeResponse.coupleId, 
          userId: Number(extractedUserId),
          missionCompletedCount: homeResponse.missionCompletedCount || 0,
          mainPhoto: homeResponse.mainPhoto || null,
          myProfileImageUrl: homeResponse.myProfileImageUrl || null,
          partnerProfileImageUrl: homeResponse.partnerProfileImageUrl || null,
        };
        setUserData(mergedData);
      } else {
        console.warn('⚠️ [UserContext] 데이터 로드 실패 (필수 정보 누락)');
      }

      if (Array.isArray(missionResponse)) {
        setTodayMissions(missionResponse);
      } else {
        setTodayMissions([]);
      }

    } catch (e) {
      console.warn('User data fetch failed', e);
    }
  };

  return (
    <UserContext.Provider value={{ userData, todayMissions, setUserData, setTodayMissions, refreshUserData }}>
      {children}
    </UserContext.Provider>
  );
};