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
    { id: 'sales', label: 'Sales', icon: '💰' },
    { id: 'purchases', label: 'Purchases', icon: '🛒' },
    { id: 'inventory', label: 'Inventory', icon: '📦' },
    { id: 'customers', label: 'Customers', icon: '👥' },
    { id: 'suppliers', label: 'Suppliers', icon: '🏪' },
    { id: 'expenses', label: 'Expenses', icon: '📉' },
    { id: 'reports', label: 'Reports', icon: '📈' },
    { id: 'settings', label: 'Settings', icon: '⚙️' }
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
    initPasscodeModal(); // Initialize passcode modal
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
    // Clear passcode verification on logout
    sessionStorage.removeItem('passcodeVerified');
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
        sales: renderSales,
        purchases: renderPurchases,
        inventory: renderInventory,
        customers: renderCustomers,
        suppliers: renderSuppliers,
        expenses: renderExpenses,
        reports: renderReports,
        settings: renderSettings
    }[currentPage];
    if (renderFn) renderFn(content);
}

async function renderDashboard(container) {
    const [sales, purchases, expenses, inventory, customers, suppliers] = await Promise.all([
        getCollection('sales'),
        getCollection('purchases'),
        getCollection('expenses'),
        getCollection('inventory'),
        getCollection('customers'),
        getCollection('suppliers')
    ]);
    const totalSales = sales.reduce((sum, s) => sum + (s.total || 0), 0);
    const totalPurchases = purchases.reduce((sum, p) => sum + (p.total || 0), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const profit = totalSales - totalPurchases - totalExpenses;
    
    const customerMap = Object.fromEntries(customers.map(c => [c.id, c.name]));
    const supplierMap = Object.fromEntries(suppliers.map(s => [s.id, s.name]));
    const inventoryMap = Object.fromEntries(inventory.map(i => [i.id, i.name]));
    
    const allTransactions = [
        ...sales.map(s => ({ type: 'sale', ...s })),
        ...purchases.map(p => ({ type: 'purchase', ...p })),
        ...expenses.map(e => ({ type: 'expense', ...e }))
    ].sort((a, b) => {
        const getDate = (item) => {
            if (item.date) return new Date(item.date);
            if (item.createdAt?.toDate) return item.createdAt.toDate();
            return new Date(item.createdAt);
        };
        return getDate(b) - getDate(a);
    });
    
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
            <h2>Recent Transactions</h2>
            ${allTransactions.length ? `
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Details</th>
                            <th>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${allTransactions.slice(0, 20).map(t => {
                            let details = '';
                            let amount = 0;
                            let typeColor = '';
                            let typeLabel = '';
                            if (t.type === 'sale') {
                                details = `${customerMap[t.customerId] || 'Unknown'} - ${inventoryMap[t.productId] || 'Unknown'}`;
                                amount = t.total;
                                typeColor = 'var(--success)';
                                typeLabel = 'Sale';
                            } else if (t.type === 'purchase') {
                                details = `${supplierMap[t.supplierId] || 'Unknown'} - ${inventoryMap[t.productId] || 'Unknown'}`;
                                amount = t.total;
                                typeColor = 'var(--primary)';
                                typeLabel = 'Purchase';
                            } else {
                                details = t.category + (t.description ? ` - ${t.description}` : '');
                                amount = t.amount;
                                typeColor = 'var(--danger)';
                                typeLabel = 'Expense';
                            }
                            const getDate = (item) => {
                                if (item.date) return new Date(item.date);
                                if (item.createdAt?.toDate) return item.createdAt.toDate();
                                return new Date(item.createdAt);
                            };
                            return `<tr>
                                <td>${getDate(t).toLocaleDateString()}</td>
                                <td style="color: ${typeColor}; font-weight: 600">${typeLabel}</td>
                                <td>${details}</td>
                                <td>₹${amount.toFixed(2)}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            ` : '<p>No transactions yet</p>'}
        </div>
    `;
}

async function renderSales(container) {
    const sales = await getCollection('sales');
    const customers = await getCollection('customers');
    const inventory = await getCollection('inventory');
    
    window.salesItems = [];
    
    container.innerHTML = `
        <div class="card">
            <h2>Add Sale</h2>
            <form id="sale-form">
                <div class="form-group">
                    <label>Customer</label>
                    <select id="sale-customer" required>
                        <option value="">Select Customer</option>
                        ${customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                    </select>
                </div>
                <div id="sale-items-container">
                    <h3>Items</h3>
                    <div id="sale-items-list"></div>
                    <div class="form-group">
                        <button type="button" class="secondary" onclick="addSaleItem()">Add Item</button>
                    </div>
                </div>
                <div class="form-group">
                    <label>Total Amount</label>
                    <input type="text" id="sale-total" readonly value="₹0.00" style="background: var(--bg-alt);">
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
    
    window.inventoryData = inventory;
    window.customersData = customers;
    
    document.getElementById('sale-form').addEventListener('submit', handleSaleSubmit);
    document.getElementById('sales-search').addEventListener('input', (e) => renderSalesList(sales, e.target.value));
    renderSalesList(sales);
}

function addSaleItem() {
    const itemsList = document.getElementById('sale-items-list');
    const itemId = Date.now();
    const itemHtml = `
        <div class="sale-item" id="sale-item-${itemId}" style="border: 1px solid var(--border); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
            <div class="form-group">
                <label>Product</label>
                <select class="sale-item-product" onchange="updateSaleItemPrice(${itemId})">
                    <option value="">Select Product</option>
                    ${window.inventoryData.map(i => `<option value="${i.id}" data-price="${i.sellingPrice}" data-stock="${i.quantity}">${i.name} (${i.quantity} in stock)</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Quantity</label>
                <input type="number" class="sale-item-qty" min="1" value="1" onchange="updateSaleTotal()">
            </div>
            <div class="form-group">
                <label>Unit Price</label>
                <input type="number" class="sale-item-price" step="0.01" value="0" onchange="updateSaleTotal()">
            </div>
            <button type="button" class="btn-danger btn-sm" onclick="removeSaleItem(${itemId})">Remove Item</button>
        </div>
    `;
    itemsList.insertAdjacentHTML('beforeend', itemHtml);
}

function updateSaleItemPrice(itemId) {
    const itemDiv = document.getElementById(`sale-item-${itemId}`);
    const productSelect = itemDiv.querySelector('.sale-item-product');
    const priceInput = itemDiv.querySelector('.sale-item-price');
    const selectedOption = productSelect.options[productSelect.selectedIndex];
    if (selectedOption && selectedOption.dataset.price) {
        priceInput.value = parseFloat(selectedOption.dataset.price).toFixed(2);
        updateSaleTotal();
    }
}

function removeSaleItem(itemId) {
    document.getElementById(`sale-item-${itemId}`).remove();
    updateSaleTotal();
}

function updateSaleTotal() {
    let total = 0;
    const items = document.querySelectorAll('.sale-item');
    items.forEach(item => {
        const qty = parseFloat(item.querySelector('.sale-item-qty').value) || 0;
        const price = parseFloat(item.querySelector('.sale-item-price').value) || 0;
        total += qty * price;
    });
    document.getElementById('sale-total').value = `₹${total.toFixed(2)}`;
}

async function handleSaleSubmit(e) {
    e.preventDefault();
    if (!(await checkPasscodeRequired())) {
        return;
    }
    const customerId = document.getElementById('sale-customer').value;
    const items = document.querySelectorAll('.sale-item');
    
    if (items.length === 0) {
        alert('Please add at least one item');
        return;
    }
    
    let totalAmount = 0;
    const saleItemsData = [];
    
    for (const item of items) {
        const productId = item.querySelector('.sale-item-product').value;
        const qty = parseInt(item.querySelector('.sale-item-qty').value);
        const price = parseFloat(item.querySelector('.sale-item-price').value);
        
        if (!productId || qty <= 0 || price <= 0) {
            alert('Please fill in all item details correctly');
            return;
        }
        
        const product = window.inventoryData.find(p => p.id === productId);
        if (product && qty > product.quantity) {
            alert(`Not enough stock for ${product.name}. Available: ${product.quantity}`);
            return;
        }
        
        totalAmount += qty * price;
        saleItemsData.push({ productId, quantity: qty, unitPrice: price });
    }
    
    // Add sale document
    const sale = {
        customerId,
        items: saleItemsData,
        total: totalAmount,
        date: new Date().toISOString(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    // For backward compatibility, also add as individual sales for existing list view
    for (const itemData of saleItemsData) {
        const singleSale = {
            customerId,
            productId: itemData.productId,
            quantity: itemData.quantity,
            unitPrice: itemData.unitPrice,
            total: itemData.quantity * itemData.unitPrice,
            date: new Date().toISOString(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        await addDocument('sales', singleSale);
        
        // Update inventory
        const product = await getDocument('inventory', itemData.productId);
        if (product) {
            await updateDocument('inventory', itemData.productId, { quantity: product.quantity - itemData.quantity });
        }
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
                    <select id="purchase-supplier" required>
                        <option value="">Select Supplier</option>
                        ${suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                    </select>
                </div>
                <div id="purchase-items-container">
                    <h3>Items</h3>
                    <div id="purchase-items-list"></div>
                    <div class="form-group">
                        <button type="button" class="secondary" onclick="addPurchaseItem()">Add Item</button>
                    </div>
                </div>
                <div class="form-group">
                    <label>Total Amount</label>
                    <input type="text" id="purchase-total" readonly value="₹0.00" style="background: var(--bg-alt);">
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
    
    window.inventoryData = inventory;
    window.suppliersData = suppliers;
    
    document.getElementById('purchase-form').addEventListener('submit', handlePurchaseSubmit);
    document.getElementById('purchases-search').addEventListener('input', (e) => renderPurchasesList(purchases, e.target.value));
    renderPurchasesList(purchases);
}

function addPurchaseItem() {
    const itemsList = document.getElementById('purchase-items-list');
    const itemId = Date.now();
    const itemHtml = `
        <div class="purchase-item" id="purchase-item-${itemId}" style="border: 1px solid var(--border); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
            <div class="form-group">
                <label>Product</label>
                <select class="purchase-item-product" onchange="updatePurchaseItemCost(${itemId})">
                    <option value="">Select Product</option>
                    ${window.inventoryData.map(i => `<option value="${i.id}" data-cost="${i.costPrice}">${i.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Quantity</label>
                <input type="number" class="purchase-item-qty" min="1" value="1" onchange="updatePurchaseTotal()">
            </div>
            <div class="form-group">
                <label>Unit Cost</label>
                <input type="number" class="purchase-item-cost" step="0.01" value="0" onchange="updatePurchaseTotal()">
            </div>
            <button type="button" class="btn-danger btn-sm" onclick="removePurchaseItem(${itemId})">Remove Item</button>
        </div>
    `;
    itemsList.insertAdjacentHTML('beforeend', itemHtml);
}

function updatePurchaseItemCost(itemId) {
    const itemDiv = document.getElementById(`purchase-item-${itemId}`);
    const productSelect = itemDiv.querySelector('.purchase-item-product');
    const costInput = itemDiv.querySelector('.purchase-item-cost');
    const selectedOption = productSelect.options[productSelect.selectedIndex];
    if (selectedOption && selectedOption.dataset.cost) {
        costInput.value = parseFloat(selectedOption.dataset.cost).toFixed(2);
        updatePurchaseTotal();
    }
}

function removePurchaseItem(itemId) {
    document.getElementById(`purchase-item-${itemId}`).remove();
    updatePurchaseTotal();
}

function updatePurchaseTotal() {
    let total = 0;
    const items = document.querySelectorAll('.purchase-item');
    items.forEach(item => {
        const qty = parseFloat(item.querySelector('.purchase-item-qty').value) || 0;
        const cost = parseFloat(item.querySelector('.purchase-item-cost').value) || 0;
        total += qty * cost;
    });
    document.getElementById('purchase-total').value = `₹${total.toFixed(2)}`;
}

async function handlePurchaseSubmit(e) {
    e.preventDefault();
    if (!(await checkPasscodeRequired())) {
        return;
    }
    const supplierId = document.getElementById('purchase-supplier').value;
    const items = document.querySelectorAll('.purchase-item');
    
    if (items.length === 0) {
        alert('Please add at least one item');
        return;
    }
    
    let totalAmount = 0;
    const purchaseItemsData = [];
    
    for (const item of items) {
        const productId = item.querySelector('.purchase-item-product').value;
        const qty = parseInt(item.querySelector('.purchase-item-qty').value);
        const cost = parseFloat(item.querySelector('.purchase-item-cost').value);
        
        if (!productId || qty <= 0 || cost <= 0) {
            alert('Please fill in all item details correctly');
            return;
        }
        
        totalAmount += qty * cost;
        purchaseItemsData.push({ productId, quantity: qty, unitCost: cost });
    }
    
    // For backward compatibility, also add as individual purchases for existing list view
    for (const itemData of purchaseItemsData) {
        const singlePurchase = {
            supplierId,
            productId: itemData.productId,
            quantity: itemData.quantity,
            unitCost: itemData.unitCost,
            total: itemData.quantity * itemData.unitCost,
            date: new Date().toISOString(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        await addDocument('purchases', singlePurchase);
        
        // Update inventory
        const product = await getDocument('inventory', itemData.productId);
        if (product) {
            await updateDocument('inventory', itemData.productId, { quantity: product.quantity + itemData.quantity });
        }
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
    if (!(await checkPasscodeRequired())) {
        return;
    }
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
    if (!(await checkPasscodeRequired())) {
        return;
    }
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
    if (!(await checkPasscodeRequired())) {
        return;
    }
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
                <div id="expense-items-container">
                    <h3>Expense Items</h3>
                    <div id="expense-items-list"></div>
                    <div class="form-group">
                        <button type="button" class="secondary" onclick="addExpenseItem()">Add Item</button>
                    </div>
                </div>
                <div class="form-group">
                    <label>Total Amount</label>
                    <input type="text" id="expense-total" readonly value="₹0.00" style="background: var(--bg-alt);">
                </div>
                <button type="submit">Add Expenses</button>
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

function addExpenseItem() {
    const itemsList = document.getElementById('expense-items-list');
    const itemId = Date.now();
    const itemHtml = `
        <div class="expense-item" id="expense-item-${itemId}" style="border: 1px solid var(--border); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
            <div class="form-group">
                <label>Category</label>
                <input type="text" class="expense-item-category" required>
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea class="expense-item-description"></textarea>
            </div>
            <div class="form-group">
                <label>Amount</label>
                <input type="number" class="expense-item-amount" step="0.01" min="0.01" value="0" onchange="updateExpenseTotal()">
            </div>
            <button type="button" class="btn-danger btn-sm" onclick="removeExpenseItem(${itemId})">Remove Item</button>
        </div>
    `;
    itemsList.insertAdjacentHTML('beforeend', itemHtml);
}

function removeExpenseItem(itemId) {
    document.getElementById(`expense-item-${itemId}`).remove();
    updateExpenseTotal();
}

function updateExpenseTotal() {
    let total = 0;
    const items = document.querySelectorAll('.expense-item');
    items.forEach(item => {
        const amount = parseFloat(item.querySelector('.expense-item-amount').value) || 0;
        total += amount;
    });
    document.getElementById('expense-total').value = `₹${total.toFixed(2)}`;
}

async function handleExpenseSubmit(e) {
    e.preventDefault();
    if (!(await checkPasscodeRequired())) {
        return;
    }
    
    const items = document.querySelectorAll('.expense-item');
    
    if (items.length === 0) {
        alert('Please add at least one expense item');
        return;
    }
    
    for (const item of items) {
        const category = item.querySelector('.expense-item-category').value;
        const amount = parseFloat(item.querySelector('.expense-item-amount').value);
        const description = item.querySelector('.expense-item-description').value;
        
        if (!category || amount <= 0) {
            alert('Please fill in all item details correctly');
            return;
        }
        
        const expense = {
            category,
            description,
            amount,
            date: new Date().toISOString(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        await addDocument('expenses', expense);
    }
    
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
            <!-- PASSCODE SECTION START -->
            <div class="form-group">
                <label>Passcode (for data entry)</label>
                <div id="passcode-settings">
                    <!-- Content will be injected by initPasscodeSettings -->
                </div>
            </div>
            <!-- PASSCODE SECTION END -->
        </div>
    `;
    // Initialize passcode settings after rendering
    initPasscodeSettings();
}

// PASSCODE HELPER FUNCTIONS
async function getPasscode() {
    try {
        const doc = await db.collection('settings').doc('app_settings').get();
        if (doc.exists) {
            const data = doc.data();
            return data.passcode || null;
        }
        return null;
    } catch (err) {
        console.error('Error getting passcode:', err);
        return null;
    }
}

async function setPasscode(code) {
    try {
        await db.collection('settings').doc('app_settings').set({
            passcode: code
        }, { merge: true });
    } catch (err) {
        console.error('Error setting passcode:', err);
        throw err;
    }
}

async function removePasscode() {
    try {
        await db.collection('settings').doc('app_settings').update({
            passcode: firebase.firestore.FieldValue.delete()
        });
    } catch (err) {
        console.error('Error removing passcode:', err);
        throw err;
    }
}

// PASSCODE MODAL FUNCTIONS
let passcodeModal = null;
let passcodeInput = null;
let passcodeError = null;
let passcodeCancelBtn = null;
let passcodeSubmitBtn = null;

function initPasscodeModal() {
    passcodeModal = document.getElementById('passcode-modal');
    passcodeInput = document.getElementById('passcode-input');
    passcodeError = document.getElementById('passcode-error');
    passcodeCancelBtn = document.getElementById('passcode-cancel');
    passcodeSubmitBtn = document.getElementById('passcode-submit');

    if (!passcodeModal) return;

    passcodeCancelBtn.addEventListener('click', hidePasscodeModal);
    passcodeSubmitBtn.addEventListener('click', handlePasscodeSubmit);
    passcodeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handlePasscodeSubmit();
        }
    });
}

function showPasscodeModal() {
    if (passcodeModal) {
        passcodeModal.classList.remove('hidden');
        passcodeInput.value = '';
        passcodeError.textContent = '';
        passcodeInput.focus();
    }
}

function hidePasscodeModal() {
    if (passcodeModal) {
        passcodeModal.classList.add('hidden');
    }
}

async function handlePasscodeSubmit() {
    const code = passcodeInput.value.trim();
    if (code.length !== 4 || !/^\d{4}$/.test(code)) {
        passcodeError.textContent = 'Please enter a valid 4-digit passcode';
        return;
    }

    const storedPasscode = await getPasscode();
    if (storedPasscode === null) {
        // This should not happen because we only show modal when passcode is set
        passcodeError.textContent = 'Passcode not set';
        return;
    }

    if (code === storedPasscode) {
        sessionStorage.setItem('passcodeVerified', 'true');
        hidePasscodeModal();
    } else {
        passcodeError.textContent = 'Incorrect passcode';
    }
}

// PASSCODE SETTINGS FUNCTIONS
async function initPasscodeSettings() {
    const passcodeSettingsDiv = document.getElementById('passcode-settings');
    if (!passcodeSettingsDiv) return;

    const passcode = await getPasscode();
    if (passcode === null) {
        passcodeSettingsDiv.innerHTML = `
            <p>No passcode set</p>
            <div class="form-group">
                <label>Set New 4-Digit Passcode</label>
                <input type="password" id="new-passcode" maxlength="4" placeholder="____" />
                <button class="secondary" onclick="setNewPasscode()">Set Passcode</button>
            </div>
        `;
    } else {
        passcodeSettingsDiv.innerHTML = `
            <p>Passcode is set (****)</p>
            <div class="form-group">
                <button class="secondary" onclick="showChangePasscodeForm()">Change Passcode</button>
                <button class="btn-danger" onclick="showRemovePasscodeForm()">Remove Passcode</button>
            </div>
            <div id="change-passcode-form" class="hidden">
                <div class="form-group">
                    <label>Enter Old Passcode</label>
                    <input type="password" id="old-passcode-input" maxlength="4" placeholder="____" />
                </div>
                <div class="form-group">
                    <label>Enter New 4-Digit Passcode</label>
                    <input type="password" id="change-passcode-input" maxlength="4" placeholder="____" />
                </div>
                <div class="form-group">
                    <label>Confirm New Passcode</label>
                    <input type="password" id="confirm-passcode-input" maxlength="4" placeholder="____" />
                </div>
                <button class="secondary" onclick="saveNewPasscode()">Save</button>
                <button class="secondary" onclick="hideChangePasscodeForm()">Cancel</button>
                <div id="change-passcode-error" class="error"></div>
            </div>
            <div id="remove-passcode-form" class="hidden">
                <div class="form-group">
                    <label>Enter Old Passcode to Remove</label>
                    <input type="password" id="remove-passcode-input" maxlength="4" placeholder="____" />
                </div>
                <button class="btn-danger" onclick="confirmRemovePasscode()">Remove Passcode</button>
                <button class="secondary" onclick="hideRemovePasscodeForm()">Cancel</button>
                <div id="remove-passcode-error" class="error"></div>
            </div>
        `;
    }
}

async function setNewPasscode() {
    const input = document.getElementById('new-passcode');
    const code = input.value.trim();
    if (code.length !== 4 || !/^\d{4}$/.test(code)) {
        alert('Please enter a valid 4-digit passcode');
        return;
    }
    try {
        await setPasscode(code);
        alert('Passcode set successfully');
        input.value = '';
        initPasscodeSettings();
    } catch (err) {
        alert('Error setting passcode: ' + err.message);
    }
}

function showChangePasscodeForm() {
    document.getElementById('change-passcode-form').classList.remove('hidden');
    document.getElementById('remove-passcode-form')?.classList.add('hidden');
    document.getElementById('old-passcode-input').focus();
}

function hideChangePasscodeForm() {
    document.getElementById('change-passcode-form').classList.add('hidden');
    document.getElementById('old-passcode-input').value = '';
    document.getElementById('change-passcode-input').value = '';
    document.getElementById('confirm-passcode-input').value = '';
    document.getElementById('change-passcode-error').textContent = '';
}

function showRemovePasscodeForm() {
    document.getElementById('remove-passcode-form').classList.remove('hidden');
    document.getElementById('change-passcode-form')?.classList.add('hidden');
    document.getElementById('remove-passcode-input').focus();
}

function hideRemovePasscodeForm() {
    document.getElementById('remove-passcode-form').classList.add('hidden');
    document.getElementById('remove-passcode-input').value = '';
    document.getElementById('remove-passcode-error').textContent = '';
}

async function saveNewPasscode() {
    const oldInput = document.getElementById('old-passcode-input');
    const newInput = document.getElementById('change-passcode-input');
    const confirmInput = document.getElementById('confirm-passcode-input');
    const errorDiv = document.getElementById('change-passcode-error');
    
    const oldCode = oldInput.value.trim();
    const newCode = newInput.value.trim();
    const confirmCode = confirmInput.value.trim();
    
    const storedPasscode = await getPasscode();
    
    if (oldCode !== storedPasscode) {
        errorDiv.textContent = 'Old passcode is incorrect';
        return;
    }
    
    if (newCode.length !== 4 || !/^\d{4}$/.test(newCode)) {
        errorDiv.textContent = 'Please enter a valid 4-digit new passcode';
        return;
    }
    
    if (newCode !== confirmCode) {
        errorDiv.textContent = 'New passcodes do not match';
        return;
    }
    
    try {
        await setPasscode(newCode);
        alert('Passcode changed successfully');
        hideChangePasscodeForm();
        initPasscodeSettings();
    } catch (err) {
        errorDiv.textContent = 'Error changing passcode: ' + err.message;
    }
}

async function confirmRemovePasscode() {
    const input = document.getElementById('remove-passcode-input');
    const errorDiv = document.getElementById('remove-passcode-error');
    const code = input.value.trim();
    const storedPasscode = await getPasscode();
    
    if (code !== storedPasscode) {
        errorDiv.textContent = 'Old passcode is incorrect';
        return;
    }
    
    if (!confirm('Are you sure you want to remove the passcode?')) {
        return;
    }
    
    try {
        await removePasscode();
        alert('Passcode removed successfully');
        hideRemovePasscodeForm();
        initPasscodeSettings();
    } catch (err) {
        errorDiv.textContent = 'Error removing passcode: ' + err.message;
    }
}

// PASSCODE CHECK FUNCTION
async function checkPasscodeRequired() {
    const passcode = await getPasscode();
    if (passcode === null) {
        return true; // No passcode set, allowed
    }

    // Check if already verified in this session
    if (sessionStorage.getItem('passcodeVerified') === 'true') {
        return true;
    }

    // Show modal and wait for user input
    return new Promise((resolve) => {
        showPasscodeModal();
        
        const submitHandler = () => {
            const code = passcodeInput.value.trim();
            if (code.length === 4 && /^\d{4}$/.test(code) && code === passcode) {
                sessionStorage.setItem('passcodeVerified', 'true');
                hidePasscodeModal();
                // Clean up event listeners
                passcodeSubmitBtn.removeEventListener('click', submitHandler);
                passcodeCancelBtn.removeEventListener('click', cancelHandler);
                passcodeInput.removeEventListener('keypress', keypressHandler);
                resolve(true);
            } else {
                passcodeError.textContent = 'Incorrect passcode';
            }
        };
        
        const cancelHandler = () => {
            hidePasscodeModal();
            // Clean up event listeners
            passcodeSubmitBtn.removeEventListener('click', submitHandler);
            passcodeCancelBtn.removeEventListener('click', cancelHandler);
            passcodeInput.removeEventListener('keypress', keypressHandler);
            resolve(false);
        };
        
        const keypressHandler = (e) => {
            if (e.key === 'Enter') {
                submitHandler();
            }
        };
        
        passcodeSubmitBtn.addEventListener('click', submitHandler);
        passcodeCancelBtn.addEventListener('click', cancelHandler);
        passcodeInput.addEventListener('keypress', keypressHandler);
    });
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
    if (!(await checkPasscodeRequired())) {
        return;
    }
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