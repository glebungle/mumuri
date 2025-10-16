// app/index.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function Gate() {
  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem('token');
      if (token) router.replace('./(tabs)/camera');
      else router.replace('./(auth)');
    })();
  }, []);

  return (
    <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
      <ActivityIndicator />
    </View>
  );
}
