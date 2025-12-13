// app/chat.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, ListRenderItem } from 'react-native';
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
import AppText from '../components/AppText';
import { ChatIncoming, ChatReadUpdate, createChatClient } from './lib/chatSocket';
// ✅ [수정] Hook은 컴포넌트 내부에서만 사용해야 하므로 여기서 호출하던 코드를 제거했습니다.
import { useUser } from './context/UserContext';

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

// ================== 내부 유틸(API) ==================
const CHAT_CACHE_KEY = (roomId: string) => `chat_cache_${roomId}`;
const MISSION_CACHE_KEY = 'performed_missions_cache';
const CACHE_VERSION = 'v1'; 

// 채팅 캐시 저장
async function saveChatCache(roomId: string, messages: ChatMessage[]) {
  try {
    const toSave = messages
      .filter(m => m.status !== 'failed') 
      .slice(-100); 

    await AsyncStorage.setItem(
      CHAT_CACHE_KEY(roomId),
      JSON.stringify({ version: CACHE_VERSION, data: toSave })
    );
    console.log(`[cache saved] ${toSave.length} messages saved (room: ${roomId})`);
  } catch (e) {
    console.warn('[cache save]', e);
  }
}

// 채팅 캐시 로드
async function loadChatCache(roomId: string): Promise<ChatMessage[]> {
  try {
    const cached = await AsyncStorage.getItem(CHAT_CACHE_KEY(roomId));
    if (!cached) return [];

    const parsed = JSON.parse(cached);
    if (parsed.version !== CACHE_VERSION) return []; 

    return parsed.data || [];
  } catch {
    return [];
  }
}

// 미션 캐시 저장
async function saveMissionCache(missions: PerformedMission[]) {
  try {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const toSave = missions.filter(m => m.doneAtTs > cutoff);

    await AsyncStorage.setItem(
      MISSION_CACHE_KEY,
      JSON.stringify({ version: CACHE_VERSION, data: toSave })
    );
  } catch (e) {
    console.warn('[mission cache save]', e);
  }
}

// 미션 캐시 로드
async function loadMissionCache(): Promise<PerformedMission[]> {
  try {
    const cached = await AsyncStorage.getItem(MISSION_CACHE_KEY);
    if (!cached) return [];

    const parsed = JSON.parse(cached);
    if (parsed.version !== CACHE_VERSION) return [];

    return parsed.data || [];
  } catch {
    return [];
  }
}

//--------------------------
async function authedFetch(path: string, init: RequestInit = {}) {
  const token = await AsyncStorage.getItem('token');
  const headers = {
    Accept: 'application/json',
    'ngrok-skip-browser-warning': 'true',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init.body && typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
    ...(init.headers || {}),
  };
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} ${res.status}: ${text.slice(0, 200)}`);
  try { return JSON.parse(text); } catch { return text; }
}

async function presignIfNeeded(rawUrl?: string | null) {
  if (!rawUrl) return null;
  if (/\bX-Amz-Algorithm=/.test(rawUrl)) return rawUrl; 

  const candidates: Array<
    { path: string; method: 'GET' | 'POST'; body?: any }
  > = [
      { path: `/api/couples/missions/today`, method: 'GET' },
    ];

  for (const c of candidates) {
    try {
      const res = await authedFetch(
        c.method === 'GET'
          ? `${c.path}${c.path.includes('?') ? '' : `?url=${encodeURIComponent(rawUrl)}`}`
          : c.path,
        c.method === 'GET'
          ? { method: 'GET' }
          : { method: 'POST', body: JSON.stringify(c.body ?? { url: rawUrl }) }
      );

      if (!res) continue;
      const url =
        res.url ??
        res.presignedUrl ??
        res.signedUrl ??
        (typeof res === 'string' ? res : null);
      if (url && /\bX-Amz-Algorithm=/.test(String(url))) {
        return String(url);
      }
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (!/404|405|401|403/.test(msg)) {
        console.warn('[presign warn]', c.method, c.path, msg);
      } else {
        console.warn('[presign]', c.method, c.path, msg);
      }
    }
  }

  return rawUrl;
}

// ================== 타입 ==================
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
  alt?: string; 
};

type DateMarker = { __type: 'date'; key: string; ts: number };
function isDateMarker(x: ChatMessage | DateMarker): x is DateMarker { return (x as any).__type === 'date'; }

type MissionProgressDto = {
  userId: number;
  status: string;       
  photoUrl?: string;    
  completedAt?: string;
  updatedAt?: string;
};

type MissionTodayDto = {
  missionId: number;
  missionDate?: string; 
  title?: string;
  description?: string | null;
  status?: string;
  progresses?: MissionProgressDto[];
};

type PerformedMission = {
  missionId: number;
  title: string;
  missionDateTs: number;
  doneAtTs: number;     
  me?: { url?: string | null; when?: number | null };
  partner?: { url?: string | null; when?: number | null };
};

// ================== 유틸 ==================
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
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) {
    const y = Number(m[1]), mo = Number(m[2]) - 1, d = Number(m[3]);
    return new Date(y, mo, d, 0, 0, 0, 0).getTime();
  }
  const t = new Date(s).getTime();
  return Number.isNaN(t) ? null : t;
}
function isPerformed(status?: string) {
  if (!status) return false;
  const s = String(status).toUpperCase();
  return !s.includes('NOT');
}

// ================== 화면 ==================
export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const accessoryID = 'chat-input-accessory';
  
  // ✅ [수정] 컴포넌트 내부에서 Context 사용
  const { userData } = useUser();

  // ✅ [수정] Context 데이터에서 ID 추출 (타입 안전성 고려)
  const userId = userData?.userId || null;
  console.log(userId);
  const ROOM_KEY = userData?.roomId ? String(userData.roomId) : null;

  const { justCompletedMissionId, justCompletedMissionText, justCompletedPhotoUrl, justCompletedAt } =
    useLocalSearchParams<{
      justCompletedMissionId?: string;
      justCompletedMissionText?: string;
      justCompletedPhotoUrl?: string;
      justCompletedAt?: string; 
    }>();

  const [token, setToken] = useState<string | undefined>(undefined);
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [inputBarHeight, setInputBarHeight] = useState(56);

  const [performedMissions, setPerformedMissions] = useState<PerformedMission[]>([]);

  // 안전한 저장을 위한 Ref
  const latestMessages = useRef(messages);
  const latestPerformedMissions = useRef(performedMissions);

  // State와 Ref 동기화
  useEffect(() => {
    latestMessages.current = messages;
  }, [messages]);

  useEffect(() => {
    latestPerformedMissions.current = performedMissions;
  }, [performedMissions]);

  const listRef = useRef<FlatList<ChatMessage | DateMarker>>(null);
  const chatRef = useRef<ReturnType<typeof createChatClient> | null>(null);
  const latestVisibleMsgId = useRef<string | null>(null);

  // ✅ [수정] 토큰만 로드 (ID는 Context에서 이미 가져옴)
  useEffect(() => {
    (async () => {
      const t = await AsyncStorage.getItem('token');
      if (t) setToken(t);
    })();
  }, []);

  // ✅ 화면이 종료(Unmount)될 때 최신 데이터 저장
  useEffect(() => {
    return () => {
      if (ROOM_KEY) {
        saveChatCache(ROOM_KEY, latestMessages.current);
        saveMissionCache(latestPerformedMissions.current);
      }
    };
  }, [ROOM_KEY]);

  // 키보드
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

  // STOMP 메시지 수신
  const onIncoming = useCallback((p: ChatIncoming) => {
    setMessages(prev => {
      if (p.id != null && prev.some(x => String(x.id) === String(p.id))) return prev;

      if (p.clientMsgId) {
        const ix = prev.findIndex(x => x.clientMsgId === p.clientMsgId);
        if (ix >= 0) {
          const updated = [...prev];
          const cur = updated[ix];
          updated[ix] = {
            ...(cur as ChatMessage),
            id: String(p.id ?? cur.id),
            status: 'sent',
            createdAt: p.createdAt ?? cur.createdAt,
            imageUrl: p.imageUrl ?? cur.imageUrl,
          } as ChatMessage;

          if (ROOM_KEY) saveChatCache(ROOM_KEY, updated);
          return updated;
        }
      }

      const isMine = String(p.senderId) === String(userId ?? '');
      
      if (isMine && p.message) {
        const matchIndex = prev.findIndex(m => 
          m.id.startsWith('local_') && 
          m.text === p.message &&
          m.mine === true
        );

        if (matchIndex >= 0) {
          const updated = [...prev];
          const cur = updated[matchIndex];
          updated[matchIndex] = {
            ...cur, 
            id: String(p.id ?? cur.id), 
            status: 'sent', 
            createdAt: p.createdAt ?? cur.createdAt, 
          } as ChatMessage;

          if (ROOM_KEY) saveChatCache(ROOM_KEY, updated);
          return updated;
        }
      }

      const add: ChatMessage = {
        id: String(p.id ?? `${Date.now()}`),
        text: p.message ?? undefined,
        imageUrl: p.imageUrl ?? undefined,
        mine: isMine,
        createdAt: p.createdAt ?? Date.now(),
        type: p.imageUrl ? 'image' : 'text',
        status: 'sent',
      };
      
      if (prev.some(x => x.id === add.id)) return prev;

      const newMessages = [...prev, add];
      if (ROOM_KEY) saveChatCache(ROOM_KEY, newMessages);
      return newMessages;
    });
  }, [userId, ROOM_KEY]);

  // ✅ onIncoming 핸들러의 최신 상태를 Ref로 관리
  const onIncomingRef = useRef(onIncoming);
  useEffect(() => {
    onIncomingRef.current = onIncoming;
  }, [onIncoming]);

  useFocusEffect(
    useCallback(() => {
      // 1. 포커스 얻었을 때 (Mount/Focus)
      // ✅ [중요] 모든 필수 데이터가 준비되어야 연결
      if (!USE_STOMP || !token || !ROOM_KEY || !userId) {
        // 데이터가 아직 없으면 대기 (Context 로드 시 재실행됨)
        return;
      }

      console.log(`[useFocusEffect] Connecting Chat - Room: ${ROOM_KEY}, User: ${userId}`);
      
      const chat = createChatClient({
        wsUrl: WS_URL,
        token,
        roomId: ROOM_KEY,
        handlers: {
          // ✅ Ref를 통해 최신 핸들러 호출
          onMessage: (p) => onIncomingRef.current(p),
          onReadUpdate: (_u: ChatReadUpdate) => { },
          onConnected: () => {
            chatRef.current?.markAsRead(ROOM_KEY, Number(userId), latestVisibleMsgId.current ?? undefined);
          },
          onError: (e: unknown) => console.warn('[STOMP ERROR]', e),
        },
        connectTimeoutMs: 6000,
      });

      chatRef.current = chat;
      chat.activate();

      // 2. 포커스 잃었을 때 (Unmount/Blur)
      return () => {
        console.log('[useFocusEffect] Disconnecting');
        
        chat.deactivate();
        chatRef.current = null;

        if (ROOM_KEY) {
            saveChatCache(ROOM_KEY, latestMessages.current);
            saveMissionCache(latestPerformedMissions.current);
        }
      };
    }, [token, ROOM_KEY, userId]) 
  );

  useEffect(() => {
    if (!ROOM_KEY || !token || !userId) return;

    const loadData = async () => {
      let cachedMsgs: ChatMessage[] = [];
      let historyMsgs: ChatMessage[] = [];

      try {
        cachedMsgs = await loadChatCache(ROOM_KEY);
      } catch (e: any) {
        console.warn('[chat cache] load failed:', e?.message);
      }

      try {
        const res: any = await authedFetch(`/chat/${ROOM_KEY}/history?size=50`, { method: 'GET' });
        
        let rows = [];
        if (Array.isArray(res)) {
          rows = res;
        } else if (res && Array.isArray(res.messages)) {
          rows = res.messages;
        } else if (res && Array.isArray(res.content)) {
          rows = res.content;
        }

        historyMsgs = rows.map((r: any) => {
          let timeString = r.sentAt;
          if (timeString && !timeString.endsWith('Z')) {
            timeString += 'Z'; 
          }

          return {
            id: String(r.id),
            text: r.message ?? undefined,
            imageUrl: r.imageUrl ?? undefined,
            mine: String(r.senderId) === String(userId ?? ''),
            createdAt: timeString 
              ? new Date(timeString).getTime() 
              : (r.createdAt ? new Date(r.createdAt).getTime() : Date.now()),
            type: r.imageUrl ? 'image' : 'text',
            status: 'sent',
          };
        }) as ChatMessage[];
        
      } catch (e: any) {
        console.warn('[chat history] load failed:', e?.message);
      }

      setMessages(prev => {
        const serverMsgs = historyMsgs.filter(m => !m.id.startsWith('local_'));
        const latestServerTime = serverMsgs.length > 0 
          ? Math.max(...serverMsgs.map(m => m.createdAt)) 
          : 0;

        const allMsgs = [...prev, ...cachedMsgs, ...historyMsgs];
        const idMap = new Map<string, ChatMessage>();

        for (const m of allMsgs) {
          if (!m.id.startsWith('local_') && !m.id.startsWith('mission_')) {
            idMap.set(m.id, m);
            continue;
          }
          if (m.id.startsWith('mission_')) {
            idMap.set(m.id, m);
            continue;
          }
          if (m.id.startsWith('local_')) {
            if (m.createdAt <= latestServerTime + 1000) {
              continue; 
            }
            idMap.set(m.id, m);
          }
        }

        const merged = Array.from(idMap.values());
        return merged.sort((a, b) => a.createdAt - b.createdAt);
      });
    };

    loadData();
  }, [ROOM_KEY, token, userId]);

  useEffect(() => {
    if (!token || !userId) return;

    const fetchAndMergeMissions = async () => {
      let todayMissions: PerformedMission[] = [];
      let cachedMissions: PerformedMission[] = [];

      try {
        const raw: MissionTodayDto[] = await authedFetch('/api/couples/missions/today', { method: 'GET' });
        
        for (const m of raw || []) {
          if (!isPerformed(m.status)) {
            const someoneDid = (m.progresses || []).some(p => isPerformed(p.status));
            if (!someoneDid) continue;
          }

          const title = (m.description || m.title || '오늘의 미션').trim();
          const missionDateTs = parseTSLocalOrISO(m.missionDate) ?? Date.now();
          const meP = (m.progresses || []).find(p => String(p.userId) === String(userId));
          const paP = (m.progresses || []).find(p => String(p.userId) !== String(userId));

          const meWhen = (meP && isPerformed(meP.status))
            ? (parseTSLocalOrISO(meP.completedAt) ?? parseTSLocalOrISO(meP.updatedAt) ?? null)
            : null;
          const paWhen = (paP && isPerformed(paP.status))
            ? (parseTSLocalOrISO(paP.completedAt) ?? parseTSLocalOrISO(paP.updatedAt) ?? null)
            : null;

          const [meUrl, paUrl] = await Promise.all([
            presignIfNeeded(meP?.photoUrl),
            presignIfNeeded(paP?.photoUrl),
          ]);

          const candidates: number[] = [];
          if (meWhen != null) candidates.push(meWhen);
          if (paWhen != null) candidates.push(paWhen);
          if (!candidates.length) candidates.push(missionDateTs);
          const doneAtTs = Math.min(...candidates);

          todayMissions.push({
            missionId: m.missionId,
            title,
            missionDateTs,
            doneAtTs,
            me: meP && isPerformed(meP.status) ? { url: meUrl, when: meWhen } : undefined,
            partner: paP && isPerformed(paP.status) ? { url: paUrl, when: paWhen } : undefined,
          });
        }

        cachedMissions = await loadMissionCache();

        const allMissions = new Map<number, PerformedMission>();
        for (const m of cachedMissions) allMissions.set(m.missionId, m);
        for (const m of todayMissions) allMissions.set(m.missionId, m);

        const mergedMissions = Array.from(allMissions.values());
        mergedMissions.sort((a, b) => a.doneAtTs - b.doneAtTs);

        setPerformedMissions(mergedMissions);
        saveMissionCache(mergedMissions);

      } catch (e: any) {
        console.warn('[mission load failed]', e?.message);
        try {
          const cached = await loadMissionCache();
          cached.sort((a, b) => a.doneAtTs - b.doneAtTs);
          setPerformedMissions(cached);
        } catch {
          setPerformedMissions([]);
        }
      }
    };

    fetchAndMergeMissions();
  }, [token, userId]);

  const appendedOnceRef = useRef(false);
  useEffect(() => {
    if (appendedOnceRef.current) return;
    if (!justCompletedMissionId) return;

    const ts = parseTSLocalOrISO(justCompletedAt) ?? Date.now();
    const title = (justCompletedMissionText || '오늘의 미션').trim();
    const img = (justCompletedPhotoUrl || '').trim() || undefined;

    setMessages(prev => {
      const newMsgs = [
        ...prev,
        {
          id: `mission_text_opt_${justCompletedMissionId}_${ts}`,
          type: 'mission_text',
          text: title,
          mine: true,
          createdAt: ts,
          status: 'sent',
        } as ChatMessage,
        ...(img ? [{
          id: `mission_img_opt_${justCompletedMissionId}_${ts}`,
          type: 'image',
          imageUrl: img,
          mine: true,
          createdAt: ts,
          status: 'sent',
        } as ChatMessage] : []),
      ];

      if (ROOM_KEY) saveChatCache(ROOM_KEY, newMsgs);
      return newMsgs;
    });

    setPerformedMissions(prev => {
      const newMission: PerformedMission = {
        missionId: Number(justCompletedMissionId),
        title,
        missionDateTs: ts,
        doneAtTs: ts,
        me: { url: img, when: ts },
        partner: undefined
      };

      const map = new Map<number, PerformedMission>();
      prev.forEach(m => map.set(m.missionId, m));
      const existing = map.get(newMission.missionId);
      if (existing) {
        map.set(newMission.missionId, {
          ...existing,
          me: newMission.me,
          doneAtTs: Math.min(existing.doneAtTs, ts)
        });
      } else {
        map.set(newMission.missionId, newMission);
      }

      const updated = Array.from(map.values()).sort((a, b) => a.doneAtTs - b.doneAtTs);
      saveMissionCache(updated);
      return updated;
    });

    appendedOnceRef.current = true;
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [justCompletedMissionId, justCompletedMissionText, justCompletedPhotoUrl, justCompletedAt, ROOM_KEY]);

  const sendMessage = useCallback(async () => {
    if (!ROOM_KEY || !userId) {
      Alert.alert('안내', '채팅 서버 연결을 기다리고 있어요.');
      return;
    }
    if (sending) return;

    const trimmed = text.trim();
    if (!trimmed) return;
    if (trimmed.length > MAX_TEXT_LEN) {
      Alert.alert('글자 수 초과', `메시지는 최대 ${MAX_TEXT_LEN}자까지 보낼 수 있어요.`);
      return;
    }

    setSending(true);
    const clientMsgId = uuid4();
    const tempId = `local_${clientMsgId}`;
    const createdAt = Date.now();

    const newMessage: ChatMessage = {
      id: tempId,
      text: trimmed,
      mine: true,
      createdAt,
      type: 'text',
      status: USE_STOMP ? 'sending' : 'sent',
      clientMsgId,
    };

    setMessages(prev => {
      const newMessages = [...prev, newMessage];
      return newMessages;
    });
    setText('');

    try {
      if (USE_STOMP) {
        chatRef.current?.sendMessage(ROOM_KEY, Number(userId), {
          message: trimmed,
          imageUrl: null,
          clientMsgId,
          createdAt,
        });
      } else {
        setMessages(prev => {
          const newMessages = prev.map(m => m.id === tempId ? ({ ...m, status: 'sent' } as ChatMessage) : m);
          if (ROOM_KEY) saveChatCache(ROOM_KEY, newMessages);
          return newMessages;
        });
      }
    } catch {
      setMessages(prev => prev.map(m => m.id === tempId ? ({ ...m, status: 'failed' } as ChatMessage) : m));
      Alert.alert('전송 실패', '메시지 전송 중 오류가 발생했어요.');
    } finally {
      setSending(false);
    }
  }, [ROOM_KEY, userId, sending, text]);

  const listData = useMemo<(ChatMessage | DateMarker)[]>(() => {
    const baseMsgs = [...messages];
    const missionMsgs: ChatMessage[] = [];

    for (const m of performedMissions) {
      const baseTs = m.doneAtTs ?? m.missionDateTs;

      const missionTextId = `mission_text_${m.missionId}`;
      const optTextId = `mission_text_opt_${m.missionId}`;
      
      const hasText = baseMsgs.some(msg => 
        msg.id === missionTextId || msg.id.startsWith(optTextId)
      );

      if (!hasText) {
        missionMsgs.push({
          id: missionTextId,
          type: 'mission_text',
          text: m.title || '오늘의 미션',
          mine: true,
          createdAt: baseTs,
          status: 'sent',
        } as ChatMessage);
      }

      if (m.partner?.url) {
        const missionImgPartnerId = `mission_img_partner_${m.missionId}`;
        const hasImg = baseMsgs.some(msg => msg.id === missionImgPartnerId);
        if (!hasImg) {
          missionMsgs.push({
            id: missionImgPartnerId,
            type: 'image',
            imageUrl: m.partner.url,
            mine: false,
            createdAt: m.partner.when ?? baseTs,
            status: 'sent',
          } as ChatMessage);
        }
      }

      if (m.me?.url) {
        const missionImgMeId = `mission_img_me_${m.missionId}`;
        const optImgId = `mission_img_opt_${m.missionId}`;
        const hasImg = baseMsgs.some(msg => 
          msg.id === missionImgMeId || msg.id.startsWith(optImgId)
        );

        if (!hasImg) {
          missionMsgs.push({
            id: missionImgMeId,
            type: 'image',
            imageUrl: m.me.url,
            mine: true,
            createdAt: m.me.when ?? baseTs,
            status: 'sent',
          } as ChatMessage);
        }
      }
    }

    const merged = [...baseMsgs, ...missionMsgs].sort((a, b) => a.createdAt - b.createdAt);

    const out: (ChatMessage | DateMarker)[] = [];
    let lastTs: number | null = null;
    for (const m of merged) {
      if (lastTs == null || !sameYMD(lastTs, m.createdAt)) {
        out.push({ __type: 'date', key: `date_${m.createdAt}`, ts: m.createdAt });
      }
      out.push(m);
      lastTs = m.createdAt;
    }
    return out;
  }, [messages, performedMissions]);

  const shouldShowTime = useCallback((idx: number) => {
    const cur = listData[idx] as ChatMessage;
    if (isDateMarker(cur)) return false;
    let j = idx + 1;
    while (j < listData.length && isDateMarker(listData[j] as any)) j++;
    const next = j < listData.length ? (listData[j] as ChatMessage) : null;
    if (!next || isDateMarker(next as any)) return true;
    return !(next.mine === cur.mine && sameMinute(next.createdAt, cur.createdAt));
  }, [listData]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<ViewToken> }) => {
    if (!viewableItems?.length) return;
    const visibleMsg = viewableItems
      .map(v => v.item as ChatMessage | DateMarker)
      .filter((it) => !isDateMarker(it)) as ChatMessage[];

    if (!visibleMsg.length) return;
    const last = visibleMsg[visibleMsg.length - 1];
    if (last?.id && last.id !== latestVisibleMsgId.current) {
      latestVisibleMsgId.current = last.id;
      if (ROOM_KEY && userId) chatRef.current?.markAsRead(ROOM_KEY, Number(userId), last.id);
    }
  }).current;

  // 렌더링
  const renderItem: ListRenderItem<ChatMessage | DateMarker> = useCallback(({ item, index }) => {
    if (isDateMarker(item)) {
      return (
        <View style={styles.dateWrap}>
          <ChatText style={styles.dateText}>{formatDate(item.ts)}</ChatText>
        </View>
      );
    }

    const m = item as ChatMessage;
    const mine = m.mine;
    const showTime = shouldShowTime(index);

    const isMissionText = m.type === 'mission_text';
    const bubbleStyle = isMissionText
      ? (mine ? styles.bubbleMissionMine : styles.bubbleMissionOther)
      : (mine ? styles.bubbleMine : styles.bubbleOther);

    const contentContainerStyle =
      m.type === 'image'
        ? (mine ? styles.imageBoxMine : styles.imageBoxOther)
        : [styles.bubble, bubbleStyle];

    return (
      <View style={[styles.row, mine ? styles.rowMine : styles.rowOther]}>
        <View style={[styles.msgCol, mine ? { flexDirection: 'row', justifyContent: 'flex-end' } : { flexDirection: 'row', justifyContent: 'flex-start' }]}>
          {mine && showTime && (
            <ChatText style={styles.timeTextMine}>
              {formatTime(m.createdAt)}
            </ChatText>
          )}

          <View style={contentContainerStyle}>
            {isMissionText ? (
              <AppText type='pretendard-b' style={[styles.msgText]}>
                {m.text}
              </AppText>
            ) : m.type === 'image' ? (
              <Image
                source={{ uri: m.imageUrl! }}
                style={styles.missionImage}
                resizeMode="cover"
                onError={(e) => {
                  console.warn('[IMG ERROR]', m.imageUrl, e.nativeEvent?.error);
                  m.alt = '이미지를 불러오지 못했어요';
                }}
              />
            ) : (
              <AppText type='pretendard-m'style={[mine ? styles.msgTextMine : styles.msgTextOther]}>
                {m.text}
              </AppText>
            )}
            {m.alt ? (
              <ChatText style={[styles.msgText, { marginTop: 6, color: mine ? '#FCECEC' : '#C00' }]}>
                {m.alt}
              </ChatText>
            ) : null}
          </View>

          {!mine && showTime && (
            <ChatText style={styles.timeTextOther}>
              {formatTime(m.createdAt)}
            </ChatText>
          )}
        </View>

        <View style={styles.metaWrapRight}>
          {m.status === 'failed' ? (
            <Ionicons name="alert-circle" size={14} color="#FF4D4F" />
          ) : m.status === 'sending' ? (
            <AppText type='pretendard-b' style={styles.SendingText}> 전송 중..</AppText>
            // <Ionicons name="time-outline" size={12} color="#1622ffff" />
          ) : null}
        </View>
      </View>
    );
  }, [shouldShowTime]);

  const keyExtractor = useCallback((item: ChatMessage | DateMarker, idx: number) => {
    if (isDateMarker(item)) return item.key;
    return item.id ?? String(idx);
  }, []);

  const inputExtra = Platform.OS === 'android' ? keyboardHeight : 0;
  const listBottomPadding = inputExtra + inputBarHeight + 12 + insets.bottom;

  return (
    <KeyboardAvoidingView
      style={styles.wrap}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + HEADER_HEIGHT : 0}
    >
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable style={{ paddingHorizontal: 8 }} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#111" />
        </Pressable>
        <AppText style={styles.headerTitle}>애인</AppText>
        <Pressable onPress={() => router.push('/camera')} style={{ paddingHorizontal: 8 }}>
          <Ionicons name="camera-outline" size={24} color="#111" />
        </Pressable>
      </View>

      <FlatList<ChatMessage | DateMarker>
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

      {Platform.OS === 'ios' ? (
        <InputAccessoryView nativeID={accessoryID}>
          <View
            style={[styles.inputBar, { paddingBottom: 8 + insets.bottom }]}
            onLayout={(e) => setInputBarHeight(e.nativeEvent.layout.height)}
          >
            <TextInput
              style={[styles.input, { fontFamily: 'Pretendard-Medium' }]}
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
          style={[
            styles.inputBar,
            { position: 'absolute', left: 0, right: 0, bottom: 8 + insets.bottom + keyboardHeight },
          ]}
          onLayout={(e) => setInputBarHeight(e.nativeEvent.layout.height)}
        >
          <TextInput
            style={[styles.input, { fontFamily: 'Pretendard-Medium' }]}
            placeholder="대화를 입력하세요"
            value={text}
            onChangeText={(t) => t.length <= MAX_TEXT_LEN && setText(t)}
            multiline
          />
          <Pressable style={[styles.sendBtn, sending && { opacity: 0.6 }]} onPress={sendMessage} disabled={sending}>
            <Ionicons name="arrow-up" size={22} color="#4D5053" />
          </Pressable>
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
    paddingHorizontal: 6,
    justifyContent: 'space-between', 
    marginVertical: 25,
  },
  headerTitle: { fontSize: 16, color: '#111' },

  row: {
    width: '100%',
    marginVertical: 6,
  },
  rowMine: { alignItems: 'flex-end' }, // 전체 행을 우측 정렬
  rowOther: { alignItems: 'flex-start' }, // 전체 행을 좌측 정렬

  msgCol: { 
    maxWidth: '80%', 
    alignItems: 'flex-end', // 기본 정렬 (시간 텍스트 정렬용)
  },

  bubble: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 16 },
  bubbleMine: { backgroundColor: '#BED5FF', borderBottomRightRadius: 2 },
  bubbleOther: { backgroundColor: '#FFADAD', borderWidth: StyleSheet.hairlineWidth, borderTopLeftRadius: 2 },

  imageBoxMine: {
    borderRadius: 18,
    overflow: 'hidden',
    alignSelf: 'flex-end',
  },
  imageBoxOther: {
    borderRadius: 18,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },

  bubbleMissionMine: { backgroundColor: '#6198FF', borderBottomRightRadius: 0,width:'80%',},
  bubbleMissionOther: {
    backgroundColor: '#FFADAD',
    borderTopRightRadius: 0,
    width:'80%',
  },
  missionImage: {
    width: STICKER_SIZE * 1.6,
    height: STICKER_SIZE * 2.5,
    borderRadius: 0, 
    backgroundColor: '#DDE7FF', 
  },

  msgText: { fontSize: 13, lineHeight: 20, color: '#fff', paddingVertical:12, paddingHorizontal:20},
  msgTextMine: { fontSize: 13, color: '#3F3F3F' },
  msgTextOther: { fontSize: 13, color: '#3F3F3F' },

  SendingText:{fontSize:10, color:'#6198FF'},

  timeTextMine: { 
    marginRight: 6, 
    marginBottom: 0, 
    fontSize: 10, 
    color: '#75787B',
    alignSelf: 'flex-end' 
  },
  timeTextOther: { 
    marginLeft: 6, 
    marginBottom: 0, 
    fontSize: 10, 
    color: '#75787B',
    alignSelf: 'flex-end'
  },

  metaWrapRight: { marginLeft: 6, alignItems: 'center', justifyContent: 'flex-end' },

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
    backgroundColor: '#EEEFEF',
  },
});