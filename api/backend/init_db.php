<?php
// 数据库连接配置
$host = "localhost";
$username = "root";
$password = "yb123456";

// 创建数据库连接
$conn = new mysqli($host, $username, $password);

// 检查连接
if ($conn->connect_error) {
    die("数据库连接失败: " . $conn->connect_error);
}

echo "数据库连接成功\n";

// 读取SQL文件内容
$sql_file = file_get_contents('create_tables.sql');

// 分割SQL语句
$sql_statements = explode(';', $sql_file);

// 执行每个SQL语句
foreach ($sql_statements as $statement) {
    $statement = trim($statement);
    if (!empty($statement)) {
        if ($conn->query($statement) === TRUE) {
            echo "执行成功: " . substr($statement, 0, 50) . "...\n";
        } else {
            echo "执行失败: " . $conn->error . "\n";
        }
    }
}

echo "数据库初始化完成\n";

// 关闭连接
$conn->close();
?>