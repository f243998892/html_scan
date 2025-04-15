// 全局变量
const SUPABASE_URL = 'https://mirilhunybcsydhtowqo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pcmlsaHVueWJjc3lkaHRvd3FvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEyNjk3MzEsImV4cCI6MjA1Njg0NTczMX0.fQCOraXJXQFshRXxHf2N-VIwTSbEc1hrxXzHP4sIIAw';
// 初始化Supabase客户端
let supabase;

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
    currentHtml5QrScanner: null
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
    // 初始化Supabase
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    initApp();
});

// 初始化应用
async function initApp() {
    addEventListeners();
    tryAutoLogin();
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
    document.getElementById('card-delete-records').addEventListener('click', () => showFeatureNotAvailable('删除记录功能暂未开放'));
    
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
    
    // 扫码配置
    const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        disableFlip: false,
        videoConstraints: {
            facingMode: "environment"
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
    
    // 忽略重复扫码
    if (decodedText === scanState.lastScannedCode) return;
    
    scanState.isProcessing = true;
    scanState.lastScannedCode = decodedText;
    
    // 处理扫码结果
    if (scanState.isContinuous) {
        // 连续扫码模式，添加到待上传列表
        if (!scanState.pendingCodes.includes(decodedText)) {
            scanState.pendingCodes.push(decodedText);
            updatePendingList();
            showToast(`已添加到队列: ${decodedText}`, 'success');
            
            // 播放成功提示音
            playSuccessSound();
        } else {
            showToast('该产品已在队列中，请勿重复扫码', 'warning');
            
            // 播放错误提示音
            playErrorSound();
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
        }
    }
    
    // 延迟重置处理状态
    setTimeout(() => {
        scanState.isProcessing = false;
        scanState.lastScannedCode = '';
    }, 1000);
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
        const audio = new Audio('data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAASAAAeMwAUFBQUFCgUFBQUFDMzMzMzM0dHR0dHR1paWlpaWm5ubm5ubm5HR0dHR0dHMzMzMzMzFBQUFBQUCgAAAAAA//tAxAAAAAABLgAAAAgAAksAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//tAxPwAAAL0CVoQAhIBXhS5NCJVY9ToV1OUdBUColOik0ilX/6y+++KGw4IPz8IOD8IPg+tQuD72MQhCD6woH/w+D9bcH3P//f3+/lwfTg//lwfA+/lwfA+CYP/wTB8Hw//+OD7/lwfB8H4Pg+D4Pg+CEKSEEKSEEKSEEKSEEKS//sQxP4ADZiVKGJsXAK+PpVoIwKESEKSEEKSEEKSEEKSEEKSEH////sQxP8AQ7B1GtdkUYC3j6VKaMAhEhCkhBCkhBCkhBCkhBCkhB////sQxP8AQ6htGtGGLALcPZUoowCESEKSEEKSEEKSEEKSEEKSEH///w==');
        audio.play();
    } catch (e) {
        console.error('无法播放音频', e);
    }
}

// 播放错误提示音
function playErrorSound() {
    try {
        const audio = new Audio('data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAASAAAeMwAUFBQUFCgUFBQUFDMzMzMzM0dHR0dHR1paWlpaWm5ubm5ubm5HR0dHR0dHMzMzMzMzFBQUFBQUCgAAAAAA//tAxAAAAAABLgAAAAgAAksAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//tAxPwAAAL0CVoQAhIBXhS5NCJVY9ToV1OUdBUColOik0ilX/6y+++KGw4IPz8IOD8IPg+tQuD72MQhCD6woH/w+D9bcH3P//f3+/lwfTg//lwfA+/lwfA+CYP/wTB8Hw//+OD7/lwfB8H4Pg+D4Pg+CEKSEEKSEEKSEEKSEEKS//wQxP8AQ7B1GtdkUYC3j6VKaMAhEhCkhBCkhBCkhBCkhBCkhB//');
        audio.play();
    } catch (e) {
        console.error('无法播放音频', e);
    }
}

// ------ Supabase数据操作 ------

// 更新产品信息
async function updateProductProcess(productCode, processType, employeeName) {
    try {
        // 确定字段名称
        const { employeeField, timeField } = getProcessFields(processType);
        
        // 先查询产品信息，检查工序字段是否已有数据
        const { data: productData, error: queryError } = await supabase
            .from('products')
            .select()
            .eq('产品编码', productCode)
            .maybeSingle();
        
        if (queryError) {
            console.error('查询产品信息失败:', queryError);
            return false;
        }
        
        // 如果找不到产品，返回失败
        if (!productData) {
            console.error('产品不存在:', productCode);
            return false;
        }
        
        // 检查工序字段是否已有数据
        if (productData[timeField]) {
            console.error('该产品的该工序已存在数据，不能覆盖:', productCode, timeField);
            return false;
        }
        
        // 准备更新数据
        const updateData = {};
        
        // 设置当前时间
        updateData[timeField] = getCurrentISOTimeString();
        
        // 只有在员工字段存在的情况下才更新
        if (employeeField) {
            updateData[employeeField] = employeeName;
        }
        
        // 执行更新
        const { error: updateError } = await supabase
            .from('products')
            .update(updateData)
            .eq('产品编码', productCode);
        
        if (updateError) {
            console.error('更新产品信息失败:', updateError);
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('更新产品信息失败:', error);
        return false;
    }
}

// 批量更新产品信息
async function batchUpdateProductProcess(productCodes, processType, employeeName) {
    const results = [];
    
    for (const code of productCodes) {
        try {
            const success = await updateProductProcess(code, processType, employeeName);
            results.push({ code, success });
        } catch (error) {
            console.error(`批量更新产品 ${code} 失败:`, error);
            results.push({ code, success: false });
        }
    }
    
    return results;
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
            employeeField = '';  // 浸漆没有对应的员工字段
            timeField = '浸漆时间';
            break;
        default:
            break;
    }
    
    return { employeeField, timeField };
}

// 查询产品详情
async function getProductDetails(productCode) {
    try {
        const { data, error } = await supabase
            .from('products')
            .select()
            .eq('产品编码', productCode)
            .maybeSingle();
        
        if (error) {
            console.error('查询产品详情失败:', error);
            return null;
        }
        
        return data;
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
        
        // 查询并显示用户本月完成的产品工序统计
        await loadUserMonthlyProcesses();
    } catch (error) {
        console.error('获取产品查询数据失败:', error);
        showToast('获取数据失败，请重试', 'error');
    }
}

// 处理产品扫码查询
async function handleProductScanQuery() {
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
    
    // 更新UI
    document.getElementById('scan-title').textContent = '产品扫码查询';
    document.getElementById('scan-upload').classList.add('d-none');
    document.getElementById('scan-pending-list').classList.add('d-none');
    
    // 显示扫码界面
    showScreen(SCREENS.SCAN);
    
    // 初始化扫码器
    const scannerContainer = document.getElementById('scanner-container');
    scannerContainer.innerHTML = '';
    
    const html5QrCode = new Html5Qrcode("scanner-container");
    scanState.currentHtml5QrScanner = html5QrCode;
    
    const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        disableFlip: false,
        videoConstraints: {
            facingMode: "environment"
        }
    };
    
    html5QrCode.start(
        { facingMode: "environment" },
        config,
        onProductQueryScanSuccess,
        onScanFailure
    ).catch(err => {
        console.error(`无法启动相机: ${err}`);
        showToast('无法启动相机，请检查权限设置', 'error');
    });
}

// 产品查询扫码成功回调
async function onProductQueryScanSuccess(decodedText, decodedResult) {
    // 如果正在处理，忽略新的扫码结果
    if (scanState.isProcessing) return;
    
    // 忽略重复扫码
    if (decodedText === scanState.lastScannedCode) return;
    
    scanState.isProcessing = true;
    scanState.lastScannedCode = decodedText;
    
    try {
        // 查询产品详情
        const productData = await getProductDetails(decodedText);
        
        if (productData) {
            // 播放成功提示音
            playSuccessSound();
            
            // 显示产品详情
            showProductDetail(productData);
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
            scanState.lastScannedCode = '';
        }, 1000);
    }
}

// 显示产品详情
function showProductDetail(product) {
    // 创建产品详情内容
    const productDetailContent = document.getElementById('product-detail-content');
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
    if (product['浸漆时间']) {
        const immersionDiv = document.createElement('div');
        immersionDiv.className = 'product-detail-item';
        immersionDiv.innerHTML = `
            <div class="product-detail-label">浸漆:</div>
            <div>时间: ${formatDate(product['浸漆时间'])}</div>
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
    
    // 显示模态框
    const productDetailModal = new bootstrap.Modal(document.getElementById('product-detail-modal'));
    productDetailModal.show();
}

// 获取本月日期范围
async function getMonthRange() {
    try {
        // 尝试从数据库获取自定义月份范围
        const { data, error } = await supabase
            .from('month_range')
            .select('*')
            .order('id', { ascending: false })
            .limit(1)
            .single();
        
        if (error) {
            console.error('获取月份范围失败:', error);
            // 使用默认的本月范围
            setDefaultMonthRange();
            return;
        }
        
        if (data && data.start_date && data.end_date) {
            queryState.monthRange.startDate = new Date(data.start_date);
            queryState.monthRange.endDate = new Date(data.end_date);
        } else {
            // 使用默认的本月范围
            setDefaultMonthRange();
        }
    } catch (error) {
        console.error('获取月份范围失败:', error);
        // 使用默认的本月范围
        setDefaultMonthRange();
    }
}

// 设置默认的本月范围
function setDefaultMonthRange() {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    
    queryState.monthRange.startDate = firstDay;
    queryState.monthRange.endDate = lastDay;
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
            '车止口': 0
        };
        
        // 统计各工序和型号
        const processModels = {
            '绕线': {},
            '嵌线': {},
            '接线': {},
            '压装': {},
            '车止口': {}
        };
        
        // 统计工序和产品编码
        const processProducts = {
            '绕线': {},
            '嵌线': {},
            '接线': {},
            '压装': {},
            '车止口': {}
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
        
    } catch (error) {
        console.error('加载用户本月工序统计失败:', error);
        document.getElementById('process-list').innerHTML = '<div class="text-center my-3 text-danger">加载失败，请重试</div>';
    }
}

// 判断日期是否在查询范围内
function isDateInRange(dateString) {
    if (!dateString) return false;
    
    const date = new Date(dateString);
    return date >= queryState.monthRange.startDate && date <= queryState.monthRange.endDate;
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
        
        // 查询员工完成的产品
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .or(`绕线员工.eq.${employeeName},嵌线员工.eq.${employeeName},接线员工.eq.${employeeName},压装员工.eq.${employeeName},车止口员工.eq.${employeeName}`)
            .order('产品编码');
        
        if (error) {
            console.error('查询产品失败:', error);
            return [];
        }
        
        // 在前端过滤日期范围
        return (data || []).filter(product => {
            // 检查该员工是否参与了这些工序，并且是在指定日期范围内
            if (product['绕线员工'] === employeeName && isDateInRange(product['绕线时间'])) {
                return true;
            }
            if (product['嵌线员工'] === employeeName && isDateInRange(product['嵌线时间'])) {
                return true;
            }
            if (product['接线员工'] === employeeName && isDateInRange(product['接线时间'])) {
                return true;
            }
            if (product['压装员工'] === employeeName && isDateInRange(product['压装时间'])) {
                return true;
            }
            if (product['车止口员工'] === employeeName && isDateInRange(product['车止口时间'])) {
                return true;
            }
            return false;
        });
    } catch (error) {
        console.error('获取用户本月产品失败:', error);
        return [];
    }
} 