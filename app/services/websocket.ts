class WebSocketService {
    private socket: WebSocket | null = null;
    private url: string = 'wss://backend-production-0413.up.railway.app/ws/tracking/';
    private listeners: ((data: any) => void)[] = [];
    private messageQueue: string[] = []; // Queue for messages while connecting

    connect() {
        if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
            return;
        }

        this.socket = new WebSocket(this.url);

        this.socket.onopen = () => {
            console.log('Connected to WebSocket');
            this.flushQueue();
        };

        this.socket.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);
                if (data.message) {
                    this.notifyListeners(data.message);
                }
            } catch (err) {
                console.error('Error parsing websocket message', err);
            }
        };

        this.socket.onerror = (e) => {
            console.log('WebSocket error:', e);
        };

        this.socket.onclose = (e) => {
            console.log('WebSocket closed:', e.code, e.reason);
            this.socket = null;
        };
    }

    private flushQueue() {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;

        while (this.messageQueue.length > 0) {
            const msg = this.messageQueue.shift();
            if (msg) {
                this.socket.send(msg);
            }
        }
    }

    sendLocation(lat: number, lon: number, userId?: number, role?: string) {
        const payload = JSON.stringify({
            message: {
                latitude: lat,
                longitude: lon,
                id: userId,
                role: role,
                timestamp: Date.now()
            }
        });

        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(payload);
        } else {
            // If not connected yet, queue the message
            // Only keep the LATEST location to avoid spamming old history if it takes too long
            // Actually for "just connected" we want the latest one mostly.
            // Let's clear previous queue to only send MOST RECENT location on connect
            this.messageQueue = [payload];

            // Ensure we are trying to connect
            if (!this.socket || this.socket.readyState === WebSocket.CLOSED) {
                this.connect();
            }
        }
    }

    subscribe(callback: (data: any) => void) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    private notifyListeners(data: any) {
        this.listeners.forEach(l => l(data));
    }
}

export default new WebSocketService();
