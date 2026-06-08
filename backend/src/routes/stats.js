const Router = require("koa-router");
const dayjs = require("dayjs");
const pool = require("../database/db");
const { authMiddleware } = require("../middleware/auth");

const router = new Router({ prefix: "/api/stats" });

router.get("/overview", authMiddleware, async (ctx) => {
  const user = ctx.state.user;

  let districtWhere = "";
  const params = [];

  if (user.role === "dispatcher" && user.district) {
    districtWhere = "WHERE district = ?";
    params.push(user.district);
  }

  const [stationStats] = await pool.query(
    `SELECT COUNT(*) as total_stations, 
      SUM(total_docks) as total_docks,
      SUM(available_bikes) as total_available_bikes,
      SUM(empty_docks) as total_empty_docks
     FROM stations ${districtWhere}`,
    params,
  );

  const bikeWhere =
    user.role === "dispatcher" && user.district
      ? "WHERE station_id IN (SELECT id FROM stations WHERE district = ?)"
      : "";
  const bikeParams =
    user.role === "dispatcher" && user.district ? [user.district] : [];

  const [bikeStats] = await pool.query(
    `SELECT COUNT(*) as total_bikes,
      SUM(CASE WHEN status = '在桩' THEN 1 ELSE 0 END) as in_station_bikes,
      SUM(CASE WHEN status = '骑行中' THEN 1 ELSE 0 END) as riding_bikes,
      SUM(CASE WHEN status = '调度中' THEN 1 ELSE 0 END) as dispatching_bikes,
      SUM(CASE WHEN status = '维修中' THEN 1 ELSE 0 END) as repairing_bikes
     FROM bikes ${bikeWhere}`,
    bikeParams,
  );

  const today = dayjs().format("YYYY-MM-DD");
  const rideWhere =
    user.role === "dispatcher" && user.district
      ? "WHERE DATE(start_time) = ? AND start_station_id IN (SELECT id FROM stations WHERE district = ?)"
      : "WHERE DATE(start_time) = ?";
  const rideParams =
    user.role === "dispatcher" && user.district
      ? [today, user.district]
      : [today];

  const [todayRideStats] = await pool.query(
    `SELECT COUNT(*) as today_rides,
      COUNT(DISTINCT user_phone) as today_users
     FROM ride_records ${rideWhere}`,
    rideParams,
  );

  const dispatchWhere =
    user.role === "dispatcher" && user.district
      ? "WHERE DATE(created_at) = ? AND from_station_id IN (SELECT id FROM stations WHERE district = ?)"
      : "WHERE DATE(created_at) = ?";
  const dispatchParams =
    user.role === "dispatcher" && user.district
      ? [today, user.district]
      : [today];

  const [todayDispatchStats] = await pool.query(
    `SELECT COUNT(*) as today_dispatches,
      SUM(CASE WHEN status = '已完成' THEN bike_count ELSE 0 END) as total_dispatched_bikes
     FROM dispatch_tasks ${dispatchWhere}`,
    dispatchParams,
  );

  ctx.body = {
    stations: stationStats[0],
    bikes: bikeStats[0],
    todayRides: todayRideStats[0],
    todayDispatches: todayDispatchStats[0],
  };
});

router.get("/rides/hourly", authMiddleware, async (ctx) => {
  const user = ctx.state.user;
  const { date = dayjs().format("YYYY-MM-DD") } = ctx.query;

  let whereClause = "WHERE DATE(start_time) = ?";
  const params = [date];

  if (user.role === "dispatcher" && user.district) {
    whereClause +=
      " AND start_station_id IN (SELECT id FROM stations WHERE district = ?)";
    params.push(user.district);
  }

  const [results] = await pool.query(
    `SELECT HOUR(start_time) as hour, COUNT(*) as count
     FROM ride_records
     ${whereClause}
     GROUP BY HOUR(start_time)
     ORDER BY hour`,
    params,
  );

  const hourlyData = Array(24)
    .fill(0)
    .map((_, i) => ({
      hour: `${i}:00`,
      count: 0,
    }));

  results.forEach((r) => {
    hourlyData[r.hour].count = r.count;
  });

  ctx.body = hourlyData;
});

router.get("/rides/daily", authMiddleware, async (ctx) => {
  const user = ctx.state.user;
  const { days = 7 } = ctx.query;

  let whereClause = "WHERE start_time >= DATE_SUB(CURDATE(), INTERVAL ? DAY)";
  const params = [parseInt(days)];

  if (user.role === "dispatcher" && user.district) {
    whereClause +=
      " AND start_station_id IN (SELECT id FROM stations WHERE district = ?)";
    params.push(user.district);
  }

  const [results] = await pool.query(
    `SELECT DATE(start_time) as date, COUNT(*) as count
     FROM ride_records
     ${whereClause}
     GROUP BY DATE(start_time)
     ORDER BY date`,
    params,
  );

  ctx.body = results;
});

router.get("/rides/stations", authMiddleware, async (ctx) => {
  const user = ctx.state.user;
  const { top = 10, type = "borrow" } = ctx.query;

  let whereClause = "";
  const params = [];

  if (user.role === "dispatcher" && user.district) {
    whereClause =
      "WHERE station_id IN (SELECT id FROM stations WHERE district = ?)";
    params.push(user.district);
  }

  const stationField =
    type === "return" ? "end_station_id" : "start_station_id";

  const [results] = await pool.query(
    `SELECT s.id, s.station_code, s.station_name, s.district, COUNT(*) as count
     FROM ride_records r
     JOIN stations s ON r.${stationField} = s.id
     ${whereClause ? "WHERE " + whereClause.replace("WHERE ", "") : ""}
     GROUP BY s.id, s.station_code, s.station_name, s.district
     ORDER BY count DESC
     LIMIT ?`,
    [...params, parseInt(top)],
  );

  ctx.body = results;
});

router.get("/district/daily", authMiddleware, async (ctx) => {
  const { days = 7 } = ctx.query;

  const [results] = await pool.query(
    `SELECT s.district, DATE(r.start_time) as date, COUNT(*) as count
     FROM ride_records r
     JOIN stations s ON r.start_station_id = s.id
     WHERE r.start_time >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY s.district, DATE(r.start_time)
     ORDER BY date, district`,
    [parseInt(days)],
  );

  const districts = ["东区", "西区", "南区"];
  const dateMap = {};

  results.forEach((r) => {
    const date = r.date;
    if (!dateMap[date]) {
      dateMap[date] = { date };
      districts.forEach((d) => (dateMap[date][d] = 0));
    }
    dateMap[date][r.district] = r.count;
  });

  ctx.body = Object.values(dateMap);
});

router.get("/stations/fill-rate", authMiddleware, async (ctx) => {
  const user = ctx.state.user;

  let whereClause = "";
  const params = [];

  if (user.role === "dispatcher" && user.district) {
    whereClause = "WHERE district = ?";
    params.push(user.district);
  }

  const [stations] = await pool.query(
    `SELECT station_code, station_name, district, total_docks, available_bikes,
      (available_bikes / total_docks) * 100 as fill_rate
     FROM stations ${whereClause}
     ORDER BY fill_rate DESC`,
    params,
  );

  const ranges = [
    { label: "0-15%", min: 0, max: 15, count: 0 },
    { label: "15-30%", min: 15, max: 30, count: 0 },
    { label: "30-50%", min: 30, max: 50, count: 0 },
    { label: "50-70%", min: 50, max: 70, count: 0 },
    { label: "70-85%", min: 70, max: 85, count: 0 },
    { label: "85-100%", min: 85, max: 100, count: 0 },
  ];

  stations.forEach((s) => {
    const rate = parseFloat(s.fill_rate);
    for (const range of ranges) {
      if (rate >= range.min && rate < range.max) {
        range.count++;
        break;
      }
    }
    if (rate >= 85) ranges[5].count++;
  });

  ctx.body = {
    stations,
    distribution: ranges,
  };
});

router.get("/dispatch/completion-rate", authMiddleware, async (ctx) => {
  const user = ctx.state.user;
  const { days = 7 } = ctx.query;

  let whereClause = "WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)";
  const params = [parseInt(days)];

  if (user.role === "dispatcher" && user.district) {
    whereClause +=
      " AND from_station_id IN (SELECT id FROM stations WHERE district = ?)";
    params.push(user.district);
  }

  const [results] = await pool.query(
    `SELECT DATE(created_at) as date,
      COUNT(*) as total_tasks,
      SUM(CASE WHEN status = '已完成' THEN 1 ELSE 0 END) as completed_tasks
     FROM dispatch_tasks
     ${whereClause}
     GROUP BY DATE(created_at)
     ORDER BY date`,
    params,
  );

  const data = results.map((r) => ({
    date: r.date,
    total: r.total_tasks,
    completed: r.completed_tasks,
    rate:
      r.total_tasks > 0
        ? ((r.completed_tasks / r.total_tasks) * 100).toFixed(1)
        : 0,
  }));

  ctx.body = data;
});

router.get("/fault/types", authMiddleware, async (ctx) => {
  const user = ctx.state.user;
  const { days = 30 } = ctx.query;

  let whereClause = "WHERE report_time >= DATE_SUB(CURDATE(), INTERVAL ? DAY)";
  const params = [parseInt(days)];

  if (user.role === "dispatcher" && user.district) {
    whereClause +=
      " AND bike_id IN (SELECT id FROM bikes WHERE station_id IN (SELECT id FROM stations WHERE district = ?))";
    params.push(user.district);
  }

  const [results] = await pool.query(
    `SELECT fault_type, COUNT(*) as count
     FROM fault_reports
     ${whereClause}
     GROUP BY fault_type
     ORDER BY count DESC`,
    params,
  );

  ctx.body = results;
});

module.exports = router;
