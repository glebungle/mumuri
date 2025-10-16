// app/oauth/kakao.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';

export default function KakaoDeepLinkHandler() {
  const { token, nickname, status } = useLocalSearchParams<{
    token?: string;
    nickname?: string;
    status?: string;
  }>();

  useEffect(() => {
    (async () => {
      if (!token) {
        Alert.alert('로그인 오류', '필수 정보(token)를 받지 못했습니다.');
        router.replace('./(auth)');
        return;
      }

      await AsyncStorage.setItem('token', String(token));
      if (nickname) await AsyncStorage.setItem('name', String(nickname));

      if (status === 'NEW' || status === 'NEED_INFO') {
        router.replace('/signup'); // 너의 회원가입 라우트로
      } else {
        router.replace('./(tabs)/camera'); // 로그인 후 홈(카메라)
      }
    })();
  }, [token, nickname, status]);

  return (
    <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
      <ActivityIndicator />
    </View>
  );
}
