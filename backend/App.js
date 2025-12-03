// backend/App.js (或 server.js)

// 1. 最优先：加载环境变量
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db'); // 数据库连接

const app = express();

// ==========================================
// ★★★ 核心修正区：全局中间件 (必须放在路由之前！) ★★★
// ==========================================

// 1. 允许跨域 (解决前端报错 Access-Control-Allow-Origin)
app.use(cors());

// 2. 解析 JSON Body (解决 req.body 为 undefined)
app.use(express.json());


// ==========================================
// ★★★ 业务路由区 (拿到处理好的数据开始干活) ★★★
// ==========================================

// 1. 数据同步与操作路由 (引入 routes/data.js)
// 注意：这里面已经包含了 authMiddleware，所以会自动检查 Token
app.use('/api/data', require('./routes/data'));


// 2. 注册接口
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ msg: '用户名和密码不能为空' });
  }

  try {
    const conn = await db; // 获取数据库连接

    // A. 查重
    const [exists] = await conn.query('SELECT id FROM users WHERE username = ?', [username]);
    if (exists.length > 0) {
      return res.status(400).json({ msg: '用户名已存在' });
    }

    // B. 加密
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);

    // C. 入库
    const [result] = await conn.query('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, hash]);
    const userId = result.insertId;

    // D. 初始化默认设置 (写入 user_settings 表)
    const defaultProfiles = [
      { 
        id: 'ebbinghaus', 
        name: '🧠 艾宾浩斯 (长期记忆)', 
        intervals: [0, 1, 2, 4, 7, 15, 30, 60], 
        regressStep: 1, 
        graduationInterval: 90 
      },
      { 
        id: 'daily_habit', 
        name: '📅 每日打卡 (天天见)', 
        intervals: [0], 
        regressStep: 0, // 错了也不退，反正明天还得见
        graduationInterval: 1 
      },
      { 
        id: 'exam_week', 
        name: '🔥 考前高频 (短期突击)', 
        intervals: [0, 1, 1, 2, 3], 
        regressStep: 2, // 错了惩罚重一点
        graduationInterval: 3 
      },
      { 
        id: 'today_only', 
        name: '⚡️ 仅今日学习 (一次性)', 
        intervals: [0], 
        regressStep: 0, 
        graduationInterval: 0 
      },
      { 
        id: 'tommorow_only', 
        name: '⚡️ 仅明日学习 (一次性)', 
        intervals: [1], 
        regressStep: 0, 
        graduationInterval: 0 
      }
    ];

    await conn.query(
      'INSERT INTO user_settings (user_id, profiles, default_id) VALUES (?, ?, ?)', 
      [userId, JSON.stringify(defaultProfiles), 'ebbinghaus']
    );

    res.json({ msg: '注册成功，请去登录' });

  } catch (err) {
    console.error('注册报错:', err);
    res.status(500).json({ msg: '服务器内部错误' });
  }
});


// 3. 登录接口
app.post('/api/login', async (req, res) => {
  // 因为 express.json() 已经在上面执行了，这里可以安全读取 req.body
  const { username, password } = req.body;

  try {
    const conn = await db;

    // A. 找用户
    const [users] = await conn.query('SELECT * FROM users WHERE username = ?', [username]);
    if (users.length === 0) {
      return res.status(400).json({ msg: '用户不存在' });
    }
    const user = users[0];

    // B. 验密码
    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ msg: '密码错误' });
    }

    // C. 签发 Token
    const token = jwt.sign(
      { id: user.id, username: user.username }, 
      process.env.JWT_SECRET, // 读取 .env 里的密钥
      { expiresIn: '30d' }
    );

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

// ==========================================
// 启动服务
// ==========================================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 后端服务器运行在: http://localhost:${PORT}`);
});