// Import Firebase services
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, collection, addDoc, setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// --- KONFIGURASI APLIKASI ---
const appData = {
    nurses: ["Suriansyah, S.Kep., Ns", "Ahmad, S.Kep., Ns", "Budiman, A.Md.Kep", "Citra, S.Kep., Ns", "Dewi, A.Md.Kep"],
    operations: ["Appendectomy", "Hernia Repair", "Laparotomy", "Mastectomy", "Cholecystectomy", "Sectio Caesarea"],
    anesthesiaTypes: ["General Anesthesia", "Spinal Anesthesia", "Epidural Anesthesia", "Regional Block"],
    mobilityScale: [
        {level: 0, name: "Level 0: Pasif", description: "Pasien hanya berbaring, belum ada aktivitas sama sekali."},
        {level: 1, name: "Level 1: Fase Sangat Dini (0-6 Jam)", description: "Latihan napas dalam, batuk efektif, gerak sendi tangan/kaki, dan miring kanan/kiri di tempat tidur."},
        {level: 2, name: "Level 2: Fase Dini (6-12 Jam)", description: "Mampu duduk di tepi tempat tidur dengan kaki menggantung selama >1 menit."},
        {level: 3, name: "Level 3: Fase Progresif (12-24 Jam)", description: "Mampu berdiri di samping tempat tidur selama >1 menit (boleh dengan bantuan/pegangan)."},
        {level: 4, name: "Level 4: Fase Aktif Awal", description: "Mampu berpindah dari tempat tidur ke kursi dan berjalan beberapa langkah di sekitar tempat tidur."},
        {level: 5, name: "Level 5: Fase Aktif Lanjut (24-48 Jam)", description: "Mampu berjalan mandiri di dalam kamar pasien (minimal 3 meter)."},
        {level: 6, name: "Level 6: Fase Pemulihan", description: "Mampu berjalan mandiri di koridor atau luar kamar pasien."}
    ],
    questionnaire: {
        questions: [
            { id: 1, text: "Menggerakkan badan sesegera mungkin setelah operasi akan mempercepat pemulihan.", type: "positive" },
            { id: 2, text: "Bergerak setelah operasi sangat berbahaya karena bisa membuat jahitan lepas.", type: "negative" },
            { id: 3, text: "Latihan gerak di tempat tidur (seperti miring kanan-kiri) adalah langkah pertama yang penting.", type: "positive" },
            { id: 4, text: "Manfaat utama bergerak setelah operasi adalah agar bisa cepat pulang ke rumah.", type: "positive" },
            { id: 5, text: "Jika terasa sangat nyeri saat bergerak, lebih baik berhenti dan panggil perawat.", type: "positive" },
            { id: 6, text: "Peran keluarga tidak penting, karena mobilisasi adalah tugas perawat sepenuhnya.", type: "negative" }
        ],
        scoring: { positive: { setuju: 2, ragu: 1, tidak_setuju: 0 }, negative: { setuju: 0, ragu: 1, tidak_setuju: 2 } }
    }
};

// --- INISIALISASI FIREBASE ---
let db, auth;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'mlq-default-app';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;

async function initializeFirebase() {
    if (!firebaseConfig) {
        console.error("Firebase config not found.");
        showToast("Konfigurasi Firebase tidak ditemukan.", "error");
        return;
    }
    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        setLogLevel('debug');
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
        } else {
            await signInAnonymously(auth);
        }
        console.log("Firebase initialized and user signed in.", auth.currentUser?.uid);
        showToast("Terhubung ke database.", "success");
    } catch (error) {
        console.error("Firebase initialization error:", error);
        showToast("Gagal terhubung ke database.", "error");
    }
}

// --- STATE APLIKASI ---
let currentTestType = 'pretest';
let selectedMobilityLevel = null;
let observationData = { nurse: null, operation: null, anesthesia: null };

// --- FUNGSI UTAMA ---
document.addEventListener('DOMContentLoaded', () => {
    initializeFirebase();
    setupEventListeners();
    generateQuestionnaire();
    generateMobilityLevels();
});

function setupEventListeners() {
    document.querySelector('.nav-list').addEventListener('click', (e) => {
        const navItem = e.target.closest('.nav-item');
        if (navItem) navigateToPage(navItem.dataset.page);
    });
    document.querySelector('#landing-page .menu-grid').addEventListener('click', (e) => {
        const menuCard = e.target.closest('.menu-card');
        if (menuCard) navigateToPage(menuCard.dataset.page);
    });

    // Kuesioner Listeners
    document.querySelector('.test-selector').addEventListener('click', (e) => {
        const testBtn = e.target.closest('.test-btn');
        if (testBtn) setActiveTest(testBtn.dataset.test);
    });
    document.getElementById('questionnaire-form').addEventListener('submit', handleQuestionnaireSubmit);
    document.querySelector('.reset-btn').addEventListener('click', resetQuestionnaire);
    document.querySelector('.retry-btn').addEventListener('click', resetQuestionnaire);

    // Observasi Listeners
    document.getElementById('mobility-levels-container').addEventListener('click', (e) => {
        const levelItem = e.target.closest('.level-item');
        if (levelItem) selectMobilityLevel(parseInt(levelItem.dataset.level));
    });
    document.querySelector('.save-observation').addEventListener('click', saveObservation);

    // Modal Listeners
    document.getElementById('select-nurse-btn').addEventListener('click', () => openModal('nurse', (v) => { observationData.nurse = v; }));
    document.getElementById('select-op-btn').addEventListener('click', () => openModal('operation', (v) => { observationData.operation = v; }));
    document.getElementById('select-anesthesia-btn').addEventListener('click', () => openModal('anesthesia', (v) => { observationData.anesthesia = v; }));
    document.querySelector('.modal-close-btn').addEventListener('click', closeModal);
    document.querySelector('.modal-overlay').addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) closeModal();
    });
}

function navigateToPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`${pageId}-page`).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === pageId));
}

// --- FUNGSI MODAL (POP-UP) ---
function openModal(type, onSelectCallback) {
    const modal = document.getElementById('selection-modal');
    const title = document.getElementById('modal-title');
    const list = document.getElementById('modal-list');
    list.innerHTML = '';
    
    let data, titleText;
    switch (type) {
        case 'nurse': data = appData.nurses; titleText = 'Pilih Nama Perawat'; break;
        case 'operation': data = appData.operations; titleText = 'Pilih Tindakan Operasi'; break;
        case 'anesthesia': data = appData.anesthesiaTypes; titleText = 'Pilih Jenis Anestesi'; break;
    }

    title.textContent = titleText;
    data.forEach(item => {
        const button = document.createElement('button');
        button.className = 'modal-list-item';
        button.textContent = item;
        button.onclick = () => {
            document.getElementById(`selected-${type}`).textContent = item;
            onSelectCallback(item);
            closeModal();
        };
        list.appendChild(button);
    });
    modal.classList.remove('hidden');
}

function closeModal() {
    document.getElementById('selection-modal').classList.add('hidden');
}

// --- FUNGSI KUESIONER ---
function setActiveTest(testType) {
    currentTestType = testType;
    document.querySelectorAll('.test-btn').forEach(btn => {
        const isActive = btn.dataset.test === testType;
        btn.classList.toggle('active', isActive);
        btn.classList.toggle('btn--primary', isActive);
        btn.classList.toggle('btn--secondary', !isActive);
    });
    document.getElementById('test-mode-indicator').textContent = `Mode: ${testType === 'pretest' ? 'Pre-Test' : 'Post-Test'}`;
    resetQuestionnaire();
}

function generateQuestionnaire() {
    const container = document.getElementById('questions-container');
    container.innerHTML = appData.questionnaire.questions.map((q, i) => `
        <div class="question-item">
            <div class="question-text">${i + 1}. ${q.text}</div>
            <div class="question-options">
                <label class="option-label"><input type="radio" name="q_${q.id}" value="setuju" required> Setuju</label>
                <label class="option-label"><input type="radio" name="q_${q.id}" value="ragu" required> Ragu-ragu</label>
                <label class="option-label"><input type="radio" name="q_${q.id}" value="tidak_setuju" required> Tidak Setuju</label>
            </div>
        </div>
    `).join('');
}

async function handleQuestionnaireSubmit(e) {
    e.preventDefault();
    if (!db || !auth.currentUser) {
        showToast("Database belum siap.", "error");
        return;
    }
    
    const patientName = document.getElementById('q-patient-name').value;
    const patientRM = document.getElementById('q-patient-rm').value;
    const patientDOB = document.getElementById('q-patient-dob').value;
    
    if (!patientName || !patientRM || !patientDOB) {
        showToast("Harap lengkapi data diri pasien.", "error");
        return;
    }

    const formData = new FormData(e.target);
    let totalScore = 0;
    const answers = {};
    
    for (const q of appData.questionnaire.questions) {
        const answer = formData.get(`q_${q.id}`);
        if (!answer) {
            showToast("Harap jawab semua pertanyaan.", "warning");
            return;
        }
        answers[q.id] = answer;
        totalScore += appData.questionnaire.scoring[q.type][answer];
    }
    
    const resultData = {
        patientName, patientRM, patientDOB,
        testType: currentTestType,
        score: totalScore,
        answers,
        createdAt: new Date().toISOString(),
        userId: auth.currentUser.uid,
    };

    try {
        await addDoc(collection(db, 'artifacts', appId, 'users', auth.currentUser.uid, 'questionnaires'), resultData);
        showToast("Hasil kuesioner berhasil disimpan!", "success");
        displayResults(totalScore);
    } catch (err) {
        console.error("Error saving questionnaire: ", err);
        showToast("Gagal menyimpan hasil. Cek konsol.", "error");
    }
}

function displayResults(score) {
    document.getElementById('questionnaire-form').classList.add('hidden');
    const resultsContainer = document.getElementById('results-container');
    resultsContainer.classList.remove('hidden');

    document.getElementById('score-display').textContent = score;
    const interpretationEl = document.getElementById('interpretation');
    
    let interp;
    if (score >= 9) interp = { text: "Pengetahuan Baik", class: "good" };
    else if (score >= 5) interp = { text: "Pengetahuan Cukup", class: "fair" };
    else interp = { text: "Pengetahuan Kurang", class: "poor" };
    
    interpretationEl.innerHTML = `<h4>${interp.text}</h4>`;
    interpretationEl.className = `interpretation ${interp.class}`;
}

function resetQuestionnaire() {
    document.getElementById('questionnaire-form').reset();
    document.getElementById('questionnaire-form').classList.remove('hidden');
    document.getElementById('results-container').classList.add('hidden');
}

// --- FUNGSI OBSERVASI ---
function generateMobilityLevels() {
    const container = document.getElementById('mobility-levels-container');
    container.innerHTML = appData.mobilityScale.map(item => `
        <div class="level-item" data-level="${item.level}">
            <div class="level-header">
                <span class="level-number">${item.level}</span>
                <h4>${item.name}</h4>
            </div>
            <p>${item.description}</p>
        </div>
    `).join('');
}

function selectMobilityLevel(level) {
    if (level === null) {
        document.querySelectorAll('.level-item.selected').forEach(i => i.classList.remove('selected'));
    } else {
        document.querySelectorAll('.level-item').forEach(item => {
            item.classList.toggle('selected', parseInt(item.dataset.level) === level);
        });
    }
    selectedMobilityLevel = level;
}

async function saveObservation() {
    if (!db || !auth.currentUser) {
        showToast("Database belum siap.", "error");
        return;
    }
    const patientName = document.getElementById('obs-patient-name').value;
    const patientRM = document.getElementById('obs-patient-rm').value;
    const surgeryDate = document.getElementById('surgery-date').value;
    const observationTime = document.getElementById('observation-time').value;
    
    if (!patientName || !patientRM || !surgeryDate || !observationTime || selectedMobilityLevel === null || !observationData.nurse || !observationData.operation || !observationData.anesthesia) {
        showToast("Harap lengkapi semua data sebelum menyimpan.", "error");
        return;
    }
    const finalData = {
        patientName, patientRM, surgeryDate, observationTime,
        operation: observationData.operation,
        anesthesia: observationData.anesthesia,
        mobilityLevel: selectedMobilityLevel,
        mobilityLevelName: appData.mobilityScale.find(s => s.level === selectedMobilityLevel)?.name || 'Unknown',
        notes: document.getElementById('observation-notes').value,
        nurse: observationData.nurse,
        createdAt: new Date().toISOString(),
        userId: auth.currentUser.uid,
    };
    try {
        await addDoc(collection(db, 'artifacts', appId, 'users', auth.currentUser.uid, 'observations'), finalData);
        showToast("Data observasi berhasil disimpan!", "success");
        // Reset form
        document.getElementById('obs-patient-name').value = '';
        document.getElementById('obs-patient-rm').value = '';
        selectMobilityLevel(null);
        ['nurse', 'operation', 'anesthesia'].forEach(type => {
            observationData[type] = null;
            document.getElementById(`selected-${type}`).textContent = '';
        });
    } catch (e) {
        console.error("Error adding document: ", e);
        showToast("Gagal menyimpan data. Cek konsol.", "error");
    }
}

// --- FUNGSI BANTUAN (TOAST) ---
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastIcon = toast.querySelector('.toast-icon');
    toast.querySelector('.toast-message').textContent = message;
    
    const icons = { success: 'fas fa-check-circle', error: 'fas fa-times-circle', warning: 'fas fa-exclamation-triangle', info: 'fas fa-info-circle' };
    toastIcon.className = `toast-icon ${icons[type]}`;
    toast.className = `toast show ${type}`;
    
    setTimeout(() => { toast.classList.remove('show'); }, 3000);
}

