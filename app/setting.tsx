// app/setting.tsx
import { Ionicons } from '@expo/vector-icons';
// import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../components/AppText';

export default function SettingScreen() {
  const insets = useSafeAreaInsets();
  const [coupleCode, setCoupleCode] = useState<string | null>(null);

  // 뒤로가기
  const handleBack = () => router.back();

  // // 커플코드 복사 핸들러
  // const handleCopyCode = async () => {
  //   // 실제로는 AsyncStorage나 API에서 내 코드를 가져와야 함
  //   const code = await AsyncStorage.getItem('coupleCode') || 'CODE-NOT-FOUND';
  //   await Clipboard.setStringAsync(code);
  //   Alert.alert('복사 완료', '커플 코드가 클립보드에 복사되었어요.');
  // };

  // 로그아웃 핸들러
  // const handleLogout = () => {
  //   Alert.alert('로그아웃', '정말 로그아웃 하시겠습니까?', [
  //     { text: '취소', style: 'cancel' },
  //     { 
  //       text: '로그아웃', 
  //       style: 'destructive',
  //       onPress: async () => {
  //         // 토큰 삭제 및 로그인 화면 이동 로직
  //         await AsyncStorage.clear();
  //         router.replace('/'); 
  //       }
  //     }
  //   ]);
  // };

  // // 회원탈퇴 핸들러
  // const handleWithdraw = () => {
  //   Alert.alert('회원 탈퇴', '정말 탈퇴하시겠습니까? 모든 데이터가 삭제됩니다.', [
  //     { text: '취소', style: 'cancel' },
  //     { text: '탈퇴하기', style: 'destructive', onPress: () => console.log('탈퇴 API 호출') }
  //   ]);
  // };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      
      {/* 1. 상단 네비게이션 헤더 */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#1E1E1E" />
        </Pressable>
        <AppText style={styles.headerTitle}>설정</AppText>
        <View style={{ width: 24 }} /> {/* 레이아웃 균형용 공백 */}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* 섹션 1: 프로필 관리 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <AppText type='semibold' style={styles.sectionTitle}>프로필 관리</AppText>
            <Ionicons name="chevron-forward" size={18} color="#000" />
          </View>
          <View style={styles.itemGroup}>
            {/* <Pressable onPress={() => router.push('/mypage/edit')}> */}
              <AppText type='medium' style={styles.itemText}>마이 프로필</AppText>
            {/* </Pressable> */}
          </View>
        </View>

        {/* 섹션 2: 커플 연결 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <AppText type='semibold' style={styles.sectionTitle}>커플 연결</AppText>
            <Ionicons name="chevron-forward" size={18} color="#000" />
          </View>
          <View>
            <View style={styles.itemGroup}>
              <Pressable onPress={() => router.push('/couple-connect')}>
                <AppText type='medium' style={styles.itemText}>커플 연결하기</AppText>
              </Pressable>
            </View>
          </View>
        </View>

        {/* 섹션 3: 계정 관리 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <AppText type='semibold' style={styles.sectionTitle}>계정 관리</AppText>
            <Ionicons name="chevron-forward" size={18} color="#000" />
          </View>
          <View style={styles.itemGroup}>
            {/* <Pressable onPress={handleLogout} style={styles.itemRow}> */}
              <AppText type='medium' style={styles.itemText}>로그아웃</AppText>
            {/* </Pressable> */}
            {/* <Pressable onPress={handleWithdraw} style={styles.itemRow}> */}
              <AppText type='medium' style={styles.itemText}>회원 탈퇴</AppText>
            {/* </Pressable> */}
          </View>
        </View>

        {/* 섹션 4: 정보 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <AppText type='semibold' style={styles.sectionTitle}>정보</AppText>
            <Ionicons name="chevron-forward" size={18} color="#000" />
          </View>
          <View style={styles.itemGroup}>
            <View style={styles.itemRow}>
              <AppText type='medium' style={styles.itemText}>나의 앱 버전</AppText>
              {/* 버전 정보 등 추가 가능 */}
            </View>
            <Pressable style={styles.itemRow}>
              <AppText type='medium' style={styles.itemText}>이용약관</AppText>
            </Pressable>
            <Pressable style={styles.itemRow}>
              <AppText type='medium' style={styles.itemText}>개인정보 처리방침</AppText>
            </Pressable>
          </View>
        </View>

        {/* 섹션 5: 여유공간 (장식용) */}
        <View style={styles.storageSection}>
          <AppText style={styles.storageTitle}>여유공간</AppText>
          
          <View style={styles.storageContent}>
            <AppText type='medium' style={styles.storageUsageText}>65.43GB / 100GB</AppText>
            {/* 프로그레스 바 */}
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: '65%' }]} />
            </View>
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  
  // 헤더 스타일
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
  },

  // 컨텐츠 영역
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },

  // 공통 섹션 스타일
  section: {
    marginTop: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingBottom: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    color: '#444444',
    paddingLeft:8,
  },
  
  // 섹션 하위 아이템 (우측 정렬 텍스트)
  itemGroup: {
    gap: 4, 
  },
  itemRow: {

  },
  itemText: {
    fontSize: 15,
    color: '#666', 
    textAlign: 'right', 
  },

  // 여유공간 섹션 
  storageSection: {
    marginTop: 32,
    
  },
  storageTitle: {
    paddingLeft:8,
    fontSize: 16,
    color: '#444444',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingBottom: 8,
    marginBottom: 12,
  },
  storageContent: {
    gap: 8,
  },
  storageUsageText: {
    paddingLeft:8,
    fontSize: 14,
    color: '#747474',
  },
  progressBarBg: {
    height: 16,
    backgroundColor: '#E0E0E0',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#363636', 
    borderRadius: 6,
  },
});