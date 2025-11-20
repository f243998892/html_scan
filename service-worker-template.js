// Service Worker版本化管理模板

// 🔥 关键：每次更新前端代码时，修改这个版本号！
const CACHE_VERSION = 'v3.11'; // 对应index.html中的版本
const CACHE_NAME = `app-cache-${CACHE_VERSION}`;
const MODEL_CACHE_NAME = `face-models-${CACHE_VERSION}`;

// 需要缓存的资源列表
const urlsToCache = [
  '/',
  '/index.html',
  '/css/bootstrap.min.css',
  '/css/style.css',
  '/js/app-new.js',
  '/js/bootstrap/bootstrap.bundle.min.js',
  '/js/html5-qrcode.min.js',
  // 人脸识别相关
  '/js/face-api.min.js',
  '/js/face-recognition.js',
  // 模型文件（单独缓存策略）
  '/models/tiny_face_detector_model-weights_manifest.json',
  '/models/tiny_face_detector_model-shard1',
  '/models/face_landmark_68_model-weights_manifest.json',
  '/models/face_landmark_68_model-shard1',
  '/models/face_recognition_model-weights_manifest.json',
  '/models/face_recognition_model-shard1',
];

// 安装事件：缓存资源
self.addEventListener('install', (event) => {
  console.log(`[SW ${CACHE_VERSION}] 开始安装...`);
  
  event.waitUntil(
    Promise.all([
      // 缓存应用资源
      caches.open(CACHE_NAME).then((cache) => {
        console.log(`[SW ${CACHE_VERSION}] 缓存应用资源`);
        return cache.addAll(urlsToCache);
      }),
      // 缓存模型文件（独立缓存空间）
      caches.open(MODEL_CACHE_NAME).then((cache) => {
        console.log(`[SW ${CACHE_VERSION}] 缓存模型文件`);
        const modelUrls = urlsToCache.filter(url => url.startsWith('/models/'));
        return cache.addAll(modelUrls);
      })
    ]).then(() => {
      console.log(`[SW ${CACHE_VERSION}] 安装完成`);
      // 🔥 关键：立即激活新版本，不等待
      return self.skipWaiting();
    })
  );
});

// 激活事件：清理旧缓存
self.addEventListener('activate', (event) => {
  console.log(`[SW ${CACHE_VERSION}] 开始激活...`);
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // 保留当前版本的缓存，删除其他所有旧版本
          if (cacheName !== CACHE_NAME && cacheName !== MODEL_CACHE_NAME) {
            console.log(`[SW ${CACHE_VERSION}] 删除旧缓存: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log(`[SW ${CACHE_VERSION}] 激活完成`);
      // 🔥 关键：立即接管所有页面
      return self.clients.claim();
    })
  );
});

// 拦截请求：从缓存或网络获取
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // API请求：始终从网络获取（不缓存）
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // 静态资源：缓存优先策略
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        // 缓存命中
        return response;
      }
      
      // 缓存未命中，从网络获取
      return fetch(event.request).then((networkResponse) => {
        // 如果是有效响应，更新缓存
        if (networkResponse && networkResponse.status === 200) {
          const cacheName = url.pathname.startsWith('/models/') 
            ? MODEL_CACHE_NAME 
            : CACHE_NAME;
          
          caches.open(cacheName).then((cache) => {
            cache.put(event.request, networkResponse.clone());
          });
        }
        return networkResponse;
      });
    }).catch(() => {
      // 网络和缓存都失败，返回离线页面
      if (event.request.destination === 'document') {
        return caches.match('/offline.html');
      }
    })
  );
});

// 监听来自页面的消息
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    // 强制更新
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    // 返回当前版本
    event.ports[0].postMessage({ version: CACHE_VERSION });
  }
});
