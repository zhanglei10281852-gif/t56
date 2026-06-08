const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'bike_management_secret_key_2024';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

const authMiddleware = async (ctx, next) => {
  const token = ctx.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    ctx.status = 401;
    ctx.body = { code: 401, message: '未提供认证令牌' };
    return;
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    ctx.status = 401;
    ctx.body = { code: 401, message: '认证令牌无效或已过期' };
    return;
  }

  ctx.state.user = decoded;
  await next();
};

const adminMiddleware = async (ctx, next) => {
  if (ctx.state.user?.role !== 'admin') {
    ctx.status = 403;
    ctx.body = { code: 403, message: '权限不足，需要管理员权限' };
    return;
  }
  await next();
};

const dispatcherMiddleware = async (ctx, next) => {
  if (!ctx.state.user || (ctx.state.user.role !== 'admin' && ctx.state.user.role !== 'dispatcher')) {
    ctx.status = 403;
    ctx.body = { code: 403, message: '权限不足' };
    return;
  }
  await next();
};

const checkDistrictAccess = (user, district) => {
  if (user.role === 'admin') return true;
  if (user.role === 'dispatcher') return user.district === district;
  return false;
};

module.exports = {
  generateToken,
  verifyToken,
  authMiddleware,
  adminMiddleware,
  dispatcherMiddleware,
  checkDistrictAccess
};
