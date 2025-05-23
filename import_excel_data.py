import pyodbc
import pandas as pd
from datetime import datetime
import os
import shutil
from supabase import create_client, Client

# Supabase配置
SUPABASE_URL = "https://mirilhunybcsydhtowqo.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pcmlsaHVueWJjc3lkaHRvd3FvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEyNjk3MzEsImV4cCI6MjA1Njg0NTczMX0.fQCOraXJXQFshRXxHf2N-VIwTSbEc1hrxXzHP4sIIAw"

# 初始化Supabase客户端
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# 检查month_range表
def check_month_range_table():
    try:
        # 检查表是否存在，如果不存在会引发异常
        response = supabase.table("month_range").select("*").execute()
        print("month_range表已存在")
        
        # 如果表存在但没有数据，添加一条默认记录
        if not response.data:
            # 添加带时区的时间戳
            current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S%z')
            supabase.table("month_range").insert({"month_start": current_time}).execute()
            print("已向month_range表添加初始记录")
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
        # 方法1: 直接查询Excel中包含的产品编码，避免分页问题
        for i in range(0, len(excel_product_codes), 20):  # 每批20个编码
            batch_codes = excel_product_codes[i:i+20]
            if not batch_codes:
                continue
                
            # 使用IN查询批量获取产品信息
            try:
                # 将产品编码转换为字符串格式，以适应Supabase查询
                response = supabase.table("products").select("产品编码, 产品型号").in_("产品编码", batch_codes).execute()
                for item in response.data:
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
                        '产品编码': product_code,  # Supabase中的列名
                        '产品型号': product_model   # Supabase中的列名
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
                            supabase.table("products").update({"产品型号": item['new_product_model']}).eq("产品编码", item['product_code']).execute()
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
                        verification_response = supabase.table("products").select("产品编码, 产品型号").in_("产品编码", updated_codes).execute()
                        verification_success = 0
                        for item in verification_response.data:
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
                    check_response = supabase.table("products").select("产品编码").eq("产品编码", product_code).execute()
                    
                    if check_response.data and len(check_response.data) > 0:
                        # 产品已存在，跳过
                        print(f"跳过已存在的产品编码: {product_code}")
                        skipped += 1
                        continue
                        
                    # 产品不存在，尝试插入
                    insert_response = supabase.table("products").insert([record]).execute()
                    if insert_response and insert_response.data:
                        insert_success += 1
                        inserted_codes.append(product_code)
                        print(f"已插入产品: {product_code}")
                    else:
                        print(f"插入产品 {product_code} 可能失败，未返回数据")
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
                    verification_response = supabase.table("products").select("产品编码").in_("产品编码", inserted_codes).execute()
                    verified_count = len(verification_response.data)
                    if verified_count == len(inserted_codes):
                        print(f"验证成功：所有 {verified_count} 条记录都已成功插入数据库")
                    else:
                        print(f"警告：只有 {verified_count}/{len(inserted_codes)} 条记录验证成功")
                        # 显示未成功插入的产品编码
                        verified_codes = [item['产品编码'] for item in verification_response.data]
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
        
        print("Excel 数据已成功导入并更新到Supabase数据库中。")
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
        # 转换为 YYYY-MM-DD HH:MM:SS 格式，加上时区信息
        date_obj = datetime.strptime(start_date, '%Y-%m-%d')
        start_date_with_time = date_obj.strftime('%Y-%m-%d 00:00:00')
        
        # 将日期存储到Supabase的month_range表
        try:
            # 先获取记录ID
            response = supabase.table("month_range").select("id").execute()
            if response.data:
                # 如果有记录，更新第一条记录
                record_id = response.data[0]['id']
                supabase.table("month_range").update({"month_start": start_date_with_time}).eq("id", record_id).execute()
                print("已将日期更新到Supabase")
            else:
                # 如果没有记录，插入新记录
                supabase.table("month_range").insert({"month_start": start_date_with_time}).execute()
                print("已将日期插入到Supabase")
        except Exception as e:
            print(f"更新Supabase中的日期记录时出错：{e}")
        
        # 作为备份，同时将 start_date 存储到本地文件的第一行
        with open('import_date_record.txt', 'r+') as f:
            lines = f.readlines()
            lines[0] = start_date + '\n'
            if len(lines) < 2:
                lines.append('\n')  # 确保文件至少有两行
            f.seek(0)
            f.writelines(lines)
    except ValueError:
        print("日期格式不正确，请使用YYYY-MM-DD格式")

def get_last_import_time():
    try:
        # 从Supabase获取最后导入时间
        response = supabase.table("month_range").select("month_start").execute()
        if response.data:
            last_date_str = response.data[0]['month_start']
            # 处理timestamptz格式
            if 'T' in last_date_str:  # ISO格式， 如"2023-01-01T00:00:00+00:00"
                last_date_str = last_date_str.split('T')[0]
            elif ' ' in last_date_str:  # 包含时间部分
                last_date_str = last_date_str.split(' ')[0]
            return datetime.strptime(last_date_str, '%Y-%m-%d')
    except Exception as e:
        print(f"从Supabase获取最后导入时间时出错：{e}")
        # 如果从Supabase获取失败，尝试从本地文件获取
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
        response = supabase.table("products").select("产品编码, 半成品检验时间, 产品型号").execute()
        existing_products = {item['产品编码']: {'半成品检验时间': item.get('半成品检验时间'), '产品型号': item.get('产品型号')} for item in response.data}

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
                    
                    supabase.table("products").update(update_fields).eq("产品编码", product_code).execute()
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
                    supabase.table("products").insert(batch).execute()
                    insert_success += len(batch)
                except Exception as e:
                    print(f"批量插入记录时出错 (批次 {i//batch_size+1}): {e}")
                    # 逐条尝试插入，忽略已存在的记录
                    for record in batch:
                        try:
                            supabase.table("products").insert(record).execute()
                            insert_success += 1
                        except Exception as e:
                            if "duplicate key" in str(e):
                                print(f"跳过已存在的产品编码(由异常捕获): {record['产品编码']}")
                                skipped += 1
                            else:
                                print(f"插入产品编码 {record['产品编码']} 时出错: {e}")
            print(f"已插入 {insert_success} 条新记录")
        
        if skipped > 0:
            print(f"跳过了 {skipped} 条已有记录")

        print("半成品检验 数据已成功导入并更新到Supabase数据库中。")

        # 仅在需要记录时间时记录
        if record_time:
            # 将当前时间转换为timestamptz格式
            current_time_str = current_time.strftime('%Y-%m-%d %H:%M:%S')
            
            # 更新month_range表中的月份开始时间
            try:
                # 先获取记录ID
                response = supabase.table("month_range").select("id").execute()
                if response.data:
                    # 如果有记录，更新第一条记录
                    record_id = response.data[0]['id']
                    supabase.table("month_range").update({"month_start": current_time_str}).eq("id", record_id).execute()
                    print("已更新month_range表中的月份开始时间")
                else:
                    # 如果没有记录，插入新记录
                    supabase.table("month_range").insert({"month_start": current_time_str}).execute()
                    print("已向month_range表插入月份开始时间")
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
        print(f"操作Supabase数据库时出错：{e}")

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
        response = supabase.table("products").select("产品编码, 成品检验时间").execute()
        existing_products = {item['产品编码']: item.get('成品检验时间') for item in response.data}

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
                    supabase.table("products").update({"成品检验时间": update["成品检验时间"]}).eq("产品编码", update["产品编码"]).execute()
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
                    supabase.table("products").insert(batch).execute()
                    insert_success += len(batch)
                except Exception as e:
                    print(f"批量插入记录时出错 (批次 {i//batch_size+1}): {e}")
                    # 逐条尝试插入，忽略已存在的记录
                    for record in batch:
                        try:
                            supabase.table("products").insert(record).execute()
                            insert_success += 1
                        except Exception as e:
                            if "duplicate key" in str(e):
                                print(f"跳过已存在的产品编码(由异常捕获): {record['产品编码']}")
                                skipped += 1
                            else:
                                print(f"插入产品编码 {record['产品编码']} 时出错: {e}")
            print(f"已插入 {insert_success} 条新记录")
        
        if skipped > 0:
            print(f"跳过了 {skipped} 条已有记录")

        print("成品检验 数据已成功导入并更新到Supabase数据库中。")

        # 仅在需要记录时间时记录
        if record_time:
            # 将当前时间转换为timestamptz格式
            current_time_str = current_time.strftime('%Y-%m-%d %H:%M:%S')
            
            # 更新month_range表中的月份开始时间
            try:
                # 先获取记录ID
                response = supabase.table("month_range").select("id").execute()
                if response.data:
                    # 如果有记录，更新第一条记录
                    record_id = response.data[0]['id']
                    supabase.table("month_range").update({"month_start": current_time_str}).eq("id", record_id).execute()
                    print("已更新month_range表中的月份开始时间")
                else:
                    # 如果没有记录，插入新记录
                    supabase.table("month_range").insert({"month_start": current_time_str}).execute()
                    print("已向month_range表插入月份开始时间")
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
        print(f"操作Supabase数据库时出错：{e}")

def test_connections():
    try:
        # 测试 Excel 文件连接
        excel_file_path = r"\\fwq\共享文件\Public\生产共享文件\daoru.xlsm"
        pd.read_excel(excel_file_path, sheet_name='Sheet2')
        print("Excel 文件连接成功。")
    except Exception as e:
        print(f"Excel 文件连接失败：{e}")

    try:
        # 测试 Supabase 连接
        response = supabase.table("products").select("count", count="exact").limit(1).execute()
        print(f"Supabase 连接成功，products表中有 {response.count} 条记录。")
        
        # 获取products表结构
        response = supabase.table("products").select("*").limit(1).execute()
        if response.data:
            print("\nproducts表字段结构:")
            for key in response.data[0].keys():
                print(f"  - {key}")
        
        # 测试 month_range 表连接
        response = supabase.table("month_range").select("*").execute()
        if response.data:
            print(f"\nmonth_range表连接成功，当前的month_start值为: {response.data[0]['month_start']}")
        else:
            print("\nmonth_range表连接成功，但表中没有数据。")
    except Exception as e:
        print(f"Supabase 连接失败：{e}")

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
    # 检查month_range表
    check_month_range_table()
    
    while True:
        print("\n请选择操作：")
        print("1. 导入 Excel 数据")
        print("2. 设置当月起始日期")
        print("3. 导入 检验 数据（设置起始日期进行导入）")
        print("4. 测试连接")
        print("5. 退出程序")
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
            break
        else:
            print("无效的选项，请重新输入。")

if __name__ == "__main__":
    main()
