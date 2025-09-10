// Import Firebase services
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, collection, addDoc, doc, onSnapshot, updateDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// --- KONFIGURASI APLIKASI ---
const appData = {
    nurses: ["Suriansyah, S.Kep., Ns", "Ahmad, S.Kep., Ns", "Budiman, A.Md.Kep", "Citra, S.Kep., Ns", "Dewi, A.Md.Kep"],
    operations: ["Appendectomy", "Hernia Repair", "Laparotomy", "Mastectomy", "Cholecystectomy", "Sectio Caesarea"],
    anesthesiaTypes: ["General Anesthesia", "Spinal Anesthesia", "Epidural Anesthesia", "Regional Block"],
    mobilityScale: [
        {level: 0, name: "Level 0: Pasif"},
        {level: 1, name: "Level 1: Fase Sangat Dini"},
        {level: 2, name: "Level 2: Fase Dini"},
        {level: 3, name: "Level 3: Fase Progresif"},
        {level: 4, name: "Level 4: Fase Aktif Awal"},
        {level: 5, name: "Level 5: Fase Aktif Lanjut"},
        {level: 6, name: "Level 6: Fase Pemulihan"}
    ],
    questionnaire: {
        questions: [
            { id: 1, text: "Menggerakkan badan sesegera mungkin setelah operasi akan mempercepat pemulihan.", type: "positive" },
            { id: 2, text: "Bergerak setelah operasi sangat berbahaya karena bisa membuat jahitan lepas.", type: "negative" },
            { id: 3, text: "Latihan gerak di tempat tidur adalah langkah pertama yang penting.", type: "positive" },
            { id: 4, text: "Manfaat utama bergerak setelah operasi adalah agar bisa cepat pulang.", type: "positive" },
            { id: 5, text: "Jika terasa sangat nyeri saat bergerak, lebih baik berhenti dan panggil perawat.", type: "positive" },
            { id: 6, text: "Peran keluarga tidak penting, mobilisasi adalah tugas perawat sepenuhnya.", type: "negative" }
        ],
        scoring: { positive: { setuju: 2, ragu: 1, tidak_setuju: 0 }, negative: { setuju: 0, ragu: 1, tidak_setuju: 2 } }
    }
};

// --- INISIALISASI FIREBASE ---

// 1. Deklarasikan variabel db dan auth di scope yang lebih tinggi
let db, auth;

// 2. Tempelkan konfigurasi Firebase baru Anda di sini
const firebaseConfig = {
  apiKey: "AIzaSyDXLA7gDQcQtoOrgdW2PnTmYg8q7YQ0OLU",
  authDomain: "mobilisasi-69979.firebaseapp.com",
  projectId: "mobilisasi-69979",
  storageBucket: "mobilisasi-69979.firebasestorage.app",
  messagingSenderId: "97383306678",
  appId: "1:97383306678:web:559cfabae7d7ba24631d17",
  measurementId: "G-HQL9JQBMN3"
};

// 3. Modifikasi fungsi initializeFirebase untuk menggunakan konfigurasi baru
async function initializeFirebase() {
    try {
        // Initialize Firebase
        const app = initializeApp(firebaseConfig);
        
        // Initialize services
        db = getFirestore(app);
        auth = getAuth(app);

        // Sign in user (anonymously in this case)
        await signInAnonymously(auth);
        
        console.log("Firebase berhasil diinisialisasi. User:", auth.currentUser?.uid);
        
        // Panggil fungsi lain yang bergantung pada Firebase setelah inisialisasi berhasil
        listenForPatientUpdates();

    } catch (error) {
        console.error("Gagal inisialisasi Firebase:", error);
        showToast("Gagal terhubung ke database.", "error");
    }
}

// --- STATE APLIKASI & EVENT LISTENERS ---
let patientsData = [];
let currentTestType = 'pretest';

document.addEventListener('DOMContentLoaded', () => {
    initializeFirebase();
    setupEventListeners();
    generateQuestionnaire();
    startRealtimeClocks();
});

function setupEventListeners() {
    // Navigasi
    document.querySelector('.nav-list').addEventListener('click', e => {
        const navItem = e.target.closest('.nav-item');
        if (navItem) navigateToPage(navItem.dataset.page);
    });
    document.querySelector('.menu-grid').addEventListener('click', e => {
        const menuCard = e.target.closest('.menu-card');
        if (menuCard) navigateToPage(menuCard.dataset.page);
    });
    
    // Kuesioner
    document.querySelector('.test-selector').addEventListener('click', e => {
        const testBtn = e.target.closest('.test-btn');
        if (testBtn) setActiveTest(testBtn.dataset.test);
    });
    document.getElementById('questionnaire-form').addEventListener('submit', handleQuestionnaireSubmit);
    document.querySelector('.reset-btn').addEventListener('click', resetQuestionnaire);
    document.querySelector('.retry-btn').addEventListener('click', resetQuestionnaire);

    // Dasbor Pasien
    document.getElementById('add-patient-btn').addEventListener('click', () => openPatientModal());
    document.body.addEventListener('click', e => {
        if (e.target.closest('.update-patient-btn')) {
            const patientId = e.target.closest('.update-patient-btn').dataset.id;
            openPatientModal(patientId);
        }
        if (e.target.matches('.modal-close-btn') || e.target.matches('.modal-overlay')) {
            closePatientModal();
        }
    });
}

function navigateToPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`${pageId}-page`).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === pageId));
}

// --- FUNGSI KUESIONER (DIKEMBALIKAN) ---
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
            <p>${i + 1}. ${q.text}</p>
            <div class="form-group">
                <label class="option-label"><input type="radio" name="q_${q.id}" value="setuju" required> Setuju</label>
                <label class="option-label"><input type="radio" name="q_${q.id}" value="ragu"> Ragu-ragu</label>
                <label class="option-label"><input type="radio" name="q_${q.id}" value="tidak_setuju"> Tidak Setuju</label>
            </div>
        </div>`).join('');
}

async function handleQuestionnaireSubmit(e) {
    e.preventDefault();
    if (!auth.currentUser) return showToast("Database belum siap.", "error");
    
    const patientName = document.getElementById('q-patient-name').value;
    const patientRM = document.getElementById('q-patient-rm').value;
    if (!patientName || !patientRM) return showToast("Harap lengkapi Nama dan Nomor RM.", "error");

    const formData = new FormData(e.target);
    let totalScore = 0;
    const answers = {};
    
    for (const q of appData.questionnaire.questions) {
        const answer = formData.get(`q_${q.id}`);
        if (!answer) return showToast("Harap jawab semua pertanyaan.", "warning");
        answers[q.id] = answer;
        totalScore += appData.questionnaire.scoring[q.type][answer];
    }
    
    const resultData = { patientName, patientRM, testType: currentTestType, score: totalScore, answers, createdAt: new Date().toISOString(), userId: auth.currentUser.uid };

    try {
        await addDoc(collection(db, 'artifacts', appId, 'users', auth.currentUser.uid, 'questionnaires'), resultData);
        showToast("Hasil kuesioner berhasil disimpan!", "success");
        displayResults(totalScore);
    } catch (err) {
        console.error("Error saving questionnaire: ", err);
        showToast("Gagal menyimpan hasil.", "error");
    }
}

function displayResults(score) {
    document.getElementById('questionnaire-form').classList.add('hidden');
    const resultsContainer = document.getElementById('results-container');
    resultsContainer.classList.remove('hidden');
    document.getElementById('score-display').textContent = score;
    const interpEl = document.getElementById('interpretation');
    let interp;
    if (score >= 9) interp = { text: "Pengetahuan Baik", class: "good" };
    else if (score >= 5) interp = { text: "Pengetahuan Cukup", class: "fair" };
    else interp = { text: "Pengetahuan Kurang", class: "poor" };
    interpEl.innerHTML = `<h4>${interp.text}</h4>`;
    interpEl.className = `interpretation ${interp.class}`;
}

function resetQuestionnaire() {
    document.getElementById('questionnaire-form').reset();
    document.getElementById('questionnaire-form').classList.remove('hidden');
    document.getElementById('results-container').classList.add('hidden');
}

// --- FUNGSI DASBOR PASIEN ---
function listenForPatientUpdates() {
    if (!auth.currentUser) return setTimeout(listenForPatientUpdates, 500);
    const q = query(collection(db, 'artifacts', appId, 'users', auth.currentUser.uid, 'patients'), orderBy("surgeryFinishTime", "desc"));
    onSnapshot(q, snapshot => {
        patientsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderPatientTable(patientsData);
    }, error => console.error("Error listening:", error));
}

function renderPatientTable(patients) {
    const tableBody = document.getElementById('patient-table-body');
    if (patients.length === 0) {
        tableBody.innerHTML = `<tr class="no-data-row"><td colspan="6">Belum ada data pasien.</td></tr>`;
        return;
    }
    tableBody.innerHTML = patients.map(p => {
        const latestObs = p.observationLog?.[p.observationLog.length - 1] || { mobilityLevel: 0 };
        return `
            <tr>
                <td>${p.name}</td>
                <td>${p.rm}</td>
                <td>${p.operation}</td>
                <td class="post-op-time" data-timestamp="${p.surgeryFinishTime.seconds}">${formatElapsedTime(p.surgeryFinishTime.seconds * 1000)}</td>
                <td><span class="status status-level-${latestObs.mobilityLevel}">Level ${latestObs.mobilityLevel}</span></td>
                <td><button class="btn btn--primary btn--sm update-patient-btn" data-id="${p.id}"><i class="fas fa-edit"></i> Update</button></td>
            </tr>`;
    }).join('');
}

function openPatientModal(patientId = null) {
    const isEditing = patientId !== null;
    const patient = isEditing ? patientsData.find(p => p.id === patientId) : null;
    document.getElementById('modal-title').textContent = isEditing ? 'Update Data Pasien' : 'Tambah Pasien Baru';
    const modalBody = document.getElementById('modal-body');
    const addForm = `
        <div class="modal-grid">
            <div class="form-group"><label>Nama Pasien</label><input type="text" id="patient-name" class="form-control" required></div>
            <div class="form-group"><label>Nomor RM</label><input type="text" id="patient-rm" class="form-control" required></div>
            <div class="form-group full-width"><label>Jenis Operasi</label><select id="patient-operation" class="form-control">${appData.operations.map(op=>`<option>${op}</option>`).join('')}</select></div>
            <div class="form-group full-width"><label>Jenis Anestesi</label><select id="patient-anesthesia" class="form-control">${appData.anesthesiaTypes.map(an=>`<option>${an}</option>`).join('')}</select></div>
            <div class="form-group full-width"><label>Operasi Selesai (Jam yang lalu)</label><input type="number" id="patient-hours-ago" class="form-control" placeholder="Contoh: 2" required></div>
        </div>
        <div class="modal-footer"><button class="btn btn--primary" id="save-new-patient-btn">Simpan Pasien</button></div>`;
    const updateForm = `
        <h4>Pasien: ${patient?.name} (${patient?.rm})</h4><hr class="form-divider">
        <div class="modal-grid">
            <div class="form-group full-width"><label>Update Skala Mobilitas</label><select id="update-mobility" class="form-control">${appData.mobilityScale.map(s=>`<option value="${s.level}">${s.name}</option>`).join('')}</select></div>
            <div class="form-group"><label>Skala Nyeri (0-10)</label><input type="number" id="update-pain" class="form-control" min="0" max="10" value="0"></div>
            <div class="form-group"><label>Mual/Muntah (PONV)</label><select id="update-ponv" class="form-control"><option>Tidak Ada</option><option>Ringan</option><option>Berat</option></select></div>
            <div class="form-group full-width"><label>Tingkat Kesadaran (RASS)</label><select id="update-rass" class="form-control"><option>Sadar & Tenang</option><option>Mengantuk</option><option>Sulit Dibangunkan</option></select></div>
            <div class="form-group full-width"><label>Perawat</label><select id="update-nurse" class="form-control">${appData.nurses.map(n=>`<option>${n}</option>`).join('')}</select></div>
        </div>
        <div class="modal-footer"><button class="btn btn--primary" id="save-update-btn" data-id="${patientId}">Simpan Observasi</button></div>`;
    modalBody.innerHTML = isEditing ? updateForm : addForm;
    if (isEditing) document.getElementById('save-update-btn').addEventListener('click', savePatientUpdate);
    else document.getElementById('save-new-patient-btn').addEventListener('click', saveNewPatient);
    document.getElementById('patient-modal').classList.remove('hidden');
}

function closePatientModal() {
    document.getElementById('patient-modal').classList.add('hidden');
}

async function saveNewPatient() {
    const name = document.getElementById('patient-name').value;
    const rm = document.getElementById('patient-rm').value;
    const hoursAgo = parseFloat(document.getElementById('patient-hours-ago').value);
    if (!name || !rm || isNaN(hoursAgo)) return showToast("Harap lengkapi semua field.", "error");
    const newPatient = {
        name, rm, 
        operation: document.getElementById('patient-operation').value,
        anesthesia: document.getElementById('patient-anesthesia').value,
        surgeryFinishTime: new Date(Date.now() - hoursAgo * 3600 * 1000),
        createdAt: serverTimestamp(),
        observationLog: []
    };
    try {
        await addDoc(collection(db, 'artifacts', appId, 'users', auth.currentUser.uid, 'patients'), newPatient);
        showToast("Pasien baru ditambahkan.", "success");
        closePatientModal();
    } catch (error) { showToast("Gagal menambahkan pasien.", "error"); }
}

async function savePatientUpdate(e) {
    const patientId = e.target.dataset.id;
    const patient = patientsData.find(p => p.id === patientId);
    const newObservation = {
        mobilityLevel: parseInt(document.getElementById('update-mobility').value),
        painScale: document.getElementById('update-pain').value,
        ponv: document.getElementById('update-ponv').value,
        rass: document.getElementById('update-rass').value,
        nurse: document.getElementById('update-nurse').value,
        timestamp: new Date()
    };
    try {
        await updateDoc(doc(db, 'artifacts', appId, 'users', auth.currentUser.uid, 'patients', patientId), {
            observationLog: [...(patient.observationLog || []), newObservation]
        });
        showToast("Observasi berhasil diperbarui.", "success");
        closePatientModal();
    } catch (error) { showToast("Gagal memperbarui data.", "error"); }
}

// --- FUNGSI BANTUAN ---
function startRealtimeClocks() {
    setInterval(() => {
        document.querySelectorAll('.post-op-time').forEach(el => {
            el.textContent = formatElapsedTime(parseInt(el.dataset.timestamp) * 1000);
        });
    }, 60000);
}

function formatElapsedTime(timestamp) {
    const seconds = Math.floor((new Date() - timestamp) / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours} jam ${minutes} mnt` : `${minutes} mnt`;
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.querySelector('.toast-message').textContent = message;
    const icons = { success: 'fas fa-check-circle', error: 'fas fa-times-circle', warning: 'fas fa-exclamation-triangle', info: 'fas fa-info-circle' };
    toast.querySelector('.toast-icon').className = `toast-icon ${icons[type]}`;
    toast.className = `toast show ${type}`;
    setTimeout(() => toast.classList.remove('show'), 3000);
}

