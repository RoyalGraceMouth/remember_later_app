// server/server.js
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db'); // 引入刚才测试成功的数据库连接
require('dotenv').config();

const app = express();

app.use('/api/data', require('./routes/data'));

// --- 中间件配置 ---
app.use(cors()); // 允许前端 React (localhost:5173) 访问
app.use(express.json()); // 解析 JSON 请求体

// --- 1. 注册接口 ---
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  
  // 基本校验
  if (!username || !password) {
    return res.status(400).json({ msg: '用户名和密码不能为空' });
  }

  try {
    // A. 查重：去腾讯云看看有没有人用过这个名字
    const [exists] = await db.query('SELECT id FROM users WHERE username = ?', [username]);
    if (exists.length > 0) {
      return res.status(400).json({ msg: '用户名已存在' });
    }

    // B. 加密：CS专业必须懂，密码不能存明文，用 bcrypt 加盐哈希
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);

    // C. 入库：存入 users 表
    const [result] = await db.query('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, hash]);
    const userId = result.insertId;

    // D. 初始化设置：给新用户送一套默认规则 (存入 user_settings 表)
    // 这是一个标准的 JSON 字符串
    const defaultProfiles = [
      { id: 'default_1', name: '默认算法', intervals: [1, 2, 4, 7, 15, 30], regressStep: 1, graduationInterval: 0 }
    ];
    await db.query(
      'INSERT INTO user_settings (user_id, profiles, default_id) VALUES (?, ?, ?)', 
      [userId, JSON.stringify(defaultProfiles), 'default_1']
    );

    res.json({ msg: '注册成功，请去登录' });

  } catch (err) {
    console.error('注册报错:', err);
    res.status(500).json({ msg: '服务器内部错误' });
  }
});

// --- 2. 登录接口 ---
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // A. 找用户
    const [users] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (users.length === 0) {
      return res.status(400).json({ msg: '用户不存在' });
    }
    const user = users[0];

    // B. 验密码
    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ msg: '密码错误' });
    }

    // C. 签发 Token (身份证)
    const token = jwt.sign(
      { id: user.id, username: user.username }, 
      process.env.JWT_SECRET || 'secret123', // 密钥
      { expiresIn: '30d' } // 有效期30天
    );

    // D. 返回给前端
    res.json({ 
      msg: '登录成功', 
      token, 
      user: { id: user.id, name: user.username } 
    });

  } catch (err) {
    console.error('登录报错:', err);
    res.status(500).json({ msg: '服务器错误' });
  }
});

// 启动服务
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 后端服务器运行在: http://localhost:${PORT}`);
});

