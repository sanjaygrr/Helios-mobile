class WebSocketService {
    private socket: WebSocket | null = null;
    private url: string = 'wss://backend-production-0413.up.railway.app/ws/tracking/';

    connect() {
        this.socket = new WebSocket(this.url);

        this.socket.onopen = () => {
            console.log('Connected to WebSocket');
        };

        this.socket.onmessage = (e) => {
            console.log('Message received:', e.data);
        };

        this.socket.onerror = (e) => {
            console.log('WebSocket error:', e);
        };

        this.socket.onclose = (e) => {
            console.log('WebSocket closed:', e.code, e.reason);
        };
    }

    sendLocation(lat: number, lon: number) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                message: { lat, lon }
            }));
        }
    }
}

export default new WebSocketService();
