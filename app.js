// Application data
const appData = {
    hospital: {
        name: "RSUD Pangeran Jaya Sumitra Kotabaru",
        location: "Ruang Kerapu",
        program: "MLQ - Early Mobilization, Leaflet, Video QR Code",
        nurse: "Suriansyah, S.Kep., Ns",
        nip: "19920220 202504 1 005",
        address: "Jl. Brigjend H. Hasan Basri No. 57, Desa Semayap, Kec. Pulau Sigam, Kab. Kotabaru, Kalimantan Selatan",
        phone: "(0518) 22945"
    },
    questionnaire: {
        questions: [
            {
                id: 1,
                text: "Menggerakkan badan sesegera mungkin setelah operasi akan mempercepat pemulihan",
                type: "positive"
            },
            {
                id: 2,
                text: "Bergerak setelah operasi sangat berbahaya karena bisa membuat jahitan lepas",
                type: "negative"
            },
            {
                id: 3,
                text: "Latihan gerak di tempat tidur (seperti miring kanan-kiri dan menggerakkan kaki) adalah langkah pertama yang penting",
                type: "positive"
            },
            {
                id: 4,
                text: "Manfaat utama bergerak setelah operasi adalah agar bisa cepat pulang ke rumah",
                type: "negative"
            },
            {
                id: 5,
                text: "Jika terasa nyeri saat bergerak, lebih baik berhenti dan panggil perawat daripada memaksakan diri",
                type: "positive"
            },
            {
                id: 6,
                text: "Peran keluarga tidak terlalu penting, karena urusan gerak setelah operasi adalah tugas perawat",
                type: "negative"
            }
        ],
        scoring: {
            positive: { setuju: 2, ragu: 1, tidak_setuju: 0 },
            negative: { setuju: 0, ragu: 1, tidak_setuju: 2 }
        },
        interpretation: {
            good: { min: 9, max: 12, desc: "Pengetahuan Baik - pemahaman yang baik mengenai mobilisasi dini" },
            fair: { min: 5, max: 8, desc: "Pengetahuan Cukup - perlu edukasi tambahan" },
            poor: { min: 0, max: 4, desc: "Pengetahuan Kurang - butuh edukasi komprehensif" }
        }
    },
    mobilityScale: [
        {level: 0, name: "Pasif", description: "Pasien hanya berbaring, belum ada aktivitas"},
        {level: 1, name: "Aktivitas di Tempat Tidur", description: "Mampu miring kanan/kiri, menggerakkan sendi kaki/tangan secara aktif"},
        {level: 2, name: "Duduk di Tempat Tidur", description: "Mampu duduk tegak di tepi tempat tidur (kaki menggantung) selama >1 menit"},
        {level: 3, name: "Berdiri", description: "Mampu berdiri di samping tempat tidur selama >30 detik (boleh dengan bantuan/pegangan)"},
        {level: 4, name: "Transfer", description: "Mampu berpindah dari tempat tidur ke kursi secara mandiri/dengan sedikit bantuan"},
        {level: 5, name: "Ambulasi di Kamar", description: "Mampu berjalan minimal 3 meter di dalam kamar"},
        {level: 6, name: "Ambulasi di Luar Kamar", description: "Mampu berjalan di koridor/luar kamar"}
    ]
};

// Application state
let currentPage = 'landing';
let currentTestType = 'pretest';
let selectedMobilityLevel = null;
let questionnaireAnswers = {};

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing app...');
    initializeApp();
});

function initializeApp() {
    console.log('Initializing application...');
    
    // Show landing page first
    showPage('landing');
    setActiveNav('landing');
    
    // Set up all event listeners
    setupEventListeners();
    
    // Generate questionnaire content
    generateQuestionnaire();
    
    // Set up mobility levels
    setupMobilityLevels();
    
    // Set default observation time to now
    const observationTimeInput = document.getElementById('observation-time');
    if (observationTimeInput) {
        const now = new Date();
        const localDateTime = now.toISOString().slice(0, 16);
        observationTimeInput.value = localDateTime;
    }
    
    console.log('Application initialized successfully');
}

function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Navigation items
    document.addEventListener('click', function(e) {
        // Handle navigation item clicks
        if (e.target.closest('.nav-item')) {
            e.preventDefault();
            const navItem = e.target.closest('.nav-item');
            const page = navItem.getAttribute('data-page');
            console.log('Nav item clicked:', page);
            if (page) {
                navigateToPage(page);
            }
            return;
        }
        
        // Handle menu card clicks
        if (e.target.closest('.menu-card')) {
            e.preventDefault();
            const menuCard = e.target.closest('.menu-card');
            const page = menuCard.getAttribute('data-page');
            console.log('Menu card clicked:', page);
            if (page) {
                navigateToPage(page);
            }
            return;
        }
        
        // Handle test button clicks
        if (e.target.closest('.test-btn')) {
            e.preventDefault();
            const testBtn = e.target.closest('.test-btn');
            const testType = testBtn.getAttribute('data-test');
            console.log('Test button clicked:', testType);
            if (testType) {
                setActiveTest(testType);
                resetQuestionnaire();
            }
            return;
        }
        
        // Handle mobility level clicks
        if (e.target.closest('.level-item')) {
            e.preventDefault();
            const levelItem = e.target.closest('.level-item');
            const level = levelItem.getAttribute('data-level');
            console.log('Mobility level clicked:', level);
            selectMobilityLevel(parseInt(level));
            return;
        }
        
        // Handle other button clicks
        if (e.target.matches('.reset-btn')) {
            e.preventDefault();
            resetQuestionnaire();
            return;
        }
        
        if (e.target.matches('.retry-btn')) {
            e.preventDefault();
            retryQuestionnaire();
            return;
        }
        
        if (e.target.matches('.export-leaflet-btn')) {
            e.preventDefault();
            exportLeafletToPDF();
            return;
        }
        
        if (e.target.matches('.export-results')) {
            e.preventDefault();
            exportResultsToPDF();
            return;
        }
        
        if (e.target.matches('.save-observation')) {
            e.preventDefault();
            saveObservation();
            return;
        }
        
        if (e.target.matches('.generate-qr-btn')) {
            e.preventDefault();
            generateQRCode();
            return;
        }
    });
    
    // Questionnaire form submission
    const questionnaireForm = document.getElementById('questionnaire-form');
    if (questionnaireForm) {
        questionnaireForm.addEventListener('submit', handleQuestionnaireSubmit);
    }
    
    console.log('Event listeners set up successfully');
}

function navigateToPage(pageId) {
    console.log('Navigating to page:', pageId);
    showPage(pageId);
    setActiveNav(pageId);
}

function showPage(pageId) {
    console.log('Showing page:', pageId);
    
    // Hide all pages
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => {
        page.classList.remove('active');
    });
    
    // Show target page
    const targetPageId = `${pageId}-page`;
    const targetPage = document.getElementById(targetPageId);
    
    if (targetPage) {
        targetPage.classList.add('active');
        currentPage = pageId;
        console.log('Successfully showed page:', pageId);
    } else {
        console.error('Page not found:', targetPageId);
        console.log('Available pages:', Array.from(document.querySelectorAll('.page')).map(p => p.id));
    }
}

function setActiveNav(pageId) {
    console.log('Setting active nav:', pageId);
    
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.classList.remove('active');
    });
    
    const activeItem = document.querySelector(`.nav-item[data-page="${pageId}"]`);
    if (activeItem) {
        activeItem.classList.add('active');
        console.log('Successfully set active nav:', pageId);
    } else {
        console.error('Nav item not found for page:', pageId);
    }
}

function setActiveTest(testType) {
    console.log('Setting active test:', testType);
    
    const testButtons = document.querySelectorAll('.test-btn');
    testButtons.forEach(btn => {
        btn.classList.remove('active', 'btn--primary');
        btn.classList.add('btn--secondary');
    });
    
    const activeBtn = document.querySelector(`[data-test="${testType}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active', 'btn--primary');
        activeBtn.classList.remove('btn--secondary');
    }
    
    currentTestType = testType;
    
    const testTitle = document.getElementById('test-title');
    if (testTitle) {
        testTitle.textContent = testType === 'pretest' ? 'Pre-Test Pengetahuan' : 'Post-Test Pengetahuan';
    }
}

function generateQuestionnaire() {
    console.log('Generating questionnaire...');
    
    const questionsContainer = document.getElementById('questions-container');
    if (!questionsContainer) {
        console.log('Questions container not found');
        return;
    }
    
    questionsContainer.innerHTML = '';
    
    appData.questionnaire.questions.forEach((question, index) => {
        const questionDiv = document.createElement('div');
        questionDiv.className = 'question-item';
        questionDiv.innerHTML = `
            <div class="question-text">${index + 1}. ${question.text}</div>
            <div class="question-options">
                <label class="option-label">
                    <input type="radio" name="question_${question.id}" value="setuju" required>
                    <span>Setuju</span>
                </label>
                <label class="option-label">
                    <input type="radio" name="question_${question.id}" value="ragu">
                    <span>Ragu-ragu</span>
                </label>
                <label class="option-label">
                    <input type="radio" name="question_${question.id}" value="tidak_setuju">
                    <span>Tidak Setuju</span>
                </label>
            </div>
        `;
        questionsContainer.appendChild(questionDiv);
    });
    
    console.log('Questionnaire generated successfully');
}

function handleQuestionnaireSubmit(e) {
    e.preventDefault();
    console.log('Handling questionnaire submit...');
    
    const formData = new FormData(e.target);
    questionnaireAnswers = {};
    let totalScore = 0;
    
    // Check if all questions are answered
    let allAnswered = true;
    appData.questionnaire.questions.forEach(question => {
        const answer = formData.get(`question_${question.id}`);
        if (answer) {
            questionnaireAnswers[question.id] = answer;
            const score = appData.questionnaire.scoring[question.type][answer];
            totalScore += score;
        } else {
            allAnswered = false;
        }
    });
    
    if (!allAnswered) {
        showToast('Mohon jawab semua pertanyaan sebelum mengirim', 'warning');
        return;
    }
    
    console.log('Total score:', totalScore);
    displayResults(totalScore);
    showToast('Kuesioner berhasil dikirim!', 'success');
}

function displayResults(score) {
    console.log('Displaying results with score:', score);
    
    const scoreDisplay = document.getElementById('score-display');
    const interpretation = document.getElementById('interpretation');
    
    if (scoreDisplay) {
        scoreDisplay.textContent = score;
    }
    
    if (interpretation) {
        let category, categoryClass;
        if (score >= appData.questionnaire.interpretation.good.min) {
            category = appData.questionnaire.interpretation.good;
            categoryClass = 'good';
        } else if (score >= appData.questionnaire.interpretation.fair.min) {
            category = appData.questionnaire.interpretation.fair;
            categoryClass = 'fair';
        } else {
            category = appData.questionnaire.interpretation.poor;
            categoryClass = 'poor';
        }
        
        interpretation.innerHTML = `
            <h4>${categoryClass === 'good' ? 'Baik' : categoryClass === 'fair' ? 'Cukup' : 'Kurang'}</h4>
            <p>${category.desc}</p>
        `;
        interpretation.className = `interpretation ${categoryClass}`;
    }
    
    // Show results, hide form
    const questionnaireForm = document.getElementById('questionnaire-form');
    const resultsContainer = document.getElementById('results-container');
    
    if (questionnaireForm) {
        questionnaireForm.style.display = 'none';
    }
    if (resultsContainer) {
        resultsContainer.classList.remove('hidden');
    }
}

function resetQuestionnaire() {
    console.log('Resetting questionnaire...');
    
    const questionnaireForm = document.getElementById('questionnaire-form');
    const resultsContainer = document.getElementById('results-container');
    
    if (questionnaireForm) {
        questionnaireForm.reset();
        questionnaireForm.style.display = 'block';
    }
    if (resultsContainer) {
        resultsContainer.classList.add('hidden');
    }
    questionnaireAnswers = {};
}

function retryQuestionnaire() {
    resetQuestionnaire();
    showToast('Kuesioner direset. Silakan coba lagi.', 'info');
}

function setupMobilityLevels() {
    console.log('Setting up mobility levels...');
    // Mobility levels are handled by the global click handler
}

function selectMobilityLevel(level) {
    console.log('Selecting mobility level:', level);
    
    // Remove previous selection
    const mobilityLevels = document.querySelectorAll('.level-item');
    mobilityLevels.forEach(l => l.classList.remove('selected'));
    
    // Add selection to clicked level
    const selectedLevel = document.querySelector(`[data-level="${level}"]`);
    if (selectedLevel) {
        selectedLevel.classList.add('selected');
        selectedMobilityLevel = level;
        showToast(`Level ${level} dipilih`, 'info');
    }
}

function saveObservation() {
    console.log('Saving observation...');
    
    const patientName = document.getElementById('patient-name')?.value;
    const surgeryType = document.getElementById('surgery-type')?.value;
    const surgeryDate = document.getElementById('surgery-date')?.value;
    const observationTime = document.getElementById('observation-time')?.value;
    const painScale = document.getElementById('pain-scale')?.value;
    const bloodPressure = document.getElementById('blood-pressure')?.value;
    const pulse = document.getElementById('pulse')?.value;
    const spo2 = document.getElementById('spo2')?.value;
    const notes = document.getElementById('observation-notes')?.value;
    const nurseSignature = document.getElementById('nurse-signature')?.value;
    
    if (!patientName || !surgeryType || !surgeryDate || !observationTime) {
        showToast('Mohon lengkapi semua data pasien yang diperlukan', 'error');
        return;
    }
    
    if (selectedMobilityLevel === null) {
        showToast('Mohon pilih level mobilitas pasien', 'warning');
        return;
    }
    
    const observationData = {
        timestamp: new Date().toISOString(),
        testType: 'observation',
        patientInfo: {
            name: patientName,
            surgeryType: surgeryType,
            surgeryDate: surgeryDate,
            observationTime: observationTime
        },
        mobilityLevel: selectedMobilityLevel,
        vitalSigns: {
            painScale: painScale || 'Tidak diukur',
            bloodPressure: bloodPressure || 'Tidak diukur',
            pulse: pulse || 'Tidak diukur',
            spo2: spo2 || 'Tidak diukur'
        },
        notes: notes || '',
        nurseSignature: nurseSignature || '',
        hospital: appData.hospital
    };
    
    console.log('Observation data:', observationData);
    showToast('Data observasi berhasil disimpan!', 'success');
}

function exportLeafletToPDF() {
    console.log('Exporting leaflet to PDF...');
    
    // Check if jsPDF is available - try multiple ways to access it
    let jsPDF;
    
    try {
        if (window.jsPDF && window.jsPDF.jsPDF) {
            jsPDF = window.jsPDF.jsPDF;
        } else if (window.jsPDF) {
            jsPDF = window.jsPDF;
        } else if (typeof jspdf !== 'undefined') {
            jsPDF = jspdf.jsPDF;
        }
        
        if (!jsPDF) {
            throw new Error('jsPDF not found');
        }
        
        const doc = new jsPDF();
        
        // Set font encoding to support Indonesian text
        doc.setFont('helvetica');
        
        // Header with logo placeholder
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('LEAFLET MOBILISASI DINI POST OPERASI', 105, 25, { align: 'center' });
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text('RSUD Pangeran Jaya Sumitra Kotabaru', 105, 35, { align: 'center' });
        doc.text('Ruang Kerapu', 105, 42, { align: 'center' });
        
        let yPos = 55;
        
        // Manfaat Mobilisasi Dini
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('MANFAAT MOBILISASI DINI:', 20, yPos);
        yPos += 10;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const benefits = [
            '• Mencegah trombosis vena dalam (DVT)',
            '• Mengurangi pneumonia dan atelektasis', 
            '• Mencegah atrofi otot dan kekakuan sendi',
            '• Mengurangi konstipasi dan ileus',
            '• Mempersingkat lama rawat inap',
            '• Mempercepat kembali fungsi normal'
        ];
        
        benefits.forEach(benefit => {
            doc.text(benefit, 25, yPos);
            yPos += 6;
        });
        
        yPos += 8;
        
        // Fase Mobilisasi
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('FASE MOBILISASI DINI POST OPERASI:', 20, yPos);
        yPos += 12;
        
        const phases = [
            {
                title: '0-2 Jam (PACU/Recovery):',
                activities: [
                    '• Latihan napas dalam/batuk, gerakan lingkar lengan, angkat bahu',
                    '• Pompa kaki (ankle pumps), geser kaki, fleksi/ekstensi lutut',
                    '• Frekuensi: 10-15 repetisi setiap jam saat terjaga'
                ]
            },
            {
                title: '2-6 Jam (Bangun):',
                activities: [
                    '• Duduk di tepi tempat tidur (dangling)',
                    '• Mulai elevasi 30-45°, progresif ke 90°',
                    '• Monitor tekanan darah dan denyut nadi',
                    '• Pompa kaki dan fleksi lutut saat duduk'
                ]
            },
            {
                title: '6-12 Jam:',
                activities: [
                    '• Berdiri di samping tempat tidur dengan bantuan',
                    '• Gunakan gait belt untuk keamanan',
                    '• Berdiri 1-2 menit, weight shifting kecil',
                    '• Marching in place atau beberapa langkah'
                ]
            },
            {
                title: '12-24 Jam:',
                activities: [
                    '• Ambulasi awal: jalan pendek 10-20 meter 1-2x',
                    '• Gunakan walker atau bantuan',
                    '• Pace lambat, istirahat jika sesak/nyeri',
                    '• Target: duduk di kursi dan jalan koridor'
                ]
            },
            {
                title: '>24 Jam (Hari 1+):',
                activities: [
                    '• Jalan progresif: ≥50-100 meter beberapa kali/hari',
                    '• Transfer kursi mandiri, toileting aman',
                    '• Keluar tempat tidur sebagian besar waktu terjaga'
                ]
            }
        ];
        
        phases.forEach(phase => {
            if (yPos > 250) {
                doc.addPage();
                yPos = 20;
            }
            
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text(phase.title, 20, yPos);
            yPos += 7;
            
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            phase.activities.forEach(activity => {
                if (yPos > 270) {
                    doc.addPage();
                    yPos = 20;
                }
                // Split long lines to fit page width
                const lines = doc.splitTextToSize(activity, 170);
                lines.forEach(line => {
                    doc.text(line, 25, yPos);
                    yPos += 5;
                });
            });
            yPos += 5;
        });
        
        // Add new page for indications and contraindications
        doc.addPage();
        yPos = 25;
        
        // Indikasi
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('INDIKASI MOBILISASI:', 20, yPos);
        yPos += 10;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const indications = [
            '• Pasien sadar dan kooperatif',
            '• Tanda vital stabil',
            '• Nyeri terkontrol (≤3-4/10)',
            '• Tidak ada kontraindikasi medis'
        ];
        
        indications.forEach(indication => {
            doc.text(indication, 25, yPos);
            yPos += 7;
        });
        
        yPos += 8;
        
        // Kontraindikasi
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('KONTRAINDIKASI:', 20, yPos);
        yPos += 10;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const contraindications = [
            '• Instabilitas hemodinamik',
            '• Hipoksemia berat (SpO₂ <88%)',
            '• Nyeri tidak terkontrol',
            '• Perdarahan aktif',
            '• Kesadaran menurun'
        ];
        
        contraindications.forEach(contraindication => {
            doc.text(contraindication, 25, yPos);
            yPos += 7;
        });
        
        yPos += 12;
        
        // Tips Keamanan
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('TIPS KEAMANAN:', 20, yPos);
        yPos += 10;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const safetyTips = [
            '• Selalu dampingi pasien',
            '• Gunakan gait belt',
            '• Monitor tanda vital',
            '• Hentikan jika ada gejala',
            '• Pastikan lingkungan aman'
        ];
        
        safetyTips.forEach(tip => {
            doc.text(tip, 25, yPos);
            yPos += 7;
        });
        
        // Footer
        yPos += 20;
        if (yPos > 250) {
            doc.addPage();
            yPos = 30;
        }
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Ruang Kerapu - RSUD Pangeran Jaya Sumitra Kotabaru', 105, yPos, { align: 'center' });
        yPos += 8;
        doc.setFont('helvetica', 'normal');
        doc.text('Perawat Ahli Pertama: Suriansyah, S.Kep., Ns', 105, yPos, { align: 'center' });
        yPos += 6;
        doc.text('NIP: 19920220 202504 1 005', 105, yPos, { align: 'center' });
        
        // Save the PDF
        const timestamp = new Date().toISOString().slice(0, 10);
        doc.save(`Leaflet_Mobilisasi_Dini_${timestamp}.pdf`);
        
        showToast('Leaflet PDF berhasil didownload!', 'success');
        
    } catch (error) {
        console.error('PDF generation error:', error);
        console.log('jsPDF availability check:', {
            'window.jsPDF': typeof window.jsPDF,
            'window.jsPDF.jsPDF': window.jsPDF && typeof window.jsPDF.jsPDF,
            'jspdf': typeof jspdf !== 'undefined' ? typeof jspdf : 'undefined'
        });
        
        showToast('Menggunakan fungsi print browser untuk menyimpan PDF...', 'info');
        
        // Fallback: use print functionality
        const originalTitle = document.title;
        document.title = 'Leaflet Mobilisasi Dini Post Operasi';
        
        // Navigate to leaflet page if not already there
        if (currentPage !== 'leaflet') {
            navigateToPage('leaflet');
        }
        
        // Wait a bit then trigger print
        setTimeout(() => {
            window.print();
            document.title = originalTitle;
        }, 500);
    }
}

function exportResultsToPDF() {
    console.log('Exporting results to PDF...');
    
    if (Object.keys(questionnaireAnswers).length === 0) {
        showToast('Tidak ada hasil kuesioner untuk diekspor', 'warning');
        return;
    }
    
    // Check if jsPDF is available
    let jsPDF;
    
    try {
        if (window.jsPDF && window.jsPDF.jsPDF) {
            jsPDF = window.jsPDF.jsPDF;
        } else if (window.jsPDF) {
            jsPDF = window.jsPDF;
        } else if (typeof jspdf !== 'undefined') {
            jsPDF = jspdf.jsPDF;
        }
        
        if (!jsPDF) {
            throw new Error('jsPDF not found');
        }
        
        const doc = new jsPDF();
        
        // Calculate score
        let totalScore = 0;
        appData.questionnaire.questions.forEach(question => {
            const answer = questionnaireAnswers[question.id];
            if (answer) {
                const score = appData.questionnaire.scoring[question.type][answer];
                totalScore += score;
            }
        });
        
        // Determine interpretation
        let interpretation;
        if (totalScore >= appData.questionnaire.interpretation.good.min) {
            interpretation = 'Baik';
        } else if (totalScore >= appData.questionnaire.interpretation.fair.min) {
            interpretation = 'Cukup';
        } else {
            interpretation = 'Kurang';
        }
        
        // Header
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('HASIL KUESIONER MOBILISASI DINI', 105, 20, { align: 'center' });
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text('RSUD Pangeran Jaya Sumitra Kotabaru - Ruang Kerapu', 105, 30, { align: 'center' });
        
        let yPos = 45;
        
        // Test info
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`Jenis Test: ${currentTestType === 'pretest' ? 'Pre-Test' : 'Post-Test'}`, 20, yPos);
        yPos += 8;
        doc.text(`Tanggal: ${new Date().toLocaleDateString('id-ID')}`, 20, yPos);
        yPos += 15;
        
        // Score
        doc.setFontSize(14);
        doc.text(`SKOR TOTAL: ${totalScore}/12`, 20, yPos);
        yPos += 8;
        doc.text(`INTERPRETASI: ${interpretation}`, 20, yPos);
        yPos += 15;
        
        // Questions and answers
        doc.setFontSize(12);
        doc.text('JAWABAN:', 20, yPos);
        yPos += 10;
        
        doc.setFontSize(10);
        appData.questionnaire.questions.forEach((question, index) => {
            if (yPos > 260) {
                doc.addPage();
                yPos = 20;
            }
            
            doc.setFont('helvetica', 'bold');
            const questionLines = doc.splitTextToSize(`${index + 1}. ${question.text}`, 170);
            questionLines.forEach(line => {
                doc.text(line, 20, yPos);
                yPos += 6;
            });
            yPos += 2;
            
            const answer = questionnaireAnswers[question.id];
            doc.setFont('helvetica', 'normal');
            doc.text(`Jawaban: ${answer === 'setuju' ? 'Setuju' : answer === 'ragu' ? 'Ragu-ragu' : 'Tidak Setuju'}`, 25, yPos);
            yPos += 10;
        });
        
        // Footer
        yPos += 10;
        if (yPos > 260) {
            doc.addPage();
            yPos = 30;
        }
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Perawat Ahli Pertama: Suriansyah, S.Kep., Ns', 105, yPos, { align: 'center' });
        yPos += 6;
        doc.text('NIP: 19920220 202504 1 005', 105, yPos, { align: 'center' });
        
        // Save the PDF
        const timestamp = new Date().toISOString().slice(0, 10);
        const testTypeLabel = currentTestType === 'pretest' ? 'PreTest' : 'PostTest';
        doc.save(`Hasil_Kuesioner_${testTypeLabel}_${timestamp}.pdf`);
        
        showToast('Hasil kuesioner PDF berhasil didownload!', 'success');
        
    } catch (error) {
        console.error('PDF generation error:', error);
        showToast('Error saat membuat PDF. Gunakan print browser sebagai alternatif.', 'warning');
        
        // Fallback to print
        setTimeout(() => {
            window.print();
        }, 500);
    }
}

function generateQRCode() {
    const currentURL = window.location.href;
    const qrCodeContainer = document.querySelector('.qr-code');
    
    // Create QR code using API
    const qrCodeURL = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(currentURL)}`;
    
    qrCodeContainer.innerHTML = `
        <img src="${qrCodeURL}" alt="QR Code" style="max-width: 200px; border-radius: 8px;">
        <p>Scan untuk akses mobile</p>
    `;
    
    showToast('QR Code berhasil dibuat!', 'success');
}

function calculateScore() {
    let totalScore = 0;
    appData.questionnaire.questions.forEach(question => {
        const answer = questionnaireAnswers[question.id];
        if (answer) {
            const score = appData.questionnaire.scoring[question.type][answer];
            totalScore += score;
        }
    });
    return totalScore;
}

function showToast(message, type = 'info') {
    console.log('Showing toast:', message, type);
    
    const toast = document.getElementById('toast');
    if (!toast) {
        console.error('Toast element not found');
        return;
    }
    
    const toastIcon = toast.querySelector('.toast-icon');
    const toastMessage = toast.querySelector('.toast-message');
    
    if (!toastIcon || !toastMessage) {
        console.error('Toast components not found');
        return;
    }
    
    // Set icon based on type
    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };
    
    toastIcon.className = `toast-icon ${icons[type]}`;
    toastMessage.textContent = message;
    
    // Remove previous type classes and add current type
    toast.classList.remove('success', 'error', 'warning', 'info');
    toast.classList.add(type);
    
    // Show toast
    toast.classList.remove('hidden');
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // Hide toast after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 300);
    }, 3000);
}

// Print function enhancement
window.addEventListener('beforeprint', function() {
    document.body.classList.add('printing');
});

window.addEventListener('afterprint', function() {
    document.body.classList.remove('printing');
});

// Utility functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}