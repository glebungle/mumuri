// app/(tabs)/chat.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  InputAccessoryView,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../../components/AppText';

const BASE_URL = 'https://870dce98a8c7.ngrok-free.app';
const TEST_COUPLE_ID = '1';
const SEND_URL = `${BASE_URL}/chat/${encodeURIComponent(TEST_COUPLE_ID)}`;

const MAX_TEXT_LEN = 500;
const ALLOWED_MIME = ['image/jpeg'];
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const STICKER_SIZE = 128;
const HEADER_HEIGHT = 56;

const SEND_TO_SERVER = false;

type SendStatus = 'sent' | 'sending' | 'failed' | undefined;
type ChatMessage = {
  id: string;
  text?: string;
  imageUri?: string;
  mine: boolean;
  createdAt: number;
  type: 'text' | 'image';
  status?: SendStatus;
};
type DateMarker = { __type: 'date'; key: string; ts: number };

function sameYMD(a: number, b: number) {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear() &&
         da.getMonth() === db.getMonth() &&
         da.getDate() === db.getDate();
}
function sameMinute(a: number, b: number) {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear() &&
         da.getMonth() === db.getMonth() &&
         da.getDate() === db.getDate() &&
         da.getHours() === db.getHours() &&
         da.getMinutes() === db.getMinutes();
}
function formatDate(ts: number) {
  const d = new Date(ts);
  const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
  const w = ['일','월','화','수','목','금','토'][d.getDay()];
  return `${y}년 ${m}월 ${day}일 ${w}요일`;
}
function formatTime(ts: number) {
  const d = new Date(ts);
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h < 12 ? '오전' : '오후';
  if (h === 0) h = 12;
  if (h > 12) h -= 12;
  return `${ampm} ${h}:${m}`;
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const accessoryID = 'chat-input-accessory';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);

  // 가림 방지용
  const [keyboardHeight, setKeyboardHeight] = useState(0);     // Android용 키보드 높이
  const [inputBarHeight, setInputBarHeight] = useState(56);    // 실제 입력바 높이

  const listRef = useRef<FlatList<any>>(null);

  useEffect(() => {
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: any) => {
      const h = e?.endCoordinates?.height ?? 0;
      if (Platform.OS === 'android') setKeyboardHeight(h);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    };
    const onHide = () => setKeyboardHeight(0);

    const s1 = Keyboard.addListener(show, onShow);
    const s2 = Keyboard.addListener(hide, onHide);
    return () => { s1.remove(); s2.remove(); };
  }, []);

  // 갤러리 선택
  const pickFromGallery = useCallback(async () => {
    try {
      setAttaching(true);
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('권한 필요', '앨범 접근 권한이 필요합니다.');
        return;
      }
      const r = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        quality: 0.9,
      });
      if (r.canceled) return;
      const a = r.assets?.[0];
      if (!a?.uri) return;

      const mime = a.mimeType ?? 'image/jpeg';
      if (!ALLOWED_MIME.includes(mime)) {
        Alert.alert('형식 오류', '이미지는 JPEG 형식만 지원해요.');
        return;
      }
      const size = a.fileSize ?? null;
      if (size != null && size > MAX_FILE_SIZE) {
        Alert.alert('용량 초과', `파일 크기 제한은 ${(MAX_FILE_SIZE / (1024*1024)).toFixed(1)}MB 입니다.`);
        return;
      }
      setPendingImage(a.uri);
    } finally {
      setAttaching(false);
    }
  }, []);

  const appendLocal = useCallback((m: ChatMessage) => {
    setMessages((prev) => {
      const next = [...prev, m];
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
      return next;
    });
  }, []);

  const resendMessage = useCallback(async (msgId: string) => {
    const msg = messages.find((m) => m.id === msgId);
    if (!msg) return;
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, status: 'sending' } : m)));
    try {
      const token = (await AsyncStorage.getItem('token')) ?? '';
      if (SEND_TO_SERVER) {
        const form = new FormData();
        if (msg.text) form.append('text', msg.text);
        if (msg.imageUri) {
          form.append('file', { uri: msg.imageUri, name: `img_${Date.now()}.jpg`, type: 'image/jpeg' } as any);
        }
        const res = await fetch(SEND_URL, {
          method: 'POST',
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), Accept: 'application/json', 'ngrok-skip-browser-warning': 'true' },
          body: form,
        });
        const raw = await res.text();
        console.log('[RESEND]', res.status, raw.slice(0, 200));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } else {
        await new Promise((r) => setTimeout(r, 400));
      }
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, status: 'sent' } : m)));
    } catch {
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, status: 'failed' } : m)));
      Alert.alert('전송 실패', '재전송에 실패했어요.');
    }
  }, [messages]);

  const sendMessage = useCallback(async () => {
    if (sending) return;
    const trimmed = text.trim();
    const hasText = trimmed.length > 0;
    const hasImage = !!pendingImage;
    if (!hasText && !hasImage) {
      Alert.alert('안내', '보낼 내용이 없어요.');
      return;
    }
    if (trimmed.length > MAX_TEXT_LEN) {
      Alert.alert('글자 수 초과', `메시지는 최대 ${MAX_TEXT_LEN}자까지 보낼 수 있어요.`);
      return;
    }

    setSending(true);

    const tempId = `local_${Date.now()}`;
    const optimistic: ChatMessage = {
      id: tempId,
      text: hasText ? trimmed : undefined,
      imageUri: hasImage ? pendingImage! : undefined,
      mine: true,
      createdAt: Date.now(),
      type: hasImage ? 'image' : 'text',
      status: SEND_TO_SERVER ? 'sending' : 'sent',
    };
    appendLocal(optimistic);
    setText('');
    setPendingImage(null);

    if (!SEND_TO_SERVER) {
      setSending(false);
      return;
    }

    try {
      const token = (await AsyncStorage.getItem('token')) ?? '';
      const form = new FormData();
      if (hasText) form.append('text', trimmed);
      if (hasImage && optimistic.imageUri) {
        form.append('file', { uri: optimistic.imageUri, name: `sticker_${Date.now()}.jpg`, type: 'image/jpeg' } as any);
      }
      const res = await fetch(SEND_URL, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), Accept: 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: form,
      });
      const raw = await res.text();
      console.log('[SEND]', res.status, raw.slice(0, 200));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, status: 'sent' } : m)));
    } catch {
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, status: 'failed' } : m)));
      Alert.alert('전송 실패', '메시지 전송 중 오류가 발생했어요.');
    } finally {
      setSending(false);
    }
  }, [text, pendingImage, sending, appendLocal]);

  // 날짜 마커 삽입
  const listData = useMemo<(ChatMessage | DateMarker)[]>(() => {
    if (messages.length === 0) return [];
    const out: (ChatMessage | DateMarker)[] = [];
    const sorted = [...messages].sort((a, b) => a.createdAt - b.createdAt);
    let lastTs: number | null = null;
    for (const m of sorted) {
      if (lastTs == null || !sameYMD(lastTs, m.createdAt)) {
        out.push({ __type: 'date', key: `date_${m.createdAt}`, ts: m.createdAt });
      }
      out.push(m);
      lastTs = m.createdAt;
    }
    return out;
  }, [messages]);

  const shouldShowTime = useCallback((idx: number) => {
    const cur = listData[idx] as ChatMessage;
    if ((cur as any).__type === 'date') return false;
    let j = idx + 1;
    while (j < listData.length && (listData[j] as any).__type === 'date') j++;
    const next = j < listData.length ? (listData[j] as ChatMessage) : null;
    if (!next) return true;
    return !(next.mine === cur.mine && sameMinute(next.createdAt, cur.createdAt));
  }, [listData]);

  const renderItem = useCallback(
    ({ item, index }: { item: ChatMessage | DateMarker; index: number }) => {
      if ((item as DateMarker).__type === 'date') {
        const mark = item as DateMarker;
        return (
          <View style={styles.dateWrap}>
            <AppText style={styles.dateText}>{formatDate(mark.ts)}</AppText>
          </View>
        );
      }
      const m = item as ChatMessage;
      const mine = m.mine;
      const showTime = shouldShowTime(index);

      return (
        <View style={[styles.row, mine ? styles.rowMine : styles.rowOther]}>
          {/* 최대 폭 80% */}
          <View style={styles.msgCol}>
            <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
              {m.imageUri ? (
                <Image
                  source={{ uri: m.imageUri }}
                  style={{ width: STICKER_SIZE, height: STICKER_SIZE, borderRadius: 16, marginBottom: m.text ? 6 : 0 }}
                  resizeMode="cover"
                />
              ) : null}
              {m.text ? <AppText style={[styles.msgText, mine ? styles.msgTextMine : styles.msgTextOther]}>{m.text}</AppText> : null}
            </View>
            {showTime && <AppText style={styles.timeTextLeft}>{formatTime(m.createdAt)}</AppText>}
          </View>

          {/* 상태 아이콘(작게) */}
          <View style={styles.metaWrapRight}>
            {m.status === 'failed' ? (
              <Pressable style={styles.retryBtn} onPress={() => resendMessage(m.id)}>
                <Ionicons name="refresh" size={14} color="#FF4D4F" />
              </Pressable>
            ) : m.status === 'sending' ? (
              <Ionicons name="time-outline" size={12} color="#999" />
            ) : null}
          </View>
        </View>
      );
    },
    [shouldShowTime, resendMessage]
  );

  const keyExtractor = useCallback((item: ChatMessage | DateMarker, idx: number) => {
    if ((item as DateMarker).__type === 'date') return (item as DateMarker).key;
    return (item as ChatMessage).id ?? String(idx);
  }, []);

  // 입력바/리스트 패딩 계산
  const inputExtra = Platform.OS === 'android' ? keyboardHeight : 0;
  const listBottomPadding = inputExtra + inputBarHeight + 12 + insets.bottom;

  return (
    <KeyboardAvoidingView
      style={styles.wrap}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + HEADER_HEIGHT : 0}
    >
      {/* 헤더 */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable style={{ paddingHorizontal: 8 }} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#111" />
        </Pressable>
        <AppText style={styles.headerTitle}>애인</AppText>
        <Pressable style={{ paddingHorizontal: 8 }} onPress={pickFromGallery} disabled={attaching}>
          <Ionicons name="camera-outline" size={22} color="#111" />
        </Pressable>
      </View>

      {/* 목록 */}
      <FlatList
        ref={listRef}
        contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: listBottomPadding }}
        data={listData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
      />

      {/* iOS: InputAccessoryView */}
      {Platform.OS === 'ios' ? (
        <InputAccessoryView nativeID={accessoryID}>
          <View
            style={[styles.inputBar, { paddingBottom: 8 + insets.bottom }]}
            onLayout={(e) => setInputBarHeight(e.nativeEvent.layout.height)}
          >
            {pendingImage ? (
              <Image source={{ uri: pendingImage }} style={{ width: 36, height: 36, borderRadius: 8, marginRight: 8 }} />
            ) : null}
            <TextInput
              style={styles.input}
              placeholder="대화를 입력하세요"
              value={text}
              onChangeText={(t) => t.length <= MAX_TEXT_LEN && setText(t)}
              multiline
              inputAccessoryViewID={accessoryID}
            />
            <Pressable style={[styles.sendBtn, sending && { opacity: 0.6 }]} onPress={sendMessage} disabled={sending}>
              <Ionicons name="arrow-up" size={22} color="#fff" />
            </Pressable>
          </View>
        </InputAccessoryView>
      ) : (
        // Android: absolute + keyboardHeight
        <View
          style={[styles.inputBar, { position: 'absolute', left: 0, right: 0, bottom: 8 + insets.bottom + keyboardHeight }]}
          onLayout={(e) => setInputBarHeight(e.nativeEvent.layout.height)}
        >
          {pendingImage ? (
            <Image source={{ uri: pendingImage }} style={{ width: 36, height: 36, borderRadius: 8, marginRight: 8 }} />
          ) : null}
          <TextInput
            style={styles.input}
            placeholder="대화를 입력하세요"
            value={text}
            onChangeText={(t) => t.length <= MAX_TEXT_LEN && setText(t)}
            multiline
          />
          <Pressable style={[styles.sendBtn, sending && { opacity: 0.6 }]} onPress={sendMessage} disabled={sending}>
            <Ionicons name="arrow-up" size={22} color="#fff" />
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#FFFCF5' },

  header: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: '#111' },

  row: {
    width: '100%',
    marginVertical: 6,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  rowMine: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },

  msgCol: {
    maxWidth: '80%',
  },

  bubble: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
  },
  bubbleMine: { backgroundColor: '#8FB6FF' },
  bubbleOther: { backgroundColor: '#fff', borderWidth: StyleSheet.hairlineWidth, borderColor: '#e5e7eb' },

  msgText: { fontSize: 14, lineHeight: 20 },
  msgTextMine: { color: '#fff' },
  msgTextOther: { color: '#111' },

  // 시간 마커
  timeTextLeft: { marginTop: 4, fontSize: 10, color: '#888', alignSelf: 'flex-start', marginLeft: 6 },

  // 상태 아이콘 
  metaWrapRight: { marginLeft: 6, alignItems: 'center', justifyContent: 'flex-end' },
  retryBtn: {
    padding: 2,
    borderRadius: 10,
    backgroundColor: '#FFF2F2',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FFD6D6',
  },

  dateWrap: { alignItems: 'center', marginVertical: 6 },
  dateText: {
    fontSize: 12,
    color: '#888',
    backgroundColor: '#EDEDED',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },

  // 입력바
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    gap: 8,
    backgroundColor: 'transparent',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
    color: '#111',
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FF9191',
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, elevation: 3,
  },
});
