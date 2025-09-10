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
        {level: 0, name: "Level 0: Pasif", desc: "Pasien hanya berbaring"},
        {level: 1, name: "Level 1: Fase Sangat Dini", desc: "Latihan napas & gerak sendi di tempat tidur"},
        {level: 2, name: "Level 2: Fase Dini", desc: "Duduk di tepi tempat tidur"},
        {level: 3, name: "Level 3: Fase Progresif", desc: "Berdiri di samping tempat tidur"},
        {level: 4, name: "Level 4: Fase Aktif Awal", desc: "Berpindah ke kursi"},
        {level: 5, name: "Level 5: Fase Aktif Lanjut", desc: "Berjalan di dalam kamar"},
        {level: 6, name: "Level 6: Fase Pemulihan", desc: "Berjalan di luar kamar"}
    ],
    // ... data kuesioner tidak berubah
};

// --- INISIALISASI FIREBASE ---
let db, auth;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'mlq-default-app';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;

async function initializeFirebase() {
    if (!firebaseConfig) return showToast("Konfigurasi Firebase tidak ditemukan.", "error");
    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
        } else {
            await signInAnonymously(auth);
        }
        console.log("Firebase initialized. User:", auth.currentUser?.uid);
        listenForPatientUpdates(); // Mulai mendengarkan data pasien
    } catch (error) {
        console.error("Firebase initialization error:", error);
        showToast("Gagal terhubung ke database.", "error");
    }
}

// --- STATE APLIKASI & EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    initializeFirebase();
    setupEventListeners();
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

    // Tombol Tambah Pasien
    document.getElementById('add-patient-btn').addEventListener('click', () => openPatientModal());
    
    // Penanganan klik di dalam body untuk event delegation
    document.body.addEventListener('click', e => {
        // Tombol Update di tabel pasien
        if (e.target.closest('.update-patient-btn')) {
            const patientId = e.target.closest('.update-patient-btn').dataset.id;
            openPatientModal(patientId);
        }
        // Tombol close modal
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


// --- FUNGSI DASBOR PASIEN (OBSERVASI) ---
let patientsData = []; // Cache data pasien untuk modal

function listenForPatientUpdates() {
    if (!auth.currentUser) return setTimeout(listenForPatientUpdates, 500); // Tunggu auth siap
    
    const patientsCol = collection(db, 'artifacts', appId, 'users', auth.currentUser.uid, 'patients');
    const q = query(patientsCol, orderBy("surgeryFinishTime", "desc"));

    onSnapshot(q, (snapshot) => {
        patientsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderPatientTable(patientsData);
    }, (error) => {
        console.error("Error listening to patient updates:", error);
        showToast("Gagal memuat data pasien.", "error");
    });
}

function renderPatientTable(patients) {
    const tableBody = document.getElementById('patient-table-body');
    if (patients.length === 0) {
        tableBody.innerHTML = `<tr class="no-data-row"><td colspan="6">Belum ada data pasien. Klik "Tambah Pasien Baru".</td></tr>`;
        return;
    }
    
    tableBody.innerHTML = patients.map(p => {
        const latestObservation = p.observationLog?.[p.observationLog.length - 1] || { mobilityLevel: 0 };
        return `
            <tr>
                <td>${p.name}</td>
                <td>${p.rm}</td>
                <td>${p.operation}</td>
                <td class="post-op-time" data-timestamp="${p.surgeryFinishTime.seconds}">${formatElapsedTime(p.surgeryFinishTime.seconds * 1000)}</td>
                <td><span class="status status-level-${latestObservation.mobilityLevel}">Level ${latestObservation.mobilityLevel}</span></td>
                <td><button class="btn btn--primary btn--sm update-patient-btn" data-id="${p.id}"><i class="fas fa-edit"></i> Update</button></td>
            </tr>
        `;
    }).join('');
}

// --- FUNGSI MODAL PASIEN (TAMBAH & UPDATE) ---

function openPatientModal(patientId = null) {
    const isEditing = patientId !== null;
    const patient = isEditing ? patientsData.find(p => p.id === patientId) : null;
    
    document.getElementById('modal-title').textContent = isEditing ? 'Update Data Pasien' : 'Tambah Pasien Baru';
    const modalBody = document.getElementById('modal-body');
    
    // Form untuk Tambah Pasien Baru
    const addFormHTML = `
        <div class="modal-grid">
            <div class="form-group"><label class="form-label">Nama Pasien</label><input type="text" id="patient-name" class="form-control" required></div>
            <div class="form-group"><label class="form-label">Nomor RM</label><input type="text" id="patient-rm" class="form-control" required></div>
            <div class="form-group full-width"><label class="form-label">Jenis Operasi</label><select id="patient-operation" class="form-control">${appData.operations.map(op => `<option>${op}</option>`).join('')}</select></div>
            <div class="form-group full-width"><label class="form-label">Jenis Anestesi</label><select id="patient-anesthesia" class="form-control">${appData.anesthesiaTypes.map(an => `<option>${an}</option>`).join('')}</select></div>
            <div class="form-group full-width"><label class="form-label">Operasi Selesai (Jam yang lalu)</label><input type="number" id="patient-hours-ago" class="form-control" placeholder="Contoh: 2" required></div>
        </div>
        <div class="modal-footer"><button class="btn btn--primary" id="save-new-patient-btn">Simpan Pasien</button></div>
    `;

    // Form untuk Update Observasi
    const updateFormHTML = `
        <h4>Pasien: ${patient?.name} (${patient?.rm})</h4>
        <hr class="form-divider">
        <div class="modal-grid">
            <div class="form-group full-width"><label class="form-label">Update Skala Mobilitas</label><select id="update-mobility" class="form-control">${appData.mobilityScale.map(s => `<option value="${s.level}">${s.name}</option>`).join('')}</select></div>
            <div class="form-group"><label class="form-label">Skala Nyeri (0-10)</label><input type="number" id="update-pain" class="form-control" min="0" max="10" value="0"></div>
            <div class="form-group"><label class="form-label">Mual/Muntah (PONV)</label><select id="update-ponv" class="form-control"><option>Tidak Ada</option><option>Ringan</option><option>Berat</option></select></div>
            <div class="form-group full-width"><label class="form-label">Tingkat Kesadaran (RASS)</label><select id="update-rass" class="form-control"><option>Sadar & Tenang</option><option>Mengantuk</option><option>Sulit Dibangunkan</option></select></div>
            <div class="form-group full-width"><label class="form-label">Perawat</label><select id="update-nurse" class="form-control">${appData.nurses.map(n => `<option>${n}</option>`).join('')}</select></div>
        </div>
        <div class="modal-footer"><button class="btn btn--primary" id="save-update-btn" data-id="${patientId}">Simpan Observasi</button></div>
    `;

    modalBody.innerHTML = isEditing ? updateFormHTML : addFormHTML;
    
    // Tambahkan event listener ke tombol simpan yang baru dibuat
    if (isEditing) {
        document.getElementById('save-update-btn').addEventListener('click', savePatientUpdate);
    } else {
        document.getElementById('save-new-patient-btn').addEventListener('click', saveNewPatient);
    }
    
    document.getElementById('patient-modal').classList.remove('hidden');
}

function closePatientModal() {
    document.getElementById('patient-modal').classList.add('hidden');
}

// --- FUNGSI PENYIMPANAN DATA (FIREBASE) ---
async function saveNewPatient() {
    const name = document.getElementById('patient-name').value;
    const rm = document.getElementById('patient-rm').value;
    const operation = document.getElementById('patient-operation').value;
    const anesthesia = document.getElementById('patient-anesthesia').value;
    const hoursAgo = parseFloat(document.getElementById('patient-hours-ago').value);

    if (!name || !rm || isNaN(hoursAgo)) {
        return showToast("Harap lengkapi semua field.", "error");
    }

    const finishTimestamp = new Date(Date.now() - hoursAgo * 3600 * 1000);

    const newPatient = {
        name, rm, operation, anesthesia,
        surgeryFinishTime: finishTimestamp,
        createdAt: serverTimestamp(),
        observationLog: []
    };

    try {
        const patientsCol = collection(db, 'artifacts', appId, 'users', auth.currentUser.uid, 'patients');
        await addDoc(patientsCol, newPatient);
        showToast("Pasien baru berhasil ditambahkan.", "success");
        closePatientModal();
    } catch (error) {
        console.error("Error adding patient: ", error);
        showToast("Gagal menambahkan pasien.", "error");
    }
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
    
    const updatedLog = patient.observationLog ? [...patient.observationLog, newObservation] : [newObservation];

    try {
        const patientDoc = doc(db, 'artifacts', appId, 'users', auth.currentUser.uid, 'patients', patientId);
        await updateDoc(patientDoc, {
            observationLog: updatedLog
        });
        showToast("Data observasi berhasil diperbarui.", "success");
        closePatientModal();
    } catch (error) {
        console.error("Error updating patient: ", error);
        showToast("Gagal memperbarui data.", "error");
    }
}


// --- FUNGSI BANTUAN & REAL-TIME ---
function startRealtimeClocks() {
    setInterval(() => {
        document.querySelectorAll('.post-op-time').forEach(el => {
            const timestamp = parseInt(el.dataset.timestamp) * 1000;
            el.textContent = formatElapsedTime(timestamp);
        });
    }, 60000); // Update setiap 1 menit
}

function formatElapsedTime(timestamp) {
    const seconds = Math.floor((new Date() - timestamp) / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
        return `${hours} jam ${minutes} mnt`;
    }
    return `${minutes} mnt`;
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.querySelector('.toast-message').textContent = message;
    const icons = { success: 'fas fa-check-circle', error: 'fas fa-times-circle', warning: 'fas fa-exclamation-triangle', info: 'fas fa-info-circle' };
    toast.querySelector('.toast-icon').className = `toast-icon ${icons[type]}`;
    toast.className = `toast show ${type}`;
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// NOTE: Fungsi kuesioner tidak disertakan di sini karena tidak ada perubahan dari versi sebelumnya.
// Pastikan fungsi-fungsi tersebut ada di file Anda jika diperlukan.

