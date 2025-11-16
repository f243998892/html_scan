# 身份验证方案对比

## 方案A：严格白名单（需要管理员）

### 流程
```
1. 管理员预先录入员工名单到数据库
   - 张三
   - 李四
   - 王五
   ...

2. 用户注册时
   输入姓名 → 检查白名单 → 存在才允许注册人脸

3. 用户登录时
   人脸识别 → 匹配数据库 → 返回姓名
```

### 实现方式

#### 数据库设计
```sql
-- 员工白名单表
CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) UNIQUE NOT NULL,
    department VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active',  -- active/inactive
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 人脸特征表
CREATE TABLE face_features (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id),
    face_descriptor BYTEA NOT NULL,
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### API接口
```python
# 1. 检查用户是否在白名单
@app.get("/api/auth/check-whitelist/{name}")
async def check_whitelist(name: str):
    """检查姓名是否在员工白名单中"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute(
        "SELECT id, full_name, status FROM employees WHERE full_name = %s",
        (name,)
    )
    employee = cursor.fetchone()
    
    if not employee:
        return {"allowed": False, "message": "该姓名不在员工名单中"}
    
    if employee['status'] != 'active':
        return {"allowed": False, "message": "该员工账号已停用"}
    
    return {"allowed": True, "employee_id": employee['id']}

# 2. 注册人脸（需要先通过白名单检查）
@app.post("/api/face/register")
async def register_face(request: FaceRegisterRequest):
    """注册人脸特征"""
    # 先检查白名单
    whitelist_check = await check_whitelist(request.name)
    if not whitelist_check['allowed']:
        raise HTTPException(status_code=403, detail=whitelist_check['message'])
    
    # 通过白名单，保存人脸特征
    # ...
```

#### 前端注册流程
```javascript
async function handleFaceRegister() {
    const name = document.getElementById('username').value.trim();
    
    // 1. 检查白名单
    const whitelistCheck = await fetch(`/api/auth/check-whitelist/${encodeURIComponent(name)}`);
    const result = await whitelistCheck.json();
    
    if (!result.allowed) {
        showToast(result.message, 'error');
        return;
    }
    
    // 2. 白名单验证通过，继续录入人脸
    showToast('姓名验证通过，请录入人脸', 'success');
    startFaceCapture();
}
```

### 优点
- ✅ 安全性最高
- ✅ 只有真实员工可以注册
- ✅ 便于管理（离职员工可停用）

### 缺点
- ❌ 需要管理员录入初始数据
- ❌ 新员工入职需要管理员添加
- ❌ 维护成本高

### 适用场景
- 员工数量少（<100人）
- 人员变动不频繁
- 需要严格权限控制

---

## 方案B：开放注册 + 人脸绑定（推荐）✅

### 流程
```
1. 无需预先录入名单

2. 用户首次使用
   输入姓名 → 录入人脸 → 保存绑定 → 立即可用

3. 后续登录
   人脸识别 → 自动登录

4. 防止冒充
   每个人只能用自己的脸注册
   登录时必须人脸匹配
```

### 实现方式

#### 数据库设计
```sql
-- 只需要一个表
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) UNIQUE NOT NULL,
    face_descriptor BYTEA NOT NULL,
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- 可选：记录登录历史
CREATE TABLE login_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(50)
);
```

#### API接口
```python
# 1. 检查姓名是否已被注册
@app.get("/api/users/check/{name}")
async def check_user_exists(name: str):
    """检查姓名是否已被使用"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute(
        "SELECT full_name FROM users WHERE full_name = %s",
        (name,)
    )
    user = cursor.fetchone()
    
    return {"exists": user is not None}

# 2. 注册（姓名 + 人脸）
@app.post("/api/face/register")
async def register_face(request: FaceRegisterRequest):
    """注册新用户"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 检查姓名是否已被使用
    cursor.execute(
        "SELECT id FROM users WHERE full_name = %s",
        (request.name,)
    )
    if cursor.fetchone():
        raise HTTPException(status_code=400, detail="该姓名已被注册")
    
    # 保存用户和人脸特征
    descriptor_bytes = np.array(request.descriptor).tobytes()
    cursor.execute(
        "INSERT INTO users (full_name, face_descriptor) VALUES (%s, %s)",
        (request.name, descriptor_bytes)
    )
    conn.commit()
    
    return {"success": True, "message": "注册成功"}

# 3. 人脸登录
@app.post("/api/face/login")
async def face_login(request: FaceLoginRequest):
    """人脸识别登录"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 获取所有用户的人脸特征
    cursor.execute("SELECT id, full_name, face_descriptor FROM users")
    users = cursor.fetchall()
    
    # 计算相似度
    input_descriptor = np.array(request.descriptor)
    best_match = None
    best_similarity = 0
    
    for user in users:
        stored_descriptor = np.frombuffer(user['face_descriptor'])
        similarity = cosine_similarity(input_descriptor, stored_descriptor)
        
        if similarity > best_similarity:
            best_similarity = similarity
            best_match = user
    
    # 相似度阈值：0.6
    if best_similarity > 0.6:
        # 更新最后登录时间
        cursor.execute(
            "UPDATE users SET last_login = NOW() WHERE id = %s",
            (best_match['id'],)
        )
        conn.commit()
        
        return {
            "success": True,
            "name": best_match['full_name'],
            "similarity": float(best_similarity)
        }
    else:
        raise HTTPException(status_code=404, detail="未识别到注册用户")
```

#### 前端注册流程
```javascript
async function handleFaceRegister() {
    const name = document.getElementById('username').value.trim();
    
    if (!name) {
        showToast('请输入姓名', 'warning');
        return;
    }
    
    // 1. 检查姓名是否已被使用
    const checkRes = await fetch(`/api/users/check/${encodeURIComponent(name)}`);
    const checkData = await checkRes.json();
    
    if (checkData.exists) {
        showToast('该姓名已被注册，请直接使用人脸登录', 'warning');
        // 切换到登录标签页
        switchToLoginTab();
        return;
    }
    
    // 2. 姓名可用，开始录入人脸
    showToast('请正视摄像头，准备拍摄人脸', 'info');
    const descriptor = await captureFaceDescriptor();
    
    if (!descriptor) {
        showToast('未检测到人脸，请重试', 'error');
        return;
    }
    
    // 3. 提交注册
    const registerRes = await fetch('/api/face/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: name,
            descriptor: descriptor
        })
    });
    
    if (registerRes.ok) {
        showToast('注册成功！', 'success');
        // 保存到localStorage，实现"记住登录"
        localStorage.setItem('user_full_name', name);
        userState.fullName = name;
        navigateToHome();
    }
}
```

### 优点
- ✅ 无需管理员介入，用户自助
- ✅ 新员工入职立即可用
- ✅ 防止冒充（人脸唯一）
- ✅ 姓名 + 人脸双重绑定
- ✅ 实施简单

### 缺点
- ⚠️ 需要防止恶意注册（见下方增强方案）
- ⚠️ 姓名可能重复（需提示用户加后缀）

### 适用场景
- ✅ 您的需求："简单防止他人登录 + 用户自行操作"
- ✅ 员工较多，人员流动性大
- ✅ 无需严格权限分级

---

## 方案C：混合方案（开放注册 + 后台审核）

### 流程
```
1. 用户自助注册（姓名 + 人脸）
   → 状态：pending（待审核）
   → 可以查看功能，但无法录入数据

2. 管理员后台审核
   → 通过：状态改为 active
   → 拒绝：删除或标记为 rejected

3. 审核通过后
   → 用户可以正常使用所有功能
```

### 实现方式
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) UNIQUE NOT NULL,
    face_descriptor BYTEA NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',  -- pending/active/rejected
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_by VARCHAR(100),
    approved_at TIMESTAMP
);
```

### 优点
- ✅ 用户可以自助注册
- ✅ 管理员有审核权
- ✅ 防止恶意注册

### 缺点
- ⚠️ 需要开发审核界面
- ⚠️ 用户注册后需等待审核

---

## 方案对比总结

| 特性 | 方案A<br>严格白名单 | 方案B<br>开放注册 | 方案C<br>混合方案 |
|------|-------------------|------------------|------------------|
| 用户自助注册 | ❌ 需管理员添加 | ✅ 完全自助 | ⚠️ 注册后需审核 |
| 防止冒充 | ✅ 人脸验证 | ✅ 人脸验证 | ✅ 人脸验证 |
| 防止恶意注册 | ✅ 白名单控制 | ⚠️ 需额外措施 | ✅ 后台审核 |
| 管理员工作量 | 高 | 低 | 中 |
| 新员工上手 | 慢 | 快 | 中 |
| 实施复杂度 | 高 | 低 | 中 |
| **适合您的需求** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

---

## 针对方案B的增强措施

### 防止恶意注册

#### 措施1：限制注册频率
```javascript
// 记录IP地址，限制每个IP每天只能注册1次
CREATE TABLE registration_limits (
    ip_address VARCHAR(50) PRIMARY KEY,
    registration_count INTEGER DEFAULT 0,
    last_registration TIMESTAMP,
    daily_limit INTEGER DEFAULT 1
);
```

#### 措施2：姓名格式验证
```javascript
function validateName(name) {
    // 必须是中文姓名，2-4个字
    if (!/^[\u4e00-\u9fa5]{2,4}$/.test(name)) {
        return { valid: false, message: '请输入2-4个中文字符的真实姓名' };
    }
    
    // 不允许特殊字符
    return { valid: true };
}
```

#### 措施3：人脸质量检测
```javascript
// 拒绝明显的照片/视频
async function checkFaceLiveness(video) {
    // 要求眨眼
    // 要求转头
    // 检测是否为真人
}
```

#### 措施4：重复人脸检测
```python
@app.post("/api/face/register")
async def register_face(request: FaceRegisterRequest):
    # 检查该人脸是否已注册过（防止一人注册多个账号）
    existing_users = cursor.execute("SELECT * FROM users")
    
    for user in existing_users:
        similarity = calculate_similarity(request.descriptor, user.descriptor)
        if similarity > 0.8:  # 很高的相似度
            raise HTTPException(
                status_code=400,
                detail=f"检测到与用户「{user.full_name}」人脸相似，一人只能注册一个账号"
            )
    
    # 继续注册...
```

---

## 推荐方案：方案B（开放注册 + 增强措施）

### 为什么推荐？

1. **符合您的需求**
   - ✅ 简单防止他人登录（人脸验证）
   - ✅ 用户自行操作（无需管理员）
   - ✅ 实施简单，维护成本低

2. **安全性足够**
   - 人脸特征唯一，无法伪造
   - 姓名 + 人脸双重绑定
   - 无法冒充他人

3. **用户体验好**
   - 新员工立即可用
   - 注册流程简单
   - 记住登录，无需重复认证

4. **可扩展**
   - 后续可以添加审核功能
   - 可以添加组长/管理员权限
   - 可以添加人脸更新功能

### 实施建议

#### 第一阶段：基础功能
```
✅ 注册：姓名 + 人脸录入
✅ 登录：人脸识别
✅ 记住登录：localStorage
✅ 防重复姓名：数据库唯一约束
```

#### 第二阶段：增强安全
```
✅ 防重复人脸：相似度检测
✅ 姓名格式验证：中文2-4字
✅ 注册频率限制：IP限制
```

#### 第三阶段：管理功能（可选）
```
✅ 用户列表：查看所有注册用户
✅ 删除用户：处理离职/错误注册
✅ 人脸更新：允许用户重新录入人脸
```
