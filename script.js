import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-analytics.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    onSnapshot 
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyA9h_32RAALDD6_dUnvpQAJGbPO_wiEe0",
    authDomain: "looks-d9510.firebaseapp.com",
    projectId: "looks-d9510",
    storageBucket: "looks-d9510.firebasestorage.app",
    messagingSenderId: "233234503223",
    appId: "1:233234503223:web:7f109a4e6edf79c39b91b2",
    measurementId: "G-5K0JMNRN6M"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const COLLECTION_NAME = "guests";

let guests = [];

const navButtons = document.querySelectorAll('.nav-btn');
const viewSections = document.querySelectorAll('.view-section');
const guestsTableBody = document.getElementById('guests-table-body');
const searchInput = document.getElementById('search-input');
const statusFilter = document.getElementById('status-filter');
const appNotification = document.getElementById('app-notification');

const modal = document.getElementById('guest-modal');
const openModalBtn = document.getElementById('open-modal-btn');
const closeModalBtn = document.getElementById('close-modal-btn');
const cancelModalBtn = document.getElementById('cancel-modal-btn');
const guestForm = document.getElementById('guest-form');
const modalTitle = document.getElementById('modal-title');

const guestIdInput = document.getElementById('guest-id');
const guestNameInput = document.getElementById('guest-name');
const guestDocInput = document.getElementById('guest-doc');
const guestPhoneInput = document.getElementById('guest-phone');
const guestOriginInput = document.getElementById('guest-origin');
const guestStatusInput = document.getElementById('guest-status');
const statusGroupContainer = document.getElementById('status-group-container');

const deleteModal = document.getElementById('delete-modal');
const closeDeleteModalBtn = document.getElementById('close-delete-modal');
const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
const deleteGuestNameEl = document.getElementById('delete-guest-name');
let pendingDeleteId = null;

// Modal de Escaneo Exitoso
const scanSuccessModal = document.getElementById('scan-success-modal');
const closeScanModalBtn = document.getElementById('close-scan-modal-btn');
const scanGuestName = document.getElementById('scan-guest-name');
const scanGuestDoc = document.getElementById('scan-guest-doc');
const scanGuestLetter = document.getElementById('scan-guest-letter');

const winnerModal = document.getElementById('winner-modal');
const closeWinnerModalBtn = document.getElementById('close-winner-modal');
const acceptWinnerBtn = document.getElementById('accept-winner-btn');
const winnerNumberEl = document.getElementById('winner-number');
const winnerNameEl = document.getElementById('winner-name');
const winnerDocEl = document.getElementById('winner-doc');
const winnerOriginEl = document.getElementById('winner-origin');

const presentCountEl = document.getElementById('present-count');
const absentCountEl = document.getElementById('absent-count');

const qrInputCode = document.getElementById('qr-input-code');
const processQrBtn = document.getElementById('process-qr-btn');

const spinRouletteBtn = document.getElementById('spin-roulette-btn');
const rouletteNumberEl = document.getElementById('roulette-number');

let html5QrCodeScanner = null;

function showNotification(message, isError = false) {
    appNotification.innerHTML = `<i class="fa-solid ${isError ? 'fa-triangle-exclamation' : 'fa-circle-info'}"></i> ${message}`;
    appNotification.style.display = 'flex';
    appNotification.style.borderColor = isError ? '#ef4444' : 'var(--border-color)';
    
    setTimeout(() => {
        appNotification.style.display = 'none';
    }, 4000);
}

navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        navButtons.forEach(b => b.classList.remove('active'));
        viewSections.forEach(s => s.classList.remove('active'));

        btn.classList.add('active');
        const targetId = btn.getAttribute('data-target');
        const targetView = document.getElementById(targetId);
        if (targetView) targetView.classList.add('active');

        if (targetId === 'scanner-view') {
            initCameraScanner();
        } else {
            stopCameraScanner();
        }
    });
});

function getAssignedLetter(index) {
    if (index < 50) return 'A';
    if (index < 100) return 'B';
    return 'C';
}

function getLetterCounts() {
    let counts = { A: 0, B: 0, C: 0 };
    guests.forEach((_, index) => {
        const letter = getAssignedLetter(index);
        if (counts[letter] !== undefined) counts[letter]++;
    });
    return counts;
}

function renderGuests() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const filterStatus = statusFilter.value;

    guestsTableBody.innerHTML = '';

    const filteredGuests = guests.map((guest, originalIndex) => ({ ...guest, originalIndex })).filter(item => {
        const assignedLetter = getAssignedLetter(item.originalIndex).toLowerCase();
        const originText = (item.origin || '').toLowerCase();
        const matchesSearch = item.name.toLowerCase().includes(searchTerm) || 
                              item.doc.toLowerCase().includes(searchTerm) || 
                              originText.includes(searchTerm) ||
                              assignedLetter === searchTerm;
        const matchesStatus = filterStatus === '' || item.status === filterStatus;
        return matchesSearch && matchesStatus;
    });

    if (filteredGuests.length === 0) {
        guestsTableBody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center">No se encontraron registros en Firebase</td>
            </tr>
        `;
        return;
    }

    filteredGuests.forEach((guest) => {
        const index = guest.originalIndex;
        const letter = getAssignedLetter(index);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="row-number">#${index + 1}</td>
            <td><span class="letter-badge letter-${letter}">${letter}</span></td>
            <td>${guest.name}</td>
            <td>${guest.doc}</td>
            <td>${guest.phone || 'N/A'}</td>
            <td>${guest.origin || 'N/A'}</td>
            <td><span class="status-badge badge-${guest.status}">${guest.status}</span></td>
            <td class="text-center">
                <button class="action-icon edit" onclick="window.openEditModal('${guest.id}')" title="Editar">
                    <i class="fa-solid fa-pen-to-square"></i>
                </button>
                <button class="action-icon delete" onclick="window.promptDeleteGuest('${guest.id}')" title="Eliminar">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        guestsTableBody.appendChild(tr);
    });
}

function updateMetrics() {
    presentCountEl.textContent = guests.filter(g => g.status === 'Presente').length;
    absentCountEl.textContent = guests.filter(g => g.status === 'Ausente').length;
}

function initRealtimeSync() {
    onSnapshot(collection(db, COLLECTION_NAME), (snapshot) => {
        guests = [];
        snapshot.forEach((docSnap) => {
            guests.push({ id: docSnap.id, ...docSnap.data() });
        });
        renderGuests();
        updateMetrics();
    }, (error) => {
        console.error("Error al sincronizar con Firestore:", error);
        showNotification("Error al conectar con la base de datos.", true);
    });
}

function openModal() { modal.classList.add('active'); }
function closeModal() {
    modal.classList.remove('active');
    guestForm.reset();
    guestIdInput.value = '';
    modalTitle.textContent = 'Nuevo Registro';
}

openModalBtn.addEventListener('click', () => {
    if (guests.length >= 150) {
        showNotification('Se ha alcanzado el límite máximo absoluto de 150 registros.', true);
        return;
    }

    modalTitle.textContent = 'Nuevo Registro';
    guestForm.reset();
    guestIdInput.value = '';
    statusGroupContainer.style.display = 'none';
    openModal();
});

closeModalBtn.addEventListener('click', closeModal);
cancelModalBtn.addEventListener('click', closeModal);
window.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

guestForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = guestIdInput.value;
    const name = guestNameInput.value.trim();
    const docId = guestDocInput.value.trim();
    const phone = guestPhoneInput.value.trim();
    const origin = guestOriginInput.value.trim();
    const status = guestStatusInput.value;

    closeModal(); // Cierre instantáneo del modal al guardar

    try {
        if (id) {
            const guestRef = doc(db, COLLECTION_NAME, id);
            await updateDoc(guestRef, { name, doc: docId, phone, origin, status });
            showNotification('Registro actualizado en Firebase.');
        } else {
            const counts = getLetterCounts();
            if (counts.A >= 50 && counts.B >= 50 && counts.C >= 50) {
                showNotification('Todas las filas están llenas.', true);
                return;
            }

            await addDoc(collection(db, COLLECTION_NAME), {
                name,
                doc: docId,
                phone,
                origin,
                status: 'Ausente',
                createdAt: new Date().toISOString()
            });
            showNotification('Nuevo invitado guardado.');
        }
    } catch (error) {
        console.error("Error al guardar en Firebase:", error);
        showNotification("Hubo un error al guardar el registro.", true);
    }
});

async function processScannedCode(code) {
    const cleanCode = code.trim();
    
    let extractedDoc = cleanCode;
    if (cleanCode.includes("Cédula:")) {
        const parts = cleanCode.split("Cédula:");
        if (parts.length > 1) {
            extractedDoc = parts[1].split("|")[0].trim();
        }
    }

    const index = guests.findIndex(g => g.doc === cleanCode || g.doc === extractedDoc || g.id === cleanCode || g.name.toLowerCase() === cleanCode.toLowerCase());
    
    if (index !== -1) {
        const guest = guests[index];
        const assignedLetter = getAssignedLetter(index);
        
        try {
            const guestRef = doc(db, COLLECTION_NAME, guest.id);
            await updateDoc(guestRef, { status: 'Presente' });

            scanGuestName.textContent = guest.name;
            scanGuestDoc.textContent = guest.doc;
            scanGuestLetter.textContent = `Fila ${assignedLetter} (Orden #${index + 1})`;
            scanSuccessModal.classList.add('active');
        } catch (error) {
            console.error("Error al actualizar asistencia:", error);
            showNotification('Error al actualizar la asistencia en la base de datos.', true);
        }
    } else {
        showNotification(`Código "${cleanCode}" no registrado en la base de datos.`, true);
    }
}

closeScanModalBtn.addEventListener('click', () => {
    scanSuccessModal.classList.remove('active');
});
window.addEventListener('click', (e) => {
    if (e.target === scanSuccessModal) scanSuccessModal.classList.remove('active');
});

function initCameraScanner() {
    if (html5QrCodeScanner) return;
    try {
        html5QrCodeScanner = new Html5QrcodeScanner(
            "reader", 
            { fps: 10, qrbox: { width: 250, height: 250 } },
            false
        );
        html5QrCodeScanner.render((decodedText) => {
            processScannedCode(decodedText);
        }, (errorMessage) => {});
    } catch (e) {
        console.error("Error al iniciar cámara:", e);
    }
}

function stopCameraScanner() {
    if (html5QrCodeScanner) {
        html5QrCodeScanner.clear().catch(() => {});
        html5QrCodeScanner = null;
    }
}

processQrBtn.addEventListener('click', () => {
    const code = qrInputCode.value.trim();
    if (!code) {
        showNotification('Por favor ingresa un código.', true);
        return;
    }
    processScannedCode(code);
    qrInputCode.value = '';
});

qrInputCode.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') processQrBtn.click();
});

spinRouletteBtn.addEventListener('click', () => {
    const presentGuests = guests.map((g, idx) => ({ ...g, originalIndex: idx }))
                                .filter(g => g.status === 'Presente');

    if (presentGuests.length === 0) {
        rouletteNumberEl.textContent = '0';
        showNotification('No hay ningún invitado marcado como "Presente" para participar.', true);
        return;
    }

    let counter = 0;
    spinRouletteBtn.disabled = true;
    
    const interval = setInterval(() => {
        const randomTemp = Math.floor(Math.random() * presentGuests.length) + 1;
        rouletteNumberEl.textContent = randomTemp;
        counter++;

        if (counter > 15) {
            clearInterval(interval);
            const randomIndex = Math.floor(Math.random() * presentGuests.length);
            const winner = presentGuests[randomIndex];

            rouletteNumberEl.textContent = `#${winner.originalIndex + 1}`;
            
            setTimeout(() => {
                winnerNumberEl.textContent = `#${winner.originalIndex + 1}`;
                winnerNameEl.textContent = winner.name;
                winnerDocEl.textContent = winner.doc;
                winnerOriginEl.textContent = winner.origin || 'N/A';
                
                winnerModal.classList.add('active');
                spinRouletteBtn.disabled = false;
            }, 250);
        }
    }, 100);
});

closeWinnerModalBtn.addEventListener('click', () => { winnerModal.classList.remove('active'); });
acceptWinnerBtn.addEventListener('click', () => { winnerModal.classList.remove('active'); });
window.addEventListener('click', (e) => { if (e.target === winnerModal) winnerModal.classList.remove('active'); });

window.openEditModal = function(id) {
    const guest = guests.find(g => g.id === id);
    if (!guest) return;

    modalTitle.textContent = 'Editar Registro';
    guestIdInput.value = guest.id;
    guestNameInput.value = guest.name;
    guestDocInput.value = guest.doc;
    guestPhoneInput.value = guest.phone;
    guestOriginInput.value = guest.origin || '';
    guestStatusInput.value = guest.status;

    statusGroupContainer.style.display = 'block';
    openModal();
};

window.promptDeleteGuest = function(id) {
    const guest = guests.find(g => g.id === id);
    if (!guest) return;

    pendingDeleteId = id;
    deleteGuestNameEl.textContent = guest.name;
    deleteModal.classList.add('active');
};

const closeDeleteModal = () => {
    deleteModal.classList.remove('active');
    pendingDeleteId = null;
};

closeDeleteModalBtn.addEventListener('click', closeDeleteModal);
cancelDeleteBtn.addEventListener('click', closeDeleteModal);
window.addEventListener('click', (e) => { if (e.target === deleteModal) closeDeleteModal(); });

confirmDeleteBtn.addEventListener('click', async () => {
    if (!pendingDeleteId) return;

    const guestToDelete = guests.find(g => g.id === pendingDeleteId);
    const guestName = guestToDelete ? guestToDelete.name : 'Registro';
    const idToDelete = pendingDeleteId;

    closeDeleteModal(); // Cerramos el modal primero de forma instantánea

    try {
        await deleteDoc(doc(db, COLLECTION_NAME, idToDelete));
        showNotification(`Se ha eliminado correctamente a ${guestName}.`);
    } catch (error) {
        console.error("Error al eliminar de Firebase:", error);
        showNotification("No se pudo eliminar el registro.", true);
    }
});

searchInput.addEventListener('input', renderGuests);
statusFilter.addEventListener('change', renderGuests);

initRealtimeSync();