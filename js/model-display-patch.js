/**
 * 型号显示补丁
 * 修改app-new.js中的关键函数，使其支持型号切换
 */

(function() {
    console.log('🔧 型号显示补丁开始应用...');
    
    // 等待DOM加载完成
    document.addEventListener('DOMContentLoaded', function() {
        // 重写产品详情显示函数
        if (typeof window.showProductDetail === 'function') {
            const originalShowProductDetail = window.showProductDetail;
            
            window.showProductDetail = function(product) {
                // 临时替换产品型号字段为当前选择的型号
                if (product && typeof ModelSwitcher !== 'undefined') {
                    // 使用getModelFromProduct获取根据当前模式选择的型号
                    const modelValue = ModelSwitcher.getModelFromProduct(product);
                    
                    // 创建一个代理对象，在访问"产品型号"时返回当前选择的型号
                    const productProxy = new Proxy(product, {
                        get(target, prop) {
                            if (prop === '产品型号') {
                                return modelValue || target[prop];
                            }
                            return target[prop];
                        }
                    });
                    
                    return originalShowProductDetail.call(this, productProxy);
                }
                
                return originalShowProductDetail.call(this, product);
            };
        }
        
        console.log('✅ 型号显示补丁已应用');
    });
    
    /**
     * 为所有查询函数添加型号字段支持
     */
    window.addEventListener('modelTypeChanged', function(event) {
        console.log('🔄 型号类型已切换，触发页面刷新');
        
        // 获取当前页面并刷新
        if (typeof ModelDisplayAdapter !== 'undefined') {
            ModelDisplayAdapter.refreshCurrentScreen();
        }
    });
    
})();
