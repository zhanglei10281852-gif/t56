const Router = require('koa-router');
const bcrypt = require('bcryptjs');
const pool = require('../database/db');
const { generateToken, authMiddleware } = require('../middleware/auth');

const router = new Router({ prefix: '/api/auth' });

router.post('/login', async (ctx) => {
  const { username, password } = ctx.request.body;

  if (!username || !password) {
    ctx.status = 400;
    ctx.body = { code: 400, message: '用户名和密码不能为空' };
    return;
  }

  const [users] = await pool.execute(
    'SELECT id, username, password, real_name, role, district, status FROM users WHERE username = ?',
    [username]
  );

  if (users.length === 0) {
    ctx.status = 401;
    ctx.body = { code: 401, message: '用户名或密码错误' };
    return;
  }

  const user = users[0];
  if (user.status !== 1) {
    ctx.status = 403;
    ctx.body = { code: 403, message: '账号已被禁用' };
    return;
  }

  const isValid = bcrypt.compareSync(password, user.password);
  if (!isValid) {
    ctx.status = 401;
    ctx.body = { code: 401, message: '用户名或密码错误' };
    return;
  }

  const token = generateToken({
    id: user.id,
    username: user.username,
    realName: user.real_name,
    role: user.role,
    district: user.district
  });

  ctx.body = {
    code: 200,
    message: '登录成功',
    data: {
      token,
      userInfo: {
        id: user.id,
        username: user.username,
        realName: user.real_name,
        role: user.role,
        district: user.district
      }
    }
  };
});

router.get('/profile', authMiddleware, async (ctx) => {
  const userId = ctx.state.user.id;

  const [users] = await pool.execute(
    'SELECT id, username, real_name, role, district, created_at FROM users WHERE id = ?',
    [userId]
  );

  if (users.length === 0) {
    ctx.status = 404;
    ctx.body = { code: 404, message: '用户不存在' };
    return;
  }

  const user = users[0];
  ctx.body = {
    id: user.id,
    username: user.username,
    realName: user.real_name,
    role: user.role,
    district: user.district,
    createdAt: user.created_at
  };
});

router.post('/logout', authMiddleware, async (ctx) => {
  ctx.body = { message: '退出成功' };
});

module.exports = router;
