const bcrypt = require('bcryptjs');
const dayjs = require('dayjs');
const pool = require('./db');
const { createTables } = require('./schema');

const initData = async () => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    console.log('正在初始化用户数据...');
    const [users] = await connection.execute('SELECT COUNT(*) as count FROM users');
    if (users[0].count === 0) {
      const adminPassword = bcrypt.hashSync('bike@2024', 10);
      const dispatcherPassword = bcrypt.hashSync('dp888', 10);

      await connection.execute(
        `INSERT INTO users (username, password, real_name, role, district) VALUES 
         (?, ?, ?, 'admin', NULL),
         (?, ?, ?, 'dispatcher', '东区'),
         (?, ?, ?, 'dispatcher', '西区'),
         (?, ?, ?, 'dispatcher', '南区')`,
        [
          'admin', adminPassword, '系统管理员',
          'dispatcher1', dispatcherPassword, '张调度',
          'dispatcher2', dispatcherPassword, '李调度',
          'dispatcher3', dispatcherPassword, '王调度'
        ]
      );
      console.log('用户数据初始化完成');
    } else {
      console.log('用户数据已存在，跳过');
    }

    console.log('正在初始化站点数据...');
    const [stations] = await connection.execute('SELECT COUNT(*) as count FROM stations');
    if (stations[0].count === 0) {
      const stationData = [
        { name: '人民广场站', lat: 31.2304, lng: 121.4737, district: '东区', docks: 30 },
        { name: '南京东路站', lat: 31.2350, lng: 121.4800, district: '东区', docks: 25 },
        { name: '陆家嘴站', lat: 31.2397, lng: 121.4998, district: '东区', docks: 35 },
        { name: '世纪大道站', lat: 31.2250, lng: 121.5200, district: '东区', docks: 40 },
        { name: '张江高科站', lat: 31.2050, lng: 121.5800, district: '东区', docks: 20 },
        { name: '静安寺站', lat: 31.2230, lng: 121.4450, district: '西区', docks: 32 },
        { name: '中山公园站', lat: 31.2200, lng: 121.4200, district: '西区', docks: 28 },
        { name: '徐家汇站', lat: 31.1950, lng: 121.4370, district: '西区', docks: 38 },
        { name: '虹桥火车站', lat: 31.1950, lng: 121.3200, district: '西区', docks: 40 },
        { name: '漕河泾站', lat: 31.1800, lng: 121.4000, district: '西区', docks: 22 },
        { name: '人民广场南站', lat: 31.2200, lng: 121.4737, district: '南区', docks: 26 },
        { name: '打浦桥站', lat: 31.2050, lng: 121.4700, district: '南区', docks: 24 },
        { name: '世博园区站', lat: 31.1900, lng: 121.4900, district: '南区', docks: 36 },
        { name: '龙华寺站', lat: 31.1800, lng: 121.4500, district: '南区', docks: 18 },
        { name: '上海南站', lat: 31.1550, lng: 121.4300, district: '南区', docks: 15 }
      ];

      for (let i = 0; i < stationData.length; i++) {
        const station = stationData[i];
        const code = `S${String(i + 1).padStart(4, '0')}`;
        const availableBikes = Math.floor(Math.random() * (station.docks + 1));
        const emptyDocks = station.docks - availableBikes;

        await connection.execute(
          `INSERT INTO stations (station_code, station_name, latitude, longitude, district, total_docks, available_bikes, empty_docks) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [code, station.name, station.lat, station.lng, station.district, station.docks, availableBikes, emptyDocks]
        );
      }
      console.log('站点数据初始化完成，共15个站点');
    } else {
      console.log('站点数据已存在，跳过');
    }

    console.log('正在初始化车辆数据...');
    const [bikes] = await connection.execute('SELECT COUNT(*) as count FROM bikes');
    if (bikes[0].count === 0) {
      const [stationList] = await connection.execute('SELECT id, total_docks, available_bikes FROM stations ORDER BY id');
      
      let bikeIndex = 1;
      const totalBikes = 200;
      
      for (const station of stationList) {
        const bikesAtStation = station.available_bikes;
        for (let j = 0; j < bikesAtStation && bikeIndex <= totalBikes; j++) {
          const bikeCode = `B${String(bikeIndex).padStart(5, '0')}`;
          const bikeType = Math.random() > 0.7 ? '电助力' : '普通';
          const rideCount = Math.floor(Math.random() * 500);
          const lastMaintenance = dayjs().subtract(Math.floor(Math.random() * 90), 'day').format('YYYY-MM-DD');

          await connection.execute(
            `INSERT INTO bikes (bike_code, bike_type, status, station_id, ride_count, last_maintenance_date) 
             VALUES (?, ?, '在桩', ?, ?, ?)`,
            [bikeCode, bikeType, station.id, rideCount, lastMaintenance]
          );
          bikeIndex++;
        }
      }

      while (bikeIndex <= totalBikes) {
        const bikeCode = `B${String(bikeIndex).padStart(5, '0')}`;
        const bikeType = Math.random() > 0.7 ? '电助力' : '普通';
        const statuses = ['骑行中', '维修中', '调度中'];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const rideCount = Math.floor(Math.random() * 500);
        const lastMaintenance = dayjs().subtract(Math.floor(Math.random() * 90), 'day').format('YYYY-MM-DD');

        await connection.execute(
          `INSERT INTO bikes (bike_code, bike_type, status, station_id, ride_count, last_maintenance_date) 
           VALUES (?, ?, ?, NULL, ?, ?)`,
          [bikeCode, bikeType, status, rideCount, lastMaintenance]
        );
        bikeIndex++;
      }

      console.log('车辆数据初始化完成，共200辆车');
    } else {
      console.log('车辆数据已存在，跳过');
    }

    console.log('正在初始化骑行记录...');
    const [rides] = await connection.execute('SELECT COUNT(*) as count FROM ride_records');
    if (rides[0].count === 0) {
      const [bikeList] = await connection.execute('SELECT id FROM bikes LIMIT 50');
      const [stationList] = await connection.execute('SELECT id, latitude, longitude FROM stations');
      
      for (let i = 0; i < 100; i++) {
        const bike = bikeList[Math.floor(Math.random() * bikeList.length)];
        const startStation = stationList[Math.floor(Math.random() * stationList.length)];
        let endStation = stationList[Math.floor(Math.random() * stationList.length)];
        while (endStation.id === startStation.id) {
          endStation = stationList[Math.floor(Math.random() * stationList.length)];
        }
        
        const startTime = dayjs().subtract(Math.floor(Math.random() * 7), 'day').subtract(Math.floor(Math.random() * 24), 'hour');
        const duration = Math.floor(Math.random() * 60) + 5;
        const endTime = startTime.add(duration, 'minute');
        const phone = `138${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}`;

        await connection.execute(
          `INSERT INTO ride_records (bike_id, user_phone, start_station_id, start_time, start_latitude, start_longitude, 
            end_station_id, end_time, end_latitude, end_longitude, duration, status) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '已完成')`,
          [
            bike.id, phone, startStation.id, startTime.format('YYYY-MM-DD HH:mm:ss'), 
            startStation.latitude, startStation.longitude,
            endStation.id, endTime.format('YYYY-MM-DD HH:mm:ss'),
            endStation.latitude, endStation.longitude, duration
          ]
        );
      }
      console.log('骑行记录初始化完成，共100条记录');
    } else {
      console.log('骑行记录已存在，跳过');
    }

    console.log('正在初始化故障报修记录...');
    const [faults] = await connection.execute('SELECT COUNT(*) as count FROM fault_reports');
    if (faults[0].count === 0) {
      const [bikeList] = await connection.execute('SELECT id FROM bikes LIMIT 30');
      const faultTypes = ['刹车', '轮胎', '锁具', '链条', '电池', '其他'];
      const statuses = ['待处理', '维修中', '已完成'];
      
      for (let i = 0; i < 15; i++) {
        const bike = bikeList[Math.floor(Math.random() * bikeList.length)];
        const faultType = faultTypes[Math.floor(Math.random() * faultTypes.length)];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const reportTime = dayjs().subtract(Math.floor(Math.random() * 30), 'day');
        const reportCode = `F${String(i + 1).padStart(6, '0')}`;
        const phone = `139${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}`;

        let maintenanceStaff = null;
        let maintenanceResult = null;
        let maintenanceTime = null;
        if (status === '已完成') {
          maintenanceStaff = '李师傅';
          maintenanceResult = '已更换部件，修复完成';
          maintenanceTime = reportTime.add(1, 'day').format('YYYY-MM-DD HH:mm:ss');
        }

        await connection.execute(
          `INSERT INTO fault_reports (report_code, bike_id, fault_type, description, reporter_phone, report_time, 
            status, maintenance_staff, maintenance_result, maintenance_time) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            reportCode, bike.id, faultType, `${faultType}故障，需要维修`, phone,
            reportTime.format('YYYY-MM-DD HH:mm:ss'), status, maintenanceStaff, maintenanceResult, maintenanceTime
          ]
        );
      }
      console.log('故障报修数据初始化完成，共15条记录');
    } else {
      console.log('故障报修数据已存在，跳过');
    }

    console.log('正在初始化调度任务...');
    const [tasks] = await connection.execute('SELECT COUNT(*) as count FROM dispatch_tasks');
    if (tasks[0].count === 0) {
      const [stationList] = await connection.execute('SELECT id FROM stations');
      const statuses = ['待执行', '执行中', '已完成'];
      
      for (let i = 0; i < 8; i++) {
        const fromIdx = Math.floor(Math.random() * stationList.length);
        let toIdx = Math.floor(Math.random() * stationList.length);
        while (toIdx === fromIdx) {
          toIdx = Math.floor(Math.random() * stationList.length);
        }
        const taskCode = `T${String(i + 1).padStart(6, '0')}`;
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const bikeCount = Math.floor(Math.random() * 10) + 3;
        const scheduledTime = dayjs().add(Math.floor(Math.random() * 3), 'day');
        const plate = `沪A${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;

        let actualStart = null;
        let actualEnd = null;
        if (status === '执行中' || status === '已完成') {
          actualStart = scheduledTime.subtract(1, 'hour').format('YYYY-MM-DD HH:mm:ss');
        }
        if (status === '已完成') {
          actualEnd = scheduledTime.add(1, 'hour').format('YYYY-MM-DD HH:mm:ss');
        }

        await connection.execute(
          `INSERT INTO dispatch_tasks (task_code, from_station_id, to_station_id, bike_count, dispatch_vehicle_plate, 
            scheduled_time, actual_start_time, actual_end_time, status, remark) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            taskCode, stationList[fromIdx].id, stationList[toIdx].id, bikeCount, plate,
            scheduledTime.format('YYYY-MM-DD HH:mm:ss'), actualStart, actualEnd, status,
            '日常调度任务'
          ]
        );
      }
      console.log('调度任务初始化完成，共8条任务');
    } else {
      console.log('调度任务数据已存在，跳过');
    }

    await connection.commit();
    console.log('所有数据初始化完成！');
    return true;
  } catch (error) {
    await connection.rollback();
    console.error('初始化数据失败:', error);
    throw error;
  } finally {
    connection.release();
  }
};

const init = async () => {
  try {
    console.log('开始数据库初始化...');
    await createTables();
    await initData();
    console.log('数据库初始化全部完成！');
    process.exit(0);
  } catch (error) {
    console.error('初始化失败:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  init();
}

module.exports = { initData };
