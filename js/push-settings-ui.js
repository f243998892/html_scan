/**
 * 推送设置界面交互逻辑
 * 依赖: push-manager.js, app-new.js
 */

(function() {
    'use strict';
    
    console.log('[PushSettingsUI] 初始化推送设置界面');
    
    // DOM元素
    const elements = {
        // 按钮
        pushSettingsBtn: document.getElementById('push-settings-btn'),
        pushSettingsBackBtn: document.getElementById('push-settings-back-btn'),
        pushSubscribeBtn: document.getElementById('push-subscribe-btn'),
        pushUnsubscribeBtn: document.getElementById('push-unsubscribe-btn'),
        savePushSettingsBtn: document.getElementById('save-push-settings-btn'),
        testPushBtn: document.getElementById('test-push-btn'),
        
        // 容器
        pushStatusAlert: document.getElementById('push-status-alert'),
        pushSubscribeSection: document.getElementById('push-subscribe-section'),
        pushSettingsForm: document.getElementById('push-settings-form'),
        
        // 设置项
        enablePush: document.getElementById('enable-push'),
        enableTaskComplete: document.getElementById('enable-task-complete'),
        enableDailySummary: document.getElementById('enable-daily-summary'),
        enableAbnormalAlert: document.getElementById('enable-abnormal-alert'),
        quietStartHour: document.getElementById('quiet-start-hour'),
        quietEndHour: document.getElementById('quiet-end-hour')
    };
    
    // 当前状态
    let currentUser = null;
    let isSubscribed = false;
    
    /**
     * 初始化事件监听
     */
    function initEventListeners() {
        // 推送设置按钮
        if (elements.pushSettingsBtn) {
            elements.pushSettingsBtn.addEventListener('click', showPushSettings);
        }
        
        // 返回按钮
        if (elements.pushSettingsBackBtn) {
            elements.pushSettingsBackBtn.addEventListener('click', () => {
                // 使用全局SCREENS常量（如果存在）
                const leaderScreen = window.SCREENS ? window.SCREENS.LEADER_SUMMARY : 'leader-summary-screen';
                showScreen(leaderScreen);
            });
        }
        
        // 保存设置按钮
        if (elements.savePushSettingsBtn) {
            elements.savePushSettingsBtn.addEventListener('click', handleSaveSettings);
        }
        
        // 测试推送按钮
        if (elements.testPushBtn) {
            elements.testPushBtn.addEventListener('click', handleTestPush);
        }
    }
    
    /**
     * 显示推送设置界面
     */
    async function showPushSettings() {
        try {
            console.log('[PushSettingsUI] 打开推送设置界面');
            
            // 获取当前用户
            currentUser = localStorage.getItem('user_full_name');
            if (!currentUser) {
                showToast('请先登录', 'error');
                return;
            }
            
            // 切换界面
            const pushSettingsScreen = window.SCREENS ? window.SCREENS.PUSH_SETTINGS : 'push-settings-screen';
            showScreen(pushSettingsScreen);
            
            // 直接显示设置界面（钉钉推送不需要浏览器通知权限）
            console.log('[PushSettingsUI] 加载钉钉推送设置');
            
            // 加载并显示设置
            await loadSettings();
            elements.pushSettingsForm.classList.remove('d-none');
            
        } catch (error) {
            console.error('[PushSettingsUI] 显示推送设置失败:', error);
            updateStatusAlert('加载推送设置失败: ' + error.message, 'danger', false);
        }
    }
    
    /**
     * 更新状态提示
     */
    function updateStatusAlert(message, type = 'info', showSpinner = false) {
        const alertClasses = {
            'info': 'alert-info',
            'success': 'alert-success',
            'warning': 'alert-warning',
            'danger': 'alert-danger'
        };
        
        elements.pushStatusAlert.className = 'alert ' + (alertClasses[type] || 'alert-info');
        
        if (showSpinner) {
            elements.pushStatusAlert.innerHTML = `
                <div class="d-flex align-items-center">
                    <div class="spinner-border spinner-border-sm me-2" role="status">
                        <span class="visually-hidden">加载中...</span>
                    </div>
                    <span>${message}</span>
                </div>
            `;
        } else {
            elements.pushStatusAlert.textContent = message;
        }
    }
    
    /**
     * 显示订阅按钮
     */
    function showSubscribeButton() {
        elements.pushSubscribeBtn.classList.remove('d-none');
        elements.pushUnsubscribeBtn.classList.add('d-none');
    }
    
    /**
     * 显示取消订阅按钮
     */
    function showUnsubscribeButton() {
        elements.pushSubscribeBtn.classList.add('d-none');
        elements.pushUnsubscribeBtn.classList.remove('d-none');
    }
    
    /**
     * 处理订阅
     */
    async function handleSubscribe() {
        try {
            console.log('[PushSettingsUI] 开始订阅推送 (WebSocket)');
            
            elements.pushSubscribeBtn.disabled = true;
            elements.pushSubscribeBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>连接中...';
            
            updateStatusAlert('正在请求通知权限...', 'info', true);
            
            // 请求通知权限
            const hasPermission = await WebSocketPush.requestPermission();
            if (!hasPermission) {
                throw new Error('用户拒绝了通知权限');
            }
            
            // 初始化WebSocket连接
            WebSocketPush.init(currentUser);
            
            // 等待连接建立
            await new Promise((resolve, reject) => {
                let attempts = 0;
                const checkInterval = setInterval(() => {
                    attempts++;
                    if (WebSocketPush.isConnected()) {
                        clearInterval(checkInterval);
                        resolve();
                    } else if (attempts > 10) {  // 最多等待5秒
                        clearInterval(checkInterval);
                        reject(new Error('连接超时'));
                    }
                }, 500);
            });
            
            console.log('[PushSettingsUI] ✅ WebSocket连接成功');
            
            isSubscribed = true;
            updateStatusAlert('✅ 推送通知已开启 (WebSocket)', 'success', false);
            showUnsubscribeButton();
            
            // 加载并显示设置
            await loadSettings();
            elements.pushSettingsForm.classList.remove('d-none');
            
            showToast('推送通知已开启', 'success');
            
        } catch (error) {
            console.error('[PushSettingsUI] 订阅失败:', error);
            const errorMsg = error.message || '订阅失败，请重试';
            updateStatusAlert('订阅失败: ' + errorMsg, 'danger', false);
            showToast('订阅失败: ' + errorMsg, 'error');
            
            // 恢复按钮状态
            elements.pushSubscribeBtn.disabled = false;
            elements.pushSubscribeBtn.innerHTML = '<i class="bi bi-bell-fill"></i> 开启推送通知';
        }
    }
    
    /**
     * 处理取消订阅
     */
    async function handleUnsubscribe() {
        try {
            const confirmed = confirm('确定要关闭推送通知吗？\n关闭后将无法收到任务完成通知。');
            if (!confirmed) return;
            
            console.log('[PushSettingsUI] 取消订阅');
            
            elements.pushUnsubscribeBtn.disabled = true;
            elements.pushUnsubscribeBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>取消中...';
            
            updateStatusAlert('正在取消订阅...', 'info', true);
            
            const result = await PushManager.unsubscribe(currentUser);
            
            if (result.success) {
                console.log('[PushSettingsUI] ✅ 取消订阅成功');
                
                isSubscribed = false;
                updateStatusAlert('推送通知已关闭', 'warning', false);
                showSubscribeButton();
                elements.pushSubscribeBtn.disabled = false;
                elements.pushSettingsForm.classList.add('d-none');
                
                showToast('推送通知已关闭', 'success');
            }
            
            elements.pushUnsubscribeBtn.disabled = false;
            elements.pushUnsubscribeBtn.innerHTML = '<i class="bi bi-bell-slash"></i> 关闭推送通知';
            
        } catch (error) {
            console.error('[PushSettingsUI] 取消订阅失败:', error);
            updateStatusAlert('取消订阅失败: ' + error.message, 'danger', false);
            showToast('取消订阅失败', 'error');
            
            elements.pushUnsubscribeBtn.disabled = false;
            elements.pushUnsubscribeBtn.innerHTML = '<i class="bi bi-bell-slash"></i> 关闭推送通知';
        }
    }
    
    /**
     * 加载推送设置
     */
    async function loadSettings() {
        try {
            console.log('[PushSettingsUI] 加载推送设置，用户:', currentUser);
            
            const settings = await PushManager.getSettings(currentUser);
            
            if (settings) {
                console.log('[PushSettingsUI] 设置已加载:', settings);
                console.log('[PushSettingsUI] enable_push原始值:', settings.enable_push, '类型:', typeof settings.enable_push);
                
                // 检查DOM元素是否存在
                if (!elements.enablePush) {
                    console.error('[PushSettingsUI] ❌ enablePush元素不存在！');
                    return;
                }
                
                // 填充设置项（明确判断true/false，避免undefined导致的问题）
                elements.enablePush.checked = settings.enable_push === true;
                elements.enableTaskComplete.checked = settings.enable_task_complete === true;
                elements.enableDailySummary.checked = settings.enable_daily_summary === true;
                elements.enableAbnormalAlert.checked = settings.enable_abnormal_alert === true;
                elements.quietStartHour.value = settings.quiet_start_hour || 22;
                elements.quietEndHour.value = settings.quiet_end_hour || 8;
                
                console.log('[PushSettingsUI] ✅ 界面已更新');
                console.log('[PushSettingsUI] enablePush.checked =', elements.enablePush.checked);
                console.log('[PushSettingsUI] enableTaskComplete.checked =', elements.enableTaskComplete.checked);
            } else {
                console.warn('[PushSettingsUI] ⚠️ 未获取到设置数据');
            }
            
        } catch (error) {
            console.error('[PushSettingsUI] 加载设置失败:', error);
            showToast('加载设置失败', 'error');
        }
    }
    
    /**
     * 保存推送设置
     */
    async function handleSaveSettings() {
        try {
            console.log('[PushSettingsUI] 保存推送设置，当前用户:', currentUser);
            
            // 检查用户是否登录
            if (!currentUser) {
                showToast('请先登录', 'error');
                return;
            }
            
            elements.savePushSettingsBtn.disabled = true;
            elements.savePushSettingsBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>保存中...';
            
            const settings = {
                enable_push: elements.enablePush.checked,
                enable_task_complete: elements.enableTaskComplete.checked,
                enable_daily_summary: elements.enableDailySummary.checked,
                enable_abnormal_alert: elements.enableAbnormalAlert.checked,
                quiet_start_hour: parseInt(elements.quietStartHour.value),
                quiet_end_hour: parseInt(elements.quietEndHour.value)
            };
            
            console.log('[PushSettingsUI] 设置内容:', settings);
            console.log('[PushSettingsUI] 调用 PushManager.updateSettings...');
            
            const success = await PushManager.updateSettings(currentUser, settings);
            
            console.log('[PushSettingsUI] 保存结果:', success);
            
            if (success) {
                console.log('[PushSettingsUI] ✅ 设置已保存到数据库');
                showToast('✅ 设置已保存', 'success');
            } else {
                console.warn('[PushSettingsUI] ⚠️ 保存失败，success = false');
                showToast('保存设置失败，请重试', 'error');
            }
            
            elements.savePushSettingsBtn.disabled = false;
            elements.savePushSettingsBtn.innerHTML = '<i class="bi bi-save"></i> 保存设置';
            
        } catch (error) {
            console.error('[PushSettingsUI] ❌ 保存设置异常:', error);
            console.error('[PushSettingsUI] 错误详情:', error.message, error.stack);
            showToast('保存设置时发生错误: ' + error.message, 'error');
            
            elements.savePushSettingsBtn.disabled = false;
            elements.savePushSettingsBtn.innerHTML = '<i class="bi bi-save"></i> 保存设置';
        }
    }
    
    /**
     * 发送测试推送（钉钉）
     */
    async function handleTestPush() {
        try {
            console.log('[PushSettingsUI] 发送钉钉测试推送，当前用户:', currentUser);
            
            // 检查用户是否登录
            if (!currentUser) {
                showToast('请先登录', 'error');
                return;
            }
            
            elements.testPushBtn.disabled = true;
            elements.testPushBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>发送中...';
            
            const requestBody = {
                team_name: '嵌线组',  // 测试发送给嵌线组长（方辉）
                user_name: currentUser,
                task_name: '🧪 推送测试',
                progress: '测试中',
                status: '✅ 功能正常',
                details: `测试用户: ${currentUser}\n测试时间: ${new Date().toLocaleString('zh-CN')}`
            };
            
            console.log('[PushSettingsUI] 请求数据:', requestBody);
            
            // 调用钉钉推送API
            const response = await fetch('/api/push/dingtalk/team', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            
            console.log('[PushSettingsUI] 响应状态:', response.status);
            
            const result = await response.json();
            console.log('[PushSettingsUI] 响应结果:', result);
            
            if (result.success) {
                console.log('[PushSettingsUI] ✅ 钉钉测试推送已发送');
                showToast('测试消息已发送到钉钉！请检查嵌线组长（方辉）的钉钉通知', 'success');
            } else {
                const reason = result.reason || '';
                let message = result.message || '发送失败';
                
                // 根据原因给出更友好的提示
                if (reason === 'push_disabled') {
                    message = '❌ 推送总开关已关闭，请先打开推送总开关';
                } else if (reason === 'quiet_hours') {
                    message = '🌙 当前在免打扰时间内，推送已被抑制';
                } else if (reason === 'leader_not_found') {
                    message = '❌ 未找到该组的组长信息';
                }
                
                console.warn('[PushSettingsUI] ⚠️ 发送失败:', reason, message);
                showToast(message, 'warning');
            }
            
            elements.testPushBtn.disabled = false;
            elements.testPushBtn.innerHTML = '<i class="bi bi-send"></i> 发送测试通知';
            
        } catch (error) {
            console.error('[PushSettingsUI] 发送测试推送失败:', error);
            showToast('发送测试推送失败: ' + error.message, 'error');
            
            elements.testPushBtn.disabled = false;
            elements.testPushBtn.innerHTML = '<i class="bi bi-send"></i> 发送测试通知';
        }
    }
    
    /**
     * 显示Toast提示
     */
    function showToast(message, type = 'info') {
        // 使用全局的showToast函数（如果存在）
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
        } else {
            alert(message);
        }
    }
    
    /**
     * 显示界面
     */
    function showScreen(screenId) {
        // 使用全局的showScreen函数（如果存在）
        if (typeof window.showScreen === 'function') {
            window.showScreen(screenId);
        } else {
            // 降级方案
            document.querySelectorAll('[id$="-screen"]').forEach(screen => {
                screen.classList.add('d-none');
            });
            const targetScreen = document.getElementById(screenId);
            if (targetScreen) {
                targetScreen.classList.remove('d-none');
            }
        }
    }
    
    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initEventListeners);
    } else {
        initEventListeners();
    }
    
    console.log('[PushSettingsUI] 推送设置UI模块已加载');
    
})();
