/**
 * 任务管理模块 - 双次扫码制度
 * 功能：领取任务、完成任务、型号工时配置
 */

console.log('========================================');
console.log('🚀 任务管理模块开始加载...');
console.log('========================================');

// 保存原有的updateProductProcess函数（全局变量）
let originalUpdateProductProcess = null;
let isUpdateProductProcessPatched = false;

// ==================== 型号工时配置管理 ====================

/**
 * 加载所有可用型号列表
 */
async function loadAvailableModels() {
    try {
        // 从 products表获取所有产品型号
        const response = await fetch('/api/task/all-models');
        const data = await response.json();
        
        if (data.status === 'success' && data.data && Array.isArray(data.data)) {
            const datalist = document.getElementById('available-models');
            const hint = document.getElementById('available-models-hint');
            
            if (datalist) {
                datalist.innerHTML = '';
                
                // 添加所有型号
                data.data.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model;
                    datalist.appendChild(option);
                });
                
                if (hint) {
                    hint.innerHTML = `<i class="bi bi-check-circle"></i> 共 ${data.data.length} 个型号可选`;
                    hint.style.color = '#28a745';
                }
            }
        } else {
            const hint = document.getElementById('available-models-hint');
            if (hint) {
                hint.innerHTML = '<i class="bi bi-info-circle"></i> 暂无可用型号';
                hint.style.color = '#6c757d';
            }
        }
    } catch (error) {
        console.error('加载型号列表失败:', error);
        const hint = document.getElementById('available-models-hint');
        if (hint) {
            hint.innerHTML = '<i class="bi bi-exclamation-circle"></i> 加载失败';
            hint.style.color = '#dc3545';
        }
    }
}

/**
 * 打开型号工时配置界面
 */
async function handleWorkTimeConfig() {
    if (!userState.fullName) {
        showToast('请先登录', 'warning');
        return;
    }
    
    const modal = new bootstrap.Modal(document.getElementById('work-time-config-modal'));
    modal.show();
    
    // 加载配置列表
    await loadWorkTimeConfigs();
    
    // 加载所有型号列表
    await loadAvailableModels();
}

/**
 * 加载工时配置列表
 */
async function loadWorkTimeConfigs() {
    try {
        const response = await fetch('/api/task/work-time-config');
        const data = await response.json();
        
        if (data.status === 'success') {
            displayWorkTimeConfigs(data.data);
        } else {
            showToast('加载配置失败', 'error');
        }
    } catch (error) {
        console.error('加载工时配置失败:', error);
        showToast('加载配置失败', 'error');
    }
}

/**
 * 显示工时配置列表
 */
function displayWorkTimeConfigs(configs) {
    const container = document.getElementById('work-time-config-list');
    
    if (!configs || configs.length === 0) {
        container.innerHTML = '<p class="text-center text-muted">暂无配置</p>';
        return;
    }
    
    const processNameMap = {
        'embedding': '嵌线',
        'wiring': '绕线',
        'connecting': '接线',
        'pressing': '压装',
        'stopper': '车止口',
        'immersion': '浸漆'
    };
    
    let html = `
        <table class="table table-striped table-hover">
            <thead>
                <tr>
                    <th>型号名称</th>
                    <th>工序</th>
                    <th>扫码次数</th>
                    <th>最短工时</th>
                    <th>配置人</th>
                    <th>配置时间</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    configs.forEach(config => {
        const configTime = new Date(config.configured_at).toLocaleString('zh-CN');
        const processName = processNameMap[config.process_type] || config.process_type;
        
        html += `
            <tr>
                <td><strong>${config.model_name}</strong></td>
                <td><span class="badge bg-primary">${processName}</span></td>
                <td><span class="badge ${config.scan_mode === 'single' ? 'bg-success' : 'bg-info'}">${config.scan_mode === 'single' ? '一次录入' : '两次录入'}</span></td>
                <td><span class="text-danger fw-bold">${config.min_work_minutes}</span> 分钟${config.min_work_minutes === 0 ? '(不限制)' : ''}</td>
                <td>${config.configured_by}</td>
                <td><small>${configTime}</small></td>
                <td>
                    <button class="btn btn-sm btn-warning" onclick="editWorkTimeConfig('${config.model_name}', '${config.process_type}', '${config.scan_mode}', ${config.min_work_minutes})">
                        <i class="bi bi-pencil"></i>
                    </button>
                    ${config.model_name !== '默认配置' ? `
                    <button class="btn btn-sm btn-danger" onclick="deleteWorkTimeConfig('${config.model_name}', '${config.process_type}')">
                        <i class="bi bi-trash"></i>
                    </button>
                    ` : ''}
                </td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

/**
 * 保存工时配置
 */
window.saveWorkTimeConfig = async function() {
    const modelName = document.getElementById('config-model-name').value.trim();
    const processType = document.getElementById('config-process-type').value;
    const scanMode = document.getElementById('config-scan-mode').value;
    const minMinutes = parseInt(document.getElementById('config-min-minutes').value) || 0;
    
    if (!modelName) {
        showToast('请输入型号名称', 'warning');
        return;
    }
    
    // 一次录入不需要验证工时
    if (scanMode === 'double' && minMinutes < 0) {
        showToast('最短工时不能为负数', 'warning');
        return;
    }
    
    try {
        const requestData = {
            model_name: modelName,
            process_type: processType,
            scan_mode: scanMode,
            min_work_minutes: minMinutes,
            configured_by: userState.fullName
        };
        
        const response = await fetch('/api/task/work-time-config', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(requestData)
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            showToast(data.message, 'success');
            
            // 清空表单
            document.getElementById('config-model-name').value = '';
            document.getElementById('config-scan-mode').value = 'single';
            document.getElementById('config-min-minutes').value = '0';
            document.getElementById('config-min-minutes').disabled = true;
            document.getElementById('config-min-minutes').classList.add('bg-light');
            
            // 重新加载列表
            await loadWorkTimeConfigs();
        } else {
            showToast('保存失败', 'error');
        }
    } catch (error) {
        console.error('保存工时配置失败:', error);
        showToast('保存失败：' + error.message, 'error');
    }
}

/**
 * 编辑工时配置
 */
window.editWorkTimeConfig = function(modelName, processType, scanMode, minMinutes) {
    document.getElementById('config-model-name').value = modelName;
    document.getElementById('config-process-type').value = processType;
    document.getElementById('config-scan-mode').value = scanMode;
    document.getElementById('config-min-minutes').value = minMinutes;
    
    // 根据扫码模式设置工时输入框状态
    const minMinutesInput = document.getElementById('config-min-minutes');
    if (scanMode === 'single') {
        minMinutesInput.disabled = true;
        minMinutesInput.classList.add('bg-light');
    } else {
        minMinutesInput.disabled = false;
        minMinutesInput.classList.remove('bg-light');
    }
    
    // 滚动到表单
    document.getElementById('config-model-name').scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById('config-model-name').focus();
}

/**
 * 删除工时配置
 */
window.deleteWorkTimeConfig = async function(modelName, processType) {
    if (!confirm(`确认删除型号 ${modelName} 的工时配置吗？`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/task/work-time-config/${encodeURIComponent(modelName)}/${processType}?deleted_by=${encodeURIComponent(userState.fullName)}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            showToast('删除成功', 'success');
            await loadWorkTimeConfigs();
        } else {
            showToast('删除失败', 'error');
        }
    } catch (error) {
        console.error('删除工时配置失败:', error);
        showToast('删除失败', 'error');
    }
}


// ==================== 双次扫码逻辑 ====================

/**
 * 处理嵌线扫码（双次扫码逻辑）
 * @param {string} productCode - 产品编码
 * @param {string} employeeName - 员工姓名
 * @returns {Promise<boolean>} - 是否成功
 */
async function handleEmbeddingTask(productCode, employeeName) {
    try {
        console.log(`[handleEmbeddingTask] 开始处理: ${productCode}`);
        
        // 1. 先查询产品状态
        const statusResponse = await fetch(`/api/products/${encodeURIComponent(productCode)}`);
        if (!statusResponse.ok) {
            // 产品不存在，使用原有逻辑（创建新产品）
            console.log(`[handleEmbeddingTask] 产品不存在，使用原有逻辑`);
            if (typeof originalUpdateProductProcess === 'function') {
                return await originalUpdateProductProcess(productCode, 'embedding', employeeName, true);
            }
            return false;
        }
        
        const product = await statusResponse.json();
        console.log(`[handleEmbeddingTask] 产品信息:`, {
            '嵌线任务状态': product['嵌线任务状态'],
            '嵌线领取时间': product['嵌线领取时间'],
            '嵌线时间': product['嵌线时间']
        });
        
        const taskStatus = product['嵌线任务状态'];
        const claimEmployee = product['嵌线领取员工'];
        const claimTime = product['嵌线领取时间'];
        
        console.log(`[handleEmbeddingTask] 启用双次扫码逻辑`);
        
        // 2. 判断是第一次扫码还是第二次扫码
        if (!taskStatus || taskStatus === '未领取') {
            // 第一次扫码 - 领取任务
            console.log(`[handleEmbeddingTask] 第一次扫码，领取任务`);
            return await claimEmbeddingTask(productCode, employeeName, product);
        } else if (taskStatus === '进行中') {
            // 第二次扫码 - 完成任务
            console.log(`[handleEmbeddingTask] 第二次扫码，完成任务`);
            return await completeEmbeddingTask(productCode, employeeName, product);
        } else if (taskStatus === '已完成') {
            showToast('该产品已完成嵌线工序', 'warning');
            return false;
        }
        
    } catch (error) {
        console.error('处理嵌线任务失败:', error);
        showToast('操作失败：' + error.message, 'error');
        return false;
    }
}

/**
 * 领取嵌线任务（第一次扫码）
 */
async function claimEmbeddingTask(productCode, employeeName, product) {
    try {
        const response = await fetch('/api/task/claim', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                product_code: productCode,
                employee_name: employeeName,
                process_type: 'embedding'
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.status === 'success') {
            // 领取成功
            const canCompleteTime = new Date(data.can_complete_at).toLocaleTimeString('zh-CN');
            showToast(
                `✅ 任务领取成功！\n型号：${data.product_model}\n最短工时：${data.min_work_minutes}分钟\n完成后请再次扫码（${canCompleteTime}后可完成）`,
                'success',
                5000
            );
            return true;
        } else if (data.status === 'already_claimed') {
            // 已经领取过，提示可以完成
            showToast('您已领取过此任务，请完成后再次扫码', 'info');
            return false;
        } else {
            showToast(data.detail || '领取失败', 'error');
            return false;
        }
    } catch (error) {
        console.error('领取任务失败:', error);
        showToast('领取失败：' + error.message, 'error');
        return false;
    }
}

/**
 * 完成嵌线任务（第二次扫码）
 */
async function completeEmbeddingTask(productCode, employeeName, product) {
    try {
        const response = await fetch('/api/task/complete', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                product_code: productCode,
                employee_name: employeeName,
                process_type: 'embedding'
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.status === 'success') {
            // 完成成功
            showToast(
                `✅ 任务完成！\n型号：${data.product_model}\n用时：${data.duration_minutes}分钟\n要求：${data.min_required_minutes}分钟`,
                'success',
                4000
            );
            return true;
        } else {
            // 完成失败（可能是时间不足）
            const errorMsg = data.detail || '完成失败';
            
            // 如果是时间不足的错误，显示倒计时
            if (errorMsg.includes('不足') && errorMsg.includes('分钟')) {
                showToast(`⏱️ ${errorMsg}`, 'warning', 5000);
            } else {
                showToast(errorMsg, 'error');
            }
            return false;
        }
    } catch (error) {
        console.error('完成任务失败:', error);
        showToast('完成失败：' + error.message, 'error');
        return false;
    }
}

/**
 * 扩展showToast函数支持更长的显示时间
 */
const originalShowToast = window.showToast;
window.showToast = function(message, type, duration) {
    if (typeof originalShowToast === 'function') {
        return originalShowToast(message, type, duration);
    } else {
        alert(message);
    }
};


// ==================== 集成到现有扫码流程 ====================

/**
 * 修改现有的updateProductProcess函数，集成双次扫码逻辑
 * 只对嵌线工序启用双次扫码
 */
// 延迟执行，确保 app-new.js 已加载
function patchUpdateProductProcess() {
    if (isUpdateProductProcessPatched) {
        return;
    }
    
    // 保存原有函数
    if (!originalUpdateProductProcess && typeof window.updateProductProcess === 'function') {
        originalUpdateProductProcess = window.updateProductProcess;
        console.log('✅ 已保存原有的 updateProductProcess 函数');
    }
    
    // 重写函数
    window.updateProductProcess = async function(productCode, processType, employeeName, showSuccessToast = true) {
        console.log(`[updateProductProcess] 产品: ${productCode}, 工序: ${processType}, 员工: ${employeeName}`);
        
        // 如果是嵌线工序，使用双次扫码逻辑
        if (processType === 'embedding') {
            console.log('[updateProductProcess] 检测到嵌线工序，使用双次扫码逻辑');
            return await handleEmbeddingTask(productCode, employeeName);
        }
        
        // 其他工序使用原有逻辑
        if (typeof originalUpdateProductProcess === 'function') {
            return await originalUpdateProductProcess(productCode, processType, employeeName, showSuccessToast);
        }
        
        return false;
    };
    
    isUpdateProductProcessPatched = true;
    console.log('✅ updateProductProcess 已被重写，嵌线工序启用双次扫码');
}

// 在页面加载完成后执行补丁
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(patchUpdateProductProcess, 100);
    });
} else {
    setTimeout(patchUpdateProductProcess, 100);
}


// ==================== 初始化 ====================

// ==================== 通知频率设置 ====================

/**
 * 打开通知频率设置界面
 */
async function handleNotificationFrequency() {
    if (!userState.fullName) {
        showToast('请先登录', 'warning');
        return;
    }
    
    const modal = new bootstrap.Modal(document.getElementById('notification-frequency-modal'));
    modal.show();
    
    // 加载当前配置
    await loadNotificationFrequency();
}

/**
 * 加载通知频率配置
 */
async function loadNotificationFrequency() {
    try {
        const response = await fetch('/api/task/notification-frequency');
        const data = await response.json();
        
        if (data.status === 'success' && data.data) {
            data.data.forEach(config => {
                const selectId = `freq-${config.notification_type.replace('_', '-')}`;
                const select = document.getElementById(selectId);
                if (select) {
                    select.value = config.interval_minutes;
                }
            });
        }
    } catch (error) {
        console.error('加载通知频率配置失败:', error);
    }
}

/**
 * 保存通知设置（包括频率、开关、免打扰）
 */
window.saveNotificationSettings = async function() {
    try {
        const configs = [
            {
                type: 'task_complete',
                interval: parseInt(document.getElementById('freq-task-complete').value)
            },
            {
                type: 'config_change',
                interval: parseInt(document.getElementById('freq-config-change').value)
            },
            {
                type: 'abnormal_alert',
                interval: parseInt(document.getElementById('freq-abnormal-alert').value)
            }
        ];
        
        let successCount = 0;
        
        for (const config of configs) {
            try {
                const response = await fetch('/api/task/notification-frequency', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        notification_type: config.type,
                        interval_minutes: config.interval,
                        updated_by: userState.fullName
                    })
                });
                
                const data = await response.json();
                if (data.status === 'success') {
                    successCount++;
                } else {
                    console.error(`保存${config.type}失败:`, data);
                }
            } catch (err) {
                console.error(`保存${config.type}异常:`, err);
            }
        }
        
        // TODO: 保存推送开关和免打扰时间（后续实现）
        const enablePush = document.getElementById('enable-push').checked;
        const quietStart = document.getElementById('quiet-start-hour').value;
        const quietEnd = document.getElementById('quiet-end-hour').value;
        
        // 这里可以调用现有的推送设置 API
        // await savePushSettings(enablePush, quietStart, quietEnd);
        
        if (successCount === configs.length) {
            showToast('通知设置已保存', 'success');
            
            // 关闭模态框
            const modal = bootstrap.Modal.getInstance(document.getElementById('notification-frequency-modal'));
            if (modal) {
                modal.hide();
            }
        } else {
            showToast('部分设置保存失败', 'warning');
        }
    } catch (error) {
        console.error('保存通知频率设置失败:', error);
        showToast('保存失败', 'error');
    }
}

// ==================== 初始化 ====================

// 页面加载时绑定事件
document.addEventListener('DOMContentLoaded', function() {
    // 绑定型号工时配置按钮
    const workTimeConfigBtn = document.getElementById('work-time-config-btn');
    if (workTimeConfigBtn) {
        workTimeConfigBtn.addEventListener('click', handleWorkTimeConfig);
    }
    
    // 绑定通知频率设置按钮
    const notificationFrequencyBtn = document.getElementById('notification-frequency-btn');
    if (notificationFrequencyBtn) {
        notificationFrequencyBtn.addEventListener('click', handleNotificationFrequency);
    }
    
    // 绑定扫码模式变化事件
    const scanModeSelect = document.getElementById('config-scan-mode');
    if (scanModeSelect) {
        scanModeSelect.addEventListener('change', function() {
            const minMinutesInput = document.getElementById('config-min-minutes');
            const minTimeHint = document.getElementById('min-time-hint');
            
            if (this.value === 'single') {
                // 一次录入：禁用最短工时
                minMinutesInput.disabled = true;
                minMinutesInput.classList.add('bg-light');
                minMinutesInput.value = '0';
                if (minTimeHint) {
                    minTimeHint.textContent = '一次录入不需要设置工时';
                    minTimeHint.style.color = '#6c757d';
                }
            } else {
                // 两次录入：启用最短工时
                minMinutesInput.disabled = false;
                minMinutesInput.classList.remove('bg-light');
                if (minTimeHint) {
                    minTimeHint.textContent = '仅两次录入时生效，0=不限制';
                    minTimeHint.style.color = '#6c757d';
                }
            }
        });
    }
});

console.log('✅ 任务管理模块已加载（双次扫码制度）');

// 立即尝试执行补丁（如果函数已存在）
if (typeof window.updateProductProcess === 'function') {
    console.log('🔧 检测到 updateProductProcess 已存在，立即执行补丁');
    patchUpdateProductProcess();
} else {
    console.log('⏳ updateProductProcess 尚未定义，等待 DOMContentLoaded');
}
