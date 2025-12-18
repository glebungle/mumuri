import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../components/AppText';
import { useUser } from './context/UserContext';

const BASE_URL = 'https://mumuri.shop';

export default function LogoutScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const { setUserData, setTodayMissions } = useUser();
  const handleBack = () => router.back();

  const handleLogoutPress = () => {
    Alert.alert('로그아웃', '정말 로그아웃 하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '로그아웃', style: 'destructive', onPress: performLogout }
    ]);
  };

  const performLogout = async () => {
    setLoading(true);
    try {
      // 1. 백엔드 로그아웃 API (토큰 만료)
      try {
        const accessToken = await AsyncStorage.getItem('token');
        const refreshToken = await AsyncStorage.getItem('refreshToken');
        if (accessToken) {
          await fetch(`${BASE_URL}/auth/logout`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ refreshToken: refreshToken || '' }),
          });
        }
      } catch (e) { /* 무시 */ }

      // 2. 앱 데이터 삭제
      await AsyncStorage.clear();
      setUserData(null);
      setTodayMissions([]);

      // ✅ [핵심] "나 로그아웃 했음" 표시
      // 이 표시가 있으면 다음 로그인 버튼 클릭 시 'prompt=login'이 발동됩니다.
      await AsyncStorage.setItem('isLoggingOut', 'true');

      // 3. 홈으로 이동
      if (router.canDismiss()) {
        router.dismissAll();
      }
      router.replace({
        pathname: '/',
        params: {} 
      });

    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('오류', '로그아웃 처리 중 문제가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#1E1E1E" />
        </Pressable>
        <AppText style={styles.headerTitle}>로그아웃</AppText>
        <View style={{ width: 24 }} />
      </View>
      <View style={styles.content} />
      <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + 20 }]}>
        <Pressable 
          style={[styles.logoutButton, loading && { opacity: 0.7 }]} 
          onPress={handleLogoutPress}
          disabled={loading}
        >
          <AppText type="medium" style={styles.logoutButtonText}>
            {loading ? '로그아웃 중...' : '무무리 로그아웃'}
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#FFF',
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, color: '#444444',  },
  content: { flex: 1 },
  bottomContainer: { paddingHorizontal: 24 },
  logoutButton: {
    backgroundColor: '#6198FF', borderRadius: 12, height: 56,
    alignItems: 'center', justifyContent: 'center',
  },
  logoutButtonText: { color: '#FFF', fontSize: 16, },
});