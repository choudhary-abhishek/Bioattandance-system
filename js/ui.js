const ui = {
    chartInstance: null,

    init() {
        this.updateClock();
        setInterval(() => this.updateClock(), 1000);
        this.initSettings();
        this.renderDashboard();
        if ('speechSynthesis' in window) {
            window.speechSynthesis.onvoiceschanged = () => this.populateVoices();
            this.populateVoices();
        }
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
            
            const user = DB.users.find(u => u.id === log.studentId);
            const photoHtml = user && user.photo ? 
                `<img src="${user.photo}" class="table-avatar" style="cursor:pointer" onclick="ui.showAnalytics('${log.studentId}')">` : 
                `<div class="table-avatar" style="display:flex;align-items:center;justify-content:center;font-size:0.8rem;font-weight:bold;color:var(--accent);background:rgba(14,165,233,0.1);cursor:pointer" onclick="ui.showAnalytics('${log.studentId}')">${log.name.charAt(0)}</div>`;
            
            const statusColor = log.status === 'Late' ? 'var(--warning)' : 'var(--success)';
            const statusBg = log.status === 'Late' ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)';
            const statusText = log.status === 'Late' ? '● Late' : '● Present';
            const badgeHtml = `<span class="badge" style="color:${statusColor}; border-color:${statusColor}; background:${statusBg}">${statusText}</span>`;

            tbody.innerHTML += `
                <tr>
                    <td>${photoHtml}</td>
                    <td>${time}</td>
                    <td style="font-family:var(--font-mono)">${log.studentId}</td>
                    <td style="font-weight:600; cursor:pointer" onclick="ui.showAnalytics('${log.studentId}')">${log.name}</td>
                    <td>${badgeHtml}</td>
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
            tbody.innerHTML = '<tr><td colspan="8" class="text-center">No records found.</td></tr>';
            return;
        }

        logs.forEach(log => {
            const d = new Date(log.timestamp);
            const user = DB.users.find(u => u.id === log.studentId);
            const photoHtml = user && user.photo ? 
                `<img src="${user.photo}" class="table-avatar" style="cursor:pointer" onclick="ui.showAnalytics('${log.studentId}')">` : 
                `<div class="table-avatar" style="display:flex;align-items:center;justify-content:center;font-size:0.8rem;font-weight:bold;color:var(--accent);background:rgba(14,165,233,0.1);cursor:pointer" onclick="ui.showAnalytics('${log.studentId}')">${log.name.charAt(0)}</div>`;
            const phone = log.phone || (user ? user.phone : 'N/A');
            
            const statusColor = log.status === 'Late' ? 'var(--warning)' : 'var(--success)';
            const statusBg = log.status === 'Late' ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)';
            const statusText = log.status === 'Late' ? '● Late' : '● Present';
            const badgeHtml = `<span class="badge" style="color:${statusColor}; border-color:${statusColor}; background:${statusBg}">${statusText}</span>`;

            tbody.innerHTML += `
                <tr>
                    <td>${photoHtml}</td>
                    <td>${d.toLocaleDateString()}</td>
                    <td>${d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</td>
                    <td style="font-family:var(--font-mono)">${log.studentId}</td>
                    <td style="font-weight:600; cursor:pointer" onclick="ui.showAnalytics('${log.studentId}')">${log.name}</td>
                    <td>${badgeHtml}</td>
                    <td style="font-family:var(--font-mono)">${phone}</td>
                    <td>
                        <button class="btn btn-secondary" style="color:var(--danger); border-color:var(--danger); padding: 4px 8px; font-size: 0.8rem;" onclick="app.deleteLog('${log.timestamp}', '${log.studentId}')">Delete</button>
                    </td>
                </tr>`;
        });
    },

    renderManage() {
        const tbody = document.querySelector('#manage-table tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        
        if (DB.users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No profiles found.</td></tr>';
            return;
        }

        DB.users.forEach(user => {
            const photoHtml = user.photo ? 
                `<img src="${user.photo}" class="table-avatar" style="cursor:pointer" onclick="ui.showAnalytics('${user.id}')">` : 
                `<div class="table-avatar" style="display:flex;align-items:center;justify-content:center;font-size:0.8rem;font-weight:bold;color:var(--accent);background:rgba(14,165,233,0.1);cursor:pointer" onclick="ui.showAnalytics('${user.id}')">${user.name.charAt(0)}</div>`;
            const phone = user.phone || 'N/A';
            tbody.innerHTML += `
                <tr>
                    <td>${photoHtml}</td>
                    <td style="font-family:var(--font-mono)">${user.id}</td>
                    <td style="font-weight:600; cursor:pointer" onclick="ui.showAnalytics('${user.id}')">${user.name}</td>
                    <td>${user.email}</td>
                    <td style="font-family:var(--font-mono)">${phone}</td>
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
    },

    /* System Settings Page Initializer */
    initSettings() {
        const s = DB.settings;
        document.getElementById('settings-start-time').value = s.startTime || "09:00";
        document.getElementById('settings-grace').value = s.gracePeriod !== undefined ? s.gracePeriod : 15;
        document.getElementById('settings-voice').checked = !!s.voiceEnabled;
        document.getElementById('settings-sound-enabled').checked = !!s.soundEnabled;
        document.getElementById('settings-sound-type').value = s.soundType || "beep";
        document.getElementById('settings-voice-rate').value = s.voiceRate !== undefined ? s.voiceRate : 1.0;
        document.getElementById('settings-voice-rate-val').innerText = s.voiceRate !== undefined ? s.voiceRate : "1.0";
        document.getElementById('settings-voice-pitch').value = s.voicePitch !== undefined ? s.voicePitch : 1.0;
        document.getElementById('settings-voice-pitch-val').innerText = s.voicePitch !== undefined ? s.voicePitch : "1.0";
        document.getElementById('settings-voice-text').value = s.voiceText || "Attendance marked for {name}";
        document.getElementById('settings-otp-registration').checked = !!s.otpOnRegistration;
        document.getElementById('settings-otp-method').value = s.otpMethod || "email";
        document.getElementById('settings-email-script-url').value = s.emailScriptUrl || "";
        document.getElementById('settings-admin-email').value = s.adminEmail || "";
        
        this.populateVoices();
        this.toggleVoiceSettingsFields();
        this.toggleOtpTypeFields();
    },

    populateVoices() {
        const select = document.getElementById('settings-voice-select');
        if (!select || !('speechSynthesis' in window)) return;
        
        const voices = window.speechSynthesis.getVoices();
        const configuredVoice = DB.settings.voiceName;
        
        select.innerHTML = '';
        
        // Sort: Indian English (en-IN) first, then other English (en), then alphabetical
        const sortedVoices = [...voices].sort((a, b) => {
            const aIN = a.lang === 'en-IN' || a.lang.toLowerCase().includes('en-in');
            const bIN = b.lang === 'en-IN' || b.lang.toLowerCase().includes('en-in');
            if (aIN && !bIN) return -1;
            if (!aIN && bIN) return 1;
            
            const aEN = a.lang.startsWith('en');
            const bEN = b.lang.startsWith('en');
            if (aEN && !bEN) return -1;
            if (!aEN && bEN) return 1;
            
            return a.name.localeCompare(b.name);
        });
        
        sortedVoices.forEach(voice => {
            const option = document.createElement('option');
            option.value = voice.name;
            let displayName = `${voice.name} (${voice.lang})`;
            if (voice.lang === 'en-IN' || voice.lang.toLowerCase().includes('en-in')) {
                displayName = `🇮🇳 ${voice.name} (Indian English)`;
            }
            option.textContent = displayName;
            select.appendChild(option);
        });
        
        if (configuredVoice && voices.some(v => v.name === configuredVoice)) {
            select.value = configuredVoice;
        } else {
            const indianVoice = voices.find(v => v.lang === 'en-IN' || v.lang.toLowerCase().includes('en-in'));
            if (indianVoice) {
                select.value = indianVoice.name;
            } else {
                const enVoice = voices.find(v => v.lang.startsWith('en'));
                if (enVoice) {
                    select.value = enVoice.name;
                } else if (voices.length > 0) {
                    select.value = voices[0].name;
                }
            }
        }
    },

    toggleVoiceSettingsFields() {
        const voiceAnnounce = document.getElementById('settings-voice').checked;
        const soundEnabled = document.getElementById('settings-sound-enabled').checked;
        const wrapper = document.getElementById('voice-settings-wrapper');
        const soundTypeGroup = document.getElementById('sound-type-wrapper');
        const voiceSelectGroup = document.getElementById('voice-select-wrapper');
        const voiceRateInput = document.getElementById('settings-voice-rate').closest('.settings-group');
        const voicePitchInput = document.getElementById('settings-voice-pitch').closest('.settings-group');
        const voiceTextInput = document.getElementById('settings-voice-text').closest('.settings-group');
        
        if (voiceAnnounce || soundEnabled) {
            wrapper.classList.remove('hidden');
            
            if (soundEnabled) {
                soundTypeGroup.classList.remove('hidden');
            } else {
                soundTypeGroup.classList.add('hidden');
            }
            
            if (voiceAnnounce) {
                voiceSelectGroup.classList.remove('hidden');
                voiceRateInput.classList.remove('hidden');
                voicePitchInput.classList.remove('hidden');
                voiceTextInput.classList.remove('hidden');
            } else {
                voiceSelectGroup.classList.add('hidden');
                voiceRateInput.classList.add('hidden');
                voicePitchInput.classList.add('hidden');
                voiceTextInput.classList.add('hidden');
            }
        } else {
            wrapper.classList.add('hidden');
        }
    },

    testSoundEffect() {
        const type = document.getElementById('settings-sound-type').value;
        app.playAudioEffect(type);
    },

    testVoiceAnnouncement() {
        if (!('speechSynthesis' in window)) {
            this.showToast("Speech synthesis not supported in this browser.", "error");
            return;
        }
        
        window.speechSynthesis.cancel();
        
        const voiceName = document.getElementById('settings-voice-select').value;
        const rate = parseFloat(document.getElementById('settings-voice-rate').value) || 1.0;
        const pitch = parseFloat(document.getElementById('settings-voice-pitch').value) || 1.0;
        let textTemplate = document.getElementById('settings-voice-text').value || "Attendance marked for {name}";
        const text = textTemplate.replace('{name}', 'Amit Choudhary');
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = rate;
        utterance.pitch = pitch;
        
        const voices = window.speechSynthesis.getVoices();
        const selectedVoice = voices.find(v => v.name === voiceName);
        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }
        
        window.speechSynthesis.speak(utterance);
    },

    toggleOtpTypeFields() {
        const otpReg = document.getElementById('settings-otp-registration').checked;
        const otpMethod = document.getElementById('settings-otp-method').value;

        const methodGroup = document.getElementById('settings-otp-method-group');
        const emailWrapper = document.getElementById('email-settings-wrapper');

        if (otpReg) {
            methodGroup.classList.remove('hidden');
            if (otpMethod === 'email') {
                emailWrapper.classList.remove('hidden');
            } else {
                emailWrapper.classList.add('hidden');
            }
        } else {
            methodGroup.classList.add('hidden');
            emailWrapper.classList.add('hidden');
        }
    },

    /* Interactive Student Profile Analytics Card modal rendering */
    showAnalytics(userId) {
        const user = DB.users.find(u => u.id === userId);
        if (!user) return;
        
        const modal = document.getElementById('analytics-modal');
        const content = document.getElementById('analytics-modal-content');
        
        const userLogs = DB.logs.filter(l => l.studentId === userId);
        const totalLogs = userLogs.length;
        
        const today = new Date().toISOString().split('T')[0];
        const presents = userLogs.filter(l => l.status !== 'Late').length;
        const lates = userLogs.filter(l => l.status === 'Late').length;
        
        // Calculate attendance rate over active days since registration
        const regDateStr = user.regDate ? user.regDate.split('T')[0] : today;
        const regDate = new Date(regDateStr);
        const systemDays = Math.max(1, Math.ceil((new Date() - regDate) / (1000 * 60 * 60 * 24)));
        const attendanceRate = Math.round((totalLogs / systemDays) * 100);

        // Generate last 14 days grid
        let calendarGridHtml = '';
        for (let i = 13; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const logForDay = userLogs.find(l => l.timestamp.startsWith(dateStr));
            
            let statusClass = 'absent';
            let statusText = 'Absent';
            let label = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
            
            if (logForDay) {
                statusClass = logForDay.status === 'Late' ? 'late' : 'present';
                statusText = logForDay.status === 'Late' ? 'Late Check-in' : 'Present (On-Time)';
            }
            
            calendarGridHtml += `
                <div class="calendar-cell ${statusClass}">
                    ${d.getDate()}
                    <span class="calendar-cell-tooltip">${label}: ${statusText}</span>
                </div>
            `;
        }
        
        const avatarHtml = user.photo ? 
            `<img src="${user.photo}" class="analytics-avatar">` : 
            `<div class="analytics-avatar" style="display:flex;align-items:center;justify-content:center;font-size:2rem;font-weight:bold;color:var(--accent);background:rgba(14,165,233,0.1)">${user.name.charAt(0)}</div>`;

        content.innerHTML = `
            <div class="analytics-header">
                ${avatarHtml}
                <div class="analytics-meta">
                    <h2>${user.name}</h2>
                    <p style="font-family:var(--font-mono);font-size:0.8rem">ID: ${user.id} • Registered: ${new Date(user.regDate || Date.now()).toLocaleDateString()}</p>
                    <p style="margin-top:4px;font-size:0.85rem">Email: ${user.email} • Phone: ${user.phone || 'N/A'}</p>
                </div>
            </div>
            
            <div class="analytics-stats">
                <div class="analytics-stat-card">
                    <h4>Attendance</h4>
                    <div class="num success">${attendanceRate}%</div>
                </div>
                <div class="analytics-stat-card">
                    <h4>On-Time</h4>
                    <div class="num">${presents} days</div>
                </div>
                <div class="analytics-stat-card">
                    <h4>Late</h4>
                    <div class="num warning">${lates} days</div>
                </div>
            </div>
            
            <div class="calendar-strip">
                <div class="calendar-title">Last 14 Days Check-in Heatmap</div>
                <div class="calendar-grid">
                    ${calendarGridHtml}
                </div>
            </div>
        `;
        
        modal.classList.remove('hidden');
    },

    closeAnalyticsModal(event) {
        if (!event || event.target === document.getElementById('analytics-modal') || event.target.classList.contains('modal-close')) {
            document.getElementById('analytics-modal').classList.add('hidden');
        }
    },


    showOTPModal() {
        const modal = document.getElementById('otp-modal');
        if (modal) {
            modal.classList.remove('hidden');
            const inputs = document.querySelectorAll('.otp-digit');
            inputs.forEach(input => input.value = '');
            if (inputs[0]) inputs[0].focus();
        }
    },

    closeOTPModal(event) {
        if (!event || event.target === document.getElementById('otp-modal') || event.target.classList.contains('modal-close') || event.target.innerText === 'Cancel') {
            const modal = document.getElementById('otp-modal');
            if (modal) modal.classList.add('hidden');
            app.pendingRegistration = null;
        }
    },

    handleOtpInput(element, index) {
        element.value = element.value.replace(/[^0-9]/g, '');
        if (element.value && index < 5) {
            const next = document.querySelectorAll('.otp-digit')[index + 1];
            if (next) next.focus();
        }
        const digits = Array.from(document.querySelectorAll('.otp-digit')).map(input => input.value).join('');
        if (digits.length === 6) {
            app.verifyOTP();
        }
    },

    handleOtpKeydown(event, index) {
        if (event.key === 'Backspace' && !event.target.value && index > 0) {
            const prev = document.querySelectorAll('.otp-digit')[index - 1];
            if (prev) {
                prev.focus();
                prev.value = '';
            }
        }
    }
};