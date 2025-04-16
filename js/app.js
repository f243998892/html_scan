// 全局变量
const SUPABASE_URL = 'https://mirilhunybcsydhtowqo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pcmlsaHVueWJjc3lkaHRvd3FvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEyNjk3MzEsImV4cCI6MjA1Njg0NTczMX0.fQCOraXJXQFshRXxHf2N-VIwTSbEc1hrxXzHP4sIIAw';
// 初始化Supabase客户端
let supabase;

// 设置扫码配置的常量
const SCAN_CONFIG = {
    DEFAULT_FPS: 25,          // 默认帧率
    HIGH_QUALITY_SCAN: true,  // 高质量扫描模式
    CONTINUOUS_SCAN_DELAY: 200, // 连续扫码延迟时间(ms)
    SINGLE_SCAN_DELAY: 500,    // 单次扫码延迟时间(ms)
    DUPLICATE_CODE_INTERVAL: 1500 // 认为是重复扫码的时间间隔(ms)
};

// 存储当前用户信息
const userState = {
    fullName: '',
    exitAfterScan: false
};

// 存储当前扫码状态
const scanState = {
    processType: '',
    isContinuous: false,
    pendingCodes: [],
    lastScannedCode: '',
    isProcessing: false,
    currentHtml5QrScanner: null,
    lastScanTime: 0
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
    PRODUCTS: 'products-screen'
};

// 初始化应用
document.addEventListener('DOMContentLoaded', function() {
    // 初始化Supabase - 使用完全限定的访问方式
    supabase = supabaseJs.createClient(SUPABASE_URL, SUPABASE_KEY);
    initApp();
});

// 初始化应用
async function initApp() {
    // 初始化用户交互标志
    initUserInteraction();
    
    // 添加事件监听
    addEventListeners();
    
    // 尝试自动登录
    tryAutoLogin();
}

// 初始化用户交互处理
function initUserInteraction() {
    // 添加用户交互事件监听，以便启用音频播放
    const interactionEvents = ['click', 'touchstart', 'keydown'];
    const markInteraction = function() {
        document.body.classList.add('user-interaction');
        // 移除所有事件监听
        interactionEvents.forEach(event => {
            document.removeEventListener(event, markInteraction);
        });
    };
    
    // 添加各种用户交互事件监听
    interactionEvents.forEach(event => {
        document.addEventListener(event, markInteraction);
    });
}

// 尝试自动登录
async function tryAutoLogin() {
    const savedFullName = localStorage.getItem('user_full_name');
    if (savedFullName) {
        userState.fullName = savedFullName;
        userState.exitAfterScan = localStorage.getItem('exit_after_scan') === 'true';
        navigateToHome();
    }
}

// 添加事件监听
function addEventListeners() {
    // 登录事件
    document.getElementById('login-btn').addEventListener('click', handleLogin);
    
    // 首页功能卡片点击事件
    document.getElementById('card-single-scan').addEventListener('click', () => showScreen(SCREENS.SINGLE_SCAN));
    document.getElementById('card-continuous-scan').addEventListener('click', () => showScreen(SCREENS.CONTINUOUS_SCAN));
    document.getElementById('card-product-query').addEventListener('click', handleProductQuery);
    document.getElementById('card-product-scan-query').addEventListener('click', handleProductScanQuery);
    document.getElementById('card-inventory').addEventListener('click', () => showFeatureNotAvailable('该功能暂未开放，敬请期待'));
    document.getElementById('card-delete-records').addEventListener('click', handleDeleteRecords);
    
    // 设置开关
    document.getElementById('exit-after-scan').addEventListener('change', function(e) {
        userState.exitAfterScan = e.target.checked;
        localStorage.setItem('exit_after_scan', e.target.checked);
    });
    
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
}

// 处理登录
async function handleLogin() {
    const nameInput = document.getElementById('username');
    const fullName = nameInput.value.trim();
    
    if (!fullName) {
        showToast('请输入姓名', 'warning');
        return;
    }
    
    userState.fullName = fullName;
    localStorage.setItem('user_full_name', fullName);
    
    navigateToHome();
}

// 导航到首页
function navigateToHome() {
    document.getElementById('user-fullname').textContent = `用户: ${userState.fullName}`;
    document.getElementById('exit-after-scan').checked = userState.exitAfterScan;
    showScreen(SCREENS.HOME);
}

// 显示指定屏幕
function showScreen(screenId) {
    // 隐藏所有屏幕
    Object.values(SCREENS).forEach(id => {
        document.getElementById(id).classList.add('d-none');
    });
    
    // 显示目标屏幕
    document.getElementById(screenId).classList.remove('d-none');
    
    // 如果切换回首页，停止扫码
    if (screenId === SCREENS.HOME && scanState.currentHtml5QrScanner) {
        stopScanner();
    }
}

// 显示功能未实现提示
function showFeatureNotAvailable(message) {
    showToast(message, 'info');
}

// 显示Toast提示
function showToast(message, type = 'success', duration = 3000) {
    const toastContainer = document.getElementById('toast-container');
    
    const toastElement = document.createElement('div');
    toastElement.classList.add('custom-toast', 'p-3', 'mb-2');
    
    // 设置Toast样式
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
            break;
    }
    
    toastElement.textContent = message;
    toastContainer.appendChild(toastElement);
    
    // 自动关闭
    setTimeout(() => {
        toastElement.style.opacity = '0';
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
    
    // 更新UI
    document.getElementById('scan-title').textContent = `${getChineseProcessName(processType)}扫码`;
    
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
    
    // 显示扫码界面
    showScreen(SCREENS.SCAN);
    
    // 初始化扫码器
    initializeScanner();
}

// 初始化扫码器
function initializeScanner() {
    const scannerContainer = document.getElementById('scanner-container');
    
    // 确保容器为空
    scannerContainer.innerHTML = '';
    
    // 创建扫码器
    const html5QrCode = new Html5Qrcode("scanner-container");
    scanState.currentHtml5QrScanner = html5QrCode;
    
    // 获取屏幕尺寸
    const screenWidth = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
    const isSmallScreen = screenWidth < 600;
    
    // 计算二维码扫描框大小 - 根据屏幕大小动态调整
    const qrboxSize = isSmallScreen ? Math.min(screenWidth * 0.7, 250) : 300;
    
    // 获取视频约束参数
    const videoConstraintsWidth = SCAN_CONFIG.HIGH_QUALITY_SCAN ? 1280 : 640;
    const videoConstraintsHeight = SCAN_CONFIG.HIGH_QUALITY_SCAN ? 720 : 480;
    
    // 扫码配置 - 使用常量配置
    const config = {
        fps: SCAN_CONFIG.DEFAULT_FPS, 
        qrbox: { width: qrboxSize, height: qrboxSize },
        aspectRatio: 1.0,
        disableFlip: false,
        formats: ['qr_code'], // 仅支持QR码，减少判断时间
        videoConstraints: {
            facingMode: "environment",
            width: { ideal: videoConstraintsWidth },
            height: { ideal: videoConstraintsHeight },
            focusMode: "continuous"
        }
    };
    
    // 启动扫码
    html5QrCode.start(
        { facingMode: "environment" },
        config,
        onScanSuccess,
        onScanFailure
    ).catch(err => {
        console.error(`无法启动相机: ${err}`);
        showToast('无法启动相机，请检查权限设置', 'error');
    });
}

// 扫码成功回调
async function onScanSuccess(decodedText, decodedResult) {
    // 如果正在处理，忽略新的扫码结果
    if (scanState.isProcessing) return;
    
    // 优化重复扫码检测 - 保留上次扫码结果，但减少重复判断的时间间隔
    const now = Date.now();
    if (decodedText === scanState.lastScannedCode && (now - scanState.lastScanTime < SCAN_CONFIG.DUPLICATE_CODE_INTERVAL)) {
        return; // 如果在设定时间内扫描了相同的码，则忽略
    }
    
    scanState.isProcessing = true;
    scanState.lastScannedCode = decodedText;
    scanState.lastScanTime = now; // 记录本次扫码时间
    
    // 处理扫码结果
    if (scanState.isContinuous) {
        // 连续扫码模式，添加到待上传列表
        if (!scanState.pendingCodes.includes(decodedText)) {
            scanState.pendingCodes.push(decodedText);
            updatePendingList();
            showToast(`已添加到队列: ${decodedText}`, 'success');
            
            // 播放成功提示音
            playSuccessSound();
            
            // 快速重置处理状态，允许立即扫描下一个码
            setTimeout(() => {
                scanState.isProcessing = false;
            }, SCAN_CONFIG.CONTINUOUS_SCAN_DELAY);
        } else {
            showToast('该产品已在队列中，请勿重复扫码', 'warning');
            
            // 播放错误提示音
            playErrorSound();
            
            // 对于错误情况，也快速重置
            setTimeout(() => {
                scanState.isProcessing = false;
            }, SCAN_CONFIG.CONTINUOUS_SCAN_DELAY + 100); // 比正常情况稍微长一点
        }
    } else {
        // 单次扫码模式，直接上传
        const success = await updateProductProcess(decodedText, scanState.processType, userState.fullName);
        
        if (success) {
            // 播放成功提示音
            playSuccessSound();
            
            showToast(`${getChineseProcessName(scanState.processType)}数据更新成功: ${decodedText}`, 'success');
            
            // 如果设置了扫码成功后退出，则退出
            if (userState.exitAfterScan) {
                // 延迟一秒后退出
                setTimeout(() => {
                    stopScanner();
                    window.close(); // 尝试关闭窗口
                }, 1000);
            } else {
                // 单次扫码模式，回到上一页面
                setTimeout(() => {
                    stopScanner();
                    showScreen(scanState.isContinuous ? SCREENS.CONTINUOUS_SCAN : SCREENS.SINGLE_SCAN);
                }, 1000);
            }
        } else {
            // 播放错误提示音
            playErrorSound();
            
            showToast('该产品的该工序已存在，请勿重复扫码', 'error');
            
            // 减少错误提示后的处理延迟
            setTimeout(() => {
                scanState.isProcessing = false;
            }, SCAN_CONFIG.SINGLE_SCAN_DELAY);
        }
    }
}

// 扫码失败回调
function onScanFailure(error) {
    // 不需要处理每次扫码失败，避免过多的日志
    console.debug(`扫码过程中: ${error}`);
}

// 停止扫码并返回
function stopScan() {
    // 如果是连续扫码模式且有待上传的数据，询问是否放弃上传
    if (scanState.isContinuous && scanState.pendingCodes.length > 0) {
        if (confirm('是否放弃上传？')) {
            scanState.pendingCodes = [];
            stopScanner();
            showScreen(scanState.isContinuous ? SCREENS.CONTINUOUS_SCAN : SCREENS.SINGLE_SCAN);
        }
    } else {
        stopScanner();
        showScreen(scanState.isContinuous ? SCREENS.CONTINUOUS_SCAN : SCREENS.SINGLE_SCAN);
    }
}

// 停止扫码器
function stopScanner() {
    if (scanState.currentHtml5QrScanner) {
        scanState.currentHtml5QrScanner.stop().then(() => {
            console.log('扫码器已停止');
        }).catch(err => {
            console.error('停止扫码器失败:', err);
        });
        scanState.currentHtml5QrScanner = null;
    }
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