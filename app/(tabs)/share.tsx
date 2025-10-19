import { Ionicons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import AppText from '../../components/AppText';

export default function ShareScreen() {
  const { uri } = useLocalSearchParams<{ uri?: string }>();
  const [saving, setSaving] = useState(false);
  const photoUri = uri || '';

  const saveToAlbum = async () => {
    try {
      setSaving(true);
      await MediaLibrary.createAssetAsync(photoUri);
      Alert.alert('저장 완료', '사진이 앨범에 저장되었어요.');
    } catch (e) {
      console.error(e);
      Alert.alert('저장 실패', '사진 저장 중 문제가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const sendToPartner = async () => {
    // TODO: 채팅방/상대에게 업로드 연동(API)
    Alert.alert('전송', '상대에게 전송하는 API는 다음 단계에서 연결할게요!');
  };

  if (!photoUri) {
    return (
      <View style={styles.center}>
        <Text>사진 정보가 없어요.</Text>
        <Pressable style={styles.backBtn} onPress={() => router.replace('../camera')}>
          <Text style={{ color: '#fff' }}>홈으로</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <AppText style={styles.title}>상대방이 주말을 어떻게 보내고 있을지 찍어 보내주세요</AppText>
      <Image source={{ uri: photoUri }} style={styles.image} resizeMode="cover" />

      <View style={styles.bottomActions}>
        <Pressable style={styles.roundBtn} onPress={sendToPartner}>
          <Ionicons name="paper-plane" size={40} color="#FF9191" />
        </Pressable>
        <Pressable style={styles.saveBtn} onPress={saveToAlbum} disabled={saving}>
          <Ionicons name="download-outline" size={32} color="#FF9191" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#FFFCF5', paddingHorizontal: 16, paddingTop: 24 },
  title: { color: '#3279FF', fontSize: 12, marginTop: 10, marginBottom: 12, textAlign: 'center' },
  image: { width: '100%', aspectRatio: 3 / 4, borderRadius: 16, backgroundColor: '#e5e7eb' },

  // ✅ 하단 바: 가운데 정렬만 두고, 아이템은 개별 위치 지정
  bottomActions: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 28,
    alignItems: 'center',   // 중앙 정렬
    height: 90,             // 배치 여유
  },

  // ✅ 전송(가운데)
  roundBtn: {
    alignSelf: 'center',
    width: 76, height: 76, borderRadius: 76, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, elevation: 3,
  },

  // ✅ 저장(오른쪽)
  saveBtn: {
    position: 'absolute',
    right: 50,             // 화면 오른쪽 여백
    bottom: 6,             // 중앙 버튼과 수직 정렬 보정
    width: 70, height: 70,
    alignItems: 'center', justifyContent: 'center',
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backBtn: { marginTop: 14, backgroundColor: '#2563eb', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
});
