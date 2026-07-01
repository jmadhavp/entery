// ========================================
// COMPREHENSIVE USER AGENT DETECTION SYSTEM
// ========================================
const UA_DETECTOR = {
    parseUserAgent: function() {
        const ua = navigator.userAgent;
        const platform = navigator.platform;
        const vendor = navigator.vendor || '';
        const result = {
            browser: 'unknown',
            browserVersion: 'unknown',
            os: 'unknown',
            osVersion: 'unknown',
            device: 'desktop',
            isMobile: false,
            isTablet: false,
            isDesktop: true,
            isTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
            screenWidth: window.screen.width,
            screenHeight: window.screen.height,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            pixelRatio: window.devicePixelRatio || 1,
            isHighDPI: (window.devicePixelRatio || 1) > 1
        };

        // Browser detection
        if (/Edg/.test(ua)) {
            result.browser = 'edge';
            const match = ua.match(/Edg\/(\d+\.\d+)/);
            result.browserVersion = match ? match[1] : 'unknown';
        } else if (/Chrome/.test(ua) && !/Edg/.test(ua)) {
            result.browser = 'chrome';
            const match = ua.match(/Chrome\/(\d+\.\d+)/);
            result.browserVersion = match ? match[1] : 'unknown';
        } else if (/Firefox/.test(ua)) {
            result.browser = 'firefox';
            const match = ua.match(/Firefox\/(\d+\.\d+)/);
            result.browserVersion = match ? match[1] : 'unknown';
        } else if (/Safari/.test(ua) && /Apple Computer/.test(vendor)) {
            result.browser = 'safari';
            const match = ua.match(/Version\/(\d+\.\d+)/);
            result.browserVersion = match ? match[1] : 'unknown';
        } else if (/MSIE|Trident/.test(ua)) {
            result.browser = /Trident/.test(ua) ? 'edge-legacy' : 'ie';
            const match = ua.match(/(?:MSIE |rv:)(\d+\.\d+)/);
            result.browserVersion = match ? match[1] : 'unknown';
        }

        // OS detection
        if (/Win/.test(platform)) {
            result.os = 'windows';
            const match = ua.match(/Windows NT (\d+\.\d+)/);
            if (match) {
                const version = match[1];
                if (version === '10.0' || version === '11.0') {
                    result.osVersion = '10/11';
                } else if (version === '6.3') {
                    result.osVersion = '8.1';
                } else if (version === '6.2') {
                    result.osVersion = '8';
                } else if (version === '6.1') {
                    result.osVersion = '7';
                }
            }
        } else if (/Mac/.test(platform)) {
            result.os = 'macos';
            const match = ua.match(/Mac OS X (\d+[_\. ]\d+)/i);
            if (match) {
                result.osVersion = match[1].replace(/_/g, '.');
            }
        } else if (/Linux/.test(platform)) {
            result.os = 'linux';
        } else if (/Android/.test(ua)) {
            result.os = 'android';
            const match = ua.match(/Android (\d+[.\d]*)/);
            result.osVersion = match ? match[1] : 'unknown';
        } else if (/iPhone|iPad|iPod/.test(ua)) {
            result.os = 'ios';
            const match = ua.match(/OS (\d+[_\d]*)/);
            if (match) {
                result.osVersion = match[1].replace(/_/g, '.');
            }
        }

        // Device detection
        if (/Mobile/.test(ua) && !/Tablet/.test(ua)) {
            result.device = 'mobile';
            result.isMobile = true;
            result.isDesktop = false;
        } else if (/Tablet/.test(ua) || (/iPad/.test(ua) && !/iPhone/.test(ua))) {
            result.device = 'tablet';
            result.isTablet = true;
            result.isDesktop = false;
        } else {
            // Check screen size for device type
            const width = Math.max(window.innerWidth, window.screen.width);
            if (width < 768) {
                result.device = 'mobile';
                result.isMobile = true;
                result.isDesktop = false;
            } else if (width < 1024) {
                result.device = 'tablet';
                result.isTablet = true;
                result.isDesktop = false;
            } else if (width < 1440) {
                result.device = 'laptop';
            } else {
                result.device = 'desktop';
            }
        }

        return result;
    },

    applyUAToDOM: function(info) {
        const html = document.documentElement;
        
        // Set all data attributes
        html.setAttribute('data-browser', info.browser);
        html.setAttribute('data-browser-version', info.browserVersion);
        html.setAttribute('data-os', info.os);
        html.setAttribute('data-os-version', info.osVersion);
        html.setAttribute('data-device', info.device);
        html.setAttribute('data-touch', info.isTouch.toString());
        html.setAttribute('data-high-dpi', info.isHighDPI.toString());
        html.setAttribute('data-pixel-ratio', info.pixelRatio);
        
        console.log('User Agent Detected:', info);
        return info;
    },

    getOptimizedNavigationItems: function(info, items) {
        if (info.isMobile) {
            // Simplify for mobile - use just icons
            return items.map(item => ({
                ...item,
                showText: false,
                showIcon: true
            }));
        } else if (info.isTablet) {
            // Show shorter text on tablets
            return items.map(item => ({
                ...item,
                shortLabel: item.shortLabel || item.label.substring(0, 8),
                showText: true,
                showIcon: true
            }));
        }
        // Desktop - full content
        return items.map(item => ({
            ...item,
            showText: true,
            showIcon: true
        }));
    },

    getOptimalIconSize: function(info) {
        if (info.isMobile) return '24px';
        if (info.isTablet) return '22px';
        return '20px';
    },

    getOptimalFontSize: function(info) {
        if (info.isMobile) return '13px';
        if (info.isTablet) return '14px';
        if (info.os === 'macos' || info.os === 'ios') return '16px';
        if (info.os === 'windows') return '15px';
        return '16px';
    },

    getSidebarWidth: function(info) {
        if (info.isMobile) return '100%';
        if (info.isTablet) return '200px';
        if (info.device === 'laptop') return '220px';
        return '250px';
    },

    shouldUseCompactLayout: function(info) {
        return info.isMobile || info.isTablet || 
               (info.viewportWidth < 1200 && info.isDesktop);
    },

    getFormInputPadding: function(info) {
        if (info.isMobile) return '1rem';
        if (info.isTablet) return '0.9rem';
        if (info.os === 'macos' || info.os === 'ios') return '0.85rem';
        return '0.8rem';
    }
};

// ========================================
// GLOBAL VARIABLES
// ========================================
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
    { id: 'dashboard', label: 'Dashboard', shortLabel: 'Home', icon: '📊' },
    { id: 'sales', label: 'Sales', shortLabel: 'Sales', icon: '💰' },
    { id: 'purchases', label: 'Purchases', shortLabel: 'Buy', icon: '🛒' },
    { id: 'inventory', label: 'Inventory', shortLabel: 'Stock', icon: '📦' },
    { id: 'customers', label: 'Customers', shortLabel: 'People', icon: '👥' },
    { id: 'suppliers', label: 'Suppliers', shortLabel: 'Vendors', icon: '🏪' },
    { id: 'expenses', label: 'Expenses', shortLabel: 'Costs', icon: '📉' },
    { id: 'reports', label: 'Reports', shortLabel: 'Data', icon: '📈' },
    { id: 'settings', label: 'Settings', shortLabel: 'Prefs', icon: '⚙️' }
];

let currentUser = null;
let currentPage = 'dashboard';
let deletedItems = [];
let isOffline = !navigator.onLine;
let pendingSync = JSON.parse(localStorage.getItem('pendingSync') || '[]');
let userAgentInfo = null;

// ========================================
// INITIALIZATION
// ========================================
document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    // Detect user agent first
    userAgentInfo = UA_DETECTOR.parseUserAgent();
    UA_DETECTOR.applyUAToDOM(userAgentInfo);
    
    initTheme();
    initAuth();
    initLoginForm();
    initOfflineDetection();
    initPasscodeModal();
    initResponsiveHandlers();
    
    console.log('App initialized with UA:', userAgentInfo);
}

function initResponsiveHandlers() {
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            userAgentInfo = UA_DETECTOR.parseUserAgent();
            UA_DETECTOR.applyUAToDOM(userAgentInfo);
            if (currentUser) {
                initNavigation();
                renderPage();
            }
        }, 150);
    });
    
    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            userAgentInfo = UA_DETECTOR.parseUserAgent();
            UA_DETECTOR.applyUAToDOM(userAgentInfo);
            if (currentUser) {
                initNavigation();
                renderPage();
            }
        }, 100);
    });
}

// ========================================
// THEME MANAGEMENT
// ========================================
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

// ========================================
// NAVIGATION
// ========================================
function initNavigation() {
    const navMenu = document.getElementById('nav-menu');
    if (!navMenu) return;
    
    const optimizedItems = UA_DETECTOR.getOptimizedNavigationItems(userAgentInfo, NAV_ITEMS);
    
    navMenu.innerHTML = optimizedItems.map(item => {
        const labelText = userAgentInfo.isTablet ? (item.shortLabel || item.label) : item.label;
        return `
            <li>
                <a href="#" data-page="${item.id}" class="${item.id === currentPage ? 'active' : ''}">
                    ${item.showIcon ? item.icon : ''}
                    ${item.showText ? `<span style="${userAgentInfo.isMobile ? 'display: none;' : ''}">${labelText}</span>` : ''}
                </a>
            </li>
        `;
    }).join('');
    
    navMenu.addEventListener('click', (e) => {
        const link = e.target.closest('a[data-page]');
        if (link) {
            e.preventDefault();
            currentPage = link.dataset.page;
            document.querySelectorAll('#nav-menu a').forEach(a => a.classList.remove('active'));
            link.classList.add('active');
            renderPage();
        }
    });
}

// ========================================
// AUTHENTICATION
// ========================================
function initAuth() {
    const authContainer = document.getElementById('auth-container');
    auth.onAuthStateChanged(user => {
        currentUser = user;
        if (user) {
            document.getElementById('login-screen').classList.add('hidden');
            document.getElementById('app').classList.remove('hidden');
            initNavigation();
            renderPage();
            
            const logoutText = userAgentInfo.isMobile ? 'Out' : 'Logout';
            authContainer.innerHTML = `
                <span>${userAgentInfo.isMobile ? '' : 'Hello, '}${user.email}</span>
                <button class="secondary btn-sm" onclick="logout()">${logoutText}</button>
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
    sessionStorage.removeItem('passcodeVerified');
}

// ========================================
// OFFLINE SUPPORT
// ========================================
function initOfflineDetection() {
    window.addEventListener('online', () => {
        isOffline = false;
        syncPendingItems();
    });
    window.addEventListener('offline', () => {
        isOffline = true;
    });
}

// ========================================
// PAGE RENDERING
// ========================================
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

// ========================================
// DASHBOARD
// ========================================
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
    
    const customerMap = Object.fromEntries(customers.map(c => [c.id, c.name]));
    const supplierMap = Object.fromEntries(suppliers.map(s => [s.id, s.name]));
    const inventoryMap = Object.fromEntries(inventory.map(i => [i.id, i.name]));
    
    const showCompactStats = userAgentInfo.isMobile || userAgentInfo.viewportWidth < 600;
    
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
                            ${!showCompactStats ? '<th>Type</th>' : ''}
                            <th>Details</th>
                            <th>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${allTransactions.slice(0, userAgentInfo.isMobile ? 10 : 20).map(t => {
                            let details = '';
                            let amount = 0;
                            let typeColor = '';
                            let typeLabel = '';
                            
                            if (t.type === 'sale') {
                                details = customerMap[t.customerId] || 'Unknown';
                                if (t.items && Array.isArray(t.items)) {
                                    details += ' - ' + t.items.slice(0, userAgentInfo.isMobile ? 1 : 2).map(item => inventoryMap[item.productId] || 'Unknown').join(', ');
                                } else if (t.productId) {
                                    details += ' - ' + (inventoryMap[t.productId] || 'Unknown');
                                }
                                amount = t.total;
                                typeColor = 'var(--success)';
                                typeLabel = 'Sale';
                            } else if (t.type === 'purchase') {
                                details = supplierMap[t.supplierId] || 'Unknown';
                                if (t.items && Array.isArray(t.items)) {
                                    details += ' - ' + t.items.slice(0, userAgentInfo.isMobile ? 1 : 2).map(item => inventoryMap[item.productId] || 'Unknown').join(', ');
                                } else if (t.productId) {
                                    details += ' - ' + (inventoryMap[t.productId] || 'Unknown');
                                }
                                amount = t.total;
                                typeColor = 'var(--primary)';
                                typeLabel = 'Purchase';
                            } else {
                                details = t.category;
                                if (t.items && Array.isArray(t.items)) {
                                    details += ' - ' + t.items.slice(0, userAgentInfo.isMobile ? 1 : 2).map(item => item.description || '').filter(d => d).join(', ');
                                } else if (t.description) {
                                    details += ' - ' + t.description;
                                }
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
                                ${!showCompactStats ? `<td style="color: ${typeColor}; font-weight: 600">${typeLabel}</td>` : ''}
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

// ========================================
// SALES
// ========================================
async function renderSales(container) {
    const sales = await getCollection('sales');
    const customers = await getCollection('customers');
    const inventory = await getCollection('inventory');
    
    window.inventoryData = inventory;
    window.customersData = customers;
    window.saleItemsCount = 0;
    
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
                <div id="sale-items-container">
                    <h4 style="margin-bottom: 10px; color: var(--text-alt)">Items</h4>
                </div>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem;">
                    <button type="button" class="secondary" onclick="addSaleItem()">
                        ${userAgentInfo.isMobile ? '+ Item' : '+ Add Item'}
                    </button>
                    <button type="submit">Save Sale</button>
                </div>
            </form>
        </div>
        <div class="card">
            <h2>Sales History</h2>
            <div class="search-bar">
                <input type="text" id="sales-search" placeholder="Search sales...">
                <button class="secondary" onclick="exportCSV('sales')">Export</button>
            </div>
            <div id="sales-list"></div>
        </div>
    `;
    
    addSaleItem();
    document.getElementById('sale-form').addEventListener('submit', handleSaleSubmit);
    document.getElementById('sales-search').addEventListener('input', (e) => renderSalesList(sales, e.target.value));
    renderSalesList(sales);
}

function addSaleItem() {
    const container = document.getElementById('sale-items-container');
    const itemId = Date.now();
    const div = document.createElement('div');
    div.className = 'multi-item-row';
    div.id = `sale-item-${itemId}`;
    
    const isCompact = userAgentInfo.isMobile;
    
    div.innerHTML = `
        <div class="form-group">
            <label>${isCompact ? 'Product' : 'Product'}</label>
            <select id="sale-product-${itemId}">
                <option value="">Select Product</option>
                ${window.inventoryData.map(i => `<option value="${i.id}">${i.name} (${i.quantity} in stock)</option>`).join('')}
            </select>
        </div>
        <div class="form-group">
            <label>Qty</label>
            <input type="number" id="sale-qty-${itemId}" min="1" value="1" required>
        </div>
        ${!isCompact ? `
        <div class="form-group">
            <label>Unit Price</label>
            <input type="number" id="sale-price-${itemId}" step="0.01" required>
        </div>
        ` : ''}
        <button type="button" class="btn-danger btn-sm" onclick="removeSaleItem(${itemId})">✕</button>
    `;
    container.appendChild(div);
    window.saleItemsCount++;
}

function removeSaleItem(itemId) {
    if (window.saleItemsCount <= 1) {
        alert('Must have at least one item');
        return;
    }
    document.getElementById(`sale-item-${itemId}`).remove();
    window.saleItemsCount--;
}

async function handleSaleSubmit(e) {
    e.preventDefault();
    if (!(await checkPasscodeRequired())) return;
    
    const customerId = document.getElementById('sale-customer').value;
    if (!customerId) {
        alert('Please select a customer');
        return;
    }
    
    const items = [];
    const itemRows = document.querySelectorAll('#sale-items-container .multi-item-row');
    
    for (const row of itemRows) {
        const itemId = row.id.split('-')[2];
        const productId = document.getElementById(`sale-product-${itemId}`).value;
        const qty = parseInt(document.getElementById(`sale-qty-${itemId}`).value);
        const priceInput = document.getElementById(`sale-price-${itemId}`);
        const price = priceInput ? parseFloat(priceInput.value) : 0;
        
        if (!productId || !qty) {
            alert('Please fill in all item details');
            return;
        }
        
        items.push({ productId, quantity: qty, unitPrice: price, total: qty * price });
    }
    
    const totalAmount = items.reduce((sum, item) => sum + item.total, 0);
    const sale = {
        customerId, items, total: totalAmount,
        date: new Date().toISOString(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    await addDocument('sales', sale);
    
    for (const item of items) {
        const product = await getDocument('inventory', item.productId);
        if (product) {
            await updateDocument('inventory', item.productId, { quantity: product.quantity - item.quantity });
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
                <tr>
                    <th>Date</th>
                    ${!userAgentInfo.isMobile ? '<th>Customer</th>' : ''}
                    <th>Total</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${filtered.map(s => `
                    <tr>
                        <td>${new Date(s.date).toLocaleDateString()}</td>
                        ${!userAgentInfo.isMobile ? `<td>${customerMap[s.customerId] || 'Unknown'}</td>` : ''}
                        <td>₹${s.total.toFixed(2)}</td>
                        <td class="actions">
                            ${!userAgentInfo.isMobile ? `<button class="btn-sm secondary" onclick="generateQR('sale', '${s.id}')">QR</button>` : ''}
                            <button class="btn-sm btn-danger" onclick="deleteItem('sales', '${s.id}')">✕</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// ========================================
// PURCHASES
// ========================================
async function renderPurchases(container) {
    const purchases = await getCollection('purchases');
    const suppliers = await getCollection('suppliers');
    const inventory = await getCollection('inventory');
    
    window.inventoryData = inventory;
    window.suppliersData = suppliers;
    window.purchaseItemsCount = 0;
    
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
                <div id="purchase-items-container">
                    <h4 style="margin-bottom: 10px; color: var(--text-alt)">Items</h4>
                </div>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem;">
                    <button type="button" class="secondary" onclick="addPurchaseItem()">
                        ${userAgentInfo.isMobile ? '+ Item' : '+ Add Item'}
                    </button>
                    <button type="submit">Save Purchase</button>
                </div>
            </form>
        </div>
        <div class="card">
            <h2>Purchase History</h2>
            <div class="search-bar">
                <input type="text" id="purchases-search" placeholder="Search purchases...">
                <button class="secondary" onclick="exportCSV('purchases')">Export</button>
            </div>
            <div id="purchases-list"></div>
        </div>
    `;
    
    addPurchaseItem();
    document.getElementById('purchase-form').addEventListener('submit', handlePurchaseSubmit);
    document.getElementById('purchases-search').addEventListener('input', (e) => renderPurchasesList(purchases, e.target.value));
    renderPurchasesList(purchases);
}

function addPurchaseItem() {
    const container = document.getElementById('purchase-items-container');
    const itemId = Date.now();
    const div = document.createElement('div');
    div.className = 'multi-item-row';
    div.id = `purchase-item-${itemId}`;
    
    const isCompact = userAgentInfo.isMobile;
    
    div.innerHTML = `
        <div class="form-group">
            <label>Product</label>
            <select id="purchase-product-${itemId}">
                <option value="">Select Product</option>
                ${window.inventoryData.map(i => `<option value="${i.id}">${i.name}</option>`).join('')}
            </select>
        </div>
        <div class="form-group">
            <label>Qty</label>
            <input type="number" id="purchase-qty-${itemId}" min="1" value="1" required>
        </div>
        ${!isCompact ? `
        <div class="form-group">
            <label>Unit Cost</label>
            <input type="number" id="purchase-cost-${itemId}" step="0.01" required>
        </div>
        ` : ''}
        <button type="button" class="btn-danger btn-sm" onclick="removePurchaseItem(${itemId})">✕</button>
    `;
    container.appendChild(div);
    window.purchaseItemsCount++;
}

function removePurchaseItem(itemId) {
    if (window.purchaseItemsCount <= 1) {
        alert('Must have at least one item');
        return;
    }
    document.getElementById(`purchase-item-${itemId}`).remove();
    window.purchaseItemsCount--;
}

async function handlePurchaseSubmit(e) {
    e.preventDefault();
    if (!(await checkPasscodeRequired())) return;
    
    const supplierId = document.getElementById('purchase-supplier').value;
    if (!supplierId) {
        alert('Please select a supplier');
        return;
    }
    
    const items = [];
    const itemRows = document.querySelectorAll('#purchase-items-container .multi-item-row');
    
    for (const row of itemRows) {
        const itemId = row.id.split('-')[2];
        const productId = document.getElementById(`purchase-product-${itemId}`).value;
        const qty = parseInt(document.getElementById(`purchase-qty-${itemId}`).value);
        const costInput = document.getElementById(`purchase-cost-${itemId}`);
        const cost = costInput ? parseFloat(costInput.value) : 0;
        
        if (!productId || !qty) {
            alert('Please fill in all item details');
            return;
        }
        
        items.push({ productId, quantity: qty, unitCost: cost, total: qty * cost });
    }
    
    const totalAmount = items.reduce((sum, item) => sum + item.total, 0);
    const purchase = {
        supplierId, items, total: totalAmount,
        date: new Date().toISOString(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    await addDocument('purchases', purchase);
    
    for (const item of items) {
        const product = await getDocument('inventory', item.productId);
        if (product) {
            await updateDocument('inventory', item.productId, { quantity: product.quantity + item.quantity });
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
                <tr>
                    <th>Date</th>
                    ${!userAgentInfo.isMobile ? '<th>Supplier</th>' : ''}
                    <th>Total</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${filtered.map(p => `
                    <tr>
                        <td>${new Date(p.date).toLocaleDateString()}</td>
                        ${!userAgentInfo.isMobile ? `<td>${supplierMap[p.supplierId] || 'Unknown'}</td>` : ''}
                        <td>₹${p.total.toFixed(2)}</td>
                        <td class="actions">
                            <button class="btn-sm btn-danger" onclick="deleteItem('purchases', '${p.id}')">✕</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// ========================================
// INVENTORY
// ========================================
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
                ${!userAgentInfo.isMobile ? `
                <div class="form-group">
                    <label>SKU</label>
                    <input type="text" id="inv-sku">
                </div>
                ` : ''}
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
                <button class="secondary" onclick="exportCSV('inventory')">Export</button>
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
    if (!(await checkPasscodeRequired())) return;
    
    const product = {
        name: document.getElementById('inv-name').value,
        sku: document.getElementById('inv-sku')?.value || '',
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
                <tr>
                    <th>Name</th>
                    ${!userAgentInfo.isMobile ? '<th>SKU</th>' : ''}
                    <th>Qty</th>
                    ${!userAgentInfo.isMobile ? '<th>Cost</th><th>Price</th>' : ''}
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${filtered.map(i => `
                    <tr>
                        <td>${i.name}</td>
                        ${!userAgentInfo.isMobile ? `<td>${i.sku || '-'}</td>` : ''}
                        <td style="color: ${i.quantity < 10 ? 'var(--danger)' : 'var(--success)'}">${i.quantity}</td>
                        ${!userAgentInfo.isMobile ? `
                        <td>₹${i.costPrice.toFixed(2)}</td>
                        <td>₹${i.sellingPrice.toFixed(2)}</td>
                        ` : ''}
                        <td class="actions">
                            <button class="btn-sm btn-danger" onclick="deleteItem('inventory', '${i.id}')">✕</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// ========================================
// CUSTOMERS & SUPPLIERS
// ========================================
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
                ${!userAgentInfo.isMobile ? `
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
                ` : ''}
                <button type="submit">Add Customer</button>
            </form>
        </div>
        <div class="card">
            <h2>Customers</h2>
            <div class="search-bar">
                <input type="text" id="customers-search" placeholder="Search customers...">
                <button class="secondary" onclick="exportCSV('customers')">Export</button>
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
    if (!(await checkPasscodeRequired())) return;
    
    const customer = {
        name: document.getElementById('cust-name').value,
        email: document.getElementById('cust-email')?.value || '',
        phone: document.getElementById('cust-phone')?.value || '',
        address: document.getElementById('cust-address')?.value || '',
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
                <tr>
                    <th>Name</th>
                    ${!userAgentInfo.isMobile ? '<th>Email</th><th>Phone</th>' : ''}
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${filtered.map(c => `
                    <tr>
                        <td>${c.name}</td>
                        ${!userAgentInfo.isMobile ? `
                        <td>${c.email || '-'}</td>
                        <td>${c.phone || '-'}</td>
                        ` : ''}
                        <td class="actions">
                            <button class="btn-sm btn-danger" onclick="deleteItem('customers', '${c.id}')">✕</button>
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
                ${!userAgentInfo.isMobile ? `
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
                ` : ''}
                <button type="submit">Add Supplier</button>
            </form>
        </div>
        <div class="card">
            <h2>Suppliers</h2>
            <div class="search-bar">
                <input type="text" id="suppliers-search" placeholder="Search suppliers...">
                <button class="secondary" onclick="exportCSV('suppliers')">Export</button>
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
    if (!(await checkPasscodeRequired())) return;
    
    const supplier = {
        name: document.getElementById('sup-name').value,
        email: document.getElementById('sup-email')?.value || '',
        phone: document.getElementById('sup-phone')?.value || '',
        address: document.getElementById('sup-address')?.value || '',
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
                <tr>
                    <th>Name</th>
                    ${!userAgentInfo.isMobile ? '<th>Email</th><th>Phone</th>' : ''}
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${filtered.map(s => `
                    <tr>
                        <td>${s.name}</td>
                        ${!userAgentInfo.isMobile ? `
                        <td>${s.email || '-'}</td>
                        <td>${s.phone || '-'}</td>
                        ` : ''}
                        <td class="actions">
                            <button class="btn-sm btn-danger" onclick="deleteItem('suppliers', '${s.id}')">✕</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// ========================================
// EXPENSES
// ========================================
async function renderExpenses(container) {
    const expenses = await getCollection('expenses');
    window.expenseItemsCount = 0;
    
    container.innerHTML = `
        <div class="card">
            <h2>Add Expense</h2>
            <form id="expense-form">
                <div class="form-group">
                    <label>Category</label>
                    <input type="text" id="exp-cat" required>
                </div>
                <div id="expense-items-container">
                    <h4 style="margin-bottom: 10px; color: var(--text-alt)">Items</h4>
                </div>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem;">
                    <button type="button" class="secondary" onclick="addExpenseItem()">
                        ${userAgentInfo.isMobile ? '+ Item' : '+ Add Item'}
                    </button>
                    <button type="submit">Save Expense</button>
                </div>
            </form>
        </div>
        <div class="card">
            <h2>Expenses</h2>
            <div class="search-bar">
                <input type="text" id="expenses-search" placeholder="Search expenses...">
                <button class="secondary" onclick="exportCSV('expenses')">Export</button>
            </div>
            <div id="expenses-list"></div>
        </div>
    `;
    
    addExpenseItem();
    document.getElementById('expense-form').addEventListener('submit', handleExpenseSubmit);
    document.getElementById('expenses-search').addEventListener('input', (e) => renderExpensesList(expenses, e.target.value));
    renderExpensesList(expenses);
}

function addExpenseItem() {
    const container = document.getElementById('expense-items-container');
    const itemId = Date.now();
    const div = document.createElement('div');
    div.className = 'multi-item-row';
    div.id = `expense-item-${itemId}`;
    
    div.innerHTML = `
        <div class="form-group">
            <label>Description</label>
            <textarea id="exp-desc-${itemId}" required></textarea>
        </div>
        <div class="form-group">
            <label>Amount</label>
            <input type="number" id="exp-amount-${itemId}" step="0.01" required>
        </div>
        <button type="button" class="btn-danger btn-sm" onclick="removeExpenseItem(${itemId})">✕</button>
    `;
    container.appendChild(div);
    window.expenseItemsCount++;
}

function removeExpenseItem(itemId) {
    if (window.expenseItemsCount <= 1) {
        alert('Must have at least one item');
        return;
    }
    document.getElementById(`expense-item-${itemId}`).remove();
    window.expenseItemsCount--;
}

async function handleExpenseSubmit(e) {
    e.preventDefault();
    if (!(await checkPasscodeRequired())) return;
    
    const category = document.getElementById('exp-cat').value;
    if (!category) {
        alert('Please enter a category');
        return;
    }
    
    const items = [];
    const itemRows = document.querySelectorAll('#expense-items-container .multi-item-row');
    
    for (const row of itemRows) {
        const itemId = row.id.split('-')[2];
        const description = document.getElementById(`exp-desc-${itemId}`).value;
        const amount = parseFloat(document.getElementById(`exp-amount-${itemId}`).value);
        
        if (!description || !amount) {
            alert('Please fill in all item details');
            return;
        }
        
        items.push({ description, amount });
    }
    
    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
    const expense = {
        category, items, amount: totalAmount,
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
                <tr>
                    <th>Date</th>
                    ${!userAgentInfo.isMobile ? '<th>Category</th>' : ''}
                    <th>Amount</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${filtered.map(e => `
                    <tr>
                        <td>${new Date(e.date).toLocaleDateString()}</td>
                        ${!userAgentInfo.isMobile ? `<td>${e.category}</td>` : ''}
                        <td>₹${e.amount.toFixed(2)}</td>
                        <td class="actions">
                            <button class="btn-sm btn-danger" onclick="deleteItem('expenses', '${e.id}')">✕</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// ========================================
// REPORTS
// ========================================
async function renderReports(container) {
    const [sales, purchases, expenses] = await Promise.all([
        getCollection('sales'),
        getCollection('purchases'),
        getCollection('expenses')
    ]);
    
    const totalSales = sales.reduce((sum, s) => sum + (s.total || 0), 0);
    const totalPurchases = purchases.reduce((sum, p) => sum + (p.total || 0), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const grossProfit = totalSales - totalPurchases;
    const netProfit = totalSales - totalPurchases - totalExpenses;
    
    container.innerHTML = `
        <div class="card">
            <h2>Profit Report</h2>
            <div class="stats-grid">
                <div class="stat-card">
                    <h3>Total Revenue</h3>
                    <p>₹${totalSales.toFixed(2)}</p>
                </div>
                <div class="stat-card">
                    <h3>Total COGS</h3>
                    <p>₹${totalPurchases.toFixed(2)}</p>
                </div>
                <div class="stat-card">
                    <h3>Total Expenses</h3>
                    <p>₹${totalExpenses.toFixed(2)}</p>
                </div>
                <div class="stat-card">
                    <h3>Gross Profit</h3>
                    <p>₹${grossProfit.toFixed(2)}</p>
                </div>
                <div class="stat-card">
                    <h3>Net Profit</h3>
                    <p>₹${netProfit.toFixed(2)}</p>
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

// ========================================
// SETTINGS
// ========================================
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
            ${!userAgentInfo.isMobile ? `
            <div class="form-group">
                <label>Google Sheets Webhook URL (for backup)</label>
                <input type="text" id="sheets-url" placeholder="Enter webhook URL" value="${localStorage.getItem('sheetsUrl') || ''}">
                <button class="secondary" onclick="localStorage.setItem('sheetsUrl', document.getElementById('sheets-url').value)">Save</button>
            </div>
            ` : ''}
            <div class="form-group">
                <label>Passcode (for data entry)</label>
                <div id="passcode-settings"></div>
            </div>
        </div>
    `;
    
    initPasscodeSettings();
}

// ========================================
// PASSCODE MANAGEMENT
// ========================================
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
        if (e.key === 'Enter') handlePasscodeSubmit();
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
    if (passcodeModal) passcodeModal.classList.add('hidden');
}

async function handlePasscodeSubmit() {
    const code = passcodeInput.value.trim();
    if (code.length !== 4 || !/^\d{4}$/.test(code)) {
        passcodeError.textContent = 'Please enter a valid 4-digit passcode';
        return;
    }

    const storedPasscode = await getPasscode();
    if (storedPasscode === null) {
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

async function initPasscodeSettings() {
    const passcodeSettingsDiv = document.getElementById('passcode-settings');
    if (!passcodeSettingsDiv) return;

    const passcode = await getPasscode();
    if (passcode === null) {
        passcodeSettingsDiv.innerHTML = `
            <p>No passcode set</p>
            <div class="form-group">
                <label>Set New 4-digit Passcode</label>
                <input type="password" id="new-passcode" maxlength="4" placeholder="____">
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
                    <label>Verify Old Passcode</label>
                    <input type="password" id="old-passcode-input" maxlength="4" placeholder="____">
                </div>
                <div class="form-group">
                    <label>Enter New 4-digit Passcode</label>
                    <input type="password" id="change-passcode-input" maxlength="4" placeholder="____">
                </div>
                <button class="secondary" onclick="saveNewPasscode()">Save</button>
                <button class="secondary" onclick="hideChangePasscodeForm()">Cancel</button>
                <div id="change-passcode-error" class="error"></div>
            </div>
            <div id="remove-passcode-form" class="hidden">
                <div class="form-group">
                    <label>Verify Old Passcode</label>
                    <input type="password" id="remove-passcode-input" maxlength="4" placeholder="____">
                </div>
                <button class="btn-danger" onclick="confirmRemovePasscode()">Remove</button>
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
    document.getElementById('remove-passcode-form').classList.add('hidden');
    document.getElementById('old-passcode-input').focus();
}

function hideChangePasscodeForm() {
    document.getElementById('change-passcode-form').classList.add('hidden');
    document.getElementById('old-passcode-input').value = '';
    document.getElementById('change-passcode-input').value = '';
    document.getElementById('change-passcode-error').textContent = '';
}

function showRemovePasscodeForm() {
    document.getElementById('remove-passcode-form').classList.remove('hidden');
    document.getElementById('change-passcode-form').classList.add('hidden');
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
    const oldCode = oldInput.value.trim();
    const newCode = newInput.value.trim();
    const storedPasscode = await getPasscode();
    
    if (oldCode !== storedPasscode) {
        document.getElementById('change-passcode-error').textContent = 'Incorrect old passcode';
        return;
    }
    if (newCode.length !== 4 || !/^\d{4}$/.test(newCode)) {
        document.getElementById('change-passcode-error').textContent = 'Please enter a valid 4-digit passcode';
        return;
    }
    try {
        await setPasscode(newCode);
        alert('Passcode changed successfully');
        hideChangePasscodeForm();
        initPasscodeSettings();
    } catch (err) {
        document.getElementById('change-passcode-error').textContent = 'Error changing passcode: ' + err.message;
    }
}

async function confirmRemovePasscode() {
    const input = document.getElementById('remove-passcode-input');
    const code = input.value.trim();
    const storedPasscode = await getPasscode();
    
    if (code !== storedPasscode) {
        document.getElementById('remove-passcode-error').textContent = 'Incorrect passcode';
        return;
    } else {
        try {
            await removePasscode();
            alert('Passcode removed successfully');
            hideRemovePasscodeForm();
            initPasscodeSettings();
        } catch (err) {
            document.getElementById('remove-passcode-error').textContent = 'Error removing passcode: ' + err.message;
        }
    }
}

async function checkPasscodeRequired() {
    const passcode = await getPasscode();
    if (passcode === null) return true;
    
    if (sessionStorage.getItem('passcodeVerified') === 'true') return true;
    
    return new Promise((resolve) => {
        showPasscodeModal();
        
        const submitHandler = async () => {
            const code = passcodeInput.value.trim();
            if (code.length === 4 && /^\d{4}$/.test(code) && code === passcode) {
                sessionStorage.setItem('passcodeVerified', 'true');
                hidePasscodeModal();
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
            passcodeSubmitBtn.removeEventListener('click', submitHandler);
            passcodeCancelBtn.removeEventListener('click', cancelHandler);
            passcodeInput.removeEventListener('keypress', keypressHandler);
            resolve(false);
        };
        
        const keypressHandler = (e) => {
            if (e.key === 'Enter') submitHandler();
        };
        
        passcodeSubmitBtn.addEventListener('click', submitHandler);
        passcodeCancelBtn.addEventListener('click', cancelHandler);
        passcodeInput.addEventListener('keypress', keypressHandler);
    });
}

// ========================================
// DATABASE FUNCTIONS
// ========================================
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
    if (!(await checkPasscodeRequired())) return;
    
    const doc = await getDocument(collection, id);
    if (!doc) return;
    
    await db.collection(COLLECTIONS.deleted).add({
        collection, data: doc,
        deletedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    await db.collection(collection).doc(id).delete();
    renderPage();
}

async function syncPendingItems() {
    const toSync = [...pendingSync];
    pendingSync = [];
    localStorage.setItem('pendingSync', '[]');
    
    for (const item of toSync) {
        if (item.action === 'add') {
            await db.collection(item.collection).add(item.data);
        } else if (item.action === 'update' && item.id) {
            await db.collection(item.collection).doc(item.id).update(item.data);
        }
    }
}

// ========================================
// EXPORT & UTILITY FUNCTIONS
// ========================================
function exportCSV(collection) {
    getCollection(collection).then(data => {
        if (!data.length) {
            alert('No data to export');
            return;
        }
        
        const headers = Object.keys(data[0]).filter(k => k !== 'id');
        const csv = [
            headers.join(','),
            ...data.map(row => 
                headers.map(h => {
                    let value = row[h];
                    if (typeof value === 'string') {
                        value = value.replace(/"/g, '""');
                        if (value.includes(',') || value.includes('\n')) {
                            value = `"${value}"`;
                        }
                    }
                    return value;
                }).join(',')
            )
        ].join('\n');
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${collection}_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
}

function exportAllCSV() {
    Promise.all(['sales', 'purchases', 'expenses', 'inventory', 'customers', 'suppliers'].map(c => 
        getCollection(c).then(data => ({ collection: c, data }))
    )).then(results => {
        results.forEach(({ collection, data }) => {
            if (data.length) {
                const headers = Object.keys(data[0]).filter(k => k !== 'id');
                const csv = [
                    headers.join(','),
                    ...data.map(row => 
                        headers.map(h => {
                            let value = row[h];
                            if (typeof value === 'string') {
                                value = value.replace(/"/g, '""');
                                if (value.includes(',') || value.includes('\n')) {
                                    value = `"${value}"`;
                                }
                            }
                            return value;
                        }).join(',')
                    )
                ].join('\n');
                
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${collection}_${new Date().toISOString().split('T')[0]}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        });
    });
}

async function syncToSheets() {
    const webhookUrl = localStorage.getItem('sheetsUrl');
    if (!webhookUrl) {
        alert('Please set Google Sheets webhook URL in settings');
        return;
    }
    
    const data = await Promise.all([
        getCollection('sales'),
        getCollection('purchases'),
        getCollection('expenses')
    ]);
    
    try {
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sales: data[0],
                purchases: data[1],
                expenses: data[2],
                syncedAt: new Date().toISOString()
            })
        });
        alert('Sync complete!');
    } catch (err) {
        console.error('Sync error:', err);
        alert('Sync failed');
    }
}

async function generateQR(type, id) {
    let data;
    if (type === 'sale') data = await getDocument('sales', id);
    if (type === 'purchase') data = await getDocument('purchases', id);
    if (!data) return;
    
    const qrData = JSON.stringify({ type, id, ...data });
    const qrCodeContainer = document.createElement('div');
    qrCodeContainer.className = 'qr-code';
    qrCodeContainer.id = 'qr-display';
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>QR Code</h3>
            <div id="qr-container"></div>
            <div class="modal-actions">
                <button class="secondary" onclick="this.closest('.modal').remove()">Close</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.classList.remove('hidden');
    
    if (typeof QRCode !== 'undefined') {
        new QRCode(document.getElementById('qr-container'), qrData);
    } else {
        document.getElementById('qr-container').innerHTML = `<p style="text-align: center">QR code library not available</p><pre>${JSON.stringify(data, null, 2)}</pre>`;
    }
}

console.log('App loaded successfully!');
console.log('User Agent Info:', navigator.userAgent);
console.log('Detected Device:', userAgentInfo?.device || 'Unknown');

