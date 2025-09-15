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
    if (tableBody) tableBody.innerHTML = `<tr><td colspan="10" class="text-center p-5"><i class="fas fa-spinner fa-spin"></i> Memuat data pasien...</td></tr>`;
    
    onSnapshot(q, async snapshot => {
        allPatientsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const activePatients = allPatientsData
            .filter(p => p.status === 'aktif' && p.surgeryFinishTime)
            .sort((a,b) => getSecondsFromTS(b.surgeryFinishTime) - getSecondsFromTS(a.surgeryFinishTime));
        
        await renderPatientTable(activePatients);

    }, error => {
        console.error("Error listening to patient updates:", error);
        showToast("Gagal memuat data pasien.", "error");
        if (tableBody) tableBody.innerHTML = `<tr><td colspan="10" class="text-center p-5 text-red-500"><i class="fas fa-exclamation-triangle"></i> Gagal memuat data.</td></tr>`;
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
        tableBody.innerHTML = `<tr class="no-data-row"><td colspan="10">Belum ada data pasien aktif. Klik 'Tambah Pasien Baru' untuk memulai.</td></tr>`;
        return;
    }

    const patientRowsHTML = patients.map(p => {
        const latestObs = p.latestObservation || { ponv: 'N/A', rass: 'N/A', mobilityLevel: 1, painScale: 'N/A' };
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
                <td><small><strong>PONV:</strong> ${latestObs.ponv}<br><strong>RASS:</strong> ${latestObs.rass}</small></td>
                <td><span class="status ${painClass}">${painScore}/10</span></td>
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
                
                targetCell.innerHTML = `<span class="status status-level-${plan.targetLevel}" title="${plan.reason || ''}">${plan.targetText}</span>`;
                
                suggestionCell.querySelector('.loading-state').style.display = 'none';
                const content = suggestionCell.querySelector('.suggestion-content');
                content.querySelector('.suggestion-text').innerHTML = `${plan.suggestion} <span class="ai-badge">✨ AI</span>`;
                content.style.display = 'block';
            }
        });
    }
}


// Utility: robust hours since surgery finish (epoch seconds or ISO string supported)
function getHoursSince(ts) {
  if (!ts) return NaN;
  let ms = 0;
  if (typeof ts === 'number') {
    // assume seconds
    ms = ts * 1000;
  } else if (typeof ts === 'string') {
    const d = new Date(ts);
    if (!isNaN(d.getTime())) ms = d.getTime();
  }
  if (!ms) return NaN;
  return (Date.now() - ms) / 3600000;
}

// JH-HLM labels (evidence-based mapping)
const HLM_LABELS = {
  1: "Level 1", // Berbaring
  2: "Level 2", // Aktivitas di tempat tidur
  3: "Level 3", // Duduk tepi tempat tidur
  4: "Level 4", // Transfer ke kursi/commode
  5: "Level 5", // Berdiri ≥1 menit
  6: "Level 6", // Jalan ≥10 langkah
  7: "Level 7", // Jalan ≥7,5 m (≥25 ft)
  8: "Level 8"  // Jalan ≥75 m (≥250 ft)
};

// Simple classifier for clinical stability
function classifyStability(patient, latestObs, hoursPostOp) {
  const rassStr = (latestObs.rass || '').toString().trim();
  const rassStable = rassStr.startsWith('0') || rassStr === '0';
  const pain = Number.isFinite(latestObs.painScale) ? latestObs.painScale : 0;
  const painLow = pain <= 3; // 0-3 aman untuk progresi
  const ponvText = (latestObs.ponv || '').toLowerCase();
  const ponvNone = ponvText.includes('tidak') || ponvText.includes('none') || ponvText.includes('no');
  const anesthesia = (patient.anesthesia || '').toLowerCase();
  const isSpinal = anesthesia.includes('spinal') || anesthesia.includes('subarachnoid');
  // Spinal residual window: konservatif pada 0–6 jam pertama
  const spinalResidual = isSpinal && Number.isFinite(hoursPostOp) && hoursPostOp < 6;
  // Unstable if any critical factor
  const unstable = !rassStable || !painLow || !ponvNone || spinalResidual;
  return { rassStable, painLow, ponvNone, isSpinal, spinalResidual, unstable };
}

// Suggest allowed target range based on stability and current level
function computeAllowedRange(currentLevel, flags) {
  const cur = Math.min(8, Math.max(1, Number(currentLevel) || 1));
  // Default progression: allow up to cur+1 if stable
  let minT = cur;
  let maxT = Math.min(8, cur + 1);

  if (flags.unstable) {
    // Constrain aggressively when unstable
    // Cap at 3 if spinal residual or RASS not 0; otherwise cap at 4
    const cap = (flags.spinalResidual || !flags.rassStable) ? 3 : 4;
    maxT = Math.min(maxT, cap);
    // Ensure min not above max
    minT = Math.min(minT, maxT);
  }
  return { minTarget: minT, maxTarget: maxT };
}

// Build concise, actionable Indonesian suggestions per target level
function levelSuggestion(level, flags) {
  const safetyPrefix = (!flags.rassStable || !flags.painLow || !flags.ponvNone)
    ? "Pantau tanda vital, kontrol nyeri dan mual terlebih dulu. "
    : "";
  switch (level) {
    case 1: return safetyPrefix + "Ubah posisi miring kanan–kiri tiap 2 jam, latihan pernapasan, ROM pasif–aktif di tempat tidur.";
    case 2: return safetyPrefix + "Lakukan latihan kaki (ankle pump, quad/glute set) dan bridging di tempat tidur, kepala tempat tidur 30–45° jika hemodinamik stabil.";
    case 3: return safetyPrefix + "Bantu duduk tepi tempat tidur 5–10 menit, pantau pusing/hipotensi, ulang 2–3 sesi jika toleran.";
    case 4: return safetyPrefix + "Transfer ke kursi dengan 1–2 pendamping/alat bantu, durasi duduk 15–30 menit, pastikan pengaman jatuh.";
    case 5: return safetyPrefix + "Latih berdiri ≥1 menit dengan alat bantu bila perlu, uji ortostatik, ulang 2–3 kali dengan istirahat cukup.";
    case 6: return safetyPrefix + "Jalan di kamar ≥10 langkah dengan pendamping, gunakan walker bila perlu, hentikan bila pusing/mual.";
    case 7: return safetyPrefix + "Jalan di koridor ±10–20 m dengan satu pendamping, istirahat bila lelah, target 2 sesi/hari.";
    case 8: return safetyPrefix + "Jalan di koridor ≥75 m total/hari dalam beberapa sesi, tingkatkan kemandirian bertahap.";
    default: return safetyPrefix + "Mulai dari intervensi dasar dan tingkatkan bertahap sesuai toleransi.";
  }
}

// Robust JSON extraction from model text
function extractJson(text) {
  if (!text) return null;
  // Strip code fences if any
  let t = text.trim();
  if (t.startsWith('```
    t = t.replace(/^```json/i, '').replace(/^``````$/, '').trim();
  }
  // Find first { ... } block
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const candidate = t.slice(start, end + 1);
    try {
      return JSON.parse(candidate);
    } catch (_) { /* ignore */ }
  }
  // Fallback straight parse
  try { return JSON.parse(t); } catch (_) { return null; }
}

// Strong rule-based fallback aligned to JH-HLM and safety rules
function getRuleBasedPlan(patient) {
  const latestObs = patient.latestObservation || {
    mobilityLevel: 1, ponv: 'Tidak ada keluhan', rass: '0: Alert & Calm', painScale: 0, notes: ''
  };
  const hoursPostOp = getHoursSince(patient.surgeryFinishTime);
  const flags = classifyStability(patient, latestObs, hoursPostOp);
  const cur = Math.min(8, Math.max(1, Number(latestObs.mobilityLevel) || 1));
  const { minTarget, maxTarget } = computeAllowedRange(cur, flags);

  // Choose conservative within allowed range when unstable, otherwise highest allowed
  const targetLevel = flags.unstable ? minTarget : maxTarget;
  const suggestion = levelSuggestion(targetLevel, flags);

  return {
    targetLevel,
    targetText: HLM_LABELS[targetLevel],
    suggestion
  };
}

async function getAIPlan(patient) {
  const latestObs = patient.latestObservation || {
    mobilityLevel: 1,
    ponv: 'Tidak ada keluhan',
    rass: '0: Alert & Calm',
    painScale: 0,
    notes: ''
  };

  const hoursPostOp = getHoursSince(patient.surgeryFinishTime);
  const flags = classifyStability(patient, latestObs, hoursPostOp);
  const curLevel = Math.min(8, Math.max(1, Number(latestObs.mobilityLevel) || 1));
  const { minTarget, maxTarget } = computeAllowedRange(curLevel, flags);

  // Build structured instruction with explicit JSON schema and guardrails
  const systemPrompt =
    "Anda adalah perawat klinis ahli pemulihan pasca-operasi di Indonesia. " +
    "Tugas Anda: tentukan target mobilisasi JH-HLM yang aman dan progresif, dengan prioritas keselamatan. " +
    "Kembalikan HANYA JSON dengan kunci persis: targetLevel (integer 1-8), targetText (string 'Level X'), suggestion (string, Bahasa Indonesia, singkat-aksi). " +
    "Aturan: Jika RASS ≠ 0, nyeri >3/10, PONV aktif, atau masih dalam efek anestesi spinal dini, pilih target konservatif dalam rentang diizinkan. " +
    "Jika stabil, dorong naik 1 level dari capaian saat ini. Jangan sertakan penjelasan di luar JSON.";

  const userPayload = {
    patient: {
      age: patient.age,
      gender: patient.gender,
      operation: patient.operation,
      anesthesia: patient.anesthesia,
      surgeryFinishTime: patient.surgeryFinishTime,
      hoursPostOp: Number.isFinite(hoursPostOp) ? Number(hoursPostOp.toFixed(1)) : null
    },
    latestObservation: {
      mobilityLevel: curLevel,
      ponv: latestObs.ponv,
      rass: latestObs.rass,
      painScale: latestObs.painScale,
      notes: latestObs.notes || ''
    },
    // Guardrails for model
    policy: {
      allowedTargetMin: minTarget,
      allowedTargetMax: maxTarget,
      hlmDefinitions: {
        1: "Berbaring",
        2: "Aktivitas di tempat tidur",
        3: "Duduk tepi tempat tidur",
        4: "Transfer ke kursi/commode",
        5: "Berdiri ≥1 menit",
        6: "Jalan ≥10 langkah",
        7: "Jalan ≥7,5 m",
        8: "Jalan ≥75 m"
      }
    },
    outputSchema: {
      type: "object",
      required: ["targetLevel", "targetText", "suggestion"],
      properties: {
        targetLevel: { type: "integer", minimum: 1, maximum: 8 },
        targetText: { type: "string" },
        suggestion: { type: "string" }
      }
    }
  };

  const apiKey = ""; // <-- isi API key
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

  // Timeout + retry
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  const payload = {
    contents: [
      { parts: [{ text: JSON.stringify(userPayload) }] }
    ],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2,
      topK: 32,
      topP: 0.9,
      maxOutputTokens: 200
    }
  };

  try {
    if (!apiKey) throw new Error("Missing API key");
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.error("AI API Error:", response.status, response.statusText);
      throw new Error('AI response not OK');
    }

    const result = await response.json();
    const raw = result?.candidates?.?.content?.parts?.?.text || "";
    const parsed = extractJson(raw);

    // Validate and normalize
    let out = parsed && typeof parsed === 'object' ? parsed : null;
    if (out) {
      let tLvl = parseInt(out.targetLevel, 10);
      if (!Number.isFinite(tLvl)) throw new Error('Invalid targetLevel');
      // Enforce guardrail range
      tLvl = Math.max(minTarget, Math.min(maxTarget, tLvl));
      tLvl = Math.max(1, Math.min(8, tLvl));
      const tText = `Level ${tLvl}`;
      const sugg = String(out.suggestion || '').trim();
      const final = {
        targetLevel: tLvl,
        targetText: tText,
        suggestion: sugg || levelSuggestion(tLvl, classifyStability(patient, latestObs, hoursPostOp))
      };
      return final;
    }

    throw new Error('Invalid JSON response from AI');
  } catch (error) {
    console.warn("AI recommendation failed, falling back to rule-based logic.", error);
    clearTimeout(timeout);
    return getRuleBasedPlan(patient);
  }
}


function getRuleBasedPlan(patient) {
    const latestObs = patient.latestObservation || { mobilityLevel: 1, ponv: 'Tidak ada keluhan', rass: '0: Alert & Calm', painScale: 0 };
    const hoursPostOp = (Date.now() - (getSecondsFromTS(patient.surgeryFinishTime) * 1000)) / (3600 * 1000);
    const currentLevel = latestObs.mobilityLevel;

    let targetLevel = (hoursPostOp < 24) ? 3 : (hoursPostOp < 48 ? 4 : 5);
    let suggestions = [];

    if (latestObs.ponv !== 'Tidak ada keluhan' || !latestObs.rass.startsWith('0:')) {
        targetLevel = Math.min(targetLevel, currentLevel, 2);
        suggestions.push("<strong>Prioritas:</strong> Atasi PONV/RASS sebelum melanjutkan mobilisasi.");
    }
    
    if (patient.anesthesia.toLowerCase().includes('spinal') && hoursPostOp < 8) {
        targetLevel = 1;
        suggestions.push("<strong>Perhatian Anestesi Spinal:</strong> Pasien dalam 8 jam pertama, fokus pada miring kanan/kiri.");
    }

    const isTargetAchieved = currentLevel >= targetLevel;

    if (isTargetAchieved) {
        suggestions.unshift(`<strong>Pertahankan!</strong> Target tercapai. Dorong ke level berikutnya jika kondisi stabil.`);
    } else {
        suggestions.unshift(`<strong>Ayo Kejar!</strong> Fokus untuk mencapai Level ${targetLevel}.`);
    }

    return {
        targetLevel: targetLevel,
        targetText: `Level ${targetLevel}`,
        suggestion: suggestions.join('<br>') + ' <span class="ai-badge fallback">Fallback</span>'
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

