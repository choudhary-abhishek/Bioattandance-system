const app = {
    streams: { reg: null, scan: null },
    timer: null,
    tempCaptures: [],
    modelsLoaded: false,
    pendingRegistration: null,
    // Liveness checks removed as requested

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
        } catch (e) {
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
            'scanner': 'Live Scanner', 'history': 'Logs', 'export': 'Export', 'manage': 'Manage Profiles', 'settings': 'System Settings'
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
        if (viewId === 'settings') ui.initSettings();
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
        if (this.tempCaptures.length >= 3) {
            ui.showToast("Maximum of 3 samples reached. Clear or save profile.", "warning");
            return;
        }

        const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();
        if (!detection) return ui.showToast("No face detected! Please look at the camera.", "error");

        const box = detection.detection.box;
        const faceCanvas = document.createElement('canvas');
        faceCanvas.width = 100;
        faceCanvas.height = 100;
        const faceCtx = faceCanvas.getContext('2d');

        // Add 15% margin around the face
        const margin = 0.15;
        const sx = Math.max(0, box.x - box.width * margin);
        const sy = Math.max(0, box.y - box.height * margin);
        const sw = Math.min(video.videoWidth - sx, box.width * (1 + margin * 2));
        const sh = Math.min(video.videoHeight - sy, box.height * (1 + margin * 2));

        faceCtx.drawImage(video, sx, sy, sw, sh, 0, 0, 100, 100);
        const croppedImage = faceCanvas.toDataURL('image/jpeg', 0.7);

        this.tempCaptures.push({
            descriptor: detection.descriptor,
            image: croppedImage
        });

        // Update UI Slot
        const slots = document.getElementById('reg-previews').children;
        if (this.tempCaptures.length <= 3) {
            slots[this.tempCaptures.length - 1].innerHTML = `<img src="${this.tempCaptures[this.tempCaptures.length - 1].image}">`;
        }
        ui.showToast(`Sample ${this.tempCaptures.length}/3 captured`);
    },

    async registerUser() {
        const id = document.getElementById('reg-id').value.trim();
        const name = document.getElementById('reg-name').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const phone = document.getElementById('reg-phone').value.trim();

        if (!id || !name || !email || !phone) return ui.showToast("Fill all fields", "error");
        if (this.tempCaptures.length < 1) return ui.showToast("Capture at least 1 sample", "warning");

        const newStudent = {
            id,
            name,
            email,
            phone,
            photo: this.tempCaptures[0].image,
            descriptor: Array.from(this.tempCaptures[0].descriptor),
            regDate: new Date().toISOString()
        };

        if (DB.settings.otpOnRegistration) {
            let otp = "123456";
            const method = DB.settings.otpMethod || "email";
            const scriptUrl = DB.settings.emailScriptUrl;

            if (method === 'email' && scriptUrl) {
                // Generate a random 6-digit code
                otp = Math.floor(100000 + Math.random() * 900000).toString();
                ui.showToast("Sending OTP via Email...", "warning");
                try {
                    const mailSubject = "BioAttend Registration OTP Verification";
                    const mailBody = `Hello ${name},\n\nYour 6-digit security OTP code for BioAttend registration is: ${otp}\n\nPlease enter this code to authorize and complete your registration.\n\nThank you,\nBioAttend System`;
                    
                    const success = await this.sendEmail(email, mailSubject, mailBody);
                    if (success) {
                        ui.showToast("OTP sent successfully to your email!");
                    } else {
                        ui.showToast("Email send failed. Use dummy OTP 123456.", "warning");
                        otp = "123456";
                    }
                } catch (e) {
                    ui.showToast("Email error. Use dummy OTP 123456.", "warning");
                    otp = "123456";
                }
            } else if (method === 'email') {
                ui.showToast("Email script URL not configured. Use dummy OTP 123456.", "warning");
            } else {
                ui.showToast("OTP verification required. Use dummy OTP 123456.", "warning");
            }

            this.pendingRegistration = {
                student: newStudent,
                otp: otp
            };

            ui.showOTPModal();
        } else {
            DB.addUser(newStudent);
            ui.showToast(`User ${name} Registered successfully!`);
            this.resetRegistrationForm();
        }
    },

    verifyOTP() {
        if (!this.pendingRegistration) return;

        const digits = Array.from(document.querySelectorAll('.otp-digit')).map(input => input.value).join('');
        if (digits.length < 6) {
            ui.showToast("Please enter all 6 digits of the OTP", "warning");
            return;
        }

        if (digits === this.pendingRegistration.otp) {
            const student = this.pendingRegistration.student;
            DB.addUser(student);
            ui.showToast(`User ${student.name} Registered successfully!`);
            this.resetRegistrationForm();
            ui.closeOTPModal();
            this.pendingRegistration = null;
        } else {
            ui.showToast("Invalid OTP code. Please try again.", "error");
        }
    },

    resetRegistrationForm() {
        document.getElementById('reg-id').value = '';
        document.getElementById('reg-name').value = '';
        document.getElementById('reg-email').value = '';
        document.getElementById('reg-phone').value = '';
        this.tempCaptures = [];
        document.querySelectorAll('.preview-img').forEach(el => el.innerHTML = el.getAttribute('data-index') || '');
        ui.renderDashboard();
    },

    async sendEmail(recipient, subject, body) {
        const scriptUrl = DB.settings.emailScriptUrl;
        if (!scriptUrl) {
            return false;
        }
        try {
            const response = await fetch(scriptUrl, {
                method: 'POST',
                mode: 'cors',
                headers: {
                    'Content-Type': 'text/plain'
                },
                body: JSON.stringify({
                    to: recipient,
                    subject: subject,
                    body: body
                })
            });
            if (response.ok) {
                return true;
            } else {
                console.error("Email send failed status:", response.status);
                return false;
            }
        } catch (e) {
            console.error("Email Exception", e);
            return false;
        }
    },

    // --- Scanner & Real Face Matching Logic ---
    playAudioEffect(type) {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            
            if (type === 'beep') {
                const playBeep = (freq, start, duration) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, start);
                    gain.gain.setValueAtTime(0.12, start);
                    gain.gain.exponentialRampToValueAtTime(0.01, start + duration - 0.02);
                    osc.start(start);
                    osc.stop(start + duration);
                };
                
                const now = ctx.currentTime;
                playBeep(880, now, 0.08); // A5 (880Hz)
                playBeep(1046.5, now + 0.09, 0.12); // C6 (1046.5Hz)
            } else if (type === 'chime') {
                const playChimeTone = (freq, start, duration) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(freq, start);
                    gain.gain.setValueAtTime(0.1, start);
                    gain.gain.exponentialRampToValueAtTime(0.001, start + duration - 0.05);
                    osc.start(start);
                    osc.stop(start + duration);
                };
                
                const now = ctx.currentTime;
                playChimeTone(523.25, now, 0.2); // C5
                playChimeTone(659.25, now + 0.08, 0.2); // E5
                playChimeTone(783.99, now + 0.16, 0.35); // G5
            }
        } catch (e) {
            console.error("Audio synthesis error", e);
        }
    },

    startScanner() {
        this.startCamera('scan');

        const video = document.getElementById('scan-video');
        const canvas = document.getElementById('scan-canvas');
        const overlay = document.getElementById('scan-overlay');
        const msg = document.getElementById('scan-message');
        const dot = document.getElementById('scan-dot');

        let lastMatchTime = 0;

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
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (detection) {
                overlay.className = 'overlay-scan scanning';
                dot.className = "status-dot active";

                const resizedDetection = faceapi.resizeResults(detection, displaySize);

                if (DB.users.length > 0) {
                    const labeledDescriptors = DB.users.map(u => new faceapi.LabeledFaceDescriptors(u.id, [new Float32Array(u.descriptor)]));
                    const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.45);
                    const match = faceMatcher.findBestMatch(detection.descriptor);

                    let labelText = match.label;
                    if (match.label !== 'unknown') {
                        const userObj = DB.users.find(u => u.id === match.label);
                        if (userObj) labelText = userObj.name;
                    }

                    const boxColor = match.label === 'unknown' ? 'red' : '#0ea5e9';
                    const drawBox = new faceapi.draw.DrawBox(resizedDetection.detection.box, { label: labelText, boxColor: boxColor });
                    drawBox.draw(canvas);

                    if (match.label !== 'unknown') {
                        msg.innerText = `Recognized: ${labelText}`;

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
        }, 1000);
    },

    stopScanner() {
        if (this.timer) clearInterval(this.timer);
        this.stopCamera('scan');
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

        const now = new Date();
        const settings = DB.settings;

        let status = "Present";
        if (settings.startTime) {
            const [startHour, startMin] = settings.startTime.split(':').map(Number);
            const checkTime = new Date();
            checkTime.setHours(startHour, startMin + (settings.gracePeriod || 0), 0, 0);

            if (now > checkTime) {
                status = "Late";
            }
        }

        DB.addLog({
            timestamp: now.toISOString(),
            studentId: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone || '',
            status: status
        });

        ui.showToast(`✅ Attendance Marked: ${user.name} (${status})`);
        ui.renderDashboard(); // Update stats

        // Sound Feedback
        if (settings.soundEnabled) {
            this.playAudioEffect(settings.soundType);
        }

        // Voice Feedback
        if (settings.voiceEnabled && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            
            const template = settings.voiceText || "Attendance marked for {name}";
            const text = template.replace('{name}', user.name);
            
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = parseFloat(settings.voiceRate) || 1.0;
            utterance.pitch = parseFloat(settings.voicePitch) || 1.0;
            
            if (settings.voiceName) {
                const voices = window.speechSynthesis.getVoices();
                const selectedVoice = voices.find(v => v.name === settings.voiceName);
                if (selectedVoice) {
                    utterance.voice = selectedVoice;
                }
            }
            window.speechSynthesis.speak(utterance);
        }

        // Email notification confirmation
        const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateString = now.toLocaleDateString();
        const statusText = status === 'Late' ? 'Late Check-in' : 'Present (On-Time)';
        
        const emailSubject = `Attendance Marked: ${user.name} (${status})`;
        const emailBody = `Hello ${user.name},\n\nYour attendance has been successfully logged by BioAttend.\n\nDate: ${dateString}\nTime: ${timeString}\nStatus: ${statusText}\nID: ${user.id}\n\nThank you,\nBioAttend System`;
        
        // Send email to student
        if (user.email) {
            this.sendEmail(user.email, emailSubject, emailBody);
        }
        
        // Send copy to admin if configured
        if (settings.adminEmail) {
            this.sendEmail(settings.adminEmail, `[Admin Notification] ${emailSubject}`, emailBody);
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
                const user = DB.users.find(u => u.id === l.studentId);
                return [d.toLocaleDateString(), d.toLocaleTimeString(), l.studentId, l.name, l.status || 'Present', l.email, l.phone || (user ? user.phone : 'N/A')];
            });

            doc.autoTable({
                startY: 40,
                head: [['Date', 'Time', 'ID', 'Name', 'Status', 'Email', 'Phone']],
                body: tableData,
                theme: 'grid',
                headStyles: { fillColor: [14, 165, 233] },
            });

            doc.save(`attendance_report_${new Date().toISOString().slice(0, 10)}.pdf`);
            ui.showToast("PDF Downloaded successfully!");
            return;
        }

        let csv = "Date,Time,ID,Name,Status,Email,Phone\n";
        DB.logs.forEach(l => {
            const d = new Date(l.timestamp);
            const user = DB.users.find(u => u.id === l.studentId);
            csv += `${d.toLocaleDateString()},${d.toLocaleTimeString()},${l.studentId},${l.name},${l.status || 'Present'},${l.email},${l.phone || (user ? user.phone : 'N/A')}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `attendance_${new Date().toISOString().slice(0, 10)}.${format}`;
        link.click();
        ui.showToast("Export Downloaded");
    },

    // --- Settings Panel Controller ---
    saveSettings() {
        const startTime = document.getElementById('settings-start-time').value;
        const gracePeriod = parseInt(document.getElementById('settings-grace').value) || 0;
        const voiceEnabled = document.getElementById('settings-voice').checked;
        const soundEnabled = document.getElementById('settings-sound-enabled').checked;
        const soundType = document.getElementById('settings-sound-type').value;
        const voiceName = document.getElementById('settings-voice-select').value;
        const voiceRate = parseFloat(document.getElementById('settings-voice-rate').value) || 1.0;
        const voicePitch = parseFloat(document.getElementById('settings-voice-pitch').value) || 1.0;
        const voiceText = document.getElementById('settings-voice-text').value.trim();
        const otpOnRegistration = document.getElementById('settings-otp-registration').checked;
        const otpMethod = document.getElementById('settings-otp-method').value;
        const emailScriptUrl = document.getElementById('settings-email-script-url').value.trim();
        const adminEmail = document.getElementById('settings-admin-email').value.trim();

        DB.saveSettings({
            startTime,
            gracePeriod,
            voiceEnabled,
            soundEnabled,
            soundType,
            voiceName,
            voiceRate,
            voicePitch,
            voiceText,
            otpOnRegistration,
            otpMethod,
            emailScriptUrl,
            adminEmail
        });

        ui.showToast("Settings saved successfully!");
        this.router('dashboard');
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