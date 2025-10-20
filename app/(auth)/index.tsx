// app/index.tsx
import KakaoLoginButton from '@/components/KakaoLoginButton';
import { router } from 'expo-router';
import React from 'react';
import {
  Dimensions,
  Pressable,
  StyleSheet,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppText from '../../components/AppText';

const { width, height } = Dimensions.get('window');

export default function StartScreen() {
  // 카메라 테스트를 위해 바로 탭 화면으로 이동
  const handleSkipLogin = () => {
    // 경고 없이 바로 메인 화면으로 
    router.replace('/(tabs)/camera');
  };
  return (
    
    <SafeAreaView style={s.wrap}>

      <View pointerEvents="none" style={s.bubbles}>
        <View style={[s.bubble, { left: 32, top: height * 0.18, backgroundColor: '#49DC95' }]} />
        <View style={[s.bubble, { left: width * 0.65, top: height * 0.35, backgroundColor: '#6198FF' }]} />
        <View style={[s.bubble, { left: width * 0.45, top: height * 0.58, backgroundColor: '#FF9191' }]} />
      </View>

      {/* 중앙 로고/타이틀 */}
      <View style={s.center}>
        <AppText style={s.title}>mumuri</AppText>
      </View>
      {/* 로그인 없이 바로 카메라로 이동 */}
        <Pressable onPress={handleSkipLogin} style={s.skipButton}>
            <AppText type='regular' style={s.skipButtonText}>카메라/메인 테스트 (임시)</AppText>
        </Pressable>

      {/* 하단 액션 영역 */}
      <View style={s.bottom}>
        <KakaoLoginButton />
        <Pressable onPress={() => router.push('/signup')} style={{ marginTop: 14 }}>
          <AppText type='regular'style={s.signupLink}>회원가입</AppText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#FFF8E9',
  },
  bubbles: {
    position: 'absolute',
    inset: 0,
  },
  bubble: {
    position: 'absolute',
    width: 45,
    height: 45,
    borderRadius: 28,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 100,  color: '#444444', letterSpacing: 0 },
  bottom: {
    paddingHorizontal: 20,
    paddingBottom:70,
    alignItems: 'center',
  },
    skipButton: {
        margin: 10,
        paddingHorizontal: 8,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#75787B',
    },
    skipButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
    },
  signupLink: { color: '#75787B', fontSize: 10 },
});
