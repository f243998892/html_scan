/**
 * 统一Service Worker - 整合缓存和推送功能
 * 适用于：生产扫描系统 PWA
 * 
 * 🔥 重要：每次更新前端代码时，必须更新 CACHE_VERSION！
 */

const CACHE_VERSION = 'v3.12'; // ← 每次更新都要改这个版本号
const CACHE_NAME = `app-cache-${CACHE_VERSION}`;
const MODEL_CACHE_NAME = `face-models-${CACHE_VERSION}`;
const ICON_CACHE_NAME = `icons-${CACHE_VERSION}`;

// 推送通知配置
const NOTIFICATION_CONFIG = {
    badge: '/icons/icon-192x192.png',
    icon: '/icons/icon-192x192.png',
    vibrate: [200, 100, 200],
    requireInteraction: false,
    tag: 'default-notification'
};

console.log(`[Service Worker ${CACHE_VERSION}] 初始化...`);

// ====================================================================
// 需要缓存的资源列表
// ====================================================================

// 核心静态资源（CSS/JS/图标）
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/stamping.html',
    '/css/bootstrap.min.css',
    '/css/bootstrap-icons.css',
    '/css/style.css',
    '/css/mobile-optimize.css',
    '/js/bootstrap/bootstrap.bundle.min.js',
    '/js/app-new.js',
    '/js/html5-qrcode.min.js',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png'
];

// 人脸识别模型文件（大文件，永久缓存）
const MODEL_FILES = [
    '/models/tiny_face_detector_model-weights_manifest.json',
    '/models/tiny_face_detector_model-shard1',
    '/models/face_landmark_68_model-weights_manifest.json',
    '/models/face_landmark_68_model-shard1',
    '/models/face_recognition_model-weights_manifest.json',
    '/models/face_recognition_model-shard1'
];

// ====================================================================
// 安装事件：预缓存关键资源
// ====================================================================

self.addEventListener('install', event => {
    console.log(`[SW ${CACHE_VERSION}] 开始安装...`);
    
    // 跳过等待，立即激活新版本
    self.skipWaiting();
    
    event.waitUntil(
        Promise.all([
            // 1. 缓存静态资源
            caches.open(CACHE_NAME).then(cache => {
                console.log(`[SW ${CACHE_VERSION}] 缓存静态资源...`);
                return cache.addAll(STATIC_ASSETS).catch(err => {
                    console.warn(`[SW ${CACHE_VERSION}] 部分静态资源缓存失败:`, err);
                });
            }),
            
            // 2. 缓存模型文件（独立缓存空间）
            caches.open(MODEL_CACHE_NAME).then(cache => {
                console.log(`[SW ${CACHE_VERSION}] 缓存模型文件...`);
                return cache.addAll(MODEL_FILES).catch(err => {
                    console.warn(`[SW ${CACHE_VERSION}] 部分模型文件缓存失败:`, err);
                });
            }),
            
            // 3. 缓存图标
            caches.open(ICON_CACHE_NAME).then(cache => {
                console.log(`[SW ${CACHE_VERSION}] 缓存图标...`);
                return cache.addAll([
                    '/icons/icon-192x192.png',
                    '/icons/icon-512x512.png'
                ]).catch(err => {
                    console.warn(`[SW ${CACHE_VERSION}] 图标缓存失败:`, err);
                });
            })
        ]).then(() => {
            console.log(`[SW ${CACHE_VERSION}] ✅ 安装完成`);
        })
    );
});

// ====================================================================
// 激活事件：清理旧缓存
// ====================================================================

self.addEventListener('activate', event => {
    console.log(`[SW ${CACHE_VERSION}] 开始激活...`);
    
    event.waitUntil(
        Promise.all([
            // 清理旧版本缓存
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(name => {
                            // 删除所有旧版本的缓存
                            return (name.startsWith('app-cache-') && name !== CACHE_NAME) ||
                                   (name.startsWith('face-models-') && name !== MODEL_CACHE_NAME) ||
                                   (name.startsWith('icons-') && name !== ICON_CACHE_NAME) ||
                                   name.startsWith('push-sw-'); // 删除旧的推送SW缓存
                        })
                        .map(name => {
                            console.log(`[SW ${CACHE_VERSION}] 删除旧缓存: ${name}`);
                            return caches.delete(name);
                        })
                );
            }),
            
            // 立即接管所有客户端
            self.clients.claim()
        ]).then(() => {
            console.log(`[SW ${CACHE_VERSION}] ✅ 激活完成`);
        })
    );
});

// ====================================================================
// Fetch事件：智能缓存策略
// ====================================================================

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    const request = event.request;
    
    // 只处理同源请求
    if (url.origin !== location.origin) {
        return;
    }
    
    // API请求：网络优先，不缓存（确保实时数据）
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(request).catch(() => {
                // 网络失败时，返回离线提示
                return new Response(
                    JSON.stringify({ error: '网络连接失败，请检查网络' }),
                    {
                        status: 503,
                        headers: { 'Content-Type': 'application/json' }
                    }
                );
            })
        );
        return;
    }
    
    // 模型文件：缓存优先（大文件，很少更新）
    if (url.pathname.startsWith('/models/')) {
        event.respondWith(
            caches.open(MODEL_CACHE_NAME).then(cache => {
                return cache.match(request).then(cachedResponse => {
                    if (cachedResponse) {
                        // 缓存命中，立即返回
                        return cachedResponse;
                    }
                    
                    // 缓存未命中，从网络获取并缓存
                    return fetch(request).then(networkResponse => {
                        if (networkResponse && networkResponse.status === 200) {
                            cache.put(request, networkResponse.clone());
                        }
                        return networkResponse;
                    });
                });
            })
        );
        return;
    }
    
    // 图标文件：缓存优先
    if (url.pathname.startsWith('/icons/')) {
        event.respondWith(
            caches.open(ICON_CACHE_NAME).then(cache => {
                return cache.match(request).then(cachedResponse => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    
                    return fetch(request).then(networkResponse => {
                        if (networkResponse && networkResponse.status === 200) {
                            cache.put(request, networkResponse.clone());
                        }
                        return networkResponse;
                    });
                });
            })
        );
        return;
    }
    
    // HTML页面：网络优先，失败时返回离线页面
    if (request.destination === 'document' || request.headers.get('accept').includes('text/html')) {
        event.respondWith(
            fetch(request)
                .then(networkResponse => {
                    // 网络成功，更新缓存
                    if (networkResponse && networkResponse.status === 200) {
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(request, networkResponse.clone());
                        });
                    }
                    return networkResponse;
                })
                .catch(() => {
                    // 网络失败，尝试从缓存获取
                    return caches.match(request).then(cachedResponse => {
                        if (cachedResponse) {
                            return cachedResponse;
                        }
                        // 缓存也没有，返回离线页面
                        return caches.match('/offline.html') || new Response('离线模式', {
                            status: 503,
                            headers: { 'Content-Type': 'text/html' }
                        });
                    });
                })
        );
        return;
    }
    
    // 静态资源（CSS/JS）：缓存优先，网络更新
    event.respondWith(
        caches.open(CACHE_NAME).then(cache => {
            return cache.match(request).then(cachedResponse => {
                // 缓存命中，立即返回，同时在后台更新
                if (cachedResponse) {
                    // 后台更新缓存
                    fetch(request).then(networkResponse => {
                        if (networkResponse && networkResponse.status === 200) {
                            cache.put(request, networkResponse.clone());
                        }
                    }).catch(() => {
                        // 网络更新失败，忽略（使用缓存）
                    });
                    
                    return cachedResponse;
                }
                
                // 缓存未命中，从网络获取
                return fetch(request).then(networkResponse => {
                    if (networkResponse && networkResponse.status === 200) {
                        cache.put(request, networkResponse.clone());
                    }
                    return networkResponse;
                });
            });
        })
    );
});

// ====================================================================
// Push事件：接收推送通知
// ====================================================================

self.addEventListener('push', event => {
    console.log('[SW] 收到推送:', event);
    
    let notification = {
        title: '新消息',
        body: '您有一条新消息',
        ...NOTIFICATION_CONFIG
    };
    
    // 解析推送数据
    if (event.data) {
        try {
            const data = event.data.json();
            console.log('[SW] 推送数据:', data);
            
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
            console.error('[SW] 解析推送数据失败:', err);
            try {
                const textData = event.data.text();
                if (textData) {
                    notification.body = textData;
                }
            } catch (textErr) {
                console.error('[SW] 文本解析失败:', textErr);
            }
        }
    }
    
    // 显示通知
    event.waitUntil(
        self.registration.showNotification(notification.title, notification)
            .then(() => {
                console.log('[SW] 通知已显示');
            })
            .catch(err => {
                console.error('[SW] 显示通知失败:', err);
            })
    );
});

// ====================================================================
// 通知点击事件
// ====================================================================

self.addEventListener('notificationclick', event => {
    console.log('[SW] 通知被点击:', event.notification.tag);
    
    event.notification.close();
    
    const notificationData = event.notification.data || {};
    const targetUrl = notificationData.url || '/';
    
    // 处理action按钮点击
    if (event.action === 'view') {
        console.log('[SW] 用户点击"查看详情"');
    }
    
    // 打开或聚焦到目标页面
    event.waitUntil(
        clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        }).then(clientList => {
            // 查找已打开的窗口
            for (let client of clientList) {
                if (client.url.includes(targetUrl) && 'focus' in client) {
                    console.log('[SW] 聚焦到已打开的页面');
                    return client.focus();
                }
            }
            
            // 没有找到，打开新窗口
            if (clients.openWindow) {
                console.log('[SW] 打开新页面:', targetUrl);
                return clients.openWindow(targetUrl);
            }
        }).catch(err => {
            console.error('[SW] 打开页面失败:', err);
        })
    );
});

// ====================================================================
// 通知关闭事件
// ====================================================================

self.addEventListener('notificationclose', event => {
    console.log('[SW] 通知被关闭:', event.notification.tag);
});

// ====================================================================
// 消息事件：接收来自页面的消息
// ====================================================================

self.addEventListener('message', event => {
    console.log('[SW] 收到消息:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log('[SW] 强制更新');
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({
            version: CACHE_VERSION,
            cacheName: CACHE_NAME
        });
    }
    
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(name => caches.delete(name))
                );
            }).then(() => {
                console.log('[SW] 所有缓存已清除');
                event.ports[0].postMessage({ success: true });
            })
        );
    }
});

// ====================================================================
// 错误处理
// ====================================================================

self.addEventListener('error', event => {
    console.error('[SW] 错误:', event.error);
});

self.addEventListener('unhandledrejection', event => {
    console.error('[SW] 未处理的Promise拒绝:', event.reason);
});

console.log(`[SW ${CACHE_VERSION}] ✅ 初始化完成`);

