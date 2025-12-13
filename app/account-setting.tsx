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
        <AppText style={styles.headerTitle}>계정 관리</AppText>
        <View style={{ width: 24 }} />
      </View>

      {/* 메뉴 리스트 */}
      <View style={styles.content}>
        
        {/* 로그아웃 메뉴 */}
        <Pressable 
          style={styles.menuItem} 
          onPress={() => router.push('/logout')}
        >
          <AppText type="medium" style={styles.menuText}>로그아웃</AppText>
          <Ionicons name="chevron-forward" size={20} color="#505050" />
        </Pressable>

        {/* 회원 탈퇴 메뉴 */}
        <Pressable 
          style={styles.menuItem} 
          onPress={() => router.push('/withdraw')}
        >
          <AppText type="medium" style={styles.menuText}>회원 탈퇴</AppText>
          <Ionicons name="chevron-forward" size={20} color="#505050" />
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
    marginTop: 20,
    paddingHorizontal: 24,
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
});