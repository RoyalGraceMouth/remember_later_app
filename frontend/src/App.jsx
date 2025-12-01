import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import './App.css'; 
import { MoreHorizontal, Check, X, Trash2, Edit2, Calendar as CalIcon , GraduationCap} from 'lucide-react';
import {Search,Database} from 'lucide-react';

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

    // 删除题目
  const deleteQuestion = (id) => {
    if (window.confirm("确定要删除这道错题吗？")) {
      setQuestions(prev => prev.filter(q => q.id !== id));
    }
  };

  // 更新题目 (内容 或 规则)
  // ★★★ 修复版：修改题目内容或规则，并自动修正日期 ★★★
  const updateQuestion = (id, newContent, newSettingId) => {
    setQuestions(prev => prev.map(q => {
      if (q.id !== id) return q;

      // 1. 如果只改了文字，没改规则，直接返回
      if (q.settingId === newSettingId) {
        return { ...q, content: newContent };
      }

      // --- 2. 如果改了规则，开始计算“时差” ---
      const oldProfile = getProfileById(q.settingId);
      const newProfile = getProfileById(newSettingId);

      // (安全检查：如果找不到规则，就不改日期，只改ID)
      if (!oldProfile || !newProfile) {
        return { ...q, content: newContent, settingId: newSettingId };
      }

      // 获取当前等级对应的“旧间隔”
      // (注意：如果当前等级超过了规则长度，取最后一位)
      const oldIndex = Math.min(q.streak, oldProfile.intervals.length - 1);
      const oldDays = oldProfile.intervals[oldIndex] !== undefined ? oldProfile.intervals[oldIndex] : 1;

      // 获取当前等级对应的“新间隔”
      const newIndex = Math.min(q.streak, newProfile.intervals.length - 1);
      const newDays = newProfile.intervals[newIndex] !== undefined ? newProfile.intervals[newIndex] : 1;

      // 算出差值 (比如 3天变成了 7天，diff 就是 +4)
      const diff = newDays - oldDays;

      // 计算新的日期
      const newDate = dayjs(q.nextReviewDate).add(diff, 'day').format('YYYY-MM-DD');

      console.log(`题目[${id}]切换规则: ${oldProfile.name} -> ${newProfile.name}, 日期修正: ${diff}天`);

      // --- 3. 还有一种特殊情况：毕业状态 ---
      // 如果新规则更短（比如旧规则只有1级已毕业，新规则有5级），可能需要“取消毕业”？
      // 或者如果新规则更长，可能需要“立即毕业”？
      // 这里为了简单稳健，我们暂时只修正日期，并重新检查一下毕业状态。
      
      const isNowGraduated = q.streak >= newProfile.intervals.length;

      return {
        ...q,
        content: newContent,
        settingId: newSettingId,    // 更新 ID
        nextReviewDate: newDate,    // 更新 日期
        isGraduated: isNowGraduated // 更新 毕业状态 (防止切换到短规则后状态不对)
      };
    }));
  };

  

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

      // 1. 获取规则
      const profile = getProfileById(q.settingId);
      
      let newStreak = q.streak;
      
      // 2. 计算新等级
      if (isCorrect) {
        newStreak = newStreak + 1;
      } else {
        // 做错倒退 (最低为0)
        newStreak = Math.max(0, newStreak - profile.regressStep);
      }

      // ★★★ 核心修复：毕业判断 ★★★
      // 这里的逻辑是：如果是 [0]，长度为1。
      // 初始 streak=0。做对 -> newStreak=1。
      // 1 >= 1，满足条件，触发毕业。
      if (newStreak >= profile.intervals.length) {
        return {
          ...q,
          streak: newStreak,
          isGraduated: true, // ★ 标记为毕业
          nextReviewDate: '🏁 已毕业' // 以后不再显示日期
        };
      }

      // 3. 如果没毕业，继续计算下次日期
      const intervalIndex = newStreak; 
      // 注意：数组索引是从0开始的，intervals[0]对应streak0
      // 这里的 intervalIndex 不需要 Math.min 锁死最后一位了，
      // 因为上面已经拦截了毕业的情况。只要能走到这里，说明 newStreak 一定在数组范围内。
      
      const daysToAdd = profile.intervals[intervalIndex];
      const nextDate = dayjs().add(daysToAdd, 'day').format('YYYY-MM-DD');

      return { 
        ...q, 
        streak: newStreak, 
        nextReviewDate: nextDate,
        isGraduated: false // 确保错题回炉重造时取消毕业状态
      };
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
                onDelete={deleteQuestion}   
                onUpdate={updateQuestion}   
              />
            ) : <LoginPage onLogin={login} />
          } />
          <Route path="/settings" element={
            <SettingsPage settings={settings} setSettings={setSettings} questions={questions} setQuestions={setQuestions}/>
          } />
          <Route path="/profile" element={<ProfilePage user={user} questions={questions} onLogout={logout} />} />
          <Route path="/login" element={<LoginPage onLogin={login} />} />
          <Route path="/database" element={
            <DatabasePage 
              questions={questions} 
              onDelete={deleteQuestion} 
              onUpdate={updateQuestion}
              getProfileById={getProfileById}
              settings={settings} // 记得传 settings 给它，因为编辑模态框需要
            />
          } />
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
            <Link to="/database">题库</Link> 
            <Link to="/settings">规则设置</Link>
            <Link to="/profile">我的 ({user.name})</Link>
          </>
        ) : (
          <Link to="/login">登录</Link>
        )}
      </div>
    </nav>
  );
}

// 2. 主页
function HomePage({ questions, onAdd, onReview, onDelete, onUpdate, settings, getProfileById }) {
  const [inputContent, setInputContent] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState(settings.defaultId);
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  
  // 编辑模态框的状态
  const [editingQ, setEditingQ] = useState(null); // 当前正在编辑的题目对象

  const today = dayjs().format('YYYY-MM-DD');
  const isFutureView = selectedDate > today;

  const reviewsDue = questions.filter(q => {
    const profile = getProfileById(q.settingId);
    if (selectedDate === today) return q.nextReviewDate <= today;
    const timeline = calculateTimeline(q, profile);
    return timeline.has(selectedDate);
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
        <h2 style={{display:'flex', alignItems:'center', gap:'10px'}}>
           <CalIcon size={20}/> {dateTitle} 
           <span style={{fontSize:'0.9rem', color:'#999', fontWeight:'normal'}}>({reviewsDue.length})</span>
        </h2>

        {reviewsDue.length === 0 ? (
          <div style={{textAlign:'center', padding:'40px', color:'#94a3b8'}}>
            <p>{isFutureView ? "🍃 这一天没有复习计划" : "🎉 任务清空！去休息吧。"}</p>
          </div>
        ) : (
          <div style={{marginBottom: '20px'}}>
            {reviewsDue.map(q => (
              <ReviewCard 
                key={q.id} 
                question={q} 
                isFuture={isFutureView} 
                onReview={onReview}
                onEdit={() => setEditingQ(q)} // 打开编辑框
                onDelete={() => onDelete(q.id)} // 删除
                profileName={getProfileById(q.settingId)?.name}
                getProfileById={getProfileById} 
              />
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

      {/* 右侧录入区 (保持不变) */}
      <section className="card section-add">
        <h2>✏️ 快速录入</h2>
        <form onSubmit={handleSubmit}>
          <textarea 
            value={inputContent}
            onChange={(e) => setInputContent(e.target.value)}
            placeholder="输入题目内容..."
            rows="5"
          />
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
                  {p.id === settings.defaultId && ' *'}
                </div>
              ))}
            </div>
          </div>
          <button type="submit" className="btn-primary">添加错题</button>
        </form>
      </section>

      {/* ★ 编辑模态框 ★ */}
      {editingQ && (
        <EditModal 
          question={editingQ} 
          settings={settings} 
          onClose={() => setEditingQ(null)} 
          onSave={onUpdate}
        />
      )}
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

function ReviewCard({ 
  question, 
  isFuture, 
  onReview, 
  onEdit, 
  onDelete, 
  getProfileById, // 必须传这个，用于判断是否毕业
  readOnly = false // 新增：是否为只读模式（用于数据库页面）
}) {
  const [showMenu, setShowMenu] = useState(false);
  
  // 1. 获取该题目的规则
  const profile = getProfileById(question.settingId);
  const profileName = profile?.name || '未知规则';
  
  // 2. ★★★ 核心逻辑：判断下一次点击是否毕业 ★★★
  // 如果当前等级 + 1 >= 规则的总长度，说明点一下就通关了
  const isNextGraduation = profile && (question.streak + 1 >= profile.intervals.length);

  return (
    <div className="review-item" onMouseLeave={() => setShowMenu(false)}>
      {/* 菜单逻辑不变 */}
      <button className="more-btn" onClick={() => setShowMenu(!showMenu)}>
        <MoreHorizontal size={20} />
      </button>

      {showMenu && (
        <div className="menu-dropdown">
          <div className="menu-item" onClick={() => { onEdit(); setShowMenu(false); }}>
            <Edit2 size={16} /> 编辑
          </div>
          <div className="menu-item delete" onClick={() => { onDelete(); setShowMenu(false); }}>
            <Trash2 size={16} /> 删除
          </div>
        </div>
      )}

      {/* 题目内容 */}
      <div className="review-content" style={{whiteSpace: 'pre-wrap'}}>
        {question.content}
      </div>

      <div className="review-footer">
        <div style={{display:'flex', gap:'8px', alignItems:'center'}}>
          {/* 状态标签 */}
          {question.isGraduated ? (
            <span className="mini-tag" style={{background:'#f3e8ff', color:'#702963', fontWeight:'bold'}}>
              🎓 已毕业
            </span>
          ) : (
            <span className="mini-tag">Lv.{question.streak}</span>
          )}
          
          <span className="mini-tag">{profileName}</span>
          
          {/* 如果是未来，显示预测时间 */}
          {isFuture && !question.isGraduated && (
            <span className="mini-tag" style={{background:'#fef3c7', color:'#d97706'}}>
              {question.nextReviewDate}
            </span>
          )}
        </div>

        {/* 按钮区域逻辑 */}
        {!readOnly && !isFuture && !question.isGraduated && (
          <div className="action-row">
            {/* 忘了按钮 */}
            <button 
              className="icon-btn btn-forgot" 
              onClick={() => onReview(question.id, false)}
              title="忘了 (退步)"
            >
              <X size={24} strokeWidth={3} />
            </button>

            {/* 记得按钮 vs 毕业按钮 */}
            {isNextGraduation ? (
              <button 
                className="icon-btn btn-graduate" 
                onClick={() => {
                  // 这里可以加个礼花特效 alert，增加情绪价值
                  // alert("🎉 恭喜！这道题通过了所有考验，光荣毕业！"); 
                  onReview(question.id, true);
                }}
                title="点击毕业！(Byzantine Purple)"
              >
                {/* 🎓 毕业帽图标 */}
                <GraduationCap size={24} strokeWidth={3} />
              </button>
            ) : (
              <button 
                className="icon-btn btn-remember" 
                onClick={() => onReview(question.id, true)}
                title="记得 (保持)"
              >
                <Check size={24} strokeWidth={3} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EditModal({ question, settings, onClose, onSave }) {
  const [content, setContent] = useState(question.content);
  const [settingId, setSettingId] = useState(question.settingId);

  const handleSave = () => {
    onSave(question.id, content, settingId);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h3 style={{marginTop:0}}>✏️ 编辑错题</h3>
        
        <label style={{display:'block', marginBottom:'5px', color:'#666', fontSize:'0.9rem'}}>题目内容</label>
        <textarea 
          value={content} 
          onChange={e => setContent(e.target.value)}
          rows="5"
        />

        <label style={{display:'block', marginBottom:'5px', color:'#666', fontSize:'0.9rem', marginTop:'15px'}}>复习规则</label>
        <select value={settingId} onChange={e => setSettingId(e.target.value)}>
          {settings.profiles.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <div className="modal-actions">
          <button className="btn-outline" onClick={onClose} style={{width:'auto'}}>取消</button>
          <button className="btn-primary" onClick={handleSave} style={{width:'auto'}}>保存</button>
        </div>
      </div>
    </div>
  );
}

// 3. 数据库页
function DatabasePage({ questions, onDelete, onUpdate, getProfileById, settings }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all"); // all, active, graduated
  const [editingQ, setEditingQ] = useState(null); // 复用编辑功能

  // 筛选逻辑
  const filteredQuestions = questions.filter(q => {
    // 1. 搜索匹配 (内容)
    const matchesSearch = q.content.toLowerCase().includes(searchTerm.toLowerCase());
    
    // 2. 类型匹配
    let matchesType = true;
    if (filterType === 'active') matchesType = !q.isGraduated;
    if (filterType === 'graduated') matchesType = q.isGraduated;

    return matchesSearch && matchesType;
  });

  // 按时间倒序排列 (最新的在前面)
  const sortedQuestions = [...filteredQuestions].sort((a, b) => b.id - a.id);

  return (
    <div className="dashboard-grid">
      {/* 既然是数据库，我们就让它占满全宽，或者依然保持左侧主列表的布局 */}
      <section className="card" style={{gridColumn: '1 / -1'}}> {/* 强制占满全宽 */}
        <h2 style={{display:'flex', alignItems:'center', gap:'10px'}}>
          <Database size={22} /> 错题博物馆
          <span style={{fontSize:'0.9rem', color:'#999', fontWeight:'normal'}}>
            (共 {questions.length} 题)
          </span>
        </h2>

        {/* 顶部工具栏：搜索 + 筛选 */}
        <div className="database-header">
          <div className="search-bar-wrapper">
            <Search className="search-icon" size={18} />
            <input 
              type="text" 
              className="search-input"
              placeholder="搜索题目内容..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="segmented-control">
            <button 
              className={`segment-btn ${filterType === 'all' ? 'active' : ''}`}
              onClick={() => setFilterType('all')}
            >
              全部
            </button>
            <button 
              className={`segment-btn ${filterType === 'active' ? 'active' : ''}`}
              onClick={() => setFilterType('active')}
            >
              进行中
            </button>
            <button 
              className={`segment-btn ${filterType === 'graduated' ? 'active' : ''}`}
              onClick={() => setFilterType('graduated')}
            >
              🎓 已毕业
            </button>
          </div>
        </div>

        {/* 列表区域 */}
        {sortedQuestions.length === 0 ? (
          <div className="empty-state">
            <p>📭 没有找到符合条件的题目</p>
          </div>
        ) : (
          <div>
            {sortedQuestions.map(q => (
              <ReviewCard 
                key={q.id} 
                question={q} 
                getProfileById={getProfileById}
                onDelete={()=> onDelete(q.id)}
                onEdit={() => setEditingQ(q)} // 复用编辑
                readOnly={true} // ★ 开启只读模式，不显示复习按钮
              />
            ))}
          </div>
        )}
      </section>

      {/* ★ 复用编辑模态框 ★ */}
      {editingQ && (
        <EditModal 
          question={editingQ} 
          settings={settings} 
          onClose={() => setEditingQ(null)} 
          onSave={onUpdate}
        />
      )}
    </div>
  );
}

// 4. 登录页
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

// 5. 注册页
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

// 6. 个人中心：充实内容，拒绝留白
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

// 7. 设置页
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
    // --- 1. 严格校验间隔序列 ---
    const rawIntervals = formIntervals.split(/[,，\s]+/); // 支持中英文逗号、空格分隔
    const newIntervals = [];
    
    for (let s of rawIntervals) {
      if (!s.trim()) continue; // 跳过空字符
      
      const num = Number(s);
      
      // 校验 A: 必须是数字
      if (isNaN(num)) {
        return alert(`❌ 输入错误："${s}" 不是有效数字`);
      }
      // 校验 B: 必须是整数
      if (!Number.isInteger(num)) {
        return alert(`❌ 输入错误："${s}" 必须是整数，不能有小数`);
      }
      // 校验 C: 不能小于 0
      if (num < 0) {
        return alert(`❌ 输入错误："${s}" 不能是负数`);
      }
      // 校验 D: 防止过大 (比如限制在 10年以内，防止溢出)
      if (num > 3650) {
        return alert(`❌ 输入错误："${s}" 太大了，建议不要超过 3650 天`);
      }
      
      newIntervals.push(num);
    }

    if (newIntervals.length === 0) {
      return alert("❌ 至少需要设置一个间隔时间！");
    }

    // --- 2. 校验倒退步数 ---
    if (formStep < 0) return alert("倒退步数不能小于 0");

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

// 8. 日历组件
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