const Koa = require('koa');
const cors = require('@koa/cors');
const bodyParser = require('koa-bodyparser');
require('dotenv').config();

const { errorHandler, responseHandler } = require('./middleware/response');
const authRoutes = require('./routes/auth');
const stationRoutes = require('./routes/stations');
const bikeRoutes = require('./routes/bikes');
const rideRoutes = require('./routes/ride');
const dispatchRoutes = require('./routes/dispatch');
const faultRoutes = require('./routes/fault');
const statsRoutes = require('./routes/stats');
const { initData } = require('./database/init');
const { createTables } = require('./database/schema');

const app = new Koa();
const PORT = process.env.PORT || 9182;

app.use(cors({
  origin: '*',
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

app.use(bodyParser({
  jsonLimit: '10mb',
  formLimit: '10mb'
}));

app.use(errorHandler);
app.use(responseHandler);

app.use(async (ctx, next) => {
  console.log(`${ctx.method} ${ctx.url}`);
  await next();
});

app.use(authRoutes.routes()).use(authRoutes.allowedMethods());
app.use(stationRoutes.routes()).use(stationRoutes.allowedMethods());
app.use(bikeRoutes.routes()).use(bikeRoutes.allowedMethods());
app.use(rideRoutes.routes()).use(rideRoutes.allowedMethods());
app.use(dispatchRoutes.routes()).use(dispatchRoutes.allowedMethods());
app.use(faultRoutes.routes()).use(faultRoutes.allowedMethods());
app.use(statsRoutes.routes()).use(statsRoutes.allowedMethods());

app.use(async (ctx) => {
  if (ctx.path === '/') {
    ctx.body = {
      name: '城市公共自行车运营管理平台 API',
      version: '1.0.0',
      status: 'running'
    };
  }
});

const initDatabase = async () => {
  try {
    console.log('正在初始化数据库...');
    await createTables();
    await initData();
    console.log('数据库初始化完成');
  } catch (error) {
    console.error('数据库初始化失败:', error.message);
    console.log('将在数据库就绪后重试...');
    setTimeout(initDatabase, 5000);
  }
};

const startServer = async () => {
  await initDatabase();
  
  app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log(`环境: ${process.env.NODE_ENV || 'development'}`);
  });
};

startServer();

module.exports = app;
