import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import './App.css'; 

// --- 默认设置 ---
const DEFAULT_SETTINGS = {
  intervals: [14, 21, 28], 
  regressStep: 1,          
};

function App() {
  // 1. 用户登录状态 (模拟)
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('my_app_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  // 2. 错题数据
  const [questions, setQuestions] = useState(() => {
    const saved = localStorage.getItem('my_wrong_questions');
    return saved ? JSON.parse(saved) : [];
  });

  // 3. 设置数据
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('my_app_settings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  // 持久化保存
  useEffect(() => { localStorage.setItem('my_wrong_questions', JSON.stringify(questions)); }, [questions]);
  useEffect(() => { localStorage.setItem('my_app_settings', JSON.stringify(settings)); }, [settings]);
  useEffect(() => { 
    if (user) localStorage.setItem('my_app_user', JSON.stringify(user)); 
    else localStorage.removeItem('my_app_user');
  }, [user]);

  // --- 业务逻辑 ---
  const addQuestion = (content) => {
    const newQ = {
      id: Date.now(),
      content: content,
      streak: 0,
      nextReviewDate: dayjs().add(settings.intervals[0], 'day').format('YYYY-MM-DD'),
    };
    setQuestions(prev => [...prev, newQ]); // 使用函数式更新
  };

  const handleReview = (id, isCorrect) => {
    setQuestions(prev => prev.map(q => {
      if (q.id !== id) return q;
      
      let newStreak = q.streak;
      if (isCorrect) {
        newStreak = newStreak + 1;
      } else {
        newStreak = Math.max(0, newStreak - settings.regressStep);
      }

      const intervalIndex = Math.min(newStreak, settings.intervals.length - 1);
      const daysToAdd = settings.intervals[intervalIndex];
      const nextDate = dayjs().add(daysToAdd, 'day').format('YYYY-MM-DD');

      return { ...q, streak: newStreak, nextReviewDate: nextDate };
    }));
  };

  // 登录/退出逻辑
  const login = (username) => setUser({ name: username, avatar: '👤' });
  const logout = () => setUser(null);

  return (
    <BrowserRouter>
      <div className="app-container">
        <NavBar user={user} />

        <Routes>
          <Route path="/" element={
            user ? (
              <HomePage questions={questions} onAdd={addQuestion} onReview={handleReview} />
            ) : (
              <LoginPage onLogin={login} />
            )
          } />
          
          <Route path="/settings" element={<SettingsPage settings={settings} setSettings={setSettings} />} />
          
          {/* 个人中心现在传递 questions，用于计算统计数据 */}
          <Route path="/profile" element={<ProfilePage user={user} questions={questions} onLogout={logout} />} />
          
          <Route path="/login" element={<LoginPage onLogin={login} />} />
          <Route path="/register" element={<RegisterPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

// --- 组件部分 ---

// 1. 导航栏
function NavBar({ user }) {
  return (
    <nav className="nav-bar">
      <div className="logo">MyMemory 🧠</div>
      <div className="nav-links">
        {user ? (
          <>
            <Link to="/">复习面板</Link>
            <Link to="/settings">规则设置</Link>
            <Link to="/profile">
               我的 ({user.name})
            </Link>
          </>
        ) : (
          <>
            <Link to="/login">登录</Link>
            <Link to="/register">注册</Link>
          </>
        )}
      </div>
    </nav>
  );
}

// 2. 主页
function HomePage({ questions, onAdd, onReview }) {
  const [inputContent, setInputContent] = useState("");
  const today = dayjs().format('YYYY-MM-DD');
  const reviewsDue = questions.filter(q => q.nextReviewDate <= today);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputContent.trim()) return;
    onAdd(inputContent);
    setInputContent("");
  };

  return (
    <div className="dashboard-grid">
      
      {/* 区域 A：复习列表*/}
      <section className="card section-list">
        <h2>📚 今日任务 ({reviewsDue.length})</h2>
        {reviewsDue.length === 0 ? (
          <div style={{textAlign: 'center', padding: '40px', color: '#888'}}>
            <p>🎉 今天没有需要复习的题目！</p>
            <p>去添加一点新知识吧。</p>
          </div>
        ) : (
          <div>
            {reviewsDue.map(q => (
              <div key={q.id} className="review-item">
                <div style={{whiteSpace: 'pre-wrap'}}>{q.content}</div>
                <div className="review-actions">
                  <button className="btn-outline" style={{borderColor:'#ef4444', color:'#ef4444'}} onClick={() => onReview(q.id, false)}>
                    忘了 (退步)
                  </button>
                  <button className="btn-primary" style={{background:'#22c55e'}} onClick={() => onReview(q.id, true)}>
                    记得 (保持)
                  </button>
                </div>
                <div style={{fontSize: '12px', color: '#999', marginTop: '5px'}}>
                  当前等级: Lv.{q.streak}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 区域 B：录入框*/}
      <section className="card section-add">
        <h2>✏️ 快速录入</h2>
        <form onSubmit={handleSubmit}>
          <textarea 
            value={inputContent}
            onChange={(e) => setInputContent(e.target.value)}
            placeholder="输入题目、页码或概念..."
            rows="5"
          />
          <button type="submit" className="btn-primary">添加错题</button>
        </form>
        
        <div style={{marginTop: '20px', padding: '15px', background: '#f1f5f9', borderRadius: '8px'}}>
          <h4>📊 统计概览</h4>
          <p>错题总数: {questions.length}</p>
          {/* 这里以后可以加日历热力图 */}
        </div>
      </section>

    </div>
  );
}

// 3. 登录页
function LoginPage({ onLogin }) {
  const [name, setName] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name) return alert("请输入用户名");
    onLogin(name);
    navigate('/');
  };

  return (
    <div className="page-center-wrapper">
      <div className="card" style={{width: '100%', maxWidth: '400px'}}>
        <h2 style={{textAlign: 'center'}}>👋 欢迎回来</h2>
        <p style={{textAlign: 'center', color: '#666', marginBottom: '30px'}}>继续你的间隔重复复习之旅</p>
        
        <form onSubmit={handleSubmit}>
          <div style={{marginBottom: '20px'}}>
            <label style={{display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: '#374151'}}>用户名</label>
            <input 
              type="text" 
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="例如: RoyalGrace"
            />
          </div>
          <div style={{marginBottom: '30px'}}>
            <label style={{display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: '#374151'}}>密码</label>
            <input type="password" placeholder="••••••••" />
          </div>
          <button type="submit" className="btn-primary">立即登录</button>
        </form>
        
        <p style={{textAlign: 'center', marginTop: '20px', color: '#6b7280', fontSize: '0.9rem'}}>
          还没有账号？ <Link to="/register" style={{color: 'var(--primary)', textDecoration: 'none'}}>去注册</Link>
        </p>
      </div>
    </div>
  );
}

// 4. 注册页
function RegisterPage() {
  return (
    <div className="auth-container card">
      <h2>🚀 创建账号</h2>
      <input type="text" placeholder="设置用户名" />
      <input type="email" placeholder="电子邮箱" />
      <input type="password" placeholder="设置密码" />
      <button className="btn-primary">立即注册</button>
      <p style={{marginTop: '15px'}}>
        已有账号？ <Link to="/login">去登录</Link>
      </p>
    </div>
  );
}

// 1. 个人中心：充实内容，拒绝留白
function ProfilePage({ user, questions, onLogout }) {
  const navigate = useNavigate();
  if (!user) { navigate('/login'); return null; }

  const handleLogout = () => { onLogout(); navigate('/login'); };

  // 算一点假数据来填充界面
  const totalReviews = questions.reduce((acc, q) => acc + q.streak, 0); // 假设 streak 代表复习次数
  const maxStreak = questions.reduce((max, q) => Math.max(max, q.streak), 0);
  const masteryRate = questions.length > 0 ? Math.round((questions.filter(q => q.streak > 3).length / questions.length) * 100) : 0;

  return (
    <div className="page-center-wrapper">
      <div className="profile-grid">
        
        {/* 左侧：个人信息卡 */}
        <div className="card" style={{textAlign: 'center'}}>
          <div style={{fontSize: '80px', marginBottom: '10px'}}>{user.avatar}</div>
          <h2 style={{margin: '10px 0'}}>{user.name}</h2>
          <p style={{color: '#666', marginBottom: '30px'}}>记忆大师 Lv.3</p>
          
          <div className="setting-group">
            <button className="btn-outline" style={{width:'100%', marginBottom:'10px'}}>修改头像</button>
            <button className="btn-outline" style={{width:'100%', marginBottom:'10px'}}>修改密码</button>
            <button className="btn-danger" style={{width:'100%'}} onClick={handleLogout}>退出登录</button>
          </div>
        </div>

        {/* 右侧：统计数据面板 (PC上会填满右侧) */}
        <div className="card">
          <h3 style={{marginTop:0}}>📈 学习概览</h3>
          
          {/* 数据网格 */}
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '30px'}}>
            <div className="stat-card">
              <div className="stat-number">{questions.length}</div>
              <div className="stat-label">总错题数</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{maxStreak}</div>
              <div className="stat-label">最高连胜</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{masteryRate}%</div>
              <div className="stat-label">掌握率</div>
            </div>
          </div>

          <h3>🔥 贡献热力图 (模拟)</h3>
          <div style={{
            height: '120px', 
            background: '#f8fafc', 
            borderRadius: '8px', 
            border: '1px dashed #cbd5e1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8'
          }}>
            这里未来可以放置类似 GitHub 的打卡热力图
          </div>

          <div style={{marginTop: '30px'}}>
             <h3>📥 数据管理</h3>
             <button className="btn-outline">导出所有数据 (JSON)</button>
          </div>
        </div>

      </div>
    </div>
  );
}

// 5. 设置页
function SettingsPage({ settings, setSettings }) {
  const [intervalStr, setIntervalStr] = useState(settings.intervals.join(','));

  const handleSave = () => {
    const newIntervals = intervalStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    setSettings({ ...settings, intervals: newIntervals });
    alert('✅ 设置已更新');
  };

  return (
    <div className="page-center-wrapper">
      <div className="card card-settings">
        <h2 style={{textAlign: 'center', marginBottom: '30px'}}>⚙️ 算法规则设置</h2>
        
        <div style={{marginBottom: '25px'}}>
          <label style={{display:'block', marginBottom:'10px', fontWeight:'600', color: '#374151'}}>
            记忆间隔序列 (天数)
          </label>
          <input 
            type="text" 
            value={intervalStr}
            onChange={(e) => setIntervalStr(e.target.value)}
            style={{fontSize: '1.1rem', letterSpacing: '1px'}}
          />
          <p style={{fontSize: '0.85rem', color: '#6b7280', marginTop: '8px', lineHeight: '1.5'}}>
            逻辑：当做对时，依次采用上述间隔。<br/>
            例如 14, 21, 28 表示：第1次对隔14天，第2次对隔21天...
          </p>
        </div>

        <div style={{marginBottom: '35px'}}>
          <label style={{display:'block', marginBottom:'10px', fontWeight:'600', color: '#374151'}}>
            遗忘惩罚 (倒退级数)
          </label>
          <div style={{
            display: 'flex', 
            alignItems: 'center', 
            gap: '15px', 
            background: '#f9fafb', 
            padding: '10px', 
            borderRadius: '8px',
            border: '1px solid #e5e7eb'
          }}>
            <button className="btn-outline" style={{width: '50px'}} onClick={() => setSettings({...settings, regressStep: Math.max(1, settings.regressStep - 1)})}>-</button>
            <span style={{fontSize: '1.1rem', fontWeight: 'bold', minWidth: '60px', textAlign: 'center'}}>
              {settings.regressStep} 级
            </span>
            <button className="btn-outline" style={{width: '50px'}} onClick={() => setSettings({...settings, regressStep: settings.regressStep + 1})}>+</button>
            <span style={{fontSize: '0.9rem', color: '#6b7280', marginLeft: 'auto'}}>做错题时，进度条倒退的格数</span>
          </div>
        </div>

        <button className="btn-primary" onClick={handleSave}>保存所有更改</button>
      </div>
    </div>
  );
}

export default App;