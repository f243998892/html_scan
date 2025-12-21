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
