# Service Worker 更新策略详解

## 问题：前端代码更新，客户端如何及时更新？

### ❌ 如果不处理会发生什么？

```
场景：
1. 您发布了新版本（修改了app-new.js）
2. 用户打开网站
3. Service Worker返回缓存的旧版本app-new.js
4. 用户看到的是旧功能/旧bug

结果：用户必须手动清除网站数据才能看到新版本！
```

---

## ✅ 解决方案对比

### 方案A：不使用Service Worker（当前状态）
```
优点：
  ✅ 每次都加载最新代码
  ✅ 不需要管理缓存版本

缺点：
  ❌ 模型文件每次清除缓存都要重新下载
  ❌ 网络慢时加载慢
  ❌ 无法离线使用
```

### 方案B：Service Worker + 版本号机制（推荐）
```
优点：
  ✅ 模型文件永久缓存（清除浏览器缓存不影响）
  ✅ 加载速度快
  ✅ 可以离线使用
  ✅ 自动检测更新并提示用户

缺点：
  ⚠️ 需要管理版本号
  ⚠️ 更新需要刷新两次（第一次安装新SW，第二次应用）
```

### 方案C：分离缓存策略（最佳）
```
策略：
  - 模型文件：Service Worker缓存（永久）
  - 业务代码：HTTP缓存 + 版本号参数（正常更新）

优点：
  ✅ 模型文件永久缓存
  ✅ 业务代码正常更新（像现在一样）
  ✅ 两全其美

实现：
  Service Worker只缓存 /models/* 路径
  其他资源按原来的方式加载
```

---

## 🎯 推荐实施：方案C（分离缓存）

### 实现代码

```javascript
// service-worker.js（简化版）
const MODEL_CACHE = 'face-models-v1';

// 只预缓存模型文件
const modelFiles = [
  '/models/tiny_face_detector_model-weights_manifest.json',
  '/models/tiny_face_detector_model-shard1',
  '/models/face_landmark_68_model-weights_manifest.json',
  '/models/face_landmark_68_model-shard1',
  '/models/face_recognition_model-weights_manifest.json',
  '/models/face_recognition_model-shard1',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(MODEL_CACHE).then((cache) => {
      return cache.addAll(modelFiles);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // 只拦截模型文件请求
  if (url.pathname.startsWith('/models/')) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
    );
  }
  // 其他请求正常通过，不缓存
});
```

### 业务代码更新方式（保持现有）

```html
<!-- index.html -->
<!-- 使用版本号参数强制更新 -->
<script src="js/app-new.js?v=3.11&t=202511161027"></script>

<!-- 修改代码后，更新版本号： -->
<script src="js/app-new.js?v=3.12&t=202511161115"></script>
```

---

## 📊 三种方案对比表

| 特性 | 方案A<br>无SW | 方案B<br>全缓存SW | 方案C<br>分离缓存 |
|------|--------------|------------------|-----------------|
| 模型加载速度（首次） | 2-3秒 | 2-3秒 | 2-3秒 |
| 模型加载速度（缓存后） | 50-100ms<br>清缓存后重下 | <10ms<br>**永久缓存** | <10ms<br>**永久缓存** |
| 业务代码更新 | ✅ 即时 | ⚠️ 需管理版本 | ✅ 即时 |
| 清除浏览器缓存影响 | 模型重下 | 不影响 | 不影响 |
| 离线可用 | ❌ | ✅ | 部分✅ |
| 复杂度 | 简单 | 复杂 | 中等 |
| **推荐程度** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

---

## 🔧 实际更新流程演示

### 方案C的更新流程

```
【初始安装】
1. 用户首次访问网站
2. Service Worker安装，缓存模型文件到CacheStorage
3. 业务代码通过HTTP缓存加载
4. 完成

【日常使用】
1. 用户打开网站
2. 模型文件从CacheStorage加载（<10ms）
3. 业务代码从HTTP缓存加载（50-100ms）
4. 完成

【您发布新版本】
1. 修改app-new.js代码
2. 更新index.html中的版本号：
   <script src="js/app-new.js?v=3.12&t=新时间戳">
3. 部署到服务器
4. 用户刷新页面
5. ✅ 浏览器发现URL变化（版本号变了）
6. ✅ 自动下载新版本app-new.js
7. ✅ 用户立即看到新功能
8. 模型文件仍然从CacheStorage加载（不重新下载）

【用户清除浏览器缓存】
1. 用户点击"清除缓存的图片和文件"
2. HTTP缓存被清除
3. CacheStorage保留（模型文件不丢失）
4. 下次访问：
   - 模型文件：<10ms（从CacheStorage）
   - 业务代码：重新下载（但只下载一次）
```

---

## 🎯 最终建议

### 如果追求简单（推荐初期）
**不使用Service Worker**
- 依赖HTTP缓存和nginx配置
- 用户偶尔需要清缓存重新下载模型（2-3秒）
- 代码更新即时生效

### 如果追求体验（推荐长期）
**使用方案C：分离缓存**
- Service Worker只缓存模型文件
- 业务代码正常更新（版本号机制）
- 模型永久缓存，业务代码即时更新
- 最佳体验

### 实施步骤
```
阶段1：先实现人脸识别功能（不用SW）
  ↓
阶段2：功能稳定后，添加SW缓存模型
  ↓
阶段3：根据反馈优化缓存策略
```

---

## 🛠️ 调试工具

### Chrome DevTools检查缓存

```
1. 打开 F12
2. Application标签
3. 查看：
   - Cache Storage → face-models-v1（SW缓存）
   - Cache → https://www.saby.uno（HTTP缓存）
4. 可以手动删除测试
```

### 强制更新命令

```javascript
// 在控制台执行：

// 1. 检查SW状态
navigator.serviceWorker.getRegistration().then(console.log);

// 2. 手动更新SW
navigator.serviceWorker.getRegistration().then(reg => reg.update());

// 3. 清除所有缓存
caches.keys().then(names => Promise.all(names.map(n => caches.delete(n))));

// 4. 注销SW
navigator.serviceWorker.getRegistration().then(reg => reg.unregister());
```

### 测试不同缓存策略

```bash
# nginx配置测试长期缓存
location /models/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# 验证：
curl -I https://www.saby.uno/models/tiny_face_detector_model-shard1
# 查看 Cache-Control 响应头
```

---

## ❓ 常见问题

### Q1: 我修改了代码，用户看不到新版本怎么办？
A: 
- 方案C：更新index.html中的版本号参数
- 方案B：修改service-worker.js中的CACHE_VERSION
- 应急：提示用户按Ctrl+Shift+R强制刷新

### Q2: 用户清除网站数据后，模型会丢失吗？
A: 会的。但这是极少数情况，且只需重新下载一次

### Q3: Service Worker在iOS Safari上支持吗？
A: iOS 11.3+支持，您的HTTPS环境满足条件

### Q4: 如何回滚到旧版本？
A: 
- 方案C：修改版本号参数即可
- 方案B：修改CACHE_VERSION并重新部署service-worker.js

### Q5: 开发阶段如何禁用缓存？
A: Chrome DevTools → Application → Service Workers → 勾选"Bypass for network"
