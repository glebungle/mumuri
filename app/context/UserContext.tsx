import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useState } from 'react';

const BASE_URL = 'https://mumuri.shop';

// [1] 홈 메인 데이터 + 유저 ID
export interface HomeData {
  anniversary: string;
  name: string | null;
  date: number;
  roomId: number;
  userId: number; // 숫자형 ID 필수
}

// [2] 오늘의 미션 데이터
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
  refreshUserData: () => Promise<void>;
}

const UserContext = createContext<UserContextType>({
  userData: null,
  todayMissions: [],
  setUserData: () => {},
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
    // 여기서 105 같은 숫자가 바로 리턴됩니다.
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
    if (!res.ok) throw new Error(`Today Missions Fetch Error: ${res.status}`);
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

      const [homeData, userInfo, missionsData] = await Promise.all([
        fetchHomeMain(token),
        fetchUserInfo(token),
        fetchTodayMissions(token),
      ]);

      // 🔍 [디버깅 로그]
      console.log('📢 [DEBUG] UserInfo Type:', typeof userInfo);
      console.log('📢 [DEBUG] UserInfo Value:', userInfo);

      let extractedUserId = null;

      if (typeof userInfo === 'number') {
        extractedUserId = userInfo;
      }

      if (homeData && extractedUserId !== null) {
        const mergedData: HomeData = {
          ...homeData,
          userId: Number(extractedUserId), // 숫자로 확실히 변환
        };
        console.log(`✅ UserData 병합 성공! (ID: ${extractedUserId})`);
        setUserData(mergedData);
      } else {
        console.warn('⚠️ UserData 생성 실패 (ID 추출 불가 또는 홈 데이터 누락)');
      }

      if (missionsData) setTodayMissions(missionsData);

    } catch (e) {
      console.warn('User data fetch failed', e);
    }
  };

  return (
    <UserContext.Provider value={{ userData, todayMissions, setUserData, refreshUserData }}>
      {children}
    </UserContext.Provider>
  );
};