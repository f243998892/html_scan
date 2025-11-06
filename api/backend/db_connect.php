<?php
// 数据库连接配置
$host = "localhost";
$username = "root";
$password = "yb123456";
$database = "product_system";

// 创建数据库连接
function getDBConnection() {
    global $host, $username, $password, $database;
    
    $conn = new mysqli($host, $username, $password, $database);
    
    // 检查连接
    if ($conn->connect_error) {
        header('Content-Type: application/json');
        echo json_encode(['error' => "数据库连接失败: " . $conn->connect_error]);
        exit();
    }
    
    // 设置字符集
    $conn->set_charset("utf8");
    
    return $conn;
}

// 关闭数据库连接
function closeDBConnection($conn) {
    if ($conn) {
        $conn->close();
    }
}
?>