// app/oauth/kakao.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';

export default function KakaoDeepLinkHandler() {
  const { token, nickname, status } = useLocalSearchParams<{
    token?: string;
    nickname?: string;
    status?: string; // 'NEW' | 'NEED_INFO' | 'OK' 등
  }>();

  const doneRef = useRef(false); // 중복 실행 방지

  useEffect(() => {
    (async () => {
      if (doneRef.current) return;
      // token 체크
      if (!token) {
        Alert.alert('로그인 오류', '필수 정보(token)를 받지 못했습니다.');
        router.replace('/(auth)');
        return;
      }

      doneRef.current = true;

      try {
        // 닉네임은 혹시 몰라 디코딩
        const name = nickname ? decodeURIComponent(String(nickname)) : undefined;

        await AsyncStorage.setItem('token', String(token));
        if (name) await AsyncStorage.setItem('name', name);

        // 환영 메시지
        if (name) {
          Alert.alert('환영합니다 🎉', `${name}님, 로그인되었어요!`);
        } else {
          Alert.alert('로그인 완료', '성공적으로 로그인했어요!');
        }

        // Alert가 보일 시간을 300ms 정도 주고 이동
        setTimeout(() => {
          if (status === 'NEW' || status === 'NEED_INFO') {
            router.replace('/signup');
          } else {
            router.replace('/(tabs)/camera'); // ✅ 절대 경로 사용
          }
        }, 300);
      } catch (e) {
        console.error('DeepLink handle error:', e);
        Alert.alert('오류', '로그인 처리 중 문제가 발생했습니다.');
        router.replace('/(auth)');
      }
    })();
  }, [token, nickname, status]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator />
    </View>
  );
}
