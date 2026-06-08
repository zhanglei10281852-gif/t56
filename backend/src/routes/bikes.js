const Router = require("koa-router");
const pool = require("../database/db");
const { authMiddleware } = require("../middleware/auth");

const router = new Router({ prefix: "/api/bikes" });

router.get("/", authMiddleware, async (ctx) => {
  const {
    station_id,
    status,
    bike_type,
    page = 1,
    pageSize = 20,
    keyword,
  } = ctx.query;
  const user = ctx.state.user;

  let whereClause = "WHERE 1=1";
  const params = [];

  if (user.role === "dispatcher" && user.district) {
    whereClause +=
      " AND b.station_id IN (SELECT id FROM stations WHERE district = ?)";
    params.push(user.district);
  }

  if (station_id) {
    whereClause += " AND b.station_id = ?";
    params.push(station_id);
  }

  if (status) {
    whereClause += " AND b.status = ?";
    params.push(status);
  }

  if (bike_type) {
    whereClause += " AND b.bike_type = ?";
    params.push(bike_type);
  }

  if (keyword) {
    whereClause += " AND b.bike_code LIKE ?";
    params.push(`%${keyword}%`);
  }

  const pageNum = parseInt(page) || 1;
  const sizeNum = parseInt(pageSize) || 20;
  const offset = (pageNum - 1) * sizeNum;

  const [countResult] = await pool.query(
    `SELECT COUNT(*) as total FROM bikes b ${whereClause}`,
    params,
  );

  const [bikes] = await pool.query(
    `SELECT b.*, s.station_name, s.station_code, s.district 
     FROM bikes b 
     LEFT JOIN stations s ON b.station_id = s.id 
     ${whereClause} 
     ORDER BY b.id DESC 
     LIMIT ? OFFSET ?`,
    [...params, sizeNum, offset],
  );

  ctx.body = {
    list: bikes,
    total: countResult[0].total,
    page: pageNum,
    pageSize: sizeNum,
  };
});

router.get("/:id", authMiddleware, async (ctx) => {
  const { id } = ctx.params;

  const [bikes] = await pool.query(
    `SELECT b.*, s.station_name, s.station_code, s.district 
     FROM bikes b 
     LEFT JOIN stations s ON b.station_id = s.id 
     WHERE b.id = ?`,
    [id],
  );

  if (bikes.length === 0) {
    ctx.status = 404;
    ctx.body = { code: 404, message: "车辆不存在" };
    return;
  }

  const [recentRides] = await pool.query(
    `SELECT r.*, s1.station_name as start_station_name, s2.station_name as end_station_name
     FROM ride_records r
     LEFT JOIN stations s1 ON r.start_station_id = s1.id
     LEFT JOIN stations s2 ON r.end_station_id = s2.id
     WHERE r.bike_id = ?
     ORDER BY r.start_time DESC
     LIMIT 10`,
    [id],
  );

  ctx.body = {
    ...bikes[0],
    recentRides,
  };
});

router.post("/", authMiddleware, async (ctx) => {
  const user = ctx.state.user;
  if (user.role !== "admin") {
    ctx.status = 403;
    ctx.body = { code: 403, message: "只有管理员可以添加车辆" };
    return;
  }

  const {
    bike_code,
    bike_type = "普通",
    status = "在桩",
    station_id,
  } = ctx.request.body;

  if (!bike_code) {
    ctx.status = 400;
    ctx.body = { code: 400, message: "车辆编号不能为空" };
    return;
  }

  const [existing] = await pool.query(
    "SELECT id FROM bikes WHERE bike_code = ?",
    [bike_code],
  );
  if (existing.length > 0) {
    ctx.status = 400;
    ctx.body = { code: 400, message: "车辆编号已存在" };
    return;
  }

  if (status === "在桩" && !station_id) {
    ctx.status = 400;
    ctx.body = { code: 400, message: "在桩车辆必须指定站点" };
    return;
  }

  if (station_id) {
    const [stations] = await pool.query("SELECT * FROM stations WHERE id = ?", [
      station_id,
    ]);
    if (stations.length === 0) {
      ctx.status = 404;
      ctx.body = { code: 404, message: "站点不存在" };
      return;
    }
    if (stations[0].empty_docks <= 0) {
      ctx.status = 400;
      ctx.body = { code: 400, message: "目标站点空桩不足" };
      return;
    }
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [result] = await connection.query(
      `INSERT INTO bikes (bike_code, bike_type, status, station_id, ride_count) VALUES (?, ?, ?, ?, 0)`,
      [bike_code, bike_type, status, station_id || null],
    );

    if (status === "在桩" && station_id) {
      await connection.query(
        "UPDATE stations SET available_bikes = available_bikes + 1, empty_docks = empty_docks - 1 WHERE id = ?",
        [station_id],
      );
    }

    await connection.commit();
    ctx.status = 201;
    ctx.body = { id: result.insertId, bike_code, message: "车辆添加成功" };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});

router.put("/:id", authMiddleware, async (ctx) => {
  const user = ctx.state.user;
  if (user.role !== "admin") {
    ctx.status = 403;
    ctx.body = { code: 403, message: "只有管理员可以编辑车辆" };
    return;
  }

  const { id } = ctx.params;
  const { bike_type, status, station_id, last_maintenance_date } =
    ctx.request.body;

  const [bikes] = await pool.query("SELECT * FROM bikes WHERE id = ?", [id]);
  if (bikes.length === 0) {
    ctx.status = 404;
    ctx.body = { code: 404, message: "车辆不存在" };
    return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const oldStatus = bikes[0].status;
    const oldStationId = bikes[0].station_id;

    if (station_id !== undefined && station_id !== oldStationId) {
      if (oldStatus === "在桩" && oldStationId) {
        await connection.query(
          "UPDATE stations SET available_bikes = available_bikes - 1, empty_docks = empty_docks + 1 WHERE id = ?",
          [oldStationId],
        );
      }

      if (station_id && status === "在桩") {
        const [stations] = await connection.query(
          "SELECT * FROM stations WHERE id = ?",
          [station_id],
        );
        if (stations.length === 0 || stations[0].empty_docks <= 0) {
          throw new Error("目标站点空桩不足");
        }
        await connection.query(
          "UPDATE stations SET available_bikes = available_bikes + 1, empty_docks = empty_docks - 1 WHERE id = ?",
          [station_id],
        );
      }
    }

    const updateFields = [];
    const updateParams = [];

    if (bike_type !== undefined) {
      updateFields.push("bike_type = ?");
      updateParams.push(bike_type);
    }
    if (status !== undefined) {
      updateFields.push("status = ?");
      updateParams.push(status);
    }
    if (station_id !== undefined) {
      updateFields.push("station_id = ?");
      updateParams.push(station_id || null);
    }
    if (last_maintenance_date !== undefined) {
      updateFields.push("last_maintenance_date = ?");
      updateParams.push(last_maintenance_date);
    }

    if (updateFields.length > 0) {
      updateParams.push(id);
      await connection.query(
        `UPDATE bikes SET ${updateFields.join(", ")} WHERE id = ?`,
        updateParams,
      );
    }

    await connection.commit();
    ctx.body = { message: "车辆更新成功" };
  } catch (error) {
    await connection.rollback();
    ctx.status = 400;
    ctx.body = { code: 400, message: error.message };
  } finally {
    connection.release();
  }
});

router.delete("/:id", authMiddleware, async (ctx) => {
  const user = ctx.state.user;
  if (user.role !== "admin") {
    ctx.status = 403;
    ctx.body = { code: 403, message: "只有管理员可以删除车辆" };
    return;
  }

  const { id } = ctx.params;

  const [bikes] = await pool.query("SELECT * FROM bikes WHERE id = ?", [id]);
  if (bikes.length === 0) {
    ctx.status = 404;
    ctx.body = { code: 404, message: "车辆不存在" };
    return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    if (bikes[0].status === "在桩" && bikes[0].station_id) {
      await connection.query(
        "UPDATE stations SET available_bikes = available_bikes - 1, empty_docks = empty_docks + 1 WHERE id = ?",
        [bikes[0].station_id],
      );
    }

    await connection.query("DELETE FROM bikes WHERE id = ?", [id]);
    await connection.commit();

    ctx.body = { message: "车辆删除成功" };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});

module.exports = router;
