const Router = require('koa-router');
const pool = require('../database/db');
const { authMiddleware, checkDistrictAccess } = require('../middleware/auth');

const router = new Router({ prefix: '/api/stations' });

router.get('/', authMiddleware, async (ctx) => {
  const { district, page = 1, pageSize = 20, keyword } = ctx.query;
  const user = ctx.state.user;

  let whereClause = 'WHERE 1=1';
  const params = [];

  if (user.role === 'dispatcher' && user.district) {
    whereClause += ' AND district = ?';
    params.push(user.district);
  } else if (district) {
    whereClause += ' AND district = ?';
    params.push(district);
  }

  if (keyword) {
    whereClause += ' AND (station_name LIKE ? OR station_code LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  const offset = (page - 1) * pageSize;

  const [countResult] = await pool.execute(
    `SELECT COUNT(*) as total FROM stations ${whereClause}`,
    params
  );

  const [stations] = await pool.execute(
    `SELECT * FROM stations ${whereClause} ORDER BY station_code LIMIT ? OFFSET ?`,
    [...params, parseInt(pageSize), offset]
  );

  const stationsWithRate = stations.map(s => ({
    ...s,
    fillRate: s.total_docks > 0 ? ((s.available_bikes / s.total_docks) * 100).toFixed(1) : 0,
    statusLevel: s.total_docks > 0
      ? (s.available_bikes / s.total_docks) > 0.85 ? 'surplus'
        : (s.available_bikes / s.total_docks) < 0.15 ? 'shortage'
        : 'normal'
      : 'normal'
  }));

  ctx.body = {
    list: stationsWithRate,
    total: countResult[0].total,
    page: parseInt(page),
    pageSize: parseInt(pageSize)
  };
});

router.get('/:id', authMiddleware, async (ctx) => {
  const { id } = ctx.params;

  const [stations] = await pool.execute('SELECT * FROM stations WHERE id = ?', [id]);

  if (stations.length === 0) {
    ctx.status = 404;
    ctx.body = { code: 404, message: '站点不存在' };
    return;
  }

  const station = stations[0];
  
  const [bikes] = await pool.execute(
    'SELECT id, bike_code, bike_type, status FROM bikes WHERE station_id = ? AND status = ?',
    [id, '在桩']
  );

  ctx.body = {
    ...station,
    fillRate: station.total_docks > 0 ? ((station.available_bikes / station.total_docks) * 100).toFixed(1) : 0,
    bikes
  };
});

router.post('/', authMiddleware, async (ctx) => {
  const user = ctx.state.user;
  if (user.role !== 'admin') {
    ctx.status = 403;
    ctx.body = { code: 403, message: '只有管理员可以添加站点' };
    return;
  }

  const { station_name, latitude, longitude, district, total_docks, available_bikes = 0 } = ctx.request.body;

  if (!station_name || !latitude || !longitude || !district || !total_docks) {
    ctx.status = 400;
    ctx.body = { code: 400, message: '请填写完整的站点信息' };
    return;
  }

  if (available_bikes > total_docks) {
    ctx.status = 400;
    ctx.body = { code: 400, message: '可用车辆数不能超过锁桩总数' };
    return;
  }

  const [maxResult] = await pool.execute(
    "SELECT MAX(CAST(SUBSTRING(station_code, 2) AS UNSIGNED)) as max_code FROM stations"
  );
  const nextCode = (maxResult[0].max_code || 0) + 1;
  const station_code = `S${String(nextCode).padStart(4, '0')}`;

  const empty_docks = total_docks - available_bikes;

  const [result] = await pool.execute(
    `INSERT INTO stations (station_code, station_name, latitude, longitude, district, total_docks, available_bikes, empty_docks) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [station_code, station_name, latitude, longitude, district, total_docks, available_bikes, empty_docks]
  );

  ctx.status = 201;
  ctx.body = { id: result.insertId, station_code, message: '站点创建成功' };
});

router.put('/:id', authMiddleware, async (ctx) => {
  const user = ctx.state.user;
  if (user.role !== 'admin') {
    ctx.status = 403;
    ctx.body = { code: 403, message: '只有管理员可以编辑站点' };
    return;
  }

  const { id } = ctx.params;
  const { station_name, latitude, longitude, district, total_docks, available_bikes } = ctx.request.body;

  const [stations] = await pool.execute('SELECT * FROM stations WHERE id = ?', [id]);
  if (stations.length === 0) {
    ctx.status = 404;
    ctx.body = { code: 404, message: '站点不存在' };
    return;
  }

  if (total_docks !== undefined && available_bikes !== undefined && available_bikes > total_docks) {
    ctx.status = 400;
    ctx.body = { code: 400, message: '可用车辆数不能超过锁桩总数' };
    return;
  }

  const updateFields = [];
  const updateParams = [];

  if (station_name !== undefined) { updateFields.push('station_name = ?'); updateParams.push(station_name); }
  if (latitude !== undefined) { updateFields.push('latitude = ?'); updateParams.push(latitude); }
  if (longitude !== undefined) { updateFields.push('longitude = ?'); updateParams.push(longitude); }
  if (district !== undefined) { updateFields.push('district = ?'); updateParams.push(district); }
  
  if (total_docks !== undefined) {
    const currentAvailable = available_bikes !== undefined ? available_bikes : stations[0].available_bikes;
    if (currentAvailable > total_docks) {
      ctx.status = 400;
      ctx.body = { code: 400, message: '可用车辆数不能超过锁桩总数' };
      return;
    }
    updateFields.push('total_docks = ?');
    updateParams.push(total_docks);
    updateFields.push('empty_docks = ?');
    updateParams.push(total_docks - currentAvailable);
  }
  
  if (available_bikes !== undefined) {
    const currentTotal = total_docks !== undefined ? total_docks : stations[0].total_docks;
    if (available_bikes > currentTotal) {
      ctx.status = 400;
      ctx.body = { code: 400, message: '可用车辆数不能超过锁桩总数' };
      return;
    }
    updateFields.push('available_bikes = ?');
    updateParams.push(available_bikes);
    if (total_docks === undefined) {
      updateFields.push('empty_docks = ?');
      updateParams.push(stations[0].total_docks - available_bikes);
    }
  }

  updateParams.push(id);

  await pool.execute(
    `UPDATE stations SET ${updateFields.join(', ')} WHERE id = ?`,
    updateParams
  );

  ctx.body = { message: '站点更新成功' };
});

router.delete('/:id', authMiddleware, async (ctx) => {
  const user = ctx.state.user;
  if (user.role !== 'admin') {
    ctx.status = 403;
    ctx.body = { code: 403, message: '只有管理员可以删除站点' };
    return;
  }

  const { id } = ctx.params;

  const [bikes] = await pool.execute('SELECT COUNT(*) as count FROM bikes WHERE station_id = ?', [id]);
  if (bikes[0].count > 0) {
    ctx.status = 400;
    ctx.body = { code: 400, message: '该站点还有车辆，无法删除' };
    return;
  }

  await pool.execute('DELETE FROM stations WHERE id = ?', [id]);
  ctx.body = { message: '站点删除成功' };
});

router.get('/dispatch/suggestions', authMiddleware, async (ctx) => {
  const user = ctx.state.user;

  let whereClause = '';
  const params = [];

  if (user.role === 'dispatcher' && user.district) {
    whereClause = 'WHERE district = ?';
    params.push(user.district);
  }

  const [stations] = await pool.execute(
    `SELECT * FROM stations ${whereClause} ORDER BY available_bikes / total_docks DESC`,
    params
  );

  const surplusStations = [];
  const shortageStations = [];

  stations.forEach(s => {
    const rate = s.total_docks > 0 ? s.available_bikes / s.total_docks : 0;
    const targetBikes = Math.round(s.total_docks * 0.5);
    const diff = s.available_bikes - targetBikes;

    const stationInfo = {
      id: s.id,
      stationCode: s.station_code,
      stationName: s.station_name,
      district: s.district,
      totalDocks: s.total_docks,
      availableBikes: s.available_bikes,
      emptyDocks: s.empty_docks,
      fillRate: (rate * 100).toFixed(1),
      targetBikes,
      adjustCount: Math.abs(diff)
    };

    if (rate > 0.85) {
      surplusStations.push(stationInfo);
    } else if (rate < 0.15) {
      shortageStations.push(stationInfo);
    }
  });

  ctx.body = {
    surplusStations,
    shortageStations,
    totalNeedDispatch: surplusStations.length + shortageStations.length
  };
});

module.exports = router;
