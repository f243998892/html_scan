// 全局变量
const DB_CONFIG = {
    host: 's5.gnip.vip',
    port: 33946,
    database: 'postgres',
    user: 'postgres',
    password: 'postgres'
};
// 使用相对路径，不再硬编码外部域名
const HTTP_API_URL = window.location.hostname === 'localhost' ? 'http://localhost:8000' : '';
const API_BASE_URL = '/api'; // 添加API基础URL
// 初始化PostgreSQL客户端
let dbClient;

// 存储当前用户信息
const userState = {
    fullName: ''
};

// 存储当前扫码状态
const scanState = {
    processType: '',
    isContinuous: false,
    pendingCodes: [],
    lastScannedCode: '',
    isProcessing: false,
    currentHtml5QrScanner: null,
    lastScanTime: null
};

// 存储当前查询状态
const queryState = {
    currentProcess: '',
    currentModel: '',
    monthRange: { startDate: null, endDate: null }
};

// 常量定义
const SCREENS = {
    LOGIN: 'login-screen',
    HOME: 'home-screen',
    SINGLE_SCAN: 'single-scan-screen',
    CONTINUOUS_SCAN: 'continuous-scan-screen',
    SCAN: 'scan-screen',
    QUERY: 'query-screen',
    MODELS: 'models-screen',
    PRODUCTS: 'products-screen',
    DELETE_RECORDS: 'delete-records-screen',
    MANUAL_SCAN: 'manual-scan-screen' // 新增扫码枪/手动录入界面
};

// 全局缓存对象
const dataCache = {
    monthlyTransactions: {
        data: null,
        timestamp: null,
        params: null,
        expiresInMinutes: 5  // 缓存过期时间（分钟）
    }
};

// 检查缓存是否有效
function isCacheValid(cacheKey) {
    if (!dataCache[cacheKey] || !dataCache[cacheKey].data || !dataCache[cacheKey].timestamp) {
        return false;
    }
    
    const now = new Date();
    const cacheTime = new Date(dataCache[cacheKey].timestamp);
    const diffInMs = now - cacheTime;
    const diffInMinutes = diffInMs / (1000 * 60);
    
    return diffInMinutes < dataCache[cacheKey].expiresInMinutes;
}

// 应用初始状态
const appState = {
    scanner: null,
    isScanning: false,
    lastScannedCode: null,
    lastScannedTime: null,
    scannerInputReady: false,
    isContinuousScanMode: false,
    pendingCodes: [],
    // 月份范围缓存
    monthRangeCache: {
        data: null,
        timestamp: null,
        maxAge: 5 * 60 * 1000  // 5分钟缓存
    }
};

// 初始化应用
document.addEventListener('DOMContentLoaded', function() {
    // 初始化数据库连接
    initDbConnection();
    initApp();
});

// 初始化数据库连接
function initDbConnection() {
    // 在这里我们将使用HTTP API而不是直接连接数据库
    // 所有数据库操作都通过HTTP API进行
    console.log('数据库连接已初始化');
}

// 初始化应用
async function initApp() {
    try {
        console.log('初始化应用...');
        
        // 首先添加事件监听
        addEventListeners();
        
        // 尝试自动登录，如果失败会显示登录页面
        await tryAutoLogin();
    } catch (error) {
        console.error('应用初始化失败:', error);
        // 确保显示登录页面
        showScreen(SCREENS.LOGIN);
    }
}

// 尝试自动登录
async function tryAutoLogin() {
    try {
        const savedFullName = localStorage.getItem('user_full_name');
        console.log('尝试自动登录，保存的用户名:', savedFullName);
        
        if (savedFullName) {
            userState.fullName = savedFullName;
            
            // 加载保存的工序设置
            loadSavedProcessSelection();
            
            // 导航到主页
            navigateToHome();
            console.log('自动登录成功:', savedFullName);
        } else {
            // 没有登录信息，显示登录页面
            showScreen(SCREENS.LOGIN);
            console.log('未找到登录信息，显示登录页面');
        }
    } catch (error) {
        console.error('自动登录失败:', error);
        // 显示登录页面
        showScreen(SCREENS.LOGIN);
    }
}

// 添加事件监听
function addEventListeners() {
    // 登录事件
    document.getElementById('login-btn').addEventListener('click', handleLogin);
    
    // 首页功能卡片点击事件
    document.getElementById('card-single-scan').addEventListener('click', handleSingleScan);
    document.getElementById('card-continuous-scan').addEventListener('click', handleContinuousScan);
    document.getElementById('card-product-query').addEventListener('click', handleProductQuery);
    document.getElementById('card-product-scan-query').addEventListener('click', handleProductScanQuery);
    document.getElementById('card-inventory').addEventListener('click', () => showFeatureNotAvailable('该功能暂未开放，敬请期待'));
    document.getElementById('card-delete-records').addEventListener('click', handleDeleteRecords);
    
    // 工序选择下拉框变化时保存选择并立即更新浮动框
    const processSelect = document.getElementById('process-select');
    if (processSelect) {
        processSelect.addEventListener('change', function() {
            saveProcessSelection(this.value);
            // 立即更新浮动工序框
            createFloatingProcess();
        });
    }
    
    // 单次扫码工序按钮
    document.querySelectorAll('.process-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const processType = this.getAttribute('data-process');
            scanState.processType = processType;
            scanState.isContinuous = false;
            startScan(processType, false);
        });
    });
    
    // 连续扫码工序按钮
    document.querySelectorAll('.process-btn-continuous').forEach(btn => {
        btn.addEventListener('click', function() {
            const processType = this.getAttribute('data-process');
            scanState.processType = processType;
            scanState.isContinuous = true;
            startScan(processType, true);
        });
    });
    
    // 返回按钮
    document.getElementById('single-scan-back').addEventListener('click', () => showScreen(SCREENS.HOME));
    document.getElementById('continuous-scan-back').addEventListener('click', () => showScreen(SCREENS.HOME));
    document.getElementById('query-back').addEventListener('click', () => showScreen(SCREENS.HOME));
    document.getElementById('models-back').addEventListener('click', () => showScreen(SCREENS.QUERY));
    document.getElementById('products-back').addEventListener('click', () => showScreen(SCREENS.MODELS));
    
    // 扫码相关
    document.getElementById('scan-stop').addEventListener('click', stopScan);
    document.getElementById('scan-upload').addEventListener('click', uploadPendingCodes);
    
    // 添加扫码枪/手动录入按钮事件
    addManualScanEvent();
}

// 保存工序选择到本地存储
function saveProcessSelection(processType) {
    try {
        localStorage.setItem('selected_process', processType);
        console.log('工序选择已保存:', processType);
        // 立即更新浮动工序框
        createFloatingProcess();
    } catch (error) {
        console.error('保存工序选择失败:', error);
    }
}

// 从本地存储加载工序选择
function loadSavedProcessSelection() {
    try {
        const savedProcess = localStorage.getItem('selected_process');
        if (savedProcess) {
            const processSelect = document.getElementById('process-select');
            if (processSelect) {
                processSelect.value = savedProcess;
                console.log('已恢复保存的工序选择:', savedProcess);
            }
        }
    } catch (error) {
        console.error('加载工序选择失败:', error);
    }
}

// 处理登录
async function handleLogin() {
    try {
        const nameInput = document.getElementById('username');
        const fullName = nameInput.value.trim();
        
        if (!fullName) {
            showToast('请输入姓名', 'warning');
            return;
        }
        
        // 保存用户信息到状态和本地存储
        userState.fullName = fullName;
        
        // 确保localStorage可用
        try {
            localStorage.setItem('user_full_name', fullName);
        } catch (storageError) {
            console.error('无法访问localStorage:', storageError);
            // 虽然localStorage失败，但仍可继续使用，只是设置不会被保存
        }
        
        // 导航到首页
        navigateToHome();
        
        // 显示登录成功提示
        showToast(`欢迎，${fullName}！`, 'success');
    } catch (error) {
        console.error('登录过程中发生错误:', error);
        showToast('登录失败，请重试', 'error');
    }
}

// 导航到首页
function navigateToHome() {
    try {
        // 更新用户信息显示
        const userFullnameElement = document.getElementById('user-fullname');
        if (userFullnameElement) {
            userFullnameElement.textContent = `用户: ${userState.fullName || '未登录'}`;
        }
        
        // 在主页上方添加工序提醒条
        showProcessWarning();
        
        // 显示主屏幕
        showScreen(SCREENS.HOME);
        
        // 创建浮动工序名称框
        createFloatingProcess();
    } catch (error) {
        console.error('导航到首页失败:', error);
    }
}

// 在主页显示当前选择的工序提醒条
function showProcessWarning() {
    // 移除已存在的提醒条
    const existingWarning = document.getElementById('process-warning');
    if (existingWarning) {
        existingWarning.remove();
    }
    
    const processSelect = document.getElementById('process-select');
    if (processSelect && processSelect.selectedIndex >= 0) {
        const selectedText = processSelect.options[processSelect.selectedIndex].text;
        
        // 创建提醒条
        const warningDiv = document.createElement('div');
        warningDiv.id = 'process-warning';
        warningDiv.className = 'process-warning';
        warningDiv.innerHTML = `当前工序: <span class="process-highlight">${selectedText}</span>`;
        
        // 添加到body
        document.body.appendChild(warningDiv);
        
        // 5秒后自动消失
        setTimeout(() => {
            const div = document.getElementById('process-warning');
            if (div) {
                div.style.opacity = '0';
                div.style.transition = 'opacity 0.5s';
                setTimeout(() => {
                    if (div.parentNode) {
                        div.parentNode.removeChild(div);
                    }
                }, 500);
            }
        }, 5000);
    }
}

// 显示指定屏幕
function showScreen(screenId) {
    try {
        console.log('切换到页面:', screenId);
        
        // 隐藏所有屏幕
        Object.values(SCREENS).forEach(id => {
            document.getElementById(id).classList.add('d-none');
        });
        
        // 显示目标屏幕
        document.getElementById(screenId).classList.remove('d-none');
        
        // 隐藏所有模态框
        hideAllModals();
        
        // 如果切换回首页，停止扫码
        if (screenId === SCREENS.HOME && scanState.currentHtml5QrScanner) {
            stopScanner();
        }
        
        // 在查询页面隐藏浮动工序框，其他页面显示
        const floatingProcessEl = document.getElementById('floating-process');
        if (floatingProcessEl) {
            if (screenId === SCREENS.QUERY || 
                screenId === SCREENS.MODELS || 
                screenId === SCREENS.PRODUCTS ||
                screenId === SCREENS.DELETE_RECORDS) {
                floatingProcessEl.style.display = 'none';
            } else {
                floatingProcessEl.style.display = 'block';
            }
        } else if (screenId !== SCREENS.QUERY && 
                  screenId !== SCREENS.MODELS && 
                  screenId !== SCREENS.PRODUCTS &&
                  screenId !== SCREENS.DELETE_RECORDS) {
            // 创建浮动工序名称框（如果不存在）
            createFloatingProcess();
        }
    } catch (error) {
        console.error('切换屏幕失败:', error);
    }
}

// 隐藏所有模态框
function hideAllModals() {
    try {
        // 隐藏产品详情模态框
        const productDetailModal = document.getElementById('product-detail-modal');
        if (productDetailModal) {
            productDetailModal.style.display = 'none';
            productDetailModal.classList.remove('show');
            
            // 移除可能存在的背景
            const modalBackdrops = document.querySelectorAll('.modal-backdrop');
            modalBackdrops.forEach(backdrop => {
                if (backdrop.parentNode) {
                    backdrop.parentNode.removeChild(backdrop);
                }
            });
            
            // 移除body上的modal-open类
            document.body.classList.remove('modal-open');
        }
    } catch (error) {
        console.error('隐藏模态框失败:', error);
    }
}

// 显示功能未实现提示
function showFeatureNotAvailable(message) {
    showToast(message, 'info');
}

// 显示Toast提示
function showToast(message, type = 'success', duration = 3000) {
    // 如果类型是info并且消息包含"成功识别"，则使用较短的显示时间
    if (type === 'info' && message.includes('成功识别')) {
        duration = 1500; // 扫码识别成功提示仅显示1.5秒
    }
    
    const toastContainer = document.getElementById('toast-container');
    
    const toastElement = document.createElement('div');
    toastElement.classList.add('custom-toast', 'p-3', 'mb-2');
    
    // 设置Toast样式 - 现在显示在屏幕中间
    switch(type) {
        case 'success':
            toastElement.classList.add('bg-success', 'text-white');
            break;
        case 'error':
            toastElement.classList.add('bg-danger', 'text-white');
            break;
        case 'warning':
            toastElement.classList.add('bg-warning', 'text-dark');
            break;
        case 'info':
        default:
            toastElement.classList.add('bg-info', 'text-white');
            
            // 为扫码识别成功添加特殊样式
            if (message.includes('成功识别')) {
                toastElement.style.fontWeight = 'bold';
                toastElement.style.fontSize = '1.1em';
                toastElement.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
                toastElement.style.border = '1px solid rgba(255, 255, 255, 0.3)';
            }
            break;
    }
    
    toastElement.textContent = message;
    toastContainer.appendChild(toastElement);
    
    // 增加样式使Toast显示在屏幕中间
    toastElement.style.position = 'fixed';
    toastElement.style.top = '50%';
    toastElement.style.left = '50%';
    toastElement.style.transform = 'translate(-50%, -50%)';
    toastElement.style.zIndex = '9999';
    toastElement.style.minWidth = '200px';
    toastElement.style.textAlign = 'center';
    toastElement.style.borderRadius = '8px';
    toastElement.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.3)';
    
    // 自动关闭
    setTimeout(() => {
        toastElement.style.opacity = '0';
        toastElement.style.transition = 'opacity 0.3s ease';
        setTimeout(() => {
            toastContainer.removeChild(toastElement);
        }, 300);
    }, duration);
}

// 日期格式化
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
}

// 获取当前时间ISO字符串
function getCurrentISOTimeString() {
    return new Date().toISOString();
}

// ------ 扫码相关功能 ------

// 启动扫码
function startScan(processType, isContinuous) {
    // 重置扫码状态
    scanState.processType = processType;
    scanState.isContinuous = isContinuous;
    scanState.pendingCodes = [];
    scanState.lastScannedCode = '';
    scanState.isProcessing = false;
    
    // 获取工序的中文名称
    const processName = getChineseProcessName(processType);
    
    // 更新UI
    document.getElementById('scan-title').innerHTML = `<span style="color:#8a2be2; font-weight:bold; font-size:1.3rem;">扫码工序: <span class="process-highlight">${processName}</span></span>`;
    
    // 连续扫码模式显示上传按钮和待上传列表
    if (isContinuous) {
        document.getElementById('scan-upload').classList.remove('d-none');
        document.getElementById('scan-pending-list').classList.remove('d-none');
        document.getElementById('pending-codes-list').innerHTML = '';
        document.getElementById('pending-count').textContent = '0';
    } else {
        document.getElementById('scan-upload').classList.add('d-none');
        document.getElementById('scan-pending-list').classList.add('d-none');
    }
    
    // 显示扫码界面前先清理
    cleanup();
    showScreen(SCREENS.SCAN);
    
    // 初始化扫码器
    initializeScanner();
    
    // 确保浮动工序框在扫码页面也显示
    createFloatingProcess();
}

// 初始化扫码器
function initializeScanner() {
    const scannerContainer = document.getElementById('scanner-container');
    
    // 确保容器为空
    scannerContainer.innerHTML = '';
    
    // 创建扫码器
    const html5QrCode = new Html5Qrcode("scanner-container");
    scanState.currentHtml5QrScanner = html5QrCode;
    
    // 为所有类型扫码增加手动输入功能
    addManualInputField();
    
    // 添加扫码帮助提示
    addScanningHelpTips();
    
    // 根据扫码类型选择回调函数
    const successCallback = (scanState.processType === 'query') 
        ? onProductQueryScanSuccess
        : onScanSuccess;
    
    // 先检测设备性能，为低端设备使用更简单的配置
    checkDevicePerformance().then(isLowEndDevice => {
        // 扫码配置 - 针对低端设备优化参数
        const config = {
            fps: isLowEndDevice ? 5 : 10,
            qrbox: isLowEndDevice ? 300 : { width: 280, height: 280 },
            aspectRatio: 1.0,
            disableFlip: false, // 允许翻转以提高识别率
            formatsToSupport: isLowEndDevice ? 
                [Html5QrcodeSupportedFormats.QR_CODE, Html5QrcodeSupportedFormats.CODE_128] : 
                [Html5QrcodeSupportedFormats.QR_CODE, Html5QrcodeSupportedFormats.CODE_128, 
                Html5QrcodeSupportedFormats.EAN_13, Html5QrcodeSupportedFormats.CODE_39, 
                Html5QrcodeSupportedFormats.DATA_MATRIX],
            experimentalFeatures: {
                useBarCodeDetectorIfSupported: true // 使用浏览器原生条形码检测器
            },
            rememberLastUsedCamera: true, // 记住上次使用的摄像头
            supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA], // 只使用摄像头扫描
            videoConstraints: {
                width: { ideal: isLowEndDevice ? 640 : 1280, min: 640 },
                height: { ideal: isLowEndDevice ? 480 : 720, min: 480 },
                facingMode: "environment",
                advanced: [
                    { focusMode: "continuous" },
                    { exposureMode: "continuous" },
                    { whiteBalanceMode: "continuous" }
                ]
            }
        };
        
        // 启动扫码
        startScanner(html5QrCode, config, successCallback);
    });
}

// 启动扫码器
function startScanner(html5QrCode, config, successCallback) {
    // 先清理旧的扫码会话
    if (html5QrCode.isScanning) {
        html5QrCode.stop().catch(err => console.error('停止旧的扫码会话失败:', err));
    }
    
    // 显示加载提示
    showToast('正在启动摄像头...', 'info', 2000);
    
    // 启动扫码
    html5QrCode.start(
        { facingMode: "environment" },
        config,
        successCallback,
        onScanFailure
    ).then(() => {
        console.log('扫码器启动成功');
    }).catch(err => {
        console.error(`无法启动相机: ${err}`);
        showToast('无法启动相机，请检查权限设置', 'error');
        
        // 添加错误恢复机制
        setTimeout(() => {
            try {
                // 如果启动失败，尝试使用更简单的配置重试
                const simpleConfig = {
                    fps: 5,
                    qrbox: 250,
                    formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE, Html5QrcodeSupportedFormats.CODE_128]
                };
                html5QrCode.start({ facingMode: "environment" }, simpleConfig, successCallback, onScanFailure)
                .then(() => {
                    console.log('使用简化配置启动扫码器成功');
                });
            } catch (retryErr) {
                console.error('重试启动相机失败:', retryErr);
                
                // 如果相机完全无法启动，显示仅手动输入模式提示
                showToast('相机无法启动，请使用手动输入模式', 'warning', 5000);
                
                // 确保手动输入区域可见
                const manualInputContainer = document.getElementById('manual-input-container');
                if (manualInputContainer) {
                    manualInputContainer.style.display = 'block';
                    manualInputContainer.style.marginTop = '20px';
                    manualInputContainer.style.marginBottom = '20px';
                    
                    // 添加明显提示
                    const helpText = document.createElement('div');
                    helpText.className = 'alert alert-info';
                    helpText.innerHTML = '<strong>提示：</strong> 相机无法启动，请使用手动输入产品编码';
                    manualInputContainer.prepend(helpText);
                }
            }
        }, 1000);
    });
}

// 检测设备性能
async function checkDevicePerformance() {
    try {
        // 使用简单的性能检测
        const start = performance.now();
        let counter = 0;
        
        // 执行一些计算来测试设备性能
        for (let i = 0; i < 1000000; i++) {
            counter += Math.sqrt(i);
        }
        
        const duration = performance.now() - start;
        console.log(`性能测试耗时: ${duration}ms`);
        
        // 如果计算时间超过100毫秒，认为是低端设备
        return duration > 100;
    } catch (error) {
        console.error('性能检测失败:', error);
        return false; // 默认不是低端设备
    }
}

// 切换闪光灯状态
async function toggleTorch(scanner, button) {
    // 空函数，闪光灯功能已移除
    console.log('闪光灯功能已禁用');
}

// 为所有类型扫码增加手动输入功能
function addManualInputField() {
    // 移除已存在的手动输入框，确保不重复创建
    const existingInputs = document.querySelectorAll('#manual-input-container');
    existingInputs.forEach(container => container.remove());
    
    // 获取扫码容器
    const scannerContainer = document.getElementById('scanner-container');
    if (!scannerContainer) return;
    
    // 创建并添加手动输入框
    const manualInputContainer = document.createElement('div');
    manualInputContainer.className = 'mb-3';
    manualInputContainer.id = 'manual-input-container';
    manualInputContainer.innerHTML = `
        <div class="input-group mb-3">
            <input type="text" class="form-control form-control-lg" id="manual-product-code" placeholder="手动输入产品编码">
            <button class="btn btn-primary btn-lg" id="submit-manual-code" type="button">确认</button>
        </div>
    `;
    
    // 添加到扫码容器之后
    scannerContainer.parentNode.insertBefore(manualInputContainer, scannerContainer.nextSibling);
    
    // 添加手动输入事件
    const submitButton = document.getElementById('submit-manual-code');
    const inputField = document.getElementById('manual-product-code');
    
    if (submitButton && inputField) {
        // 点击确认按钮
        submitButton.addEventListener('click', handleManualCodeInput);
        
        // 按回车确认
        inputField.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                handleManualCodeInput();
            }
        });
    }
}

// 添加扫码帮助提示
function addScanningHelpTips() {
    const scannerContainer = document.getElementById('scanner-container');
    if (!scannerContainer || !scannerContainer.parentNode) return;
    
    const helpTipsContainer = document.createElement('div');
    helpTipsContainer.className = 'alert alert-info mt-2';
    helpTipsContainer.innerHTML = `
        <h5 class="mb-2">扫码技巧:</h5>
        <ul class="mb-0">
            <li>保持设备稳定，避免晃动</li>
            <li>确保产品条码在框内，光线充足</li>
            <li>如扫码失败，可尝试手动输入</li>
        </ul>
    `;
    
    // 添加到扫码容器之后
    scannerContainer.parentNode.insertBefore(helpTipsContainer, scannerContainer.nextSibling);
}

// 处理手动输入的产品码
function handleManualCodeInput() {
    const inputField = document.getElementById('manual-product-code');
    if (!inputField) return;
    
    const productCode = inputField.value.trim();
    if (!productCode) {
        showToast('请输入产品编码', 'warning');
        return;
    }
    
    // 根据当前模式处理手动输入的码
    if (scanState.processType === 'query') {
        // 产品查询模式
        handleManualInput();
    } else {
        // 扫码模式 - 模拟扫码成功
        onScanSuccess(productCode, { result: { text: productCode } });
    }
    
    // 清空输入框
    inputField.value = '';
}

// 扫码成功回调
async function onScanSuccess(decodedText, decodedResult) {
    // 如果正在处理，忽略新的扫码结果
    if (scanState.isProcessing) return;
    
    // 防抖处理 - 检查是否是重复扫码
    const now = Date.now();
    // 忽略1秒内的重复扫码
    if (decodedText === scanState.lastScannedCode && now - scanState.lastScanTime < 1000) return;
    
    scanState.isProcessing = true;
    scanState.lastScannedCode = decodedText;
    scanState.lastScanTime = now;
    
    // 立即显示成功识别提示
    showToast(`成功识别: ${decodedText}`, 'info');
    
    // 播放识别成功提示音 - 使用更轻量的方式
    playSuccessBeep();
    
    // 处理扫码结果
    if (scanState.isContinuous) {
        // 连续扫码模式，添加到待上传列表
        if (!scanState.pendingCodes.includes(decodedText)) {
            scanState.pendingCodes.push(decodedText);
            
            // 使用防抖方式更新UI
            if (!window.pendingUpdateTimer) {
                window.pendingUpdateTimer = setTimeout(() => {
                    updatePendingList();
                    window.pendingUpdateTimer = null;
                }, 100);
            }
            
            showToast(`已添加到队列: ${decodedText}`, 'success');
        } else {
            showToast('该产品已在队列中，请勿重复扫码', 'warning');
            playErrorSound();
        }
        
        // 立即释放处理锁，允许下一次扫码
        scanState.isProcessing = false;
    } else {
        // 单次扫码模式，直接上传
        try {
            const success = await updateProductProcess(decodedText, scanState.processType, userState.fullName);
            
            if (success) {
                // 播放成功提示音
                playSuccessBeep();
                
                showToast(`${getChineseProcessName(scanState.processType)}数据更新成功: ${decodedText}`, 'success');
                
                // 修改：单次扫码成功后直接返回主页
                setTimeout(() => {
                    stopScanner().then(() => {
                        // 返回主页
                        showScreen(SCREENS.HOME);
                    }).catch(error => {
                        console.error('停止扫码器失败:', error);
                        // 即使出错也返回主页
                        showScreen(SCREENS.HOME);
                    });
                }, 1000);
            } else {
                // 播放错误提示音
                playErrorSound();
                showToast('该产品的该工序已存在，请勿重复扫码', 'error');
                
                // 失败后也释放锁，这样用户可以立即重试
                setTimeout(() => {
                    scanState.isProcessing = false;
                }, 500);
            }
        } catch (error) {
            console.error('处理扫码结果失败:', error);
            playErrorSound();
            showToast('处理失败，请重试', 'error');
            
            // 确保失败后也释放锁
            setTimeout(() => {
                scanState.isProcessing = false;
            }, 500);
        }
    }
}

// 更高效的成功提示音
function playSuccessBeep() {
    // 使用AudioContext API更高效地播放提示音
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.value = 1800; // 使用更高的频率提高识别度
        gainNode.gain.value = 0.1; // 保持较低的音量
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.08); // 更短的提示音时长
        
        // 添加渐变效果以避免爆音
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
        
        // 完成后关闭AudioContext以释放资源
        setTimeout(() => {
            audioCtx.close();
        }, 100);
    } catch (e) {
        console.log('播放提示音失败:', e);
    }
}

// 扫码失败回调
function onScanFailure(error) {
    // 忽略一般的"未识别到码"错误，避免频繁提示
    if (error && error.message && error.message.includes("No QR code found")) {
        return;
    }
    
    // 检查如果是摄像头权限错误
    if (error && error.message && (
        error.message.includes("permission") || 
        error.message.includes("权限") ||
        error.message.includes("NotAllowedError")
    )) {
        console.error("相机权限错误:", error);
        showToast("请授予相机访问权限", "error");
        return;
    }
    
    // 设备问题
    if (error && error.message && (
        error.message.includes("device") ||
        error.message.includes("设备") ||
        error.message.includes("NotFoundError") ||
        error.message.includes("NotReadableError")
    )) {
        console.error("设备错误:", error);
        showToast("无法访问相机设备，请尝试重新加载或检查设备", "error");
        return;
    }
    
    // 其他错误
    if (error) {
        // 仅记录日志，不显示提示，以免干扰用户
        console.error("扫码失败:", error);
    }
}

// 停止扫码并返回
function stopScan() {
    console.log("停止扫码，当前扫码类型:", scanState.processType);
    
    // 如果是连续扫码模式且有待上传的数据，询问是否放弃上传
    if (scanState.isContinuous && scanState.pendingCodes.length > 0) {
        if (confirm('是否放弃上传？')) {
            scanState.pendingCodes = [];
            cleanupScanResources(); // 使用统一的清理函数
            // 修改：直接返回主页
            showScreen(SCREENS.HOME);
        }
    } else {
        cleanupScanResources(); // 使用统一的清理函数
        // 修改：直接返回主页
        showScreen(SCREENS.HOME);
    }
}

// 清理扫码相关资源
function cleanupScanResources() {
    // 停止扫码器
    if (scanState.currentHtml5QrScanner) {
        stopScanner().then(() => {
            console.log("扫码器已停止");
            
            // 只有在非查询模式下才移除手动输入框
            if (scanState.processType !== 'query') {
                const existingInputs = document.querySelectorAll('#manual-input-container');
                existingInputs.forEach(element => element.remove());
            }
        }).catch(error => {
            console.error('停止扫码器出错:', error);
        });
    } else {
        console.log("没有活动的扫码器");
    }
}

// 停止扫码器
function stopScanner() {
    if (scanState.currentHtml5QrScanner) {
        // 首先清除所有捕获的流
        try {
            const videoElement = document.querySelector("#scanner-container video");
            if (videoElement && videoElement.srcObject) {
                const tracks = videoElement.srcObject.getTracks();
                tracks.forEach(track => track.stop());
                videoElement.srcObject = null;
            }
        } catch (e) {
            console.log('清理视频流失败:', e);
        }
        
        // 移除闪光灯按钮
        const torchButton = document.getElementById('torch-button');
        if (torchButton) {
            torchButton.remove();
        }
        
        return new Promise((resolve, reject) => {
            scanState.currentHtml5QrScanner.stop()
                .then(() => {
                    console.log('扫码器已停止');
                    
                    // 只有在非查询模式下才移除手动输入框
                    if (document.getElementById(SCREENS.SCAN).classList.contains('d-none') === false && scanState.processType !== 'query') {
                        const existingInputs = document.querySelectorAll('#manual-input-container');
                        existingInputs.forEach(element => element.remove());
                    }
                    
                    // 释放资源
                    scanState.currentHtml5QrScanner = null;
                    resolve();
                })
                .catch(err => {
                    console.error('停止扫码器失败:', err);
                    scanState.currentHtml5QrScanner = null;
                    reject(err);
                });
        });
    }
    return Promise.resolve(); // 如果没有扫码器，直接返回已解决的Promise
}

// 更新待上传列表
function updatePendingList() {
    const listElement = document.getElementById('pending-codes-list');
    const countElement = document.getElementById('pending-count');
    
    // 清空列表
    listElement.innerHTML = '';
    
    // 添加新项目
    scanState.pendingCodes.forEach((code, index) => {
        const listItem = document.createElement('li');
        listItem.className = 'list-group-item pending-item';
        
        const codeSpan = document.createElement('span');
        codeSpan.textContent = code;
        
        const badgeSpan = document.createElement('span');
        badgeSpan.className = 'badge bg-primary';
        badgeSpan.textContent = `#${index + 1}`;
        
        listItem.appendChild(codeSpan);
        listItem.appendChild(badgeSpan);
        listElement.appendChild(listItem);
    });
    
    // 更新计数
    countElement.textContent = scanState.pendingCodes.length.toString();
}

// 上传所有待处理的产品编码
async function uploadPendingCodes() {
    if (scanState.pendingCodes.length === 0) {
        showToast('没有待上传的数据', 'warning');
        return;
    }
    
    // 禁用上传按钮
    const uploadButton = document.getElementById('scan-upload');
    uploadButton.disabled = true;
    uploadButton.textContent = '上传中...';
    
    // 显示上传中提示
    showToast('上传中，请稍候...', 'info');
    
    try {
        // 批量更新产品信息
        const results = await batchUpdateProductProcess(
            scanState.pendingCodes,
            scanState.processType,
            userState.fullName
        );
        
        // 统计成功和失败的数量
        const successCount = results.filter(r => r.success).length;
        const failureCount = results.filter(r => !r.success).length;
        
        // 显示结果
        if (successCount > 0 && failureCount === 0) {
            showToast(`所有${successCount}个产品更新成功`, 'success');
        } else if (successCount > 0 && failureCount > 0) {
            showToast(`${successCount}个产品更新成功，${failureCount}个产品更新失败`, 'warning');
        } else {
            showToast('所有产品更新失败', 'error');
        }
        
        // 清空待上传列表
        scanState.pendingCodes = [];
        updatePendingList();
        
        // 延迟返回
        setTimeout(() => {
            stopScanner();
            showScreen(SCREENS.CONTINUOUS_SCAN);
        }, 2000);
    } catch (error) {
        console.error('上传失败:', error);
        showToast('上传失败，请重试', 'error');
    } finally {
        // 恢复上传按钮
        uploadButton.disabled = false;
        uploadButton.textContent = '上传';
    }
}

// 将英文工序名转换为中文
function getChineseProcessName(processType) {
    switch (processType) {
        case 'wiring': return '绕线';
        case 'embedding': return '嵌线';
        case 'wiring_connect': return '接线';
        case 'pressing': return '压装';
        case 'stopper': return '车止口';
        case 'immersion': return '浸漆';
        default: return processType;
    }
}

// 播放成功提示音
function playSuccessSound() {
    try {
        // 创建简短的提示音
        const context = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.value = 1200; // 高频提示音
        gainNode.gain.value = 0.1; // 降低音量
        
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);
        
        // 短促的提示音
        oscillator.start(context.currentTime);
        oscillator.stop(context.currentTime + 0.15);
        
        // 淡出效果
        gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.15);
    } catch (e) {
        console.log('播放提示音失败:', e);
    }
}

// 播放错误提示音
function playErrorSound() {
    try {
        // 创建错误提示音
        const context = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.value = 400; // 低频警告音
        gainNode.gain.value = 0.1; // 降低音量
        
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);
        
        // 短促的错误音
        oscillator.start(context.currentTime);
        oscillator.stop(context.currentTime + 0.3);
        
        // 频率变化
        oscillator.frequency.exponentialRampToValueAtTime(200, context.currentTime + 0.3);
        
        // 淡出效果
        gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.3);
    } catch (e) {
        console.log('播放错误提示音失败:', e);
    }
}

// ------ Supabase数据操作 ------

// 更新产品信息
async function updateProductProcess(productCode, processType, employeeName) {
    try {
        // 确定字段名称
        const { employeeField, timeField } = getProcessFields(processType);
        
        // 准备请求数据
        const updateData = {
            productCode: productCode,
            processType: processType,
            employeeName: employeeName,
            timeField: timeField,
            employeeField: employeeField,
            timestamp: getCurrentISOTimeString()
        };
        
        // 发送HTTP请求到API
        const response = await fetch(`${HTTP_API_URL}/api/updateProductProcess`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updateData)
        });
        
        // 即使服务器返回400错误，我们也尝试解析响应
        const result = await response.json().catch(e => {
            console.error('解析响应失败:', e);
            return { success: false, error: '网络错误' };
        });
        
        // 不再检查response.ok，而是检查返回的result对象
        if (result.success) {
            return true;
        }
        
        // 如果是404错误，说明产品不存在，应该创建新产品
        if (response.status === 404) {
            console.log('产品不存在，将创建新产品:', productCode);
            
            // 再次发送请求，这次添加一个特殊标记，表示需要创建新产品
            updateData.createIfNotExists = true;
            
            const createResponse = await fetch(`${HTTP_API_URL}/api/updateProductProcess`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updateData)
            });
            
            const createResult = await createResponse.json().catch(e => {
                console.error('解析创建响应失败:', e);
                return { success: false };
            });
        
            return createResult.success === true;
        }
        
        console.error('更新产品信息失败:', result.error || '未知错误');
        return false;
    } catch (error) {
        console.error('更新产品信息失败:', error);
        return false;
    }
}

// 批量更新产品信息
async function batchUpdateProductProcess(productCodes, processType, employeeName) {
    const results = [];
    
    // 准备请求数据
    const batchData = {
        productCodes: productCodes,
        processType: processType,
        employeeName: employeeName
    };
    
    try {
        // 发送HTTP请求到API
        const response = await fetch(`${HTTP_API_URL}/api/batchUpdateProductProcess`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(batchData)
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            console.error('批量更新产品信息失败:', result.error);
            return productCodes.map(code => ({ code, success: false }));
        }
        
        return result.results;
        } catch (error) {
        console.error('批量更新产品信息失败:', error);
        return productCodes.map(code => ({ code, success: false }));
        }
}

// 获取工序对应的字段名
function getProcessFields(processType) {
    let employeeField = '';
    let timeField = '';
    
    const processName = getChineseProcessName(processType);
    
    switch (processName) {
        case '绕线':
            employeeField = '绕线员工';
            timeField = '绕线时间';
            break;
        case '嵌线':
            employeeField = '嵌线员工';
            timeField = '嵌线时间';
            break;
        case '接线':
            employeeField = '接线员工';
            timeField = '接线时间';
            break;
        case '压装':
            employeeField = '压装员工';
            timeField = '压装时间';
            break;
        case '车止口':
            employeeField = '车止口员工';
            timeField = '车止口时间';
            break;
        case '浸漆':
            timeField = '浸漆时间';
            employeeField = '浸漆员工'; // 修正：浸漆也有员工字段
            break;
        default:
            break;
    }
    
    return { employeeField, timeField };
}

// 查询产品详情
async function getProductDetails(productCode) {
    try {
        const response = await fetch(`${HTTP_API_URL}/api/getProductDetails?productCode=${encodeURIComponent(productCode)}`);
        
        if (!response.ok) {
            console.error('查询产品详情失败:', response.statusText);
            return null;
        }
        
        const result = await response.json();
        return result.data;
    } catch (error) {
        console.error('查询产品详情失败:', error);
        return null;
    }
}

// ------ 查询相关功能 ------

// 处理产品查询
async function handleProductQuery() {
    try {
        // 获取本月范围
        await getMonthRange();
        
        // 显示查询屏幕
        showScreen(SCREENS.QUERY);
        
        // 清除任何可能存在的删除按钮
        const deleteButtonsContainer = document.getElementById('fixed-delete-buttons');
        if (deleteButtonsContainer) {
            deleteButtonsContainer.remove();
        }
        
        // 恢复原有的返回按钮（如果已被删除）
        const queryContent = document.getElementById('query-content');
        if (!document.getElementById('query-back')) {
            // 确保我们添加返回按钮
            const originalBackButton = document.querySelector('#query-screen button#query-back');
            if (!originalBackButton) {
                const backButtonDiv = document.createElement('div');
                backButtonDiv.innerHTML = '<button class="btn btn-secondary mt-3 w-100" id="query-back">返回</button>';
                document.querySelector('#query-screen .card-body').appendChild(backButtonDiv);
                
                // 添加事件监听器
                document.getElementById('query-back').addEventListener('click', () => showScreen(SCREENS.HOME));
            }
        }
        
        // 确保流水账容器可见
        document.getElementById('monthly-transactions-container').style.display = 'block';
        
        // 查询并显示用户本月完成的产品工序统计
        await loadUserMonthlyProcesses();
        
        // 加载本月流水账
        await loadMonthlyTransactionList();
    } catch (error) {
        console.error('获取产品查询数据失败:', error);
        showToast('获取数据失败，请重试', 'error');
    }
}

// 处理产品扫码查询
async function handleProductScanQuery() {
    // 停止可能存在的扫码器
    if (scanState.currentHtml5QrScanner) {
        await stopScanner();
    }
    
    // 不再移除手动输入框
    
    // 启动扫码查询
    startProductScanQuery();
}

// 启动产品扫码查询
function startProductScanQuery() {
    // 清空当前状态
    scanState.processType = 'query';
    scanState.isContinuous = false;
    scanState.pendingCodes = [];
    scanState.lastScannedCode = '';
    scanState.isProcessing = false;
    
    // 清理界面并显示扫码界面
    // 先停止已有的扫码器
    if (scanState.currentHtml5QrScanner) {
        scanState.currentHtml5QrScanner.stop().catch(err => {
            console.error('停止扫码器失败:', err);
        });
        scanState.currentHtml5QrScanner = null;
    }
    
    // 获取扫码容器
    const scannerContainer = document.getElementById('scanner-container');
    if (scannerContainer) {
        scannerContainer.innerHTML = '';
    }
    
    // 更新UI
    document.getElementById('scan-title').textContent = '产品扫码查询';
    document.getElementById('scan-upload').classList.add('d-none');
    document.getElementById('scan-pending-list').classList.add('d-none');
    
    // 显示扫码界面
    showScreen(SCREENS.SCAN);
    
    // 移除已存在的手动输入框，确保不重复创建
    const existingInputs = document.querySelectorAll('#manual-input-container');
    existingInputs.forEach(container => container.remove());
    
    // 创建并添加手动输入框
    const manualInputContainer = document.createElement('div');
    manualInputContainer.className = 'mb-3';
    manualInputContainer.id = 'manual-input-container';
    manualInputContainer.innerHTML = `
        <div class="input-group mb-3">
            <input type="text" class="form-control" id="manual-product-code" placeholder="手动输入产品编码">
            <button class="btn btn-primary" id="submit-manual-code" type="button">查询</button>
        </div>
    `;
    
    // 确保找到scannerContainer及其父元素
    if (scannerContainer && scannerContainer.parentNode) {
    scannerContainer.parentNode.insertBefore(manualInputContainer, scannerContainer);
        console.log('手动输入框已添加');
    } else {
        console.error('无法找到scannerContainer或其父元素，无法添加手动输入框');
        // 尝试添加到扫码屏幕
        const scanScreen = document.getElementById(SCREENS.SCAN);
        if (scanScreen) {
            // 查找一个合适的容器来放置输入框
            const container = scanScreen.querySelector('.container') || scanScreen;
            container.insertBefore(manualInputContainer, container.firstChild);
            console.log('手动输入框已添加到扫码屏幕');
        }
    }
    
    // 添加手动输入事件
    const submitButton = document.getElementById('submit-manual-code');
    const inputField = document.getElementById('manual-product-code');
    
    if (submitButton && inputField) {
        // 移除之前可能存在的事件监听器
        const newSubmitButton = submitButton.cloneNode(true);
        submitButton.parentNode.replaceChild(newSubmitButton, submitButton);
        
        const newInputField = inputField.cloneNode(true);
        inputField.parentNode.replaceChild(newInputField, inputField);
        
        // 点击查询按钮
        newSubmitButton.addEventListener('click', handleManualInput);
        
        // 按回车查询
        newInputField.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                handleManualInput();
            }
        });
        
        console.log('手动输入事件已添加');
    } else {
        console.error('无法找到提交按钮或输入字段');
    }
    
    // 初始化扫码器
    initializeScanner();
    
    // 确保手动输入框可见
    setTimeout(() => {
        const inputContainer = document.getElementById('manual-input-container');
        if (inputContainer) {
            inputContainer.style.display = 'block';
            inputContainer.style.visibility = 'visible';
            inputContainer.style.opacity = '1';
        }
    }, 500);
}

// 清理函数 - 避免移除产品扫码查询的输入框
function cleanup() {
    // 如果当前不是扫码查询页面，才移除手动输入框
    if (scanState.processType !== 'query') {
        const inputContainers = document.querySelectorAll('#manual-input-container');
        inputContainers.forEach(container => container.remove());
    }
    
    // 清空扫码容器
    const scannerContainer = document.getElementById('scanner-container');
    if (scannerContainer) {
        scannerContainer.innerHTML = '';
    }
}

// 处理手动输入
async function handleManualInput() {
        const productCode = document.getElementById('manual-product-code').value.trim();
        if (!productCode) {
            showToast('请输入产品编码', 'warning');
            return;
        }
        
        try {
            // 模拟扫码成功处理
            scanState.isProcessing = true;
            
            // 查询产品详情
            const productData = await getProductDetails(productCode);
            
            if (productData) {
                // 播放成功提示音
                playSuccessSound();
                
                // 显示产品详情
                showProductDetail(productData);
                
                // 清空输入框
                document.getElementById('manual-product-code').value = '';
            } else {
                // 播放错误提示音
                playErrorSound();
                
                showToast('未找到该产品信息', 'error');
            }
        } catch (error) {
            console.error('查询产品信息失败:', error);
            showToast('查询失败，请重试', 'error');
            playErrorSound();
        } finally {
            // 延迟重置处理状态
            setTimeout(() => {
                scanState.isProcessing = false;
            }, 1000);
        }
}

// 产品查询扫码成功回调
async function onProductQueryScanSuccess(decodedText, decodedResult) {
    // 如果正在处理，忽略新的扫码结果
    if (scanState.isProcessing) return;
    
    // 防抖处理 - 检查是否是重复扫码
    const now = Date.now();
    // 忽略1秒内的重复扫码
    if (decodedText === scanState.lastScannedCode && now - scanState.lastScanTime < 1000) return;
    
    scanState.isProcessing = true;
    scanState.lastScannedCode = decodedText;
    scanState.lastScanTime = now;
    
    // 立即显示成功识别提示
    showToast(`成功识别产品码: ${decodedText}`, 'info');
    
    // 播放识别成功提示音
    playSuccessBeep();
    
    try {
        // 使用缓存机制查询产品详情
        const productData = await getCachedProductDetails(decodedText);
        
        if (productData) {
            // 播放成功提示音
            playSuccessBeep();
            
            // 显示产品详情
            showProductDetail(productData);
            
            // 延迟重置处理状态，但不要太长
            setTimeout(() => {
                scanState.isProcessing = false;
            }, 500);
        } else {
            // 播放错误提示音
            playErrorSound();
            
            showToast('未找到该产品信息', 'error');
            
            // 延迟重置处理状态，但时间短一些以便用户可以快速重试
            setTimeout(() => {
                scanState.isProcessing = false;
            }, 300);
        }
    } catch (error) {
        console.error('查询产品信息失败:', error);
        showToast('查询失败，请重试', 'error');
        playErrorSound();
        
        // 延迟重置处理状态
        setTimeout(() => {
            scanState.isProcessing = false;
        }, 300);
    }
}

// 带缓存的产品详情查询
const productDetailsCache = new Map();

async function getCachedProductDetails(productCode) {
    // 检查缓存中是否有数据
    if (productDetailsCache.has(productCode)) {
        const cachedData = productDetailsCache.get(productCode);
        // 检查缓存是否过期（1小时）
        if (Date.now() - cachedData.timestamp < 3600000) {
            return cachedData.data;
        }
    }
    
    // 缓存中没有数据或已过期，从API获取
    try {
        const productData = await getProductDetails(productCode);
        if (productData) {
            // 存入缓存
            productDetailsCache.set(productCode, {
                data: productData,
                timestamp: Date.now()
            });
            
            // 控制缓存大小，最多保存100条记录
            if (productDetailsCache.size > 100) {
                // 删除最旧的缓存记录
                const firstKey = productDetailsCache.keys().next().value;
                if (firstKey) {
                    productDetailsCache.delete(firstKey);
                }
            }
        }
        return productData;
    } catch (error) {
        console.error('获取产品详情失败:', error);
        return null;
    }
}

// 显示产品详情
function showProductDetail(product) {
    try {
        console.log('显示产品详情:', product['产品编码']);
        
    // 创建产品详情内容
    const productDetailContent = document.getElementById('product-detail-content');
        if (!productDetailContent) {
            console.error('未找到产品详情内容容器');
            return;
        }
        
    productDetailContent.innerHTML = '';
    
    // 产品编码
    if (product['产品编码']) {
        const codeDiv = document.createElement('div');
        codeDiv.className = 'product-detail-item';
        codeDiv.innerHTML = `<div class="product-detail-label">产品编码:</div><div>${product['产品编码']}</div>`;
        productDetailContent.appendChild(codeDiv);
    }
    
    // 产品型号
    if (product['产品型号']) {
        const modelDiv = document.createElement('div');
        modelDiv.className = 'product-detail-item';
        modelDiv.innerHTML = `<div class="product-detail-label">产品型号:</div><div>${product['产品型号']}</div>`;
        productDetailContent.appendChild(modelDiv);
    }
    
    // 绕线信息
    if (product['绕线员工'] || product['绕线时间']) {
        const wiringDiv = document.createElement('div');
        wiringDiv.className = 'product-detail-item';
        wiringDiv.innerHTML = `
            <div class="product-detail-label">绕线:</div>
            <div>
                ${product['绕线员工'] ? '员工: ' + product['绕线员工'] : ''}
                ${product['绕线时间'] ? '<br>时间: ' + formatDate(product['绕线时间']) : ''}
            </div>
        `;
        productDetailContent.appendChild(wiringDiv);
    }
    
    // 嵌线信息
    if (product['嵌线员工'] || product['嵌线时间']) {
        const embeddingDiv = document.createElement('div');
        embeddingDiv.className = 'product-detail-item';
        embeddingDiv.innerHTML = `
            <div class="product-detail-label">嵌线:</div>
            <div>
                ${product['嵌线员工'] ? '员工: ' + product['嵌线员工'] : ''}
                ${product['嵌线时间'] ? '<br>时间: ' + formatDate(product['嵌线时间']) : ''}
            </div>
        `;
        productDetailContent.appendChild(embeddingDiv);
    }
    
    // 接线信息
    if (product['接线员工'] || product['接线时间']) {
        const wiringConnectDiv = document.createElement('div');
        wiringConnectDiv.className = 'product-detail-item';
        wiringConnectDiv.innerHTML = `
            <div class="product-detail-label">接线:</div>
            <div>
                ${product['接线员工'] ? '员工: ' + product['接线员工'] : ''}
                ${product['接线时间'] ? '<br>时间: ' + formatDate(product['接线时间']) : ''}
            </div>
        `;
        productDetailContent.appendChild(wiringConnectDiv);
    }
    
    // 压装信息
    if (product['压装员工'] || product['压装时间']) {
        const pressingDiv = document.createElement('div');
        pressingDiv.className = 'product-detail-item';
        pressingDiv.innerHTML = `
            <div class="product-detail-label">压装:</div>
            <div>
                ${product['压装员工'] ? '员工: ' + product['压装员工'] : ''}
                ${product['压装时间'] ? '<br>时间: ' + formatDate(product['压装时间']) : ''}
            </div>
        `;
        productDetailContent.appendChild(pressingDiv);
    }
    
    // 车止口信息
    if (product['车止口员工'] || product['车止口时间']) {
        const stopperDiv = document.createElement('div');
        stopperDiv.className = 'product-detail-item';
        stopperDiv.innerHTML = `
            <div class="product-detail-label">车止口:</div>
            <div>
                ${product['车止口员工'] ? '员工: ' + product['车止口员工'] : ''}
                ${product['车止口时间'] ? '<br>时间: ' + formatDate(product['车止口时间']) : ''}
            </div>
        `;
        productDetailContent.appendChild(stopperDiv);
    }
    
    // 浸漆信息
        if (product['浸漆时间'] || product['浸漆员工']) {
        const immersionDiv = document.createElement('div');
        immersionDiv.className = 'product-detail-item';
        immersionDiv.innerHTML = `
            <div class="product-detail-label">浸漆:</div>
                <div>
                    ${product['浸漆员工'] ? '员工: ' + product['浸漆员工'] : ''}
                    ${product['浸漆时间'] ? '<br>时间: ' + formatDate(product['浸漆时间']) : ''}
                </div>
        `;
        productDetailContent.appendChild(immersionDiv);
    }
    
    // 半成品检验信息
    if (product['半成品检验时间']) {
        const semiInspectionDiv = document.createElement('div');
        semiInspectionDiv.className = 'product-detail-item';
        semiInspectionDiv.innerHTML = `
            <div class="product-detail-label">半成品检验:</div>
            <div>时间: ${formatDate(product['半成品检验时间'])}</div>
        `;
        productDetailContent.appendChild(semiInspectionDiv);
    }
    
    // 成品检验信息
    if (product['成品检验时间']) {
        const finalInspectionDiv = document.createElement('div');
        finalInspectionDiv.className = 'product-detail-item';
        finalInspectionDiv.innerHTML = `
            <div class="product-detail-label">成品检验:</div>
            <div>时间: ${formatDate(product['成品检验时间'])}</div>
        `;
        productDetailContent.appendChild(finalInspectionDiv);
    }
        
        // 确保模态框元素存在
        const modalElement = document.getElementById('product-detail-modal');
        if (!modalElement) {
            console.error('未找到产品详情模态框');
            return;
    }
    
    // 显示模态框
        try {
            // 首先确保所有其他模态框已隐藏
            hideAllModals();
            
            // 使用我们自定义的Bootstrap Modal类
            const productDetailModal = new bootstrap.Modal(modalElement);
    productDetailModal.show();
        } catch (error) {
            console.error('显示模态框失败:', error);
            
            // 备用方案：使用简单的显示方式
            modalElement.style.display = 'block';
            modalElement.classList.add('show');
        }
    } catch (error) {
        console.error('显示产品详情时出错:', error);
        showToast('显示产品详情失败', 'error');
    }
}

// 获取月份范围
async function getMonthRange() {
    try {
        // 检查缓存是否有效
        const now = new Date().getTime();
        if (appState.monthRangeCache.data && 
            appState.monthRangeCache.timestamp && 
            (now - appState.monthRangeCache.timestamp) < appState.monthRangeCache.maxAge) {
            console.log('使用缓存的月份范围数据');
            // 使用缓存数据
            queryState.monthRange.startDate = new Date(appState.monthRangeCache.data.startDate);
            queryState.monthRange.endDate = new Date(appState.monthRangeCache.data.endDate);
            return true;
        }
        
        // 缓存无效，从API获取月份范围
        const response = await fetch(`${HTTP_API_URL}/api/getMonthRange`);
        
        if (!response.ok) {
            console.error('获取月份范围失败:', response.statusText);
            // 设置默认范围作为备用
            setDefaultMonthRange();
            return true;
        }
        
        const result = await response.json();
        if (result.data && result.data.startDate && result.data.endDate) {
            // 更新应用状态
            queryState.monthRange.startDate = new Date(result.data.startDate);
            queryState.monthRange.endDate = new Date(result.data.endDate);
            
            // 保存到缓存
            appState.monthRangeCache.data = {
                startDate: result.data.startDate,
                endDate: result.data.endDate
            };
            appState.monthRangeCache.timestamp = now;
            
            console.log('从API获取并缓存月份范围:', 
                queryState.monthRange.startDate.toISOString(), '至', 
                queryState.monthRange.endDate.toISOString());
            return true;
        } else {
            // 如果API返回的数据不完整，使用默认范围
            console.warn('API返回的月份范围不完整，使用默认范围');
            setDefaultMonthRange();
            return true;
        }
    } catch (error) {
        console.error('获取月份范围失败:', error);
        setDefaultMonthRange();
        return true;
    }
}

// 设置默认月份范围（本月第一天到最后一天）
function setDefaultMonthRange() {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    queryState.monthRange.startDate = firstDay;
    queryState.monthRange.endDate = lastDay;
    
    console.log('使用默认月份范围:', 
        queryState.monthRange.startDate.toISOString(), '至', 
        queryState.monthRange.endDate.toISOString());
}

// 加载用户本月完成的产品工序统计
async function loadUserMonthlyProcesses() {
    try {
        // 显示加载中
        document.getElementById('process-list').innerHTML = '<div class="text-center my-3"><div class="spinner-border text-primary" role="status"></div><div class="mt-2">加载中...</div></div>';
        
        // 查询用户本月完成的产品
        const products = await getUserMonthlyProducts(
            userState.fullName,
            queryState.monthRange.startDate,
            queryState.monthRange.endDate
        );
        
        if (!products || products.length === 0) {
            document.getElementById('process-list').innerHTML = '<div class="text-center my-3">本月暂无完成的工序</div>';
            return;
        }
        
        // 统计各工序数量
        const processCounts = {
            '绕线': 0,
            '嵌线': 0,
            '接线': 0,
            '压装': 0,
            '车止口': 0,
            '浸漆': 0
        };
        
        // 统计各工序和型号
        const processModels = {
            '绕线': {},
            '嵌线': {},
            '接线': {},
            '压装': {},
            '车止口': {},
            '浸漆': {}
        };
        
        // 统计工序和产品编码
        const processProducts = {
            '绕线': {},
            '嵌线': {},
            '接线': {},
            '压装': {},
            '车止口': {},
            '浸漆': {}
        };
        
        // 处理产品数据
        products.forEach(product => {
            // 检查该用户完成的工序
            if (product['绕线员工'] === userState.fullName && isDateInRange(product['绕线时间'])) {
                processCounts['绕线']++;
                
                // 按型号统计
                if (!processModels['绕线'][product['产品型号']]) {
                    processModels['绕线'][product['产品型号']] = 0;
                }
                processModels['绕线'][product['产品型号']]++;
                
                // 存储产品编码和时间
                if (!processProducts['绕线'][product['产品型号']]) {
                    processProducts['绕线'][product['产品型号']] = [];
                }
                processProducts['绕线'][product['产品型号']].push({
                    code: product['产品编码'],
                    time: product['绕线时间']
                });
            }
            
            if (product['嵌线员工'] === userState.fullName && isDateInRange(product['嵌线时间'])) {
                processCounts['嵌线']++;
                
                // 按型号统计
                if (!processModels['嵌线'][product['产品型号']]) {
                    processModels['嵌线'][product['产品型号']] = 0;
                }
                processModels['嵌线'][product['产品型号']]++;
                
                // 存储产品编码和时间
                if (!processProducts['嵌线'][product['产品型号']]) {
                    processProducts['嵌线'][product['产品型号']] = [];
                }
                processProducts['嵌线'][product['产品型号']].push({
                    code: product['产品编码'],
                    time: product['嵌线时间']
                });
            }
            
            if (product['接线员工'] === userState.fullName && isDateInRange(product['接线时间'])) {
                processCounts['接线']++;
                
                // 按型号统计
                if (!processModels['接线'][product['产品型号']]) {
                    processModels['接线'][product['产品型号']] = 0;
                }
                processModels['接线'][product['产品型号']]++;
                
                // 存储产品编码和时间
                if (!processProducts['接线'][product['产品型号']]) {
                    processProducts['接线'][product['产品型号']] = [];
                }
                processProducts['接线'][product['产品型号']].push({
                    code: product['产品编码'],
                    time: product['接线时间']
                });
            }
            
            if (product['压装员工'] === userState.fullName && isDateInRange(product['压装时间'])) {
                processCounts['压装']++;
                
                // 按型号统计
                if (!processModels['压装'][product['产品型号']]) {
                    processModels['压装'][product['产品型号']] = 0;
                }
                processModels['压装'][product['产品型号']]++;
                
                // 存储产品编码和时间
                if (!processProducts['压装'][product['产品型号']]) {
                    processProducts['压装'][product['产品型号']] = [];
                }
                processProducts['压装'][product['产品型号']].push({
                    code: product['产品编码'],
                    time: product['压装时间']
                });
            }
            
            if (product['车止口员工'] === userState.fullName && isDateInRange(product['车止口时间'])) {
                processCounts['车止口']++;
                
                // 按型号统计
                if (!processModels['车止口'][product['产品型号']]) {
                    processModels['车止口'][product['产品型号']] = 0;
                }
                processModels['车止口'][product['产品型号']]++;
                
                // 存储产品编码和时间
                if (!processProducts['车止口'][product['产品型号']]) {
                    processProducts['车止口'][product['产品型号']] = [];
                }
                processProducts['车止口'][product['产品型号']].push({
                    code: product['产品编码'],
                    time: product['车止口时间']
                });
            }
            
            if (product['浸漆员工'] === userState.fullName && isDateInRange(product['浸漆时间'])) {
                processCounts['浸漆']++;
                // 按型号统计
                if (!processModels['浸漆'][product['产品型号']]) {
                    processModels['浸漆'][product['产品型号']] = 0;
                }
                processModels['浸漆'][product['产品型号']]++;
                // 存储产品编码和时间
                if (!processProducts['浸漆'][product['产品型号']]) {
                    processProducts['浸漆'][product['产品型号']] = [];
                }
                processProducts['浸漆'][product['产品型号']].push({
                    code: product['产品编码'],
                    time: product['浸漆时间']
                });
            }
        });
        
        // 保存查询结果，以便后续使用
        queryState.processModels = processModels;
        queryState.processProducts = processProducts;
        
        // 生成工序列表
        let processListHTML = '';
        
        Object.keys(processCounts).forEach(process => {
            if (processCounts[process] > 0) {
                processListHTML += `
                    <div class="process-item" data-process="${process}">
                        <span>${process}</span>
                        <span class="badge bg-primary rounded-pill">${processCounts[process]}</span>
                    </div>
                `;
            }
        });
        
        if (processListHTML === '') {
            processListHTML = '<div class="text-center my-3">本月暂无完成的工序</div>';
        }
        
        document.getElementById('process-list').innerHTML = processListHTML;
        
        // 添加点击事件，显示型号列表
        document.querySelectorAll('.process-item').forEach(item => {
            item.addEventListener('click', function() {
                const process = this.getAttribute('data-process');
                showModelList(process);
            });
        });
        
        // 加载月度流水账
        loadMonthlyTransactionList();
    } catch (error) {
        console.error('加载用户本月工序统计失败:', error);
        document.getElementById('process-list').innerHTML = '<div class="text-center my-3 text-danger">加载失败，请重试</div>';
    }
}

// 检查日期是否在当前月份范围内
function isDateInRange(dateString, startDate, endDate) {
    if (!dateString) return false;
    
    const date = new Date(dateString);
    
    // 如果没有提供开始和结束日期，使用queryState中的日期范围
    if (!startDate || !endDate) {
        startDate = queryState.monthRange.startDate;
        endDate = queryState.monthRange.endDate;
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // 移除时间部分进行纯日期比较
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    
    return date >= start && date <= end;
}

// 显示型号列表
function showModelList(process) {
    queryState.currentProcess = process;
    
    // 更新标题
    document.getElementById('models-title').textContent = `${process}型号列表`;
    
    // 获取该工序的所有型号
    const models = queryState.processModels[process];
    
    // 生成型号列表
    let modelListHTML = '';
    
    Object.keys(models).forEach(model => {
        if (models[model] > 0) {
            modelListHTML += `
                <div class="model-item" data-model="${model}">
                    <span>${model}</span>
                    <span class="badge bg-success rounded-pill">${models[model]}</span>
                </div>
            `;
        }
    });
    
    if (modelListHTML === '') {
        modelListHTML = '<div class="text-center my-3">暂无型号数据</div>';
    }
    
    document.getElementById('model-list').innerHTML = modelListHTML;
    
    // 添加点击事件，显示产品列表
    document.querySelectorAll('.model-item').forEach(item => {
        item.addEventListener('click', function() {
            const model = this.getAttribute('data-model');
            showProductList(queryState.currentProcess, model);
        });
    });
    
    // 显示型号列表屏幕
    showScreen(SCREENS.MODELS);
}

// 显示产品列表
function showProductList(process, model) {
    queryState.currentModel = model;
    
    // 更新标题
    document.getElementById('products-title').textContent = `${process} - ${model}`;
    
    // 获取该工序和型号的所有产品
    const products = queryState.processProducts[process][model] || [];
    
    // 按时间排序
    products.sort((a, b) => new Date(b.time) - new Date(a.time));
    
    // 生成产品列表
    let productListHTML = '';
    
    products.forEach(product => {
        productListHTML += `
            <div class="product-item" data-code="${product.code}">
                <span>${product.code}</span>
                <span>${formatDate(product.time)}</span>
            </div>
        `;
    });
    
    if (productListHTML === '') {
        productListHTML = '<div class="text-center my-3">暂无产品数据</div>';
    }
    
    document.getElementById('product-list').innerHTML = productListHTML;
    
    // 添加点击事件，查询产品详情
    document.querySelectorAll('.product-item').forEach(item => {
        item.addEventListener('click', async function() {
            const code = this.getAttribute('data-code');
            
            try {
                // 查询产品详情
                const productData = await getProductDetails(code);
                
                if (productData) {
                    // 显示产品详情
                    showProductDetail(productData);
                } else {
                    showToast('未找到该产品信息', 'error');
                }
            } catch (error) {
                console.error('查询产品详情失败:', error);
                showToast('查询失败，请重试', 'error');
            }
        });
    });
    
    // 显示产品列表屏幕
    showScreen(SCREENS.PRODUCTS);
}

// 获取用户本月完成的产品
async function getUserMonthlyProducts(employeeName, startDate, endDate) {
    try {
        // 将日期转换为ISO格式字符串
        const startDateStr = startDate.toISOString();
        const endDateStr = endDate.toISOString();
        
        console.log('查询时间范围:', startDateStr, '至', endDateStr);
        console.log('查询员工:', employeeName);
        
        // 使用HTTP API查询员工完成的产品
        const response = await fetch(`${HTTP_API_URL}/api/getUserMonthlyProducts?employeeName=${encodeURIComponent(employeeName)}&startDate=${encodeURIComponent(startDateStr)}&endDate=${encodeURIComponent(endDateStr)}`);
        
        if (!response.ok) {
            console.error('查询产品失败:', response.statusText);
            return [];
        }
        
        const result = await response.json();
        return result.data || [];
    } catch (error) {
        console.error('获取用户本月产品失败:', error);
        return [];
    }
}

// 获取工序图标
function getProcessIcon(process) {
    let iconClass = '';
    let iconColor = '';
    
    switch (process) {
        case '绕线':
            iconClass = 'bi-rotate-right';
            iconColor = 'text-primary';
            break;
        case '嵌线':
            iconClass = 'bi-cable';
            iconColor = 'text-success';
            break;
        case '接线':
            iconClass = 'bi-power';
            iconColor = 'text-warning';
            break;
        case '压装':
            iconClass = 'bi-compress';
            iconColor = 'text-danger';
            break;
        case '车止口':
            iconClass = 'bi-scissors';
            iconColor = 'text-info';
            break;
        case '浸漆':
            iconClass = 'bi-droplet';
            iconColor = 'text-secondary';
            break;
        default:
            iconClass = 'bi-gear';
            iconColor = 'text-muted';
    }
    
    return `<i class="bi ${iconClass} ${iconColor}" style="font-size: 1.5rem;"></i>`;
}

// 加载本月流水账
async function loadMonthlyTransactionList() {
    try {
        // 获取当前用户信息
        const fullName = localStorage.getItem('user_full_name');
        if (!fullName) {
            console.error('无法获取用户信息');
            document.getElementById('monthly-transactions-container').innerHTML = '<div class="alert alert-warning">无法获取用户信息，请重新登录</div>';
            return;
        }

        // 显示加载提示
        const transactionsContainer = document.getElementById('monthly-transactions-container');
        transactionsContainer.innerHTML = '<div class="text-center"><div class="spinner-border text-primary" role="status"></div><p>数据加载中...</p></div>';

        // 确保容器可见
        transactionsContainer.style.display = 'block';

        // 获取本月范围
        await getMonthRange();

        // 将日期转换为ISO格式字符串
        const startDateStr = queryState.monthRange.startDate.toISOString();
        const endDateStr = queryState.monthRange.endDate.toISOString();

        // 检查缓存是否有效
        const cacheKey = 'monthlyTransactions';
        const cacheParams = `${fullName}_${startDateStr}_${endDateStr}`;
        
        // 如果缓存有效并且参数匹配，直接使用缓存数据
        if (isCacheValid(cacheKey) && dataCache[cacheKey].params === cacheParams) {
            console.log('使用缓存的月度交易数据');
            renderTransactionList(dataCache[cacheKey].data);
            return;
        }
        
        console.log('从API加载月度交易数据');

        // 使用HTTP API查询数据库获取产品记录
        const url = `${HTTP_API_URL}/api/getUserMonthlyTransactions?employeeName=${encodeURIComponent(fullName)}&startDate=${encodeURIComponent(startDateStr)}&endDate=${encodeURIComponent(endDateStr)}`;
        
        // 添加随机查询参数以避免潜在的缓存问题
        const cacheBuster = `&_=${Date.now()}`;
        
        const response = await fetch(url + cacheBuster, {
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });

        if (!response.ok) {
            console.error('加载产品记录失败:', response.statusText);
            transactionsContainer.innerHTML = '<div class="alert alert-danger">加载记录失败，请重试</div>';
            return;
        }

        const result = await response.json();
        const userRecords = result.data || [];
        
        // 更新缓存
        dataCache[cacheKey] = {
            data: userRecords,
            timestamp: new Date(),
            params: cacheParams
        };
        
        // 渲染交易记录列表
        renderTransactionList(userRecords);

    } catch (error) {
        console.error('加载流水账失败:', error);
        document.getElementById('monthly-transactions-container').innerHTML = '<div class="alert alert-danger">加载数据失败，请重试</div>';
    }
}

// 渲染交易记录列表
function renderTransactionList(userRecords) {
    const transactionsContainer = document.getElementById('monthly-transactions-container');

        // 按时间排序（最新的在前）
        userRecords.sort((a, b) => new Date(b.time) - new Date(a.time));

        // 构建HTML表格
        let html = '';
        if (userRecords.length === 0) {
            html = '<div class="alert alert-info">本月无记录</div>';
        } else {
            // 创建一个响应式表格
            html = `
                <div class="table-responsive">
                    <table class="table table-striped table-bordered table-sm">
                        <thead class="table-dark">
                            <tr>
                                <th scope="col">工序</th>
                                <th scope="col">产品编码</th>
                                <th scope="col">型号</th>
                                <th scope="col">时间</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            userRecords.forEach(record => {
                // 格式化时间
                const recordDate = new Date(record.time);
                const formattedDate = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, '0')}-${String(recordDate.getDate()).padStart(2, '0')} ${String(recordDate.getHours()).padStart(2, '0')}:${String(recordDate.getMinutes()).padStart(2, '0')}`;
                
                html += `
                    <tr>
                        <td>${record.process}</td>
                        <td>${record.productCode}</td>
                        <td>${record.model}</td>
                        <td>${formattedDate}</td>
                    </tr>
                `;
            });

            html += `
                        </tbody>
                    </table>
                </div>
            `;
        }

        // 更新DOM
    transactionsContainer.innerHTML = html;
}

// 在showMonthlyQuery函数中添加对loadMonthlyTransactionList的调用
function showMonthlyQuery() {
    showScreen(SCREENS.MONTHLY_QUERY);
    loadCurrentMonthRange();
    displayMonthRange();
    loadUserMonthlyProcesses();
    // 加载本月流水账 - 直接调用优化后的函数
    loadMonthlyTransactionList();
}

// 添加获取产品记录的函数
async function fetchRecords() {
    try {
        // 使用实际的API获取数据
        const response = await fetch(`${HTTP_API_URL}/api/getRecords`);
        
        if (!response.ok) {
            console.error('获取记录失败:', response.statusText);
            showToast('获取记录失败，请重试', 'error');
            // 如果API失败，使用全局变量中的记录作为备用
            return globalRecords;
        }
        
        const result = await response.json();
        return result.data || [];
    } catch (error) {
        console.error('获取记录时出错:', error);
        showToast('加载记录失败，请重试', 'error');
        // 如果API失败，使用全局变量中的记录作为备用
        return globalRecords;
    }
}

// 处理删除记录 - 优化版本
async function handleDeleteRecords() {
    try {
        // 获取本月范围
        await getMonthRange();
        
        // 显示删除记录屏幕
        showScreen(SCREENS.DELETE_RECORDS);
        
        // 显示加载中提示
        const deleteContent = document.getElementById('delete-records-content');
        deleteContent.innerHTML = '<div class="text-center my-3"><div class="spinner-border text-primary" role="status"></div><div class="mt-2">加载中...</div></div>';
        
        // 清空已有的固定按钮容器（如果存在）
        const existingButtonsContainer = document.getElementById('fixed-delete-buttons');
        if (existingButtonsContainer) {
            existingButtonsContainer.remove();
        }
        
        // 创建固定在屏幕底部的按钮容器
        const fixedButtonsContainer = document.createElement('div');
        fixedButtonsContainer.className = 'fixed-bottom bg-white border-top p-2';
        fixedButtonsContainer.id = 'fixed-delete-buttons';
        fixedButtonsContainer.style.boxShadow = '0 -2px 10px rgba(0,0,0,0.1)';
        fixedButtonsContainer.style.zIndex = '1030';
        fixedButtonsContainer.innerHTML = `
            <div class="container">
                <div class="row">
                    <div class="col-6">
                        <button class="btn btn-secondary w-100" id="delete-back-button">返回</button>
                    </div>
                    <div class="col-6">
                        <button class="btn btn-danger w-100" id="delete-selected-records" disabled>
                            删除选中记录
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // 添加到页面
        document.body.appendChild(fixedButtonsContainer);
        
        // 为新的返回按钮添加事件监听器
        document.getElementById('delete-back-button').addEventListener('click', () => {
            // 移除固定按钮容器
            fixedButtonsContainer.remove();
            // 返回到主屏幕
            showScreen(SCREENS.HOME);
            // 清除缓存，确保下次查看时重新加载数据
            dataCache.monthlyTransactions.data = null;
            dataCache.monthlyTransactions.timestamp = null;
        });
        
        // 将日期转换为ISO格式字符串
        const startDateStr = queryState.monthRange.startDate.toISOString();
        const endDateStr = queryState.monthRange.endDate.toISOString();
        
        // 添加随机查询参数以避免潜在的缓存问题
        const cacheBuster = `&_=${Date.now()}`;
        
        // 使用与本月台账查询相同的API获取记录，但不限制用户
        const response = await fetch(`${HTTP_API_URL}/api/getUserMonthlyTransactions?employeeName=${encodeURIComponent(userState.fullName)}&startDate=${encodeURIComponent(startDateStr)}&endDate=${encodeURIComponent(endDateStr)}${cacheBuster}`, {
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
        
        if (!response.ok) {
            console.error('获取记录失败:', response.statusText);
            deleteContent.innerHTML = '<div class="alert alert-danger">获取记录失败，请重试</div>';
            return;
        }
        
        const result = await response.json();
        const records = result.data || [];
        
        if (records.length === 0) {
            deleteContent.innerHTML = '<div class="alert alert-info">没有找到记录</div>';
            return;
        }
        
        // 构建HTML表格 - 与台账查询页面相同的表格样式
        let html = `
            <div class="table-responsive mb-5 pb-5"> <!-- 添加底部间距，避免按钮遮挡内容 -->
                <table class="table table-striped table-bordered table-sm">
                    <thead class="table-dark">
                        <tr>
                            <th scope="col" width="40px"></th>
                            <th scope="col">工序</th>
                            <th scope="col">产品编码</th>
                            <th scope="col">型号</th>
                            <th scope="col">时间</th>
                        </tr>
                    </thead>
                    <tbody id="records-tbody">
        `;
        
        // 按时间排序（最新的在前）
        records.sort((a, b) => new Date(b.time) - new Date(a.time));
        
        records.forEach(record => {
            // 格式化时间
            const recordDate = new Date(record.time);
            const formattedDate = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, '0')}-${String(recordDate.getDate()).padStart(2, '0')} ${String(recordDate.getHours()).padStart(2, '0')}:${String(recordDate.getMinutes()).padStart(2, '0')}`;
            
            html += `
                <tr data-id="${record.id || Math.random().toString(36).substring(2, 10)}">
                    <td><input type="checkbox" class="record-checkbox" data-id="${record.id || Math.random().toString(36).substring(2, 10)}"></td>
                    <td>${record.process}</td>
                    <td>${record.productCode}</td>
                    <td>${record.model}</td>
                    <td>${formattedDate}</td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        
        // 更新DOM
        deleteContent.innerHTML = html;
        
        // 单个复选框变化时更新删除按钮状态
        document.getElementById('records-tbody').addEventListener('change', e => {
            if (e.target.classList.contains('record-checkbox')) {
                updateDeleteButtonState();
            }
        });
        
        // 删除按钮点击事件
        document.getElementById('delete-selected-records').addEventListener('click', deleteSelectedRecords);
        
    } catch (error) {
        console.error('处理删除记录时出错:', error);
        document.getElementById('delete-records-content').innerHTML = '<div class="alert alert-danger">加载数据失败，请重试</div>';
    }
    
    // 更新删除按钮状态
    function updateDeleteButtonState() {
        const selectedCount = document.querySelectorAll('.record-checkbox:checked').length;
        const deleteButton = document.getElementById('delete-selected-records');
        deleteButton.disabled = selectedCount === 0;
        deleteButton.textContent = selectedCount > 0 ? `删除选中记录 (${selectedCount})` : '删除选中记录';
    }
    
    // 删除选中记录
    function deleteSelectedRecords() {
        const selectedCheckboxes = document.querySelectorAll('.record-checkbox:checked');
        const selectedIds = Array.from(selectedCheckboxes).map(cb => cb.dataset.id);
        
        if (selectedIds.length === 0) {
            showToast('请先选择要删除的记录', 'warning');
            return;
        }
        
        if (!confirm(`确定要删除选中的 ${selectedIds.length} 条记录吗？此操作不可撤销。`)) {
            return;
        }
        
        const deleteButton = document.getElementById('delete-selected-records');
        const originalText = deleteButton.textContent;
        deleteButton.disabled = true;
        deleteButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 删除中...';
        
        // 获取选中行
        const promises = [];
        
        selectedCheckboxes.forEach(checkbox => {
            const row = checkbox.closest('tr');
            const processName = row.cells[1].textContent.trim();
            const productCode = row.cells[2].textContent.trim();
            
            // 根据中文工序名获取英文工序类型
            let processType = '';
            if (processName === '绕线') processType = 'wiring';
            else if (processName === '嵌线') processType = 'embedding';
            else if (processName === '接线') processType = 'wiring_connect';
            else if (processName === '压装') processType = 'pressing';
            else if (processName === '车止口') processType = 'stopper';
            else if (processName === '浸漆') processType = 'immersion';
            
            // 根据工序类型获取字段名
            const fields = getProcessFields(processType);
            
            // 调用删除API
            const promise = fetch(`${HTTP_API_URL}/api/deleteProductProcess`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    productCode: productCode,
                    processType: processType,
                    employeeName: userState.fullName,
                    timeField: fields.timeField,
                    employeeField: fields.employeeField
                }),
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            });
            
            promises.push(promise);
        });
        
        // 等待所有删除完成
        Promise.all(promises)
            .then(results => {
                const successCount = results.filter(data => data.success).length;
                
                // 从DOM中删除选中的行
                selectedCheckboxes.forEach(checkbox => {
                    const row = checkbox.closest('tr');
                    if (row) row.remove();
                });
                
                // 显示成功提示
                showToast(`成功删除 ${successCount} 条记录`, 'success');
                
                // 检查是否还有剩余记录
                handleRemainingRecords();
                
                // 清除缓存，确保数据刷新
                dataCache.monthlyTransactions.data = null;
                dataCache.monthlyTransactions.timestamp = null;
                
                // 恢复按钮状态
                deleteButton.disabled = false;
                deleteButton.textContent = originalText;
            })
            .catch(error => {
                console.error('删除记录时出错:', error);
                showToast('删除失败，请重试', 'error');
                
                // 恢复按钮状态
                deleteButton.disabled = false;
                deleteButton.textContent = originalText;
            });
    }
        
        function handleRemainingRecords() {
            const remainingRecords = document.querySelectorAll('#records-tbody tr').length;
            if (remainingRecords === 0) {
                document.getElementById('delete-records-content').innerHTML = 
                    '<div class="alert alert-info">没有找到记录</div>';
                
                // 如果没有剩余记录，也移除底部按钮
                const fixedButtons = document.getElementById('fixed-delete-buttons');
                if (fixedButtons) {
                    fixedButtons.remove();
                }
                
                // 延迟返回主屏幕
                setTimeout(() => {
                    showScreen(SCREENS.HOME);
                }, 1000);
            }
            
            // 更新删除按钮状态
            updateDeleteButtonState();
    }
} 

// 处理单个扫码
function handleSingleScan() {
    const processSelect = document.getElementById('process-select');
    const selectedProcess = processSelect.value;
    const selectedProcessText = processSelect.options[processSelect.selectedIndex].text;
    
    if (!selectedProcess) {
        showToast('请先选择工序', 'warning');
        return;
    }
    
    // 保存工序选择
    saveProcessSelection(selectedProcess);
    
    // 设置单个扫码工序提示
    const processDisplay = document.getElementById('single-scan-process');
    processDisplay.innerHTML = `<strong>当前工序:</strong> <span class="process-highlight">${selectedProcessText}</span>`;
    processDisplay.style.fontSize = '1.4rem'; // 确保字体足够大
    
    // 设置扫码状态
    scanState.processType = selectedProcess;
    scanState.isContinuous = false;
    
    // 显示单个扫码页面
    showScreen(SCREENS.SINGLE_SCAN);
    
    // 开始扫码
    startScan(selectedProcess, false);
}

// 处理连续扫码
function handleContinuousScan() {
    const processSelect = document.getElementById('process-select');
    const selectedProcess = processSelect.value;
    const selectedProcessText = processSelect.options[processSelect.selectedIndex].text;
    
    if (!selectedProcess) {
        showToast('请先选择工序', 'warning');
        return;
    }
    
    // 检查是否是允许的连续扫码工序（车止口和浸漆）
    if (selectedProcess !== 'stopper' && selectedProcess !== 'immersion') {
        showToast('只有车止口和浸漆工序支持连续扫码', 'error');
        return;
    }
    
    // 保存工序选择
    saveProcessSelection(selectedProcess);
    
    // 设置连续扫码工序提示
    const processDisplay = document.getElementById('continuous-scan-process');
    processDisplay.innerHTML = `<strong>当前工序:</strong> <span class="process-highlight">${selectedProcessText}</span>`;
    processDisplay.style.fontSize = '1.4rem'; // 确保字体足够大
    
    // 设置扫码状态
    scanState.processType = selectedProcess;
    scanState.isContinuous = true;
    
    // 显示连续扫码页面
    showScreen(SCREENS.CONTINUOUS_SCAN);
    
    // 自动聚焦多行输入框
    setTimeout(() => {
        const multilineInput = document.getElementById('manual-multiline-codes');
        if (multilineInput) multilineInput.focus();
    }, 300);
    
    // 绑定手动上传事件（防止重复绑定）
    setTimeout(() => {
        const uploadBtn = document.getElementById('manual-multiline-upload');
        if (uploadBtn && !uploadBtn.dataset.bound) {
            uploadBtn.addEventListener('click', function() {
                const textarea = document.getElementById('manual-multiline-codes');
                if (!textarea) return;
                const codes = textarea.value.split('\n').map(line => line.trim()).filter(line => line);
                if (codes.length === 0) {
                    showToast('请输入至少一条产品编码', 'warning');
                    return;
                }
                let successCount = 0, failCount = 0;
                const processCode = async (code) => {
                    // 复用扫码成功逻辑，且不影响扫码枪
                    await onScanSuccess(code, { result: { text: code } });
                };
                (async () => {
                    for (const code of codes) {
                        await processCode(code);
                    }
                    showToast(`手动上传完成，共${codes.length}条`, 'success');
                    textarea.value = '';
                })();
            });
            uploadBtn.dataset.bound = '1';
        }
    }, 350);
    
    // 开始扫码
    startScan(selectedProcess, true);
}

// 创建浮动工序名称框
function createFloatingProcess() {
    // 移除已存在的浮动框
    const existingFloat = document.getElementById('floating-process');
    if (existingFloat) {
        existingFloat.remove();
    }
    
    // 获取当前工序名称
    const processSelect = document.getElementById('process-select');
    if (!processSelect || processSelect.selectedIndex < 0) return;
    
    const selectedProcessText = processSelect.options[processSelect.selectedIndex].text;
    console.log('创建浮动工序框, 当前选择工序:', selectedProcessText);
    
    // 创建浮动框元素
    const floatingDiv = document.createElement('div');
    floatingDiv.id = 'floating-process';
    floatingDiv.className = 'floating-process';
    
    // 设置内容 - 工序名称加上醒目符号
    floatingDiv.innerHTML = `⚠️ 当前工序: <span style="font-size: 1.5em;">${selectedProcessText}</span> ⚠️`;
    
    // 随机初始位置
    const initialX = Math.random() * (window.innerWidth - 200);
    const initialY = Math.random() * (window.innerHeight - 100);
    floatingDiv.style.left = `${initialX}px`;
    floatingDiv.style.top = `${initialY}px`;
    
    // 添加到body
    document.body.appendChild(floatingDiv);
}

// 添加扫码枪/手动录入按钮事件
function addManualScanEvent() {
    const manualScanBtn = document.getElementById('card-manual-scan');
    if (manualScanBtn) {
        manualScanBtn.addEventListener('click', function() {
            const processSelect = document.getElementById('process-select');
            const selectedProcess = processSelect.value;
            const selectedProcessText = processSelect.options[processSelect.selectedIndex].text;
            if (!selectedProcess) {
                showToast('请先选择工序', 'warning');
                return;
            }
            if (selectedProcess !== 'stopper' && selectedProcess !== 'immersion') {
                showToast('只有车止口和浸漆工序支持手动录入', 'error');
                return;
            }
            // 显示工序提示
            const processDisplay = document.getElementById('manual-scan-process');
            processDisplay.innerHTML = `<strong>当前工序:</strong> <span class="process-highlight">${selectedProcessText}</span>`;
            processDisplay.style.fontSize = '1.4rem';
            // 切换界面
            showScreen(SCREENS.MANUAL_SCAN);
            // 自动聚焦
            setTimeout(() => {
                const textarea = document.getElementById('manual-scan-codes');
                if (textarea) textarea.focus();
            }, 200);
        });
    }
    // 返回按钮
    const backBtn = document.getElementById('manual-scan-back');
    if (backBtn) {
        backBtn.addEventListener('click', function() {
            showScreen(SCREENS.HOME);
        });
    }
    // 上传按钮
    const uploadBtn = document.getElementById('manual-scan-upload');
    if (uploadBtn) {
        uploadBtn.addEventListener('click', async function() {
            const textarea = document.getElementById('manual-scan-codes');
            if (!textarea) return;
            const codes = textarea.value.split('\n').map(line => line.trim()).filter(line => line);
            if (codes.length === 0) {
                showToast('请输入至少一条产品编码', 'warning');
                return;
            }
            const processSelect = document.getElementById('process-select');
            const selectedProcess = processSelect.value;
            let successCount = 0, failCount = 0;
            for (const code of codes) {
                try {
                    const success = await updateProductProcess(code, selectedProcess, userState.fullName);
                    if (success) successCount++; else failCount++;
                } catch (e) { failCount++; }
            }
            showToast(`上传完成，成功${successCount}条，失败${failCount}条`, 'success');
            textarea.value = '';
        });
    }
}
// 页面初始化时调用
setTimeout(addManualScanEvent, 500);
