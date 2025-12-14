// app/share.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImageManipulator from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, View } from 'react-native'; // ActivityIndicator 추가
import AppText from '../components/AppText';
import { ChatIncoming, ChatReadUpdate, createChatClient } from './lib/chatSocket';
// ✅ [수정] Context 사용
import { useUser } from './context/UserContext';

const BASE_URL = 'https://mumuri.shop';
const WS_URL   = `${BASE_URL}/ws-chat`;

// 미션 완료 후 채팅에도 실제 "이미지 메시지"를 남길지
const SEND_CHAT_IMAGE_AFTER_COMPLETE = true;
// STOMP로 presignedUrl을 그대로 보낼지(권장: true)
const USE_PRESIGNED_FOR_STOMP = true;

// UUID
function uuid4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0, v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// presignedUrl에서 ? 이하 제거 → 쿼리 없는 전체 URL
function toRawUrl(url?: string | null) {
  if (!url) return null;
  try { return url.split('?')[0] || url; } catch { return url; }
}

// presigned/full URL에서 "S3 object key"만 추출
function extractS3KeyFromUrl(url?: string | null) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.pathname.replace(/^\/+/, '');
  } catch {
    const marker = '.amazonaws.com/';
    const idx = url.indexOf(marker);
    if (idx >= 0) {
      return url.substring(idx + marker.length);
    }
    return url;
  }
}

// STOMP로 채팅방에 이미지 메시지 1회 발사
async function sendChatImageViaStomp({
  token, roomId, senderId, imageUrl,
}: { token: string; roomId: string; senderId: number; imageUrl: string; }) {
  return new Promise<boolean>((resolve) => {
    const client = createChatClient({
      wsUrl: WS_URL,
      token,
      roomId,
      handlers: {
        onMessage: (_msg: ChatIncoming) => {},
        onReadUpdate: (_u: ChatReadUpdate) => {},
        onConnected: () => {
          const now = Date.now();
          client.sendMessage(roomId, senderId, {
            message: null,
            imageUrl,
            clientMsgId: uuid4(),
            createdAt: now,
          });
          setTimeout(() => { client.deactivate(); resolve(true); }, 300);
        },
        onError: (e) => {
          console.warn('[STOMP ERROR]', (e as any)?.message);
          try { client.deactivate(); } finally { resolve(false); }
        },
      },
      connectTimeoutMs: 5000,
    });

    client.activate();
    setTimeout(() => { try { client.deactivate(); } finally { resolve(false); } }, 7000);
  });
}

// ===== 메인 컴포넌트 =====
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

  // ✅ [수정] 전역 Context에서 사용자 정보 가져오기
  const { userData } = useUser();
  const userId = userData?.userId || null;
  const coupleId = userData?.coupleId || null;

  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

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
      console.error(e);
      Alert.alert('저장 실패', '사진 저장 중 문제가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // ===== 전송 =====
  const sendToPartner = async () => {
    if (!photoUri || sending) return;
    
    // ✅ 토큰은 스토리지에서 직접 가져오고, ID는 Context값 사용
    const token = await AsyncStorage.getItem('token');
    if (!token) { Alert.alert('오류','로그인 정보가 없습니다. 다시 로그인해 주세요.'); return; }
    
    // ✅ Context 정보 확인
    if (!userId || !coupleId) {
      Alert.alert('정보 부족', '사용자 또는 커플 정보를 불러오지 못했습니다. 앱을 다시 실행해주세요.');
      console.log('[Share Error] Missing Info:', { userId, coupleId });
      return;
    }

    setSending(true);
    try {
      const uid = userId;
      const cid = coupleId;

      // 1) 리사이즈 (업로드/저장 공통 소스)
      let uploadUri = photoUri;
      try {
        const manipulated = await ImageManipulator.manipulateAsync(
          photoUri, [{ resize: { width: 1200 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
        );
        uploadUri = manipulated.uri;
        console.log('[UPLOAD] resized image uri =', uploadUri);
      } catch {
        console.warn('[UPLOAD] resize failed, use original uri');
      }

      // --- 공통: 사진을 먼저 /photo/{coupleId} 에 업로드해서 presignedUrl 확보 ---
      const uploadUrl = `${BASE_URL}/photo/${encodeURIComponent(String(cid))}`;
      console.log('[UPLOAD] url =', uploadUrl);

      const uploadForm = new FormData();
      uploadForm.append('file', {
        uri: uploadUri,
        name: `photo_${Date.now()}.jpg`,
        type: 'image/jpeg',
      } as any);

      const upRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: uploadForm,
      });
      const upRaw = await upRes.text();
      console.log('[UPLOAD] status =', upRes.status, 'raw body =', upRaw);
      if (upRes.status === 413) {
        Alert.alert('사진이 너무 커요','사진 용량 제한을 넘었어요.');
        return;
      }
      if (!upRes.ok) throw new Error(`HTTP ${upRes.status}`);

      // 2) 최신 presignedUrl 조회
      const listUrl = `${BASE_URL}/photo/${encodeURIComponent(String(cid))}/all`;
      const listRes = await fetch(listUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
      });
      const listRaw = await listRes.text();
      // console.log('[PHOTO LIST] status =', listRes.status, 'raw =', listRaw.slice(0, 200));
      if (!listRes.ok) throw new Error(`photo list HTTP ${listRes.status}`);

      let listJson: any[] = [];
      try { listJson = JSON.parse(listRaw); } catch {}

      // 미션이 있는 경우: 해당 미션 경로만 필터, 없으면 그냥 최신
      let photoUrlPresigned: string | null = null;
      const midNum = missionId ? Number(missionId) : null;

      if (midNum != null && Number.isFinite(midNum)) {
        const missionItems = listJson.filter(x =>
          typeof x.presignedUrl === 'string' &&
          x.presignedUrl.includes(`/${cid}/${midNum}/`)
        );
        if (missionItems.length > 0) {
          let latest = missionItems[0];
          for (const it of missionItems) { if (it?.id > latest?.id) latest = it; }
          photoUrlPresigned = latest?.presignedUrl ?? null;
        }
      }

      // 필터 결과가 없거나 미션이 없는 경우 → id 가장 큰 항목
      if (!photoUrlPresigned) {
        const rawList = Array.isArray(listJson) ? listJson : (listJson as any).items || [];
        if (rawList.length > 0) {
          let latest = rawList[0];
          for (const it of rawList) { if (it?.id > latest?.id) latest = it; }
          photoUrlPresigned =
            typeof latest?.presignedUrl === 'string' ? latest.presignedUrl : null;
        }
      }

      if (!photoUrlPresigned) {
        throw new Error('presignedUrl을 찾을 수 없습니다.');
      }

      // ---- 여기서부터 미션 여부에 따라 분기 ----
      if (missionId) {
        // 🔸 미션 완료 API
        const mid = Number(missionId);
        const completeUrl = `${BASE_URL}/api/couples/missions/${mid}/complete-v2`;

        // 서버가 S3 Key를 기대한다고 보고, URL에서 key만 추출해서 보냄
        const s3Key = extractS3KeyFromUrl(photoUrlPresigned) || photoUrlPresigned;
        const bodyJson = JSON.stringify({ file: s3Key });

        console.log('[MISSION COMPLETE] request →', completeUrl, bodyJson);

        const compRes = await fetch(completeUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
          },
          body: bodyJson,
        });
        const compText = await compRes.text();
        console.log('[MISSION COMPLETE] response ←', compRes.status, compText);
        if (!compRes.ok) throw new Error(`mission complete ${compRes.status}: ${compText}`);

        // (옵션) STOMP로 채팅 전송
        if (SEND_CHAT_IMAGE_AFTER_COMPLETE && photoUrlPresigned && uid) {
          const imageUrlForStomp = USE_PRESIGNED_FOR_STOMP
            ? photoUrlPresigned
            : (toRawUrl(photoUrlPresigned) || photoUrlPresigned);

          try {
            await sendChatImageViaStomp({
              token,
              roomId: String(cid),
              senderId: uid,
              imageUrl: imageUrlForStomp!,
            });
          } catch (e) {
            console.warn('[CHAT IMAGE SEND] (mission) STOMP error', (e as any)?.message);
          }
        }

        // 채팅으로 이동 (미션 텍스트/사진 URL 같이 넘기기)
        router.replace({
          pathname: '/chat',
          params: {
            justCompletedMissionId: String(mid),
            justCompletedMissionText: missionDescription || missionTitle || '',
            justCompletedPhotoUrl: USE_PRESIGNED_FOR_STOMP
              ? (photoUrlPresigned || '')
              : (toRawUrl(photoUrlPresigned || '') || ''),
          },
        });
      } else {
        // 🔹 일반 사진 전송: presigned를 STOMP로만 보내고 채팅으로 이동
        if (SEND_CHAT_IMAGE_AFTER_COMPLETE && photoUrlPresigned && uid) {
          const imageUrlForStomp = USE_PRESIGNED_FOR_STOMP
            ? photoUrlPresigned
            : (toRawUrl(photoUrlPresigned) || photoUrlPresigned);

          try {
            await sendChatImageViaStomp({
              token,
              roomId: String(cid),
              senderId: uid,
              imageUrl: imageUrlForStomp!,
            });
          } catch (e) {
            console.warn('[CHAT IMAGE SEND] (no mission) STOMP error', (e as any)?.message);
          }
        }

        router.replace('/chat');
      }

    } catch (e: any) {
      console.warn('[UPLOAD] error:', e?.message);
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
      <AppText style={styles.title}>{missionLabel}</AppText>

      <Image source={{ uri: photoUri }} style={styles.image} resizeMode="contain" />

      <View style={styles.bottomActions}>
        <Pressable
          style={styles.sendBtn}
          onPress={sendToPartner}
          disabled={sending || !coupleId || !userId} // ID 없으면 비활성화
        >
          {sending ? (
             <ActivityIndicator color="#FF9191" />
          ) : (
             <Ionicons name="paper-plane" size={32} color={sending ? '#FF9191' : '#FF9191'} />
          )}
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
  title: { color: '#3279FF', fontSize: 12, marginTop: 10, marginBottom: 12, textAlign: 'center' },
  image: { width: '100%', flex: 1, borderRadius: 16, backgroundColor: '#000', marginBottom: 100 },
  bottomActions: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 40,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtn: {
    position: 'absolute',
    right: 40,
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backBtn: {
    marginTop: 14,
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
});