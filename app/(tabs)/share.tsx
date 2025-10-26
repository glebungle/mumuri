// app/(tabs)/share.tsx  (파일 경로는 네 프로젝트 구조에 맞춰 사용)
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as MediaLibrary from 'expo-media-library';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import AppText from '../../components/AppText';

const BASE_URL = 'https://5fbe91913f6e.ngrok-free.app';

export default function ShareScreen() {
  // 카메라에서 넘어온 파라미터
  const { uri, mission } = useLocalSearchParams<{ uri?: string; mission?: string }>();
  const photoUri = uri || '';

  // 상태
  const [token, setToken] = useState<string | null>(null);
  const [coupleId, setCoupleId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  // ---- 공통: /user/getuser 로 보강해서 coupleId 확보 ----
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
      // 실패해도 조용히 패스
      if (!res.ok) return;

      let data: any;
      try { data = JSON.parse(text); } catch { data = {}; }

      const foundCoupleId = data?.coupleId ?? data?.couple_id ?? null;
      if (foundCoupleId != null && Number.isFinite(Number(foundCoupleId))) {
        const cid = Number(foundCoupleId);
        await AsyncStorage.setItem('coupleId', String(cid));
        setCoupleId(cid);
        console.log('[share] /user/getuser → coupleId =', cid);
      }
    } catch (_) {}
  }, []);

  // ---- 첫 마운트/포커스될 때마다 토큰 & 커플ID 로딩 ----
  const hydrate = useCallback(async () => {
    const t = await AsyncStorage.getItem('token');
    const cidStr = await AsyncStorage.getItem('coupleId');
    setToken(t);
    const cidNum = cidStr != null ? Number(cidStr) : null;
    setCoupleId(Number.isFinite(cidNum as number) ? (cidNum as number) : null);

    // 없으면 보강 호출
    if (t && (cidNum == null || !Number.isFinite(cidNum))) {
      await fetchMeAndStore();
    }
  }, [fetchMeAndStore]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // 다른 탭/화면에서 커플아이디가 저장된 후 돌아왔을 때 갱신되게
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        if (!active) return;
        await hydrate();
      })();
      return () => { active = false; };
    }, [hydrate])
  );

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
      await MediaLibrary.createAssetAsync(photoUri);
      Alert.alert('저장 완료', '사진이 앨범에 저장되었어요.');
    } catch (e) {
      console.error(e);
      Alert.alert('저장 실패', '사진 저장 중 문제가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // ===== 사진 전송 =====
  const sendToPartner = async () => {
    if (!photoUri || sending) return;

    //토큰/커플ID 준비 
    if (!token) {
      Alert.alert('오류', '로그인 정보가 없습니다. 다시 로그인해 주세요.');
      return;
    }
    if (!coupleId || !Number.isFinite(coupleId)) {
      Alert.alert('오류', '커플 ID가 비어있거나 올바르지 않아요.\n회원가입 완료 후 다시 시도해 주세요.');
      return;
    }

    setSending(true);
    try {
      const url = `${BASE_URL}/photo/${encodeURIComponent(String(coupleId))}`;
      console.log('[UPLOAD] url =', url);

      const form = new FormData();
      form.append('file', {
        uri: photoUri,
        name: `photo_${Date.now()}.jpg`,
        type: 'image/jpeg',
      } as any);
      if (mission) form.append('mission', String(mission));

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: form,
      });

      const text = await res.text();
      console.log('[UPLOAD] status =', res.status, 'body =', text.slice(0, 200));

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      Alert.alert('업로드 완료', '상대에게 전송했어요!');
      // 필요하면 전송 후 이동/리셋
      // router.replace('/(tabs)/gallery') 등
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
      <AppText style={styles.title}>
        {mission || '상대방이 주말을 어떻게 보내고 있을지 찍어 보내주세요'}
      </AppText>

      <Image source={{ uri: photoUri }} style={styles.image} resizeMode="cover" />

      <View style={styles.bottomActions}>
        <Pressable style={styles.sendBtn} onPress={sendToPartner} disabled={sending || !token || !coupleId}>
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
  backBtn: { marginTop: 14, backgroundColor: '#2563eb', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
});
