const errorHandler = async (ctx, next) => {
  try {
    await next();
    if (ctx.status === 404) {
      ctx.body = { code: 404, message: '接口不存在' };
    }
  } catch (error) {
    console.error('服务器错误:', error);
    ctx.status = error.statusCode || error.status || 500;
    ctx.body = {
      code: ctx.status,
      message: error.message || '服务器内部错误',
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    };
  }
};

const responseHandler = async (ctx, next) => {
  await next();
  
  if (ctx.body && !ctx.body.code && ctx.status < 400) {
    const originalBody = ctx.body;
    ctx.body = {
      code: 200,
      message: 'success',
      data: originalBody
    };
  }
};

module.exports = { errorHandler, responseHandler };
