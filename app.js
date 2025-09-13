// app.js — MODIFIED with Delete Function, No Archive View, and Data Analysis Dashboard

// Import Firebase services
// PERUBAHAN: Menambahkan deleteDoc
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, collection, addDoc, doc, onSnapshot, updateDoc, query, serverTimestamp, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// --- KONFIGURASI APLIKASI ---
const appData = {
    nurses: ["Suriansyah, S.Kep., Ns", "Akbar Wirahadi, A.Md.Kep", "Annisa Aulia Rahma, A.Md.Kep", "Dina Ghufriana, S.Kep.Ners", "Dwi Sucilowati, AMK", "Gusti Rusmiyati, S.Kep.Ners", "Gusti Rusmiyati, S.Kep.Ners", "Herliyana Paramitha, S.Kep.,Ners", "Isnawati, AMK", "Khairun Nisa, S.Kep.Ners", "Noor Makiah, AMK", "Nurmilah A, A.Md.Kep", "Qatrunnada Mufidah, A.Md.Kep", "Raudatul Hikmah, S.Kep., Ns", "Verawaty, AMK", "Zahratul Zannah, S.Kep., Ns"],
    operations: ["Appendectomy", "Hernia Repair", "Laparotomy", "Mastectomy", "BPH", "Excision", "Debridement", "ORIF", "ROI"],
    anesthesiaTypes: ["General Anesthesia", "Spinal Anesthesia", "Epidural Anesthesia", "Regional Block"],
    mobilityScale: [
        {level: 1, name: "Level 1: Berbaring di Tempat Tidur", description: "Pasien berbaring, dapat melakukan miring kanan/kiri secara mandiri."},
        {level: 2, name: "Level 2: Duduk di Tepi Tempat Tidur", description: "Pasien mampu duduk di tepi tempat tidur setidaknya selama 1 menit."},
        {level: 3, name: "Level 3: Berdiri", description: "Pasien mampu berdiri di samping tempat tidur setidaknya selama 1 menit."},
        {level: 4, name: "Level 4: Berjalan di Tempat", description: "Pasien mampu melangkah di tempat di samping tempat tidur."},
        {level: 5, name: "Level 5: Transfer ke Kursi & Berjalan > 10 Langkah", description: "Mampu pindah ke kursi dan/atau berjalan lebih dari 10 langkah."},
        {level: 6, name: "Level 6: Berjalan > 7 Meter", description: "Berjalan mandiri dengan atau tanpa alat bantu sejauh lebih dari 7 meter."},
        {level: 7, name: "Level 7: Berjalan > 30 Meter", description: "Berjalan mandiri dengan atau tanpa alat bantu sejauh lebih dari 30 meter."},
        {level: 8, name: "Level 8: Naik Turun Tangga", description: "Mampu naik/turun setidaknya satu anak tangga."}
    ],
    questionnaire: {
        questions: [
            { id: 1, text: "Menggerakkan badan sesegera mungkin setelah operasi akan mempercepat pemulihan.", type: "positive" },
            { id: 2, text: "Bergerak setelah operasi sangat berbahaya karena bisa membuat jahitan lepas.", type: "negative" },
            { id: 3, text: "Latihan gerak di tempat tidur adalah langkah pertama yang penting.", type: "positive" },
            { id: 4, text: "Jika terasa sangat nyeri saat bergerak, lebih baik berhenti dan panggil perawat.", type: "positive" },
            { id: 5, text: "Dalam 24 jam terakhir, rasa nyeri membuat saya sulit untuk berkonsentrasi pada hal lain.", type: "negative_promis" },
            { id: 6, text: "Dalam 24 jam terakhir, rasa nyeri mengganggu aktivitas saya di tempat tidur (misal: miring kanan-kiri).", type: "negative_promis" },
            { id: 7, text: "Saya merasa cukup kuat untuk duduk sendiri di tepi tempat tidur.", type: "positive_promis" },
            { id: 8, text: "Saya yakin bisa berjalan beberapa langkah tanpa bantuan.", type: "positive_promis" },
            { id: 9, text: "Manfaat utama bergerak setelah operasi adalah agar bisa cepat pulang.", type: "positive" },
            { id: 10, text: "Peran keluarga tidak penting, mobilisasi adalah tugas perawat sepenuhnya.", type: "negative" }
        ],
        scoring: { 
            positive: { setuju: 2, ragu: 1, tidak_setuju: 0 }, 
            negative: { setuju: 0, ragu: 1, tidak_setuju: 2 },
            negative_promis: { setuju: 0, ragu: 1, tidak_setuju: 2 },
            positive_promis: { setuju: 2, ragu: 1, tidak_setuju: 0 }
        }
    }
};

// --- INISIALISASI ---
let db, auth;
let userId, clinicId;
let patientsData = [];
// Variabel untuk menyimpan instance chart agar bisa di-destroy
let mobilityChartInstance, anesthesiaChartInstance;


document.addEventListener('DOMContentLoaded', () => {
    setupClinicId();
});

function setupClinicId() {
    const storedClinicId = localStorage.getItem('mlqClinicId');
    const modal = document.getElementById('clinic-id-modal');
    
    if (storedClinicId) {
        clinicId = storedClinicId;
        modal.classList.add('hidden');
        initializeAppSequence();
    } else {
        modal.classList.remove('hidden');
        document.getElementById('save-clinic-id-btn').addEventListener('click', () => {
            const inputId = document.getElementById('clinic-id-input').value.trim().toUpperCase().replace(/\s+/g, '-');
            if (inputId) {
                clinicId = inputId;
                localStorage.setItem('mlqClinicId', clinicId);
                modal.classList.add('hidden');
                initializeAppSequence();
            } else {
                showToast("ID Klinik tidak boleh kosong.", "error");
            }
        });
    }
}

function initializeAppSequence() {
    initializeFirebase();
    setupEventListeners();
    populateNurseSelector();
    generateQuestionnaire();
    displayMobilityScaleInfo();
    startRealtimeClocks();
}

async function initializeFirebase() {
    try {
        const firebaseConfig = {
            apiKey: "AIzaSyDXLA7gDQcQtoOrgdW2PnTmYg8q7YQ0OLU",
            authDomain: "mobilisasi-69979.firebaseapp.com",
            projectId: "mobilisasi-69979",
            storageBucket: "mobilisasi-69979.firebasestorage.app",
            messagingSenderId: "97383306678",
            appId: "1:97383306678:web:559cfabae7d7ba24631d17",
            measurementId: "G-HQL9JQBMN3"
        };
        
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);

        onAuthStateChanged(auth, (user) => {
            if (user) {
                userId = user.uid;
                console.log("Firebase Authenticated. User ID:", userId, "| Clinic ID:", clinicId);
                listenForPatientUpdates(); 
            } else {
                userId = null;
            }
        });
        
        await signInAnonymously(auth);

    } catch (error) {
        console.error("Firebase Initialization Error:", error);
        showToast(`Error Inisialisasi: ${error.message}`, "error");
    }
}

async function addObservationToPatient(patientId, observation) {
    const obsCollectionPath = `clinics/${clinicId}/patients/${patientId}/observations`;
    const patientDocPath = `clinics/${clinicId}/patients/${patientId}`;

    await addDoc(collection(db, obsCollectionPath), { ...observation, createdAt: serverTimestamp() });
    await updateDoc(doc(db, patientDocPath), { latestObservation: { ...observation, createdAt: serverTimestamp() } });
}

async function handleQuestionnaireSubmit(e) {
    e.preventDefault();
    if (!userId || !clinicId) return showToast("Database belum siap.", "error");
    
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
    
    const collectionPath = `clinics/${clinicId}/questionnaires`;
    const resultData = { patientName, patientRM, testType: currentTestType, score: totalScore, answers, createdAt: serverTimestamp(), createdBy: userId, clinicId };
    
    try {
        await addDoc(collection(db, collectionPath), resultData);
        showToast("Hasil kuesioner berhasil disimpan!", "success");
        const maxScore = appData.questionnaire.questions.length * 2;
        displayResults(totalScore, maxScore);
    } catch (err) {
        console.error("Error saving questionnaire: ", err);
        showToast("Gagal menyimpan hasil.", "error");
    }
}

function listenForPatientUpdates() {
    if (!userId || !clinicId) return; 
    const collectionPath = `clinics/${clinicId}/patients`;
    const q = query(collection(db, collectionPath));
    
    const tableBody = document.getElementById('patient-table-body');
    if (tableBody) tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Memuat data pasien...</td></tr>`;
    
    onSnapshot(q, snapshot => {
        patientsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const activePatients = patientsData.filter(p => p.status === 'aktif' && p.surgeryFinishTime).sort((a,b) => getSecondsFromTS(b.surgeryFinishTime) - getSecondsFromTS(a.surgeryFinishTime));
        
        renderPatientTable(activePatients);
        // PERUBAHAN: Memanggil fungsi analisis data
        renderDataAnalysis(activePatients);

    }, error => {
        console.error("Error listening to patient updates:", error);
        showToast("Gagal memuat data pasien.", "error");
        if (tableBody) tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; color: var(--color-error); padding: 20px;"><i class="fas fa-exclamation-triangle"></i> Gagal memuat data.</td></tr>`;
    });
}

async function saveNewPatient() {
    if(!userId || !clinicId) return showToast("Koneksi ke database belum siap.", "error");
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
    };
    
    const newPatient = {
        name, rm, 
        operation: document.getElementById('patient-operation').value,
        anesthesia: document.getElementById('patient-anesthesia').value,
        surgeryFinishTime: new Date(finishTimeValue),
        createdAt: serverTimestamp(),
        status: 'aktif',
        clinicId: clinicId,
        createdBy: userId,
    };

    try {
        const collectionPath = `clinics/${clinicId}/patients`;
        const patientRef = await addDoc(collection(db, collectionPath), newPatient);
        await addObservationToPatient(patientRef.id, initialObservation);
        showToast("Pasien baru ditambahkan.", "success");
        closePatientModal();
    } catch (error) { 
        console.error("Error adding patient:", error);
        showToast("Gagal menambahkan pasien.", "error"); 
    }
}

async function savePatientUpdate(e) {
    if(!userId || !clinicId) return showToast("Koneksi ke database belum siap.", "error");
    const patientId = e.target.dataset.id;
    const selectedNurse = document.getElementById('current-nurse-selector').value;
    if(!selectedNurse) return showToast("Pilih nama perawat terlebih dahulu.", "warning");
    const newObservation = {
        mobilityLevel: parseInt(document.getElementById('update-mobility').value),
        painScale: document.getElementById('update-pain').value,
        ponv: document.getElementById('update-ponv').value,
        rass: document.getElementById('update-rass').value,
        notes: document.getElementById('update-notes').value,
        nurse: selectedNurse,
        updatedBy: userId
    };
    try {
        await addObservationToPatient(patientId, newObservation);
        showToast("Observasi berhasil diperbarui.", "success");
        closePatientModal();
    } catch (error) { 
        console.error("Error updating patient:", error);
        showToast("Gagal memperbarui data.", "error"); 
    }
}

async function dischargePatient(patientId) {
    if(!userId || !clinicId) return showToast("Koneksi ke database belum siap.", "error");
    showConfirmationDialog("Apakah Anda yakin ingin menandai pasien ini sebagai 'Pulang'? Pasien akan diarsipkan dari dasbor utama.", async () => {
        try {
            const docPath = `clinics/${clinicId}/patients/${patientId}`;
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

// PERUBAHAN: Fungsi baru untuk menghapus pasien
async function deletePatient(patientId) {
    if (!userId || !clinicId) return showToast("Koneksi ke database belum siap.", "error");
    
    showConfirmationDialog("Apakah Anda yakin ingin MENGHAPUS data pasien ini secara permanen? Aksi ini tidak bisa dibatalkan.", async () => {
        try {
            const docPath = `clinics/${clinicId}/patients/${patientId}`;
            await deleteDoc(doc(db, docPath));
            showToast("Data pasien berhasil dihapus.", "success");
        } catch (error) {
            console.error("Error deleting patient:", error);
            showToast("Gagal menghapus data pasien.", "error");
        }
    });
}


// --- FUNGSI UTILITAS & RENDER ---

function getSecondsFromTS(ts) {
    if (!ts) return 0;
    if (typeof ts === 'object' && ts.seconds !== undefined) return ts.seconds;
    if (ts && typeof ts.toDate === 'function') return Math.floor(ts.toDate().getTime()/1000);
    if (ts instanceof Date) return Math.floor(ts.getTime()/1000);
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

let currentTestType = 'pretest';

function setupEventListeners() {
    document.querySelector('.nav-list').addEventListener('click', e => {
        const navItem = e.target.closest('.nav-item');
        if (navItem) navigateToPage(navItem.dataset.page);
    });
    document.querySelector('.menu-grid').addEventListener('click', e => {
        const menuCard = e.target.closest('.menu-card');
        if (menuCard) navigateToPage(menuCard.dataset.page);
    });
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
        // PERUBAHAN: Menambahkan listener untuk tombol hapus
        if (e.target.closest('.delete-patient-btn')) {
            const patientId = e.target.closest('.delete-patient-btn').dataset.id;
            deletePatient(patientId);
        }
        if (e.target.matches('.modal-close-btn') || e.target.matches('.modal-overlay')) {
            if(!document.getElementById('clinic-id-modal').classList.contains('hidden')) return;
            closePatientModal();
        }
    });
}

function navigateToPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`${pageId}-page`).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === pageId));
}

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
            <div class="form-group-options">
                <label class="option-label"><input type="radio" name="q_${q.id}" value="setuju" required> Setuju</label>
                <label class="option-label"><input type="radio" name="q_${q.id}" value="ragu"> Ragu-ragu</label>
                <label class="option-label"><input type="radio" name="q_${q.id}" value="tidak_setuju"> Tidak Setuju</label>
            </div>
        </div>`).join('');
}

function displayResults(score, maxScore) {
    document.getElementById('questionnaire-form').classList.add('hidden');
    const resultsContainer = document.getElementById('results-container');
    resultsContainer.classList.remove('hidden');
    document.getElementById('score-display').textContent = score;
    const interpEl = document.getElementById('interpretation');
    let interp;
    if (score >= maxScore * 0.75) interp = { text: "Pengetahuan & Kondisi Baik", class: "good" };
    else if (score >= maxScore * 0.5) interp = { text: "Pengetahuan & Kondisi Cukup", class: "fair" };
    else interp = { text: "Pengetahuan & Kondisi Kurang", class: "poor" };
    interpEl.innerHTML = `<h4>${interp.text}</h4>`;
    interpEl.className = `interpretation ${interp.class}`;
}

function resetQuestionnaire() {
    document.getElementById('questionnaire-form').reset();
    document.getElementById('questionnaire-form').classList.remove('hidden');
    document.getElementById('results-container').classList.add('hidden');
}

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
    selector.innerHTML = `<option value="">-- Pilih Perawat --</option>` + appData.nurses.sort().map(nurse => `<option value="${nurse}">${nurse}</option>`).join('');
}

function renderPatientTable(patients) {
    const tableBody = document.getElementById('patient-table-body');
    if (!tableBody) return;
    if (patients.length === 0) {
        tableBody.innerHTML = `<tr class="no-data-row"><td colspan="8">Belum ada data pasien aktif. Klik 'Tambah Pasien Baru' untuk memulai.</td></tr>`;
        return;
    }
    tableBody.innerHTML = patients.map(p => {
        const latestObs = p.latestObservation || { ponv: 'N/A', rass: 'N/A', mobilityLevel: 1, createdAt: { seconds: getSecondsFromTS(p.createdAt) } };
        const idealMobility = calculateIdealMobility(p, latestObs);
        const suggestion = generateActionSuggestion(latestObs, idealMobility);
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
                        <!-- PERUBAHAN: Menambahkan tombol Hapus -->
                        <button class="btn btn--danger btn--sm delete-patient-btn" data-id="${p.id}"><i class="fas fa-trash-alt"></i> Hapus</button>
                    </div>
                </td>
            </tr>`;
    }).join('');
}

// PERUBAHAN: Menghapus fungsi renderArchivedPatientTable

function calculateIdealMobility(patient, latestObs) {
    const hoursPostOp = (Date.now() - (getSecondsFromTS(patient.surgeryFinishTime) * 1000)) / (3600 * 1000);
    const majorOperations = ["Laparotomy", "ORIF"];
    const isMajorOp = majorOperations.includes(patient.operation);
    
    if (latestObs.ponv !== 'Tidak Ada' || latestObs.rass !== 'Sadar & Tenang') {
        return { level: 1, text: `Level 1 (Atasi ${latestObs.ponv !== 'Tidak Ada' ? 'PONV' : 'RASS'})` };
    }
    
    if (patient.anesthesia === "Spinal Anesthesia" && hoursPostOp < 8) {
        return { level: 2, text: "Level 2 (Post-Spinal)" };
    }
    
    if (isMajorOp) {
        if (hoursPostOp < 6) return { level: 1, text: "Level 1" };
        if (hoursPostOp >= 6 && hoursPostOp < 12) return { level: 2, text: "Level 2" };
        if (hoursPostOp >= 12 && hoursPostOp < 24) return { level: 3, text: "Level 3" };
        if (hoursPostOp >= 24 && hoursPostOp < 48) return { level: 5, text: "Level 5" };
        if (hoursPostOp >= 48 && hoursPostOp < 72) return { level: 6, text: "Level 6" };
        return { level: 7, text: "Level 7" };
    } else {
        if (hoursPostOp < 4) return { level: 2, text: "Level 2" };
        if (hoursPostOp >= 4 && hoursPostOp < 8) return { level: 3, text: "Level 3" };
        if (hoursPostOp >= 8 && hoursPostOp < 18) return { level: 5, text: "Level 5" };
        if (hoursPostOp >= 18 && hoursPostOp < 36) return { level: 6, text: "Level 6" };
        return { level: 7, text: "Level 7" };
    }
}

function generateActionSuggestion(latestObs, idealMobility) {
    const currentLevel = latestObs.mobilityLevel;
    const idealLevel = idealMobility.level;
    
    if (latestObs.ponv !== 'Tidak Ada') return '<strong>Prioritas:</strong> Atasi mual/muntah (PONV) sesuai advise DPJP.';
    if (latestObs.rass !== 'Sadar & Tenang') return '<strong>Prioritas:</strong> Stabilkan kesadaran (RASS). Observasi ketat.';
    
    if (currentLevel >= idealLevel) {
        const nextLevel = appData.mobilityScale.find(s => s.level === currentLevel + 1);
        if (nextLevel) {
            return `<strong>Pertahankan!</strong> Target tercapai. Dorong ke <strong>${nextLevel.name}</strong> jika kondisi memungkinkan.`;
        }
        return '<strong>Luar Biasa!</strong> Pasien sangat aktif. Pertahankan dan monitor kenyamanan.';
    } else {
        const targetAction = appData.mobilityScale.find(s => s.level === idealLevel);
        const currentAction = appData.mobilityScale.find(s => s.level === currentLevel);
        
        const currentActionName = currentAction ? currentAction.name : 'Level Saat Ini';
        const targetActionName = targetAction ? targetAction.name : 'Target Berikutnya';

        return `<strong>Ayo Kejar!</strong> Pasien masih di <strong>${currentActionName}</strong>. Target selanjutnya: <strong>${targetActionName}</strong>.`;
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
            <div class="form-group full-width"><label>Mobilisasi Awal (JH-HLM)</label><select id="initial-mobility" class="form-control">${appData.mobilityScale.map(s=>`<option value="${s.level}">${s.name}</option>`).join('')}</select></div>
        </div>
        <div class="modal-footer"><button class="btn btn--primary" id="save-new-patient-btn">Simpan Pasien</button></div>`;
        
    const updateForm = `
        <h4>Pasien: ${patient?.name} (${patient?.rm})</h4><hr class="form-divider">
        <div class="modal-grid">
            <div class="form-group full-width"><label>Update Skala Mobilitas (JH-HLM)</label><select id="update-mobility" class="form-control">${appData.mobilityScale.map(s=>`<option value="${s.level}">${s.name}</option>`).join('')}</select></div>
            <div class="form-group"><label>Skala Nyeri (0-10)</label><input type="number" id="update-pain" class="form-control" min="0" max="10" value="0"></div>
            <div class="form-group"><label>Mual/Muntah (PONV)</label><select id="update-ponv" class="form-control"><option>Tidak Ada</option><option>Ringan</option><option>Berat</option></select></div>
            <div class="form-group"><label>Tingkat Kesadaran (RASS)</label><select id="update-rass" class="form-control"><option>Sadar & Tenang</option><option>Mengantuk</option><option>Respon suara</option><option>Tak ada respon</option></select></div>
            <div class="form-group full-width"><label>Catatan Tambahan</label><textarea id="update-notes" class="form-control" rows="2"></textarea></div>
        </div>
        <div class="modal-footer"><button class="btn btn--primary" id="save-update-btn" data-id="${patientId}">Simpan Observasi</button></div>`;
        
    modalBody.innerHTML = isEditing ? updateForm : addForm;

    if (isEditing) {
        const latestObs = patient.latestObservation || {};
        document.getElementById('update-mobility').value = latestObs.mobilityLevel || 1;
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

function startRealtimeClocks() {
    const updateTimes = () => {
        document.querySelectorAll('.post-op-time').forEach(el => {
            const timestamp = parseInt(el.dataset.timestamp, 10);
            if (!isNaN(timestamp)) {
               el.textContent = formatElapsedTime(timestamp * 1000);
            }
        });
    };
    setInterval(updateTimes, 1000 * 30);
    updateTimes();
}

// PERUBAHAN: Fungsi baru untuk merender analisis data
function renderDataAnalysis(patients) {
    const analysisSection = document.getElementById('data-analysis-section');
    if (patients.length === 0) {
        analysisSection.classList.add('hidden');
        return;
    }
    analysisSection.classList.remove('hidden');

    // 1. Hitung Statistik
    const totalPatients = patients.length;
    const totalMobilityScore = patients.reduce((sum, p) => sum + (p.latestObservation?.mobilityLevel || 0), 0);
    const avgMobility = totalPatients > 0 ? (totalMobilityScore / totalPatients).toFixed(1) : 0;

    document.getElementById('total-patients-stat').textContent = totalPatients;
    document.getElementById('avg-mobility-stat').textContent = avgMobility;
    
    // 2. Data untuk Grafik Distribusi Mobilitas
    const mobilityCounts = appData.mobilityScale.map(level => {
        return patients.filter(p => p.latestObservation?.mobilityLevel === level.level).length;
    });
    
    const mobilityData = {
        labels: appData.mobilityScale.map(level => `Level ${level.level}`),
        datasets: [{
            label: 'Jumlah Pasien',
            data: mobilityCounts,
            backgroundColor: 'rgba(33, 128, 141, 0.6)',
            borderColor: 'rgba(33, 128, 141, 1)',
            borderWidth: 1
        }]
    };
    
    // 3. Data untuk Grafik Proporsi Anestesi
    const anesthesiaCounts = appData.anesthesiaTypes.map(type => {
        return { type: type, count: patients.filter(p => p.anesthesia === type).length };
    }).filter(item => item.count > 0);

    const anesthesiaData = {
        labels: anesthesiaCounts.map(item => item.type),
        datasets: [{
            label: 'Jumlah Pasien',
            data: anesthesiaCounts.map(item => item.count),
            backgroundColor: [
                'rgba(41, 150, 161, 0.7)',
                'rgba(230, 129, 97, 0.7)',
                'rgba(98, 108, 113, 0.7)',
                'rgba(94, 82, 64, 0.7)'
            ],
            borderColor: '#fff',
            borderWidth: 2
        }]
    };

    // 4. Render Grafik
    renderBarChart('mobility-chart-canvas', mobilityData, mobilityChartInstance, (chart) => mobilityChartInstance = chart);
    renderDoughnutChart('anesthesia-chart-canvas', anesthesiaData, anesthesiaChartInstance, (chart) => anesthesiaChartInstance = chart);
}

function renderBarChart(canvasId, data, chartInstance, setInstance) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (chartInstance) {
        chartInstance.destroy();
    }
    const newChart = new Chart(ctx, {
        type: 'bar',
        data: data,
        options: {
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
        }
    });
    setInstance(newChart);
}

function renderDoughnutChart(canvasId, data, chartInstance, setInstance) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (chartInstance) {
        chartInstance.destroy();
    }
    const newChart = new Chart(ctx, {
        type: 'doughnut',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } }
        }
    });
    setInstance(newChart);
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
    dialog.style.opacity = '0';
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

