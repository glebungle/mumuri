import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../components/AppText';

export default function AccountSettingScreen() {
  const insets = useSafeAreaInsets();

  const handleBack = () => router.back();

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
            <Ionicons name="pencil" size={20} color="#505050" />
          </View>
        </View>
        
        <View style={styles.menuItem}>
          <AppText type="semibold" style={styles.menuText}>이름</AppText>
          <AppText type="regular" style={styles.subText}>25.12.1</AppText>
        </View>

        <View style={styles.menuItem}>
          <AppText type="semibold" style={styles.menuText}>생년월일</AppText>
          <AppText type="regular" style={styles.subText}>25.12.1</AppText>
        </View>

        <View style={styles.menuItem}>
          <AppText type="semibold" style={styles.menuText}>기념일</AppText>
          <AppText type="regular" style={styles.subText}>25.12.1</AppText>
        </View>

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
    marginTop: 10,
    paddingHorizontal: 24,
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
});