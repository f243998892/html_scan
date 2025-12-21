#!/bin/bash

# 拍照打卡功能安装脚本
# 自动配置所需环境和权限

echo "🚀 开始安装拍照打卡功能..."

# 1. 确保上传目录存在且权限正确
echo "📁 配置上传目录..."
mkdir -p /var/www/product_system_dev/uploads/checkin_photos/{originals,compressed,thumbnails}
chmod -R 755 /var/www/product_system_dev/uploads
chown -R www-data:www-data /var/www/product_system_dev/uploads

# 2. 安装后端依赖
echo "📦 安装Python依赖..."
cd /home/user/product_api_dev
source venv/bin/activate
pip install pillow aiofiles

# 3. 检查nginx配置
echo "🔧 检查Nginx配置..."
if [ -f "/etc/nginx/sites-available/product_system_dev" ]; then
    # 备份现有配置
    cp /etc/nginx/sites-available/product_system_dev /etc/nginx/sites-available/product_system_dev.backup.$(date +%Y%m%d_%H%M%S)
    
    # 添加照片服务配置
    if ! grep -q "uploads/checkin_photos" /etc/nginx/sites-available/product_system_dev; then
        echo "添加照片静态文件服务配置..."
        cat >> /etc/nginx/sites-available/product_system_dev << 'EOF'

    # 拍照打卡静态文件服务
    location /uploads/checkin_photos/ {
        alias /var/www/product_system_dev/uploads/checkin_photos/;
        add_header X-Content-Type-Options nosniff;
        add_header X-Frame-Options DENY;
        expires 30d;
        add_header Cache-Control "public, immutable";
        
        location ~* \.(jpg|jpeg|png|webp)$ {
            try_files $uri =404;
        }
        location ~ \.(php|html|js|css|txt|log)$ {
            deny all;
        }
    }
EOF
        # 重新加载nginx配置
        nginx -t && systemctl reload nginx
        echo "✅ Nginx配置已更新"
    else
        echo "✅ Nginx配置已存在"
    fi
else
    echo "⚠️  未找到nginx配置文件，请手动配置"
fi

# 4. 重启后端服务
echo "🔄 重启后端服务..."
if systemctl is-active --quiet product-api; then
    systemctl restart product-api
    echo "✅ 后端服务已重启"
else
    echo "⚠️  后端服务未运行，请手动启动"
fi

# 5. 设置日志轮转
echo "📝 配置日志轮转..."
cat > /etc/logrotate.d/photo-checkin << 'EOF'
/var/www/product_system_dev/uploads/checkin_photos/checkin_log.txt {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
EOF

# 6. 创建监控脚本
echo "📊 创建监控脚本..."
cat > /var/www/product_system_dev/monitor-photo-checkin.sh << 'EOF'
#!/bin/bash
# 拍照打卡功能监控脚本

UPLOAD_DIR="/var/www/product_system_dev/uploads/checkin_photos"
DATE=$(date +%Y-%m-%d)

echo "=== 拍照打卡系统状态监控 ($DATE) ==="

# 检查磁盘使用情况
echo "📁 存储使用情况:"
du -sh $UPLOAD_DIR/*/ 2>/dev/null || echo "无数据"

# 统计今日上传数量
TODAY_COUNT=$(find $UPLOAD_DIR/compressed -name "checkin_*$(date +%Y%m%d)*" -type f | wc -l)
echo "📸 今日上传数量: $TODAY_COUNT"

# 检查目录权限
echo "🔒 目录权限:"
ls -la $UPLOAD_DIR

# 检查后端API状态
echo "🌐 API状态:"
curl -s http://localhost:8001/api/checkin-stats | grep -q "success" && echo "✅ API正常" || echo "❌ API异常"
EOF

chmod +x /var/www/product_system_dev/monitor-photo-checkin.sh

# 7. 创建清理脚本
echo "🗑️  创建清理脚本..."
cat > /var/www/product_system_dev/cleanup-old-photos.sh << 'EOF'
#!/bin/bash
# 清理30天前的照片文件

UPLOAD_DIR="/var/www/product_system_dev/uploads/checkin_photos"
DAYS_TO_KEEP=30

echo "🗑️  开始清理 $DAYS_TO_KEEP 天前的照片..."

# 清理原图（保留时间短）
find "$UPLOAD_DIR/originals" -type f -mtime +7 -name "*.jpg" -delete
echo "✅ 已清理原图"

# 清理压缩图（保留时间长）
find "$UPLOAD_DIR/compressed" -type f -mtime +$DAYS_TO_KEEP -name "*.jpg" -delete
echo "✅ 已清理压缩图"

# 清理缩略图
find "$UPLOAD_DIR/thumbnails" -type f -mtime +$DAYS_TO_KEEP -name "*.jpg" -delete
echo "✅ 已清理缩略图"

echo "🎉 清理完成"
EOF

chmod +x /var/www/product_system_dev/cleanup-old-photos.sh

# 8. 添加定时任务
echo "⏰ 配置定时任务..."
(crontab -l 2>/dev/null; echo "0 2 * * * /var/www/product_system_dev/cleanup-old-photos.sh >> /var/log/photo-checkin-cleanup.log 2>&1") | crontab -

echo "🎉 拍照打卡功能安装完成！"
echo ""
echo "📋 安装摘要:"
echo "  - 📁 上传目录已创建: $UPLOAD_DIR"
echo "  - 🔧 Nginx配置已更新"
echo "  - 📦 Python依赖已安装"
echo "  - 📝 日志轮转已配置"
echo "  - ⏰ 自动清理已配置"
echo ""
echo "🚀 现在可以测试拍照打卡功能了！"
echo "📊 监控命令: /var/www/product_system_dev/monitor-photo-checkin.sh"
