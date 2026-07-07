// ---------- State ----------
  let transactions = [];
  let settings = { name: '', currency: 'INR', darkMode: false };
  let currentFilter = 'all';
  let currentTxType = 'expense';
  let cashflowChart = null;
  let currentUser = null;

  const CURRENCY_SYMBOLS = { INR:'₹', USD:'$', EUR:'€', GBP:'£', JPY:'¥' };

  // ---------- Storage Wrapper ----------
  const storage = {
    get(key) {
      if (window.storage && typeof window.storage.get === 'function') {
        const val = window.storage.get(key, false);
        return val !== null ? (typeof val === 'string' ? { value: val } : val) : null;
      }
      const val = localStorage.getItem(key);
      return val !== null ? { value: val } : null;
    },
    set(key, val) {
      if (window.storage && typeof window.storage.set === 'function') {
        window.storage.set(key, val, false);
        return;
      }
      localStorage.setItem(key, val);
    },
    remove(key) {
      if (window.storage && typeof window.storage.remove === 'function') {
        window.storage.remove(key, false);
        return;
      }
      localStorage.removeItem(key);
    }
  };

  // ---------- Storage ----------
  function loadTransactions(){
    if(!currentUser) return [];
    try{
      const res = storage.get(`transactions_${currentUser.toLowerCase()}`);
      return res ? JSON.parse(res.value) : [];
    }catch(e){ return []; }
  }
  function saveTransactions(){
    if(!currentUser) return;
    try{ storage.set(`transactions_${currentUser.toLowerCase()}`, JSON.stringify(transactions)); }
    catch(e){ showToast('Could not save — please try again'); }
  }
  function loadSettings(){
    if(!currentUser) return { name:'', currency:'INR', darkMode:false };
    try{
      const res = storage.get(`settings_${currentUser.toLowerCase()}`);
      return res ? JSON.parse(res.value) : { name: currentUser, currency:'INR', darkMode:false };
    }catch(e){ return { name: currentUser, currency:'INR', darkMode:false }; }
  }
  function saveSettings(){
    if(!currentUser) return;
    try{ storage.set(`settings_${currentUser.toLowerCase()}`, JSON.stringify(settings)); }
    catch(e){ showToast('Could not save preferences'); }
  }

  // ---------- Authentication ----------
  function setAuthTab(tab){
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    document.getElementById('login-error').textContent = '';
    document.getElementById('signup-error').textContent = '';
    
    if(tab === 'login'){
      document.getElementById('tab-login').classList.add('active');
      document.getElementById('form-login').classList.add('active');
    } else {
      document.getElementById('tab-signup').classList.add('active');
      document.getElementById('form-signup').classList.add('active');
    }
  }

  function handleSignup(){
    const nameEl = document.getElementById('signup-name');
    const passEl = document.getElementById('signup-password');
    const errEl = document.getElementById('signup-error');
    
    const name = nameEl.value.trim();
    const password = passEl.value;
    
    if(!name || !password){
      errEl.textContent = 'Please fill in all fields.';
      return;
    }
    if(password.length < 6){
      errEl.textContent = 'Password must be at least 6 characters.';
      return;
    }
    
    errEl.textContent = '';
    
    let users = [];
    try {
      const res = storage.get('fintrack_users');
      users = res ? JSON.parse(res.value) : [];
    } catch(e) {}
    
    const exists = users.some(u => u.username.toLowerCase() === name.toLowerCase());
    if(exists){
      errEl.textContent = 'An account with this name already exists.';
      return;
    }
    
    users.push({ username: name, password: password });
    storage.set('fintrack_users', JSON.stringify(users));
    
    showToast('Account created successfully! Please log in.');
    
    nameEl.value = '';
    passEl.value = '';
    
    setAuthTab('login');
    document.getElementById('login-username').value = name;
  }

  function handleLogin(){
    const nameEl = document.getElementById('login-username');
    const passEl = document.getElementById('login-password');
    const errEl = document.getElementById('login-error');
    
    const name = nameEl.value.trim();
    const password = passEl.value;
    
    if(!name || !password){
      errEl.textContent = 'Please fill in all fields.';
      return;
    }
    
    errEl.textContent = '';
    
    let users = [];
    try {
      const res = storage.get('fintrack_users');
      users = res ? JSON.parse(res.value) : [];
    } catch(e) {}
    
    const user = users.find(u => u.username.toLowerCase() === name.toLowerCase() && u.password === password);
    if(!user){
      errEl.textContent = 'Invalid name or password.';
      return;
    }
    
    currentUser = user.username;
    storage.set('fintrack_current_user', currentUser);
    
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    
    nameEl.value = '';
    passEl.value = '';
    
    init();
    showToast(`Welcome back, ${currentUser}!`);
  }

  function handleLogout(){
    currentUser = null;
    storage.remove('fintrack_current_user');
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
    
    transactions = [];
    settings = { name: '', currency: 'INR', darkMode: false };
    if (cashflowChart) {
      cashflowChart.destroy();
      cashflowChart = null;
    }
    
    showToast('Logged out successfully.');
  }

  // Expose handlers globally
  window.setAuthTab = setAuthTab;
  window.handleSignup = handleSignup;
  window.handleLogin = handleLogin;
  window.handleLogout = handleLogout;

  // ---------- Init ----------
  function init(){
    const res = storage.get('fintrack_current_user');
    currentUser = res ? res.value : null;

    if (!currentUser) {
      document.getElementById('auth-screen').classList.remove('hidden');
      document.getElementById('app').classList.add('hidden');
      return;
    }

    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');

    settings = loadSettings();
    transactions = loadTransactions();

    document.getElementById('account-username').textContent = currentUser;
    document.body.classList.toggle('dark', !!settings.darkMode);
    document.getElementById('input-dark').checked = !!settings.darkMode;
    document.getElementById('input-name').value = settings.name || currentUser;
    document.getElementById('input-currency').value = settings.currency || 'INR';
    document.getElementById('greeting').textContent = settings.name ? `${settings.name}'s Ledger` : `${currentUser}'s Ledger`;
    document.getElementById('input-date').valueAsDate = new Date();
    setTxType('expense');

    masterRefresh();
  }

  // ---------- Navigation ----------
  function showPage(page){
    document.querySelectorAll('.page').forEach(p => p.classList.remove('visible'));
    document.getElementById('page-' + page).classList.add('visible');
    document.querySelectorAll('.nav-link').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  }

  // ---------- Modal ----------
  function openModal(){
    document.getElementById('modal-overlay').classList.add('visible');
    document.getElementById('form-error').textContent = '';
  }
  function closeModal(){
    document.getElementById('modal-overlay').classList.remove('visible');
    document.getElementById('input-desc').value = '';
    document.getElementById('input-amount').value = '';
    document.getElementById('input-category').selectedIndex = 0;
    document.getElementById('input-date').valueAsDate = new Date();
    setTxType('expense');
  }
  function setTxType(type){
    currentTxType = type;
    document.getElementById('type-income').classList.toggle('active-income', type === 'income');
    document.getElementById('type-expense').classList.toggle('active-expense', type === 'expense');
  }

  function saveTransaction(){
    const desc = document.getElementById('input-desc').value.trim();
    const amount = parseFloat(document.getElementById('input-amount').value);
    const date = document.getElementById('input-date').value;
    const category = document.getElementById('input-category').value;
    const errEl = document.getElementById('form-error');

    if(!desc || !amount || amount <= 0 || !date || !category){
      errEl.textContent = 'Fill in every field with a valid amount before saving.';
      return;
    }
    errEl.textContent = '';

    const tx = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2,7),
      type: currentTxType, description: desc, amount, date, category
    };
    transactions.push(tx);
    saveTransactions();
    closeModal();
    masterRefresh();
    showToast('Transaction saved');
  }

  function deleteTransaction(id){
    transactions = transactions.filter(t => t.id !== id);
    saveTransactions();
    masterRefresh();
    showToast('Transaction deleted');
  }

  // ---------- Filters ----------
  function setFilter(filter){
    currentFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === filter));
    renderTable();
  }

  // ---------- Calculations ----------
  function calculateTotals(){
    let income = 0, expense = 0;
    for(const t of transactions){
      if(t.type === 'income') income += t.amount; else expense += t.amount;
    }
    return { income, expense, balance: income - expense, count: transactions.length };
  }

  // Formatting Money helper
  function formatMoney(n){
    const sym = CURRENCY_SYMBOLS[settings.currency] || '₹';
    return sym + n.toLocaleString(undefined, { minimumFractionDigits:2, maximumFractionDigits:2 });
  }

  // ---------- Rendering ----------
  function updateCards(){
    const { income, expense, balance, count } = calculateTotals();
    document.getElementById('stat-balance').textContent = formatMoney(balance);
    document.getElementById('stat-income').textContent = formatMoney(income);
    document.getElementById('stat-expense').textContent = formatMoney(expense);
    document.getElementById('stat-count').textContent = count;
  }

  function renderTable(){
    const tbody = document.getElementById('tx-tbody');
    tbody.innerHTML = '';
    let list = [...transactions].sort((a,b) => new Date(b.date) - new Date(a.date));
    if(currentFilter !== 'all') list = list.filter(t => t.type === currentFilter);

    if(list.length === 0){
      tbody.innerHTML = `<tr class="empty-row"><td colspan="5">No transactions here yet — add one to start your ledger.</td></tr>`;
      return;
    }

    for(const t of list){
      const tr = document.createElement('tr');
      const sign = t.type === 'income' ? '+' : '−';
      const cls = t.type === 'income' ? 'in' : 'out';
      tr.innerHTML = `
        <td>${new Date(t.date + 'T00:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}</td>
        <td>${escapeHtml(t.description)}</td>
        <td><span class="cat-chip">${escapeHtml(t.category)}</span></td>
        <td class="amt ${cls}">${sign}${formatMoney(t.amount)}</td>
        <td><button class="del-btn" title="Delete" onclick="deleteTransaction('${t.id}')">✕</button></td>
      `;
      tbody.appendChild(tr);
    }
  }

  function escapeHtml(s){
    const d = document.createElement('div'); d.textContent = s; return d.innerHTML;
  }

  function renderChart(){
    const sorted = [...transactions].sort((a,b) => new Date(a.date) - new Date(b.date));
    const labels = [...new Set(sorted.map(t => t.date))];
    const incomeData = labels.map(d => sorted.filter(t => t.date === d && t.type === 'income').reduce((s,t)=>s+t.amount,0));
    const expenseData = labels.map(d => sorted.filter(t => t.date === d && t.type === 'expense').reduce((s,t)=>s+t.amount,0));

    if(cashflowChart) cashflowChart.destroy();
    const ctx = document.getElementById('cashflow-chart').getContext('2d');
    const isDark = document.body.classList.contains('dark');
    const gridColor = isDark ? 'rgba(248,250,252,0.08)' : 'rgba(15,23,42,0.08)';
    const textColor = isDark ? '#94A3B8' : '#64748B';

    cashflowChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels.map(d => new Date(d + 'T00:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'})),
        datasets: [
          { label:'Income', data: incomeData, backgroundColor:'#10B981', borderRadius:4, maxBarThickness:26 },
          { label:'Expense', data: expenseData, backgroundColor:'#EF4444', borderRadius:4, maxBarThickness:26 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: textColor, font:{family:'Inter'} } } },
        scales: {
          x: { grid: { display:false }, ticks: { color: textColor, font:{family:'IBM Plex Mono', size:11} } },
          y: { grid: { color: gridColor }, ticks: { color: textColor, font:{family:'IBM Plex Mono', size:11} } }
        }
      }
    });
  }

  function masterRefresh(){
    updateCards();
    renderTable();
    renderChart();
  }

  // ---------- Settings actions ----------
  function updateName(name){
    settings.name = name.trim();
    saveSettings();
    document.getElementById('greeting').textContent = settings.name ? `${settings.name}'s Ledger` : `${currentUser}'s Ledger`;
    showToast('Name updated');
  }
  function updateCurrency(code){
    settings.currency = code;
    saveSettings();
    masterRefresh();
    showToast('Currency updated');
  }
  function toggleDarkMode(on){
    settings.darkMode = on;
    document.body.classList.toggle('dark', on);
    saveSettings();
    renderChart();
  }
  function resetAll(){
    if(!confirm('This will permanently delete all transaction data. Continue?')) return;
    transactions = [];
    saveTransactions();
    masterRefresh();
    showToast('All transaction data reset');
  }

  // ---------- Toast ----------
  let toastTimer = null;
  function showToast(msg){
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  document.addEventListener('DOMContentLoaded', init);