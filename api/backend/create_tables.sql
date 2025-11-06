-- 创建数据库
CREATE DATABASE IF NOT EXISTS product_system;
USE product_system;

-- 创建组表
CREATE TABLE IF NOT EXISTS `groups` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 创建组成员表
CREATE TABLE IF NOT EXISTS `group_members` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `group_id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `group_id` (`group_id`),
  CONSTRAINT `group_members_ibfk_1` FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 创建产品表
CREATE TABLE IF NOT EXISTS `products` (
  `id` varchar(20) NOT NULL,
  `name` varchar(100) NOT NULL,
  `model` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 创建组产品关联表
CREATE TABLE IF NOT EXISTS `group_products` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `group_id` int(11) NOT NULL,
  `product_id` varchar(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `group_product_unique` (`group_id`,`product_id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `group_products_ibfk_1` FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`) ON DELETE CASCADE,
  CONSTRAINT `group_products_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 插入示例数据
INSERT INTO `groups` (`name`, `description`) VALUES
('小组A', '组装'),
('小组B', '测试'),
('小组C', '包装');

INSERT INTO `group_members` (`group_id`, `name`) VALUES
(1, '张三'),
(1, '李四'),
(1, '王五'),
(2, '赵六'),
(2, '钱七'),
(2, '孙八'),
(3, '周九'),
(3, '吴十'),
(3, '郑十一');

INSERT INTO `products` (`id`, `name`, `model`) VALUES
('P001', '产品A', '型号X'),
('P002', '产品B', '型号Y'),
('P003', '产品C', '型号Z'),
('P004', '产品D', '型号W'),
('P005', '产品E', '型号V');

INSERT INTO `group_products` (`group_id`, `product_id`) VALUES
(1, 'P001'),
(1, 'P002'),
(2, 'P003'),
(3, 'P004');