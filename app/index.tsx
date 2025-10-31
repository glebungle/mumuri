// app/index.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function Gate() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem('token');
      if (token) router.replace('./(auth)');//router.replace('./(tabs)/camera');
      else router.replace('./onboarding/intro');
    })();
  }, [router]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFCF5' }}>
      <ActivityIndicator color="#FF9191" />
    </View>
  );
}

