// app/(tabs)/share.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImageManipulator from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import AppText from '../../components/AppText';
import { ChatIncoming, ChatReadUpdate, createChatClient } from '../lib/chatSocket';

const BASE_URL = 'https://mumuri.shop';
const WS_URL   = `${BASE_URL}/ws-chat`;

// 미션 완료 후 채팅에도 실제 "이미지 메시지"를 남길지
const SEND_CHAT_IMAGE_AFTER_COMPLETE = true;

// STOMP로는 presignedUrl을 그대로 보냄(채팅이 presign을 못해도 이미지가 바로 보이도록)
const USE_PRESIGNED_FOR_STOMP = true;

function uuid4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random()*16)|0, v = c === 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
}

// presignedUrl → raw 키 (필요 시 사용할 수 있게 유지용)
function toRawUrl(url?: string | null) {
  if (!url) return null;
  try { return url.split('?')[0] || url; } catch { return url; }
}

// STOMP를 통해 채팅방에 이미지 메시지 발사 (1회)
async function sendChatImageViaStomp({
  token, roomId, senderId, imageUrl,
}: { token: string; roomId: string; senderId: number; imageUrl: string; }) {
  return new Promise<boolean>((resolve) => {
    const client = createChatClient({
      wsUrl: WS_URL,
      token,
      roomId,
      handlers: {
        // 필수 핸들러들(더미여도 필수)
        onMessage: (_msg: ChatIncoming) => {},
        onReadUpdate: (_u: ChatReadUpdate) => {},
        onConnected: () => {
          const now = Date.now();
          client.sendMessage(roomId, senderId, {
            message: null,
            imageUrl,                  // presigned 그대로 보냄
            clientMsgId: uuid4(),
            createdAt: now,
          });
          // 서버로 전송 후 약간의 여유를 주고 종료
          setTimeout(() => { client.deactivate(); resolve(true); }, 300);
        },
        onError: () => { try { client.deactivate(); } finally { resolve(false); } },
      },
      connectTimeoutMs: 5000,
    });

    client.activate();
    // 연결 실패/미응답 방어 타임아웃
    setTimeout(() => { try { client.deactivate(); } finally { resolve(false); } }, 7000);
  });
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

  const missionLabel =
    missionDescription ||
    missionTitle ||
    '미션을 연결해주세요!';

  const [token, setToken] = useState<string | null>(null);
  const [coupleId, setCoupleId] = useState<number | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const fetchMeAndStore = useCallback(async () => {
    const t = await AsyncStorage.getItem('token');
    if (!t) return;
    try {
      const res = await fetch(`${BASE_URL}/user/getuser`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${t}`,
          'ngrok-skip-browser-warning': 'true',
        },
      });
      const text = await res.text();
      if (!res.ok) return;

      let data: any = {};
      try { data = JSON.parse(text); } catch {}

      const foundCoupleId = data?.coupleId ?? data?.couple_id ?? null;
      const foundUserId   = data?.userId   ?? data?.id       ?? data?.memberId ?? null;

      if (foundCoupleId != null && Number.isFinite(Number(foundCoupleId))) {
        const cid = Number(foundCoupleId);
        await AsyncStorage.setItem('coupleId', String(cid));
        setCoupleId(cid);
      }
      if (foundUserId != null && Number.isFinite(Number(foundUserId))) {
        const uid = Number(foundUserId);
        await AsyncStorage.setItem('userId', String(uid));
        setUserId(uid);
      }
      console.log('[share] /user/getuser →', { coupleId: foundCoupleId, userId: foundUserId });
    } catch (e) {
      console.warn('[share] /user/getuser failed', (e as any)?.message);
    }
  }, []);

  const hydrate = useCallback(async () => {
    const t = await AsyncStorage.getItem('token');
    const cidStr = await AsyncStorage.getItem('coupleId');
    const uidStr = await AsyncStorage.getItem('userId');
    setToken(t);
    setCoupleId(cidStr != null && Number.isFinite(Number(cidStr)) ? Number(cidStr) : null);
    setUserId(uidStr != null && Number.isFinite(Number(uidStr)) ? Number(uidStr) : null);
    if (t && (!cidStr || !uidStr)) await fetchMeAndStore();
  }, [fetchMeAndStore]);

  useEffect(() => { hydrate(); }, [hydrate]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => { if (active) await hydrate(); })();
      return () => { active = false; };
    }, [hydrate])
  );

  const saveToAlbum = async () => {
    if (!photoUri || saving) return;
    try {
      setSaving(true);
      const libPerm = await MediaLibrary.requestPermissionsAsync();
      if (!libPerm.granted) {
        Alert.alert('권한 필요', '사진을 앨범에 저장하려면 권한이 필요합니다.');
        return;
      }
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
    if (!photoUri || sending) return;

    if (!token) { Alert.alert('오류','로그인 정보가 없습니다. 다시 로그인해 주세요.'); return; }
    if (!coupleId || !Number.isFinite(coupleId)) {
      Alert.alert('오류','커플 ID가 비어있거나 올바르지 않아요.\n회원가입 완료 후 다시 시도해 주세요.');
      return;
    }

    setSending(true);
    try {
      // 1) 리사이즈
      let uploadUri = photoUri;
      try {
        const manipulated = await ImageManipulator.manipulateAsync(
          photoUri, [{ resize: { width: 1200 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
        );
        uploadUri = manipulated.uri;
        console.log('[UPLOAD] resized image uri =', uploadUri);
      } catch (e) {
        console.warn('[UPLOAD] resize failed, use original uri', e);
      }

      // 2) 사진 업로드 (multipart)
      const uploadUrl = `${BASE_URL}/photo/${encodeURIComponent(String(coupleId))}`;
      console.log('[UPLOAD] url =', uploadUrl);
      const uploadForm = new FormData();
      uploadForm.append('file', { uri: uploadUri, name: `photo_${Date.now()}.jpg`, type: 'image/jpeg' } as any);

      const upRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: uploadForm,
      });
      const upRaw = await upRes.text();
      console.log('[UPLOAD] status =', upRes.status, 'raw body =', upRaw);
      if (upRes.status === 413) { Alert.alert('사진이 너무 커요','사진 용량 제한을 넘었어요.'); return; }
      if (!upRes.ok) throw new Error(`HTTP ${upRes.status}`);

      // 3) 최신 presignedUrl 조회 → id 가장 큰 항목
      const listUrl = `${BASE_URL}/photo/${encodeURIComponent(String(coupleId))}/all`;
      const listRes = await fetch(listUrl, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'ngrok-skip-browser-warning': 'true' },
      });
      const listRaw = await listRes.text();
      console.log('[PHOTO LIST] status =', listRes.status, 'raw =', listRaw.slice(0, 200));
      if (!listRes.ok) throw new Error(`photo list HTTP ${listRes.status}`);

      let listJson: any[] = [];
      try { listJson = JSON.parse(listRaw); } catch {}
      let latest = listJson[0];
      for (const it of listJson) { if (it?.id > latest?.id) latest = it; }

      const photoUrlPresigned: string | null =
        typeof latest?.presignedUrl === 'string' ? latest.presignedUrl : null;

      if (!photoUrlPresigned) {
        console.warn('[UPLOAD] presignedUrl not found on list item');
      }
      console.log('[UPLOAD] final photoUrl (presigned) =', photoUrlPresigned);

      // 4) 미션 완료 (multipart)
      if (missionId) {
        const midNum = Number(missionId);
        if (Number.isFinite(midNum)) {
          const completeUrl = `${BASE_URL}/api/couples/missions/${encodeURIComponent(String(midNum))}/complete`;
          const completeForm = new FormData();
          completeForm.append('file', {
            uri: uploadUri,
            name: `mission_${Date.now()}.jpg`,
            type: 'image/jpeg',
          } as any);

          console.log('[MISSION COMPLETE] request →', completeUrl);
          const compRes = await fetch(completeUrl, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' },
            body: completeForm,
          });
          const compRaw = await compRes.text();
          console.log('[MISSION COMPLETE] response ←', compRes.status, compRaw);
          if (!compRes.ok) console.warn('[MISSION COMPLETE] failed', compRes.status, compRaw);

          // 5) (옵션) 채팅방에 이미지 메시지 실제로 남기기 — STOMP
          if (SEND_CHAT_IMAGE_AFTER_COMPLETE && photoUrlPresigned && userId) {
            try {
              const imageUrlForStomp = USE_PRESIGNED_FOR_STOMP
                ? photoUrlPresigned
                : (toRawUrl(photoUrlPresigned) || photoUrlPresigned);

              const ok = await sendChatImageViaStomp({
                token,
                roomId: String(coupleId),
                senderId: userId,
                imageUrl: imageUrlForStomp,
              });
              console.log('[CHAT IMAGE SEND] via STOMP =', ok);
            } catch (e) {
              console.warn('[CHAT IMAGE SEND] STOMP error', (e as any)?.message);
            }
          }

          // 6) 채팅으로 이동 + 낙관적 미션말풍선(즉시 보이게 presigned 전달)
          router.replace({
            pathname: '/(tabs)/chat',
            params: {
              justCompletedMissionId: String(midNum),
              justCompletedMissionText: missionDescription || missionTitle || '',
              justCompletedPhotoUrl: photoUrlPresigned || '',
            },
          });
        } else {
          router.replace('/(tabs)/chat');
        }
      } else {
        // 미션 연결 없이 사진만 보낸 케이스: 채팅 이미지 메시지 남기기(옵션)
        if (SEND_CHAT_IMAGE_AFTER_COMPLETE && photoUrlPresigned && userId) {
          try {
            const imageUrlForStomp = USE_PRESIGNED_FOR_STOMP
              ? photoUrlPresigned
              : (toRawUrl(photoUrlPresigned) || photoUrlPresigned);

            const ok = await sendChatImageViaStomp({
              token,
              roomId: String(coupleId),
              senderId: userId,
              imageUrl: imageUrlForStomp,
            });
            console.log('[CHAT IMAGE SEND] (no mission) via STOMP =', ok);
          } catch (e) {
            console.warn('[CHAT IMAGE SEND] (no mission) STOMP error', (e as any)?.message);
          }
        }
        router.replace('/(tabs)/chat');
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

      <Image source={{ uri: photoUri }} style={styles.image} resizeMode="cover" />

      <View style={styles.bottomActions}>
        <Pressable
          style={styles.sendBtn}
          onPress={sendToPartner}
          disabled={sending || !token || !coupleId}
        >
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
  title: { color: '#3279FF', fontSize: 12, marginTop: 10, marginBottom: 12, textAlign: 'center' },
  image: { width: '100%', aspectRatio: 3 / 4, borderRadius: 16, backgroundColor: '#e5e7eb' },
  bottomActions: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 28,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#FF9191',
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
    backgroundColor: '#fdeaea',
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
