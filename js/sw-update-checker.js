// Service Worker自动更新检测器

class ServiceWorkerUpdateChecker {
  constructor() {
    this.registration = null;
    this.updateFound = false;
  }

  // 初始化Service Worker
  async init() {
    if (!('serviceWorker' in navigator)) {
      console.log('浏览器不支持Service Worker');
      return;
    }

    try {
      // 注册Service Worker
      this.registration = await navigator.serviceWorker.register('/service-worker.js');
      console.log('Service Worker注册成功');

      // 监听更新
      this.checkForUpdates();
      
      // 每30分钟检查一次更新
      setInterval(() => this.checkForUpdates(), 30 * 60 * 1000);
      
      // 页面可见时检查更新
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          this.checkForUpdates();
        }
      });

    } catch (error) {
      console.error('Service Worker注册失败:', error);
    }
  }

  // 检查更新
  async checkForUpdates() {
    if (!this.registration) return;

    try {
      // 手动触发更新检查
      await this.registration.update();
      console.log('已检查Service Worker更新');
    } catch (error) {
      console.error('检查更新失败:', error);
    }
  }

  // 监听Service Worker状态变化
  setupUpdateListener() {
    if (!this.registration) return;

    // 监听installing状态
    this.registration.addEventListener('updatefound', () => {
      const newWorker = this.registration.installing;
      console.log('发现新版本Service Worker');

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // 新版本已安装，但旧版本仍在控制页面
          this.showUpdateNotification();
        }
      });
    });
  }

  // 显示更新通知
  showUpdateNotification() {
    // 使用您现有的toast提示
    if (typeof showToast === 'function') {
      showToast('发现新版本，刷新页面以更新', 'info');
    }

    // 或者显示一个更明显的提示框
    const updateBanner = document.createElement('div');
    updateBanner.id = 'sw-update-banner';
    updateBanner.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: #007bff;
        color: white;
        padding: 12px 20px;
        text-align: center;
        z-index: 10000;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      ">
        <strong>🎉 发现新版本！</strong>
        <span style="margin: 0 10px;">点击刷新以获取最新功能</span>
        <button onclick="location.reload()" style="
          background: white;
          color: #007bff;
          border: none;
          padding: 6px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
          margin: 0 5px;
        ">立即刷新</button>
        <button onclick="this.parentElement.parentElement.remove()" style="
          background: transparent;
          color: white;
          border: 1px solid white;
          padding: 6px 16px;
          border-radius: 4px;
          cursor: pointer;
          margin: 0 5px;
        ">稍后</button>
      </div>
    `;
    document.body.appendChild(updateBanner);
  }

  // 强制更新（立即应用新版本）
  async forceUpdate() {
    if (!this.registration || !this.registration.waiting) {
      console.log('没有等待中的Service Worker');
      return;
    }

    // 发送消息给waiting的Service Worker，让它跳过等待
    this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });

    // 监听控制器变化
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('Service Worker已更新，刷新页面...');
      window.location.reload();
    });
  }

  // 获取当前Service Worker版本
  async getCurrentVersion() {
    if (!navigator.serviceWorker.controller) {
      return 'no-sw';
    }

    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();
      messageChannel.port1.onmessage = (event) => {
        resolve(event.data.version);
      };
      navigator.serviceWorker.controller.postMessage(
        { type: 'GET_VERSION' },
        [messageChannel.port2]
      );
    });
  }

  // 手动清除所有缓存（调试用）
  async clearAllCaches() {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
    console.log('所有缓存已清除');
    
    // 注销Service Worker
    if (this.registration) {
      await this.registration.unregister();
      console.log('Service Worker已注销');
    }
    
    // 刷新页面
    window.location.reload();
  }
}

// 全局实例
const swUpdateChecker = new ServiceWorkerUpdateChecker();

// 页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => swUpdateChecker.init());
} else {
  swUpdateChecker.init();
}

// 暴露到全局，方便调试
window.swUpdateChecker = swUpdateChecker;

// 开发者工具：手动检查更新
// 在控制台输入：swUpdateChecker.checkForUpdates()

// 开发者工具：强制更新
// 在控制台输入：swUpdateChecker.forceUpdate()

// 开发者工具：清除所有缓存
// 在控制台输入：swUpdateChecker.clearAllCaches()

// 开发者工具：查看当前版本
// 在控制台输入：swUpdateChecker.getCurrentVersion().then(console.log)
