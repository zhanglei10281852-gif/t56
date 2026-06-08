const Router = require('koa-router');
const dayjs = require('dayjs');
const pool = require('../database/db');
const { authMiddleware } = require('../middleware/auth');

const router = new Router({ prefix: '/api/dispatch' });

router.get('/tasks', authMiddleware, async (ctx) => {
  const { page = 1, pageSize = 20, status, district } = ctx.query;
  const user = ctx.state.user;

  let whereClause = 'WHERE 1=1';
  const params = [];

  if (user.role === 'dispatcher') {
    whereClause += ' AND (s1.district = ? OR s2.district = ?)';
    params.push(user.district, user.district);
  } else if (district) {
    whereClause += ' AND (s1.district = ? OR s2.district = ?)';
    params.push(district, district);
  }

  if (status) {
    whereClause += ' AND t.status = ?';
    params.push(status);
  }

  const offset = (page - 1) * pageSize;

  const [countResult] = await pool.execute(
    `SELECT COUNT(*) as total FROM dispatch_tasks t 
     LEFT JOIN stations s1 ON t.from_station_id = s1.id
     LEFT JOIN stations s2 ON t.to_station_id = s2.id
     ${whereClause}`,
    params
  );

  const [tasks] = await pool.execute(
    `SELECT t.*, 
      s1.station_code as from_station_code, s1.station_name as from_station_name, s1.district as from_district,
      s2.station_code as to_station_code, s2.station_name as to_station_name, s2.district as to_district,
      u.real_name as dispatcher_name
     FROM dispatch_tasks t
     LEFT JOIN stations s1 ON t.from_station_id = s1.id
     LEFT JOIN stations s2 ON t.to_station_id = s2.id
     LEFT JOIN users u ON t.dispatcher_id = u.id
     ${whereClause}
     ORDER BY t.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, parseInt(pageSize), offset]
  );

  ctx.body = {
    list: tasks,
    total: countResult[0].total,
    page: parseInt(page),
    pageSize: parseInt(pageSize)
  };
});

router.get('/tasks/:id', authMiddleware, async (ctx) => {
  const { id } = ctx.params;

  const [tasks] = await pool.execute(
    `SELECT t.*, 
      s1.station_code as from_station_code, s1.station_name as from_station_name,
      s2.station_code as to_station_code, s2.station_name as to_station_name,
      u.real_name as dispatcher_name
     FROM dispatch_tasks t
     LEFT JOIN stations s1 ON t.from_station_id = s1.id
     LEFT JOIN stations s2 ON t.to_station_id = s2.id
     LEFT JOIN users u ON t.dispatcher_id = u.id
     WHERE t.id = ?`,
    [id]
  );

  if (tasks.length === 0) {
    ctx.status = 404;
    ctx.body = { code: 404, message: '调度任务不存在' };
    return;
  }

  ctx.body = tasks[0];
});

router.post('/tasks', authMiddleware, async (ctx) => {
  const user = ctx.state.user;
  const { from_station_id, to_station_id, bike_count, dispatch_vehicle_plate, scheduled_time, remark } = ctx.request.body;

  if (!from_station_id || !to_station_id || !bike_count) {
    ctx.status = 400;
    ctx.body = { code: 400, message: '请填写完整的调度信息' };
    return;
  }

  if (from_station_id === to_station_id) {
    ctx.status = 400;
    ctx.body = { code: 400, message: '调出站点和调入站点不能相同' };
    return;
  }

  if (bike_count <= 0) {
    ctx.status = 400;
    ctx.body = { code: 400, message: '调度车辆数必须大于0' };
    return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [fromStations] = await connection.execute(
      'SELECT * FROM stations WHERE id = ?',
      [from_station_id]
    );

    if (fromStations.length === 0) {
      ctx.status = 404;
      ctx.body = { code: 404, message: '调出站点不存在' };
      await connection.rollback();
      return;
    }

    const [toStations] = await connection.execute(
      'SELECT * FROM stations WHERE id = ?',
      [to_station_id]
    );

    if (toStations.length === 0) {
      ctx.status = 404;
      ctx.body = { code: 404, message: '调入站点不存在' };
      await connection.rollback();
      return;
    }

    if (user.role === 'dispatcher') {
      if (fromStations[0].district !== user.district && toStations[0].district !== user.district) {
        ctx.status = 403;
        ctx.body = { code: 403, message: '只能管理本片区的调度任务' };
        await connection.rollback();
        return;
      }
    }

    if (fromStations[0].available_bikes < bike_count) {
      ctx.status = 400;
      ctx.body = { code: 400, message: `调出站点可用车辆不足，当前仅有${fromStations[0].available_bikes}辆` };
      await connection.rollback();
      return;
    }

    if (toStations[0].empty_docks < bike_count) {
      ctx.status = 400;
      ctx.body = { code: 400, message: `调入站点空桩不足，当前仅有${toStations[0].empty_docks}个空桩` };
      await connection.rollback();
      return;
    }

    const [maxResult] = await connection.execute(
      "SELECT MAX(CAST(SUBSTRING(task_code, 2) AS UNSIGNED)) as max_code FROM dispatch_tasks"
    );
    const nextCode = (maxResult[0].max_code || 0) + 1;
    const task_code = `T${String(nextCode).padStart(6, '0')}`;

    const dispatcherId = user.role === 'dispatcher' ? user.id : null;

    const [result] = await connection.execute(
      `INSERT INTO dispatch_tasks (task_code, from_station_id, to_station_id, bike_count, 
        dispatch_vehicle_plate, scheduled_time, status, dispatcher_id, remark) 
       VALUES (?, ?, ?, ?, ?, ?, '待执行', ?, ?)`,
      [task_code, from_station_id, to_station_id, bike_count, 
       dispatch_vehicle_plate || null, scheduled_time || null, 
       dispatcherId, remark || null]
    );

    await connection.commit();

    ctx.status = 201;
    ctx.body = {
      id: result.insertId,
      task_code,
      message: '调度任务创建成功'
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});

router.put('/tasks/:id/status', authMiddleware, async (ctx) => {
  const { id } = ctx.params;
  const { status } = ctx.request.body;
  const user = ctx.state.user;

  if (!['执行中', '已完成', '已取消'].includes(status)) {
    ctx.status = 400;
    ctx.body = { code: 400, message: '无效的状态值' };
    return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [tasks] = await connection.execute('SELECT * FROM dispatch_tasks WHERE id = ? FOR UPDATE', [id]);
    if (tasks.length === 0) {
      ctx.status = 404;
      ctx.body = { code: 404, message: '调度任务不存在' };
      await connection.rollback();
      return;
    }

    const task = tasks[0];

    if (user.role === 'dispatcher') {
      const [fromStation] = await connection.execute('SELECT district FROM stations WHERE id = ?', [task.from_station_id]);
      if (fromStation[0].district !== user.district) {
        ctx.status = 403;
        ctx.body = { code: 403, message: '只能管理本片区的调度任务' };
        await connection.rollback();
        return;
      }
    }

    if (status === '执行中' && task.status !== '待执行') {
      ctx.status = 400;
      ctx.body = { code: 400, message: '只有待执行的任务才能开始执行' };
      await connection.rollback();
      return;
    }

    if (status === '已完成' && task.status !== '执行中') {
      ctx.status = 400;
      ctx.body = { code: 400, message: '只有执行中的任务才能标记完成' };
      await connection.rollback();
      return;
    }

    if (status === '已完成') {
      const [fromStation] = await connection.execute(
        'SELECT * FROM stations WHERE id = ? FOR UPDATE',
        [task.from_station_id]
      );
      const [toStation] = await connection.execute(
        'SELECT * FROM stations WHERE id = ? FOR UPDATE',
        [task.to_station_id]
      );

      if (fromStation[0].available_bikes < task.bike_count) {
        ctx.status = 400;
        ctx.body = { code: 400, message: '调出站点车辆不足' };
        await connection.rollback();
        return;
      }

      if (toStation[0].empty_docks < task.bike_count) {
        ctx.status = 400;
        ctx.body = { code: 400, message: '调入站点空桩不足' };
        await connection.rollback();
        return;
      }

      await connection.execute(
        'UPDATE stations SET available_bikes = available_bikes - ?, empty_docks = empty_docks + ? WHERE id = ?',
        [task.bike_count, task.bike_count, task.from_station_id]
      );

      await connection.execute(
        'UPDATE stations SET available_bikes = available_bikes + ?, empty_docks = empty_docks - ? WHERE id = ?',
        [task.bike_count, task.bike_count, task.to_station_id]
      );

      const [bikesToMove] = await connection.execute(
        "SELECT id FROM bikes WHERE station_id = ? AND status = '在桩' LIMIT ?",
        [task.from_station_id, task.bike_count]
      );

      for (const bike of bikesToMove) {
        await connection.execute(
          "UPDATE bikes SET status = '调度中', station_id = NULL WHERE id = ?",
          [bike.id]
        );
      }

      for (const bike of bikesToMove) {
        await connection.execute(
          "UPDATE bikes SET status = '在桩', station_id = ? WHERE id = ?",
          [task.to_station_id, bike.id]
        );
      }

      const endTime = dayjs().format('YYYY-MM-DD HH:mm:ss');
      await connection.execute(
        "UPDATE dispatch_tasks SET status = '已完成', actual_end_time = ? WHERE id = ?",
        [endTime, id]
      );
    } else if (status === '执行中') {
      const startTime = dayjs().format('YYYY-MM-DD HH:mm:ss');
      await connection.execute(
        "UPDATE dispatch_tasks SET status = '执行中', actual_start_time = ? WHERE id = ?",
        [startTime, id]
      );
    } else {
      await connection.execute(
        'UPDATE dispatch_tasks SET status = ? WHERE id = ?',
        [status, id]
      );
    }

    await connection.commit();
    ctx.body = { message: `任务状态已更新为${status}` };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});

router.delete('/tasks/:id', authMiddleware, async (ctx) => {
  const { id } = ctx.params;
  const user = ctx.state.user;

  const [tasks] = await pool.execute('SELECT * FROM dispatch_tasks WHERE id = ?', [id]);
  if (tasks.length === 0) {
    ctx.status = 404;
    ctx.body = { code: 404, message: '调度任务不存在' };
    return;
  }

  if (tasks[0].status !== '待执行') {
    ctx.status = 400;
    ctx.body = { code: 400, message: '只能删除待执行的任务' };
    return;
  }

  if (user.role === 'dispatcher') {
    const [fromStation] = await pool.execute('SELECT district FROM stations WHERE id = ?', [tasks[0].from_station_id]);
    if (fromStation[0].district !== user.district) {
      ctx.status = 403;
      ctx.body = { code: 403, message: '只能删除本片区的调度任务' };
      return;
    }
  }

  await pool.execute('DELETE FROM dispatch_tasks WHERE id = ?', [id]);
  ctx.body = { message: '调度任务删除成功' };
});

module.exports = router;
