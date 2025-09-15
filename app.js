// app.js — MODIFIED with Gemini AI Integration for Clinical Suggestions

// Import Firebase services
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, collection, addDoc, doc, onSnapshot, updateDoc, query, serverTimestamp, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// --- KONFIGURASI APLIKASI ---
const appData = {
    nurses: ["Akbar Wirahadi, A.Md.Kep", "Annisa Aulia Rahma, A.Md.Kep", "Dina Ghufriana, S.Kep.Ners", "Dwi Sucilowati, AMK", "Gusti Rusmiyati, S.Kep.Ners", "Herliyana Paramitha, S.Kep.,Ners", "Isnawati, AMK", "Khairun Nisa, S.Kep.Ners", "Noor Makiah, AMK", "Nurmilah A, A.Md.Kep", "Qatrunnada Mufidah, A.Md.Kep", "Raudatul Hikmah, S.Kep., Ns", "Suriansyah, S.Kep., Ns",  "Verawaty, AMK", "Zahratul Zannah, S.Kep., Ns"],
    operations: ["Appendectomy", "Hernia Repair", "Laparotomy", "Mastectomy", "BPH", "Excision", "Debridement", "ORIF", "ROI", "Lainnya..."],
    anesthesiaTypes: ["General Anesthesia", "Spinal Anesthesia", "Epidural Anesthesia", "Regional Block"],
    mobilityScale: [
        {level: 1, name: "Level 1: Berbaring di Tempat Tidur", description: "Pasien berbaring, dapat melakukan miring kanan/kiri secara mandiri."},
        {level: 2, name: "Level 2: Duduk di Tepi Tempat Tidur", description: "Pasien mampu duduk di tepi tempat tidur setidaknya selama 1 menit."},
        {level: 3, name: "Level 3: Berdiri", description: "Pasien mampu berdiri di samping tempat tidur setidaknya selama 1 menit."},
        {level: 4, name: "Level 4: Berjalan di Tempat", description: "Pasien mampu melangkah di tempat di samping tempat tidur."},
        {level: 5, name: "Level 5: Transfer ke Kursi & Berjalan > 10 Langkah", description: "Mampu pindah ke kursi dan/atau berjalan lebih dari 10 langkah."},
        {level: 6, name: "Level 6: Berjalan > 14 langkah", description: "Berjalan mandiri dengan atau tanpa alat bantu sejauh lebih dari 14 langkah."},
        {level: 7, name: "Level 7: Berjalan > 60 langkah", description: "Berjalan mandiri dengan atau tanpa alat bantu sejauh lebih dari 60 langkah."},
        {level: 8, name: "Level 8: Naik Turun Tangga atau Berjalan > 150 langkah", description: "Mampu naik/turun setidaknya satu anak tangga atau berjalan mandiri lebih dari 150 langkah."}
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
let allPatientsData = [];
let questionnaireData = [];
let chartInstances = {};

Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.color = 'var(--color-text-secondary)';
Chart.defaults.borderColor = 'rgba(var(--color-brown-600-rgb), 0.1)';


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
                listenForQuestionnaireUpdates();
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
    let knowledgeScore = 0, promisScore = 0;
    let maxKnowledgeScore = 0, maxPromisScore = 0;
    const answers = {};

    for (const q of appData.questionnaire.questions) {
        const answer = formData.get(`q_${q.id}`);
        if (!answer) return showToast("Harap jawab semua pertanyaan.", "warning");
        answers[q.id] = answer;
        const score = appData.questionnaire.scoring[q.type][answer];

        if (q.type.includes('_promis')) {
            promisScore += score;
            maxPromisScore += 2;
        } else {
            knowledgeScore += score;
            maxKnowledgeScore += 2;
        }
    }
    
    const collectionPath = `clinics/${clinicId}/questionnaires`;
    const resultData = { 
        patientName, 
        patientRM, 
        testType: currentTestType, 
        knowledgeScore, 
        promisScore,
        totalScore: knowledgeScore + promisScore,
        answers, 
        createdAt: serverTimestamp(), 
        createdBy: userId, 
        clinicId 
    };
    
    try {
        await addDoc(collection(db, collectionPath), resultData);
        showToast("Hasil kuesioner berhasil disimpan!", "success");
        displayResults(knowledgeScore, maxKnowledgeScore, promisScore, maxPromisScore);
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
    if (tableBody) tableBody.innerHTML = `<tr><td colspan="9" class="text-center p-5"><i class="fas fa-spinner fa-spin"></i> Memuat data pasien...</td></tr>`;
    
    onSnapshot(q, async snapshot => {
        allPatientsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const activePatients = allPatientsData
            .filter(p => p.status === 'aktif' && p.surgeryFinishTime)
            .sort((a,b) => getSecondsFromTS(b.surgeryFinishTime) - getSecondsFromTS(a.surgeryFinishTime));
        
        await renderPatientTable(activePatients);

    }, error => {
        console.error("Error listening to patient updates:", error);
        showToast("Gagal memuat data pasien.", "error");
        if (tableBody) tableBody.innerHTML = `<tr><td colspan="9" class="text-center p-5 text-red-500"><i class="fas fa-exclamation-triangle"></i> Gagal memuat data.</td></tr>`;
    });
}

function listenForQuestionnaireUpdates() {
    if (!userId || !clinicId) return;
    const collectionPath = `clinics/${clinicId}/questionnaires`;
    const q = query(collection(db, collectionPath));
    onSnapshot(q, snapshot => {
        questionnaireData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }, error => {
        console.error("Error listening to questionnaire updates:", error);
        showToast("Gagal memuat data kuesioner.", "error");
    });
}


async function saveNewPatient() {
    if(!userId || !clinicId) return showToast("Koneksi ke database belum siap.", "error");
    const name = document.getElementById('patient-name').value;
    const rm = document.getElementById('patient-rm').value;
    const age = document.getElementById('patient-age').value;
    const gender = document.getElementById('patient-gender').value;
    const finishTimeValue = document.getElementById('patient-finish-time').value;
    const selectedNurse = document.getElementById('current-nurse-selector').value;
    
    const operationSelect = document.getElementById('patient-operation').value;
    let finalOperation = operationSelect;
    if (operationSelect === 'Lainnya...') {
        finalOperation = document.getElementById('patient-operation-other').value.trim();
        if (!finalOperation) {
            return showToast("Harap sebutkan jenis operasi.", "error");
        }
    }

    if (!name || !rm || !age || !finishTimeValue) return showToast("Harap lengkapi semua data pasien.", "error");
    if (!selectedNurse) return showToast("Pilih nama perawat terlebih dahulu.", "warning");

    const initialObservation = {
        mobilityLevel: parseInt(document.getElementById('initial-mobility').value),
        painScale: parseInt(document.getElementById('initial-pain').value),
        ponv: document.getElementById('initial-ponv').value,
        rass: document.getElementById('initial-rass').value,
        notes: document.getElementById('initial-notes').value || 'Data awal pasien.',
        nurse: selectedNurse
    };
    
    const newPatient = {
        name, rm, age, gender,
        operation: finalOperation,
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
        painScale: parseInt(document.getElementById('update-pain').value),
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

function formatPostOpDuration(timestamp) {
    const totalHours = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60));
    if (totalHours < 0) return 'Baru saja';
    if (totalHours < 24) {
        return `${totalHours} jam`;
    }
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    return `${days} hari ${hours} jam`;
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
    const page = document.getElementById(`${pageId}-page`);
    if(page) page.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === pageId));

    if (pageId === 'analysis') {
        renderGlobalAnalysis();
    }
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

function displayResults(knowledgeScore, maxKnowledgeScore, promisScore, maxPromisScore) {
    document.getElementById('questionnaire-form').classList.add('hidden');
    const resultsContainer = document.getElementById('results-container');
    resultsContainer.classList.remove('hidden');
    
    const totalScore = knowledgeScore + promisScore;
    document.getElementById('score-display').textContent = totalScore;
    document.getElementById('score-total').textContent = `dari ${maxKnowledgeScore + maxPromisScore}`;

    const knowledgeLevel = knowledgeScore / maxKnowledgeScore;
    const promisLevel = promisScore / maxPromisScore;

    let knowledgeText, promisText, overallClass;

    if (knowledgeLevel >= 0.75) knowledgeText = "Pemahaman Baik";
    else if (knowledgeLevel >= 0.5) knowledgeText = "Pemahaman Cukup";
    else knowledgeText = "Pemahaman Kurang";

    if (promisLevel >= 0.75) promisText = "Kondisi Mendukung";
    else if (promisLevel >= 0.5) promisText = "Kondisi Cukup Mendukung";
    else promisText = "Kondisi Kurang Mendukung";

    if (knowledgeLevel >= 0.75 && promisLevel >= 0.75) overallClass = "good";
    else if (knowledgeLevel < 0.5 || promisLevel < 0.5) overallClass = "poor";
    else overallClass = "fair";

    const interpEl = document.getElementById('interpretation');
    interpEl.innerHTML = `
        <h4>${knowledgeText} & ${promisText}</h4>
        <div class="score-breakdown">
            <span>Pemahaman: <strong>${knowledgeScore}/${maxKnowledgeScore}</strong></span>
            <span>Kondisi PROMIS: <strong>${promisScore}/${maxPromisScore}</strong></span>
        </div>
    `;
    interpEl.className = `interpretation ${overallClass}`;
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

async function renderPatientTable(patients) {
    const tableBody = document.getElementById('patient-table-body');
    if (!tableBody) return;
    if (patients.length === 0) {
        tableBody.innerHTML = `<tr class="no-data-row"><td colspan="9">Belum ada data pasien aktif. Klik 'Tambah Pasien Baru' untuk memulai.</td></tr>`;
        return;
    }

    const patientRowsHTML = patients.map(p => {
        const latestObs = p.latestObservation || { ponv: 'N/A', rass: 'N/A', mobilityLevel: 1, painScale: 0 };
        const finishSeconds = getSecondsFromTS(p.surgeryFinishTime);
        const finishTimestamp = finishSeconds * 1000;
        
        const painScore = latestObs.painScale;
        let painClass = 'status-level-5'; // Default Green for 0
        if (painScore > 3) {
            painClass = 'status-level-1'; // Red for > 3
        } else if (painScore > 0) {
            painClass = 'status-level-2'; // Yellow for 1-3
        }

        return `
            <tr data-patient-id="${p.id}">
                <td><strong>${p.name}</strong><br><small>${p.rm}</small></td>
                <td>${p.age} thn<br><small>${p.gender}</small></td>
                <td>${p.operation}</td>
                <td>${p.anesthesia}</td>
                <td class="post-op-time" data-timestamp="${finishTimestamp}">${formatPostOpDuration(finishTimestamp)}</td>
                <td>
                    <small>
                        <strong>PONV:</strong> ${latestObs.ponv}<br>
                        <strong>RASS:</strong> ${latestObs.rass}<br>
                        <strong>Nyeri:</strong> <span class="status ${painClass}" style="padding: 2px 6px; font-size: 11px;">${painScore}/10</span>
                    </small>
                </td>
                <td><span class="status status-level-${latestObs.mobilityLevel}">Level ${latestObs.mobilityLevel}</span></td>
                <td class="target-cell"><div class="loading-state"><i class="fas fa-spinner fa-spin"></i> AI...</div></td>
                <td class="suggestion-cell">
                    <div class="loading-state"><i class="fas fa-spinner fa-spin"></i> Menganalisis...</div>
                    <div class="suggestion-content" style="display:none;">
                         <div class="suggestion-text"></div>
                         <div class="action-buttons">
                            <button class="btn btn--primary btn--sm update-patient-btn" data-id="${p.id}"><i class="fas fa-edit"></i> Update</button>
                            <button class="btn btn--success btn--sm discharge-patient-btn" data-id="${p.id}"><i class="fas fa-check-circle"></i> Pulang</button>
                            <button class="btn btn--danger btn--sm delete-patient-btn" data-id="${p.id}"><i class="fas fa-trash-alt"></i> Hapus</button>
                        </div>
                    </div>
                </td>
            </tr>`;
    });
    tableBody.innerHTML = patientRowsHTML.join('');

    for (const patient of patients) {
        getAIPlan(patient).then(plan => {
            const row = tableBody.querySelector(`tr[data-patient-id="${patient.id}"]`);
            if (row) {
                const targetCell = row.querySelector('.target-cell');
                const suggestionCell = row.querySelector('.suggestion-cell');
                
                const targetLevelInfo = appData.mobilityScale.find(l => l.level === plan.targetLevel) || { name: plan.targetText };
                targetCell.innerHTML = `<span class="status status-level-${plan.targetLevel}" title="${targetLevelInfo.name}">${plan.targetText}</span>`;
                
                suggestionCell.querySelector('.loading-state').style.display = 'none';
                const content = suggestionCell.querySelector('.suggestion-content');
                const suggestionTextElement = content.querySelector('.suggestion-text');
                suggestionTextElement.innerHTML = `${plan.suggestion} <span class="ai-badge">✨ AI</span>`;
                suggestionTextElement.title = `Rasional AI: ${plan.rationale}`;
                content.style.display = 'block';
            }
        });
    }
}


async function getAIPlan(patient) {
    const latestObs = patient.latestObservation || { mobilityLevel: 1, ponv: 'Tidak ada keluhan', rass: '0: Alert & Calm', painScale: 0, notes: '' };
    const hoursPostOp = (Date.now() - (getSecondsFromTS(patient.surgeryFinishTime) * 1000)) / (3600 * 1000);

    const systemPrompt = `Anda adalah seorang Perawat Spesialis Pemulihan Dini Pasca Operasi (ERAS - Enhanced Recovery After Surgery) di sebuah rumah sakit terkemuka di Indonesia. Tugas Anda adalah memberikan rekomendasi klinis yang sangat spesifik, aman, dan berorientasi pada tindakan untuk mobilisasi dini pasien. Jawaban WAJIB dalam format JSON.

    Format JSON harus berisi empat kunci:
    1. "targetLevel" (integer): Level mobilisasi (1-8) yang realistis untuk dicapai dalam 12 jam ke depan.
    2. "targetText" (string): Teks target, contoh: "Level 4: Jalan di Tempat".
    3. "suggestion" (string): Saran UTAMA untuk perawat, singkat, jelas, dan dapat ditindaklanjuti. WAJIB dimulai dengan kata kerja (Contoh: "Bantu pasien...", "Kolaborasi untuk...", "Lakukan asesmen...").
    4. "rationale" (string): Alasan klinis singkat di balik saran Anda. Jelaskan MENGAPA target dan saran ini dipilih berdasarkan data pasien.

    ATURAN PENTING:
    - KESELAMATAN ADALAH UTAMA: Jika skala nyeri > 4, ada keluhan PONV (selain 'tidak ada'), atau RASS bukan '0', maka saran pertama HARUS berfokus pada penanganan masalah tersebut (misal: "Kolaborasi untuk manajemen nyeri..."). Target mobilisasi tidak boleh dinaikkan jika ada hambatan ini.
    - SPESIFIK & TERUKUR: Hindari saran umum. Alih-alih "motivasi pasien", berikan "Bantu pasien duduk di tepi bed selama 15 menit, 2 kali sebelum jam makan siang."
    - HOLISTIK: Pertimbangkan semua data. Operasi mayor (Laparotomi, ORIF) memerlukan pendekatan yang lebih hati-hati. Anestesi spinal membatasi mobilisasi dalam 8-12 jam pertama. Usia lanjut (>60 tahun) mungkin perlu waktu pemulihan lebih lama.
    - PROGRESIF: Jika pasien stabil (nyeri <= 4, tidak ada PONV, RASS 0), dorong pasien untuk naik satu level dari level saat ini.`;

    const userQuery = `
    Data Pasien:
    - Umur: ${patient.age} tahun
    - Jenis Kelamin: ${patient.gender}
    - Waktu Pasca-Operasi: ${hoursPostOp.toFixed(1)} jam
    - Jenis Operasi: ${patient.operation}
    - Jenis Anestesi: ${patient.anesthesia}
    - Level Mobilisasi Saat Ini: Level ${latestObs.mobilityLevel}
    - Kondisi PONV (Mual/Muntah): ${latestObs.ponv}
    - Tingkat Kesadaran (RASS): ${latestObs.rass}
    - Skala Nyeri (0-10): ${latestObs.painScale}
    - Catatan Tambahan: ${latestObs.notes || 'Tidak ada'}

    Berdasarkan data di atas, berikan rekomendasi mobilisasi dalam format JSON yang diminta.`;

    try {
        const apiKey = "";
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
        
        const payload = {
            contents: [{ parts: [{ text: userQuery }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
             generationConfig: {
                responseMimeType: "application/json",
            }
        };

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error("AI API Error:", response.status, response.statusText);
            throw new Error('AI response not OK');
        }

        const result = await response.json();
        const jsonString = result.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (jsonString) {
            const parsedJson = JSON.parse(jsonString);
            if (parsedJson.targetLevel && parsedJson.targetText && parsedJson.suggestion && parsedJson.rationale) {
                // Pastikan targetText sesuai dengan scale
                const scaleInfo = appData.mobilityScale.find(s => s.level === parsedJson.targetLevel);
                if (scaleInfo) parsedJson.targetText = `Level ${scaleInfo.level}`;
                return parsedJson;
            }
        }
        throw new Error('Invalid JSON response from AI');

    } catch (error) {
        console.warn("AI recommendation failed, falling back to rule-based logic.", error);
        return getRuleBasedPlan(patient);
    }
}

function getRuleBasedPlan(patient) {
    const latestObs = patient.latestObservation || { mobilityLevel: 1, ponv: 'Tidak ada keluhan', rass: '0: Alert & Calm', painScale: 0 };
    const hoursPostOp = (Date.now() - (getSecondsFromTS(patient.surgeryFinishTime) * 1000)) / (3600 * 1000);
    const currentLevel = latestObs.mobilityLevel;
    const majorOps = ['Laparotomy', 'Mastectomy', 'ORIF', 'ROI'];
    const isMajorOp = majorOps.some(op => patient.operation.includes(op));

    let targetLevel = currentLevel;
    let suggestion = "";
    let rationale = "";

    // Cek hambatan
    if (latestObs.painScale > 4) {
        suggestion = "Kolaborasi untuk manajemen nyeri. Lakukan asesmen ulang nyeri 30 menit setelah intervensi.";
        rationale = "Nyeri > 4 menghambat partisipasi pasien. Mobilisasi ditunda sampai nyeri terkontrol.";
    } else if (latestObs.ponv !== 'Tidak ada keluhan') {
        suggestion = "Atasi mual/muntah sesuai advis medis. Pastikan hidrasi cukup.";
        rationale = "PONV meningkatkan risiko dehidrasi dan kelelahan. Stabilkan kondisi sebelum mobilisasi.";
    } else if (!latestObs.rass.startsWith('0:')) {
        suggestion = "Observasi tingkat kesadaran. Laporkan jika RASS tidak kembali ke 0.";
        rationale = "Pasien harus sadar penuh (RASS 0) untuk dapat mengikuti instruksi mobilisasi dengan aman.";
    } else if (patient.anesthesia.toLowerCase().includes('spinal') && hoursPostOp < 10) {
        targetLevel = 1;
        suggestion = "Fokus pada miring kanan/kiri setiap 2 jam. Awasi tanda-tanda vital dan sensasi motorik ekstremitas bawah.";
        rationale = `Efek anestesi spinal masih berpengaruh dalam 10 jam pertama, batasi mobilisasi di tempat tidur.`;
    } else {
        // Jika tidak ada hambatan, tentukan target
        let nextLevel = currentLevel + 1;
        if (isMajorOp) {
             // Progresi lebih lambat untuk operasi besar
            if (hoursPostOp < 24) targetLevel = Math.min(nextLevel, 3);
            else targetLevel = Math.min(nextLevel, 5);
        } else {
            // Progresi standar
            if (hoursPostOp < 12) targetLevel = Math.min(nextLevel, 3);
            else if (hoursPostOp < 24) targetLevel = Math.min(nextLevel, 4);
            else targetLevel = Math.min(nextLevel, 6);
        }
        targetLevel = Math.min(targetLevel, 8); // Batas atas

        if (targetLevel > currentLevel) {
            suggestion = `Bantu pasien untuk mencapai Level ${targetLevel}. Lakukan secara bertahap dan observasi respon pasien.`;
            rationale = `Pasien stabil dan tidak ada kontraindikasi. Progresi ke level selanjutnya dianjurkan untuk mempercepat pemulihan.`;
        } else {
            suggestion = `Pertahankan Level ${currentLevel}. Lanjutkan observasi dan dorong latihan aktif di level saat ini.`;
            rationale = `Pasien sudah mencapai target untuk fase ini atau ada faktor (misal: op mayor) yang membutuhkan pendekatan konservatif.`;
        }
    }

    const scaleInfo = appData.mobilityScale.find(s => s.level === targetLevel);

    return {
        targetLevel: targetLevel,
        targetText: `Level ${targetLevel}`,
        suggestion: suggestion + ' <span class="ai-badge fallback">Fallback</span>',
        rationale: rationale,
    };
}


function openPatientModal(patientId = null) {
    const isEditing = patientId !== null;
    const patient = isEditing ? allPatientsData.find(p => p.id === patientId) : null;
    document.getElementById('modal-title').textContent = isEditing ? 'Update Observasi Pasien' : 'Tambah Pasien Baru';
    const modalBody = document.getElementById('modal-body');
    
    const ponvOptions = [
        "Tidak ada keluhan", "Mual tanpa muntah", "Muntah 1-2 kali", "Muntah >2 kali"
    ].map(opt => `<option value="${opt}">${opt}</option>`).join('');

    const rassOptions = [
        { value: "+4: Combative", text: "+4: Combative (Sangat melawan)" },
        { value: "+3: Very Agitated", text: "+3: Very Agitated (Sangat gelisah, agresif)" },
        { value: "+2: Agitated", text: "+2: Agitated (Gelisah, gerakan tanpa tujuan)" },
        { value: "+1: Restless", text: "+1: Restless (Gelisah, tidak agresif)" },
        { value: "0: Alert & Calm", text: "0: Alert & Calm (Terjaga dan tenang)" },
        { value: "-1: Drowsy", text: "-1: Drowsy (Mengantuk, respon >10d)" },
        { value: "-2: Light Sedation", text: "-2: Light Sedation (Sedasi ringan, respon <10d)" },
        { value: "-3: Moderate Sedation", text: "-3: Moderate Sedation (Sedasi sedang, respon suara)" },
        { value: "-4: Deep Sedation", text: "-4: Deep Sedation (Sedasi dalam, respon fisik)" },
        { value: "-5: Unarusable", text: "-5: Unarusable (Tidak ada respon)" }
    ].map(opt => `<option value="${opt.value}">${opt.text}</option>`).join('');

    const addForm = `
        <div class="modal-grid">
            <div class="form-group"><label for="patient-name">Nama Pasien</label><input type="text" id="patient-name" class="form-control" required></div>
            <div class="form-group"><label for="patient-rm">Nomor RM</label><input type="text" id="patient-rm" class="form-control" required></div>
            <div class="form-group"><label for="patient-age">Umur (Tahun)</label><input type="number" id="patient-age" class="form-control" min="0" required></div>
            <div class="form-group"><label for="patient-gender">Jenis Kelamin</label><select id="patient-gender" class="form-control"><option>Laki-laki</option><option>Perempuan</option></select></div>
            <div class="form-group full-width"><label for="patient-operation">Jenis Operasi</label><select id="patient-operation" class="form-control">${appData.operations.map(op=>`<option value="${op}">${op}</option>`).join('')}</select></div>
            <div class="form-group full-width hidden" id="other-operation-container">
                <label for="patient-operation-other">Sebutkan Jenis Operasi</label>
                <input type="text" id="patient-operation-other" class="form-control" placeholder="Contoh: Tiroidektomi">
            </div>
            <div class="form-group full-width"><label for="patient-anesthesia">Jenis Anestesi</label><select id="patient-anesthesia" class="form-control">${appData.anesthesiaTypes.map(an=>`<option>${an}</option>`).join('')}</select></div>
            <div class="form-group full-width"><label for="patient-finish-time">Waktu Selesai Operasi</label><input type="datetime-local" id="patient-finish-time" class="form-control" required></div>
        </div>
        <hr class="form-divider">
        <h4>Observasi Awal</h4>
        <div class="modal-grid">
            <div class="form-group"><label>Mual/Muntah (PONV)</label><select id="initial-ponv" class="form-control">${ponvOptions}</select></div>
            <div class="form-group"><label>Tingkat Kesadaran (RASS)</label><select id="initial-rass" class="form-control">${rassOptions}</select></div>
            <div class="form-group"><label>Mobilisasi Awal (JH-HLM)</label><select id="initial-mobility" class="form-control">${appData.mobilityScale.map(s=>`<option value="${s.level}">${s.name}</option>`).join('')}</select></div>
            <div class="form-group"><label for="initial-pain">Skala Nyeri (0-10)</label><input type="number" id="initial-pain" class="form-control" min="0" max="10" value="0"></div>
            <div class="form-group full-width">
                <label for="initial-notes">Catatan Tambahan</label>
                <textarea id="initial-notes" class="form-control" rows="2" placeholder="Contoh: Riwayat hipertensi, terpasang kateter, dll..."></textarea>
            </div>
        </div>
        <div class="modal-footer"><button class="btn btn--primary" id="save-new-patient-btn">Simpan Pasien</button></div>`;
        
    const updateForm = `
        <h4>Pasien: ${patient?.name} (${patient?.rm})</h4>
        <p class="patient-info-subtitle">${patient?.age} tahun, ${patient?.gender}</p>
        <hr class="form-divider">
        <div class="modal-grid">
            <div class="form-group full-width"><label>Update Skala Mobilitas (JH-HLM)</label><select id="update-mobility" class="form-control">${appData.mobilityScale.map(s=>`<option value="${s.level}">${s.name}</option>`).join('')}</select></div>
            <div class="form-group"><label>Skala Nyeri (0-10)</label><input type="number" id="update-pain" class="form-control" min="0" max="10" value="0"></div>
            <div class="form-group"><label>Mual/Muntah (PONV)</label><select id="update-ponv" class="form-control">${ponvOptions}</select></div>
            <div class="form-group"><label>Tingkat Kesadaran (RASS)</label><select id="update-rass" class="form-control">${rassOptions}</select></div>
            <div class="form-group full-width"><label>Catatan Tambahan</label><textarea id="update-notes" class="form-control" rows="2"></textarea></div>
        </div>
        <div class="modal-footer"><button class="btn btn--primary" id="save-update-btn" data-id="${patientId}">Simpan Observasi</button></div>`;
        
    modalBody.innerHTML = isEditing ? updateForm : addForm;

    if (isEditing) {
        const latestObs = patient.latestObservation || {};
        document.getElementById('update-mobility').value = latestObs.mobilityLevel || 1;
        document.getElementById('update-pain').value = latestObs.painScale || 0;
        document.getElementById('update-ponv').value = latestObs.ponv || 'Tidak ada keluhan';
        document.getElementById('update-rass').value = latestObs.rass || '0: Alert & Calm';
        document.getElementById('update-notes').value = latestObs.notes || '';
        document.getElementById('save-update-btn').addEventListener('click', savePatientUpdate);
    } else {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        document.getElementById('patient-finish-time').value = now.toISOString().slice(0, 16);
        document.getElementById('save-new-patient-btn').addEventListener('click', saveNewPatient);

        const operationSelect = document.getElementById('patient-operation');
        const otherOperationContainer = document.getElementById('other-operation-container');
        operationSelect.addEventListener('change', () => {
            otherOperationContainer.classList.toggle('hidden', operationSelect.value !== 'Lainnya...');
        });
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
               el.textContent = formatPostOpDuration(timestamp);
            }
        });
    };
    setInterval(updateTimes, 1000 * 60 * 30);
    updateTimes();
}

// --- FUNGSI ANALISIS GLOBAL (DIUBAH TOTAL) ---

function renderGlobalAnalysis() {
    renderQuestionnaireAnalysis(questionnaireData);
    renderPatientDashboardAnalysis(allPatientsData);
}

function renderQuestionnaireAnalysis(data) {
    const container = document.getElementById('questionnaire-analysis-container');
    if (!data || data.length === 0) {
        container.innerHTML = `<div class="info-card"><p>Belum ada data kuesioner yang cukup untuk dianalisis.</p></div>`;
        return;
    }

    const preTests = data.filter(d => d.testType === 'pretest');
    const postTests = data.filter(d => d.testType === 'posttest');
    
    const avgPreScore = preTests.length > 0 ? (preTests.reduce((sum, d) => sum + (d.totalScore || 0), 0) / preTests.length) : 0;
    const avgPostScore = postTests.length > 0 ? (postTests.reduce((sum, d) => sum + (d.totalScore || 0), 0) / postTests.length) : 0;
    const improvement = avgPreScore > 0 ? ((avgPostScore - avgPreScore) / avgPreScore) * 100 : (avgPostScore > 0 ? 100 : 0);

    container.innerHTML = `
        <div class="analysis-grid">
            <div class="stat-card">
                <div class="stat-icon"><i class="fas fa-question-circle"></i></div>
                <div class="stat-content">
                    <div class="stat-value">${avgPreScore.toFixed(1)}</div>
                    <div class="stat-label">Rata-rata Skor Pre-Test</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon"><i class="fas fa-check-circle"></i></div>
                <div class="stat-content">
                    <div class="stat-value">${avgPostScore.toFixed(1)}</div>
                    <div class="stat-label">Rata-rata Skor Post-Test</div>
                </div>
            </div>
            <div class="stat-card success">
                <div class="stat-icon"><i class="fas fa-arrow-up"></i></div>
                <div class="stat-content">
                    <div class="stat-value">${improvement.toFixed(0)}%</div>
                    <div class="stat-label">Peningkatan Skor</div>
                </div>
            </div>
        </div>
        <div class="interpretation-card">
            <h4>Interpretasi</h4>
            <p>Data menunjukkan adanya <strong>peningkatan skor gabungan (pemahaman & kondisi) pasien sebesar ${improvement.toFixed(0)}%</strong> setelah mendapatkan edukasi. Skor rata-rata yang lebih tinggi pada post-test mengindikasikan bahwa intervensi dan perawatan secara umum efektif dalam meningkatkan kesiapan pasien untuk mobilisasi.</p>
        </div>
    `;
}

function renderPatientDashboardAnalysis(data) {
    const container = document.getElementById('patient-analysis-container');
    const patients = data.filter(p => p.latestObservation && p.surgeryFinishTime);

    if (patients.length < 3) { // Membutuhkan lebih banyak data untuk analisis yang berarti
        container.innerHTML = `<div class="info-card"><p>Data pasien belum cukup untuk membuat analisis komprehensif. Dibutuhkan minimal 3 data pasien.</p></div>`;
        return;
    }

    container.innerHTML = `
        <div class="analysis-grid-varied">
            <div class="chart-container full-span">
                <h4>Progres Mobilisasi vs. Target Seiring Waktu</h4>
                <canvas id="progress-vs-target-chart"></canvas>
            </div>
            <div class="chart-container">
                <h4>Perbandingan Level per Jenis Operasi & Anestesi</h4>
                <canvas id="op-anesthesia-chart"></canvas>
            </div>
            <div class="chart-container">
                <h4>Perbandingan Level per Umur & Jenis Kelamin</h4>
                <canvas id="age-gender-chart"></canvas>
            </div>
             <div class="chart-container full-span">
                <h4>Dampak Hambatan (PONV/RASS/Nyeri) Terhadap Pencapaian Target</h4>
                <canvas id="barrier-impact-chart"></canvas>
            </div>
        </div>
        <div class="interpretation-card">
            <h4>Interpretasi Analisis Komprehensif</h4>
            <p>Analisis ini menghubungkan berbagai faktor untuk memberikan gambaran lengkap tentang progres mobilisasi dini di ruangan Anda:</p>
            <ul>
                <li><strong>Progres vs. Target (Grafik 1):</strong> Grafik ini adalah indikator utama keberhasilan program. Idealnya, garis 'Level Aktual' harus selalu mendekati atau bahkan melampaui garis 'Target Level' seiring berjalannya hari pasca-operasi (POD). Jarak yang lebar antara kedua garis mungkin mengindikasikan adanya tantangan sistemik.</li>
                <li><strong>Faktor Klinis (Grafik 2):</strong> Grafik ini membandingkan dampak gabungan dari jenis operasi dan anestesi. Misalnya, Anda mungkin menemukan bahwa pasien 'Operasi Mayor' dengan 'Anestesi Spinal' memiliki progres paling lambat, yang menandakan bahwa kelompok ini memerlukan perhatian dan strategi mobilisasi khusus.</li>
                <li><strong>Faktor Demografis (Grafik 3):</strong> Dengan membandingkan kelompok umur dan jenis kelamin, kita dapat mengidentifikasi populasi berisiko. Jika pasien 'Usia > 60' secara konsisten menunjukkan level mobilisasi yang lebih rendah, ini bisa menjadi dasar untuk mengembangkan protokol mobilisasi geriatri.</li>
                <li><strong>Hambatan Utama (Grafik 4):</strong> Grafik ini secara kuantitatif menunjukkan 'biang keladi' dari kegagalan pencapaian target. Persentase keberhasilan yang jauh lebih rendah pada kelompok 'Dengan Hambatan' adalah bukti kuat bahwa manajemen nyeri, PONV, dan RASS yang efektif merupakan prasyarat mutlak untuk keberhasilan mobilisasi.</li>
            </ul>
        </div>
    `;
    
    // --- 1. Progres Aktual vs Target per POD ---
    const podData = {}; // { 0: { actuals: [], targets: [] } }
    patients.forEach(p => {
        const hoursPostOp = (getSecondsFromTS(p.dischargedAt || p.latestObservation.createdAt || p.createdAt) - getSecondsFromTS(p.surgeryFinishTime)) / 3600;
        const pod = Math.floor(hoursPostOp / 24);
        if (pod < 4) { // Analisis untuk 4 hari pertama
            if (!podData[pod]) podData[pod] = { actuals: [], targets: [] };
            podData[pod].actuals.push(p.latestObservation.mobilityLevel);
            podData[pod].targets.push(getRuleBasedPlan(p).targetLevel);
        }
    });

    const podLabels = Object.keys(podData).sort((a,b)=>a-b);
    const actualsAvg = podLabels.map(pod => podData[pod].actuals.reduce((a,b)=>a+b,0) / podData[pod].actuals.length);
    const targetsAvg = podLabels.map(pod => podData[pod].targets.reduce((a,b)=>a+b,0) / podData[pod].targets.length);

    renderChart('progress-vs-target-chart', 'line', {
        labels: podLabels.map(l => `Hari ke-${l}`),
        datasets: [
            { label: 'Level Aktual Rata-rata', data: actualsAvg, borderColor: 'var(--color-primary)', backgroundColor: 'transparent', tension: 0.1, pointRadius: 5 },
            { label: 'Target Level Rata-rata', data: targetsAvg, borderColor: 'var(--color-error)', backgroundColor: 'transparent', borderDash: [5, 5], tension: 0.1, pointRadius: 5 }
        ]
    });

    // --- 2. Perbandingan per Jenis Operasi & Anestesi ---
    const majorOps = ['Laparotomy', 'Mastectomy', 'ORIF', 'ROI'];
    const opAnesthesiaData = {
        'Op. Minor - General': [], 'Op. Minor - Spinal': [],
        'Op. Mayor - General': [], 'Op. Mayor - Spinal': []
    };
    patients.forEach(p => {
        const opType = majorOps.includes(p.operation) ? 'Op. Mayor' : 'Op. Minor';
        const anType = p.anesthesia.includes('General') ? 'General' : 'Spinal';
        const key = `${opType} - ${anType}`;
        if (opAnesthesiaData.hasOwnProperty(key)) {
            opAnesthesiaData[key].push(p.latestObservation.mobilityLevel);
        }
    });
    const opAnesthesiaLabels = Object.keys(opAnesthesiaData);
    const opAnesthesiaValues = opAnesthesiaLabels.map(label => {
        const levels = opAnesthesiaData[label];
        return levels.length > 0 ? levels.reduce((a,b)=>a+b,0) / levels.length : 0;
    });
    renderChart('op-anesthesia-chart', 'bar', {
        labels: opAnesthesiaLabels,
        datasets: [{ label: 'Level Rata-rata', data: opAnesthesiaValues, backgroundColor: ['#2dd4bf', '#38bdf8', '#fb923c', '#f87171'], borderRadius: 4 }]
    }, { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } });

    // --- 3. Perbandingan per Umur & Jenis Kelamin ---
    const ageGenderData = {
        'L: <40 thn': [], 'P: <40 thn': [],
        'L: 40-60 thn': [], 'P: 40-60 thn': [],
        'L: >60 thn': [], 'P: >60 thn': []
    };
     patients.forEach(p => {
        const age = parseInt(p.age);
        const gender = p.gender === 'Laki-laki' ? 'L' : 'P';
        let ageGroup = '';
        if (age < 40) ageGroup = '<40 thn';
        else if (age <= 60) ageGroup = '40-60 thn';
        else ageGroup = '>60 thn';
        const key = `${gender}: ${ageGroup}`;
        if (ageGenderData.hasOwnProperty(key)) {
            ageGenderData[key].push(p.latestObservation.mobilityLevel);
        }
    });
    const ageGenderLabels = Object.keys(ageGenderData);
    const ageGenderValues = ageGenderLabels.map(label => {
        const levels = ageGenderData[label];
        return levels.length > 0 ? levels.reduce((a,b)=>a+b,0) / levels.length : 0;
    });
    renderChart('age-gender-chart', 'bar', {
        labels: ageGenderLabels,
        datasets: [{ label: 'Level Rata-rata', data: ageGenderValues, backgroundColor: ['#3b82f6', '#ec4899', '#22c55e', '#f43f5e', '#8b5cf6', '#eab308' ], borderRadius: 4 }]
    }, { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } });


    // --- 4. Analisis Dampak Hambatan (PONV/RASS/Nyeri) ---
    const barrierAnalysis = {
        withBarrier: { success: 0, total: 0 },
        noBarrier: { success: 0, total: 0 }
    };
    patients.forEach(p => {
        const obs = p.latestObservation;
        const painScore = obs.painScale || 0;
        const hasBarrier = obs.ponv !== 'Tidak ada keluhan' || !obs.rass.startsWith('0:') || painScore >= 4;
        const targetPlan = getRuleBasedPlan(p);
        const isAchieved = obs.mobilityLevel >= targetPlan.targetLevel;

        const group = hasBarrier ? 'withBarrier' : 'noBarrier';
        barrierAnalysis[group].total++;
        if (isAchieved) {
            barrierAnalysis[group].success++;
        }
    });

    const barrierData = [
        barrierAnalysis.noBarrier.total > 0 ? (barrierAnalysis.noBarrier.success / barrierAnalysis.noBarrier.total) * 100 : 0,
        barrierAnalysis.withBarrier.total > 0 ? (barrierAnalysis.withBarrier.success / barrierAnalysis.withBarrier.total) * 100 : 0
    ];

    renderChart('barrier-impact-chart', 'bar', {
        labels: ['Pasien Stabil (Tanpa Hambatan)', 'Pasien dengan PONV/RASS/Nyeri ≥ 4'],
        datasets: [{
            label: '% Target Tercapai',
            data: barrierData,
            backgroundColor: ['rgba(var(--color-success-rgb), 0.7)', 'rgba(var(--color-error-rgb), 0.6)'],
            borderRadius: 4,
            barThickness: 60
        }]
    }, { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100, ticks: { callback: value => `${value}%` } } } });
}


function renderChart(canvasId, type, data, options = {}) {
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;
    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
    }
    const defaultOptions = {
        maintainAspectRatio: true,
	aspectRatio: 2.5,
        responsive: true,
        plugins: {
            legend: {
                display: type === 'line',
                position: 'top',
            },
            tooltip: {
                enabled: true,
                backgroundColor: 'rgba(var(--color-slate-900-rgb), 0.9)',
                titleColor: 'var(--color-white)',
                bodyColor: 'var(--color-white)',
                padding: 12,
                cornerRadius: 8,
                boxPadding: 4,
                titleFont: { weight: 'bold' },
                bodyFont: { size: 14 },
            }
        },
        scales: {
             x: { grid: { display: false }, ticks: { color: 'var(--color-slate-500)'} },
             y: { grid: { drawBorder: false }, ticks: { color: 'var(--color-slate-500)'} }
        },
    };

    if (type === 'pie' || type === 'doughnut') {
        delete defaultOptions.scales;
    }
    
    chartInstances[canvasId] = new Chart(ctx, {
        type: type,
        data: data,
        options: { ...defaultOptions, ...options }
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
