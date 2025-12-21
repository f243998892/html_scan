/**
 * 拍照打卡功能模块
 * 支持图片压缩、异步上传、进度显示、错误重试
 */

class PhotoCheckin {
    constructor() {
        this.maxFileSize = 5 * 1024 * 1024; // 5MB
        this.compressQuality = 0.8; // 压缩质量
        this.maxWidth = 1920; // 最大宽度
        this.maxHeight = 1080; // 最大高度
        this.uploadQueue = []; // 上传队列
        this.isUploading = false;
        this.retryAttempts = 3; // 重试次数
        
        this.init();
    }
    
    init() {
        console.log('🚀 拍照打卡模块已加载');
        this.bindEvents();
    }
    
    bindEvents() {
        // 监听拍照按钮点击
        document.addEventListener('click', (e) => {
            if (e.target.matches('.photo-checkin-btn') || e.target.closest('.photo-checkin-btn')) {
                e.preventDefault();
                this.startPhotoCheckin();
            }
        });
        
        // 监听文件选择
        document.addEventListener('change', (e) => {
            if (e.target.matches('.photo-input')) {
                this.handleFileSelect(e);
            }
        });
    }
    
    /**
     * 开始拍照打卡流程
     */
    async startPhotoCheckin() {
        try {
            // 检查打卡范围限制
            if (typeof CheckinRangeConfig !== 'undefined') {
                const rangeConfig = new CheckinRangeConfig();
                
                this.showToast('正在检查打卡权限...', 'info');
                const checkResult = await rangeConfig.checkCheckinAllowed();
                
                if (!checkResult.overall.passed) {
                    // 显示限制原因对话框
                    this.showRangeRestrictionDialog(checkResult);
                    return;
                }
                
                this.showToast(checkResult.overall.message, 'success');
            }
            
            // 显示拍照界面
            this.showPhotoInterface();
            
        } catch (error) {
            console.error('启动拍照功能失败:', error);
            this.showToast('启动拍照功能失败，请重试', 'error');
        }
    }
    
    /**
     * 显示拍照界面
     */
    showPhotoInterface() {
        // 创建拍照模态框
        const modal = this.createPhotoModal();
        document.body.appendChild(modal);
        
        // 显示模态框
        setTimeout(() => {
            modal.classList.add('show');
        }, 100);
    }
    
    /**
     * 创建拍照模态框
     */
    createPhotoModal() {
        const modal = document.createElement('div');
        modal.className = 'photo-checkin-modal';
        modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">
                        <i class="bi bi-camera-fill"></i>
                        拍照打卡
                    </h5>
                    <button type="button" class="btn-close" onclick="this.closest('.photo-checkin-modal').remove()">
                        <i class="bi bi-x-lg"></i>
                    </button>
                </div>
                
                <div class="modal-body">
                    <!-- 拍照区域 -->
                    <div class="photo-capture-area" id="photoCaptureArea">
                        <div class="camera-preview" id="cameraPreview">
                            <video id="cameraVideo" autoplay playsinline></video>
                            <canvas id="captureCanvas" style="display: none;"></canvas>
                        </div>
                        
                        <div class="camera-controls">
                            <button type="button" class="btn btn-primary btn-lg" id="captureBtn">
                                <i class="bi bi-camera-fill"></i>
                                拍照
                            </button>
                            <button type="button" class="btn btn-secondary" id="switchCameraBtn">
                                <i class="bi bi-arrow-repeat"></i>
                                切换摄像头
                            </button>
                        </div>
                        
                        <!-- 文件上传备选 -->
                        <div class="file-upload-option">
                            <label for="photoFileInput" class="btn btn-outline-primary">
                                <i class="bi bi-folder2-open"></i>
                                选择照片
                            </label>
                            <input type="file" id="photoFileInput" class="photo-input" accept="image/*" style="display: none;">
                        </div>
                    </div>
                    
                    <!-- 照片预览区域 -->
                    <div class="photo-preview-area" id="photoPreviewArea" style="display: none;">
                        <div class="preview-container">
                            <img id="previewImage" alt="预览照片">
                            <div class="preview-overlay">
                                <div class="photo-info">
                                    <span id="photoSize"></span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="preview-controls">
                            <button type="button" class="btn btn-secondary" id="retakeBtn">
                                <i class="bi bi-arrow-left"></i>
                                重新拍照
                            </button>
                            <button type="button" class="btn btn-success btn-lg" id="confirmUploadBtn">
                                <i class="bi bi-cloud-upload"></i>
                                确认上传
                            </button>
                        </div>
                    </div>
                    
                    <!-- 上传进度 -->
                    <div class="upload-progress-area" id="uploadProgressArea" style="display: none;">
                        <div class="progress-container">
                            <div class="upload-status">
                                <i class="bi bi-cloud-upload" id="uploadIcon"></i>
                                <span id="uploadStatusText">正在上传...</span>
                            </div>
                            <div class="progress">
                                <div class="progress-bar" id="uploadProgressBar" style="width: 0%"></div>
                            </div>
                            <div class="progress-text">
                                <span id="uploadProgressText">0%</span>
                                <span id="uploadSpeedText"></span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // 绑定事件
        this.bindModalEvents(modal);
        
        return modal;
    }
    
    /**
     * 绑定模态框事件
     */
    bindModalEvents(modal) {
        const captureBtn = modal.querySelector('#captureBtn');
        const switchCameraBtn = modal.querySelector('#switchCameraBtn');
        const retakeBtn = modal.querySelector('#retakeBtn');
        const confirmUploadBtn = modal.querySelector('#confirmUploadBtn');
        const photoFileInput = modal.querySelector('#photoFileInput');
        
        // 拍照按钮
        captureBtn?.addEventListener('click', () => this.capturePhoto(modal));
        
        // 切换摄像头
        switchCameraBtn?.addEventListener('click', () => this.switchCamera(modal));
        
        // 重新拍照
        retakeBtn?.addEventListener('click', () => this.retakePhoto(modal));
        
        // 确认上传
        confirmUploadBtn?.addEventListener('click', () => this.confirmUpload(modal));
        
        // 文件选择
        photoFileInput?.addEventListener('change', (e) => this.handleFileSelect(e, modal));
        
        // 模态框关闭时停止摄像头
        modal.querySelector('.btn-close')?.addEventListener('click', () => {
            this.stopCamera();
        });
        
        // 启动摄像头
        setTimeout(() => this.startCamera(modal), 500);
    }
    
    /**
     * 启动摄像头
     */
    async startCamera(modal) {
        try {
            const video = modal.querySelector('#cameraVideo');
            
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                    facingMode: 'environment' // 后置摄像头
                }
            });
            
            video.srcObject = stream;
            this.currentStream = stream;
            
        } catch (error) {
            console.error('启动摄像头失败:', error);
            this.showToast('无法访问摄像头，请检查权限设置', 'warning');
        }
    }
    
    /**
     * 停止摄像头
     */
    stopCamera() {
        if (this.currentStream) {
            this.currentStream.getTracks().forEach(track => track.stop());
            this.currentStream = null;
        }
    }
    
    /**
     * 切换摄像头
     */
    async switchCamera(modal) {
        this.stopCamera();
        
        try {
            const video = modal.querySelector('#cameraVideo');
            const currentFacing = this.currentFacingMode || 'environment';
            const newFacing = currentFacing === 'environment' ? 'user' : 'environment';
            
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                    facingMode: newFacing
                }
            });
            
            video.srcObject = stream;
            this.currentStream = stream;
            this.currentFacingMode = newFacing;
            
        } catch (error) {
            console.error('切换摄像头失败:', error);
            // 回退到原来的摄像头
            this.startCamera(modal);
        }
    }
    
    /**
     * 拍照
     */
    capturePhoto(modal) {
        const video = modal.querySelector('#cameraVideo');
        const canvas = modal.querySelector('#captureCanvas');
        const ctx = canvas.getContext('2d');
        
        // 设置canvas尺寸
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // 绘制视频帧到canvas
        ctx.drawImage(video, 0, 0);
        
        // 转换为blob
        canvas.toBlob((blob) => {
            this.handleCapturedPhoto(blob, modal);
        }, 'image/jpeg', this.compressQuality);
    }
    
    /**
     * 处理拍摄的照片
     */
    async handleCapturedPhoto(blob, modal) {
        try {
            // 压缩照片
            const compressedBlob = await this.compressImage(blob);
            
            // 显示预览
            this.showPhotoPreview(compressedBlob, modal);
            
            // 停止摄像头
            this.stopCamera();
            
        } catch (error) {
            console.error('处理照片失败:', error);
            this.showToast('处理照片失败，请重试', 'error');
        }
    }
    
    /**
     * 处理文件选择
     */
    async handleFileSelect(event, modal = null) {
        const file = event.target.files[0];
        if (!file) return;
        
        // 检查文件类型
        if (!file.type.startsWith('image/')) {
            this.showToast('请选择图片文件', 'warning');
            return;
        }
        
        // 检查文件大小
        if (file.size > this.maxFileSize) {
            this.showToast('图片文件太大，请选择小于5MB的图片', 'warning');
            return;
        }
        
        try {
            // 压缩图片
            const compressedBlob = await this.compressImage(file);
            
            // 显示预览
            this.showPhotoPreview(compressedBlob, modal);
            
        } catch (error) {
            console.error('处理选择的文件失败:', error);
            this.showToast('处理图片失败，请重试', 'error');
        }
    }
    
    /**
     * 压缩图片
     */
    async compressImage(file) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
                // 计算新尺寸
                let { width, height } = this.calculateNewDimensions(img.width, img.height);
                
                canvas.width = width;
                canvas.height = height;
                
                // 绘制压缩后的图片
                ctx.drawImage(img, 0, 0, width, height);
                
                // 转换为blob
                canvas.toBlob(resolve, 'image/jpeg', this.compressQuality);
            };
            
            img.src = URL.createObjectURL(file);
        });
    }
    
    /**
     * 计算新尺寸
     */
    calculateNewDimensions(width, height) {
        if (width <= this.maxWidth && height <= this.maxHeight) {
            return { width, height };
        }
        
        const widthRatio = this.maxWidth / width;
        const heightRatio = this.maxHeight / height;
        const ratio = Math.min(widthRatio, heightRatio);
        
        return {
            width: Math.round(width * ratio),
            height: Math.round(height * ratio)
        };
    }
    
    /**
     * 显示照片预览
     */
    showPhotoPreview(blob, modal) {
        const captureArea = modal.querySelector('#photoCaptureArea');
        const previewArea = modal.querySelector('#photoPreviewArea');
        const previewImage = modal.querySelector('#previewImage');
        const photoSize = modal.querySelector('#photoSize');
        
        // 隐藏拍照区域，显示预览区域
        captureArea.style.display = 'none';
        previewArea.style.display = 'block';
        
        // 设置预览图片
        const imageUrl = URL.createObjectURL(blob);
        previewImage.src = imageUrl;
        
        // 显示文件大小
        const sizeInMB = (blob.size / (1024 * 1024)).toFixed(2);
        photoSize.textContent = `${sizeInMB} MB`;
        
        // 保存blob用于上传
        this.currentPhotoBlob = blob;
    }
    
    /**
     * 重新拍照
     */
    retakePhoto(modal) {
        const captureArea = modal.querySelector('#photoCaptureArea');
        const previewArea = modal.querySelector('#photoPreviewArea');
        
        // 显示拍照区域，隐藏预览区域
        previewArea.style.display = 'none';
        captureArea.style.display = 'block';
        
        // 重新启动摄像头
        this.startCamera(modal);
        
        // 清理当前照片
        this.currentPhotoBlob = null;
    }
    
    /**
     * 确认上传
     */
    async confirmUpload(modal) {
        if (!this.currentPhotoBlob) {
            this.showToast('没有可上传的照片', 'warning');
            return;
        }
        
        try {
            // 显示上传进度
            this.showUploadProgress(modal);
            
            // 执行上传
            await this.uploadPhoto(this.currentPhotoBlob, modal);
            
        } catch (error) {
            console.error('上传照片失败:', error);
            this.showUploadError(modal, error.message);
        }
    }
    
    /**
     * 显示上传进度
     */
    showUploadProgress(modal) {
        const previewArea = modal.querySelector('#photoPreviewArea');
        const progressArea = modal.querySelector('#uploadProgressArea');
        
        previewArea.style.display = 'none';
        progressArea.style.display = 'block';
        
        // 重置进度
        this.updateUploadProgress(0, '准备上传...');
    }
    
    /**
     * 上传照片
     */
    async uploadPhoto(blob, modal) {
        const formData = new FormData();
        formData.append('photo', blob, `checkin_${Date.now()}.jpg`);
        formData.append('employee_name', userState?.fullName || '未知员工');
        formData.append('timestamp', new Date().toISOString());
        
        const xhr = new XMLHttpRequest();
        
        return new Promise((resolve, reject) => {
            // 上传进度
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percentage = Math.round((e.loaded / e.total) * 100);
                    this.updateUploadProgress(percentage, '正在上传...');
                }
            });
            
            // 上传完成
            xhr.addEventListener('load', () => {
                if (xhr.status === 200) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        this.handleUploadSuccess(modal, response);
                        resolve(response);
                    } catch (error) {
                        reject(new Error('服务器响应格式错误'));
                    }
                } else {
                    reject(new Error(`上传失败: ${xhr.status} ${xhr.statusText}`));
                }
            });
            
            // 上传错误
            xhr.addEventListener('error', () => {
                reject(new Error('网络错误，上传失败'));
            });
            
            // 发送请求
            xhr.open('POST', `${API_BASE_URL}/upload-checkin-photo`);
            xhr.send(formData);
        });
    }
    
    /**
     * 更新上传进度
     */
    updateUploadProgress(percentage, status) {
        const modal = document.querySelector('.photo-checkin-modal');
        if (!modal) return;
        
        const progressBar = modal.querySelector('#uploadProgressBar');
        const progressText = modal.querySelector('#uploadProgressText');
        const statusText = modal.querySelector('#uploadStatusText');
        
        if (progressBar) progressBar.style.width = `${percentage}%`;
        if (progressText) progressText.textContent = `${percentage}%`;
        if (statusText) statusText.textContent = status;
    }
    
    /**
     * 处理上传成功
     */
    handleUploadSuccess(modal, response) {
        this.updateUploadProgress(100, '上传成功！');
        
        const uploadIcon = modal.querySelector('#uploadIcon');
        if (uploadIcon) {
            uploadIcon.className = 'bi bi-check-circle-fill text-success';
        }
        
        // 显示成功消息
        this.showToast('拍照打卡成功！', 'success');
        
        // 延迟关闭模态框
        setTimeout(() => {
            modal.remove();
            this.stopCamera();
        }, 1500);
    }
    
    /**
     * 处理上传错误
     */
    showUploadError(modal, errorMessage) {
        const uploadIcon = modal.querySelector('#uploadIcon');
        const statusText = modal.querySelector('#uploadStatusText');
        
        if (uploadIcon) {
            uploadIcon.className = 'bi bi-exclamation-triangle-fill text-danger';
        }
        
        if (statusText) {
            statusText.textContent = '上传失败: ' + errorMessage;
        }
        
        // 显示重试按钮
        const progressArea = modal.querySelector('#uploadProgressArea');
        const retryBtn = document.createElement('button');
        retryBtn.className = 'btn btn-primary mt-3';
        retryBtn.innerHTML = '<i class="bi bi-arrow-repeat"></i> 重试上传';
        retryBtn.onclick = () => this.confirmUpload(modal);
        
        progressArea.appendChild(retryBtn);
        
        this.showToast('上传失败，请重试', 'error');
    }
    
    /**
     * 显示范围限制对话框
     */
    showRangeRestrictionDialog(checkResult) {
        const modal = document.createElement('div');
        modal.className = 'photo-checkin-modal';
        modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">
                        <i class="bi bi-exclamation-triangle-fill text-warning"></i>
                        打卡限制
                    </h5>
                    <button type="button" class="btn-close" onclick="this.closest('.photo-checkin-modal').remove()">
                        <i class="bi bi-x-lg"></i>
                    </button>
                </div>
                
                <div class="modal-body">
                    <div class="alert alert-warning">
                        <h6><i class="bi bi-info-circle"></i> ${checkResult.overall.message}</h6>
                    </div>
                    
                    <div class="restriction-details">
                        ${checkResult.time.passed ? 
                            `<div class="check-item passed">
                                <i class="bi bi-check-circle-fill text-success"></i>
                                ${checkResult.time.message}
                            </div>` : 
                            `<div class="check-item failed">
                                <i class="bi bi-x-circle-fill text-danger"></i>
                                ${checkResult.time.message}
                            </div>`
                        }
                        
                        ${checkResult.location.passed ? 
                            `<div class="check-item passed">
                                <i class="bi bi-check-circle-fill text-success"></i>
                                ${checkResult.location.message}
                            </div>` : 
                            `<div class="check-item failed">
                                <i class="bi bi-x-circle-fill text-danger"></i>
                                ${checkResult.location.message}
                            </div>`
                        }
                    </div>
                    
                    <div class="admin-bypass mt-3">
                        <div class="form-group">
                            <label for="bypassCode" class="form-label">管理员绕过代码：</label>
                            <div class="input-group">
                                <input type="password" class="form-control" id="bypassCode" placeholder="输入绕过代码">
                                <button class="btn btn-outline-primary" type="button" id="adminBypassBtn">
                                    验证绕过
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.photo-checkin-modal').remove()">
                        取消
                    </button>
                    <button type="button" class="btn btn-primary" id="retryCheckBtn">
                        <i class="bi bi-arrow-repeat"></i>
                        重新检查
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 显示模态框
        setTimeout(() => {
            modal.classList.add('show');
        }, 100);
        
        // 绑定事件
        const retryBtn = modal.querySelector('#retryCheckBtn');
        const bypassBtn = modal.querySelector('#adminBypassBtn');
        const bypassInput = modal.querySelector('#bypassCode');
        
        retryBtn?.addEventListener('click', () => {
            modal.remove();
            this.startPhotoCheckin();
        });
        
        bypassBtn?.addEventListener('click', async () => {
            const code = bypassInput.value.trim();
            if (!code) {
                this.showToast('请输入绕过代码', 'warning');
                return;
            }
            
            const rangeConfig = new CheckinRangeConfig();
            const bypassResult = rangeConfig.adminBypass(code);
            
            if (bypassResult.passed) {
                this.showToast(bypassResult.message, 'success');
                modal.remove();
                this.showPhotoInterface();
            } else {
                this.showToast(bypassResult.message, 'error');
                bypassInput.value = '';
                bypassInput.focus();
            }
        });
        
        // 回车键提交绕过代码
        bypassInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                bypassBtn.click();
            }
        });
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

// 初始化拍照打卡功能
const photoCheckin = new PhotoCheckin();

// 导出给其他模块使用
window.PhotoCheckin = PhotoCheckin;
