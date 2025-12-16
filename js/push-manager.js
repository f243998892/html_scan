/**
 * Web Push推送管理模块
 * 负责Service Worker注册、推送订阅和通知管理
 */

const PushManager = (function() {
    'use strict';
    
    // 配置
    const CONFIG = {
        apiBaseUrl: '/api',
        swPath: '/service-worker.js',  // 使用统一的Service Worker
        vapidPublicKey: null  // 从服务器获取
    };
    
    // 状态
    let isInitialized = false;
    let registration = null;
    let currentSubscription = null;
    
    /**
     * 初始化推送管理器
     */
    async function init() {
        if (isInitialized) {
            console.log('[PushManager] 已初始化');
            return true;
        }
        
        try {
            console.log('[PushManager] 开始初始化...');
            
            // 1. 检查浏览器支持
            if (!('serviceWorker' in navigator)) {
                console.error('[PushManager] 浏览器不支持Service Worker');
                return false;
            }
            
            if (!('PushManager' in window)) {
                console.error('[PushManager] 浏览器不支持Push API');
                return false;
            }
            
            // 2. 获取VAPID公钥
            CONFIG.vapidPublicKey = await fetchVapidPublicKey();
            if (!CONFIG.vapidPublicKey) {
                console.error('[PushManager] 获取VAPID公钥失败');
                return false;
            }
            
            console.log('[PushManager] VAPID公钥已获取');
            
            // 3. 注册Service Worker
            registration = await registerServiceWorker();
            if (!registration) {
                console.error('[PushManager] Service Worker注册失败');
                return false;
            }
            
            console.log('[PushManager] Service Worker已注册');
            
            // 4. 获取当前订阅
            currentSubscription = await registration.pushManager.getSubscription();
            if (currentSubscription) {
                console.log('[PushManager] 已有推送订阅');
            }
            
            isInitialized = true;
            console.log('[PushManager] ✅ 初始化完成');
            return true;
            
        } catch (error) {
            console.error('[PushManager] 初始化失败:', error);
            return false;
        }
    }
    
    /**
     * 从服务器获取VAPID公钥
     */
    async function fetchVapidPublicKey() {
        try {
            const response = await fetch(`${CONFIG.apiBaseUrl}/push/vapid-public-key`);
            const data = await response.json();
            
            if (data.success && data.public_key) {
                return data.public_key;
            }
            
            console.error('[PushManager] VAPID公钥响应无效:', data);
            return null;
            
        } catch (error) {
            console.error('[PushManager] 获取VAPID公钥失败:', error);
            return null;
        }
    }
    
    /**
     * 注册Service Worker
     */
    async function registerServiceWorker() {
        try {
            const reg = await navigator.serviceWorker.register(CONFIG.swPath, {
                scope: '/'
            });
            
            console.log('[PushManager] Service Worker注册成功:', reg.scope);
            
            // 等待Service Worker激活
            if (reg.installing) {
                console.log('[PushManager] Service Worker正在安装...');
                await new Promise(resolve => {
                    reg.installing.addEventListener('statechange', function() {
                        if (this.state === 'activated') {
                            resolve();
                        }
                    });
                });
            }
            
            // 确保Service Worker处于激活状态
            await navigator.serviceWorker.ready;
            
            return reg;
            
        } catch (error) {
            console.error('[PushManager] Service Worker注册失败:', error);
            return null;
        }
    }
    
    /**
     * 将base64字符串转换为Uint8Array（用于VAPID公钥）
     */
    function urlBase64ToUint8Array(base64String) {
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
    
    /**
     * 订阅推送通知
     * @param {string} userName - 用户姓名
     */
    async function subscribe(userName) {
        if (!isInitialized) {
            const initialized = await init();
            if (!initialized) {
                throw new Error('推送管理器初始化失败');
            }
        }
        
        try {
            console.log('[PushManager] 开始订阅推送...');
            
            // 1. 检查当前订阅
            currentSubscription = await registration.pushManager.getSubscription();
            
            // 2. 如果已有订阅，先取消
            if (currentSubscription) {
                console.log('[PushManager] 检测到现有订阅，先取消...');
                await currentSubscription.unsubscribe();
            }
            
            // 3. 创建新订阅
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(CONFIG.vapidPublicKey)
            });
            
            console.log('[PushManager] 推送订阅成功');
            
            // 4. 保存订阅到服务器
            await saveSubscriptionToServer(userName, subscription);
            
            currentSubscription = subscription;
            console.log('[PushManager] ✅ 订阅完成并已保存');
            
            return {
                success: true,
                subscription: subscription
            };
            
        } catch (error) {
            console.error('[PushManager] 订阅失败:', error);
            
            // 如果已经创建了订阅但保存失败，需要取消订阅
            if (currentSubscription) {
                try {
                    await currentSubscription.unsubscribe();
                    console.log('[PushManager] 已取消浏览器订阅');
                } catch (unsubErr) {
                    console.error('[PushManager] 取消订阅失败:', unsubErr);
                }
                currentSubscription = null;
            }
            
            // 如果是权限被拒绝
            if (error.name === 'NotAllowedError') {
                throw new Error('通知权限被拒绝，请在浏览器设置中允许通知');
            }
            
            throw error;
        }
    }
    
    /**
     * 保存订阅信息到服务器
     */
    async function saveSubscriptionToServer(userName, subscription) {
        try {
            console.log('[PushManager] 准备保存订阅到服务器...', {
                userName,
                endpoint: subscription.endpoint
            });
            
            const requestBody = {
                user_name: userName,
                subscription: subscription.toJSON(),
                user_agent: navigator.userAgent
            };
            
            console.log('[PushManager] 请求体:', requestBody);
            
            const response = await fetch(`${CONFIG.apiBaseUrl}/push/subscribe`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            
            console.log('[PushManager] 服务器响应状态:', response.status, response.statusText);
            
            // 先克隆response，以便在需要时读取多次
            const responseClone = response.clone();
            
            // 尝试解析JSON
            let data;
            try {
                data = await response.json();
                console.log('[PushManager] 服务器响应数据:', data);
            } catch (jsonError) {
                // 如果JSON解析失败，尝试读取文本
                console.error('[PushManager] JSON解析失败，尝试读取文本...');
                const text = await responseClone.text();
                console.error('[PushManager] 响应文本:', text);
                throw new Error(`JSON解析失败: ${jsonError.message}. 响应: ${text.substring(0, 200)}`);
            }
            
            // 检查HTTP状态
            if (!response.ok) {
                console.error('[PushManager] 服务器返回错误状态:', data);
                throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`);
            }
            
            // 检查业务状态
            if (data.success) {
                console.log('[PushManager] ✅ 订阅已保存到服务器');
                return;
            } else {
                console.error('[PushManager] ❌ 保存订阅失败:', data);
                const errorMsg = data.message || data.detail || '保存订阅失败';
                throw new Error(errorMsg);
            }
            
        } catch (error) {
            console.error('[PushManager] ❌ 保存订阅到服务器出错:', error);
            console.error('[PushManager] 错误详情:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            // 重新抛出错误，让上层捕获
            throw error;
        }
    }
    
    /**
     * 取消推送订阅
     * @param {string} userName - 用户姓名
     */
    async function unsubscribe(userName) {
        try {
            console.log('[PushManager] 取消订阅...');
            
            if (!currentSubscription) {
                currentSubscription = await registration.pushManager.getSubscription();
            }
            
            if (!currentSubscription) {
                console.log('[PushManager] 没有活动订阅');
                return { success: true };
            }
            
            const endpoint = currentSubscription.endpoint;
            
            // 1. 从浏览器取消订阅
            await currentSubscription.unsubscribe();
            console.log('[PushManager] 浏览器订阅已取消');
            
            // 2. 从服务器删除订阅
            const response = await fetch(`${CONFIG.apiBaseUrl}/push/unsubscribe`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_name: userName,
                    endpoint: endpoint
                })
            });
            
            const data = await response.json();
            
            currentSubscription = null;
            console.log('[PushManager] ✅ 订阅已完全取消');
            
            return { success: true };
            
        } catch (error) {
            console.error('[PushManager] 取消订阅失败:', error);
            throw error;
        }
    }
    
    /**
     * 检查订阅状态
     */
    async function getSubscriptionStatus() {
        try {
            if (!isInitialized) {
                await init();
            }
            
            currentSubscription = await registration.pushManager.getSubscription();
            
            return {
                isSubscribed: !!currentSubscription,
                subscription: currentSubscription,
                permissionState: await getPermissionState()
            };
            
        } catch (error) {
            console.error('[PushManager] 获取订阅状态失败:', error);
            return {
                isSubscribed: false,
                subscription: null,
                permissionState: 'denied'
            };
        }
    }
    
    /**
     * 获取推送权限状态
     */
    async function getPermissionState() {
        if (!registration) {
            return 'denied';
        }
        
        try {
            return await registration.pushManager.permissionState({
                userVisibleOnly: true
            });
        } catch (error) {
            // 降级到Notification权限
            return Notification.permission;
        }
    }
    
    /**
     * 请求通知权限
     */
    async function requestPermission() {
        try {
            const permission = await Notification.requestPermission();
            console.log('[PushManager] 通知权限:', permission);
            return permission === 'granted';
        } catch (error) {
            console.error('[PushManager] 请求权限失败:', error);
            return false;
        }
    }
    
    /**
     * 检查是否支持推送通知
     */
    function isSupported() {
        return ('serviceWorker' in navigator) && 
               ('PushManager' in window) &&
               ('Notification' in window);
    }
    
    /**
     * 获取推送设置
     */
    async function getSettings(userName) {
        try {
            const response = await fetch(`${CONFIG.apiBaseUrl}/push/settings?user_name=${encodeURIComponent(userName)}`);
            const data = await response.json();
            return data.success ? data.settings : null;
        } catch (error) {
            console.error('[PushManager] 获取推送设置失败:', error);
            return null;
        }
    }
    
    /**
     * 更新推送设置
     */
    async function updateSettings(userName, settings) {
        try {
            console.log('[PushManager] 更新推送设置，用户:', userName);
            console.log('[PushManager] 设置内容:', settings);
            
            const requestData = {
                user_name: userName,
                ...settings
            };
            
            console.log('[PushManager] 请求数据:', requestData);
            console.log('[PushManager] 请求URL:', `${CONFIG.apiBaseUrl}/push/settings`);
            
            const response = await fetch(`${CONFIG.apiBaseUrl}/push/settings`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            });
            
            console.log('[PushManager] 响应状态:', response.status, response.statusText);
            
            if (!response.ok) {
                console.error('[PushManager] HTTP错误:', response.status);
                return false;
            }
            
            const data = await response.json();
            console.log('[PushManager] 响应数据:', data);
            
            if (data.success) {
                console.log('[PushManager] ✅ 更新成功');
            } else {
                console.warn('[PushManager] ⚠️ 更新失败:', data.message);
            }
            
            return data.success;
        } catch (error) {
            console.error('[PushManager] ❌ 更新推送设置异常:', error);
            console.error('[PushManager] 错误详情:', error.message, error.stack);
            return false;
        }
    }
    
    /**
     * 发送测试推送
     */
    async function sendTestPush(userName, groupName = null) {
        try {
            const response = await fetch(`${CONFIG.apiBaseUrl}/push/test`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_name: userName,
                    group_name: groupName
                })
            });
            
            const data = await response.json();
            return data.success;
        } catch (error) {
            console.error('[PushManager] 发送测试推送失败:', error);
            return false;
        }
    }
    
    // 导出公共API
    return {
        init,
        subscribe,
        unsubscribe,
        getSubscriptionStatus,
        requestPermission,
        isSupported,
        getSettings,
        updateSettings,
        sendTestPush
    };
    
})();

// 全局暴露
window.PushManager = PushManager;

console.log('[PushManager] 模块已加载');
