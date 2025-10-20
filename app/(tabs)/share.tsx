import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as MediaLibrary from 'expo-media-library';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import AppText from '../../components/AppText';
// import * as FileSystem from 'expo-file-system'; // 🚨 FormData 사용 시 필요 없음
// import { FileSystemUploadType } from 'expo-file-system'; // 🚨 제거

// 임시 설정 (BASE_URL과 COUPLE_ID는 로그인 시 저장된 것을 사용해야 함)
const BASE_URL = 'https://870dce98a8c7.ngrok-free.app'; 

export default function ShareScreen() {
    // 카메라에서 넘어온 파라미터
  const { uri, mission } = useLocalSearchParams<{ uri?: string, mission?: string }>();
  const [saving, setSaving] = useState(false);
    const [sending, setSending] = useState(false); // 전송 상태 추가
  const photoUri = uri || '';

  // 앨범 저장 로직 (수정 없음)
  const saveToAlbum = async () => {
        try {
            setSaving(true);
            const libPerm = await MediaLibrary.requestPermissionsAsync();
            if (!libPerm.granted) {
                Alert.alert('권한 필요', '사진을 앨범에 저장하려면 권한이 필요합니다.');
                return;
            }
            // 🚨 MediaLibrary.createAssetAsync은 URI를 바로 받으므로 FileSystem 필요 없음
            await MediaLibrary.createAssetAsync(photoUri); 
            Alert.alert('저장 완료', '사진이 앨범에 저장되었어요.');
        } catch (e) {
            console.error(e);
            Alert.alert('저장 실패', '사진 저장 중 문제가 발생했습니다.');
        } finally {
            setSaving(false);
        }
  };

    // ====== 상대방에게 전송 (API 연동) ======
  const sendToPartner = async () => {
    if (!photoUri || sending) return;
    setSending(true);

    try {
      const token = await AsyncStorage.getItem('token');
      const coupleIdStr = await AsyncStorage.getItem('coupleId'); // 로그인/페어링 때 저장해야 함
      const coupleId = Number(coupleIdStr);

      if (!token) {
        Alert.alert('오류', '로그인 정보가 없습니다. 다시 로그인해 주세요.');
        setSending(false);
        return;
      }
      if (!Number.isFinite(coupleId)) {
        Alert.alert('오류', '커플 ID가 비어있거나 올바르지 않아요.');
        setSending(false);
        return;
      }

      // ✅ 스웨거와 동일한 실제 엔드포인트
      const url = `${BASE_URL}/photo/1`;
      console.log('[UPLOAD] url =', url);

      const form = new FormData();
      form.append('file', {
        // @ts-ignore (RN 전용 형태)
        uri: photoUri,
        name: `photo_${Date.now()}.jpg`,
        type: 'image/jpeg',
      } as any);
      if (mission) form.append('mission', String(mission));

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true',
          Accept: 'application/json',
          // ⚠️ Content-Type 직접 설정 금지 (FormData가 boundary 추가)
        },
        body: form,
      });

      const text = await res.text();
      console.log('[UPLOAD] status =', res.status, 'body =', text.slice(0, 200));

      if (!res.ok) {
        // 401/403: 토큰/권한, 404: 경로(커플ID), 413: 파일 용량
        throw new Error(`HTTP ${res.status}`);
      }

      Alert.alert('업로드 완료', '상대에게 전송했어요!');
    } catch (e: any) {
      Alert.alert('전송 실패', e?.message || '서버 전송 중 오류가 발생했어요.');
    } finally {
      setSending(false);
    }
  };


  if (!photoUri) {
    return (
      <View style={styles.center}>
        <AppText>사진 정보가 없어요.</AppText>
        <Pressable style={styles.backBtn} onPress={() => router.replace('/')}>
          <AppText style={{ color: '#fff' }}>홈으로</AppText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <AppText style={styles.title}>{mission || '상대방이 주말을 어떻게 보내고 있을지 찍어 보내주세요'}</AppText>
      <Image source={{ uri: photoUri }} style={styles.image} resizeMode="cover" />

      <View style={styles.bottomActions}>
        <Pressable style={styles.sendBtn} onPress={sendToPartner} disabled={sending}>
          <Ionicons name="paper-plane" size={32} color={sending ? '#999' : '#fff'} />
        </Pressable>
        
        <Pressable style={styles.saveBtn} onPress={saveToAlbum} disabled={saving || sending}>
          <Ionicons name="download-outline" size={24} color="#FF9191" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#FFFCF5', paddingHorizontal: 16, paddingTop: 24 },
  title: { color: '#3279FF', fontSize: 12, marginTop:10,marginBottom: 12, textAlign: 'center' },
  image: { width: '100%', aspectRatio: 3 / 4, borderRadius: 16, backgroundColor: '#e5e7eb' },
  bottomActions: {
    position: 'absolute', left: 0, right: 0, bottom: 28,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
  },
  sendBtn: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: '#FF9191',
    alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
  },
  saveBtn: {
    position: 'absolute', right: 40, 
    width: 50, height: 50, borderRadius: 25, 
    backgroundColor: '#fdeaea',
    alignItems: 'center', justifyContent: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backBtn: { marginTop: 14, backgroundColor: '#2563eb', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
}); 