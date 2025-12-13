import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview'; // ✅ WebView 사용
import AppText from '../components/AppText';
import { useUser } from './context/UserContext';

const BASE_URL = 'https://mumuri.shop';

// ✅ 환경 변수 또는 문자열 직접 입력 (KakaoLoginButton과 동일해야 함)
const REST_API_KEY = process.env.EXPO_PUBLIC_KAKAO_REST_KEY || ''; 
const LOGOUT_REDIRECT_URI = 'https://mumuri.shop/api/auth/kakao/callback';

export default function LogoutScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [kakaoLogoutVisible, setKakaoLogoutVisible] = useState(false);

  const { setUserData, setTodayMissions } = useUser();

  const handleBack = () => router.back();

  // 1. 로그아웃 버튼 클릭
  const handleLogoutPress = () => {
    Alert.alert('로그아웃', '정말 로그아웃 하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { 
        text: '로그아웃', 
        style: 'destructive',
        onPress: startLogoutProcess 
      }
    ]);
  };

  // 2. 카카오 로그아웃 시도 (WebView 활성화)
  const startLogoutProcess = () => {
    setLoading(true);
    if (REST_API_KEY) {
      console.log('🔄 [Logout] 카카오 로그아웃 WebView 시작...');
      setKakaoLogoutVisible(true); // WebView를 렌더링해서 URL 호출
    } else {
      finalizeLogout();
    }
  };

  // 3. 앱 데이터 정리 및 이동 (최종)
  const finalizeLogout = async () => {
    try {
      console.log('🧹 [Logout] 앱 데이터 정리 시작');
      
      // (선택) 백엔드 로그아웃 API 호출 - 에러나도 무시하고 진행
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
      } catch (e) {
        console.warn('Backend logout warning (Ignored):', e);
      }

      // 로컬 스토리지 삭제
      await AsyncStorage.clear();
      
      // 전역 상태 초기화
      setUserData(null);
      setTodayMissions([]);

      // 로그인 화면으로 이동
      if (router.canDismiss()) {
        router.dismissAll();
      }
      router.replace('/');

    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('오류', '로그아웃 처리 중 문제가 발생했습니다.');
    } finally {
      setLoading(false);
      setKakaoLogoutVisible(false);
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

      {/* ✅ [수정] 카카오 로그아웃용 WebView */}
      {kakaoLogoutVisible && (
        <View style={{ height: 1, opacity: 0 }}> 
          <WebView
            // ✅ [핵심 1] 로그인할 때 생성된 쿠키를 공유받아야 함
            sharedCookiesEnabled={true} 
            
            source={{
              uri: `https://kauth.kakao.com/oauth/logout?client_id=${REST_API_KEY}&logout_redirect_uri=${LOGOUT_REDIRECT_URI}`
            }}
            
            onNavigationStateChange={(e) => {
              console.log('📡 [Logout WebView]', e.url);
              // ✅ [핵심 2] 로그아웃 후 리다이렉트 주소 감지
              if (e.url.includes(LOGOUT_REDIRECT_URI) || e.url.includes('api/auth/kakao/callback')) {
                console.log('✅ [Logout] 카카오 세션 만료 확인됨');
                setKakaoLogoutVisible(false);
                finalizeLogout();
              }
            }}
            
            // 혹시 WebView 로딩 에러 시 강제 로그아웃 진행
            onError={(e) => {
              console.warn('WebView Error:', e.nativeEvent);
              setKakaoLogoutVisible(false);
              finalizeLogout();
            }}
          />
        </View>
      )}
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
    backgroundColor: '#6198FF', 
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