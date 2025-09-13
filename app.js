// app.js — MODIFIED with Dashboard, Better UI, and Automatic Suggestions

// Import Firebase services
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, collection, addDoc, doc, onSnapshot, updateDoc, query, serverTimestamp, deleteDoc, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// --- KONFIGURASI APLIKASI ---
const appData = {
    nurses: ["Suriansyah, S.Kep., Ns", "Akbar Wirahadi, A.Md.Kep", "Annisa Aulia Rahma, A.Md.Kep", "Dina Ghufriana, S.Kep.Ners", "Dwi Sucilowati, AMK", "Gusti Rusmiyati, S.Kep.Ners", "Herliyana Paramitha, S.Kep.,Ners", "Isnawati, AMK", "Khairun Nisa, S.Kep.Ners", "Noor Makiah, AMK", "Nurmilah A, A.Md.Kep", "Qatrunnada Mufidah, A.Md.Kep", "Raudatul Hikmah, S.Kep., Ns", "Verawaty, AMK", "Zahratul Zannah, S.Kep., Ners"],
    operations: ["Appendiktomi", "Herniotomi", "Laparotomi", "Debridement", "ORIF", "Sectio Caesarea", "Mastektomi", "Kolelitiasis", "Lainnya"],
    anesthesiaTypes: ["Anestesi Umum", "Anestesi Spinal / Epidural"],
    mobilizationLevels: [0, 1, 2, 3, 4, 5, 6]
};

// PERUBAHAN: Data untuk saran otomatis berdasarkan CSV
const mobilizationFactors = {
  pod: [
    { day: 0, level: '0-2', suggestion: 'Mulai miring kanan-kiri, tekuk lutut, dan gerakkan pergelangan kaki setiap 2 jam.' },
    { day: 1, level: '2-4', suggestion: 'Latihan duduk di tepi tempat tidur, usahakan 3-4 kali sehari dengan bantuan.' },
    { day: 2, level: '4-5', suggestion: 'Target hari ini adalah berdiri di samping tempat tidur dan berjalan beberapa langkah.' },
    { day: 3, level: '4-5', suggestion: 'Tingkatkan durasi berjalan di sekitar tempat tidur atau di dalam kamar.' },
    { day: 4, level: '5-6', suggestion: 'Berjalan mandiri di koridor ruangan. Target 3 kali sehari.' },
  ],
  anesthesia: {
    'Anestesi Umum': 'Mobilisasi dimulai setelah sadar penuh & mual terkontrol.',
    'Anestesi Spinal / Epidural': 'Jangan berdiri sebelum kekuatan & rasa pada kaki kembali normal untuk mencegah risiko jatuh.'
  }
};

// --- INISIALISASI FIREBASE ---
const firebaseConfig = {
    apiKey: "...", // Ganti dengan konfigurasi Anda
    authDomain: "...",
    projectId: "...",
    storageBucket: "...",
    messagingSenderId: "...",
    appId: "..."
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- State Aplikasi ---
let clinicId = localStorage.getItem('clinicId') || null;
let clinicPatients = null;
let unsubscribe = null;
let currentUserId = null;
let allPatientsData = [];

// --- Chart Variables ---
let mobilizationChart, patientStatusChart, losChart;

// --- DOM Elements ---
const tableBody = document.querySelector('#patient-table tbody');
const modal = document.getElementById('patient-modal');
const modalBody = document.getElementById('modal-body');
const modalTitle = document.getElementById('modal-title');
const clinicIdModal = document.getElementById('clinic-id-modal');

// --- EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    setupAuthListener();
    setupNavigation();
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('add-patient-btn').addEventListener('click', () => openPatientModal());
    document.getElementById('modal-close-btn').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    document.getElementById('save-clinic-id-btn').addEventListener('click', saveClinicId);
    document.getElementById('change-clinic-id').addEventListener('click', showClinicIdModal);
    tableBody.addEventListener('click', handleTableActions);
}

// --- FUNGSI AUTENTIKASI & INISIALISASI ---
function setupAuthListener() {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUserId = user.uid;
            if (!clinicId) {
                showClinicIdModal();
            } else {
                initializeAppWithClinicId();
            }
        } else {
            signInAnonymously(auth).catch(error => console.error("Anonymous sign-in failed:", error));
        }
    });
}

function showClinicIdModal() {
    clinicIdModal.classList.remove('hidden');
    clinicIdModal.style.opacity = '1';
}

function saveClinicId() {
    const input = document.getElementById('clinic-id-input');
    const id = input.value.trim().toLowerCase();
    if (id) {
        clinicId = id;
        localStorage.setItem('clinicId', clinicId);
        clinicIdModal.style.opacity = '0';
        setTimeout(() => clinicIdModal.classList.add('hidden'), 300);
        initializeAppWithClinicId();
    } else {
        showToast('error', 'ID Klinik tidak boleh kosong.');
    }
}

function initializeAppWithClinicId() {
    if (unsubscribe) unsubscribe();
    clinicPatients = collection(db, `mobilization-data/${clinicId}/patients`);
    listenForPatientUpdates();
    showToast('success', `Data untuk klinik '${clinicId}' berhasil dimuat.`);
}

// --- FUNGSI NAVIGASI ---
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item[data-page]');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const pageId = item.dataset.page;
            
            document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
            document.getElementById(`${pageId}-page`).classList.remove('hidden');

            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            // PERUBAHAN: Render dashboard jika halaman analisis dibuka
            if (pageId === 'analisis') {
                initDashboard(allPatientsData);
            }
        });
    });
}

// --- FUNGSI CRUD & DATA FIREBASE ---
function listenForPatientUpdates() {
    const q = query(clinicPatients);
    unsubscribe = onSnapshot(q, (snapshot) => {
        allPatientsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        displayPatients(allPatientsData);
        // PERUBAHAN: Update dashboard secara real-time jika sedang aktif
        if (!document.getElementById('analisis-page').classList.contains('hidden')) {
            initDashboard(allPatientsData);
        }
    }, error => console.error("Error listening to patient updates:", error));
}

async function savePatient(patientId, patientData) {
    try {
        if (patientData.waktuSelesaiOperasi && typeof patientData.waktuSelesaiOperasi === 'string') {
            patientData.waktuSelesaiOperasi = new Date(patientData.waktuSelesaiOperasi);
        }

        if (patientId) {
            const patientRef = doc(db, clinicPatients.path, patientId);
            await updateDoc(patientRef, patientData);
            showToast('success', 'Data pasien berhasil diperbarui.');
        } else {
            patientData.createdAt = serverTimestamp();
            patientData.status = 'dirawat';
            await addDoc(clinicPatients, patientData);
            showToast('success', 'Pasien baru berhasil ditambahkan.');
        }
        closeModal();
    } catch (error) {
        console.error("Error saving patient:", error);
        showToast('error', 'Gagal menyimpan data pasien.');
    }
}

async function deletePatient(patientId) {
    try {
        const patientRef = doc(db, clinicPatients.path, patientId);
        await deleteDoc(patientRef);
        showToast('success', 'Data pasien telah dihapus.');
    } catch (error) {
        console.error("Error deleting patient:", error);
        showToast('error', 'Gagal menghapus data pasien.');
    }
}

async function dischargePatient(patientId) {
    try {
        const patientRef = doc(db, clinicPatients.path, patientId);
        await updateDoc(patientRef, {
            status: 'pulang',
            tanggalPulang: serverTimestamp()
        });
        showToast('success', 'Pasien telah ditandai sudah pulang.');
    } catch (error) {
        console.error("Error discharging patient:", error);
        showToast('error', 'Gagal memperbarui status pasien.');
    }
}

// --- FUNGSI TAMPILAN (UI) ---
function displayPatients(patients) {
    tableBody.innerHTML = '';
    if (patients.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center;">Belum ada data pasien. Klik 'Tambah Pasien' untuk memulai.</td></tr>`;
        return;
    }
    
    // Urutkan pasien: yang masih dirawat di atas
    patients.sort((a, b) => {
        if (a.status === 'pulang' && b.status !== 'pulang') return 1;
        if (a.status !== 'pulang' && b.status === 'pulang') return -1;
        return (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0);
    });

    patients.forEach(patient => {
        const row = document.createElement('tr');
        if (patient.status === 'pulang') {
            row.style.opacity = '0.6';
            row.style.backgroundColor = '#f8f9fa';
        }
        
        const pod = calculatePod(patient.waktuSelesaiOperasi);
        const { suggestion, target } = getSuggestionForPatient(patient, pod);
        
        row.innerHTML = `
            <td data-label="Nama Pasien">${patient.namaPasien || '-'}</td>
            <td data-label="No. RM">${patient.noRm || '-'}</td>
            <td data-label="Jenis Operasi">${patient.jenisOperasi || '-'}</td>
            <td data-label="Level Mobilisasi">${patient.levelMobilisasi} (Target: ${target})</td>
            <td data-label="Hari Rawat">${pod}</td>
            <td data-label="Saran / Target">${suggestion}</td>
            <td data-label="Aksi">
                <div class="action-buttons">
                    <button class="btn btn--icon btn--secondary" data-action="update" data-id="${patient.id}" title="Update Data" ${patient.status === 'pulang' ? 'disabled' : ''}><i class="fas fa-edit"></i><span>Update</span></button>
                    <button class="btn btn--icon btn--danger" data-action="delete" data-id="${patient.id}" title="Hapus Pasien"><i class="fas fa-trash"></i><span>Hapus</span></button>
                    <button class="btn btn--icon btn--success" data-action="discharge" data-id="${patient.id}" title="Pasien Pulang" ${patient.status === 'pulang' ? 'disabled' : ''}><i class="fas fa-hospital-user"></i><span>Pulang</span></button>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });
}


function openPatientModal(patient = null) {
    modalTitle.textContent = patient ? 'Update Data Pasien' : 'Tambah Pasien Baru';
    
    const fields = [
        { id: 'namaPasien', label: 'Nama Pasien', type: 'text' },
        { id: 'noRm', label: 'No. Rekam Medis', type: 'text' },
        { id: 'waktuSelesaiOperasi', label: 'Waktu Selesai Operasi', type: 'datetime-local' }, // PERUBAHAN
        { id: 'jenisOperasi', label: 'Jenis Operasi', type: 'select', options: appData.operations },
        { id: 'jenisAnestesi', label: 'Jenis Anestesi', type: 'select', options: appData.anesthesiaTypes },
        { id: 'levelMobilisasi', label: 'Level Mobilisasi Saat Ini', type: 'select', options: appData.mobilizationLevels },
        { id: 'perawat', label: 'Perawat Penanggung Jawab', type: 'select', options: appData.nurses }
    ];

    let formHtml = '<form id="patient-form" class="modal-grid">';
    fields.forEach(field => {
        let value = patient ? (patient[field.id] || '') : '';
        if (field.id === 'waktuSelesaiOperasi' && patient && patient[field.id]) {
            const date = patient[field.id].toDate();
            value = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
        }

        formHtml += `<div class="form-group ${field.id === 'namaPasien' || field.id === 'noRm' ? '' : ''}">
                        <label for="${field.id}" class="form-label">${field.label}</label>`;
        if (field.type === 'select') {
            formHtml += `<select id="${field.id}" class="form-control">`;
            field.options.forEach(opt => {
                formHtml += `<option value="${opt}" ${opt == value ? 'selected' : ''}>${opt}</option>`;
            });
            formHtml += `</select>`;
        } else {
            formHtml += `<input type="${field.type}" id="${field.id}" class="form-control" value="${value}">`;
        }
        formHtml += `</div>`;
    });
    formHtml += `</form>
                 <div class="modal-footer">
                    <button id="save-patient-btn" class="btn btn--primary">Simpan Data</button>
                 </div>`;

    modalBody.innerHTML = formHtml;
    document.getElementById('save-patient-btn').onclick = () => {
        const patientData = {};
        fields.forEach(field => {
            patientData[field.id] = document.getElementById(field.id).value;
        });
        savePatient(patient ? patient.id : null, patientData);
    };

    modal.classList.remove('hidden');
    modal.style.opacity = '1';
}

function closeModal() {
    modal.style.opacity = '0';
    setTimeout(() => modal.classList.add('hidden'), 300);
}

function handleTableActions(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const action = button.dataset.action;
    const id = button.dataset.id;
    const patient = allPatientsData.find(p => p.id === id);

    if (action === 'update') {
        openPatientModal(patient);
    } else if (action === 'delete') {
        showConfirmationDialog(`Anda yakin ingin menghapus data pasien "${patient.namaPasien}"? Tindakan ini tidak dapat dibatalkan.`, () => {
            deletePatient(id);
        });
    } else if (action === 'discharge') {
        showConfirmationDialog(`Anda yakin ingin menandai pasien "${patient.namaPasien}" sudah pulang?`, () => {
            dischargePatient(id);
        });
    }
}

// --- FUNGSI UTILITAS & HELPER ---

function calculatePod(timestamp) {
    if (!timestamp || !timestamp.toDate) return 'N/A';
    const opDate = timestamp.toDate();
    const now = new Date();
    const diffTime = Math.abs(now - opDate);
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

// PERUBAHAN: Logika baru untuk mendapatkan saran
function getSuggestionForPatient(patient, pod) {
    if (pod === 'N/A') {
        return { suggestion: 'Lengkapi data waktu selesai operasi.', target: 'N/A' };
    }

    let suggestions = [];
    let targetLevel = 'N/A';

    const podFactor = mobilizationFactors.pod.find(f => f.day == pod) || mobilizationFactors.pod[mobilizationFactors.pod.length - 1];
    if (podFactor) {
        suggestions.push(`<b>POD ${pod}:</b> ${podFactor.suggestion}`);
        targetLevel = podFactor.level;
    }

    if (patient.jenisAnestesi && mobilizationFactors.anesthesia[patient.jenisAnestesi]) {
        suggestions.push(mobilizationFactors.anesthesia[patient.jenisAnestesi]);
    }
    
    return {
        suggestion: suggestions.join('<br>'),
        target: targetLevel
    };
}


function showToast(type, message) {
    const toast = document.getElementById('toast');
    const icons = { success: 'fa-solid fa-check-circle', error: 'fa-solid fa-times-circle' };
    toast.querySelector('.toast-message').textContent = message;
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
    dialog.style.cssText = 'opacity: 0; transition: opacity 0.3s;';
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
    setTimeout(() => dialog.style.opacity = '1', 10);

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

// PERUBAHAN: Fungsi untuk membuat dan merender dashboard
function initDashboard(patients) {
    const ctxLevel = document.getElementById('mobilizationLevelChart').getContext('2d');
    const ctxStatus = document.getElementById('patientStatusChart').getContext('2d');
    const ctxLos = document.getElementById('losChart').getContext('2d');

    if (mobilizationChart) mobilizationChart.destroy();
    if (patientStatusChart) patientStatusChart.destroy();
    if (losChart) losChart.destroy();

    // 1. Grafik Distribusi Level Mobilisasi
    const levelCounts = Array(7).fill(0);
    patients.filter(p => p.status !== 'pulang').forEach(p => {
        if (p.levelMobilisasi >= 0 && p.levelMobilisasi <= 6) {
            levelCounts[p.levelMobilisasi]++;
        }
    });

    mobilizationChart = new Chart(ctxLevel, {
        type: 'bar',
        data: {
            labels: Array.from({ length: 7 }, (_, i) => `Level ${i}`),
            datasets: [{
                label: 'Jumlah Pasien Aktif',
                data: levelCounts,
                backgroundColor: 'rgba(50, 184, 198, 0.6)',
                borderColor: 'rgba(50, 184, 198, 1)',
                borderWidth: 1
            }]
        },
        options: { responsive: true, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });

    // 2. Grafik Status Pasien
    const statusCounts = { 'Dirawat': 0, 'Pulang': 0 };
    patients.forEach(p => {
        if (p.status === 'pulang') statusCounts['Pulang']++;
        else statusCounts['Dirawat']++;
    });

    patientStatusChart = new Chart(ctxStatus, {
        type: 'pie',
        data: {
            labels: ['Masih Dirawat', 'Sudah Pulang'],
            datasets: [{
                data: [statusCounts['Dirawat'], statusCounts['Pulang']],
                backgroundColor: ['rgba(255, 159, 64, 0.6)', 'rgba(75, 192, 192, 0.6)'],
                borderColor: ['rgba(255, 159, 64, 1)', 'rgba(75, 192, 192, 1)'],
            }]
        },
        options: { responsive: true }
    });
    
    // 3. Grafik Rata-rata Lama Rawat (LOS)
    const dischargedPatients = patients.filter(p => p.status === 'pulang' && p.waktuSelesaiOperasi && p.tanggalPulang);
    let totalLos = 0;
    dischargedPatients.forEach(p => {
        const opDate = p.waktuSelesaiOperasi.toDate();
        const dischargeDate = p.tanggalPulang.toDate();
        totalLos += (dischargeDate - opDate) / (1000 * 60 * 60 * 24);
    });
    const averageLos = dischargedPatients.length > 0 ? (totalLos / dischargedPatients.length).toFixed(1) : 0;

    losChart = new Chart(ctxLos, {
        type: 'bar',
         data: {
            labels: ['Rata-rata Lama Rawat (Hari)'],
            datasets: [{
                label: 'LOS Pasien Pulang',
                data: [averageLos],
                backgroundColor: ['rgba(153, 102, 255, 0.6)'],
                borderColor: ['rgba(153, 102, 255, 1)'],
                borderWidth: 1,
                maxBarThickness: 100
            }]
        },
        options: { responsive: true, indexAxis: 'y', scales: { x: { beginAtZero: true, suggestedMax: 10 } } }
    });
}
