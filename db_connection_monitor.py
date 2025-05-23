#!/usr/bin/env python3
import psycopg2
from psycopg2.extras import RealDictCursor
import time
from datetime import datetime
import sys

# 公网连接配置
PUBLIC_DB_CONFIG = {
    "DB_HOST": "s5.gnip.vip",
    "DB_PORT": "33946",
    "DB_NAME": "scan_db",
    "DB_USER": "fh",
    "DB_PASSWORD": "yb123456"
}

def get_db_connection():
    """建立数据库连接"""
    try:
        conn = psycopg2.connect(
            host=PUBLIC_DB_CONFIG["DB_HOST"],
            port=PUBLIC_DB_CONFIG["DB_PORT"],
            database=PUBLIC_DB_CONFIG["DB_NAME"],
            user=PUBLIC_DB_CONFIG["DB_USER"],
            password=PUBLIC_DB_CONFIG["DB_PASSWORD"],
            cursor_factory=RealDictCursor,
            connect_timeout=5  # 5秒超时
        )
        return conn
    except Exception as e:
        return None

def check_connection(interval=10):
    """
    监控数据库连接状态
    interval: 检查间隔时间（秒）
    """
    connection_count = 0
    start_time = datetime.now()
    
    print(f"开始监控数据库连接状态，每 {interval} 秒检查一次")
    print(f"连接配置: 主机={PUBLIC_DB_CONFIG['DB_HOST']}, 端口={PUBLIC_DB_CONFIG['DB_PORT']}")
    print("按 Ctrl+C 停止监控")
    print("-" * 50)
    
    try:
        while True:
            # 尝试连接数据库
            conn = get_db_connection()
            
            if conn:
                connection_count += 1
                current_time = datetime.now()
                elapsed = (current_time - start_time).total_seconds()
                
                # 执行一个简单的查询
                cursor = conn.cursor()
                cursor.execute("SELECT COUNT(*) FROM products")
                count = cursor.fetchone()['count']
                
                print(f"[{current_time.strftime('%Y-%m-%d %H:%M:%S')}] 连接正常 (第 {connection_count} 次查询)")
                print(f"  - 已运行时间: {int(elapsed//3600)}小时 {int((elapsed%3600)//60)}分钟 {int(elapsed%60)}秒")
                print(f"  - 数据库中的产品数量: {count}")
                
                # 关闭连接
                cursor.close()
                conn.close()
            else:
                print(f"\n[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] !!! 警告：数据库连接失败 !!!")
                print("  可能原因:")
                print("  1. 网络连接问题")
                print("  2. 服务器超时断开")
                print("  3. 数据库服务不可用")
                print("\n尝试重新连接中...")
            
            # 等待指定间隔时间
            time.sleep(interval)
            
    except KeyboardInterrupt:
        print("\n监控已停止")
    except Exception as e:
        print(f"\n发生错误: {e}")

if __name__ == "__main__":
    # 获取命令行参数，默认10秒检查一次
    interval = 10
    if len(sys.argv) > 1:
        try:
            interval = int(sys.argv[1])
        except ValueError:
            print(f"无效的间隔时间: {sys.argv[1]}，使用默认值 10 秒")
    
    check_connection(interval) 