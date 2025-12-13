import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../components/AppText';

const BASE_URL = 'https://mumuri.shop';

export default function LogoutScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);

  const handleBack = () => router.back();

  const handleLogout = async () => {
    try {
      setLoading(true);
      // 저장된 토큰 가져오기 (API 호출용)
      const refreshToken = await AsyncStorage.getItem('refreshToken'); 
      const accessToken = await AsyncStorage.getItem('token');

      // API 호출
      const res = await fetch(`${BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`, 
        },
        body: JSON.stringify({
          refreshToken: refreshToken || '', // 리프레시 토큰 전송
        }),
      });

      if (res.ok) {
        // 성공 시 로컬 데이터 삭제 및 이동
        await AsyncStorage.clear();
        Alert.alert('로그아웃', '로그아웃 되었습니다.', [
          { text: '확인', onPress: () => router.replace('/') }
        ]);
      } else {
        // 실패하더라도 앱 내에서는 로그아웃 처리하는 경우가 많음
        await AsyncStorage.clear();
        router.replace('/');
      }
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('오류', '로그아웃 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#1E1E1E" />
        </Pressable>
        <AppText style={styles.headerTitle}>로그아웃</AppText>
        <View style={{ width: 24 }} />
      </View>

      {/* 본문 (이미지상 공백) */}
      <View style={styles.content} />

      {/* 하단 버튼 */}
      <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + 20 }]}>
        <Pressable 
          style={[styles.logoutButton, loading && { opacity: 0.7 }]} 
          onPress={handleLogout}
          disabled={loading}
        >
          <AppText type="medium" style={styles.logoutButtonText}>
            {loading ? '처리중...' : '무무리 로그아웃'}
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFF',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    color: '#444444',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  bottomContainer: {
    paddingHorizontal: 24,
  },
  logoutButton: {
    backgroundColor: '#6198FF', // 무무리 테마 블루
    borderRadius: 12,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});