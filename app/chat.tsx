// app/chat.tsx

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ListRenderItem } from 'react-native';
import {
  Dimensions,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  KeyboardEvent,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../components/AppText';
import { useUser } from './context/UserContext';
import { ChatIncoming, createChatClient } from './lib/chatSocket';

const ChatText = (props: React.ComponentProps<typeof AppText>) => {
  const { style, ...rest } = props;
  return (
    <AppText
      {...rest}
      style={[{ fontFamily: 'Pretendard-Medium' }, style]}
    />
  );
};

// ================== 환경 및 상수 ==================
const API_BASE = 'https://mumuri.shop';
const WS_URL = `${API_BASE}/ws-chat`;
const MAX_TEXT_LEN = 500;
const HEADER_HEIGHT = 56;
const USE_STOMP = true;
const cameraImg = require('../assets/images/Camera.png');
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ================== 타입 정의 ==================
type SendStatus = 'sent' | 'sending' | 'failed' | undefined;
type ChatMessage = {
  id: string; 
  text?: string; 
  imageUrl?: string; 
  mine: boolean;
  createdAt: number; 
  type: 'text' | 'image' | 'mission_text';
  status?: SendStatus; 
  clientMsgId?: string | null; 
  isFirstInGroup?: boolean; 
};
type DateMarker = { __type: 'date'; key: string; ts: number };
function isDateMarker(x: ChatMessage | DateMarker): x is DateMarker { return (x as any).__type === 'date'; }

// ================== 유틸 함수 ==================
const CHAT_CACHE_KEY = (roomId: string) => `chat_cache_${roomId}`;
const CACHE_VERSION = 'v1'; 

async function loadChatCache(roomId: string): Promise<ChatMessage[]> {
  try {
    const cached = await AsyncStorage.getItem(CHAT_CACHE_KEY(roomId));
    if (!cached) return [];
    const parsed = JSON.parse(cached);
    return parsed.version === CACHE_VERSION ? parsed.data || [] : [];
  } catch { return []; }
}

async function authedFetch(path: string, init: RequestInit = {}) {
  const token = await AsyncStorage.getItem('token');
  const headers = {
    Accept: 'application/json', 'ngrok-skip-browser-warning': 'true',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init.body && typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
    ...(init.headers || {}),
  };
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  try { return JSON.parse(text); } catch { return text; }
}

function sameYMD(a: number, b: number) {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}
function sameMinute(a: number, b: number) {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate()
    && da.getHours() === db.getHours() && da.getMinutes() === db.getMinutes();
}
function formatDate(ts: number) {
  const d = new Date(ts);
  const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
  const w = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
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
    const r = (Math.random() * 16) | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
function parseTSLocalOrISO(s?: string | null): number | null {
  if (!s) return null;
  const isoTimeStr = String(s).replace(' ', 'T');
  const isoTime = new Date(isoTimeStr).getTime();
  return Number.isNaN(isoTime) ? null : isoTime;
}

// ================== 메인 컴포넌트 ==================
export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { userData } = useUser();
  const userId = userData?.userId || null;
  const ROOM_KEY = userData?.roomId ? String(userData.roomId) : null;

  const { justCompletedMissionId, justCompletedMissionText, justCompletedPhotoUrl, justCompletedAt } =
    useLocalSearchParams<{ justCompletedMissionId?: string; justCompletedMissionText?: string; justCompletedPhotoUrl?: string; justCompletedAt?: string; }>();

  const [token, setToken] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const listRef = useRef<FlatList<ChatMessage | DateMarker>>(null);
  const chatRef = useRef<ReturnType<typeof createChatClient> | null>(null);
  const latestVisibleMsgId = useRef<string | null>(null);

  const scrollToBottom = useCallback(() => {
    if (listRef.current) {
      listRef.current.scrollToOffset({ offset: 0, animated: true });
    }
  }, []);

  // 초기 토큰 로드
  useEffect(() => { (async () => { const t = await AsyncStorage.getItem('token'); if (t) setToken(t); })(); }, []);

  // 키보드 높이 감지
  useEffect(() => {
    const onShow = (e: KeyboardEvent) => setKeyboardHeight(e.endCoordinates.height);
    const onHide = () => setKeyboardHeight(0);
    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', onShow);
    const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', onHide);
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  // 메시지 수신 핸들러
const onIncoming = useCallback((p: ChatIncoming) => {
  setMessages(prev => {
    // 이미 목록에 서버 ID로 존재하는 메시지라면 무시
    if (p.id != null && prev.some(x => String(x.id) === String(p.id))) return prev;

    let updated = [...prev];
    let foundIndex = -1;

    if (p.clientMsgId) {
      foundIndex = prev.findIndex(x => x.clientMsgId === p.clientMsgId);
    }

    if (foundIndex === -1 && p.message) {
      foundIndex = prev.findIndex(x => 
        x.id.startsWith('local_') && 
        x.text === p.message && 
        x.mine === (String(p.senderId) === String(userId))
      );
    }

    if (foundIndex >= 0) {
      const existing = updated[foundIndex];
      updated[foundIndex] = {
        ...existing,
        id: String(p.id ?? existing.id), // 서버 ID로 교체
        status: 'sent',
        createdAt: p.createdAt ?? existing.createdAt,
        imageUrl: p.imageUrl ?? existing.imageUrl,
      };
      return updated;
    } else {
      let newMsgType: 'text' | 'image' | 'mission_text' = 
        (p as any).type === 'MISSION_TEXT' ? 'mission_text' : (p.imageUrl ? 'image' : 'text');

      return [...prev, {
        id: String(p.id ?? Date.now()),
        text: p.message ?? undefined,
        imageUrl: p.imageUrl ?? undefined,
        mine: String(p.senderId) === String(userId ?? ''),
        createdAt: p.createdAt ?? Date.now(),
        type: newMsgType,
        status: 'sent',
      }];
    }
  });
  setTimeout(scrollToBottom, 100);
}, [userId, scrollToBottom]);

  // 소켓 연결
  useFocusEffect(
    useCallback(() => {
      if (!USE_STOMP || !token || !ROOM_KEY || !userId) return;
      const chat = createChatClient({
        wsUrl: WS_URL, token, roomId: ROOM_KEY,
        handlers: {
          onMessage: (p) => onIncoming(p),
          onReadUpdate: () => {},
          onConnected: () => { chatRef.current?.markAsRead(ROOM_KEY, Number(userId), latestVisibleMsgId.current ?? undefined); },
          onError: (e) => console.warn('[STOMP ERROR]', e),
        },
      });
      chatRef.current = chat;
      chat.activate();
      return () => { chat.deactivate(); chatRef.current = null; };
    }, [token, ROOM_KEY, userId, onIncoming]) 
  );

  // 히스토리 로드
  useEffect(() => {
    if (!ROOM_KEY || !token || !userId) return;
    (async () => {
      try {
        const res: any = await authedFetch(`/chat/${ROOM_KEY}/history?size=50`, { method: 'GET' });
        const rows = Array.isArray(res) ? res : (res?.messages || res?.content || []);
        const historyMsgs: ChatMessage[] = rows.map((r: any) => ({
          id: String(r.id),
          text: r.message,
          imageUrl: r.imageUrl,
          mine: String(r.senderId) === String(userId ?? ''),
          createdAt: parseTSLocalOrISO(r.sentAt || r.createdAt) ?? Date.now(),
          type: r.type === 'MISSION_TEXT' ? 'mission_text' : (r.imageUrl ? 'image' : 'text'),
          status: 'sent'
        }));
        setMessages(prev => {
          const all = [...prev, ...historyMsgs];
          const unique = new Map();
          all.forEach(m => unique.set(m.id, m));
          return Array.from(unique.values()).sort((a, b) => a.createdAt - b.createdAt);
        });
      } catch (e) { console.warn(e); }
    })();
  }, [ROOM_KEY, token, userId]);

  // 메시지 전송
  const sendMessage = useCallback(async () => {
    if (!ROOM_KEY || !userId || sending || !text.trim()) return;
    setSending(true);
    const clientMsgId = uuid4();
    const tempId = `local_${clientMsgId}`;
    const createdAt = Date.now();
    setMessages(prev => [...prev, { id: tempId, text: text.trim(), mine: true, createdAt, type: 'text', status: 'sending', clientMsgId }]);
    setText('');
    setTimeout(scrollToBottom, 50);
    try {
      if (USE_STOMP) chatRef.current?.sendMessage(ROOM_KEY, Number(userId), { message: text.trim(), imageUrl: null, clientMsgId, createdAt });
    } catch {
      setMessages(prev => prev.map(m => m.id === tempId ? ({ ...m, status: 'failed' } as ChatMessage) : m));
    } finally { setSending(false); }
  }, [ROOM_KEY, userId, sending, text, scrollToBottom]);

  // 리스트 데이터 변환
  const listData = useMemo(() => {
    const sorted = [...messages].sort((a, b) => a.createdAt - b.createdAt);
    const withDate: (ChatMessage | DateMarker)[] = [];
    let lastTs: number | null = null;
    sorted.forEach((m, i) => {
      const prev = i > 0 ? sorted[i - 1] : null;
      const isFirst = !prev || prev.mine !== m.mine || !sameMinute(prev.createdAt, m.createdAt);
      const msgWithGroup = { ...m, isFirstInGroup: isFirst };
      if (lastTs == null || !sameYMD(lastTs, m.createdAt)) {
        withDate.push({ __type: 'date', key: `date_${m.createdAt}`, ts: m.createdAt });
        msgWithGroup.isFirstInGroup = true;
      }
      withDate.push(msgWithGroup);
      lastTs = m.createdAt;
    });
    return withDate.reverse();
  }, [messages]);

  const renderItem: ListRenderItem<ChatMessage | DateMarker> = useCallback(({ item, index }) => {
    if (isDateMarker(item)) return <View style={styles.dateWrap}><ChatText style={styles.dateText}>{formatDate(item.ts)}</ChatText></View>;
    const m = item as ChatMessage;
    const isIOS = Platform.OS === 'ios';
    const showTime = (() => {
      const nextIdx = index - 1;
      if (nextIdx < 0) return true;
      const next = listData[nextIdx] as ChatMessage;
      if (isDateMarker(next)) return true;
      return !(next.mine === m.mine && sameMinute(next.createdAt, m.createdAt));
    })();

    const partnerProfile = userData?.partnerProfileImageUrl ? { uri: userData.partnerProfileImageUrl } : require('../assets/images/userprofile.png');

    return (
      <View style={[styles.row, m.mine ? styles.rowMine : styles.rowOther]}>
        {!m.mine && (
          <View style={styles.profileContainer}>
            {m.isFirstInGroup ? <Image source={partnerProfile} style={styles.profileImage} /> : <View style={styles.profileSpacer} />}
          </View>
        )}
        <View style={[styles.msgContentWrapper, !m.mine && { alignItems: 'flex-start' }]}>
          {!m.mine && m.isFirstInGroup && <AppText type='pretendard-m' style={styles.partnerName}>{userData?.partnerName}{isIOS ? '' : '\u200A'}</AppText>}
          <View style={[styles.msgContainer, m.mine ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
            {m.mine && showTime && <ChatText style={styles.timeTextMine}>{formatTime(m.createdAt)}</ChatText>}
            <View style={[styles.bubble, m.type === 'mission_text' ? (m.mine ? styles.bubbleMissionMine : styles.bubbleMissionOther) : (m.mine ? styles.bubbleMine : styles.bubbleOther), m.type === 'image' && styles.imageBubble]}>
              {m.type === 'image' ? <Image source={{ uri: m.imageUrl! }} style={styles.missionImage} resizeMode="cover" /> : <AppText type='pretendard-m' style={[styles.msgText, m.mine ? styles.msgTextMine : styles.msgTextOther]}>{m.text}{isIOS ? '' : '\u200A'}</AppText>}
            </View>
            {!m.mine && showTime && <ChatText style={styles.timeTextOther}>{formatTime(m.createdAt)}</ChatText>}
          </View>
        </View>
      </View>
    );
  }, [listData, userData]);

  const isIOS = Platform.OS === 'ios';

  return (
    <KeyboardAvoidingView
      style={styles.wrap}
      // ✅ [수정] 아이패드/아이폰에서 중복 간격을 줄이기 위해 behavior 조정
      behavior={isIOS ? 'padding' : undefined}
      // ✅ [수정] 오프셋 값을 헤더 높이에 딱 맞게 조절
      keyboardVerticalOffset={isIOS ? HEADER_HEIGHT + insets.top : 0}
    >
      {/* 헤더 */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#111" />
        </Pressable>
        <View style={styles.titleContainer} pointerEvents="none">
          <AppText style={styles.headerTitle}>
            {userData?.partnerName}{isIOS ? '' : '\u200A'}
          </AppText>
        </View>
      </View>

      {/* 채팅 리스트 */}
      <FlatList
        ref={listRef}
        inverted
        data={listData}
        renderItem={renderItem}
        keyExtractor={(item, i) => isDateMarker(item) ? item.key : item.id ?? String(i)}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 12 }}
        keyboardShouldPersistTaps="handled"
      />

      <View style={[
        styles.inputBar, 
        { 
          paddingBottom: keyboardHeight > 0 ? 8 : (isIOS ? insets.bottom + 8 : 12) 
        }
      ]}>
        <Pressable onPress={() => router.push('/camera')} style={{ paddingHorizontal: 8, paddingBottom: 6 }}>
          <Image source={cameraImg} style={styles.cameraImage} resizeMode="contain" />
        </Pressable>
        <TextInput
          style={styles.input}
          placeholder="대화를 입력하세요"
          placeholderTextColor="#999"
          value={text}
          onChangeText={setText}
          multiline
        />
        <Pressable style={[styles.sendBtn, { marginBottom: 4 }]} onPress={sendMessage} disabled={sending || !text.trim()}>
          <Ionicons name="arrow-up" size={22} color={text.trim() ? "#6198FF" : "#B0B0B0"} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#FFFCF5' },
  header: { height: HEADER_HEIGHT, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, marginTop: 25, position: 'relative' },
  backButton: { paddingHorizontal: 8, zIndex: 10 },
  titleContainer: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 16, color: '#111' },
  row: { width: '100%', marginVertical: 2, flexDirection: 'row', alignItems: 'flex-start' },
  rowMine: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  profileContainer: { width: 40, marginRight: 8, alignItems: 'center' },
  profileImage: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#DDD' },
  profileSpacer: { width: 40 },
  msgContentWrapper: { maxWidth: '80%' },
  partnerName: { fontSize: 12, color: '#3F3F3F', marginBottom: 4, marginLeft: 4 },
  msgContainer: { flexDirection: 'row', alignItems: 'flex-end' },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, maxWidth: SCREEN_WIDTH * 0.65 },
  bubbleMine: { backgroundColor: '#BED5FF', borderBottomRightRadius: 2 },
  bubbleOther: { backgroundColor: '#FFADAD', borderTopLeftRadius: 2 },
  bubbleMissionMine: { backgroundColor: '#6198FF', borderBottomRightRadius: 0 },
  bubbleMissionOther: { backgroundColor: '#FFADAD', borderTopRightRadius: 0 },
  imageBubble: { padding: 0, overflow: 'hidden', borderRadius: 12 },
  msgText: { fontSize: 14, lineHeight: 20 },
  msgTextMine: { color: '#111' },
  msgTextOther: { color: '#111' },
  timeTextMine: { marginRight: 4, fontSize: 10, color: '#888' },
  timeTextOther: { marginLeft: 4, fontSize: 10, color: '#888' },
  missionImage: { width: 180, height: 240 },
  dateWrap: { alignItems: 'center', marginVertical: 20 },
  dateText: { fontSize: 12, color: '#666', backgroundColor: '#F0EBE0', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 100 },
  inputBar: { 
    flexDirection: 'row', 
    alignItems: 'flex-end', 
    paddingHorizontal: 10, 
    backgroundColor: '#FFFCF5', 
    paddingTop: 8, 
    borderTopWidth: 0.5, 
    borderTopColor: '#E5E7EB' 
  },
  input: { 
    flex: 1, 
    minHeight: 36, 
    maxHeight: 100, 
    backgroundColor: '#FFF', 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    borderRadius: 20, 
    borderWidth: 1, 
    borderColor: '#EEE', 
    color: '#111', 
    marginBottom: 4 
  },
  sendBtn: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: '#F0F0F0', 
    marginLeft: 4 
  },
  cameraImage: { width: 24, height: 24, tintColor: '#6198FF', marginBottom: 10 },
});