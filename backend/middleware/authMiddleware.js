// backend/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
// ★★★ 修改这里：确保路径正确指向 backend/.env ★★★
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

module.exports = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  // ★★★ 调试打印 (请看后端控制台输出) ★★★
  console.log('--- Middleware Debug ---');
  console.log('1. 接收到的 Token:', token);
  console.log('2. 使用的密钥:', process.env.JWT_SECRET); 

  if (!token) {
    return res.status(401).json({ msg: '无权限' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    // ★★★ 打印具体错误信息 ★★★
    console.error('Token 验证失败原因:', err.message); 
    res.status(401).json({ msg: 'Token 无效' });
  }
};