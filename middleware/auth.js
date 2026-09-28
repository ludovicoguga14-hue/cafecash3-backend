/**
 * ═══════════════════════════════════════════════════════════════════
 * CafeCash Authentication
 * Handles: Login, Register, Google, Apple, Backend sync
 * ═══════════════════════════════════════════════════════════════════
 */

(function () {
    'use strict';

    // ═══════════════════════════════════════════════════════════════
    // CONFIG
    // ═══════════════════════════════════════════════════════════════

    const API_BASE =
        (location.hostname === 'localhost' ||
         location.hostname === '127.0.0.1')
            ? 'http://localhost:8080/api'
            : 'https://cafecash3-backend-3.onrender.com/api';

    let mode = 'login';

    // ═══════════════════════════════════════════════════════════════
    // DOM
    // ═══════════════════════════════════════════════════════════════

    const $ = (id) => document.getElementById(id);

    function showError(message) {
        const el = $('authError');

        if (!el) {
            console.error('AUTH ERROR:', message);
            return;
        }

        el.textContent = message;
        el.classList.add('show');
    }

    function hideError() {
        const el = $('authError');

        if (!el) return;

        el.classList.remove('show');
    }

    function setLoading(loading) {
        const btn = $('authSubmit');

        if (!btn) return;

        btn.disabled = loading;

        btn.textContent = loading
            ? (mode === 'login' ? 'Signing in…' : 'Creating…')
            : (mode === 'login' ? 'Sign in' : 'Create account');
    }

    // ═══════════════════════════════════════════════════════════════
    // LOGIN / REGISTER MODE
    // ═══════════════════════════════════════════════════════════════

    window.switchAuthMode = function (newMode) {
        mode = newMode;

        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.classList.toggle(
                'active',
                tab.dataset.mode === newMode
            );
        });

        const isRegister = newMode === 'register';

        const nameField = $('nameField');
        const universityField = $('universityField');
        const cafeteriaField = $('cafeteriaField');
        const titleEl = $('authTitle');
        const subtitleEl = $('authSubtitle');
        const submitBtn = $('authSubmit');
        const passwordEl = $('password');

        if (nameField) {
            nameField.style.display = isRegister ? '' : 'none';
        }

        if (universityField) {
            universityField.style.display = isRegister ? '' : 'none';
        }

        if (cafeteriaField) {
            cafeteriaField.style.display = isRegister ? '' : 'none';
        }

        if (titleEl) {
            titleEl.textContent =
                isRegister
                    ? 'Create your account'
                    : 'Welcome back';
        }

        if (subtitleEl) {
            subtitleEl.textContent =
                isRegister
                    ? 'Set up your café workspace in under 30 seconds'
                    : 'Sign in to your CafeCash account';
        }

        if (submitBtn) {
            submitBtn.textContent =
                isRegister
                    ? 'Create account'
                    : 'Sign in';
        }

        if (passwordEl) {
            passwordEl.autocomplete =
                isRegister
                    ? 'new-password'
                    : 'current-password';
        }

        hideError();

        const url = new URL(location.href);

        if (isRegister) {
            url.hash = 'register';
        } else {
            url.hash = '';
        }

        history.replaceState(null, '', url);
    };

    // ═══════════════════════════════════════════════════════════════
    // GET FRESH FIREBASE TOKEN
    // ═══════════════════════════════════════════════════════════════

    async function getFreshFirebaseToken(user) {
        if (!user) {
            throw new Error('Firebase user was not found.');
        }

        const idToken = await user.getIdToken(true);

        if (!idToken) {
            throw new Error(
                'Firebase did not provide an ID token.'
            );
        }

        console.log('════════ FIREBASE TOKEN ════════');
        console.log('UID:', user.uid);
        console.log('Email:', user.email);
        console.log('Token received:', true);
        console.log('Token length:', idToken.length);
        console.log('════════════════════════════════');

        return idToken;
    }

    // ═══════════════════════════════════════════════════════════════
    // BACKEND SYNC
    // ═══════════════════════════════════════════════════════════════

    async function syncWithBackend(idToken, payload) {

        console.log('════════ BACKEND SYNC ════════');
        console.log('URL:', API_BASE + '/auth/sync');
        console.log('Payload:', payload);
        console.log('Token exists:', !!idToken);
        console.log('Token length:', idToken?.length);
        console.log('══════════════════════════════');

        let res;

        try {

            res = await fetch(
                API_BASE + '/auth/sync',
                {
                    method: 'POST',

                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + idToken
                    },

                    body: JSON.stringify(payload)
                }
            );

        } catch (networkError) {

            console.error(
                '❌ NETWORK ERROR:',
                networkError
            );

            throw new Error(
                'Could not reach the CafeCash backend. Check that Render is running.'
            );
        }

        let data;

        try {

            data = await res.json();

        } catch (jsonError) {

            console.error(
                '❌ INVALID BACKEND RESPONSE:',
                jsonError
            );

            throw new Error(
                `Backend returned an invalid response (HTTP ${res.status}).`
            );
        }

        console.log('════════ BACKEND RESPONSE ════════');
        console.log('HTTP status:', res.status);
        console.log('Status text:', res.statusText);
        console.log('Response:', data);
        console.log('══════════════════════════════════');

        if (!res.ok || data.success === false) {

            console.error(
                '❌ BACKEND SYNC FAILED:',
                {
                    status: res.status,
                    statusText: res.statusText,
                    data: data
                }
            );

            const error = new Error(
                data.error ||
                data.message ||
                `Backend error: HTTP ${res.status}`
            );

            error.status = res.status;
            error.code = data.code || null;
            error.backendResponse = data;

            throw error;
        }

        console.log(
            '✅ BACKEND SYNC SUCCESSFUL'
        );

        return data;
    }

    // ═══════════════════════════════════════════════════════════════
    // SAVE SESSION
    // ═══════════════════════════════════════════════════════════════

    function saveSession(idToken, user) {

        if (!idToken) {
            throw new Error(
                'Cannot save session: Firebase token is missing.'
            );
        }

        localStorage.setItem(
            'cafecash_token',
            idToken
        );

        sessionStorage.setItem(
            'cafecash_user',
            JSON.stringify(user)
        );

        console.log('✅ CafeCash session saved');
    }

    // ═══════════════════════════════════════════════════════════════
    // REDIRECT
    // ═══════════════════════════════════════════════════════════════

    function redirectToDashboard() {
        window.location.href = 'dashboard.html';
    }

    // ═══════════════════════════════════════════════════════════════
    // MAIN SUBMIT
    // ═══════════════════════════════════════════════════════════════

    function handleSubmit(e) {

        e.preventDefault();
        e.stopPropagation();

        hideError();

        const email =
            ($('email')?.value || '').trim();

        const password =
            $('password')?.value || '';

        const name =
            ($('name')?.value || '').trim();

        const universityName =
            ($('universityName')?.value || '').trim();

        const cafeteriaName =
            ($('cafeteriaName')?.value || '').trim();

        // ═══════════════════════════════════════════════════════════
        // VALIDATION
        // ═══════════════════════════════════════════════════════════

        if (!email || !password) {
            showError(
                'Email and password are required'
            );
            return;
        }

        if (password.length < 6) {
            showError(
                'Password must be at least 6 characters'
            );
            return;
        }

        if (mode === 'register' && !name) {
            showError(
                'Please enter your full name'
            );
            return;
        }

        // ═══════════════════════════════════════════════════════════
        // FIREBASE CHECK
        // ═══════════════════════════════════════════════════════════

        if (
            typeof firebase === 'undefined' ||
            !firebase.auth
        ) {
            showError(
                'Firebase is not loaded. Please refresh the page.'
            );
            return;
        }

        setLoading(true);

        (async () => {

            try {

                let userCredential;

                // ═══════════════════════════════════════════════════
                // REGISTER
                // ═══════════════════════════════════════════════════

                if (mode === 'register') {

                    userCredential =
                        await firebase
                            .auth()
                            .createUserWithEmailAndPassword(
                                email,
                                password
                            );

                    const firebaseUser =
                        userCredential.user;

                    if (name) {

                        await firebaseUser.updateProfile({
                            displayName: name
                        });

                    }

                }

                // ═══════════════════════════════════════════════════
                // LOGIN
                // ═══════════════════════════════════════════════════

                else {

                    userCredential =
                        await firebase
                            .auth()
                            .signInWithEmailAndPassword(
                                email,
                                password
                            );
                }

                const firebaseUser =
                    userCredential.user;

                console.log(
                    '✅ Firebase authentication successful'
                );

                console.log(
                    'Firebase UID:',
                    firebaseUser.uid
                );

                // ═══════════════════════════════════════════════════
                // FORCE FRESH TOKEN
                // ═══════════════════════════════════════════════════

                const idToken =
                    await getFreshFirebaseToken(
                        firebaseUser
                    );

                // ═══════════════════════════════════════════════════
                // BACKEND PAYLOAD
                // ═══════════════════════════════════════════════════

                const syncPayload = {
                    name:
                        name ||
                        firebaseUser.displayName ||
                        undefined
                };

                if (mode === 'register') {

                    if (universityName) {
                        syncPayload.universityName =
                            universityName;
                    }

                    if (cafeteriaName) {
                        syncPayload.cafeteriaName =
                            cafeteriaName;
                    }
                }

                // ═══════════════════════════════════════════════════
                // BACKEND SYNC
                // ═══════════════════════════════════════════════════

                let syncData;

                try {

                    syncData =
                        await syncWithBackend(
                            idToken,
                            syncPayload
                        );

                } catch (syncErr) {

                    console.error(
                        '❌ BACKEND SYNC ERROR:',
                        syncErr
                    );

                    throw new Error(
                        `Backend sync failed (${syncErr.status || 'unknown'}): ${
                            syncErr.message ||
                            'Unknown backend error'
                        }`
                    );
                }

                // ═══════════════════════════════════════════════════
                // SAVE SESSION
                // ═══════════════════════════════════════════════════

                saveSession(
                    idToken,
                    syncData.data
                );

                console.log(
                    '✅ Login complete'
                );

                // ═══════════════════════════════════════════════════
                // DASHBOARD
                // ═══════════════════════════════════════════════════

                redirectToDashboard();

            } catch (err) {

                console.error(
                    '❌ AUTH ERROR:',
                    err
                );

                let msg =
                    err.message ||
                    'Authentication failed';

                // ═══════════════════════════════════════════════════
                // FIREBASE ERRORS
                // ═══════════════════════════════════════════════════

                if (
                    msg.includes(
                        'email-already-in-use'
                    )
                ) {

                    msg =
                        'This email is already registered. Try signing in instead.';

                } else if (
                    msg.includes(
                        'wrong-password'
                    ) ||
                    msg.includes(
                        'invalid-credential'
                    ) ||
                    msg.includes(
                        'INVALID_LOGIN_CREDENTIALS'
                    )
                ) {

                    msg =
                        'Incorrect email or password';

                } else if (
                    msg.includes(
                        'user-not-found'
                    )
                ) {

                    msg =
                        'No account found with this email. Create one instead?';

                } else if (
                    msg.includes(
                        'weak-password'
                    )
                ) {

                    msg =
                        'Password is too weak. Use at least 6 characters.';

                } else if (
                    msg.includes(
                        'invalid-email'
                    )
                ) {

                    msg =
                        'Please enter a valid email address';

                } else if (
                    msg.includes(
                        'network-request-failed'
                    )
                ) {

                    msg =
                        'Network error. Check your internet connection.';

                } else if (
                    msg.includes(
                        'api-key-not-valid'
                    ) ||
                    msg.includes(
                        'invalid-api-key'
                    )
                ) {

                    msg =
                        'Firebase config is missing or invalid.';

                } else if (
                    msg.includes(
                        'operation-not-allowed'
                    )
                ) {

                    msg =
                        'Email/Password sign-in is not enabled in Firebase Console.';

                } else if (
                    msg.includes(
                        'too-many-requests'
                    )
                ) {

                    msg =
                        'Too many attempts. Wait a moment and try again.';
                }

                // ═══════════════════════════════════════════════════
                // SHOW ACTUAL ERROR
                // ═══════════════════════════════════════════════════

                showError(msg);

                setLoading(false);
            }

        })();
    }

    // ═══════════════════════════════════════════════════════════════
    // GOOGLE
    // ═══════════════════════════════════════════════════════════════

    window.handleGoogleSignIn = async function () {

        hideError();

        if (
            typeof firebase === 'undefined' ||
            !firebase.auth
        ) {
            showError(
                'Firebase is not loaded. Please refresh the page.'
            );
            return;
        }

        try {

            const provider =
                new firebase.auth.GoogleAuthProvider();

            const result =
                await firebase
                    .auth()
                    .signInWithPopup(provider);

            const firebaseUser =
                result.user;

            const idToken =
                await getFreshFirebaseToken(
                    firebaseUser
                );

            const syncData =
                await syncWithBackend(
                    idToken,
                    {
                        name:
                            firebaseUser.displayName
                    }
                );

            saveSession(
                idToken,
                syncData.data
            );

            redirectToDashboard();

        } catch (err) {

            if (
                err.code ===
                'auth/popup-closed-by-user'
            ) {
                return;
            }

            console.error(
                'Google sign-in error:',
                err
            );

            showError(
                err.message ||
                'Google sign-in failed'
            );
        }
    };

    // ═══════════════════════════════════════════════════════════════
    // APPLE
    // ═══════════════════════════════════════════════════════════════

    window.handleAppleSignIn = async function () {

        hideError();

        if (
            typeof firebase === 'undefined' ||
            !firebase.auth
        ) {
            showError(
                'Firebase is not loaded. Please refresh the page.'
            );
            return;
        }

        try {

            const provider =
                new firebase.auth.OAuthProvider(
                    'apple.com'
                );

            const result =
                await firebase
                    .auth()
                    .signInWithPopup(provider);

            const firebaseUser =
                result.user;

            const idToken =
                await getFreshFirebaseToken(
                    firebaseUser
                );

            const syncData =
                await syncWithBackend(
                    idToken,
                    {
                        name:
                            firebaseUser.displayName
                    }
                );

            saveSession(
                idToken,
                syncData.data
            );

            redirectToDashboard();

        } catch (err) {

            if (
                err.code ===
                'auth/popup-closed-by-user'
            ) {
                return;
            }

            console.error(
                'Apple sign-in error:',
                err
            );

            showError(
                err.message ||
                'Apple sign-in failed'
            );
        }
    };

    // ═══════════════════════════════════════════════════════════════
    // INIT
    // ═══════════════════════════════════════════════════════════════

    function init() {

        const form = $('authForm');

        if (form) {

            form.addEventListener(
                'submit',
                handleSubmit
            );

        } else {

            console.error(
                '❌ authForm not found in DOM'
            );
        }

        if (location.hash === '#register') {
            window.switchAuthMode('register');
        }

        /*
         * Do NOT automatically redirect when a token exists.
         *
         * This prevents an old/invalid token from creating:
         *
         * login → dashboard → 403 → login → dashboard
         */

        console.log(
            '✅ CafeCash auth.js loaded'
        );
    }

    // ═══════════════════════════════════════════════════════════════
    // START
    // ═══════════════════════════════════════════════════════════════

    if (
        document.readyState === 'loading'
    ) {

        document.addEventListener(
            'DOMContentLoaded',
            init
        );

    } else {

        init();
    }

})();
