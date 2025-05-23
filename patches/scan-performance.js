/**
 * 扫码系统性能优化补丁文件
 * 
 * 此补丁包括：
 * 1. 设备适配优化
 * 2. 扫码参数优化
 * 3. 内存管理优化
 */

// 在文档加载完成后应用补丁
document.addEventListener('DOMContentLoaded', function() {
    console.log("[性能补丁] 正在加载扫码性能优化补丁...");
    setTimeout(applyPerformancePatches, 500);
});

// 设备能力检测结果
const deviceCapabilities = {
    isLowEndDevice: false,
    preferredSettings: null
};

// 应用性能补丁
function applyPerformancePatches() {
    console.log("[性能补丁] 正在应用扫码性能优化...");
    
    // 检测设备能力
    detectDeviceCapabilities();
    
    // 优化扫码初始化
    optimizeScanner();
    
    console.log("[性能补丁] 扫码性能优化已应用");
}

// 检测设备能力
function detectDeviceCapabilities() {
    console.log("[性能补丁] 正在检测设备能力...");
    
    // 检测处理能力
    const startTime = performance.now();
    let result = 0;
    for (let i = 0; i < 100000; i++) {
        result += Math.sqrt(i);
    }
    const duration = performance.now() - startTime;
    
    // 根据计算时间评估设备性能
    deviceCapabilities.isLowEndDevice = duration > 50;
    
    // 检测内存限制
    try {
        const memory = navigator.deviceMemory;
        if (memory && memory <= 2) {
            deviceCapabilities.isLowEndDevice = true;
        }
    } catch (e) {}
    
    // 检测是否为移动设备
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
        deviceCapabilities.isLowEndDevice = true;
    }
    
    // 根据设备性能确定最佳扫码参数
    if (deviceCapabilities.isLowEndDevice) {
        deviceCapabilities.preferredSettings = {
            fps: 10,
            qrbox: 200
        };
    } else {
        deviceCapabilities.preferredSettings = {
            fps: 20,
            qrbox: 220
        };
    }
    
    console.log("[性能补丁] 设备能力检测完成:", 
                deviceCapabilities.isLowEndDevice ? "低端设备" : "高端设备");
}

// 优化扫码器
function optimizeScanner() {
    // 增强initializeScanner函数
    if (typeof initializeScanner === 'function') {
        console.log("[性能补丁] 正在优化扫码初始化函数...");
        
        // 保存原始函数
        const originalInitializeScanner = initializeScanner;
        
        // 替换为优化版本
        window.initializeScanner = function() {
            console.log("[性能补丁] 使用优化的扫码初始化");
            
            const scannerContainer = document.getElementById('scanner-container');
            if (!scannerContainer) {
                return originalInitializeScanner.apply(this, arguments);
            }
            
            // 确保容器为空
            scannerContainer.innerHTML = '';
            
            // 创建扫码器
            const html5QrCode = new Html5Qrcode("scanner-container");
            scanState.currentHtml5QrScanner = html5QrCode;
            
            // 根据设备能力确定最佳配置
            const settings = deviceCapabilities.preferredSettings || {
                fps: 15,
                qrbox: 220
            };
            
            // 扫码配置
            const config = {
                fps: settings.fps,
                qrbox: { width: settings.qrbox, height: settings.qrbox },
                aspectRatio: 1.0,
                disableFlip: true,
                formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE, Html5QrcodeSupportedFormats.CODE_128],
                experimentalFeatures: {
                    useBarCodeDetectorIfSupported: true
                }
            };
            
            // 在低端设备上使用更轻量级的配置
            if (deviceCapabilities.isLowEndDevice) {
                delete config.experimentalFeatures;
            } else {
                // 只有在高性能设备上才使用更高的分辨率
                config.videoConstraints = {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: "environment"
                };
            }
            
            // 根据扫码类型选择回调函数
            const successCallback = (scanState.processType === 'query') 
                ? onProductQueryScanSuccess
                : onScanSuccess;
            
            // 启动扫码
            html5QrCode.start(
                { facingMode: "environment" },
                config,
                successCallback,
                onScanFailure
            ).catch(err => {
                console.error(`[性能补丁] 无法启动相机: ${err}`);
                showToast('无法启动相机，请检查权限设置', 'error');
                
                // 错误恢复
                setTimeout(() => {
                    try {
                        const simpleConfig = {
                            fps: 10,
                            qrbox: 250
                        };
                        html5QrCode.start({ facingMode: "environment" }, simpleConfig, successCallback, onScanFailure);
                    } catch (retryErr) {
                        console.error('[性能补丁] 重试启动相机失败:', retryErr);
                    }
                }, 1000);
            });
        };
    }
    
    // 优化停止扫码器函数
    if (typeof stopScanner === 'function') {
        const originalStopScanner = stopScanner;
        
        window.stopScanner = function() {
            // 首先清除相机流
            try {
                const videoElement = document.querySelector("#scanner-container video");
                if (videoElement && videoElement.srcObject) {
                    const tracks = videoElement.srcObject.getTracks();
                    tracks.forEach(track => track.stop());
                    videoElement.srcObject = null;
                }
            } catch (e) {}
            
            // 调用原始函数
            return originalStopScanner.apply(this, arguments);
        };
    }
}

console.log("[性能补丁] 扫码性能优化模块已加载"); 