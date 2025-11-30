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
              <HomePage questions={questions} onAdd={addQuestion} onReview={handleReview} settings={settings}/>
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
// --- 更新后的 HomePage ---
// --- 更新后的 HomePage 组件 ---
function HomePage({ questions, onAdd, onReview, settings }) {
  const [inputContent, setInputContent] = useState("");
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  const today = dayjs().format('YYYY-MM-DD');
  
  // 判断当前视图是否为未来
  const isFutureView = selectedDate > today;

  // ★ 核心逻辑修改：列表筛选 ★
  const reviewsDue = questions.filter(q => {
    if (selectedDate === today) {
      // 今天：显示截止到今天所有没做的 (补作业逻辑)
      return q.nextReviewDate <= today;
    } else {
      // 未来：显示“选中日期”在“题目预测时间线”上的题目
      // 也就是说，虽然这道题下次复习是12月1号，但如果我点12月15号，
      // 而根据算法 12月15号 也是它的第N次复习日，那也要显示出来！
      const timeline = calculateTimeline(q, settings);
      return timeline.has(selectedDate);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputContent.trim()) return;
    onAdd(inputContent);
    setInputContent("");
  };

  const dateTitle = selectedDate === today ? "今日任务" : `${selectedDate} 的规划`;

  return (
    <div className="dashboard-grid">
      <section className="card section-list">
        <h2>📚 {dateTitle} ({reviewsDue.length})</h2>
        
        {reviewsDue.length === 0 ? (
          <div style={{textAlign: 'center', padding: '30px', color: '#888'}}>
            <p>{isFutureView ? "这一天不在任何题目的复习计划上" : "🎉 任务清空！"}</p>
          </div>
        ) : (
          <div style={{marginBottom: '20px'}}>
            {reviewsDue.map(q => (
              <div key={q.id} className="review-item">
                <div style={{whiteSpace: 'pre-wrap', marginBottom: '10px'}}>{q.content}</div>
                
                {isFutureView ? (
                  // 未来视图：只显示信息，不显示操作
                  <div style={{
                    padding: '8px', 
                    background: '#f8fafc', 
                    borderRadius: '6px', 
                    border: '1px dashed #cbd5e1',
                    fontSize: '0.85rem', 
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px'
                  }}>
                    <span>🔮 预测: 这是第 {q.streak + calculateStreakDiff(q, selectedDate, settings)} 次复习节点</span>
                  </div>
                ) : (
                  // 今天视图：显示操作按钮
                  <div className="review-actions">
                    <button className="btn-outline" style={{borderColor:'#ef4444', color:'#ef4444'}} onClick={() => onReview(q.id, false)}>
                      忘了
                    </button>
                    <button className="btn-primary" style={{background:'#22c55e'}} onClick={() => onReview(q.id, true)}>
                      记得
                    </button>
                  </div>
                )}

                <div style={{fontSize: '12px', color: '#999', marginTop: '8px', display:'flex', justifyContent:'space-between'}}>
                   {/* 如果是未来，显示原本的下次日期作为对比 */}
                   <span>当前等级: Lv.{q.streak}</span>
                   {isFutureView && <span>(原定下次: {q.nextReviewDate})</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        <Calendar 
          questions={questions} 
          settings={settings}
          selectedDate={selectedDate} 
          onDateSelect={setSelectedDate} 
        />
      </section>

      {/* 右侧部分不变 */}
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
        </div>
      </section>
    </div>
  );
}

// 辅助函数：计算未来某天是第几次复习（用于显示“第N次复习节点”）
function calculateStreakDiff(question, targetDate, settings) {
  let tempStreak = question.streak;
  let currentDateObj = dayjs(question.nextReviewDate);
  let count = 1; // 至少是下一次

  if (targetDate === currentDateObj.format('YYYY-MM-DD')) return 1;

  while (true) {
    tempStreak++;
    if (tempStreak >= settings.intervals.length) break;
    
    const daysToAdd = settings.intervals[tempStreak];
    currentDateObj = currentDateObj.add(daysToAdd, 'day');
    count++;
    
    if (currentDateObj.format('YYYY-MM-DD') === targetDate) {
      return count;
    }
  }
  return 1; // Fallback
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
// --- 提取出来的日历核心预测算法 ---
// 作用：根据题目当前的 streak 和 settings，算出未来所有的复习日期点
const calculateTimeline = (question, settings) => {
  const dates = new Set();
  
  // 1. 放入当前的下一次复习日期 (这是确定的起点)
  let currentDateObj = dayjs(question.nextReviewDate);
  dates.add(currentDateObj.format('YYYY-MM-DD'));

  // 2. 模拟未来 (只要还没把 settings.intervals 跑完，就继续算)
  // 我们从当前的 streak 开始往后推
  let tempStreak = question.streak;

  while (true) {
    // 假设下一次做对了，等级+1
    tempStreak++;

    // ★ 关键逻辑修改：如果等级超过了设置数组的长度，就停止预测
    // 比如 intervals = [14, 21, 28]，长度是3
    // streak 0 -> 用14天
    // streak 1 -> 用21天
    // streak 2 -> 用28天
    // streak 3 -> 越界了，不显示了，循环结束
    if (tempStreak >= settings.intervals.length) {
      break; 
    }

    const daysToAdd = settings.intervals[tempStreak];
    currentDateObj = currentDateObj.add(daysToAdd, 'day');
    dates.add(currentDateObj.format('YYYY-MM-DD'));
  }

  return dates;
};

// 6. 日历组件
function Calendar({ questions, settings, selectedDate, onDateSelect }) {
  const [currentDate, setCurrentDate] = useState(dayjs(selectedDate));

  // 计算所有题目的“所有未来日期”
  const taskMap = (() => {
    const map = new Set();
    questions.forEach(q => {
      // 对每一道题，计算它的整个生命周期
      const timeline = calculateTimeline(q, settings);
      timeline.forEach(date => map.add(date));
    });
    return map;
  })();

  const nextMonth = () => setCurrentDate(currentDate.add(1, 'month'));
  const prevMonth = () => setCurrentDate(currentDate.subtract(1, 'month'));
  const jumpToToday = () => {
    const today = dayjs().format('YYYY-MM-DD');
    setCurrentDate(dayjs());
    onDateSelect(today);
  };

  const startOfMonth = currentDate.startOf('month');
  const daysInMonth = currentDate.daysInMonth();
  const startDay = startOfMonth.day(); 
  
  const daysArray = [];
  for (let i = 0; i < startDay; i++) daysArray.push({ type: 'empty', id: `empty-${i}` });
  
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = currentDate.date(i).format('YYYY-MM-DD');
    daysArray.push({ type: 'day', val: i, dateStr, hasTask: taskMap.has(dateStr) });
  }

  const weeks = ['日', '一', '二', '三', '四', '五', '六'];

  return (
    <div className="calendar-wrapper">
      <div className="calendar-header">
        <button onClick={prevMonth}>&lt;</button>
        <span className="calendar-title" onClick={jumpToToday}>
          {currentDate.format('YYYY年 MM月')}
        </span>
        <button onClick={nextMonth}>&gt;</button>
      </div>

      <div className="calendar-grid">
        {weeks.map(w => <div key={w} className="calendar-day-label">{w}</div>)}
        {daysArray.map(item => {
          if (item.type === 'empty') return <div key={item.id} />;
          
          const isSelected = item.dateStr === selectedDate;
          const isToday = item.dateStr === dayjs().format('YYYY-MM-DD');

          return (
            <div 
              key={item.dateStr} 
              className={`calendar-cell ${isSelected ? 'selected' : ''} ${isToday ? 'is-today' : ''}`}
              onClick={() => onDateSelect(item.dateStr)}
            >
              {item.val}
              {item.hasTask && <div className={`task-dot ${item.dateStr > dayjs().format('YYYY-MM-DD') ? 'projected' : ''}`} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default App;