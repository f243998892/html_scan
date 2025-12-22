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
    window.simplePhotoCheckin = async function() {
        console.log('🚀 启动简单拍照打卡');
        
        try {
            // 先进行位置和权限检查
            console.log('📍 开始检查打卡权限和位置...');
            const locationCheck = await checkLocationAndPermissions();
            
            if (!locationCheck.success) {
                console.log('❌ 位置检查失败:', locationCheck.message);
                showLocationError(locationCheck);
                return;
            }
            
            console.log('✅ 位置检查通过，显示拍照界面');
            showPhotoInterface(locationCheck.location);
            
        } catch (error) {
            console.error('❌ 启动拍照打卡失败:', error);
            alert('启动拍照打卡失败: ' + error.message);
        }
    };
    
    // 检查位置和权限
    async function checkLocationAndPermissions() {
        console.log('🔍 开始位置检查流程...');
        
        // 1. 先检查浏览器是否支持地理定位
        if (!navigator.geolocation) {
            console.error('❌ 浏览器不支持地理定位');
            return {
                success: false,
                message: '您的浏览器不支持地理定位功能',
                needsManualLocation: true
            };
        }
        
        console.log('✅ 浏览器支持地理定位');
        
        // 2. 检查权限状态 (仅现代浏览器支持)
        if (navigator.permissions) {
            try {
                const permission = await navigator.permissions.query({name: 'geolocation'});
                console.log('🔐 地理位置权限状态:', permission.state);
                
                if (permission.state === 'denied') {
                    return {
                        success: false,
                        message: '地理位置权限被拒绝，请在浏览器设置中允许位置访问',
                        needsManualLocation: true
                    };
                }
            } catch (e) {
                console.log('⚠️ 无法检查权限状态 (可能是较老的浏览器)');
            }
        }
        
        // 3. 尝试获取位置 (使用针对移动设备优化的多种策略)
        const locationStrategies = [
            // 策略1: 移动设备优化 - 适中精度，适中超时
            {
                enableHighAccuracy: true,
                timeout: 8000,
                maximumAge: 10000,
                name: '移动设备优化定位'
            },
            // 策略2: 快速定位 - 使用缓存但较新
            {
                enableHighAccuracy: false,
                timeout: 3000,
                maximumAge: 60000,
                name: '快速缓存定位'
            },
            // 策略3: 高精度长等待 - 给GPS充分时间
            {
                enableHighAccuracy: true,
                timeout: 20000,
                maximumAge: 0,
                name: '高精度GPS定位'
            },
            // 策略4: 网络定位兜底
            {
                enableHighAccuracy: false,
                timeout: 10000,
                maximumAge: 120000,
                name: '网络基站定位'
            }
        ];
        
        for (let i = 0; i < locationStrategies.length; i++) {
            const strategy = locationStrategies[i];
            console.log(`🎯 尝试${strategy.name}...`);
            
            try {
                const position = await getCurrentPositionWithTimeout(strategy);
                
                const userLat = position.coords.latitude;
                const userLng = position.coords.longitude;
                const accuracy = position.coords.accuracy;
                
                console.log(`📍 ${strategy.name}成功: 纬度${userLat.toFixed(6)}, 经度${userLng.toFixed(6)}, 精度${accuracy}米`);
                
                // 公司坐标 (北纬39°4'31"，东经117°2'14")
                const companyLat = 39.075277;
                const companyLng = 117.037222;
                const maxDistance = 500; // 500米范围
                
                // 计算距离
                const distance = calculateDistance(userLat, userLng, companyLat, companyLng);
                console.log(`📏 距离公司: ${distance.toFixed(0)}米`);
                
                if (distance <= maxDistance) {
                    return {
                        success: true,
                        location: {
                            latitude: userLat,
                            longitude: userLng,
                            accuracy: accuracy,
                            distance: distance
                        },
                        message: `位置验证通过，距离公司${distance.toFixed(0)}米`
                    };
                } else {
                    return {
                        success: false,
                        message: `不在打卡范围内，距离公司${distance.toFixed(0)}米，需要在${maxDistance}米以内`,
                        location: { latitude: userLat, longitude: userLng, accuracy: accuracy, distance: distance }
                    };
                }
                
            } catch (error) {
                console.warn(`❌ ${strategy.name}失败:`, error.message);
                if (i === locationStrategies.length - 1) {
                    // 最后一个策略也失败了
                    let message = '无法获取位置信息: ';
                    switch(error.code) {
                        case 1: // PERMISSION_DENIED
                            message += '位置权限被拒绝或未授权';
                            break;
                        case 2: // POSITION_UNAVAILABLE
                            message += 'GPS信号不可用或网络问题';
                            break;
                        case 3: // TIMEOUT
                            message += '定位超时';
                            break;
                        default:
                            message += error.message || '未知错误';
                    }
                    return {
                        success: false,
                        message: message,
                        needsManualLocation: true
                    };
                }
            }
        }
    }
    
    // 包装getCurrentPosition为Promise
    function getCurrentPositionWithTimeout(options) {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, options);
        });
    }
    
    // 计算两点间距离(米)
    function calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371e3; // 地球半径(米)
        const φ1 = lat1 * Math.PI/180;
        const φ2 = lat2 * Math.PI/180;
        const Δφ = (lat2-lat1) * Math.PI/180;
        const Δλ = (lng2-lng1) * Math.PI/180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c;
    }
    
    // 显示位置错误
    function showLocationError(locationCheck) {
        const modal = document.createElement('div');
        modal.className = 'simple-modal';
        
        const isPermissionIssue = locationCheck.message.includes('权限') || locationCheck.message.includes('拒绝');
        const isSignalIssue = locationCheck.message.includes('信号') || locationCheck.message.includes('超时') || locationCheck.message.includes('不可用');
        
        modal.innerHTML = `
            <div class="simple-modal-content" style="max-width: 450px;">
                <button class="simple-modal-close" onclick="this.closest('.simple-modal').remove()">&times;</button>
                <h3>📍 位置定位问题</h3>
                <div style="padding: 20px;">
                    <div style="color: #dc3545; font-size: 16px; margin: 15px 0; text-align: center;">
                        ${locationCheck.message}
                    </div>
                    
                    ${isPermissionIssue ? `
                    <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 15px 0;">
                        <h4 style="color: #856404; margin: 0 0 10px 0;">🔧 位置权限解决方案</h4>
                        <div style="font-size: 14px; color: #856404; line-height: 1.5;">
                            <p><strong>Chrome浏览器:</strong></p>
                            <p>• 点击地址栏左侧的🔒或ℹ️图标</p>
                            <p>• 将"位置"设置为"允许"</p>
                            <p>• 刷新页面重试</p>
                            
                            <p style="margin-top: 10px;"><strong>手机浏览器:</strong></p>
                            <p>• 进入浏览器设置 → 网站设置 → 位置权限</p>
                            <p>• 允许此网站访问位置</p>
                        </div>
                    </div>
                    ` : ''}
                    
                    ${isSignalIssue ? `
                    <div style="background: #e7f3ff; padding: 15px; border-radius: 8px; margin: 15px 0;">
                        <h4 style="color: #0c5460; margin: 0 0 10px 0;">📡 GPS信号优化</h4>
                        <div style="font-size: 14px; color: #0c5460; line-height: 1.5;">
                            <p>• 确保在户外或靠窗位置</p>
                            <p>• 关闭省电模式和飞行模式</p>
                            <p>• 等待10-30秒让GPS获取更好信号</p>
                            <p>• 尝试重启手机位置服务</p>
                        </div>
                    </div>
                    ` : ''}
                    
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0;">
                        <h4 style="color: #495057; margin: 0 0 10px 0;">⚠️ 安全说明</h4>
                        <div style="font-size: 13px; color: #6c757d; line-height: 1.4;">
                            GPS位置验证是打卡系统的核心安全功能，确保员工在公司范围内才能打卡。
                            系统不提供位置绕过功能以维护考勤数据的准确性。
                        </div>
                    </div>
                    
                    <div style="text-align: center;">
                        <button class="simple-btn" onclick="this.closest('.simple-modal').remove(); simplePhotoCheckin();" style="margin: 5px;">
                            🔄 重新定位
                        </button>
                        <button class="simple-btn" onclick="this.closest('.simple-modal').remove();" style="margin: 5px; background: #6c757d;">
                            关闭
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('show'), 100);
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }
    
    // 显示拍照界面
    function showPhotoInterface(userLocation) {
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
                <div style="background: #e7f3ff; padding: 10px; margin: 10px; border-radius: 8px; font-size: 12px;">
                    <div>📍 位置: ${userLocation.distance.toFixed(0)}米 (公司范围内)</div>
                    <div>🎯 精度: ${userLocation.accuracy.toFixed(0)}米</div>
                    <div style="color: #666; font-size: 10px;">
                        坐标: ${userLocation.latitude.toFixed(6)}, ${userLocation.longitude.toFixed(6)}
                    </div>
                </div>
                <div style="text-align: center; padding: 20px;">
                    <video id="simple-video" width="320" height="240" autoplay style="border-radius: 10px; margin: 10px;"></video>
                    <canvas id="simple-canvas" width="320" height="240" style="display: none;"></canvas>
                    <br>
                    <button class="simple-btn" onclick="startSimpleCamera()">📷 启动摄像头</button>
                    <button class="simple-btn" onclick="captureSimplePhoto()">📸 拍照</button>
                    <button class="simple-btn" onclick="uploadSimplePhoto()">📤 上传</button>
                    <br>
                    <div id="simple-status" style="margin: 10px; color: #666;"></div>
                </div>
            </div>
        `;
        
        // 添加到页面
        document.body.appendChild(modal);
        
        // 存储用户位置供上传使用
        window.currentUserLocation = userLocation;
        
        // 显示模态框
        setTimeout(() => {
            modal.classList.add('show');
            console.log('📱 拍照界面已显示，位置信息已保存');
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
                video: { 
                    width: 320, 
                    height: 240,
                    facingMode: 'environment'  // 使用后置摄像头
                } 
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
        
        console.log('📸 开始拍照...');
        
        // 捕获当前视频帧到canvas
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, 320, 240);
        
        // 显示捕获的画面，隐藏视频流
        video.style.display = 'none';
        canvas.style.display = 'block';
        canvas.style.borderRadius = '10px';
        canvas.style.margin = '10px';
        
        console.log('📷 画面已捕获到canvas');
        
        // 将canvas转换为blob保存
        canvas.toBlob((blob) => {
            if (blob) {
                simpleCapturedImage = blob;
                status.textContent = '✅ 照片已拍摄！可以上传或重新拍摄';
                console.log('💾 照片已保存为blob:');
                console.log('   - 大小:', blob.size, '字节');
                console.log('   - 类型:', blob.type);
                console.log('   - 有效性:', blob.size > 0 ? '✅' : '❌');
                
                // 更新按钮状态
                updateCameraButtons('captured');
            } else {
                console.error('❌ canvas转blob失败');
                status.textContent = '❌ 拍照失败，请重试';
            }
        }, 'image/jpeg', 0.8);
    };
    
    // 重新拍照功能
    window.retakeSimplePhoto = function() {
        const video = document.getElementById('simple-video');
        const canvas = document.getElementById('simple-canvas');
        const status = document.getElementById('simple-status');
        
        // 显示视频流，隐藏canvas
        video.style.display = 'block';
        canvas.style.display = 'none';
        
        // 清除已拍摄的照片
        simpleCapturedImage = null;
        status.textContent = '摄像头已重新启动，可以重新拍照';
        
        // 更新按钮状态
        updateCameraButtons('streaming');
        
        console.log('🔄 已重置到拍照状态');
    };
    
    // 更新摄像头按钮状态
    function updateCameraButtons(state) {
        const buttonsContainer = document.querySelector('.simple-modal-content');
        if (!buttonsContainer) return;
        
        // 找到按钮容器
        const buttonContainer = buttonsContainer.querySelector('div[style*="text-align: center"]');
        if (!buttonContainer) return;
        
        if (state === 'captured') {
            // 拍照后状态：显示重拍和上传按钮
            const captureBtn = buttonContainer.querySelector('button[onclick="captureSimplePhoto()"]');
            const uploadBtn = buttonContainer.querySelector('button[onclick="uploadSimplePhoto()"]');
            
            if (captureBtn) {
                captureBtn.textContent = '🔄 重新拍照';
                captureBtn.setAttribute('onclick', 'retakeSimplePhoto()');
            }
            
            if (uploadBtn) {
                uploadBtn.style.background = '#28a745';  // 绿色突出显示
                uploadBtn.style.fontWeight = 'bold';
            }
        } else if (state === 'streaming') {
            // 视频流状态：正常的拍照按钮
            const retakeBtn = buttonContainer.querySelector('button[onclick="retakeSimplePhoto()"]');
            const uploadBtn = buttonContainer.querySelector('button[onclick="uploadSimplePhoto()"]');
            
            if (retakeBtn) {
                retakeBtn.textContent = '📸 拍照';
                retakeBtn.setAttribute('onclick', 'captureSimplePhoto()');
            }
            
            if (uploadBtn) {
                uploadBtn.style.background = '';  // 重置颜色
                uploadBtn.style.fontWeight = '';
            }
        }
    }
    
    window.uploadSimplePhoto = async function() {
        const status = document.getElementById('simple-status');
        
        if (!simpleCapturedImage) {
            status.textContent = '请先拍照';
            return;
        }
        
        if (!window.currentUserLocation) {
            status.textContent = '位置信息丢失，请重新打开拍照界面';
            return;
        }
        
        try {
            status.textContent = '正在上传...';
            
            const location = window.currentUserLocation;
            console.log('📤 准备上传照片，位置信息:', location);
            
            // 检查图片数据
            console.log('🖼️ 检查图片数据:');
            console.log('   - 图片对象:', simpleCapturedImage);
            console.log('   - 图片大小:', simpleCapturedImage.size, '字节');
            console.log('   - 图片类型:', simpleCapturedImage.type);
            console.log('   - 是否有效:', simpleCapturedImage.size > 0 && simpleCapturedImage.type.startsWith('image/'));
            
            const employeeName = '员工' + Math.floor(Math.random() * 1000);
            const timestamp = new Date().toISOString();
            
            const formData = new FormData();
            formData.append('photo', simpleCapturedImage, `checkin_${Date.now()}.jpg`);
            formData.append('employee_name', employeeName);
            formData.append('timestamp', timestamp);
            formData.append('location', JSON.stringify({
                latitude: location.latitude,
                longitude: location.longitude,
                accuracy: location.accuracy,
                distance_to_company: location.distance
            }));
            
            console.log('📋 FormData内容:');
            console.log('   - employee_name:', employeeName);
            console.log('   - timestamp:', timestamp);
            console.log('   - location:', JSON.stringify({
                latitude: location.latitude,
                longitude: location.longitude,
                accuracy: location.accuracy,
                distance: location.distance.toFixed(0) + '米'
            }));
            
            // 使用正确的API端点 - 端口8002的开发服务器
            const response = await fetch('http://localhost:8002/api/upload-checkin-photo', {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                const result = await response.json();
                status.textContent = '✅ 上传成功！';
                console.log('✅ 上传结果:', result);
                console.log('📍 打卡位置已记录: 距离公司' + location.distance.toFixed(0) + '米');
            } else {
                const errorText = await response.text();
                console.error('❌ 服务器返回错误:', response.status, errorText);
                throw new Error(`上传失败: ${response.status} - ${errorText}`);
            }
            
        } catch (error) {
            console.error('❌ 上传失败:', error);
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
