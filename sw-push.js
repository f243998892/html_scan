/**
 * Service Worker for Web Push Notifications
 * 专注于推送通知功能，采用保守的缓存策略
 */

const SW_VERSION = 'v1.0.1';
const CACHE_NAME = `push-sw-${SW_VERSION}`;

// 推送通知配置
const NOTIFICATION_CONFIG = {
    badge: '/icons/icon-192x192.png',  // 使用现有图标
    icon: '/icons/icon-192x192.png',
    vibrate: [200, 100, 200],
    requireInteraction: false,
    tag: 'default-notification'
};

console.log(`[Service Worker] 版本: ${SW_VERSION}`);

// ====================================================================
// 安装事件
// ====================================================================

self.addEventListener('install', event => {
    console.log('[Service Worker] 安装中...');
    
    // 跳过等待，立即激活
    self.skipWaiting();
    
    event.waitUntil(
        // 预缓存关键资源（可选，这里只缓存图标）
        caches.open(CACHE_NAME).then(cache => {
            console.log('[Service Worker] 预缓存图标');
            return cache.addAll([
                '/icons/icon-192x192.png',
                '/icons/badge-72x72.png'
            ]).catch(err => {
                // 图标缓存失败不影响SW安装
                console.warn('[Service Worker] 预缓存失败（不影响功能）:', err);
            });
        })
    );
});

// ====================================================================
// 激活事件
// ====================================================================

self.addEventListener('activate', event => {
    console.log('[Service Worker] 激活中...');
    
    event.waitUntil(
        Promise.all([
            // 清理旧缓存
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(name => name.startsWith('push-sw-') && name !== CACHE_NAME)
                        .map(name => {
                            console.log('[Service Worker] 删除旧缓存:', name);
                            return caches.delete(name);
                        })
                );
            }),
            // 立即接管所有客户端
            self.clients.claim()
        ]).then(() => {
            console.log('[Service Worker] 已激活并接管页面');
        })
    );
});

// ====================================================================
// Fetch事件 - 网络优先策略（不干预正常请求，确保及时更新）
// ====================================================================

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // 只处理图标请求，其他一律走网络（确保程序及时更新）
    if (url.pathname.includes('/icons/')) {
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                // 优先返回缓存，同时发起网络请求更新
                const fetchPromise = fetch(event.request).then(response => {
                    if (response && response.status === 200) {
                        // 更新缓存
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, response.clone());
                        });
                    }
                    return response;
                });
                
                return cachedResponse || fetchPromise;
            })
        );
    } else {
        // 其他请求直接走网络，不缓存（确保HTML/JS/CSS及时更新）
        return;
    }
});

// ====================================================================
// Push事件 - 接收推送通知
// ====================================================================

self.addEventListener('push', event => {
    console.log('[Service Worker] 收到推送:', event);
    
    let notification = {
        title: '新消息',
        body: '您有一条新消息',
        ...NOTIFICATION_CONFIG
    };
    
    // 解析推送数据
    if (event.data) {
        try {
            // 尝试解析JSON
            const data = event.data.json();
            console.log('[Service Worker] 推送数据:', data);
            
            notification = {
                title: data.title || notification.title,
                body: data.body || notification.body,
                icon: data.icon || notification.icon,
                badge: data.badge || notification.badge,
                tag: data.tag || `notification-${Date.now()}`,
                data: data.data || {},
                actions: data.actions || [],
                requireInteraction: data.requireInteraction !== undefined ? 
                    data.requireInteraction : false,
                vibrate: data.vibrate || notification.vibrate,
                timestamp: data.timestamp || Date.now()
            };
        } catch (err) {
            console.error('[Service Worker] 解析推送数据失败:', err);
            // 降级：尝试解析为文本
            try {
                const textData = event.data.text();
                console.log('[Service Worker] 使用文本数据:', textData);
                if (textData) {
                    notification.body = textData;
                }
            } catch (textErr) {
                console.error('[Service Worker] 文本解析也失败:', textErr);
            }
        }
    }
    
    // 显示通知
    event.waitUntil(
        self.registration.showNotification(notification.title, notification)
            .then(() => {
                console.log('[Service Worker] 通知已显示');
            })
            .catch(err => {
                console.error('[Service Worker] 显示通知失败:', err);
            })
    );
});

// ====================================================================
// 通知点击事件
// ====================================================================

self.addEventListener('notificationclick', event => {
    console.log('[Service Worker] 通知被点击:', event.notification.tag);
    
    event.notification.close();
    
    // 获取通知数据
    const notificationData = event.notification.data || {};
    const targetUrl = notificationData.url || '/';
    
    // 处理action按钮点击
    if (event.action === 'view') {
        console.log('[Service Worker] 用户点击"查看详情"');
    }
    
    // 打开或聚焦到目标页面
    event.waitUntil(
        clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        }).then(clientList => {
            // 查找已打开的窗口
            for (let client of clientList) {
                if (client.url === new URL(targetUrl, self.location.origin).href && 'focus' in client) {
                    console.log('[Service Worker] 聚焦到已打开的页面');
                    return client.focus();
                }
            }
            
            // 没有找到，打开新窗口
            if (clients.openWindow) {
                console.log('[Service Worker] 打开新页面');
                return clients.openWindow(targetUrl);
            }
        }).catch(err => {
            console.error('[Service Worker] 打开页面失败:', err);
        })
    );
});

// ====================================================================
// 通知关闭事件
// ====================================================================

self.addEventListener('notificationclose', event => {
    console.log('[Service Worker] 通知被关闭:', event.notification.tag);
    
    // 可以在这里记录通知关闭事件（用于统计）
});

// ====================================================================
// 消息事件 - 接收来自页面的消息
// ====================================================================

self.addEventListener('message', event => {
    console.log('[Service Worker] 收到消息:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        // 强制更新
        console.log('[Service Worker] 强制更新');
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'GET_VERSION') {
        // 返回版本信息
        event.ports[0].postMessage({
            version: SW_VERSION,
            cacheName: CACHE_NAME
        });
    }
    
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        // 清除所有缓存
        event.waitUntil(
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(name => caches.delete(name))
                );
            }).then(() => {
                console.log('[Service Worker] 所有缓存已清除');
                event.ports[0].postMessage({ success: true });
            })
        );
    }
});

// ====================================================================
// 错误处理
// ====================================================================

self.addEventListener('error', event => {
    console.error('[Service Worker] 错误:', event.error);
});

self.addEventListener('unhandledrejection', event => {
    console.error('[Service Worker] 未处理的Promise拒绝:', event.reason);
});

console.log('[Service Worker] 初始化完成');
