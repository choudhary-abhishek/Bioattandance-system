const ui = {
    chartInstance: null,

    init() {
        this.updateClock();
        setInterval(() => this.updateClock(), 1000);
        this.renderDashboard();
    },

    updateClock() {
        document.getElementById('current-time').innerText = new Date().toLocaleTimeString();
    },

    toggleTheme() {
        const body = document.body;
        const isDark = body.getAttribute('data-theme') !== 'light';
        body.setAttribute('data-theme', isDark ? 'light' : 'dark');
        
        const txt = document.getElementById('theme-text');
        const icon = document.getElementById('theme-icon');
        if (isDark) {
            txt.innerText = "Dark Mode";
            icon.innerText = "☾";
        } else {
            txt.innerText = "Light Mode";
            icon.innerText = "☀";
        }
    },

    renderDashboard() {
        const todayLogs = DB.getTodayLogs();
        
        // Update Cards
        document.getElementById('stat-total-students').innerText = DB.users.length;
        document.getElementById('stat-present-today').innerText = todayLogs.length;
        document.getElementById('stat-absent-today').innerText = Math.max(0, DB.users.length - todayLogs.length);
        
        const rate = DB.users.length ? Math.round((todayLogs.length / DB.users.length) * 100) : 0;
        document.getElementById('stat-attendance-rate').innerText = `${rate}%`;

        // Update Table (Top 5)
        const tbody = document.querySelector('#dashboard-table tbody');
        tbody.innerHTML = '';
        todayLogs.slice(0, 5).forEach(log => {
            const time = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            tbody.innerHTML += `
                <tr>
                    <td>${time}</td>
                    <td>${log.studentId}</td>
                    <td>${log.name}</td>
                    <td><span class="badge" style="color:var(--success); border-color:var(--success); background:rgba(16,185,129,0.1)">● Present</span></td>
                </tr>`;
        });

        this.updateChart();
    },

    updateChart() {
        if (!window.Chart) return; // Wait for CDN
        const ctx = document.getElementById('attendanceChart').getContext('2d');
        
        // Generate last 7 days data
        const labels = [];
        const data = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            labels.push(d.toLocaleDateString([], { weekday: 'short' }));
            
            // Count logs for this day
            const dateStr = d.toISOString().split('T')[0];
            const count = DB.logs.filter(l => l.timestamp.startsWith(dateStr)).length;
            data.push(count);
        }

        if (this.chartInstance) {
            this.chartInstance.data.datasets[0].data = data;
            this.chartInstance.update();
        } else {
            this.chartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Attendance',
                        data: data,
                        borderColor: '#0ea5e9',
                        backgroundColor: 'rgba(14, 165, 233, 0.2)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { stepSize: 1, color: '#94a3b8' } },
                        x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                    }
                }
            });
        }
    },

    renderHistory() {
        const date = document.getElementById('filter-date').value;
        const name = document.getElementById('filter-name').value.toLowerCase();
        
        let logs = DB.logs;
        
        if (date) logs = logs.filter(l => l.timestamp.startsWith(date));
        if (name) logs = logs.filter(l => l.name.toLowerCase().includes(name));

        const tbody = document.querySelector('#history-table tbody');
        tbody.innerHTML = '';

        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">No records found.</td></tr>';
            return;
        }

        logs.forEach(log => {
            const d = new Date(log.timestamp);
            tbody.innerHTML += `
                <tr>
                    <td>${d.toLocaleDateString()}</td>
                    <td>${d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</td>
                    <td>${log.studentId}</td>
                    <td>${log.name}</td>
                </tr>`;
        });
    },

    renderManage() {
        const tbody = document.querySelector('#manage-table tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        
        if (DB.users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">No profiles found.</td></tr>';
            return;
        }

        DB.users.forEach(user => {
            tbody.innerHTML += `
                <tr>
                    <td>${user.id}</td>
                    <td>${user.name}</td>
                    <td>${user.email}</td>
                    <td>
                        <button class="btn btn-secondary" style="color:var(--danger); border-color:var(--danger); padding: 4px 8px; font-size: 0.8rem;" onclick="app.deleteUser('${user.id}')">Delete</button>
                    </td>
                </tr>`;
        });
    },

    clearFilters() {
        document.getElementById('filter-date').value = '';
        document.getElementById('filter-name').value = '';
        this.renderHistory();
    },

    showToast(msg, type = 'success') {
        const container = document.getElementById('toast-container');
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        
        let icon = type === 'error' ? '⚠' : type === 'warning' ? '⚠' : '✓';
        
        el.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px; width:100%; justify-content:space-between">
                <div style="display:flex; align-items:center; gap:8px">
                    <span style="font-weight:bold; font-size:1.1rem">${icon}</span>
                    <span>${msg}</span>
                </div>
                <span style="cursor:pointer;opacity:0.6;font-size:1.2rem" onclick="this.parentElement.parentElement.remove()">×</span>
            </div>
        `;
        container.appendChild(el);
        setTimeout(() => el.remove(), 4000);
    }
};