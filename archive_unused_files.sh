#!/bin/bash

# 归档不需要的文件脚本 - product_system_dev
# 创建时间: 2025-11-21

# 设置颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 工作目录
WORK_DIR="/var/www/product_system_dev"
ARCHIVE_DIR="${WORK_DIR}/archived_unused_files_$(date +%Y%m%d_%H%M%S)"
RECORD_FILE="${ARCHIVE_DIR}/file_locations_record.txt"

echo -e "${GREEN}开始归档不需要的文件...${NC}"

# 检查权限
if [ ! -w "$WORK_DIR" ]; then
    echo -e "${RED}错误: 没有写入权限，需要sudo执行${NC}"
    exit 1
fi

# 创建归档目录
mkdir -p "$ARCHIVE_DIR"
echo "归档目录: $ARCHIVE_DIR"
echo ""

# 创建记录文件头部
cat > "$RECORD_FILE" << 'EOF'
========================================
文件归档记录 - product_system_dev
创建时间: $(date '+%Y-%m-%d %H:%M:%S')
原始目录: /var/www/product_system_dev
========================================

此文件记录了所有被归档文件的原始位置
如需还原，请按照以下格式执行：
mv archived_unused_files_*/[文件名] [原始路径]

========================================
文件列表:
========================================

EOF

# 替换日期
sed -i "s/\$(date '+%Y-%m-%d %H:%M:%S')/$(date '+%Y-%m-%d %H:%M:%S')/g" "$RECORD_FILE"

echo "创建记录文件: $RECORD_FILE"
echo ""

# 归档函数
archive_file() {
    local file="$1"
    local category="$2"
    
    if [ -e "$file" ]; then
        # 记录原始位置
        echo "[${category}] ${file}" >> "$RECORD_FILE"
        
        # 移动文件
        mv "$file" "$ARCHIVE_DIR/"
        echo -e "${YELLOW}已归档:${NC} $file"
        return 0
    fi
    return 1
}

# 归档目录函数
archive_dir() {
    local dir="$1"
    local category="$2"
    
    if [ -d "$dir" ]; then
        echo "[${category}] ${dir}/ (目录)" >> "$RECORD_FILE"
        
        # 创建同名目录结构
        local dir_name=$(basename "$dir")
        mkdir -p "$ARCHIVE_DIR/$dir_name"
        
        # 移动目录内容
        mv "$dir"/* "$ARCHIVE_DIR/$dir_name/" 2>/dev/null
        # 删除空目录
        rmdir "$dir" 2>/dev/null
        
        echo -e "${YELLOW}已归档:${NC} $dir/"
        return 0
    fi
    return 1
}

cd "$WORK_DIR" || exit 1

echo "========================================="
echo "1. 归档日志文件..."
echo "========================================="
archive_file "${WORK_DIR}/connection_keepalive.log" "日志文件"

echo ""
echo "========================================="
echo "2. 归档文档文件..."
echo "========================================="
archive_file "${WORK_DIR}/CHANGELOG.md" "文档"
archive_file "${WORK_DIR}/CRITICAL_FIX.md" "文档"
archive_file "${WORK_DIR}/DEBUG_LOGIN_REDIRECT.md" "文档"
archive_file "${WORK_DIR}/DEPLOYMENT_COMPLETE.md" "文档"
archive_file "${WORK_DIR}/FACE_RECOGNITION_TEST_GUIDE.md" "文档"
archive_file "${WORK_DIR}/FIX_VERIFICATION.md" "文档"
archive_file "${WORK_DIR}/README.md" "文档"
archive_file "${WORK_DIR}/型号智能筛选优化说明.md" "文档"
archive_file "${WORK_DIR}/型号筛选和Excel导出功能说明.md" "文档"
archive_file "${WORK_DIR}/移动端优化说明.md" "文档"
archive_file "${WORK_DIR}/移动端加载和型号筛选修复说明.md" "文档"
archive_file "${WORK_DIR}/组长功能使用说明.md" "文档"
archive_file "${WORK_DIR}/问题修复说明.md" "文档"

echo ""
echo "========================================="
echo "3. 归档测试和演示HTML文件..."
echo "========================================="
archive_file "${WORK_DIR}/bootstrap_demo.html" "测试/演示文件"
archive_file "${WORK_DIR}/test.html" "测试文件"
archive_file "${WORK_DIR}/test-notification.html" "测试文件"
archive_file "${WORK_DIR}/test-polyfill.html" "测试文件"
archive_file "${WORK_DIR}/test-tabs.html" "测试文件"

echo ""
echo "========================================="
echo "4. 归档工具页面（独立使用，非主程序）..."
echo "========================================="
archive_file "${WORK_DIR}/cert-info.html" "工具页面"
archive_file "${WORK_DIR}/clear-cache.html" "工具页面"
archive_file "${WORK_DIR}/download-cert.html" "工具页面"
archive_file "${WORK_DIR}/install-ca.html" "工具页面"
archive_file "${WORK_DIR}/install-public-ca.html" "工具页面"
archive_file "${WORK_DIR}/ios-camera.html" "工具页面"
archive_file "${WORK_DIR}/ios-cert-download.html" "工具页面"
archive_file "${WORK_DIR}/ios-install.html" "工具页面"
archive_file "${WORK_DIR}/public-cert.html" "工具页面"
archive_file "${WORK_DIR}/pwa-install.html" "工具页面"
archive_file "${WORK_DIR}/refresh.html" "工具页面"

echo ""
echo "========================================="
echo "5. 归档重定向页面..."
echo "========================================="
archive_file "${WORK_DIR}/index-new.html" "重定向页面"

echo ""
echo "========================================="
echo "6. 归档备份文件..."
echo "========================================="
archive_file "${WORK_DIR}/ios-cert-download.html.backup" "备份文件"

echo ""
echo "========================================="
echo "7. 归档临时文件..."
echo "========================================="
archive_file "${WORK_DIR}/temp_file.txt" "临时文件"
archive_file "${WORK_DIR}/missing_functions.txt" "临时文件"

echo ""
echo "========================================="
echo "8. 归档验证文件..."
echo "========================================="
archive_file "${WORK_DIR}/0740f2994a8d17427aa56b1920ce34e2.txt" "域名验证文件"

echo ""
echo "========================================="
echo "9. 归档Let's Encrypt测试文件..."
echo "========================================="
archive_file "${WORK_DIR}/.well-known/acme-challenge/test-file" "Let's Encrypt测试"
archive_file "${WORK_DIR}/.well-known/acme-challenge/testfile" "Let's Encrypt测试"

echo ""
echo "========================================="
echo "10. 归档脚本文件（已完成使用）..."
echo "========================================="
archive_file "${WORK_DIR}/download_face_api.sh" "下载脚本"
archive_file "${WORK_DIR}/keep_connection_alive.py" "数据库连接脚本副本"

echo ""
echo "========================================="
echo "11. 归档旧的PHP后端（已迁移到Python）..."
echo "========================================="
archive_dir "${WORK_DIR}/api/backend" "旧PHP后端"
archive_dir "${WORK_DIR}/api/groups" "旧PHP API"
archive_dir "${WORK_DIR}/api/product-group" "旧PHP API"

echo ""
echo "========================================="
echo "12. 归档空文件和空目录..."
echo "========================================="
archive_file "${WORK_DIR}/patches/scan-integration.js" "空文件"
archive_file "${WORK_DIR}/assets/css/bootstrap-icons.css" "空文件"
archive_file "${WORK_DIR}/assets/css/bootstrap.min.css" "空文件"
archive_dir "${WORK_DIR}/assets/fonts" "空目录"
archive_dir "${WORK_DIR}/assets/js" "空目录"
archive_dir "${WORK_DIR}/cert" "空目录"
archive_dir "${WORK_DIR}/certs" "空目录"
archive_dir "${WORK_DIR}/img" "空目录"
archive_dir "${WORK_DIR}/install-cert" "空目录"

# 清理空的父目录
echo ""
echo "========================================="
echo "13. 清理空的父目录..."
echo "========================================="
rmdir "${WORK_DIR}/assets/css" 2>/dev/null && echo -e "${YELLOW}已删除空目录:${NC} ${WORK_DIR}/assets/css"
rmdir "${WORK_DIR}/assets" 2>/dev/null && echo -e "${YELLOW}已删除空目录:${NC} ${WORK_DIR}/assets"
rmdir "${WORK_DIR}/api" 2>/dev/null && echo -e "${YELLOW}已删除空目录:${NC} ${WORK_DIR}/api"
rmdir "${WORK_DIR}/.well-known/acme-challenge" 2>/dev/null && echo -e "${YELLOW}已删除空目录:${NC} ${WORK_DIR}/.well-known/acme-challenge"
rmdir "${WORK_DIR}/.well-known" 2>/dev/null && echo -e "${YELLOW}已删除空目录:${NC} ${WORK_DIR}/.well-known"

echo ""
echo "========================================="
echo -e "${GREEN}归档完成！${NC}"
echo "========================================="
echo "归档目录: $ARCHIVE_DIR"
echo "记录文件: $RECORD_FILE"
echo ""
echo "如需还原，请查看记录文件了解详情"
echo ""

# 显示统计
file_count=$(find "$ARCHIVE_DIR" -type f | wc -l)
echo "已归档文件总数: $((file_count - 1))" # 减去记录文件本身
echo ""

echo -e "${GREEN}完成！${NC}"
