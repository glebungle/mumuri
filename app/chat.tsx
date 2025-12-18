// app/chat.tsx

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ListRenderItem } from 'react-native';
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  InputAccessoryView,
  Keyboard,
  KeyboardAvoidingView,
  KeyboardEvent,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  ViewToken,
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

// ================== 환경 ==================
const API_BASE = 'https://mumuri.shop';
const WS_URL = `${API_BASE}/ws-chat`;

const MAX_TEXT_LEN = 500;
const HEADER_HEIGHT = 56;

const USE_STOMP = true;
const cameraImg = require('../assets/images/Camera.png');
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ================== 내부 유틸(API) ==================
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

// ================== 타입 ==================
type SendStatus = 'sent' | 'sending' | 'failed' | undefined;

// 백엔드에서 type: 'TEXT' | 'IMAGE' | 'MISSION_TEXT' | 'MISSION_IMAGE' 로 온다고 가정
// 프론트 내부에서는 기존 로직 호환을 위해 'text' | 'image' | 'mission_text' 로 매핑하여 사용
type ChatMessage = {
  id: string; 
  text?: string; 
  imageUrl?: string; 
  mine: boolean;
  createdAt: number; 
  type: 'text' | 'image' | 'mission_text'; // 프론트엔드 내부 타입
  status?: SendStatus; 
  clientMsgId?: string | null; 
  alt?: string; 
  isFirstInGroup?: boolean; 
};

type DateMarker = { __type: 'date'; key: string; ts: number };
function isDateMarker(x: ChatMessage | DateMarker): x is DateMarker { return (x as any).__type === 'date'; }

// ================== 유틸 ==================
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
  let isoTimeStr = String(s).replace(' ', 'T');
  // Z 제거: 서버가 한국 시간을 주면 그대로 쓰고, UTC면 브라우저가 알아서 처리하도록 유도
  // 만약 서버가 KST(한국시간) 문자열을 주는데 Z를 붙이면 9시간 더해지는 문제 발생하므로 Z 강제 추가 로직 제거
  const isoTime = new Date(isoTimeStr).getTime();
  if (!Number.isNaN(isoTime)) return isoTime;
  
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) { return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime(); }
  return null;
}

// ================== 화면 ==================
export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const accessoryID = 'chat-input-accessory';
  
  const { userData } = useUser();
  const userId = userData?.userId || null;
  const ROOM_KEY = userData?.roomId ? String(userData.roomId) : null;

  // 카메라에서 돌아왔을 때 임시로 띄워주기 위한 파라미터들
  const { justCompletedMissionId, justCompletedMissionText, justCompletedPhotoUrl, justCompletedAt } =
    useLocalSearchParams<{ justCompletedMissionId?: string; justCompletedMissionText?: string; justCompletedPhotoUrl?: string; justCompletedAt?: string; }>();

  const [token, setToken] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [inputBarHeight, setInputBarHeight] = useState(56);

  // [수정] 키보드 높이 직접 관리
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const latestMessages = useRef(messages);
  useEffect(() => { latestMessages.current = messages; }, [messages]);

  const listRef = useRef<FlatList<ChatMessage | DateMarker>>(null);
  const chatRef = useRef<ReturnType<typeof createChatClient> | null>(null);
  const latestVisibleMsgId = useRef<string | null>(null);

  useEffect(() => { (async () => { const t = await AsyncStorage.getItem('token'); if (t) setToken(t); })(); }, []);

  const scrollToBottom = useCallback(() => {
    if (listRef.current) {
      listRef.current.scrollToOffset({ offset: 0, animated: true });
    }
  }, []);

  // 키보드 리스너
  useEffect(() => {
    const onShow = (e: KeyboardEvent) => {
        setKeyboardHeight(e.endCoordinates.height);
    };
    const onHide = () => {
        setKeyboardHeight(0);
    };

    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', onShow);
    const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', onHide);
    
    return () => {
        showSub.remove();
        hideSub.remove();
    };
  }, []);

  const onIncoming = useCallback((p: ChatIncoming) => {
    setMessages(prev => {
      if (p.id != null && prev.some(x => String(x.id) === String(p.id))) return prev;
      let updated = [...prev];
      let found = false;
      
      // 클라이언트 ID 매칭
      if (p.clientMsgId) {
        const ix = prev.findIndex(x => x.clientMsgId === p.clientMsgId);
        if (ix >= 0) {
          updated[ix] = { 
            ...(updated[ix] as ChatMessage), 
            id: String(p.id ?? updated[ix].id), 
            status: 'sent', 
            createdAt: p.createdAt ?? updated[ix].createdAt, 
            imageUrl: p.imageUrl ?? updated[ix].imageUrl 
          } as ChatMessage;
          found = true;
        }
      }
      
      // 메시지 내용 매칭 (Fallback)
      if (!found) {
        const isMine = String(p.senderId) === String(userId ?? '');
        if (isMine && p.message) {
          const matchIndex = prev.findIndex(m => m.id.startsWith('local_') && m.text === p.message && m.mine === true);
          if (matchIndex >= 0) {
              updated[matchIndex] = { ...updated[matchIndex], id: String(p.id ?? updated[matchIndex].id), status: 'sent', createdAt: p.createdAt ?? updated[matchIndex].createdAt } as ChatMessage;
              found = true;
          }
        }
      }
      
      // 새 메시지 추가
      if (!found) {
        // [중요] 소켓으로 들어오는 데이터의 type 처리 (없으면 추론)
        let newMsgType: 'text' | 'image' | 'mission_text' = 'text';
        
        // 백엔드에서 p.type을 보내준다고 가정 (ChatIncoming 타입에 type 추가 필요할 수 있음)
        // 만약 p.type이 'MISSION_TEXT'라면 'mission_text', 그 외 이미지류는 'image'
        const incomingType = (p as any).type; 
        if (incomingType === 'MISSION_TEXT') newMsgType = 'mission_text';
        else if (incomingType === 'MISSION_IMAGE') newMsgType = 'image';
        else if (p.imageUrl) newMsgType = 'image';

        updated.push({
          id: String(p.id ?? `${Date.now()}`), 
          text: p.message ?? undefined, 
          imageUrl: p.imageUrl ?? undefined,
          mine: String(p.senderId) === String(userId ?? ''), 
          createdAt: p.createdAt ?? Date.now(),
          type: newMsgType, 
          status: 'sent',
        });
      }
      return updated;
    });
    setTimeout(scrollToBottom, 100); 
  }, [userId, ROOM_KEY, scrollToBottom]);

  const onIncomingRef = useRef(onIncoming);
  useEffect(() => { onIncomingRef.current = onIncoming; }, [onIncoming]);

  useFocusEffect(
    useCallback(() => {
      if (!USE_STOMP || !token || !ROOM_KEY || !userId) return;
      const chat = createChatClient({
        wsUrl: WS_URL, token, roomId: ROOM_KEY,
        handlers: {
          onMessage: (p) => onIncomingRef.current(p),
          onReadUpdate: () => { },
          onConnected: () => { chatRef.current?.markAsRead(ROOM_KEY, Number(userId), latestVisibleMsgId.current ?? undefined); },
          onError: (e) => console.warn('[STOMP ERROR]', e),
        },
        connectTimeoutMs: 6000,
      });
      chatRef.current = chat;
      chat.activate();
      return () => { chat.deactivate(); chatRef.current = null; };
    }, [token, ROOM_KEY, userId]) 
  );

  // [핵심 변경] 통합된 API 호출 (미션 내역도 여기 포함됨)
  useEffect(() => {
    if (!ROOM_KEY || !token || !userId) return;

    const loadData = async () => {
      let cachedMsgs: ChatMessage[] = [], historyMsgs: ChatMessage[] = [];
      try { cachedMsgs = await loadChatCache(ROOM_KEY); } catch {}
      try {
        const res: any = await authedFetch(`/chat/${ROOM_KEY}/history?size=50`, { method: 'GET' });
        // 백엔드 응답이 { messages: [...] } 형태라고 가정
        let rows = Array.isArray(res) ? res : (res?.messages || res?.content || []);
        
        console.log('[Debug] Chat & Mission History:', JSON.stringify(rows, null, 2));

        historyMsgs = rows.map((r: any) => {
            const rawTime = r.sentAt || r.createdAt;
            let ts = Date.now();

            if (rawTime) {
                const parsed = parseTSLocalOrISO(rawTime);
                if (parsed) ts = parsed;
            }

            // [타입 매핑] 백엔드 타입 -> 프론트엔드 타입
            // 백엔드: TEXT, IMAGE, MISSION_TEXT, MISSION_IMAGE
            let msgType: 'text' | 'image' | 'mission_text' = 'text';
            
            if (r.type === 'MISSION_TEXT') {
                msgType = 'mission_text';
            } else if (r.imageUrl || r.type === 'IMAGE' || r.type === 'MISSION_IMAGE') {
                // 일반 이미지와 미션 이미지 모두 'image' 타입으로 처리 (스타일 공유)
                msgType = 'image';
            }

            return {
                id: String(r.id),
                text: r.message,
                imageUrl: r.imageUrl,
                mine: String(r.senderId) === String(userId ?? ''),
                createdAt: ts,
                type: msgType,
                status: 'sent'
            };
        });

      } catch (e) {
          console.warn('[History Load Error]', e);
      }

      setMessages(prev => {
        const all = [...prev, ...cachedMsgs, ...historyMsgs];
        const unique = new Map();
        all.forEach(m => unique.set(m.id, m));
        return Array.from(unique.values()).sort((a, b) => a.createdAt - b.createdAt);
      });
    };
    loadData();
  }, [ROOM_KEY, token, userId]);

  // [삭제됨] fetchMissions (미션 API 별도 호출 로직 제거)

  // 카메라 앱 등에서 돌아왔을 때 임시로 메시지 띄우는 로직 (유지)
  const appendedOnceRef = useRef(false);
  useEffect(() => {
    if (appendedOnceRef.current || !justCompletedMissionId) return;
    const ts = parseTSLocalOrISO(justCompletedAt) ?? Date.now();
    setMessages(prev => {
        const add = [{ 
            id: `mission_text_opt_${justCompletedMissionId}_${ts}`, 
            type: 'mission_text', 
            text: justCompletedMissionText || '오늘의 미션', 
            mine: true, 
            createdAt: ts, 
            status: 'sent' 
        } as ChatMessage];
        
        if (justCompletedPhotoUrl) {
            add.push({ 
                id: `mission_img_opt_${justCompletedMissionId}_${ts}`, 
                type: 'image', 
                imageUrl: justCompletedPhotoUrl, 
                mine: true, 
                createdAt: ts, 
                status: 'sent' 
            } as ChatMessage);
        }
        return [...prev, ...add];
    });
    setTimeout(scrollToBottom, 300);
    appendedOnceRef.current = true;
  }, [justCompletedMissionId, justCompletedMissionText, justCompletedPhotoUrl, justCompletedAt, scrollToBottom]);

  const sendMessage = useCallback(async () => {
    if (!ROOM_KEY || !userId || sending) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    if (trimmed.length > MAX_TEXT_LEN) { Alert.alert('오류', '메시지가 너무 깁니다.'); return; }

    setSending(true);
    const clientMsgId = uuid4();
    const tempId = `local_${clientMsgId}`;
    const createdAt = Date.now();

    // 일반 메시지 전송이므로 type='text'
    setMessages(prev => [...prev, { id: tempId, text: trimmed, mine: true, createdAt, type: 'text', status: USE_STOMP?'sending':'sent', clientMsgId }]);
    setText('');
    setTimeout(scrollToBottom, 50);

    try {
      if (USE_STOMP) chatRef.current?.sendMessage(ROOM_KEY, Number(userId), { message: trimmed, imageUrl: null, clientMsgId, createdAt });
    } catch {
      setMessages(prev => prev.map(m => m.id === tempId ? ({ ...m, status: 'failed' } as ChatMessage) : m));
    } finally { setSending(false); }
  }, [ROOM_KEY, userId, sending, text, scrollToBottom]);

  // [단순화됨] listData: 미션 병합 로직 제거, 단순히 메시지 정렬 및 날짜 그룹핑만 수행
  const listData = useMemo<(ChatMessage | DateMarker)[]>(() => {
    const sortedMessages = [...messages].sort((a, b) => a.createdAt - b.createdAt);

    const groupedMessages: ChatMessage[] = [];
    for (let i = 0; i < sortedMessages.length; i++) {
        const current = sortedMessages[i];
        const prev = i > 0 ? sortedMessages[i - 1] : null;

        const isFirst = !prev || prev.mine !== current.mine || !sameMinute(prev.createdAt, current.createdAt);
        
        groupedMessages.push({ ...current, isFirstInGroup: isFirst });
    }
    
    const withDate: (ChatMessage | DateMarker)[] = [];
    let lastTs: number | null = null;
    
    for (const m of groupedMessages) {
        if (lastTs == null || !sameYMD(lastTs, m.createdAt)) {
            withDate.push({ __type: 'date', key: `date_${m.createdAt}`, ts: m.createdAt });
            m.isFirstInGroup = true; 
        }
        withDate.push(m);
        lastTs = m.createdAt;
    }
    
    return withDate.reverse();
  }, [messages]); // performedMissions 의존성 제거

  const shouldShowTime = useCallback((idx: number) => {
    const cur = listData[idx] as ChatMessage;
    if (isDateMarker(cur)) return false;
    let j = idx - 1;
    while (j >= 0 && isDateMarker(listData[j] as any)) j--;
    const nextNewer = j >= 0 ? listData[j] as ChatMessage : null;
    if (!nextNewer) return true;
    return !(nextNewer.mine === cur.mine && sameMinute(nextNewer.createdAt, cur.createdAt));
  }, [listData]);

  const renderItem: ListRenderItem<ChatMessage | DateMarker> = useCallback(({ item, index }) => {
    if (isDateMarker(item)) return <View style={styles.dateWrap}><ChatText style={styles.dateText}>{formatDate(item.ts)}</ChatText></View>;
    
    const m = item as ChatMessage;
    const showTime = shouldShowTime(index); 
    
    // type에 따라 스타일 분기 (mission_text, image, text)
    const bubbleStyle = m.type === 'mission_text' ? (m.mine ? styles.bubbleMissionMine : styles.bubbleMissionOther) : (m.mine ? styles.bubbleMine : styles.bubbleOther);
    const containerStyle = m.type === 'image' ? (m.mine ? styles.imageBoxMine : styles.imageBoxOther) : [styles.bubble, bubbleStyle];

    const partnerName = userData?.partnerName || '애인';
    const partnerProfile = userData?.partnerProfileImageUrl 
        ? { uri: userData.partnerProfileImageUrl } 
        : require('../assets/images/userprofile.png');

    return (
      <View style={[styles.row, m.mine ? styles.rowMine : styles.rowOther]}>
        
        {/* 1. 상대방 메시지 프로필 영역 */}
        {!m.mine && (
            <View style={styles.profileContainer}>
                {m.isFirstInGroup ? (
                    <Image source={partnerProfile} style={styles.profileImage} />
                ) : (
                    <View style={styles.profileSpacer} /> 
                )}
            </View>
        )}

        {/* 2. 메시지 내용*/}
        <View style={[styles.msgContentWrapper, !m.mine && { alignItems: 'flex-start' }]}>
            
            {/* 이름 */}
            {!m.mine && m.isFirstInGroup && (
                <AppText type='pretendard-m' style={styles.partnerName}>{partnerName}{Platform.OS === 'android' ? '\u200A' : ''}</AppText>
            )}

            {/* 말풍선 + 시간 */}
            <View style={[styles.msgContainer, m.mine ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
                
                {/* 내 메시지 시간  */}
                {m.mine && showTime && <ChatText style={styles.timeTextMine}>{formatTime(m.createdAt)}</ChatText>}
                
                {/* 말풍선  */}
                <View style={containerStyle}>
                    {m.type === 'mission_text' ? <AppText type='pretendard-b' style={styles.msgText}>{m.text}</AppText> :
                    m.type === 'image' ? <Image source={{ uri: m.imageUrl! }} style={styles.missionImage} resizeMode="cover" /> :
                    <AppText type='pretendard-m' style={m.mine ? styles.msgTextMine : styles.msgTextOther}>{m.text}{Platform.OS === 'android' ? '\u200A' : ''}</AppText>}
                </View>

                {/* 상대방 메시지 시간  */}
                {!m.mine && showTime && <ChatText style={styles.timeTextOther}>{formatTime(m.createdAt)}</ChatText>}
            </View>
        </View>

        {/* 전송 상태 표시 (내 메시지용) */}
        {m.mine && (
            <View style={styles.metaWrapRight}>
                {m.status === 'failed' && <Ionicons name="alert-circle" size={14} color="#FF4D4F" />}
                {m.status === 'sending' && <AppText type='pretendard-b' style={styles.SendingText}>...</AppText>}
            </View>
        )}
      </View>
    );
  }, [shouldShowTime, userData]); 

  const isIOS = Platform.OS === 'ios';

  const androidPadding = keyboardHeight > 0 
    ? 60 + keyboardHeight// 키보드 올라옴: 키보드 높이 + 기본패딩 - 네비바(중복방지)
    : 12 + insets.bottom; // 키보드 내려감: 기본패딩 + 네비바(안전영역)

  return (
    <KeyboardAvoidingView
      style={styles.wrap}
      // [핵심] Android는 KAV 끄고 수동 패딩 사용
      behavior={isIOS ? 'padding' : undefined}
      enabled={isIOS} 
      keyboardVerticalOffset={isIOS ? HEADER_HEIGHT + insets.top : 0}
    >
      <View style={[styles.header, { paddingTop: 0 }]}>
        <Pressable style={{ paddingHorizontal: 8 }} onPress={() => router.back()}><Ionicons name="chevron-back" size={24} color="#111" /></Pressable>
        <AppText style={styles.headerTitle}>{userData?.partnerName}{Platform.OS === 'android' ? '\u200A' : ''}</AppText>
      </View>

      <FlatList<ChatMessage | DateMarker>
        ref={listRef}
        inverted={true}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 12, }}
        data={listData}
        renderItem={renderItem}
        keyExtractor={(item, i) => isDateMarker(item) ? item.key : item.id ?? String(i)}
        keyboardShouldPersistTaps="handled"
        onViewableItemsChanged={useRef(({ viewableItems }: { viewableItems: Array<ViewToken> }) => {
            if (!viewableItems.length) return;
            const latest = viewableItems.find(v => !isDateMarker(v.item));
            if (latest?.item && (latest.item as ChatMessage).id) {
                const mid = (latest.item as ChatMessage).id;
                if (mid !== latestVisibleMsgId.current) {
                    latestVisibleMsgId.current = mid;
                    if (ROOM_KEY && userId) chatRef.current?.markAsRead(ROOM_KEY, Number(userId), mid);
                }
            }
        }).current}
      />

      {isIOS ? (
        <InputAccessoryView nativeID={accessoryID}>
          <View style={[styles.inputBar, { paddingBottom: 8 + insets.bottom }]} onLayout={(e) => setInputBarHeight(e.nativeEvent.layout.height)}>
            <Pressable onPress={() => router.push('/camera')} style={{ paddingHorizontal: 8 }}><Image source={cameraImg} style={styles.cameraImage} resizeMode="contain" /></Pressable>
            <TextInput
              style={[styles.input, { fontFamily: 'Pretendard-Regular'}]} 
              placeholder="대화를 입력하세요" placeholderTextColor="#999"
              value={text} onChangeText={(t) => t.length <= MAX_TEXT_LEN && setText(t)} multiline inputAccessoryViewID={accessoryID}
            />
            <Pressable style={[styles.sendBtn, sending && { opacity: 0.6 }]} onPress={sendMessage} disabled={sending}><Ionicons name="arrow-up" size={22} color="#fff" /></Pressable>
          </View>
        </InputAccessoryView>
      ) : (
        <View style={[styles.inputBar, { paddingBottom: androidPadding }]}> 
          <Pressable onPress={() => router.push('/camera')} style={{ paddingHorizontal: 8 }}><Image source={cameraImg} style={styles.cameraImage} resizeMode="contain" /></Pressable>
          <TextInput
            style={[styles.input, { fontFamily: 'Pretendard-Regular', includeFontPadding: false, textAlignVertical: 'center' }]}
            placeholder="대화를 입력하세요" placeholderTextColor="#999"
            value={text} onChangeText={(t) => t.length <= MAX_TEXT_LEN && setText(t)} multiline
          />
          <Pressable style={[styles.sendBtn, sending && { opacity: 0.6 }]} onPress={sendMessage} disabled={sending}><Ionicons name="arrow-up" size={22} color="#4D5053" /></Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const STICKER_SIZE = 128;
const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#FFFCF5' },
  header: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    justifyContent: 'flex-start',
    marginVertical: 25,
    gap: '37%',
  },
  headerTitle: { fontSize: 16, color: '#111', top: 0 },

  row: {
    width: '100%',
    marginVertical: 2,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  rowMine: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },

  profileContainer: {
    width: 40,
    marginRight: 4,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  profileImage: { width: 36, height: 36, borderRadius: 99, backgroundColor: '#DDD' },
  profileSpacer: { width: 0 }, // 빈 공간

  msgContentWrapper: {
    maxWidth: '100%',
    flexDirection: 'column',
  },

  partnerName: {
    fontSize: 12,
    color: '#3F3F3F',
    marginBottom: 4,
  },

  msgCol: {
    alignItems: 'flex-end',
  },

  bubble: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    maxWidth: SCREEN_WIDTH * 0.63,
  },

  imageBoxMine: {
    borderRadius: 18,
    overflow: 'hidden',
    alignSelf: 'flex-end',
    maxWidth: SCREEN_WIDTH * 0.6,
  },
  imageBoxOther: {
    borderRadius: 18,
    overflow: 'hidden',
    alignSelf: 'flex-start',
    maxWidth: SCREEN_WIDTH * 0.6,
  },

  bubbleMissionMine: {
    backgroundColor: '#6198FF',
    borderBottomRightRadius: 0,
    width: 'auto',
    maxWidth: SCREEN_WIDTH * 0.63,
  },
  bubbleMissionOther: {
    backgroundColor: '#FFADAD',
    borderTopRightRadius: 0,
    width: 'auto',
    maxWidth: SCREEN_WIDTH * 0.63,
  },

  msgContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 4,
  },
  timeTextMine: {
    marginRight: 4,
    fontSize: 9,
    color: '#75787B',
    fontFamily: 'Pretendard-Regular',
  },
  timeTextOther: {
    marginLeft: 4,
    fontSize: 9,
    color: '#75787B',
    fontFamily: 'Pretendard-Regular',
  },

  bubbleMine: { backgroundColor: '#BED5FF', borderBottomRightRadius: 2 },
  bubbleOther: { backgroundColor: '#FFADAD', borderTopLeftRadius: 2 },

  missionImage: {
    width: STICKER_SIZE * 1.6,
    height: STICKER_SIZE * 2.5,
    borderRadius: 0,
    backgroundColor: '#DDE7FF',
  },

  msgText: { fontSize: 13, lineHeight: 20, color: '#fff', paddingVertical: 12, paddingHorizontal: 20 },

  msgTextMine: {
    fontSize: 12,
    lineHeight: 16,
    color: '#3F3F3F',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },

  msgTextOther: {
    fontSize: 12,
    lineHeight: 16,
    color: '#3F3F3F',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },

  SendingText: { fontSize: 10, color: '#6198FF' },
  metaWrapRight: { alignItems: 'center', justifyContent: 'flex-end' },
  dateWrap: { alignItems: 'center', marginVertical: 26 },
  dateText: {
    fontSize: 12,
    color: '#4D5053',
    backgroundColor: '#F8F4EA',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 100,
  },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    gap: 8,
    backgroundColor: '#FFFCF5',
    paddingTop: 8,
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
    fontFamily: 'Pretendard-Regular',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEEFEF',
  },
  cameraImage: { width: 24, height: 24, tintColor: '#6198FF', marginBottom: 10 },
});