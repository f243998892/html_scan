// 全局变量
// 使用相对路径，不再硬编码外部域名
const HTTP_API_URL = window.location.hostname === 'localhost' ? 'http://localhost:8001' : '';
const API_BASE_URL = '/api'; // 添加API基础URL

// 存储当前用户信息
const userState = {
    fullName: ''
};

// 存储当前扫码状态
const scanState = {
    processType: '',
    isContinuous: false,
    pendingCodes: [],
    lastScannedCode: '',
    isProcessing: false,
    currentHtml5QrScanner: null,
    lastScanTime: null
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
    PRODUCTS: 'products-screen',
    DELETE_RECORDS: 'delete-records-screen',
    MANUAL_SCAN: 'manual-scan-screen', // 新增扫码枪/手动录入界面
    LEADER_SUMMARY: 'leader-summary-screen', // 组长汇总查询界面
    GROUP_PRODUCTS: 'group-products-screen', // 小组产品数量查询
    EMPLOYEE_PRODUCTS: 'employee-products-screen', // 员工产品数量查询
    ASSIGN_GROUP: 'assign-group-screen', // 为新产品分配小组
    ASSIGN_SECURE: 'assign-secure-screen',
    PUSH_SETTINGS: 'push-settings-screen' // 推送通知设置界面
};

// 暴露给全局使用
window.SCREENS = SCREENS;

// 统一的 DOM 安全工具
function $(id) { return document.getElementById(id); }
function onId(id, evt, handler) {
    const el = $(id);
    if (el && typeof el.addEventListener === 'function') {
        el.addEventListener(evt, handler);
    } else {
        console.warn('[bind-miss]', id);
    }
}
function ensureContainer(containerId) {
    let el = $(containerId);
    if (!el) {
        el = document.createElement('div');
        el.id = containerId;
        document.body.appendChild(el);
        console.warn('[auto-create]', containerId);
    }
    return el;
}

// 全局缓存对象
const dataCache = {
    monthlyTransactions: {
        data: null,
        timestamp: null,
        params: null,
        expiresInMinutes: 5  // 缓存过期时间（分钟）
    }
};

// 检查缓存是否有效
function isCacheValid(cacheKey) {
    if (!dataCache[cacheKey] || !dataCache[cacheKey].data || !dataCache[cacheKey].timestamp) {
        return false;
    }
    
    const now = new Date();
    const cacheTime = new Date(dataCache[cacheKey].timestamp);
    const diffInMs = now - cacheTime;
    const diffInMinutes = diffInMs / (1000 * 60);
    
    return diffInMinutes < dataCache[cacheKey].expiresInMinutes;
}

// 应用初始状态
const appState = {
    scanner: null,
    isScanning: false,
    lastScannedCode: null,
    lastScannedTime: null,
    scannerInputReady: false,
    isContinuousScanMode: false,
    pendingCodes: [],
    // 月份范围缓存
    monthRangeCache: {
        data: null,
        timestamp: null,
        maxAge: 5 * 60 * 1000  // 5分钟缓存
    }
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
    try {
        console.log('初始化应用...');
        
        // 触发应用初始化开始事件
        window.dispatchEvent(new CustomEvent('app:init:start'));
        
        // 首先添加事件监听
        addEventListeners();
        
        // 触发UI准备事件
        window.dispatchEvent(new CustomEvent('app:init:ui'));
        
        // 尝试自动登录，如果失败会显示登录页面
        await tryAutoLogin();
        
        // 触发初始化完成事件
        window.dispatchEvent(new CustomEvent('app:init:complete'));
        
    } catch (error) {
        console.error('应用初始化失败:', error);
        // 确保显示登录页面
        showScreen(SCREENS.LOGIN);
        // 即使失败也触发完成事件，隐藏加载指示器
        window.dispatchEvent(new CustomEvent('app:init:complete'));
    }
}

// 尝试自动登录
async function tryAutoLogin() {
    try {
        const savedFullName = localStorage.getItem('user_full_name');
        console.log('尝试自动登录，保存的用户名:', savedFullName);
        
        if (savedFullName) {
            userState.fullName = savedFullName;
            
            // 加载保存的工序设置
            loadSavedProcessSelection();
            
            // 导航到主页
            navigateToHome();
            console.log('自动登录成功:', savedFullName);
        } else {
            // 没有登录信息，显示登录页面
            showScreen(SCREENS.LOGIN);
            console.log('未找到登录信息，显示登录页面');
        }
    } catch (error) {
        console.error('自动登录失败:', error);
        // 显示登录页面
        showScreen(SCREENS.LOGIN);
    }
}

// 添加事件监听
function addEventListeners() {
    // 登录事件（安全绑定）
    onId('login-btn', 'click', handleLogin);
    
    // 首页功能卡片点击事件（安全绑定）
    onId('card-single-scan', 'click', handleSingleScan);
    onId('card-continuous-scan', 'click', handleContinuousScan);
    onId('card-product-query', 'click', handleProductQuery);
    onId('card-product-scan-query', 'click', handleProductScanQuery);
    onId('card-stamping-scan', 'click', handleStampingScan);
    onId('card-inventory', 'click', () => showFeatureNotAvailable('该功能暂未开放，敬请期待'));
    onId('card-delete-records', 'click', handleDeleteRecords);
    
    // 组长功能相关事件
    onId('leader-card', 'click', handleLeaderFunctions);
    onId('leader-back-btn', 'click', () => showScreen(SCREENS.HOME));
    
    // 小组产品数量查询
    onId('group-products-btn', 'click', handleGroupProducts);
    onId('group-products-back-btn', 'click', () => showScreen(SCREENS.LEADER_SUMMARY));
    onId('query-group-products-btn', 'click', queryGroupProducts);
    onId('export-excel-btn', 'click', handleExportExcel);
    
    // 员工产品数量查询
    onId('employee-products-btn', 'click', handleEmployeeProducts);
    onId('employee-products-back-btn', 'click', () => showScreen(SCREENS.LEADER_SUMMARY));
    onId('query-employee-products-btn', 'click', queryEmployeeProducts);
    
    // 为新产品分配小组
    onId('assign-group-btn', 'click', handleAssignGroup);
    onId('assign-group-back-btn', 'click', () => showScreen(SCREENS.LEADER_SUMMARY));
    onId('process-type-select', 'change', loadProductModelsAndGroups);
    onId('assign-group-submit-btn', 'click', submitGroupAssignment);
    onId('view-assigned-btn', 'click', handleViewAssigned);
    
    // 小组选择改变时，如果已显示已分配列表，则自动刷新
    onId('assign-group-select', 'change', () => {
        const container = document.getElementById('assigned-list-container');
        if (container && !container.classList.contains('d-none')) {
            handleViewAssigned();
        }
    });
    
    // 工序选择下拉框变化时保存选择并立即更新浮动框
    const processSelect = document.getElementById('process-select');
    if (processSelect && typeof processSelect.addEventListener === 'function') {
        processSelect.addEventListener('change', function() {
            saveProcessSelection(this.value);
        });
    }
    
    // 监听所有Bootstrap Modal的关闭事件，确保恢复页面滚动
    document.addEventListener('hidden.bs.modal', function (event) {
        console.log('Modal关闭事件触发');
        // 强制清理所有modal相关的类和样式
        setTimeout(() => {
            document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
            document.body.classList.remove('modal-open');
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
            document.documentElement.style.overflow = '';
        }, 100);
    });
    
    // 组长功能实现
// 处理组长功能入口
function handleLeaderFunctions() {
    showScreen(SCREENS.LEADER_SUMMARY);
}

// 处理小组产品数量查询
async function handleGroupProducts() {
    // 加载小组数据
    await loadGroups();
    // 设置默认日期为当天
    setDefaultDateToToday('start-date', 'end-date');
    // 设置默认时间为全天
    setDefaultTimeRange('start-time', 'end-time');
    // 加载员工列表
    await loadEmployeeList();
    // 初始化型号筛选框（使用Select2）
    initModelFilter();
    showScreen(SCREENS.GROUP_PRODUCTS);
    // 在显示界面后立即刷新型号列表（此时日期已设置好）
    setTimeout(() => {
        if (document.getElementById('group-select').value) {
            console.log('页面打开完成，自动刷新型号列表');
            loadModelList();
        }
    }, 100);
}

// 处理导出Excel
async function handleExportExcel() {
    const groupSelect = document.getElementById('group-select');
    const groupName = groupSelect.value;
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    const startTime = document.getElementById('start-time').value || '00:00:00';
    const endTime = document.getElementById('end-time').value || '23:59:59';
    const employeeFilter = document.getElementById('employee-filter').value;
    
    // 获取选中的型号
    let modelFilter = [];
    const modelFilterElement = document.getElementById('model-filter');
    if (typeof jQuery !== 'undefined' && typeof jQuery.fn.select2 !== 'undefined') {
        try {
            modelFilter = jQuery('#model-filter').val() || [];
        } catch (e) {
            modelFilter = Array.from(modelFilterElement.selectedOptions).map(opt => opt.value);
        }
    } else {
        modelFilter = Array.from(modelFilterElement.selectedOptions).map(opt => opt.value);
    }
    
    // 过滤掉空值（"全部型号"选项的value是空字符串）
    modelFilter = modelFilter.filter(v => v && v.trim() !== '');
    
    if (!groupName) {
        showToast('请先选择小组', 'warning');
        return;
    }
    
    if (!startDate || !endDate) {
        showToast('请选择日期范围', 'warning');
        return;
    }
    
    try {
        showToast('正在生成Excel文件...', 'info');
        
        // 获取选中的工序
        const selectedOption = groupSelect.options[groupSelect.selectedIndex];
        const processName = selectedOption.getAttribute('data-process-name');
        
        // 组合日期和时间（不添加Z，使用本地时间避免时区问题）
        const startDateTime = `${startDate}T${startTime}`;
        const endDateTime = `${endDate}T${endTime}`;
        
        // 调用组长汇总API获取数据
        const requestBody = {
            group_name: groupName,
            process: processName,
            requester_name: userState.fullName,
            start_date: startDateTime,
            end_date: endDateTime,
            employee_name: employeeFilter || null
        };
        
        const response = await fetch(`${API_BASE_URL}/group-management/leader-summary`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            throw new Error('获取数据失败');
        }
        
        const data = await response.json();
        
        console.log('API返回的完整数据:', data);
        console.log('API返回的items[0]:', data.items ? data.items[0] : 'no items');
        
        // 生成Excel
        await generateExcelReport(data, {
            groupName,
            processName,
            startDate,
            endDate,
            startTime,
            endTime,
            employeeFilter,
            modelFilter
        });
        
        showToast('Excel文件已生成并下载', 'success');
        
    } catch (error) {
        console.error('导出失败:', error);
        showToast('导出失败: ' + error.message, 'error');
    }
}

// 生成Excel报告
async function generateExcelReport(data, filters) {
    if (!data || !data.items || data.items.length === 0) {
        showToast('没有数据可以导出', 'warning');
        return;
    }
    
    // 检查XLSX库是否加载
    if (typeof XLSX === 'undefined') {
        showToast('Excel库未加载，请刷新页面重试', 'error');
        return;
    }
    
    // 过滤数据 - 注意：不要丢失employee_details字段
    let filteredItems = data.items;
    const isEmployeeFiltered = filters.employeeFilter && filters.employeeFilter.trim() !== '';
    const isModelFiltered = filters.modelFilter && Array.isArray(filters.modelFilter) && filters.modelFilter.length > 0;
    
    console.log('原始数据样例:', data.items[0]);
    
    // 应用型号筛选
    if (isModelFiltered) {
        filteredItems = filteredItems.filter(item => 
            filters.modelFilter.includes(item.product_model)
        );
    }
    
    // 只保留有完成数的项
    filteredItems = filteredItems.filter(item => {
        const count = isEmployeeFiltered ? item.employee_completed : item.total_completed;
        return count > 0;
    });
    
    console.log('过滤后数据样例:', filteredItems[0]);
    
    if (filteredItems.length === 0) {
        showToast('筛选后没有数据可以导出', 'warning');
        return;
    }
    
    // 创建工作簿
    const wb = XLSX.utils.book_new();
    
    // 1. 生成概览页
    const summarySheet = generateSummarySheet(filteredItems, filters, isEmployeeFiltered);
    XLSX.utils.book_append_sheet(wb, summarySheet, '概览');
    
    // 2. 生成按型号汇总页
    const modelSheet = generateModelSummarySheet(filteredItems, filters, isEmployeeFiltered);
    XLSX.utils.book_append_sheet(wb, modelSheet, '按型号汇总');
    
    // 3. 生成详细流水账（获取详细记录）
    const detailsSheet = await generateDetailsSheet(filters);
    XLSX.utils.book_append_sheet(wb, detailsSheet, '详细流水账');
    
    // 生成文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `${filters.groupName}_${filters.processName}_${filters.startDate}_${timestamp}.xlsx`;
    
    // 下载文件
    XLSX.writeFile(wb, fileName);
}

// 生成概览页
function generateSummarySheet(items, filters, isEmployeeFiltered) {
    const data = [];
    
    // 标题
    data.push(['生产汇总报告']);
    data.push([]);
    
    // 基本信息
    data.push(['报告信息']);
    data.push(['生成时间', new Date().toLocaleString('zh-CN')]);
    data.push(['小组名称', filters.groupName]);
    data.push(['工序', filters.processName]);
    data.push(['时间范围', `${filters.startDate} ${filters.startTime} ~ ${filters.endDate} ${filters.endTime}`]);
    data.push(['员工筛选', filters.employeeFilter || '全体员工']);
    data.push(['型号筛选', filters.modelFilter && filters.modelFilter.length > 0 ? filters.modelFilter.join(', ') : '全部型号']);
    data.push([]);
    
    // 汇总统计
    data.push(['汇总统计']);
    const totalProducts = items.reduce((sum, item) => {
        const count = isEmployeeFiltered ? item.employee_completed : item.total_completed;
        return sum + count;
    }, 0);
    const totalModels = items.length;
    const totalEmployees = new Set();
    items.forEach(item => {
        // 注意：后端字段名是 employees 不是 employee_details
        const empList = item.employees || item.employee_details;
        if (empList) {
            empList.forEach(emp => totalEmployees.add(emp.employee_name));
        }
    });
    
    data.push(['完成总数', totalProducts]);
    data.push(['涉及型号数', totalModels]);
    data.push(['参与员工数', totalEmployees.size]);
    data.push([]);
    
    // 型号排行榜（前10）
    data.push(['产量TOP10型号']);
    data.push(['排名', '型号', '完成数量', '占比']);
    const sortedItems = [...items].sort((a, b) => {
        const countA = isEmployeeFiltered ? a.employee_completed : a.total_completed;
        const countB = isEmployeeFiltered ? b.employee_completed : b.total_completed;
        return countB - countA;
    });
    
    sortedItems.slice(0, 10).forEach((item, index) => {
        const count = isEmployeeFiltered ? item.employee_completed : item.total_completed;
        const percentage = ((count / totalProducts) * 100).toFixed(2) + '%';
        data.push([index + 1, item.product_model, count, percentage]);
    });
    
    data.push([]);
    
    // 员工排行榜（前10）
    if (!isEmployeeFiltered) {
        data.push(['产量TOP10员工']);
        data.push(['排名', '员工姓名', '完成数量', '涉及型号数']);
        
        const employeeStats = new Map();
        items.forEach(item => {
            // 注意：后端字段名是 employees 不是 employee_details
            const empList = item.employees || item.employee_details;
            if (empList) {
                empList.forEach(emp => {
                    if (!employeeStats.has(emp.employee_name)) {
                        employeeStats.set(emp.employee_name, { count: 0, models: new Set() });
                    }
                    const stats = employeeStats.get(emp.employee_name);
                    stats.count += emp.count;
                    stats.models.add(item.product_model);
                });
            }
        });
        
        const employeeArray = Array.from(employeeStats.entries())
            .map(([name, stats]) => ({ name, count: stats.count, models: stats.models.size }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        
        employeeArray.forEach((emp, index) => {
            data.push([index + 1, emp.name, emp.count, emp.models]);
        });
    }
    
    return XLSX.utils.aoa_to_sheet(data);
}

// 生成按型号汇总页
function generateModelSummarySheet(items, filters, isEmployeeFiltered) {
    const data = [];
    
    // 标题行
    data.push(['型号', '完成数量', '参与员工数', '平均每人完成数']);
    
    // 数据行
    items.forEach(item => {
        const count = isEmployeeFiltered ? item.employee_completed : item.total_completed;
        // 注意：后端字段名是 employees 不是 employee_details
        const empList = item.employees || item.employee_details;
        const employeeCount = empList ? empList.length : 0;
        const avgPerEmployee = employeeCount > 0 ? (count / employeeCount).toFixed(2) : 0;
        
        data.push([
            item.product_model,
            count,
            employeeCount,
            avgPerEmployee
        ]);
    });
    
    return XLSX.utils.aoa_to_sheet(data);
}

// 生成按员工汇总页
function generateEmployeeSummarySheet(items, filters) {
    const data = [];
    
    // 标题行
    data.push(['员工姓名', '完成数量', '涉及型号数', '型号列表']);
    
    console.log('生成按员工汇总页，items数量:', items.length);
    
    // 收集员工统计
    const employeeStats = new Map();
    items.forEach(item => {
        // 注意：后端字段名是 employees 不是 employee_details
        const empList = item.employees || item.employee_details;
        console.log('处理型号:', item.product_model, 'employees:', empList);
        
        if (empList && Array.isArray(empList)) {
            empList.forEach(emp => {
                // 确保员工名称存在且不为空
                const empName = emp.employee_name || emp.name;
                if (empName && empName.trim()) {
                    if (!employeeStats.has(empName)) {
                        employeeStats.set(empName, { count: 0, models: new Set() });
                    }
                    const stats = employeeStats.get(empName);
                    stats.count += (emp.count || 0);
                    stats.models.add(item.product_model);
                }
            });
        }
    });
    
    console.log('员工统计结果:', employeeStats);
    
    // 如果没有员工数据，添加提示行
    if (employeeStats.size === 0) {
        data.push(['(暂无员工数据)', '-', '-', '-']);
        console.warn('警告：没有找到员工数据');
    } else {
        // 排序并输出
        const employeeArray = Array.from(employeeStats.entries())
            .map(([name, stats]) => ({
                name,
                count: stats.count,
                modelCount: stats.models.size,
                models: Array.from(stats.models).join(', ')
            }))
            .sort((a, b) => b.count - a.count);
        
        employeeArray.forEach(emp => {
            data.push([emp.name, emp.count, emp.modelCount, emp.models]);
        });
        
        console.log('按员工汇总数据行数:', employeeArray.length);
    }
    
    return XLSX.utils.aoa_to_sheet(data);
}

// 生成详细流水账页 - 动态导出所有字段
async function generateDetailsSheet(filters) {
    // 调用API获取详细记录
    const response = await fetch(`${API_BASE_URL}/getProductsByGroup`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            group_name: filters.groupName,
            process_name: filters.processName,
            start_date: `${filters.startDate}T${filters.startTime}`,
            end_date: `${filters.endDate}T${filters.endTime}`
        })
    });
    
    if (!response.ok) {
        throw new Error('获取详细记录失败');
    }
    
    const records = await response.json();
    
    if (!records || records.length === 0) {
        return XLSX.utils.aoa_to_sheet([['暂无数据']]);
    }
    
    // 动态获取所有字段名（从第一条记录）
    const allFields = Object.keys(records[0]);
    
    const data = [];
    
    // 标题行 - 动态生成，包含所有字段
    const headers = ['序号', ...allFields];
    data.push(headers);
    
    // 数据行
    let filteredRecords = records;
    
    // 应用员工筛选
    if (filters.employeeFilter) {
        const employeeField = getEmployeeFieldName(filters.processName);
        filteredRecords = filteredRecords.filter(r => r[employeeField] === filters.employeeFilter);
    }
    
    // 应用型号筛选 - 根据ModelSwitcher当前类型选择正确的型号字段
    if (filters.modelFilter && filters.modelFilter.length > 0) {
        filteredRecords = filteredRecords.filter(record => {
            // 使用与显示逻辑一致的型号选择
            let displayModel = record['产品型号'];
            if (typeof ModelSwitcher !== 'undefined') {
                const currentType = ModelSwitcher.getCurrentType();
                if (currentType === 'auto') {
                    // 自动模式：优先显示成品型号 → 半成品型号 → 产品型号
                    if (record['成品型号'] && record['成品型号'].trim()) {
                        displayModel = record['成品型号'];
                    } else if (record['半成品型号'] && record['半成品型号'].trim()) {
                        displayModel = record['半成品型号'];
                    } else {
                        displayModel = record['产品型号'];
                    }
                } else if (currentType === 'semi') {
                    // 半成品模式
                    displayModel = record['半成品型号'] || record['产品型号'];
                } else if (currentType === 'finished') {
                    // 成品模式
                    displayModel = record['成品型号'] || record['产品型号'];
                }
            }
            return filters.modelFilter.includes(displayModel);
        });
    }
    
    filteredRecords.forEach((record, index) => {
        // 格式化时间的辅助函数
        const formatTime = (timeStr) => {
            if (!timeStr) return '';
            try {
                return new Date(timeStr).toLocaleString('zh-CN');
            } catch (e) {
                return timeStr;
            }
        };
        
        // 动态构建数据行
        const row = [index + 1]; // 序号
        allFields.forEach(field => {
            const value = record[field];
            // 如果字段名包含"时间"，格式化时间
            if (field.includes('时间') && value) {
                row.push(formatTime(value));
            } else {
                row.push(value || '');
            }
        });
        
        data.push(row);
    });
    
    return XLSX.utils.aoa_to_sheet(data);
}


// 辅助函数：根据工序获取员工字段名
function getEmployeeFieldName(processName) {
    const fieldMap = {
        '绕线': '绕线员工',
        '嵌线': '嵌线员工',
        '接线': '接线员工',
        '压装': '压装员工',
        '车止口': '车止口员工',
        '浸漆': '浸漆员工'
    };
    return fieldMap[processName] || '员工';
}

// 辅助函数：根据工序获取时间字段名
function getTimeFieldName(processName) {
    const fieldMap = {
        '绕线': '绕线时间',
        '嵌线': '嵌线时间',
        '接线': '接线时间',
        '压装': '压装时间',
        '车止口': '车止口时间',
        '浸漆': '浸漆时间'
    };
    return fieldMap[processName] || '时间';
}

// 加载小组数据
async function loadGroups() {
    try {
        // 从API获取所有组别
        const response = await fetch(`${API_BASE_URL}/groups?active_only=true`);
        if (!response.ok) {
            throw new Error('获取组别数据失败');
        }
        
        const data = await response.json();
        const groups = data.groups || [];
        
        const groupSelect = document.getElementById('group-select');
        if (!groupSelect) {
            console.error('找不到group-select元素');
            return;
        }
        
        groupSelect.innerHTML = '';
        
        // 添加"未分配小组"选项（所有用户都可以查看未分配的产品）
        const unassignedOption = document.createElement('option');
        unassignedOption.value = '__UNASSIGNED__';
        unassignedOption.setAttribute('data-group-name', '__UNASSIGNED__');
        unassignedOption.setAttribute('data-process-name', 'all');
        unassignedOption.textContent = '未分配小组 - 查看未分配给任何小组的产品';
        groupSelect.appendChild(unassignedOption);
        
        // 只显示当前登录用户作为组长的小组
        const userGroups = await getLeaderGroups();
        
        let firstGroup = null;
        groups.forEach((group, index) => {
            // 检查当前用户是否是该组的组长
            const isLeader = userGroups.some(ug => ug.group_name === group.group_name);
            if (isLeader) {
            const option = document.createElement('option');
                option.value = group.group_name;  // 使用group_name作为value
                option.setAttribute('data-group-name', group.group_name);
                option.setAttribute('data-process-name', group.process_name);
                option.textContent = `${group.group_name} - ${getProcessDisplayName(group.process_name)}`;
            groupSelect.appendChild(option);
                
                // 记录第一个小组
                if (!firstGroup) {
                    firstGroup = group;
                }
            }
        });
        
        // 默认选中第一个小组
        if (firstGroup) {
            groupSelect.value = firstGroup.group_name;
        }
    } catch (error) {
        console.error('加载小组数据失败:', error);
        showToast('获取小组数据失败: ' + error.message, 'error');
    }
}

// 获取当前用户作为组长的所有小组
async function getLeaderGroups() {
    try {
        const response = await fetch(`${API_BASE_URL}/group-leaders?leader_name=${encodeURIComponent(userState.fullName)}`);
        if (!response.ok) {
            // 如果接口不存在,返回空数组
            if (response.status === 404) {
                return [];
            }
            throw new Error('获取组长信息失败');
        }
        
        const data = await response.json();
        return data.groups || [];
    } catch (error) {
        console.error('获取组长信息失败:', error);
        // 返回空数组以防止页面崩溃
        return [];
    }
}

// 设置默认日期范围（当月）
function setDefaultDateRange(startId, endId) {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    document.getElementById(startId).valueAsDate = startDate;
    document.getElementById(endId).valueAsDate = endDate;
}

// 设置默认日期为当天
function setDefaultDateToToday(startId, endId) {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    document.getElementById(startId).value = today;
    document.getElementById(endId).value = today;
}

// 设置默认时间范围（全天）
function setDefaultTimeRange(startTimeId, endTimeId) {
    document.getElementById(startTimeId).value = '00:00:00';
    document.getElementById(endTimeId).value = '23:59:59';
}

// 加载员工列表
async function loadEmployeeList() {
    try {
        const groupSelect = document.getElementById('group-select');
        const employeeFilter = document.getElementById('employee-filter');
        
        if (!groupSelect || !employeeFilter) {
            return;
        }
        
        const groupName = groupSelect.value;
        if (!groupName) {
            employeeFilter.innerHTML = '<option value="">全体员工</option>';
            return;
        }
        
        // 获取选中小组的工序
        const selectedOption = groupSelect.options[groupSelect.selectedIndex];
        const processName = selectedOption.getAttribute('data-process-name');
        
        if (!processName) {
            employeeFilter.innerHTML = '<option value="">全体员工</option>';
            return;
        }
        
        // 获取一个较大的时间范围来获取所有员工（最近30天）
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        
        const startDateTime = startDate.toISOString().split('T')[0] + 'T00:00:00Z';
        const endDateTime = endDate.toISOString().split('T')[0] + 'T23:59:59Z';
        
        // 调用API获取该小组该工序的员工列表
        const response = await fetch(`${API_BASE_URL}/group-management/leader-summary`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                group_name: groupName,
                process: processName,
                start_date: startDateTime,
                end_date: endDateTime,
                requester_name: userState.fullName,
                employee_name: null
            })
        });
        
        if (!response.ok) {
            throw new Error('获取员工列表失败');
        }
        
        const data = await response.json();
        const employees = new Set();
        
        // 从返回的数据中提取员工名字
        if (data.items) {
            data.items.forEach(item => {
                if (item.employees && Array.isArray(item.employees)) {
                    item.employees.forEach(emp => {
                        if (emp.employee_name && emp.employee_name.trim()) {
                            employees.add(emp.employee_name.trim());
                        }
                    });
                }
            });
        }
        
        // 填充员工下拉框
        employeeFilter.innerHTML = '<option value="">全体员工</option>';
        const empArray = Array.from(employees).sort();
        
        if (empArray.length === 0) {
            // 如果没有找到员工，显示提示
            const option = document.createElement('option');
            option.value = '';
            option.textContent = '(暂无员工记录)';
            option.disabled = true;
            employeeFilter.appendChild(option);
        } else {
            empArray.forEach(empName => {
                const option = document.createElement('option');
                option.value = empName;
                option.textContent = empName;
                employeeFilter.appendChild(option);
            });
        }
    } catch (error) {
        console.error('加载员工列表失败:', error);
        const employeeFilter = document.getElementById('employee-filter');
        if (employeeFilter) {
            employeeFilter.innerHTML = '<option value="">全体员工</option>';
        }
    }
}

// 用于标记是否已初始化监听器
let modelFilterListenersInitialized = false;

// 初始化型号筛选器（使用Select2或原生多选框）
function initModelFilter() {
    // 尝试使用Select2（如果可用）
    if (typeof jQuery !== 'undefined' && typeof jQuery.fn.select2 !== 'undefined') {
        try {
            // 先销毁已存在的Select2实例
            if (jQuery('#model-filter').data('select2')) {
                jQuery('#model-filter').select2('destroy');
            }
        // 获取当前型号类型的标签
        let modelLabel = '型号';
        if (typeof ModelSwitcher !== 'undefined') {
            modelLabel = ModelSwitcher.MODEL_FIELDS[ModelSwitcher.getCurrentType()].label;
        }
        
        jQuery('#model-filter').select2({
            theme: 'bootstrap-5',
            placeholder: '全部' + modelLabel + '（可多选）',
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
            console.log('Select2初始化成功');
        } catch (error) {
            console.warn('Select2初始化失败，使用原生多选框:', error);
        }
    } else {
        console.warn('jQuery或Select2未加载，使用原生多选框');
    }
    
    // 只在第一次初始化时添加监听器，避免重复添加
    if (!modelFilterListenersInitialized) {
        console.log('初始化型号筛选自动刷新监听器');
        
        // 监听所有影响型号列表的筛选条件变化
        const groupSelect = document.getElementById('group-select');
        const startDateInput = document.getElementById('start-date');
        const endDateInput = document.getElementById('end-date');
        const startTimeInput = document.getElementById('start-time');
        const endTimeInput = document.getElementById('end-time');
        const employeeFilterSelect = document.getElementById('employee-filter');
        
        // 监听小组变化
        if (groupSelect) {
            groupSelect.addEventListener('change', function() {
                console.log('小组变化，自动刷新型号列表和员工列表');
            loadEmployeeList();
                loadModelList();
        });
        }
        
        // 监听日期时间变化 - 延迟刷新避免频繁请求
        let dateTimeChangeTimer;
        const handleDateTimeChange = function() {
            clearTimeout(dateTimeChangeTimer);
            dateTimeChangeTimer = setTimeout(() => {
                if (groupSelect && groupSelect.value) {
                    console.log('时间区间变化，自动刷新型号列表');
        loadModelList();
                }
            }, 800); // 800ms延迟，避免用户还在调整时就刷新
        };
        
        if (startDateInput) startDateInput.addEventListener('change', handleDateTimeChange);
        if (endDateInput) endDateInput.addEventListener('change', handleDateTimeChange);
        if (startTimeInput) startTimeInput.addEventListener('change', handleDateTimeChange);
        if (endTimeInput) endTimeInput.addEventListener('change', handleDateTimeChange);
        
        // 监听员工筛选变化
        if (employeeFilterSelect) {
            employeeFilterSelect.addEventListener('change', function() {
                if (groupSelect && groupSelect.value) {
                    console.log('员工筛选变化，自动刷新型号列表');
                    loadModelList();
                }
            });
        }
        
        modelFilterListenersInitialized = true;
    }
}

// 加载型号列表（根据当前筛选条件动态加载）
async function loadModelList() {
    const groupSelect = document.getElementById('group-select');
    const modelFilter = document.getElementById('model-filter');
    const groupName = groupSelect.value;
    
    if (!groupName) {
        // 没有选择小组，清空型号列表
        modelFilter.innerHTML = '';
        if (typeof jQuery !== 'undefined' && typeof jQuery.fn.select2 !== 'undefined') {
            try {
                jQuery('#model-filter').trigger('change');
            } catch (e) {
                console.log('Select2未初始化');
            }
        }
        return;
    }
    
    try {
        // 获取该小组的所有型号（使用页面上的时间区间和员工筛选）
        const selectedOption = groupSelect.options[groupSelect.selectedIndex];
        const processName = selectedOption.getAttribute('data-process-name');
        
        if (!processName) {
            console.error('小组信息不完整');
            return;
        }
        
        // 获取用户选择的时间区间
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;
        const startTime = document.getElementById('start-time').value || '00:00:00';
        const endTime = document.getElementById('end-time').value || '23:59:59';
        
        // 如果用户还没选择日期，使用默认的最近30天
        let startDateTime, endDateTime;
        if (startDate && endDate) {
            startDateTime = `${startDate}T${startTime}`;
            endDateTime = `${endDate}T${endTime}`;
        } else {
            // 默认最近30天
            const endDateObj = new Date();
            const startDateObj = new Date();
            startDateObj.setDate(startDateObj.getDate() - 30);
            startDateTime = startDateObj.toISOString();
            endDateTime = endDateObj.toISOString();
        }
        
        // 获取员工筛选
        const employeeFilterValue = document.getElementById('employee-filter').value;
        const employeeName = employeeFilterValue || null;
        
        const requestBody = {
            group_name: groupName,
            process: processName,
            requester_name: userState.fullName,
            start_date: startDateTime,
            end_date: endDateTime,
            employee_name: employeeName
        };
        
        // 发送请求获取型号列表
        
        const response = await fetch(`${API_BASE_URL}/group-management/leader-summary`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            throw new Error('获取型号列表失败');
        }
        
        const data = await response.json();
        const models = new Set();
        
        // 从返回的数据中提取型号
        // 智能过滤：只显示有数据的型号，并根据ModelSwitcher选择显示对应的型号类型
        if (data.items) {
            data.items.forEach(item => {
                // 根据ModelSwitcher获取要显示的型号（与查询结果保持一致）
                let displayModel = item.product_model;
                if (typeof ModelSwitcher !== 'undefined') {
                    const currentType = ModelSwitcher.getCurrentType();
                    if (currentType === 'auto') {
                        // 自动模式：优先显示成品型号 → 半成品型号 → 产品型号
                        if (item.finished_product_model && item.finished_product_model.trim()) {
                            displayModel = item.finished_product_model;
                        } else if (item.semi_product_model && item.semi_product_model.trim()) {
                            displayModel = item.semi_product_model;
                        } else {
                            displayModel = item.product_model;
                        }
                    } else if (currentType === 'semi') {
                        // 选择半成品型号：fallback到产品型号
                        displayModel = item.semi_product_model || item.product_model;
                    } else if (currentType === 'finished') {
                        // 选择成品型号：fallback到产品型号
                        displayModel = item.finished_product_model || item.product_model;
                    }
                }
                
                if (displayModel && displayModel.trim()) {
                    // 根据筛选条件决定使用哪个完成数
                    let completedCount;
                    if (employeeName) {
                        // 如果选择了员工，使用该员工的完成数
                        completedCount = item.employee_completed || 0;
                    } else {
                        // 如果没选择员工，使用总完成数
                        completedCount = item.total_completed || 0;
                    }
                    
                    // 只添加有完成数的型号（在当前时间范围和员工条件下有数据）
                    if (completedCount > 0) {
                        models.add(displayModel.trim());
                    }
                }
            });
        }
        
        // 填充型号下拉框
        const modelArray = Array.from(models).sort();
        const modelFilter = document.getElementById('model-filter');
        
        // 保存当前选中的型号
        const currentSelected = Array.from(modelFilter.selectedOptions).map(opt => opt.value);
        
        modelFilter.innerHTML = '';
        
        if (modelArray.length === 0) {
            // 没有型号
            const option = document.createElement('option');
            option.value = '';
            option.textContent = '当前筛选条件下没有数据';
            option.disabled = true;
            modelFilter.appendChild(option);
            showToast('当前筛选条件下没有数据', 'warning');
        } else {
            // 添加"全部型号"选项作为第一项
            const allOption = document.createElement('option');
            allOption.value = '';
            allOption.textContent = '全部型号';
            modelFilter.appendChild(allOption);
            
            // 添加具体型号
            modelArray.forEach(model => {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = model;
                // 如果之前选中过这个型号，且它仍在新列表中，保持选中状态
                if (currentSelected.includes(model)) {
                    option.selected = true;
                }
                modelFilter.appendChild(option);
            });
            showToast(`型号列表已刷新，共${modelArray.length}个型号`, 'success');
        }
        
        // 如果Select2已初始化，触发更新
        if (typeof jQuery !== 'undefined' && typeof jQuery.fn.select2 !== 'undefined') {
            try {
        jQuery('#model-filter').trigger('change');
            } catch (e) {
                console.log('Select2未初始化');
            }
        }
        
    } catch (error) {
        console.error('加载型号列表失败:', error);
        const modelFilter = document.getElementById('model-filter');
        modelFilter.innerHTML = '';
        if (typeof jQuery !== 'undefined' && typeof jQuery.fn.select2 !== 'undefined') {
            try {
                jQuery('#model-filter').trigger('change');
            } catch (e) {
                console.log('Select2未初始化');
            }
        }
    }
}

// 查询小组产品数量
async function queryGroupProducts() {
    const groupSelect = document.getElementById('group-select');
    const groupName = groupSelect.value;
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    const startTime = document.getElementById('start-time').value || '00:00:00';
    const endTime = document.getElementById('end-time').value || '23:59:59';
    const employeeFilter = document.getElementById('employee-filter').value;
    
    // 获取选中的型号（数组） - 兼容Select2和原生多选框
    let modelFilter = [];
    const modelFilterElement = document.getElementById('model-filter');
    if (typeof jQuery !== 'undefined' && typeof jQuery.fn.select2 !== 'undefined') {
        try {
            modelFilter = jQuery('#model-filter').val() || [];
        } catch (e) {
            // Select2未初始化，使用原生方式
            modelFilter = Array.from(modelFilterElement.selectedOptions).map(opt => opt.value);
        }
    } else {
        // 使用原生方式获取多选值
        modelFilter = Array.from(modelFilterElement.selectedOptions).map(opt => opt.value);
    }
    
    // 过滤掉空值（"全部型号"选项的value是空字符串）
    modelFilter = modelFilter.filter(v => v && v.trim() !== '');
    
    if (!groupName) {
        showToast('请选择小组', 'warning');
        return;
    }
    
    if (!startDate || !endDate) {
        showToast('请选择日期范围', 'warning');
        return;
    }
    
    try {
        // 获取选中的工序
        const selectedOption = groupSelect.options[groupSelect.selectedIndex];
        const processName = selectedOption.getAttribute('data-process-name');
        
        if (!processName) {
            showToast('小组信息不完整', 'error');
            return;
        }
        
        // 组合日期和时间（不添加Z，使用本地时间避免时区问题）
        const startDateTime = `${startDate}T${startTime}`;
        const endDateTime = `${endDate}T${endTime}`;
        
        // 调用组长汇总API
        const requestBody = {
            group_name: groupName,
            process: processName,
            requester_name: userState.fullName,
            start_date: startDateTime,
            end_date: endDateTime,
            employee_name: employeeFilter || null  // 如果选择了员工则筛选
        };
        
        const response = await fetch(`${API_BASE_URL}/group-management/leader-summary`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || '查询数据失败');
        }
        
        const data = await response.json();
        
        // 显示结果
        displayGroupProductsResult(data, groupName, processName, startDate, endDate, startTime, endTime, employeeFilter, modelFilter);
    } catch (error) {
        console.error('查询失败:', error);
        showToast('查询失败: ' + error.message, 'error');
    }
}

// 显示小组产品数量结果
function displayGroupProductsResult(data, groupName, processName, startDate, endDate, startTime, endTime, employeeFilter, modelFilter) {
    const resultContainer = document.getElementById('group-products-result');
    
    if (!data || !data.items || data.items.length === 0) {
        resultContainer.innerHTML = '<div class="alert alert-info">该时间范围内没有找到产品数据</div>';
        return;
    }
    
    // 如果筛选了员工，显示该员工的完成数；否则显示所有员工的总数
    const isEmployeeFiltered = employeeFilter && employeeFilter.trim() !== '';
    
    // 是否筛选了型号
    const isModelFiltered = modelFilter && Array.isArray(modelFilter) && modelFilter.length > 0;
    
    // 只显示数量大于0的产品（根据筛选条件选择合适的字段）
    // 只保留有完成数的项
    const filteredItems = data.items.filter(item => {
        const count = isEmployeeFiltered ? item.employee_completed : item.total_completed;
        // 先过滤数量
        if (count <= 0) return false;
        // 如果筛选了型号，只显示选中的型号
        if (isModelFiltered && modelFilter.length > 0 && !modelFilter.includes(item.product_model)) return false;
        return true;
    });
    
    if (filteredItems.length === 0) {
        let msg = '该时间范围内没有完成数量大于0的产品';
        if (isEmployeeFiltered) {
            msg = `员工 ${employeeFilter} 在该时间范围内没有完成任何产品`;
        }
        if (isModelFiltered) {
            msg += '（已应用型号筛选）';
        }
        resultContainer.innerHTML = `<div class="alert alert-info">${msg}</div>`;
        return;
    }
    
    const timeRangeStr = startTime && endTime ? ` ${startTime} - ${endTime}` : '';
    const employeeStr = isEmployeeFiltered ? ` (员工: ${employeeFilter})` : '';
    const modelStr = isModelFiltered ? ` (型号: ${modelFilter.join(', ')})` : '';
    
    let html = `
        <h4 class="mb-3">查询结果</h4>
        <p><strong>小组:</strong> ${groupName} (${getProcessDisplayName(processName)})</p>
        <p><strong>时间范围:</strong> ${formatDate(startDate)} 至 ${formatDate(endDate)}${timeRangeStr}${employeeStr}${modelStr}</p>
        <div class="table-responsive">
        <table class="table table-striped table-bordered" id="group-products-table">
            <thead>
                <tr>
                    <th class="long-text">产品型号 (点击查看详情)</th>
                    <th class="number-cell">完成数量</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    let totalCount = 0;
    
    filteredItems.forEach((item, index) => {
        // 根据是否筛选员工，显示对应的数量
        const displayCount = isEmployeeFiltered ? item.employee_completed : item.total_completed;
        
        // 使用ModelSwitcher获取要显示的型号
        let displayModel = item.product_model;
        if (typeof ModelSwitcher !== 'undefined') {
            const currentType = ModelSwitcher.getCurrentType();
            if (currentType === 'auto') {
                // 自动模式：优先显示成品型号 → 半成品型号 → 产品型号
                if (item.finished_product_model && item.finished_product_model.trim()) {
                    displayModel = item.finished_product_model;
                } else if (item.semi_product_model && item.semi_product_model.trim()) {
                    displayModel = item.semi_product_model;
                } else {
                    displayModel = item.product_model;
                }
            } else if (currentType === 'semi') {
                // 选择半成品型号：fallback到产品型号
                displayModel = item.semi_product_model || item.product_model;
            } else if (currentType === 'finished') {
                // 选择成品型号：fallback到产品型号
                displayModel = item.finished_product_model || item.product_model;
            }
        }
        
        html += `
            <tr class="product-row" data-index="${index}" style="cursor: pointer;">
                <td class="long-text">${displayModel}</td>
                <td class="number-cell">${displayCount}</td>
            </tr>
            <tr class="product-detail-row" id="detail-${index}" style="display: none;">
                <td colspan="2">
                    <div class="card mt-2 mb-2">
                        <div class="card-body" style="padding: 0.5rem;">
                            <h6 style="font-size: 0.9rem; margin-bottom: 0.3rem;">员工完成详情：</h6>
                            <table class="table table-sm table-bordered mb-0" style="font-size: 0.85rem; table-layout: fixed;">
                                <thead>
                                    <tr>
                                        <th style="padding: 0.25rem 0.5rem !important; line-height: 1.2 !important; width: 70%;">员工姓名</th>
                                        <th style="padding: 0.25rem 0.5rem !important; line-height: 1.2 !important; width: 30%;">完成数量</th>
            </tr>
                                </thead>
                                <tbody>
        `;
        
        // 显示员工详情
        if (item.employees && item.employees.length > 0) {
            item.employees.forEach((emp, empIndex) => {
                html += `
                    <tr class="employee-row" data-product-index="${index}" data-employee-index="${empIndex}" style="cursor: pointer; height: 28px;">
                        <td class="employee-name-cell" style="color: #0d6efd; font-weight: 500; padding: 0.25rem 0.5rem !important; font-size: 0.875rem; line-height: 1.2 !important; height: 28px; vertical-align: middle;">
                            <i class="bi bi-chevron-right employee-chevron" id="chevron-${index}-${empIndex}" style="font-size: 0.7rem;"></i>
                            ${emp.employee_name}
                        </td>
                        <td style="padding: 0.25rem 0.5rem !important; font-size: 0.875rem; line-height: 1.2 !important; height: 28px; vertical-align: middle;">${emp.count}</td>
                    </tr>
                    <tr class="employee-products-row" id="employee-products-${index}-${empIndex}" style="display: none;">
                        <td colspan="2" style="padding: 0 !important;">
                            <div style="background-color: #f8f9fa; padding: 0.25rem 0.5rem;">
                                <div id="products-list-${index}-${empIndex}">
                                    <div class="text-center text-muted small">
                                        <div class="spinner-border spinner-border-sm" role="status"></div>
                                        加载中...
                                    </div>
                                </div>
                            </div>
                        </td>
                    </tr>
                `;
            });
        } else {
            html += `
                <tr>
                    <td colspan="2" class="text-center text-muted" style="padding: 0.3rem 0.5rem; font-size: 0.85rem;">暂无员工详情</td>
                </tr>
            `;
        }
        
        html += `
                                </tbody>
                            </table>
                        </div>
                    </div>
                </td>
            </tr>
        `;
        totalCount += displayCount;
    });
    
    html += `
            </tbody>
            <tfoot>
                <tr>
                    <th class="long-text">总计</th>
                    <th class="number-cell">${totalCount}</th>
                </tr>
            </tfoot>
        </table>
        </div>
    `;
    
    resultContainer.innerHTML = html;
    
    // 添加点击事件
    filteredItems.forEach((item, index) => {
        const row = document.querySelector(`.product-row[data-index="${index}"]`);
        const detailRow = document.getElementById(`detail-${index}`);
        
        if (row && detailRow) {
            row.addEventListener('click', () => {
                // 切换显示/隐藏
                if (detailRow.style.display === 'none') {
                    detailRow.style.display = '';
                    row.style.backgroundColor = '#e7f3ff';
                } else {
                    detailRow.style.display = 'none';
                    row.style.backgroundColor = '';
                }
            });
        }
        
        // 为每个员工添加点击事件
        if (item.employees && item.employees.length > 0) {
            item.employees.forEach((emp, empIndex) => {
                const empRow = document.querySelector(`.employee-row[data-product-index="${index}"][data-employee-index="${empIndex}"]`);
                const empProductsRow = document.getElementById(`employee-products-${index}-${empIndex}`);
                const chevron = document.getElementById(`chevron-${index}-${empIndex}`);
                
                if (empRow && empProductsRow) {
                    empRow.addEventListener('click', async (e) => {
                        e.stopPropagation(); // 防止触发产品行的点击事件
                        
                        // 切换显示/隐藏
                        if (empProductsRow.style.display === 'none') {
                            empProductsRow.style.display = '';
                            if (chevron) chevron.className = 'bi bi-chevron-down employee-chevron';
                            empRow.style.backgroundColor = '#fff3cd';
                            
                            // 加载该员工的产品列表
                            await loadEmployeeProducts(index, empIndex, emp.employee_name, item.product_model, startDate, endDate, startTime, endTime);
                        } else {
                            empProductsRow.style.display = 'none';
                            if (chevron) chevron.className = 'bi bi-chevron-right employee-chevron';
                            empRow.style.backgroundColor = '';
                        }
                    });
                }
            });
        }
    });
}

// 加载员工完成的产品列表
async function loadEmployeeProducts(productIndex, empIndex, employeeName, productModel, startDate, endDate, startTime, endTime) {
    const productsListDiv = document.getElementById(`products-list-${productIndex}-${empIndex}`);
    
    if (!productsListDiv) return;
    
    try {
        // 获取当前小组和工序信息
        const groupSelect = document.getElementById('group-select');
        const selectedOption = groupSelect.options[groupSelect.selectedIndex];
        const groupName = groupSelect.value;
        const processName = selectedOption.getAttribute('data-process-name');
        
        // 使用getProductsByGroup API查询该时间范围的所有产品
        const response = await fetch(`${API_BASE_URL}/getProductsByGroup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                group_name: groupName,
                process_name: processName,
                start_date: `${startDate}T${startTime || '00:00:00'}`,
                end_date: `${endDate}T${endTime || '23:59:59'}`
            })
        });
        
        if (!response.ok) {
            throw new Error('获取产品列表失败');
        }
        
        const products = await response.json();
        
        if (!products || products.length === 0) {
            productsListDiv.innerHTML = '<div class="text-center text-muted small py-2">该员工在此时间范围内未完成任何产品</div>';
            return;
        }
        
        // 获取当前工序的员工字段和时间字段
        const empField = `${processName}员工`;
        const timeField = `${processName}时间`;
        
        // 过滤出该型号、该员工在该工序完成的产品
        const filteredProducts = products
            .filter(p => {
                return p['产品型号'] === productModel && 
                       p[empField] && 
                       p[empField].includes(employeeName) && 
                       p[timeField];
            })
            .map(p => ({
                code: p['产品编码'],
                model: p['产品型号'],
                completedTime: new Date(p[timeField]),
                fullData: p
            }));
        
        console.log(`员工${employeeName}在${processName}完成${productModel}的产品数:`, filteredProducts.length);
        
        if (filteredProducts.length === 0) {
            productsListDiv.innerHTML = '<div class="text-center text-muted small py-2">该员工未完成该型号的产品</div>';
            return;
        }
        
        // 按完成时间排序
        filteredProducts.sort((a, b) => b.completedTime - a.completedTime);
        
        // 构建产品列表HTML
        let html = '<div style="border: 1px solid #dee2e6;">';
        filteredProducts.forEach((product, idx) => {
            const timeStr = formatDateTime(product.completedTime);
            html += `
                <a href="#" class="product-code-link" 
                   data-product-code="${product.code}" 
                   data-product-index="${productIndex}" 
                   data-emp-index="${empIndex}" 
                   data-item-index="${idx}"
                   style="display: flex; justify-content: space-between; align-items: center; padding: 0.25rem 0.5rem; font-size: 0.8rem; line-height: 1.3; border-bottom: 1px solid #dee2e6; text-decoration: none; background-color: white;">
                    <strong style="color: #0066cc;">${product.code}</strong>
                    <span class="text-muted" style="font-size: 0.75rem; white-space: nowrap;">
                        <i class="bi bi-clock" style="font-size: 0.7rem;"></i>
                        ${timeStr}
                    </span>
                </a>
            `;
        });
        html += '</div>';
        
        productsListDiv.innerHTML = html;
        
        // 为每个产品编号添加点击事件和hover效果
        filteredProducts.forEach((product, idx) => {
            const link = productsListDiv.querySelector(`.product-code-link[data-item-index="${idx}"]`);
            if (link) {
                // 添加hover效果
                link.addEventListener('mouseenter', (e) => {
                    e.target.style.backgroundColor = '#e7f3ff';
                });
                link.addEventListener('mouseleave', (e) => {
                    e.target.style.backgroundColor = 'white';
                });
                
                // 添加点击事件
                link.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // 显示工序详情弹窗
                    showProductDetail(product.fullData);
                    
                    // 显示模态窗口
                    const modal = document.getElementById('product-detail-modal');
                    if (modal) {
                        const bsModal = new bootstrap.Modal(modal);
                        bsModal.show();
                    }
                });
            }
        });
        
    } catch (error) {
        console.error('加载员工产品列表失败:', error);
        productsListDiv.innerHTML = '<div class="text-center text-danger small py-2">加载失败，请重试</div>';
    }
}

// 格式化日期时间
function formatDateTime(date) {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// 处理员工产品数量查询
async function handleEmployeeProducts() {
    // 加载小组数据到employee-group-select
    await loadEmployeeGroups();
    // 设置默认日期范围（当月）
    setDefaultDateRange('employee-start-date', 'employee-end-date');
    showScreen(SCREENS.EMPLOYEE_PRODUCTS);
}

// 加载员工查询的小组数据
async function loadEmployeeGroups() {
    try {
        // 从API获取所有组别
        const response = await fetch(`${API_BASE_URL}/groups?active_only=true`);
        if (!response.ok) {
            throw new Error('获取组别数据失败');
        }
        
        const data = await response.json();
        const groups = data.groups || [];
        
        const groupSelect = document.getElementById('employee-group-select');
        if (!groupSelect) {
            console.error('找不到employee-group-select元素');
            return;
        }
        
        groupSelect.innerHTML = '<option value="" selected>请选择小组</option>';
        
        // 只显示当前登录用户作为组长的小组
        const userGroups = await getLeaderGroups();
        
        groups.forEach(group => {
            // 检查当前用户是否是该组的组长
            const isLeader = userGroups.some(ug => ug.group_name === group.group_name);
            if (isLeader) {
                const option = document.createElement('option');
                option.value = group.group_name;  // 使用group_name作为value
                option.setAttribute('data-group-name', group.group_name);
                option.setAttribute('data-process-name', group.process_name);
                option.textContent = `${group.group_name} - ${getProcessDisplayName(group.process_name)}`;
                groupSelect.appendChild(option);
            }
        });
    } catch (error) {
        console.error('加载小组数据失败:', error);
        showToast('获取小组数据失败: ' + error.message, 'error');
    }
}

// 查询员工产品数量
async function queryEmployeeProducts() {
    const groupSelect = document.getElementById('employee-group-select');
    const groupName = groupSelect.value;
    const employeeName = document.getElementById('employee-name').value.trim();
    const startDate = document.getElementById('employee-start-date').value;
    const endDate = document.getElementById('employee-end-date').value;
    
    if (!groupName) {
        showToast('请选择小组', 'warning');
        return;
    }
    
    if (!startDate || !endDate) {
        showToast('请选择日期范围', 'warning');
        return;
    }
    
    try {
        // 获取选中的工序
        const selectedOption = groupSelect.options[groupSelect.selectedIndex];
        const processName = selectedOption.getAttribute('data-process-name');
        
        if (!processName) {
            showToast('小组信息不完整', 'error');
            return;
        }
        
        // 调用组长汇总API
        const requestBody = {
            group_name: groupName,
            process: processName,
            requester_name: userState.fullName,
            start_date: `${startDate}T00:00:00Z`,
            end_date: `${endDate}T23:59:59Z`,
            employee_name: employeeName || null  // 如果留空则查询全部
        };
        
        const response = await fetch(`${API_BASE_URL}/group-management/leader-summary`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || '查询数据失败');
                    }
        
        const data = await response.json();
        
        // 显示结果
        displayEmployeeProductsResult(data, employeeName, groupName, processName, startDate, endDate);
    } catch (error) {
        console.error('查询失败:', error);
        showToast('查询失败: ' + error.message, 'error');
    }
}

// 显示员工产品数量结果
function displayEmployeeProductsResult(data, employeeName, groupName, processName, startDate, endDate) {
    const resultContainer = document.getElementById('employee-products-result');
    
    if (!data || !data.items || data.items.length === 0) {
        resultContainer.innerHTML = '<div class="alert alert-info">该时间范围内没有找到产品数据</div>';
        return;
    }
    
    let html = `
        <h4 class="mb-3">查询结果</h4>
        <p><strong>小组:</strong> ${groupName} (${getProcessDisplayName(processName)})</p>
        ${employeeName ? `<p><strong>员工:</strong> ${employeeName}</p>` : '<p><strong>范围:</strong> 全部员工</p>'}
        <p><strong>日期范围:</strong> ${formatDate(startDate)} 至 ${formatDate(endDate)}</p>
        <div class="table-responsive">
        <table class="table table-striped table-bordered">
            <thead>
                <tr>
                    <th class="long-text">产品型号</th>
                    ${employeeName ? '<th class="number-cell">该员工完成</th>' : ''}
                    <th class="number-cell">小组总完成</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    let totalEmployeeCount = 0;
    let totalGroupCount = 0;
    
    data.items.forEach(item => {
        // 使用ModelSwitcher获取要显示的型号
        let displayModel = item.product_model;
        if (typeof ModelSwitcher !== 'undefined') {
            const currentType = ModelSwitcher.getCurrentType();
            if (currentType === 'auto') {
                // 自动模式：优先显示成品型号 → 半成品型号 → 产品型号
                if (item.finished_product_model && item.finished_product_model.trim()) {
                    displayModel = item.finished_product_model;
                } else if (item.semi_product_model && item.semi_product_model.trim()) {
                    displayModel = item.semi_product_model;
                } else {
                    displayModel = item.product_model;
                }
            } else if (currentType === 'semi') {
                // 选择半成品型号：fallback到产品型号
                displayModel = item.semi_product_model || item.product_model;
            } else if (currentType === 'finished') {
                // 选择成品型号：fallback到产品型号
                displayModel = item.finished_product_model || item.product_model;
            }
        }

        html += `
            <tr>
                <td class="long-text">${displayModel}</td>
                ${employeeName ? `<td class="number-cell">${item.employee_completed}</td>` : ''}
                <td class="number-cell">${item.total_completed}</td>
            </tr>
        `;
        totalEmployeeCount += item.employee_completed;
        totalGroupCount += item.total_completed;
    });
    
    html += `
            </tbody>
            <tfoot>
                <tr>
                    <th class="long-text">总计</th>
                    ${employeeName ? `<th class="number-cell">${totalEmployeeCount}</th>` : ''}
                    <th class="number-cell">${totalGroupCount}</th>
                </tr>
            </tfoot>
        </table>
        </div>
    `;
    
    resultContainer.innerHTML = html;
}

// 处理为新产品分配小组
function handleAssignGroup() {
    showScreen(SCREENS.ASSIGN_GROUP);
}

// 加载产品型号和小组数据
async function loadProductModelsAndGroups() {
    const processType = document.getElementById('process-type-select').value;
    
    if (!processType) {
        return;
    }
    
    try {
        // 加载未分配小组的产品型号
        const productResponse = await fetch(`${API_BASE_URL}/group-management/unassigned-products?process=${encodeURIComponent(processType)}`);
        if (!productResponse.ok) {
            throw new Error('获取产品型号数据失败');
        }
        
        const products = await productResponse.json();
        const productSelect = document.getElementById('product-model-select');
        productSelect.innerHTML = '';
        
        if (!products || products.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = '该工序暂无未分配的产品型号';
            option.disabled = true;
            productSelect.appendChild(option);
        } else {
            products.forEach(product => {
                const option = document.createElement('option');
                option.value = product.model;
                option.textContent = product.model;
            productSelect.appendChild(option);
        });
        }
        
        // 加载该工序下所有小组（只显示当前用户作为组长的小组）
        const groupResponse = await fetch(`${API_BASE_URL}/groups?active_only=true`);
        if (!groupResponse.ok) {
            throw new Error('获取小组数据失败');
        }
        
        const groupData = await groupResponse.json();
        const allGroups = groupData.groups || [];
        
        // 获取当前用户作为组长的小组
        const userGroups = await getLeaderGroups();
        
        const groupSelect = document.getElementById('assign-group-select');
        groupSelect.innerHTML = '<option value="" selected>请选择小组</option>';
        
        // 只显示该工序下，且当前用户是组长的小组
        allGroups.forEach(group => {
            if (group.process_name === processType) {
                const isLeader = userGroups.some(ug => ug.group_name === group.group_name);
                if (isLeader) {
            const option = document.createElement('option');
            option.value = group.group_name;  // 使用group_name作为value
                    option.setAttribute('data-group-name', group.group_name);
                    option.textContent = group.group_name;
            groupSelect.appendChild(option);
                }
            }
        });
        
        if (groupSelect.options.length === 1) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = '您不是该工序任何小组的组长';
            option.disabled = true;
            groupSelect.appendChild(option);
        }
    } catch (error) {
        console.error('加载数据失败:', error);
        showToast('加载数据失败: ' + error.message, 'error');
    }
}

// 提交小组分配
async function submitGroupAssignment() {
    const productSelect = document.getElementById('product-model-select');
    const groupSelect = document.getElementById('assign-group-select');
    const processType = document.getElementById('process-type-select').value;
    
    // 获取所有选中的产品型号
    const selectedOptions = Array.from(productSelect.selectedOptions);
    const productModels = selectedOptions.map(opt => opt.value).filter(v => v);
    
    if (productModels.length === 0) {
        showToast('请选择至少一个产品型号', 'warning');
        return;
    }
    
    const groupName = groupSelect.value;
    if (!groupName) {
        showToast('请选择小组', 'warning');
        return;
    }
    
    try {
        // 使用严格分配API
        const requestBody = {
            group_name: groupName,
            process: processType,
            product_models: productModels,
            requester_name: userState.fullName
        };
        
        const response = await fetch(`${API_BASE_URL}/group-management/assign-secure`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || '分配失败');
        }
        
        const data = await response.json();
        
        // 显示分配结果
            const resultElement = document.getElementById('assign-group-result');
        resultElement.classList.remove('d-none');
        
        let html = '<div class="alert alert-success"><h5>分配结果</h5><ul>';
        let successCount = 0;
        let failCount = 0;
        
        data.results.forEach(result => {
            if (result.success) {
                successCount++;
                html += `<li class="text-success">✓ ${result.product_model}: ${result.action === 'created' ? '新分配' : '更新分配'}</li>`;
        } else {
                failCount++;
                html += `<li class="text-danger">✗ ${result.product_model}: ${result.error}</li>`;
            }
        });
        
        html += `</ul><p><strong>成功: ${successCount}, 失败: ${failCount}</strong></p></div>`;
        resultElement.innerHTML = html;
        
        // 重新加载产品型号列表
        await loadProductModelsAndGroups();
        
        if (successCount > 0) {
            showToast(`成功分配 ${successCount} 个产品型号`, 'success');
        }
    } catch (error) {
        console.error('分配失败:', error);
        const resultElement = document.getElementById('assign-group-result');
        resultElement.innerHTML = `<div class="alert alert-danger">分配失败: ${error.message}</div>`;
        resultElement.classList.remove('d-none');
        showToast('分配失败: ' + error.message, 'error');
    }
}

// 处理查看已分配
async function handleViewAssigned() {
    const processSelect = document.getElementById('process-type-select');
    const processName = processSelect.value;
    const groupSelect = document.getElementById('assign-group-select');
    const groupName = groupSelect.value; // 可能为空
    
    if (!processName) {
        showToast('请先选择工序', 'warning');
        return;
    }
    
    try {
        showToast('正在加载已分配列表...', 'info');
        
        // 获取已分配的产品列表
        const response = await fetch(`${API_BASE_URL}/group-management/assigned-products?process=${encodeURIComponent(processName)}`);
        
        if (!response.ok) {
            throw new Error('获取已分配列表失败');
        }
        
        const assignments = await response.json();
        displayAssignedList({assignments: assignments}, processName, groupName);
        
    } catch (error) {
        console.error('获取已分配列表失败:', error);
        showToast('获取已分配列表失败: ' + error.message, 'error');
    }
}

// 显示已分配列表
function displayAssignedList(data, processName, groupName = '') {
    const container = document.getElementById('assigned-list-container');
    const listDiv = document.getElementById('assigned-list');
    
    if (!data || !data.assignments || data.assignments.length === 0) {
        listDiv.innerHTML = '<div class="alert alert-info">该工序暂无已分配的产品型号</div>';
        container.classList.remove('d-none');
        return;
    }
    
    // 如果选择了小组，则筛选该小组的数据
    let filteredAssignments = data.assignments;
    if (groupName && groupName.trim() !== '') {
        filteredAssignments = data.assignments.filter(item => item.group_name === groupName);
    }
    
    if (filteredAssignments.length === 0) {
        const message = groupName ? `小组 ${groupName} 暂无已分配的产品型号` : '该工序暂无已分配的产品型号';
        listDiv.innerHTML = `<div class="alert alert-info">${message}</div>`;
        container.classList.remove('d-none');
        return;
    }
    
    // 添加全选操作区域（移除批量删除按钮，将移到底部）
    const groupInfo = groupName ? ` - ${groupName}` : '';
    let html = `
        <div class="d-flex justify-content-between align-items-center mb-2" style="padding: 0.5rem; background-color: #f8f9fa; border-radius: 0.25rem;">
            <div class="form-check" style="margin: 0;">
                <input class="form-check-input" type="checkbox" id="select-all-assignments" style="margin-top: 0;">
                <label class="form-check-label" for="select-all-assignments" style="font-size: 0.9rem;">
                    全选${groupInfo}
                </label>
            </div>
            <span id="selected-count-display" style="font-size: 0.85rem; color: #6c757d;">已选: <span id="selected-count">0</span></span>
        </div>
    `;
    
    filteredAssignments.forEach(item => {
        const timeStr = new Date(item.assigned_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        html += `
            <div class="list-group-item" style="padding: 0.4rem 0.5rem;">
                <div style="display: flex; align-items: center; gap: 0.3rem; overflow: hidden;">
                    <input class="form-check-input assignment-checkbox" type="checkbox" 
                           data-assignment-id="${item.id}"
                           data-product-model="${item.product_model}"
                           data-group-name="${item.group_name}"
                           style="flex-shrink: 0; margin: 0; width: 16px; height: 16px;">
                    <span style="font-weight: 600; font-size: 0.85rem; flex-shrink: 0;">${item.product_model}</span>
                    <span style="font-size: 0.75rem; color: #6c757d; flex-shrink: 0;">→</span>
                    <span style="font-size: 0.8rem; font-weight: 500; flex-shrink: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.group_name}</span>
                    <span style="font-size: 0.7rem; color: #999; flex-shrink: 0; margin-left: auto;">${timeStr}</span>
                </div>
            </div>
        `;
    });
    
    listDiv.innerHTML = html;
    container.classList.remove('d-none');
    
    // 绑定全选功能
    const selectAllCheckbox = document.getElementById('select-all-assignments');
    const assignmentCheckboxes = document.querySelectorAll('.assignment-checkbox');
    const batchDeleteBtn = document.getElementById('batch-delete-btn');
    const selectedCountSpan = document.getElementById('selected-count');
    const selectedCountBtnSpan = document.getElementById('selected-count-btn');
    
    function updateSelectedCount() {
        const checkedBoxes = document.querySelectorAll('.assignment-checkbox:checked');
        const count = checkedBoxes.length;
        selectedCountSpan.textContent = count;
        if (selectedCountBtnSpan) {
            selectedCountBtnSpan.textContent = count;
        }
        batchDeleteBtn.disabled = count === 0;
    }
    
    selectAllCheckbox.addEventListener('change', function() {
        assignmentCheckboxes.forEach(cb => cb.checked = this.checked);
        updateSelectedCount();
    });
    
    assignmentCheckboxes.forEach(cb => {
        cb.addEventListener('change', updateSelectedCount);
    });
    
    // 绑定批量删除按钮
    batchDeleteBtn.addEventListener('click', function() {
        const checkedBoxes = Array.from(document.querySelectorAll('.assignment-checkbox:checked'));
        if (checkedBoxes.length === 0) return;
        
        const items = checkedBoxes.map(cb => ({
            id: cb.getAttribute('data-assignment-id'),
            model: cb.getAttribute('data-product-model'),
            group: cb.getAttribute('data-group-name')
        }));
        
        handleBatchDeleteAssignment(items, processName);
    });
}

// 处理批量删除分配
async function handleBatchDeleteAssignment(items, processName) {
    const modelList = items.map(item => `"${item.model}"`).join('、');
    if (!confirm(`确定要删除以下 ${items.length} 个型号的分配吗？\n\n${modelList}\n\n删除后这些型号将重新出现在未分配列表中。`)) {
        return;
    }
    
    try {
        showToast(`正在删除 ${items.length} 个分配...`, 'info');
        
        let successCount = 0;
        let failCount = 0;
        
        // 依次删除每个分配
        for (const item of items) {
            try {
                const response = await fetch(`${API_BASE_URL}/group-management/assignments/${item.id}`, {
                    method: 'DELETE'
                });
                
                if (response.ok) {
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (error) {
                console.error(`删除 ${item.model} 失败:`, error);
                failCount++;
            }
        }
        
        if (successCount > 0) {
            showToast(`成功删除 ${successCount} 个分配${failCount > 0 ? `，失败 ${failCount} 个` : ''}`, 'success');
        } else {
            showToast('删除失败', 'error');
        }
        
        // 刷新已分配列表
        handleViewAssigned();
        
        // 刷新未分配列表
        loadProductModelsAndGroups();
        
    } catch (error) {
        console.error('批量删除失败:', error);
        showToast('批量删除失败: ' + error.message, 'error');
    }
}

// 辅助函数
function getProcessDisplayName(processName) {
    const processMap = {
        'wiring': '绕线',
        'embedding': '嵌线',
        'connecting': '接线',
        'pressing': '压装',
        'turning': '车止口',
        'dipping': '浸漆'
    };
    return processMap[processName] || processName;
}

function getEmployeeFieldByProcess(processName) {
    const fieldMap = {
        'wiring': '绕线员工',
        'embedding': '嵌线员工',
        'connecting': '接线员工',
        'pressing': '压装员工',
        'turning': '车止口员工',
        'dipping': '浸漆员工'
    };
    return fieldMap[processName] || '';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
}

// 单次扫码工序按钮
    document.querySelectorAll('.process-btn').forEach(btn => {
        if (btn && typeof btn.addEventListener === 'function') {
            btn.addEventListener('click', function() {
                const processType = this.getAttribute('data-process');
                scanState.processType = processType;
                scanState.isContinuous = false;
                startScan(processType, false);
            });
        }
    });
    
    // 连续扫码工序按钮
    document.querySelectorAll('.process-btn-continuous').forEach(btn => {
        if (btn && typeof btn.addEventListener === 'function') {
            btn.addEventListener('click', function() {
                const processType = this.getAttribute('data-process');
                scanState.processType = processType;
                scanState.isContinuous = true;
                startScan(processType, true);
            });
        }
    });
    
    // 返回按钮（安全绑定）
    onId('single-scan-back', 'click', () => showScreen(SCREENS.HOME));
    onId('continuous-scan-back', 'click', () => showScreen(SCREENS.HOME));
    onId('query-back', 'click', () => showScreen(SCREENS.HOME));
    onId('models-back', 'click', () => showScreen(SCREENS.QUERY));
    onId('products-back', 'click', () => showScreen(SCREENS.MODELS));
    
    // 扫码相关（安全绑定）
    onId('scan-stop', 'click', stopScan);
    onId('scan-upload', 'click', uploadPendingCodes);
    
    // 添加扫码枪/手动录入按钮事件
    addManualScanEvent();
}

// 保存工序选择到本地存储
function saveProcessSelection(processType) {
    try {
        localStorage.setItem('selected_process', processType);
        console.log('工序选择已保存:', processType);
    } catch (error) {
        console.error('保存工序选择失败:', error);
    }
}

// 从本地存储加载工序选择
function loadSavedProcessSelection() {
    try {
        const savedProcess = localStorage.getItem('selected_process');
        if (savedProcess) {
            const processSelect = document.getElementById('process-select');
            if (processSelect) {
                processSelect.value = savedProcess;
                console.log('已恢复保存的工序选择:', savedProcess);
            }
        }
    } catch (error) {
        console.error('加载工序选择失败:', error);
    }
}

// 处理登录
async function handleLogin() {
    try {
        const nameInput = document.getElementById('username');
        const fullName = nameInput.value.trim();
        
        if (!fullName) {
            showToast('请输入姓名', 'warning');
            return;
        }
        
        // 保存用户信息到状态和本地存储
        userState.fullName = fullName;
        
        // 确保localStorage可用
        try {
            localStorage.setItem('user_full_name', fullName);
        } catch (storageError) {
            console.error('无法访问localStorage:', storageError);
            // 虽然localStorage失败，但仍可继续使用，只是设置不会被保存
        }
        
        // 导航到首页
        navigateToHome();
        
        // 显示登录成功提示
        showToast(`欢迎，${fullName}！`, 'success');
    } catch (error) {
        console.error('登录过程中发生错误:', error);
        showToast('登录失败，请重试', 'error');
    }
}

// 导航到首页
function navigateToHome() {
    try {
        // 更新用户信息显示
        const userFullnameElement = document.getElementById('user-fullname');
        if (userFullnameElement) {
            userFullnameElement.textContent = `用户: ${userState.fullName || '未登录'}`;
        }
        // 清空用户角色显示（不需要显示任何内容）
        const userRoleElement = document.getElementById('user-role');
        if (userRoleElement) {
            userRoleElement.textContent = '';
        }
        // 在主页上方添加工序提醒条
        showProcessWarning();
        // 显示主屏幕
        showScreen(SCREENS.HOME);
        // 不在这里调用refreshTodayProcessCount，避免和showScreen重复
    } catch (error) {
        console.error('导航到首页失败:', error);
    }
}

// 在主页显示当前选择的工序提醒条
function showProcessWarning() {
    // 移除已存在的提醒条
    const existingWarning = document.getElementById('process-warning');
    if (existingWarning) {
        existingWarning.remove();
    }
    
    const processSelect = document.getElementById('process-select');
    if (processSelect && processSelect.selectedIndex >= 0) {
        const selectedText = processSelect.options[processSelect.selectedIndex].text;
        
        // 创建提醒条
        const warningDiv = document.createElement('div');
        warningDiv.id = 'process-warning';
        warningDiv.className = 'process-warning';
        warningDiv.innerHTML = `当前工序: <span class="process-highlight">${selectedText}</span>`;
        
        // 添加到body
        document.body.appendChild(warningDiv);
        
        // 5秒后自动消失
        setTimeout(() => {
            const div = document.getElementById('process-warning');
            if (div) {
                div.style.opacity = '0';
                div.style.transition = 'opacity 0.5s';
                setTimeout(() => {
                    if (div.parentNode) {
                        div.parentNode.removeChild(div);
                    }
                }, 500);
            }
        }, 5000);
    }
}

// 显示指定屏幕
function showScreen(screenId) {
    try {
        console.log('切换到页面:', screenId);

        // 隐藏所有屏幕（容错：屏幕不存在则跳过）
        Object.values(SCREENS).forEach(id => {
            const el = document.getElementById(id);
            if (el && el.classList) {
                el.classList.add('d-none');
            } else {
                console.warn('[screen-miss]', id);
            }
        });

        // 显示目标屏幕（容错：目标不存在则回退首页）
        const targetEl = document.getElementById(screenId);
        if (targetEl && targetEl.classList) {
            targetEl.classList.remove('d-none');
        } else {
            console.error('[screen-target-miss]', screenId);
            const homeEl = document.getElementById(SCREENS.HOME);
            if (homeEl && homeEl.classList) {
                homeEl.classList.remove('d-none');
            }
        }

        // 隐藏所有模态框
        hideAllModals();

        // 如果切换回首页，停止扫码并刷新今日工序数量
        if (screenId === SCREENS.HOME) {
            if (scanState.currentHtml5QrScanner) {
                stopScanner();
            }
            setTimeout(refreshTodayProcessCount, 0);
        }

        // 浮动工序框功能已删除
    } catch (error) {
        console.error('切换屏幕失败:', error);
    }
}


// 隐藏所有模态框
function hideAllModals() {
    try {
        // 隐藏产品详情模态框
        const productDetailModal = document.getElementById('product-detail-modal');
        if (productDetailModal) {
            productDetailModal.style.display = 'none';
            productDetailModal.classList.remove('show');
            
            // 移除可能存在的背景
            const modalBackdrops = document.querySelectorAll('.modal-backdrop');
            modalBackdrops.forEach(backdrop => {
                if (backdrop.parentNode) {
                    backdrop.parentNode.removeChild(backdrop);
                }
            });
            
            // 移除body上的modal-open类和恢复滚动
            document.body.classList.remove('modal-open');
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
            
            // 恢复html的滚动
            document.documentElement.style.overflow = '';
        }
    } catch (error) {
        console.error('隐藏模态框失败:', error);
    }
}

// 显示功能未实现提示
function showFeatureNotAvailable(message) {
    showToast(message, 'info');
}

// 显示Toast提示
function showToast(message, type = 'success', duration = 3000) {
    // 如果类型是info并且消息包含"成功识别"，则使用较短的显示时间
    if (type === 'info' && message.includes('成功识别')) {
        duration = 1500; // 扫码识别成功提示仅显示1.5秒
    }
    
    const toastContainer = document.getElementById('toast-container');
    
    const toastElement = document.createElement('div');
    toastElement.classList.add('custom-toast', 'p-3', 'mb-2');
    
    // 设置Toast样式 - 现在显示在屏幕中间
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
            
            // 为扫码识别成功添加特殊样式
            if (message.includes('成功识别')) {
                toastElement.style.fontWeight = 'bold';
                toastElement.style.fontSize = '1.1em';
                toastElement.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
                toastElement.style.border = '1px solid rgba(255, 255, 255, 0.3)';
            }
            break;
    }
    
    toastElement.textContent = message;
    toastContainer.appendChild(toastElement);
    
    // 增加样式使Toast显示在屏幕中间
    toastElement.style.position = 'fixed';
    toastElement.style.top = '50%';
    toastElement.style.left = '50%';
    toastElement.style.transform = 'translate(-50%, -50%)';
    toastElement.style.zIndex = '9999';
    toastElement.style.minWidth = '200px';
    toastElement.style.textAlign = 'center';
    toastElement.style.borderRadius = '8px';
    toastElement.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.3)';
    
    // 自动关闭
    setTimeout(() => {
        toastElement.style.opacity = '0';
        toastElement.style.transition = 'opacity 0.3s ease';
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
    
    // 获取工序的中文名称
    const processName = getChineseProcessName(processType);
    
    // 更新UI
    document.getElementById('scan-title').innerHTML = `<span style="color:#8a2be2; font-weight:bold; font-size:1.3rem;">扫码工序: <span class="process-highlight">${processName}</span></span>`;
    
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
    
    // 显示扫码界面前先清理
    cleanup();
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
    
    // 为所有类型扫码增加手动输入功能
    addManualInputField();
    
    // 添加扫码帮助提示
    addScanningHelpTips();
    
    // 根据扫码类型选择回调函数
    const successCallback = (scanState.processType === 'query') 
        ? onProductQueryScanSuccess
        : onScanSuccess;
    
    // 先检测设备性能，为低端设备使用更简单的配置
    checkDevicePerformance().then(isLowEndDevice => {
        // 扫码配置 - 针对低端设备优化参数
        const config = {
            fps: isLowEndDevice ? 5 : 10,
            qrbox: isLowEndDevice ? 300 : { width: 280, height: 280 },
            aspectRatio: 1.0,
            disableFlip: false, // 允许翻转以提高识别率
            formatsToSupport: isLowEndDevice ? 
                [Html5QrcodeSupportedFormats.QR_CODE, Html5QrcodeSupportedFormats.CODE_128] : 
                [Html5QrcodeSupportedFormats.QR_CODE, Html5QrcodeSupportedFormats.CODE_128, 
                Html5QrcodeSupportedFormats.EAN_13, Html5QrcodeSupportedFormats.CODE_39, 
                Html5QrcodeSupportedFormats.DATA_MATRIX],
            experimentalFeatures: {
                useBarCodeDetectorIfSupported: true // 使用浏览器原生条形码检测器
            },
            rememberLastUsedCamera: true, // 记住上次使用的摄像头
            supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA], // 只使用摄像头扫描
            videoConstraints: {
                width: { ideal: isLowEndDevice ? 640 : 1280, min: 640 },
                height: { ideal: isLowEndDevice ? 480 : 720, min: 480 },
                facingMode: "environment",
                advanced: [
                    { focusMode: "continuous" },
                    { exposureMode: "continuous" },
                    { whiteBalanceMode: "continuous" }
                ]
            }
        };
        
        // 启动扫码
        startScanner(html5QrCode, config, successCallback);
    });
}

// 启动扫码器
function startScanner(html5QrCode, config, successCallback) {
    // 先清理旧的扫码会话
    if (html5QrCode.isScanning) {
        html5QrCode.stop().catch(err => console.error('停止旧的扫码会话失败:', err));
    }
    
    // 显示加载提示
    showToast('正在启动摄像头...', 'info', 2000);
    
    // 启动扫码
    html5QrCode.start(
        { facingMode: "environment" },
        config,
        successCallback,
        onScanFailure
    ).then(() => {
        console.log('扫码器启动成功');
    }).catch(err => {
        console.error(`无法启动相机: ${err}`);
        showToast('无法启动相机，请检查权限设置', 'error');
        
        // 添加错误恢复机制
        setTimeout(() => {
            try {
                // 如果启动失败，尝试使用更简单的配置重试
                const simpleConfig = {
                    fps: 5,
                    qrbox: 250,
                    formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE, Html5QrcodeSupportedFormats.CODE_128]
                };
                html5QrCode.start({ facingMode: "environment" }, simpleConfig, successCallback, onScanFailure)
                .then(() => {
                    console.log('使用简化配置启动扫码器成功');
                });
            } catch (retryErr) {
                console.error('重试启动相机失败:', retryErr);
                
                // 如果相机完全无法启动，显示仅手动输入模式提示
                showToast('相机无法启动，请使用手动输入模式', 'warning', 5000);
                
                // 确保手动输入区域可见
                const manualInputContainer = document.getElementById('manual-input-container');
                if (manualInputContainer) {
                    manualInputContainer.style.display = 'block';
                    manualInputContainer.style.marginTop = '20px';
                    manualInputContainer.style.marginBottom = '20px';
                    
                    // 添加明显提示
                    const helpText = document.createElement('div');
                    helpText.className = 'alert alert-info';
                    helpText.innerHTML = '<strong>提示：</strong> 相机无法启动，请使用手动输入产品编码';
                    manualInputContainer.prepend(helpText);
                }
            }
        }, 1000);
    });
}

// 检测设备性能
async function checkDevicePerformance() {
    try {
        // 使用简单的性能检测
        const start = performance.now();
        let counter = 0;
        
        // 执行一些计算来测试设备性能
        for (let i = 0; i < 1000000; i++) {
            counter += Math.sqrt(i);
        }
        
        const duration = performance.now() - start;
        console.log(`性能测试耗时: ${duration}ms`);
        
        // 如果计算时间超过100毫秒，认为是低端设备
        return duration > 100;
    } catch (error) {
        console.error('性能检测失败:', error);
        return false; // 默认不是低端设备
    }
}

// 切换闪光灯状态
async function toggleTorch(scanner, button) {
    // 空函数，闪光灯功能已移除
    console.log('闪光灯功能已禁用');
}

// 为所有类型扫码增加手动输入功能
function addManualInputField() {
    // 移除已存在的手动输入框，确保不重复创建
    const existingInputs = document.querySelectorAll('#manual-input-container');
    existingInputs.forEach(container => container.remove());
    
    // 获取扫码容器
    const scannerContainer = document.getElementById('scanner-container');
    if (!scannerContainer) return;
    
    // 创建并添加手动输入框
    const manualInputContainer = document.createElement('div');
    manualInputContainer.className = 'mb-3';
    manualInputContainer.id = 'manual-input-container';
    manualInputContainer.innerHTML = `
        <div class="input-group mb-3">
            <input type="text" class="form-control form-control-lg" id="manual-product-code" placeholder="手动输入产品编码">
            <button class="btn btn-primary btn-lg" id="submit-manual-code" type="button">确认</button>
        </div>
    `;
    
    // 添加到扫码容器之后
    scannerContainer.parentNode.insertBefore(manualInputContainer, scannerContainer.nextSibling);
    
    // 添加手动输入事件
    const submitButton = document.getElementById('submit-manual-code');
    const inputField = document.getElementById('manual-product-code');
    
    if (submitButton && inputField) {
        // 点击确认按钮
        submitButton.addEventListener('click', handleManualCodeInput);
        
        // 按回车确认
        inputField.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                handleManualCodeInput();
            }
        });
    }
}

// 添加扫码帮助提示
function addScanningHelpTips() {
    const scannerContainer = document.getElementById('scanner-container');
    if (!scannerContainer || !scannerContainer.parentNode) return;
    
    const helpTipsContainer = document.createElement('div');
    helpTipsContainer.className = 'alert alert-info mt-2';
    helpTipsContainer.innerHTML = `
        <h5 class="mb-2">扫码技巧:</h5>
        <ul class="mb-0">
            <li>保持设备稳定，避免晃动</li>
            <li>确保产品条码在框内，光线充足</li>
            <li>如扫码失败，可尝试手动输入</li>
        </ul>
    `;
    
    // 添加到扫码容器之后
    scannerContainer.parentNode.insertBefore(helpTipsContainer, scannerContainer.nextSibling);
}

// 处理手动输入的产品码
function handleManualCodeInput() {
    const inputField = document.getElementById('manual-product-code');
    if (!inputField) return;
    
    const productCode = inputField.value.trim();
    if (!productCode) {
        showToast('请输入产品编码', 'warning');
        return;
    }
    
    // 根据当前模式处理手动输入的码
    if (scanState.processType === 'query') {
        // 产品查询模式
        handleManualInput();
    } else {
        // 扫码模式 - 模拟扫码成功
        onScanSuccess(productCode, { result: { text: productCode } });
    }
    
    // 清空输入框
    inputField.value = '';
}

// 统一的编码清洗与去重
function normalizeCode(code) {
    return (code || '').trim();
}
function dedupeOrdered(list) {
    const seen = new Set();
    const out = [];
    for (const raw of list || []) {
        const c = normalizeCode(raw);
        if (!c) continue;
        if (seen.has(c)) continue;
        seen.add(c);
        out.push(c);
    }
    return out;
}

// 扫码成功回调
async function onScanSuccess(decodedText, decodedResult, showSuccessToast = true) {
    if (scanState.isProcessing) return;
    const normalized = normalizeCode(decodedText);
    if (!normalized) return;
    const now = Date.now();
    if (normalized === scanState.lastScannedCode && now - scanState.lastScanTime < 1000) return;
    scanState.isProcessing = true;
    scanState.lastScannedCode = normalized;
    scanState.lastScanTime = now;
    showToast(`成功识别: ${normalized}`, 'info');
    playSuccessBeep();
    if (scanState.isContinuous) {
        const next = dedupeOrdered([...(scanState.pendingCodes || []), normalized]);
        const added = next.length !== (scanState.pendingCodes || []).length;
        scanState.pendingCodes = next;
        if (added) {
            if (!window.pendingUpdateTimer) {
                window.pendingUpdateTimer = setTimeout(() => {
                    updatePendingList();
                    window.pendingUpdateTimer = null;
                }, 100);
            }
            showToast(`已添加到队列: ${normalized}`, 'success');
        } else {
            showToast('该产品已在队列中，请勿重复扫码', 'warning');
            playErrorSound();
        }
        scanState.isProcessing = false;
    } else {
        try {
            const result = await updateProductProcess(normalized, scanState.processType, userState.fullName, showSuccessToast);
            if (result === true) {
                playSuccessBeep();
                if (showSuccessToast) {
                    showToast(`${getChineseProcessName(scanState.processType)}数据更新成功: ${normalized}`, 'success');
                }
                setTimeout(() => {
                    stopScanner().then(() => {
                        showScreen(SCREENS.HOME);
                    }).catch(() => {
                        showScreen(SCREENS.HOME);
                    });
                }, 1000);
            } else if (result === 'duplicate') {
                // 单次扫码遇到已存在记录：先判断是否为当前用户自己录入
                playErrorSound();
                try {
                    scanState.isProcessing = true;
                    let isOwn = false;
                    try {
                        const details = await getProductDetails(normalized);
                        if (details) {
                            const { employeeField } = getProcessFields(scanState.processType);
                            const dbName = (details[employeeField] || '').replace(/\s+/g, '').trim();
                            const userName = (userState.fullName || '').replace(/\s+/g, '').trim();
                            isOwn = !!dbName && !!userName && (dbName === userName);
                        }
                    } catch (e) {
                        console.warn('判断是否本人录入失败，按非本人处理:', e);
                    }

                    if (isOwn) {
                        // 自己录入：不弹阻塞窗，仅提示
                        showToast('该产品该工序已由你录入，无需重复', 'warning');
                        setTimeout(() => { scanState.isProcessing = false; }, 200);
                    } else {
                        // 非本人：弹出需点击关闭的阻塞模态
                        const msgEl = document.getElementById('duplicate-record-message');
                        if (msgEl) {
                            const processName = getChineseProcessName(scanState.processType);
                            msgEl.innerHTML = `编号 <b>${normalized}</b> 的 <b>${processName}</b> 已存在记录。<br><span class="text-danger">注意：本次扫码不会计入当前登录人账目，即为如果继续使用此二维码，这台活儿白干。</span>`;
                        }
                        const modalEl = document.getElementById('duplicate-record-modal');
                        console.debug('[duplicate-modal] modalEl found?', !!modalEl);
                        if (modalEl) {
                            let modal;
                            try {
                                modal = bootstrap.Modal.getOrCreateInstance(modalEl, { backdrop: 'static', keyboard: false });
                            } catch (e) {
                                console.warn('[duplicate-modal] 获取Bootstrap实例失败，使用退化显示方式', e);
                            }
                            const confirmBtn = document.getElementById('duplicate-record-confirm');
                            if (confirmBtn) {
                                const newBtn = confirmBtn.cloneNode(true);
                                confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
                                newBtn.addEventListener('click', () => {
                                    try { modal && modal.hide(); } catch (_) {}
                                    try {
                                        modalEl.classList.remove('show');
                                        modalEl.style.display = 'none';
                                        document.body.classList.remove('modal-open');
                                        document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
                                    } catch(_) {}
                                    setTimeout(() => { scanState.isProcessing = false; }, 100);
                                });
                            }
                            try {
                                if (modal) {
                                    modal.show();
                                } else {
                                    modalEl.style.display = 'block';
                                    modalEl.classList.add('show');
                                    const backdrop = document.createElement('div');
                                    backdrop.className = 'modal-backdrop fade show';
                                    document.body.appendChild(backdrop);
                                    document.body.classList.add('modal-open');
                                }
                                console.debug('[duplicate-modal] 显示完成');
                            } catch (showErr) {
                                console.error('[duplicate-modal] 显示失败：', showErr);
                                showToast('该产品的该工序已存在，请勿重复扫码', 'error');
                                setTimeout(() => { scanState.isProcessing = false; }, 300);
                            }
                        } else {
                            showToast('该产品的该工序已存在，请勿重复扫码', 'error');
                            setTimeout(() => { scanState.isProcessing = false; }, 300);
                        }
                    }
                } catch (e) {
                    console.error('处理重复逻辑失败:', e);
                    setTimeout(() => { scanState.isProcessing = false; }, 300);
                }
                // 保持在单次扫码界面
            } else {
                // 其他错误情况
                playErrorSound();
                showToast('更新失败，请重试', 'error');
                setTimeout(() => { scanState.isProcessing = false; }, 500);
            }
        } catch (error) {
            console.error('处理扫码结果失败:', error);
            playErrorSound();
            showToast('处理失败，请重试', 'error');
            setTimeout(() => { scanState.isProcessing = false; }, 500);
        }
    }
}

// 更高效的成功提示音
function playSuccessBeep() {
    // 使用AudioContext API更高效地播放提示音
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.value = 1800; // 使用更高的频率提高识别度
        gainNode.gain.value = 0.1; // 保持较低的音量
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.08); // 更短的提示音时长
        
        // 添加渐变效果以避免爆音
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
        
        // 完成后关闭AudioContext以释放资源
        setTimeout(() => {
            audioCtx.close();
        }, 100);
    } catch (e) {
        console.log('播放提示音失败:', e);
    }
}

// 扫码失败回调
function onScanFailure(error) {
    // 忽略一般的"未识别到码"错误，避免频繁提示
    if (error && error.message && error.message.includes("No QR code found")) {
        return;
    }
    
    // 检查如果是摄像头权限错误
    if (error && error.message && (
        error.message.includes("permission") || 
        error.message.includes("权限") ||
        error.message.includes("NotAllowedError")
    )) {
        console.error("相机权限错误:", error);
        showToast("请授予相机访问权限", "error");
        return;
    }
    
    // 设备问题
    if (error && error.message && (
        error.message.includes("device") ||
        error.message.includes("设备") ||
        error.message.includes("NotFoundError") ||
        error.message.includes("NotReadableError")
    )) {
        console.error("设备错误:", error);
        showToast("无法访问相机设备，请尝试重新加载或检查设备", "error");
        return;
    }
    
    // 其他错误
    if (error) {
        // 仅记录日志，不显示提示，以免干扰用户
        console.error("扫码失败:", error);
    }
}

// 停止扫码并返回
function stopScan() {
    console.log("停止扫码，当前扫码类型:", scanState.processType);
    
    // 如果是连续扫码模式且有待上传的数据，询问是否放弃上传
    if (scanState.isContinuous && scanState.pendingCodes.length > 0) {
        if (confirm('是否放弃上传？')) {
            scanState.pendingCodes = [];
            cleanupScanResources(); // 使用统一的清理函数
            // 修改：直接返回主页
            showScreen(SCREENS.HOME);
        }
    } else {
        cleanupScanResources(); // 使用统一的清理函数
        // 修改：直接返回主页
        showScreen(SCREENS.HOME);
    }
}

// 清理扫码相关资源
function cleanupScanResources() {
    // 停止扫码器
    if (scanState.currentHtml5QrScanner) {
        stopScanner().then(() => {
            console.log("扫码器已停止");
            
            // 只有在非查询模式下才移除手动输入框
            if (scanState.processType !== 'query') {
                const existingInputs = document.querySelectorAll('#manual-input-container');
                existingInputs.forEach(element => element.remove());
            }
        }).catch(error => {
            console.error('停止扫码器出错:', error);
        });
    } else {
        console.log("没有活动的扫码器");
    }
}

// 停止扫码器
function stopScanner() {
    if (scanState.currentHtml5QrScanner) {
        // 首先清除所有捕获的流
        try {
            const videoElement = document.querySelector("#scanner-container video");
            if (videoElement && videoElement.srcObject) {
                const tracks = videoElement.srcObject.getTracks();
                tracks.forEach(track => track.stop());
                videoElement.srcObject = null;
            }
        } catch (e) {
            console.log('清理视频流失败:', e);
        }
        
        // 移除闪光灯按钮
        const torchButton = document.getElementById('torch-button');
        if (torchButton) {
            torchButton.remove();
        }
        
        return new Promise((resolve, reject) => {
            scanState.currentHtml5QrScanner.stop()
                .then(() => {
                    console.log('扫码器已停止');
                    
                    // 只有在非查询模式下才移除手动输入框
                    if (document.getElementById(SCREENS.SCAN).classList.contains('d-none') === false && scanState.processType !== 'query') {
                        const existingInputs = document.querySelectorAll('#manual-input-container');
                        existingInputs.forEach(element => element.remove());
                    }
                    
                    // 释放资源
                    scanState.currentHtml5QrScanner = null;
                    resolve();
                })
                .catch(err => {
                    console.error('停止扫码器失败:', err);
                    scanState.currentHtml5QrScanner = null;
                    reject(err);
                });
        });
    }
    return Promise.resolve(); // 如果没有扫码器，直接返回已解决的Promise
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
    // 统一去重与清洗，确保与后端一致
    scanState.pendingCodes = dedupeOrdered(scanState.pendingCodes);
    if (scanState.pendingCodes.length === 0) {
        showToast('没有有效的产品编码', 'warning');
        return;
    }
    const uploadButton = document.getElementById('scan-upload');
    uploadButton.disabled = true;
    uploadButton.textContent = '上传中...';
    showToast('上传中，请稍候...', 'info');
    try {
        const results = await batchUpdateProductProcess(
            scanState.pendingCodes,
            scanState.processType,
            userState.fullName
        );
        const successCount = results.filter(r => r.success).length;
        const failureCount = results.filter(r => !r.success).length;
        if (successCount > 0 && failureCount === 0) {
            showToast(`所有${successCount}个产品更新成功`, 'success');
        } else if (successCount > 0 && failureCount > 0) {
            showToast(`${successCount}个产品更新成功，${failureCount}个产品更新失败`, 'warning');
        } else {
            showToast('所有产品更新失败', 'error');
        }
        scanState.pendingCodes = [];
        updatePendingList();
        setTimeout(() => {
            stopScanner();
            showScreen(SCREENS.HOME);
        }, 2000);
    } catch (error) {
        console.error('上传失败:', error);
        showToast('上传失败，请重试', 'error');
    } finally {
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
        // 创建简短的提示音
        const context = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.value = 1200; // 高频提示音
        gainNode.gain.value = 0.1; // 降低音量
        
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);
        
        // 短促的提示音
        oscillator.start(context.currentTime);
        oscillator.stop(context.currentTime + 0.15);
        
        // 淡出效果
        gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.15);
    } catch (e) {
        console.log('播放提示音失败:', e);
    }
}

// 播放错误提示音
function playErrorSound() {
    try {
        // 创建错误提示音
        const context = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.value = 400; // 低频警告音
        gainNode.gain.value = 0.1; // 降低音量
        
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);
        
        // 短促的错误音
        oscillator.start(context.currentTime);
        oscillator.stop(context.currentTime + 0.3);
        
        // 频率变化
        oscillator.frequency.exponentialRampToValueAtTime(200, context.currentTime + 0.3);
        
        // 淡出效果
        gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.3);
    } catch (e) {
        console.log('播放错误提示音失败:', e);
    }
}

// ------ Supabase数据操作 ------

// 更新产品信息
async function updateProductProcess(productCode, processType, employeeName, showSuccessToast = true) {
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
        
        // 即使服务器返回400错误，我们也尝试解析响应
        const result = await response.json().catch(e => {
            console.error('解析响应失败:', e);
            return { success: false, error: '网络错误' };
        });
        // 记录最近一次响应，便于弹窗读取已有员工与时间
        window.__lastUpdateProcessResponseStatus = response.status;
        window.__lastUpdateProcessResult = result;
        console.debug('[updateProductProcess] status=', response.status, 'result=', result);
        
        // 不再检查response.ok，而是检查返回的result对象
        if (result.success) {
            // 只在showSuccessToast为true时弹窗
            if (showSuccessToast) {
                showToast(`${getChineseProcessName(processType)}数据更新成功: ${productCode}`, 'success');
            }
            return true;
        }
        
        // 如果是404错误，说明产品不存在，应该创建新产品
        if (response.status === 404) {
            console.log('产品不存在，将创建新产品:', productCode);
            
            // 再次发送请求，这次添加一个特殊标记，表示需要创建新产品
            updateData.createIfNotExists = true;
            
            const createResponse = await fetch(`${HTTP_API_URL}/api/updateProductProcess`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updateData)
            });
            
            const createResult = await createResponse.json().catch(e => {
                console.error('解析创建响应失败:', e);
                return { success: false };
            });
        
            return createResult.success === true;
        }
        
        // 检查是否是"已存在数据"的错误（兼容detail或error字段）
        if ((result && result.error && String(result.error).includes('该产品的该工序已存在数据，不能覆盖')) ||
            (result && result.detail && String(result.detail).includes('该产品的该工序已存在数据，不能覆盖'))) {
            console.log('[updateProductProcess] 检测到重复记录错误，将触发模态框');
            return 'duplicate'; // 返回特殊值表示重复记录
        }
        
        console.error('更新产品信息失败:', result.error || '未知错误');
        return false;
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
        
        // 清除任何可能存在的删除按钮
        const deleteButtonsContainer = document.getElementById('fixed-delete-buttons');
        if (deleteButtonsContainer) {
            deleteButtonsContainer.remove();
        }
        
        // 恢复原有的返回按钮（如果已被删除）
        const queryContent = document.getElementById('query-content');
        if (!document.getElementById('query-back')) {
            // 确保我们添加返回按钮
            const originalBackButton = document.querySelector('#query-screen button#query-back');
            if (!originalBackButton) {
                const backButtonDiv = document.createElement('div');
                backButtonDiv.innerHTML = '<button class="btn btn-secondary mt-3 w-100" id="query-back">返回</button>';
                document.querySelector('#query-screen .card-body').appendChild(backButtonDiv);
                
                // 添加事件监听器
                document.getElementById('query-back').addEventListener('click', () => showScreen(SCREENS.HOME));
            }
        }
        
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
    // 停止可能存在的扫码器
    if (scanState.currentHtml5QrScanner) {
        await stopScanner();
    }
    
    // 不再移除手动输入框
    
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
    
    // 清理界面并显示扫码界面
    // 先停止已有的扫码器
    if (scanState.currentHtml5QrScanner) {
        scanState.currentHtml5QrScanner.stop().catch(err => {
            console.error('停止扫码器失败:', err);
        });
        scanState.currentHtml5QrScanner = null;
    }
    
    // 获取扫码容器
    const scannerContainer = document.getElementById('scanner-container');
    if (scannerContainer) {
        scannerContainer.innerHTML = '';
    }
    
    // 更新UI
    document.getElementById('scan-title').textContent = '产品扫码查询';
    document.getElementById('scan-upload').classList.add('d-none');
    document.getElementById('scan-pending-list').classList.add('d-none');
    
    // 显示扫码界面
    showScreen(SCREENS.SCAN);
    
    // 移除已存在的手动输入框，确保不重复创建
    const existingInputs = document.querySelectorAll('#manual-input-container');
    existingInputs.forEach(container => container.remove());
    
    // 创建并添加手动输入框
    const manualInputContainer = document.createElement('div');
    manualInputContainer.className = 'mb-3';
    manualInputContainer.id = 'manual-input-container';
    manualInputContainer.innerHTML = `
        <div class="input-group mb-3">
            <input type="text" class="form-control" id="manual-product-code" placeholder="手动输入产品编码">
            <button class="btn btn-primary" id="submit-manual-code" type="button">查询</button>
        </div>
    `;
    
    // 确保找到scannerContainer及其父元素
    if (scannerContainer && scannerContainer.parentNode) {
    scannerContainer.parentNode.insertBefore(manualInputContainer, scannerContainer);
        console.log('手动输入框已添加');
    } else {
        console.error('无法找到scannerContainer或其父元素，无法添加手动输入框');
        // 尝试添加到扫码屏幕
        const scanScreen = document.getElementById(SCREENS.SCAN);
        if (scanScreen) {
            // 查找一个合适的容器来放置输入框
            const container = scanScreen.querySelector('.container') || scanScreen;
            container.insertBefore(manualInputContainer, container.firstChild);
            console.log('手动输入框已添加到扫码屏幕');
        }
    }
    
    // 添加手动输入事件
    const submitButton = document.getElementById('submit-manual-code');
    const inputField = document.getElementById('manual-product-code');
    
    if (submitButton && inputField) {
        // 移除之前可能存在的事件监听器
        const newSubmitButton = submitButton.cloneNode(true);
        submitButton.parentNode.replaceChild(newSubmitButton, submitButton);
        
        const newInputField = inputField.cloneNode(true);
        inputField.parentNode.replaceChild(newInputField, inputField);
        
        // 点击查询按钮
        newSubmitButton.addEventListener('click', handleManualInput);
        
        // 按回车查询
        newInputField.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                handleManualInput();
            }
        });
        
        console.log('手动输入事件已添加');
    } else {
        console.error('无法找到提交按钮或输入字段');
    }
    
    // 初始化扫码器
    initializeScanner();
    
    // 确保手动输入框可见
    setTimeout(() => {
        const inputContainer = document.getElementById('manual-input-container');
        if (inputContainer) {
            inputContainer.style.display = 'block';
            inputContainer.style.visibility = 'visible';
            inputContainer.style.opacity = '1';
        }
    }, 500);
}

// 清理函数 - 避免移除产品扫码查询的输入框
function cleanup() {
    // 如果当前不是扫码查询页面，才移除手动输入框
    if (scanState.processType !== 'query') {
        const inputContainers = document.querySelectorAll('#manual-input-container');
        inputContainers.forEach(container => container.remove());
    }
    
    // 清空扫码容器
    const scannerContainer = document.getElementById('scanner-container');
    if (scannerContainer) {
        scannerContainer.innerHTML = '';
    }
}

// 处理手动输入
async function handleManualInput() {
        const productCode = document.getElementById('manual-product-code').value.trim();
        if (!productCode) {
            showToast('请输入产品编码', 'warning');
            return;
        }
        
        try {
            // 模拟扫码成功处理
            scanState.isProcessing = true;
            
            // 查询产品详情
            const productData = await getProductDetails(productCode);
            
            if (productData) {
                // 播放成功提示音
                playSuccessSound();
                
                // 显示产品详情
                showProductDetail(productData);
                
                // 清空输入框
                document.getElementById('manual-product-code').value = '';
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
            }, 1000);
        }
}

// 产品查询扫码成功回调
async function onProductQueryScanSuccess(decodedText, decodedResult) {
    // 如果正在处理，忽略新的扫码结果
    if (scanState.isProcessing) return;
    
    // 防抖处理 - 检查是否是重复扫码
    const now = Date.now();
    // 忽略1秒内的重复扫码
    if (decodedText === scanState.lastScannedCode && now - scanState.lastScanTime < 1000) return;
    
    scanState.isProcessing = true;
    scanState.lastScannedCode = decodedText;
    scanState.lastScanTime = now;
    
    // 立即显示成功识别提示
    showToast(`成功识别产品码: ${decodedText}`, 'info');
    
    // 播放识别成功提示音
    playSuccessBeep();
    
    try {
        // 使用缓存机制查询产品详情
        const productData = await getCachedProductDetails(decodedText);
        
        if (productData) {
            // 播放成功提示音
            playSuccessBeep();
            
            // 显示产品详情
            showProductDetail(productData);
            
            // 延迟重置处理状态，但不要太长
            setTimeout(() => {
                scanState.isProcessing = false;
            }, 500);
        } else {
            // 播放错误提示音
            playErrorSound();
            
            showToast('未找到该产品信息', 'error');
            
            // 延迟重置处理状态，但时间短一些以便用户可以快速重试
            setTimeout(() => {
                scanState.isProcessing = false;
            }, 300);
        }
    } catch (error) {
        console.error('查询产品信息失败:', error);
        showToast('查询失败，请重试', 'error');
        playErrorSound();
        
        // 延迟重置处理状态
        setTimeout(() => {
            scanState.isProcessing = false;
        }, 300);
    }
}

// 带缓存的产品详情查询
const productDetailsCache = new Map();

async function getCachedProductDetails(productCode) {
    // 检查缓存中是否有数据
    if (productDetailsCache.has(productCode)) {
        const cachedData = productDetailsCache.get(productCode);
        // 检查缓存是否过期（1小时）
        if (Date.now() - cachedData.timestamp < 3600000) {
            return cachedData.data;
        }
    }
    
    // 缓存中没有数据或已过期，从API获取
    try {
        const productData = await getProductDetails(productCode);
        if (productData) {
            // 存入缓存
            productDetailsCache.set(productCode, {
                data: productData,
                timestamp: Date.now()
            });
            
            // 控制缓存大小，最多保存100条记录
            if (productDetailsCache.size > 100) {
                // 删除最旧的缓存记录
                const firstKey = productDetailsCache.keys().next().value;
                if (firstKey) {
                    productDetailsCache.delete(firstKey);
                }
            }
        }
        return productData;
    } catch (error) {
        console.error('获取产品详情失败:', error);
        return null;
    }
}

// 显示产品详情
function showProductDetail(product) {
    try {
        console.log('显示产品详情:', product['产品编码']);
        
    // 创建产品详情内容
    const productDetailContent = document.getElementById('product-detail-content');
        if (!productDetailContent) {
            console.error('未找到产品详情内容容器');
            return;
        }
        
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
        if (product['浸漆时间'] || product['浸漆员工']) {
        const immersionDiv = document.createElement('div');
        immersionDiv.className = 'product-detail-item';
        immersionDiv.innerHTML = `
            <div class="product-detail-label">浸漆:</div>
                <div>
                    ${product['浸漆员工'] ? '员工: ' + product['浸漆员工'] : ''}
                    ${product['浸漆时间'] ? '<br>时间: ' + formatDate(product['浸漆时间']) : ''}
                </div>
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
        
        // 确保模态框元素存在
        const modalElement = document.getElementById('product-detail-modal');
        if (!modalElement) {
            console.error('未找到产品详情模态框');
            return;
    }
    
    // 显示模态框
        try {
            // 首先确保所有其他模态框已隐藏
            hideAllModals();
            
            // 使用我们自定义的Bootstrap Modal类
            const productDetailModal = new bootstrap.Modal(modalElement);
    productDetailModal.show();
        } catch (error) {
            console.error('显示模态框失败:', error);
            
            // 备用方案：使用简单的显示方式
            modalElement.style.display = 'block';
            modalElement.classList.add('show');
        }
    } catch (error) {
        console.error('显示产品详情时出错:', error);
        showToast('显示产品详情失败', 'error');
    }
}

// 获取月份范围
async function getMonthRange() {
    try {
        // 检查缓存是否有效
        const now = new Date().getTime();
        if (appState.monthRangeCache.data && 
            appState.monthRangeCache.timestamp && 
            (now - appState.monthRangeCache.timestamp) < appState.monthRangeCache.maxAge) {
            console.log('使用缓存的月份范围数据');
            // 使用缓存数据
            queryState.monthRange.startDate = new Date(appState.monthRangeCache.data.startDate);
            queryState.monthRange.endDate = new Date(appState.monthRangeCache.data.endDate);
            return true;
        }
        
        // 缓存无效，从API获取月份范围
        const response = await fetch(`${HTTP_API_URL}/api/getMonthRange`);
        
        if (!response.ok) {
            console.error('获取月份范围失败:', response.statusText);
            // 设置默认范围作为备用
            setDefaultMonthRange();
            return true;
        }
        
        const result = await response.json();
        if (result.data && result.data.startDate && result.data.endDate) {
            // 更新应用状态
            queryState.monthRange.startDate = new Date(result.data.startDate);
            queryState.monthRange.endDate = new Date(result.data.endDate);
            
            // 保存到缓存
            appState.monthRangeCache.data = {
                startDate: result.data.startDate,
                endDate: result.data.endDate
            };
            appState.monthRangeCache.timestamp = now;
            
            console.log('从API获取并缓存月份范围:', 
                queryState.monthRange.startDate.toISOString(), '至', 
                queryState.monthRange.endDate.toISOString());
            return true;
        } else {
            // 如果API返回的数据不完整，使用默认范围
            console.warn('API返回的月份范围不完整，使用默认范围');
            setDefaultMonthRange();
            return true;
        }
    } catch (error) {
        console.error('获取月份范围失败:', error);
        setDefaultMonthRange();
        return true;
    }
}

// 设置默认月份范围（本月第一天到最后一天）
function setDefaultMonthRange() {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    queryState.monthRange.startDate = firstDay;
    queryState.monthRange.endDate = lastDay;
    
    console.log('使用默认月份范围:', 
        queryState.monthRange.startDate.toISOString(), '至', 
        queryState.monthRange.endDate.toISOString());
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
            
            if (product['浸漆员工'] === userState.fullName && isDateInRange(product['浸漆时间'])) {
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
        // 获取当前用户信息
        const fullName = localStorage.getItem('user_full_name');
        if (!fullName) {
            console.error('无法获取用户信息');
            document.getElementById('monthly-transactions-container').innerHTML = '<div class="alert alert-warning">无法获取用户信息，请重新登录</div>';
            return;
        }

        // 显示加载提示
        const transactionsContainer = document.getElementById('monthly-transactions-container');
        transactionsContainer.innerHTML = '<div class="text-center"><div class="spinner-border text-primary" role="status"></div><p>数据加载中...</p></div>';

        // 确保容器可见
        transactionsContainer.style.display = 'block';

        // 获取本月范围
        await getMonthRange();

        // 将日期转换为ISO格式字符串
        const startDateStr = queryState.monthRange.startDate.toISOString();
        const endDateStr = queryState.monthRange.endDate.toISOString();

        // 检查缓存是否有效
        const cacheKey = 'monthlyTransactions';
        const cacheParams = `${fullName}_${startDateStr}_${endDateStr}`;
        
        // 如果缓存有效并且参数匹配，直接使用缓存数据
        if (isCacheValid(cacheKey) && dataCache[cacheKey].params === cacheParams) {
            console.log('使用缓存的月度交易数据');
            renderTransactionList(dataCache[cacheKey].data);
            return;
        }
        
        console.log('从API加载月度交易数据');

        // 使用HTTP API查询数据库获取产品记录
        const url = `${HTTP_API_URL}/api/getUserMonthlyTransactions?employeeName=${encodeURIComponent(fullName)}&startDate=${encodeURIComponent(startDateStr)}&endDate=${encodeURIComponent(endDateStr)}`;
        
        // 添加随机查询参数以避免潜在的缓存问题
        const cacheBuster = `&_=${Date.now()}`;
        
        const response = await fetch(url + cacheBuster, {
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });

        if (!response.ok) {
            console.error('加载产品记录失败:', response.statusText);
            transactionsContainer.innerHTML = '<div class="alert alert-danger">加载记录失败，请重试</div>';
            return;
        }

        const result = await response.json();
        const userRecords = result.data || [];
        
        // 更新缓存
        dataCache[cacheKey] = {
            data: userRecords,
            timestamp: new Date(),
            params: cacheParams
        };
        
        // 渲染交易记录列表
        renderTransactionList(userRecords);

    } catch (error) {
        console.error('加载流水账失败:', error);
        document.getElementById('monthly-transactions-container').innerHTML = '<div class="alert alert-danger">加载数据失败，请重试</div>';
    }
}

// 渲染交易记录列表
function renderTransactionList(userRecords) {
    const transactionsContainer = document.getElementById('monthly-transactions-container');

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
    transactionsContainer.innerHTML = html;
}

// 在showMonthlyQuery函数中添加对loadMonthlyTransactionList的调用
function showMonthlyQuery() {
    showScreen(SCREENS.MONTHLY_QUERY);
    loadCurrentMonthRange();
    displayMonthRange();
    loadUserMonthlyProcesses();
    // 加载本月流水账 - 直接调用优化后的函数
    loadMonthlyTransactionList();
}

// 添加获取产品记录的函数
async function fetchRecords() {
    try {
        // 使用实际的API获取数据
        const response = await fetch(`${HTTP_API_URL}/api/getRecords`);
        
        if (!response.ok) {
            console.error('获取记录失败:', response.statusText);
            showToast('获取记录失败，请重试', 'error');
            // 如果API失败，使用全局变量中的记录作为备用
            return globalRecords;
        }
        
        const result = await response.json();
        return result.data || [];
    } catch (error) {
        console.error('获取记录时出错:', error);
        showToast('加载记录失败，请重试', 'error');
        // 如果API失败，使用全局变量中的记录作为备用
        return globalRecords;
    }
}

// 处理删除记录 - 优化版本
async function handleDeleteRecords() {
    try {
        // 获取本月范围
        await getMonthRange();
        
        // 显示删除记录屏幕
        showScreen(SCREENS.DELETE_RECORDS);
        
        // 显示加载中提示
        const deleteContent = document.getElementById('delete-records-content');
        deleteContent.innerHTML = '<div class="text-center my-3"><div class="spinner-border text-primary" role="status"></div><div class="mt-2">加载中...</div></div>';
        
        // 清空已有的固定按钮容器（如果存在）
        const existingButtonsContainer = document.getElementById('fixed-delete-buttons');
        if (existingButtonsContainer) {
            existingButtonsContainer.remove();
        }
        
        // 创建固定在屏幕底部的按钮容器
        const fixedButtonsContainer = document.createElement('div');
        fixedButtonsContainer.className = 'fixed-bottom bg-white border-top p-2';
        fixedButtonsContainer.id = 'fixed-delete-buttons';
        fixedButtonsContainer.style.boxShadow = '0 -2px 10px rgba(0,0,0,0.1)';
        fixedButtonsContainer.style.zIndex = '1030';
        fixedButtonsContainer.innerHTML = `
            <div class="container">
                <div class="row">
                    <div class="col-6">
                        <button class="btn btn-secondary w-100" id="delete-back-button">返回</button>
                    </div>
                    <div class="col-6">
                        <button class="btn btn-danger w-100" id="delete-selected-records" disabled>
                            删除选中记录
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // 添加到页面
        document.body.appendChild(fixedButtonsContainer);
        
        // 为新的返回按钮添加事件监听器
        document.getElementById('delete-back-button').addEventListener('click', () => {
            // 移除固定按钮容器
            fixedButtonsContainer.remove();
            // 返回到主屏幕
            showScreen(SCREENS.HOME);
            // 清除缓存，确保下次查看时重新加载数据
            dataCache.monthlyTransactions.data = null;
            dataCache.monthlyTransactions.timestamp = null;
        });
        
        // 将日期转换为ISO格式字符串
        const startDateStr = queryState.monthRange.startDate.toISOString();
        const endDateStr = queryState.monthRange.endDate.toISOString();
        
        // 添加随机查询参数以避免潜在的缓存问题
        const cacheBuster = `&_=${Date.now()}`;
        
        // 使用与本月台账查询相同的API获取记录，但不限制用户
        const response = await fetch(`${HTTP_API_URL}/api/getUserMonthlyTransactions?employeeName=${encodeURIComponent(userState.fullName)}&startDate=${encodeURIComponent(startDateStr)}&endDate=${encodeURIComponent(endDateStr)}${cacheBuster}`, {
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
        
        if (!response.ok) {
            console.error('获取记录失败:', response.statusText);
            deleteContent.innerHTML = '<div class="alert alert-danger">获取记录失败，请重试</div>';
            return;
        }
        
        const result = await response.json();
        const records = result.data || [];
        
        if (records.length === 0) {
            deleteContent.innerHTML = '<div class="alert alert-info">没有找到记录</div>';
            return;
        }
        
        // 构建HTML表格 - 优化响应式设计和美化样式
        let html = `
            <style>
                /* 删除记录表格专用样式 */
                .delete-records-container {
                    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                    border-radius: 12px;
                    padding: 20px;
                    margin: 10px 0;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                    width: 100%;
                    max-width: none;
                }
                
                .delete-records-table {
                    background: white;
                    border-radius: 8px;
                    overflow: hidden;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.08);
                    margin-bottom: 0;
                    width: 100%;
                    table-layout: auto;
                }
                
                .delete-records-table thead th {
                    background: linear-gradient(135deg, #6c757d 0%, #495057 100%);
                    color: white;
                    font-weight: 600;
                    text-align: center;
                    border: none;
                    padding: 8px 6px;
                    font-size: 0.9rem;
                    white-space: nowrap;
                }
                
                .delete-records-table tbody tr {
                    transition: all 0.2s ease;
                    border-bottom: 1px solid #e9ecef;
                }
                
                .delete-records-table tbody tr:hover {
                    background-color: #f8f9fa;
                    transform: translateY(-1px);
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }
                
                .delete-records-table tbody tr:last-child {
                    border-bottom: none;
                }
                
                .delete-records-table td {
                    padding: 8px 6px;
                    vertical-align: middle;
                    text-align: center;
                    border: none;
                    font-size: 0.9rem;
                    word-wrap: break-word;
                }
                
                /* 列宽度动态自适应（根据内容） */
                .delete-records-table th:nth-child(1),
                .delete-records-table td:nth-child(1) {
                    width: auto;
                    min-width: 40px;
                }
                
                /* 工序列 - 最小宽度，根据内容 */
                .delete-records-table th:nth-child(2),
                .delete-records-table td:nth-child(2) {
                    width: 1%;
                    min-width: 1px;
                    white-space: nowrap;
                }
                
                .delete-records-table th:nth-child(3),
                .delete-records-table td:nth-child(3) {
                    width: auto;
                    min-width: 90px;
                }
                
                /* 型号列 - 最小宽度，根据内容 */
                .delete-records-table th:nth-child(4),
                .delete-records-table td:nth-child(4) {
                    width: 1%;
                    min-width: 1px;
                    white-space: nowrap;
                }
                
                .delete-records-table th:nth-child(5),
                .delete-records-table td:nth-child(5) {
                    width: auto;
                    min-width: 110px;
                }
                
                .delete-records-table .record-checkbox {
                    width: 18px;
                    height: 18px;
                    cursor: pointer;
                    transform: scale(1.2);
                }
                
                .delete-records-table .record-checkbox:checked {
                    accent-color: #dc3545;
                }
                
                /* 工序列样式 */
                .delete-records-table .process-cell {
                    font-weight: 600;
                    color: #495057;
                    background-color: #f8f9fa;
                    border-radius: 4px;
                    padding: 4px 6px;
                    margin: 1px 0;
                    display: inline-block;
                    white-space: nowrap;
                }
                
                /* 产品编码列样式 */
                .delete-records-table .product-code-cell {
                    font-family: 'Courier New', monospace;
                    font-weight: 500;
                    color: #0d6efd;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                
                /* 型号列样式 */
                .delete-records-table .model-cell {
                    font-weight: 500;
                    color: #28a745;
                    word-break: break-word;
                }
                
                /* 时间列样式 - 优化显示，避免换行 */
                .delete-records-table .time-cell {
                    color: #6c757d;
                    font-size: 0.85rem;
                    white-space: nowrap;
                    font-family: 'Courier New', monospace;
                }
                
                /* PC端显示完整时间，隐藏简短时间 */
                .delete-records-table .time-short {
                    display: none;
                }
                
                .delete-records-table .time-full {
                    display: inline;
                }
                
                /* 响应式设计优化 */
                @media (max-width: 768px) {
                    .delete-records-container {
                        padding: 15px;
                        margin: 5px 0;
                    }
                    
                    .delete-records-table {
                        font-size: 0.8rem;
                    }
                    
                    .delete-records-table thead th {
                        font-size: 0.75rem;
                        padding: 6px 3px;
                    }
                    
                    .delete-records-table td {
                        font-size: 0.7rem;
                        padding: 6px 3px;
                    }
                    
                    .delete-records-table .time-cell {
                        font-size: 0.65rem;
                    }
                    
                    .delete-records-table .record-checkbox {
                        transform: scale(1.0);
                    }
                }
                
                @media (max-width: 576px) {
                    .delete-records-container {
                        padding: 8px;
                        border-radius: 8px;
                    }
                    
                    /* 启用横向滚动，显示所有列 */
                    .table-responsive {
                        overflow-x: auto;
                        -webkit-overflow-scrolling: touch;
                        position: relative;
                    }
                    
                    /* 横向滚动提示阴影 */
                    .table-responsive::after {
                        content: '';
                        position: absolute;
                        top: 0;
                        right: 0;
                        bottom: 0;
                        width: 20px;
                        background: linear-gradient(to left, rgba(0,0,0,0.1), transparent);
                        pointer-events: none;
                    }
                    
                    .delete-records-table {
                        font-size: 0.7rem;
                        table-layout: auto;
                        min-width: 450px;
                        width: max-content;
                    }
                    
                    .delete-records-table thead th {
                        font-size: 0.65rem;
                        padding: 4px 2px;
                        white-space: nowrap;
                    }
                    
                    .delete-records-table td {
                        font-size: 0.65rem;
                        padding: 4px 2px;
                    }
                    
                    .delete-records-table .time-cell {
                        font-size: 0.6rem;
                    }
                    
                    /* 移动端隐藏完整时间，显示简短时间 */
                    .delete-records-table .time-full {
                        display: none;
                    }
                    
                    .delete-records-table .time-short {
                        display: inline;
                    }
                    
                    .delete-records-table .process-cell {
                        padding: 2px 4px;
                        font-size: 0.6rem;
                        white-space: nowrap;
                        margin: 0;
                    }
                    
                    /* 使用动态列宽，根据内容自适应（启用横向滚动） */
                    
                    /* 复选框列 - 固定最小宽度 */
                    .delete-records-table th:nth-child(1),
                    .delete-records-table td:nth-child(1) {
                        width: auto;
                        min-width: 30px;
                        padding: 4px 3px;
                    }
                    
                    /* 工序列 - 极小padding，根据文字宽度 */
                    .delete-records-table th:nth-child(2),
                    .delete-records-table td:nth-child(2) {
                        width: 1%;
                        min-width: 1px;
                        padding: 4px 2px;
                        white-space: nowrap;
                    }
                    
                    /* 产品编码列 - 保证足够宽度 */
                    .delete-records-table th:nth-child(3),
                    .delete-records-table td:nth-child(3) {
                        width: auto;
                        min-width: 80px;
                        padding: 4px 5px;
                    }
                    
                    /* 型号列 - 极小padding，根据文字宽度 */
                    .delete-records-table th:nth-child(4),
                    .delete-records-table td:nth-child(4) {
                        width: 1%;
                        min-width: 1px;
                        padding: 4px 2px;
                        white-space: nowrap;
                    }
                    
                    /* 时间列 - 固定显示简短格式 */
                    .delete-records-table th:nth-child(5),
                    .delete-records-table td:nth-child(5) {
                        width: auto;
                        min-width: 75px;
                        padding: 4px 5px;
                    }
                    
                    .delete-records-table .record-checkbox {
                        transform: scale(0.9);
                        width: 16px;
                        height: 16px;
                    }
                    
                    /* 确保产品编码列不换行 */
                    .delete-records-table .product-code-cell {
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }
                    
                    /* 型号列也不要太宽 */
                    .delete-records-table .model-cell {
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }
                }
                
                /* 加载动画 */
                .delete-records-loading {
                    text-align: center;
                    padding: 40px;
                    color: #6c757d;
                }
                
                .delete-records-loading .spinner-border {
                    width: 3rem;
                    height: 3rem;
                    border-width: 0.3em;
                }
            </style>
            <div class="table-responsive mb-5 pb-5">
                <table class="table delete-records-table">
                        <thead>
                            <tr>
                                 <th scope="col"></th>
                                 <th scope="col">工序</th>
                                 <th scope="col">编码</th>
                                 <th scope="col">型号</th>
                                 <th scope="col">时间</th>
                             </tr>
                        </thead>
                        <tbody id="records-tbody">
        `;
        
        // 按时间排序（最新的在前）
        records.sort((a, b) => new Date(b.time) - new Date(a.time));
        
        records.forEach(record => {
            // 格式化时间
            const recordDate = new Date(record.time);
            const year = recordDate.getFullYear();
            const month = String(recordDate.getMonth() + 1).padStart(2, '0');
            const day = String(recordDate.getDate()).padStart(2, '0');
            const hours = String(recordDate.getHours()).padStart(2, '0');
            const minutes = String(recordDate.getMinutes()).padStart(2, '0');
            
            // 完整格式（PC端）
            const formattedDateFull = `${year}-${month}-${day} ${hours}:${minutes}`;
            // 简短格式（移动端）
            const formattedDateShort = `${month}-${day} ${hours}:${minutes}`;
            
            html += `
                <tr data-id="${record.id || Math.random().toString(36).substring(2, 10)}">
                    <td><input type="checkbox" class="record-checkbox" data-id="${record.id || Math.random().toString(36).substring(2, 10)}"></td>
                    <td><span class="process-cell">${record.process}</span></td>
                    <td class="product-code-cell">${record.productCode}</td>
                    <td class="model-cell">${record.model}</td>
                    <td class="time-cell" data-full-time="${formattedDateFull}">
                        <span class="time-full">${formattedDateFull}</span>
                        <span class="time-short">${formattedDateShort}</span>
                    </td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        
        // 更新DOM
        deleteContent.innerHTML = html;
        
        // 单个复选框变化时更新删除按钮状态
        document.getElementById('records-tbody').addEventListener('change', e => {
            if (e.target.classList.contains('record-checkbox')) {
                updateDeleteButtonState();
            }
        });
        
        // 删除按钮点击事件
        document.getElementById('delete-selected-records').addEventListener('click', deleteSelectedRecords);
        
    } catch (error) {
        console.error('处理删除记录时出错:', error);
        document.getElementById('delete-records-content').innerHTML = '<div class="alert alert-danger">加载数据失败，请重试</div>';
    }
    
    // 更新删除按钮状态
    function updateDeleteButtonState() {
        const selectedCount = document.querySelectorAll('.record-checkbox:checked').length;
        const deleteButton = document.getElementById('delete-selected-records');
        deleteButton.disabled = selectedCount === 0;
        deleteButton.textContent = selectedCount > 0 ? `删除选中记录 (${selectedCount})` : '删除选中记录';
    }
    
    // 删除选中记录
    function deleteSelectedRecords() {
        const selectedCheckboxes = document.querySelectorAll('.record-checkbox:checked');
        const selectedIds = Array.from(selectedCheckboxes).map(cb => cb.dataset.id);
        
        if (selectedIds.length === 0) {
            showToast('请先选择要删除的记录', 'warning');
            return;
        }
        
        if (!confirm(`确定要删除选中的 ${selectedIds.length} 条记录吗？此操作不可撤销。`)) {
            return;
        }
        
        const deleteButton = document.getElementById('delete-selected-records');
        const originalText = deleteButton.textContent;
        deleteButton.disabled = true;
        deleteButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 删除中...';
        
        // 获取选中行
        const promises = [];
        
        selectedCheckboxes.forEach(checkbox => {
            const row = checkbox.closest('tr');
            const processName = row.cells[1].textContent.trim();
            const productCode = row.cells[2].textContent.trim();
            
            // 根据中文工序名获取英文工序类型
            let processType = '';
            if (processName === '绕线') processType = 'wiring';
            else if (processName === '嵌线') processType = 'embedding';
            else if (processName === '接线') processType = 'wiring_connect';
            else if (processName === '压装') processType = 'pressing';
            else if (processName === '车止口') processType = 'stopper';
            else if (processName === '浸漆') processType = 'immersion';
            
            // 根据工序类型获取字段名
            const fields = getProcessFields(processType);
            
            // 调用删除API
            const promise = fetch(`${HTTP_API_URL}/api/deleteProductProcess`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    productCode: productCode,
                    processType: processType,
                    employeeName: userState.fullName,
                    timeField: fields.timeField,
                    employeeField: fields.employeeField
                }),
            })
            .then(response => {
                if (!response.ok) {
                    return response.text().then(text => {
                        throw new Error(`HTTP error! Status: ${response.status}, ${text}`);
                    });
                }
                return response.text().then(text => {
                    // 先获取文本，再尝试解析JSON
                    if (!text || text.trim() === '') {
                        // 空响应，但HTTP状态是200，认为删除成功
                        console.warn('删除API返回空响应，但状态码为200，认为删除成功');
                        return {success: true};
                    }
                    try {
                        return JSON.parse(text);
                    } catch (e) {
                        // JSON解析失败，但HTTP状态是200，认为删除成功
                        console.warn('JSON解析失败，但状态码为200，认为删除成功。响应内容:', text.substring(0, 100));
                        return {success: true};
                    }
                });
            });
            
            promises.push(promise);
        });
        
        // 等待所有删除完成
        Promise.all(promises)
            .then(results => {
                const successCount = results.filter(data => data.success).length;
                
                // 从DOM中删除选中的行
                selectedCheckboxes.forEach(checkbox => {
                    const row = checkbox.closest('tr');
                    if (row) row.remove();
                });
                
                // 显示成功提示
                showToast(`成功删除 ${successCount} 条记录`, 'success');
                
                // 清除缓存，确保数据刷新
                dataCache.monthlyTransactions.data = null;
                dataCache.monthlyTransactions.timestamp = null;
                
                // 检查是否还有剩余记录
                const remainingRecords = document.querySelectorAll('#records-tbody tr').length;
                
                // 恢复按钮状态（必须在handleRemainingRecords之前，因为它可能会移除按钮）
                if (deleteButton && deleteButton.parentElement) {
                    deleteButton.disabled = false;
                    deleteButton.textContent = originalText;
                }
                
                // 处理剩余记录
                if (remainingRecords === 0) {
                    try {
                        handleRemainingRecords();
                    } catch (e) {
                        console.error('处理剩余记录时出错:', e);
                        // 不显示错误提示，因为删除已经成功
                    }
                }
            })
            .catch(error => {
                console.error('删除记录时出错:', error);
                showToast('删除失败，请重试', 'error');
                
                // 恢复按钮状态
                deleteButton.disabled = false;
                deleteButton.textContent = originalText;
            });
    }
        
        function handleRemainingRecords() {
            const remainingRecords = document.querySelectorAll('#records-tbody tr').length;
            if (remainingRecords === 0) {
                document.getElementById('delete-records-content').innerHTML = 
                    '<div class="alert alert-info">没有找到记录</div>';
                
                // 如果没有剩余记录，也移除底部按钮
                const fixedButtons = document.getElementById('fixed-delete-buttons');
                if (fixedButtons) {
                    fixedButtons.remove();
                }
                
                // 延迟返回主屏幕
                setTimeout(() => {
                    showScreen(SCREENS.HOME);
                }, 1000);
            }
            
            // 更新删除按钮状态
            updateDeleteButtonState();
    }
} 

// 处理单个扫码
function handleSingleScan() {
    const processSelect = document.getElementById('process-select');
    const selectedProcess = processSelect.value;
    const selectedProcessText = processSelect.options[processSelect.selectedIndex].text;
    
    if (!selectedProcess) {
        showToast('请先选择工序', 'warning');
        return;
    }
    
    // 保存工序选择
    saveProcessSelection(selectedProcess);
    
    // 设置单个扫码工序提示
    const processDisplay = document.getElementById('single-scan-process');
    processDisplay.innerHTML = `<strong>当前工序:</strong> <span class="process-highlight">${selectedProcessText}</span>`;
    processDisplay.style.fontSize = '1.4rem'; // 确保字体足够大
    
    // 设置扫码状态
    scanState.processType = selectedProcess;
    scanState.isContinuous = false;
    
    // 显示单个扫码页面
    showScreen(SCREENS.SINGLE_SCAN);
    
    // 开始扫码
    startScan(selectedProcess, false);
}

// 处理连续扫码
function handleContinuousScan() {
    const processSelect = document.getElementById('process-select');
    const selectedProcess = processSelect.value;
    const selectedProcessText = processSelect.options[processSelect.selectedIndex].text;
    
    if (!selectedProcess) {
        showToast('请先选择工序', 'warning');
        return;
    }
    
    // 检查是否是允许的连续扫码工序（车止口和浸漆）
    if (selectedProcess !== 'stopper' && selectedProcess !== 'immersion') {
        showToast('只有车止口和浸漆工序支持连续扫码', 'error');
        return;
    }
    
    // 保存工序选择
    saveProcessSelection(selectedProcess);
    
    // 设置连续扫码工序提示
    const processDisplay = document.getElementById('continuous-scan-process');
    processDisplay.innerHTML = `<strong>当前工序:</strong> <span class="process-highlight">${selectedProcessText}</span>`;
    processDisplay.style.fontSize = '1.4rem'; // 确保字体足够大
    
    // 设置扫码状态
    scanState.processType = selectedProcess;
    scanState.isContinuous = true;
    
    // 显示连续扫码页面
    showScreen(SCREENS.CONTINUOUS_SCAN);
    
    // 自动聚焦多行输入框
    setTimeout(() => {
        const multilineInput = document.getElementById('manual-multiline-codes');
        if (multilineInput) multilineInput.focus();
    }, 300);
    
    // 绑定手动上传事件（防止重复绑定）
    setTimeout(() => {
        const uploadBtn = document.getElementById('manual-multiline-upload');
        if (uploadBtn && !uploadBtn.dataset.bound) {
            uploadBtn.addEventListener('click', function() {
                const textarea = document.getElementById('manual-multiline-codes');
                if (!textarea) return;
                // 统一去重与清洗
                const codes = dedupeOrdered(textarea.value.split('\n'));
                if (codes.length === 0) {
                    showToast('请输入至少一条产品编码', 'warning');
                    return;
                }
                const processCode = async (code) => {
                    await onScanSuccess(code, { result: { text: code } }, false);
                };
                (async () => {
                    for (const code of codes) {
                        await processCode(code);
                    }
                    showToast(`手动上传完成，共${codes.length}条`, 'success');
                    textarea.value = '';
                })();
            });
            uploadBtn.dataset.bound = '1';
        }
    }, 350);
    
    // 开始扫码
    startScan(selectedProcess, true);
}

// 浮动工序框功能已删除

// 添加扫码枪/手动录入按钮事件
function addManualScanEvent() {
    const manualScanBtn = document.getElementById('card-manual-scan');
    if (manualScanBtn) {
        manualScanBtn.addEventListener('click', function() {
            const processSelect = document.getElementById('process-select');
            const selectedProcess = processSelect.value;
            const selectedProcessText = processSelect.options[processSelect.selectedIndex].text;
            if (!selectedProcess) {
                showToast('请先选择工序', 'warning');
                return;
            }
            // 禁止嵌线使用扫码枪/手动录入
            if (selectedProcess === 'embedding') {
                showToast('嵌线工序不支持批量录入，请使用单次扫码', 'error');
                return;
            }
            if (selectedProcess !== 'stopper' && selectedProcess !== 'immersion') {
                showToast('只有车止口和浸漆工序支持手动录入', 'error');
                return;
            }
            // 显示工序提示
            const processDisplay = document.getElementById('manual-scan-process');
            processDisplay.innerHTML = `<strong>当前工序:</strong> <span class="process-highlight">${selectedProcessText}</span>`;
            processDisplay.style.fontSize = '1.4rem';
            // 切换界面
            showScreen(SCREENS.MANUAL_SCAN);
            // 自动聚焦
            setTimeout(() => {
                const textarea = document.getElementById('manual-scan-codes');
                if (textarea) textarea.focus();
            }, 200);
        });
    }
    // 返回按钮
    const backBtn = document.getElementById('manual-scan-back');
    if (backBtn) {
        backBtn.addEventListener('click', function() {
            showScreen(SCREENS.HOME);
        });
    }
    // 上传按钮
    const uploadBtn = document.getElementById('manual-scan-upload');
    if (uploadBtn && !uploadBtn.dataset.bound) {
        uploadBtn.addEventListener('click', async function() {
            const textarea = document.getElementById('manual-scan-codes');
            if (!textarea) return;
            const codes = textarea.value.split('\n').map(line => line.trim()).filter(line => line);
            if (codes.length === 0) {
                showToast('请输入至少一条产品编码', 'warning');
                return;
            }
            const processSelect = document.getElementById('process-select');
            const selectedProcess = processSelect.value;
            let successCount = 0, failCount = 0;
            for (const code of codes) {
                try {
                    const success = await updateProductProcess(code, selectedProcess, userState.fullName, false); // 关闭单条弹窗
                    if (success) successCount++; else failCount++;
                } catch (e) { failCount++; }
            }
            showToast(`上传完成，成功${successCount}条，失败${failCount}条`, 'success');
            textarea.value = '';
        });
        uploadBtn.dataset.bound = '1';
    }
}
// 页面初始化时调用
setTimeout(addManualScanEvent, 500);

// 在主页用户名下方显示今日工序数量
let refreshTodayProcessCountTimer = null;
async function refreshTodayProcessCount() {
    // 防抖：短时间内只允许一次
    if (refreshTodayProcessCountTimer) {
        clearTimeout(refreshTodayProcessCountTimer);
    }
    refreshTodayProcessCountTimer = setTimeout(async () => {
        // 彻底移除所有旧的统计
        document.querySelectorAll('#today-process-count').forEach(e => e.remove());
        const userFullnameElement = document.getElementById('user-fullname');
        if (!userFullnameElement) return;
        // 获取今日日期范围
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        // 获取数据
        let products = [];
        try {
            products = await getUserMonthlyProducts(userState.fullName, start, end);
            if (!products || !Array.isArray(products)) {
                products = [];
            }
        } catch (e) {
            console.error('获取今日工序数量失败:', e);
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
        products.forEach(product => {
            if (product['绕线员工'] === userState.fullName && isDateInRange(product['绕线时间'], start, end)) processCounts['绕线']++;
            if (product['嵌线员工'] === userState.fullName && isDateInRange(product['嵌线时间'], start, end)) processCounts['嵌线']++;
            if (product['接线员工'] === userState.fullName && isDateInRange(product['接线时间'], start, end)) processCounts['接线']++;
            if (product['压装员工'] === userState.fullName && isDateInRange(product['压装时间'], start, end)) processCounts['压装']++;
            if (product['车止口员工'] === userState.fullName && isDateInRange(product['车止口时间'], start, end)) processCounts['车止口']++;
            if (product['浸漆员工'] === userState.fullName && isDateInRange(product['浸漆时间'], start, end)) processCounts['浸漆']++;
        });
        // 生成统计文本
        let html = '<div id="today-process-count" style="font-size:12px;color:#888;margin-top:2px;">';
        let has = false;
        Object.keys(processCounts).forEach(key => {
            if (processCounts[key] > 0) {
                html += `${key}<span style=\"color:#007bff;margin:0 2px;\">${processCounts[key]}</span> `;
                has = true;
            }
        });
        if (!has) html += '无';
        html += '</div>';
        // 插入到用户名下方
        userFullnameElement.insertAdjacentHTML('afterend', html);
    }, 100);
}

// =============================================================================
// 人脸识别登录回调
// =============================================================================

/**
 * 人脸识别登录成功的回调函数
 * 由face-recognition.js模块调用
 */
window.onFaceLoginSuccess = function(fullName) {
    console.log('====================================');
    console.log('🎉 onFaceLoginSuccess 被调用');
    console.log('用户名称:', fullName);
    console.log('====================================');
    
    try {
        // 设置用户状态
        console.log('1. 设置用户状态...');
        userState.fullName = fullName;
        console.log('   ✅ 用户状态已设置:', userState.fullName);
        
        // 更新UI显示
        console.log('2. 更新UI显示...');
        updateUserDisplay();
        console.log('   ✅ UI已更新');
        
        // 加载保存的工序设置
        console.log('3. 加载工序设置...');
        loadSavedProcessSelection();
        console.log('   ✅ 工序设置已加载');
        
        // 导航到主页
        console.log('4. 导航到主页...');
        console.log('   SCREENS.HOME:', SCREENS.HOME);
        navigateToHome();
        console.log('   ✅ 已调用navigateToHome');
        
        // 显示欢迎提示
        console.log('5. 显示欢迎提示...');
        showToast(`欢迎回来，${fullName}！`, 'success');
        console.log('   ✅ 欢迎提示已显示');
        
        console.log('====================================');
        console.log('✅ onFaceLoginSuccess 执行完成');
        console.log('====================================');
    } catch (error) {
        console.error('❌ onFaceLoginSuccess 执行出错:', error);
        console.error('错误堆栈:', error.stack);
        // 如果出错，至少尝试刷新页面
        alert('登录成功！正在为您加载系统...');
        location.reload();
    }
};

/**
 * 提供一个全局的showToast函数供face-recognition.js使用
 */
if (typeof showToast === 'function') {
    window.showToast = showToast;
} else {
    window.showToast = function(message, type) {
        alert(message);
    };
}

// ==================== 冲床型号扫描功能 ====================

let stampingCurrentDevice = '';
let stampingScanningFor = '';
let stampingHtml5QrCode = null;
let stampingScannedModel = null;

function handleStampingScan() {
    if (!userState.fullName) {
        showToast('请先登录', 'warning');
        return;
    }
    
    // 检查bootstrap是否已加载
    if (typeof bootstrap === 'undefined') {
        alert('系统正在加载，请稍后再试');
        return;
    }
    
    const modalEl = document.getElementById('stamping-scan-modal');
    if (!modalEl) {
        alert('扫码功能未加载，请刷新页面');
        return;
    }
    
    // 重置模态框状态（修复bug）
    resetStampingModal();
    
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
    
    document.getElementById('stamping-current-employee').textContent = userState.fullName;
    
    const lastDevice = localStorage.getItem('lastStampingDevice');
    if (lastDevice) {
        document.getElementById('stamping-last-device').style.display = 'block';
        document.getElementById('stamping-last-device-name').textContent = lastDevice;
    }
    
    document.getElementById('stamping-scan-device-btn').onclick = startScanStampingDevice;
    
    // 型号选择下拉列表事件绑定
    document.getElementById('stamping-model-dropdown').onchange = onStampingModelDropdownChange;
    document.getElementById('stamping-confirm-model-btn').onclick = onStampingModelConfirm;
}

function useLastStampingDevice() {
    const lastDevice = localStorage.getItem('lastStampingDevice');
    if (lastDevice) {
        onStampingDeviceScanned(lastDevice);
    }
}

function startScanStampingDevice() {
    stampingScanningFor = 'device';
    document.getElementById('stamping-qr-reader').style.display = 'block';
    document.getElementById('stamping-scan-device-btn').style.display = 'none';
    
    stampingHtml5QrCode = new Html5Qrcode("stamping-qr-reader");
    stampingHtml5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        onStampingScanSuccess
    ).catch(err => {
        showToast('启动摄像头失败', 'error');
        document.getElementById('stamping-scan-device-btn').style.display = 'block';
    });
}

// 加载型号列表到下拉框
async function loadStampingModelList() {
    try {
        const response = await fetch(`/api/stamping/models`);
        const result = await response.json();
        
        const models = result.data || [];
        const dropdown = document.getElementById('stamping-model-dropdown');
        
        // 清空现有选项
        dropdown.innerHTML = '<option value="">请选择型号...</option>';
        
        // 添加有效的型号选项
        models.filter(m => m.is_active).forEach(model => {
            const option = document.createElement('option');
            option.value = model.model_name;
            option.textContent = `${model.model_name} (${model.sheets_per_product}片/台)`;
            option.dataset.sheetsPerProduct = model.sheets_per_product;
            dropdown.appendChild(option);
        });
        
        console.log(`已加载 ${models.length} 个型号到下拉列表`);
        
    } catch (error) {
        console.error('加载型号列表失败:', error);
        showToast('加载型号列表失败', 'error');
    }
}

// 型号下拉列表选择变化处理
function onStampingModelDropdownChange() {
    const dropdown = document.getElementById('stamping-model-dropdown');
    const confirmBtn = document.getElementById('stamping-confirm-model-btn');
    
    if (dropdown.value) {
        confirmBtn.disabled = false;
        
        // 更新选中的型号信息
        const selectedOption = dropdown.options[dropdown.selectedIndex];
        stampingScannedModel = {
            model_name: dropdown.value,
            sheets_per_product: parseInt(selectedOption.dataset.sheetsPerProduct),
            is_active: true
        };
    } else {
        confirmBtn.disabled = true;
        stampingScannedModel = null;
    }
}

// 确认型号选择
async function onStampingModelConfirm() {
    if (!stampingScannedModel) {
        showToast('请先选择型号', 'warning');
        return;
    }
    
    if (confirm(`型号：${stampingScannedModel.model_name}\n配置：${stampingScannedModel.sheets_per_product}片/台\n\n确认绑定此型号？`)) {
        await confirmStampingBinding();
    }
}

function onStampingScanSuccess(decodedText) {
    stampingHtml5QrCode.stop();
    document.getElementById('stamping-qr-reader').style.display = 'none';
    
    if (stampingScanningFor === 'device') {
        onStampingDeviceScanned(decodedText);
    } else if (stampingScanningFor === 'model') {
        onStampingModelScanned(decodedText);
    }
}

function onStampingDeviceScanned(deviceId) {
    // 验证设备ID格式（应该以STAMP_开头）
    if (!deviceId.startsWith('STAMP_')) {
        showToast('设备ID格式错误，应以STAMP_开头', 'error');
        document.getElementById('stamping-scan-device-btn').style.display = 'block';
        return;
    }
    
    stampingCurrentDevice = deviceId;
    localStorage.setItem('lastStampingDevice', deviceId);
    
    // 隐藏上次设备按钮
    document.getElementById('stamping-last-device').style.display = 'none';
    
    // 更新显示
    document.getElementById('stamping-info-device').textContent = deviceId;
    document.getElementById('stamping-current-info').style.display = 'block';
    document.getElementById('stamping-scan-device-btn').style.display = 'none';
    document.getElementById('stamping-model-selection').style.display = 'block';
    
    loadStampingDeviceInfo(deviceId);
    loadStampingModelList(); // 加载型号列表到下拉框
    showToast(`设备 ${deviceId} 选择成功，请选择型号`, 'success');
}

async function onStampingModelScanned(modelName) {
    try {
        const response = await fetch(`/api/stamping/models`);
        const result = await response.json();
        
        // 查找匹配的型号
        const models = result.data || [];
        stampingScannedModel = models.find(m => m.model_name === modelName);
        
        if (stampingScannedModel && stampingScannedModel.is_active) {
            
            if (confirm(`型号：${stampingScannedModel.model_name}\n配置：${stampingScannedModel.sheets_per_product}片/台\n\n确认绑定此型号？`)) {
                await confirmStampingBinding();
            } else {
                document.getElementById('stamping-scan-model-btn').style.display = 'block';
            }
        } else {
            showToast(`型号 ${modelName} 不存在或已禁用`, 'error');
            document.getElementById('stamping-scan-model-btn').style.display = 'block';
        }
    } catch (error) {
        showToast('查询型号失败', 'error');
        document.getElementById('stamping-scan-model-btn').style.display = 'block';
    }
}

async function confirmStampingBinding() {
    try {
        const response = await fetch(`/api/stamping/device/${stampingCurrentDevice}/bind-model`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                model_name: stampingScannedModel.model_name,
                employee_name: userState.fullName
            })
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            let message = '绑定成功！';
            if (result.previous_employee) {
                message += `\n已推送交接通知给：${result.previous_employee}`;
            }
            if (result.unbound_count > 0) {
                message += `\n未绑定的${result.unbound_count}冲次已记录到您的台账`;
            }
            showToast(message, 'success');
            
            loadStampingDeviceInfo(stampingCurrentDevice);
            
            // 立即关闭模态框并清理backdrop
            setTimeout(() => {
                closeStampingModal();
            }, 1500);
        } else {
            showToast('绑定失败：' + result.message, 'error');
        }
    } catch (error) {
        showToast('绑定失败', 'error');
    }
}

async function loadStampingDeviceInfo(deviceId) {
    try {
        const response = await fetch(`/api/stamping/device/${deviceId}/today-models`);
        const data = await response.json();
        
        document.getElementById('stamping-info-device').textContent = data.device_id;
        document.getElementById('stamping-info-model').textContent = data.current_model || '未选择';
        
        if (data.models && data.models.length > 0) {
            const currentModel = data.models.find(m => m.model_name === data.current_model) || data.models[0];
            document.getElementById('stamping-info-sheets').textContent = currentModel.sheets_per_product + ' 片/台';
            document.getElementById('stamping-info-completed').textContent = data.today_summary.total_completed + ' 台';
            document.getElementById('stamping-info-progress').textContent = 
                `${currentModel.current_sheets}/${currentModel.sheets_per_product} 片`;
            
            const progress = currentModel.progress_percent || 0;
            document.getElementById('stamping-progress-bar').style.width = progress + '%';
            document.getElementById('stamping-progress-bar').textContent = progress.toFixed(1) + '%';
        }
    } catch (error) {
        console.error('加载设备信息失败:', error);
    }
}

function resetStampingModal() {
    // 重置所有按钮和显示状态
    document.getElementById('stamping-scan-device-btn').style.display = 'block';
    document.getElementById('stamping-model-selection').style.display = 'none';
    document.getElementById('stamping-qr-reader').style.display = 'none';
    document.getElementById('stamping-current-info').style.display = 'none';
    document.getElementById('stamping-last-device').style.display = 'none';
    
    // 重置型号选择下拉列表
    const dropdown = document.getElementById('stamping-model-dropdown');
    const confirmBtn = document.getElementById('stamping-confirm-model-btn');
    dropdown.value = '';
    confirmBtn.disabled = true;
    
    // 清空扫码器
    if (stampingHtml5QrCode) {
        try {
            stampingHtml5QrCode.stop();
        } catch (e) {
            console.log('扫码器已停止');
        }
        stampingHtml5QrCode = null;
    }
    
    // 重置全局变量
    stampingCurrentDevice = '';
    stampingScannedModel = null;
}

function closeStampingModal() {
    // 停止扫码
    if (stampingHtml5QrCode) {
        try {
            stampingHtml5QrCode.stop();
        } catch (e) {
            console.log('扫码器已停止');
        }
        stampingHtml5QrCode = null;
    }
    
    // 关闭模态框
    const modalEl = document.getElementById('stamping-scan-modal');
    const modalInstance = bootstrap.Modal.getInstance(modalEl);
    if (modalInstance) {
        modalInstance.hide();
    }
    
    // 强制清理backdrop和恢复页面状态
    setTimeout(() => {
        // 移除所有backdrop
        document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
        // 移除modal-open类
        document.body.classList.remove('modal-open');
        // 恢复滚动
        document.body.style.overflow = 'auto';
        document.body.style.overflowX = 'hidden';
        document.body.style.paddingRight = '0';
        // 恢复html滚动
        document.documentElement.style.overflow = 'auto';
    }, 100);
}

// ==================== 冲床台账查询功能 ====================

let stampingLedgerData = [];

async function handleStampingLedger() {
    if (!userState.fullName) {
        showToast('请先登录', 'warning');
        return;
    }
    
    // 检查是否是组长
    const isLeader = await checkIfLeader(userState.fullName);
    
    const modal = new bootstrap.Modal(document.getElementById('stamping-ledger-modal'));
    modal.show();
    
    // 设置默认日期为本月
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    document.getElementById('ledger-start-date').value = firstDay.toISOString().split('T')[0];
    document.getElementById('ledger-end-date').value = today.toISOString().split('T')[0];
    
    // 如果不是组长，默认填入当前员工姓名并禁用修改
    const employeeInput = document.getElementById('ledger-employee');
    if (!isLeader) {
        employeeInput.value = userState.fullName;
        employeeInput.readOnly = true;
        employeeInput.classList.add('bg-light');
    } else {
        employeeInput.value = '';
        employeeInput.readOnly = false;
        employeeInput.classList.remove('bg-light');
    }
}

async function checkIfLeader(employeeName) {
    try {
        const response = await fetch(`${API_BASE_URL}/group-leaders?leader_name=${encodeURIComponent(employeeName)}`);
        if (!response.ok) return false;
        const data = await response.json();
        return data && data.length > 0;
    } catch (error) {
        return false;
    }
}

// 加载型号选项
let availableModels = [];

async function loadModelOptions() {
    const startDate = document.getElementById('ledger-start-date').value;
    const endDate = document.getElementById('ledger-end-date').value;
    const employee = document.getElementById('ledger-employee').value.trim();
    
    if (!startDate || !endDate) {
        return;
    }
    
    try {
        // 构建查询参数
        const params = new URLSearchParams();
        if (employee) params.append('employee_name', employee);
        params.append('start_date', startDate);
        params.append('end_date', endDate);
        params.append('get_models_only', 'true'); // 只获取型号列表
        
        const response = await fetch(`/api/stamping/ledger/models?${params}`);
        const data = await response.json();
        
        if (data.status === 'success' && data.models) {
            availableModels = data.models;
            updateModelDatalist(data.models);
        }
    } catch (error) {
        console.error('加载型号失败:', error);
    }
}

function updateModelDatalist(models) {
    const select = document.getElementById('ledger-model');
    const hint = document.getElementById('model-count-hint');
    
    if (!select) return;
    
    // 清空现有选项
    select.innerHTML = '';
    
    if (models && models.length > 0) {
        // 添加选项
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model;
            select.appendChild(option);
        });
        
        // 更新提示
        if (hint) {
            hint.innerHTML = `<i class="bi bi-check-circle"></i> 共 ${models.length} 个型号可选，按住Ctrl/Cmd可多选`;
            hint.style.color = '#28a745';
        }
    } else {
        const option = document.createElement('option');
        option.value = '';
        option.disabled = true;
        option.textContent = '该时间范围内无型号数据';
        select.appendChild(option);
        
        if (hint) {
            hint.innerHTML = '<i class="bi bi-info-circle"></i> 请选择有数据的日期范围';
            hint.style.color = '#6c757d';
        }
    }
}

// 监听日期和员工变化，自动加载型号
function initStampingLedgerListeners() {
    const startDateInput = document.getElementById('ledger-start-date');
    const endDateInput = document.getElementById('ledger-end-date');
    const employeeInput = document.getElementById('ledger-employee');
    
    if (startDateInput) {
        startDateInput.addEventListener('change', loadModelOptions);
    }
    if (endDateInput) {
        endDateInput.addEventListener('change', loadModelOptions);
    }
    if (employeeInput) {
        employeeInput.addEventListener('input', debounce(loadModelOptions, 500));
    }
}

// 防抖函数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 在页面加载时初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStampingLedgerListeners);
} else {
    initStampingLedgerListeners();
}

async function queryStampingLedger() {
    const employee = document.getElementById('ledger-employee').value.trim();
    const modelSelect = document.getElementById('ledger-model');
    const selectedModels = Array.from(modelSelect.selectedOptions).map(opt => opt.value).filter(v => v);
    const startDate = document.getElementById('ledger-start-date').value;
    const endDate = document.getElementById('ledger-end-date').value;
    
    try {
        showToast('查询中...', 'info');
        
        // 构建查询参数
        const params = new URLSearchParams();
        if (employee) params.append('employee_name', employee);
        // 如果选择了型号，传递所有选中的型号
        if (selectedModels.length > 0) {
            selectedModels.forEach(model => {
                params.append('model_names', model);
            });
        }
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);
        
        const response = await fetch(`/api/stamping/ledger/query?${params}`);
        const data = await response.json();
        
        if (data.status === 'success') {
            stampingLedgerData = data.records;
            displayStampingLedger(data);
            showToast(`查询成功，共 ${data.count} 条记录`, 'success');
        } else {
            showToast('查询失败', 'error');
        }
    } catch (error) {
        showToast('查询失败：' + error.message, 'error');
    }
}

function displayStampingLedger(data) {
    const resultsDiv = document.getElementById('ledger-results');
    const summaryDiv = document.getElementById('ledger-summary');
    
    if (data.records.length === 0) {
        resultsDiv.innerHTML = '<p class="text-center text-muted">没有找到符合条件的记录</p>';
        summaryDiv.style.display = 'none';
        return;
    }
    
    // 滚动到顶部
    resultsDiv.scrollTop = 0;
    
    // 计算统计数据
    const uniqueDates = new Set(data.records.map(r => r.work_date));
    const dayCount = uniqueDates.size;
    const avgDaily = dayCount > 0 ? (data.summary.total_completed / dayCount).toFixed(2) : 0;
    
    // 显示汇总
    document.getElementById('ledger-count').textContent = data.count;
    document.getElementById('ledger-total-sheets').textContent = data.summary.total_sheets;
    document.getElementById('ledger-total-completed').textContent = data.summary.total_completed + ' 台';
    document.getElementById('ledger-avg-daily').textContent = avgDaily + ' 台/天';
    summaryDiv.style.display = 'block';
    
    // 显示表格
    let html = `
        <table class="table table-striped table-hover">
            <thead>
                <tr>
                    <th>序号</th>
                    <th>日期</th>
                    <th>员工</th>
                    <th>设备</th>
                    <th>型号</th>
                    <th>冲压片数</th>
                    <th>完成台数</th>
                    <th>当前进度</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    data.records.forEach((record, index) => {
        html += `
            <tr>
                <td>${index + 1}</td>
                <td>${record.work_date}</td>
                <td>${record.employee_name}</td>
                <td>${record.device_id}</td>
                <td>${record.model_name}</td>
                <td>${record.total_sheets}</td>
                <td class="text-success"><strong>${record.completed_products}</strong></td>
                <td>${record.current_sheets} 片</td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    resultsDiv.innerHTML = html;
}

function exportStampingLedger() {
    if (!stampingLedgerData || stampingLedgerData.length === 0) {
        showToast('没有数据可导出', 'warning');
        return;
    }
    
    if (typeof XLSX === 'undefined') {
        showToast('Excel库未加载', 'error');
        return;
    }
    
    const data = [[
        '序号', '日期', '员工', '设备', '型号', 
        '冲压片数', '完成台数', '当前进度'
    ]];
    
    stampingLedgerData.forEach((record, index) => {
        data.push([
            index + 1,
            record.work_date,
            record.employee_name,
            record.device_id,
            record.model_name,
            record.total_sheets,
            record.completed_products,
            record.current_sheets + ' 片'
        ]);
    });
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, '冲床台账');
    
    const fileName = `冲床台账_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    showToast('Excel导出成功', 'success');
}

async function handoverStampingTask() {
    if (!stampingCurrentDevice || !userState.fullName) {
        showToast('请先绑定设备和型号', 'warning');
        return;
    }
    
    if (!confirm('确认交接任务？\n您的工作数据将被保存，设备绑定将被清除。')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/stamping/device/${stampingCurrentDevice}/handover`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                employee_name: userState.fullName
            })
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            let summary = '交接成功！\n\n您的工作数据：\n';
            result.work_summary.models.forEach(m => {
                summary += `\n${m.model_name}: ${m.total_sheets}片, ${m.completed_products}台`;
            });
            summary += `\n\n总完成：${result.work_summary.total_completed}台`;
            
            alert(summary);
            localStorage.removeItem('lastStampingDevice');
            
            const modalEl = document.getElementById('stamping-scan-modal');
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            if (modalInstance) {
                modalInstance.hide();
            }
            // 手动移除backdrop
            setTimeout(() => {
                document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
                document.body.classList.remove('modal-open');
                document.body.style.overflow = '';
                document.body.style.paddingRight = '';
            }, 300);
        } else {
            showToast('交接失败：' + result.message, 'error');
        }
    } catch (error) {
        showToast('交接失败', 'error');
    }
}
