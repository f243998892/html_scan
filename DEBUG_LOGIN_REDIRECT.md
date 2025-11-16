# 🔍 登录跳转问题调试指南

## 📋 当前情况

- ✅ 选项卡功能正常
- ✅ 人脸识别登录成功
- ❌ 登录后不自动跳转到主页
- ❌ 需要手动刷新才能进入主页

---

## 🧪 调试步骤

### 第1步：清除缓存并重新加载

**重要！** 必须清除浏览器缓存：
- **Windows/Linux**: `Ctrl + Shift + F5`
- **Mac**: `Cmd + Shift + R`

或在控制台执行：
```javascript
localStorage.clear();
location.reload(true);
```

---

### 第2步：打开浏览器控制台

1. 按 `F12` 打开开发者工具
2. 切换到 **Console（控制台）** 标签
3. 保持控制台打开

---

### 第3步：进行人脸登录

1. 打开登录页面
2. 点击"开始人脸识别登录"
3. 等待识别成功

---

### 第4步：查看控制台输出

登录成功后，控制台应该显示详细的调试信息：

#### ✅ 正常流程应该显示：

```
开始人脸登录流程...
✅ 模型加载完成，耗时: 0.05秒
人脸登录成功: 用户名
准备跳转到主页...
onFaceLoginSuccess类型: function
调用onFaceLoginSuccess函数
====================================
🎉 onFaceLoginSuccess 被调用
用户名称: 用户名
====================================
1. 设置用户状态...
   ✅ 用户状态已设置: 用户名
2. 更新UI显示...
   ✅ UI已更新
3. 加载工序设置...
   ✅ 工序设置已加载
4. 导航到主页...
   SCREENS.HOME: home-screen
切换到页面: home-screen
   ✅ 已调用navigateToHome
5. 显示欢迎提示...
   ✅ 欢迎提示已显示
====================================
✅ onFaceLoginSuccess 执行完成
====================================
```

---

### 第5步：诊断问题

根据控制台输出判断问题：

#### 情况A：看不到 "🎉 onFaceLoginSuccess 被调用"

**问题**：回调函数没有被调用

**可能原因**：
1. app-new.js 没有正确加载
2. 缓存没有清除

**解决方案**：
```javascript
// 在控制台检查
console.log('onFaceLoginSuccess:', typeof window.onFaceLoginSuccess);
// 应该显示: function

// 如果显示 undefined，强制刷新
location.reload(true);
```

---

#### 情况B：看到 "🎉 onFaceLoginSuccess 被调用"，但在某个步骤后停止

**问题**：某个步骤执行出错

**查看**：
- 控制台是否有红色错误信息
- 在哪一步停止了

**常见错误及解决方案**：

1. **停在步骤1（设置用户状态）**
   ```javascript
   // 检查userState是否存在
   console.log('userState:', userState);
   ```

2. **停在步骤2（更新UI显示）**
   ```javascript
   // 检查updateUserDisplay函数
   console.log('updateUserDisplay:', typeof updateUserDisplay);
   ```

3. **停在步骤3（加载工序设置）**
   ```javascript
   // 检查loadSavedProcessSelection函数
   console.log('loadSavedProcessSelection:', typeof loadSavedProcessSelection);
   ```

4. **停在步骤4（导航到主页）**
   ```javascript
   // 检查navigateToHome函数
   console.log('navigateToHome:', typeof navigateToHome);
   console.log('SCREENS:', SCREENS);
   console.log('home-screen元素:', document.getElementById('home-screen'));
   ```

5. **停在步骤5（显示欢迎提示）**
   ```javascript
   // 检查showToast函数
   console.log('showToast:', typeof showToast);
   console.log('window.showToast:', typeof window.showToast);
   ```

---

#### 情况C：所有步骤都显示 ✅，但页面没有切换

**问题**：showScreen函数可能有问题，或者HOME屏幕元素不存在

**检查**：
```javascript
// 检查HOME屏幕是否存在
const homeScreen = document.getElementById('home-screen');
console.log('home-screen元素:', homeScreen);
console.log('是否可见:', homeScreen ? !homeScreen.classList.contains('d-none') : 'N/A');

// 检查LOGIN屏幕是否隐藏
const loginScreen = document.getElementById('login-screen');
console.log('login-screen元素:', loginScreen);
console.log('是否可见:', loginScreen ? !loginScreen.classList.contains('d-none') : 'N/A');
```

**手动测试跳转**：
```javascript
// 手动调用navigateToHome
navigateToHome();

// 或直接调用showScreen
showScreen('home-screen');
```

---

#### 情况D：看到 "❌ onFaceLoginSuccess 执行出错"

**问题**：某个步骤抛出了异常

**查看**：
- 错误信息
- 错误堆栈

**根据错误信息解决**

---

## 🔍 手动验证各个组件

### 验证回调函数是否存在

```javascript
console.log('window.onFaceLoginSuccess:', typeof window.onFaceLoginSuccess);
// 应该: function
```

### 验证所有依赖函数

```javascript
console.log('userState:', typeof userState);
console.log('updateUserDisplay:', typeof updateUserDisplay);
console.log('loadSavedProcessSelection:', typeof loadSavedProcessSelection);
console.log('navigateToHome:', typeof navigateToHome);
console.log('showScreen:', typeof showScreen);
console.log('showToast:', typeof showToast);
console.log('SCREENS:', SCREENS);
```

### 验证页面元素

```javascript
console.log('login-screen:', document.getElementById('login-screen'));
console.log('home-screen:', document.getElementById('home-screen'));
```

### 手动测试登录成功流程

```javascript
// 模拟登录成功
window.onFaceLoginSuccess('测试用户');
```

---

## 🛠️ 常见问题及解决方案

### 问题1：回调函数未定义

**症状**：`typeof window.onFaceLoginSuccess` 返回 `undefined`

**解决**：
1. 确认 app-new.js 已加载
2. 清除缓存并硬刷新
3. 检查版本号是否为 `v=3.14`

### 问题2：页面元素不存在

**症状**：`document.getElementById('home-screen')` 返回 `null`

**解决**：
1. 检查 index.html 中是否有 `id="home-screen"` 的元素
2. 可能页面结构有问题

### 问题3：函数执行但页面不切换

**症状**：所有日志都显示 ✅，但页面仍然是登录界面

**解决**：
```javascript
// 强制显示主页，隐藏登录页
document.getElementById('login-screen').classList.add('d-none');
document.getElementById('home-screen').classList.remove('d-none');
```

### 问题4：缓存问题

**症状**：修改代码后没有生效

**解决**：
```javascript
// 清除所有缓存
if ('caches' in window) {
    caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
    });
}
localStorage.clear();
sessionStorage.clear();
location.reload(true);
```

---

## 📞 收集调试信息

如果问题仍然存在，请在控制台运行以下命令，并截图：

```javascript
// 收集诊断信息
console.log('=== 诊断信息 ===');
console.log('1. Bootstrap:', typeof bootstrap);
console.log('2. faceapi:', typeof faceapi);
console.log('3. onFaceLoginSuccess:', typeof window.onFaceLoginSuccess);
console.log('4. navigateToHome:', typeof navigateToHome);
console.log('5. showScreen:', typeof showScreen);
console.log('6. SCREENS:', SCREENS);
console.log('7. userState:', userState);
console.log('8. login-screen 存在:', !!document.getElementById('login-screen'));
console.log('9. home-screen 存在:', !!document.getElementById('home-screen'));
console.log('10. app-new.js URL:', 
    Array.from(document.scripts).find(s => s.src.includes('app-new')).src
);
```

---

## ✅ 快速测试命令

### 测试1：验证所有函数已加载

```javascript
const checks = [
    ['Bootstrap', typeof bootstrap],
    ['onFaceLoginSuccess', typeof window.onFaceLoginSuccess],
    ['navigateToHome', typeof navigateToHome],
    ['showScreen', typeof showScreen],
    ['showToast', typeof showToast],
    ['updateUserDisplay', typeof updateUserDisplay],
    ['loadSavedProcessSelection', typeof loadSavedProcessSelection]
];

checks.forEach(([name, type]) => {
    console.log(`${type === 'function' || type === 'object' ? '✅' : '❌'} ${name}: ${type}`);
});
```

### 测试2：验证DOM元素

```javascript
['login-screen', 'home-screen'].forEach(id => {
    const el = document.getElementById(id);
    const visible = el && !el.classList.contains('d-none');
    console.log(`${el ? '✅' : '❌'} ${id} - 存在:${!!el}, 可见:${visible}`);
});
```

### 测试3：手动触发登录流程

```javascript
// 设置测试用户
localStorage.setItem('user_full_name', '测试用户');

// 手动调用回调
window.onFaceLoginSuccess('测试用户');
```

---

## 📝 版本信息

- **app-new.js**: v=3.14 (2025-11-16 14:50)
- **face-recognition.js**: v=1.2
- **Bootstrap**: v=5.3.0
- **修改内容**: 在 onFaceLoginSuccess 中添加详细的调试日志

---

**现在请按照调试步骤操作，并告诉我控制台显示了什么！** 🔍
