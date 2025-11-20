/**
 * 人脸识别模块
 * 负责处理人脸注册和登录功能
 */

(function() {
    'use strict';
    
    // ==========================================================================
    // 全局变量
    // ==========================================================================
    
    let modelsLoaded = false;
    let currentStream = null;
    let isProcessing = false;
    
    const MODELS_PATH = '/models';
    const API_BASE_URL = '/api';
    
    // ==========================================================================
    // 初始化
    // ==========================================================================
    
    async function initFaceRecognition() {
        console.log('开始初始化人脸识别...');
        
        try {
            // 显示加载提示
            const loadingEl = document.getElementById('face-loading');
            if (loadingEl) loadingEl.style.display = 'block';
            
            // 加载模型
            await loadModels();
            
            // 隐藏加载提示
            if (loadingEl) loadingEl.style.display = 'none';
            
            console.log('✅ 人脸识别初始化完成');
            
            // 绑定事件
            bindEvents();
            
        } catch (error) {
            console.error('❌ 人脸识别初始化失败:', error);
            showToast('人脸识别初始化失败，请刷新页面重试', 'error');
        }
    }
    
    // ==========================================================================
    // 加载模型
    // ==========================================================================
    
    async function loadModels() {
        if (modelsLoaded) {
            console.log('模型已加载，跳过');
            return;
        }
        
        console.log('开始加载人脸识别模型...');
        
        // 触发模型加载开始事件
        window.dispatchEvent(new CustomEvent('app:init:models'));
        
        const startTime = performance.now();
        
        try {
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_PATH),
                faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_PATH),
                faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_PATH)
            ]);
            
            modelsLoaded = true;
            const loadTime = ((performance.now() - startTime) / 1000).toFixed(2);
            console.log(`✅ 模型加载完成，耗时: ${loadTime}秒`);
            
            // 触发模型加载完成事件
            window.dispatchEvent(new CustomEvent('app:models:loaded'));
            
        } catch (error) {
            console.error('模型加载失败:', error);
            throw new Error('模型加载失败: ' + error.message);
        }
    }
    
    // ==========================================================================
    // 事件绑定
    // ==========================================================================
    
    function bindEvents() {
        // 人脸登录按钮
        const faceLoginBtn = document.getElementById('face-login-btn');
        const stopFaceLoginBtn = document.getElementById('stop-face-login-btn');
        
        if (faceLoginBtn) {
            faceLoginBtn.addEventListener('click', startFaceLogin);
        }
        
        if (stopFaceLoginBtn) {
            stopFaceLoginBtn.addEventListener('click', () => {
                stopCamera('face-login-video');
                stopFaceLoginBtn.style.display = 'none';
                faceLoginBtn.style.display = 'block';
            });
        }
        
        // 人脸注册按钮
        const faceRegisterBtn = document.getElementById('face-register-btn');
        const stopFaceRegisterBtn = document.getElementById('stop-face-register-btn');
        
        if (faceRegisterBtn) {
            faceRegisterBtn.addEventListener('click', startFaceRegister);
        }
        
        if (stopFaceRegisterBtn) {
            stopFaceRegisterBtn.addEventListener('click', () => {
                stopCamera('face-register-video');
                stopFaceRegisterBtn.style.display = 'none';
                faceRegisterBtn.style.display = 'block';
            });
        }
    }
    
    // ==========================================================================
    // 摄像头控制
    // ==========================================================================
    
    async function startCamera(videoElementId) {
        const video = document.getElementById(videoElementId);
        if (!video) return null;
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                }
            });
            
            video.srcObject = stream;
            currentStream = stream;
            
            // 等待视频元素准备就绪
            await new Promise((resolve) => {
                video.onloadedmetadata = () => {
                    video.play();
                    resolve();
                };
            });
            
            return video;
            
        } catch (error) {
            console.error('摄像头启动失败:', error);
            showToast('无法访问摄像头，请检查权限设置', 'error');
            return null;
        }
    }
    
    function stopCamera(videoElementId) {
        const video = document.getElementById(videoElementId);
        if (video && video.srcObject) {
            const stream = video.srcObject;
            const tracks = stream.getTracks();
            tracks.forEach(track => track.stop());
            video.srcObject = null;
        }
        currentStream = null;
        isProcessing = false;
    }
    
    // ==========================================================================
    // 人脸检测
    // ==========================================================================
    
    async function detectFace(video) {
        try {
            const detection = await faceapi
                .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks()
                .withFaceDescriptor();
            
            return detection;
            
        } catch (error) {
            console.error('人脸检测失败:', error);
            return null;
        }
    }
    
    // ==========================================================================
    // 人脸登录
    // ==========================================================================
    
    async function startFaceLogin() {
        if (isProcessing) return;
        
        console.log('开始人脸登录流程...');
        isProcessing = true;
        
        const faceLoginBtn = document.getElementById('face-login-btn');
        const stopFaceLoginBtn = document.getElementById('stop-face-login-btn');
        const statusEl = document.getElementById('face-login-status');
        
        try {
            // 更新UI
            faceLoginBtn.style.display = 'none';
            stopFaceLoginBtn.style.display = 'block';
            updateStatus(statusEl, '正在启动摄像头...', 'info');
            
            // 启动摄像头
            const video = await startCamera('face-login-video');
            if (!video) {
                isProcessing = false;
                faceLoginBtn.style.display = 'block';
                stopFaceLoginBtn.style.display = 'none';
                return;
            }
            
            updateStatus(statusEl, '请正视摄像头，保持面部清晰...', 'info');
            
            // 等待1秒让用户调整位置
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            updateStatus(statusEl, '正在识别人脸...', 'warning');
            
            // 检测人脸
            const detection = await detectFace(video);
            
            if (!detection) {
                updateStatus(statusEl, '未检测到人脸，请重试', 'error');
                stopCamera('face-login-video');
                faceLoginBtn.style.display = 'block';
                stopFaceLoginBtn.style.display = 'none';
                isProcessing = false;
                return;
            }
            
            updateStatus(statusEl, '人脸识别成功，正在登录...', 'success');
            
            // 获取人脸特征向量
            const descriptor = Array.from(detection.descriptor);
            
            // 调用后端API进行登录
            const result = await callFaceLoginAPI(descriptor);
            
            if (result.success) {
                updateStatus(statusEl, `登录成功！欢迎回来，${result.name}`, 'success');
                
                // 保存到localStorage
                localStorage.setItem('user_full_name', result.name);
                
                // 停止摄像头
                stopCamera('face-login-video');
                
                // 1秒后跳转到主页
                setTimeout(() => {
                    console.log('准备跳转到主页...');
                    console.log('onFaceLoginSuccess类型:', typeof window.onFaceLoginSuccess);
                    
                    // 调用全局的登录成功处理函数
                    if (typeof window.onFaceLoginSuccess === 'function') {
                        console.log('调用onFaceLoginSuccess函数');
                        window.onFaceLoginSuccess(result.name);
                    } else {
                        console.log('onFaceLoginSuccess未定义，刷新页面');
                        location.reload();
                    }
                }, 1000);
                
            } else {
                updateStatus(statusEl, result.message || '未识别到注册用户', 'error');
                stopCamera('face-login-video');
                faceLoginBtn.style.display = 'block';
                stopFaceLoginBtn.style.display = 'none';
            }
            
        } catch (error) {
            console.error('人脸登录失败:', error);
            updateStatus(statusEl, '登录失败: ' + error.message, 'error');
            stopCamera('face-login-video');
            faceLoginBtn.style.display = 'block';
            stopFaceLoginBtn.style.display = 'none';
        }
        
        isProcessing = false;
    }
    
    // ==========================================================================
    // 人脸注册
    // ==========================================================================
    
    async function startFaceRegister() {
        if (isProcessing) return;
        
        const nameInput = document.getElementById('register-username');
        const name = nameInput?.value.trim();
        
        // 验证姓名
        if (!name || name.length < 2 || name.length > 10) {
            showToast('请输入2-10个字符的姓名', 'warning');
            return;
        }
        
        console.log('开始人脸注册流程...', name);
        isProcessing = true;
        
        const faceRegisterBtn = document.getElementById('face-register-btn');
        const stopFaceRegisterBtn = document.getElementById('stop-face-register-btn');
        const statusEl = document.getElementById('face-register-status');
        
        try {
            // 更新UI
            faceRegisterBtn.style.display = 'none';
            stopFaceRegisterBtn.style.display = 'block';
            updateStatus(statusEl, '正在检查姓名...', 'info');
            
            // 检查姓名是否已被注册
            const nameCheck = await checkUserExists(name);
            if (nameCheck.exists) {
                updateStatus(statusEl, '该姓名已被注册，请更换姓名或使用人脸登录', 'error');
                faceRegisterBtn.style.display = 'block';
                stopFaceRegisterBtn.style.display = 'none';
                isProcessing = false;
                return;
            }
            
            updateStatus(statusEl, '正在启动摄像头...', 'info');
            
            // 启动摄像头
            const video = await startCamera('face-register-video');
            if (!video) {
                isProcessing = false;
                faceRegisterBtn.style.display = 'block';
                stopFaceRegisterBtn.style.display = 'none';
                return;
            }
            
            updateStatus(statusEl, '请正视摄像头，保持面部清晰...', 'info');
            
            // 等待1秒让用户调整位置
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            updateStatus(statusEl, '正在识别人脸...', 'warning');
            
            // 检测人脸
            const detection = await detectFace(video);
            
            if (!detection) {
                updateStatus(statusEl, '未检测到人脸，请重试', 'error');
                stopCamera('face-register-video');
                faceRegisterBtn.style.display = 'block';
                stopFaceRegisterBtn.style.display = 'none';
                isProcessing = false;
                return;
            }
            
            updateStatus(statusEl, '人脸识别成功，正在注册...', 'success');
            
            // 获取人脸特征向量
            const descriptor = Array.from(detection.descriptor);
            
            // 调用后端API进行注册
            const result = await callFaceRegisterAPI(name, descriptor);
            
            if (result.success) {
                updateStatus(statusEl, `注册成功！欢迎，${name}`, 'success');
                
                // 保存到localStorage
                localStorage.setItem('user_full_name', name);
                
                // 停止摄像头
                stopCamera('face-register-video');
                
                // 清空输入框
                if (nameInput) nameInput.value = '';
                
                // 1秒后跳转到主页
                setTimeout(() => {
                    console.log('准备跳转到主页（注册成功）...');
                    console.log('onFaceLoginSuccess类型:', typeof window.onFaceLoginSuccess);
                    
                    // 调用全局的登录成功处理函数
                    if (typeof window.onFaceLoginSuccess === 'function') {
                        console.log('调用onFaceLoginSuccess函数');
                        window.onFaceLoginSuccess(name);
                    } else {
                        console.log('onFaceLoginSuccess未定义，刷新页面');
                        location.reload();
                    }
                }, 1000);
                
            } else {
                updateStatus(statusEl, result.message || '注册失败', 'error');
                stopCamera('face-register-video');
                faceRegisterBtn.style.display = 'block';
                stopFaceRegisterBtn.style.display = 'none';
            }
            
        } catch (error) {
            console.error('人脸注册失败:', error);
            updateStatus(statusEl, '注册失败: ' + error.message, 'error');
            stopCamera('face-register-video');
            faceRegisterBtn.style.display = 'block';
            stopFaceRegisterBtn.style.display = 'none';
        }
        
        isProcessing = false;
    }
    
    // ==========================================================================
    // API调用
    // ==========================================================================
    
    async function checkUserExists(name) {
        try {
            const response = await fetch(`${API_BASE_URL}/users/check/${encodeURIComponent(name)}`);
            return await response.json();
        } catch (error) {
            console.error('检查用户失败:', error);
            throw error;
        }
    }
    
    async function callFaceRegisterAPI(name, descriptor) {
        try {
            const response = await fetch(`${API_BASE_URL}/face/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: name,
                    descriptor: descriptor
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                return {
                    success: false,
                    message: data.detail || '注册失败'
                };
            }
            
            return data;
            
        } catch (error) {
            console.error('调用注册API失败:', error);
            return {
                success: false,
                message: '网络错误: ' + error.message
            };
        }
    }
    
    async function callFaceLoginAPI(descriptor) {
        try {
            const response = await fetch(`${API_BASE_URL}/face/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    descriptor: descriptor
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                return {
                    success: false,
                    message: data.detail || '登录失败'
                };
            }
            
            return data;
            
        } catch (error) {
            console.error('调用登录API失败:', error);
            return {
                success: false,
                message: '网络错误: ' + error.message
            };
        }
    }
    
    // ==========================================================================
    // 工具函数
    // ==========================================================================
    
    function updateStatus(element, message, type = 'info') {
        if (!element) return;
        
        element.textContent = message;
        element.style.display = 'block';
        
        // 移除所有颜色类
        element.classList.remove('bg-primary', 'bg-success', 'bg-danger', 'bg-warning', 'bg-dark');
        
        // 根据类型添加颜色
        switch (type) {
            case 'success':
                element.classList.add('bg-success');
                break;
            case 'error':
                element.classList.add('bg-danger');
                break;
            case 'warning':
                element.classList.add('bg-warning');
                element.classList.add('text-dark');
                break;
            case 'info':
            default:
                element.classList.add('bg-primary');
                break;
        }
    }
    
    function showToast(message, type = 'info') {
        // 使用全局的showToast函数（如果存在）
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
        } else {
            alert(message);
        }
    }
    
    // ==========================================================================
    // 导出到全局
    // ==========================================================================
    
    window.FaceRecognition = {
        init: initFaceRecognition,
        loadModels: loadModels
    };
    
    // 页面加载完成后自动初始化
    // 使用延迟初始化，确保DOM和所有脚本都已加载
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(initFaceRecognition, 100);
        });
    } else {
        setTimeout(initFaceRecognition, 100);
    }
    
})();
