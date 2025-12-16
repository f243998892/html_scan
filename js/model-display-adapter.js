/**
 * 型号显示适配器
 * 适配所有显示型号的地方，使其支持型号切换
 */

(function() {
    console.log('🔧 型号显示适配器开始加载...');
    
    /**
     * 从产品对象获取当前选择的型号值
     * @param {Object} product - 产品对象
     * @returns {string} - 型号值
     */
    function getProductModel(product) {
        if (!product) return '';
        
        if (typeof ModelSwitcher !== 'undefined') {
            return ModelSwitcher.getModelFromProduct(product);
        }
        
        // 降级方案：返回产品型号
        return product['产品型号'] || '';
    }
    
    /**
     * 获取当前型号字段的标签
     * @returns {string} - 标签文本，如"产品型号"、"半成品型号"等
     */
    function getModelLabel() {
        if (typeof ModelSwitcher !== 'undefined') {
            return ModelSwitcher.getCurrentField().label;
        }
        return '产品型号';
    }
    
    /**
     * 获取当前型号字段的数据库字段名
     * @returns {string} - 数据库字段名
     */
    function getModelDbField() {
        if (typeof ModelSwitcher !== 'undefined') {
            return ModelSwitcher.getCurrentDbField();
        }
        return '产品型号';
    }
    
    /**
     * 监听型号切换事件并刷新当前页面
     */
    function setupModelChangeListener() {
        if (typeof ModelSwitcher !== 'undefined') {
            ModelSwitcher.onChange(function(newType, oldType) {
                console.log(`📊 型号切换，准备刷新页面数据...`);
                
                // 触发页面刷新事件
                const event = new CustomEvent('modelTypeChanged', {
                    detail: { newType, oldType }
                });
                window.dispatchEvent(event);
                
                // 如果在查询页面，自动刷新数据
                refreshCurrentScreen();
            });
        }
    }
    
    /**
     * 刷新当前显示的页面
     */
    function refreshCurrentScreen() {
        // 获取当前显示的screen
        const screens = document.querySelectorAll('[id$="-screen"]');
        let currentScreen = null;
        
        screens.forEach(screen => {
            if (!screen.classList.contains('d-none')) {
                currentScreen = screen.id;
            }
        });
        
        if (!currentScreen) return;
        
        console.log('🔄 刷新页面:', currentScreen);
        
        // 根据不同页面执行相应的刷新逻辑
        switch(currentScreen) {
            case 'group-products-screen':
                // 重新查询小组产品
                if (typeof queryGroupProducts === 'function') {
                    queryGroupProducts();
                }
                break;
            case 'query-screen':
                // 重新加载月度台账
                if (typeof loadUserMonthlyTransactions === 'function') {
                    loadUserMonthlyTransactions();
                }
                break;
            case 'delete-records-screen':
                // 重新加载删除记录
                if (typeof loadDeleteRecords === 'function') {
                    loadDeleteRecords();
                }
                break;
            // 可以添加更多页面的刷新逻辑
        }
    }
    
    // 暴露到全局
    window.ModelDisplayAdapter = {
        getProductModel: getProductModel,
        getModelLabel: getModelLabel,
        getModelDbField: getModelDbField,
        refreshCurrentScreen: refreshCurrentScreen
    };
    
    // 页面加载完成后设置监听器
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupModelChangeListener);
    } else {
        setupModelChangeListener();
    }
    
    console.log('✅ 型号显示适配器已加载');
    
})();
