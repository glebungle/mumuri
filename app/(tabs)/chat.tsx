// app/(tabs)/chat.tsx
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
import AppText from '../../components/AppText';
import { ChatIncoming, ChatReadUpdate, createChatClient } from '../lib/chatSocket';

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
    // 1. 상태가 failed인 것만 제외하고, sent나 sending은 모두 저장
    const toSave = messages
      .filter(m => m.status !== 'failed') 
      .slice(-100); // 최근 100개

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

function normalizeGetUser(raw: any) {
  if (typeof raw === 'number') return { userId: raw };
  if (typeof raw === 'string' && /^[0-9]+$/.test(raw)) return { userId: Number(raw) };
  if (raw && typeof raw === 'object') {
    const userId = raw.userId ?? raw.id ?? raw.memberId ?? null;
    const coupleId = raw.coupleId ?? raw.couple_id ?? null;
    const coupleCode = raw.coupleCode ?? raw.couple_code ?? null;
    return { userId, coupleId, coupleCode };
  }
  return { userId: null, coupleId: null, coupleCode: null };
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

  const { justCompletedMissionId, justCompletedMissionText, justCompletedPhotoUrl, justCompletedAt } =
    useLocalSearchParams<{
      justCompletedMissionId?: string;
      justCompletedMissionText?: string;
      justCompletedPhotoUrl?: string;
      justCompletedAt?: string; 
    }>();

  const [token, setToken] = useState<string | undefined>(undefined);
  const [coupleId, setCoupleId] = useState<number | null>(null);
  const [coupleCode, setCoupleCode] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);

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

  // 초기 사용자/커플 식별자 확보
  useEffect(() => {
    (async () => {
      const entries = await AsyncStorage.multiGet(['token', 'userId', 'coupleId', 'coupleCode']);
      const map = Object.fromEntries(entries);
      const tokenStr = map.token || undefined;
      const userIdNum = map.userId ? Number(map.userId) : null;
      const coupleIdNum = map.coupleId ? Number(map.coupleId) : null;
      const codeStr = map.coupleCode || null;

      setToken(tokenStr);
      setUserId(userIdNum);
      setCoupleId(coupleIdNum);
      setCoupleCode(codeStr);

      if (tokenStr && (!userIdNum || (!coupleIdNum && !codeStr))) {
        try {
          const raw = await authedFetch('/user/getuser', { method: 'GET' });
          const { userId: uid, coupleId: cid, coupleCode: ccode } = normalizeGetUser(raw);
          const kv: [string, string][] = [];
          if (uid != null && uid !== userIdNum) { setUserId(uid); kv.push(['userId', String(uid)]); }
          if (cid != null && cid !== coupleIdNum) { setCoupleId(cid); kv.push(['coupleId', String(cid)]); }
          if (ccode && ccode !== codeStr) { setCoupleCode(ccode); kv.push(['coupleCode', ccode]); }
          if (kv.length) await AsyncStorage.multiSet(kv);
        } catch (e: any) {
          console.warn('[getuser] failed:', e?.message);
        }
      }
    })();
  }, []);

  const ROOM_KEY: string | null = (coupleId != null ? String(coupleId) : null);

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

  // ✅ [수정] onIncoming을 useFocusEffect보다 위로 올림 (Hoisting 문제 해결)
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

          // 실시간 저장
          if (ROOM_KEY) saveChatCache(ROOM_KEY, updated);
          return updated;
        }
      }

      const isMine = String(p.senderId) === String(userId ?? '');
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

  // ✅ useFocusEffect (onIncoming 선언 후 사용)
  useFocusEffect(
    useCallback(() => {
      // 1. 포커스 얻었을 때 (Mount/Focus)
      if (!USE_STOMP || !token || !ROOM_KEY || !userId) return;

      console.log('[useFocusEffect] Mounted/Focused - Connecting STOMP');
      
      const chat = createChatClient({
        wsUrl: WS_URL,
        token,
        roomId: ROOM_KEY,
        handlers: {
          onMessage: onIncoming, // 이제 에러 안 남
          onReadUpdate: (_u: ChatReadUpdate) => { },
          onConnected: () => {
            chatRef.current?.markAsRead(ROOM_KEY, userId, latestVisibleMsgId.current ?? undefined);
          },
          onError: (e: unknown) => console.warn('[STOMP ERROR]', e),
        },
        connectTimeoutMs: 6000,
      });

      chatRef.current = chat;
      chat.activate();

      // 2. 포커스 잃었을 때 (Unmount/Blur)
      return () => {
        console.log('[useFocusEffect] Unmounted/Blurred - Disconnecting & Saving');
        
        chat.deactivate();
        chatRef.current = null;

        // 다른 탭 갈 때 반드시 저장!
        if (ROOM_KEY) {
            saveChatCache(ROOM_KEY, latestMessages.current);
            saveMissionCache(latestPerformedMissions.current);
        }
      };
    }, [token, ROOM_KEY, userId, onIncoming]) 
  );


  // 채팅 캐시 로드 + 히스토리 API 로드
  useEffect(() => {
    if (!ROOM_KEY || !token) return;

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
        
        // 🔍 디버깅용 로그
        console.log('[chat history DEBUG]', JSON.stringify(res, null, 2));

        let rows = [];
        if (Array.isArray(res)) {
          rows = res;
        } else if (res && Array.isArray(res.messages)) {
          rows = res.messages;
        } else if (res && Array.isArray(res.content)) {
          rows = res.content;
        }

        historyMsgs = rows.map((r: any) => ({
          id: String(r.id),
          text: r.message ?? undefined,
          imageUrl: r.imageUrl ?? undefined,
          mine: String(r.senderId) === String(userId ?? ''),
          createdAt: r.sentAt ? new Date(r.sentAt).getTime() : (r.createdAt ? new Date(r.createdAt).getTime() : Date.now()),
          type: r.imageUrl ? 'image' : 'text',
          status: 'sent',
        })) as ChatMessage[];
      } catch (e: any) {
        console.warn('[chat history] load failed:', e?.message);
      }

      setMessages(prev => {
        const allMsgs = [...prev, ...cachedMsgs, ...historyMsgs];
        const idMap = new Map<string, ChatMessage>();
        for (const m of allMsgs) {
          if (m.id.startsWith('local_') || m.id.startsWith('mission_')) {
            idMap.set(m.id, m);
            continue;
          }
          const existing = idMap.get(m.id);
          if (!existing || m.createdAt > existing.createdAt) {
            idMap.set(m.id, m);
          }
        }
        const merged = Array.from(idMap.values());
        return merged.sort((a, b) => a.createdAt - b.createdAt);
      });
    };

    loadData();
  }, [ROOM_KEY, token, userId]);

  // 미션 캐시 로드 + 오늘 미션 API 병합
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

  // 미션 완료 후 처리
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

  // 텍스트 전송
  const sendMessage = useCallback(async () => {
    if (!ROOM_KEY || !userId) {
      Alert.alert('안내', '커플 정보가 아직 준비되지 않았어요.');
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
        chatRef.current?.sendMessage(ROOM_KEY, userId, {
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

  // 렌더링 데이터 생성
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
      if (ROOM_KEY && userId) chatRef.current?.markAsRead(ROOM_KEY, userId, last.id);
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
        : [styles.bubble, bubbleStyle, isMissionText && styles.bubbleMissionText];

    return (
      <View style={[styles.row, mine ? styles.rowMine : styles.rowOther]}>
        <View style={styles.msgCol}>
          <View style={contentContainerStyle}>
            {isMissionText ? (
              <ChatText style={[styles.msgText, mine ? styles.msgTextMine : styles.msgTextOther]}>
                {m.text}
              </ChatText>
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
              <ChatText style={[styles.msgText, mine ? styles.msgTextMine : styles.msgTextOther]}>
                {m.text}
              </ChatText>
            )}
            {m.alt ? (
              <ChatText style={[styles.msgText, { marginTop: 6, color: mine ? '#FCECEC' : '#C00' }]}>
                {m.alt}
              </ChatText>
            ) : null}
          </View>
          {showTime && (
            <ChatText style={[styles.timeTextLeft, mine ? { alignSelf: 'flex-end', marginRight: 6 } : { alignSelf: 'flex-start', marginLeft: 6 }]}>
              {formatTime(m.createdAt)}
            </ChatText>
          )}
        </View>

        <View style={styles.metaWrapRight}>
          {m.status === 'failed' ? (
            <Ionicons name="alert-circle" size={14} color="#FF4D4F" />
          ) : m.status === 'sending' ? (
            <Ionicons name="time-outline" size={12} color="#999" />
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
        <View style={{ width: 30 }} />
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
          style={[
            styles.inputBar,
            { position: 'absolute', left: 0, right: 0, bottom: 8 + insets.bottom + keyboardHeight },
          ]}
          onLayout={(e) => setInputBarHeight(e.nativeEvent.layout.height)}
        >
          <TextInput
            style={styles.input}
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
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, color: '#111' },

  row: {
    width: '100%',
    marginVertical: 6,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  rowMine: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },

  msgCol: { maxWidth: '80%' },

  bubble: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 16 },
  bubbleMine: { backgroundColor: '#6198FF' },
  bubbleOther: { backgroundColor: '#fff', borderWidth: StyleSheet.hairlineWidth, borderColor: '#e5e7eb' },

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

  bubbleMissionMine: { backgroundColor: '#6198FF' },
  bubbleMissionOther: {
    backgroundColor: '#FFE8D2',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#F7CBA7',
  },
  missionImage: {
    width: STICKER_SIZE * 1.6,
    height: STICKER_SIZE * 1.6,
    borderRadius: 0, 
    backgroundColor: '#DDE7FF', 
  },
  bubbleMissionText: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
  },
  missionLabel: {
    fontSize: 11,
    color: '#ffffff',
    marginBottom: 4,
  },

  msgText: { fontSize: 14, lineHeight: 20 },
  msgTextMine: { color: '#fff' },
  msgTextOther: { color: '#111' },

  timeTextLeft: { marginTop: 4, fontSize: 10, color: '#888' },

  metaWrapRight: { marginLeft: 6, alignItems: 'center', justifyContent: 'flex-end' },

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
    backgroundColor: '#EEEFEF',
  },
});