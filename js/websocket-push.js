/**
 * WebSocket推送客户端
 * 提供实时推送通知功能
 */

const WebSocketPush = (function() {
    'use strict';
    
    const config = {
        socketUrl: window.location.origin,  // 使用当前域名
        reconnectDelay: 3000,  // 重连延迟（毫秒）
        maxReconnectAttempts: 10  // 最大重连次数
    };
    
    let socket = null;
    let currentUser = null;
    let isConnected = false;
    let reconnectAttempts = 0;
    let reconnectTimer = null;
    
    /**
     * 初始化WebSocket连接
     */
    function init(userName) {
        console.log('[WebSocketPush] 初始化...', userName);
        currentUser = userName;
        
        // 如果已连接，先断开
        if (socket) {
            disconnect();
        }
        
        connect();
    }
    
    /**
     * 连接WebSocket
     */
    function connect() {
        try {
            console.log('[WebSocketPush] 连接到:', config.socketUrl);
            
            // 加载Socket.IO客户端（从CDN）
            if (typeof io === 'undefined') {
                console.error('[WebSocketPush] Socket.IO客户端未加载');
                loadSocketIO(() => {
                    connectSocket();
                });
                return;
            }
            
            connectSocket();
            
        } catch (error) {
            console.error('[WebSocketPush] 连接失败:', error);
            scheduleReconnect();
        }
    }
    
    /**
     * 加载Socket.IO客户端
     */
    function loadSocketIO(callback) {
        const script = document.createElement('script');
        script.src = 'https://cdn.socket.io/4.5.4/socket.io.min.js';
        script.onload = callback;
        script.onerror = () => {
            console.error('[WebSocketPush] 无法加载Socket.IO客户端');
        };
        document.head.appendChild(script);
    }
    
    /**
     * 建立Socket连接
     */
    function connectSocket() {
        socket = io(config.socketUrl, {
            path: '/socket.io',
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: config.reconnectDelay,
            reconnectionAttempts: config.maxReconnectAttempts
        });
        
        // 连接成功
        socket.on('connect', () => {
            console.log('[WebSocketPush] ✅ 连接成功, sid:', socket.id);
            isConnected = true;
            reconnectAttempts = 0;
            
            // 注册用户
            if (currentUser) {
                register(currentUser);
            }
        });
        
        // 连接断开
        socket.on('disconnect', (reason) => {
            console.log('[WebSocketPush] ❌ 连接断开:', reason);
            isConnected = false;
            
            if (reason === 'io server disconnect') {
                // 服务器主动断开，尝试重连
                scheduleReconnect();
            }
        });
        
        // 注册成功
        socket.on('registered', (data) => {
            console.log('[WebSocketPush] ✅ 注册成功:', data);
        });
        
        // 接收通知
        socket.on('notification', (data) => {
            console.log('[WebSocketPush] 📨 收到通知:', data);
            showNotification(data);
        });
        
        // 连接错误
        socket.on('connect_error', (error) => {
            console.error('[WebSocketPush] ❌ 连接错误:', error);
            scheduleReconnect();
        });
        
        // 心跳回应（静默模式，不输出日志）
        socket.on('pong', () => {
            // 心跳正常，静默处理
        });
    }
    
    /**
     * 注册用户
     */
    function register(userName) {
        if (!socket || !isConnected) {
            console.warn('[WebSocketPush] 未连接，无法注册');
            return false;
        }
        
        console.log('[WebSocketPush] 注册用户:', userName);
        socket.emit('register', { user_name: userName });
        return true;
    }
    
    /**
     * 断开连接
     */
    function disconnect() {
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        
        if (socket) {
            socket.disconnect();
            socket = null;
        }
        
        isConnected = false;
        console.log('[WebSocketPush] 已断开连接');
    }
    
    /**
     * 计划重连
     */
    function scheduleReconnect() {
        if (reconnectAttempts >= config.maxReconnectAttempts) {
            console.error('[WebSocketPush] 达到最大重连次数，停止重连');
            return;
        }
        
        if (reconnectTimer) {
            return;  // 已经在重连中
        }
        
        reconnectAttempts++;
        console.log(`[WebSocketPush] 将在 ${config.reconnectDelay}ms 后重连 (${reconnectAttempts}/${config.maxReconnectAttempts})`);
        
        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connect();
        }, config.reconnectDelay);
    }
    
    /**
     * 显示通知
     */
    function showNotification(data) {
        // 检查通知权限
        if (Notification.permission !== 'granted') {
            console.warn('[WebSocketPush] 没有通知权限');
            return;
        }
        
        const title = data.title || '新消息';
        const options = {
            body: data.body || '',
            icon: data.icon || '/icons/icon-192x192.png',
            badge: data.badge || '/icons/icon-192x192.png',
            tag: data.tag || 'websocket-notification',
            requireInteraction: data.requireInteraction || false,
            data: data
        };
        
        const notification = new Notification(title, options);
        
        notification.onclick = function() {
            console.log('[WebSocketPush] 用户点击了通知');
            window.focus();
            notification.close();
            
            if (data.url) {
                window.location.href = data.url;
            }
        };
        
        // 3秒后自动关闭
        setTimeout(() => {
            notification.close();
        }, 3000);
    }
    
    /**
     * 发送心跳
     */
    function sendHeartbeat() {
        if (socket && isConnected) {
            socket.emit('ping');
        }
    }
    
    /**
     * 获取连接状态
     */
    function getStatus() {
        return {
            connected: isConnected,
            user: currentUser,
            reconnectAttempts: reconnectAttempts
        };
    }
    
    /**
     * 请求通知权限
     */
    async function requestPermission() {
        if (!('Notification' in window)) {
            console.error('[WebSocketPush] 浏览器不支持通知');
            return false;
        }
        
        if (Notification.permission === 'granted') {
            return true;
        }
        
        if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        }
        
        return false;
    }
    
    // 定时心跳（每30秒）
    setInterval(() => {
        sendHeartbeat();
    }, 30000);
    
    // 暴露公共API
    return {
        init: init,
        disconnect: disconnect,
        getStatus: getStatus,
        requestPermission: requestPermission,
        isConnected: () => isConnected
    };
})();

// 暴露到全局
window.WebSocketPush = WebSocketPush;

console.log('[WebSocketPush] 📦 模块已加载');
