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
// STOMP로 presignedUrl을 그대로 보낼지(권장: true)
const USE_PRESIGNED_FOR_STOMP = true;

function uuid4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0, v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// presignedUrl에서 ? 이하 제거 → raw 키 URL (백엔드가 presign해서 쓰고 싶을 때)
function toRawUrl(url?: string | null) {
  if (!url) return null;
  try { return url.split('?')[0] || url; } catch { return url; }
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
          console.log('[PUB] /app/chat.send', JSON.stringify({
            roomId, senderId, imageUrl, message: null, clientMsgId: uuid4(), createdAt: now
          }));
          client.sendMessage(roomId, senderId, {
            message: null,
            imageUrl,
            clientMsgId: uuid4(),
            createdAt: now,
          });
          setTimeout(() => { client.deactivate(); resolve(true); }, 300);
        },
        onError: (e) => { console.warn('[STOMP ERROR]', (e as any)?.message); try { client.deactivate(); } finally { resolve(false); } },
      },
      connectTimeoutMs: 5000,
    });

    client.activate();
    // 연결 실패/무응답 대비 타임아웃
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
  const missionLabel = missionDescription || missionTitle || '미션을 연결해주세요!';

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

  // userId/coupleId 확보
  const ensureIdsReady = useCallback(async () => {
    if (!token) throw new Error('토큰 없음');
    let uid = userId, cid = coupleId;
    if (!uid || !cid) {
      await fetchMeAndStore();
      const [uidStr, cidStr] = await Promise.all([
        AsyncStorage.getItem('userId'),
        AsyncStorage.getItem('coupleId'),
      ]);
      uid = uid ?? (uidStr ? Number(uidStr) : null);
      cid = cid ?? (cidStr ? Number(cidStr) : null);
    }
    if (!uid || !cid) throw new Error('유저/커플 식별자 준비 실패');
    return { uid, cid };
  }, [token, userId, coupleId, fetchMeAndStore]);

  const saveToAlbum = async () => {
    if (!photoUri || saving) return;
    try {
      setSaving(true);

      const libPerm = await MediaLibrary.requestPermissionsAsync();
      if (!libPerm.granted) {
        Alert.alert('권한 필요', '사진을 앨범에 저장하려면 권한이 필요합니다.');
        return;
      }

      // 편집본 생성(리사이즈)
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
      Alert.alert('저장 완료', '편집본이 앨범에 저장되었어요.');
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

    setSending(true);
    try {
      // 식별자 확보
      const { uid, cid } = await ensureIdsReady();

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

      // ====== 분기 시작 ======
      if (missionId) {
        // 🔸 미션이 연결된 경우: 일반 갤러리 업로드(/photo/{cid})는 "하지 않는다" → 중복 제거
        const midNum = Number(missionId);

        // 2) 미션 완료 업로드만 수행
        const completeUrl = `${BASE_URL}/api/couples/missions/${midNum}/complete`;
        const completeForm = new FormData();
        completeForm.append('file', { uri: uploadUri, name: `mission_${Date.now()}.jpg`, type: 'image/jpeg' } as any);

        console.log('[MISSION COMPLETE] request →', completeUrl);
        const compRes = await fetch(completeUrl, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' },
          body: completeForm
        });
        const compText = await compRes.text();
        console.log('[MISSION COMPLETE] response ←', compRes.status, compText);
        if (!compRes.ok) throw new Error(`mission complete ${compRes.status}: ${compText}`);

        // 3) 채팅에 보낼 이미지 presignedUrl 확보
        //    (백엔드가 응답으로 URL/키를 준다면 그걸 우선 사용)
        let photoUrlPresigned: string | undefined;
        try {
          const compJson = JSON.parse(compText);
          photoUrlPresigned = compJson?.presignedUrl || compJson?.url || compJson?.imageUrl;
        } catch {}

        if (!photoUrlPresigned) {
          // 응답에 없으면 리스트에서 "해당 미션 경로"만 필터해서 최신 1장
          const listUrl = `${BASE_URL}/photo/${cid}/all`;
          const listRes = await fetch(listUrl, {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'ngrok-skip-browser-warning': 'true' },
          });
          const listRaw = await listRes.text();
          console.log('[PHOTO LIST] status =', listRes.status, 'raw =', listRaw.slice(0, 200));
          if (!listRes.ok) throw new Error(`photo list HTTP ${listRes.status}`);

          let listJson: any[] = [];
          try { listJson = JSON.parse(listRaw); } catch {}
          const missionItems = listJson.filter(x =>
            typeof x.presignedUrl === 'string' && x.presignedUrl.includes(`/${cid}/${midNum}/`)
          );
          const latest = missionItems.reduce((a,b) => (a?.id > b?.id ? a : b), missionItems[0]);
          photoUrlPresigned = latest?.presignedUrl;
        }

        // 4) (옵션) STOMP로 채팅 전송
        console.log('[STOMP GUARD]', {
          SEND_CHAT_IMAGE_AFTER_COMPLETE,
          hasPresigned: !!photoUrlPresigned,
          userId: uid,
          coupleId: cid,
          token: !!token,
        });
        if (SEND_CHAT_IMAGE_AFTER_COMPLETE && photoUrlPresigned && uid) {
          const imageUrlForStomp = USE_PRESIGNED_FOR_STOMP
            ? photoUrlPresigned
            : (toRawUrl(photoUrlPresigned) || photoUrlPresigned);

          console.log('[STOMP SEND PREPARED]', {
            roomId: String(cid),
            senderId: uid,
            usingPresigned: USE_PRESIGNED_FOR_STOMP,
            imageUrlLen: imageUrlForStomp?.length,
          });

          try {
            const ok = await sendChatImageViaStomp({
              token,
              roomId: String(cid),
              senderId: uid,
              imageUrl: imageUrlForStomp!,
            });
            console.log('[CHAT IMAGE SEND] via STOMP =', ok);
          } catch (e) {
            console.warn('[CHAT IMAGE SEND] STOMP error', (e as any)?.message);
          }
        }

        // 5) 채팅으로 이동 + 낙관 파라미터 전달
        router.replace({
          pathname: '/(tabs)/chat',
          params: {
            justCompletedMissionId: String(midNum),
            justCompletedMissionText: missionDescription || missionTitle || '',
            justCompletedPhotoUrl: (USE_PRESIGNED_FOR_STOMP ? (photoUrlPresigned || '') : (toRawUrl(photoUrlPresigned || '') || '')),
          },
        });

      } else {
        // 🔹 미션 연결이 없는 일반 전송: 기존 갤러리에 업로드 후 최신 1장 presigned 사용
        const uploadUrl = `${BASE_URL}/photo/${encodeURIComponent(String(cid))}`;
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

        // 최신 presignedUrl 조회 → id 가장 큰 항목
        const listUrl = `${BASE_URL}/photo/${encodeURIComponent(String(cid))}/all`;
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

        // (옵션) STOMP로 채팅 전송
        console.log('[STOMP GUARD(no mission)]', {
          SEND_CHAT_IMAGE_AFTER_COMPLETE,
          hasPresigned: !!photoUrlPresigned,
          userId: uid,
          coupleId: cid,
          token: !!token,
        });

        if (SEND_CHAT_IMAGE_AFTER_COMPLETE && photoUrlPresigned && uid) {
          const imageUrlForStomp = USE_PRESIGNED_FOR_STOMP
            ? photoUrlPresigned
            : (toRawUrl(photoUrlPresigned) || photoUrlPresigned);

          console.log('[STOMP SEND PREPARED(no mission)]', {
            roomId: String(cid),
            senderId: uid,
            usingPresigned: USE_PRESIGNED_FOR_STOMP,
            imageUrlLen: imageUrlForStomp?.length,
          });

          try {
            const ok = await sendChatImageViaStomp({
              token,
              roomId: String(cid),
              senderId: uid,
              imageUrl: imageUrlForStomp!,
            });
            console.log('[CHAT IMAGE SEND] (no mission) via STOMP =', ok);
          } catch (e) {
            console.warn('[CHAT IMAGE SEND] (no mission) STOMP error', (e as any)?.message);
          }
        }

        router.replace('/(tabs)/chat');
      }
      // ====== 분기 끝 ======

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
          disabled={sending || !token || !coupleId || !userId}
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
