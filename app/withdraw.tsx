import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../components/AppText';

const BASE_URL = 'https://mumuri.shop';

export default function WithdrawScreen() {
  const insets = useSafeAreaInsets();
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleBack = () => router.back();

  const handleWithdraw = async () => {
    if (!checked) return;

    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('token');
      
      const res = await fetch(`${BASE_URL}/user/users/me`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });

      if (res.ok) {
        await AsyncStorage.clear();
        Alert.alert('탈퇴 완료', '회원 탈퇴가 완료되었습니다.', [
          { text: '확인', onPress: () => router.replace('/') }
        ]);
      } else {
        const errorText = await res.text();
        console.error('Withdraw failed:', errorText);
        Alert.alert('오류', '회원 탈퇴 처리에 실패했습니다. 잠시 후 다시 시도해주세요.');
      }
    } catch (e) {
      console.error('Withdraw error:', e);
      Alert.alert('오류', '네트워크 오류가 발생했습니다.');
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
        <AppText style={styles.headerTitle}>무무리 탈퇴</AppText>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <AppText type='medium' style={styles.warningText}>무무리를 탈퇴하면,</AppText>
        <View style={{ height: 30 }} />
        <AppText type='medium' style={styles.warningText}>정보 복구 불가능</AppText>
        <View style={{ height: 30 }} />
        <AppText type='medium' style={styles.warningText}>중요한 정보는 탈퇴 전 저장해주세요.</AppText>
      </View>

      {/* 하단 영역 */}
      <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.checkboxRow} >
        <AppText type='medium' style={styles.checkLabel}>
            위 유의사항을 모두 확인하였고, 탈퇴를 진행합니다.
          </AppText>
        {/* 체크박스 영역 */}
        <Pressable 
          onPress={() => setChecked(!checked)}
        >
          <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
            {checked && <Ionicons name="checkmark" size={20} color="#000" />}
          </View>
        </Pressable>
        </View>

        {/* 탈퇴 버튼 */}
        <Pressable 
          style={[
            styles.withdrawButton, 
            (!checked || loading) && styles.withdrawButtonDisabled
          ]} 
          onPress={handleWithdraw}
          disabled={!checked || loading}
        >
          <AppText type="medium" style={styles.withdrawButtonText}>
            {loading ? '처리중...' : '무무리 탈퇴'}
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
  },
  content: {
    flex: 1,
    paddingHorizontal: 30,
    paddingTop: 50,
  },
  warningText: {
    fontSize: 16,
    color: '#000',
    lineHeight: 24,
  },
  bottomContainer: {
    paddingHorizontal: 24,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 20,
    gap: 8,
  },
  checkLabel: {
    fontSize: 12,
    color: '#444',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    backgroundColor: '#CECECE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#CECECE', 
  },
  withdrawButton: {
    backgroundColor: '#6198FF',
    borderRadius: 12,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  withdrawButtonDisabled: {
    backgroundColor: '#A0C4FF', // 비활성화 시 연한 색
  },
  withdrawButtonText: {
    color: '#FFF',
    fontSize: 16,
  },
});