// app/index.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function Gate() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      
      const [token, hasSeenOnboarding] = await Promise.all([
        AsyncStorage.getItem('token'),
        AsyncStorage.getItem('hasSeenOnboarding')
      ]);

      if (token) {
        // 토큰 있음
        router.replace('./(tabs)/home'); 
      } else {
        // 온보딩 이미 봄
        if (hasSeenOnboarding === 'true') {
          router.replace('./(auth)');
        } 
        // 맨 처음 접속엔 온보딩 이동
        else {
          router.replace('./onboarding/intro');
        }
      }
    })();
  }, [router]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFCF5' }}>
      <ActivityIndicator color="#FF9191" />
    </View>
  );
}