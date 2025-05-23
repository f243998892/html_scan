/**
 * iOS设备兼容性修复脚本
 * 解决iOS设备在内网访问时的数据查询和录入问题
 */

// 在文档加载完成后应用补丁
document.addEventListener('DOMContentLoaded', function() {
    console.log("[iOS补丁] 文档已加载，准备应用iOS补丁...");
    // 检测iOS设备
    if (isIOS()) {
        console.log("[iOS补丁] 检测到iOS设备，应用特定修复");
        setTimeout(applyIOSFixes, 800);
    }
});

// 检测是否为iOS设备
function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

// 应用iOS特定修复
function applyIOSFixes() {
    // 1. 修复AJAX请求
    patchAjaxRequests();
    
    // 2. 修复HTML5 QR扫描器
    patchQRScanner();
    
    // 3. 修复表单提交
    patchFormSubmissions();
    
    console.log("[iOS补丁] 已应用所有iOS设备特定修复");
}

// 修复AJAX请求
function patchAjaxRequests() {
    console.log("[iOS补丁] 正在修复AJAX请求...");
    
    // 保存原始fetch函数
    const originalFetch = window.fetch;
    
    // 重写fetch函数，添加额外头部和处理
    window.fetch = function(url, options = {}) {
        // 创建新的options对象，避免修改原始对象
        let newOptions = { ...options };
        
        // 确保headers对象存在
        newOptions.headers = newOptions.headers || {};
        
        // 添加iOS特定标志
        if (typeof newOptions.headers.append === 'function') {
            newOptions.headers.append('X-iOS-Client', 'true');
        } else {
            newOptions.headers = {
                ...newOptions.headers,
                'X-iOS-Client': 'true'
            };
        }
        
        // 添加防缓存参数到URL
        if (typeof url === 'string') {
            const separator = url.includes('?') ? '&' : '?';
            url = `${url}${separator}_iosNoCache=${Date.now()}`;
        }
        
        // 调用原始fetch函数
        return originalFetch.call(this, url, newOptions)
            .then(response => {
                // 检查响应是否成功
                if (!response.ok && isIOS()) {
                    console.log(`[iOS补丁] 请求失败: ${url}, 状态: ${response.status}`);
                    // 这里可以添加iOS特定的错误处理
                }
                return response;
            })
            .catch(error => {
                console.error(`[iOS补丁] 请求异常: ${url}`, error);
                // 重新抛出异常，让调用者处理
                throw error;
            });
    };
    
    // 添加HTTPS特定处理
    if (window.location.protocol === 'https:') {
        console.log("[iOS补丁] 检测到HTTPS连接，应用特殊处理");
        
        // 为所有HTTPS请求添加额外时间戳和处理
        const originalOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function() {
            let args = Array.from(arguments);
            let url = args[1];
            
            // 添加时间戳避免缓存
            if (typeof url === 'string' && url.startsWith('https')) {
                const separator = url.includes('?') ? '&' : '?';
                url = `${url}${separator}_iostimestamp=${Date.now()}`;
                args[1] = url;
            }
            
            return originalOpen.apply(this, args);
        };
        
        // 添加对location.reload的补丁，确保iOS Safari正确重载页面
        const originalReload = window.location.reload;
        window.location.reload = function() {
            if (isIOS()) {
                console.log("[iOS补丁] 使用特殊方式重载页面");
                // 使用一个特殊的URL参数强制刷新
                window.location.href = window.location.href.split('?')[0] + '?_iosreload=' + Date.now();
            } else {
                originalReload.apply(window.location);
            }
        };
    }
    
    console.log("[iOS补丁] AJAX请求修复完成");
}

// 修复HTML5 QR扫描器
function patchQRScanner() {
    console.log("[iOS补丁] 正在修复QR扫描器...");
    
    // 监听扫描器初始化
    const originalInitializeScanner = window.initializeScanner;
    if (typeof originalInitializeScanner === 'function') {
        window.initializeScanner = function() {
            // 调用原始函数
            originalInitializeScanner.apply(this, arguments);
            
            // 为iOS设备应用特定设置
            if (isIOS() && scanState && scanState.currentHtml5QrScanner) {
                console.log("[iOS补丁] 应用iOS扫描器特定设置");
                
                // 2秒后应用相机设置，确保相机已初始化
                setTimeout(() => {
                    try {
                        // 应用连续自动对焦模式
                        scanState.currentHtml5QrScanner.applyVideoConstraints({
                            focusMode: "continuous",
                            // 不使用缩放，因为iOS 16以下不支持
                            // 增加分辨率
                            width: { ideal: 1920 },
                            height: { ideal: 1080 }
                        });
                        console.log("[iOS补丁] 已应用iOS相机增强设置");
                    } catch (e) {
                        console.error("[iOS补丁] 应用相机设置时出错:", e);
                    }
                }, 2500);
            }
        };
    }
    
    console.log("[iOS补丁] QR扫描器修复完成");
}

// 修复表单提交
function patchFormSubmissions() {
    console.log("[iOS补丁] 正在修复表单提交...");
    
    // 修复批量更新函数
    const originalBatchUpdate = window.batchUpdateProductProcess;
    if (typeof originalBatchUpdate === 'function') {
        window.batchUpdateProductProcess = async function(productCodes, processType, employeeName) {
            console.log("[iOS补丁] 拦截批量更新请求", productCodes);
            
            if (isIOS()) {
                // 为iOS设备设置更长的超时和重试机制
                try {
                    const result = await originalBatchUpdate.apply(this, arguments);
                    console.log("[iOS补丁] 批量更新成功", result);
                    return result;
                } catch (error) {
                    console.error("[iOS补丁] 批量更新失败，尝试重试", error);
                    
                    // 等待500ms后重试
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    // 重试请求
                    return await originalBatchUpdate.apply(this, arguments);
                }
            } else {
                return await originalBatchUpdate.apply(this, arguments);
            }
        };
    }
    
    // 修复产品查询函数
    const originalGetProductDetails = window.getProductDetails;
    if (typeof originalGetProductDetails === 'function') {
        window.getProductDetails = async function(productCode) {
            console.log("[iOS补丁] 拦截产品查询请求", productCode);
            
            if (isIOS()) {
                try {
                    let result = await originalGetProductDetails.apply(this, arguments);
                    
                    // 如果在iOS上查询失败，尝试重试一次
                    if (!result) {
                        console.log("[iOS补丁] 产品查询首次失败，尝试重试");
                        // 等待300ms后重试
                        await new Promise(resolve => setTimeout(resolve, 300));
                        result = await originalGetProductDetails.apply(this, arguments);
                    }
                    
                    return result;
                } catch (error) {
                    console.error("[iOS补丁] 产品查询异常，尝试重试", error);
                    
                    // 等待300ms后重试
                    await new Promise(resolve => setTimeout(resolve, 300));
                    
                    // 重试请求
                    return await originalGetProductDetails.apply(this, arguments);
                }
            } else {
                return await originalGetProductDetails.apply(this, arguments);
            }
        };
    }
    
    console.log("[iOS补丁] 表单提交修复完成");
} 
