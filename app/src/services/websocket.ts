import { WebSocketMessage } from '../types';

export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface WebSocketEventHandlers {
  onMessage?: (message: WebSocketMessage) => void;
  onStatusChange?: (status: WebSocketStatus) => void;
  onError?: (error: Error) => void;
}

class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string | null = null;
  private token: string | null = null;
  private status: WebSocketStatus = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private maxReconnectDelay = 30000; // Max 30 seconds
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingTimer: NodeJS.Timeout | null = null;
  private eventHandlers: WebSocketEventHandlers = {};

  connect(url: string, token: string, handlers: WebSocketEventHandlers = {}) {
    this.url = url;
    this.token = token;
    this.eventHandlers = handlers;
    this.reconnectAttempts = 0;
    
    this.establishConnection();
  }

  private establishConnection() {
    if (!this.url || !this.token) {
      throw new Error('URL and token are required');
    }

    try {
      // Add token as query parameter
      const wsUrl = `${this.url}?token=${encodeURIComponent(this.token)}`;
      
      this.ws = new WebSocket(wsUrl);
      this.setStatus('connecting');

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = (event) => {
        this.handleError(new Error('WebSocket error'));
      };
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  private handleOpen() {
    console.log('WebSocket connected');
    this.setStatus('connected');
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;
    
    // Start ping timer
    this.startPingTimer();
  }

  private handleMessage(event: MessageEvent) {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      
      // Handle pong responses
      if (message.type === 'pong') {
        return;
      }
      
      this.eventHandlers.onMessage?.(message);
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
      this.eventHandlers.onError?.(error as Error);
    }
  }

  private handleClose(event: CloseEvent) {
    console.log('WebSocket closed:', event.code, event.reason);
    this.setStatus('disconnected');
    this.stopPingTimer();
    
    // Attempt to reconnect if not a normal closure
    if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.scheduleReconnect();
    }
  }

  private handleError(error: Error) {
    console.error('WebSocket error:', error);
    this.setStatus('error');
    this.eventHandlers.onError?.(error);
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), this.maxReconnectDelay);
    
    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    this.reconnectTimer = setTimeout(() => {
      this.establishConnection();
    }, delay);
  }

  private startPingTimer() {
    this.stopPingTimer();
    
    this.pingTimer = setInterval(() => {
      this.sendPing();
    }, 30000); // Ping every 30 seconds
  }

  private stopPingTimer() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private sendPing() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const pingMessage: WebSocketMessage = {
        type: 'ping',
        payload: { timestamp: Date.now() },
      };
      
      this.send(pingMessage);
    }
  }

  send(message: WebSocketMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected. Cannot send message:', message);
    }
  }

  private setStatus(status: WebSocketStatus) {
    if (this.status !== status) {
      this.status = status;
      this.eventHandlers.onStatusChange?.(status);
    }
  }

  getStatus(): WebSocketStatus {
    return this.status;
  }

  disconnect() {
    this.stopPingTimer();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.setStatus('disconnected');
  }

  // Public methods for sending specific message types
  sendMessageReceived(messageId: string) {
    this.send({
      type: 'message_received',
      payload: { message_id: messageId },
    });
  }

  sendMessageDelivered(messageId: string) {
    this.send({
      type: 'message_delivered',
      payload: { message_id: messageId },
    });
  }

  sendMessageRead(messageId: string) {
    this.send({
      type: 'message_read',
      payload: { message_id: messageId },
    });
  }
}

export const webSocketService = new WebSocketService();
