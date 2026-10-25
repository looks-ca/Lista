import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs,
    doc,
    updateDoc
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
const db = getFirestore(app);
const COLLECTION_NAME = "guests";

// Referencias del DOM
const tabLoginBtn = document.getElementById('tab-login-btn');
const tabRegisterBtn = document.getElementById('tab-register-btn');
const tabButtonsContainer = document.querySelector('.tab-buttons');
const notification = document.getElementById('auth-notification');

const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const recoverStep1 = document.getElementById('recover-step1');
const recoverStep2 = document.getElementById('recover-step2');
const recoverStep3 = document.getElementById('recover-step3');

const authView = document.getElementById('auth-view');
const qrView = document.getElementById('qr-view');
const userDisplayName = document.getElementById('user-display-name');
const badgeDoc = document.getElementById('badge-doc');
const badgeOrigin = document.getElementById('badge-origin');
const badgeStatus = document.getElementById('badge-status');
const qrcodeContainer = document.getElementById('qrcode');
const logoutBtn = document.getElementById('logout-btn');
const welcomeMessage = document.getElementById('welcome-message');

let currentUserDocId = null; 
let qrInstance = null;
let recoveryUserId = null; // Para guardar el ID temporal al recuperar clave

// Función de notificaciones
function showNotification(message, isError = false) {
    notification.textContent = message;
    notification.style.display = 'flex';
    notification.style.backgroundColor = isError ? 'rgba(239, 68, 68, 0.2)' : 'rgba(52, 211, 153, 0.2)';
    notification.style.border = `1px solid ${isError ? '#ef4444' : '#34d399'}`;
    notification.style.color = isError ? '#f87171' : '#34d399';

    setTimeout(() => {
        notification.style.display = 'none';
    }, 3500);
}

// Cambiar entre formularios principales
function switchForm(formToShow) {
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    formToShow.classList.add('active');
}

tabLoginBtn.addEventListener('click', () => {
    tabLoginBtn.classList.add('active');
    tabRegisterBtn.classList.remove('active');
    tabButtonsContainer.style.display = 'flex';
    switchForm(loginForm);
});

tabRegisterBtn.addEventListener('click', () => {
    tabRegisterBtn.classList.add('active');
    tabLoginBtn.classList.remove('active');
    tabButtonsContainer.style.display = 'flex';
    switchForm(registerForm);
});

// Botones de "Volver" en los menús de recuperación
document.querySelectorAll('.btn-back-login').forEach(btn => {
    btn.addEventListener('click', () => {
        tabLoginBtn.click();
    });
});

// Navegar a Recuperar Contraseña
document.getElementById('btn-forgot-password').addEventListener('click', () => {
    tabButtonsContainer.style.display = 'none'; // Ocultar pestañas al recuperar
    switchForm(recoverStep1);
});

// REGISTRO DE USUARIO
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim().toLowerCase();
    
    // Concatenar Selectores con Inputs
    const docType = document.getElementById('reg-doc-type').value;
    const docNumber = document.getElementById('reg-doc').value.trim();
    const fullDoc = docType + docNumber;

    const phoneCode = document.getElementById('reg-phone-code').value;
    const phoneNumber = document.getElementById('reg-phone').value.trim();
    const fullPhone = phoneCode + phoneNumber;

    const origin = document.getElementById('reg-origin').value;
    const password = document.getElementById('reg-password').value.trim();

    try {
        const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
        let exists = false;
        querySnapshot.forEach((docSnap) => {
            if (docSnap.data().doc === fullDoc || docSnap.data().email === email) {
                exists = true;
            }
        });

        if (exists) {
            showNotification("Ya existe un registro con esta cédula o correo.", true);
            return;
        }

        await addDoc(collection(db, COLLECTION_NAME), {
            name,
            email,
            doc: fullDoc,
            phone: fullPhone,
            origin,
            password,
            status: "Ausente",
            recoveryCode: null,
            createdAt: new Date().toISOString()
        });

        registerForm.reset();
        tabLoginBtn.click();
        showNotification("¡Registrado con éxito! Ya puedes iniciar sesión.");
    } catch (error) {
        console.error("Error al registrar:", error);
        showNotification("Hubo un error al registrar en la base de datos.", true);
    }
});

// LOGIN DE USUARIO
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const docType = document.getElementById('login-doc-type').value;
    const docNumber = document.getElementById('login-doc').value.trim();
    const fullDoc = docType + docNumber;
    
    const password = document.getElementById('login-password').value.trim();

    try {
        const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
        let foundUser = null;
        let foundId = null;

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.doc === fullDoc) {
                foundUser = data;
                foundId = docSnap.id;
            }
        });

        if (!foundUser) {
            showNotification("No se encontró ningún registro con esta cédula.", true);
        } else {
            if (foundUser.password && foundUser.password !== password) {
                showNotification("Contraseña incorrecta.", true);
                return;
            }

            currentUserDocId = foundId;
            welcomeMessage.textContent = `Bienvenido, ${foundUser.name}`;
            userDisplayName.textContent = foundUser.name;
            badgeDoc.textContent = foundUser.doc;
            badgeOrigin.textContent = foundUser.origin || 'N/A';
            badgeStatus.textContent = foundUser.status;
            badgeStatus.className = `status-badge badge-${foundUser.status}`;

            qrcodeContainer.innerHTML = "";
            qrInstance = new QRCode(qrcodeContainer, {
                text: foundUser.doc,
                width: 180,
                height: 180,
                colorDark: "#3C005A",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });

            authView.style.display = 'none';
            qrView.style.display = 'block';
        }
    } catch (error) {
        console.error("Error al iniciar sesión:", error);
        showNotification("Error al conectar con la base de datos.", true);
    }
});

// PASO 1: ENVIAR CÓDIGO DE RECUPERACIÓN
recoverStep1.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('rec-email').value.trim().toLowerCase();

    try {
        const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
        let foundUser = null;
        
        querySnapshot.forEach((docSnap) => {
            if (docSnap.data().email === email) {
                foundUser = docSnap.id;
            }
        });

        if (!foundUser) {
            showNotification("No hay ninguna cuenta con ese correo.", true);
            return;
        }

        // Generar código aleatorio de 6 dígitos
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Guardar código en la BD
        const userRef = doc(db, COLLECTION_NAME, foundUser);
        await updateDoc(userRef, { recoveryCode: code });

        recoveryUserId = foundUser;
        
// ENVÍO DE CORREO REAL CON EMAILJS
        showNotification("Enviando código, por favor espera...");
        
        try {
            await emailjs.send("service_8imxdcc", "template_2e9s9ex", {
                to_email: email, // El correo del usuario
                codigo: code     // El código de 6 dígitos que generamos
            });

            showNotification("Código enviado. Revisa tu bandeja de entrada o SPAM.");
            switchForm(recoverStep2);
            
        } catch (emailError) {
            console.error("Error al enviar el correo con EmailJS:", emailError);
            showNotification("Error al enviar el correo. Intenta de nuevo.", true);
            // Si el correo falla, regresamos el código a null en la BD por seguridad
            await updateDoc(userRef, { recoveryCode: null });
        }
    } catch (error) {
        console.error("Error:", error);
        showNotification("Error al procesar la solicitud.", true);
    }
});

// PASO 2: VERIFICAR CÓDIGO
recoverStep2.addEventListener('submit', async (e) => {
    e.preventDefault();
    const inputCode = document.getElementById('rec-code').value.trim();

    try {
        const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
        let isValid = false;

        querySnapshot.forEach((docSnap) => {
            if (docSnap.id === recoveryUserId && docSnap.data().recoveryCode === inputCode) {
                isValid = true;
            }
        });

        if (isValid) {
            showNotification("Código verificado correctamente.");
            switchForm(recoverStep3);
        } else {
            showNotification("Código incorrecto o expirado.", true);
        }
    } catch (error) {
        showNotification("Error de conexión.", true);
    }
});

// PASO 3: GUARDAR NUEVA CONTRASEÑA
recoverStep3.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPassword = document.getElementById('rec-new-password').value.trim();

    try {
        const userRef = doc(db, COLLECTION_NAME, recoveryUserId);
        
        // Actualiza clave y elimina el código de seguridad usado
        await updateDoc(userRef, { 
            password: newPassword,
            recoveryCode: null
        });

        showNotification("Contraseña actualizada con éxito.");
        recoverStep1.reset();
        recoverStep2.reset();
        recoverStep3.reset();
        recoveryUserId = null;
        tabLoginBtn.click(); // Vuelve al login normal
        
    } catch (error) {
        showNotification("Error al cambiar la contraseña.", true);
    }
});

// CERRAR SESIÓN
logoutBtn.addEventListener('click', () => {
    currentUserDocId = null;
    loginForm.reset();
    qrView.style.display = 'none';
    authView.style.display = 'block';
});