/**
 * 页面加载状态指示器
 * 显示应用初始化进度，提升用户体验
 */

(function() {
    'use strict';
    
    const LoadingIndicator = {
        indicator: null,
        statusText: null,
        progressBar: null,
        currentProgress: 0,
        
        /**
         * 初始化加载指示器
         */
        init() {
            this.indicator = document.getElementById('page-loading-indicator');
            this.statusText = document.getElementById('loading-status-text');
            this.progressBar = document.getElementById('loading-progress-bar');
            
            if (!this.indicator) {
                console.warn('[LoadingIndicator] 未找到加载指示器元素');
                return;
            }
            
            console.log('[LoadingIndicator] 初始化完成');
            this.updateProgress(10, '正在加载应用资源...');
        },
        
        /**
         * 更新加载进度
         * @param {number} progress - 进度百分比 (0-100)
         * @param {string} message - 状态消息
         */
        updateProgress(progress, message) {
            if (!this.progressBar || !this.statusText) return;
            
            this.currentProgress = Math.min(100, Math.max(0, progress));
            this.progressBar.style.width = this.currentProgress + '%';
            this.statusText.textContent = message;
            
            console.log(`[LoadingIndicator] 进度: ${this.currentProgress}% - ${message}`);
        },
        
        /**
         * 隐藏加载指示器
         */
        hide() {
            if (!this.indicator) return;
            
            // 先显示100%完成
            this.updateProgress(100, '加载完成！');
            
            // 延迟隐藏，让用户看到完成状态
            setTimeout(() => {
                if (this.indicator) {
                    this.indicator.style.transition = 'opacity 0.3s ease-out';
                    this.indicator.style.opacity = '0';
                    
                    setTimeout(() => {
                        if (this.indicator) {
                            this.indicator.style.display = 'none';
                        }
                    }, 300);
                }
                console.log('[LoadingIndicator] 已隐藏');
            }, 500);
        },
        
        /**
         * 显示加载指示器
         */
        show() {
            if (!this.indicator) return;
            
            this.indicator.style.display = 'block';
            this.indicator.style.opacity = '1';
            this.currentProgress = 0;
            this.updateProgress(0, '正在加载...');
            console.log('[LoadingIndicator] 已显示');
        }
    };
    
    // 页面加载时自动初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            LoadingIndicator.init();
        });
    } else {
        LoadingIndicator.init();
    }
    
    // 导出到全局
    window.LoadingIndicator = LoadingIndicator;
    
    // 监听应用初始化事件
    window.addEventListener('app:init:start', () => {
        LoadingIndicator.updateProgress(20, '正在初始化应用...');
    });
    
    window.addEventListener('app:init:models', () => {
        LoadingIndicator.updateProgress(40, '正在加载人脸识别模型...');
    });
    
    window.addEventListener('app:init:data', () => {
        LoadingIndicator.updateProgress(60, '正在加载数据...');
    });
    
    window.addEventListener('app:init:ui', () => {
        LoadingIndicator.updateProgress(80, '正在准备界面...');
    });
    
    window.addEventListener('app:init:complete', () => {
        LoadingIndicator.updateProgress(100, '加载完成！');
        setTimeout(() => {
            LoadingIndicator.hide();
        }, 500);
    });
    
    // 监听页面加载完成
    window.addEventListener('load', () => {
        // 如果应用没有触发完成事件，3秒后自动隐藏加载指示器
        setTimeout(() => {
            if (LoadingIndicator.currentProgress < 100) {
                LoadingIndicator.updateProgress(100, '准备就绪');
                LoadingIndicator.hide();
            }
        }, 3000);
    });
    
})();
