<?php
// 设置响应头
header('Content-Type: application/json');

// 引入数据库连接
require_once 'db_connect.php';

// 获取组产品数据
function getGroupProducts($group_id) {
    $conn = getDBConnection();
    
    try {
        $sql = "SELECT p.id, p.name, p.model FROM products p 
                JOIN group_products gp ON p.id = gp.product_id 
                WHERE gp.group_id = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("i", $group_id);
        $stmt->execute();
        $result = $stmt->get_result();
        
        $products = [];
        while($row = $result->fetch_assoc()) {
            $products[] = $row;
        }
        
        return ['products' => $products];
    } catch (Exception $e) {
        return ['error' => '获取产品数据失败: ' . $e->getMessage()];
    } finally {
        closeDBConnection($conn);
    }
}

// 获取未分配产品数据
function getUnassignedProducts() {
    $conn = getDBConnection();
    
    try {
        $sql = "SELECT p.id, p.name, p.model FROM products p 
                LEFT JOIN group_products gp ON p.id = gp.product_id 
                WHERE gp.product_id IS NULL";
        $result = $conn->query($sql);
        
        $products = [];
        while($row = $result->fetch_assoc()) {
            $products[] = $row;
        }
        
        return ['products' => $products];
    } catch (Exception $e) {
        return ['error' => '获取未分配产品数据失败: ' . $e->getMessage()];
    } finally {
        closeDBConnection($conn);
    }
}
?>