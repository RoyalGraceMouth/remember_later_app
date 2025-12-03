// src/api.js
const BASE_URL = 'http://localhost:3001/api';

export const api = {
  post: async (endpoint, body) => {
    try {
      const res = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        // 如果后端返回 400/500，抛出错误信息
        throw new Error(data.msg || '请求失败');
      }
      return data;
    } catch (err) {
      throw err; // 继续向外抛，让 UI 层去 alert
    }
  }
};