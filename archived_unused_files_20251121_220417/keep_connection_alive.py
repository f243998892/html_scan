#!/usr/bin/env python3
import psycopg2
import time
import logging
from datetime import datetime
import sys
import signal

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('connection_keepalive.log')
    ]
)

# 数据库连接配置
DB_CONFIG = {
    "host": "s5.gnip.vip",
    "port": "33946",
    "database": "scan_db",
    "user": "fh",
    "password": "yb123456"
}

# 全局变量
running = True

def signal_handler(sig, frame):
    """处理Ctrl+C终止信号"""
    global running
    logging.info("收到终止信号，正在关闭...")
    running = False

def get_db_connection():
    """创建数据库连接"""
    try:
        conn = psycopg2.connect(
            host=DB_CONFIG["host"],
            port=DB_CONFIG["port"],
            database=DB_CONFIG["database"],
            user=DB_CONFIG["user"],
            password=DB_CONFIG["password"],
            connect_timeout=5  # 5秒超时
        )
        conn.autocommit = True
        return conn
    except Exception as e:
        logging.error(f"数据库连接失败: {e}")
        return None

def keep_connection_alive(interval=60):
    """
    保持数据库连接活跃
    interval: 发送心跳查询的间隔（秒）
    """
    global running
    connection_count = 0
    start_time = datetime.now()
    conn = None
    
    logging.info(f"启动连接保持程序，每 {interval} 秒发送一次心跳")
    logging.info(f"连接配置: 主机={DB_CONFIG['host']}, 端口={DB_CONFIG['port']}")
    
    try:
        while running:
            # 如果连接不存在或已关闭，创建新连接
            if conn is None or conn.closed:
                conn = get_db_connection()
                if conn is None:
                    logging.warning("无法建立数据库连接，30秒后重试...")
                    time.sleep(30)
                    continue
                logging.info("成功建立数据库连接")
            
            try:
                # 执行简单查询保持连接活跃
                cursor = conn.cursor()
                cursor.execute("SELECT 1 AS keepalive")
                result = cursor.fetchone()
                cursor.close()
                
                connection_count += 1
                current_time = datetime.now()
                elapsed = (current_time - start_time).total_seconds()
                
                logging.info(f"心跳 #{connection_count} 发送成功，已运行: {int(elapsed//3600)}小时 {int((elapsed%3600)//60)}分钟 {int(elapsed%60)}秒")
                
                # 等待指定间隔
                time.sleep(interval)
                
            except Exception as e:
                logging.error(f"查询执行失败: {e}")
                # 关闭连接以便重新创建
                if conn and not conn.closed:
                    try:
                        conn.close()
                    except:
                        pass
                conn = None
                time.sleep(10)  # 短暂等待后重试
    
    except KeyboardInterrupt:
        logging.info("程序终止")
    except Exception as e:
        logging.error(f"发生错误: {e}")
    finally:
        # 确保关闭连接
        if conn and not conn.closed:
            conn.close()
            logging.info("数据库连接已关闭")

if __name__ == "__main__":
    # 注册信号处理器
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # 获取命令行参数，默认60秒发送一次心跳
    interval = 60
    if len(sys.argv) > 1:
        try:
            interval = int(sys.argv[1])
        except ValueError:
            logging.warning(f"无效的间隔时间: {sys.argv[1]}，使用默认值 60 秒")
    
    keep_connection_alive(interval) 