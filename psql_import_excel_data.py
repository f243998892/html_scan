import pyodbc
import pandas as pd
from datetime import datetime
import os
import shutil
import psycopg2
from psycopg2.extras import RealDictCursor

# 全局变量，用于存储连接模式
CONNECTION_MODE = None

# 数据库连接配置 - 硬编码环境变量
# 内网连接配置
INTERNAL_DB_CONFIG = {
    "DB_HOST": "192.168.0.215",
    "DB_PORT": "5432",
    "DB_NAME": "scan_db",
    "DB_USER": "fh",
    "DB_PASSWORD": "yb123456"
}

# 公网连接配置
PUBLIC_DB_CONFIG = {
    "DB_HOST": "s5.gnip.vip",
    "DB_PORT": "33946",
    "DB_NAME": "scan_db",
    "DB_USER": "fh",
    "DB_PASSWORD": "yb123456"
}

# 数据库连接函数
def get_db_connection():
    global CONNECTION_MODE
    
    # 如果未选择连接模式，默认为内网
    if CONNECTION_MODE is None:
        CONNECTION_MODE = "internal"
    
    # 根据连接模式选择配置
    if CONNECTION_MODE == "internal":
        config = INTERNAL_DB_CONFIG
    else:
        config = PUBLIC_DB_CONFIG
    
    # 连接到PostgreSQL数据库
    conn = psycopg2.connect(
        host=config["DB_HOST"],
        port=config["DB_PORT"],
        database=config["DB_NAME"],
        user=config["DB_USER"],
        password=config["DB_PASSWORD"],
        cursor_factory=RealDictCursor,
        connect_timeout=5  # 5秒超时
    )
    return conn

# 设置连接模式
def set_connection_mode():
    global CONNECTION_MODE
    
    while True:
        print("\n==== 请选择数据库连接模式 ====")
        print("1. 内网连接")
        print("2. 公网连接")
        choice = input("请输入选项编号: ")
        
        if choice == "1":
            CONNECTION_MODE = "internal"
            print("已选择内网连接模式")
            break
        elif choice == "2":
            CONNECTION_MODE = "public"
            print("已选择公网连接模式")
            break
        else:
            print("无效的选项，请重新选择")

# 检查month_range表
def check_month_range_table():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 检查表是否存在
        cursor.execute("SELECT to_regclass('public.month_range')")
        exists = cursor.fetchone()['to_regclass']
        
        if exists:
            print("month_range表已存在")
            
            # 如果表存在但没有数据，添加一条默认记录
            cursor.execute("SELECT COUNT(*) FROM month_range")
            count = cursor.fetchone()['count']
            
            if count == 0:
                # 添加带时区的时间戳
                current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                cursor.execute("INSERT INTO month_range (month_start) VALUES (%s)", (current_time,))
                conn.commit()
                print("已向month_range表添加初始记录")
        else:
            print("month_range表不存在，请先创建此表")
            print("CREATE TABLE month_range (id SERIAL PRIMARY KEY, month_start TIMESTAMP WITH TIME ZONE)")
            
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"检查month_range表时出错：{e}")
        print("请确保month_range表已创建，包含month_start字段(类型为timestamptz)")

def import_excel_data():
    # 获取程序所在目录
    excel_file_path = r"\\fwq\共享文件\Public\生产共享文件\daoru.xlsm"
    try:
        # 读取 Excel 文件
        df = pd.read_excel(excel_file_path, sheet_name='Sheet2')
        print(f"成功读取Excel文件。数据行数: {len(df)}")
        print(f"Excel文件列名: {list(df.columns)}")
        
        # 提取Excel中所有的产品编码，用于后续查询
        excel_product_codes = [str(row['product_code']) for index, row in df.iterrows()]
        print(f"Excel中包含 {len(excel_product_codes)} 个产品编码")
        
        # 创建产品编码到产品型号的映射
        excel_product_map = {str(row['product_code']): str(row['product_model']) for index, row in df.iterrows()}
        
        # 从Excel提取的产品编码列表分批查询数据库，避免分页限制
        existing_products = {}
        
        print("正在从数据库查询所有可能存在的产品编码...")
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 方法1: 直接查询Excel中包含的产品编码，避免分页问题
        for i in range(0, len(excel_product_codes), 20):  # 每批20个编码
            batch_codes = excel_product_codes[i:i+20]
            if not batch_codes:
                continue
                
            # 使用IN查询批量获取产品信息
            try:
                placeholders = ', '.join(['%s'] * len(batch_codes))
                query = f'SELECT "产品编码", "产品型号" FROM products WHERE "产品编码" IN ({placeholders})'
                cursor.execute(query, batch_codes)
                
                for item in cursor.fetchall():
                    existing_products[item['产品编码']] = item['产品型号']
            except Exception as e:
                print(f"查询数据库时出错（批次{i//20+1}）: {e}")
        
        print(f"在数据库中找到 {len(existing_products)} 条与Excel匹配的产品记录")

        # 收集需要更新的重复数据
        duplicate_data = []
        new_data = []
        
        for index, row in df.iterrows():
            product_code = str(row['product_code'])  # Excel中的列名
            product_model = str(row['product_model'])  # Excel中的列名
            
            # 检查产品编码是否已存在
            if product_code in existing_products:
                # 收集重复数据
                existing_product_model = existing_products[product_code]
                # 只收集产品型号不同的重复数据
                if existing_product_model != product_model and product_model:
                    duplicate_data.append({
                        'product_code': product_code,
                        'existing_product_model': existing_product_model,
                        'new_product_model': product_model
                    })
            else:
                # 收集新数据
                if product_model:
                    new_data.append({
                        '产品编码': product_code,  # 数据库中的列名
                        '产品型号': product_model   # 数据库中的列名
                    })

        # 如果有重复数据，提示用户是否覆盖
        if duplicate_data:
            print("发现以下产品编码在数据库中已存在，但产品型号不同：")
            for item in duplicate_data:
                print(f"产品编码: {item['product_code']}, 数据库中型号: {item['existing_product_model']}, Excel中型号: {item['new_product_model']}")
            user_choice = input("是否用Excel中的产品型号覆盖数据库中的产品型号？(y/n): ").strip().lower()
            if user_choice == 'y':
                updated_count = 0
                updated_codes = []  # 用于记录成功更新的产品编码
                for item in duplicate_data:
                    if item['new_product_model']:
                        try:
                            cursor.execute(
                                'UPDATE products SET "产品型号" = %s WHERE "产品编码" = %s',
                                (item['new_product_model'], item['product_code'])
                            )
                            conn.commit()
                            print(f"已将产品编码 {item['product_code']} 的产品型号从 {item['existing_product_model']} 更新为 {item['new_product_model']}。")
                            updated_count += 1
                            updated_codes.append(item['product_code'])
                        except Exception as e:
                            print(f"更新产品编码 {item['product_code']} 时出错: {e}")
                
                # 验证更新是否成功
                if updated_codes:
                    print("正在验证更新是否成功...")
                    # 查询已更新的记录
                    try:
                        placeholders = ', '.join(['%s'] * len(updated_codes))
                        query = f'SELECT "产品编码", "产品型号" FROM products WHERE "产品编码" IN ({placeholders})'
                        cursor.execute(query, updated_codes)
                        verification_success = 0
                        
                        for item in cursor.fetchall():
                            product_code = item['产品编码']
                            current_model = item['产品型号']
                            expected_model = excel_product_map.get(product_code)
                            if current_model == expected_model:
                                verification_success += 1
                            else:
                                print(f"警告: 产品编码 {product_code} 更新可能不成功，当前型号为 {current_model}，预期型号为 {expected_model}")
                        
                        print(f"更新验证结果: {verification_success}/{len(updated_codes)} 条记录成功更新")
                    except Exception as e:
                        print(f"验证更新时出错: {e}")
                
                print(f"共更新了 {updated_count} 条记录。")
            else:
                print("用户选择保留数据库中的数据，不进行覆盖。")
        else:
            print("未发现相同产品编码但不同产品型号的数据。")
        
        # 逐条插入新数据，在插入前再次检查是否已存在
        insert_success = 0
        skipped = 0
        inserted_codes = []  # 用于记录成功插入的产品编码
        
        if new_data:
            print(f"准备插入 {len(new_data)} 条新记录...")
            
            for record in new_data:
                product_code = record['产品编码']
                
                # 直接检查当前产品编码是否存在
                try:
                    cursor.execute('SELECT "产品编码" FROM products WHERE "产品编码" = %s', (product_code,))
                    if cursor.fetchone():
                        # 产品已存在，跳过
                        print(f"跳过已存在的产品编码: {product_code}")
                        skipped += 1
                        continue
                    
                    # 产品不存在，尝试插入
                    columns = ', '.join([f'"{k}"' for k in record.keys()])
                    placeholders = ', '.join(['%s'] * len(record))
                    query = f'INSERT INTO products ({columns}) VALUES ({placeholders})'
                    cursor.execute(query, list(record.values()))
                    conn.commit()
                    
                    insert_success += 1
                    inserted_codes.append(product_code)
                    print(f"已插入产品: {product_code}")
                except Exception as e:
                    if "duplicate key" in str(e):
                        print(f"跳过已存在的产品编码(由异常捕获): {product_code}")
                        skipped += 1
                    else:
                        print(f"插入产品编码 {product_code} 时出错: {e}")
            
            # 验证插入是否成功
            if inserted_codes:
                print("正在验证插入是否成功...")
                try:
                    placeholders = ', '.join(['%s'] * len(inserted_codes))
                    query = f'SELECT "产品编码" FROM products WHERE "产品编码" IN ({placeholders})'
                    cursor.execute(query, inserted_codes)
                    verified_records = cursor.fetchall()
                    verified_count = len(verified_records)
                    
                    if verified_count == len(inserted_codes):
                        print(f"验证成功：所有 {verified_count} 条记录都已成功插入数据库")
                    else:
                        print(f"警告：只有 {verified_count}/{len(inserted_codes)} 条记录验证成功")
                        # 显示未成功插入的产品编码
                        verified_codes = [item['产品编码'] for item in verified_records]
                        missing_codes = [code for code in inserted_codes if code not in verified_codes]
                        if missing_codes:
                            print(f"未成功插入的产品编码: {', '.join(missing_codes)}")
                except Exception as e:
                    print(f"验证插入时出错: {e}")
            
            print(f"已插入 {insert_success} 条新数据")
            if skipped > 0:
                print(f"跳过了 {skipped} 条已有记录")
        else:
            print("没有新数据需要插入")
        
        # 关闭数据库连接
        cursor.close()
        conn.close()
        
        print("Excel 数据已成功导入并更新到PostgreSQL数据库中。")
    except FileNotFoundError:
        print(f"未找到指定的 Excel 文件：{excel_file_path}，请检查文件路径是否正确。")
    except KeyError as e:
        print(f"Excel 文件中列名可能不正确: {e}，请确保包含 'product_code' 和 'product_model' 列。")
    except Exception as e:
        print(f"导入Excel数据时出错：{e}")
        import traceback
        traceback.print_exc()

def set_start_date():
    start_date = input("请输入当月起始日期（YYYY-MM-DD）：")
    print(f"已设置当月起始日期为：{start_date}")
    
    # 将日期格式化为带时区的时间戳格式
    try:
        # 转换为 YYYY-MM-DD HH:MM:SS 格式
        date_obj = datetime.strptime(start_date, '%Y-%m-%d')
        start_date_with_time = date_obj.strftime('%Y-%m-%d 00:00:00')
        
        # 将日期存储到数据库的month_range表
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            
            # 先获取记录ID
            cursor.execute("SELECT id FROM month_range LIMIT 1")
            result = cursor.fetchone()
            
            if result:
                # 如果有记录，更新第一条记录
                record_id = result['id']
                cursor.execute("UPDATE month_range SET month_start = %s WHERE id = %s", 
                              (start_date_with_time, record_id))
                conn.commit()
                print("已将日期更新到数据库")
            else:
                # 如果没有记录，插入新记录
                cursor.execute("INSERT INTO month_range (month_start) VALUES (%s)", 
                              (start_date_with_time,))
                conn.commit()
                print("已将日期插入到数据库")
                
            cursor.close()
            conn.close()
        except Exception as e:
            print(f"更新数据库中的日期记录时出错：{e}")
        
        # 作为备份，同时将 start_date 存储到本地文件的第一行
        with open('import_date_record.txt', 'r+') as f:
            lines = f.readlines()
            if not lines:
                lines = ['', '']
            lines[0] = start_date + '\n'
            if len(lines) < 2:
                lines.append('\n')  # 确保文件至少有两行
            f.seek(0)
            f.writelines(lines)
    except ValueError:
        print("日期格式不正确，请使用YYYY-MM-DD格式")

def get_last_import_time():
    try:
        # 从数据库获取最后导入时间
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT month_start FROM month_range LIMIT 1")
        result = cursor.fetchone()
        
        cursor.close()
        conn.close()
        
        if result:
            last_date_str = result['month_start']
            # 处理timestamptz格式
            if 'T' in last_date_str:  # ISO格式， 如"2023-01-01T00:00:00+00:00"
                last_date_str = last_date_str.split('T')[0]
            elif ' ' in last_date_str:  # 包含时间部分
                last_date_str = last_date_str.split(' ')[0]
            return datetime.strptime(last_date_str, '%Y-%m-%d')
    except Exception as e:
        print(f"从数据库获取最后导入时间时出错：{e}")
        # 如果从数据库获取失败，尝试从本地文件获取
        try:
            with open('import_date_record.txt', 'r') as f:
                lines = f.readlines()
                last_time_str = lines[1].strip() if len(lines) > 1 else ''
                if last_time_str:
                    try:
                        # 尝试解析为 '%Y-%m-%d %H:%M:%S' 格式
                        return datetime.strptime(last_time_str, '%Y-%m-%d %H:%M:%S')
                    except ValueError:
                        # 如果失败，尝试解析为 '%Y-%m-%d' 格式
                        return datetime.strptime(last_time_str, '%Y-%m-%d')
        except FileNotFoundError:
            pass
    return None 

def import_testdataban_data(start_date=None, record_time=False):
    if start_date is None:
        # 输入日期
        start_date_str = input("请输入导出 检验数据 的起始日期（YYYY-MM-DD）：")
        try:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
        except ValueError:
            print("日期格式不正确，请使用 YYYY-MM-DD 格式。")
            return
    try:
        # 记录当前时间
        current_time = datetime.now()

        # 创建一个字典来存储新的数据
        new_data = {}

        # 从网络路径复制数据库文件到本地临时文件
        remote_mdb_path = r"\\bCPJYNEW\Database\TESTDATA.MDB"
        local_mdb_path = os.path.join(os.getcwd(), "temp_testdataban.mdb")
        
        try:
            print(f"正在从 {remote_mdb_path} 复制数据库文件到本地...")
            shutil.copy2(remote_mdb_path, local_mdb_path)
            print(f"数据库文件已成功复制到本地: {local_mdb_path}")
            
            # 连接到本地 Access 数据库
            conn_str = f'DRIVER={{Microsoft Access Driver (*.mdb, *.accdb)}};DBQ={local_mdb_path};'
            mdb_conn = pyodbc.connect(conn_str)
            mdb_cursor = mdb_conn.cursor()
    
            # 使用参数化查询，只获取测试时间字段
            query = "SELECT DISTINCT 出厂编号, 测试时间, 电机型号 FROM 表2 WHERE 测试结果 = '测试合格' AND 测试日期 >= ?"
            # 将 start_date 转换为 Access 可能需要的格式
            start_date_str = start_date.strftime('%Y-%m-%d')
            mdb_cursor.execute(query, (start_date_str,))
            rows = mdb_cursor.fetchall()
    
            for row in rows:
                factory_number = str(row[0])
                test_time = str(row[1])
                motor_model = str(row[2]) if row[2] else None
    
                # 删除出厂编号中的 '-' 及其后的内容
                if '-' in factory_number:
                    base_number = factory_number.split('-', 1)[0]
                    product_code = base_number
                else:
                    product_code = factory_number
    
                if product_code not in new_data or new_data[product_code]['test_time'] < test_time:
                    new_data[product_code] = {
                        'test_time': test_time,
                        'motor_model': motor_model
                    }
                    
            # 确保关闭连接
            mdb_cursor.close()
            mdb_conn.close()
            
            # 删除临时文件
            try:
                os.remove(local_mdb_path)
                print("临时数据库文件已删除")
            except Exception as e:
                print(f"删除临时数据库文件时出错: {e}")
                
        except Exception as e:
            print(f"处理第一个Access数据库时出错：{e}")
            return

        # 获取现有产品数据
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT "产品编码", "半成品检验时间", "产品型号" FROM products')
        existing_products = {item['产品编码']: {'半成品检验时间': item.get('半成品检验时间'), '产品型号': item.get('产品型号')} 
                            for item in cursor.fetchall()}

        # 处理新数据
        updates = []
        inserts = []
        skipped = 0
        
        for product_code, data in new_data.items():
            test_time = data['test_time']
            motor_model = data['motor_model']

            # 检查产品编码是否已存在
            if product_code in existing_products:
                # 产品代码已存在，更新记录
                update_fields = {"半成品检验时间": test_time}
                
                # 如果有电机型号，覆盖产品型号
                if motor_model:
                    update_fields["产品型号"] = motor_model
                
                updates.append({
                    "产品编码": product_code,
                    "update_fields": update_fields,
                    "old_model": existing_products[product_code].get('产品型号')
                })
            else:
                # 产品代码不存在，插入新数据
                new_record = {
                    "产品编码": product_code,
                    "半成品检验时间": test_time
                }
                
                if motor_model:
                    new_record["产品型号"] = motor_model
                
                inserts.append(new_record)
        
        # 批量更新
        update_success = 0
        model_updated = 0
        if updates:
            for update in updates:
                try:
                    product_code = update["产品编码"]
                    update_fields = update["update_fields"]
                    old_model = update["old_model"]
                    
                    # 构建SQL更新语句
                    set_clause = ", ".join([f'"{k}" = %s' for k in update_fields.keys()])
                    params = list(update_fields.values()) + [product_code]
                    
                    cursor.execute(f'UPDATE products SET {set_clause} WHERE "产品编码" = %s', params)
                    conn.commit()
                    update_success += 1
                    
                    # 记录产品型号更新
                    if "产品型号" in update_fields and old_model != update_fields["产品型号"]:
                        model_updated += 1
                        print(f"更新产品编码 {product_code} 的产品型号从 {old_model or '空'} 更新为 {update_fields['产品型号']}")
                        
                except Exception as e:
                    print(f"更新产品编码 {update['产品编码']} 时出错: {e}")
            
            print(f"已更新 {update_success} 条记录，其中 {model_updated} 条产品型号被更新")
        
        # 批量插入，每次最多100条
        insert_success = 0
        if inserts:
            # 分批处理，每批最多100条
            batch_size = 100
            for i in range(0, len(inserts), batch_size):
                batch = inserts[i:i+batch_size]
                try:
                    # 构建批量插入语句
                    if batch:
                        columns = ', '.join([f'"{k}"' for k in batch[0].keys()])
                        values_template = ', '.join(['%s'] * len(batch[0]))
                        query = f'INSERT INTO products ({columns}) VALUES ({values_template})'
                        
                        for record in batch:
                            try:
                                cursor.execute(query, list(record.values()))
                                conn.commit()
                                insert_success += 1
                            except Exception as e:
                                if "duplicate key" in str(e):
                                    print(f"跳过已存在的产品编码(由异常捕获): {record['产品编码']}")
                                    skipped += 1
                                else:
                                    print(f"插入产品编码 {record['产品编码']} 时出错: {e}")
                except Exception as e:
                    print(f"批量插入记录时出错 (批次 {i//batch_size+1}): {e}")
                    
            print(f"已插入 {insert_success} 条新记录")
        
        if skipped > 0:
            print(f"跳过了 {skipped} 条已有记录")

        print("半成品检验 数据已成功导入并更新到PostgreSQL数据库中。")

        # 关闭数据库连接
        cursor.close()
        conn.close()
        
        # 仅在需要记录时间时记录
        if record_time:
            # 将当前时间转换为时间戳格式
            current_time_str = current_time.strftime('%Y-%m-%d %H:%M:%S')
            
            # 更新month_range表中的月份开始时间
            try:
                conn = get_db_connection()
                cursor = conn.cursor()
                
                # 先获取记录ID
                cursor.execute("SELECT id FROM month_range LIMIT 1")
                result = cursor.fetchone()
                
                if result:
                    # 如果有记录，更新第一条记录
                    record_id = result['id']
                    cursor.execute("UPDATE month_range SET month_start = %s WHERE id = %s", 
                                  (current_time_str, record_id))
                    conn.commit()
                    print("已更新month_range表中的月份开始时间")
                else:
                    # 如果没有记录，插入新记录
                    cursor.execute("INSERT INTO month_range (month_start) VALUES (%s)", 
                                  (current_time_str,))
                    conn.commit()
                    print("已向month_range表插入月份开始时间")
                
                cursor.close()
                conn.close()
            except Exception as e:
                print(f"更新month_range表时出错：{e}")
            
            # 同时更新本地文件
            with open('import_date_record.txt', 'r+') as f:
                lines = f.readlines()
                if len(lines) < 2:
                    lines.append(current_time.strftime('%Y-%m-%d %H:%M:%S') + '\n')
                else:
                    lines[1] = current_time.strftime('%Y-%m-%d %H:%M:%S') + '\n'
                f.seek(0)
                f.writelines(lines)

    except Exception as e:
        print(f"操作数据库时出错：{e}")
        import traceback
        traceback.print_exc() 

def import_testdata_data(start_date=None, record_time=False):
    if start_date is None:
        # 输入日期
        start_date_str = input("请输入导出 成品检验数据 的起始日期（YYYY-MM-DD）：")
        try:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
        except ValueError:
            print("日期格式不正确，请使用 YYYY-MM-DD 格式。")
            return
    try:
        # 记录当前时间
        current_time = datetime.now()

        # 创建一个字典来存储新的数据
        new_data = {}

        # 从网络路径复制数据库文件到本地临时文件
        remote_mdb_path = r"\\CPJYNEW\Database\TESTDATA.MDB"
        local_mdb_path = os.path.join(os.getcwd(), "temp_testdata.mdb")
        
        try:
            print(f"正在从 {remote_mdb_path} 复制数据库文件到本地...")
            shutil.copy2(remote_mdb_path, local_mdb_path)
            print(f"数据库文件已成功复制到本地: {local_mdb_path}")
            
            # 连接到本地 Access 数据库
            conn_str = f'DRIVER={{Microsoft Access Driver (*.mdb, *.accdb)}};DBQ={local_mdb_path};'
            mdb_conn = pyodbc.connect(conn_str)
            mdb_cursor = mdb_conn.cursor()
    
            # 使用参数化查询，只获取测试时间字段
            query = "SELECT DISTINCT 出厂编号, 测试时间, 电机型号 FROM 表2 WHERE 测试结果 = '测试合格' AND 测试日期 >= ?"
            # 将 start_date 转换为 Access 可能需要的格式
            start_date_str = start_date.strftime('%Y-%m-%d')
            mdb_cursor.execute(query, (start_date_str,))
            rows = mdb_cursor.fetchall()
    
            for row in rows:
                factory_number = str(row[0])
                test_time = str(row[1])
                motor_model = str(row[2]) if row[2] else None
    
                # 删除出厂编号中的 '-' 及其后的内容
                if '-' in factory_number:
                    base_number = factory_number.split('-', 1)[0]
                    product_code = base_number
                else:
                    product_code = factory_number
    
                if product_code not in new_data or new_data[product_code]['test_time'] < test_time:
                    new_data[product_code] = {
                        'test_time': test_time,
                        'motor_model': motor_model
                    }
                    
            # 确保关闭连接
            mdb_cursor.close()
            mdb_conn.close()
            
            # 删除临时文件
            try:
                os.remove(local_mdb_path)
                print("临时数据库文件已删除")
            except Exception as e:
                print(f"删除临时数据库文件时出错: {e}")
                
        except Exception as e:
            print(f"处理第二个Access数据库时出错：{e}")
            return

        # 获取现有产品数据
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT "产品编码", "成品检验时间" FROM products')
        existing_products = {item['产品编码']: item.get('成品检验时间') for item in cursor.fetchall()}

        # 处理新数据
        updates = []
        inserts = []
        skipped = 0
        
        for product_code, data in new_data.items():
            test_time = data['test_time']
            motor_model = data['motor_model']

            # 检查产品编码是否已存在
            if product_code in existing_products:
                # 产品代码已存在，更新记录（只更新成品检验时间）
                updates.append({
                    "产品编码": product_code,
                    "成品检验时间": test_time
                })
            else:
                # 产品代码不存在，插入新数据
                new_record = {
                    "产品编码": product_code,
                    "成品检验时间": test_time
                }
                
                if motor_model:
                    new_record["产品型号"] = motor_model
                
                inserts.append(new_record)
        
        # 批量更新
        update_success = 0
        if updates:
            for update in updates:
                try:
                    cursor.execute(
                        'UPDATE products SET "成品检验时间" = %s WHERE "产品编码" = %s',
                        (update["成品检验时间"], update["产品编码"])
                    )
                    conn.commit()
                    update_success += 1
                except Exception as e:
                    print(f"更新产品编码 {update['产品编码']} 时出错: {e}")
            print(f"已更新 {update_success} 条记录")
        
        # 批量插入，每次最多100条
        insert_success = 0
        if inserts:
            # 分批处理，每批最多100条
            batch_size = 100
            for i in range(0, len(inserts), batch_size):
                batch = inserts[i:i+batch_size]
                try:
                    # 构建批量插入语句
                    if batch:
                        columns = ', '.join([f'"{k}"' for k in batch[0].keys()])
                        values_template = ', '.join(['%s'] * len(batch[0]))
                        query = f'INSERT INTO products ({columns}) VALUES ({values_template})'
                        
                        for record in batch:
                            try:
                                cursor.execute(query, list(record.values()))
                                conn.commit()
                                insert_success += 1
                            except Exception as e:
                                if "duplicate key" in str(e):
                                    print(f"跳过已存在的产品编码(由异常捕获): {record['产品编码']}")
                                    skipped += 1
                                else:
                                    print(f"插入产品编码 {record['产品编码']} 时出错: {e}")
                except Exception as e:
                    print(f"批量插入记录时出错 (批次 {i//batch_size+1}): {e}")
            print(f"已插入 {insert_success} 条新记录")
        
        if skipped > 0:
            print(f"跳过了 {skipped} 条已有记录")

        # 关闭数据库连接
        cursor.close()
        conn.close()
        
        print("成品检验 数据已成功导入并更新到PostgreSQL数据库中。")

        # 仅在需要记录时间时记录
        if record_time:
            # 将当前时间转换为时间戳格式
            current_time_str = current_time.strftime('%Y-%m-%d %H:%M:%S')
            
            # 更新month_range表中的月份开始时间
            try:
                conn = get_db_connection()
                cursor = conn.cursor()
                
                # 先获取记录ID
                cursor.execute("SELECT id FROM month_range LIMIT 1")
                result = cursor.fetchone()
                
                if result:
                    # 如果有记录，更新第一条记录
                    record_id = result['id']
                    cursor.execute("UPDATE month_range SET month_start = %s WHERE id = %s", 
                                 (current_time_str, record_id))
                    conn.commit()
                    print("已更新month_range表中的月份开始时间")
                else:
                    # 如果没有记录，插入新记录
                    cursor.execute("INSERT INTO month_range (month_start) VALUES (%s)", 
                                 (current_time_str,))
                    conn.commit()
                    print("已向month_range表插入月份开始时间")
                
                cursor.close()
                conn.close()
            except Exception as e:
                print(f"更新month_range表时出错：{e}")
            
            # 同时更新本地文件
            with open('import_date_record.txt', 'r+') as f:
                lines = f.readlines()
                if len(lines) < 2:
                    lines.append(current_time.strftime('%Y-%m-%d %H:%M:%S') + '\n')
                else:
                    lines[1] = current_time.strftime('%Y-%m-%d %H:%M:%S') + '\n'
                f.seek(0)
                f.writelines(lines)

    except pyodbc.Error as e:
        print(f"连接到 Access 数据库或执行查询时出错：{e}")
    except Exception as e:
        print(f"操作数据库时出错：{e}")
        import traceback
        traceback.print_exc() 

def test_connections():
    try:
        # 测试 Excel 文件连接
        excel_file_path = r"\\fwq\共享文件\Public\生产共享文件\daoru.xlsm"
        pd.read_excel(excel_file_path, sheet_name='Sheet2')
        print("Excel 文件连接成功。")
    except Exception as e:
        print(f"Excel 文件连接失败：{e}")

    try:
        # 测试 PostgreSQL 连接
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM products")
        result = cursor.fetchone()
        print(f"PostgreSQL 连接成功，products表中有 {result['count']} 条记录。")
        
        # 获取products表结构
        cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'products'")
        columns = cursor.fetchall()
        
        print("\nproducts表字段结构:")
        for col in columns:
            print(f"  - {col['column_name']}")
        
        # 测试 month_range 表连接
        cursor.execute("SELECT to_regclass('public.month_range')")
        exists = cursor.fetchone()['to_regclass']
        
        if exists:
            cursor.execute("SELECT * FROM month_range")
            result = cursor.fetchall()
            if result:
                print(f"\nmonth_range表连接成功，当前的month_start值为: {result[0]['month_start']}")
            else:
                print("\nmonth_range表连接成功，但表中没有数据。")
        else:
            print("\nmonth_range表不存在。")
            
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"PostgreSQL 连接失败：{e}")

    try:
        # 测试第一个 Access 数据库连接，复制到本地再测试
        remote_mdb_path1 = r"\\bCPJYNEW\Database\TESTDATA.MDB"
        local_mdb_path1 = os.path.join(os.getcwd(), "temp_test_databan.mdb")
        
        try:
            print(f"正在从 {remote_mdb_path1} 复制数据库文件到本地进行测试...")
            shutil.copy2(remote_mdb_path1, local_mdb_path1)
            
            conn_str1 = f'DRIVER={{Microsoft Access Driver (*.mdb, *.accdb)}};DBQ={local_mdb_path1};'
            mdb_conn1 = pyodbc.connect(conn_str1)
            mdb_cursor1 = mdb_conn1.cursor()
            # 测试获取表结构
            mdb_cursor1.tables()
            tables = [table.table_name for table in mdb_cursor1.fetchall() if table.table_type == 'TABLE']
            print(f"\n第一个Access数据库(半成品检验)连接成功，包含表: {', '.join(tables)}")
            mdb_cursor1.close()
            mdb_conn1.close()
            
            # 测试完成后删除临时文件
            os.remove(local_mdb_path1)
            print("第一个测试用临时数据库文件已删除")
        except Exception as e:
            print(f"第一个 Access 数据库复制或连接失败：{e}")
    except Exception as e:
        print(f"第一个 Access 数据库测试过程出错：{e}")

    try:
        # 测试第二个 Access 数据库连接，复制到本地再测试
        remote_mdb_path2 = r"\\CPJYNEW\Database\TESTDATA.MDB"
        local_mdb_path2 = os.path.join(os.getcwd(), "temp_test_data.mdb")
        
        try:
            print(f"正在从 {remote_mdb_path2} 复制数据库文件到本地进行测试...")
            shutil.copy2(remote_mdb_path2, local_mdb_path2)
            
            conn_str2 = f'DRIVER={{Microsoft Access Driver (*.mdb, *.accdb)}};DBQ={local_mdb_path2};'
            mdb_conn2 = pyodbc.connect(conn_str2)
            mdb_cursor2 = mdb_conn2.cursor()
            # 测试获取表结构
            mdb_cursor2.tables()
            tables = [table.table_name for table in mdb_cursor2.fetchall() if table.table_type == 'TABLE']
            print(f"\n第二个Access数据库(成品检验)连接成功，包含表: {', '.join(tables)}")
            mdb_cursor2.close()
            mdb_conn2.close()
            
            # 测试完成后删除临时文件
            os.remove(local_mdb_path2)
            print("第二个测试用临时数据库文件已删除")
        except Exception as e:
            print(f"第二个 Access 数据库复制或连接失败：{e}")
    except Exception as e:
        print(f"第二个 Access 数据库测试过程出错：{e}")

def main():
    # 首先选择连接模式
    set_connection_mode()
    
    # 检查month_range表
    check_month_range_table()
    
    while True:
        print("\n请选择操作：")
        print("1. 导入 Excel 数据")
        print("2. 设置当月起始日期")
        print("3. 导入 检验 数据（设置起始日期进行导入）")
        print("4. 测试连接")
        print("5. 切换连接模式（内网/公网）")
        print("6. 退出程序")
        choice = input("请输入选项：")
        if choice == '1':
            import_excel_data()
        elif choice == '2':
            set_start_date()
        elif choice == '3':
            start_date_str = input("请输入导出 检验 数据的起始日期（YYYY-MM-DD）：")
            try:
                start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
                import_testdataban_data(start_date=start_date, record_time=False)
                import_testdata_data(start_date=start_date, record_time=False)
            except ValueError:
                print("日期格式不正确，请使用 YYYY-MM-DD 格式。")
        elif choice == '4':
            test_connections()
        elif choice == '5':
            set_connection_mode()
        elif choice == '6':
            break
        else:
            print("无效的选项，请重新输入。")

if __name__ == "__main__":
    main() 