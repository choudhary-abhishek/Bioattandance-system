const app = {
    streams: { reg: null, scan: null },
    timer: null,
    tempCaptures: [],
    modelsLoaded: false,

    async init() {
        DB.init();
        ui.init();
        await this.loadModels();
    },

    async loadModels() {
        try {
            ui.showToast("Loading AI Models...", "warning");
            await faceapi.nets.tinyFaceDetector.loadFromUri('./models');
            await faceapi.nets.faceLandmark68Net.loadFromUri('./models');
            await faceapi.nets.faceRecognitionNet.loadFromUri('./models');
            this.modelsLoaded = true;
            ui.showToast("AI Models Loaded Successfully!");
        } catch(e) {
            console.error("Model load error", e);
            ui.showToast("Failed to load AI models. Please use a local web server.", "error");
        }
    },

    // --- Navigation Controller ---
    router(viewId) {
        // Update Sidebar
        document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
        const btn = document.getElementById('nav-' + viewId);
        if (btn) btn.classList.add('active');

        // Switch Section
        document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
        document.getElementById(viewId).classList.add('active');

        // Set Title
        const titles = {
            'dashboard': 'Dashboard', 'registration': 'Registration', 
            'scanner': 'Live Scanner', 'history': 'Logs', 'export': 'Export', 'manage': 'Manage Profiles'
        };
        document.getElementById('page-title').innerText = titles[viewId];

        // Lifecycle Hooks
        if (viewId === 'registration') this.startCamera('reg');
        else this.stopCamera('reg');

        if (viewId === 'scanner') this.startScanner();
        else this.stopScanner();

        if (viewId === 'dashboard') ui.renderDashboard();
        if (viewId === 'history') ui.renderHistory();
        if (viewId === 'manage') ui.renderManage();
    },

    // --- Camera Hardware Logic ---
    async startCamera(mode) {
        const id = mode === 'reg' ? 'reg-video' : 'scan-video';
        const video = document.getElementById(id);
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = stream;
            this.streams[mode] = stream;
        } catch (e) {
            ui.showToast("Camera Access Denied", "error");
        }
    },

    stopCamera(mode) {
        if (this.streams[mode]) {
            this.streams[mode].getTracks().forEach(t => t.stop());
            this.streams[mode] = null;
        }
    },

    // --- Registration Logic ---
    async capturePreview() {
        if (!this.modelsLoaded) return ui.showToast("AI Models still loading...", "warning");
        const video = document.getElementById('reg-video');
        if (!video.srcObject) return;

        const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();
        if (!detection) return ui.showToast("No face detected! Please look at the camera.", "error");

        const canvas = document.getElementById('reg-canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);

        this.tempCaptures.push({
            descriptor: detection.descriptor,
            image: canvas.toDataURL('image/jpeg')
        });
        
        // Update UI Slot
        const slots = document.getElementById('reg-previews').children;
        if (this.tempCaptures.length <= 3) {
            slots[this.tempCaptures.length - 1].innerHTML = `<img src="${this.tempCaptures[this.tempCaptures.length-1].image}">`;
        }
        ui.showToast(`Sample ${this.tempCaptures.length}/3 captured`);
    },

    registerUser() {
        const id = document.getElementById('reg-id').value;
        const name = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;

        if (!id || !name || !email) return ui.showToast("Fill all fields", "error");
        if (this.tempCaptures.length < 1) return ui.showToast("Capture at least 1 sample", "warning");

        DB.addUser({
            id, name, email,
            descriptor: Array.from(this.tempCaptures[0].descriptor), // Convert Float32Array
            regDate: new Date().toISOString()
        });

        ui.showToast(`User ${name} Registered`);
        
        // Reset
        document.getElementById('reg-id').value = '';
        document.getElementById('reg-name').value = '';
        document.getElementById('reg-email').value = '';
        this.tempCaptures = [];
        document.querySelectorAll('.preview-img').forEach(el => el.innerHTML = el.getAttribute('data-index') || '');
        ui.renderDashboard();
    },

    // --- Scanner & Real Face Matching Logic ---
    startScanner() {
        this.startCamera('scan');
        
        const video = document.getElementById('scan-video');
        const canvas = document.getElementById('scan-canvas');
        const overlay = document.getElementById('scan-overlay');
        const msg = document.getElementById('scan-message');
        const dot = document.getElementById('scan-dot');

        let lastMatchTime = 0;

        // Ensure canvas matches video dimensions
        video.addEventListener('loadedmetadata', () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
        }, { once: true });

        this.timer = setInterval(async () => {
            if (!video.srcObject || video.readyState !== 4 || !this.modelsLoaded) return;

            const displaySize = { width: video.videoWidth, height: video.videoHeight };
            faceapi.matchDimensions(canvas, displaySize);

            const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();
            
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height); // clear previous drawings

            if (detection) {
                overlay.className = 'overlay-scan scanning';
                dot.className = "status-dot active";
                
                const resizedDetection = faceapi.resizeResults(detection, displaySize);
                
                if (DB.users.length > 0) {
                    const labeledDescriptors = DB.users.map(u => new faceapi.LabeledFaceDescriptors(u.id, [new Float32Array(u.descriptor)]));
                    const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.45); // threshold 0.45
                    const match = faceMatcher.findBestMatch(detection.descriptor);
                    
                    // Retrieve User Name if matched
                    let labelText = match.label;
                    if (match.label !== 'unknown') {
                        const userObj = DB.users.find(u => u.id === match.label);
                        if (userObj) labelText = userObj.name;
                    }

                    const boxColor = match.label === 'unknown' ? 'red' : '#2ea043';
                    const drawBox = new faceapi.draw.DrawBox(resizedDetection.detection.box, { label: labelText, boxColor: boxColor });
                    drawBox.draw(canvas);
                    
                    if (match.label !== 'unknown') {
                        msg.innerText = `Recognized: ${labelText}`;
                        
                        // Prevent spamming attendance calls
                        const now = Date.now();
                        if (now - lastMatchTime > 5000) {
                            this.processAttendance(match.label);
                            lastMatchTime = now;
                        }
                    } else {
                        msg.innerText = "Unknown Face";
                        dot.className = "status-dot danger";
                        overlay.className = 'overlay-scan spoof-detected';
                    }
                } else {
                    msg.innerText = "No registered users";
                    faceapi.draw.drawDetections(canvas, resizedDetection);
                }
            } else {
                overlay.className = 'overlay-scan';
                msg.innerText = "Scanning for Faces...";
                dot.className = "status-dot";
            }
        }, 1000); // Check every 1000ms for better performance
    },

    stopScanner() {
        if (this.timer) clearInterval(this.timer);
        this.stopCamera('scan');
        // Clear canvas
        const canvas = document.getElementById('scan-canvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        const overlay = document.getElementById('scan-overlay');
        if (overlay) overlay.className = 'overlay-scan';
    },

    processAttendance(id) {
        const user = DB.users.find(u => u.id === id);
        if (!user) return;

        if (DB.checkDuplicate(id)) {
            ui.showToast("Duplicate: Already logged today", "warning");
            return;
        }

        DB.addLog({
            timestamp: new Date().toISOString(),
            studentId: user.id,
            name: user.name,
            email: user.email
        });

        ui.showToast(`✅ Attendance Marked: ${user.name}`);
        ui.renderDashboard(); // Update stats
        
        // Voice Feedback
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(`Attendance marked for ${user.name}`);
            utterance.rate = 1.0;
            window.speechSynthesis.speak(utterance);
        }
    },

    exportData(format) {
        if (DB.logs.length === 0) return ui.showToast("No data to export", "error");

        if (format === 'pdf') {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            doc.setFontSize(18);
            doc.text("Biometric Attendance Report", 14, 22);
            doc.setFontSize(11);
            doc.setTextColor(100);
            doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);

            const tableData = DB.logs.map(l => {
                const d = new Date(l.timestamp);
                return [d.toLocaleDateString(), d.toLocaleTimeString(), l.studentId, l.name, l.email];
            });

            doc.autoTable({
                startY: 40,
                head: [['Date', 'Time', 'Student ID', 'Name', 'Email']],
                body: tableData,
                theme: 'grid',
                headStyles: { fillColor: [14, 165, 233] },
            });

            doc.save(`attendance_report_${new Date().toISOString().slice(0,10)}.pdf`);
            ui.showToast("PDF Downloaded successfully!");
            return;
        }

        let csv = "Date,Time,ID,Name,Email\n";
        DB.logs.forEach(l => {
            const d = new Date(l.timestamp);
            csv += `${d.toLocaleDateString()},${d.toLocaleTimeString()},${l.studentId},${l.name},${l.email}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `attendance_${new Date().toISOString().slice(0,10)}.${format}`;
        link.click();
        ui.showToast("Export Downloaded");
    },

    // --- Management Logic ---
    deleteUser(id) {
        if (!confirm('Are you sure you want to delete this user and all their attendance records?')) return;
        DB.deleteUser(id);
        ui.showToast('User deleted successfully');
        if (document.getElementById('manage').classList.contains('active')) ui.renderManage();
        ui.renderDashboard();
    },

    deleteLog(timestamp, studentId) {
        if (!confirm('Are you sure you want to delete this attendance record?')) return;
        DB.deleteLog(timestamp, studentId);
        ui.showToast('Attendance record deleted');
        if (document.getElementById('history').classList.contains('active')) ui.renderHistory();
        ui.renderDashboard();
    }
};

// Start Application
window.addEventListener('DOMContentLoaded', () => app.init());