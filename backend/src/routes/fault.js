const Router = require('koa-router');
const dayjs = require('dayjs');
const pool = require('../database/db');
const { authMiddleware } = require('../middleware/auth');

const router = new Router({ prefix: '/api/fault' });

router.get('/reports', authMiddleware, async (ctx) => {
  const { page = 1, pageSize = 20, status, fault_type, keyword } = ctx.query;
  const user = ctx.state.user;

  let whereClause = 'WHERE 1=1';
  const params = [];

  if (user.role === 'dispatcher' && user.district) {
    whereClause += ' AND f.bike_id IN (SELECT id FROM bikes WHERE station_id IN (SELECT id FROM stations WHERE district = ?))';
    params.push(user.district);
  }

  if (status) {
    whereClause += ' AND f.status = ?';
    params.push(status);
  }

  if (fault_type) {
    whereClause += ' AND f.fault_type = ?';
    params.push(fault_type);
  }

  if (keyword) {
    whereClause += ' AND (f.report_code LIKE ? OR b.bike_code LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  const offset = (page - 1) * pageSize;

  const [countResult] = await pool.execute(
    `SELECT COUNT(*) as total FROM fault_reports f 
     LEFT JOIN bikes b ON f.bike_id = b.id
     ${whereClause}`,
    params
  );

  const [reports] = await pool.execute(
    `SELECT f.*, b.bike_code, b.bike_type, s.station_name, s.station_code
     FROM fault_reports f
     LEFT JOIN bikes b ON f.bike_id = b.id
     LEFT JOIN stations s ON b.station_id = s.id
     ${whereClause}
     ORDER BY f.report_time DESC
     LIMIT ? OFFSET ?`,
    [...params, parseInt(pageSize), offset]
  );

  ctx.body = {
    list: reports,
    total: countResult[0].total,
    page: parseInt(page),
    pageSize: parseInt(pageSize)
  };
});

router.get('/reports/:id', authMiddleware, async (ctx) => {
  const { id } = ctx.params;

  const [reports] = await pool.execute(
    `SELECT f.*, b.bike_code, b.bike_type, b.status as bike_status, 
      s.station_name, s.station_code, s.district
     FROM fault_reports f
     LEFT JOIN bikes b ON f.bike_id = b.id
     LEFT JOIN stations s ON b.station_id = s.id
     WHERE f.id = ?`,
    [id]
  );

  if (reports.length === 0) {
    ctx.status = 404;
    ctx.body = { code: 404, message: '报修记录不存在' };
    return;
  }

  ctx.body = reports[0];
});

router.post('/reports', authMiddleware, async (ctx) => {
  const { bike_code, fault_type, description, reporter_phone } = ctx.request.body;

  if (!bike_code || !fault_type) {
    ctx.status = 400;
    ctx.body = { code: 400, message: '车辆编号和故障类型不能为空' };
    return;
  }

  const validTypes = ['刹车', '轮胎', '锁具', '链条', '电池', '其他'];
  if (!validTypes.includes(fault_type)) {
    ctx.status = 400;
    ctx.body = { code: 400, message: '无效的故障类型' };
    return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [bikes] = await connection.execute('SELECT * FROM bikes WHERE bike_code = ?', [bike_code]);
    if (bikes.length === 0) {
      ctx.status = 404;
      ctx.body = { code: 404, message: '车辆不存在' };
      await connection.rollback();
      return;
    }

    const bike = bikes[0];

    if (bike.status === '维修中') {
      ctx.status = 400;
      ctx.body = { code: 400, message: '该车辆已在维修中' };
      await connection.rollback();
      return;
    }

    const [maxResult] = await connection.execute(
      "SELECT MAX(CAST(SUBSTRING(report_code, 2) AS UNSIGNED)) as max_code FROM fault_reports"
    );
    const nextCode = (maxResult[0].max_code || 0) + 1;
    const report_code = `F${String(nextCode).padStart(6, '0')}`;

    const reportTime = dayjs().format('YYYY-MM-DD HH:mm:ss');

    const [result] = await connection.execute(
      `INSERT INTO fault_reports (report_code, bike_id, fault_type, description, reporter_phone, report_time, status) 
       VALUES (?, ?, ?, ?, ?, ?, '待处理')`,
      [report_code, bike.id, fault_type, description || '', reporter_phone || '', reportTime]
    );

    if (bike.status === '在桩' && bike.station_id) {
      await connection.execute(
        'UPDATE stations SET available_bikes = available_bikes - 1, empty_docks = empty_docks + 1 WHERE id = ?',
        [bike.station_id]
      );
    }

    await connection.execute(
      "UPDATE bikes SET status = '维修中' WHERE id = ?",
      [bike.id]
    );

    await connection.commit();

    ctx.status = 201;
    ctx.body = {
      id: result.insertId,
      report_code,
      message: '故障报修成功'
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});

router.put('/reports/:id/maintenance', authMiddleware, async (ctx) => {
  const { id } = ctx.params;
  const { action, maintenance_staff, maintenance_result } = ctx.request.body;
  const user = ctx.state.user;

  if (!['开始维修', '完成维修'].includes(action)) {
    ctx.status = 400;
    ctx.body = { code: 400, message: '无效的操作类型' };
    return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [reports] = await connection.execute(
      'SELECT * FROM fault_reports WHERE id = ? FOR UPDATE',
      [id]
    );

    if (reports.length === 0) {
      ctx.status = 404;
      ctx.body = { code: 404, message: '报修记录不存在' };
      await connection.rollback();
      return;
    }

    const report = reports[0];

    if (action === '开始维修') {
      if (report.status !== '待处理') {
        ctx.status = 400;
        ctx.body = { code: 400, message: '只有待处理的报修可以开始维修' };
        await connection.rollback();
        return;
      }

      await connection.execute(
        "UPDATE fault_reports SET status = '维修中', maintenance_staff = ? WHERE id = ?",
        [maintenance_staff || user.realName || '维修员', id]
      );
    } else if (action === '完成维修') {
      if (report.status !== '维修中') {
        ctx.status = 400;
        ctx.body = { code: 400, message: '只有维修中的报修可以完成' };
        await connection.rollback();
        return;
      }

      const maintenanceTime = dayjs().format('YYYY-MM-DD HH:mm:ss');

      await connection.execute(
        `UPDATE fault_reports SET status = '已完成', maintenance_result = ?, maintenance_time = ? WHERE id = ?`,
        [maintenance_result || '维修完成', maintenanceTime, id]
      );

      const [bikes] = await connection.execute('SELECT * FROM bikes WHERE id = ?', [report.bike_id]);
      if (bikes.length > 0) {
        const bike = bikes[0];
        if (bike.station_id) {
          const [stations] = await connection.execute('SELECT * FROM stations WHERE id = ?', [bike.station_id]);
          if (stations.length > 0 && stations[0].empty_docks > 0) {
            await connection.execute(
              'UPDATE stations SET available_bikes = available_bikes + 1, empty_docks = empty_docks - 1 WHERE id = ?',
              [bike.station_id]
            );
          }
        }
        await connection.execute(
          "UPDATE bikes SET status = '在桩', last_maintenance_date = CURDATE() WHERE id = ?",
          [report.bike_id]
        );
      }
    }

    await connection.commit();
    ctx.body = { message: `操作成功，状态已更新` };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});

module.exports = router;
