import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import './App.css'; 

// --- 默认设置 ---
const DEFAULT_SETTINGS_DATA = {
  // 存放所有的规则配置
  profiles: [
    { 
      id: 'default_1', 
      name: '默认算法 (推荐)', 
      intervals: [1, 2, 4, 7, 15, 30], // 经典遗忘曲线
      regressStep: 1 
    },
    { 
      id: 'hard_mode', 
      name: '魔鬼训练 (包含当日)', 
      intervals: [0, 0, 1, 3, 7], // 0代表今天立刻再做一次
      regressStep: 2 
    }
  ],
  // 当前默认使用的规则 ID
  defaultId: 'default_1'
};

function App() {
  // 1. 用户状态
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('my_app_user');
    return saved ? JSON.parse(saved) : null;
  });

  // 2. 错题数据
  const [questions, setQuestions] = useState(() => {
    const saved = localStorage.getItem('my_wrong_questions');
    return saved ? JSON.parse(saved) : [];
  });

  // 3. 设置数据 (结构大改)
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('my_app_settings');
    // 如果是旧版数据（没有 profiles 字段），强制重置为新版，防止报错
    if (saved) {
      const parsed = JSON.parse(saved);
      if (!parsed.profiles) return DEFAULT_SETTINGS_DATA;
      return parsed;
    }
    return DEFAULT_SETTINGS_DATA;
  });

  // 持久化
  useEffect(() => { localStorage.setItem('my_wrong_questions', JSON.stringify(questions)); }, [questions]);
  useEffect(() => { localStorage.setItem('my_app_settings', JSON.stringify(settings)); }, [settings]);
  useEffect(() => { 
    if (user) localStorage.setItem('my_app_user', JSON.stringify(user));
    else localStorage.removeItem('my_app_user');
  }, [user]);

  // --- 辅助函数：根据ID找配置 ---
  const getProfileById = (id) => {
    return settings.profiles.find(p => p.id === id) || settings.profiles.find(p => p.id === settings.defaultId);
  };

  // --- 核心业务逻辑 ---

  // 添加错题：现在支持指定 settingId
  const addQuestion = (content, settingId) => {
    const targetId = settingId || settings.defaultId;
    const profile = getProfileById(targetId);

    // ★ 关键修复：不能用 || 1，因为 0 也是有效值
    // 如果 intervals[0] 存在，就用它；否则默认 1
    const firstInterval = profile.intervals[0] !== undefined ? profile.intervals[0] : 1;

    const newQ = {
      id: Date.now(),
      content: content,
      streak: 0,
      settingId: targetId,
      // dayjs().add(0, 'day') 依然是今天，这样就修好了
      nextReviewDate: dayjs().add(firstInterval, 'day').format('YYYY-MM-DD'),
    };
    
    // 如果是今天复习，强制刷新一下列表（虽然 React 会自动做，但为了保险）
    setQuestions(prev => [...prev, newQ]);
  };

  // 复习逻辑 (完全重写，支持 0 天)
  const handleReview = (id, isCorrect) => {
    setQuestions(prev => prev.map(q => {
      if (q.id !== id) return q;

      // 1. 找到这道题对应的规则
      const profile = getProfileById(q.settingId);
      
      let newStreak = q.streak;
      
      // 2. 只有今天的错题才能修改 streak (未来预测逻辑保持显示但不操作)
      if (isCorrect) {
        newStreak = newStreak + 1;
      } else {
        // 做错倒退，最少退回 0
        newStreak = Math.max(0, newStreak - profile.regressStep);
      }

      // 3. 统一查表计算日子 (不管对错，都查表)
      // 如果 streak 超过了数组长度，就一直取最后一个
      const intervalIndex = Math.min(newStreak, profile.intervals.length - 1);
      const daysToAdd = profile.intervals[intervalIndex];

      // 4. 算出日期
      const nextDate = dayjs().add(daysToAdd, 'day').format('YYYY-MM-DD');

      return { ...q, streak: newStreak, nextReviewDate: nextDate };
    }));
  };

  // 登录退出
  const login = (name) => setUser({ name, avatar: '👤' });
  const logout = () => setUser(null);

  return (
    <BrowserRouter>
      <div className="app-container">
        <NavBar user={user} />
        <Routes>
          <Route path="/" element={
            user ? (
              <HomePage 
                questions={questions} 
                onAdd={addQuestion} 
                onReview={handleReview} 
                settings={settings} // 把整个 settings 传进去，方便日历预测
                getProfileById={getProfileById} // 传个查找器给日历用
              />
            ) : <LoginPage onLogin={login} />
          } />
          <Route path="/settings" element={
            <SettingsPage settings={settings} setSettings={setSettings} questions={questions} setQuestions={setQuestions}/>
          } />
          <Route path="/profile" element={<ProfilePage user={user} questions={questions} onLogout={logout} />} />
          <Route path="/login" element={<LoginPage onLogin={login} />} />
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
      <div className="logo">延时记 🧠</div>
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
function HomePage({ questions, onAdd, onReview, settings, getProfileById }) {
  const [inputContent, setInputContent] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState(settings.defaultId);
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  const today = dayjs().format('YYYY-MM-DD');
  
  const isFutureView = selectedDate > today;

  // 列表筛选逻辑
  const reviewsDue = questions.filter(q => {
    const profile = getProfileById(q.settingId);
    if (selectedDate === today) {
      return q.nextReviewDate <= today;
    } else {
      const timeline = calculateTimeline(q, profile);
      return timeline.has(selectedDate);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputContent.trim()) return;
    onAdd(inputContent, selectedProfileId);
    setInputContent("");
  };

  const dateTitle = selectedDate === today ? "今日任务" : `${selectedDate} 的规划`;

  return (
    <div className="dashboard-grid">
      <section className="card section-list">
        <h2>📚 {dateTitle} ({reviewsDue.length})</h2>
        {reviewsDue.length === 0 ? (
          <div style={{textAlign:'center', padding:'30px', color:'#888'}}>
            {isFutureView ? "无计划" : "🎉 任务清空！"}
          </div>
        ) : (
          <div style={{marginBottom: '20px'}}>
            {reviewsDue.map(q => (
              <div key={q.id} className="review-item">
                <div style={{whiteSpace: 'pre-wrap', marginBottom:'10px'}}>
                  {q.content}
                  <span style={{float:'right', fontSize:'0.7rem', background:'#eee', padding:'2px 6px', borderRadius:'4px', color:'#666'}}>
                     {getProfileById(q.settingId)?.name}
                  </span>
                </div>
                {!isFutureView && (
                  <div className="review-actions">
                     <button className="btn-outline" style={{borderColor:'#ef4444', color:'#ef4444'}} onClick={() => onReview(q.id, false)}>忘了</button>
                     <button className="btn-primary" style={{background:'#22c55e'}} onClick={() => onReview(q.id, true)}>记得</button>
                  </div>
                )}
                <div style={{fontSize: '12px', color: '#999', marginTop: '8px', display:'flex', justifyContent:'space-between'}}>
                   <span>Lv.{q.streak}</span>
                   {isFutureView && <span>(原定: {q.nextReviewDate})</span>}
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
          getProfileById={getProfileById} 
        />
      </section>

      {/* 右侧：录入区 */}
      <section className="card section-add">
        <h2>✏️ 快速录入</h2>
        <form onSubmit={handleSubmit}>
          
          {/* 1. 先放输入框 */}
          <textarea 
            value={inputContent}
            onChange={(e) => setInputContent(e.target.value)}
            placeholder="输入题目内容..."
            rows="5"
          />

          {/* 2. 再放规则 Tag 选择器 (UI调整) */}
          <div style={{marginTop: '10px', marginBottom: '15px'}}>
            <span className="tag-label">复习策略:</span>
            <div className="tag-selector">
              {settings.profiles.map(p => (
                <div 
                  key={p.id} 
                  className={`rule-tag ${selectedProfileId === p.id ? 'active' : ''}`}
                  onClick={() => setSelectedProfileId(p.id)}
                >
                  {p.name}
                  {/* 如果是默认，加个小星号提示 */}
                  {p.id === settings.defaultId && ' *'}
                </div>
              ))}
            </div>
          </div>

          <button type="submit" className="btn-primary">添加错题</button>
        </form>
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
function SettingsPage({ settings, setSettings ,questions, setQuestions}) {
  const [activeId, setActiveId] = useState(settings.profiles[0].id);
  const activeProfile = settings.profiles.find(p => p.id === activeId) || settings.profiles[0];
  
  const [formName, setFormName] = useState(activeProfile.name);
  const [formIntervals, setFormIntervals] = useState(activeProfile.intervals.join(','));
  const [formStep, setFormStep] = useState(activeProfile.regressStep);

  useEffect(() => {
    setFormName(activeProfile.name);
    setFormIntervals(activeProfile.intervals.join(','));
    setFormStep(activeProfile.regressStep);
  }, [activeProfile]);

  const handleAddProfile = () => {
    const newId = `custom_${Date.now()}`;
    const newProfile = {
      id: newId,
      name: "新规则",
      intervals: [1, 3, 7],
      regressStep: 1
    };
    setSettings({ ...settings, profiles: [...settings.profiles, newProfile] });
    setActiveId(newId);
  };

  const handleSave = () => {
    // 1. 解析新规则的间隔数组
    const newIntervals = formIntervals.split(',')
      .map(s => parseInt(s.trim()))
      .filter(n => !isNaN(n));

    // 2. 准备更新 Settings
    const updatedProfiles = settings.profiles.map(p => {
      if (p.id === activeId) {
        return {
          ...p,
          name: formName,
          intervals: newIntervals,
          regressStep: formStep
        };
      }
      return p;
    });

    // 3. 准备更新 Questions (批量修正日期)
    const today = dayjs().format('YYYY-MM-DD');
    const oldIntervals = activeProfile.intervals; // 保存前的旧间隔

    const updatedQuestions = questions.map(q => {
      // 条件A: 必须是属于当前正在修改的规则
      if (q.settingId !== activeId) return q;

      // 条件B: 必须是“将来”或“今天”的任务。
      // 如果已经是过去的逾期任务，根据你的要求，不应该改动历史。
      if (q.nextReviewDate < today) return q;

      // --- 开始计算时差 ---
      
      // 1. 获取该题目当前Streak对应的“旧间隔天数”
      // (注意防止数组越界，取最后一位)
      const oldIndex = Math.min(q.streak, oldIntervals.length - 1);
      const oldDays = oldIntervals[oldIndex] !== undefined ? oldIntervals[oldIndex] : 1;

      // 2. 获取该题目当前Streak对应的“新间隔天数”
      const newIndex = Math.min(q.streak, newIntervals.length - 1);
      const newDays = newIntervals[newIndex] !== undefined ? newIntervals[newIndex] : 1;

      // 3. 算出差值 (比如 0变1，差值就是 +1)
      const diff = newDays - oldDays;

      // 4. 如果没变化，直接返回
      if (diff === 0) return q;

      // 5. 应用时差：在原定日期上 加/减 差值
      const fixedDate = dayjs(q.nextReviewDate).add(diff, 'day').format('YYYY-MM-DD');

      console.log(`修正题目: ${q.content}, 原日期: ${q.nextReviewDate}, 新日期: ${fixedDate} (差值 ${diff})`);

      return {
        ...q,
        nextReviewDate: fixedDate
      };
    });

    // 4. 同时提交修改
    setSettings({ ...settings, profiles: updatedProfiles });
    setQuestions(updatedQuestions);
    
    alert(`✅ 规则已保存，并智能修正了 ${updatedQuestions.filter((q,i) => q.nextReviewDate !== questions[i].nextReviewDate).length} 个待办任务的日期。`);
  };

  const handleSetDefault = () => { setSettings({ ...settings, defaultId: activeId }); };

  const handleDelete = () => {
    if (settings.profiles.length <= 1) return alert("至少保留一个规则！");
    if (activeId === settings.defaultId) return alert("无法删除默认规则。");
    if (window.confirm("确定删除吗？")) {
      const newProfiles = settings.profiles.filter(p => p.id !== activeId);
      setSettings({ ...settings, profiles: newProfiles });
      setActiveId(newProfiles[0].id);
    }
  };

  return (
    <div className="page-center-wrapper">
      <div className="card" style={{width: '100%', maxWidth: '900px'}}>
        <h2 style={{marginBottom: '20px'}}>⚙️ 算法配置管理</h2>
        
        <div className="settings-container">
          {/* 左侧列表 */}
          <div className="settings-sidebar">
            <h4 style={{margin: '0 0 10px 0', color: '#666'}}>规则列表</h4>
            {settings.profiles.map(p => (
              <div 
                key={p.id} 
                className={`profile-item ${p.id === activeId ? 'active' : ''}`}
                onClick={() => setActiveId(p.id)}
              >
                <span>{p.name}</span>
                {p.id === settings.defaultId && <span className="badge-default">默认</span>}
              </div>
            ))}
            <button className="btn-outline" onClick={handleAddProfile} style={{marginTop: 'auto'}}>+ 新建规则</button>
          </div>

          {/* 右侧编辑 */}
          <div className="settings-content">
            <h4 style={{marginTop: 0}}>编辑: {activeProfile.name}</h4>
            
            <div style={{marginBottom: '15px'}}>
              <label style={{display:'block', marginBottom:'5px', fontSize:'0.9rem'}}>规则名称</label>
              <input type="text" value={formName} onChange={e => setFormName(e.target.value)} />
            </div>

            <div style={{marginBottom: '15px'}}>
              <label style={{display:'block', marginBottom:'5px', fontSize:'0.9rem'}}>间隔序列 (允许填0)</label>
              <input type="text" value={formIntervals} onChange={e => setFormIntervals(e.target.value)} />
            </div>

            <div style={{marginBottom: '20px'}}>
              <label style={{display:'block', marginBottom:'5px', fontSize:'0.9rem'}}>
                {/* ★ 逻辑修复：显示0级 */}
                做错倒退级数: {formStep === 0 ? '0 (不倒退)' : `${formStep} 级`}
              </label>
              <input 
                type="range" 
                min="0" max="5" /* ★ 逻辑修复：允许设为 0 */
                value={formStep} 
                onChange={e => setFormStep(parseInt(e.target.value))} 
                style={{width: '100%'}}
              />
            </div>

            <div style={{display: 'flex', gap: '10px'}}>
              <button className="btn-primary" onClick={handleSave}>保存修改</button>
              {activeId !== settings.defaultId && (
                <button className="btn-outline" onClick={handleSetDefault}>设为默认</button>
              )}
              <button className="btn-danger" onClick={handleDelete} style={{width: 'auto'}}>删除</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
// --- 提取出来的日历核心预测算法 ---
// 作用：根据题目当前的 streak 和 settings，算出未来所有的复习日期点
const calculateTimeline = (question, profile) => {
  const dates = new Set();
  let currentDateObj = dayjs(question.nextReviewDate);
  dates.add(currentDateObj.format('YYYY-MM-DD'));

  let tempStreak = question.streak;
  
  // 安全限制：最多预测20次，防止死循环
  for(let i=0; i<20; i++) {
    tempStreak++;
    if (tempStreak >= profile.intervals.length) break;

    const daysToAdd = profile.intervals[tempStreak];
    currentDateObj = currentDateObj.add(daysToAdd, 'day');
    dates.add(currentDateObj.format('YYYY-MM-DD'));
  }
  return dates;
};

// 6. 日历组件
function Calendar({ questions, selectedDate, onDateSelect, getProfileById }) {
  const [currentDate, setCurrentDate] = useState(dayjs(selectedDate));

  // 预测算法：现在必须对每道题分别查找它的规则
  const taskMap = (() => {
    const map = new Set();
    questions.forEach(q => {
      const profile = getProfileById(q.settingId); // ★ 找对应的规则
      if(profile) {
        const timeline = calculateTimeline(q, profile);
        timeline.forEach(date => map.add(date));
      }
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