const firebaseConfig = {
    apiKey: "AIzaSyASSH_a0qetl-wT5fvSC6vQk-T3mibPf54",
    authDomain: "entery-d6888.firebaseapp.com",
    projectId: "entery-d6888",
    storageBucket: "entery-d6888.firebasestorage.app",
    messagingSenderId: "164060710775",
    appId: "1:164060710775:web:d4bffc1c8f404e57180372",
    measurementId: "G-KG13TVN75X"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

const COLLECTIONS = {
    sales: 'sales',
    purchases: 'purchases',
    inventory: 'inventory',
    customers: 'customers',
    suppliers: 'suppliers',
    expenses: 'expenses',
    users: 'users',
    settings: 'settings',
    deleted: 'deleted_items'
};

const NAV_ITEMS = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'products', label: 'Products', icon: '📋' },
    { id: 'purchases', label: 'Purchase', icon: '🛒' },
    { id: 'sales', label: 'Sales', icon: '💰' }
];

let currentUser = null;
let currentPage = 'dashboard';
let deletedItems = [];
let isOffline = !navigator.onLine;
let pendingSync = JSON.parse(localStorage.getItem('pendingSync') || '[]');

document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
    initTheme();
    initAuth();
    initLoginForm();
    initOfflineDetection();
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const toggleBtn = document.getElementById('theme-toggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', toggleTheme);
    }
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
}

function initNavigation() {
    const navMenu = document.getElementById('nav-menu');
    navMenu.innerHTML = NAV_ITEMS.map(item => `
        <li>
            <a href="#" data-page="${item.id}" class="${item.id === currentPage ? 'active' : ''}">
                ${item.icon} ${item.label}
            </a>
        </li>
    `).join('');
    navMenu.addEventListener('click', (e) => {
        if (e.target.tagName === 'A') {
            e.preventDefault();
            currentPage = e.target.dataset.page;
            document.querySelectorAll('#nav-menu a').forEach(a => a.classList.remove('active'));
            e.target.classList.add('active');
            renderPage();
        }
    });
}

function initAuth() {
    const authContainer = document.getElementById('auth-container');
    auth.onAuthStateChanged(user => {
        currentUser = user;
        if (user) {
            document.getElementById('login-screen').classList.add('hidden');
            document.getElementById('app').classList.remove('hidden');
            initNavigation();
            renderPage();
            authContainer.innerHTML = `
                <span>Hello, ${user.email}</span>
                <button class="secondary btn-sm" onclick="logout()">Logout</button>
            `;
        } else {
            document.getElementById('login-screen').classList.remove('hidden');
            document.getElementById('app').classList.add('hidden');
        }
    });
}

function initLoginForm() {
    const form = document.getElementById('login-form');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const errorDiv = document.getElementById('login-error');
        
        auth.signInWithEmailAndPassword(email, password)
            .catch(err => {
                errorDiv.textContent = 'Login failed: ' + err.message;
            });
    });
}

function logout() {
    auth.signOut();
}

function initOfflineDetection() {
    window.addEventListener('online', () => {
        isOffline = false;
        syncPendingItems();
    });
    window.addEventListener('offline', () => {
        isOffline = true;
    });
}

function renderPage() {
    const content = document.getElementById('content');
    const renderFn = {
        dashboard: renderDashboard,
        products: renderInventory,
        purchases: renderPurchases,
        sales: renderSales,
        customers: renderCustomers,
        suppliers: renderSuppliers,
        expenses: renderExpenses,
        reports: renderReports,
        settings: renderSettings
    }[currentPage];
    if (renderFn) renderFn(content);
}

async function renderDashboard(container) {
    const [sales, purchases, expenses, inventory] = await Promise.all([
        getCollection('sales'),
        getCollection('purchases'),
        getCollection('expenses'),
        getCollection('inventory')
    ]);
    const totalSales = sales.reduce((sum, s) => sum + (s.total || 0), 0);
    const totalPurchases = purchases.reduce((sum, p) => sum + (p.total || 0), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const profit = totalSales - totalPurchases - totalExpenses;
    const lowStock = inventory.filter(i => (i.quantity || 0) < 10);
    container.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <h3>Total Sales</h3>
                <p>₹${totalSales.toFixed(2)}</p>
            </div>
            <div class="stat-card">
                <h3>Total Purchases</h3>
                <p>₹${totalPurchases.toFixed(2)}</p>
            </div>
            <div class="stat-card">
                <h3>Total Expenses</h3>
                <p>₹${totalExpenses.toFixed(2)}</p>
            </div>
            <div class="stat-card">
                <h3>Net Profit</h3>
                <p style="color: ${profit >= 0 ? 'var(--success)' : 'var(--danger)'}">₹${profit.toFixed(2)}</p>
            </div>
        </div>
        <div class="card">
            <h2>Low Stock Items</h2>
            ${lowStock.length ? `
                <table>
                    <thead><tr><th>Product</th><th>Quantity</th></tr></thead>
                    <tbody>${lowStock.map(i => `<tr><td>${i.name}</td><td>${i.quantity}</td></tr>`).join('')}</tbody>
                </table>
            ` : '<p>No low stock items</p>'}
        </div>
    `;
}

async function renderSales(container) {
    const sales = await getCollection('sales');
    const customers = await getCollection('customers');
    const inventory = await getCollection('inventory');
    container.innerHTML = `
        <div class="card">
            <h2>Add Sale</h2>
            <form id="sale-form">
                <div class="form-group">
                    <label>Customer</label>
                    <select id="sale-customer">
                        <option value="">Select Customer</option>
                        ${customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Product</label>
                    <select id="sale-product">
                        <option value="">Select Product</option>
                        ${inventory.map(i => `<option value="${i.id}">${i.name} (${i.quantity} in stock)</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Quantity</label>
                    <input type="number" id="sale-qty" min="1" required>
                </div>
                <div class="form-group">
                    <label>Unit Price</label>
                    <input type="number" id="sale-price" step="0.01" required>
                </div>
                <button type="submit">Add Sale</button>
            </form>
        </div>
        <div class="card">
            <h2>Sales History</h2>
            <div class="search-bar">
                <input type="text" id="sales-search" placeholder="Search sales...">
                <button class="secondary" onclick="exportCSV('sales')">Export CSV</button>
            </div>
            <div id="sales-list"></div>
        </div>
    `;
    document.getElementById('sale-form').addEventListener('submit', handleSaleSubmit);
    document.getElementById('sales-search').addEventListener('input', (e) => renderSalesList(sales, e.target.value));
    renderSalesList(sales);
}

async function handleSaleSubmit(e) {
    e.preventDefault();
    const customerId = document.getElementById('sale-customer').value;
    const productId = document.getElementById('sale-product').value;
    const qty = parseInt(document.getElementById('sale-qty').value);
    const price = parseFloat(document.getElementById('sale-price').value);
    const total = qty * price;
    const sale = {
        customerId, productId, quantity: qty, unitPrice: price, total,
        date: new Date().toISOString(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await addDocument('sales', sale);
    const product = await getDocument('inventory', productId);
    if (product) {
        await updateDocument('inventory', productId, { quantity: product.quantity - qty });
    }
    renderSales(document.getElementById('content'));
}

async function renderSalesList(sales, search = '') {
    const customers = await getCollection('customers');
    const customerMap = Object.fromEntries(customers.map(c => [c.id, c.name]));
    const filtered = sales.filter(s => 
        !search || (customerMap[s.customerId] || '').toLowerCase().includes(search.toLowerCase())
    );
    document.getElementById('sales-list').innerHTML = `
        <table>
            <thead>
                <tr><th>Date</th><th>Customer</th><th>Total</th><th>Actions</th></tr>
            </thead>
            <tbody>
                ${filtered.map(s => `
                    <tr>
                        <td>${new Date(s.date).toLocaleDateString()}</td>
                        <td>${customerMap[s.customerId] || 'Unknown'}</td>
                        <td>₹${s.total.toFixed(2)}</td>
                        <td class="actions">
                            <button class="btn-sm secondary" onclick="generateQR('sale', '${s.id}')">QR</button>
                            <button class="btn-sm btn-danger" onclick="deleteItem('sales', '${s.id}')">Delete</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

async function renderPurchases(container) {
    const purchases = await getCollection('purchases');
    const suppliers = await getCollection('suppliers');
    const inventory = await getCollection('inventory');
    container.innerHTML = `
        <div class="card">
            <h2>Add Purchase</h2>
            <form id="purchase-form">
                <div class="form-group">
                    <label>Supplier</label>
                    <select id="purchase-supplier">
                        <option value="">Select Supplier</option>
                        ${suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Product</label>
                    <select id="purchase-product">
                        <option value="">Select Product</option>
                        ${inventory.map(i => `<option value="${i.id}">${i.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Quantity</label>
                    <input type="number" id="purchase-qty" min="1" required>
                </div>
                <div class="form-group">
                    <label>Unit Cost</label>
                    <input type="number" id="purchase-cost" step="0.01" required>
                </div>
                <button type="submit">Add Purchase</button>
            </form>
        </div>
        <div class="card">
            <h2>Purchase History</h2>
            <div class="search-bar">
                <input type="text" id="purchases-search" placeholder="Search purchases...">
                <button class="secondary" onclick="exportCSV('purchases')">Export CSV</button>
            </div>
            <div id="purchases-list"></div>
        </div>
    `;
    document.getElementById('purchase-form').addEventListener('submit', handlePurchaseSubmit);
    document.getElementById('purchases-search').addEventListener('input', (e) => renderPurchasesList(purchases, e.target.value));
    renderPurchasesList(purchases);
}

async function handlePurchaseSubmit(e) {
    e.preventDefault();
    const supplierId = document.getElementById('purchase-supplier').value;
    const productId = document.getElementById('purchase-product').value;
    const qty = parseInt(document.getElementById('purchase-qty').value);
    const cost = parseFloat(document.getElementById('purchase-cost').value);
    const total = qty * cost;
    const purchase = {
        supplierId, productId, quantity: qty, unitCost: cost, total,
        date: new Date().toISOString(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await addDocument('purchases', purchase);
    const product = await getDocument('inventory', productId);
    if (product) {
        await updateDocument('inventory', productId, { quantity: product.quantity + qty });
    }
    renderPurchases(document.getElementById('content'));
}

async function renderPurchasesList(purchases, search = '') {
    const suppliers = await getCollection('suppliers');
    const supplierMap = Object.fromEntries(suppliers.map(s => [s.id, s.name]));
    const filtered = purchases.filter(p => 
        !search || (supplierMap[p.supplierId] || '').toLowerCase().includes(search.toLowerCase())
    );
    document.getElementById('purchases-list').innerHTML = `
        <table>
            <thead>
                <tr><th>Date</th><th>Supplier</th><th>Total</th><th>Actions</th></tr>
            </thead>
            <tbody>
                ${filtered.map(p => `
                    <tr>
                        <td>${new Date(p.date).toLocaleDateString()}</td>
                        <td>${supplierMap[p.supplierId] || 'Unknown'}</td>
                        <td>₹${p.total.toFixed(2)}</td>
                        <td class="actions">
                            <button class="btn-sm btn-danger" onclick="deleteItem('purchases', '${p.id}')">Delete</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

async function renderInventory(container) {
    const inventory = await getCollection('inventory');
    container.innerHTML = `
        <div class="card">
            <h2>Add Product</h2>
            <form id="inventory-form">
                <div class="form-group">
                    <label>Product Name</label>
                    <input type="text" id="inv-name" required>
                </div>
                <div class="form-group">
                    <label>SKU</label>
                    <input type="text" id="inv-sku">
                </div>
                <div class="form-group">
                    <label>Quantity</label>
                    <input type="number" id="inv-qty" min="0" required>
                </div>
                <div class="form-group">
                    <label>Cost Price</label>
                    <input type="number" id="inv-cost" step="0.01" required>
                </div>
                <div class="form-group">
                    <label>Selling Price</label>
                    <input type="number" id="inv-price" step="0.01" required>
                </div>
                <button type="submit">Add Product</button>
            </form>
        </div>
        <div class="card">
            <h2>Inventory</h2>
            <div class="search-bar">
                <input type="text" id="inventory-search" placeholder="Search products...">
                <button class="secondary" onclick="exportCSV('inventory')">Export CSV</button>
            </div>
            <div id="inventory-list"></div>
        </div>
    `;
    document.getElementById('inventory-form').addEventListener('submit', handleInventorySubmit);
    document.getElementById('inventory-search').addEventListener('input', (e) => renderInventoryList(inventory, e.target.value));
    renderInventoryList(inventory);
}

async function handleInventorySubmit(e) {
    e.preventDefault();
    const product = {
        name: document.getElementById('inv-name').value,
        sku: document.getElementById('inv-sku').value,
        quantity: parseInt(document.getElementById('inv-qty').value),
        costPrice: parseFloat(document.getElementById('inv-cost').value),
        sellingPrice: parseFloat(document.getElementById('inv-price').value),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await addDocument('inventory', product);
    renderInventory(document.getElementById('content'));
}

async function renderInventoryList(inventory, search = '') {
    const filtered = inventory.filter(i => 
        !search || i.name.toLowerCase().includes(search.toLowerCase()) || (i.sku || '').toLowerCase().includes(search.toLowerCase())
    );
    document.getElementById('inventory-list').innerHTML = `
        <table>
            <thead>
                <tr><th>Name</th><th>SKU</th><th>Quantity</th><th>Cost</th><th>Price</th><th>Actions</th></tr>
            </thead>
            <tbody>
                ${filtered.map(i => `
                    <tr>
                        <td>${i.name}</td>
                        <td>${i.sku || '-'}</td>
                        <td style="color: ${i.quantity < 10 ? 'var(--danger)' : 'var(--success)'}">${i.quantity}</td>
                        <td>₹${i.costPrice.toFixed(2)}</td>
                        <td>₹${i.sellingPrice.toFixed(2)}</td>
                        <td class="actions">
                            <button class="btn-sm btn-danger" onclick="deleteItem('inventory', '${i.id}')">Delete</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

async function renderCustomers(container) {
    const customers = await getCollection('customers');
    container.innerHTML = `
        <div class="card">
            <h2>Add Customer</h2>
            <form id="customer-form">
                <div class="form-group">
                    <label>Name</label>
                    <input type="text" id="cust-name" required>
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="cust-email">
                </div>
                <div class="form-group">
                    <label>Phone</label>
                    <input type="tel" id="cust-phone">
                </div>
                <div class="form-group">
                    <label>Address</label>
                    <textarea id="cust-address"></textarea>
                </div>
                <button type="submit">Add Customer</button>
            </form>
        </div>
        <div class="card">
            <h2>Customers</h2>
            <div class="search-bar">
                <input type="text" id="customers-search" placeholder="Search customers...">
                <button class="secondary" onclick="exportCSV('customers')">Export CSV</button>
            </div>
            <div id="customers-list"></div>
        </div>
    `;
    document.getElementById('customer-form').addEventListener('submit', handleCustomerSubmit);
    document.getElementById('customers-search').addEventListener('input', (e) => renderCustomersList(customers, e.target.value));
    renderCustomersList(customers);
}

async function handleCustomerSubmit(e) {
    e.preventDefault();
    const customer = {
        name: document.getElementById('cust-name').value,
        email: document.getElementById('cust-email').value,
        phone: document.getElementById('cust-phone').value,
        address: document.getElementById('cust-address').value,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await addDocument('customers', customer);
    renderCustomers(document.getElementById('content'));
}

async function renderCustomersList(customers, search = '') {
    const filtered = customers.filter(c => 
        !search || c.name.toLowerCase().includes(search.toLowerCase())
    );
    document.getElementById('customers-list').innerHTML = `
        <table>
            <thead>
                <tr><th>Name</th><th>Email</th><th>Phone</th><th>Actions</th></tr>
            </thead>
            <tbody>
                ${filtered.map(c => `
                    <tr>
                        <td>${c.name}</td>
                        <td>${c.email || '-'}</td>
                        <td>${c.phone || '-'}</td>
                        <td class="actions">
                            <button class="btn-sm btn-danger" onclick="deleteItem('customers', '${c.id}')">Delete</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

async function renderSuppliers(container) {
    const suppliers = await getCollection('suppliers');
    container.innerHTML = `
        <div class="card">
            <h2>Add Supplier</h2>
            <form id="supplier-form">
                <div class="form-group">
                    <label>Name</label>
                    <input type="text" id="sup-name" required>
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="sup-email">
                </div>
                <div class="form-group">
                    <label>Phone</label>
                    <input type="tel" id="sup-phone">
                </div>
                <div class="form-group">
                    <label>Address</label>
                    <textarea id="sup-address"></textarea>
                </div>
                <button type="submit">Add Supplier</button>
            </form>
        </div>
        <div class="card">
            <h2>Suppliers</h2>
            <div class="search-bar">
                <input type="text" id="suppliers-search" placeholder="Search suppliers...">
                <button class="secondary" onclick="exportCSV('suppliers')">Export CSV</button>
            </div>
            <div id="suppliers-list"></div>
        </div>
    `;
    document.getElementById('supplier-form').addEventListener('submit', handleSupplierSubmit);
    document.getElementById('suppliers-search').addEventListener('input', (e) => renderSuppliersList(suppliers, e.target.value));
    renderSuppliersList(suppliers);
}

async function handleSupplierSubmit(e) {
    e.preventDefault();
    const supplier = {
        name: document.getElementById('sup-name').value,
        email: document.getElementById('sup-email').value,
        phone: document.getElementById('sup-phone').value,
        address: document.getElementById('sup-address').value,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await addDocument('suppliers', supplier);
    renderSuppliers(document.getElementById('content'));
}

async function renderSuppliersList(suppliers, search = '') {
    const filtered = suppliers.filter(s => 
        !search || s.name.toLowerCase().includes(search.toLowerCase())
    );
    document.getElementById('suppliers-list').innerHTML = `
        <table>
            <thead>
                <tr><th>Name</th><th>Email</th><th>Phone</th><th>Actions</th></tr>
            </thead>
            <tbody>
                ${filtered.map(s => `
                    <tr>
                        <td>${s.name}</td>
                        <td>${s.email || '-'}</td>
                        <td>${s.phone || '-'}</td>
                        <td class="actions">
                            <button class="btn-sm btn-danger" onclick="deleteItem('suppliers', '${s.id}')">Delete</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

async function renderExpenses(container) {
    const expenses = await getCollection('expenses');
    container.innerHTML = `
        <div class="card">
            <h2>Add Expense</h2>
            <form id="expense-form">
                <div class="form-group">
                    <label>Category</label>
                    <input type="text" id="exp-cat" required>
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea id="exp-desc"></textarea>
                </div>
                <div class="form-group">
                    <label>Amount</label>
                    <input type="number" id="exp-amount" step="0.01" required>
                </div>
                <button type="submit">Add Expense</button>
            </form>
        </div>
        <div class="card">
            <h2>Expenses</h2>
            <div class="search-bar">
                <input type="text" id="expenses-search" placeholder="Search expenses...">
                <button class="secondary" onclick="exportCSV('expenses')">Export CSV</button>
            </div>
            <div id="expenses-list"></div>
        </div>
    `;
    document.getElementById('expense-form').addEventListener('submit', handleExpenseSubmit);
    document.getElementById('expenses-search').addEventListener('input', (e) => renderExpensesList(expenses, e.target.value));
    renderExpensesList(expenses);
}

async function handleExpenseSubmit(e) {
    e.preventDefault();
    const expense = {
        category: document.getElementById('exp-cat').value,
        description: document.getElementById('exp-desc').value,
        amount: parseFloat(document.getElementById('exp-amount').value),
        date: new Date().toISOString(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await addDocument('expenses', expense);
    renderExpenses(document.getElementById('content'));
}

async function renderExpensesList(expenses, search = '') {
    const filtered = expenses.filter(e => 
        !search || e.category.toLowerCase().includes(search.toLowerCase())
    );
    document.getElementById('expenses-list').innerHTML = `
        <table>
            <thead>
                <tr><th>Date</th><th>Category</th><th>Amount</th><th>Actions</th></tr>
            </thead>
            <tbody>
                ${filtered.map(e => `
                    <tr>
                        <td>${new Date(e.date).toLocaleDateString()}</td>
                        <td>${e.category}</td>
                        <td>₹${e.amount.toFixed(2)}</td>
                        <td class="actions">
                            <button class="btn-sm btn-danger" onclick="deleteItem('expenses', '${e.id}')">Delete</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

async function renderReports(container) {
    const sales = await getCollection('sales');
    const purchases = await getCollection('purchases');
    const expenses = await getCollection('expenses');
    container.innerHTML = `
        <div class="card">
            <h2>Profit Report</h2>
            <div class="stats-grid">
                <div class="stat-card">
                    <h3>Total Revenue</h3>
                    <p>₹${sales.reduce((sum, s) => sum + (s.total || 0), 0).toFixed(2)}</p>
                </div>
                <div class="stat-card">
                    <h3>Total COGS</h3>
                    <p>₹${purchases.reduce((sum, p) => sum + (p.total || 0), 0).toFixed(2)}</p>
                </div>
                <div class="stat-card">
                    <h3>Total Expenses</h3>
                    <p>₹${expenses.reduce((sum, e) => sum + (e.amount || 0), 0).toFixed(2)}</p>
                </div>
                <div class="stat-card">
                    <h3>Gross Profit</h3>
                    <p>₹${(sales.reduce((sum, s) => sum + (s.total || 0), 0) - purchases.reduce((sum, p) => sum + (p.total || 0), 0)).toFixed(2)}</p>
                </div>
                <div class="stat-card">
                    <h3>Net Profit</h3>
                    <p>₹${(sales.reduce((sum, s) => sum + (s.total || 0), 0) - purchases.reduce((sum, p) => sum + (p.total || 0), 0) - expenses.reduce((sum, e) => sum + (e.amount || 0), 0)).toFixed(2)}</p>
                </div>
            </div>
        </div>
        <div class="card">
            <h2>Export All Data</h2>
            <div class="actions">
                <button onclick="exportAllCSV()">Export All as CSV</button>
                <button onclick="syncToSheets()">Sync to Google Sheets</button>
            </div>
        </div>
    `;
}

function renderSettings(container) {
    container.innerHTML = `
        <div class="card">
            <h2>Settings</h2>
            <div class="form-group">
                <label>Theme</label>
                <select onchange="localStorage.setItem('theme', this.value); document.documentElement.setAttribute('data-theme', this.value)">
                    <option value="light" ${localStorage.getItem('theme') === 'light' ? 'selected' : ''}>Light</option>
                    <option value="dark" ${localStorage.getItem('theme') === 'dark' ? 'selected' : ''}>Dark</option>
                </select>
            </div>
            <div class="form-group">
                <label>Google Sheets Webhook URL (for backup)</label>
                <input type="text" id="sheets-url" placeholder="Enter webhook URL" value="${localStorage.getItem('sheetsUrl') || ''}">
                <button class="secondary" onclick="localStorage.setItem('sheetsUrl', document.getElementById('sheets-url').value)">Save</button>
            </div>
        </div>
    `;
}

async function getCollection(collection) {
    try {
        const snapshot = await db.collection(collection).orderBy('createdAt', 'desc').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
        console.error('Error getting collection:', err);
        return [];
    }
}

async function getDocument(collection, id) {
    try {
        const doc = await db.collection(collection).doc(id).get();
        return doc.exists ? { id: doc.id, ...doc.data() } : null;
    } catch (err) {
        console.error('Error getting document:', err);
        return null;
    }
}

async function addDocument(collection, data) {
    if (isOffline) {
        pendingSync.push({ collection, data, action: 'add' });
        localStorage.setItem('pendingSync', JSON.stringify(pendingSync));
        alert('Saved offline - will sync when online');
        return;
    }
    try {
        await db.collection(collection).add(data);
    } catch (err) {
        console.error('Error adding document:', err);
        alert('Error: ' + err.message);
    }
}

async function updateDocument(collection, id, data) {
    if (isOffline) {
        pendingSync.push({ collection, id, data, action: 'update' });
        localStorage.setItem('pendingSync', JSON.stringify(pendingSync));
        return;
    }
    try {
        await db.collection(collection).doc(id).update(data);
    } catch (err) {
        console.error('Error updating document:', err);
    }
}

async function deleteItem(collection, id) {
    const doc = await getDocument(collection, id);
    if (!doc) return;
    await db.collection(COLLECTIONS.deleted).add({
        collection,
        data: doc,
        deletedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await db.collection(collection).doc(id).delete();
    showUndoNotification(collection, id, doc);
    renderPage();
}

function showUndoNotification(collection, id, doc) {
    const notification = document.createElement('div');
    notification.className = 'undo-notification';
    notification.innerHTML = `
        <span>Item deleted</span>
        <div>
            <button class="btn-sm btn-success" onclick="undoDelete('${collection}', '${id}'); this.parentElement.parentElement.remove()">Undo</button>
            <button class="btn-sm secondary" onclick="this.parentElement.parentElement.remove()">Dismiss</button>
        </div>
    `;
    document.getElementById('content').insertBefore(notification, document.getElementById('content').firstChild);
    setTimeout(() => notification.remove(), 10000);
}

async function undoDelete(collection, id) {
    const deletedSnapshot = await db.collection(COLLECTIONS.deleted)
        .where('collection', '==', collection)
        .where('data.id', '==', id)
        .get();
    if (!deletedSnapshot.empty) {
        const deletedDoc = deletedSnapshot.docs[0];
        await db.collection(collection).doc(id).set(deletedDoc.data().data);
        await deletedDoc.ref.delete();
    }
    renderPage();
}

async function syncPendingItems() {
    const toSync = [...pendingSync];
    pendingSync = [];
    localStorage.setItem('pendingSync', '[]');
    for (const item of toSync) {
        try {
            if (item.action === 'add') {
                await db.collection(item.collection).add(item.data);
            } else if (item.action === 'update') {
                await db.collection(item.collection).doc(item.id).update(item.data);
            }
        } catch (err) {
            console.error('Sync error:', err);
            pendingSync.push(item);
            localStorage.setItem('pendingSync', JSON.stringify(pendingSync));
        }
    }
}

function exportCSV(collection) {
    getCollection(collection).then(data => {
        if (!data.length) return;
        const headers = Object.keys(data[0]).filter(k => k !== 'id' && k !== 'createdAt');
        const csv = [
            headers.join(','),
            ...data.map(row => headers.map(h => `"${(row[h] || '').toString().replace(/"/g, '""')}"`).join(','))
        ].join('\n');
        downloadFile(csv, `${collection}_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
    });
}

async function exportAllCSV() {
    const collections = ['sales', 'purchases', 'inventory', 'customers', 'suppliers', 'expenses'];
    for (const col of collections) {
        exportCSV(col);
    }
}

function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function generateQR(type, id) {
    const qrContainer = document.createElement('div');
    qrContainer.className = 'card qr-code';
    qrContainer.innerHTML = `
        <div>
            <h3>QR Code</h3>
            <div id="qr-canvas"></div>
            <button class="secondary" onclick="this.parentElement.parentElement.remove()">Close</button>
        </div>
    `;
    document.getElementById('content').insertBefore(qrContainer, document.getElementById('content').firstChild);
    QRCode.toCanvas(document.getElementById('qr-canvas'), `${type}:${id}`, { width: 200 }, (err) => {
        if (err) console.error(err);
    });
}

async function syncToSheets() {
    const sheetsUrl = localStorage.getItem('sheetsUrl');
    if (!sheetsUrl) {
        alert('Please set Google Sheets webhook URL in Settings first');
        return;
    }
    const [sales, purchases, expenses, inventory, customers, suppliers] = await Promise.all([
        getCollection('sales'),
        getCollection('purchases'),
        getCollection('expenses'),
        getCollection('inventory'),
        getCollection('customers'),
        getCollection('suppliers')
    ]);
    try {
        await fetch(sheetsUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                timestamp: new Date().toISOString(),
                sales, purchases, expenses, inventory, customers, suppliers
            })
        });
        alert('Synced to Google Sheets successfully!');
    } catch (err) {
        alert('Sync failed: ' + err.message);
    }
}
