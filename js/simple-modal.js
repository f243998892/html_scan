// 简单模态框解决方案 - 不依赖任何外部库
(function() {
    'use strict';
    
    // 创建样式
    const style = document.createElement('style');
    style.textContent = `
        .simple-modal {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            background: rgba(0,0,0,0.8) !important;
            z-index: 999999 !important;
            display: none !important;
            align-items: center !important;
            justify-content: center !important;
        }
        .simple-modal.show {
            display: flex !important;
        }
        .simple-modal-content {
            background: white !important;
            border-radius: 10px !important;
            padding: 20px !important;
            max-width: 90% !important;
            max-height: 90% !important;
            overflow: auto !important;
            position: relative !important;
        }
        .simple-modal-close {
            position: absolute !important;
            top: 10px !important;
            right: 15px !important;
            background: none !important;
            border: none !important;
            font-size: 24px !important;
            cursor: pointer !important;
            color: #666 !important;
        }
        .simple-modal-close:hover {
            color: #000 !important;
        }
        .simple-btn {
            background: #007bff !important;
            color: white !important;
            border: none !important;
            padding: 10px 20px !important;
            border-radius: 5px !important;
            cursor: pointer !important;
            margin: 5px !important;
        }
        .simple-btn:hover {
            background: #0056b3 !important;
        }
        .simple-btn.danger {
            background: #dc3545 !important;
        }
        .simple-btn.danger:hover {
            background: #c82333 !important;
        }
    `;
    document.head.appendChild(style);
    
    // 简单拍照打卡功能
    window.simplePhotoCheckin = function() {
        console.log('启动简单拍照打卡');
        
        // 移除已存在的模态框
        const existing = document.querySelector('.simple-modal');
        if (existing) existing.remove();
        
        // 创建模态框
        const modal = document.createElement('div');
        modal.className = 'simple-modal';
        modal.innerHTML = `
            <div class="simple-modal-content">
                <button class="simple-modal-close" onclick="this.closest('.simple-modal').remove()">&times;</button>
                <h3>📸 拍照打卡</h3>
                <div style="text-align: center; padding: 20px;">
                    <video id="simple-video" width="320" height="240" autoplay style="border-radius: 10px; margin: 10px;"></video>
                    <canvas id="simple-canvas" width="320" height="240" style="display: none;"></canvas>
                    <br>
                    <button class="simple-btn" onclick="startSimpleCamera()">📷 启动摄像头</button>
                    <button class="simple-btn" onclick="captureSimplePhoto()">📸 拍照</button>
                    <button class="simple-btn" onclick="uploadSimplePhoto()">📤 上传</button>
                    <br>
                    <input type="file" id="simple-file" accept="image/*" style="margin: 10px;">
                    <br>
                    <div id="simple-status" style="margin: 10px; color: #666;"></div>
                </div>
            </div>
        `;
        
        // 添加到页面
        document.body.appendChild(modal);
        
        // 显示模态框
        setTimeout(() => {
            modal.classList.add('show');
            console.log('模态框已显示');
        }, 100);
        
        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    };
    
    // 简单照片管理功能
    window.simplePhotoManagement = function() {
        console.log('启动简单照片管理');
        
        // 移除已存在的模态框
        const existing = document.querySelector('.simple-modal');
        if (existing) existing.remove();
        
        // 创建模态框
        const modal = document.createElement('div');
        modal.className = 'simple-modal';
        modal.innerHTML = `
            <div class="simple-modal-content" style="width: 80%; height: 80%;">
                <button class="simple-modal-close" onclick="this.closest('.simple-modal').remove()">&times;</button>
                <h3>📁 照片管理</h3>
                <div style="padding: 20px;">
                    <div style="margin: 10px 0;">
                        <input type="text" placeholder="搜索员工" style="padding: 8px; border: 1px solid #ddd; border-radius: 4px; margin-right: 10px;">
                        <button class="simple-btn">🔍 搜索</button>
                        <button class="simple-btn danger">🗑️ 删除选中</button>
                    </div>
                    <div style="border: 1px solid #ddd; border-radius: 5px; padding: 15px; height: 400px; overflow: auto;">
                        <h5>📊 统计信息</h5>
                        <p>总照片数: 0 | 今日照片: 0 | 存储占用: 0MB</p>
                        <hr>
                        <h5>📷 照片列表</h5>
                        <div style="text-align: center; color: #666; padding: 50px;">
                            <div style="font-size: 48px;">📸</div>
                            <p>暂无打卡照片</p>
                            <p>照片将会显示在这里</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // 添加到页面
        document.body.appendChild(modal);
        
        // 显示模态框
        setTimeout(() => {
            modal.classList.add('show');
            console.log('照片管理模态框已显示');
        }, 100);
        
        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    };
    
    // 摄像头相关功能
    let simpleStream = null;
    let simpleCapturedImage = null;
    
    window.startSimpleCamera = async function() {
        const status = document.getElementById('simple-status');
        const video = document.getElementById('simple-video');
        
        try {
            status.textContent = '正在启动摄像头...';
            
            if (simpleStream) {
                simpleStream.getTracks().forEach(track => track.stop());
            }
            
            simpleStream = await navigator.mediaDevices.getUserMedia({ 
                video: { width: 320, height: 240 } 
            });
            
            video.srcObject = simpleStream;
            status.textContent = '摄像头已启动，可以拍照了';
            
        } catch (error) {
            console.error('启动摄像头失败:', error);
            status.textContent = '摄像头启动失败: ' + error.message;
        }
    };
    
    window.captureSimplePhoto = function() {
        const video = document.getElementById('simple-video');
        const canvas = document.getElementById('simple-canvas');
        const status = document.getElementById('simple-status');
        
        if (!simpleStream) {
            status.textContent = '请先启动摄像头';
            return;
        }
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, 320, 240);
        
        canvas.toBlob((blob) => {
            simpleCapturedImage = blob;
            status.textContent = '照片已拍摄，可以上传了';
        }, 'image/jpeg', 0.8);
    };
    
    window.uploadSimplePhoto = async function() {
        const status = document.getElementById('simple-status');
        const fileInput = document.getElementById('simple-file');
        
        let imageBlob = simpleCapturedImage;
        
        // 如果没有拍照，检查文件选择
        if (!imageBlob && fileInput.files.length > 0) {
            imageBlob = fileInput.files[0];
        }
        
        if (!imageBlob) {
            status.textContent = '请先拍照或选择文件';
            return;
        }
        
        try {
            status.textContent = '正在上传...';
            
            const formData = new FormData();
            formData.append('photo', imageBlob, `checkin_${Date.now()}.jpg`);
            formData.append('employee_name', '测试员工');
            formData.append('timestamp', new Date().toISOString());
            
            const response = await fetch('/api/upload-checkin-photo', {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                const result = await response.json();
                status.textContent = '✅ 上传成功！';
                console.log('上传结果:', result);
            } else {
                throw new Error('上传失败: ' + response.status);
            }
            
        } catch (error) {
            console.error('上传失败:', error);
            status.textContent = '❌ 上传失败: ' + error.message;
        }
    };
    
    // 绑定按钮事件
    document.addEventListener('click', function(e) {
        // 拍照打卡按钮
        if (e.target.matches('.photo-checkin-btn') || e.target.closest('.photo-checkin-btn')) {
            e.preventDefault();
            e.stopPropagation();
            simplePhotoCheckin();
            return;
        }
        
        // 照片管理按钮
        if (e.target.matches('.photo-management-btn') || e.target.closest('.photo-management-btn')) {
            e.preventDefault();
            e.stopPropagation();
            simplePhotoManagement();
            return;
        }
    });
    
    console.log('✅ 简单模态框已加载完成');
})();
