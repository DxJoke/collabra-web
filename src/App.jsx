import React, { useState, useEffect } from 'react';
import { 
  Search, Plus, CheckCircle2, Circle, 
  Bell, Briefcase, PlusCircle, Trash2, 
  LogOut, Users, UserPlus, X, ShieldAlert,
  Menu, Edit2, Save, Rocket, Lock, User, AtSign, Eye, EyeOff,
  UploadCloud, Image as ImageIcon, BarChart3, ListTodo, FileText
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { db, storage } from './firebase';
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export default function App() {
  // --- STATE MANAJEMEN ---
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('collabra_user');
    return saved ? JSON.parse(saved) : null;
  }); 
  const [activeCategory, setActiveCategory] = useState('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  
  // UI States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null); 
  const [assignDropdownActive, setAssignDropdownActive] = useState(null); 
  const [inviteDropdownActive, setInviteDropdownActive] = useState(null); 
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Fitur Edit
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTaskTitle, setEditingTaskTitle] = useState('');

  // Toast Notification State
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });

  // Data State (Real-Time dari Firebase)
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Auth States
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [authForm, setAuthForm] = useState({ name: '', username: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Effects: Firebase Real-Time Listeners
  useEffect(() => {
    // Listener untuk koleksi 'users'
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ ...doc.data() }));
      setUsers(usersData);
    }, (error) => {
      console.error("Error fetching users: ", error);
      setAuthError('Gagal terhubung ke database. Pastikan Rules Firestore adalah test mode.');
    });

    // Listener untuk koleksi 'tasks' (diurutkan berdasarkan waktu pembuatan terbaru)
    const q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
    const unsubscribeTasks = onSnapshot(q, (snapshot) => {
      const tasksData = snapshot.docs.map(doc => ({ ...doc.data() }));
      setTasks(tasksData);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching tasks: ", error);
      // Fallback jika belum bikin index orderBy di firestore
      const fallbackQuery = onSnapshot(collection(db, 'tasks'), (snap) => {
         const tData = snap.docs.map(d => ({...d.data()})).sort((a,b) => b.createdAt - a.createdAt);
         setTasks(tData);
         setIsLoading(false);
      });
      return () => fallbackQuery();
    });

    return () => {
      unsubscribeUsers();
      unsubscribeTasks();
    };
  }, []);

  const categories = ['Semua', 'Kuliah', 'Organisasi', 'Pribadi'];
  const [newTask, setNewTask] = useState({ title: '', description: '', category: 'Kuliah', members: [], subtasks: [{ id: Date.now().toString(), title: '' }] });
  
  // States untuk Fitur Lanjutan (Modal & Foto)
  const [activeTaskTab, setActiveTaskTab] = useState('rincian'); // 'rincian' | 'statistik'
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(null); // id subtask yang sedang upload
  const [showPhotoModal, setShowPhotoModal] = useState(null); // url gambar
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editedDesc, setEditedDesc] = useState('');

  // Helpers
  const getUserById = (id) => users.find(u => u.id === id);
  const getInitials = (name) => name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '?';
  const calculateProgress = (subtasks) => {
    if (!subtasks || subtasks.length === 0) return 0;
    const completed = subtasks.filter(st => st.isCompleted).length;
    return Math.round((completed / subtasks.length) * 100);
  };

  const showToast = (message, type = 'success') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
  };

  // --- AUTH ACTIONS (Firebase) ---
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setAuthError('');
    setIsSubmitting(true);

    const { name, username, password } = authForm;
    const cleanUsername = username.trim().toLowerCase();

    if (authMode === 'register') {
      if (!name || !username || !password) {
        setIsSubmitting(false);
        return setAuthError('Semua kolom harus diisi.');
      }
      if (users.find(u => u.username === cleanUsername)) {
        setIsSubmitting(false);
        return setAuthError('Username sudah digunakan.');
      }

      const colors = ['bg-blue-500', 'bg-pink-500', 'bg-emerald-500', 'bg-purple-500', 'bg-orange-500', 'bg-indigo-500', 'bg-teal-500'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      
      const newUserId = `u${Date.now()}`;
      const newUser = { id: newUserId, name: name.trim(), username: cleanUsername, password, color: randomColor };

      try {
        const setDocPromise = setDoc(doc(db, 'users', newUserId), newUser);
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 8000));
        
        await Promise.race([setDocPromise, timeoutPromise]);
        
        localStorage.setItem('collabra_user', JSON.stringify(newUser));
        setCurrentUser(newUser);
        showToast('Pendaftaran berhasil! Selamat datang.');
        setAuthForm({ name: '', username: '', password: '' });
      } catch (err) {
        if (err.message === 'TIMEOUT') {
          setAuthError('Gagal terhubung ke server (Timeout). Cek koneksi internet Anda atau matikan ekstensi AdBlock.');
        } else {
          setAuthError('Gagal menyimpan. Pastikan Firestore rules Anda mengizinkan write.');
        }
      } finally {
        setIsSubmitting(false);
      }
    } else {
      if (!username || !password) {
        setIsSubmitting(false);
        return setAuthError('Username dan Password harus diisi.');
      }
      
      const user = users.find(u => u.username === cleanUsername && u.password === password);
      if (user) {
        localStorage.setItem('collabra_user', JSON.stringify(user));
        setCurrentUser(user);
        showToast(`Selamat datang kembali, ${user.name.split(' ')[0]}!`);
        setAuthForm({ name: '', username: '', password: '' });
      } else {
        setAuthError('Username atau Password salah.');
      }
      setIsSubmitting(false);
    }
  };

  const switchAuthMode = (mode) => {
    setAuthMode(mode);
    setAuthError('');
    setAuthForm({ name: '', username: '', password: '' });
    setShowPassword(false);
  };

  // --- TASK ACTIONS (Firebase) ---
  const addMemberToTask = async (taskId, userId) => {
    const task = tasks.find(t => t.id === taskId);
    if(!task) return;
    try {
      await updateDoc(doc(db, 'tasks', taskId), { members: [...task.members, userId] });
      setInviteDropdownActive(null);
      showToast(`${getUserById(userId)?.name || 'Anggota'} ditambahkan ke grup.`);
    } catch(err) { showToast('Gagal menambahkan anggota', 'error') }
  };

  const removeMemberFromTask = async (taskId, userId) => {
    const task = tasks.find(t => t.id === taskId);
    if(!task) return;
    try {
      const newMembers = task.members.filter(id => id !== userId);
      const newSubtasks = task.subtasks.map(st => ({ ...st, assignees: st.assignees.filter(id => id !== userId) }));
      await updateDoc(doc(db, 'tasks', taskId), { members: newMembers, subtasks: newSubtasks });
      showToast('Anggota dikeluarkan dari grup.', 'error');
    } catch(err) { showToast('Gagal mengeluarkan anggota', 'error') }
  };

  const assignSubtask = async (taskId, subtaskId, userIdToAssign) => {
    const task = tasks.find(t => t.id === taskId);
    if(!task) return;
    
    const newSubtasks = task.subtasks.map(st => {
      if (st.id === subtaskId && !st.assignees.includes(userIdToAssign)) {
        return { ...st, assignees: [...st.assignees, userIdToAssign] };
      }
      return st;
    });

    try {
      await updateDoc(doc(db, 'tasks', taskId), { subtasks: newSubtasks });
      setAssignDropdownActive(null);
    } catch(err) { showToast('Gagal mendelegasikan tugas', 'error') }
  };

  const removeAssignee = async (taskId, subtaskId, userIdToRemove) => {
    const task = tasks.find(t => t.id === taskId);
    if(!task) return;

    const newSubtasks = task.subtasks.map(st => st.id === subtaskId ? { ...st, assignees: st.assignees.filter(id => id !== userIdToRemove) } : st);
    try {
      await updateDoc(doc(db, 'tasks', taskId), { subtasks: newSubtasks });
    } catch(err) { showToast('Gagal menghapus delegasi', 'error') }
  };

  const toggleSubtaskStatus = async (taskId, subtaskId) => {
    const task = tasks.find(t => t.id === taskId);
    if(!task) return;
    
    const subtask = task.subtasks.find(st => st.id === subtaskId);
    if (!subtask.isCompleted && !subtask.proofImage) {
      return showToast('Wajib mengunggah foto bukti terlebih dahulu!', 'error');
    }

    const newSubtasks = task.subtasks.map(st => st.id === subtaskId ? { ...st, isCompleted: !st.isCompleted } : st);
    
    // Cek apakah baru saja mencapai 100%
    const wasCompleted = task.subtasks.filter(st => st.isCompleted).length === task.subtasks.length;
    const nowCompleted = newSubtasks.filter(st => st.isCompleted).length === newSubtasks.length;
    
    if (!wasCompleted && nowCompleted) {
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#6366f1', '#a855f7', '#ec4899', '#22c55e'] });
      showToast('Luar biasa! Tugas selesai 100% 🎉');
    }

    try {
      await updateDoc(doc(db, 'tasks', taskId), { subtasks: newSubtasks });
    } catch(err) { showToast('Gagal memperbarui status', 'error') }
  };

  const deleteTask = async (taskId) => {
    if (window.confirm('PERINGATAN: Yakin ingin menghapus seluruh tugas ini beserta isinya secara permanen dari Cloud?')) {
      try {
        await deleteDoc(doc(db, 'tasks', taskId));
        setSelectedTaskId(null);
        showToast('Tugas berhasil dihapus.', 'error');
      } catch(err) { showToast('Gagal menghapus tugas', 'error') }
    }
  };

  const saveTaskTitle = async (taskId) => {
    if (!editingTaskTitle.trim()) return;
    try {
      await updateDoc(doc(db, 'tasks', taskId), { title: editingTaskTitle });
      setEditingTaskId(null);
      showToast('Nama tugas berhasil diubah.');
    } catch(err) { showToast('Gagal merubah nama', 'error') }
  };

  const saveTaskDescription = async (taskId) => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), { description: editedDesc });
      setIsEditingDesc(false);
      showToast('Deskripsi berhasil diperbarui!');
    } catch(err) { showToast('Gagal memperbarui deskripsi', 'error') }
  };

  const [newDynamicSubtask, setNewDynamicSubtask] = useState('');
  const [isAddingDynamicSubtask, setIsAddingDynamicSubtask] = useState(false);

  const handleAddSubtaskToExisting = async (taskId) => {
    if (!newDynamicSubtask.trim()) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const newSubtaskObj = { id: Date.now().toString(), title: newDynamicSubtask, assignees: [], isCompleted: false };
    try {
      await updateDoc(doc(db, 'tasks', taskId), { subtasks: [...task.subtasks, newSubtaskObj] });
      setNewDynamicSubtask('');
      setIsAddingDynamicSubtask(false);
      showToast('Pekerjaan baru berhasil ditambahkan!');
    } catch(err) { showToast('Gagal menambah pekerjaan', 'error') }
  };

  const handleUploadProof = async (taskId, subtaskId, file) => {
    if (!file) return;
    setIsUploadingPhoto(subtaskId);
    try {
      const storageRef = ref(storage, `proofs/${taskId}_${subtaskId}_${Date.now()}_${file.name}`);
      
      const uploadPromise = uploadBytes(storageRef, file);
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 15000));
      
      await Promise.race([uploadPromise, timeoutPromise]);
      
      const downloadURL = await getDownloadURL(storageRef);
      const task = tasks.find(t => t.id === taskId);
      const newSubtasks = task.subtasks.map(st => st.id === subtaskId ? { ...st, proofImage: downloadURL } : st);
      
      const updatePromise = updateDoc(doc(db, 'tasks', taskId), { subtasks: newSubtasks });
      await Promise.race([updatePromise, timeoutPromise]);

      setIsUploadingPhoto(null);
      showToast('Foto bukti berhasil diunggah!');
    } catch(err) {
      if (err.message === 'TIMEOUT') {
        showToast('Koneksi lambat (Timeout). Pastikan Rules Firebase Storage sudah Test Mode!', 'error');
      } else {
        showToast('Gagal mengunggah foto! Pastikan aturan Firebase mengizinkan read/write.', 'error');
      }
      setIsUploadingPhoto(null);
    }
  };

  // Create Form Handlers
  const handleAddSubtaskInput = () => setNewTask({ ...newTask, subtasks: [...newTask.subtasks, { id: Date.now().toString(), title: '' }] });
  const handleSubtaskInputChange = (id, value) => setNewTask({ ...newTask, subtasks: newTask.subtasks.map(st => st.id === id ? { ...st, title: value } : st) });
  const handleRemoveSubtaskInput = (id) => setNewTask({ ...newTask, subtasks: newTask.subtasks.filter(st => st.id !== id) });
  const toggleNewTaskMember = (userId) => setNewTask(prev => ({ ...prev, members: prev.members.includes(userId) ? prev.members.filter(id => id !== userId) : [...prev.members, userId] }));

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTask.title) return;
    
    const validSubtasks = newTask.subtasks.filter(st => st.title.trim() !== '').map((st, index) => ({ id: (Date.now() + index).toString(), title: st.title, assignees: [], isCompleted: false }));
    const colors = ['from-purple-500 to-pink-500', 'from-emerald-400 to-teal-500', 'from-red-500 to-orange-500', 'from-blue-500 to-indigo-500', 'from-fuchsia-500 to-purple-600'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const newDocRef = doc(collection(db, 'tasks'));
    const finalTask = {
      id: newDocRef.id,
      title: newTask.title,
      description: newTask.description,
      category: newTask.category,
      coverColor: randomColor,
      creatorId: currentUser.id, 
      members: newTask.members,
      subtasks: validSubtasks,
      createdAt: Date.now()
    };

    try {
      await setDoc(newDocRef, finalTask);
      setShowCreateModal(false);
      setNewTask({ title: '', description: '', category: 'Kuliah', members: [], subtasks: [{ id: Date.now().toString(), title: '' }] });
      showToast('Tugas baru berhasil dibuat & tersimpan di Cloud!');
    } catch(err) {
      showToast('Gagal menyimpan tugas ke Cloud.', 'error');
    }
  };


  // Tampilan Login / Register
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute top-[20%] right-[-10%] w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-[-20%] left-[20%] w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
        
        <div className="w-full max-w-md bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-100 p-8 z-10 transition-all">
          <div className="flex flex-col items-center mb-8">
            <div className="w-24 h-24 rounded-[2rem] bg-white shadow-2xl shadow-cyan-500/30 mb-5 p-2.5 flex items-center justify-center transform hover:scale-110 transition-transform duration-500 hover:rotate-12">
              <img src="/logo.png" alt="Collabra Logo" className="w-full h-full object-contain animate-pulse" />
            </div>
            <h1 className="text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 tracking-tighter mb-2 animate-pulse hover:tracking-widest transition-all duration-700">
              Collabra
            </h1>
            <p className="text-gray-500 text-sm mt-1 text-center font-bold tracking-wide uppercase">Platform Kolaborasi Tim Terpadu</p>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authError && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-medium border border-red-100 animate-in fade-in slide-in-from-top-2">
                {authError}
              </div>
            )}

            {authMode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Nama Lengkap</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Contoh: Budi Santoso"
                    value={authForm.name}
                    onChange={(e) => setAuthForm({...authForm, name: e.target.value})}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Username</label>
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text" 
                  placeholder={authMode === 'login' ? "Username" : "Pilih username"}
                  value={authForm.username}
                  onChange={(e) => setAuthForm({...authForm, username: e.target.value})}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={authForm.password}
                  onChange={(e) => setAuthForm({...authForm, password: e.target.value})}
                  className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
                </button>
              </div>
            </div>

            <button 
              type="submit"
              disabled={isSubmitting}
              className={`w-full mt-2 py-3 rounded-xl font-bold text-white transition-all shadow-lg ${isSubmitting ? 'bg-gray-400 cursor-not-allowed shadow-none' : 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-indigo-500/30 hover:-translate-y-0.5'}`}
            >
              {isSubmitting ? 'Memproses...' : (authMode === 'login' ? 'Masuk' : 'Daftar Sekarang')}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              {authMode === 'login' ? 'Belum punya akun?' : 'Sudah punya akun?'}
              <button 
                onClick={() => switchAuthMode(authMode === 'login' ? 'register' : 'login')}
                className="ml-1 font-bold text-indigo-600 hover:text-purple-600 hover:underline transition-colors"
              >
                {authMode === 'login' ? 'Daftar di sini' : 'Masuk'}
              </button>
            </p>
          </div>
        </div>
        <style dangerouslySetInnerHTML={{__html: `@keyframes blob { 0% { transform: translate(0px, 0px) scale(1); } 33% { transform: translate(30px, -50px) scale(1.1); } 66% { transform: translate(-20px, 20px) scale(0.9); } 100% { transform: translate(0px, 0px) scale(1); } } .animate-blob { animation: blob 7s infinite; } .animation-delay-2000 { animation-delay: 2s; } .animation-delay-4000 { animation-delay: 4s; }`}} />
      </div>
    );
  }

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-indigo-500 font-bold animate-pulse">Menghubungkan ke Cloud...</div>;
  }

  // Filter & Pengurutan Tugas (100% di bawah)
  const filteredTasks = tasks.filter(task => {
    const matchSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCategory = activeCategory === 'Semua' || task.category === activeCategory;
    const isAuthorized = task.creatorId === currentUser.id || (task.members && task.members.includes(currentUser.id));
    return matchSearch && matchCategory && isAuthorized;
  }).sort((a, b) => {
    const pA = calculateProgress(a.subtasks);
    const pB = calculateProgress(b.subtasks);
    if (pA === 100 && pB !== 100) return 1;
    if (pB === 100 && pA !== 100) return -1;
    return 0; 
  });

  return (
    <div className="flex h-screen bg-gray-50 font-sans text-gray-800 overflow-hidden" onClick={() => { setAssignDropdownActive(null); setInviteDropdownActive(null); }}>
      
      {/* OVERLAY MOBILE SIDEBAR */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 md:hidden backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}></div>
      )}

      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 bg-white border-r border-gray-200 z-40 transform transition-transform duration-300 md:relative md:translate-x-0 w-64 flex flex-col ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-8 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-lg shadow-cyan-500/20 p-1.5 transform hover:rotate-[360deg] transition-transform duration-700">
                <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
              </div>
              <span className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-cyan-600 to-indigo-600 tracking-tighter animate-pulse">
                Collabra
              </span>
            </div>
            <button onClick={() => setMobileMenuOpen(false)} className="md:hidden text-gray-400 hover:text-gray-600">
              <X size={20}/>
            </button>
          </div>

          <div className="space-y-1 mb-8 shrink-0">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Pencarian</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Cari Tugas..." 
                className="w-full pl-9 pr-4 py-2 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Kategori</p>
            {['Semua', 'Kuliah', 'Laporan', 'Organisasi', 'Lainnya'].map(cat => (
              <button 
                key={cat}
                onClick={() => { setActiveCategory(cat); setMobileMenuOpen(false); }}
                className={`w-full text-left px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  activeCategory === cat ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          
          <div className="pt-4 border-t border-gray-100 mt-auto shrink-0">
            <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-2xl border border-gray-100">
              <div className={`w-10 h-10 rounded-full ${currentUser.color} flex items-center justify-center text-white font-bold shrink-0`}>
                {getInitials(currentUser.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800 truncate">{currentUser.name}</p>
                <p className="text-xs text-emerald-500 font-medium">Sedang Aktif</p>
              </div>
              <button onClick={() => { localStorage.removeItem('collabra_user'); setCurrentUser(null); }} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all" title="Keluar">
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 shrink-0 z-10">
          <div className="flex items-center gap-3 md:hidden">
            <button onClick={() => setMobileMenuOpen(true)} className="p-2 -ml-2 text-gray-600 hover:text-indigo-500 transition-colors">
              <Menu size={24} />
            </button>
            <div className="w-9 h-9 rounded-xl bg-white shadow-md shadow-cyan-500/20 flex items-center justify-center hidden sm:flex p-1 animate-pulse">
              <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <span className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-cyan-600 to-indigo-600 sm:hidden">Collabra</span>
          </div>



          <div className="flex items-center gap-4 ml-auto">
            <button className="text-gray-400 hover:text-indigo-500 transition-colors relative">
              <Bell size={20} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Dashboard Tugas</h1>
              <p className="text-sm text-gray-500 mt-1">Pantau progress kelompok Anda.</p>
            </div>
            
            <button 
              onClick={(e) => { e.stopPropagation(); setShowCreateModal(true); }}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-5 py-2.5 rounded-full font-medium shadow-lg shadow-indigo-500/30 transition-all hover:-translate-y-0.5"
            >
              <Plus size={18} />
              <span>Buat Tugas Baru</span>
            </button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
            {filteredTasks.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-400">
                <Briefcase size={48} className="mb-4 opacity-50" />
                <p>Belum ada tugas di kelompok Anda.</p>
              </div>
            ) : (
              filteredTasks.map(task => {
                const progress = calculateProgress(task.subtasks);
                const isTaskCreator = task.creatorId === currentUser.id;
                const creator = getUserById(task.creatorId);
                const is100 = progress === 100;

                return (
                  <div key={task.id} className={`bg-white rounded-2xl shadow-sm border overflow-hidden hover:shadow-md transition-all group flex flex-col h-full ${is100 ? 'border-emerald-300 bg-emerald-50/20' : 'border-gray-200'}`}>
                    
                    {/* Header Kartu Tugas */}
                    <div className={`h-36 bg-gradient-to-r ${is100 ? 'from-emerald-500 to-teal-400' : task.coverColor} p-4 relative flex flex-col justify-between transition-colors duration-500`}>
                      <div className="flex justify-between items-start">
                        <span className="bg-white/20 backdrop-blur-md text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                          {task.category}
                        </span>
                        <div className="flex gap-2">
                          {is100 && (
                            <span className="text-[10px] font-bold px-2 py-1 rounded shadow-sm bg-yellow-400 text-yellow-900">
                              🎉 SELESAI
                            </span>
                          )}
                          <span className={`text-[10px] font-bold px-2 py-1 rounded shadow-sm ${isTaskCreator ? 'bg-indigo-500 text-white' : 'bg-gray-900/50 text-white backdrop-blur-sm'}`}>
                            {isTaskCreator ? '⭐ Anda Ketua' : 'Anggota Grup'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="mt-auto">
                         <div className="flex items-center justify-between">
                           <div className="flex items-center gap-2 text-white">
                             <span className="text-[10px] font-bold opacity-80 uppercase tracking-wide bg-black/20 px-2 py-0.5 rounded-md">Tim Proyek:</span>
                             <div className="flex -space-x-1.5">
                                <div className={`w-6 h-6 rounded-full border border-white/50 flex items-center justify-center text-[9px] font-bold ${creator?.color || 'bg-gray-500'} shadow-sm z-10`} title={`${creator?.name || 'Unknown'} (Ketua)`}>
                                  {getInitials(creator?.name || '??')}
                                </div>
                                {task.members?.map(memberId => {
                                  const m = getUserById(memberId);
                                  return m ? (
                                    <div key={memberId} className={`relative group/member w-6 h-6 rounded-full border border-white/50 flex items-center justify-center text-[9px] font-bold ${m.color} shadow-sm`}>
                                      {getInitials(m.name)}
                                      {isTaskCreator && (
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); removeMemberFromTask(task.id, memberId); }}
                                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-3 h-3 flex items-center justify-center opacity-0 group-hover/member:opacity-100 transition-opacity z-20"
                                        >
                                          <X size={8}/>
                                        </button>
                                      )}
                                    </div>
                                  ) : null;
                                })}
                             </div>
                           </div>
                           
                           {isTaskCreator && !is100 && (
                             <div className="relative">
                               <button 
                                 onClick={(e) => { e.stopPropagation(); setInviteDropdownActive(inviteDropdownActive === task.id ? null : task.id); setAssignDropdownActive(null); }}
                                 className="text-[10px] bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-2 py-1 rounded font-medium border border-white/30 transition-colors flex items-center gap-1"
                               >
                                 <Plus size={12}/> Undang
                               </button>
                               
                               {inviteDropdownActive === task.id && (
                                  <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-1 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                                    <p className="text-[9px] font-bold text-gray-400 px-3 py-1 uppercase border-b border-gray-50 mb-1">Tambah ke Grup:</p>
                                    {users.filter(u => u.id !== currentUser.id && (!task.members || !task.members.includes(u.id))).map(u => (
                                      <button
                                        key={u.id}
                                        onClick={() => addMemberToTask(task.id, u.id)}
                                        className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2 transition-colors"
                                      >
                                        <div className={`w-5 h-5 rounded-full ${u.color} flex items-center justify-center text-[8px] text-white font-bold`}>
                                          {getInitials(u.name)}
                                        </div>
                                        {u.name}
                                      </button>
                                    ))}
                                    {users.filter(u => u.id !== currentUser.id && (!task.members || !task.members.includes(u.id))).length === 0 && (
                                      <p className="text-xs text-gray-400 px-3 py-2 text-center italic">Semua user sudah di grup</p>
                                    )}
                                  </div>
                               )}
                             </div>
                           )}
                         </div>
                      </div>
                    </div>
                    
                    {/* Body Kartu Tugas */}
                    <div className="p-5 flex-1 flex flex-col">
                      <div className="mb-4">
                        <h3 className={`font-bold text-lg leading-tight mb-1 ${is100 ? 'text-emerald-700' : 'text-gray-800'}`}>{task.title}</h3>
                        <div className="w-full bg-gray-100 rounded-full h-1.5 mt-3 mb-1 overflow-hidden">
                          <div className={`h-1.5 rounded-full transition-all duration-500 ${is100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-indigo-500 to-purple-500'}`} style={{ width: `${progress}%` }}></div>
                        </div>
                        <p className={`text-xs font-medium ${is100 ? 'text-emerald-600' : 'text-gray-500'}`}>Progress: {progress}%</p>
                      </div>

                      <div className="flex-1 flex flex-col relative opacity-60 pointer-events-none">
                         <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <Users size={14}/> Preview Sub-Tugas (Klik Tabel Detail)
                        </p>
                        <div className="space-y-2">
                          {task.subtasks?.slice(0, 3).map(st => (
                            <div key={st.id} className="flex items-center gap-2 text-sm text-gray-500 truncate">
                              {st.isCompleted ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0"/> : <Circle size={14} className="shrink-0"/>}
                              <span className="truncate">{st.title}</span>
                            </div>
                          ))}
                          {task.subtasks && task.subtasks.length > 3 && <p className="text-xs text-gray-400 italic mt-1">+{task.subtasks.length - 3} sub-tugas lainnya...</p>}
                        </div>
                      </div>
                        
                      <div className="pt-4 mt-auto">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setSelectedTaskId(task.id); }}
                          className={`w-full py-2.5 font-bold text-sm rounded-xl border transition-all flex items-center justify-center gap-2 ${is100 ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-gray-50 hover:bg-indigo-50 text-indigo-600 border-gray-200 hover:border-indigo-200'}`}
                        >
                          Buka Tabel Detail Pekerjaan
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>

      {/* TOAST NOTIFICATION */}
      {toast.visible && (
        <div className="fixed bottom-10 left-1/2 transform -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className={`px-5 py-3 rounded-full shadow-2xl flex items-center gap-3 font-semibold text-sm ${toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-gray-800 text-white'}`}>
             {toast.type === 'error' ? <Trash2 size={16}/> : <CheckCircle2 size={16} className="text-emerald-400"/>}
             {toast.message}
          </div>
        </div>
      )}

      {/* MODAL DETAIL TUGAS & TABEL PEMBAGIAN */}
      {selectedTaskId && tasks.find(t => t.id === selectedTaskId) && (() => {
        const activeTaskDetail = tasks.find(t => t.id === selectedTaskId);
        const progress = calculateProgress(activeTaskDetail.subtasks);
        const isTaskCreator = activeTaskDetail.creatorId === currentUser.id;
        const eligibleAssignees = [activeTaskDetail.creatorId, ...(activeTaskDetail.members || [])];
        const is100 = progress === 100;

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 md:p-8" onClick={(e) => { e.stopPropagation(); setAssignDropdownActive(null); setEditingTaskId(null); }}>
            <div className="bg-white rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
              
              {/* Header Modal */}
              <div className={`p-6 sm:p-8 bg-gradient-to-r ${is100 ? 'from-emerald-500 to-teal-400' : activeTaskDetail.coverColor} flex justify-between items-start shrink-0 text-white relative transition-colors duration-500`}>
                <div className="z-10 w-full max-w-2xl">
                  <span className="bg-white/20 backdrop-blur-md text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm mb-3 inline-block">
                    {activeTaskDetail.category}
                  </span>
                  
                  {/* Edit Judul Tugas */}
                  {editingTaskId === activeTaskDetail.id ? (
                    <div className="flex items-center gap-2 mb-2">
                      <input 
                        type="text" 
                        value={editingTaskTitle}
                        onChange={(e) => setEditingTaskTitle(e.target.value)}
                        className="bg-white/20 text-white placeholder-white/60 px-3 py-1.5 rounded-xl border border-white/40 focus:outline-none focus:ring-2 focus:ring-white w-full text-xl sm:text-2xl font-bold"
                        autoFocus
                      />
                      <button onClick={() => saveTaskTitle(activeTaskDetail.id)} className="p-2 bg-white text-indigo-500 rounded-xl hover:bg-gray-100 transition-colors">
                        <Save size={18}/>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 mb-1 group/title">
                      <h2 className="text-2xl sm:text-3xl font-extrabold">{activeTaskDetail.title}</h2>
                      {isTaskCreator && (
                         <button 
                          onClick={() => { setEditingTaskId(activeTaskDetail.id); setEditingTaskTitle(activeTaskDetail.title); }}
                          className="opacity-0 group-hover/title:opacity-100 transition-opacity p-1.5 bg-white/20 hover:bg-white/30 rounded-lg backdrop-blur-sm"
                          title="Edit Judul"
                         >
                           <Edit2 size={16}/>
                         </button>
                      )}
                    </div>
                  )}

                  <p className="text-sm font-medium opacity-90 mb-3">Progress Keseluruhan: {progress}%</p>
                  <div className="w-full sm:w-80 bg-black/20 rounded-full h-2 overflow-hidden">
                    <div className="bg-white h-2 rounded-full transition-all duration-1000" style={{ width: `${progress}%` }}></div>
                  </div>
                </div>
                
                <div className="flex items-start gap-2 z-10">
                  {isTaskCreator && (
                    <button 
                      onClick={() => deleteTask(activeTaskDetail.id)} 
                      className="w-10 h-10 flex items-center justify-center rounded-full bg-red-500/80 text-white hover:bg-red-600 transition-colors backdrop-blur-sm border border-red-400"
                      title="Hapus Tugas Secara Permanen"
                    >
                      <Trash2 size={18}/>
                    </button>
                  )}
                  <button onClick={() => setSelectedTaskId(null)} className="w-10 h-10 flex items-center justify-center rounded-full bg-black/20 text-white hover:bg-black/40 transition-colors">
                    <X size={20}/>
                  </button>
                </div>
                <div className="absolute top-0 right-0 w-40 h-40 bg-white opacity-10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
              </div>
              
              {/* Tab Navigasi */}
              <div className="flex bg-gray-50/80 border-b border-gray-200">
                <button onClick={() => setActiveTaskTab('rincian')} className={`flex-1 py-3.5 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTaskTab === 'rincian' ? 'border-indigo-500 text-indigo-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}><ListTodo size={16}/> Rincian Tugas</button>
                <button onClick={() => setActiveTaskTab('statistik')} className={`flex-1 py-3.5 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTaskTab === 'statistik' ? 'border-indigo-500 text-indigo-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}><BarChart3 size={16}/> Statistik & Kontribusi</button>
              </div>
              
              {/* Konten Modal */}
              <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1 bg-gray-50">
                {activeTaskTab === 'rincian' ? (
                  <div className="space-y-6">
                    {/* Deskripsi Section */}
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2"><FileText size={18} className="text-indigo-500"/> Deskripsi & Instruksi</h3>
                        {isTaskCreator && !isEditingDesc && (
                          <button onClick={() => { setIsEditingDesc(true); setEditedDesc(activeTaskDetail.description || ''); }} className="text-xs px-3 py-1.5 rounded-lg bg-gray-50 text-indigo-500 hover:bg-indigo-50 hover:text-indigo-700 font-bold transition-colors">Edit Deskripsi</button>
                        )}
                      </div>
                      {isEditingDesc ? (
                        <div className="space-y-3">
                          <textarea 
                            value={editedDesc} 
                            onChange={(e) => setEditedDesc(e.target.value)} 
                            className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none transition-all shadow-sm resize-none custom-scrollbar" 
                            rows={4} 
                            placeholder="Tuliskan detail instruksi di sini..."
                          />
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setIsEditingDesc(false)} className="px-4 py-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-600 font-bold transition-colors">Batal</button>
                            <button onClick={() => saveTaskDescription(activeTaskDetail.id)} className="px-4 py-2 text-xs bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-bold transition-colors shadow-sm shadow-indigo-500/30">Simpan Deskripsi</button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{activeTaskDetail.description || <span className="italic text-gray-400 font-medium">Belum ada catatan detail dari ketua kelompok.</span>}</p>
                      )}
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                      <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                          <Briefcase size={18} className="text-indigo-500"/>
                          Daftar Pekerjaan & Status
                        </h3>
                      </div>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[650px]">
                          <thead>
                            <tr className="bg-white border-b border-gray-200">
                              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-12 text-center">No</th>
                              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Deskripsi Pekerjaan</th>
                              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[150px]">Tim Ditugaskan</th>
                              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center w-24">Status</th>
                              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right w-44">Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {activeTaskDetail.subtasks?.map((st, idx) => {
                              const isAssignedToMe = st.assignees && st.assignees.includes(currentUser.id);
                              const canToggle = isAssignedToMe || isTaskCreator; 

                              return (
                                <tr key={st.id} className={`hover:bg-gray-50/50 transition-colors ${st.isCompleted ? 'bg-gray-50/30' : 'bg-white'}`}>
                                  <td className="px-4 py-4 text-sm text-gray-400 font-medium text-center">{idx + 1}</td>
                                  <td className="px-4 py-4">
                                    <p className={`text-sm font-semibold ${st.isCompleted ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                      {st.title}
                                    </p>
                                  </td>
                                  <td className="px-4 py-4">
                                    {st.assignees && st.assignees.length > 0 ? (
                                      <div className="flex flex-wrap gap-1.5">
                                        {st.assignees.map(uId => {
                                          const u = getUserById(uId);
                                          return u ? (
                                            <div key={uId} className={`flex items-center gap-1.5 px-2 py-1 rounded-full border border-gray-200 bg-white shadow-sm group/avatar relative`} title={u.name}>
                                              <div className={`w-4 h-4 rounded-full ${u.color} flex items-center justify-center text-[8px] text-white font-bold`}>
                                                {getInitials(u.name)}
                                              </div>
                                              <span className="text-xs font-medium text-gray-700 hidden sm:inline">{u.name.split(' ')[0]}</span>
                                              {(isTaskCreator || uId === currentUser.id) && !st.isCompleted && (
                                                  <button 
                                                    onClick={(e) => { e.stopPropagation(); removeAssignee(activeTaskDetail.id, st.id, uId); }}
                                                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity z-10 shadow-sm"
                                                    title="Hapus penugasan"
                                                  >
                                                    <X size={10}/>
                                                  </button>
                                              )}
                                            </div>
                                          ) : null;
                                        })}
                                      </div>
                                    ) : (
                                      <span className="text-xs font-medium text-indigo-500 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
                                        Belum ditugaskan
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-4 text-center">
                                    {st.isCompleted ? (
                                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                                        <CheckCircle2 size={12}/> Selesai
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full border border-gray-200">
                                        <Circle size={12}/> Proses
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      {/* Tombol Upload Bukti Foto */}
                                      {canToggle && (
                                        st.proofImage ? (
                                          <button onClick={(e) => { e.stopPropagation(); setShowPhotoModal(st.proofImage); }} className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition-colors shadow-sm" title="Lihat Bukti Foto">
                                            <ImageIcon size={18}/>
                                          </button>
                                        ) : (
                                          <label className="cursor-pointer p-1.5 rounded-lg bg-white border border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 transition-all shadow-sm relative group/upload" title="Wajib Unggah Bukti Foto">
                                            {isUploadingPhoto === st.id ? (
                                              <div className="w-[18px] h-[18px] border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                                            ) : (
                                              <>
                                                <UploadCloud size={18}/>
                                                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                                                </span>
                                              </>
                                            )}
                                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUploadProof(activeTaskDetail.id, st.id, e.target.files[0])}/>
                                          </label>
                                        )
                                      )}

                                      {/* Tombol Tandai Selesai */}
                                      <button 
                                        onClick={() => canToggle && toggleSubtaskStatus(activeTaskDetail.id, st.id)}
                                        disabled={!canToggle}
                                        className={`p-1.5 rounded-lg border transition-all ${st.isCompleted ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : (canToggle ? 'bg-white text-gray-400 hover:text-emerald-500 hover:border-emerald-200 shadow-sm' : 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed')}`}
                                        title={st.isCompleted ? "Batal Selesai" : "Tandai Selesai"}
                                      >
                                        <CheckCircle2 size={18} />
                                      </button>
                                      
                                      {/* Tombol Ikut Kerjakan */}
                                      {!isAssignedToMe && !st.isCompleted && (
                                        <button 
                                          onClick={() => assignSubtask(activeTaskDetail.id, st.id, currentUser.id)}
                                          className="text-[10px] uppercase tracking-wider bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 px-2.5 py-1.5 rounded-lg font-bold transition-colors shadow-sm"
                                        >
                                          Ikut
                                        </button>
                                      )}

                                      {/* Tombol Delegasi (Ketua) */}
                                      {isTaskCreator && !st.isCompleted && (
                                        <div className="relative">
                                          <button 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setAssignDropdownActive(assignDropdownActive === st.id ? null : st.id);
                                            }}
                                            className="p-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-indigo-500 transition-colors shadow-sm"
                                            title="Delegasikan"
                                          >
                                            <UserPlus size={18} />
                                          </button>

                                          {/* Dropdown Menu Pilih Anggota */}
                                          {assignDropdownActive === st.id && (
                                            <div className="absolute right-0 bottom-full mb-2 w-48 bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-1 overflow-hidden text-left" onClick={(e) => e.stopPropagation()}>
                                              <p className="text-[9px] font-bold text-gray-400 px-3 py-1.5 uppercase border-b border-gray-50 mb-1">Tugaskan Ke:</p>
                                              {eligibleAssignees.filter(uId => !st.assignees || !st.assignees.includes(uId)).map(uId => {
                                                const u = getUserById(uId);
                                                return u ? (
                                                  <button
                                                    key={u.id}
                                                    onClick={() => assignSubtask(activeTaskDetail.id, st.id, u.id)}
                                                    className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2 transition-colors"
                                                  >
                                                    <div className={`w-5 h-5 rounded-full ${u.color} flex items-center justify-center text-[8px] text-white font-bold`}>
                                                      {getInitials(u.name)}
                                                    </div>
                                                    {u.name}
                                                  </button>
                                                ) : null;
                                              })}
                                              {eligibleAssignees.filter(uId => !st.assignees || !st.assignees.includes(uId)).length === 0 && (
                                                <p className="text-xs text-gray-400 px-3 py-3 text-center">Semua anggota sudah ditugaskan</p>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      
                      {/* Form Tambah Sub-tugas (Hanya Ketua) */}
                      {isTaskCreator && (
                        <div className="p-4 bg-gray-50/50 border-t border-gray-100 flex gap-2">
                          <input 
                            type="text" 
                            placeholder="Tambah pekerjaan baru yang tertinggal..." 
                            value={newDynamicSubtask}
                            onChange={(e) => setNewDynamicSubtask(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddSubtaskToExisting(activeTaskDetail.id)}
                            className="flex-1 text-sm border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all shadow-sm"
                          />
                          <button 
                            onClick={() => handleAddSubtaskToExisting(activeTaskDetail.id)}
                            disabled={!newDynamicSubtask.trim()}
                            className="bg-indigo-500 hover:bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 transition-colors shadow-sm shadow-indigo-500/30"
                          >
                            Tambah
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden p-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-6">
                      <BarChart3 size={18} className="text-indigo-500"/>
                      Statistik & Penilaian Kontribusi
                    </h3>
                    
                    <div className="space-y-5">
                      {eligibleAssignees.map(uId => {
                        const u = getUserById(uId);
                        if (!u) return null;
                        const totalAssigned = activeTaskDetail.subtasks.filter(st => st.assignees && st.assignees.includes(uId)).length;
                        const totalCompleted = activeTaskDetail.subtasks.filter(st => st.isCompleted && st.assignees && st.assignees.includes(uId)).length;
                        const userProgress = totalAssigned === 0 ? 0 : Math.round((totalCompleted / totalAssigned) * 100);
                        
                        return (
                          <div key={uId} className="flex items-center gap-5 p-4 rounded-2xl bg-gray-50 border border-gray-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-colors">
                            <div className={`w-12 h-12 rounded-full ${u.color} flex items-center justify-center text-lg text-white font-bold shrink-0 shadow-sm ring-4 ring-white`}>{getInitials(u.name)}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-end mb-2">
                                <div>
                                  <p className="font-bold text-gray-800 text-base truncate">{u.name}</p>
                                  <p className="text-xs text-gray-500 font-medium mt-0.5">Berhasil menyelesaikan <span className="font-bold text-gray-700">{totalCompleted}</span> dari <span className="font-bold text-gray-700">{totalAssigned}</span> tugas</p>
                                </div>
                                <span className={`text-lg font-black ${userProgress === 100 ? 'text-emerald-500' : 'text-indigo-600'}`}>{userProgress}%</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                                <div className={`h-2.5 rounded-full transition-all duration-1000 ${userProgress === 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-indigo-500 to-purple-500'}`} style={{ width: `${userProgress}%` }}></div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {eligibleAssignees.length === 0 && (
                        <p className="text-center text-sm text-gray-500 py-8">Belum ada anggota di dalam tugas ini.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL BUAT TUGAS */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Buat Tugas Baru</h2>
                <p className="text-xs text-gray-500">Anda otomatis akan menjadi <strong className="text-indigo-500">Ketua</strong>.</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 text-gray-500 hover:bg-red-100 hover:text-red-500 transition-colors">
                <X size={16}/>
              </button>
            </div>
            
            <form onSubmit={handleCreateTask} className="p-6 overflow-y-auto custom-scrollbar flex-1">
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Judul Tugas Utama</label>
                  <input 
                    type="text" 
                    required
                    value={newTask.title}
                    onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                    placeholder="Contoh: Pembuatan Website E-Commerce" 
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none transition-all shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Deskripsi Detail <span className="text-xs font-normal text-gray-400">(Opsional)</span></label>
                  <textarea 
                    value={newTask.description}
                    onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                    placeholder="Tuliskan instruksi atau catatan penting terkait tugas ini..." 
                    rows={3}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none transition-all shadow-sm resize-none custom-scrollbar"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Kategori</label>
                  <select 
                    value={newTask.category}
                    onChange={(e) => setNewTask({...newTask, category: e.target.value})}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-400 outline-none appearance-none shadow-sm bg-white"
                  >
                    <option value="Kuliah">Kuliah</option>
                    <option value="Laporan">Laporan</option>
                    <option value="Organisasi">Organisasi</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>

                {/* PEMILIHAN ANGGOTA GRUP SAAT PEMBUATAN */}
                <div className="pt-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Pilih Anggota Kelompok <span className="text-xs font-normal text-gray-400">(Opsional)</span></label>
                  <div className="flex flex-wrap gap-2">
                    {users.filter(u => u.id !== currentUser.id).length === 0 ? (
                      <div className="w-full bg-indigo-50 border border-indigo-100 p-3 rounded-xl flex items-start gap-3">
                        <Users size={16} className="text-indigo-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-indigo-700 leading-relaxed">
                          <strong>Belum ada teman yang bisa dipilih!</strong><br/>
                          Saat ini hanya Anda yang baru mendaftar di database Cloud. Bagikan link website ini ke teman kelompok Anda dan minta mereka mendaftar agar nama mereka muncul di sini.
                        </p>
                      </div>
                    ) : (
                      users.filter(u => u.id !== currentUser.id).map(u => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => toggleNewTaskMember(u.id)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${newTask.members.includes(u.id) ? 'bg-indigo-100 border-indigo-400 text-indigo-700 shadow-sm' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
                        >
                          <div className={`w-4 h-4 rounded-full ${u.color} flex items-center justify-center text-[8px] text-white font-bold`}>
                            {getInitials(u.name)}
                          </div>
                          {u.name}
                        </button>
                      ))
                    )}
                  </div>
                  {users.filter(u => u.id !== currentUser.id).length > 0 && (
                    <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
                      <ShieldAlert size={12}/> Hanya Anda dan anggota terpilih yang bisa melihat & mengerjakan tugas ini.
                    </p>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Pecah Menjadi Sub-Tugas (Checklist)</label>
                  <div className="space-y-2">
                    {newTask.subtasks.map((st, index) => (
                      <div key={st.id} className="flex gap-2">
                        <span className="bg-indigo-50 text-indigo-600 w-10 shrink-0 flex items-center justify-center rounded-xl text-sm font-bold border border-indigo-100">
                          {index + 1}
                        </span>
                        <input 
                          type="text" 
                          value={st.title}
                          onChange={(e) => handleSubtaskInputChange(st.id, e.target.value)}
                          placeholder="Deskripsi pengerjaan..." 
                          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none shadow-sm"
                        />
                        {newTask.subtasks.length > 1 && (
                          <button 
                            type="button" 
                            onClick={() => handleRemoveSubtaskInput(st.id)}
                            className="w-10 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl border border-transparent hover:border-red-100 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button 
                    type="button"
                    onClick={handleAddSubtaskInput}
                    className="mt-3 flex items-center justify-center w-full gap-2 py-2 text-sm font-semibold text-indigo-500 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-200 border-dashed transition-colors"
                  >
                    <PlusCircle size={16} /> Tambah Sub-tugas Baru
                  </button>
                </div>
              </div>

              <div className="mt-8 flex gap-3 pt-4 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  className="flex-[2] py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:from-indigo-600 hover:to-purple-700 transition-all hover:-translate-y-0.5"
                >
                  Simpan & Publish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL LIHAT FOTO BUKTI */}
      {showPhotoModal && (
        <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowPhotoModal(null)}>
          <div className="relative max-w-4xl w-full flex flex-col items-center animate-in fade-in zoom-in duration-200" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowPhotoModal(null)} className="absolute -top-12 right-0 w-10 h-10 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/40 text-white transition-colors">
              <X size={20}/>
            </button>
            <img src={showPhotoModal} alt="Bukti Pengerjaan" className="max-w-full max-h-[85vh] rounded-xl shadow-2xl object-contain border border-white/10" />
            <p className="text-white/70 text-sm mt-4 font-medium flex items-center gap-2"><ImageIcon size={16}/> Bukti Pengerjaan Tugas</p>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        
        @keyframes marquee { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }
        .animate-marquee { animation: marquee 30s linear infinite; }
      `}} />
    </div>
  );
}
