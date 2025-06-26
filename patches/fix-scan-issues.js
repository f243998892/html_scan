/**
 * 扫码系统补丁文件
 * 解决以下问题：
 * 1. 产品扫码查询界面问题：手动输入框消失问题
 * 2. 连续扫码页面允许显示手动输入框（2024-06-修订）
 * 3. iOS产品扫码查询识别速度慢问题
 */

// 在文档加载完成后应用补丁
document.addEventListener('DOMContentLoaded', function() {
    console.log("[补丁] 文档已加载，准备应用补丁...");
    // 等待app.js加载完成
    setTimeout(applyPatches, 500);
});

// 全局变量，用于跟踪输入框状态
const patchState = {
    inputInitialized: false,
    lastCheckTime: 0,
    debugMode: true  // 设置为true开启详细日志
};

// 调试日志函数
function patchLog(message) {
    if (patchState.debugMode) {
        console.log(`[补丁] ${message}`);
    }
}

// 应用所有补丁
function applyPatches() {
    patchLog("正在应用系统补丁...");
    
    // 拦截原始的扫码查询函数，确保不会删除手动输入框
    enhanceHandleProductScanQuery();
    
    // 拦截清理函数，确保查询模式下不会清理输入框
    enhanceCleanupFunction();
    
    // 拦截停止扫描函数
    enhanceStopScanFunction();
    
    // 初始化DOM观察器
    initDomObserver();
    
    patchLog("所有补丁已应用，开始定期检查输入框...");
    
    // 开始周期性检查
    setInterval(checkInputField, 1000);
}

// 增强产品扫码查询处理函数
function enhanceHandleProductScanQuery() {
    if (typeof handleProductScanQuery === 'function') {
        patchLog("正在增强产品扫码查询处理...");
        
        // 保存原始函数
        const originalHandler = handleProductScanQuery;
        
        // 重写函数
        window.handleProductScanQuery = async function() {
            patchLog("产品扫码查询被触发");
            
            // 调用原始函数
            await originalHandler.apply(this, arguments);
            
            // 确保扫码页面上有输入框
            setTimeout(() => {
                ensureInputFieldExists();
                patchState.inputInitialized = true;
                patchLog("输入框已初始化");
            }, 300);
        };
    }
}

// 增强清理函数
function enhanceCleanupFunction() {
    if (typeof cleanup === 'function') {
        patchLog("正在增强清理函数...");
        
        // 保存原始函数
        const originalCleanup = cleanup;
        
        // 重写函数
        window.cleanup = function() {
            patchLog("清理函数被调用，当前模式: " + (scanState ? scanState.processType : "未知"));
            
            // 如果是查询模式，保存输入框
            let savedInput = null;
            if (scanState && scanState.processType === 'query') {
                const inputField = document.getElementById('manual-input-container');
                if (inputField) {
                    patchLog("保存查询模式输入框");
                    savedInput = inputField.cloneNode(true);
                }
            }
            
            // 调用原始清理
            originalCleanup.apply(this, arguments);
            
            // 如果是查询模式，恢复输入框
            if (scanState && scanState.processType === 'query' && savedInput) {
                patchLog("恢复查询模式输入框");
                const scannerContainer = document.getElementById('scanner-container');
                if (scannerContainer && scannerContainer.parentNode) {
                    scannerContainer.parentNode.insertBefore(savedInput, scannerContainer);
                    
                    // 重新绑定事件
                    const submitButton = savedInput.querySelector('#submit-manual-code');
                    const inputField = savedInput.querySelector('#manual-product-code');
                    
                    if (submitButton && inputField) {
                        // 清除可能存在的旧事件
                        const newSubmitButton = submitButton.cloneNode(true);
                        submitButton.parentNode.replaceChild(newSubmitButton, submitButton);
                        
                        const newInputField = inputField.cloneNode(true);
                        inputField.parentNode.replaceChild(newInputField, inputField);
                        
                        // 添加新事件
                        newSubmitButton.addEventListener('click', handleManualInput);
                        newInputField.addEventListener('keypress', function(e) {
                            if (e.key === 'Enter') {
                                handleManualInput();
                            }
                        });
                    }
                }
            }
        };
    }
}

// 增强停止扫描函数
function enhanceStopScanFunction() {
    if (typeof stopScan === 'function') {
        patchLog("正在增强停止扫描函数...");
        
        // 保存原始函数
        const originalStopScan = stopScan;
        
        // 重写函数
        window.stopScan = function() {
            patchLog("停止扫描被调用，当前模式: " + (scanState ? scanState.processType : "未知"));
            
            // 如果是查询模式，保存输入框
            let savedInput = null;
            if (scanState && scanState.processType === 'query') {
                const inputField = document.getElementById('manual-input-container');
                if (inputField) {
                    patchLog("保存查询模式输入框");
                    savedInput = inputField.cloneNode(true);
                }
            }
            
            // 调用原始函数
            originalStopScan.apply(this, arguments);
            
            // 如果是查询模式，恢复输入框（如果没有被恢复）
            if (scanState && scanState.processType === 'query' && savedInput) {
                setTimeout(() => {
                    if (!document.getElementById('manual-input-container')) {
                        patchLog("恢复查询模式输入框");
                        const scanScreen = document.getElementById('scan-screen');
                        if (scanScreen) {
                            const container = scanScreen.querySelector('.container') || scanScreen;
                            const scannerContainer = container.querySelector('#scanner-container');
                            if (scannerContainer) {
                                container.insertBefore(savedInput, scannerContainer);
                            } else {
                                container.appendChild(savedInput);
                            }
                            
                            // 重新绑定事件
                            const submitButton = savedInput.querySelector('#submit-manual-code');
                            const inputField = savedInput.querySelector('#manual-product-code');
                            
                            if (submitButton && inputField) {
                                submitButton.addEventListener('click', handleManualInput);
                                inputField.addEventListener('keypress', function(e) {
                                    if (e.key === 'Enter') {
                                        handleManualInput();
                                    }
                                });
                            }
                        }
                    }
                }, 100);
            }
        };
    }
}

// 初始化DOM观察器
function initDomObserver() {
    patchLog("初始化DOM观察器...");
    
    // 创建一个观察器实例
    const observer = new MutationObserver(function(mutations) {
        // 只在查询模式下检查DOM变化
        if (scanState && scanState.processType === 'query') {
            let needRestore = false;
            
            for (let mutation of mutations) {
                // 检查是否有节点被移除
                if (mutation.type === 'childList' && mutation.removedNodes.length > 0) {
                    for (let node of mutation.removedNodes) {
                        // 检查是否是手动输入框或其父元素被删除
                        if (node.id === 'manual-input-container' || 
                            (node.querySelector && node.querySelector('#manual-input-container'))) {
                            patchLog("检测到手动输入框被删除");
                            needRestore = true;
                            break;
                        }
                    }
                }
                
                if (needRestore) break;
            }
            
            // 如果需要恢复，延迟一点时间执行
            if (needRestore) {
                // 防止频繁触发，添加时间检查
                const now = Date.now();
                if (now - patchState.lastCheckTime > 300) { // 至少间隔300ms
                    patchState.lastCheckTime = now;
                    setTimeout(ensureInputFieldExists, 50);
                }
            }
        }
    });
    
    // 配置观察选项
    const config = { 
        childList: true,  // 观察子节点的增加和删除
        subtree: true     // 观察所有后代节点
    };
    
    // 开始观察文档
    observer.observe(document.body, config);
}

// 确保输入框存在的函数
function ensureInputFieldExists() {
    // 仅在扫码页面和查询模式下执行
    if (!scanState || scanState.processType !== 'query') return;
    
    const scanScreen = document.getElementById('scan-screen');
    if (!scanScreen || scanScreen.classList.contains('d-none')) return;
    
    // 检查输入框是否已存在
    const existingInput = document.getElementById('manual-input-container');
    if (existingInput) {
        // 确保输入框可见
        existingInput.style.display = 'block';
        existingInput.style.visibility = 'visible';
        existingInput.style.opacity = '1';
        patchLog("输入框已存在，确保其可见");
        return;
    }
    
    patchLog("创建新的输入框");
    
    // 创建输入框
    const inputContainer = document.createElement('div');
    inputContainer.id = 'manual-input-container';
    inputContainer.className = 'mb-3';
    inputContainer.style.display = 'block';
    inputContainer.style.visibility = 'visible';
    inputContainer.style.opacity = '1';
    inputContainer.innerHTML = `
        <div class="input-group mb-3">
            <input type="text" class="form-control" id="manual-product-code" placeholder="手动输入产品编码">
            <button class="btn btn-primary" id="submit-manual-code" type="button">查询</button>
        </div>
    `;
    
    // 找到合适的位置插入
    const scannerContainer = document.getElementById('scanner-container');
    if (scannerContainer && scannerContainer.parentNode) {
        scannerContainer.parentNode.insertBefore(inputContainer, scannerContainer);
        patchLog("输入框已添加到扫描器容器前");
    } else {
        // 如果找不到扫描器容器，尝试添加到扫描屏幕
        const container = scanScreen.querySelector('.container') || scanScreen;
        container.insertBefore(inputContainer, container.firstChild);
        patchLog("输入框已添加到扫描屏幕开始位置");
    }
    
    // 绑定事件处理函数
    const submitButton = document.getElementById('submit-manual-code');
    const inputField = document.getElementById('manual-product-code');
    
    if (submitButton && inputField) {
        submitButton.addEventListener('click', function() {
            if (typeof handleManualInput === 'function') {
                handleManualInput();
            } else {
                patchLog("错误: handleManualInput 函数不存在");
            }
        });
        
        inputField.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && typeof handleManualInput === 'function') {
                handleManualInput();
            }
        });
        
        patchLog("输入框事件已绑定");
    } else {
        patchLog("错误: 无法找到提交按钮或输入字段");
    }
}

// 周期性检查输入框
function checkInputField() {
    // 只在已初始化的情况下检查
    if (!patchState.inputInitialized) return;
    
    // 只在查询模式下检查
    if (scanState && scanState.processType === 'query') {
        const scanScreen = document.getElementById('scan-screen');
        if (scanScreen && !scanScreen.classList.contains('d-none')) {
            const now = Date.now();
            // 限制检查频率以避免过多日志
            if (now - patchState.lastCheckTime > 3000) { // 至少间隔3秒记录一次
                patchState.lastCheckTime = now;
                patchLog("执行周期性输入框检查");
            }
            ensureInputFieldExists();
        }
    }
}

// 在切换到扫码页面时增加额外检查
const originalShowScreen = showScreen;
showScreen = function(screenId) {
    // 调用原始函数
    originalShowScreen(screenId);
    
    // 如果切换到扫码页面，且是查询模式，确保有手动输入框
    if (screenId === 'scan-screen' && scanState && scanState.processType === 'query') {
        // 给页面切换一点时间，然后检查
        setTimeout(ensureInputFieldExists, 100);
        setTimeout(ensureInputFieldExists, 500);
    }
};

console.log('[补丁] 产品扫码查询页面输入框修复脚本已加载'); 