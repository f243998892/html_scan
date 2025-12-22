/**
 * 拍照打卡范围配置管理模块
 * 支持地理位置、时间、网络等多维度限制
 */

class CheckinRangeConfig {
    constructor() {
        this.config = {
            // 地理位置限制
            location: {
                enabled: true,
                centerLat: 39.075277,  // 公司纬度（北纬 39°4'31"）
                centerLng: 117.037222, // 公司经度（东经 117°2'14"）
                radius: 500,         // 允许打卡范围半径（米）
                accuracy: 100,       // GPS精度要求（米）
                timeout: 15000       // 定位超时时间（毫秒）
            },
            // 时间限制
            timeRange: {
                enabled: true,
                workDays: [1, 2, 3, 4, 5], // 周一到周五（0=周日）
                timeSlots: [
                    { start: '07:00', end: '09:00', name: '上班打卡' },
                    { start: '11:30', end: '13:30', name: '午休打卡' },
                    { start: '17:00', end: '19:00', name: '下班打卡' }
                ]
            },
            // 管理员设置
            admin: {
                bypassEnabled: true,
                emergencyCode: 'ADMIN2024'
            }
        };
        
        this.loadConfig();
    }
    
    /**
     * 从localStorage加载配置
     */
    loadConfig() {
        try {
            const saved = localStorage.getItem('checkin-range-config');
            if (saved) {
                const savedConfig = JSON.parse(saved);
                this.config = { ...this.config, ...savedConfig };
            }
            console.log('✅ 打卡范围配置已加载');
        } catch (error) {
            console.error('❌ 加载打卡范围配置失败:', error);
        }
    }
    
    /**
     * 保存配置
     */
    saveConfig() {
        try {
            localStorage.setItem('checkin-range-config', JSON.stringify(this.config));
            console.log('✅ 打卡范围配置已保存');
            return true;
        } catch (error) {
            console.error('❌ 保存打卡范围配置失败:', error);
            return false;
        }
    }
    
    /**
     * 检查是否允许打卡
     */
    async checkCheckinAllowed() {
        const checks = {
            time: await this.checkTimeRange(),
            location: await this.checkLocationRange(),
            overall: { passed: false, message: '', restrictions: [] }
        };
        
        // 综合判断
        const restrictions = [];
        if (!checks.time.passed) restrictions.push('时间限制');
        if (!checks.location.passed) restrictions.push('位置限制');
        
        checks.overall.passed = restrictions.length === 0;
        checks.overall.restrictions = restrictions;
        
        if (checks.overall.passed) {
            checks.overall.message = '✅ 允许打卡';
        } else {
            checks.overall.message = `❌ 不允许打卡，限制条件: ${restrictions.join(', ')}`;
        }
        
        return checks;
    }
    
    /**
     * 检查时间范围
     */
    async checkTimeRange() {
        if (!this.config.timeRange.enabled) {
            return { passed: true, message: '时间检查已禁用' };
        }
        
        const now = new Date();
        const weekday = now.getDay();
        const currentTime = now.toTimeString().slice(0, 5); // HH:MM格式
        
        // 检查工作日
        if (!this.config.timeRange.workDays.includes(weekday)) {
            return {
                passed: false,
                message: '❌ 今天不是工作日',
                data: { weekday, currentTime }
            };
        }
        
        // 检查时间段
        const allowedSlot = this.config.timeRange.timeSlots.find(slot => {
            return currentTime >= slot.start && currentTime <= slot.end;
        });
        
        if (!allowedSlot) {
            const nextSlot = this.config.timeRange.timeSlots.find(slot => currentTime < slot.start) 
                           || this.config.timeRange.timeSlots[0];
            return {
                passed: false,
                message: `❌ 当前时间 ${currentTime} 不在打卡时间范围内，下次打卡时间: ${nextSlot.start}-${nextSlot.end}`,
                data: { currentTime, nextSlot }
            };
        }
        
        return {
            passed: true,
            message: `✅ 时间检查通过 (${allowedSlot.name})`,
            data: { currentTime, slot: allowedSlot }
        };
    }
    
    /**
     * 检查地理位置范围
     */
    async checkLocationRange() {
        if (!this.config.location.enabled) {
            return { passed: true, message: '位置检查已禁用' };
        }
        
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                resolve({
                    passed: false,
                    message: '❌ 设备不支持GPS定位'
                });
                return;
            }
            
            const options = {
                enableHighAccuracy: true,
                timeout: this.config.location.timeout,
                maximumAge: 60000
            };
            
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const userLat = position.coords.latitude;
                    const userLng = position.coords.longitude;
                    const accuracy = position.coords.accuracy;
                    
                    // 检查GPS精度
                    if (accuracy > this.config.location.accuracy) {
                        resolve({
                            passed: false,
                            message: `❌ GPS精度不足 (${accuracy.toFixed(0)}m)，请到空旷地区重试`
                        });
                        return;
                    }
                    
                    // 计算距离
                    const distance = this.calculateDistance(
                        userLat, userLng,
                        this.config.location.centerLat, this.config.location.centerLng
                    );
                    
                    if (distance > this.config.location.radius) {
                        resolve({
                            passed: false,
                            message: `❌ 距离公司太远 (${distance.toFixed(0)}m > ${this.config.location.radius}m)`
                        });
                        return;
                    }
                    
                    resolve({
                        passed: true,
                        message: `✅ 位置检查通过 (距离公司 ${distance.toFixed(0)}m)`
                    });
                },
                (error) => {
                    let message = '❌ 无法获取位置: ';
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            message += '请允许位置权限';
                            break;
                        case error.POSITION_UNAVAILABLE:
                            message += '位置服务不可用';
                            break;
                        case error.TIMEOUT:
                            message += '定位超时';
                            break;
                        default:
                            message += '定位失败';
                    }
                    resolve({ passed: false, message });
                },
                options
            );
        });
    }
    
    /**
     * 计算两点间距离（米）
     */
    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371000; // 地球半径（米）
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }
    
    /**
     * 管理员绕过检查
     */
    adminBypass(code) {
        if (this.config.admin.bypassEnabled && code === this.config.admin.emergencyCode) {
            return { passed: true, message: '✅ 管理员绕过验证成功' };
        }
        return { passed: false, message: '❌ 绕过验证码错误' };
    }
}

// 全局实例
window.CheckinRangeConfig = CheckinRangeConfig;
