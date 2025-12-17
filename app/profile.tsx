import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../components/AppText';
// import { useUser } from './context/UserContext';

// 백엔드 API 명세에 맞춘 타입 정의
interface MyPageResponse {
  name: string;
  birthday: string;
  anniversary: string;
  birthdayCouple: string;
  dDay: number;
}

export default function AccountSettingScreen() {
  const insets = useSafeAreaInsets();
  // const { userData, refreshUserData } = useUser(); 
  const [myPageData, setMyPageData] = useState<MyPageResponse | null>(null);

  const handleBack = () => router.back();
  const handleEdit = () => router.push('/edit');

  const formatDate = (dateString?: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}. ${month}. ${day}`;
};

const formatBirthString = (raw?: string | null): string => {
  if (!raw) return '--. --. --';
  return formatDate(raw); 
};
  
  const myName = myPageData?.name || '사용자';
  const myBirth = formatBirthString(myPageData?.birthday);

  const anniversaryDate = formatDate(myPageData?.anniversary);
  

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#1E1E1E" />
        </Pressable>
        <AppText style={styles.headerTitle}>프로필 관리</AppText>
        <View style={{ width: 24 }} />
      </View>

      {/* 메뉴 리스트 */}
      <View style={styles.content}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <AppText type='medium' style={styles.sectionTitle}>마이 프로필</AppText>
          </View>
        </View>
        
        <View style={styles.menuItem}>
          <AppText type="semibold" style={styles.menuText}>이름</AppText>
          <AppText type="regular" style={styles.subText}>{myName}</AppText>
        </View>

        <View style={styles.menuItem}>
          <AppText type="semibold" style={styles.menuText}>생년월일</AppText>
          <AppText type="regular" style={styles.subText}>{myBirth}</AppText>
        </View>

        <View style={styles.menuItem}>
          <AppText type="semibold" style={styles.menuText}>기념일</AppText>
          <AppText type="regular" style={styles.subText}>{anniversaryDate}</AppText>
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: 20 + insets.bottom }]}>
        <Pressable style={styles.Button} onPress={handleEdit}>
          <AppText type="semibold" style={styles.ButtonText}>프로필 변경</AppText>
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
  },
  content: {
    marginTop: 10,
    paddingHorizontal: 24,
  },
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
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18,
  },
  menuText: {
    fontSize: 14,
    color: '#747474',
  },
  subText: {
    fontSize: 14,
    color: '#747474',
  },
  footer: {
    marginTop: 'auto', 
    paddingHorizontal: 24,
  },
  Button: {
    backgroundColor: '#6198FF', 
    borderRadius: 12, 
    height: 56,
    alignItems: 'center', 
    justifyContent: 'center',
  },
  ButtonText: { 
    color: '#FFF', 
    fontSize: 16, 
  },
});