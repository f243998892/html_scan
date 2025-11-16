# Service Worker 缓存机制演示

## 测试步骤

### 测试1：普通清除缓存
```
1. 打开网站 https://www.saby.uno
2. Service Worker缓存了模型文件（5MB）
3. 按 Ctrl+Shift+Delete
4. 勾选"缓存的图片和文件"
5. 点击清除
6. 刷新页面

结果：✅ 模型文件仍然存在，加载速度<100ms
原因：CacheStorage未被清除
```

### 测试2：清除网站数据
```
1. 打开开发者工具 (F12)
2. Application标签 → Storage → Clear site data
3. 勾选所有选项
4. 点击Clear
5. 刷新页面

结果：❌ 模型文件被清除，需要重新下载2-3秒
原因：CacheStorage被清除
```

## 浏览器操作对应关系

| 操作 | HTTP缓存 | CacheStorage | LocalStorage | 结果 |
|------|---------|--------------|--------------|------|
| Ctrl+Shift+Del (缓存) | 清除 | **保留** | 保留 | SW缓存有效 |
| 清除Cookie和网站数据 | 清除 | **清除** | 清除 | SW缓存失效 |
| 隐身模式关闭 | 清除 | **清除** | 清除 | 全部清除 |
| 清除最近1小时数据 | 清除 | **保留** | 保留 | SW缓存有效 |
| 开发者工具Clear Storage | 清除 | **清除** | 清除 | SW缓存失效 |

## 验证方法

### Chrome DevTools查看
```
F12 → Application标签 → Cache Storage
└── face-models-v1
    ├── /models/tiny_face_detector_model-weights_manifest.json
    ├── /models/tiny_face_detector_model-shard1
    └── ...

如果看到文件列表 → SW缓存有效
如果是空的 → SW缓存已清除
```

### 代码验证
```javascript
// 检查缓存是否存在
async function checkCacheStatus() {
    const cacheNames = await caches.keys();
    console.log('现有缓存:', cacheNames);
    
    if (cacheNames.includes('face-models-v1')) {
        const cache = await caches.open('face-models-v1');
        const keys = await cache.keys();
        console.log('缓存文件数量:', keys.length);
        return true;
    }
    return false;
}
```
