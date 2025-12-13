import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';

const BASE_URL = 'https://mumuri.shop';

async function fetchUserId(token: string) {
  try {
    const res = await fetch(`${BASE_URL}/user/getuser`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const text = await res.text();
    if (text.startsWith('{') || text.startsWith('[')) {
      const data = JSON.parse(text);
      return data.userId ?? data.id ?? data.memberId;
    }
    return text; 
  } catch (e) {
    console.log('User ID 조회 실패:', e);
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
    handleLoginSuccess();
  }, [params.accessToken]); 

  const handleLoginSuccess = async () => {
    if (!params.accessToken) return;
    if (isProcessing.current) return;
    
    isProcessing.current = true;

    // 🛑 좀비 토큰 방어 (아직 유효함)
    const logoutFlag = await AsyncStorage.getItem('isLoggingOut');
    if (logoutFlag === 'true') {
        // 여기로 들어왔다는 건, LoginButton을 거치지 않고(쿠키청소 없이)
        // 백그라운드에서 좀비 토큰이 날아왔다는 뜻이므로 무시합니다.
        console.log('🛑 [Login Handler] 좀비 토큰 차단');
        router.replace({ pathname: '/', params: {} });
        return;
    }

    console.log('🟢 [Login Handler] 정상 로그인 진행');
    
    try {
      // 1. 토큰 저장
      await AsyncStorage.setItem('token', String(params.accessToken));
      if (params.refreshToken) await AsyncStorage.setItem('refreshToken', String(params.refreshToken));
      if (params.nickname) await AsyncStorage.setItem('name', String(params.nickname));
      if (params.email) await AsyncStorage.setItem('email', String(params.email));
      if (params.roomId && params.roomId !== '0') await AsyncStorage.setItem('roomId', String(params.roomId));

      const userId = await fetchUserId(String(params.accessToken));
      if (userId) await AsyncStorage.setItem('userId', String(userId));

      // ✅ [핵심] 로그인이 "성공"했으므로 이제 방어막(깃발)을 제거합니다.
      // 이제 다음번 로그인 때는 쿠키 청소 없이 바로 로그인됩니다.
      await AsyncStorage.removeItem('isLoggingOut');

      // 2. 이동
      if (params.isNew === 'true') {
          router.replace('/signup');
      } else {
          router.replace('/(tabs)/home');
      }

    } catch (e) {
      console.error('❌ [Login Handler] 에러:', e);
      router.replace('/'); 
    }
  };

  return (
    <View style={{ flex:1, alignItems:'center', justifyContent:'center', backgroundColor: '#FFFCF5' }}>
      <ActivityIndicator size="large" color="#FF9E9E" />
    </View>
  );
}