========================================
文件归档说明 - product_system_dev
========================================
归档时间: 2025-11-21 22:04:17
归档目录: /var/www/product_system_dev/archived_unused_files_20251121_220417

本目录包含从 product_system_dev 项目中移除的不需要文件。

========================================
归档的文件类别
========================================

1. 日志文件 (1个)
   - connection_keepalive.log (15MB)
   - 程序运行产生的日志，可定期清理

2. 文档文件 (13个)
   - 各种说明文档和总结文档
   - 仅供阅读，程序运行不依赖

3. 测试文件 (5个)
   - 测试HTML页面
   - 未被主程序引用

4. 工具页面 (11个)
   - 证书安装、缓存清理等独立工具页
   - 非主程序流程，可独立访问
   - 如需使用可从此归档目录还原

5. 重定向页面 (1个)
   - index-new.html（只用于重定向）

6. 备份文件 (1个)
   - .backup 后缀的备份文件

7. 临时文件 (2个)
   - temp_file.txt, missing_functions.txt
   - 包含代码片段但非实际代码

8. 验证文件 (1个)
   - 域名验证文件（验证后可删除）

9. Let's Encrypt测试文件 (2个)
   - 测试用的验证文件

10. 脚本文件 (2个)
    - download_face_api.sh（一次性下载脚本）
    - keep_connection_alive.py（副本，实际运行的在另一目录）

11. 旧PHP后端 (3个目录)
    - api/backend/, api/groups/, api/product-group/
    - 已迁移到Python后端，未被引用

12. 空文件和空目录 (12个)
    - 无内容的文件和目录

========================================
如何还原文件
========================================

方法1: 使用还原脚本（推荐）
----------------------------
cd /var/www/product_system_dev
sudo ./restore_archived_files.sh archived_unused_files_20251121_220417

方法2: 手动还原单个文件
----------------------------
查看 file_locations_record.txt 了解原始位置：
sudo cat archived_unused_files_20251121_220417/file_locations_record.txt

手动移动文件：
sudo mv archived_unused_files_20251121_220417/[文件名] [原始路径]

例如还原README：
sudo mv archived_unused_files_20251121_220417/README.md /var/www/product_system_dev/

还原目录：
sudo mkdir -p /var/www/product_system_dev/api/backend
sudo mv archived_unused_files_20251121_220417/backend/* /var/www/product_system_dev/api/backend/

========================================
注意事项
========================================

1. 程序运行验证
   建议运行网站一段时间，确认所有功能正常后再删除归档

2. 工具页面
   如需使用证书安装等工具，可从归档还原对应HTML文件

3. 日志文件
   日志可以直接删除，程序会自动创建新的日志

4. 文档查阅
   文档在归档目录中仍可查看

5. 完全删除归档
   确认不需要后，可删除整个归档目录：
   sudo rm -rf /var/www/product_system_dev/archived_unused_files_20251121_220417

========================================
核心文件检查清单
========================================

以下核心文件应保留在项目目录中：
✓ index.html - 主入口文件
✓ js/app.js - 主应用逻辑
✓ js/face-recognition.js - 人脸识别
✓ js/push-manager.js - 推送管理
✓ css/ - 样式文件
✓ models/ - 人脸识别模型
✓ manifest.json - PWA配置
✓ service-worker-template.js
✓ sw-push.js

如发现以上文件缺失，请立即还原！

========================================
已归档文件总数: 51
========================================
