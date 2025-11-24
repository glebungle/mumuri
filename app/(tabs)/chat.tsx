// app/(tabs)/chat.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
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

// ================== 환경 ==================
const API_BASE = 'https://mumuri.shop';
const WS_URL   = `${API_BASE}/ws-chat`;

const MAX_TEXT_LEN = 500;
const HEADER_HEIGHT = 56;

const USE_STOMP = true;

// ================== 내부 유틸(API) ==================
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
  if (/\bX-Amz-Algorithm=/.test(rawUrl)) return rawUrl; // 이미 서명됨

  const candidates: Array<
    { path: string; method: 'GET' | 'POST'; body?: any }
  > = [
    // --- 미션 전용 경로 후보 ---
    { path: `/api/couples/missions/presign`, method: 'GET' },
    { path: `/api/couples/missions/presign`, method: 'POST', body: { url: rawUrl } },
    { path: `/api/couples/missions/photo/presign`, method: 'GET' },
    { path: `/api/couples/missions/photo/presign`, method: 'POST', body: { url: rawUrl } },

    // --- 일반 포토 presign 후보 ---
    { path: `/photo/presign?url=${encodeURIComponent(rawUrl)}`, method: 'GET' },
    { path: `/photo/presign`, method: 'POST', body: { url: rawUrl } },

    // --- 백엔드에서 통합 presign을 쓰는 경우 대비 ---
    { path: `/api/presign?url=${encodeURIComponent(rawUrl)}`, method: 'GET' },
    { path: `/api/presign`, method: 'POST', body: { url: rawUrl } },
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
  createdAt: number; // ms
  type: 'text' | 'image' | 'mission_text';
  status?: SendStatus;
  clientMsgId?: string | null;
  alt?: string; // 이미지 로딩 실패 안내문 등
};

type DateMarker = { __type: 'date'; key: string; ts: number };
function isDateMarker(x: ChatMessage | DateMarker): x is DateMarker { return (x as any).__type === 'date'; }

type MissionProgressDto = {
  userId: number;
  status: string;      // NOT_DONE / HALF_DONE / DONE 등
  photoUrl?: string;   // raw or presigned
  completedAt?: string; 
  updatedAt?: string;
};

type MissionTodayDto = {
  missionId: number;
  missionDate?: string; // 'YYYY-MM-DD'
  title?: string;
  description?: string | null;
  status?: string;
  progresses?: MissionProgressDto[];
};

type PerformedMission = {
  missionId: number;
  title: string;
  missionDateTs: number;
  // 정렬/표시용
  me?: { url?: string | null; when?: number | null };
  partner?: { url?: string | null; when?: number | null };
};

// ================== 유틸(날짜/문자열) ==================
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
function parseTSLocalOrISO(s?: string | null): number | null {
  if (!s) return null;
  // YYYY-MM-DD 로컬 00:00 처리
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
  // NOT_STARTED 제외, 그 외(HALF_DONE/DONE/COMPLETE 등)는 수행으로 간주
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
      justCompletedAt?: string; // complete API 가 리턴한 ISO(서버시간)
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

  // ✅ 여러 개의 “수행된” 미션을 보관
  const [performedMissions, setPerformedMissions] = useState<PerformedMission[]>([]);

  const listRef = useRef<FlatList<ChatMessage | DateMarker>>(null);
  const chatRef = useRef<ReturnType<typeof createChatClient> | null>(null);
  const latestVisibleMsgId = useRef<string | null>(null);

  // 초기 사용자/커플 식별자 확보
  useEffect(() => {
    (async () => {
      const entries = await AsyncStorage.multiGet(['token','userId','coupleId','coupleCode']);
      const map = Object.fromEntries(entries);
      const tokenStr   = map.token || undefined;
      const userIdNum  = map.userId ? Number(map.userId) : null;
      const coupleIdNum= map.coupleId ? Number(map.coupleId) : null;
      const codeStr    = map.coupleCode || null;

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

      setTimeout(async () => {
        const after = Object.fromEntries(await AsyncStorage.multiGet(['token','userId','coupleId','coupleCode']));
        console.log('[chat final]', {
          token: !!after.token,
          userId: after.userId ?? null,
          coupleId: after.coupleId ?? null,
          coupleCode: after.coupleCode ?? null,
        });
      }, 300);
    })();
  }, []);

  const ROOM_KEY: string | null = (coupleId != null ? String(coupleId) : null);

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

  // STOMP 연결
  const onIncoming = useCallback((p: ChatIncoming) => {
    setMessages(prev => {
      if (p.id != null && prev.some(x => String(x.id) === String(p.id))) return prev;

      // 클라 낙관 전송과 매칭
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
          };
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
      return [...prev, add];
    });
  }, [userId]);

  useEffect(() => {
    if (!USE_STOMP) return;
    if (!token || !ROOM_KEY || !userId) {
      console.log('[stomp guard]', { hasToken: !!token, ROOM_KEY, userId });
      return;
    }

    console.log('[stomp connect]', { ROOM_KEY, userId });
    const chat = createChatClient({
      wsUrl: WS_URL,
      token,
      roomId: ROOM_KEY,
      handlers: {
        onMessage: onIncoming,
        onReadUpdate: (_u: ChatReadUpdate) => {},
        onConnected: () => {
          chatRef.current?.markAsRead(ROOM_KEY, userId, latestVisibleMsgId.current ?? undefined);
        },
        onError: (e: unknown) => console.warn('[STOMP ERROR]', e),
      },
      connectTimeoutMs: 6000,
    });

    chatRef.current = chat;
    chat.activate();
    return () => { chat.deactivate(); chatRef.current = null; };
  }, [token, ROOM_KEY, userId, onIncoming]);

  // 채팅 히스토리(있으면)
  useEffect(() => {
    if (!ROOM_KEY || !token) return;
    (async () => {
      try {
        const rows = await authedFetch(`/chat/${ROOM_KEY}/history?limit=50`, { method: 'GET' });
        const mapped: ChatMessage[] = (rows || []).map((r: any) => ({
          id: String(r.id),
          text: r.message ?? undefined,
          imageUrl: r.imageUrl ?? undefined,
          mine: String(r.senderId) === String(userId ?? ''),
          createdAt: Number(r.createdAt ?? Date.now()),
          type: r.imageUrl ? 'image' : 'text',
          status: 'sent',
        }));
        setMessages(prev => {
          const ids = new Set(prev.map(p => p.id));
          const merged = [...prev, ...mapped.filter(m => !ids.has(m.id))];
          return merged.sort((a, b) => a.createdAt - b.createdAt);
        });
      } catch (e: any) {
        console.warn('[chat history] load failed:', e?.message);
      }
    })();
  }, [ROOM_KEY, token, userId]);

  // 오늘의 “수행된” 미션들만 가져오기 + presign
  useEffect(() => {
    if (!token || !userId) return;
    (async () => {
      try {
        const raw: MissionTodayDto[] = await authedFetch('/api/couples/missions/today', { method: 'GET' });
        console.log('[mission today raw]', raw);

        const out: PerformedMission[] = [];

        for (const m of raw || []) {
          // 미션 자체가 NOT_STARTED 라면 스킵(방어)
          if (!isPerformed(m.status)) {
            // 단, progresses 중 누군가가 한 경우는 수행으로 간주
            const someoneDid = (m.progresses || []).some(p => isPerformed(p.status));
            if (!someoneDid) continue;
          }

          const title = (m.description || m.title || '오늘의 미션').trim();
          const missionDateTs = parseTSLocalOrISO(m.missionDate) ?? Date.now();

          const meP = (m.progresses || []).find(p => String(p.userId) === String(userId));
          const paP = (m.progresses || []).find(p => String(p.userId) !== String(userId));

          // presign
          const [meUrl, paUrl] = await Promise.all([
            presignIfNeeded(meP?.photoUrl),
            presignIfNeeded(paP?.photoUrl),
          ]);

          out.push({
            missionId: m.missionId,
            title,
            missionDateTs,
            me: meP && isPerformed(meP.status) ? {
              url: meUrl,
              when: parseTSLocalOrISO(meP.completedAt) ?? parseTSLocalOrISO(meP.updatedAt) ?? missionDateTs,
            } : undefined,
            partner: paP && isPerformed(paP.status) ? {
              url: paUrl,
              when: parseTSLocalOrISO(paP.completedAt) ?? parseTSLocalOrISO(paP.updatedAt) ?? missionDateTs,
            } : undefined,
          });
        }

        // 완료/업데이트 시각 기준으로 정렬(오래된→최근)
        out.sort((a, b) => {
          const aWhen = Math.min(
            a.me?.when ?? a.missionDateTs,
            a.partner?.when ?? a.missionDateTs,
          );
          const bWhen = Math.min(
            b.me?.when ?? b.missionDateTs,
            b.partner?.when ?? b.missionDateTs,
          );
          return aWhen - bWhen;
        });

        setPerformedMissions(out);
      } catch (e: any) {
        console.warn('[mission today] failed:', e?.message);
        setPerformedMissions([]);
      }
    })();
  }, [token, userId]);

  // ✅ share → chat로 넘어올 때, 방금 완료한 미션을 "그 시각"으로 낙관 반영
  const appendedOnceRef = useRef(false);
  useEffect(() => {
    if (appendedOnceRef.current) return;
    if (!justCompletedMissionId) return;

    const ts = parseTSLocalOrISO(justCompletedAt) ?? Date.now();
    const title = (justCompletedMissionText || '오늘의 미션').trim();
    const img = (justCompletedPhotoUrl || '').trim() || undefined;

    // 텍스트 → 이미지 (같은 미션 아이템 아래)
    setMessages(prev => ([
      ...prev,
      { id: `mission_text_opt_${justCompletedMissionId}_${ts}`, type: 'mission_text', text: title, mine: true, createdAt: ts, status: 'sent' },
      ...(img ? [{ id: `mission_img_opt_${justCompletedMissionId}_${ts}`, type: 'image', imageUrl: img, mine: true, createdAt: ts + 1, status: 'sent' } as ChatMessage] : []),
    ]));
    appendedOnceRef.current = true;
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [justCompletedMissionId, justCompletedMissionText, justCompletedPhotoUrl, justCompletedAt]);

  
  // 텍스트 전송(이미지 전송 기능 제거)
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

    setMessages(prev => ([...prev, {
      id: tempId,
      text: trimmed,
      mine: true,
      createdAt,
      type: 'text',
      status: USE_STOMP ? 'sending' : 'sent',
      clientMsgId,
    }]));
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
        setMessages(prev => prev.map(m => m.id === tempId ? ({ ...m, status: 'sent' }) : m));
      }
    } catch {
      setMessages(prev => prev.map(m => m.id === tempId ? ({ ...m, status:'failed' }) : m));
      Alert.alert('전송 실패','메시지 전송 중 오류가 발생했어요.');
    } finally {
      setSending(false);
    }
  }, [ROOM_KEY, userId, sending, text]);

  // 날짜 마커 + “수행된 미션들”을 ‘텍스트 바로 아래 그 미션의 사진’으로 묶어 합성
  const listData = useMemo<(ChatMessage | DateMarker)[]>(() => {
    const baseMsgs = [...messages].sort((a,b) => a.createdAt - b.createdAt);

    const missionMsgs: ChatMessage[] = [];
    for (const m of performedMissions) {
      // 1) 미션 텍스트(한 번)
      missionMsgs.push({
        id: `mission_text_${m.missionId}`,
        type: 'mission_text',
        text: m.title || '오늘의 미션',
        mine: true,
        createdAt: m.missionDateTs,
        status: 'sent',
      });

      // 2) (있다면) 파트너 사진
      if (m.partner?.url) {
        missionMsgs.push({
          id: `mission_img_partner_${m.missionId}`,
          type: 'image',
          imageUrl: m.partner.url,
          mine: false,
          createdAt: (m.partner.when ?? m.missionDateTs),
          status: 'sent',
        });
      }

      // 3) (있다면) 내 사진
      if (m.me?.url) {
        missionMsgs.push({
          id: `mission_img_me_${m.missionId}`,
          type: 'image',
          imageUrl: m.me.url,
          mine: true,
          createdAt: (m.me.when ?? m.missionDateTs) + 1,
          status: 'sent',
        });
      }
    }

    const merged = [...baseMsgs, ...missionMsgs].sort((a,b) => a.createdAt - b.createdAt);

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

  // ================== 렌더러 ==================
  const renderItem: ListRenderItem<ChatMessage | DateMarker> = useCallback(({ item, index }) => {
    if (isDateMarker(item)) {
      return (
        <View style={styles.dateWrap}>
          <AppText style={styles.dateText}>{formatDate(item.ts)}</AppText>
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

    return (
      <View style={[styles.row, mine ? styles.rowMine : styles.rowOther]}>
        <View style={styles.msgCol}>
          <View style={[styles.bubble, bubbleStyle, isMissionText && styles.bubbleMissionText]}>
            {isMissionText ? (
              <>
                <AppText style={styles.missionLabel}>오늘의 미션</AppText>
                <AppText style={[styles.msgText, mine ? styles.msgTextMine : styles.msgTextOther]}>
                  {m.text}
                </AppText>
              </>
            ) : m.type === 'image' ? (
              <Image
                source={{ uri: m.imageUrl! }}
                style={styles.missionImage}
                resizeMode="cover"
                onError={(e) => {
                  console.warn('[IMG ERROR]', m.imageUrl, e.nativeEvent?.error);
                  // presign 실패/만료 등으로 안 보일 때 안내
                  m.alt = '이미지를 불러오지 못했어요';
                }}
              />
            ) : (
              <AppText style={[styles.msgText, mine ? styles.msgTextMine : styles.msgTextOther]}>
                {m.text}
              </AppText>
            )}
            {m.alt ? (
              <AppText style={[styles.msgText, { marginTop: 6, color: mine ? '#FCECEC' : '#C00' }]}>{m.alt}</AppText>
            ) : null}
          </View>
          {showTime && <AppText style={styles.timeTextLeft}>{formatTime(m.createdAt)}</AppText>}
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
        {/* 갤러리/카메라 버튼 삭제: “그냥 사진 보내기” 기능 제거 */}
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
            <Ionicons name="arrow-up" size={22} color="#fff" />
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

  bubble: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 16 },
  bubbleMine: { backgroundColor: '#6198FF' },
  bubbleOther: { backgroundColor: '#fff', borderWidth: StyleSheet.hairlineWidth, borderColor: '#e5e7eb' },

  bubbleMissionMine: { backgroundColor: '#6198FF' },
  bubbleMissionOther: {
    backgroundColor: '#FFE8D2',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#F7CBA7',
  },
  missionImage: {
    width: STICKER_SIZE * 1.6,
    height: STICKER_SIZE * 1.6,
    borderRadius: 12,
    backgroundColor: '#DDE7FF', // 로딩 시 배경
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

  timeTextLeft: { marginTop: 4, fontSize: 10, color: '#888', alignSelf: 'flex-start', marginLeft: 6 },

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
    backgroundColor: '#FF9191',
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, elevation: 3,
  },
});
