/**
 * 型号切换管理模块
 * 管理三个型号字段的全局切换：产品型号、半成品型号、成品型号
 */

(function() {
    console.log('🔄 型号切换模块开始加载...');
    
    // 型号字段配置
    const MODEL_FIELDS = {
        auto: { key: 'auto', label: '自动', dbField: 'auto' },
        product: { key: 'product', label: '产品型号', dbField: '产品型号' },
        semi: { key: 'semi', label: '半成品型号', dbField: '半成品型号' },
        finished: { key: 'finished', label: '成品型号', dbField: '成品型号' }
    };
    
    // 默认为自动模式
    const DEFAULT_MODEL_TYPE = 'auto';
    const STORAGE_KEY = 'selected_model_type';
    
    // 全局状态
    let currentModelType = DEFAULT_MODEL_TYPE;
    let changeCallbacks = [];
    
    /**
     * 初始化 - 从localStorage读取用户上次选择
     */
    function init() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && MODEL_FIELDS[saved]) {
            currentModelType = saved;
        }
        console.log(`✅ 型号切换模块已加载，当前显示: ${MODEL_FIELDS[currentModelType].label}`);
        
        // 初始化后立即更新UI
        updateSwitcherUI();
    }
    
    /**
     * 获取当前选择的型号类型
     */
    function getCurrentModelType() {
        return currentModelType;
    }
    
    /**
     * 获取当前型号字段配置
     */
    function getCurrentModelField() {
        return MODEL_FIELDS[currentModelType];
    }
    
    /**
     * 获取数据库字段名
     * 注意：自动模式下返回null，应使用getModelFromProduct()
     */
    function getCurrentDbField() {
        if (currentModelType === 'auto') {
            return null; // 自动模式不对应单一数据库字段
        }
        return MODEL_FIELDS[currentModelType].dbField;
    }
    
    /**
     * 切换型号类型
     */
    function switchModelType(newType) {
        if (!MODEL_FIELDS[newType]) {
            console.error('无效的型号类型:', newType);
            return false;
        }
        
        if (currentModelType === newType) {
            return false; // 没有变化
        }
        
        const oldType = currentModelType;
        currentModelType = newType;
        
        // 保存到localStorage
        localStorage.setItem(STORAGE_KEY, newType);
        
        console.log(`🔄 型号切换: ${MODEL_FIELDS[oldType].label} → ${MODEL_FIELDS[newType].label}`);
        
        // 触发所有回调
        changeCallbacks.forEach(callback => {
            try {
                callback(newType, oldType);
            } catch (error) {
                console.error('型号切换回调错误:', error);
            }
        });
        
        return true;
    }
    
    /**
     * 注册型号切换监听器
     */
    function onModelChange(callback) {
        if (typeof callback === 'function') {
            changeCallbacks.push(callback);
        }
    }
    
    /**
     * 从产品对象中提取当前选择的型号
     * 自动模式：优先显示成品型号 → 半成品型号 → 产品型号
     */
    function getModelFromProduct(product) {
        if (!product) return null;
        
        // 如果是自动模式，按优先级返回
        if (currentModelType === 'auto') {
            if (product['成品型号'] && product['成品型号'].trim()) {
                return product['成品型号'];
            }
            if (product['半成品型号'] && product['半成品型号'].trim()) {
                return product['半成品型号'];
            }
            return product['产品型号'] || null;
        }
        
        // 非自动模式，返回当前选择的字段
        return product[getCurrentDbField()] || product['产品型号'] || null;
    }
    
    /**
     * 获取所有型号字段配置
     */
    function getAllModelFields() {
        return MODEL_FIELDS;
    }
    
    /**
     * 创建型号切换下拉菜单HTML
     */
    function createSwitcherHtml() {
        return `
            <div class="dropdown d-inline-block">
                <button class="btn btn-sm btn-outline-primary dropdown-toggle" type="button" id="modelSwitcher" data-bs-toggle="dropdown" aria-expanded="false">
                    <i class="bi bi-tag"></i> <span id="currentModelLabel">${MODEL_FIELDS[currentModelType].label}</span>
                </button>
                <ul class="dropdown-menu" aria-labelledby="modelSwitcher">
                    <li><a class="dropdown-item ${currentModelType === 'auto' ? 'active' : ''}" href="#" onclick="window.ModelSwitcher.switch('auto'); return false;">
                        <i class="bi bi-magic"></i> 自动
                    </a></li>
                    <li><hr class="dropdown-divider"></li>
                    <li><a class="dropdown-item ${currentModelType === 'product' ? 'active' : ''}" href="#" onclick="window.ModelSwitcher.switch('product'); return false;">
                        <i class="bi bi-tag-fill"></i> 产品型号
                    </a></li>
                    <li><a class="dropdown-item ${currentModelType === 'semi' ? 'active' : ''}" href="#" onclick="window.ModelSwitcher.switch('semi'); return false;">
                        <i class="bi bi-tags-fill"></i> 半成品型号
                    </a></li>
                    <li><a class="dropdown-item ${currentModelType === 'finished' ? 'active' : ''}" href="#" onclick="window.ModelSwitcher.switch('finished'); return false;">
                        <i class="bi bi-award-fill"></i> 成品型号
                    </a></li>
                </ul>
            </div>
        `;
    }
    
    /**
     * 更新下拉菜单显示
     */
    function updateSwitcherUI() {
        const labelElement = document.getElementById('currentModelLabel');
        if (labelElement) {
            labelElement.textContent = MODEL_FIELDS[currentModelType].label;
        }
        
        // 更新筛选框标签
        const filterLabelElement = document.getElementById('model-filter-label');
        console.log('🔍 查找筛选框标签元素:', filterLabelElement);
        if (filterLabelElement) {
            const newText = MODEL_FIELDS[currentModelType].label + '筛选（可多选）';
            console.log('🏷️ 更新筛选框标签:', newText);
            filterLabelElement.textContent = newText;
        } else {
            console.warn('❌ 未找到筛选框标签元素 model-filter-label');
        }
        
        // 更新Select2占位符
        if (typeof jQuery !== 'undefined' && typeof jQuery.fn.select2 !== 'undefined') {
            try {
                const $modelFilter = jQuery('#model-filter');
                if ($modelFilter.data('select2')) {
                    $modelFilter.select2('destroy');
                }
                $modelFilter.select2({
                    theme: 'bootstrap-5',
                    placeholder: '全部' + MODEL_FIELDS[currentModelType].label + '（可多选）',
                    allowClear: true,
                    width: '100%',
                    language: {
                        noResults: function() {
                            return '未找到匹配的型号';
                        },
                        searching: function() {
                            return '搜索中...';
                        }
                    }
                });
            } catch (e) {
                console.log('Select2更新失败:', e);
            }
        }
        
        // 更新active状态
        const dropdown = document.getElementById('modelSwitcher');
        if (dropdown) {
            const items = dropdown.parentElement.querySelectorAll('.dropdown-item');
            items.forEach(item => {
                item.classList.remove('active');
                const href = item.getAttribute('onclick');
                if (href && href.includes(`'${currentModelType}'`)) {
                    item.classList.add('active');
                }
            });
        }
    }
    
    /**
     * 切换并更新UI
     */
    function switchAndUpdateUI(newType) {
        if (switchModelType(newType)) {
            updateSwitcherUI();
        }
    }
    
    // 暴露到全局
    window.ModelSwitcher = {
        init: init,
        getCurrentType: getCurrentModelType,
        getCurrentField: getCurrentModelField,
        getCurrentDbField: getCurrentDbField,
        switch: switchAndUpdateUI,
        onChange: onModelChange,
        getModelFromProduct: getModelFromProduct,
        getAllFields: getAllModelFields,
        createHtml: createSwitcherHtml,
        MODEL_FIELDS: MODEL_FIELDS
    };
    
    // 等待DOM加载完成后再初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
})();

console.log('✅ 型号切换模块已加载');
