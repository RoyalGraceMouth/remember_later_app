// server/utils/crypto.js
const crypto = require('crypto');
require('dotenv').config();

// 密钥 (32位) 和 初始化向量 (16位)
// 在 .env 里加一个 ENCRYPTION_KEY=一个32个字符的随机字符串
const KEY = Buffer.from(process.env.ENCRYPTION_KEY || '12345678901234567890123456789012', 'utf-8');
const IV_LENGTH = 16; 

// 加密函数
exports.encrypt = (text) => {
  if (!text) return text;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', KEY, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  // 返回格式: IV:密文 (因为解密需要IV)
  return iv.toString('hex') + ':' + encrypted.toString('hex');
};

// 解密函数
exports.decrypt = (text) => {
  if (!text) return text;
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', KEY, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (err) {
    // 如果解密失败（比如老数据没加密），返回原文或空
    return text;
  }
};