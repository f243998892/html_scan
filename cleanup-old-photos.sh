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
