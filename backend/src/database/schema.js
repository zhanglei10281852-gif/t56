const pool = require('./db');

const createTables = async () => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        real_name VARCHAR(50),
        role ENUM('admin', 'dispatcher') NOT NULL DEFAULT 'dispatcher',
        district ENUM('东区', '西区', '南区'),
        status TINYINT DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS stations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        station_code VARCHAR(10) UNIQUE NOT NULL,
        station_name VARCHAR(100) NOT NULL,
        latitude DECIMAL(10,6) NOT NULL,
        longitude DECIMAL(10,6) NOT NULL,
        district ENUM('东区', '西区', '南区') NOT NULL,
        total_docks INT NOT NULL,
        available_bikes INT NOT NULL DEFAULT 0,
        empty_docks INT NOT NULL DEFAULT 0,
        status TINYINT DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_district (district),
        INDEX idx_station_code (station_code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS bikes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        bike_code VARCHAR(20) UNIQUE NOT NULL,
        bike_type ENUM('普通', '电助力') NOT NULL DEFAULT '普通',
        status ENUM('在桩', '骑行中', '调度中', '维修中', '报废') NOT NULL DEFAULT '在桩',
        station_id INT,
        ride_count INT DEFAULT 0,
        last_maintenance_date DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (status),
        INDEX idx_station (station_id),
        FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS ride_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        bike_id INT NOT NULL,
        user_phone VARCHAR(20) NOT NULL,
        start_station_id INT NOT NULL,
        start_time DATETIME NOT NULL,
        start_latitude DECIMAL(10,6),
        start_longitude DECIMAL(10,6),
        end_station_id INT,
        end_time DATETIME,
        end_latitude DECIMAL(10,6),
        end_longitude DECIMAL(10,6),
        duration INT DEFAULT 0,
        status ENUM('骑行中', '已完成') DEFAULT '骑行中',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user (user_phone),
        INDEX idx_bike (bike_id),
        INDEX idx_start_time (start_time),
        INDEX idx_status (status),
        FOREIGN KEY (bike_id) REFERENCES bikes(id),
        FOREIGN KEY (start_station_id) REFERENCES stations(id),
        FOREIGN KEY (end_station_id) REFERENCES stations(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS dispatch_tasks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        task_code VARCHAR(20) UNIQUE NOT NULL,
        from_station_id INT NOT NULL,
        to_station_id INT NOT NULL,
        bike_count INT NOT NULL,
        dispatch_vehicle_plate VARCHAR(20),
        scheduled_time DATETIME,
        actual_start_time DATETIME,
        actual_end_time DATETIME,
        status ENUM('待执行', '执行中', '已完成', '已取消') DEFAULT '待执行',
        dispatcher_id INT,
        remark VARCHAR(500),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (status),
        INDEX idx_dispatcher (dispatcher_id),
        INDEX idx_scheduled_time (scheduled_time),
        FOREIGN KEY (from_station_id) REFERENCES stations(id),
        FOREIGN KEY (to_station_id) REFERENCES stations(id),
        FOREIGN KEY (dispatcher_id) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS fault_reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        report_code VARCHAR(20) UNIQUE NOT NULL,
        bike_id INT NOT NULL,
        fault_type ENUM('刹车', '轮胎', '锁具', '链条', '电池', '其他') NOT NULL,
        description VARCHAR(500),
        reporter_phone VARCHAR(20),
        report_time DATETIME NOT NULL,
        status ENUM('待处理', '维修中', '已完成') DEFAULT '待处理',
        maintenance_staff VARCHAR(50),
        maintenance_result VARCHAR(500),
        maintenance_time DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (status),
        INDEX idx_bike (bike_id),
        INDEX idx_report_time (report_time),
        FOREIGN KEY (bike_id) REFERENCES bikes(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await connection.commit();
    console.log('数据库表创建成功');
    return true;
  } catch (error) {
    await connection.rollback();
    console.error('创建表失败:', error);
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = { createTables };
