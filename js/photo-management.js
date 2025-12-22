/**
 * 拍照打卡照片管理模块
 * 支持查看、搜索、删除员工打卡照片
 */

class PhotoManagement {
    constructor() {
        this.currentPage = 1;
        this.pageSize = 20;
        this.totalPages = 1;
        this.currentFilter = {
            employee: '',
            date: '',
            status: 'all'
        };
        
        this.init();
    }
    
    init() {
        console.log('📸 照片管理模块已加载');
        this.bindEvents();
    }
    
    bindEvents() {
        // 监听照片管理按钮点击
        document.addEventListener('click', (e) => {
            if (e.target.matches('.photo-management-btn') || e.target.closest('.photo-management-btn')) {
                e.preventDefault();
                this.showPhotoManagement();
            }
        });
    }
    
    /**
     * 显示照片管理界面
     */
    async showPhotoManagement() {
        try {
            const modal = this.createManagementModal();
            document.body.appendChild(modal);
            
            // 显示模态框
            setTimeout(() => {
                modal.classList.add('show');
            }, 100);
            
            // 加载照片列表
            await this.loadPhotoList();
            
        } catch (error) {
            console.error('显示照片管理界面失败:', error);
            this.showToast('加载照片管理界面失败', 'error');
        }
    }
    
    /**
     * 创建照片管理模态框
     */
    createManagementModal() {
        const modal = document.createElement('div');
        modal.className = 'photo-management-modal';
        modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">
                        <i class="bi bi-images"></i>
                        打卡照片管理
                    </h5>
                    <button type="button" class="btn-close" onclick="this.closest('.photo-management-modal').remove()">
                        <i class="bi bi-x-lg"></i>
                    </button>
                </div>
                
                <div class="modal-body">
                    <!-- 筛选栏 -->
                    <div class="filter-section">
                        <div class="row g-2">
                            <div class="col-md-3">
                                <label class="form-label">员工姓名</label>
                                <input type="text" class="form-control" id="employee-filter" placeholder="搜索员工姓名">
                            </div>
                            <div class="col-md-3">
                                <label class="form-label">日期</label>
                                <input type="date" class="form-control" id="date-filter">
                            </div>
                            <div class="col-md-3">
                                <label class="form-label">状态</label>
                                <select class="form-select" id="status-filter">
                                    <option value="all">全部</option>
                                    <option value="success">成功</option>
                                    <option value="failed">失败</option>
                                </select>
                            </div>
                            <div class="col-md-3">
                                <label class="form-label">&nbsp;</label>
                                <div class="d-flex gap-2">
                                    <button class="btn btn-primary" id="search-btn">
                                        <i class="bi bi-search"></i> 搜索
                                    </button>
                                    <button class="btn btn-outline-secondary" id="reset-btn">
                                        <i class="bi bi-arrow-counterclockwise"></i> 重置
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 统计信息 -->
                    <div class="stats-section">
                        <div class="row text-center">
                            <div class="col-3">
                                <div class="stat-card">
                                    <div class="stat-number" id="total-photos">0</div>
                                    <div class="stat-label">总照片数</div>
                                </div>
                            </div>
                            <div class="col-3">
                                <div class="stat-card">
                                    <div class="stat-number" id="today-photos">0</div>
                                    <div class="stat-label">今日照片</div>
                                </div>
                            </div>
                            <div class="col-3">
                                <div class="stat-card">
                                    <div class="stat-number" id="storage-used">0MB</div>
                                    <div class="stat-label">存储占用</div>
                                </div>
                            </div>
                            <div class="col-3">
                                <div class="stat-card">
                                    <div class="stat-number" id="active-employees">0</div>
                                    <div class="stat-label">活跃员工</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 照片列表 -->
                    <div class="photos-section">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <h6>照片列表</h6>
                            <div class="view-controls">
                                <button class="btn btn-sm btn-outline-primary" id="grid-view-btn">
                                    <i class="bi bi-grid-3x3-gap"></i> 网格
                                </button>
                                <button class="btn btn-sm btn-outline-primary active" id="list-view-btn">
                                    <i class="bi bi-list-ul"></i> 列表
                                </button>
                            </div>
                        </div>
                        
                        <!-- 加载指示器 -->
                        <div class="loading-indicator text-center d-none" id="loading-indicator">
                            <div class="spinner-border" role="status">
                                <span class="visually-hidden">加载中...</span>
                            </div>
                            <p class="mt-2">加载照片中...</p>
                        </div>
                        
                        <!-- 照片列表容器 -->
                        <div class="photos-container" id="photos-container">
                            <!-- 照片将在这里动态加载 -->
                        </div>
                        
                        <!-- 分页 -->
                        <div class="pagination-section">
                            <nav>
                                <ul class="pagination justify-content-center" id="pagination">
                                    <!-- 分页按钮将在这里动态生成 -->
                                </ul>
                            </nav>
                        </div>
                    </div>
                </div>
                
                <div class="modal-footer">
                    <button type="button" class="btn btn-outline-danger" id="bulk-delete-btn">
                        <i class="bi bi-trash"></i> 批量删除
                    </button>
                    <button type="button" class="btn btn-outline-primary" id="export-btn">
                        <i class="bi bi-download"></i> 导出数据
                    </button>
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.photo-management-modal').remove()">
                        关闭
                    </button>
                </div>
            </div>
        `;
        
        // 绑定事件
        this.bindManagementEvents(modal);
        
        // 点击背景关闭
        const backdrop = modal.querySelector('.modal-backdrop');
        backdrop.addEventListener('click', () => {
            modal.remove();
        });
        
        return modal;
    }
    
    /**
     * 绑定照片管理事件
     */
    bindManagementEvents(modal) {
        const searchBtn = modal.querySelector('#search-btn');
        const resetBtn = modal.querySelector('#reset-btn');
        const gridViewBtn = modal.querySelector('#grid-view-btn');
        const listViewBtn = modal.querySelector('#list-view-btn');
        const bulkDeleteBtn = modal.querySelector('#bulk-delete-btn');
        const exportBtn = modal.querySelector('#export-btn');
        
        // 搜索按钮
        searchBtn?.addEventListener('click', () => {
            this.applyFilter(modal);
        });
        
        // 重置按钮
        resetBtn?.addEventListener('click', () => {
            this.resetFilter(modal);
        });
        
        // 视图切换
        gridViewBtn?.addEventListener('click', () => {
            this.switchView('grid', modal);
        });
        
        listViewBtn?.addEventListener('click', () => {
            this.switchView('list', modal);
        });
        
        // 批量删除
        bulkDeleteBtn?.addEventListener('click', () => {
            this.bulkDeletePhotos(modal);
        });
        
        // 导出数据
        exportBtn?.addEventListener('click', () => {
            this.exportPhotoData(modal);
        });
        
        // 回车搜索
        const employeeFilter = modal.querySelector('#employee-filter');
        employeeFilter?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.applyFilter(modal);
            }
        });
    }
    
    /**
     * 加载照片列表
     */
    async loadPhotoList() {
        try {
            const modal = document.querySelector('.photo-management-modal');
            const loadingIndicator = modal.querySelector('#loading-indicator');
            const photosContainer = modal.querySelector('#photos-container');
            
            // 显示加载指示器
            loadingIndicator.classList.remove('d-none');
            photosContainer.innerHTML = '';
            
            // 模拟API调用（实际项目中需要调用真实API）
            await this.simulatePhotoAPI();
            
            // 隐藏加载指示器
            loadingIndicator.classList.add('d-none');
            
            // 渲染照片列表
            this.renderPhotoList();
            
            // 更新统计信息
            this.updateStats();
            
        } catch (error) {
            console.error('加载照片列表失败:', error);
            this.showToast('加载照片列表失败', 'error');
        }
    }
    
    /**
     * 模拟照片数据API
     */
    async simulatePhotoAPI() {
        // 模拟网络延迟
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 模拟照片数据
        this.mockPhotos = [
            {
                id: 1,
                employee_name: '张三',
                timestamp: '2025-12-22 08:30:15',
                filename: 'checkin_张三_20251222_083015_abc12345.jpg',
                status: 'success',
                file_size: '1.2MB',
                location: '距离公司 50m',
                thumbnail_url: '/uploads/checkin_photos/thumbnails/checkin_张三_20251222_083015_abc12345.jpg',
                photo_url: '/uploads/checkin_photos/compressed/checkin_张三_20251222_083015_abc12345.jpg'
            },
            {
                id: 2,
                employee_name: '李四',
                timestamp: '2025-12-22 08:45:22',
                filename: 'checkin_李四_20251222_084522_def67890.jpg',
                status: 'success',
                file_size: '0.8MB',
                location: '距离公司 120m',
                thumbnail_url: '/uploads/checkin_photos/thumbnails/checkin_李四_20251222_084522_def67890.jpg',
                photo_url: '/uploads/checkin_photos/compressed/checkin_李四_20251222_084522_def67890.jpg'
            },
            {
                id: 3,
                employee_name: '王五',
                timestamp: '2025-12-22 17:30:45',
                filename: 'checkin_王五_20251222_173045_ghi11111.jpg',
                status: 'failed',
                file_size: '0MB',
                location: '定位失败',
                error_message: '距离公司太远'
            }
        ];
    }
    
    /**
     * 渲染照片列表
     */
    renderPhotoList() {
        const modal = document.querySelector('.photo-management-modal');
        const container = modal.querySelector('#photos-container');
        const viewMode = modal.querySelector('#list-view-btn').classList.contains('active') ? 'list' : 'grid';
        
        if (!this.mockPhotos || this.mockPhotos.length === 0) {
            container.innerHTML = `
                <div class="empty-state text-center py-4">
                    <i class="bi bi-camera-x text-muted" style="font-size: 3rem;"></i>
                    <h6 class="text-muted mt-2">暂无打卡照片</h6>
                    <p class="text-muted small">还没有员工上传打卡照片</p>
                </div>
            `;
            return;
        }
        
        if (viewMode === 'list') {
            this.renderListView(container);
        } else {
            this.renderGridView(container);
        }
        
        this.renderPagination();
    }
    
    /**
     * 渲染列表视图
     */
    renderListView(container) {
        const html = `
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead>
                        <tr>
                            <th width="40">
                                <input type="checkbox" class="form-check-input" id="select-all">
                            </th>
                            <th>员工</th>
                            <th>时间</th>
                            <th>状态</th>
                            <th>大小</th>
                            <th>位置</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.mockPhotos.map(photo => `
                            <tr data-photo-id="${photo.id}">
                                <td>
                                    <input type="checkbox" class="form-check-input photo-checkbox" value="${photo.id}">
                                </td>
                                <td>
                                    <div class="d-flex align-items-center">
                                        <div class="photo-thumbnail me-2">
                                            ${photo.status === 'success' ? 
                                                `<img src="${photo.thumbnail_url}" alt="打卡照片" width="40" height="40" style="object-fit: cover; border-radius: 4px;">` :
                                                `<div class="thumbnail-placeholder"><i class="bi bi-image"></i></div>`
                                            }
                                        </div>
                                        <div>
                                            <div class="fw-bold">${photo.employee_name}</div>
                                            <small class="text-muted">${photo.filename}</small>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <div>${photo.timestamp.split(' ')[0]}</div>
                                    <small class="text-muted">${photo.timestamp.split(' ')[1]}</small>
                                </td>
                                <td>
                                    <span class="badge ${photo.status === 'success' ? 'bg-success' : 'bg-danger'}">
                                        ${photo.status === 'success' ? '成功' : '失败'}
                                    </span>
                                </td>
                                <td>${photo.file_size}</td>
                                <td>
                                    <small class="text-muted">${photo.location}</small>
                                    ${photo.error_message ? `<br><small class="text-danger">${photo.error_message}</small>` : ''}
                                </td>
                                <td>
                                    <div class="btn-group btn-group-sm">
                                        ${photo.status === 'success' ? 
                                            `<button class="btn btn-outline-primary" onclick="window.photoManagement.viewPhoto('${photo.photo_url}', '${photo.employee_name}')">
                                                <i class="bi bi-eye"></i>
                                            </button>
                                            <button class="btn btn-outline-secondary" onclick="window.photoManagement.downloadPhoto('${photo.photo_url}', '${photo.filename}')">
                                                <i class="bi bi-download"></i>
                                            </button>` : ''
                                        }
                                        <button class="btn btn-outline-danger" onclick="window.photoManagement.deletePhoto(${photo.id}, '${photo.employee_name}')">
                                            <i class="bi bi-trash"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
        container.innerHTML = html;
        
        // 绑定全选事件
        const selectAll = container.querySelector('#select-all');
        selectAll?.addEventListener('change', (e) => {
            const checkboxes = container.querySelectorAll('.photo-checkbox');
            checkboxes.forEach(cb => cb.checked = e.target.checked);
        });
    }
    
    /**
     * 渲染网格视图
     */
    renderGridView(container) {
        const html = `
            <div class="row g-3">
                ${this.mockPhotos.map(photo => `
                    <div class="col-lg-3 col-md-4 col-6">
                        <div class="photo-card" data-photo-id="${photo.id}">
                            <div class="photo-card-header">
                                <input type="checkbox" class="form-check-input photo-checkbox" value="${photo.id}">
                                <span class="badge ${photo.status === 'success' ? 'bg-success' : 'bg-danger'}">
                                    ${photo.status === 'success' ? '成功' : '失败'}
                                </span>
                            </div>
                            <div class="photo-card-image">
                                ${photo.status === 'success' ? 
                                    `<img src="${photo.thumbnail_url}" alt="打卡照片" onclick="window.photoManagement.viewPhoto('${photo.photo_url}', '${photo.employee_name}')">` :
                                    `<div class="image-placeholder">
                                        <i class="bi bi-image"></i>
                                        <p>上传失败</p>
                                    </div>`
                                }
                            </div>
                            <div class="photo-card-body">
                                <h6>${photo.employee_name}</h6>
                                <p class="text-muted small">${photo.timestamp}</p>
                                <div class="d-flex justify-content-between">
                                    <small class="text-muted">${photo.file_size}</small>
                                    <div class="btn-group btn-group-sm">
                                        ${photo.status === 'success' ? 
                                            `<button class="btn btn-outline-primary btn-sm" onclick="window.photoManagement.downloadPhoto('${photo.photo_url}', '${photo.filename}')">
                                                <i class="bi bi-download"></i>
                                            </button>` : ''
                                        }
                                        <button class="btn btn-outline-danger btn-sm" onclick="window.photoManagement.deletePhoto(${photo.id}, '${photo.employee_name}')">
                                            <i class="bi bi-trash"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        container.innerHTML = html;
    }
    
    /**
     * 更新统计信息
     */
    updateStats() {
        const modal = document.querySelector('.photo-management-modal');
        
        const totalPhotos = this.mockPhotos.length;
        const todayPhotos = this.mockPhotos.filter(p => p.timestamp.startsWith('2025-12-22')).length;
        const storageUsed = this.mockPhotos.reduce((total, p) => {
            const size = parseFloat(p.file_size.replace('MB', '')) || 0;
            return total + size;
        }, 0);
        const activeEmployees = new Set(this.mockPhotos.map(p => p.employee_name)).size;
        
        modal.querySelector('#total-photos').textContent = totalPhotos;
        modal.querySelector('#today-photos').textContent = todayPhotos;
        modal.querySelector('#storage-used').textContent = `${storageUsed.toFixed(1)}MB`;
        modal.querySelector('#active-employees').textContent = activeEmployees;
    }
    
    /**
     * 查看照片
     */
    viewPhoto(photoUrl, employeeName) {
        const viewer = document.createElement('div');
        viewer.className = 'photo-viewer-modal';
        viewer.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="photo-viewer-content">
                <div class="photo-viewer-header">
                    <h5>${employeeName} 的打卡照片</h5>
                    <button class="btn-close" onclick="this.closest('.photo-viewer-modal').remove()">
                        <i class="bi bi-x-lg"></i>
                    </button>
                </div>
                <div class="photo-viewer-body">
                    <img src="${photoUrl}" alt="打卡照片" style="max-width: 100%; max-height: 80vh; object-fit: contain;">
                </div>
            </div>
        `;
        
        document.body.appendChild(viewer);
        setTimeout(() => viewer.classList.add('show'), 100);
        
        // 点击背景关闭
        viewer.querySelector('.modal-backdrop').addEventListener('click', () => {
            viewer.remove();
        });
    }
    
    /**
     * 下载照片
     */
    downloadPhoto(photoUrl, filename) {
        const link = document.createElement('a');
        link.href = photoUrl;
        link.download = filename;
        link.click();
    }
    
    /**
     * 删除照片
     */
    async deletePhoto(photoId, employeeName) {
        if (!confirm(`确定要删除 ${employeeName} 的打卡照片吗？`)) {
            return;
        }
        
        try {
            // 这里应该调用删除API
            console.log(`删除照片ID: ${photoId}`);
            
            // 从模拟数据中移除
            this.mockPhotos = this.mockPhotos.filter(p => p.id !== photoId);
            
            // 重新渲染
            this.renderPhotoList();
            this.updateStats();
            
            this.showToast('照片删除成功', 'success');
            
        } catch (error) {
            console.error('删除照片失败:', error);
            this.showToast('删除照片失败', 'error');
        }
    }
    
    /**
     * 切换视图模式
     */
    switchView(viewMode, modal) {
        const gridBtn = modal.querySelector('#grid-view-btn');
        const listBtn = modal.querySelector('#list-view-btn');
        
        if (viewMode === 'grid') {
            gridBtn.classList.add('active');
            listBtn.classList.remove('active');
        } else {
            listBtn.classList.add('active');
            gridBtn.classList.remove('active');
        }
        
        this.renderPhotoList();
    }
    
    /**
     * 应用筛选
     */
    applyFilter(modal) {
        const employeeFilter = modal.querySelector('#employee-filter').value.trim();
        const dateFilter = modal.querySelector('#date-filter').value;
        const statusFilter = modal.querySelector('#status-filter').value;
        
        this.currentFilter = {
            employee: employeeFilter,
            date: dateFilter,
            status: statusFilter
        };
        
        // 这里应该调用API重新加载数据
        this.loadPhotoList();
    }
    
    /**
     * 重置筛选
     */
    resetFilter(modal) {
        modal.querySelector('#employee-filter').value = '';
        modal.querySelector('#date-filter').value = '';
        modal.querySelector('#status-filter').value = 'all';
        
        this.currentFilter = {
            employee: '',
            date: '',
            status: 'all'
        };
        
        this.loadPhotoList();
    }
    
    /**
     * 渲染分页
     */
    renderPagination() {
        // 简单的分页实现
        const modal = document.querySelector('.photo-management-modal');
        const pagination = modal.querySelector('#pagination');
        
        pagination.innerHTML = `
            <li class="page-item">
                <a class="page-link" href="#" onclick="window.photoManagement.goToPage(1)">首页</a>
            </li>
            <li class="page-item active">
                <a class="page-link" href="#">1</a>
            </li>
            <li class="page-item">
                <a class="page-link" href="#" onclick="window.photoManagement.goToPage(1)">末页</a>
            </li>
        `;
    }
    
    /**
     * 跳转页面
     */
    goToPage(page) {
        this.currentPage = page;
        this.loadPhotoList();
    }
    
    /**
     * 批量删除照片
     */
    async bulkDeletePhotos(modal) {
        const checkboxes = modal.querySelectorAll('.photo-checkbox:checked');
        
        if (checkboxes.length === 0) {
            this.showToast('请选择要删除的照片', 'warning');
            return;
        }
        
        if (!confirm(`确定要删除选中的 ${checkboxes.length} 张照片吗？`)) {
            return;
        }
        
        try {
            const photoIds = Array.from(checkboxes).map(cb => parseInt(cb.value));
            
            // 这里应该调用批量删除API
            console.log('批量删除照片ID:', photoIds);
            
            // 从模拟数据中移除
            this.mockPhotos = this.mockPhotos.filter(p => !photoIds.includes(p.id));
            
            // 重新渲染
            this.renderPhotoList();
            this.updateStats();
            
            this.showToast(`成功删除 ${photoIds.length} 张照片`, 'success');
            
        } catch (error) {
            console.error('批量删除失败:', error);
            this.showToast('批量删除失败', 'error');
        }
    }
    
    /**
     * 导出照片数据
     */
    exportPhotoData(modal) {
        const data = this.mockPhotos.map(photo => ({
            员工姓名: photo.employee_name,
            上传时间: photo.timestamp,
            状态: photo.status === 'success' ? '成功' : '失败',
            文件大小: photo.file_size,
            位置信息: photo.location,
            文件名: photo.filename
        }));
        
        const csv = this.convertToCSV(data);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `打卡照片数据_${new Date().toLocaleDateString()}.csv`;
        link.click();
        
        this.showToast('导出成功', 'success');
    }
    
    /**
     * 转换为CSV格式
     */
    convertToCSV(data) {
        if (data.length === 0) return '';
        
        const headers = Object.keys(data[0]);
        const csvHeaders = headers.join(',');
        
        const csvRows = data.map(row => {
            return headers.map(header => {
                const value = row[header];
                return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
            }).join(',');
        });
        
        return [csvHeaders, ...csvRows].join('\n');
    }
    
    /**
     * 显示提示消息
     */
    showToast(message, type = 'info') {
        if (typeof showToast === 'function') {
            showToast(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }
}

// 全局实例
window.photoManagement = new PhotoManagement();
