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

    const logoutFlag = await AsyncStorage.getItem('isLoggingOut');
    if (logoutFlag === 'true') {
        console.log('[Login Handler] 좀비 토큰 차단');
        router.replace({ pathname: '/', params: {} });
        return;
    }

    console.log(' [Login Handler] 정상 로그인 진행');
    
    try {
      // 1. 토큰 저장
      await AsyncStorage.setItem('token', String(params.accessToken));
      if (params.refreshToken) await AsyncStorage.setItem('refreshToken', String(params.refreshToken));
      if (params.nickname) await AsyncStorage.setItem('name', String(params.nickname));
      if (params.email) await AsyncStorage.setItem('email', String(params.email));
      if (params.roomId && params.roomId !== '0') await AsyncStorage.setItem('roomId', String(params.roomId));

      const userId = await fetchUserId(String(params.accessToken));
      if (userId) await AsyncStorage.setItem('userId', String(userId));

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