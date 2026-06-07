'use client';

import React, { useState, useEffect } from 'react';

// ================= TYPE DEFINITIONS =================
interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  height: string;
  weight: string;
  birthDate: string;
}

interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  sessionName: string;
  type: string;
  date: string;
  detail: string;
  xp: number;
  reps: number;
  sets: number;
  duration: number;
  distance: number;
}

export default function Page() {
  // State navigasi
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'profile' | 'auth'>('dashboard');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [historyView, setHistoryView] = useState<'ringkasan' | 'detail'>('detail');

  // Authentication State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  // Form State
  const [sessionName, setSessionName] = useState('');
  const [exerciseType, setExerciseType] = useState('Push Up');
  const [reps, setReps] = useState('');
  const [sets, setSets] = useState('');
  const [distance, setDistance] = useState('');
  const [duration, setDuration] = useState('');

  // Auth Form State
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');

  // Global Community Data State (Synced from MongoDB)
  const [allActivities, setAllActivities] = useState<ActivityLog[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);

  // ================= REFRESH DATA DARI MONGODB =================
  const refreshDataFromDatabase = async () => {
    try {
      const res = await fetch('/api/data');
      const data = await res.json();
      if (data.activities) setAllActivities(data.activities);
      if (data.users) setAllUsers(data.users);
    } catch (err) {
      console.error("Gagal melakukan sinkronisasi dengan MongoDB:", err);
    }
  };

  useEffect(() => {
    // Sesi login lokal tetap disimpan agar tidak ter-logout saat refresh page
    const savedSession = localStorage.getItem('fitpoin_current_user');
    if (savedSession) setCurrentUser(JSON.parse(savedSession));

    // Ambil data terbaru dari cloud MongoDB
    refreshDataFromDatabase();
  }, []);

  // ================= AUTH LOGIC (SINKRONISASI MONGODB) =================
  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (authMode === 'register') {
      if (authPassword !== authConfirmPassword) return alert('Konfirmasi password tidak cocok!');
      if (allUsers.some(u => u.email === authEmail)) return alert('Email sudah terdaftar!');

      const newUser: UserProfile = { id: 'usr_' + Date.now(), fullName: authName, email: authEmail, height: '', weight: '', birthDate: '' };
      
      fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'register', user: newUser })
      })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal registrasi');
        alert('Registrasi berhasil disimpan ke MongoDB! Silakan login.');
        refreshDataFromDatabase();
        setAuthMode('login');
        setAuthPassword('');
      })
      .catch(err => alert(err.message));
    } else {
      const foundUser = allUsers.find(u => u.email === authEmail);
      if (!foundUser) return alert('Email tidak ditemukan atau database belum sinkron!');
      setCurrentUser(foundUser);
      localStorage.setItem('fitpoin_current_user', JSON.stringify(foundUser));
      setActiveTab('dashboard');
    }
  };

  // DIRECT DEMO LOGIN
  const handleDemoLogin = () => {
    const demoUser: UserProfile = {
      id: 'usr_demo_atlet',
      fullName: 'Bagas Atlet Demo',
      email: 'demo@fitpoin.com',
      height: '175',
      weight: '70',
      birthDate: '1999-08-17'
    };

    fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'register', user: demoUser })
    }).then(() => {
      setCurrentUser(demoUser);
      localStorage.setItem('fitpoin_current_user', JSON.stringify(demoUser));
      setActiveTab('dashboard');
      refreshDataFromDatabase();
      alert('Berhasil masuk menggunakan Akun Demo!');
    }).catch(() => {
      setCurrentUser(demoUser);
      localStorage.setItem('fitpoin_current_user', JSON.stringify(demoUser));
      setActiveTab('dashboard');
      refreshDataFromDatabase();
    });
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('fitpoin_current_user');
    setActiveTab('dashboard');
  };

  // ================= UPDATE PROFIL KEMBALI KE MONGODB =================
  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_profile', user: currentUser })
    })
    .then(res => {
      if (!res.ok) throw new Error('Gagal memperbarui profil di server');
      localStorage.setItem('fitpoin_current_user', JSON.stringify(currentUser));
      refreshDataFromDatabase();
      alert('Profil berhasil diperbarui di MongoDB!');
    })
    .catch(err => alert(err.message));
  };

  // ESTIMASI XP LOGIC
  const calculateXP = () => {
    if (['Push Up', 'Sit Up', 'Pull Up', 'Squat'].includes(exerciseType)) return (parseInt(reps) || 0) * (parseInt(sets) || 0) * 0.5; 
    if (exerciseType === 'Plank') return (parseInt(duration) || 0) * 10;
    if (exerciseType === 'Perfect Run') return Math.floor((parseFloat(distance) || 0) * 50);
    return 0;
  };
  const currentXP = calculateXP();

  // ================= SIMPAN AKTIVITAS BARU/AKUMULASI KE MONGODB =================
  const handleSaveActivity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      alert('Harap login terlebih dahulu!');
      setActiveTab('auth'); setAuthMode('login'); return;
    }
    if (!sessionName.trim()) return alert('Nama sesi latihan harus diisi!');

    let targetActivity: ActivityLog;
    const existingIndex = allActivities.findIndex(a => a.userId === currentUser.id && a.type === exerciseType);

    if (existingIndex !== -1) {
      const item = { ...allActivities[existingIndex] };
      item.reps += parseInt(reps) || 0;
      item.sets += parseInt(sets) || 0;
      item.duration += parseInt(duration) || 0;
      item.distance += parseFloat(distance) || 0;
      item.xp += currentXP;
      item.date = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + ', ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      item.sessionName = sessionName; 
      
      if (['Push Up', 'Sit Up', 'Pull Up', 'Squat'].includes(exerciseType)) item.detail = `${item.reps} reps × ${item.sets} set`;
      else if (exerciseType === 'Plank') item.detail = `${item.duration} menit`;
      else if (exerciseType === 'Perfect Run') item.detail = `${item.distance} KM • ${item.duration} menit`;
      
      targetActivity = item;
    } else {
      let detailString = '';
      if (['Push Up', 'Sit Up', 'Pull Up', 'Squat'].includes(exerciseType)) detailString = `${reps || 0} reps × ${sets || 0} set`;
      else if (exerciseType === 'Plank') detailString = `${duration || 0} menit`;
      else if (exerciseType === 'Perfect Run') detailString = `${distance || 0} KM • ${duration || 0} menit`;

      targetActivity = {
        id: Date.now().toString(),
        userId: currentUser.id,
        userName: currentUser.fullName,
        sessionName: sessionName,
        type: exerciseType,
        date: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + ', ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        detail: detailString,
        xp: currentXP,
        reps: parseInt(reps) || 0,
        sets: parseInt(sets) || 0,
        duration: parseInt(duration) || 0,
        distance: parseFloat(distance) || 0
      };
    }

    fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_activity', activity: targetActivity })
    })
    .then(res => {
      if (!res.ok) throw new Error('Gagal menyimpan aktivitas latihan');
      setSessionName(''); setReps(''); setSets(''); setDistance(''); setDuration('');
      refreshDataFromDatabase();
      alert('Aktivitas berhasil disimpan dan disinkronkan ke MongoDB!');
    })
    .catch(err => alert(err.message));
  };

  // HAPUS AKTIVITAS DARI MONGODB
  const handleDeleteActivity = (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus log aktivitas latihan ini dari database cloud?')) return;
    
    fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_activity', id: id })
    })
    .then(res => {
      if (!res.ok) throw new Error('Gagal menghapus log dari database');
      refreshDataFromDatabase();
      alert('Aktivitas berhasil dihapus dari MongoDB!');
    })
    .catch(err => alert(err.message));
  };

  // PROGRESS TARGET
  const getProgress = (type: string) => {
    if (!currentUser) return 0;
    const acts = allActivities.filter(a => a.userId === currentUser.id && a.type === type);
    if (['Push Up', 'Sit Up', 'Pull Up', 'Squat'].includes(type)) return acts.reduce((acc, curr) => acc + (curr.reps * curr.sets), 0);
    if (type === 'Plank') return acts.reduce((acc, curr) => acc + curr.duration, 0);
    if (type === 'Perfect Run') return acts.length; 
    return 0;
  };

  const targets = [
    { key: 'Push Up', icon: '💪', name: 'Push Ups', max: 50, unit: 'reps', color: 'bg-orange-100' },
    { key: 'Sit Up', icon: '🧘', name: 'Sit Ups', max: 50, unit: 'reps', color: 'bg-teal-100' },
    { key: 'Pull Up', icon: '🏋️', name: 'Pull Ups', max: 10, unit: 'reps', color: 'bg-indigo-100' },
    { key: 'Squat', icon: '🦵', name: 'Squat', max: 50, unit: 'reps', color: 'bg-yellow-100' },
    { key: 'Plank', icon: '⚡', name: 'Plank', max: 1, unit: 'menit', color: 'bg-red-100' },
    { key: 'Perfect Run', icon: '🏃', name: 'Perfect Run', max: 1, unit: 'sesi', color: 'bg-blue-100' },
  ];
  
  const doneTargets = targets.filter(t => getProgress(t.key) >= t.max).length;
  const totalPercent = Math.min(Math.floor((doneTargets / targets.length) * 100), 100);

  // KLASEMEN LIGA GLOBAL (MONGODB LIVE SYNC)
  const leaderboard = allUsers.map(u => ({
    id: u.id, name: u.fullName, xp: allActivities.filter(a => a.userId === u.id).reduce((acc, curr) => acc + curr.xp, 0)
  })).sort((a, b) => b.xp - a.xp).filter(u => u.xp > 0);

  const myActivities = currentUser ? allActivities.filter(a => a.userId === currentUser.id) : [];
  const myTotalXp = myActivities.reduce((acc, curr) => acc + curr.xp, 0);

  // ================= UI RENDER =================
  if (activeTab === 'auth') {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center items-center px-4 font-sans text-slate-800">
        <div className="w-full max-w-md mb-4">
          <button onClick={() => setActiveTab('dashboard')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition font-medium">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Kembali ke Dashboard
          </button>
        </div>

        <div className="bg-white w-full max-w-md p-8 rounded-2xl border border-gray-200 shadow-sm">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">FIT<span className="text-[#FF5722]">POIN</span></h1>
            <p className="text-sm text-gray-500 mt-2">Platform Tracking Latihan Fisik</p>
          </div>

          <div className="flex bg-gray-100 p-1 rounded-lg mb-6">
            <button onClick={() => setAuthMode('login')} className={`flex-1 py-2 text-sm font-semibold rounded-md transition ${authMode === 'login' ? 'bg-white shadow-sm text-[#FF5722]' : 'text-gray-500 hover:text-gray-800'}`}>
              Login
            </button>
            <button onClick={() => setAuthMode('register')} className={`flex-1 py-2 text-sm font-semibold rounded-md transition ${authMode === 'register' ? 'bg-white shadow-sm text-[#FF5722]' : 'text-gray-500 hover:text-gray-800'}`}>
              Register
            </button>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-5">
            {authMode === 'register' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
                <input type="text" required value={authName} onChange={(e) => setAuthName(e.target.value)} placeholder="Masukkan nama lengkap" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5722]/20"/>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" required value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="contoh@email.com" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5722]/20"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input type="password" required value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder="••••••••" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5722]/20"/>
            </div>
            {authMode === 'register' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Konfirmasi Password</label>
                <input type="password" required value={authConfirmPassword} onChange={(e) => setAuthConfirmPassword(e.target.value)} placeholder="••••••••" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5722]/20"/>
              </div>
            )}
            <button type="submit" className="w-full bg-[#FF5722] hover:bg-[#E64A19] text-white font-bold py-3.5 rounded-lg transition shadow-sm mt-2">
              {authMode === 'login' ? 'Login' : 'Daftar Sekarang'}
            </button>
          </form>

          <div className="relative flex py-4 items-center">
            <div className="flex-grow border-t border-gray-200"></div>
            <span className="flex-shrink mx-4 text-gray-400 text-xs uppercase font-medium">Atau</span>
            <div className="flex-grow border-t border-gray-200"></div>
          </div>
          <button type="button" onClick={handleDemoLogin} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold py-3 rounded-lg transition shadow-sm flex items-center justify-center gap-2 text-sm">
            ⚡ Gunakan Akun Demo (Direct)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-800 pb-10">
      {/* NAVBAR */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FF5722" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
          <span className="text-xl font-bold tracking-tight text-gray-900">FIT<span className="text-gray-600">POIN</span></span>
        </div>
        
        <div className="hidden md:flex items-center gap-2 text-sm font-medium bg-gray-50 p-1 rounded-lg border border-gray-100">
          <button onClick={() => setActiveTab('dashboard')} className={`flex items-center gap-2 px-4 py-2 rounded-md transition ${activeTab === 'dashboard' ? 'bg-[#FF5722] text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg> Dashboard
          </button>
          <button onClick={() => setActiveTab('history')} className={`flex items-center gap-2 px-4 py-2 rounded-md transition ${activeTab === 'history' ? 'bg-[#FF5722] text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/></svg> Histori
          </button>
          <button onClick={() => { if (!currentUser) { setActiveTab('auth'); } else { setActiveTab('profile'); } }} className={`flex items-center gap-2 px-4 py-2 rounded-md transition ${activeTab === 'profile' ? 'bg-[#FF5722] text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Profil
          </button>
        </div>

        <div className="flex items-center gap-4">
          {currentUser && <button onClick={handleLogout} className="text-sm font-semibold text-gray-500 hover:text-red-500 transition">Logout</button>}
          <button onClick={() => setActiveTab('auth')} className="bg-[#FF5722] hover:bg-[#E64A19] transition text-white text-sm font-semibold px-5 py-2.5 rounded-md shadow-sm">
            {currentUser ? 'Log Aktivitas' : 'Login'}
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 mt-8">
        
        {/* ================= DASHBOARD ================= */}
        {activeTab === 'dashboard' && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard title="Total Aktivitas" value={currentUser ? myActivities.length.toString() : "0"} unit="sesi" icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF5722" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>} bg="bg-orange-50"/>
              <StatCard title="Target Tercapai" value={currentUser ? `${totalPercent}` : "0"} unit="%" icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00C853" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>} bg="bg-green-50"/>
              <StatCard title="Total FitPoin" value={currentUser ? myTotalXp.toString() : "0"} unit="XP" icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#651FFF" strokeWidth="2"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>} bg="bg-indigo-50"/>
              <StatCard title="Streak Mingguan" value="0" unit="minggu" icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF1744" strokeWidth="2"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>} bg="bg-red-50"/>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                
                {/* Target Mingguan */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                  <div className="mb-6">
                    <h2 className="text-lg font-bold text-gray-900">Target Mingguan</h2>
                    <p className="text-sm text-gray-500 mt-1">Otomatis ter-reset setiap hari Senin jam 00:00</p>
                  </div>
                  <div className="space-y-6">
                    {targets.map(t => {
                      const prog = getProgress(t.key);
                      const pct = Math.min(Math.floor((prog / t.max) * 100), 100);
                      return <TargetItem key={t.key} icon={t.icon} name={t.name} progress={`${prog} / ${t.max} ${t.unit}`} percent={`${pct}%`} color={t.color} pctValue={pct}/>
                    })}
                  </div>
                  <div className="mt-8 pt-6 border-t border-gray-100">
                    <div className="flex justify-between text-sm font-semibold mb-2">
                      <span>Total Progress</span>
                      <span className="text-gray-500">{doneTargets} / {targets.length} Done</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 mb-1">
                      <div className="bg-[#FF5722] h-2 rounded-full transition-all" style={{ width: `${totalPercent}%` }}></div>
                    </div>
                    <div className="text-center text-xs text-gray-500 font-medium">{totalPercent}%</div>
                  </div>
                </div>

                {/* Linimasa */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                  <div className="mb-6">
                    <h2 className="text-lg font-bold text-gray-900">Linimasa Aktivitas Circle</h2>
                    <p className="text-sm text-gray-500 mt-1">Lihat aktivitas terbaru dari komunitas (MongoDB cloud synced)</p>
                  </div>
                  <div className="space-y-4 max-h-[600px] overflow-y-auto">
                    {allActivities.length === 0 ? (
                      <div className="text-center py-6 text-gray-400 text-sm">Belum ada aktivitas di database. Mulai latihan pertama Anda!</div>
                    ) : (
                      allActivities.map((log) => (
                        <div key={log.id} className="border border-gray-100 rounded-lg p-4 shadow-sm bg-[#FCFDFE]">
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-full bg-[#FF5722] flex items-center justify-center text-white font-bold shrink-0 uppercase">
                              {log.userName ? log.userName.substring(0, 2) : 'FP'}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold text-gray-900 text-sm">{log.userName}</h3>
                                  <span className="text-xs text-gray-400">• {log.date}</span>
                                </div>
                                {currentUser?.id === log.userId && (
                                  <button onClick={() => handleDeleteActivity(log.id)} className="text-gray-400 hover:text-red-500 p-1 rounded transition" title="Hapus Aktivitas">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/></svg>
                                  </button>
                                )}
                              </div>
                              <div className="text-sm text-gray-600 mt-1 flex items-center gap-1">
                                <span>
                                  {log.type === 'Push Up' && '💪'} {log.type === 'Sit Up' && '🧘'} {log.type === 'Pull Up' && '🏋️'}
                                  {log.type === 'Squat' && '🦵'} {log.type === 'Plank' && '⚡'} {log.type === 'Perfect Run' && '🏃'}
                                </span> {log.type}
                              </div>
                              {log.sessionName !== log.userName && <p className="text-gray-900 font-medium mt-3 mb-4">{log.sessionName}</p>}
                              <div className="flex gap-4 text-sm mt-3">
                                <span className="flex items-center gap-1 text-gray-600"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 3v18M18 3v18M3 8h18M3 16h18"/></svg>{log.detail}</span>
                                <span className="flex items-center gap-1 text-[#FF5722] font-medium"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 17 6-6 4 4 8-8"/><path d="M17 7h4v4"/></svg>+{log.xp} XP</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Form Input Latihan & Klasemen */}
              <div className="space-y-6">
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                  <div className="mb-6">
                    <h2 className="text-lg font-bold text-gray-900">Catat Progress Fisik</h2>
                    <p className="text-sm text-gray-500 mt-1">Tambahkan aktivitas latihan Anda ke cloud</p>
                  </div>
                  <form onSubmit={handleSaveActivity} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nama Sesi Latihan</label>
                      <input type="text" value={sessionName} onChange={(e) => setSessionName(e.target.value)} placeholder="Contoh: Morning Run" className="w-full bg-gray-50 border border-gray-200 rounded-md px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5722]/20"/>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Jenis Latihan</label>
                      <div className="relative">
                        <select value={exerciseType} onChange={(e) => { setExerciseType(e.target.value); setReps(''); setSets(''); setDistance(''); setDuration(''); }} className="w-full bg-gray-50 border border-gray-200 rounded-md px-4 py-2.5 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-[#FF5722]/20 text-gray-800">
                          <option value="Push Up">Push Up 💪</option>
                          <option value="Sit Up">Sit Up 🧘</option>
                          <option value="Pull Up">Pull Up 🏋️</option>
                          <option value="Squat">Squat 🦵</option>
                          <option value="Plank">Plank ⚡</option>
                          <option value="Perfect Run">Perfect Run 🏃</option>
                        </select>
                        <div className="absolute right-3 top-3 pointer-events-none text-gray-400"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg></div>
                      </div>
                    </div>
                    {exerciseType === 'Perfect Run' && (
                      <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">Jarak (KM)</label><input type="number" step="0.1" value={distance} onChange={(e) => setDistance(e.target.value)} placeholder="0.0" className="w-full bg-gray-50 border border-gray-200 rounded-md px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5722]/20"/></div>
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">Durasi (menit)</label><input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="0" className="w-full bg-gray-50 border border-gray-200 rounded-md px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5722]/20"/></div>
                      </div>
                    )}
                    {exerciseType === 'Plank' && (
                      <div><label className="block text-sm font-medium text-gray-700 mb-1">Durasi (menit)</label><input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="0" className="w-full bg-gray-50 border border-gray-200 rounded-md px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5722]/20"/></div>
                    )}
                    {['Push Up', 'Sit Up', 'Pull Up', 'Squat'].includes(exerciseType) && (
                      <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">Reps</label><input type="number" value={reps} onChange={(e) => setReps(e.target.value)} placeholder="0" className="w-full bg-gray-50 border border-gray-200 rounded-md px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5722]/20"/></div>
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">Set</label><input type="number" value={sets} onChange={(e) => setSets(e.target.value)} placeholder="0" className="w-full bg-gray-50 border border-gray-200 rounded-md px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5722]/20"/></div>
                      </div>
                    )}
                    <div className="bg-gray-100 rounded-md p-4 mt-2">
                      <p className="text-sm text-gray-500 mb-1">Estimasi FitPoin didapat:</p>
                      <p className="text-xl font-bold text-[#FF5722]">+{currentXP} XP</p>
                    </div>
                    <button type="submit" className="w-full bg-[#FF5722] hover:bg-[#E64A19] text-white font-semibold py-3 rounded-md transition mt-4 shadow-sm">
                      Simpan & Tarung Klasemen
                    </button>
                  </form>
                </div>

                {/* Klasemen */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                  <div className="mb-6"><h2 className="text-lg font-bold text-gray-900">Klasemen Liga Latihan</h2><p className="text-sm text-gray-500 mt-1">Peringkat komunitas realtime dari MongoDB</p></div>
                  <div className="flex bg-gray-100 p-1 rounded-lg mb-6">
                    <button className="flex-1 bg-white shadow-sm py-1.5 text-sm font-medium rounded-md text-gray-800">Pekan Ini</button>
                    <button className="flex-1 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-700">Bulan Ini</button>
                  </div>
                  
                  {leaderboard.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center py-6 text-gray-400">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
                      <h3 className="text-base font-bold text-gray-900 mt-4 mb-2">Belum Ada Peserta</h3>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {leaderboard.map((player, idx) => (
                        <div key={idx} className={`flex items-center justify-between p-3 rounded-lg border ${currentUser?.id === player.id ? 'bg-orange-50 border-orange-100' : 'bg-gray-50 border-gray-100'}`}>
                           <div className="flex items-center gap-3">
                             <span className="font-bold text-gray-400 text-sm">{idx + 1}</span>
                             <span className="font-semibold text-sm text-gray-800">{player.name} {currentUser?.id === player.id && <span className="text-xs text-[#FF5722] font-normal">(Anda)</span>}</span>
                           </div>
                           <span className="font-bold text-[#FF5722] text-sm">{player.xp} XP</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= HISTORI DENGAN PANELS & SUMMARY/DETAIL VIEWS ================= */}
        {activeTab === 'history' && (
          <div className="max-w-4xl mx-auto space-y-6">
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0 bg-orange-50">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF5722" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium">Total Akumulasi Latihan Anda</p>
                  <p className="text-2xl font-bold text-gray-900 mt-0.5">{myActivities.length} <span className="text-sm font-normal text-gray-500">Sesi</span></p>
                </div>
              </div>
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0 bg-indigo-50">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#651FFF" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium">Total Point Terkumpul</p>
                  <p className="text-2xl font-bold text-[#FF5722] mt-0.5">{myTotalXp} <span className="text-sm font-normal text-gray-500">XP</span></p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 pb-4 border-b border-gray-100">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Histori Progress Personal</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Pantau ringkasan akumulasi volume dan detail aktivitas Anda</p>
                </div>
                
                <div className="flex bg-gray-100 p-1 rounded-lg self-start">
                  <button onClick={() => setHistoryView('ringkasan')} className={`px-4 py-1.5 text-xs font-semibold rounded-md transition ${historyView === 'ringkasan' ? 'bg-white shadow-sm text-[#FF5722]' : 'text-gray-500 hover:text-gray-800'}`}>
                    Ringkasan Volume
                  </button>
                  <button onClick={() => setHistoryView('detail')} className={`px-4 py-1.5 text-xs font-semibold rounded-md transition ${historyView === 'detail' ? 'bg-white shadow-sm text-[#FF5722]' : 'text-gray-500 hover:text-gray-800'}`}>
                    Detail Sesi Log
                  </button>
                </div>
              </div>

              {historyView === 'ringkasan' ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm">
                      <p className="text-xs font-medium text-gray-400 mb-3">Total Aktivitas</p>
                      <p className="text-2xl font-bold text-[#FF5722]">{myActivities.length}</p>
                    </div>
                    <div className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm">
                      <p className="text-xs font-medium text-gray-400 mb-3">Total Points</p>
                      <p className="text-2xl font-bold text-[#FF5722]">{myTotalXp} XP</p>
                    </div>
                    <div className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm">
                      <p className="text-xs font-medium text-gray-400 mb-3">Jenis Latihan</p>
                      <p className="text-2xl font-bold text-[#FF5722]">{new Set(myActivities.map(a => a.type)).size}</p>
                    </div>
                    <div className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm">
                      <p className="text-xs font-medium text-gray-400 mb-3">Rata-rata XP</p>
                      <p className="text-2xl font-bold text-[#FF5722]">
                        {myActivities.length > 0 ? Math.round(myTotalXp / myActivities.length) : 0}
                      </p>
                    </div>
                  </div>

                  {/* DIAGRAM BATANG KOMPARASI DUA DATA */}
                  <div className="mt-8 pt-2">
                    <h3 className="text-base font-bold text-gray-900 mb-6">Aktivitas per Jenis Latihan</h3>
                    
                    {(() => {
                      const rawChartData = Array.from(new Set(myActivities.map(a => a.type))).map(type => {
                        const filtered = myActivities.filter(a => a.type === type);
                        return {
                          name: type === 'Push Up' ? 'Push' : type,
                          jumlah: filtered.length,
                          points: filtered.reduce((sum, item) => sum + item.xp, 0),
                        };
                      });

                      const chartData = rawChartData.length > 0 ? rawChartData : [{ name: 'Push', jumlah: 0, points: 0 }];
                      const maxDataValue = Math.max(...chartData.map(d => Math.max(d.jumlah, d.points)));
                      const maxY = Math.max(12, Math.ceil(maxDataValue / 3) * 3);

                      return (
                        <div className="relative w-full pt-4">
                          <div className="absolute left-0 top-4 bottom-12 w-8 flex flex-col justify-between text-xs text-gray-400 text-right pr-2 select-none font-medium">
                            <span>{maxY}</span>
                            <span>{maxY * 0.75}</span>
                            <span>{maxY * 0.5}</span>
                            <span>{maxY * 0.25}</span>
                            <span>0</span>
                          </div>

                          <div className="ml-10 relative h-64 border-l border-b border-gray-200">
                            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                              <div className="w-full border-t border-dashed border-gray-200 h-0"></div>
                              <div className="w-full border-t border-dashed border-gray-200 h-0"></div>
                              <div className="w-full border-t border-dashed border-gray-200 h-0"></div>
                              <div className="w-full border-t border-dashed border-gray-200 h-0"></div>
                              <div className="w-full h-0"></div>
                            </div>

                            <div className="absolute inset-0 flex justify-around items-end px-4">
                              {chartData.map((d, index) => {
                                const heightJumlah = (d.jumlah / maxY) * 100;
                                const heightPoints = (d.points / maxY) * 100;

                                return (
                                  <div key={index} className="flex flex-col items-center h-full justify-end relative group w-full max-w-[180px]">
                                    <div className="flex items-end justify-center gap-1 w-full h-full">
                                      <div className="w-12 bg-[#FF5722] rounded-t-sm transition-all duration-300 relative hover:brightness-95 cursor-pointer" style={{ height: `${heightJumlah}%` }}>
                                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-slate-800 text-white text-[11px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-30 shadow-md">
                                          Jumlah Aktivitas: {d.jumlah}
                                        </div>
                                      </div>

                                      <div className="w-12 bg-[#00D09C] rounded-t-sm transition-all duration-300 relative hover:brightness-95 cursor-pointer" style={{ height: `${heightPoints}%` }}>
                                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-slate-800 text-white text-[11px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-30 shadow-md">
                                          Total Points: {d.points} XP
                                        </div>
                                      </div>
                                    </div>

                                    <div className="absolute top-full mt-2 text-xs font-semibold text-gray-500 tracking-tight">
                                      {d.name}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <div className="flex justify-center items-center gap-6 mt-12 select-none">
                            <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
                              <span className="w-4 h-2.5 bg-[#FF5722] inline-block rounded-sm"></span>
                              Jumlah Aktivitas
                            </div>
                            <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
                              <span className="w-4 h-2.5 bg-[#00D09C] inline-block rounded-sm"></span>
                              Total Points
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead>
                      <tr className="border-b border-gray-200 text-gray-400">
                        <th className="py-3 font-semibold">Tanggal Log</th>
                        <th className="py-3 font-semibold">Nama Sesi</th>
                        <th className="py-3 font-semibold">Jenis Latihan</th>
                        <th className="py-3 font-semibold">Detail Capaian</th>
                        <th className="py-3 font-semibold">Poin</th>
                        <th className="py-3 font-semibold text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myActivities.map(log => (
                        <tr key={log.id} className="border-b border-gray-100 hover:bg-slate-50/30 transition">
                          <td className="py-4 text-gray-500">{log.date}</td>
                          <td className="py-4 font-semibold text-gray-900">{log.sessionName}</td>
                          <td className="py-4"><span className="bg-slate-100 text-gray-700 px-2 py-1 rounded-md text-xs font-medium">{log.type}</span></td>
                          <td className="py-4 text-gray-600">{log.detail}</td>
                          <td className="py-4 font-bold text-[#FF5722]">+{log.xp} XP</td>
                          <td className="py-4 text-center">
                            <button onClick={() => handleDeleteActivity(log.id)} className="text-gray-400 hover:text-red-500 p-1.5 transition inline-flex items-center rounded" title="Hapus Permanen">
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/></svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= PROFIL ================= */}
        {activeTab === 'profile' && currentUser && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 max-w-xl mx-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-6 border-b pb-4">Profil Data User</h2>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div><label className="block text-sm font-medium mb-1">Nama Lengkap</label><input type="text" value={currentUser.fullName} onChange={e => setCurrentUser({...currentUser, fullName: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-md px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5722]/20"/></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">Tinggi Badan (cm)</label><input type="number" value={currentUser.height} onChange={e => setCurrentUser({...currentUser, height: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-md px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5722]/20"/></div>
                <div><label className="block text-sm font-medium mb-1">Berat Badan (kg)</label><input type="number" value={currentUser.weight} onChange={e => setCurrentUser({...currentUser, weight: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-md px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5722]/20"/></div>
              </div>
              <div><label className="block text-sm font-medium mb-1">Tanggal Lahir</label><input type="date" value={currentUser.birthDate} onChange={e => setCurrentUser({...currentUser, birthDate: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-md px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5722]/20 text-gray-700"/></div>
              <button type="submit" className="w-full bg-[#FF5722] hover:bg-[#E64A19] text-white font-semibold py-3 rounded-md mt-4 transition">Simpan Perubahan</button>
            </form>
          </div>
        )}

      </main>
    </div>
  );
}

/* --- REUSABLE COMPONENTS --- */
function StatCard({ title, value, unit, icon, bg }: { title: string, value: string, unit: string, icon: React.ReactNode, bg: string }) {
  return (
    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${bg}`}>{icon}</div>
      <div><p className="text-sm text-gray-500 font-medium">{title}</p><p className="text-2xl font-bold text-gray-900 mt-0.5">{value} <span className="text-sm font-normal text-gray-500">{unit}</span></p></div>
    </div>
  );
}

function TargetItem({ icon, name, progress, percent, color, pctValue }: { icon: string, name: string, progress: string, percent: string, color: string, pctValue: number }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-3"><span className="text-xl">{icon}</span><div><h3 className="text-sm font-bold text-gray-900">{name}</h3><p className="text-xs text-gray-500">{progress}</p></div></div>
        <span className={`text-xs font-bold ${pctValue === 0 ? 'text-gray-400' : 'text-[#FF5722]'}`}>{percent}</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2"><div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pctValue}%` }}></div></div>
    </div>
  );
}