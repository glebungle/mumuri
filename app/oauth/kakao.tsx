// app/oauth/kakao.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';

const BASE_URL = 'https://870dce98a8c7.ngrok-free.app'; // 동일한 BASE 적용

export default function KakaoDeepLinkHandler() {
  const { token, nickname, status, couple_id, coupleId } = useLocalSearchParams<{
    token?: string;
    nickname?: string;
    status?: string;
    couple_id?: string;
    coupleId?: string;
  }>();

  const doneRef = useRef(false);

  useEffect(() => {
    (async () => {
      if (doneRef.current) return;
      if (!token) {
        Alert.alert('로그인 오류', '필수 정보(token)를 받지 못했습니다.');
        router.replace('/(auth)');
        return;
      }
      doneRef.current = true;

      try {
        const name = nickname ? decodeURIComponent(String(nickname)) : undefined;
        await AsyncStorage.setItem('token', String(token));
        if (name) await AsyncStorage.setItem('name', name);

        // 1) 쿼리에 couple_id가 있으면 저장
        const cid = (couple_id ?? coupleId)?.toString();
        if (cid && cid !== 'null' && cid !== 'undefined') {
          await AsyncStorage.setItem('coupleId', cid);
        } else {
          // 2) 없으면 로그인 직후 me 조회로 확보(옵션 2)
          try {
            const res = await fetch(`${BASE_URL}/me`, {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
                'ngrok-skip-browser-warning': 'true',
              },
            });
            const raw = await res.text();
            let data: any; try { data = JSON.parse(raw); } catch { data = {}; }
            const found = data?.couple_id ?? data?.coupleId;
            if (found != null) await AsyncStorage.setItem('coupleId', String(found));
          } catch {}
        }

        Alert.alert('로그인 완료', name ? `${name}님 환영합니다 🎉` : '성공적으로 로그인했어요!');
        setTimeout(() => {
          if (status === 'NEW' || status === 'NEED_INFO') router.replace('/signup');
          else router.replace('/(tabs)/camera');
        }, 300);
      } catch (e) {
        Alert.alert('오류', '로그인 처리 중 문제가 발생했습니다.');
        router.replace('/(auth)');
      }
    })();
  }, [token, nickname, status]);

  return (
    <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
      <ActivityIndicator />
    </View>
  );
}
