/**
 * 用户角色管理模块
 */

class UserRoleManager {
    constructor() {
        this.init();
    }
    
    init() {
        console.log('👤 用户角色管理模块已加载');
        this.bindEvents();
        this.displayCurrentRole();
    }
    
    bindEvents() {
        // 监听角色设置按钮点击
        document.addEventListener('click', (e) => {
            if (e.target.matches('.user-role-btn') || e.target.closest('.user-role-btn')) {
                e.preventDefault();
                this.showRoleSettings();
            }
        });
    }
    
    /**
     * 显示角色设置界面
     */
    showRoleSettings() {
        const modal = this.createRoleModal();
        document.body.appendChild(modal);
        
        setTimeout(() => {
            modal.classList.add('show');
        }, 100);
    }
    
    /**
     * 创建角色设置模态框
     */
    createRoleModal() {
        const currentRole = localStorage.getItem('userRole') || 'employee';
        const currentName = localStorage.getItem('userName') || '';
        
        const modal = document.createElement('div');
        modal.className = 'modal fade user-role-modal';
        modal.innerHTML = `
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header bg-warning text-white">
                        <h5 class="modal-title">
                            <i class="bi bi-person-gear me-2"></i>用户角色设置
                        </h5>
                        <button type="button" class="btn-close btn-close-white" onclick="window.closeRoleModal()"></button>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-info">
                            <i class="bi bi-info-circle me-2"></i>
                            <strong>权限说明：</strong><br>
                            • <strong>员工</strong>：只能查看自己的打卡记录，不显示照片<br>
                            • <strong>管理员</strong>：可以查看所有员工的打卡记录和照片
                        </div>
                        
                        <div class="mb-3">
                            <label class="form-label">👤 用户姓名</label>
                            <input type="text" class="form-control" id="user-name-input" 
                                   placeholder="请输入您的姓名" value="${currentName}">
                            <div class="form-text">输入您的姓名，用于筛选打卡记录</div>
                        </div>
                        
                        <div class="mb-4">
                            <label class="form-label">🔐 用户角色</label>
                            <div class="row g-3">
                                <div class="col-6">
                                    <div class="card ${currentRole === 'employee' ? 'border-primary' : ''}">
                                        <div class="card-body text-center p-3">
                                            <input type="radio" name="userRole" value="employee" 
                                                   id="role-employee" ${currentRole === 'employee' ? 'checked' : ''}>
                                            <label for="role-employee" class="d-block mt-2">
                                                <i class="bi bi-person-fill text-primary" style="font-size: 1.5rem;"></i>
                                                <div class="mt-2"><strong>员工</strong></div>
                                                <div class="text-muted small">查看自己的记录</div>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-6">
                                    <div class="card ${currentRole === 'admin' ? 'border-danger' : ''}">
                                        <div class="card-body text-center p-3">
                                            <input type="radio" name="userRole" value="admin" 
                                                   id="role-admin" ${currentRole === 'admin' ? 'checked' : ''}>
                                            <label for="role-admin" class="d-block mt-2">
                                                <i class="bi bi-person-badge-fill text-danger" style="font-size: 1.5rem;"></i>
                                                <div class="mt-2"><strong>管理员</strong></div>
                                                <div class="text-muted small">查看所有记录</div>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="current-settings p-3 bg-light rounded">
                            <h6><i class="bi bi-gear-fill me-2"></i>当前设置</h6>
                            <div class="row">
                                <div class="col-6">
                                    <strong>姓名：</strong><span id="current-name-display">${currentName || '未设置'}</span>
                                </div>
                                <div class="col-6">
                                    <strong>角色：</strong><span id="current-role-display">${currentRole === 'admin' ? '管理员' : '员工'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="window.closeRoleModal()">
                            <i class="bi bi-x-circle me-2"></i>取消
                        </button>
                        <button type="button" class="btn btn-warning" onclick="window.saveUserRole()">
                            <i class="bi bi-check-circle me-2"></i>保存设置
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // 绑定点击背景关闭事件
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeRoleModal();
            }
        });
        
        return modal;
    }
    
    /**
     * 保存用户角色设置
     */
    saveUserRole() {
        const nameInput = document.getElementById('user-name-input');
        const roleInputs = document.querySelectorAll('input[name="userRole"]');
        
        const userName = nameInput.value.trim();
        let selectedRole = 'employee';
        
        roleInputs.forEach(input => {
            if (input.checked) {
                selectedRole = input.value;
            }
        });
        
        if (!userName) {
            alert('请输入您的姓名');
            nameInput.focus();
            return;
        }
        
        // 保存到localStorage
        localStorage.setItem('userName', userName);
        localStorage.setItem('userRole', selectedRole);
        
        console.log('💾 用户设置已保存:', { name: userName, role: selectedRole });
        
        // 显示成功提示
        this.showToast(`设置已保存：${userName} (${selectedRole === 'admin' ? '管理员' : '员工'})`, 'success');
        
        // 更新当前显示
        this.displayCurrentRole();
        
        // 关闭模态框
        this.closeRoleModal();
    }
    
    /**
     * 关闭角色设置模态框
     */
    closeRoleModal() {
        const modal = document.querySelector('.user-role-modal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => {
                if (modal.parentNode) {
                    modal.parentNode.removeChild(modal);
                }
            }, 300);
        }
    }
    
    /**
     * 在页面上显示当前用户角色
     */
    displayCurrentRole() {
        const userName = localStorage.getItem('userName') || '未设置';
        const userRole = localStorage.getItem('userRole') || 'employee';
        const roleText = userRole === 'admin' ? '管理员' : '员工';
        
        // 更新角色设置卡片显示
        const roleCard = document.getElementById('card-user-role');
        if (roleCard) {
            const cardBody = roleCard.querySelector('.card-body');
            if (cardBody) {
                cardBody.innerHTML = `
                    <i class="bi bi-person-gear text-warning" style="font-size: 2rem;"></i>
                    <h6 class="text-warning mt-2">角色设置</h6>
                    <div class="small text-muted">
                        <strong>${userName}</strong><br>
                        <span class="badge ${userRole === 'admin' ? 'bg-danger' : 'bg-primary'}">${roleText}</span>
                    </div>
                `;
            }
        }
        
        console.log('👤 当前用户:', { name: userName, role: roleText });
    }
    
    /**
     * 显示提示消息
     */
    showToast(message, type = 'info') {
        // 创建toast元素
        const toast = document.createElement('div');
        toast.className = `alert alert-${type} position-fixed`;
        toast.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        toast.innerHTML = `
            <i class="bi bi-${type === 'success' ? 'check-circle' : 'info-circle'} me-2"></i>
            ${message}
        `;
        
        document.body.appendChild(toast);
        
        // 3秒后自动移除
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 3000);
    }
}

// 全局函数
window.closeRoleModal = function() {
    if (window.userRoleManager) {
        window.userRoleManager.closeRoleModal();
    }
};

window.saveUserRole = function() {
    if (window.userRoleManager) {
        window.userRoleManager.saveUserRole();
    }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    window.userRoleManager = new UserRoleManager();
});
