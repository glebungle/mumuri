import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImageManipulator from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import AppText from '../components/AppText';
import { useUser } from './context/UserContext';

const BASE_URL = 'https://mumuri.shop';

const sendImg = require('../assets/images/Send.png');
const downloadImg = require('../assets/images/Download.png');

// S3 URL에서 Key만 추출하는 함수 
function extractS3KeyFromUrl(url?: string | null) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.pathname.replace(/^\/+/, '');
  } catch {
    const marker = '.amazonaws.com/';
    const idx = url.indexOf(marker);
    if (idx >= 0) return url.substring(idx + marker.length);
    return url;
  }
}

export default function ShareScreen() {
  const { uri, missionId, missionTitle, missionDescription } =
    useLocalSearchParams<{
      uri?: string;
      missionId?: string;
      missionTitle?: string;
      missionDescription?: string;
    }>();

  const photoUri = uri || '';
  const missionLabel = missionDescription || missionTitle || '미션을 연결해주세요!';

  const { userData } = useUser();
  const userId = userData?.userId || null;
  const coupleId = userData?.coupleId || null;

  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const handleBack = () => router.back();

  // ===== 앨범 저장 =====
  const saveToAlbum = async () => {
    if (!photoUri || saving) return;
    try {
      setSaving(true);
      const libPerm = await MediaLibrary.requestPermissionsAsync();
      if (!libPerm.granted) {
        Alert.alert('권한 필요', '사진을 앨범에 저장하려면 권한이 필요합니다.');
        return;
      }
      let toSaveUri = photoUri;
      try {
        const manipulated = await ImageManipulator.manipulateAsync(
          photoUri,
          [{ resize: { width: 1200 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
        );
        toSaveUri = manipulated.uri;
      } catch {}
      await MediaLibrary.createAssetAsync(toSaveUri);
      Alert.alert('저장 완료', '사진이 앨범에 저장되었어요.');
    } catch (e) {
      Alert.alert('저장 실패', '사진 저장 중 문제가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // ===== 전송 로직 (1단계 업로드 -> 2단계 미션 완료) =====
  const sendToPartner = async () => {
    if (!photoUri || sending) return;
    
    const token = await AsyncStorage.getItem('token');
    if (!token) { Alert.alert('오류', '로그인 정보가 없습니다.'); return; }
    if (!userId || !coupleId) { Alert.alert('정보 부족', '사용자 정보를 불러오지 못했습니다.'); return; }

    setSending(true);
    try {
      // 1-1) 이미지 리사이즈
      let uploadUri = photoUri;
      try {
        const manipulated = await ImageManipulator.manipulateAsync(
          photoUri, [{ resize: { width: 1200 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
        );
        uploadUri = manipulated.uri;
      } catch (e) { console.warn('[RESIZE] failed', e); }

      // 1-2) 사진 업로드 
      const uploadUrl = `${BASE_URL}/photo/${encodeURIComponent(String(coupleId))}`;
      const uploadForm = new FormData();
      uploadForm.append('file', {
        uri: uploadUri,
        name: `photo_${Date.now()}.jpg`,
        type: 'image/jpeg',
      } as any);

      if (missionId) {
        uploadForm.append('missionId', missionId.toString());
      }

      const upRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: uploadForm,
      });

      if (!upRes.ok) throw new Error(`업로드 실패 (HTTP ${upRes.status})`);

      // 2) 최신 업로드된 사진의 URL 조회 
      const listUrl = `${BASE_URL}/photo/${encodeURIComponent(String(coupleId))}/all`;
      const listRes = await fetch(listUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
      });
      const listJson = await listRes.json();
      
      let latestPhoto = listJson[0];
      for (const it of listJson) {
        if (it.id > (latestPhoto?.id || 0)) latestPhoto = it;
      }

      const photoUrlPresigned = latestPhoto?.presignedUrl;
      if (!photoUrlPresigned) throw new Error('업로드된 사진 정보를 찾을 수 없습니다.');

      // 3) 미션 완료 API 호출 
      if (missionId) {
        const mid = Number(missionId);
        const completeUrl = `${BASE_URL}/api/couples/missions/${mid}/complete-v2`;
        const s3Key = extractS3KeyFromUrl(photoUrlPresigned) || photoUrlPresigned;

        const compRes = await fetch(completeUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
          },
          body: JSON.stringify({ file: s3Key }),
        });

        if (!compRes.ok) {
          const errText = await compRes.text();
          throw new Error(`미션 완료 처리 실패: ${errText}`);
        }
      }

      // 모든 과정 성공 시 채팅방으로 이동
      router.replace('/chat');

    } catch (e: any) {
      console.error('[SEND ERROR]', e);
      Alert.alert('전송 실패', e?.message || '오류가 발생했습니다.');
    } finally {
      setSending(false);
    }
  };

  if (!photoUri) {
    return (
      <View >
        <AppText>사진 정보가 없어요.</AppText>
        <Pressable  onPress={() => router.replace('/')}>
          <AppText style={{ color: '#fff' }}>홈으로</AppText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <AppText style={styles.title}>{missionLabel}</AppText>
      <View style={styles.imageContainer}>
        <Image source={{ uri: photoUri }} style={styles.image} resizeMode="contain" />
      </View>

      {/* 하단 버튼 영역 */}
      <View style={styles.bottomActions}>
        {/* 뒤로가기 영역 (왼쪽) */}
        <View style={styles.sideAction}>
          <Pressable style={styles.iconCircle} onPress={handleBack}>
            <Ionicons name="chevron-back" size={28} color="#1E1E1E" />
          </Pressable>
        </View>

        {/* 전송 버튼 (중앙) */}
        <Pressable
          style={styles.sendBtn}
          onPress={sendToPartner}
          disabled={sending || !coupleId || !userId}
        >
          <Image source={sendImg} style={styles.sendImage} resizeMode="contain" />
        </Pressable>

        {/* 저장 버튼 (오른쪽) */}
        <View style={styles.sideAction}>
          <Pressable 
            style={styles.iconCircle} 
            onPress={saveToAlbum} 
            disabled={saving || sending}
          >
            <Image source={downloadImg} style={styles.downloadImage} resizeMode="contain" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#FFFCF5', paddingHorizontal: 16, paddingTop: 24 },
  title: { color: '#3279FF', fontSize: 12, marginTop: '5%', marginBottom: 12, textAlign: 'center' },
  imageContainer: {
    width: '100%',
    height: '76%',
    borderRadius: 16,  
    overflow: 'hidden',   
    backgroundColor: '#000',
  },
  image: { width: '100%', height: '100%' },
  
  bottomActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 'auto', 
    marginBottom: 50,  
  },
  
  sideAction: {
    flex: 1,
    alignItems: 'center',
  },

  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sendBtn: {
    width: 72,
    height: 72,
    borderRadius: 40,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  
  sendImage: { width: 40, height: 40, paddingTop:3},
  downloadImage: { width: 30, height: 30 },
});