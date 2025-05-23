/**
 * 扫码APP集成补丁
 * 用于处理支付宝、随便扫等扫码APP的回调
 */

(function() {
    // 页面加载完成后执行
    document.addEventListener('DOMContentLoaded', function() {
        console.log('扫码APP集成补丁已加载');
        
        // 检查URL参数是否包含扫码结果
        checkForScanResults();
        
        // 监听页面可见性变化
        document.addEventListener('visibilitychange', function() {
            if (document.visibilityState === 'visible') {
                console.log('页面从后台恢复，检查是否有扫码结果');
                
                // 检查URL参数
                checkForScanResults();
                
                // 检查是否有等待处理的扫码结果
                if (window.scanState && window.scanState.callbackPending) {
                    console.log('检测到有等待处理的扫码结果');
                    
                    // 获取扫码时间戳并验证时间范围
                    const suibianTimestamp = parseInt(localStorage.getItem('suibian_scan_timestamp') || '0');
                    const alipayTimestamp = parseInt(localStorage.getItem('alipay_scan_timestamp') || '0');
                    const lastTimestamp = Math.max(suibianTimestamp, alipayTimestamp);
                    const currentTime = Date.now();
                    const timeElapsed = currentTime - lastTimestamp;
                    
                    // 如果时间间隔在合理范围内（2秒到2分钟内）
                    if (timeElapsed > 2000 && timeElapsed < 120000) {
                        // 延迟一点执行，等待系统粘贴板更新
                        setTimeout(() => {
                            // 尝试从剪贴板获取扫码结果
                            if (navigator.clipboard && navigator.clipboard.readText) {
                                navigator.clipboard.readText()
                                    .then(text => {
                                        if (text && text.trim() !== '') {
                                            console.log('从剪贴板获取到扫码结果:', text);
                                            
                                            // 如果存在处理函数，调用它
                                            if (window.handleExternalScanResult) {
                                                window.handleExternalScanResult(text);
                                            } else {
                                                console.log('未找到处理函数，将结果保存到localStorage');
                                                localStorage.setItem('pending_scan_result', text);
                                                if (window.showToast) {
                                                    window.showToast('已获取扫码结果，请选择操作', 'info');
                                                }
                                            }
                                        }
                                    })
                                    .catch(err => {
                                        console.error('无法读取剪贴板:', err);
                                        if (window.showToast) {
                                            window.showToast('无法读取扫码结果，请手动输入', 'warning');
                                        }
                                    });
                            }
                        }, 500);
                    }
                    
                    // 重置回调等待标志
                    window.scanState.callbackPending = false;
                }
            }
        });
        
        // 添加一个辅助函数，用于直接调用支付宝扫一扫
        window.openAlipayScanner = window.openAlipayScanner || function() {
            // 设置回调处理标志
            if (window.scanState) {
                window.scanState.callbackPending = true;
            }
            
            // 记录时间戳，用于判断是否是有效返回
            localStorage.setItem('alipay_scan_timestamp', Date.now().toString());
            
            // 使用支付宝的URL Scheme调用扫一扫功能
            window.location.href = 'alipay://platformapi/startapp?appId=10000007';
            
            // 显示提示
            if (window.showToast) {
                window.showToast('扫码完成后点击支付宝右上角"关闭"按钮返回', 'info', 5000);
            }
            
            // 设置一个定时检查，提醒用户返回
            setTimeout(() => {
                // 10秒后如果页面还在前台，提示用户返回
                if (document.visibilityState === 'visible' && window.scanState && window.scanState.callbackPending) {
                    if (window.showToast) {
                        window.showToast('扫码完成了吗？别忘了返回网页', 'warning', 3000);
                    }
                }
            }, 10000);
            
            console.log('正在打开支付宝扫一扫...');
        };
        
        // 添加一个辅助函数，用于直接调用《随便扫》APP
        window.openSuibianScan = window.openSuibianScan || function() {
            // 设置回调处理标志
            if (window.scanState) {
                window.scanState.callbackPending = true;
            }
            
            // 记录时间戳，用于判断是否是有效返回
            localStorage.setItem('suibian_scan_timestamp', Date.now().toString());
            
            // 获取当前URL（需要进行编码，作为回调参数）
            const currentUrl = encodeURIComponent(window.location.href);
            
            // 尝试调用《随便扫》APP
            try {
                // 构建包含回调参数的URL Scheme
                window.location.href = `qrcode://scan?returnURL=${currentUrl}`;
                
                // 显示提示
                if (window.showToast) {
                    window.showToast('扫码后请手动返回本页面', 'info', 3000);
                }
            } catch (err) {
                console.error('调用随便扫APP失败:', err);
                if (window.showToast) {
                    window.showToast('无法启动随便扫APP，请确认已安装', 'error');
                }
            }
        };
    });
    
    // 检查URL参数是否包含扫码结果
    function checkForScanResults() {
        // 获取URL参数
        const urlParams = new URLSearchParams(window.location.search);
        let scanResult = null;
        
        // 尝试多种可能的参数名
        // 1. 检查是否有明确的扫码结果参数
        const possibleResultParams = ['result', 'scan_result', 'code', 'qrcode', 'text', 'data', 'content'];
        for (const param of possibleResultParams) {
            if (urlParams.has(param)) {
                scanResult = urlParams.get(param);
                console.log(`从URL参数[${param}]获取到扫码结果:`, scanResult);
                break;
            }
        }
        
        // 2. 如果没有明确的结果参数，但有from=标记，
        // 尝试检查是否有其他未知参数可能包含扫码结果
        if (!scanResult && (urlParams.has('from') || urlParams.has('source'))) {
            // 遍历所有参数，寻找可能的结果
            for (const [key, value] of urlParams.entries()) {
                // 跳过已知的非结果参数
                if (['from', 'source', 'type', 'app', 'time', 'timestamp'].includes(key)) {
                    continue;
                }
                
                // 假设其他参数可能是结果
                scanResult = value;
                console.log(`从未知URL参数[${key}]获取到可能的扫码结果:`, scanResult);
                break;
            }
        }
        
        // 如果找到了扫码结果
        if (scanResult) {
            // 获取上次扫码的时间戳
            const suibianTimestamp = parseInt(localStorage.getItem('suibian_scan_timestamp') || '0');
            const alipayTimestamp = parseInt(localStorage.getItem('alipay_scan_timestamp') || '0');
            const lastTimestamp = Math.max(suibianTimestamp, alipayTimestamp);
            const currentTime = Date.now();
            
            // 如果时间间隔在合理范围内，处理扫码结果
            if (currentTime - lastTimestamp < 120000) { // 2分钟内
                console.log('时间范围内的扫码结果，处理中...');
                
                // 如果存在处理函数，调用它
                if (window.handleExternalScanResult) {
                    window.handleExternalScanResult(scanResult);
                } else {
                    console.log('未找到处理函数，将结果保存到localStorage');
                    localStorage.setItem('pending_scan_result', scanResult);
                    if (window.showToast) {
                        window.showToast('已获取扫码结果，请选择操作', 'info');
                    }
                }
            } else {
                console.log('扫码结果超时或无效');
            }
            
            // 清除URL参数，避免刷新页面重复处理
            const cleanUrl = window.location.pathname + window.location.hash;
            window.history.replaceState({}, document.title, cleanUrl);
        }
    }
})(); 