// app.js — MODIFIED with Gemini AI Integration for Clinical Suggestions

// Import Firebase services
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, collection, addDoc, doc, onSnapshot, updateDoc, query, serverTimestamp, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// --- KONFIGURASI APLIKASI ---
const appData = {
    nurses: ["Suriansyah, S.Kep., Ns", "Akbar Wirahadi, A.Md.Kep", "Annisa Aulia Rahma, A.Md.Kep", "Dina Ghufriana, S.Kep.Ners", "Dwi Sucilowati, AMK", "Gusti Rusmiyati, S.Kep.Ners", "Gusti Rusmiyati, S.Kep.Ners", "Herliyana Paramitha, S.Kep.,Ners", "Isnawati, AMK", "Khairun Nisa, S.Kep.Ners", "Noor Makiah, AMK", "Nurmilah A, A.Md.Kep", "Qatrunnada Mufidah, A.Md.Kep", "Raudatul Hikmah, S.Kep., Ns", "Verawaty, AMK", "Zahratul Zannah, S.Kep., Ns"],
    operations: ["Appendectomy", "Hernia Repair", "Laparotomy", "Mastectomy", "BPH", "Excision", "Debridement", "ORIF", "ROI", "Lainnya..."],
    anesthesiaTypes: ["General Anesthesia", "Spinal Anesthesia", "Epidural Anesthesia", "Regional Block"],
    mobilityScale: [
        {level: 1, name: "Level 1: Berbaring di Tempat Tidur", description: "Pasien berbaring, dapat melakukan miring kanan/kiri secara mandiri."},
        {level: 2, name: "Level 2: Duduk di Tepi Tempat Tidur", description: "Pasien mampu duduk di tepi tempat tidur setidaknya selama 1 menit."},
        {level: 3, name: "Level 3: Berdiri", description: "Pasien mampu berdiri di samping tempat tidur setidaknya selama 1 menit."},
        {level: 4, name: "Level 4: Berjalan di Tempat", description: "Pasien mampu melangkah di tempat di samping tempat tidur."},
        {level: 5, name: "Level 5: Transfer ke Kursi & Berjalan > 10 Langkah", description: "Mampu pindah ke kursi dan/atau berjalan lebih dari 10 langkah."},
        {level: 6, name: "Level 6: Berjalan > 7 Meter", description: "Berjalan mandiri dengan atau tanpa alat bantu sejauh lebih dari 7 meter."},
        {level: 7, name: "Level 7: Berjalan > 30 Meter", description: "Berjalan mandiri dengan atau tanpa alat bantu sejauh lebih dari 30 meter."},
        {level: 8, name: "Level 8: Naik Turun Tangga atau berjalan > 75 Meter", description: "Mampu naik/turun setidaknya satu anak tangga atau Berjalan Mandiri lebih dari 75 meter."}
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
        painScale: 0,
        ponv: document.getElementById('initial-ponv').value,
        rass: document.getElementById('initial-rass').value,
        notes: 'Data awal pasien.',
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
    // 1. Hitung total jam sejak operasi selesai
    const totalHours = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60));
    
    // Jika waktu belum berlalu, tampilkan 'Baru saja'
    if (totalHours < 1) return 'kurang dari 1 jam';
    
    // 2. Jika kurang dari 24 jam, tampilkan dalam format jam saja
    if (totalHours < 24) {
        return `${totalHours} jam`;
    }
    
    // 3. Jika lebih dari 24 jam, hitung hari dan sisa jamnya
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    
    // 4. Kembalikan dalam format "X hari Y jam"
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

async function renderPatientTable(patients) {
    const tableBody = document.getElementById('patient-table-body');
    if (!tableBody) return;
    if (patients.length === 0) {
        tableBody.innerHTML = `<tr class="no-data-row"><td colspan="9">Belum ada data pasien aktif. Klik 'Tambah Pasien Baru' untuk memulai.</td></tr>`;
        return;
    }

    const patientPromises = patients.map(p => {
        const latestObs = p.latestObservation || { ponv: 'N/A', rass: 'N/A', mobilityLevel: 1 };
        const finishSeconds = getSecondsFromTS(p.surgeryFinishTime);
        return `
            <tr data-patient-id="${p.id}">
                <td><strong>${p.name}</strong><br><small>${p.rm}</small></td>
                <td>${p.age} thn<br><small>${p.gender}</small></td>
                <td>${p.operation}</td>
                <td>${p.anesthesia}</td>
                <td class="post-op-time" data-timestamp="${finishSeconds}">${formatPostOpDuration(finishSeconds * 1000)}</td>
                <td>${latestObs.ponv} / ${latestObs.rass}</td>
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
    tableBody.innerHTML = patientPromises.join('');

    // Panggil AI untuk setiap pasien setelah render awal
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


// --- PERUBAHAN BESAR: INTEGRASI GEMINI AI ---
async function getAIPlan(patient) {
    const latestObs = patient.latestObservation || { mobilityLevel: 1, ponv: 'Tidak Ada', rass: 'Sadar & Tenang', painScale: 0 };
    const hoursPostOp = (Date.now() - (getSecondsFromTS(patient.surgeryFinishTime) * 1000)) / (3600 * 1000);

    const systemPrompt = `Anda adalah seorang perawat klinis ahli pemulihan pasca-operasi di sebuah rumah sakit di Indonesia. Tugas Anda adalah memberikan rekomendasi mobilisasi dini yang aman dan efektif. Berikan jawaban HANYA dalam format JSON.
    Format JSON harus berisi tiga kunci: "targetLevel" (angka integer antara 1-8), "targetText" (string, contoh: "Level 4"), dan "suggestion" (string dalam Bahasa Indonesia, singkat, jelas, dan berorientasi pada tindakan untuk perawat).
    Analisis data pasien berikut dan tentukan target serta saran yang paling sesuai. Pertimbangkan semua faktor secara holistik (umur, jenis kelamin, jenis operasi, anestesi, lama post-op, ponv, rass, dll).
    - Prioritaskan keamanan: Jika ada PONV, RASS yang tidak stabil, atau efek anestesi spinal, target harus konservatif.
    - Bersikap progresif: Jika pasien stabil, dorong ke level berikutnya.
    - Berikan saran yang spesifik dan dapat ditindaklanjuti.`;

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

    Berdasarkan data di atas, berikan rekomendasi mobilisasi dalam format JSON yang diminta.`;

    try {
        const apiKey = ""; // Kunci API akan disediakan oleh lingkungan runtime
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
            if (parsedJson.targetLevel && parsedJson.targetText && parsedJson.suggestion) {
                return parsedJson;
            }
        }
        throw new Error('Invalid JSON response from AI');

    } catch (error) {
        console.warn("AI recommendation failed, falling back to rule-based logic.", error);
        return getRuleBasedPlan(patient); // Fallback to a simpler, rule-based system
    }
}

// Fallback logic if AI fails
function getRuleBasedPlan(patient) {
    const latestObs = patient.latestObservation || { mobilityLevel: 1, ponv: 'Tidak Ada', rass: 'Sadar & Tenang', painScale: 0 };
    const hoursPostOp = (Date.now() - (getSecondsFromTS(patient.surgeryFinishTime) * 1000)) / (3600 * 1000);
    const currentLevel = latestObs.mobilityLevel;

    let targetLevel = (hoursPostOp < 24) ? 3 : (hoursPostOp < 48 ? 4 : 5); // Simple hour-based target
    let suggestions = [];

    if (latestObs.ponv !== 'Tidak Ada' || latestObs.rass !== 'Sadar & Tenang') {
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
        suggestion: suggestions.join('<br>') + ' <span class="ai-badge fallback">Fallback</span>' // Indicate it's a fallback
    };
}


function openPatientModal(patientId = null) {
    const isEditing = patientId !== null;
    const patient = isEditing ? allPatientsData.find(p => p.id === patientId) : null;
    document.getElementById('modal-title').textContent = isEditing ? 'Update Observasi Pasien' : 'Tambah Pasien Baru';
    const modalBody = document.getElementById('modal-body');
    
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
            <div class="form-group"><label>Mual/Muntah (PONV)</label><select id="initial-ponv" class="form-control"><option>Tidak Ada</option><option>Ringan</option><option>Berat</option></select></div>
            <div class="form-group"><label>Tingkat Kesadaran (RASS)</label><select id="initial-rass" class="form-control"><option>Sadar & Tenang</option><option>Mengantuk</option><option>Respon suara</option><option>Tak ada respon</option></select></div>
            <div class="form-group full-width"><label>Mobilisasi Awal (JH-HLM)</label><select id="initial-mobility" class="form-control">${appData.mobilityScale.map(s=>`<option value="${s.level}">${s.name}</option>`).join('')}</select></div>
        </div>
        <div class="modal-footer"><button class="btn btn--primary" id="save-new-patient-btn">Simpan Pasien</button></div>`;
        
    const updateForm = `
        <h4>Pasien: ${patient?.name} (${patient?.rm})</h4>
        <p class="patient-info-subtitle">${patient?.age} tahun, ${patient?.gender}</p>
        <hr class="form-divider">
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
               el.textContent = formatPostOpDuration(timestamp * 1000);
            }
        });
    };
    setInterval(updateTimes, 1000 * 60); // Update setiap menit
    updateTimes();
}

// --- FUNGSI ANALISIS ---

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

    const avgPreScore = preTests.length > 0 ? (preTests.reduce((sum, d) => sum + d.score, 0) / preTests.length) : 0;
    const avgPostScore = postTests.length > 0 ? (postTests.reduce((sum, d) => sum + d.score, 0) / postTests.length) : 0;
    const improvement = avgPreScore > 0 ? ((avgPostScore - avgPreScore) / avgPreScore) * 100 : 0;

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
                    <div class="stat-label">Peningkatan Pemahaman</div>
                </div>
            </div>
        </div>
        <div class="interpretation-card">
            <h4>Interpretasi</h4>
            <p>Data menunjukkan adanya <strong>peningkatan pemahaman pasien sebesar ${improvement.toFixed(0)}%</strong> setelah mendapatkan edukasi. Skor rata-rata yang lebih tinggi pada post-test mengindikasikan bahwa intervensi efektif.</p>
        </div>
    `;
}

function renderPatientDashboardAnalysis(data) {
    const container = document.getElementById('patient-analysis-container');
    if (data.length === 0) {
        container.innerHTML = `<div class="info-card"><p>Belum ada data pasien untuk dianalisis.</p></div>`;
        return;
    }

    container.innerHTML = `
        <div class="analysis-grid-varied">
            <div class="chart-container">
                <h4>Progres Mobilisasi per Hari Post-Op</h4>
                <canvas id="progress-by-pod-chart"></canvas>
            </div>
            <div class="chart-container">
                <h4>Rata-rata Level Mobilisasi per Jenis Operasi</h4>
                <canvas id="mobility-by-op-chart"></canvas>
            </div>
            <div class="chart-container full-span">
                <h4>Pengaruh Hambatan (PONV/RASS) Terhadap Pencapaian Target</h4>
                <canvas id="barrier-impact-chart"></canvas>
            </div>
        </div>
        <div class="interpretation-card">
            <h4>Interpretasi Wawasan</h4>
            <p>Grafik di atas memberikan wawasan kunci: <strong>(1)</strong> Progresivitas mobilisasi pasien seiring waktu, idealnya menunjukkan tren naik. <strong>(2)</strong> Perbandingan efektivitas mobilisasi antar jenis operasi, menyoroti operasi mana yang mungkin memerlukan perhatian lebih. <strong>(3)</strong> Dampak signifikan dari hambatan seperti mual dan tingkat kesadaran terhadap kemampuan pasien mencapai target mobilisasi harian mereka.</p>
        </div>
    `;

    // 1. Data untuk Progres per POD (Line Chart)
    const progressByPod = {};
    data.forEach(p => {
        if (p.latestObservation && p.surgeryFinishTime) {
            const hoursPostOp = (getSecondsFromTS(p.latestObservation.createdAt || p.createdAt) - getSecondsFromTS(p.surgeryFinishTime)) / 3600;
            const pod = Math.floor(hoursPostOp / 24);
            if (pod < 5) { 
                if (!progressByPod[pod]) progressByPod[pod] = [];
                progressByPod[pod].push(p.latestObservation.mobilityLevel);
            }
        }
    });
    const podLabels = Object.keys(progressByPod).sort();
    const podData = podLabels.map(pod => {
        const levels = progressByPod[pod];
        return levels.reduce((a, b) => a + b, 0) / levels.length;
    });
    renderChart('progress-by-pod-chart', 'line', {
        labels: podLabels.map(l => `POD ${l}`),
        datasets: [{ label: 'Rata-rata Level', data: podData, tension: 0.2, fill: true, borderColor: 'var(--color-primary)', backgroundColor: 'rgba(var(--color-teal-500-rgb), 0.1)' }]
    });

    // 2. Data untuk Rata-rata Level per Jenis Operasi (Bar Chart)
    const mobilityByOp = {};
    data.forEach(p => {
        if (p.latestObservation) {
            if (!mobilityByOp[p.operation]) mobilityByOp[p.operation] = [];
            mobilityByOp[p.operation].push(p.latestObservation.mobilityLevel);
        }
    });
    const opLabels = Object.keys(mobilityByOp);
    const opData = opLabels.map(op => {
        const levels = mobilityByOp[op];
        return levels.reduce((a, b) => a + b, 0) / levels.length;
    });
    renderChart('mobility-by-op-chart', 'bar', {
        labels: opLabels,
        datasets: [{ label: 'Rata-rata Level', data: opData, backgroundColor: 'rgba(var(--color-teal-500-rgb), 0.7)', borderRadius: 4 }]
    }, { indexAxis: 'y', scales: { x: { beginAtZero: true } } });

    // 3. Data untuk Pengaruh Hambatan (Stacked Bar Chart)
    let barrierAchieved = 0, barrierNotAchieved = 0;
    let noBarrierAchieved = 0, noBarrierNotAchieved = 0;
    data.forEach(p => {
        if (p.latestObservation) {
            const plan = getRuleBasedPlan(p); // Use rule-based for analysis consistency
            const hasBarrier = p.latestObservation.ponv !== 'Tidak Ada' || p.latestObservation.rass !== 'Sadar & Tenang';
            const isTargetAchieved = p.latestObservation.mobilityLevel >= plan.targetLevel;
            if (hasBarrier) {
                isTargetAchieved ? barrierAchieved++ : barrierNotAchieved++;
            } else {
                isTargetAchieved ? noBarrierAchieved++ : noBarrierNotAchieved++;
            }
        }
    });
    renderChart('barrier-impact-chart', 'bar', {
        labels: ['Tanpa Hambatan (PONV/RASS)', 'Dengan Hambatan (PONV/RASS)'],
        datasets: [
            { label: 'Target Tercapai', data: [noBarrierAchieved, barrierAchieved], backgroundColor: 'rgba(var(--color-success-rgb), 0.7)', borderRadius: 4 },
            { label: 'Target Belum Tercapai', data: [noBarrierNotAchieved, barrierNotAchieved], backgroundColor: 'rgba(var(--color-error-rgb), 0.6)', borderRadius: 4 }
        ]
    }, { scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } } });
}


function renderChart(canvasId, type, data, options = {}) {
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;
    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
    }
    const defaultOptions = {
        maintainAspectRatio: true, 
        responsive: true,
        plugins: {
            legend: {
                display: (type === 'bar' && options.scales?.x?.stacked) || (type === 'doughnut' || type === 'pie'),
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
