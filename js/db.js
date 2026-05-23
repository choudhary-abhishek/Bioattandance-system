const DB = {
    users: [],
    logs: [],
    settings: {
        startTime: "09:00",
        gracePeriod: 15,
        voiceEnabled: true,
        livenessEnabled: false,
        otpOnRegistration: true,
        otpMethod: "email",
        emailScriptUrl: "",
        adminEmail: ""
    },

    init() {
        const u = localStorage.getItem('bio_users');
        const l = localStorage.getItem('bio_logs');
        const s = localStorage.getItem('bio_settings');
        if (u) this.users = JSON.parse(u);
        if (l) this.logs = JSON.parse(l);
        if (s) {
            this.settings = { ...this.settings, ...JSON.parse(s) };
        } else {
            this.saveSettings(this.settings);
        }
    },

    save() {
        localStorage.setItem('bio_users', JSON.stringify(this.users));
        localStorage.setItem('bio_logs', JSON.stringify(this.logs));
    },

    saveSettings(settingsObj) {
        this.settings = settingsObj;
        localStorage.setItem('bio_settings', JSON.stringify(this.settings));
    },

    addUser(userObj) {
        this.users.push(userObj);
        this.save();
    },

    addLog(logObj) {
        this.logs.unshift(logObj); // Add to top
        this.save();
    },

    getTodayLogs() {
        const today = new Date().toISOString().split('T')[0];
        return this.logs.filter(l => l.timestamp.startsWith(today));
    },

    checkDuplicate(studentId) {
        const today = new Date().toISOString().split('T')[0];
        return this.logs.some(l => l.studentId === studentId && l.timestamp.startsWith(today));
    },

    deleteUser(id) {
        this.users = this.users.filter(u => u.id !== id);
        this.logs = this.logs.filter(l => l.studentId !== id);
        this.save();
    },

    deleteLog(timestamp, studentId) {
        this.logs = this.logs.filter(l => !(l.timestamp === timestamp && l.studentId === studentId));
        this.save();
    }
};