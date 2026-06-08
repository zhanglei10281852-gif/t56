-- 城市公共自行车运营管理平台数据库初始化脚本
-- 仅在数据库为空时执行建表，数据由后端 Node.js 服务初始化

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 建表语句由后端服务自动执行，这里保留空文件以确保目录结构正确
-- 实际数据初始化在 backend/src/database/init.js 中执行

SET FOREIGN_KEY_CHECKS = 1;
