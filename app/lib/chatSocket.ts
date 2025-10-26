// app/lib/chatSocket.ts
// 설치: yarn add @stomp/stompjs sockjs-client
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

export type ChatIncoming = {
  id?: string | number;
  roomId: string | number;
  senderId: string | number;
  message?: string | null;
  imageUrl?: string | null;
  createdAt?: number;
  clientMsgId?: string | null;
};

export type ChatReadUpdate = {
  roomId: string | number;
  userId: string | number;
  upToId?: string | number;
  readAt?: number;
};

type Handlers = {
  onMessage: (payload: ChatIncoming) => void;
  onReadUpdate?: (payload: ChatReadUpdate) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (e: unknown) => void;
};

type CreateArgs = {
  wsUrl: string;                 
  token?: string;
  roomId: string | number;
  handlers: Handlers;
  connectTimeoutMs?: number;     // 선택
};

export function createChatClient({
  wsUrl,
  token,
  roomId,
  handlers,
  connectTimeoutMs = 6000,
}: CreateArgs) {
  // 1) SockJS로 시도
  const client = new Client({
    webSocketFactory: () => {
      console.log('[STOMP/SockJS] Opening Web Socket...');
      return new SockJS(wsUrl);
    },
    connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
    reconnectDelay: 2000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    debug: (str) => console.log('[STOMP/SockJS]', str),
  });

  // 연결 상태/큐
  let _connected = false;
  const _queue: Array<() => void> = [];
  const _safePublish = (destination: string, body: unknown) => {
    console.log('[PUB]', destination, body);
    const job = () =>
      client.publish({
        destination,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    if (_connected) job();
    else _queue.push(job);
  };

  let fallbackTimer: any = null;
  const startFallbackTimer = () => {
    clearTimeout(fallbackTimer);
    fallbackTimer = setTimeout(() => {
      if (_connected) return;
      console.log('[STOMP] SockJS connect timeout → fallback to pure WS');
      client.deactivate();
      const wsClient = new Client({
        brokerURL: wsUrl.endsWith('/websocket')
          ? wsUrl.replace(/^http/, 'ws')
          : wsUrl.replace(/^http/, 'ws') + '/websocket',
        connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
        reconnectDelay: 2000,
        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,
        debug: (str) => console.log('[STOMP/WS]', str),
      });
      bindClient(wsClient);
      wsClient.activate();
    }, connectTimeoutMs);
  };

  const bindClient = (c: Client) => {
    c.onConnect = () => {
      _connected = true;
      clearTimeout(fallbackTimer);
      console.log('[STOMP] connected');
      c.subscribe(`/topic/messages/${roomId}`, (frame: IMessage) => {
        try {
          const data = JSON.parse(frame.body) as ChatIncoming;
          handlers.onMessage(data);
        } catch (e) {
          handlers.onError?.(e);
        }
      });
      c.subscribe(`/topic/messages/read/${roomId}`, (frame: IMessage) => {
        try {
          const data = JSON.parse(frame.body) as ChatReadUpdate;
          handlers.onReadUpdate?.(data);
        } catch (e) {
          handlers.onError?.(e);
        }
      });

      while (_queue.length) {
        const fn = _queue.shift();
        try { fn?.(); } catch (e) { handlers.onError?.(e); }
      }
      handlers.onConnected?.();
    };

    c.onWebSocketClose = (ev) => {
      _connected = false;
      console.log('[STOMP] ws closed', ev);
      handlers.onDisconnected?.();
    };

    c.onStompError = (frame) => {
      handlers.onError?.({
        message: frame.headers['message'],
        body: frame.body,
      });
    };
  };

  bindClient(client);

  return {
    activate: () => {
      startFallbackTimer();
      client.activate();
    },
    deactivate: () => {
      clearTimeout(fallbackTimer);
      client.deactivate();
    },
    isConnected: () => _connected,
    sendMessage: (
      roomIdArg: string | number,
      senderId: string | number,
      body: {
        message?: string | null;
        imageUrl?: string | null;
        clientMsgId?: string | null;
        createdAt?: number;
      }
    ) => {
      _safePublish('/app/chat.send', {
        roomId: Number(roomIdArg),
        senderId: Number(senderId),
        ...body,
      });
    },
    markAsRead: (
      roomIdArg: string | number,
      userId: string | number,
      upToId?: string | number
    ) => {
      _safePublish('/app/chat.read', {
        roomId: Number(roomIdArg),
        userId: Number(userId),
        upToId,
      });
    },
    raw: client,
  };
}
