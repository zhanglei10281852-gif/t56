const Router = require('koa-router');
const dayjs = require('dayjs');
const pool = require('../database/db');
const { authMiddleware } = require('../middleware/auth');

const router = new Router({ prefix: '/api/ride' });

router.post('/borrow', authMiddleware, async (ctx) => {
  const { station_id, user_phone } = ctx.request.body;

  if (!station_id || !user_phone) {
    ctx.status = 400;
    ctx.body = { code: 400, message: '站点ID和用户手机号不能为空' };
    return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [stations] = await connection.execute(
      'SELECT * FROM stations WHERE id = ? FOR UPDATE',
      [station_id]
    );

    if (stations.length === 0) {
      ctx.status = 404;
      ctx.body = { code: 404, message: '站点不存在' };
      await connection.rollback();
      return;
    }

    const station = stations[0];
    if (station.available_bikes <= 0) {
      ctx.status = 400;
      ctx.body = { code: 400, message: '该站点没有可用车辆' };
      await connection.rollback();
      return;
    }

    const [bikes] = await connection.execute(
      "SELECT * FROM bikes WHERE station_id = ? AND status = '在桩' LIMIT 1 FOR UPDATE",
      [station_id]
    );

    if (bikes.length === 0) {
      ctx.status = 400;
      ctx.body = { code: 400, message: '该站点没有可用车辆' };
      await connection.rollback();
      return;
    }

    const bike = bikes[0];

    await connection.execute(
      "UPDATE bikes SET status = '骑行中', station_id = NULL WHERE id = ?",
      [bike.id]
    );

    await connection.execute(
      'UPDATE stations SET available_bikes = available_bikes - 1, empty_docks = empty_docks + 1 WHERE id = ?',
      [station_id]
    );

    const startTime = dayjs().format('YYYY-MM-DD HH:mm:ss');
    const [result] = await connection.execute(
      `INSERT INTO ride_records (bike_id, user_phone, start_station_id, start_time, 
        start_latitude, start_longitude, status) 
       VALUES (?, ?, ?, ?, ?, ?, '骑行中')`,
      [bike.id, user_phone, station_id, startTime, station.latitude, station.longitude]
    );

    await connection.commit();

    ctx.body = {
      recordId: result.insertId,
      bikeCode: bike.bike_code,
      bikeType: bike.bike_type,
      stationName: station.station_name,
      startTime,
      message: '借车成功'
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});

router.post('/return', authMiddleware, async (ctx) => {
  const { bike_code, station_id } = ctx.request.body;

  if (!bike_code || !station_id) {
    ctx.status = 400;
    ctx.body = { code: 400, message: '车辆编号和目标站点ID不能为空' };
    return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [bikes] = await connection.execute(
      "SELECT * FROM bikes WHERE bike_code = ? AND status = '骑行中' FOR UPDATE",
      [bike_code]
    );

    if (bikes.length === 0) {
      ctx.status = 400;
      ctx.body = { code: 400, message: '车辆不存在或不在骑行状态' };
      await connection.rollback();
      return;
    }

    const bike = bikes[0];

    const [stations] = await connection.execute(
      'SELECT * FROM stations WHERE id = ? FOR UPDATE',
      [station_id]
    );

    if (stations.length === 0) {
      ctx.status = 404;
      ctx.body = { code: 404, message: '目标站点不存在' };
      await connection.rollback();
      return;
    }

    const station = stations[0];
    if (station.empty_docks <= 0) {
      ctx.status = 400;
      ctx.body = { code: 400, message: '目标站点空桩已满，无法还车' };
      await connection.rollback();
      return;
    }

    const [records] = await connection.execute(
      "SELECT * FROM ride_records WHERE bike_id = ? AND status = '骑行中' ORDER BY start_time DESC LIMIT 1 FOR UPDATE",
      [bike.id]
    );

    if (records.length === 0) {
      ctx.status = 400;
      ctx.body = { code: 400, message: '未找到骑行记录' };
      await connection.rollback();
      return;
    }

    const record = records[0];
    const endTime = dayjs().format('YYYY-MM-DD HH:mm:ss');
    const duration = Math.round((new Date(endTime) - new Date(record.start_time)) / 60000);

    await connection.execute(
      `UPDATE ride_records SET end_station_id = ?, end_time = ?, 
        end_latitude = ?, end_longitude = ?, duration = ?, status = '已完成' 
       WHERE id = ?`,
      [station_id, endTime, station.latitude, station.longitude, duration, record.id]
    );

    await connection.execute(
      "UPDATE bikes SET status = '在桩', station_id = ?, ride_count = ride_count + 1 WHERE id = ?",
      [station_id, bike.id]
    );

    await connection.execute(
      'UPDATE stations SET available_bikes = available_bikes + 1, empty_docks = empty_docks - 1 WHERE id = ?',
      [station_id]
    );

    await connection.commit();

    ctx.body = {
      recordId: record.id,
      bikeCode: bike.bike_code,
      stationName: station.station_name,
      endTime,
      duration,
      message: '还车成功'
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});

router.get('/records', authMiddleware, async (ctx) => {
  const { page = 1, pageSize = 20, user_phone, status, start_date, end_date } = ctx.query;
  const user = ctx.state.user;

  let whereClause = 'WHERE 1=1';
  const params = [];

  if (user.role === 'dispatcher' && user.district) {
    whereClause += ' AND r.start_station_id IN (SELECT id FROM stations WHERE district = ?)';
    params.push(user.district);
  }

  if (user_phone) {
    whereClause += ' AND r.user_phone LIKE ?';
    params.push(`%${user_phone}%`);
  }

  if (status) {
    whereClause += ' AND r.status = ?';
    params.push(status);
  }

  if (start_date) {
    whereClause += ' AND r.start_time >= ?';
    params.push(start_date);
  }

  if (end_date) {
    whereClause += ' AND r.start_time <= ?';
    params.push(end_date + ' 23:59:59');
  }

  const offset = (page - 1) * pageSize;

  const [countResult] = await pool.execute(
    `SELECT COUNT(*) as total FROM ride_records r ${whereClause}`,
    params
  );

  const [records] = await pool.execute(
    `SELECT r.*, b.bike_code, s1.station_name as start_station_name, s2.station_name as end_station_name
     FROM ride_records r
     LEFT JOIN bikes b ON r.bike_id = b.id
     LEFT JOIN stations s1 ON r.start_station_id = s1.id
     LEFT JOIN stations s2 ON r.end_station_id = s2.id
     ${whereClause}
     ORDER BY r.start_time DESC
     LIMIT ? OFFSET ?`,
    [...params, parseInt(pageSize), offset]
  );

  ctx.body = {
    list: records,
    total: countResult[0].total,
    page: parseInt(page),
    pageSize: parseInt(pageSize)
  };
});

module.exports = router;
