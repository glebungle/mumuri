// app/(tabs)/chat.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react-native';
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
  View,
  ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../../components/AppText';
import { ChatIncoming, ChatReadUpdate, createChatClient } from '../lib/chatSocket';

// ====== 환경 ======
const BASE_URL = 'https://870dce98a8c7.ngrok-free.app';
const TEST_COUPLE_ID = 1;
const SEND_URL = `${BASE_URL}/chat/${encodeURIComponent(String(TEST_COUPLE_ID))}`;
const WS_URL = 'https://870dce98a8c7.ngrok-free.app/ws-chat';

const MAX_TEXT_LEN = 500;
const ALLOWED_MIME = ['image/jpeg'];
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const STICKER_SIZE = 128;
const HEADER_HEIGHT = 56;

const USE_STOMP = true;
const USE_REST_UPLOAD = false;

// ====== 타입 ======
type SendStatus = 'sent' | 'sending' | 'failed' | undefined;
type ChatMessage = {
  id: string;
  text?: string;
  imageUri?: string;
  imageUrl?: string;
  mine: boolean;
  createdAt: number;
  type: 'text' | 'image';
  status?: SendStatus;
  clientMsgId?: string | null;
};

type DateMarker = { __type: 'date'; key: string; ts: number };

// ====== 유틸 ======
function sameYMD(a: number, b: number) {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear()
    && da.getMonth() === db.getMonth()
    && da.getDate() === db.getDate();
}
function sameMinute(a: number, b: number) {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear()
    && da.getMonth() === db.getMonth()
    && da.getDate() === db.getDate()
    && da.getHours() === db.getHours()
    && da.getMinutes() === db.getMinutes();
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
function uuid4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random()*16)|0, v = c === 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
}

// ====== 동일 콘텐츠 판별(서버가 clientMsgId 미포함 시 fallback 병합용) ======
function isSameContent(local: ChatMessage, incoming: ChatIncoming) {
  const lt = (local.text ?? '').trim();
  const it = (incoming.message ?? '').trim();
  const li = !!local.imageUrl || !!local.imageUri;
  const ii = !!incoming.imageUrl;
  return lt === it && li === ii;
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const accessoryID = 'chat-input-accessory';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);

  // 서버 Long 매핑에 맞춰 숫자 유지
  const ROOM_ID = 1;
  const USER_ID = 1;

  // Android 키보드 가림 방지
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [inputBarHeight, setInputBarHeight] = useState(56);

  const listRef = useRef<FlatList<any>>(null);
  const chatRef = useRef<ReturnType<typeof createChatClient> | null>(null);
  const latestVisibleMsgId = useRef<string | null>(null);

  // 키보드 리스너
  useEffect(() => {
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e: KeyboardEvent) => {
      const h = (e as any)?.endCoordinates?.height ?? 0;
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

  // ====== 공통: id/clientMsgId 중복 방지 추가 ======
  const appendLocal = useCallback((m: ChatMessage) => {
    setMessages(prev => {
      // id 중복, clientMsgId 중복은 버림
      if (prev.find(x => x.id === m.id)) return prev;
      if (m.clientMsgId && prev.find(x => x.clientMsgId === m.clientMsgId)) return prev;
      const next = [...prev, m];
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
      return next;
    });
  }, []);

  // 서버 브로드캐스트 수신 → 낙관적 병합(+fallback) + **추가 중복 방지**
  const onIncoming = useCallback((p: ChatIncoming) => {
    console.log('[INCOMING]', JSON.stringify(p)); // 수신 내용 확인 로그

    setMessages(prev => {
      // 0) 이미 동일 id 가 있으면 무시
      if (p.id != null && prev.some(x => String(x.id) === String(p.id))) return prev;

      // 1) clientMsgId 매칭 병합
      if (p.clientMsgId) {
        const ix = prev.findIndex(x => x.clientMsgId === p.clientMsgId);
        if (ix >= 0) {
          const updated = [...prev];
          const cur = updated[ix];
          updated[ix] = {
            ...cur,
            id: String(p.id ?? cur.id),
            status: 'sent',
            createdAt: p.createdAt ?? cur.createdAt,
            imageUrl: p.imageUrl ?? cur.imageUrl,
            imageUri: p.imageUrl ?? cur.imageUri,
          };
          return updated;
        }
      }

      // 2) 서버가 clientMsgId를 안 보내는 경우: 내가 보낸 메시지면 내용/시간 근사로 병합
      const isMine = String(p.senderId) === String(USER_ID);
      if (isMine) {
        const revIdx = [...prev].reverse().findIndex(m =>
          m.mine && m.status === 'sending' &&
          isSameContent(m, p) &&
          Math.abs(m.createdAt - (p.createdAt ?? m.createdAt)) < 3000
        );
        if (revIdx !== -1) {
          const realIdx = prev.length - 1 - revIdx;
          const updated = [...prev];
          const cur = updated[realIdx];
          updated[realIdx] = {
            ...cur,
            id: String(p.id ?? cur.id),
            status: 'sent',
            createdAt: p.createdAt ?? cur.createdAt,
            imageUrl: p.imageUrl ?? cur.imageUrl,
            imageUri: p.imageUrl ?? cur.imageUri,
          };
          return updated;
        }
      }

      // 3) 여기까지 못 찾았으면 새로 추가 (중복 방지를 위해 마지막으로 한 번 더 검사)
      const add: ChatMessage = {
        id: String(p.id ?? `${Date.now()}`),
        text: p.message ?? undefined,
        imageUrl: p.imageUrl ?? undefined,
        imageUri: p.imageUrl ?? undefined,
        mine: isMine,
        createdAt: p.createdAt ?? Date.now(),
        type: p.imageUrl ? 'image' : 'text',
        status: 'sent',
      };
      if (prev.some(x => x.id === add.id)) return prev;
      return [...prev, add];
    });
  }, [USER_ID]);

  // STOMP 연결
  useEffect(() => {
    let disposed = false;
    (async () => {
      if (!USE_STOMP) return;
      const token = (await AsyncStorage.getItem('token')) ?? undefined;

      const chat = createChatClient({
        wsUrl: WS_URL,
        token,
        roomId: ROOM_ID,
        handlers: {
          onMessage: onIncoming,
          onReadUpdate: (_u: ChatReadUpdate) => {},
          onConnected: () => {
            console.log('[CHAT] connected → markAsRead');
            chatRef.current?.markAsRead(ROOM_ID, USER_ID, latestVisibleMsgId.current ?? undefined);
          },
          onError: (e: unknown) => console.warn('[STOMP ERROR]', e),
        },
        connectTimeoutMs: 6000,
      });

      chatRef.current = chat;
      chat.activate();

      return () => {
        if (disposed) return;
        disposed = true;
        chat.deactivate();
        chatRef.current = null;
      };
    })();
  }, [ROOM_ID, USER_ID, onIncoming]);

  // 재전송
  const resendMessage = useCallback(async (msgId: string) => {
    const msg = messages.find((m) => m.id === msgId);
    if (!msg) return;
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'sending' } : m));
    try {
      const clientMsgId = msg.clientMsgId ?? uuid4();
      chatRef.current?.sendMessage(ROOM_ID, USER_ID, {
        message: msg.text ?? null,
        imageUrl: msg.imageUrl ?? null,
        clientMsgId,
        createdAt: msg.createdAt,
      });
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, clientMsgId } : m));
    } catch {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'failed' } : m));
      Alert.alert('전송 실패', '재전송에 실패했어요.');
    }
  }, [ROOM_ID, USER_ID, messages]);

  // 전송
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

    const clientMsgId = uuid4();
    const tempId = `local_${clientMsgId}`;
    const createdAt = Date.now();

    const optimistic: ChatMessage = {
      id: tempId,
      text: hasText ? trimmed : undefined,
      imageUri: hasImage ? pendingImage! : undefined,
      mine: true,
      createdAt,
      type: hasImage ? 'image' : 'text',
      status: USE_STOMP ? 'sending' : 'sent',
      clientMsgId,
    };
    appendLocal(optimistic);
    setText('');
    const localImageUri = pendingImage;
    setPendingImage(null);

    try {
      let imageUrlToSend: string | null = null;

      if (hasImage && USE_REST_UPLOAD) {
        const token = (await AsyncStorage.getItem('token')) ?? '';
        const form = new FormData();
        form.append('file', { uri: localImageUri!, name: `img_${Date.now()}.jpg`, type: 'image/jpeg' } as any);
        const res = await fetch(SEND_URL, {
          method: 'POST',
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), Accept: 'application/json', 'ngrok-skip-browser-warning': 'true' },
          body: form,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        imageUrlToSend = json?.imageUrl ?? null;
      }

      if (USE_STOMP) {
        chatRef.current?.sendMessage(ROOM_ID, USER_ID, {
          message: hasText ? trimmed : null,
          imageUrl: hasImage ? (imageUrlToSend ?? null) : null,
          clientMsgId,
          createdAt,
        });
      } else {
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'sent' } : m));
      }
    } catch (e) {
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));
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

  // 읽음 보고
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<ViewToken> }) => {
    if (!viewableItems?.length) return;
    const visibleMsg = viewableItems
      .map(v => v.item)
      .filter((it: ChatMessage | DateMarker) => (it as DateMarker).__type !== 'date') as ChatMessage[];

    if (!visibleMsg.length) return;
    const last = visibleMsg[visibleMsg.length - 1];
    if (last?.id && last.id !== latestVisibleMsgId.current) {
      latestVisibleMsgId.current = last.id;
      chatRef.current?.markAsRead(ROOM_ID, USER_ID, last.id);
    }
  }).current;

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
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
      />

      {/* 입력바 */}
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

  msgCol: { maxWidth: '80%' },

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

  timeTextLeft: { marginTop: 4, fontSize: 10, color: '#888', alignSelf: 'flex-start', marginLeft: 6 },

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
