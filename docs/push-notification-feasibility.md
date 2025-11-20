# 组长推送通知功能 - 可行性分析与实现方案

## 📋 需求分析

### 核心需求
1. **触发条件**: 小组员工完成任务后
2. **推送目标**: 该小组的组长手机
3. **控制功能**: 程序内可设置推送开关

### 现有基础
根据现有代码分析：
- ✅ 已有完整的组长管理系统
  - `groups` 表：小组信息
  - `group_leaders` 表：组长与小组关联
  - `product_group_assignments` 表：产品分配到小组
- ✅ 已有PWA配置 (manifest.json)
- ✅ 已有完整的扫码录入系统
- ✅ 已有用户登录和权限管理

---

## ✅ 可行性结论

**完全可以实现！** 

推荐采用 **Web Push API + 数据库存储推送配置** 的方案。

---

## 🎯 推荐技术方案

### 方案一：Web Push API（推荐）⭐

#### 优点
- ✅ 原生支持，无需第三方服务
- ✅ 免费，无额外成本
- ✅ 支持离线推送（即使浏览器关闭）
- ✅ 跨平台支持（Android、iOS、桌面）
- ✅ 用户体验好，系统级通知
- ✅ 隐私保护，订阅在本地

#### 工作原理
```
员工扫码 → 后端API → 检查组长订阅 → 发送Web Push
   ↓
组长手机收到系统通知
```

#### 技术栈
- **前端**: Service Worker + Push API
- **后端**: Python + pywebpush库
- **数据库**: 新增 `push_subscriptions` 表

---

### 方案二：轮询 + 应用内通知

#### 优点
- ✅ 实现简单
- ✅ 不需要Service Worker
- ✅ 兼容性好

#### 缺点
- ❌ 只在应用打开时有效
- ❌ 需要定时请求，消耗资源
- ❌ 不是系统级通知

---

### 方案三：第三方推送服务

#### 选项
1. **企业微信推送**
2. **邮件推送**
3. **短信推送**

#### 优缺点对比
| 方案 | 成本 | 实时性 | 到达率 | 实现难度 |
|------|------|--------|--------|----------|
| 企业微信 | 免费 | 高 | 高 | 中等 |
| 邮件 | 低 | 中 | 中 | 简单 |
| 短信 | 高 | 高 | 高 | 简单 |

---

## 🔧 推荐实现方案详解（Web Push API）

### 1. 数据库设计

#### 新增表：push_subscriptions（推送订阅表）
```sql
CREATE TABLE push_subscriptions (
    id SERIAL PRIMARY KEY,
    user_name VARCHAR(50) NOT NULL,           -- 用户姓名（组长）
    endpoint TEXT NOT NULL,                    -- Push服务端点
    p256dh TEXT NOT NULL,                      -- 加密密钥
    auth TEXT NOT NULL,                        -- 认证密钥
    subscription_data JSONB,                   -- 完整订阅数据
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(user_name, endpoint)
);

CREATE INDEX idx_push_subs_user ON push_subscriptions(user_name, is_active);
```

#### 新增表：push_settings（推送设置表）
```sql
CREATE TABLE push_settings (
    id SERIAL PRIMARY KEY,
    user_name VARCHAR(50) NOT NULL UNIQUE,     -- 用户姓名
    enable_push BOOLEAN DEFAULT TRUE,          -- 总开关
    enable_task_complete BOOLEAN DEFAULT TRUE, -- 任务完成通知
    enable_summary BOOLEAN DEFAULT FALSE,      -- 每日汇总通知
    quiet_start_hour INTEGER DEFAULT 22,       -- 免打扰开始时间
    quiet_end_hour INTEGER DEFAULT 8,          -- 免打扰结束时间
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 新增表：push_logs（推送日志表）
```sql
CREATE TABLE push_logs (
    id SERIAL PRIMARY KEY,
    user_name VARCHAR(50) NOT NULL,
    notification_type VARCHAR(50),             -- 通知类型
    title VARCHAR(200),
    message TEXT,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20),                        -- success/failed
    error_message TEXT
);

CREATE INDEX idx_push_logs_user_time ON push_logs(user_name, sent_at DESC);
```

---

### 2. 后端实现

#### 依赖安装
```bash
pip install pywebpush
```

#### API端点设计

**A. 订阅管理API**
```python
# 保存推送订阅
POST /api/push/subscribe
{
    "user_name": "张三",
    "subscription": {
        "endpoint": "https://...",
        "keys": {
            "p256dh": "...",
            "auth": "..."
        }
    }
}

# 取消订阅
POST /api/push/unsubscribe
{
    "user_name": "张三",
    "endpoint": "https://..."
}

# 获取订阅状态
GET /api/push/status?user_name=张三
```

**B. 推送设置API**
```python
# 获取推送设置
GET /api/push/settings?user_name=张三

# 更新推送设置
PUT /api/push/settings
{
    "user_name": "张三",
    "enable_push": true,
    "enable_task_complete": true,
    "quiet_start_hour": 22,
    "quiet_end_hour": 8
}
```

**C. 发送推送API**
```python
# 内部调用，当员工完成任务时触发
POST /api/push/send-task-complete
{
    "group_name": "绕线组",
    "employee_name": "李四",
    "product_model": "ABC-123",
    "quantity": 10
}
```

#### 核心代码示例

```python
# push_notification.py
from pywebpush import webpush, WebPushException
import json

class PushNotificationService:
    def __init__(self):
        # VAPID密钥（需要生成）
        self.vapid_private_key = "YOUR_PRIVATE_KEY"
        self.vapid_public_key = "YOUR_PUBLIC_KEY"
        self.vapid_claims = {
            "sub": "mailto:admin@yourdomain.com"
        }
    
    async def send_task_complete_notification(
        self, 
        group_name: str,
        employee_name: str,
        product_model: str,
        quantity: int
    ):
        """发送任务完成通知给组长"""
        
        # 1. 查询组长
        leaders = await self.get_group_leaders(group_name)
        
        for leader in leaders:
            # 2. 检查推送设置
            settings = await self.get_push_settings(leader['name'])
            if not settings or not settings['enable_push'] or not settings['enable_task_complete']:
                continue
            
            # 3. 检查免打扰时间
            if self.is_quiet_time(settings):
                continue
            
            # 4. 获取订阅信息
            subscriptions = await self.get_subscriptions(leader['name'])
            
            # 5. 构建通知内容
            notification = {
                "title": f"📦 {group_name} 新任务完成",
                "body": f"{employee_name} 完成了 {product_model} × {quantity}",
                "icon": "/icons/icon-192x192.png",
                "badge": "/icons/badge-72x72.png",
                "data": {
                    "url": "/",
                    "group_name": group_name,
                    "employee_name": employee_name
                },
                "actions": [
                    {
                        "action": "view",
                        "title": "查看详情"
                    }
                ]
            }
            
            # 6. 发送推送
            for sub in subscriptions:
                try:
                    webpush(
                        subscription_info=json.loads(sub['subscription_data']),
                        data=json.dumps(notification),
                        vapid_private_key=self.vapid_private_key,
                        vapid_claims=self.vapid_claims
                    )
                    
                    # 记录成功日志
                    await self.log_push(leader['name'], notification, 'success')
                    
                except WebPushException as e:
                    # 记录失败日志
                    await self.log_push(leader['name'], notification, 'failed', str(e))
                    
                    # 如果订阅已失效，删除它
                    if e.response.status_code == 410:
                        await self.remove_subscription(sub['id'])
    
    def is_quiet_time(self, settings):
        """检查是否在免打扰时间"""
        from datetime import datetime
        current_hour = datetime.now().hour
        
        start = settings['quiet_start_hour']
        end = settings['quiet_end_hour']
        
        if start < end:
            return start <= current_hour < end
        else:  # 跨天的情况，如22:00-08:00
            return current_hour >= start or current_hour < end
```

---

### 3. 前端实现

#### Service Worker (sw.js)

```javascript
// sw.js
self.addEventListener('push', function(event) {
    if (!event.data) return;
    
    const data = event.data.json();
    
    const options = {
        body: data.body,
        icon: data.icon || '/icons/icon-192x192.png',
        badge: data.badge || '/icons/badge-72x72.png',
        vibrate: [200, 100, 200],
        data: data.data,
        actions: data.actions || [],
        requireInteraction: true,
        tag: 'task-complete-' + Date.now()
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// 处理通知点击
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    
    if (event.action === 'view') {
        event.waitUntil(
            clients.openWindow(event.notification.data.url || '/')
        );
    }
});
```

#### 前端订阅代码

```javascript
// push-manager.js
class PushManager {
    constructor() {
        this.vapidPublicKey = 'YOUR_PUBLIC_KEY';
    }
    
    async subscribeToPush(userName) {
        try {
            // 1. 请求通知权限
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                throw new Error('未授予通知权限');
            }
            
            // 2. 注册Service Worker
            const registration = await navigator.serviceWorker.register('/sw.js');
            await navigator.serviceWorker.ready;
            
            // 3. 订阅Push
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey)
            });
            
            // 4. 发送订阅信息到后端
            const response = await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    user_name: userName,
                    subscription: subscription.toJSON()
                })
            });
            
            if (!response.ok) {
                throw new Error('订阅失败');
            }
            
            console.log('✅ 推送订阅成功');
            return true;
            
        } catch (error) {
            console.error('❌ 推送订阅失败:', error);
            return false;
        }
    }
    
    async unsubscribe(userName) {
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            
            if (subscription) {
                await subscription.unsubscribe();
                
                // 通知后端删除订阅
                await fetch('/api/push/unsubscribe', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        user_name: userName,
                        endpoint: subscription.endpoint
                    })
                });
            }
            
            console.log('✅ 已取消推送订阅');
            return true;
            
        } catch (error) {
            console.error('❌ 取消订阅失败:', error);
            return false;
        }
    }
    
    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');
        
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }
}

// 全局实例
window.pushManager = new PushManager();
```

#### 推送设置UI

```html
<!-- 在组长功能界面添加推送设置 -->
<div class="card mb-3">
    <div class="card-header">
        <h5>📲 推送通知设置</h5>
    </div>
    <div class="card-body">
        <!-- 总开关 -->
        <div class="form-check form-switch mb-3">
            <input class="form-check-input" type="checkbox" id="push-enable" checked>
            <label class="form-check-label" for="push-enable">
                <strong>启用推送通知</strong>
            </label>
        </div>
        
        <!-- 任务完成通知 -->
        <div class="form-check form-switch mb-3">
            <input class="form-check-input" type="checkbox" id="push-task-complete" checked>
            <label class="form-check-label" for="push-task-complete">
                员工完成任务时通知我
            </label>
        </div>
        
        <!-- 免打扰时间 -->
        <div class="row mb-3">
            <div class="col-6">
                <label class="form-label">免打扰开始时间</label>
                <input type="time" class="form-control" id="quiet-start" value="22:00">
            </div>
            <div class="col-6">
                <label class="form-label">免打扰结束时间</label>
                <input type="time" class="form-control" id="quiet-end" value="08:00">
            </div>
        </div>
        
        <button class="btn btn-primary" id="save-push-settings">保存设置</button>
        <button class="btn btn-outline-secondary" id="test-push">发送测试通知</button>
    </div>
</div>
```

---

### 4. 触发推送的时机

修改扫码录入API，当员工完成扫码后触发：

```python
# 在 main.py 的扫码接口中添加
@app.post("/api/scan-code-secure")
async def scan_code_secure_endpoint(request: ScanRequest):
    # ... 现有的扫码逻辑 ...
    
    # 扫码成功后，触发推送通知
    if result.get('status') == 'success':
        # 查询该产品分配到哪个小组
        group_info = await get_product_group_assignment(
            product_model=request.product_model,
            process_name=request.process_name
        )
        
        if group_info:
            # 发送推送通知给组长
            await push_service.send_task_complete_notification(
                group_name=group_info['group_name'],
                employee_name=request.full_name,
                product_model=request.product_model,
                quantity=1  # 或从request中获取数量
            )
    
    return result
```

---

## 📱 用户使用流程

### 组长首次使用

1. **登录系统**（使用组长姓名）
2. **进入组长功能**
3. **点击"推送设置"**
4. **开启推送通知** → 浏览器弹出权限请求
5. **允许通知** → 订阅成功
6. **配置推送选项**（任务完成通知、免打扰时间等）
7. **保存设置**

### 日常使用

员工扫码完成任务 → 组长手机收到通知 → 点击查看详情

---

## 🔐 安全性考虑

1. **订阅验证**: 只有登录用户才能订阅推送
2. **权限检查**: 只推送给该小组的组长
3. **数据加密**: 使用VAPID密钥加密推送内容
4. **防刷保护**: 限制推送频率，避免骚扰
5. **隐私保护**: 推送订阅信息只存储endpoint，不包含个人信息

---

## 💰 成本分析

| 方案 | 开发成本 | 运维成本 | 第三方费用 |
|------|---------|---------|-----------|
| Web Push API | 中 | 低 | 免费 |
| 轮询通知 | 低 | 中 | 免费 |
| 企业微信 | 中 | 低 | 免费 |
| 短信推送 | 低 | 低 | 0.05元/条 |

**推荐**: Web Push API（免费且功能完善）

---

## 📊 实施计划

### 阶段一：基础功能（1-2天）
- [ ] 数据库表设计和创建
- [ ] 后端API开发（订阅、设置、发送）
- [ ] VAPID密钥生成
- [ ] Service Worker实现

### 阶段二：前端集成（1天）
- [ ] 推送管理器实现
- [ ] 推送设置UI开发
- [ ] 订阅流程集成

### 阶段三：触发集成（0.5天）
- [ ] 修改扫码API，集成推送触发
- [ ] 测试推送流程

### 阶段四：测试优化（0.5天）
- [ ] 多设备测试
- [ ] 推送到达率测试
- [ ] 性能优化

**总计**: 约3-4天开发时间

---

## 🎯 功能清单

### 必需功能
- [x] 员工完成任务后推送给组长
- [x] 推送开关控制
- [x] 多设备支持
- [x] 离线推送

### 扩展功能（可选）
- [ ] 每日汇总推送（每天下班前）
- [ ] 小组排名变化提醒
- [ ] 异常任务提醒（如质量问题）
- [ ] 推送历史记录查看
- [ ] 批量推送管理

---

## ⚠️ 注意事项

1. **HTTPS必需**: Web Push API只在HTTPS环境下工作
   - ✅ 你的系统已经是HTTPS，满足条件

2. **浏览器兼容性**:
   - ✅ Chrome/Edge: 完全支持
   - ✅ Firefox: 完全支持
   - ⚠️ Safari (iOS): iOS 16.4+ 支持
   - ❌ iOS < 16.4: 不支持（可降级到应用内通知）

3. **Service Worker作用域**: 
   - 需要在根路径注册，或配置scope

4. **用户授权**:
   - 必须由用户主动触发（不能自动请求）
   - 授权被拒绝后难以再次请求

5. **推送限制**:
   - 避免频繁推送（建议设置最小间隔）
   - 尊重用户的免打扰时间

---

## 🚀 快速开始

### 1. 生成VAPID密钥

```bash
# 安装工具
pip install py-vapid

# 生成密钥对
vapid --gen

# 输出:
# Public Key: BN...（公钥，用于前端）
# Private Key: ...（私钥，用于后端，保密！）
```

### 2. 部署步骤

```bash
# 1. 更新数据库
psql -U fh -d scan_db -f push_notification_schema.sql

# 2. 安装依赖
pip install pywebpush

# 3. 配置环境变量
export VAPID_PRIVATE_KEY="your_private_key"
export VAPID_PUBLIC_KEY="your_public_key"
export VAPID_SUBJECT="mailto:admin@yourdomain.com"

# 4. 重启后端服务
sudo systemctl restart product_api_dev

# 5. 部署Service Worker
cp sw.js /var/www/product_system_dev/

# 6. 清除浏览器缓存测试
```

---

## ✅ 总结

### 完全可行！推荐方案：

**Web Push API + 推送设置管理**

### 优势
1. ✅ **免费**: 无第三方费用
2. ✅ **原生**: 系统级通知体验
3. ✅ **实时**: 即时推送
4. ✅ **离线**: 浏览器关闭也能收到
5. ✅ **可控**: 完整的开关和设置
6. ✅ **扩展性强**: 可添加更多通知类型

### 开发时间
**3-4天** 完成全部功能

### 用户体验
组长在手机上会收到**和微信、QQ一样的系统通知**，点击即可查看详情！

---

**建议**: 先实现基础的任务完成推送，稳定后再逐步添加每日汇总、异常提醒等扩展功能。

需要开始实施吗？我可以帮你逐步完成！ 🚀
