// server/routes/data.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // 你的数据库连接
const auth = require('../middleware/authMiddleware'); // 之前写的JWT中间件
const { encrypt, decrypt } = require('../utils/crypto');

// 1. 获取所有数据 (Sync)
router.get('/sync', auth, async (req, res) => {
  try {
    // 这里的 db 如果是 ssh2 的 promise，需要 await db
    // 如果是直连的 pool，直接 await db.query
    // 假设你现在用的是 ssh2 版的 db.js:
    const conn = await db; 

    // 获取设置
    const [settingsRows] = await conn.query('SELECT * FROM user_settings WHERE user_id = ?', [req.user.id]);
    
    // 获取错题
    const [qRows] = await conn.query('SELECT * FROM questions WHERE user_id = ?', [req.user.id]);

    // 解密内容 & 解析 JSON
    const questions = qRows.map(q => ({
      ...q,
      content: decrypt(q.content), // ★ 解密
      history: typeof q.history === 'string' ? JSON.parse(q.history) : q.history,
      isGraduated: !!q.is_graduated, // 转换 0/1 为 boolean
      // 注意数据库字段是下划线，前端是驼峰，这里要做映射
      settingId: q.setting_id,
      nextReviewDate: q.next_review_date
    }));

    const settings = settingsRows[0] ? {
      profiles: typeof settingsRows[0].profiles === 'string' ? JSON.parse(settingsRows[0].profiles) : settingsRows[0].profiles,
      defaultId: settingsRows[0].default_id
    } : null;

    res.json({ questions, settings });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// 2. 保存单个错题 (新增或修改)
router.post('/question', auth, async (req, res) => {
  const q = req.body;
  const conn = await db;

  try {
    // ★ 加密内容
    const encryptedContent = encrypt(q.content);
    
    // 使用 ON DUPLICATE KEY UPDATE 实现“有则更新，无则插入”
    const sql = `
      INSERT INTO questions (id, user_id, content, streak, next_review_date, is_graduated, setting_id, history)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
      content = VALUES(content),
      streak = VALUES(streak),
      next_review_date = VALUES(next_review_date),
      is_graduated = VALUES(is_graduated),
      setting_id = VALUES(setting_id),
      history = VALUES(history)
    `;

    await conn.query(sql, [
      q.id, 
      req.user.id, 
      encryptedContent, 
      q.streak, 
      q.nextReviewDate, 
      q.isGraduated, 
      q.settingId, 
      JSON.stringify(q.history)
    ]);

    res.json({ msg: 'Saved' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Save Error');
  }
});

// 3. 删除错题
router.delete('/question/:id', auth, async (req, res) => {
  const conn = await db;
  await conn.query('DELETE FROM questions WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  res.json({ msg: 'Deleted' });
});

module.exports = router;