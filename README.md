# BioAttend 🚀

**BioAttend** is a secure, highly accurate, and completely localized biometric attendance system that runs directly in your web browser. It utilizes state-of-the-art artificial intelligence (`face-api.js` powered by TensorFlow.js) to recognize faces in real-time.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Status](https://img.shields.io/badge/status-Active-success.svg)

## ✨ Core Features

- **True AI Facial Recognition:** Does not use simple motion tricks. It uses the `SSD MobileNetV1` neural network to map and extract 128-dimensional facial embeddings.
- **100% Local & Private:** All data, including face vectors and attendance logs, are stored securely inside your browser's LocalStorage. No images are ever sent to a remote server.
- **Voice Feedback:** The system audibly announces when attendance is successfully marked, allowing for hands-free operation.
- **Live Face Tracking:** Displays a real-time bounding box over the video feed, showing exactly who the AI recognizes.
- **Export Capabilities:** Easily export all logged attendance data to a CSV or Excel-compatible file.
- **Profile Management:** Register, view, and delete student profiles instantly from the dashboard.

## 🛠️ Technology Stack

- **Frontend:** HTML5, CSS3 (Modern Variables, Flexbox/Grid), Vanilla JavaScript.
- **AI Engine:** `face-api.js` (TensorFlow.js)
- **Database:** Browser LocalStorage API

## 🚀 Setup & Installation

Because BioAttend loads deep-learning models dynamically, it **cannot be opened directly via the `file://` protocol** due to modern browser CORS (Cross-Origin Resource Sharing) security policies. 

You must run it through a local web server.

### Option A: Using Python (Recommended)
If you have Python installed on your computer, running a local server is incredibly easy:
1. Open your terminal or command prompt.
2. Navigate to the project directory:
   ```bash
   cd path/to/BioAttend
   ```
3. Start the built-in HTTP server:
   ```bash
   python -m http.server 8000
   ```
4. Open your web browser and go to: `http://localhost:8000`

### Option B: Using VS Code Live Server
1. Open the project folder in Visual Studio Code.
2. Install the **Live Server** extension by Ritwick Dey.
3. Right-click on `index.html` and select **"Open with Live Server"**.

## 📖 Usage Guide

1. **Wait for Initialization:** When you first load the app, wait a few seconds for the AI models to load. You will see a toast notification when they are ready.
2. **Register a User:** Navigate to the **Registration** tab. Fill in the student's ID, Name, and Email. Look into the camera and click **"Capture Sample"**. Click **"Save Profile"**.
3. **Mark Attendance:** Go to the **Live Scanner** tab. Simply step in front of the camera. The system will detect your face, draw a box around it, and announce that your attendance has been marked!
4. **View Logs:** Navigate to the **History** tab to see all marked attendances. You can delete incorrect entries here.
5. **Manage Profiles:** Go to the **Manage** tab to view all registered students and completely delete their profiles and records if necessary.
6. **Export Data:** Go to the **Export** tab to download a CSV of your attendance logs.

## 🔒 Security Note
Since this application uses LocalStorage, clearing your browser data will wipe the database. For a production environment, you should hook the frontend up to a persistent backend database (like Firebase or PostgreSQL).
# Bioattandance-system
