#!/bin/bash

# 还原归档文件脚本 - product_system_dev
# 使用方法: ./restore_archived_files.sh [归档目录名]

# 设置颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

WORK_DIR="/var/www/product_system_dev"

# 检查参数
if [ -z "$1" ]; then
    echo -e "${RED}错误: 请提供归档目录名${NC}"
    echo "用法: $0 <归档目录名>"
    echo ""
    echo "可用的归档目录："
    ls -d ${WORK_DIR}/archived_unused_files_* 2>/dev/null || echo "  (未找到归档目录)"
    exit 1
fi

ARCHIVE_DIR="$1"

# 如果只提供了目录名，补全完整路径
if [[ "$ARCHIVE_DIR" != /* ]]; then
    ARCHIVE_DIR="${WORK_DIR}/${ARCHIVE_DIR}"
fi

# 检查归档目录是否存在
if [ ! -d "$ARCHIVE_DIR" ]; then
    echo -e "${RED}错误: 归档目录不存在: $ARCHIVE_DIR${NC}"
    exit 1
fi

RECORD_FILE="${ARCHIVE_DIR}/file_locations_record.txt"

# 检查记录文件是否存在
if [ ! -f "$RECORD_FILE" ]; then
    echo -e "${RED}错误: 记录文件不存在: $RECORD_FILE${NC}"
    exit 1
fi

# 检查权限
if [ ! -w "$WORK_DIR" ]; then
    echo -e "${RED}错误: 没有写入权限，需要sudo执行${NC}"
    exit 1
fi

echo -e "${YELLOW}警告: 此操作将还原所有归档的文件到原始位置${NC}"
echo "归档目录: $ARCHIVE_DIR"
echo ""
read -p "确定要继续吗? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "操作已取消"
    exit 0
fi

echo ""
echo -e "${GREEN}开始还原文件...${NC}"
echo ""

cd "$WORK_DIR" || exit 1

# 读取记录文件并还原
restored_count=0
while IFS= read -r line; do
    # 跳过注释和空行
    if [[ "$line" =~ ^[[:space:]]*$ ]] || [[ "$line" =~ ^=+ ]] || [[ "$line" =~ ^此文件 ]] || [[ "$line" =~ ^如需还原 ]] || [[ "$line" =~ ^mv\ archived ]] || [[ "$line" =~ ^文件列表 ]] || [[ "$line" =~ ^创建时间 ]] || [[ "$line" =~ ^原始目录 ]]; then
        continue
    fi
    
    # 解析文件路径 (格式: [类别] 路径)
    if [[ "$line" =~ \[.*\][[:space:]](.+) ]]; then
        original_path="${BASH_REMATCH[1]}"
        
        # 处理目录标记
        if [[ "$original_path" == *" (目录)" ]]; then
            original_path="${original_path% (目录)}"
            original_path="${original_path%/}"  # 移除末尾的斜杠
            
            # 获取目录名
            dir_name=$(basename "$original_path")
            archived_dir="${ARCHIVE_DIR}/${dir_name}"
            
            # 检查归档目录是否存在
            if [ -d "$archived_dir" ]; then
                # 创建原始目录
                mkdir -p "$original_path"
                # 还原目录内容
                mv "$archived_dir"/* "$original_path/" 2>/dev/null
                rmdir "$archived_dir" 2>/dev/null
                echo -e "${GREEN}已还原:${NC} $original_path/ (目录)"
                ((restored_count++))
            else
                echo -e "${YELLOW}跳过(目录不存在):${NC} $archived_dir"
            fi
        else
            # 处理文件
            filename=$(basename "$original_path")
            archived_file="${ARCHIVE_DIR}/${filename}"
            
            # 检查归档文件是否存在
            if [ -e "$archived_file" ]; then
                # 创建父目录（如果不存在）
                parent_dir=$(dirname "$original_path")
                mkdir -p "$parent_dir"
                
                # 还原文件
                mv "$archived_file" "$original_path"
                echo -e "${GREEN}已还原:${NC} $original_path"
                ((restored_count++))
            else
                echo -e "${YELLOW}跳过(文件不存在):${NC} $archived_file"
            fi
        fi
    fi
done < "$RECORD_FILE"

echo ""
echo -e "${GREEN}还原完成！${NC}"
echo "已还原文件/目录数: $restored_count"
echo ""
echo "归档目录仍然保留在: $ARCHIVE_DIR"
echo "如确认无误，可手动删除归档目录"
