// src/api.js
const BASE_URL = 'http://localhost:3001/api'; // 或者是你的服务器IP /api

export const api = {
  // 通用请求处理
  request: async (endpoint, method = 'GET', body = null) => {
    // 从 localStorage 拿 Token
    const token = localStorage.getItem('token');
    
    const headers = { 
      'Content-Type': 'application/json' 
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      method,
      headers,
    };

    if (body) {
      config.body = JSON.stringify(body);
    }

    const res = await fetch(`${BASE_URL}${endpoint}`, config);
    
    // 处理 401 (Token失效) 或其他错误
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      // 如果是 401，抛出特定错误信息，方便 App.jsx 捕获并退出登录
      if (res.status === 401) {
        throw new Error('401 Unauthorized'); 
      }
      throw new Error(errorData.msg || `请求失败: ${res.status}`);
    }

    return res.json();
  },

  // ★★★ 必须显式定义 get, post, delete 等方法 ★★★
  get: (url) => api.request(url, 'GET'),
  
  post: (url, body) => api.request(url, 'POST', body),
  
  put: (url, body) => api.request(url, 'PUT', body),
  
  // 这里为了方便，delete 也可以封装一下，虽然有些地方你是直接调 request 的
  delete: (url) => api.request(url, 'DELETE'),
};