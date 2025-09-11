// app.js — modified to store observations in a subcollection per patient
// - Patient documents are created in: artifacts/{appId}/users/{userId}/patients
// - Observations are stored in subcollection: artifacts/{appId}/users/{userId}/patients/{patientId}/observations
// - patient.latestObservation is kept as a quick summary (allows existing UI to keep working)
// NOTE: This file is a drop-in replacement for your original app.js. It keeps most original logic
// but replaces any array-based observation updates with subcollection writes + patient.latestObservation updates.

// Import Firebase services
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, collection, addDoc, doc, onSnapshot, updateDoc, query, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// --- KONFIGURASI APLIKASI ---
const appData = {
    nurses: ["Suriansyah, S.Kep., Ns", "Ahmad, S.Kep., Ns", "Budiman, A.Md.Kep", "Citra, S.Kep., Ns", "Dewi, A.Md.Kep"],
    operations: ["Appendectomy", "Hernia Repair", "Laparotomy", "Mastectomy", "Cholecystectomy", "Sectio Caesarea"],
    anesthesiaTypes: ["General Anesthesia", "Spinal Anesthesia", "Epidural Anesthesia", "Regional Block"],
    mobilityScale: [
        {level: 0, name: "Level 0: Tirah Baring", description: "Pasien pasif, semua gerakan dibantu perawat."},
        {level: 1, name: "Level 1: Latihan Pasif/Aktif di Tempat Tidur", description: "Miring kanan-kiri, latihan rentang gerak."},
        {level: 2, name: "Level 2: Duduk di Tepi Tempat Tidur", description: "Mulai mendudukkan pasien di sisi tempat tidur."},
        {level: 3, name: "Level 3: Berdiri di Samping Tempat Tidur", description: "Latihan berdiri dengan bantuan."},
        {level: 4, name: "Level 4: Berjalan Beberapa Langkah", description: "Mulai berjalan di sekitar tempat tidur."},
        {level: 5, name: "Level 5: Berjalan di Koridor", description: "Berjalan lebih jauh di area ruangan/koridor."},
        {level: 6, name: "Level 6: Mandiri", description: "Pasien mampu beraktivitas secara mandiri."}
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
let db, auth;
let userId, appId;
let patientsData = [];

async function initializeFirebase() {
    try {
        // Konfigurasi Firebase dari Anda
        const firebaseConfig = {
            apiKey: "AIzaSyDXLA7gDQcQtoOrgdW2PnTmYg8q7YQ0OLU",
            authDomain: "mobilisasi-69979.firebaseapp.com",
            projectId: "mobilisasi-69979",
            storageBucket: "mobilisasi-69979.firebasestorage.app",
            messagingSenderId: "97383306678",
            appId: "1:97383306678:web:559cfabae7d7ba24631d17",
            measurementId: "G-HQL9JQBMN3"
        };
        
        // Gunakan appId dari konfigurasi di atas
        appId = firebaseConfig.appId;

        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);

        onAuthStateChanged(auth, (user) => {
            if (user) {
                userId = user.uid;
                console.log("Firebase Authenticated. User ID:", userId);
                listenForPatientUpdates(); // Mulai memuat data setelah otentikasi berhasil
            } else {
                console.log("User not signed in.");
                userId = null;
            }
        });
        
        // Login sebagai pengguna anonim
        await signInAnonymously(auth);

    } catch (error) {
        console.error("Firebase Initialization Error:", error);
        const observationPage = document.getElementById('observation-page');
        if (observationPage) {
            observationPage.innerHTML = `<div class="error-panel"><h3><i class="fas fa-exclamation-triangle"></i> Gagal Terhubung ke Database</h3><p>Pastikan konfigurasi Firebase pada file <strong>app.js</strong> sudah benar. Error: ${error.message}</p></div>`;
        }
        showToast(`Error Inisialisasi: ${error.message}`, "error");
    }
}

// --- UTILITY HELPERS ---
function getSecondsFromTS(ts) {
    if (!ts) return 0;
    // Firestore Timestamp
    if (typeof ts === 'object' && ts.seconds !== undefined) return ts.seconds;
    // Timestamp-like with toDate()
    if (ts && typeof ts.toDate === 'function') return Math.floor(ts.toDate().getTime()/1000);
    // JavaScript Date
    if (ts instanceof Date) return Math.floor(ts.getTime()/1000);
    // ISO string / number
    if (!isNaN(Number(ts))) return Number(ts);
    return Math.floor(new Date(ts).getTime()/1000);
}

function formatElapsedTime(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `< 1 mnt`;

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    let result = '';
    if (days > 0) result += `${days} hari `;
    if (hours > 0) result += `${hours} jam `;
    if (minutes > 0) result += `${minutes} mnt`;
    
    return result.trim() || 'Baru saja';
}

// Write a new observation into the patient's observations subcollection
// and update patient.latestObservation (so UI can keep using a single field).
async function addObservationToPatient(patientId, observation) {
    const obsCollectionPath = `artifacts/${appId}/users/${userId}/patients/${patientId}/observations`;
    const patientDocPath = `artifacts/${appId}/users/${userId}/patients/${patientId}`;

    // 1) Add to observations subcollection (document will have createdAt server timestamp)
    await addDoc(collection(db, obsCollectionPath), {
        ...observation,
        createdAt: serverTimestamp()
    });

    // 2) Update patient.latestObservation for quick access in UI
    // Use serverTimestamp() safely here (it's not inside an array)
    await updateDoc(doc(db, patientDocPath), {
        latestObservation: {
            ...observation,
            createdAt: serverTimestamp()
        }
    });
}

// --- STATE APLIKASI & EVENT LISTENERS ---
let currentTestType = 'pretest';

document.addEventListener('DOMContentLoaded', () => {
    initializeFirebase();
    setupEventListeners();
    populateNurseSelector();
    generateQuestionnaire();
    displayMobilityScaleInfo();
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
    const questionnairePage = document.getElementById('questionnaire-page');
    if (questionnairePage) {
        questionnairePage.querySelector('.test-selector').addEventListener('click', e => {
            const testBtn = e.target.closest('.test-btn');
            if (testBtn) setActiveTest(testBtn.dataset.test);
        });
        document.getElementById('questionnaire-form').addEventListener('submit', handleQuestionnaireSubmit);
        questionnairePage.querySelector('.reset-btn').addEventListener('click', resetQuestionnaire);
        questionnairePage.querySelector('.retry-btn').addEventListener('click', resetQuestionnaire);
    }

    // Dasbor Pasien
    const addPatientBtn = document.getElementById('add-patient-btn');
    if (addPatientBtn) {
        addPatientBtn.addEventListener('click', () => openPatientModal());
    }
    
    document.body.addEventListener('click', e => {
        if (e.target.closest('.update-patient-btn')) {
            const patientId = e.target.closest('.update-patient-btn').dataset.id;
            openPatientModal(patientId);
        }
        if (e.target.closest('.discharge-patient-btn')) {
            const patientId = e.target.closest('.discharge-patient-btn').dataset.id;
            dischargePatient(patientId);
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
    if(!container) return;
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
    if (!userId) return showToast("Database belum siap.", "error");
    
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
    
    const collectionPath = `artifacts/${appId}/users/${userId}/questionnaires`;
    const resultData = { patientName, patientRM, testType: currentTestType, score: totalScore, answers, createdAt: serverTimestamp(), userId };
    
    try {
        await addDoc(collection(db, collectionPath), resultData);
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
function displayMobilityScaleInfo() {
    const container = document.getElementById('mobility-scale-info');
    if (!container) return;
    container.innerHTML = appData.mobilityScale.map(level => `
        <div class="mobility-level-item">
            <span class="status status-level-${level.level}">Level ${level.level}</span>
            <p><strong>${level.name}:</strong> ${level.description}</p>
        </div>
    `).join('');
}

function populateNurseSelector() {
    const selector = document.getElementById('current-nurse-selector');
    if(!selector) return;
    selector.innerHTML = appData.nurses.map(nurse => `<option value="${nurse}">${nurse}</option>`).join('');
}

function listenForPatientUpdates() {
    if (!userId || !appId) return; 
    const collectionPath = `artifacts/${appId}/users/${userId}/patients`;
    const q = query(collection(db, collectionPath));
    
    onSnapshot(q, snapshot => {
        patientsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Sort aktif dan arsip seperti semula — gunakan helper getSecondsFromTS untuk kompatibilitas
        const activePatients = patientsData.filter(p => p.status === 'aktif' && p.surgeryFinishTime).sort((a,b) => getSecondsFromTS(b.surgeryFinishTime) - getSecondsFromTS(a.surgeryFinishTime));
        const archivedPatients = patientsData.filter(p => p.status === 'diarsipkan' && p.dischargedAt).sort((a,b) => getSecondsFromTS(b.dischargedAt) - getSecondsFromTS(a.dischargedAt));
        
        renderPatientTable(activePatients);
        renderArchivedPatientTable(archivedPatients);

    }, error => {
        console.error("Error listening to patient updates:", error);
        showToast("Gagal memuat data pasien.", "error");
    });
}

function renderPatientTable(patients) {
    const tableBody = document.getElementById('patient-table-body');
    if (!tableBody) return;
    if (patients.length === 0) {
        tableBody.innerHTML = `<tr class="no-data-row"><td colspan="8">Belum ada data pasien aktif. Klik 'Tambah Pasien Baru' untuk memulai.</td></tr>`;
        return;
    }
    tableBody.innerHTML = patients.map(p => {
        // Support legacy observationLog array OR new latestObservation field
        const latestObs = p.latestObservation || (p.observationLog?.[p.observationLog.length - 1]) || { ponv: 'N/A', rass: 'N/A', mobilityLevel: 0, createdAt: { seconds: getSecondsFromTS(p.createdAt) } };
        const idealMobility = calculateIdealMobility(p, latestObs);
        const suggestion = generateActionSuggestion(latestObs.mobilityLevel, idealMobility.level, latestObs);

        const finishSeconds = getSecondsFromTS(p.surgeryFinishTime);
        return `
            <tr>
                <td><strong>${p.name}</strong><br><small>${p.rm}</small></td>
                <td>${p.operation}</td>
                <td>${p.anesthesia}</td>
                <td class="post-op-time" data-timestamp="${finishSeconds}">${formatElapsedTime(finishSeconds * 1000)}</td>
                <td>${latestObs.ponv} / ${latestObs.rass}</td>
                <td><span class="status status-level-${latestObs.mobilityLevel}">Level ${latestObs.mobilityLevel}</span></td>
                <td><span class="status status-level-${idealMobility.level}">${idealMobility.text}</span></td>
                <td>
                    <div class="suggestion-text">${suggestion}</div>
                    <div class="action-buttons">
                        <button class="btn btn--primary btn--sm update-patient-btn" data-id="${p.id}"><i class="fas fa-edit"></i> Update</button>
                        <button class="btn btn--success btn--sm discharge-patient-btn" data-id="${p.id}"><i class="fas fa-check-circle"></i> Pulang</button>
                    </div>
                </td>
            </tr>`;
    }).join('');
}

function renderArchivedPatientTable(patients) {
    const tableBody = document.getElementById('archived-patient-table-body');
    if(!tableBody) return;
    if (patients.length === 0) {
        tableBody.innerHTML = `<tr class="no-data-row"><td colspan="4">Belum ada pasien yang diarsipkan.</td></tr>`;
        return;
    }
    tableBody.innerHTML = patients.map(p => `
        <tr>
            <td><strong>${p.name}</strong><br><small>${p.rm}</small></td>
            <td>${p.operation}</td>
            <td>${p.dischargedAt ? new Date(getSecondsFromTS(p.dischargedAt) * 1000).toLocaleDateString('id-ID') : 'N/A'}</td>
            <td><button class="btn btn--secondary btn--sm" disabled>Diarsipkan</button></td>
        </tr>
    `).join('');
}

function calculateIdealMobility(patient, latestObs) {
    const hoursPostOp = (Date.now() - (getSecondsFromTS(patient.surgeryFinishTime) * 1000)) / (3600 * 1000);
    
    if (latestObs.ponv !== 'Tidak Ada' || latestObs.rass !== 'Sadar & Tenang') {
        return { level: 1, text: "Level 1 (Atasi PONV/RASS)" };
    }
    if (patient.anesthesia === "General Anesthesia" && hoursPostOp < 6) return { level: 1, text: "Level 1"};
    if (hoursPostOp < 2) return { level: 0, text: "Level 0" };
    if (hoursPostOp >= 2 && hoursPostOp < 6) return { level: 2, text: "Level 2" };
    if (hoursPostOp >= 6 && hoursPostOp < 12) return { level: 3, text: "Level 3" };
    if (hoursPostOp >= 12 && hoursPostOp < 24) return { level: 4, text: "Level 4" };
    if (hoursPostOp >= 24 && hoursPostOp < 48) return { level: 5, text: "Level 5" };
    return { level: 6, text: "Level 6" };
}

function generateActionSuggestion(currentLevel, idealLevel, latestObs) {
    if (latestObs.ponv !== 'Tidak Ada') return '<strong>Prioritas:</strong> Atasi mual/muntah (PONV).';
    if (latestObs.rass !== 'Sadar & Tenang') return '<strong>Prioritas:</strong> Stabilkan kesadaran (RASS).';

    if (currentLevel >= idealLevel) {
        return '<strong>Pertahankan!</strong> Pasien sesuai target. Lanjutkan ke level berikutnya jika memungkinkan.';
    } else {
        const targetAction = appData.mobilityScale.find(s => s.level === idealLevel);
        return `<strong>Ayo Kejar!</strong> Target selanjutnya adalah <strong>${targetAction.name}</strong>`;
    }
}

function openPatientModal(patientId = null) {
    const isEditing = patientId !== null;
    const patient = isEditing ? patientsData.find(p => p.id === patientId) : null;
    document.getElementById('modal-title').textContent = isEditing ? 'Update Observasi Pasien' : 'Tambah Pasien Baru';
    const modalBody = document.getElementById('modal-body');
    
    const addForm = `
        <div class="modal-grid">
            <div class="form-group"><label for="patient-name">Nama Pasien</label><input type="text" id="patient-name" class="form-control" required></div>
            <div class="form-group"><label for="patient-rm">Nomor RM</label><input type="text" id="patient-rm" class="form-control" required></div>
            <div class="form-group full-width"><label for="patient-operation">Jenis Operasi</label><select id="patient-operation" class="form-control">${appData.operations.map(op=>`<option>${op}</option>`).join('')}</select></div>
            <div class="form-group full-width"><label for="patient-anesthesia">Jenis Anestesi</label><select id="patient-anesthesia" class="form-control">${appData.anesthesiaTypes.map(an=>`<option>${an}</option>`).join('')}</select></div>
            <div class="form-group full-width"><label for="patient-finish-time">Waktu Selesai Operasi</label><input type="datetime-local" id="patient-finish-time" class="form-control" required></div>
        </div>
        <hr class="form-divider">
        <h4>Observasi Awal</h4>
        <div class="modal-grid">
            <div class="form-group"><label>Mual/Muntah (PONV)</label><select id="initial-ponv" class="form-control"><option>Tidak Ada</option><option>Ringan</option><option>Berat</option></select></div>
            <div class="form-group"><label>Tingkat Kesadaran (RASS)</label><select id="initial-rass" class="form-control"><option>Sadar & Tenang</option><option>Mengantuk</option><option>Respon suara</option><option>Tak ada respon</option></select></div>
            <div class="form-group full-width"><label>Mobilisasi Saat Ini</label><select id="initial-mobility" class="form-control">${appData.mobilityScale.map(s=>`<option value="${s.level}">${s.name}</option>`).join('')}</select></div>
        </div>
        <div class="modal-footer"><button class="btn btn--primary" id="save-new-patient-btn">Simpan Pasien</button></div>`;
        
    const updateForm = `
        <h4>Pasien: ${patient?.name} (${patient?.rm})</h4><hr class="form-divider">
        <div class="modal-grid">
            <div class="form-group full-width"><label>Update Skala Mobilitas</label><select id="update-mobility" class="form-control">${appData.mobilityScale.map(s=>`<option value="${s.level}">${s.name}</option>`).join('')}</select></div>
            <div class="form-group"><label>Skala Nyeri (0-10)</label><input type="number" id="update-pain" class="form-control" min="0" max="10" value="0"></div>
            <div class="form-group"><label>Mual/Muntah (PONV)</label><select id="update-ponv" class="form-control"><option>Tidak Ada</option><option>Ringan</option><option>Berat</option></select></div>
            <div class="form-group"><label>Tingkat Kesadaran (RASS)</label><select id="update-rass" class="form-control"><option>Sadar & Tenang</option><option>Mengantuk</option><option>Respon suara</option><option>Tak ada respon</option></select></div>
            <div class="form-group full-width"><label>Catatan Tambahan</label><textarea id="update-notes" class="form-control" rows="2"></textarea></div>
        </div>
        <div class="modal-footer"><button class="btn btn--primary" id="save-update-btn" data-id="${patientId}">Simpan Observasi</button></div>`;
        
    modalBody.innerHTML = isEditing ? updateForm : addForm;

    if (isEditing) {
        const latestObs = patient.latestObservation || (patient.observationLog?.[patient.observationLog.length - 1]) || {};
        document.getElementById('update-mobility').value = latestObs.mobilityLevel || 0;
        document.getElementById('update-pain').value = latestObs.painScale || 0;
        document.getElementById('update-ponv').value = latestObs.ponv || 'Tidak Ada';
        document.getElementById('update-rass').value = latestObs.rass || 'Sadar & Tenang';
        document.getElementById('save-update-btn').addEventListener('click', savePatientUpdate);
    } else {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        document.getElementById('patient-finish-time').value = now.toISOString().slice(0, 16);
        document.getElementById('save-new-patient-btn').addEventListener('click', saveNewPatient);
    }
    
    document.getElementById('patient-modal').classList.remove('hidden');
}

function closePatientModal() {
    document.getElementById('patient-modal').classList.add('hidden');
}

// --- NEW: saveNewPatient using subcollection for observations ---
async function saveNewPatient() {
    if(!userId) return showToast("User tidak terautentikasi", "error");
    const name = document.getElementById('patient-name').value;
    const rm = document.getElementById('patient-rm').value;
    const finishTimeValue = document.getElementById('patient-finish-time').value;
    const selectedNurse = document.getElementById('current-nurse-selector').value;
    
    if (!name || !rm || !finishTimeValue) return showToast("Harap lengkapi data pasien.", "error");
    if (!selectedNurse) return showToast("Pilih nama perawat terlebih dahulu.", "warning");

    const initialObservation = {
        mobilityLevel: parseInt(document.getElementById('initial-mobility').value),
        painScale: 0,
        ponv: document.getElementById('initial-ponv').value,
        rass: document.getElementById('initial-rass').value,
        notes: 'Data awal pasien.',
        nurse: selectedNurse
        // createdAt will be set server-side in subcollection write
    };
    
    const newPatient = {
        name, rm, 
        operation: document.getElementById('patient-operation').value,
        anesthesia: document.getElementById('patient-anesthesia').value,
        surgeryFinishTime: new Date(finishTimeValue),
        createdAt: serverTimestamp(),
        // Keep latestObservation field for UI (set right after creating patient doc)
        status: 'aktif',
        userId
    };
    try {
        const collectionPath = `artifacts/${appId}/users/${userId}/patients`;
        const patientRef = await addDoc(collection(db, collectionPath), newPatient);

        // Add observation to subcollection & set latestObservation on patient
        await addObservationToPatient(patientRef.id, initialObservation);

        showToast("Pasien baru ditambahkan.", "success");
        closePatientModal();
    } catch (error) { 
        console.error("Error adding patient:", error);
        showToast("Gagal menambahkan pasien.", "error"); 
    }
}

// --- NEW: savePatientUpdate writes to observations subcollection and updates latestObservation ---
async function savePatientUpdate(e) {
    if(!userId) return showToast("User tidak terautentikasi", "error");
    const patientId = e.target.dataset.id;
    const patient = patientsData.find(p => p.id === patientId);
    const selectedNurse = document.getElementById('current-nurse-selector').value;
    
    if(!selectedNurse) return showToast("Pilih nama perawat terlebih dahulu.", "warning");

    const newObservation = {
        mobilityLevel: parseInt(document.getElementById('update-mobility').value),
        painScale: document.getElementById('update-pain').value,
        ponv: document.getElementById('update-ponv').value,
        rass: document.getElementById('update-rass').value,
        notes: document.getElementById('update-notes').value,
        nurse: selectedNurse
        // createdAt set server-side
    };
    try {
        // Add to subcollection and update patient.latestObservation
        await addObservationToPatient(patientId, newObservation);
        showToast("Observasi berhasil diperbarui.", "success");
        closePatientModal();
    } catch (error) { 
        console.error("Error updating patient:", error);
        showToast("Gagal memperbarui data.", "error"); 
    }
}

async function dischargePatient(patientId) {
    if(!userId) return showToast("User tidak terautentikasi", "error");
    showConfirmationDialog("Apakah Anda yakin ingin menandai pasien ini sebagai 'Pulang'? Aksi ini tidak bisa dibatalkan.", async () => {
        try {
            const docPath = `artifacts/${appId}/users/${userId}/patients/${patientId}`;
            const patientRef = doc(db, docPath);
            await updateDoc(patientRef, {
                status: 'diarsipkan',
                dischargedAt: serverTimestamp()
            });
            showToast("Pasien telah diarsipkan.", "success");
        } catch (error) {
            console.error("Error discharging patient:", error);
            showToast("Gagal mengarsipkan pasien.", "error");
        }
    });
}

// --- FUNGSI BANTUAN ---
function startRealtimeClocks() {
    setInterval(() => {
        document.querySelectorAll('.post-op-time').forEach(el => {
            const timestamp = parseInt(el.dataset.timestamp, 10);
            if (!isNaN(timestamp)) {
               el.textContent = formatElapsedTime(timestamp * 1000);
            }
        });
    }, 1000 * 60); // Update setiap menit sudah cukup
    
    // Panggil sekali di awal agar tidak kosong saat pertama dimuat
     document.querySelectorAll('.post-op-time').forEach(el => {
        const timestamp = parseInt(el.dataset.timestamp, 10);
        if (!isNaN(timestamp)) {
           el.textContent = formatElapsedTime(timestamp * 1000);
        }
    });
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.querySelector('.toast-message').textContent = message;
    const icons = { success: 'fas fa-check-circle', error: 'fas fa-times-circle', warning: 'fas fa-exclamation-triangle', info: 'fas fa-info-circle' };
    toast.querySelector('.toast-icon').className = `toast-icon ${icons[type]}`;
    toast.className = `toast show ${type}`;
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function showConfirmationDialog(message, onConfirm) {
    const existingDialog = document.getElementById('custom-confirm-dialog');
    if (existingDialog) existingDialog.remove();

    const dialog = document.createElement('div');
    dialog.id = 'custom-confirm-dialog';
    dialog.className = 'modal-overlay';
    dialog.style.opacity = '0'; // Mulai tersembunyi untuk transisi
    dialog.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <div class="modal-header"><h3>Konfirmasi Tindakan</h3></div>
            <div class="modal-body" style="padding-bottom: 16px;"><p>${message}</p></div>
            <div class="modal-footer" style="gap: 8px;">
                <button id="confirm-cancel" class="btn btn--secondary">Batal</button>
                <button id="confirm-ok" class="btn btn--primary">Ya, Lanjutkan</button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);
    setTimeout(() => {
        dialog.classList.remove('hidden');
        dialog.style.opacity = '1';
    }, 10);

    const closeDialog = () => {
        dialog.style.opacity = '0';
        setTimeout(() => dialog.remove(), 300);
    };

    document.getElementById('confirm-ok').onclick = () => {
        onConfirm();
        closeDialog();
    };
    document.getElementById('confirm-cancel').onclick = closeDialog;
}
