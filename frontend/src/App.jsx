import React, { useState, useEffect,useMemo } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import './App.css'; 
import { MoreHorizontal, Check, X, Trash2, Edit2, Calendar as CalIcon , GraduationCap,History,Clock,ZapOff} from 'lucide-react';
import {Search,Database} from 'lucide-react';
import { api } from './api';

// // --- 默认设置 ---
// const DEFAULT_SETTINGS_DATA = {
//   // 存放所有的规则配置
//   profiles: [
//     { 
//       id: 'default_1', 
//       name: '默认算法', 
//       intervals: [1, 2, 4, 7, 15, 30], 
//       regressStep: 1,
//       graduationInterval: 0 // ★ 新增：0代表永不检查，大于0代表毕业后每隔多少天检查
//     },
//     { 
//       id: 'hard_mode', 
//       name: '魔鬼训练 (包含当日)', 
//       intervals: [0, 0, 1, 3, 7], // 0代表今天立刻再做一次
//       regressStep: 2 ,
//       graduationInterval: 0
//     }
//   ],
//   // 当前默认使用的规则 ID
//   defaultId: 'default_1'
// };

function App() {
  // 1. 用户状态
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('my_app_user');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null; // 防止解析错误导致白屏
    }
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

  const snoozeQuestion = (id, days = 1) => {
    setQuestions(prev => prev.map(q => {
      if (q.id !== id) return q;
      
      // 基于【今天】往后推，还是基于【原计划】往后推？
      // 通常是基于【今天】+ 1天，或者单纯把计划日期 + 1天
      // 这里采用：推迟到【明天】
      const newDate = dayjs().add(days, 'day').format('YYYY-MM-DD');
      
      return {
        ...q,
        nextReviewDate: newDate
      };
    }));
  };
  // 更新题目 (内容 或 规则)
  // ★★★ 修复版：修改题目内容或规则，并自动修正日期 ★★★
  const updateQuestion = (id, newContent, newSettingId) => {
    setQuestions(prev => prev.map(q => {
      if (q.id !== id) return q;

      if (q.settingId === newSettingId) {
        return { ...q, content: newContent };
      }

      const oldProfile = getProfileById(q.settingId);
      const newProfile = getProfileById(newSettingId);

      if (!oldProfile || !newProfile) {
        return { ...q, content: newContent, settingId: newSettingId };
      }

      // 1. 预判新的毕业状态
      const isNowGraduated = q.streak >= newProfile.intervals.length;

      // --- 2. 日期修正逻辑 (保持之前的状态感知逻辑) ---
      const getEffectiveInterval = (profile, streak, isGradState) => {
        if (isGradState) {
          return parseInt(profile.graduationInterval || 0);
        } else {
          const index = Math.min(streak, profile.intervals.length - 1);
          return profile.intervals[index] !== undefined ? profile.intervals[index] : 1;
        }
      };

      const valOld = getEffectiveInterval(oldProfile, q.streak, q.isGraduated);
      const valNew = getEffectiveInterval(newProfile, q.streak, isNowGraduated);
      const diff = valNew - valOld;

      let newDate = q.nextReviewDate;
      if (q.nextReviewDate === '🏁 已毕业') {
        if (!isNowGraduated || newProfile.graduationInterval > 0) {
           newDate = dayjs().format('YYYY-MM-DD');
        }
      } else if (diff !== 0) {
        newDate = dayjs(q.nextReviewDate).add(diff, 'day').format('YYYY-MM-DD');
      }

      // --- ★★★ 新增：历史记录修正 (History Rewrite) ★★★ ---
      let newHistory = q.history || [];

      // 如果发生了“复活” (从毕业 -> 未毕业)
      // 意味着以前所谓的“毕业”操作，现在看来只是普通的“做对”
      if (q.isGraduated && !isNowGraduated) {
        newHistory = newHistory.map(record => {
          if (record.result === 'graduated') {
            return { ...record, result: 'correct' }; // 紫色变绿色
          }
          return record;
        });
        console.log(`题目[${id}] 历史记录修正: 撤销毕业标记`);
      }

      return {
        ...q,
        content: newContent,
        settingId: newSettingId,
        nextReviewDate: newDate,
        isGraduated: isNowGraduated,
        history: newHistory // 更新历史
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
      // 1. 找到当前操作的题目
      if (q.id !== id) return q;

      // 2. 获取该题目的规则配置
      const profile = getProfileById(q.settingId);
      
      // 安全获取参数，防止 undefined
      const gradInterval = parseInt(profile.graduationInterval || 0); // 毕业维保天数
      const regressStep = parseInt(profile.regressStep || 1);         // 做错倒退步数
      const tolerance = profile.overdueTolerance === undefined ? 999 : parseInt(profile.overdueTolerance); // 逾期容忍
      const intervals = profile.intervals;

      // --- 核心逻辑 A: 计算逾期惩罚 (Effective Streak) ---
      const today = dayjs();
      const scheduledDate = dayjs(q.nextReviewDate);
      
      // 计算迟到了几天 (今天 - 计划日期)
      const overdueDays = today.diff(scheduledDate, 'day');

      // 计算"有效等级"：如果非毕业且逾期严重，先扣一级作为惩罚
      let effectiveStreak = q.streak;
      
      if (!q.isGraduated && overdueDays > tolerance) {
        effectiveStreak = Math.max(0, effectiveStreak - 1);
        console.log(`题目[${q.content}] 逾期 ${overdueDays} 天，触发惩罚，等级 ${q.streak} -> ${effectiveStreak}`);
      }

      // --- 核心逻辑 B: 根据对错计算新等级 ---
      let newStreak = effectiveStreak;
      
      if (isCorrect) {
        newStreak = newStreak + 1; // 做对升级
      } else {
        // 做错倒退 (在有效等级的基础上倒退)
        newStreak = Math.max(0, newStreak - regressStep);
      }

      // --- 核心逻辑 C: 判断是否毕业 ---
      // 只要新等级超过了规则数组的长度，就算毕业
      const isNowGraduated = newStreak >= intervals.length;

      // --- 核心逻辑 D: 计算下一次复习日期 ---
      let nextDate = '';
      
      if (isNowGraduated) {
        // 情况 1: 毕业状态 (刚毕业 或 维保抽查通过)
        if (gradInterval > 0) {
          // 开启了维保：安排在 N 天后
          nextDate = today.add(gradInterval, 'day').format('YYYY-MM-DD');
        } else {
          // 没开启维保：永久退休
          nextDate = '🏁 已毕业';
        }
      } else {
        // 情况 2: 还在学习中 (或者毕业抽查翻车被打回)
        // 防止数组越界
        const intervalIndex = Math.min(newStreak, intervals.length - 1);
        // 获取间隔天数 (如果配置是0，就是0)
        const daysToAdd = intervals[intervalIndex] !== undefined ? intervals[intervalIndex] : 1;
        
        // 基于【今天】往后推 daysToAdd 天
        nextDate = today.add(daysToAdd, 'day').format('YYYY-MM-DD');
      }

      // --- 核心逻辑 E: 记录历史轨迹 ---
      let resultType = 'correct'; // 默认为绿色
      if (!isCorrect) {
        resultType = 'wrong';     // 红色
      } else if (isNowGraduated) {
        // 如果这次操作导致了毕业，或者是毕业后的维保成功，都算紫色
        resultType = 'graduated'; 
      }

      const newHistoryRecord = {
        date: today.format('YYYY-MM-DD'),
        result: resultType,
        streakAfter: newStreak
      };

      // 返回更新后的题目对象
      return {
        ...q,
        streak: newStreak,          // 更新等级
        nextReviewDate: nextDate,   // 更新日期
        isGraduated: isNowGraduated,// 更新毕业状态
        history: [...(q.history || []), newHistoryRecord] // 追加历史
      };
    }));
  };

  // 登录退出
  const login = (userData) => {
    setUser({ ...userData, avatar: '👤' });
  };
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
                onSnooze={snoozeQuestion} 
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
      <div className="logo">延时记 🧠</div>
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
function HomePage({ questions, onAdd, onReview, onDelete, onUpdate, settings, getProfileById, onSnooze }) {
  const [inputContent, setInputContent] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState(settings.defaultId);
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  
  // 编辑模态框的状态
  const [editingQ, setEditingQ] = useState(null); // 当前正在编辑的题目对象

  const today = dayjs().format('YYYY-MM-DD');
  const isFutureView = selectedDate > today;

  const reviewsDue = questions.filter(q => {
    const profile = getProfileById(q.settingId);
    
    // --- 筛选逻辑修改 ---
    // 1. 如果是“永久毕业”状态 (日期字符串是🏁)，永远不显示
    if (q.nextReviewDate === '🏁 已毕业') return false;

    // 2. 如果是普通毕业 (有具体日期)，且日期到了，必须显示！
    // 3. 如果是未毕业，且日期到了，必须显示！
    
    // 简单来说，只要日期有效，且符合 selectedDate，就显示。
    // 不再单纯依据 isGraduated 暴力过滤。
    
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
                onSnooze={onSnooze}
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
  getProfileById, 
  onSnooze,
  readOnly = false 
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  
  const profile = getProfileById ? getProfileById(question.settingId) : null;
  const profileName = profile?.name || '默认规则';
  
  // 毕业预判
  const isNextGraduation = profile && profile.intervals && (question.streak + 1 >= profile.intervals.length);

  // 样式
  const cardClass = `review-item ${question.isGraduated ? 'graduated-style' : ''}`;
  const cardStyle = question.isGraduated 
    ? { background: '#faf5ff', borderColor: '#e9d5ff' } 
    : {};

  // 历史数据处理
  const history = question.history || [];
  const firstDate = history.length > 0 ? dayjs(history[0].date) : dayjs(question.id);

  const renderHistoryTags = () => {
    return history.map((record, index) => {
      const diffDays = dayjs(record.date).diff(firstDate, 'day');
      const displayDay = diffDays >= 0 ? diffDays : 0;
      return (
        <span key={index} className={`history-tag ${record.result}`} title={`${record.date} (${record.result})`}>
          D{displayDay}
        </span>
      );
    });
  };

  // ★★★ 关键判断：当前是否显示操作按钮？ ★★★
  // 条件：非只读 且 非未来 且 (未毕业 或者 虽然毕业但今天需要抽查)
  // 注意：原来的逻辑是 !readOnly && !isFuture && !question.isGraduated
  // 但我们之前改过逻辑，只要出现在今日列表里，即使是毕业抽查也要显示按钮。
  // 所以这里简化判断：只要不是只读且不是未来预览，就认为有操作区。
  const hasActions = !readOnly && !isFuture;

  // ★★★ 提取历史按钮 JSX (避免重复写代码) ★★★
  const HistoryButton = (
    <button 
      className={`btn-toggle-history ${showHistory ? 'active' : ''}`}
      onClick={() => setShowHistory(!showHistory)}
      title="查看复习历史"
    >
      <History size={14} /> 
      {/* 这里的数字即使变成 100次 也能自适应显示了 */}
      {history.length > 0 ? `${history.length}次` : '新题'}
    </button>
  );

  return (
    <div className={cardClass} style={cardStyle} onMouseLeave={() => setShowMenu(false)}>
      
      {/* 菜单按钮 */}
      <button className="more-btn" onClick={() => setShowMenu(!showMenu)}>
        <MoreHorizontal size={20} />
      </button>

      {showMenu && (
        <div className="menu-dropdown">
          <div className="menu-item" onClick={() => { onEdit(); setShowMenu(false); }}>
            <Edit2 size={16} /> 编辑 / 改规则
          </div>
          {!readOnly && !isFuture && (
            <div className="menu-item" onClick={() => { 
                onSnooze(question.id, 1); // 调用推迟函数
                setShowMenu(false); 
            }}>
              <Clock size={16} /> 推迟 1 天
            </div>
          )}
          <div className="menu-item delete" onClick={() => { 
             if(window.confirm('确定要彻底删除这个错题档案吗？此操作无法撤销。')) {
               onDelete(); 
             }
             setShowMenu(false); 
          }}>
            <Trash2 size={16} /> 彻底删除
          </div>
        </div>
      )}

      {/* 内容 */}
      <div className="review-content" style={{whiteSpace: 'pre-wrap'}}>
        {question.content}
      </div>

      {/* 底部栏 */}
      <div className="review-footer">
        
        {/* --- 左侧区域 --- */}
        <div className="footer-info">
          
          {/* 1. 华丽等级 */}
          <span className={`rank-badge ${getLevelClassName(question.streak)}`}>
            Lv.{question.streak}
          </span>

          {/* 2. 毕业/抽查辅助标签 */}
          {question.isGraduated && (
            <span className="mini-tag" style={{
              background: '#f3e8ff', color: '#702963', fontWeight: 'bold', 
              display: 'flex', alignItems: 'center', gap:'3px', border: '1px solid rgba(112, 41, 99, 0.1)'
            }}>
              <GraduationCap size={12}/> {readOnly ? '毕业' : '抽查'}
            </span>
          )}
          
          {/* 3. 规则名称 */}
          <span className="mini-tag">{profileName}</span>

          {/* ★★★ 布局逻辑 A：如果有操作按钮，历史按钮放在左边，贴着规则 ★★★ */}
          {hasActions && HistoryButton}

        </div>

        {/* --- 右侧区域 --- */}
        <div style={{display:'flex', gap:'12px', alignItems:'center'}}>
          
          {/* ★★★ 布局逻辑 B：如果没有操作按钮，历史按钮放在右边 ★★★ */}
          {!hasActions && HistoryButton}

          {/* 操作按钮组 */}
          {hasActions && (
            <div className="action-row">
               <button className="icon-btn btn-forgot" onClick={() => onReview(question.id, false)}>
                  <X size={24} strokeWidth={3} />
               </button>
               {isNextGraduation ? (
                  <button className="icon-btn btn-graduate" onClick={() => onReview(question.id, true)}>
                    <GraduationCap size={24} strokeWidth={3} />
                  </button>
               ) : (
                  <button className="icon-btn btn-remember" onClick={() => onReview(question.id, true)}>
                    <Check size={24} strokeWidth={3} />
                  </button>
               )}
            </div>
          )}
        </div>

      </div>

      {/* 历史记录展开区 */}
      {showHistory && (
        <div className="history-section">
          <span className="history-label">
            <Clock size={12} style={{marginRight:'4px', verticalAlign:'text-bottom'}}/>
            记忆轨迹 (起始日: {firstDate.format('YYYY-MM-DD')})
          </span>
          <div className="history-tags-wrapper">
            {renderHistoryTags()}
            {history.length === 0 && <span style={{fontSize:'0.8rem', color:'#ccc'}}>暂无复习记录</span>}
          </div>
        </div>
      )}
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
  const [password, setPassword] = useState(""); // 新增密码状态
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !password) return alert("请输入账号密码");

    try {
      // ★ 调用后端接口
      const data = await api.post('/login', { username: name, password: password });
      
      // 1. 存 Token (这是以后访问数据的钥匙)
      localStorage.setItem('token', data.token);
      
      // 2. 告诉 App 我登录了
      onLogin(data.user);
      
      alert('欢迎回来！');
      navigate('/');
    } catch (err) {
      alert(`登录失败: ${err.message}`);
    }
  };

  return (
    <div className="page-center-wrapper">
      <div className="card" style={{width: '100%', maxWidth: '400px', margin: '0 auto'}}>
        <h2 style={{textAlign: 'center'}}>👋 登录</h2>
        <form onSubmit={handleSubmit}>
          <div style={{marginBottom: '15px'}}>
            <label>用户名</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div style={{marginBottom: '15px'}}>
            <label>密码</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <button type="submit" className="btn-primary">立即登录</button>
        </form>
        <p style={{textAlign:'center', marginTop:'15px'}}>
          没有账号? <Link to="/register">去注册</Link>
        </p>
      </div>
    </div>
  );
}

// 5. 注册页
function RegisterPage() {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !password) return alert("请输入完整");

    try {
      // ★ 调用注册接口
      await api.post('/register', { username: name, password: password });
      
      alert('注册成功！请登录');
      navigate('/login'); // 跳去登录页
    } catch (err) {
      alert(`注册失败: ${err.message}`);
    }
  };

  return (
    <div className="page-center-wrapper">
      <div className="card" style={{width: '100%', maxWidth: '400px', margin: '0 auto'}}>
        <h2 style={{textAlign: 'center'}}>🚀 创建账号</h2>
        <form onSubmit={handleSubmit}>
          <div style={{marginBottom: '15px'}}>
            <label>用户名</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div style={{marginBottom: '15px'}}>
            <label>密码</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <button type="submit" className="btn-primary">注册</button>
        </form>
      </div>
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

          {/* <h3>🔥 贡献热力图 (模拟)</h3>
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
          </div> */}

          {/* <div style={{marginTop: '30px'}}>
             <h3>📥 数据管理</h3>
             <button className="btn-outline">导出所有数据 (JSON)</button>
          </div> */}
        </div>

      </div>
    </div>
  );
}

// 7. 设置页
// src/App.jsx -> SettingsPage 组件 (完整版)

function SettingsPage({ settings, setSettings, questions, setQuestions }) {
  const [activeId, setActiveId] = useState(settings.profiles[0].id);
  const activeProfile = settings.profiles.find(p => p.id === activeId) || settings.profiles[0];
  
  // 表单状态
  const [formName, setFormName] = useState(activeProfile.name);
  const [formIntervals, setFormIntervals] = useState(activeProfile.intervals.join(','));
  const [formStep, setFormStep] = useState(activeProfile.regressStep);
  // ★ 新增：维保间隔状态
  const [formGradInterval, setFormGradInterval] = useState(activeProfile.graduationInterval || 0);
  const [formTolerance, setFormTolerance] = useState(activeProfile.overdueTolerance === undefined ? 999 : activeProfile.overdueTolerance);
  // 切换规则时，同步表单数据
  
  useEffect(() => {
    setFormName(activeProfile.name);
    setFormIntervals(activeProfile.intervals.join(','));
    setFormStep(activeProfile.regressStep);
    setFormGradInterval(activeProfile.graduationInterval || 0);
    setFormTolerance(activeProfile.overdueTolerance === undefined ? 999 : activeProfile.overdueTolerance);
  }, [activeProfile]);

  const handleAddProfile = () => {
    let baseName = "新规则";
    let newName = baseName;
    let counter = 1;

    // 循环检查：如果名字已存在，就一直加序号，直到找到一个没被占用的
    while (settings.profiles.some(p => p.name === newName)) {
      newName = `${baseName} ${counter}`;
      counter++;
    }

    const newId = `custom_${Date.now()}`;
    const newProfile = {
      id: newId,
      name: newName, // 使用计算出的不重复名字
      intervals: [1, 3, 7],
      regressStep: 1,
      graduationInterval: 0
    };
    
    setSettings({ ...settings, profiles: [...settings.profiles, newProfile] });
    setActiveId(newId); // 自动跳转到新规则
  };

  const handleSave = () => {
    
    // 1. 校验名称 (去重逻辑)
    const trimmedName = formName.trim();
    if (!trimmedName) return alert("❌ 规则名称不能为空");

    // 检查是否有别的人用了这个名字 (排除掉自己)
    const isDuplicate = settings.profiles.some(p => p.name === trimmedName && p.id !== activeId);
    if (isDuplicate) {
      return alert(`❌ 名称重复：已存在名为 "${trimmedName}" 的规则，请换一个名字。`);
    }

    // 2. 校验间隔序列
    const rawIntervals = formIntervals.split(/[,，\s]+/);
    const newIntervals = [];
    for (let s of rawIntervals) {
      if (!s.trim()) continue;
      const num = Number(s);
      if (isNaN(num) || num < 0) return alert(`❌ 间隔输入错误："${s}" 无效`);
      newIntervals.push(num);
    }
    if (newIntervals.length === 0) return alert("❌ 需至少一个间隔");

    // 3. 校验毕业维保
    const gradInt = parseInt(formGradInterval);
    if (isNaN(gradInt) || gradInt < 0) return alert("❌ 毕业检查间隔无效");
    
    const tol = parseInt(formTolerance);
    if (isNaN(tol) || tol < 0) return alert("❌ 逾期容忍天数无效");
    // --- 4. 更新 Settings 数据 ---
    const updatedProfiles = settings.profiles.map(p => {
      if (p.id === activeId) {
        return {
          ...p,
          name: trimmedName,
          intervals: newIntervals,
          regressStep: formStep,
          graduationInterval: gradInt,
          overdueTolerance: tol
        };
      }
      return p;
    });

    // --- 5. 更新 Questions 数据 (全量清洗) ---
    // 准备旧数据对象，用于计算差值
    const oldProfile = activeProfile;
    // 准备新数据对象
    const newProfile = { intervals: newIntervals, graduationInterval: gradInt };

    const updatedQuestions = questions.map(q => {
      // 只处理属于当前规则的题
      if (q.settingId !== activeId) return q;

      // A. 预判新的毕业状态
      const isNowGraduated = q.streak >= newIntervals.length;

      // B. 计算时差 (复用状态感知逻辑)
      const getEffectiveInterval = (profile, streak, isGradState) => {
        if (isGradState) {
          return parseInt(profile.graduationInterval || 0);
        } else {
          const index = Math.min(streak, profile.intervals.length - 1);
          return profile.intervals[index] !== undefined ? profile.intervals[index] : 1;
        }
      };

      const valOld = getEffectiveInterval(oldProfile, q.streak, q.isGraduated);
      const valNew = getEffectiveInterval(newProfile, q.streak, isNowGraduated);
      const diff = valNew - valOld;

      // C. 应用日期平移
      let newDate = q.nextReviewDate;
      if (q.nextReviewDate === '🏁 已毕业') {
         // 兼容旧数据：如果复活了，重置为今天
         if (!isNowGraduated || gradInt > 0) newDate = dayjs().format('YYYY-MM-DD');
      } else if (diff !== 0) {
         newDate = dayjs(q.nextReviewDate).add(diff, 'day').format('YYYY-MM-DD');
      }

      // D. 历史记录修正 (紫色变绿色)
      let newHistory = q.history || [];
      if (q.isGraduated && !isNowGraduated) {
        newHistory = newHistory.map(record => {
          if (record.result === 'graduated') {
            return { ...record, result: 'correct' }; // 褪色处理
          }
          return record;
        });
      }

      return {
        ...q,
        nextReviewDate: newDate,
        isGraduated: isNowGraduated,
        history: newHistory
      };
    });

    // 提交所有更改
    setSettings({ ...settings, profiles: updatedProfiles });
    setQuestions(updatedQuestions);
    alert("✅ 规则已更新");
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
              <label style={{display:'block', marginBottom:'5px', fontSize:'0.9rem'}}>间隔序列 (0代表当天出现)</label>
              <input type="text" value={formIntervals} onChange={e => setFormIntervals(e.target.value)} />
            </div>

            <div style={{marginBottom: '20px'}}>
              <label style={{display:'block', marginBottom:'5px', fontSize:'0.9rem'}}>
                遗忘倒退级数: {formStep === 0 ? '0 (不倒退)' : `${formStep} 级`}
              </label>
              <input 
                type="range" min="0" max="5" 
                value={formStep} 
                onChange={e => setFormStep(parseInt(e.target.value))} 
                style={{width: '100%'}}
              />
            </div>

            {/* ★★★ 新增的 UI 区域：毕业维保 ★★★ */}
            <div style={{marginBottom: '25px', padding: '15px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0'}}>
              <label style={{display:'block', marginBottom:'8px', fontWeight:'bold', fontSize:'0.9rem', color: '#4f46e5'}}>
                🛡️ 毕业抽查设置
              </label>
              <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
                 <input 
                    type="number" min="0" 
                    value={formGradInterval}
                    onChange={e => setFormGradInterval(e.target.value)}
                    style={{width: '100px', marginBottom:0, textAlign: 'center'}}
                 />
                 <span style={{fontSize:'0.85rem', color:'#666', lineHeight: '1.4'}}>
                   {formGradInterval == 0 
                     ? '关闭 (毕业后永久不再出现)' 
                     : `开启 (毕业后，每隔 ${formGradInterval} 天自动抽查一次)`}
                 </span>
              </div>
            </div>

            <div style={{marginBottom: '20px'}}>
              <label style={{display:'block', marginBottom:'5px', fontSize:'0.9rem'}}>
                逾期惩罚 (超过几天未复习自动降级？)
              </label>
              <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                <input 
                    type="number" min="0" 
                    value={formTolerance}
                    onChange={e => setFormTolerance(e.target.value)}
                    style={{width: '100px', marginBottom:0}}
                />
                <span style={{fontSize:'0.85rem', color:'#666'}}>
                  {formTolerance >= 365 ? '关闭 (逾期不降级)' : `超过 ${formTolerance} 天未复习，等级自动 -1`}
                </span>
              </div>
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
  
  // 1. 安全检查：如果没有日期或规则，直接返回
  if (!question.nextReviewDate || !profile) return dates;
  if (question.nextReviewDate === '🏁 已毕业') return dates; // 兼容旧数据

  let currentDateObj = dayjs(question.nextReviewDate);
  dates.add(currentDateObj.format('YYYY-MM-DD')); // 加入当前这一个确定的点

  // 获取规则参数
  const intervals = profile.intervals;
  const gradInterval = parseInt(profile.graduationInterval || 0);
  
  // 模拟状态
  let tempStreak = question.streak;
  let isGraduated = question.isGraduated; // 初始状态可能已经是毕业

  // 设定“视距”：为了性能，只预测未来 2年 或 50次复习
  const LIMIT_DATE = dayjs().add(2, 'year');
  const MAX_STEPS = 50;

  for (let i = 0; i < MAX_STEPS; i++) {
    // 如果日期已经超出了2年，停止计算（没人会翻到2年后去复习日历）
    if (currentDateObj.isAfter(LIMIT_DATE)) break;

    let daysToAdd = 0;

    // --- 分支逻辑 ---
    
    if (isGraduated) {
      // 状态 A: 已经在毕业维保期
      if (gradInterval > 0) {
        daysToAdd = gradInterval; // 无限循环这个间隔
      } else {
        break; // 没开启维保，预测结束
      }
    } else {
      // 状态 B: 还在升级路上
      tempStreak++;
      
      // 检查这次升级后是否毕业
      if (tempStreak >= intervals.length) {
        isGraduated = true; // 标记为毕业，下次循环进入状态 A
        
        if (gradInterval > 0) {
          daysToAdd = gradInterval; // 毕业后的第一顿维保
        } else {
          break; // 毕业即死
        }
      } else {
        // 还没毕业，查表取间隔
        daysToAdd = intervals[tempStreak];
      }
    }

    // 计算下一个日期
    currentDateObj = currentDateObj.add(daysToAdd, 'day');
    dates.add(currentDateObj.format('YYYY-MM-DD'));
  }

  return dates;
};

// 8. 日历组件
function Calendar({ questions, selectedDate, onDateSelect, getProfileById }) {
  const [currentDate, setCurrentDate] = useState(dayjs(selectedDate));

  // 预测算法：现在必须对每道题分别查找它的规则
  const taskMap = useMemo(() => {
    // console.time("CalendarCalc"); // 调试性能用
    const map = new Set();
    
    questions.forEach(q => {
      const profile = getProfileById ? getProfileById(q.settingId) : null;
      if (profile) {
        // 这里调用刚才升级过的算法
        const timeline = calculateTimeline(q, profile);
        timeline.forEach(date => map.add(date));
      }
    });
    
    // console.timeEnd("CalendarCalc");
    return map;
  }, [questions, getProfileById]); // 依赖项

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

const getLevelClassName = (streak) => {
    if (streak < 3) return 'rank-stone';   // Lv.0 - 2 (原石)
    if (streak < 6) return 'rank-bronze';  // Lv.3 - 5 (青铜)
    if (streak < 10) return 'rank-silver'; // Lv.6 - 9 (白银)
    if (streak < 15) return 'rank-gold';   // Lv.10 - 14 (黑金)
    return 'rank-diamond';                 // Lv.15+ (璀璨钻石)
};

// src/App.jsx 放到文件最下方

// --- 补上缺失的 EditModal 组件 ---
function EditModal({ question, settings, onClose, onSave }) {
  const [content, setContent] = useState(question.content);
  // 这里加个 safe check，防止 question.settingId 为空导致崩溃
  const [settingId, setSettingId] = useState(question.settingId || settings.defaultId);

  const handleSave = () => {
    // 调用父组件传下来的保存函数
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
          style={{width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd'}}
        />

        <label style={{display:'block', marginBottom:'5px', color:'#666', fontSize:'0.9rem', marginTop:'15px'}}>复习规则</label>
        <select 
          value={settingId} 
          onChange={e => setSettingId(e.target.value)}
          style={{width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd'}}
        >
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

export default App;