// backend/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
require('dotenv').config();

module.exports = (req, res, next) => {
  // 1. 从请求头获取 Token
  const token = req.header('Authorization')?.replace('Bearer ', '');

  // 2. 没有 Token 就滚蛋
  if (!token) {
    return res.status(401).json({ msg: '无权限，请先登录' });
  }

  try {
    // 3. 验证 Token 真伪
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // 把用户信息挂载到 req 上，供后面使用
    next(); // 放行！进入路由逻辑
  } catch (err) {
    res.status(401).json({ msg: 'Token 无效' });
  }
};