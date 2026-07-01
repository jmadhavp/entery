// ==========================================
// FIREBASE SERVICE CONFIGURATION INITIALIZATION
// ==========================================
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase Instance Safely
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// Application Data State Memory
let localState = {
    activeTab: 'dashboard',
    products: [],
    sales: [],
    expenses: []
};

// ==========================================
// CORE PASSCODE REQUIREMENT CONTROLLER
// ==========================================
/**
 * Wraps critical write mutations. Checks if session validation exists.
 * If not verified, requests authentication via Firebase configuration document.
 */
function runWithSecurityGate(securedCallbackAction) {
    // Session persistent clearance condition validation check
    if (sessionStorage.getItem('session_passcode_verified') === 'true') {
        securedCallbackAction();
        return;
    }

    const modal = document.getElementById('passcode-modal');
    const input = document.getElementById('passcode-input');
    const errorEl = document.getElementById('passcode-error');
    const submitBtn = document.getElementById('passcode-submit');
    const cancelBtn = document.getElementById('passcode-cancel');

    // UI State Reveal Execution
    modal.classList.remove('hidden');
    input.value = '';
    errorEl.textContent = '';
    input.focus();

    // Context Processing Isolation Functions
    const detachListeners = () => {
        submitBtn.removeEventListener('click', evaluatePasscodeSubmission);
        cancelBtn.removeEventListener('click', closeGate);
        input.removeEventListener('keypress', handleKeypressInput);
    };

    const closeGate = () => {
        modal.classList.add('hidden');
        detachListeners();
    };

    const handleKeypressInput = (e) => {
        if (e.key === 'Enter') evaluatePasscodeSubmission();
    };

    async function evaluatePasscodeSubmission() {
        const structuralMatch = /^\d{4}$/.test(input.value);
        if (!structuralMatch) {
            errorEl.textContent = "Passcode structural input must be exactly 4 digits.";
            return;
        }

        try {
            // Document verification matching pull directly from remote storage setting paths
            const docRef = await db.collection('settings').doc('security').get();
            let MasterPasscode = "1234"; // Standby code configuration fallback initialization

            if (docRef.exists && docRef.data().passcode) {
                MasterPasscode = docRef.data().passcode;
            } else {
                // Initialize default path securely within target collection instance
                await db.collection('settings').doc('security').set({ passcode: "1234" });
            }

            if (input.value === MasterPasscode.toString()) {
                sessionStorage.setItem('session_passcode_verified', 'true');
                updateLockBadgeState();
                modal.classList.add('hidden');
                detachListeners();
                securedCallbackAction(); // Resume user transaction process flow execution
            } else {
                errorEl.textContent = "Invalid entry clearance matching assignment failed.";
                input.value = '';
                input.focus();
            }
        } catch (err) {
            errorEl.textContent = "Network response failed connection setup: " + err.message;
        }
    }

    // Bind Activation Event Catchers
    submitBtn.addEventListener('click', evaluatePasscodeSubmission);
    cancelBtn.addEventListener('click', closeGate);
    input.addEventListener('keypress', handleKeypressInput);
}

function updateLockBadgeState() {
    const badge = document.getElementById('session-badge');
    if (sessionStorage.getItem('session_passcode_verified') === 'true') {
        badge.textContent = "🔓 Session Unlocked";
        badge.className = "session-status unlocked";
    } else {
        badge.textContent = "🔒 Session Locked";
        badge.className = "session-status";
    }
}

// ==========================================
// SYSTEM SUBSCRIPTION DATA READS (NO PASSCODE RUNS)
// ==========================================
function startDatabaseListeners() {
    // Unrestricted realtime stream monitoring of statements
    db.collection('products').orderBy('name').onSnapshot(snapshot => {
        localState.products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (['dashboard', 'inventory', 'sales'].includes(localState.activeTab)) renderCurrentView();
    });

    db.collection('sales').orderBy('timestamp', 'desc').onSnapshot(snapshot => {
        localState.sales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (['dashboard', 'sales'].includes(localState.activeTab)) renderCurrentView();
    });

    db.collection('expenses').orderBy('timestamp', 'desc').onSnapshot(snapshot => {
        localState.expenses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (['dashboard', 'expenses'].includes(localState.activeTab)) renderCurrentView();
    });
}

// ==========================================
// INTERACTIVE NAVIGATION ENGINE
// ==========================================
function switchTab(targetTabId) {
    localState.activeTab = targetTabId;
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    
    // Manage dynamic headers
    const headers = {
        dashboard: "Dashboard & Statements Ledger",
        inventory: "Inventory Management & Products Portfolio",
        sales: "Sales Processing Unit",
        expenses: "Expense Ledger Tracking",
        settings: "Global Configuration Utility Profile"
    };
    document.getElementById('page-title').textContent = headers[targetTabId] || "Management Console";
    
    // Track active context style layouts
    event?.target.classList.add('active');
    renderCurrentView();
}

function renderCurrentView() {
    const stage = document.getElementById('content-area');
    updateLockBadgeState();

    switch (localState.activeTab) {
        case 'dashboard':
            let grossSales = localState.sales.reduce((acc, curr) => acc + (Number(curr.totalPrice) || 0), 0);
            let operationalExpenses = localState.expenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
            let balanceYield = grossSales - operationalExpenses;

            stage.innerHTML = `
                <div class="metrics-grid">
                    <div class="card"><h3>Gross Transaction Statement</h3><div class="value" style="color:var(--success)">$${grossSales.toFixed(2)}</div></div>
                    <div class="card"><h3>Debited Expenses Cumulative</h3><div class="value" style="color:var(--danger)">$${operationalExpenses.toFixed(2)}</div></div>
                    <div class="card"><h3>Net Statement Position</h3><div class="value" style="color:var(--primary)">$${balanceYield.toFixed(2)}</div></div>
                </div>
                <div class="card">
                    <h2 style="margin-bottom:1rem">Recent Activity Ledger Logs</h2>
                    <div class="table-container">
                        <table>
                            <thead><tr><th>Date Logs</th><th>Category Context</th><th>Description Mapping</th><th>Financial Delta</th></tr></thead>
                            <tbody>
                                ${localState.sales.slice(0, 5).map(s => `<tr><td>${new Date(s.timestamp).toLocaleDateString()}</td><td>Sales Income</td><td>Item Unit ID: ${s.productName} (x${s.qty})</td><td style="color:var(--success)">+$${Number(s.totalPrice).toFixed(2)}</td></tr>`).join('')}
                                ${localState.expenses.slice(0, 5).map(e => `<tr><td>${new Date(e.timestamp).toLocaleDateString()}</td><td>Operational Cost</td><td>${e.note}</td><td style="color:var(--danger)">-$${Number(e.amount).toFixed(2)}</td></tr>`).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>`;
            break;

        case 'inventory':
            stage.innerHTML = `
                <div class="split-view">
                    <div class="card">
                        <h2 style="margin-bottom:1rem">Add Product</h2>
                        <form id="prod-form" onsubmit="executeProductCreation(event)">
                            <div class="form-group"><label>Product / Item Title Label</label><input type="text" id="p-name" required></div>
                            <div class="form-group"><label>Asset Storage Volume (SKU Code)</label><input type="text" id="p-sku" required></div>
                            <div class="form-group"><label>Base Value Assignment Valuation ($)</label><input type="number" step="0.01" id="p-price" required></div>
                            <button type="submit" class="btn-primary">Register Asset Record</button>
                        </form>
                    </div>
                    <div class="card">
                        <h2 style="margin-bottom:1rem">Current Catalog Statement</h2>
                        <div class="table-container">
                            <table>
                                <thead><tr><th>Product Name</th><th>SKU Identity</th><th>Assigned Pricing</th></tr></thead>
                                <tbody>
                                    ${localState.products.map(p => `<tr><td><b>${p.name}</b></td><td>${p.sku}</td><td>$${Number(p.price).toFixed(2)}</td></tr>`).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>`;
            break;

        case 'sales':
            stage.innerHTML = `
                <div class="split-view">
                    <div class="card">
                        <h2 style="margin-bottom:1rem">Post Sales Order Entry</h2>
                        <form id="sale-form" onsubmit="executeSaleProcessing(event)">
                            <div class="form-group">
                                <label>Target Inventory Select</label>
                                <select id="s-prod" required>
                                    <option value="">Select Resource Asset</option>
                                    ${localState.products.map(p => `<option value="${p.id}" data-name="${p.name}" data-price="${p.price}">${p.name} [Pricing: $${p.price}]</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group"><label>Quantity Demanded Volumetric</label><input type="number" id="s-qty" min="1" required></div>
                            <button type="submit" class="btn-primary">Finalize Order Matrix</button>
                        </form>
                    </div>
                    <div class="card">
                        <h2 style="margin-bottom:1rem">Historical Order Processing Log Statements</h2>
                        <div class="table-container">
                            <table>
                                <thead><tr><th>Timestamp</th><th>Description</th><th>Qty</th><th>Aggregate ($)</th></tr></thead>
                                <tbody>
                                    ${localState.sales.map(s => `<tr><td>${new Date(s.timestamp).toLocaleDateString()}</td><td>${s.productName}</td><td>${s.qty}</td><td>$${Number(s.totalPrice).toFixed(2)}</td></tr>`).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>`;
            break;

        case 'expenses':
            stage.innerHTML = `
                <div class="split-view">
                    <div class="card">
                        <h2 style="margin-bottom:1rem">Log New Operational Expense</h2>
                        <form id="exp-form" onsubmit="executeExpenseCreation(event)">
                            <div class="form-group"><label>Expense Target/Note Description</label><input type="text" id="e-note" placeholder="Office lease, cloud resources..." required></div>
                            <div class="form-group"><label>Financial Volume Capital Amount ($)</label><input type="number" step="0.01" id="e-amount" required></div>
                            <button type="submit" class="btn-primary">Commit Capital Writeoff</button>
                        </form>
                    </div>
                    <div class="card">
                        <h2 style="margin-bottom:1rem">Expense Statement Audit Trail</h2>
                        <div class="table-container">
                            <table>
                                <thead><tr><th>Processing Date</th><th>Context Notes</th><th>Amount Total</th></tr></thead>
                                <tbody>
                                    ${localState.expenses.map(e => `<tr><td>${new Date(e.timestamp).toLocaleDateString()}</td><td>${e.note}</td><td style="color:var(--danger)">$${Number(e.amount).toFixed(2)}</td></tr>`).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>`;
            break;

        case 'settings':
            stage.innerHTML = `
                <div class="card" style="max-width: 500px; margin: 0 auto;">
                    <h2 style="margin-bottom: 1.5rem;">Security Configuration Settings</h2>
                    <div class="form-group" style="background: var(--bg-main); padding: 1rem; border-radius: 8px; border: 1px solid var(--border)">
                        <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:1rem;">
                            Modifying the operational security passcode updates the access requirement across all shared terminals accessing this Firebase ledger pipeline instancing.
                        </p>
                        <label>Define Replacement 4-Digit PIN</label>
                        <input type="password" id="new-pin-input" maxlength="4" placeholder="••••" style="letter-spacing:0.5rem; font-size:1.25rem; width:160px; text-align:center; display:block; margin-bottom:1rem;">
                        <button type="button" class="btn-primary" onclick="executePasscodeChange()" style="width:auto;">Update Cloud Security Token</button>
                    </div>
                </div>`;
            break;
    }
}

// ==========================================
// SECURED DATA WRITE TRANSACTIONS (PROTECTED BY GATEWAY)
// ==========================================
function executeProductCreation(e) {
    e.preventDefault();
    const payloadData = {
        name: document.getElementById('p-name').value,
        sku: document.getElementById('p-sku').value,
        price: parseFloat(document.getElementById('p-price').value)
    };

    // Require passcode protection verification sequence loop
    runWithSecurityGate(async () => {
        try {
            await db.collection('products').add(payloadData);
            document.getElementById('prod-form').reset();
        } catch (err) {
            alert("Database tracking structure error commitment fault: " + err.message);
        }
    });
}

function executeSaleProcessing(e) {
    e.preventDefault();
    const pointerSelector = document.getElementById('s-prod');
    const selectedOptionInstance = pointerSelector.options[pointerSelector.selectedIndex];
    
    if(!pointerSelector.value) return;

    const payloadData = {
        productId: pointerSelector.value,
        productName: selectedOptionInstance.getAttribute('data-name'),
        qty: parseInt(document.getElementById('s-qty').value),
        totalPrice: parseFloat(selectedOptionInstance.getAttribute('data-price')) * parseInt(document.getElementById('s-qty').value),
        timestamp: new Date().toISOString()
    };

    runWithSecurityGate(async () => {
        try {
            await db.collection('sales').add(payloadData);
            document.getElementById('sale-form').reset();
        } catch (err) {
            alert("Order transaction generation error fallback: " + err.message);
        }
    });
}

function executeExpenseCreation(e) {
    e.preventDefault();
    const payloadData = {
        note: document.getElementById('e-note').value,
        amount: parseFloat(document.getElementById('e-amount').value),
        timestamp: new Date().toISOString()
    };

    runWithSecurityGate(async () => {
        try {
            await db.collection('expenses').add(payloadData);
            document.getElementById('exp-form').reset();
        } catch (err) {
            alert("Expense registration data rejection error: " + err.message);
        }
    });
}

function executePasscodeChange() {
    const rawPinInput = document.getElementById('new-pin-input').value;
    if(!/^\d{4}$/.test(rawPinInput)) {
        alert("Configuration constraint validation failure: Passcode must be exactly 4 digits.");
        return;
    }

    runWithSecurityGate(async () => {
        try {
            await db.collection('settings').doc('security').set({ passcode: rawPinInput.toString() });
            alert("Security clearance parameter token rewrite operation completed successfully on Firebase cloud storage.");
            document.getElementById('new-pin-input').value = '';
        } catch (err) {
            alert("Security modification transaction failed deployment: " + err.message);
        }
    });
}

// ==========================================
// THREAD LIFE-CYCLE STARTUP ROUTINE
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    startDatabaseListeners();
    switchTab('dashboard');
});