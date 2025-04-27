// 全局变量
const DB_CONFIG = {
    host: 's5.gnip.vip',
    port: 33946,
    database: 'postgres',
    user: 'postgres',
    password: 'postgres'
};
const HTTP_API_URL = 'http://www.fanghui8131.fun';
// 初始化PostgreSQL客户端
let dbClient;

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
    console.log("停止扫码，当前扫码类型:", scanState.processType);
    
    // 如果是连续扫码模式且有待上传的数据，询问是否放弃上传
    if (scanState.isContinuous && scanState.pendingCodes.length > 0) {
        if (confirm('是否放弃上传？')) {
            scanState.pendingCodes = [];
            stopScanner();
            showScreen(scanState.isContinuous ? SCREENS.CONTINUOUS_SCAN : SCREENS.SINGLE_SCAN);
        }
    } else {
        stopScanner();
        
        // 根据当前扫码类型决定返回的页面
        if (scanState.processType === 'query') {
            console.log("产品扫码查询 - 返回主页");
            // 产品扫码查询 - 返回主页
            showScreen(SCREENS.HOME);
        } else {
            console.log("其他扫码 - 返回选择页面");
            // 其他扫码 - 返回对应的扫码选择页面
            showScreen(scanState.isContinuous ? SCREENS.CONTINUOUS_SCAN : SCREENS.SINGLE_SCAN);
        }
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
        
        const result = await response.json();
        
        if (!response.ok) {
            console.error('更新产品信息失败:', result.error);
            return false;
        }
        
        return result.success;
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

// 修改getMonthRange函数
async function getMonthRange() {
    try {
        // 直接设置默认范围而不是从supabase获取
        setDefaultMonthRange();
        return true;
    } catch (error) {
        console.error('获取月份范围失败:', error);
        return false;
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
            
            if (isDateInRange(product['浸漆时间'])) {
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

// 处理删除记录
async function handleDeleteRecords() {
    try {
        // 显示查询屏幕
        showScreen(SCREENS.QUERY);
        
        // 获取本月范围
        await getMonthRange();
        
        // 隐藏流水账容器
        document.getElementById('monthly-transactions-container').style.display = 'none';
        
        // 显示加载中
        document.getElementById('process-list').innerHTML = '<div class="text-center my-3"><div class="spinner-border text-primary" role="status"></div><div class="mt-2">加载中...</div></div>';
        
        // 获取当前用户全名
        const fullName = localStorage.getItem('user_full_name');
        if (!fullName) {
            document.getElementById('process-list').innerHTML = '<div class="text-center my-3 text-danger">无法获取用户信息</div>';
            return;
        }
        
        // 查询用户本月完成的产品
        const products = await getUserMonthlyProducts(
            fullName,
            queryState.monthRange.startDate,
            queryState.monthRange.endDate
        );
        
        if (!products || products.length === 0) {
            document.getElementById('process-list').innerHTML = '<div class="text-center my-3">本月暂无完成的工序</div>';
            return;
        }
        
        // 将产品数据处理成带有工序信息的列表
        const processRecords = [];
        
        products.forEach(product => {
            const productCode = product['产品编码'];
            const productModel = product['产品型号'];
            
            // 检查各个工序
            if (product['绕线员工'] === fullName && isDateInRange(product['绕线时间'])) {
                processRecords.push({
                    '产品编码': productCode,
                    '产品型号': productModel,
                    '工序': '绕线',
                    '时间': product['绕线时间']
                });
            }
            
            if (product['嵌线员工'] === fullName && isDateInRange(product['嵌线时间'])) {
                processRecords.push({
                    '产品编码': productCode,
                    '产品型号': productModel,
                    '工序': '嵌线',
                    '时间': product['嵌线时间']
                });
            }
            
            if (product['接线员工'] === fullName && isDateInRange(product['接线时间'])) {
                processRecords.push({
                    '产品编码': productCode,
                    '产品型号': productModel,
                    '工序': '接线',
                    '时间': product['接线时间']
                });
            }
            
            if (product['压装员工'] === fullName && isDateInRange(product['压装时间'])) {
                processRecords.push({
                    '产品编码': productCode,
                    '产品型号': productModel,
                    '工序': '压装',
                    '时间': product['压装时间']
                });
            }
            
            if (product['车止口员工'] === fullName && isDateInRange(product['车止口时间'])) {
                processRecords.push({
                    '产品编码': productCode,
                    '产品型号': productModel,
                    '工序': '车止口',
                    '时间': product['车止口时间']
                });
            }
            
            // 浸漆工序特殊处理
            if (isDateInRange(product['浸漆时间'])) {
                processRecords.push({
                    '产品编码': productCode,
                    '产品型号': productModel,
                    '工序': '浸漆',
                    '时间': product['浸漆时间']
                });
            }
        });
        
        // 按时间倒序排序
        processRecords.sort((a, b) => new Date(b['时间']) - new Date(a['时间']));
        
        // 生成记录列表
        let recordsHTML = '';
        
        processRecords.forEach((record, index) => {
            recordsHTML += `
                <div class="card mb-2">
                    <div class="card-body">
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" value="${index}" id="record-${index}" data-index="${index}">
                            <label class="form-check-label" for="record-${index}">
                                <div class="d-flex justify-content-between align-items-center">
                                    <div>
                                        <strong>产品编码: ${record['产品编码']}</strong><br>
                                        <small class="text-muted">产品型号: ${record['产品型号']}</small><br>
                                        <small class="text-muted">工序: ${record['工序']}</small><br>
                                        <small class="text-muted">时间: ${formatDate(record['时间'])}</small>
                                    </div>
                                    <div class="process-icon">
                                        ${getProcessIcon(record['工序'])}
                                    </div>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>
            `;
        });
        
        // 添加删除按钮
        recordsHTML += `
            <div class="d-grid gap-2 mt-3">
                <button class="btn btn-danger" id="delete-selected-records" disabled>
                    删除选中记录
                </button>
            </div>
        `;
        
        document.getElementById('process-list').innerHTML = recordsHTML;
        
        // 添加复选框事件监听
        const checkboxes = document.querySelectorAll('.form-check-input');
        const deleteButton = document.getElementById('delete-selected-records');
        
        // 更新删除按钮文本的函数
        function updateDeleteButtonText() {
            // 使用更精确的选择器，确保只获取当前页面中的选中复选框
            const checkedCount = document.querySelectorAll('#process-list .form-check-input:checked').length;
            deleteButton.disabled = checkedCount === 0;
            
            // 只有在有选中记录时才显示数字
            if (checkedCount > 0) {
                deleteButton.textContent = `删除选中记录 (${checkedCount})`;
            } else {
                deleteButton.textContent = '删除选中记录';
            }
            
            console.log('当前选中的记录数:', checkedCount);
        }
        
        // 在绑定事件前，先确保移除所有现有事件，避免事件重复绑定
        checkboxes.forEach(checkbox => {
            // 克隆并替换节点，以移除所有事件监听器
            const newCheckbox = checkbox.cloneNode(true);
            checkbox.parentNode.replaceChild(newCheckbox, checkbox);
        });
        
        // 重新获取复选框元素（因为上面已经替换过了）
        const refreshedCheckboxes = document.querySelectorAll('.form-check-input');
        
        // 为每个复选框添加事件
        refreshedCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', updateDeleteButtonText);
        });
        
        // 初始化按钮状态
        updateDeleteButtonText();
        
        // 将processRecords存储在按钮上，以便在点击事件中使用
        deleteButton.processRecords = processRecords;
        
        // 添加删除按钮事件监听
        deleteButton.addEventListener('click', async function() {
            // 禁用删除按钮，防止重复点击
            this.disabled = true;
            
            // 从按钮中获取processRecords
            const processRecords = this.processRecords;
            if (!processRecords || !Array.isArray(processRecords)) {
                console.error('无法获取处理记录数据');
                showToast('无法获取处理记录数据，请刷新页面重试', 'error');
                this.disabled = false;
                return;
            }
            
            // 重新获取选中的复选框，使用与updateDeleteButtonText相同的选择器
            const selectedRecords = [];
            const checkedBoxes = document.querySelectorAll('#process-list .form-check-input:checked');
            
            checkedBoxes.forEach((checkbox) => {
                // 安全地解析索引，确保是有效的数字
                const indexStr = checkbox.getAttribute('data-index');
                const index = indexStr !== null ? parseInt(indexStr, 10) : NaN;
                
                // 检查索引是否为有效数字且在数组范围内
                if (!isNaN(index) && index >= 0 && index < processRecords.length) {
                    selectedRecords.push(processRecords[index]);
                } else {
                    console.warn(`无效的索引: ${index}, processRecords长度: ${processRecords.length}, 原始值: ${indexStr}`);
                }
            });
            
            console.log('选中的记录:', selectedRecords);
            
            const selectedCount = selectedRecords.length;
            
            if (selectedCount === 0) {
                showToast('请选择要删除的记录', 'warning');
                this.disabled = false;
                return;
            }
            
            if (!confirm(`确定要删除选中的 ${selectedCount} 条记录吗？`)) {
                this.disabled = false;
                return;
            }
            
            this.textContent = '删除中...';
            
            try {
                let successCount = 0;
                let failureCount = 0;
                
                for (const record of selectedRecords) {
                    if (!record || typeof record !== 'object' || !record['产品编码']) {
                        console.error('无效的记录数据:', record);
                        failureCount++;
                        continue;
                    }
                    
                    const success = await deleteProductProcess(
                        record['产品编码'],
                        record['工序'],
                        fullName
                    );
                    
                    if (success) {
                        successCount++;
                    } else {
                        failureCount++;
                    }
                }
                
                showToast(`删除完成: 成功 ${successCount} 条, 失败 ${failureCount} 条`, 'info');
                
                // 延迟一下再重新加载记录
                setTimeout(() => {
                    handleDeleteRecords();
                }, 1000);
            } catch (error) {
                console.error('删除记录失败:', error);
                showToast('删除记录失败，请重试', 'error');
                this.disabled = false;
                updateDeleteButtonText();
            }
        });
        
    } catch (error) {
        console.error('加载删除记录失败:', error);
        document.getElementById('process-list').innerHTML = '<div class="text-center my-3 text-danger">加载失败，请重试</div>';
    }
}

// 删除产品工序信息
async function deleteProductProcess(productCode, processType, employeeName) {
    try {
        // 确定字段名称
        let employeeField = '';
        let timeField = '';
        
        switch (processType) {
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
                employeeField = '浸漆员工';
                break;
            default:
                console.error('未知工序类型:', processType);
                return false;
        }
        
        // 准备请求数据
        const deleteData = {
            productCode: productCode,
            processType: processType,
            employeeName: employeeName,
            timeField: timeField,
            employeeField: employeeField
        };
        
        // 发送HTTP请求到API
        const response = await fetch(`${HTTP_API_URL}/api/deleteProductProcess`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(deleteData)
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            console.error('删除产品工序失败:', result.error);
            return false;
        }
        
        console.log('删除产品工序成功:', productCode, processType);
        return result.success;
    } catch (error) {
        console.error('删除产品工序信息失败:', error);
        return false;
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
        // 获取当前用户信息 - 修复用户信息获取方式
        const fullName = localStorage.getItem('user_full_name');
        if (!fullName) {
            console.error('无法获取用户信息');
            document.getElementById('monthly-transactions-container').innerHTML = '<div class="alert alert-warning">无法获取用户信息，请重新登录</div>';
            return;
        }

        // 显示加载提示
        document.getElementById('monthly-transactions-container').innerHTML = '<div class="text-center"><div class="spinner-border text-primary" role="status"></div><p>数据加载中...</p></div>';

        // 获取本月范围
        await getMonthRange();
        
        // 将日期转换为ISO格式字符串
        const startDateStr = queryState.monthRange.startDate.toISOString();
        const endDateStr = queryState.monthRange.endDate.toISOString();

        // 使用HTTP API查询数据库获取产品记录
        const response = await fetch(`${HTTP_API_URL}/api/getUserMonthlyTransactions?employeeName=${encodeURIComponent(fullName)}&startDate=${encodeURIComponent(startDateStr)}&endDate=${encodeURIComponent(endDateStr)}`);

        if (!response.ok) {
            console.error('加载产品记录失败:', response.statusText);
            document.getElementById('monthly-transactions-container').innerHTML = '<div class="alert alert-danger">加载记录失败，请重试</div>';
            return;
        }

        const result = await response.json();
        const userRecords = result.data || [];

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
        document.getElementById('monthly-transactions-container').innerHTML = html;

    } catch (error) {
        console.error('加载流水账失败:', error);
        document.getElementById('monthly-transactions-container').innerHTML = '<div class="alert alert-danger">加载数据失败，请重试</div>';
    }
}

// 在showMonthlyQuery函数中添加对loadMonthlyTransactionList的调用
function showMonthlyQuery() {
    showScreen(SCREENS.MONTHLY_QUERY);
    loadCurrentMonthRange();
    displayMonthRange();
    loadUserMonthlyProcesses();
    // 加载本月流水账
    loadMonthlyTransactionList();
} 