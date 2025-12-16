/**
 * 嵌线双次扫码补丁
 * 直接在页面加载后立即执行
 */

(function() {
    console.log('========================================');
    console.log('🚀 嵌线双次扫码补丁开始执行...');
    console.log('========================================');
    
    // 保存原有函数
    const originalUpdateProductProcess = window.updateProductProcess;
    
    if (!originalUpdateProductProcess) {
        console.error('❌ updateProductProcess 函数不存在，无法应用补丁');
        return;
    }
    
    console.log('✅ 已找到原有的 updateProductProcess 函数');
    
    // 重写函数
    window.updateProductProcess = async function(productCode, processType, employeeName, showSuccessToast = true) {
        console.log(`[嵌线扫码] 产品: ${productCode}, 工序: ${processType}`);
        
        // 只对嵌线工序启用特殊逻辑
        if (processType !== 'embedding') {
            return await originalUpdateProductProcess(productCode, processType, employeeName, showSuccessToast);
        }
        
        console.log('[嵌线扫码] 检测到嵌线工序，尝试双次扫码逻辑');
        
        try {
            // 直接尝试领取任务，让后端判断
            const claimResponse = await fetch('/api/task/claim', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    product_code: productCode,
                    employee_name: employeeName,
                    process_type: 'embedding'
                })
            });
            
            const claimData = await claimResponse.json();
            
            if (claimResponse.ok && claimData.status === 'success') {
                // 领取成功
                console.log('[嵌线扫码] 领取成功');
                let message = `✅ 任务领取成功！\n型号：${claimData.product_model}`;
                if (claimData.min_work_minutes > 0) {
                    const canCompleteTime = new Date(claimData.can_complete_at).toLocaleTimeString('zh-CN');
                    message += `\n最短工时：${claimData.min_work_minutes}分钟\n完成后请再次扫码（${canCompleteTime}后可完成）`;
                } else {
                    message += `\n无时间限制，完成后请再次扫码`;
                }
                showToast(message, 'success', 5000);
                return true;
            } else if (claimData.status === 'already_claimed') {
                // 已经领取过，提示可以完成
                console.log('[嵌线扫码] 已领取，可以完成');
                showToast('您已领取过此任务，请完成后再次扫码', 'info');
                return false;
            } else if (claimResponse.status === 404) {
                // 产品不存在，使用原有逻辑创建
                console.log('[嵌线扫码] 产品不存在，创建新产品');
                return await originalUpdateProductProcess(productCode, processType, employeeName, showSuccessToast);
            } else if (claimData.detail && claimData.detail.includes('已被') && claimData.detail.includes('领取')) {
                // 被别人领取了
                showToast(claimData.detail, 'error');
                return false;
            } else {
                // 其他错误，可能是已完成或其他状态，尝试完成任务
                console.log('[嵌线扫码] 领取失败，尝试完成任务');
                return await tryCompleteTask(productCode, employeeName);
            }
            
        } catch (error) {
            console.error('[嵌线扫码] 错误:', error);
            // 出错时使用原有逻辑
            return await originalUpdateProductProcess(productCode, processType, employeeName, showSuccessToast);
        }
    };
    
    // 尝试完成任务
    async function tryCompleteTask(productCode, employeeName) {
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
                showToast(
                    `✅ 任务完成！\n型号：${data.product_model}\n用时：${data.duration_minutes}分钟`,
                    'success',
                    4000
                );
                return true;
            } else {
                const errorMsg = data.detail || '完成失败';
                showToast(`⏱️ ${errorMsg}`, 'warning', 5000);
                return false;
            }
        } catch (error) {
            console.error('[嵌线扫码] 完成失败:', error);
            return false;
        }
    }
    
    // 领取任务
    async function claimTask(productCode, productModel, employeeName, minWorkTime) {
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
                let message = `✅ 任务领取成功！\n型号：${data.product_model}`;
                
                if (minWorkTime > 0) {
                    const canCompleteTime = new Date(data.can_complete_at).toLocaleTimeString('zh-CN');
                    message += `\n最短工时：${minWorkTime}分钟\n完成后请再次扫码（${canCompleteTime}后可完成）`;
                } else {
                    message += `\n无时间限制，完成后请再次扫码`;
                }
                
                showToast(message, 'success', 5000);
                return true;
            } else {
                showToast(data.detail || '领取失败', 'error');
                return false;
            }
        } catch (error) {
            console.error('[双次扫码] 领取失败:', error);
            showToast('领取失败', 'error');
            return false;
        }
    }
    
    // 完成任务
    async function completeTask(productCode, productModel, employeeName, minWorkTime) {
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
                showToast(
                    `✅ 任务完成！\n型号：${data.product_model}\n用时：${data.duration_minutes}分钟`,
                    'success',
                    4000
                );
                return true;
            } else {
                const errorMsg = data.detail || '完成失败';
                showToast(`⏱️ ${errorMsg}`, 'warning', 5000);
                return false;
            }
        } catch (error) {
            console.error('[双次扫码] 完成失败:', error);
            showToast('完成失败', 'error');
            return false;
        }
    }
    
    console.log('========================================');
    console.log('✅ 嵌线双次扫码补丁已应用');
    console.log('========================================');
    
})();
