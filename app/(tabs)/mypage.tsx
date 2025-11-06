// app/(tabs)/mypage.tsx
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppText from '../../components/AppText';

export default function MyPage() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.wrap}>
      {/* 상단 */}
      <View style={styles.header}>
        <Pressable onPress={() => router.replace('/(auth)')}>
          <AppText style={styles.back}>&lt;</AppText>
        </Pressable>
        <AppText style={styles.title}>마이페이지</AppText>
        <View style={{ width: 24 }} />
      </View>

      {/* 프로필 원 */}
      <View style={styles.avatarWrap}>
        <View style={styles.avatar} />
      </View>

      {/* 정보 블록 */}
      <View style={styles.infoBlock}>
        <View style={styles.row}>
          <AppText style={styles.label}>이름</AppText>
          <AppText style={styles.value}>최진영</AppText>
        </View>
        <View style={styles.row}>
          <AppText style={styles.label}>생일</AppText>
          <AppText style={styles.value}>2003.12.12</AppText>
        </View>
        <View style={styles.row}>
          <AppText style={styles.label}>기념일</AppText>
          <AppText style={styles.value}>2023.12.12</AppText>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#FFFCF5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 8,
    justifyContent: 'space-between',
  },
  back: {
    fontSize: 26,
    color: '#444',
  },
  title: {
    fontSize: 16,
    color: '#444',
    fontWeight: '600',
  },
  avatarWrap: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: '#444',
    backgroundColor: '#444',
  },
  infoBlock: {
    paddingHorizontal: 32,
    gap: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  label: {
    width: 56,
    fontSize: 16,
    color: '#444',
  },
  value: {
    fontSize: 16,
    color: '#444',
  },
});
