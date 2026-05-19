const DB = {
    users: [],
    logs: [],

    init() {
        const u = localStorage.getItem('bio_users');
        const l = localStorage.getItem('bio_logs');
        if (u) this.users = JSON.parse(u);
        if (l) this.logs = JSON.parse(l);
        
        // Removed seed data since we need real face descriptors
    },

    save() {
        localStorage.setItem('bio_users', JSON.stringify(this.users));
        localStorage.setItem('bio_logs', JSON.stringify(this.logs));
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