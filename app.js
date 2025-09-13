// app.js — VERSI MODIFIKASI FINAL
// Menambahkan Kuesioner PROMIS, Skala Mobilisasi 8 Level, dan Logika Saran Dinamis
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, collection, addDoc, doc, onSnapshot, updateDoc, query, serverTimestamp, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// --- KONFIGURASI APLIKASI ---
const appData = {
    nurses: ["Suriansyah, S.Kep., Ns", "Akbar Wirahadi, A.Md.Kep", "Annisa Aulia Rahma, A.Md.Kep", "Dina Ghufriana, S.Kep.Ners", "Dwi Sucilowati, AMK", "Gusti Rusmiyati, S.Kep.Ners", "Herliyana Paramitha, S.Kep.,Ners", "Isnawati, AMK", "Khairun Nisa, S.Kep.Ners", "Noor Makiah, AMK", "Nurmilah A, A.Md.Kep", "Qatrunnada Mufidah, A.Md.Kep", "Raudatul Hikmah, S.Kep., Ns", "Verawaty, AMK", "Zahratul Zannah, S.Kep., Ns"],
    operations: ["Appendectomy", "Hernia Repair", "Laparotomy", "Mastectomy", "BPH", "Excision", "Debridement", "ORIF", "ROI"],
    anesthesiaTypes: ["General Anesthesia", "Spinal Anesthesia", "Epidural Anesthesia", "Regional Block"],
    mobilityScale: [
        { level: 0, name: "Level 0: Tirah Baring Total", description: "Pasien pasif, hanya berbaring di tempat tidur." },
        { level: 1, name: "Level 1: Latihan di Tempat Tidur", description: "Latihan nafas dalam, Batuk Efektif, Miring kanan-kiri, latihan rentang gerak." },
        { level: 2, name: "Level 2: Duduk di Tepi Tempat Tidur", description: "Pasien duduk di tepi tempat tidur dengan kedua kaki menggantung." },
        { level: 3, name: "Level 3: Berdiri di Samping Tempat Tidur", description: "Latihan berdiri dengan atau tanpa bantuan, pindah ke kursi." },
        { level: 4, name: "Level 4: Berjalan Beberapa Langkah", description: "Mulai berjalan beberapa langkah di sekitar tempat tidur." },
        { level: 5, name: "Level 5: Berjalan di Kamar", description: "Berjalan di dalam kamar pasien, termasuk ke kamar mandi dengan bantuan." },
        { level: 6, name: "Level 6: Berjalan di Koridor", description: "Berjalan lebih jauh di area koridor ruangan dengan pengawasan." },
        { level: 7, name: "Level 7: Naik Turun Tangga", description: "Latihan naik turun beberapa anak tangga dengan bantuan." },
        { level: 8, name: "Level 8: Mandiri Penuh", description: "Pasien mampu beraktivitas dan berjalan secara mandiri tanpa pengawasan." }
    ],
    // Kuesioner Pengetahuan (Tidak Berubah)
    questionnaire: {
        questions: [
            { id: 1, text: "Menggerakkan badan sesegera mungkin setelah operasi akan mempercepat pemulihan.", type: "positive" },
            { id: 2, text: "Bergerak setelah operasi sangat berbahaya karena bisa membuat jahitan lepas.", type: "negative" },
            { id: 3, text: "Latihan gerak di tempat tidur adalah langkah pertama yang penting.", type: "positive" },
            { id: 4, text: "Manfaat utama bergerak setelah operasi adalah agar bisa cepat pulang.", type: "positive" },
            { id: 5, text: "Jika terasa sangat nyeri saat bergerak, lebih baik berhenti dan panggil perawat.", type: "positive" },
            { id: 6, text: "Peran keluarga tidak penting, mobilisasi adalah tugas perawat sepenuhnya.", type: "negative" }
        ],
        scoring: {
            positive: { setuju: 2, ragu: 1, tidak_setuju: 0 },
            negative: { setuju: 0, ragu: 1, tidak_setuju: 2 }
        }
    },
    // Kuesioner PROMIS (BARU)
    promis: {
        physicalFunction: [
            { id: 'pf1', text: "Berjalan dari satu ruangan ke ruangan lain di lantai yang sama?" },
            { id: 'pf2', text: "Naik 5 anak tangga?" },
            { id: 'pf3', text: "Berdiri dari posisi duduk di kursi tanpa menggunakan tangan?" }
        ],
        painInterference: [
            { id: 'pi1', text: "Aktivitas Anda sehari-hari?" },
            { id: 'pi2', text: "Kemampuan Anda untuk tidur di malam hari?" }
        ]
    }
};

// --- Logika Saran Dinamis ---
function getIdealMobilityLevel(pod, surgeryType) {
    const isMajorSurgery = ['Laparotomy', 'ORIF', 'ROI'].includes(surgeryType);
    if (pod === 0) return 2;
    if (pod === 1) return isMajorSurgery ? 3 : 4;
    if (pod >= 2 && pod <= 3) return isMajorSurgery ? 4 : 5;
    if (pod >= 4) return 6;
    return 0;
}

function generateSuggestion(patient) {
    const pod = patient.postOpDuration;
    const currentLevel = patient.latestObservation?.mobilityLevel ?? 0;
    const idealLevel = getIdealMobilityLevel(pod, patient.operation);
    const anesthesia = patient.anesthesiaType;

    if (anesthesia === 'Spinal Anesthesia' || anesthesia === 'Epidural Anesthesia') {
        if (pod === 0) {
            return "Fokus: Latihan di tempat tidur (Level 1). Pastikan kekuatan kaki pulih sebelum mencoba berdiri.";
        }
    }

    if (currentLevel < idealLevel) {
        const nextLevelInfo = appData.mobilityScale.find(s => s.level === currentLevel + 1);
        return `Bagus! Target selanjutnya adalah **${nextLevelInfo?.name || ''}**. Coba lakukan dengan bantuan perawat.`;
    } else if (currentLevel === idealLevel) {
        if (currentLevel < 8) {
            const nextLevelInfo = appData.mobilityScale.find(s => s.level === currentLevel + 1);
            return `Hebat, target tercapai! Mari coba tingkatkan ke **${nextLevelInfo?.name || ''}** jika kondisi memungkinkan.`;
        }
        return "Luar biasa! Pertahankan level kemandirian Anda.";
    } else { // currentLevel > idealLevel
        return "Sangat baik! Anda sudah melampaui target hari ini. Pertahankan!";
    }
}


// --- Inisialisasi Aplikasi (Tidak banyak berubah) ---
// Kode inisialisasi, setupClinicId, initializeFirebase, dll. tetap sama...

// --- Modifikasi pada Fungsi yang Ada ---

async function handleQuestionnaireSubmit(e) {
    e.preventDefault();
    if (!userId || !clinicId) return showToast("Database belum siap.", "error");

    const patientName = document.getElementById('q-patient-name').value;
    const patientRM = document.getElementById('q-patient-rm').value;
    if (!patientName || !patientRM) return showToast("Harap lengkapi Nama dan Nomor RM.", "error");

    const formData = new FormData(e.target);
    
    // Proses Kuesioner Pengetahuan
    let knowledgeScore = 0;
    const knowledgeAnswers = {};
    for (const q of appData.questionnaire.questions) {
        const answer = formData.get(`q_${q.id}`);
        if (!answer) return showToast("Harap jawab semua pertanyaan pengetahuan.", "warning");
        knowledgeAnswers[q.id] = answer;
        knowledgeScore += appData.questionnaire.scoring[q.type][answer];
    }

    // Proses Kuesioner PROMIS (BARU)
    const promisAnswers = { physicalFunction: {}, painInterference: {} };
    for (const q of appData.promis.physicalFunction) {
        const answer = formData.get(`promis_${q.id}`);
        if (!answer) return showToast("Harap jawab semua pertanyaan Fungsi Fisik.", "warning");
        promisAnswers.physicalFunction[q.id] = answer;
    }
    for (const q of appData.promis.painInterference) {
        const answer = formData.get(`promis_${q.id}`);
        if (!answer) return showToast("Harap jawab semua pertanyaan Gangguan Nyeri.", "warning");
        promisAnswers.painInterference[q.id] = answer;
    }

    const collectionPath = `clinics/${clinicId}/questionnaires`;
    const resultData = {
        patientName,
        patientRM,
        testType: currentTestType,
        knowledgeScore,
        knowledgeAnswers,
        promisAnswers, // Data PROMIS disimpan
        createdAt: serverTimestamp(),
        createdBy: userId,
        clinicId
    };

    try {
        await addDoc(collection(db, collectionPath), resultData);
        showToast("Hasil kuesioner berhasil disimpan!", "success");
        // Logika displayResults mungkin perlu disesuaikan
    } catch (err) {
        console.error("Error saving questionnaire: ", err);
        showToast("Gagal menyimpan hasil.", "error");
    }
}

function listenForPatientUpdates() {
    if (!userId || !clinicId) return;
    const collectionPath = `clinics/${clinicId}/patients`;
    const q = query(collection(db, collectionPath), orderBy("operationDate", "desc"));
    const tableBody = document.getElementById('patient-table-body');

    onSnapshot(q, (snapshot) => {
        patientsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        tableBody.innerHTML = ''; // Kosongkan tabel sebelum render ulang

        if (patientsData.length === 0) {
            tableBody.innerHTML = `<tr class="no-data-row"><td colspan="8">Belum ada data pasien. Tambahkan pasien baru untuk memulai.</td></tr>`;
            return;
        }

        patientsData.forEach(p => {
            const latestObs = p.latestObservation;
            const currentMobilityLevel = latestObs?.mobilityLevel ?? 0;
            const currentMobilityName = appData.mobilityScale.find(s => s.level === currentMobilityLevel)?.name || 'N/A';
            const idealMobilityLevel = getIdealMobilityLevel(p.postOpDuration, p.operation);
            const idealMobilityName = appData.mobilityScale.find(s => s.level === idealMobilityLevel)?.name || 'N/A';
            const suggestion = generateSuggestion(p);

            const row = `
                <tr>
                    <td>${p.name} (${p.rmNumber})</td>
                    <td>${p.operation}</td>
                    <td>${p.anesthesiaType}</td>
                    <td class="post-op-time">Hari ke-${p.postOpDuration}</td>
                    <td>${latestObs?.ponv ?? 'N/A'} / ${latestObs?.rass ?? 'N/A'}</td>
                    <td><span class="status status-level-${currentMobilityLevel}">${currentMobilityName}</span></td>
                    <td><span class="status status-ideal">${idealMobilityName}</span></td>
                    <td class="suggestion-text">${suggestion}</td>
                </tr>
            `;
            tableBody.innerHTML += row;
        });
    });
}
