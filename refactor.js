const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

const helpers = `
  const isSubtaskCompletedGlobally = (st) => {
    if (st.isCompleted) return true;
    if (!st.assignees || st.assignees.length === 0) return false;
    return st.assignees.every(id => st.completedBy && st.completedBy.includes(id));
  };

  const isSubtaskCompletedByUser = (st, userId) => {
    if (st.isCompleted) return true;
    return st.completedBy && st.completedBy.includes(userId);
  };
`;

code = code.replace(/const getInitials =[^;]+;/, match => match + '\n' + helpers);

code = code.replace(/const calculateProgress = \(subtasks\) => {[\s\S]*?};/, `const calculateProgress = (subtasks) => {
    if (!subtasks || subtasks.length === 0) return 0;
    const completed = subtasks.filter(st => isSubtaskCompletedGlobally(st)).length;
    return Math.round((completed / subtasks.length) * 100);
  };`);

code = code.replace(/const toggleSubtaskStatus = async \(taskId, subtaskId\) => {[\s\S]*?catch\(err\) { showToast\('Gagal memperbarui status', 'error'\) }\n  };/, `const toggleSubtaskStatus = async (taskId, subtaskId) => {
    const task = tasks.find(t => t.id === taskId);
    if(!task) return;
    
    const subtask = task.subtasks.find(st => st.id === subtaskId);
    const userCompleted = isSubtaskCompletedByUser(subtask, currentUser.id);
    
    if (!userCompleted && !subtask.proofImage) {
      return showToast('Wajib mengunggah foto bukti terlebih dahulu!', 'error');
    }

    let newCompletedBy = subtask.completedBy || [];
    if (userCompleted) {
      newCompletedBy = newCompletedBy.filter(id => id !== currentUser.id);
    } else {
      newCompletedBy = [...newCompletedBy, currentUser.id];
    }
    
    const newSubtasks = task.subtasks.map(st => st.id === subtaskId ? { ...st, isCompleted: false, completedBy: newCompletedBy } : st);
    
    const wasCompleted = task.subtasks.filter(st => isSubtaskCompletedGlobally(st)).length === task.subtasks.length;
    const nowCompleted = newSubtasks.filter(st => isSubtaskCompletedGlobally(st)).length === newSubtasks.length;
    
    if (!wasCompleted && nowCompleted) {
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#6366f1', '#a855f7', '#ec4899', '#22c55e'] });
      showToast('Luar biasa! Tugas selesai 100% 🎉');
    }

    try {
      await updateDoc(doc(db, 'tasks', taskId), { subtasks: newSubtasks });
    } catch(err) { showToast('Gagal memperbarui status', 'error') }
  };`);

code = code.replace(/\{st\.isCompleted \? <CheckCircle2 size=\{14\} className="text-emerald-500 shrink-0"\/> : <Circle size=\{14\} className="shrink-0"\/>\}/g, '{isSubtaskCompletedGlobally(st) ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0"/> : <Circle size={14} className="shrink-0"/>}');

code = code.replace(/\{st\.isCompleted \? 'bg-gray-50\/30' : 'bg-white'\}/g, '{isSubtaskCompletedGlobally(st) ? \\'bg-gray-50/30\\' : \\'bg-white\\'}');
code = code.replace(/\{st\.isCompleted \? 'line-through text-gray-400' : 'text-gray-800'\}/g, '{isSubtaskCompletedGlobally(st) ? \\'line-through text-gray-400\\' : \\'text-gray-800\\'}');

code = code.replace(/!st\.isCompleted && \(/g, '!isSubtaskCompletedGlobally(st) && (');

code = code.replace(/\{st\.isCompleted \? \(\s*<span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600/g, '{isSubtaskCompletedGlobally(st) ? (\\n                                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600');

code = code.replace(/\{st\.isCompleted \? 'bg-emerald-50 text-emerald-600 border-emerald-200' : \(canToggle \? 'bg-white text-gray-400 hover:text-emerald-500 hover:border-emerald-200 shadow-sm' : 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'\)\}/g, '{isSubtaskCompletedByUser(st, currentUser.id) ? \\'bg-emerald-50 text-emerald-600 border-emerald-200\\' : (canToggle ? \\'bg-white text-gray-400 hover:text-emerald-500 hover:border-emerald-200 shadow-sm\\' : \\'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed\\')}');

code = code.replace(/title=\{st\.isCompleted \? "Batal Selesai" : "Tandai Selesai"\}/g, 'title={isSubtaskCompletedByUser(st, currentUser.id) ? "Batal Selesai" : "Tandai Selesai"}');

code = code.replace(/if \(st\.isCompleted && st\.assignees && st\.assignees\.includes\(uId\)\)/g, 'if (isSubtaskCompletedByUser(st, uId) && st.assignees && st.assignees.includes(uId))');

code = code.replace(/filter\(st => st\.isCompleted && st\.assignees && st\.assignees\.includes\(uId\)\)/g, 'filter(st => isSubtaskCompletedByUser(st, uId) && st.assignees && st.assignees.includes(uId))');

fs.writeFileSync('src/App.jsx', code);
