// app/chat.tsx

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ListRenderItem } from 'react-native';
import {
  Alert,
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

// ================== 내부 유틸(API) ==================
const CHAT_CACHE_KEY = (roomId: string) => `chat_cache_${roomId}`;
const MISSION_CACHE_KEY = 'performed_missions_cache';
const CACHE_VERSION = 'v1'; 

async function saveChatCache(roomId: string, messages: ChatMessage[]) {
  try {
    const toSave = messages
      .filter(m => m.status !== 'failed' && !String(m.id).startsWith('mission_')) 
      .slice(-100); 
    await AsyncStorage.setItem(CHAT_CACHE_KEY(roomId), JSON.stringify({ version: CACHE_VERSION, data: toSave }));
  } catch (e) { console.warn('[cache save]', e); }
}
async function loadChatCache(roomId: string): Promise<ChatMessage[]> {
  try {
    const cached = await AsyncStorage.getItem(CHAT_CACHE_KEY(roomId));
    if (!cached) return [];
    const parsed = JSON.parse(cached);
    return parsed.version === CACHE_VERSION ? parsed.data || [] : [];
  } catch { return []; }
}
async function saveMissionCache(missions: PerformedMission[]) {
  try {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const toSave = missions.filter(m => m.doneAtTs > cutoff);
    await AsyncStorage.setItem(MISSION_CACHE_KEY, JSON.stringify({ version: CACHE_VERSION, data: toSave }));
  } catch (e) { console.warn('[mission cache save]', e); }
}
async function loadMissionCache(): Promise<PerformedMission[]> {
  try {
    const cached = await AsyncStorage.getItem(MISSION_CACHE_KEY);
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
async function presignIfNeeded(rawUrl?: string | null) {
  if (!rawUrl || /\bX-Amz-Algorithm=/.test(rawUrl)) return rawUrl; 
  try {
    const res = await authedFetch(`/api/couples/missions/today?url=${encodeURIComponent(rawUrl)}`, { method: 'GET' });
    const url = res.url ?? res.presignedUrl ?? res.signedUrl;
    if (url) return String(url);
  } catch {}
  return rawUrl;
}

// ================== 타입 ==================
type SendStatus = 'sent' | 'sending' | 'failed' | undefined;
type ChatMessage = {
  id: string; text?: string; imageUrl?: string; mine: boolean;
  createdAt: number; type: 'text' | 'image' | 'mission_text';
  status?: SendStatus; clientMsgId?: string | null; alt?: string; 
};
type DateMarker = { __type: 'date'; key: string; ts: number };
function isDateMarker(x: ChatMessage | DateMarker): x is DateMarker { return (x as any).__type === 'date'; }

type PerformedMission = {
  missionId: number; title: string; missionDateTs: number; doneAtTs: number;     
  me?: { url?: string | null; when?: number | null };
  partner?: { url?: string | null; when?: number | null };
};

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
  if (!isoTimeStr.includes('Z') && !isoTimeStr.includes('+')) {
      isoTimeStr += 'Z';
  }
  const isoTime = new Date(isoTimeStr).getTime();
  if (!Number.isNaN(isoTime)) return isoTime;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) { return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime(); }
  return null;
}

function isPerformed(status?: string) {
  return status ? !String(status).toUpperCase().includes('NOT') : false;
}

// ================== 화면 ==================
export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const accessoryID = 'chat-input-accessory';
  
  const { userData } = useUser();
  const userId = userData?.userId || null;
  const ROOM_KEY = userData?.roomId ? String(userData.roomId) : null;

  const { justCompletedMissionId, justCompletedMissionText, justCompletedPhotoUrl, justCompletedAt } =
    useLocalSearchParams<{ justCompletedMissionId?: string; justCompletedMissionText?: string; justCompletedPhotoUrl?: string; justCompletedAt?: string; }>();

  const [token, setToken] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [performedMissions, setPerformedMissions] = useState<PerformedMission[]>([]);
  const [inputBarHeight, setInputBarHeight] = useState(56);

  // [수정] 키보드 높이 직접 관리
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const latestMessages = useRef(messages);
  const latestPerformedMissions = useRef(performedMissions);
  useEffect(() => { latestMessages.current = messages; }, [messages]);
  useEffect(() => { latestPerformedMissions.current = performedMissions; }, [performedMissions]);

  const listRef = useRef<FlatList<ChatMessage | DateMarker>>(null);
  const chatRef = useRef<ReturnType<typeof createChatClient> | null>(null);
  const latestVisibleMsgId = useRef<string | null>(null);

  useEffect(() => { (async () => { const t = await AsyncStorage.getItem('token'); if (t) setToken(t); })(); }, []);

  useEffect(() => {
    return () => {
      if (ROOM_KEY) {
        saveChatCache(ROOM_KEY, latestMessages.current);
        saveMissionCache(latestPerformedMissions.current);
      }
    };
  }, [ROOM_KEY]);

  const scrollToBottom = useCallback(() => {
    if (listRef.current) {
      listRef.current.scrollToOffset({ offset: 0, animated: true });
    }
  }, []);

  // [수정] 키보드 리스너: 높이 직접 계산 및 스크롤
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
      if (p.clientMsgId) {
        const ix = prev.findIndex(x => x.clientMsgId === p.clientMsgId);
        if (ix >= 0) {
           updated[ix] = { ...(updated[ix] as ChatMessage), id: String(p.id ?? updated[ix].id), status: 'sent', createdAt: p.createdAt ?? updated[ix].createdAt, imageUrl: p.imageUrl ?? updated[ix].imageUrl } as ChatMessage;
           found = true;
        }
      }
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
      if (!found) {
        updated.push({
          id: String(p.id ?? `${Date.now()}`), text: p.message ?? undefined, imageUrl: p.imageUrl ?? undefined,
          mine: String(p.senderId) === String(userId ?? ''), createdAt: p.createdAt ?? Date.now(),
          type: p.imageUrl ? 'image' : 'text', status: 'sent',
        });
      }
      if (ROOM_KEY) saveChatCache(ROOM_KEY, updated);
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

  useEffect(() => {
    if (!ROOM_KEY || !token || !userId) return;

    const loadData = async () => {
      let cachedMsgs: ChatMessage[] = [], historyMsgs: ChatMessage[] = [];
      try { cachedMsgs = await loadChatCache(ROOM_KEY); } catch {}
      try {
        const res: any = await authedFetch(`/chat/${ROOM_KEY}/history?size=50`, { method: 'GET' });
        let rows = Array.isArray(res) ? res : (res?.messages || res?.content || []);
        
        historyMsgs = rows.map((r: any) => {
            const rawTime = r.sentAt || r.createdAt;
            let ts = Date.now();

            if (rawTime) {
                const parsed = parseTSLocalOrISO(rawTime);
                if (parsed) ts = parsed;
            }

            return {
                id: String(r.id),
                text: r.message,
                imageUrl: r.imageUrl,
                mine: String(r.senderId) === String(userId ?? ''),
                createdAt: ts,
                type: r.imageUrl ? 'image' : 'text',
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

  useEffect(() => {
    if (!token || !userId) return;
    const fetchMissions = async () => {
        try {
            const raw = await authedFetch('/api/couples/missions/history', { method: 'GET' });
            const list = Array.isArray(raw) ? raw : [];
            let apis: PerformedMission[] = [];

            for (const m of list) {
                const isMainCompleted = m.status && isPerformed(m.status);
                const hasProgress = m.progresses && m.progresses.some((p: any) => isPerformed(p.status));

                if (!isMainCompleted && !hasProgress) continue;

                let doneAt = parseTSLocalOrISO(m.completedAt);
                if (!doneAt) {
                    doneAt = parseTSLocalOrISO(m.missionDate);
                }
                if (!doneAt) continue; 

                let meUrl=null, meWhen=null, paUrl=null, paWhen=null;

                if (m.photoUrl) {
                    meWhen = doneAt;
                    meUrl = await presignIfNeeded(m.photoUrl);
                }

                if (m.progresses) {
                    const meP = m.progresses.find((p:any) => String(p.userId) === String(userId));
                    const paP = m.progresses.find((p:any) => String(p.userId) !== String(userId));
                    
                    if (meP?.status && isPerformed(meP.status)) { 
                        const t = parseTSLocalOrISO(meP.completedAt);
                        if (t) { meWhen = t; meUrl = await presignIfNeeded(meP.photoUrl); }
                    }
                    if (paP?.status && isPerformed(paP.status)) { 
                        const t = parseTSLocalOrISO(paP.completedAt);
                        if (t) { paWhen = t; paUrl = await presignIfNeeded(paP.photoUrl); }
                    }
                }

                const finalTime = meWhen || paWhen || doneAt;

                apis.push({ 
                    missionId: m.missionId, 
                    title: m.title || '미션', 
                    missionDateTs: finalTime, 
                    doneAtTs: finalTime, 
                    me: meUrl ? { url: meUrl, when: meWhen } : undefined, 
                    partner: paUrl ? { url: paUrl, when: paWhen } : undefined 
                });
            }

            const cached = await loadMissionCache();
            const map = new Map();
            cached.forEach(m => map.set(m.missionId, m));
            apis.forEach(m => map.set(m.missionId, m));
            const merged = Array.from(map.values()).sort((a,b)=>a.doneAtTs-b.doneAtTs);
            setPerformedMissions(merged);
            saveMissionCache(merged);
        } catch (e) {
            console.warn('[Mission History Error]', e);
        }
    };
    fetchMissions();
  }, [token, userId]);

  const appendedOnceRef = useRef(false);
  useEffect(() => {
    if (appendedOnceRef.current || !justCompletedMissionId) return;
    const ts = parseTSLocalOrISO(justCompletedAt) ?? Date.now();
    setMessages(prev => {
        const add = [{ id: `mission_text_opt_${justCompletedMissionId}_${ts}`, type: 'mission_text', text: justCompletedMissionText||'오늘의 미션', mine: true, createdAt: ts, status: 'sent' } as ChatMessage];
        if (justCompletedPhotoUrl) add.push({ id: `mission_img_opt_${justCompletedMissionId}_${ts}`, type: 'image', imageUrl: justCompletedPhotoUrl, mine: true, createdAt: ts, status: 'sent' } as ChatMessage);
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

    setMessages(prev => [...prev, { id: tempId, text: trimmed, mine: true, createdAt, type: 'text', status: USE_STOMP?'sending':'sent', clientMsgId }]);
    setText('');
    setTimeout(scrollToBottom, 50);

    try {
      if (USE_STOMP) chatRef.current?.sendMessage(ROOM_KEY, Number(userId), { message: trimmed, imageUrl: null, clientMsgId, createdAt });
    } catch {
      setMessages(prev => prev.map(m => m.id === tempId ? ({ ...m, status: 'failed' } as ChatMessage) : m));
    } finally { setSending(false); }
  }, [ROOM_KEY, userId, sending, text, scrollToBottom]);

  const listData = useMemo<(ChatMessage | DateMarker)[]>(() => {
    const baseMsgs = [...messages];
    const missionMsgs: ChatMessage[] = [];
    
    performedMissions.forEach(m => {
        // 🟢 [1차 방어] 파라미터로 받은 ID와 같다면 스킵
        if (justCompletedMissionId && String(m.missionId) === String(justCompletedMissionId)) {
            return;
        }

        // 🟢 [2차 방어 - 핵심] 이미 baseMsgs(화면에 떠있는 메시지들) 안에 
        // 이 미션 ID를 가진 임시 메시지(mission_text_opt_... 등)가 존재한다면 서버 데이터 무시
        // 임시 메시지 ID 포맷: `mission_text_opt_${id}_...`
        const alreadyHasLocal = baseMsgs.some(msg => 
            String(msg.id).includes(`mission_text_opt_${m.missionId}`) || 
            String(msg.id).includes(`mission_img_opt_${m.missionId}`)
        );

        if (alreadyHasLocal) {
            return;
        }

        const baseTs = m.doneAtTs ?? m.missionDateTs;
        const mtId = `mission_text_${m.missionId}`;
        
        // 1. 미션 텍스트 추가
        const hasSameText = baseMsgs.some(msg => msg.id === mtId); // ID로만 체크해도 충분
        if (!hasSameText) {
            missionMsgs.push({ 
                id: mtId, 
                type: 'mission_text', 
                text: m.title, 
                mine: true, 
                createdAt: baseTs, 
                status: 'sent' 
            });
        }
        
        // 2. 상대방 사진 추가
        if (m.partner && m.partner.url) {
            const pUrl = m.partner.url;
            const pWhen = m.partner.when;
            const mpId = `mission_img_partner_${m.missionId}`;
            if (!baseMsgs.some(msg => msg.id === mpId)) {
                missionMsgs.push({ 
                    id: mpId, 
                    type: 'image', 
                    imageUrl: pUrl, 
                    mine: false, 
                    createdAt: pWhen ?? baseTs, 
                    status: 'sent' 
                });
            }
        }
        
        // 3. 내 사진 추가
        if (m.me && m.me.url) {
            const mUrl = m.me.url;
            const mWhen = m.me.when;
            const mmId = `mission_img_me_${m.missionId}`;
            if (!baseMsgs.some(msg => msg.id === mmId)) {
                missionMsgs.push({ 
                    id: mmId, 
                    type: 'image', 
                    imageUrl: mUrl, 
                    mine: true, 
                    createdAt: mWhen ?? baseTs, 
                    status: 'sent' 
                });
            }
        }
    });

    // ... (이하 동일) ...
    const merged = [...baseMsgs, ...missionMsgs].sort((a, b) => a.createdAt - b.createdAt);
    
    const withDate: (ChatMessage | DateMarker)[] = [];
    let lastTs: number | null = null;
    
    for (const m of merged) {
        if (lastTs == null || !sameYMD(lastTs, m.createdAt)) {
            withDate.push({ __type: 'date', key: `date_${m.createdAt}`, ts: m.createdAt });
        }
        withDate.push(m);
        lastTs = m.createdAt;
    }
    
    return withDate.reverse();
  }, [messages, performedMissions, justCompletedMissionId]);

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
    const bubbleStyle = m.type === 'mission_text' ? (m.mine ? styles.bubbleMissionMine : styles.bubbleMissionOther) : (m.mine ? styles.bubbleMine : styles.bubbleOther);
    const containerStyle = m.type === 'image' ? (m.mine ? styles.imageBoxMine : styles.imageBoxOther) : [styles.bubble, bubbleStyle];

    return (
      <View style={[styles.row, m.mine ? styles.rowMine : styles.rowOther]}>
        <View style={[styles.msgCol, m.mine ? { flexDirection: 'row', justifyContent: 'flex-end' } : { flexDirection: 'row', justifyContent: 'flex-start' }]}>
          {m.mine && showTime && <ChatText style={styles.timeTextMine}>{formatTime(m.createdAt)}</ChatText>}
          <View style={containerStyle}>
             {m.type === 'mission_text' ? <AppText type='pretendard-b' style={styles.msgText}>{m.text}</AppText> :
              m.type === 'image' ? <Image source={{ uri: m.imageUrl! }} style={styles.missionImage} resizeMode="cover" /> :
              <AppText type='pretendard-m' style={m.mine ? styles.msgTextMine : styles.msgTextOther}>{m.text}</AppText>}
          </View>
          {!m.mine && showTime && <ChatText style={styles.timeTextOther}>{formatTime(m.createdAt)}</ChatText>}
        </View>
        <View style={styles.metaWrapRight}>
            {m.status === 'failed' && <Ionicons name="alert-circle" size={14} color="#FF4D4F" />}
            {m.status === 'sending' && <AppText type='pretendard-b' style={styles.SendingText}>...</AppText>}
        </View>
      </View>
    );
  }, [shouldShowTime]);

  const isIOS = Platform.OS === 'ios';

  // Android 패딩 계산 로직 (수동 제어)
  // 키보드가 없으면 안전영역(insets.bottom)을 더해준다.
  // 키보드가 있으면 키보드 높이만큼만 올린다. (OS에 따라 키보드 높이에 네비게이션바가 포함될 수 있으므로 insets.bottom을 빼서 중복 제거)
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
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable style={{ paddingHorizontal: 8 }} onPress={() => router.back()}><Ionicons name="chevron-back" size={24} color="#111" /></Pressable>
        <AppText style={styles.headerTitle}>애인</AppText>
      </View>

      <FlatList<ChatMessage | DateMarker>
        ref={listRef}
        inverted={true}
        contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 20 }}
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
        // [핵심] Android: 수동으로 계산된 패딩 적용
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
  header: { height: HEADER_HEIGHT, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, justifyContent: 'flex-start', marginVertical: 25, gap:'37%' },
  headerTitle: { fontSize: 16, color: '#111' },
  row: { width: '100%', marginVertical: 6 },
  rowMine: { alignItems: 'flex-end' }, 
  rowOther: { alignItems: 'flex-start' }, 
  msgCol: { maxWidth: '80%', alignItems: 'flex-end' },
  bubble: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 16 },
  bubbleMine: { backgroundColor: '#BED5FF', borderBottomRightRadius: 2 },
  bubbleOther: { backgroundColor: '#FFADAD', borderWidth: StyleSheet.hairlineWidth, borderTopLeftRadius: 2 },
  imageBoxMine: { borderRadius: 18, overflow: 'hidden', alignSelf: 'flex-end' },
  imageBoxOther: { borderRadius: 18, overflow: 'hidden', alignSelf: 'flex-start' },
  bubbleMissionMine: { backgroundColor: '#6198FF', borderBottomRightRadius: 0,width:'80%',},
  bubbleMissionOther: { backgroundColor: '#FFADAD', borderTopRightRadius: 0, width:'80%' },
  missionImage: { width: STICKER_SIZE * 1.6, height: STICKER_SIZE * 2.5, borderRadius: 0, backgroundColor: '#DDE7FF' },
  msgText: { fontSize: 13, lineHeight: 20, color: '#fff', paddingVertical:12, paddingHorizontal:20},
  msgTextMine: { fontSize: 13, color: '#3F3F3F' },
  msgTextOther: { fontSize: 13, color: '#3F3F3F' },
  SendingText:{fontSize:10, color:'#6198FF'},
  timeTextMine: { marginRight: 6, marginBottom: 0, fontSize: 10, color: '#75787B', alignSelf: 'flex-end' },
  timeTextOther: { marginLeft: 6, marginBottom: 0, fontSize: 10, color: '#75787B', alignSelf: 'flex-end' },
  metaWrapRight: { marginLeft: 6, alignItems: 'center', justifyContent: 'flex-end' },
  dateWrap: { alignItems: 'center', marginVertical: 26 },
  dateText: { fontSize: 12, color: '#4D5053', backgroundColor: '#F8F4EA', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 100 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 10, gap: 8, backgroundColor: '#FFFCF5',paddingTop:8},
  input: { flex: 1, minHeight: 40, maxHeight: 120, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: '#e5e7eb', color: '#111' },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEEFEF' },
  cameraImage: { width: 24, height: 24, tintColor: '#6198FF', marginBottom:10 },
});