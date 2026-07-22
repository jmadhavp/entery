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
    deleted: 'deleted_items',
    challans: 'challans'
};

const NAV_ITEMS = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'sales', label: 'Sales', icon: '💰' },
    { id: 'purchases', label: 'Purchases', icon: '🛒' },
    { id: 'calendar', label: 'Calendar', icon: '📅' },
    { id: 'inventory', label: 'Inventory', icon: '📦' },
    { id: 'customers', label: 'Customers', icon: '👥' },
    { id: 'suppliers', label: 'Suppliers', icon: '🏪' },
    { id: 'expenses', label: 'Expenses', icon: '📉' },
    { id: 'reports', label: 'Reports', icon: '📈' },
    { id: 'statement', label: 'Statement', icon: '📄' },
    { id: 'settings', label: 'Settings', icon: '⚙️' }
];

let currentUser = null;
let currentPage = 'dashboard';
let deletedItems = [];
let isOffline = !navigator.onLine;
let pendingSync = JSON.parse(localStorage.getItem('pendingSync') || '[]');

document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
    // Register PWA service worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () =>
            navigator.serviceWorker.register('sw.js').catch(err => console.log('SW failed:', err))
        );
    }
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
        calendar: renderCalendar,
        inventory: renderInventory,
        customers: renderCustomers,
        suppliers: renderSuppliers,
        expenses: renderExpenses,
        reports: renderReports,
        statement: renderStatement,
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
    
    // Group sales by customerId + date, purchases by supplierId + date, keep expenses as-is
    const groupedSales = {};
    sales.forEach(s => {
        const dateStr = new Date(s.date || s.createdAt).toLocaleDateString();
        const key = `sale-${s.customerId}-${dateStr}`;
        if (!groupedSales[key]) {
            groupedSales[key] = { ...s, count: 1, dateStr, key: 'sale' };
        } else {
            groupedSales[key].total += (s.total || 0);
            groupedSales[key].count += 1;
        }
    });
    
    const groupedPurchases = {};
    purchases.forEach(p => {
        const dateStr = new Date(p.date || p.createdAt).toLocaleDateString();
        const key = `purchase-${p.supplierId}-${dateStr}`;
        if (!groupedPurchases[key]) {
            groupedPurchases[key] = { ...p, count: 1, dateStr, key: 'purchase' };
        } else {
            groupedPurchases[key].total += (p.total || 0);
            groupedPurchases[key].count += 1;
        }
    });
    
    // Combine and sort by date descending
    const allTransactions = [
        ...Object.values(groupedSales),
        ...Object.values(groupedPurchases),
        ...expenses
    ].sort((a, b) => {
        const getDate = (item) => {
            if (item.dateStr) {
                return new Date(item.dateStr);
            }
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
            <h2>Recent Transactions (Grouped by Party & Date)</h2>
            ${allTransactions.length ? `
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Party</th>
                            <th>Count</th>
                            <th>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${allTransactions.slice(0, 20).map(t => {
                            let partyName = '';
                            let amount = 0;
                            let typeColor = '';
                            let typeLabel = '';
                            let count = 1;
                            
                            if (t.key === 'sale') {
                                partyName = customerMap[t.customerId] || 'Unknown';
                                amount = t.total || 0;
                                typeColor = 'var(--success)';
                                typeLabel = 'Sale';
                                count = t.count || 1;
                            } else if (t.key === 'purchase') {
                                partyName = supplierMap[t.supplierId] || 'Unknown';
                                amount = t.total || 0;
                                typeColor = 'var(--primary)';
                                typeLabel = 'Purchase';
                                count = t.count || 1;
                            } else {
                                partyName = t.category;
                                amount = t.amount;
                                typeColor = 'var(--danger)';
                                typeLabel = 'Expense';
                            }
                            
                            const getDate = (item) => {
                                if (item.dateStr) return item.dateStr;
                                if (item.date) return new Date(item.date).toLocaleDateString();
                                if (item.createdAt?.toDate) return item.createdAt.toDate().toLocaleDateString();
                                return new Date(item.createdAt).toLocaleDateString();
                            };
                            
                            const clickHandler = (t.key === 'sale' || t.key === 'purchase') 
                                ? `onclick="showTransactionDetails('${t.id}', '${t.key}')"` 
                                : '';
                            return `<tr style="cursor: ${t.key === 'sale' || t.key === 'purchase' ? 'pointer' : 'default'}" ${clickHandler}>
                                <td>${getDate(t)}</td>
                                <td style="color: ${typeColor}; font-weight: 600">${typeLabel}</td>
                                <td>${partyName}</td>
                                <td>${count}</td>
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
    
    // Group sales by customerId + date for grouped view
    const groupedSales = {};
    const customerMap = Object.fromEntries(customers.map(c => [c.id, c.name]));
    
    sales.forEach(s => {
        const dateStr = new Date(s.date || s.createdAt).toLocaleDateString();
        const key = `${s.customerId}-${dateStr}`;
        if (!groupedSales[key]) {
            groupedSales[key] = { 
                ...s, 
                count: 1, 
                dateStr, 
                customerId: s.customerId,
                total: s.total || 0
            };
        } else {
            groupedSales[key].total += (s.total || 0);
            groupedSales[key].count += 1;
        }
    });
    
    const sortedGrouped = Object.values(groupedSales).sort((a, b) => 
        new Date(b.dateStr) - new Date(a.dateStr)
    );
    
    container.innerHTML = `
        <div class="card">
            <h2>Add Sale / Delivery Challan</h2>
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
                <div class="form-group" style="margin-top:1rem;">
                    <label>Payment Mode</label>
                    <select id="sale-payment">
                        <option>Cash</option>
                        <option>Online</option>
                        <option>Credit</option>
                        <option>Cheque</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Remarks</label>
                    <textarea id="sale-remarks"></textarea>
                </div>
                <div class="form-group">
                    <label>Total Amount</label>
                    <input type="text" id="sale-total" readonly value="₹0.00" style="background: var(--bg-alt);">
                </div>
                <div class="actions">
                    <button type="button" onclick="submitSaleChallan('print')">Print</button>
                    <button type="button" onclick="submitSaleChallan('saveprint')">Save & Print</button>
                    <button type="button" class="secondary" onclick="submitSaleChallan('save')">Only Save</button>
                </div>
            </form>
        </div>
        <div class="card">
            <h2>Sales Summary (Grouped by Party & Date)</h2>
            <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap:1rem;">
                ${sortedGrouped.slice(0, 10).map(g => `
                    <div style="border: 1px solid var(--border); border-radius: 8px; padding: 1rem; background: var(--bg); cursor: pointer;" onclick="showTransactionDetails('${g.id}', 'sale')">
                        <div style="font-weight: 600; color: var(--primary); margin-bottom: 0.5rem;">${customerMap[g.customerId] || 'Unknown'}</div>
                        <div style="font-size: 0.9rem; color: var(--text-alt); margin-bottom: 0.5rem;">${g.dateStr}</div>
                        <div style="font-size: 1.1rem; color: var(--success); font-weight: 600;">₹${g.total.toFixed(2)}</div>
                        <div style="font-size: 0.85rem; color: var(--text-alt); margin-top: 0.5rem;">${g.count} transaction(s)</div>
                    </div>
                `).join('')}
            </div>
        </div>
        <div class="card">
            <h2>Sales History</h2>
            <div class="search-bar">
                <input type="search" inputmode="search" id="sales-search" placeholder="Search sales...">
                <button class="secondary" onclick="exportCSV('sales')">Export CSV</button>
            </div>
            <div id="sales-list"></div>
        </div>
    `;
    
    window.inventoryData = inventory;
    window.customersData = customers;
    window.selectedCustomerId = null;
    window._challanInventory = inventory;
    window._challanCustomers = customers;

    const customerSelect = document.getElementById('sale-customer');
    customerSelect.addEventListener('change', (e) => {
        window.selectedCustomerId = e.target.value;
        const items = document.querySelectorAll('.sale-item');
        items.forEach(item => {
            const productSelect = item.querySelector('.sale-item-product');
            const currentValue = productSelect.value;
            const itemId = item.dataset.itemId;
            updateProductOptions(productSelect, itemId);
            if (currentValue) {
                productSelect.value = currentValue;
                updateSaleItemPrice(itemId);
            }
        });
    });

    document.getElementById('sale-form').addEventListener('submit', (e) => {
        e.preventDefault();
        submitSaleChallan('saveprint');
    });
    document.getElementById('sales-search').addEventListener('input', (e) => renderSalesList(sales, e.target.value));
    // Start with one empty item row so the Batch Code / Scan QR option is visible immediately
    addSaleItem();
    renderSalesList(sales);
}

function addSaleItem() {
    const itemsList = document.getElementById('sale-items-list');
    const itemId = Date.now() + Math.floor(Math.random() * 1000);
    const itemDiv = document.createElement('div');
    itemDiv.className = 'sale-item';
    itemDiv.id = `ch-item-${itemId}`;
    itemDiv.dataset.itemId = itemId;
    itemDiv.style.cssText = 'border: 1px solid var(--border); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;';
    
    itemDiv.innerHTML = `
        <div class="form-group">
            <label>Product</label>
            <select class="sale-item-product" onchange="updateSaleItemPrice(${itemId})">
                <option value="">Select Product</option>
            </select>
        </div>
        <div class="form-group">
            <label>Quantity</label>
            <input type="number" inputmode="numeric" class="sale-item-qty" min="1" value="1" onchange="updateSaleTotal()">
        </div>
        <div class="form-group">
            <label>Unit Price</label>
            <input type="number" inputmode="decimal" class="sale-item-price" step="0.01" value="0" onchange="updateSaleTotal()">
        </div>
        <div class="form-group">
            <label>Batch Code / Number</label>
            <div style="display:flex; gap:0.5rem; align-items:flex-start;">
                <input type="text" class="ch-batch" placeholder="Manual or scan QR" style="flex:1;">
                <button type="button" class="secondary btn-sm" style="min-height:44px;" onclick="startBatchScan('${itemId}')">Scan QR</button>
            </div>
        </div>
        <button type="button" class="btn-danger btn-sm" onclick="removeSaleItem(${itemId})">Remove Item</button>
    `;
    
    itemsList.appendChild(itemDiv);
    const productSelect = itemDiv.querySelector('.sale-item-product');
    updateProductOptions(productSelect, itemId);
}

function updateProductOptions(productSelect, itemId) {
    const customerId = window.selectedCustomerId;
    const inventory = window.inventoryData;
    const customers = window.customersData;
    
    // Separate linked and non-linked products
    const linkedProducts = [];
    const otherProducts = [];
    
    inventory.forEach(product => {
        const isLinked = customerId && (product.linkedCustomers || []).some(lc => lc.customerId === customerId);
        if (isLinked) {
            linkedProducts.push(product);
        } else {
            otherProducts.push(product);
        }
    });
    
    let optionsHtml = '<option value="">Select Product</option>';
    
    if (linkedProducts.length > 0) {
        optionsHtml += '<optgroup label="Linked Products">';
        linkedProducts.forEach(product => {
            const customerLink = (product.linkedCustomers || []).find(lc => lc.customerId === customerId);
            const customer = customers.find(c => c.id === customerId);
            const price = customerLink ? customerLink.price : product.sellingPrice;
            optionsHtml += `<option value="${product.id}" data-price="${price}" data-name="${escapeHtml(product.name)}">${product.name} (${customer ? customer.name : 'Linked'}) - ₹${price.toFixed(2)}</option>`;
        });
        optionsHtml += '</optgroup>';
    }
    
    optionsHtml += '<optgroup label="All Products">';
    otherProducts.forEach(product => {
        optionsHtml += `<option value="${product.id}" data-price="${product.sellingPrice}" data-name="${escapeHtml(product.name)}">${product.name} - ₹${product.sellingPrice.toFixed(2)}</option>`;
    });
    optionsHtml += '</optgroup>';
    
    productSelect.innerHTML = optionsHtml;
}

function updateSaleItemPrice(itemId) {
    const itemDiv = document.getElementById(`ch-item-${itemId}`);
    const productSelect = itemDiv.querySelector('.sale-item-product');
    const priceInput = itemDiv.querySelector('.sale-item-price');
    const selectedOption = productSelect.options[productSelect.selectedIndex];
    if (selectedOption && selectedOption.dataset.price) {
        priceInput.value = parseFloat(selectedOption.dataset.price).toFixed(2);
        updateSaleTotal();
    }
}

function removeSaleItem(itemId) {
    document.getElementById(`ch-item-${itemId}`).remove();
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

function collectSaleChallanData() {
    const customerId = document.getElementById('sale-customer').value;
    if (!customerId) {
        showToast('Please select a customer', 'error');
        return null;
    }
    const customer = (window._challanCustomers || []).find(c => c.id === customerId);
    const items = [];
    let valid = true;
    document.querySelectorAll('.sale-item').forEach(div => {
        const sel = div.querySelector('.sale-item-product');
        const pid = sel.value;
        if (!pid) return;
        const name = sel.options[sel.selectedIndex].dataset.name;
        const qty = parseInt(div.querySelector('.sale-item-qty').value) || 0;
        const price = parseFloat(div.querySelector('.sale-item-price').value) || 0;
        const batch = div.querySelector('.ch-batch').value;
        if (!pid || qty <= 0 || price <= 0) {
            showToast('Please fill in all item details correctly', 'error');
            valid = false;
            return;
        }
        items.push({ productId: pid, productName: name, quantity: qty, unitPrice: price, rate: price, amount: qty * price, batch });
    });
    if (!valid || !items.length) return null;
    const totalQty = items.reduce((s, i) => s + i.quantity, 0);
    const totalAmt = items.reduce((s, i) => s + i.amount, 0);
    return {
        customerId,
        partyName: customer ? customer.name : '',
        partyAddress: customer ? customer.address : '',
        partyMobile: customer ? customer.phone : '',
        items,
        totalQuantity: totalQty,
        totalAmount: totalAmt,
        paymentMode: document.getElementById('sale-payment').value,
        remarks: document.getElementById('sale-remarks').value
    };
}

async function submitSaleChallan(mode) {
    if (!(await checkPasscodeRequired())) return;
    const data = collectSaleChallanData();
    if (!data) return;

    if (mode === 'print') {
        // Print a preview without saving
        const preview = { ...data, challanNo: 'PREVIEW', date: new Date().toISOString() };
        await printChallanData(preview);
        return;
    }

    // 1) Save the Sale (with inventory deduction, as before)
    const saleItemsData = data.items.map(it => ({
        productId: it.productId,
        quantity: it.quantity,
        unitPrice: it.unitPrice
    }));
    const sale = {
        customerId: data.customerId,
        items: saleItemsData,
        total: data.totalAmount,
        date: new Date().toISOString(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    const saleRef = await db.collection('sales').add(sale);

    // Update inventory quantities per item
    for (const it of saleItemsData) {
        const product = await getDocument('inventory', it.productId);
        if (product) {
            await updateDocument('inventory', it.productId, { quantity: (product.quantity || 0) - it.quantity });
        }
    }

    // 2) Save the linked Challan (sales = challan, challan = sales)
    const challan = await createChallan({
        customerId: data.customerId,
        partyName: data.partyName,
        partyAddress: data.partyAddress,
        partyMobile: data.partyMobile,
        items: data.items,
        totalQuantity: data.totalQuantity,
        totalAmount: data.totalAmount,
        paymentMode: data.paymentMode,
        remarks: data.remarks,
        saleId: saleRef.id
    });

    // Link challan id back to the sale for easy re-print
    await updateDocument('sales', saleRef.id, { challanId: challan.id });

    if (mode === 'saveprint') {
        await printChallanData(challan);
    }
    showToast(mode === 'saveprint' ? 'Saved & sent to print' : 'Saved', 'success');
    renderSales(document.getElementById('content'));
}

async function printSaleChallan(saleId) {
    const sale = await getDocument('sales', saleId);
    if (!sale) return;
    let challan = null;
    if (sale.challanId) {
        challan = await getDocument('challans', sale.challanId);
    }
    if (!challan) {
        // Build a challan on the fly for older entries (no stored challan)
        const customers = await getCollection('customers');
        const customer = customers.find(c => c.id === sale.customerId);
        const inventory = await getCollection('inventory');
        const invMap = Object.fromEntries(inventory.map(i => [i.id, i]));
        const items = (sale.items || []).map(it => ({
            productId: it.productId,
            productName: invMap[it.productId] ? invMap[it.productId].name : 'Unknown',
            quantity: it.quantity,
            rate: it.unitPrice || 0,
            amount: (it.quantity || 0) * (it.unitPrice || 0),
            batch: it.batch || ''
        }));
        challan = {
            challanNo: sale.challanNo || 'PREVIEW',
            date: sale.date || new Date().toISOString(),
            partyName: customer ? customer.name : '',
            partyAddress: customer ? customer.address : '',
            partyMobile: customer ? customer.phone : '',
            items,
            totalQuantity: items.reduce((s, i) => s + i.quantity, 0),
            totalAmount: sale.total || 0,
            paymentMode: sale.paymentMode || '',
            remarks: sale.remarks || ''
        };
    }
    await printChallanData(challan);
}

async function renderSalesList(sales, search = '') {
    const customers = await getCollection('customers');
    const customerMap = Object.fromEntries(customers.map(c => [c.id, c.name]));
    const filtered = sales.filter(s => 
        !search || (customerMap[s.customerId] || '').toLowerCase().includes(search.toLowerCase())
    );
    document.getElementById('sales-list').innerHTML = `
        <div class="actions" style="justify-content: space-between; align-items: center;">
            <div>
                <button class="secondary" onclick="toggleSelectAll('sales', this)">Select All</button>
                <button class="btn-danger" onclick="deleteSelected('sales')">Delete Selected</button>
            </div>
            <div>
                <span style="color:var(--text-alt);">${filtered.length} records</span>
            </div>
        </div>
        <table>
            <thead>
                <tr><th style="width:40px"> </th><th>Date</th><th>Customer</th><th>Total</th><th>Actions</th></tr>
            </thead>
            <tbody>
                ${filtered.map(s => `
                    <tr class="${Array.isArray(s.items) ? 'grouped-transaction' : ''}" onclick="showTransactionDetails('${s.id}', 'sale')" style="cursor:pointer;">
                        <td><input type="checkbox" class="select-checkbox sales-select" data-id="${s.id}" onclick="event.stopPropagation()"></td>
                        <td>${new Date(s.date).toLocaleDateString()}</td>
                        <td>${customerMap[s.customerId] || 'Unknown'}</td>
                        <td>₹${(s.total || 0).toFixed(2)}</td>
                        <td class="actions">
                            <button class="btn-sm secondary" onclick="event.stopPropagation(); printSaleChallan('${s.id}')">Challan</button>
                            <button class="btn-sm secondary" onclick="event.stopPropagation(); generateQR('sale', '${s.id}')">QR</button>
                            <button class="btn-sm btn-danger" onclick="event.stopPropagation(); deleteItem('sales', '${s.id}')">Delete</button>
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
    
    // Group purchases by supplierId + date for grouped view
    const groupedPurchases = {};
    const supplierMap = Object.fromEntries(suppliers.map(s => [s.id, s.name]));
    
    purchases.forEach(p => {
        const dateStr = new Date(p.date || p.createdAt).toLocaleDateString();
        const key = `${p.supplierId}-${dateStr}`;
        if (!groupedPurchases[key]) {
            groupedPurchases[key] = { 
                ...p, 
                count: 1, 
                dateStr, 
                supplierId: p.supplierId,
                total: p.total || 0
            };
        } else {
            groupedPurchases[key].total += (p.total || 0);
            groupedPurchases[key].count += 1;
        }
    });
    
    const sortedGrouped = Object.values(groupedPurchases).sort((a, b) => 
        new Date(b.dateStr) - new Date(a.dateStr)
    );
    
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
            <h2>Purchases Summary (Grouped by Supplier & Date)</h2>
            <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap:1rem;">
                ${sortedGrouped.slice(0, 10).map(g => `
                    <div style="border: 1px solid var(--border); border-radius: 8px; padding: 1rem; background: var(--bg); cursor: pointer;" onclick="showTransactionDetails('${g.id}', 'purchase')">
                        <div style="font-weight: 600; color: var(--primary); margin-bottom: 0.5rem;">${supplierMap[g.supplierId] || 'Unknown'}</div>
                        <div style="font-size: 0.9rem; color: var(--text-alt); margin-bottom: 0.5rem;">${g.dateStr}</div>
                        <div style="font-size: 1.1rem; color: var(--primary); font-weight: 600;">₹${g.total.toFixed(2)}</div>
                        <div style="font-size: 0.85rem; color: var(--text-alt); margin-top: 0.5rem;">${g.count} transaction(s)</div>
                    </div>
                `).join('')}
            </div>
        </div>
        <div class="card">
            <h2>Purchase History</h2>
            <div class="search-bar">
                <input type="search" inputmode="search" id="purchases-search" placeholder="Search purchases...">
                <button class="secondary" onclick="exportCSV('purchases')">Export CSV</button>
            </div>
            <div id="purchases-list"></div>
        </div>
    `;
    
    window.inventoryData = inventory;
    window.suppliersData = suppliers;
    window.selectedSupplierId = null;
    
    const supplierSelect = document.getElementById('purchase-supplier');
    supplierSelect.addEventListener('change', (e) => {
        window.selectedSupplierId = e.target.value;
        // Refresh all existing items when supplier changes
        const items = document.querySelectorAll('.purchase-item');
        items.forEach(item => {
            const productSelect = item.querySelector('.purchase-item-product');
            const currentValue = productSelect.value;
            const itemId = item.id.replace('purchase-item-', '');
            updatePurchaseProductOptions(productSelect, itemId);
            if (currentValue) {
                productSelect.value = currentValue;
                updatePurchaseItemCost(itemId);
            }
        });
    });
    
    document.getElementById('purchase-form').addEventListener('submit', handlePurchaseSubmit);
    document.getElementById('purchases-search').addEventListener('input', (e) => renderPurchasesList(purchases, e.target.value));
    renderPurchasesList(purchases);
}

function addPurchaseItem() {
    const itemsList = document.getElementById('purchase-items-list');
    const itemId = Date.now();
    const itemDiv = document.createElement('div');
    itemDiv.className = 'purchase-item';
    itemDiv.id = `purchase-item-${itemId}`;
    itemDiv.style.cssText = 'border: 1px solid var(--border); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;';
    
    itemDiv.innerHTML = `
        <div class="form-group">
            <label>Product</label>
            <select class="purchase-item-product" onchange="updatePurchaseItemCost(${itemId})">
                <option value="">Select Product</option>
            </select>
        </div>
        <div class="form-group">
            <label>Quantity</label>
            <input type="number" inputmode="numeric" class="purchase-item-qty" min="1" value="1" onchange="updatePurchaseTotal()">
        </div>
        <div class="form-group">
            <label>Unit Cost</label>
            <input type="number" inputmode="decimal" class="purchase-item-cost" step="0.01" value="0" onchange="updatePurchaseTotal()">
        </div>
        <button type="button" class="btn-danger btn-sm" onclick="removePurchaseItem(${itemId})">Remove Item</button>
    `;
    
    itemsList.appendChild(itemDiv);
    const productSelect = itemDiv.querySelector('.purchase-item-product');
    updatePurchaseProductOptions(productSelect, itemId);
}

function updatePurchaseProductOptions(productSelect, itemId) {
    const supplierId = window.selectedSupplierId;
    const inventory = window.inventoryData;
    const suppliers = window.suppliersData;
    
    // Separate linked and non-linked products
    const linkedProducts = [];
    const otherProducts = [];
    
    inventory.forEach(product => {
        const isLinked = supplierId && (product.linkedSuppliers || []).some(ls => ls.supplierId === supplierId);
        if (isLinked) {
            linkedProducts.push(product);
        } else {
            otherProducts.push(product);
        }
    });
    
    let optionsHtml = '<option value="">Select Product</option>';
    
    if (linkedProducts.length > 0) {
        optionsHtml += '<optgroup label="Linked Products">';
        linkedProducts.forEach(product => {
            const supplier = suppliers.find(s => s.id === supplierId);
            optionsHtml += `<option value="${product.id}" data-cost="${product.costPrice}">${product.name} (${supplier ? supplier.name : 'Linked'}) - ₹${product.costPrice.toFixed(2)}</option>`;
        });
        optionsHtml += '</optgroup>';
    }
    
    optionsHtml += '<optgroup label="All Products">';
    otherProducts.forEach(product => {
        optionsHtml += `<option value="${product.id}" data-cost="${product.costPrice}">${product.name} - ₹${product.costPrice.toFixed(2)}</option>`;
    });
    optionsHtml += '</optgroup>';
    
    productSelect.innerHTML = optionsHtml;
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
        showToast('Please add at least one item', 'error');
        return;
    }
    
    let totalAmount = 0;
    const purchaseItemsData = [];
    
    for (const item of items) {
        const productId = item.querySelector('.purchase-item-product').value;
        const qty = parseInt(item.querySelector('.purchase-item-qty').value);
        const cost = parseFloat(item.querySelector('.purchase-item-cost').value);
        
        if (!productId || qty <= 0 || cost <= 0) {
            showToast('Please fill in all item details correctly', 'error');
            return;
        }
        
        totalAmount += qty * cost;
        purchaseItemsData.push({ productId, quantity: qty, unitCost: cost });
    }
    
    // Save grouped purchase transaction
    const purchase = {
        supplierId,
        items: purchaseItemsData,
        total: totalAmount,
        date: new Date().toISOString(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await addDocument('purchases', purchase);

    // Update inventory quantities per item
    for (const itemData of purchaseItemsData) {
        const product = await getDocument('inventory', itemData.productId);
        if (product) {
            await updateDocument('inventory', itemData.productId, { quantity: (product.quantity || 0) + itemData.quantity });
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
        <div class="actions" style="justify-content: space-between; align-items: center;">
            <div>
                <button class="secondary" onclick="toggleSelectAll('purchases', this)">Select All</button>
                <button class="btn-danger" onclick="deleteSelected('purchases')">Delete Selected</button>
            </div>
            <div>
                <span style="color:var(--text-alt);">${filtered.length} records</span>
            </div>
        </div>
        <table>
            <thead>
                <tr><th style="width:40px"> </th><th>Date</th><th>Supplier</th><th>Total</th><th>Actions</th></tr>
            </thead>
            <tbody>
                ${filtered.map(p => `
                    <tr class="${Array.isArray(p.items) ? 'grouped-transaction' : ''}" onclick="showTransactionDetails('${p.id}', 'purchase')" style="cursor:pointer;">
                        <td><input type="checkbox" class="select-checkbox purchases-select" data-id="${p.id}" onclick="event.stopPropagation()"></td>
                        <td>${new Date(p.date).toLocaleDateString()}</td>
                        <td>${supplierMap[p.supplierId] || 'Unknown'}</td>
                        <td>₹${(p.total || 0).toFixed(2)}</td>
                        <td class="actions">
                            <button class="btn-sm btn-danger" onclick="event.stopPropagation(); deleteItem('purchases', '${p.id}')">Delete</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

async function renderInventory(container) {
    const inventory = await getCollection('inventory');
    const customers = await getCollection('customers');
    const suppliers = await getCollection('suppliers');
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
                    <input type="number" inputmode="numeric" id="inv-qty" min="0" required>
                </div>
                <div class="form-group">
                    <label>Cost Price</label>
                    <input type="number" inputmode="decimal" id="inv-cost" step="0.01" required>
                </div>
                <div class="form-group">
                    <label>Selling Price</label>
                    <input type="number" inputmode="decimal" id="inv-price" step="0.01" required>
                </div>
                <button type="submit">Add Product</button>
            </form>
        </div>
        <div class="card">
            <h2>Inventory</h2>
            <div class="search-bar">
                <input type="search" inputmode="search" id="inventory-search" placeholder="Search products...">
                <button class="secondary" onclick="exportCSV('inventory')">Export CSV</button>
            </div>
            <div id="inventory-list"></div>
        </div>
    `;
    document.getElementById('inventory-form').addEventListener('submit', handleInventorySubmit);
    document.getElementById('inventory-search').addEventListener('input', (e) => renderInventoryList(inventory, e.target.value));
    renderInventoryList(inventory, customers, suppliers);
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

async function renderInventoryList(inventory, customers, suppliers, search = '') {
    const filtered = inventory.filter(i => 
        !search || i.name.toLowerCase().includes(search.toLowerCase()) || (i.sku || '').toLowerCase().includes(search.toLowerCase())
    );
    document.getElementById('inventory-list').innerHTML = `
        <table>
            <thead>
                <tr><th>Name</th><th>SKU</th><th>Quantity</th><th>Cost</th><th>Price</th><th>Linked Customers</th><th>Linked Suppliers</th><th>Actions</th></tr>
            </thead>
            <tbody>
                ${filtered.map(i => `
                    <tr>
                        <td>${i.name}</td>
                        <td>${i.sku || '-'}</td>
                        <td style="color: ${i.quantity < 10 ? 'var(--danger)' : 'var(--success)'}">${i.quantity}</td>
                        <td>₹${i.costPrice.toFixed(2)}</td>
                        <td>₹${i.sellingPrice.toFixed(2)}</td>
                        <td>${(i.linkedCustomers || []).map(lc => {
                            const customer = customers.find(c => c.id === lc.customerId);
                            return customer ? `${customer.name} (₹${lc.price.toFixed(2)})` : '';
                        }).join(', ') || '-'}</td>
                        <td>${(i.linkedSuppliers || []).map(ls => {
                            const supplier = suppliers.find(s => s.id === ls.supplierId);
                            return supplier ? supplier.name : '';
                        }).join(', ') || '-'}</td>
                        <td class="actions">
                            <button class="btn-sm secondary" onclick="showEditProductModal('${i.id}')">Edit</button>
                            <button class="btn-sm secondary" onclick="showLinkProductModal('${i.id}')">Link</button>
                            <button class="btn-sm btn-danger" onclick="deleteItem('inventory', '${i.id}')">Delete</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

async function showEditProductModal(productId) {
    const product = await getDocument('inventory', productId);
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'edit-product-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>Edit Product</h3>
            <form id="edit-product-form">
                <div class="form-group">
                    <label>Product Name</label>
                    <input type="text" id="edit-inv-name" required value="${product.name}">
                </div>
                <div class="form-group">
                    <label>SKU</label>
                    <input type="text" id="edit-inv-sku" value="${product.sku || ''}">
                </div>
                <div class="form-group">
                    <label>Quantity</label>
                    <input type="number" inputmode="numeric" id="edit-inv-qty" min="0" required value="${product.quantity}">
                </div>
                <div class="form-group">
                    <label>Cost Price</label>
                    <input type="number" inputmode="decimal" id="edit-inv-cost" step="0.01" required value="${product.costPrice}">
                </div>
                <div class="form-group">
                    <label>Selling Price</label>
                    <input type="number" inputmode="decimal" id="edit-inv-price" step="0.01" required value="${product.sellingPrice}">
                </div>
                <div class="modal-actions">
                    <button type="button" class="secondary" onclick="document.getElementById('edit-product-modal').remove()">Cancel</button>
                    <button type="submit">Save Changes</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('edit-product-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!(await checkPasscodeRequired())) {
            return;
        }
        const updatedProduct = {
            name: document.getElementById('edit-inv-name').value,
            sku: document.getElementById('edit-inv-sku').value,
            quantity: parseInt(document.getElementById('edit-inv-qty').value),
            costPrice: parseFloat(document.getElementById('edit-inv-cost').value),
            sellingPrice: parseFloat(document.getElementById('edit-inv-price').value),
        };
        await updateDocument('inventory', productId, updatedProduct);
        modal.remove();
        renderInventory(document.getElementById('content'));
    });
}

async function renderCustomers(container) {
    const customers = await getCollection('customers');
    const inventory = await getCollection('inventory');
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
                    <input type="tel" inputmode="tel" id="cust-phone">
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
                <input type="search" inputmode="search" id="customers-search" placeholder="Search customers...">
                <button class="secondary" onclick="exportCSV('customers')">Export CSV</button>
            </div>
            <div id="customers-list"></div>
        </div>
    `;
    document.getElementById('customer-form').addEventListener('submit', handleCustomerSubmit);
    document.getElementById('customers-search').addEventListener('input', (e) => renderCustomersList(customers, inventory, e.target.value));
    renderCustomersList(customers, inventory);
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

async function renderCustomersList(customers, inventory, search = '') {
    const filtered = customers.filter(c => 
        !search || c.name.toLowerCase().includes(search.toLowerCase())
    );
    document.getElementById('customers-list').innerHTML = `
        <table>
            <thead>
                <tr><th>Name</th><th>Email</th><th>Phone</th><th>Linked Products</th><th>Actions</th></tr>
            </thead>
            <tbody>
                ${filtered.map(c => {
                    const linkedProducts = inventory.filter(i => 
                        (i.linkedCustomers || []).some(lc => lc.customerId === c.id)
                    ).map(i => {
                        const link = (i.linkedCustomers || []).find(lc => lc.customerId === c.id);
                        return `${i.name} (₹${link.price.toFixed(2)})`;
                    }).join(', ');
                    return `
                        <tr>
                            <td>${c.name}</td>
                            <td>${c.email || '-'}</td>
                            <td>${c.phone || '-'}</td>
                            <td>${linkedProducts || '-'}</td>
                            <td class="actions">
                                <button class="btn-sm secondary" onclick="showEditCustomerModal('${c.id}')">Edit</button>
                                <button class="btn-sm btn-danger" onclick="deleteItem('customers', '${c.id}')">Delete</button>
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

async function showEditCustomerModal(customerId) {
    const customer = await getDocument('customers', customerId);
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'edit-customer-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>Edit Customer</h3>
            <form id="edit-customer-form">
                <div class="form-group">
                    <label>Name</label>
                    <input type="text" id="edit-cust-name" required value="${customer.name}">
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="edit-cust-email" value="${customer.email || ''}">
                </div>
                <div class="form-group">
                    <label>Phone</label>
                    <input type="tel" inputmode="tel" id="edit-cust-phone" value="${customer.phone || ''}">
                </div>
                <div class="form-group">
                    <label>Address</label>
                    <textarea id="edit-cust-address">${customer.address || ''}</textarea>
                </div>
                <div class="modal-actions">
                    <button type="button" class="secondary" onclick="document.getElementById('edit-customer-modal').remove()">Cancel</button>
                    <button type="submit">Save Changes</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('edit-customer-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!(await checkPasscodeRequired())) {
            return;
        }
        const updatedCustomer = {
            name: document.getElementById('edit-cust-name').value,
            email: document.getElementById('edit-cust-email').value,
            phone: document.getElementById('edit-cust-phone').value,
            address: document.getElementById('edit-cust-address').value,
        };
        await updateDocument('customers', customerId, updatedCustomer);
        modal.remove();
        renderCustomers(document.getElementById('content'));
    });
}

async function renderSuppliers(container) {
    const suppliers = await getCollection('suppliers');
    const inventory = await getCollection('inventory');
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
                    <input type="tel" inputmode="tel" id="sup-phone">
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
                <input type="search" inputmode="search" id="suppliers-search" placeholder="Search suppliers...">
                <button class="secondary" onclick="exportCSV('suppliers')">Export CSV</button>
            </div>
            <div id="suppliers-list"></div>
        </div>
    `;
    document.getElementById('supplier-form').addEventListener('submit', handleSupplierSubmit);
    document.getElementById('suppliers-search').addEventListener('input', (e) => renderSuppliersList(suppliers, inventory, e.target.value));
    renderSuppliersList(suppliers, inventory);
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

async function renderSuppliersList(suppliers, inventory, search = '') {
    const filtered = suppliers.filter(s => 
        !search || s.name.toLowerCase().includes(search.toLowerCase())
    );
    document.getElementById('suppliers-list').innerHTML = `
        <table>
            <thead>
                <tr><th>Name</th><th>Email</th><th>Phone</th><th>Linked Products</th><th>Actions</th></tr>
            </thead>
            <tbody>
                ${filtered.map(s => {
                    const linkedProducts = inventory.filter(i => 
                        (i.linkedSuppliers || []).some(ls => ls.supplierId === s.id)
                    ).map(i => i.name).join(', ');
                    return `
                        <tr>
                            <td>${s.name}</td>
                            <td>${s.email || '-'}</td>
                            <td>${s.phone || '-'}</td>
                            <td>${linkedProducts || '-'}</td>
                            <td class="actions">
                                <button class="btn-sm secondary" onclick="showEditSupplierModal('${s.id}')">Edit</button>
                                <button class="btn-sm btn-danger" onclick="deleteItem('suppliers', '${s.id}')">Delete</button>
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

async function showEditSupplierModal(supplierId) {
    const supplier = await getDocument('suppliers', supplierId);
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'edit-supplier-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>Edit Supplier</h3>
            <form id="edit-supplier-form">
                <div class="form-group">
                    <label>Name</label>
                    <input type="text" id="edit-sup-name" required value="${supplier.name}">
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="edit-sup-email" value="${supplier.email || ''}">
                </div>
                <div class="form-group">
                    <label>Phone</label>
                    <input type="tel" inputmode="tel" id="edit-sup-phone" value="${supplier.phone || ''}">
                </div>
                <div class="form-group">
                    <label>Address</label>
                    <textarea id="edit-sup-address">${supplier.address || ''}</textarea>
                </div>
                <div class="modal-actions">
                    <button type="button" class="secondary" onclick="document.getElementById('edit-supplier-modal').remove()">Cancel</button>
                    <button type="submit">Save Changes</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('edit-supplier-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!(await checkPasscodeRequired())) {
            return;
        }
        const updatedSupplier = {
            name: document.getElementById('edit-sup-name').value,
            email: document.getElementById('edit-sup-email').value,
            phone: document.getElementById('edit-sup-phone').value,
            address: document.getElementById('edit-sup-address').value,
        };
        await updateDocument('suppliers', supplierId, updatedSupplier);
        modal.remove();
        renderSuppliers(document.getElementById('content'));
    });
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
                <input type="search" inputmode="search" id="expenses-search" placeholder="Search expenses...">
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
                <input type="number" inputmode="decimal" class="expense-item-amount" step="0.01" min="0.01" value="0" onchange="updateExpenseTotal()">
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
        showToast('Please add at least one expense item', 'error');
        return;
    }
    
    for (const item of items) {
        const category = item.querySelector('.expense-item-category').value;
        const amount = parseFloat(item.querySelector('.expense-item-amount').value);
        const description = item.querySelector('.expense-item-description').value;
        
        if (!category || amount <= 0) {
            showToast('Please fill in all item details correctly', 'error');
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

// CALENDAR VIEW
async function renderCalendar(container) {
    const sales = await getCollection('sales');
    const purchases = await getCollection('purchases');
    
    // Group transactions by date
    const dateMap = {};
    
    sales.forEach(s => {
        const dateStr = new Date(s.date || s.createdAt).toLocaleDateString();
        if (!dateMap[dateStr]) {
            dateMap[dateStr] = { sales: 0, purchases: 0, date: new Date(s.date || s.createdAt) };
        }
        dateMap[dateStr].sales += (s.total || 0);
    });
    
    purchases.forEach(p => {
        const dateStr = new Date(p.date || p.createdAt).toLocaleDateString();
        if (!dateMap[dateStr]) {
            dateMap[dateStr] = { sales: 0, purchases: 0, date: new Date(p.date || p.createdAt) };
        }
        dateMap[dateStr].purchases += (p.total || 0);
    });
    
    const sortedDates = Object.entries(dateMap).sort((a, b) => b[1].date - a[1].date);
    
    container.innerHTML = `
        <div class="card">
            <h2>Calendar - Daily Summary</h2>
            <div class="calendar-grid">
                ${sortedDates.map(([dateStr, data]) => `
                    <div class="calendar-tile">
                        <div class="date">${dateStr}</div>
                        <div class="stat-line">
                            <span class="label">Sales:</span>
                            <span class="value sales">₹${data.sales.toFixed(2)}</span>
                        </div>
                        <div class="stat-line">
                            <span class="label">Purchases:</span>
                            <span class="value purchase">₹${data.purchases.toFixed(2)}</span>
                        </div>
                        <div class="stat-line">
                            <span class="label">Profit:</span>
                            <span class="value profit">₹${(data.sales - data.purchases).toFixed(2)}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// STATEMENT VIEW WITH FILTERS AND DATE RANGE
async function renderStatement(container) {
    const sales = await getCollection('sales');
    const purchases = await getCollection('purchases');
    const expenses = await getCollection('expenses');
    const customers = await getCollection('customers');
    const suppliers = await getCollection('suppliers');
    const inventory = await getCollection('inventory');
    
    const customerMap = Object.fromEntries(customers.map(c => [c.id, c.name]));
    const supplierMap = Object.fromEntries(suppliers.map(s => [s.id, s.name]));
    const inventoryMap = Object.fromEntries(inventory.map(i => [i.id, i.name]));
    
    container.innerHTML = `
        <div class="card">
            <h2>Statement</h2>
            <div class="filter-section">
                <div class="form-group" style="display:inline-block; width: 30%; margin-right:1rem;">
                    <label>From Date</label>
                    <input type="date" id="stmt-from-date" />
                </div>
                <div class="form-group" style="display:inline-block; width: 30%; margin-right:1rem;">
                    <label>To Date</label>
                    <input type="date" id="stmt-to-date" />
                </div>
                <button class="secondary" style="margin-top:1.5rem;" onclick="renderStatementFiltered()">Apply Date Range</button>
                <button class="secondary" style="margin-top:1.5rem;" onclick="printStatement()">Print Statement</button>
            </div>
            
            <div style="margin-top:1rem;">
                <h3>Filter By</h3>
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:1rem;">
                    <div>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                            <label style="font-weight:600;">Type</label>
                            <div style="display:flex; gap:0.3rem;">
                                <button class="btn-sm secondary" onclick="toggleFilterCheckboxes('input[name=filter-type]', true)">All</button>
                                <button class="btn-sm secondary" onclick="toggleFilterCheckboxes('input[name=filter-type]', false)">None</button>
                            </div>
                        </div>
                        <label><input type="checkbox" name="filter-type" value="sales" checked /> Sales</label><br>
                        <label><input type="checkbox" name="filter-type" value="purchases" checked /> Purchases</label><br>
                        <label><input type="checkbox" name="filter-type" value="expenses" checked /> Expenses</label>
                    </div>
                    <div>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                            <label style="font-weight:600;">Customers</label>
                            <div style="display:flex; gap:0.3rem;">
                                <button class="btn-sm secondary" onclick="toggleFilterCheckboxes('.filter-customer', true)">All</button>
                                <button class="btn-sm secondary" onclick="toggleFilterCheckboxes('.filter-customer', false)">None</button>
                            </div>
                        </div>
                        <div style="max-height: 200px; overflow-y:auto;">
                            ${customers.map(c => `
                                <label><input type="checkbox" class="filter-customer" value="${c.id}" checked /> ${c.name}</label><br>
                            `).join('')}
                        </div>
                    </div>
                    <div>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                            <label style="font-weight:600;">Suppliers</label>
                            <div style="display:flex; gap:0.3rem;">
                                <button class="btn-sm secondary" onclick="toggleFilterCheckboxes('.filter-supplier', true)">All</button>
                                <button class="btn-sm secondary" onclick="toggleFilterCheckboxes('.filter-supplier', false)">None</button>
                            </div>
                        </div>
                        <div style="max-height: 200px; overflow-y:auto;">
                            ${suppliers.map(s => `
                                <label><input type="checkbox" class="filter-supplier" value="${s.id}" checked /> ${s.name}</label><br>
                            `).join('')}
                        </div>
                    </div>
                    <div>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                            <label style="font-weight:600;">Items</label>
                            <div style="display:flex; gap:0.3rem;">
                                <button class="btn-sm secondary" onclick="toggleFilterCheckboxes('.filter-item', true)">All</button>
                                <button class="btn-sm secondary" onclick="toggleFilterCheckboxes('.filter-item', false)">None</button>
                            </div>
                        </div>
                        <div style="max-height: 200px; overflow-y:auto;">
                            ${inventory.map(i => `
                                <label><input type="checkbox" class="filter-item" value="${i.id}" checked /> ${i.name}</label><br>
                            `).join('')}
                        </div>
                    </div>
                </div>
                <button class="secondary" style="margin-top:1rem;" onclick="renderStatementFiltered()">Apply Filters</button>
            </div>
            
            <div id="statement-content" style="margin-top:2rem;"></div>
        </div>
    `;
    
    // Store data for filtering
    window.statementData = {
        sales, purchases, expenses, customers, suppliers, inventory,
        customerMap, supplierMap, inventoryMap
    };
    
    renderStatementContent();
}

function renderStatementContent() {
    const { sales, purchases, expenses, customerMap, supplierMap, inventoryMap } = window.statementData || {};
    if (!sales) return;
    
    const fromDate = new Date(document.getElementById('stmt-from-date')?.value || '1900-01-01');
    const toDate = new Date(document.getElementById('stmt-to-date')?.value || '2100-12-31');
    
    const filterTypes = Array.from(document.querySelectorAll('input[name="filter-type"]:checked')).map(cb => cb.value);
    const filterCustomers = Array.from(document.querySelectorAll('.filter-customer:checked')).map(cb => cb.value);
    const filterSuppliers = Array.from(document.querySelectorAll('.filter-supplier:checked')).map(cb => cb.value);
    const filterItems = Array.from(document.querySelectorAll('.filter-item:checked')).map(cb => cb.value);
    
    let transactions = [];
    
    if (filterTypes.includes('sales')) {
        transactions.push(...sales.map(s => ({
            ...s,
            type: 'sale',
            dateObj: new Date(s.date || s.createdAt),
            partyName: customerMap[s.customerId] || 'Unknown'
        })));
    }
    
    if (filterTypes.includes('purchases')) {
        transactions.push(...purchases.map(p => ({
            ...p,
            type: 'purchase',
            dateObj: new Date(p.date || p.createdAt),
            partyName: supplierMap[p.supplierId] || 'Unknown'
        })));
    }
    
    if (filterTypes.includes('expenses')) {
        transactions.push(...expenses.map(e => ({
            ...e,
            type: 'expense',
            dateObj: new Date(e.date || e.createdAt)
        })));
    }
    
    // Filter by date
    transactions = transactions.filter(t => t.dateObj >= fromDate && t.dateObj <= toDate);
    
    // Filter by party and items
    transactions = transactions.filter(t => {
        if (t.type === 'sale' && !filterCustomers.includes(t.customerId)) return false;
        if (t.type === 'purchase' && !filterSuppliers.includes(t.supplierId)) return false;
        
        // Support both new grouped format and legacy single-item format
        if (Array.isArray(t.items) && t.items.length > 0) {
            return t.items.some(it => filterItems.includes(it.productId));
        } else if (t.productId && filterItems.length > 0) {
            return filterItems.includes(t.productId);
        }
        return true;
    });
    
    transactions.sort((a, b) => b.dateObj - a.dateObj);
    
    const totalSales = transactions.filter(t => t.type === 'sale').reduce((sum, t) => sum + (t.total || 0), 0);
    const totalPurchases = transactions.filter(t => t.type === 'purchase').reduce((sum, t) => sum + (t.total || 0), 0);
    const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + (t.amount || 0), 0);
    
    let html = `
        <div class="statement-summary">
            <div class="sum-item"><strong>Total Sales:</strong> ₹${totalSales.toFixed(2)}</div>
            <div class="sum-item"><strong>Total Purchases:</strong> ₹${totalPurchases.toFixed(2)}</div>
            <div class="sum-item"><strong>Total Expenses:</strong> ₹${totalExpenses.toFixed(2)}</div>
            <div class="sum-item"><strong>Net Profit:</strong> ₹${(totalSales - totalPurchases - totalExpenses).toFixed(2)}</div>
        </div>
        <table style="width:100%; margin-top:1.5rem;">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Party</th>
                    <th>Details</th>
                    <th>Amount</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    transactions.forEach(t => {
        const dateStr = t.dateObj.toLocaleDateString();
        let details = '', amount = 0, typeLabel = '', typeColor = '';
        
        if (t.type === 'sale') {
            // Support both new grouped format and legacy single-item format
            if (Array.isArray(t.items) && t.items.length > 0) {
                details = t.items.map(it => inventoryMap[it.productId] || 'Unknown').join(', ');
            } else if (t.productId) {
                details = inventoryMap[t.productId] || 'Unknown';
            }
            amount = t.total || 0;
            typeLabel = 'Sale';
            typeColor = 'var(--success)';
        } else if (t.type === 'purchase') {
            // Support both new grouped format and legacy single-item format
            if (Array.isArray(t.items) && t.items.length > 0) {
                details = t.items.map(it => inventoryMap[it.productId] || 'Unknown').join(', ');
            } else if (t.productId) {
                details = inventoryMap[t.productId] || 'Unknown';
            }
            amount = t.total || 0;
            typeLabel = 'Purchase';
            typeColor = 'var(--primary)';
        } else {
            details = t.description || '-';
            amount = t.amount;
            typeLabel = 'Expense';
            typeColor = 'var(--danger)';
        }
        
        html += `
            <tr>
                <td>${dateStr}</td>
                <td style="color: ${typeColor}; font-weight: 600;">${typeLabel}</td>
                <td>${t.partyName || t.category || '-'}</td>
                <td>${details}</td>
                <td>₹${amount.toFixed(2)}</td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    
    document.getElementById('statement-content').innerHTML = html;
}

function renderStatementFiltered() {
    renderStatementContent();
}

function printStatement() {
    const printWindow = window.open('', '_blank');
    const content = document.getElementById('statement-content').innerHTML;
    const summary = document.querySelector('.statement-summary').innerHTML;
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Statement</title>
            <style>
                body { font-family: Arial; margin: 2cm; }
                h1 { text-align: center; }
                .statement-summary { margin: 1rem 0; border: 1px solid #ddd; padding: 1rem; }
                .sum-item { margin: 0.5rem 0; }
                table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
                th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
                th { background: #f0f0f0; }
                @media print { body { margin: 0; } }
            </style>
        </head>
        <body>
            <h1>Statement</h1>
            <p>Generated on: ${new Date().toLocaleString()}</p>
            <div class="statement-summary">${summary}</div>
            ${content}
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

// TRANSACTION DETAIL VIEW
async function showTransactionDetails(transactionId, type) {
    const doc = await getDocument(type === 'sale' ? 'sales' : 'purchases', transactionId);
    if (!doc) return;
    
    const inventory = await getCollection('inventory');
    const inventoryMap = Object.fromEntries(inventory.map(i => [i.id, i.name]));
    
    const customers = await getCollection('customers');
    const customerMap = Object.fromEntries(customers.map(c => [c.id, c.name]));
    
    const suppliers = await getCollection('suppliers');
    const supplierMap = Object.fromEntries(suppliers.map(s => [s.id, s.name]));
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'transaction-detail-modal';
    modal.style.cssText = 'display:flex; align-items:center; justify-content:center; z-index:1000;';
    
    let partyName = '';
    if (type === 'sale') {
        partyName = customerMap[doc.customerId] || 'Unknown';
    } else {
        partyName = supplierMap[doc.supplierId] || 'Unknown';
    }
    
    const dateStr = new Date(doc.date || doc.createdAt).toLocaleDateString();
    
    let itemsHtml = '';
    // Support both new grouped format (items array) and legacy single-item format
    let items = [];
    
    if (Array.isArray(doc.items) && doc.items.length > 0) {
        // New grouped format
        items = doc.items;
    } else if (doc.productId) {
        // Legacy single-item format - convert to items array format
        items = [{
            productId: doc.productId,
            quantity: doc.quantity || 1,
            unitPrice: doc.unitPrice || doc.unitCost || 0
        }];
    }
    
    if (items.length > 0) {
        itemsHtml = `
            <div style="margin-top:1rem; padding:1rem; background:var(--bg); border-radius:8px; max-height: 400px; overflow-y: auto;">
                <h4 style="margin-bottom:1rem; position: sticky; top: 0; background: var(--bg); padding-bottom: 0.5rem;">Items Details (${items.length}):</h4>
                <div style="display:grid; gap:0.75rem;">
                    ${items.map(it => {
                        const itemName = inventoryMap[it.productId] || 'Unknown';
                        const unitPrice = it.unitPrice || it.unitCost || 0;
                        const itemTotal = (it.quantity || 0) * unitPrice;
                        return `
                            <div style="padding:0.75rem; background:var(--bg-alt); border-left: 3px solid var(--primary); border-radius: 4px;">
                                <div style="font-weight: 600; color: var(--primary); margin-bottom: 0.3rem;">${itemName}</div>
                                <div style="font-size: 0.95rem; color: var(--text);">
                                    ${it.quantity} × ₹${unitPrice.toFixed(2)} = <strong>₹${itemTotal.toFixed(2)}</strong>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px; max-height:90vh; overflow:auto;">
            <h3>${type === 'sale' ? 'Sale' : 'Purchase'} Details</h3>
            <div style="margin: 1rem 0; padding: 1rem; background: var(--bg); border-radius: 8px;">
                <p><strong>Date:</strong> ${dateStr}</p>
                <p><strong>Party:</strong> ${partyName}</p>
                <p style="font-size: 1.2rem; color: var(--primary); margin: 0; font-weight: 600;"><strong>Total Amount:</strong> ₹${(doc.total || 0).toFixed(2)}</p>
            </div>
            ${itemsHtml}
            <div class="modal-actions" style="margin-top:1rem;">
                <button class="secondary" onclick="document.getElementById('transaction-detail-modal').remove()">Close</button>
                <button onclick="editGroupedTransaction('${doc.id}', '${type}')">Edit</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// EDIT GROUPED TRANSACTION
async function editGroupedTransaction(transactionId, type) {
    const doc = await getDocument(type === 'sale' ? 'sales' : 'purchases', transactionId);
    if (!doc) return;
    
    const inventory = await getCollection('inventory');
    const customers = type === 'sale' ? await getCollection('customers') : [];
    const suppliers = type === 'purchase' ? await getCollection('suppliers') : [];
    
    // Close detail modal first
    const detailModal = document.getElementById('transaction-detail-modal');
    if (detailModal) detailModal.remove();
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'edit-transaction-modal';
    
    let customerSelect = '';
    if (type === 'sale') {
        customerSelect = `
            <div class="form-group">
                <label>Customer</label>
                <select id="edit-customer" required>
                    ${customers.map(c => `<option value="${c.id}" ${c.id === doc.customerId ? 'selected' : ''}>${c.name}</option>`).join('')}
                </select>
            </div>
        `;
    }
    
    let supplierSelect = '';
    if (type === 'purchase') {
        supplierSelect = `
            <div class="form-group">
                <label>Supplier</label>
                <select id="edit-supplier" required>
                    ${suppliers.map(s => `<option value="${s.id}" ${s.id === doc.supplierId ? 'selected' : ''}>${s.name}</option>`).join('')}
                </select>
            </div>
        `;
    }
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px; max-height:90vh; overflow:auto;">
            <h3>Edit ${type === 'sale' ? 'Sale' : 'Purchase'}</h3>
            <form id="edit-transaction-form">
                ${customerSelect}
                ${supplierSelect}
                <div id="edit-items-list"></div>
                <div class="form-group">
                    <label>Total Amount</label>
                    <input type="text" id="edit-total" readonly value="₹${(doc.total || 0).toFixed(2)}" style="background: var(--bg-alt);">
                </div>
                <div class="modal-actions">
                    <button type="button" class="secondary" onclick="document.getElementById('edit-transaction-modal').remove()">Cancel</button>
                    <button type="submit">Save Changes</button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Support both new grouped format (items array) and legacy single-item format
    let itemsToEdit = [];
    if (Array.isArray(doc.items) && doc.items.length > 0) {
        itemsToEdit = doc.items;
    } else if (doc.productId) {
        // Legacy single-item format - convert to items array format
        itemsToEdit = [{
            productId: doc.productId,
            quantity: doc.quantity || 1,
            unitPrice: doc.unitPrice || doc.unitCost || 0
        }];
    }
    
    const itemsList = document.getElementById('edit-items-list');
    itemsToEdit.forEach((item, idx) => {
        const product = inventory.find(p => p.id === item.productId);
        itemsList.innerHTML += `
            <div style="border: 1px solid var(--border); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                <div class="form-group">
                    <label>Product</label>
                    <input type="text" value="${product?.name || 'Unknown'}" readonly style="background: var(--bg-alt);">
                </div>
                <div class="form-group">
                    <label>Quantity</label>
                    <input type="number" inputmode="numeric" class="edit-item-qty" value="${item.quantity}" min="1" onchange="updateEditTotal('${type}')">
                </div>
                <div class="form-group">
                    <label>Unit Price</label>
                    <input type="number" inputmode="decimal" class="edit-item-price" step="0.01" value="${(item.unitPrice || item.unitCost || 0).toFixed(2)}" onchange="updateEditTotal('${type}')">
                </div>
            </div>
        `;
    });
    
    document.getElementById('edit-transaction-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!(await checkPasscodeRequired())) return;
        
        const newItems = [];
        const qtyInputs = document.querySelectorAll('.edit-item-qty');
        const priceInputs = document.querySelectorAll('.edit-item-price');
        
        itemsToEdit.forEach((item, idx) => {
            newItems.push({
                productId: item.productId,
                quantity: parseInt(qtyInputs[idx].value),
                unitPrice: parseFloat(priceInputs[idx].value) || item.unitPrice,
                unitCost: parseFloat(priceInputs[idx].value) || item.unitCost
            });
        });
        
        const newTotal = newItems.reduce((sum, item) => sum + (item.quantity * (item.unitPrice || item.unitCost || 0)), 0);
        
        const updates = {
            items: newItems,
            total: newTotal
        };
        
        if (type === 'sale') {
            updates.customerId = document.getElementById('edit-customer').value;
        } else {
            updates.supplierId = document.getElementById('edit-supplier').value;
        }
        
        await updateDocument(type === 'sale' ? 'sales' : 'purchases', transactionId, updates);
        modal.remove();
        renderPage();
    });
}

function updateEditTotal(type) {
    let total = 0;
    const qtyInputs = document.querySelectorAll('.edit-item-qty');
    const priceInputs = document.querySelectorAll('.edit-item-price');
    
    qtyInputs.forEach((input, idx) => {
        const qty = parseFloat(input.value) || 0;
        const price = parseFloat(priceInputs[idx].value) || 0;
        total += qty * price;
    });
    
    document.getElementById('edit-total').value = `₹${total.toFixed(2)}`;
}

async function renderSettings(container) {
    const company = await getCompanySettings();
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
        <div class="card">
            <h2>Company Details (for Challan)</h2>
            <form id="company-form">
                <div class="form-group">
                    <label>Company Name</label>
                    <input type="text" id="company-name" value="${escapeHtml(company.name)}">
                </div>
                <div class="form-group">
                    <label>Brand Name</label>
                    <input type="text" id="company-brand" value="${escapeHtml(company.brand)}">
                </div>
                <div class="form-group">
                    <label>Factory Address</label>
                    <textarea id="company-address">${escapeHtml(company.address)}</textarea>
                </div>
                <div class="form-group">
                    <label>Mobile Number</label>
                    <input type="text" id="company-mobile" value="${escapeHtml(company.mobile)}">
                </div>
                <div class="form-group">
                    <label>FSSAI Licence No.</label>
                    <input type="text" id="company-fssai" value="${escapeHtml(company.fssai)}">
                </div>
                <div class="form-group">
                    <label>Company Logo</label>
                    <input type="file" id="company-logo" accept="image/*">
                    ${company.logo ? `<img src="${company.logo}" style="max-height:50px; display:block; margin-top:0.5rem;">` : ''}
                    <input type="hidden" id="company-logo-data" value="${escapeHtml(company.logo)}">
                </div>
                <button type="submit">Save Company Details</button>
            </form>
        </div>
    `;
    document.getElementById('company-form').addEventListener('submit', (e) => {
        e.preventDefault();
        saveCompanySettings();
    });
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
                <input type="password" id="new-passcode" inputmode="numeric" maxlength="4" placeholder="____" />
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
                    <input type="password" id="old-passcode-input" inputmode="numeric" maxlength="4" placeholder="____" />
                </div>
                <div class="form-group">
                    <label>Enter New 4-Digit Passcode</label>
                    <input type="password" id="change-passcode-input" inputmode="numeric" maxlength="4" placeholder="____" />
                </div>
                <div class="form-group">
                    <label>Confirm New Passcode</label>
                    <input type="password" id="confirm-passcode-input" inputmode="numeric" maxlength="4" placeholder="____" />
                </div>
                <button class="secondary" onclick="saveNewPasscode()">Save</button>
                <button class="secondary" onclick="hideChangePasscodeForm()">Cancel</button>
                <div id="change-passcode-error" class="error"></div>
            </div>
            <div id="remove-passcode-form" class="hidden">
                <div class="form-group">
                    <label>Enter Old Passcode to Remove</label>
                    <input type="password" id="remove-passcode-input" inputmode="numeric" maxlength="4" placeholder="____" />
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
        showToast('Please enter a valid 4-digit passcode', 'error');
        return;
    }
    try {
        await setPasscode(code);
        showToast('Passcode set successfully', 'success');
        input.value = '';
        initPasscodeSettings();
    } catch (err) {
        showToast('Error setting passcode: ' + err.message, 'error');
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
        showToast('Passcode changed successfully', 'success');
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
        showToast('Passcode removed successfully', 'success');
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
        showToast('Saved offline — will sync when online', 'warning');
        return;
    }
    try {
        await db.collection(collection).add(data);
    } catch (err) {
        console.error('Error adding document:', err);
        showToast('Error: ' + err.message, 'error');
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

async function showLinkProductModal(productId) {
    const product = await getDocument('inventory', productId);
    const customers = await getCollection('customers');
    const suppliers = await getCollection('suppliers');
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'link-product-modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <h3>Link Product: ${product.name}</h3>
            <div style="margin-bottom: 1rem;">
                <h4>Link to Customers (with custom price)</h4>
                <div id="customer-links-list" style="max-height: 150px; overflow-y: auto; margin-bottom: 1rem;">
                    ${customers.map(customer => {
                        const existingLink = (product.linkedCustomers || []).find(lc => lc.customerId === customer.id);
                        return `
                            <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 0.5rem;">
                                <input type="checkbox" id="customer-${customer.id}" ${existingLink ? 'checked' : ''} style="width: auto;">
                                <label style="flex: 1; margin: 0;" for="customer-${customer.id}">${customer.name}</label>
                                <input type="number" inputmode="decimal" id="customer-price-${customer.id}" step="0.01" value="${existingLink ? existingLink.price : product.sellingPrice}" style="width: 120px;">
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            <div style="margin-bottom: 1rem;">
                <h4>Link to Suppliers</h4>
                <div id="supplier-links-list" style="max-height: 150px; overflow-y: auto; margin-bottom: 1rem;">
                    ${suppliers.map(supplier => {
                        const existingLink = (product.linkedSuppliers || []).find(ls => ls.supplierId === supplier.id);
                        return `
                            <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 0.5rem;">
                                <input type="checkbox" id="supplier-${supplier.id}" ${existingLink ? 'checked' : ''} style="width: auto;">
                                <label style="flex: 1; margin: 0;" for="supplier-${supplier.id}">${supplier.name}</label>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            <div class="modal-actions">
                <button class="secondary" onclick="document.getElementById('link-product-modal').remove()">Cancel</button>
                <button onclick="saveProductLinks('${productId}')">Save Links</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function saveProductLinks(productId) {
    const product = await getDocument('inventory', productId);
    const customers = await getCollection('customers');
    const suppliers = await getCollection('suppliers');
    
    const linkedCustomers = [];
    customers.forEach(customer => {
        const checkbox = document.getElementById(`customer-${customer.id}`);
        if (checkbox && checkbox.checked) {
            const priceInput = document.getElementById(`customer-price-${customer.id}`);
            linkedCustomers.push({ customerId: customer.id, price: parseFloat(priceInput.value) });
        }
    });
    
    const linkedSuppliers = [];
    suppliers.forEach(supplier => {
        const checkbox = document.getElementById(`supplier-${supplier.id}`);
        if (checkbox && checkbox.checked) {
            linkedSuppliers.push({ supplierId: supplier.id });
        }
    });
    
    await updateDocument('inventory', productId, { linkedCustomers, linkedSuppliers });
    document.getElementById('link-product-modal').remove();
    renderInventory(document.getElementById('content'));
}

async function syncToSheets() {
    const sheetsUrl = localStorage.getItem('sheetsUrl');
    if (!sheetsUrl) {
        showToast('Please set Google Sheets webhook URL in Settings first', 'warning');
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
        showToast('Synced to Google Sheets successfully!', 'success');
    } catch (err) {
        showToast('Sync failed: ' + err.message, 'error');
    }
}

// Multi-select helpers: toggle all checkboxes and delete selected items
function toggleSelectAll(collection, btn) {
    const checkboxes = document.querySelectorAll(`.${collection}-select`);
    // If any unchecked, check all; otherwise uncheck all
    const anyUnchecked = Array.from(checkboxes).some(cb => !cb.checked);
    checkboxes.forEach(cb => cb.checked = anyUnchecked);
    btn.textContent = anyUnchecked ? 'Unselect All' : 'Select All';
}

async function deleteSelected(collection) {
    if (!(await checkPasscodeRequired())) return;
    const checkboxes = document.querySelectorAll(`.${collection}-select:checked`);
    if (!checkboxes.length) {
        showToast('No items selected', 'warning');
        return;
    }
    if (!confirm(`Delete ${checkboxes.length} selected items from ${collection}?`)) return;
    for (const cb of checkboxes) {
        const id = cb.dataset.id;
        if (id) {
            try {
                await deleteItem(collection, id);
            } catch (err) {
                console.error('Error deleting selected item', err);
            }
        }
    }
    renderPage();
}

// Toggle filter checkboxes for Statement page (Select All / Deselect All)
function toggleFilterCheckboxes(selector, checkAll) {
    const checkboxes = document.querySelectorAll(selector);
    checkboxes.forEach(cb => cb.checked = checkAll);
}

// ============ TOAST NOTIFICATION HELPER ============
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============ WHOLESALE DELIVERY CHALLAN (NON-GST) ============

function escapeHtml(str) {
    if (str == null) return '';
    const map = {
        '&': '&' + 'amp;',
        '<': '&' + 'lt;',
        '>': '&' + 'gt;',
        '"': '&' + 'quot;',
        "'": '&' + '#39;'
    };
    return String(str).replace(/[&<>"']/g, m => map[m]);
}

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

const DEFAULT_COMPANY = {
    name: 'RAJ BOTTLING',
    brand: 'KLASSIC',
    address: '104, 1st floor, plot no-26, block no 214, vikas arcade, village masma, taluka olpad',
    mobile: '7990829993',
    fssai: '10726022000066',
    email: 'rajlace_mj@yahoo.com',
    logo: ''
};

async function getCompanySettings() {
    try {
        const doc = await db.collection('settings').doc('company').get();
        if (doc.exists) {
            return { ...DEFAULT_COMPANY, ...doc.data() };
        }
        return { ...DEFAULT_COMPANY };
    } catch (err) {
        console.error('Error getting company settings:', err);
        return { ...DEFAULT_COMPANY };
    }
}

async function saveCompanySettings() {
    if (!(await checkPasscodeRequired())) return;
    const logoInput = document.getElementById('company-logo');
    let logo = (document.getElementById('company-logo-data') || {}).value || '';
    if (logoInput && logoInput.files && logoInput.files[0]) {
        try {
            logo = await readFileAsDataURL(logoInput.files[0]);
        } catch (err) {
            showToast('Error reading logo', 'error');
        }
    }
    const data = {
        name: document.getElementById('company-name').value,
        brand: document.getElementById('company-brand').value,
        address: document.getElementById('company-address').value,
        mobile: document.getElementById('company-mobile').value,
        fssai: document.getElementById('company-fssai').value,
        logo
    };
    try {
        await db.collection('settings').doc('company').set(data, { merge: true });
        showToast('Company details saved', 'success');
    } catch (err) {
        showToast('Error saving company details: ' + err.message, 'error');
    }
}

async function getNextChallanNo() {
    // Challan number is based on the date: the day-of-month is the base,
    // and multiple entries on the same day get .1, .2, .3 ... suffixes.
    // e.g. 21/7/2026 -> "21" (first), then "21.1", "21.2" for more that day.
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const dayStr = `${y}-${m}-${d}`;
    const dayNum = now.getDate();

    const metaRef = db.collection('settings').doc('challan_meta');
    const snap = await metaRef.get();
    let seq = 1;
    if (snap.exists && snap.data().lastDate === dayStr && snap.data().lastSeq) {
        seq = parseInt(snap.data().lastSeq, 10) + 1;
    }
    await metaRef.set({ lastDate: dayStr, lastSeq: seq }, { merge: true });

    return seq === 1 ? String(dayNum) : `${dayNum}.${seq - 1}`;
}

async function createChallan(data) {
    const challanNo = await getNextChallanNo();
    const challan = {
        challanNo,
        date: new Date().toISOString(),
        ...data,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    const ref = await db.collection('challans').add(challan);
    return { id: ref.id, ...challan };
}


async function printChallanData(challan) {
    const company = await getCompanySettings();
    const html = buildChallanPrintHTML(challan, company);
    const w = window.open('', '_blank');
    if (!w) {
        showToast('Popup blocked. Please allow popups to print.', 'error');
        return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
}

async function printChallan(challanId) {
    const challan = await getDocument('challans', challanId);
    if (!challan) {
        showToast('Challan not found', 'error');
        return;
    }
    await printChallanData(challan);
}

let _qrScanner = null;
let _qrTargetItemId = null;

async function startBatchScan(itemId) {
    _qrTargetItemId = itemId;
    let modal = document.getElementById('qr-scan-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'qr-scan-modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:420px;">
                <h3>Scan Batch QR Code</h3>
                <div id="qr-reader" style="width:100%;"></div>
                <div id="qr-scan-error" class="error"></div>
                <div class="modal-actions">
                    <button type="button" class="secondary" onclick="stopBatchScan()">Cancel</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
    }
    modal.classList.remove('hidden');
    try {
        if (typeof Html5Qrcode === 'undefined') {
            throw new Error('QR library not loaded (needs internet)');
        }
        if (!_qrScanner) {
            _qrScanner = new Html5Qrcode('qr-reader');
        }
        await _qrScanner.start(
            { facingMode: 'environment' },
            { fps: 10, qrbox: 200 },
            (decodedText) => {
                const div = document.getElementById('ch-item-' + _qrTargetItemId);
                if (div) div.querySelector('.ch-batch').value = decodedText;
                stopBatchScan();
                showToast('Batch code scanned', 'success');
            },
            () => {}
        );
    } catch (err) {
        const e = document.getElementById('qr-scan-error');
        if (e) e.textContent = 'Camera error: ' + err;
    }
}

function stopBatchScan() {
    const modal = document.getElementById('qr-scan-modal');
    if (modal) modal.classList.add('hidden');
    if (_qrScanner && _qrScanner.isScanning) {
        _qrScanner.stop().catch(() => {});
    }
}

function challanCopyHTML(challan, company, copyTitle) {
    const itemsRows = (challan.items || []).map((it, i) => `
        <tr>
            <td style="text-align:center;">${i + 1}</td>
            <td>${escapeHtml(it.productName)}</td>
            <td>${escapeHtml(it.batch || '-')}</td>
            <td style="text-align:right;">${it.quantity}</td>
            <td style="text-align:right;">₹${Number(it.rate || 0).toFixed(2)}</td>
            <td style="text-align:right;">₹${Number(it.amount || 0).toFixed(2)}</td>
        </tr>
    `).join('');

    const logo = company.logo
        ? `<img src="${company.logo}" style="max-height:38px; max-width:130px; display:block;">`
        : '';

    return `
    <div class="copy">
        <div class="ch-head">
            <div class="ch-company">
                ${logo}
                <div>
                    <div class="ch-name">${escapeHtml(company.name || 'COMPANY NAME')}</div>
                    <div class="ch-sub">${escapeHtml(company.brand ? company.brand + ' - ' : '')}Cold Drink Manufacturer</div>
                    <div class="ch-addr">${escapeHtml(company.address || '')}</div>
                    <div class="ch-addr">Mobile: ${escapeHtml(company.mobile || '')} &nbsp;|&nbsp; FSSAI: ${escapeHtml(company.fssai || '')}</div>
                </div>
            </div>
            <div class="ch-meta">
                <div class="ch-title">DELIVERY CHALLAN</div>
                <div><strong>Challan No:</strong> ${challan.challanNo}</div>
                <div><strong>Date:</strong> ${new Date(challan.date).toLocaleDateString()}</div>
                <div class="ch-copy">${copyTitle}</div>
            </div>
        </div>
        <div class="ch-party">
            <strong>Party:</strong> ${escapeHtml(challan.partyName || '')} &nbsp;&nbsp;
            <strong>Mobile:</strong> ${escapeHtml(challan.partyMobile || '')}<br>
            <strong>Address:</strong> ${escapeHtml(challan.partyAddress || '')}
        </div>
        <table class="ch-table">
            <thead>
                <tr>
                    <th style="width:6%;">Sr.</th>
                    <th>Product Name</th>
                    <th style="width:16%;">Batch</th>
                    <th style="width:13%;">Qty (Cases)</th>
                    <th style="width:15%;">Rate</th>
                    <th style="width:16%;">Amount</th>
                </tr>
            </thead>
            <tbody>${itemsRows}</tbody>
        </table>
        <div class="ch-bottom">
            <div class="ch-totals">
                <div><strong>Total Quantity:</strong> ${challan.totalQuantity}</div>
                <div><strong>Total Amount:</strong> ₹${Number(challan.totalAmount || 0).toFixed(2)}</div>
                <div><strong>Payment Mode:</strong> ${escapeHtml(challan.paymentMode || '')}</div>
                <div><strong>Remarks:</strong> ${escapeHtml(challan.remarks || '')}</div>
            </div>
            <div class="ch-sign">
                <div>Receiver's Signature</div>
                <div>Authorized Signature</div>
            </div>
        </div>
        <div class="ch-terms">
            <strong>Terms & Conditions / શરતો અને પરિસ્થિતિ / नियम और शर्तें:</strong><br>
            <strong>GU:</strong> અમારા દ્વારા વેચાણ થયેલ માલ માં જો કોઈપણ પ્રકાર ની તકલીફ હોય તો આપે વેચાણ લીધેલ માલ ની તારીખ થી ૧૪ દિવસ માં જાણ કરવી. ત્યારબાદ રાજ બોટલિંગ વેચાણ થયેલ માલ ની કોઈપણ પ્રકાર ની ફરિયાદ નો સાંભળશે નહીં.<br>
            <strong>EN:</strong> If there is any problem with the goods sold by us, you must inform us within 14 days from the date of purchase. After that, Raj Bottling will not entertain any complaint regarding the goods sold.<br>
            <strong>HI:</strong> अगर हमारे बेचे गए सामान में कोई समस्या है, तो आपको खरीदारी की तारीख से 14 दिनों के भीतर हमें सूचित करना होगा। इसके बाद, राज बॉटलिंग बेचे गए सामान के संबंध में किसी भी शिकायत पर विचार नहीं करेगा।
        </div>
    </div>`;
}

function buildChallanPrintHTML(challan, company) {
    const copy1 = challanCopyHTML(challan, company, 'ORIGINAL');
    const copy2 = challanCopyHTML(challan, company, 'CUSTOMER COPY');
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Challan ${challan.challanNo}</title>
<style>
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body { margin: 0; padding: 0; height: 100%; }
    @page { size: A4 portrait; margin: 6mm; }
    body {
        font-family: Arial, 'Segoe UI', Tahoma, sans-serif;
        color: #000;
        font-size: 10.5px;
        line-height: 1.25;
    }
    .sheet { height: 100%; display: flex; flex-direction: column; gap: 2mm; }
    .copy {
        flex: 1 1 0;
        min-height: 0;
        border: 1px solid #000;
        padding: 3mm 4mm;
        display: flex;
        flex-direction: column;
    }
    .ch-head { display: flex; justify-content: space-between; border-bottom: 1px solid #000; padding-bottom: 2mm; }
    .ch-company { display: flex; gap: 2mm; align-items: flex-start; }
    .ch-name { font-size: 14px; font-weight: 700; }
    .ch-sub { font-size: 10px; margin-bottom: 1mm; }
    .ch-addr { font-size: 9px; }
    .ch-meta { text-align: right; font-size: 10px; }
    .ch-title { font-weight: 700; font-size: 12px; margin-bottom: 1mm; }
    .ch-copy { margin-top: 1mm; font-weight: 700; }
    .ch-party { font-size: 10px; padding: 1.5mm 0; border-bottom: 1px solid #000; }
    .ch-table { width: 100%; border-collapse: collapse; font-size: 10px; flex: 1 1 auto; min-height: 0; }
    .ch-table th, .ch-table td { border: 1px solid #000; padding: 1mm 1.5mm; vertical-align: top; }
    .ch-table th { background: #eee; }
    .ch-bottom { display: flex; justify-content: space-between; font-size: 10px; padding-top: 1.5mm; border-top: 1px solid #000; gap: 4mm; }
    .ch-totals { flex: 1; }
    .ch-totals div { margin-bottom: 0.5mm; }
    .ch-sign { display: flex; gap: 6mm; }
    .ch-sign div { border-top: 1px solid #000; padding-top: 6mm; min-width: 38mm; text-align: center; font-size: 9px; }
    .ch-terms { font-size: 7px; line-height: 1.2; padding-top: 1mm; border-top: 1px solid #000; margin-top: 1mm; }
</style>
</head>
<body>
    <div class="sheet">
        ${copy1}
        ${copy2}
    </div>
</body>
</html>`;
}