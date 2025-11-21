#\!/bin/bash

# 归档自签名证书脚本
# 创建时间: 2025-11-21

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

WORK_DIR="/var/www/product_system_dev"
# 使用已有的归档目录
ARCHIVE_DIR="${WORK_DIR}/archived_unused_files_20251121_220417"
RECORD_FILE="${ARCHIVE_DIR}/file_locations_record.txt"

if [ \! -d "$ARCHIVE_DIR" ]; then
    echo -e "${RED}错误: 归档目录不存在${NC}"
    exit 1
fi

if [ \! -w "$WORK_DIR" ]; then
    echo -e "${RED}错误: 没有写入权限，需要sudo执行${NC}"
    exit 1
fi

echo -e "${GREEN}开始归档自签名证书文件...${NC}"
echo ""

cd "$WORK_DIR" || exit 1

# 添加证书归档说明到记录文件
echo "" >> "$RECORD_FILE"
echo "========================================" >> "$RECORD_FILE"
echo "补充归档 - 自签名证书 (2025-11-21 22:10)" >> "$RECORD_FILE"
echo "========================================" >> "$RECORD_FILE"
echo "" >> "$RECORD_FILE"

archive_file() {
    local file="$1"
    local category="$2"
    
    if [ -e "$file" ]; then
        echo "[${category}] ${file}" >> "$RECORD_FILE"
        mv "$file" "$ARCHIVE_DIR/"
        echo -e "${YELLOW}已归档:${NC} $file"
        return 0
    fi
    return 1
}

archive_dir() {
    local dir="$1"
    local category="$2"
    
    if [ -d "$dir" ]; then
        echo "[${category}] ${dir}/ (目录)" >> "$RECORD_FILE"
        
        local dir_name=$(basename "$dir")
        mkdir -p "$ARCHIVE_DIR/$dir_name"
        
        # 移动目录内容
        if [ "$(ls -A "$dir")" ]; then
            mv "$dir"/* "$ARCHIVE_DIR/$dir_name/" 2>/dev/null
        fi
        rmdir "$dir" 2>/dev/null
        
        echo -e "${YELLOW}已归档:${NC} $dir/"
        return 0
    fi
    return 1
}

echo "归档自签名证书文件..."
echo "=================================="

# 归档ca目录下的证书
archive_file "${WORK_DIR}/ca/rootCA.cer" "自签名证书"
archive_file "${WORK_DIR}/ca/rootCA.der" "自签名证书"
archive_dir "${WORK_DIR}/ca/internal" "自签名证书目录"

# 检查ca目录是否为空，如果为空则删除
if [ -d "${WORK_DIR}/ca" ] && [ \! "$(ls -A ${WORK_DIR}/ca)" ]; then
    rmdir "${WORK_DIR}/ca"
    echo "[自签名证书目录] ${WORK_DIR}/ca/ (空目录已删除)" >> "$RECORD_FILE"
    echo -e "${YELLOW}已删除空目录:${NC} ${WORK_DIR}/ca/"
fi

# 归档public-ca目录
archive_dir "${WORK_DIR}/public-ca" "公共自签名证书目录"

echo ""
echo -e "${GREEN}证书归档完成！${NC}"
echo ""

# 统计
cert_count=$(grep -c "自签名证书" "$RECORD_FILE")
echo "已归档证书文件: ${cert_count} 个"
echo ""
echo "记录已追加到: $RECORD_FILE"
