// server/db.js
const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST, // 读的是 127.0.0.1
  port: process.env.DB_PORT, // 读的是 3307
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// 简单的连接测试
pool.getConnection((err, connection) => {
  if (err) {
    console.error('❌ 连接失败:', err.message);
  } else {
    console.log('✅ 数据库连接成功！(通过 SSH 隧道)');
    connection.release();
  }
});

module.exports = pool.promise();