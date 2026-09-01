// 1. استيراد مكتبات Firebase بالطريقة الحديثة والاصدار المستقر
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, query, orderBy } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

// 2. إعدادات فايربيس الخاصة بمشروعك
const firebaseConfig = {
    apiKey: "AIzaSyAjf1_jvN1e98c4c-QwUtqg3_UAxMRak3k",
    authDomain: "shop-managment-ab098.firebaseapp.com",
    projectId: "shop-managment-ab098",
    storageBucket: "shop-managment-ab098.firebasestorage.app",
    messagingSenderId: "80638375251",
    appId: "1:80638375251:web:5546bb963a9ff4d4dfc266"
};

// 3. تهيئة التطبيق وقاعدة البيانات وتصديرها
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// نظام إدارة المحل - نسخة مستقرة مع دعم Firebase + fallback محلي
const users = {
    'عزوز': '1122334455',
    'معتز': '1122332211'
};

const currency = ' د.ع';
const STORAGE_KEY = 'shop_sales_local';
const USER_KEY = 'shop_current_user';

let currentUser = null;
let selectedUser = null;
let allSales = [];
let filteredSales = [];
let firebaseReady = true;

// دالة ذكية لتنسيق المبالغ وعرضها بشكل نظيف بدون أصفار زايدة، مع دعم البوينتات الحقيقية
function formatMoney(amount) {
    let num = parseFloat(amount);
    if (isNaN(num)) return "0";
    return Number(num.toFixed(4)).toString();
}

document.addEventListener('DOMContentLoaded', async function () {
    setTodayDates();
    await loadSales();

    // التحقق هل كان المستخدم مسجل دخول سابقاً قبل الرفرش
    const savedUser = localStorage.getItem(USER_KEY);
    if (savedUser && users[savedUser]) {
        currentUser = savedUser;
        document.getElementById('userSelectScreen').classList.remove('active');
        document.getElementById('pinScreen').classList.remove('active');
        document.getElementById('mainScreen').classList.add('active');
        document.getElementById('currentUser').textContent = `👤 ${currentUser}`;
        updateRecentSales();
        resetFilters();
    } else {
        currentUser = null;
        selectedUser = null;
        localStorage.removeItem(USER_KEY);
        showUserSelect();
    }
});

function showUserSelect() {
    document.getElementById('mainScreen').classList.remove('active');
    document.getElementById('pinScreen').classList.remove('active');
    document.getElementById('userSelectScreen').classList.add('active');
}

async function loadSales() {
    const fallbackSales = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    allSales = Array.isArray(fallbackSales) ? fallbackSales : [];

    if (db && firebaseReady) {
        try {
            const q = query(collection(db, 'sales'), orderBy('timestamp', 'desc'));
            const snapshot = await getDocs(q);
            const firebaseSales = [];

            snapshot.forEach(docSnap => {
                firebaseSales.push({ id: docSnap.id, ...docSnap.data() });
            });

            if (firebaseSales.length > 0) {
                allSales = firebaseSales;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(allSales));
            }

            console.log('✅ تم تحميل البيانات من Firebase');
        } catch (error) {
            console.warn('⚠️ Firebase غير متاح، سيتم استخدام البيانات المحلية:', error.message);
            allSales = fallbackSales;
        }
    }

    allSales.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    filteredSales = [...allSales];
    updateReportDisplay();
    updateRecentSales();
}

function saveLocalSales() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allSales));
}

window.selectUser = function(username) {
    selectedUser = username;
    document.getElementById('userSelectScreen').classList.remove('active');
    document.getElementById('pinScreen').classList.add('active');
    document.getElementById('pinUserDisplay').textContent = `المستخدم: 👤 ${username}`;
    document.getElementById('pinInput').value = '';
    document.getElementById('pinError').textContent = '';
    setTimeout(() => document.getElementById('pinInput').focus(), 100);
};

window.verifyPin = function(event) {
    event.preventDefault();

    const enteredPin = document.getElementById('pinInput').value;
    const correctPin = users[selectedUser];

    if (!selectedUser || !correctPin) {
        document.getElementById('pinError').textContent = '❌ اختر مستخدمًا أولاً';
        return;
    }

    if (enteredPin === correctPin) {
        currentUser = selectedUser;
        localStorage.setItem(USER_KEY, currentUser);

        document.getElementById('pinScreen').classList.remove('active');
        document.getElementById('mainScreen').classList.add('active');
        document.getElementById('currentUser').textContent = `👤 ${currentUser}`;
        updateRecentSales();
        resetFilters();
    } else {
        document.getElementById('pinError').textContent = '❌ الرمز الأمني غير صحيح!';
        document.getElementById('pinInput').value = '';
        document.getElementById('pinInput').focus();
    }
};

window.backToUserSelect = function() {
    selectedUser = null;
    document.getElementById('pinScreen').classList.remove('active');
    document.getElementById('userSelectScreen').classList.add('active');
    document.getElementById('pinInput').value = '';
    document.getElementById('pinError').textContent = '';
};

window.logout = function() {
    if (confirm('هل تريد تسجيل الخروج؟')) {
        currentUser = null;
        selectedUser = null;
        localStorage.removeItem(USER_KEY);
        document.getElementById('mainScreen').classList.remove('active');
        document.getElementById('userSelectScreen').classList.add('active');
        document.getElementById('salesForm').reset();
    }
};

window.switchTab = function(tabName, event) {
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.classList.remove('active'));

    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabName));

    const selectedTab = document.getElementById(tabName + 'Tab');
    if (selectedTab) {
        selectedTab.classList.add('active');
    }

    if (tabName === 'reports') {
        resetFilters();
    }
};

window.addSale = async function(event) {
    event.preventDefault();

    if (!currentUser) {
        alert('يرجى تسجيل الدخول أولاً');
        return;
    }

    const saleType = document.getElementById('saleType').value;
    const itemName = document.getElementById('itemName').value.trim();
    
    const price = parseFloat(document.getElementById('price').value);
    const quantity = parseFloat(document.getElementById('quantity').value);
    const notes = document.getElementById('notes').value.trim();

    if (!saleType || !itemName || isNaN(price) || isNaN(quantity)) {
        alert('يرجى ملء جميع الحقول المطلوبة بشكل صحيح');
        return;
    }

    const now = new Date();
    const newSale = {
        id: '',
        date: now.toLocaleDateString('ar-SA'),
        time: now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
        user: currentUser,
        type: saleType,
        itemName,
        price,
        quantity,
        total: price * quantity,
        notes,
        timestamp: now.getTime()
    };

    try {
        if (db && firebaseReady) {
            const docRef = await addDoc(collection(db, 'sales'), newSale);
            newSale.id = docRef.id;
        } else {
            newSale.id = 'local-' + Date.now();
        }

        allSales.unshift(newSale);
        saveLocalSales();
        document.getElementById('salesForm').reset();
        updateRecentSales();
        resetFilters();
        showSuccessMessage('تم حفظ العملية بنجاح ✓');
    } catch (error) {
        console.error('خطأ في حفظ العملية:', error);
        alert('حدثت مشكلة أثناء الحفظ: ' + error.message);
    }
};

function updateRecentSales() {
    const container = document.getElementById('recentSalesList');
    const today = new Date().toLocaleDateString('ar-SA');
    const todaySales = allSales.filter(sale => sale.date === today);

    if (todaySales.length === 0) {
        container.innerHTML = '<p class="empty-msg">لا توجد عمليات بيع حتى الآن</p>';
        return;
    }

    container.innerHTML = todaySales.map(sale => `
        <div class="sale-item">
            <div class="sale-item-header">
                <span class="sale-item-type">${sale.type}</span>
                <span class="sale-item-time">${sale.time}</span>
                <button class="delete-btn-small" onclick="deleteSale('${sale.id || ''}', '${sale.itemName || ''}', ${sale.price || 0}, '${sale.time || ''}')">حذف</button>
            </div>
            <div class="sale-item-details">
                <div class="sale-item-detail">
                    <span>المادة:</span>
                    <strong>${sale.itemName}</strong>
                </div>
                <div class="sale-item-detail">
                    <span>السعر:</span>
                    <strong>${formatMoney(sale.price)}${currency}</strong>
                </div>
                <div class="sale-item-detail">
                    <span>الكمية:</span>
                    <strong>${formatMoney(sale.quantity)}</strong>
                </div>
                <div class="sale-item-detail">
                    <span>الإجمالي:</span>
                    <strong>${formatMoney(sale.total)}${currency}</strong>
                </div>
                ${sale.notes ? `<div class="sale-item-detail">
                    <span>ملاحظات:</span>
                    <strong>${sale.notes}</strong>
                </div>` : ''}
            </div>
        </div>
    `).join('');
}

// دالة الحذف الذكية والمحدثة نهائياً للتعامل مع الـ ID التالف أو البيانات المفقودة
window.deleteSale = async function(id, itemName, salePrice, saleTime) {
    if (!confirm('هل أنت متأكد من حذف هذه العملية؟')) return;

    try {
        const stringId = String(id || '').trim();
        console.log("محاولة حذف العنصر، الـ ID:", stringId);

        // 1. محاولة الحذف من فايربيس إذا كان الـ ID حقيقي ومو تالف
        if (db && firebaseReady && stringId && !stringId.startsWith('local-') && stringId !== 'undefined' && stringId !== 'null' && stringId !== '') {
            try {
                await deleteDoc(doc(db, 'sales', stringId));
                console.log("✅ تم الحذف من قاعدة بيانات Firebase بنجاح");
            } catch (fbErr) {
                console.warn("⚠️ لم يتم العثور على المستند في فايربيس بالـ ID، سيتم حذفه محلياً:", fbErr);
            }
        }

        // 2. تصفية المصفوفة محلياً (مطابقة بالـ ID أو بمحتوى العنصر إذا كان الـ ID تالف)
        allSales = allSales.filter(sale => {
            const currentId = String(sale.id || '').trim();
            const isIdMatch = currentId === stringId && stringId !== '' && stringId !== 'undefined' && stringId !== 'null';
            const isDataMatch = sale.itemName === itemName && Number(sale.price) === Number(salePrice) && sale.time === saleTime;
            
            // إرجاع العناصر التي لا تطابق العنصر المراد حذفه
            return !(isIdMatch || isDataMatch);
        });
        
        // 3. حفظ التحديث الجديد فوراً في التخزين المحلي لضمان عدم عودته عند الرفرش
        saveLocalSales();

        // 4. إعادة ضبط الفلاتر والعرض
        filteredSales = [...allSales];
        updateRecentSales();
        
        if (document.getElementById('reportsTab').classList.contains('active')) {
            applyFilters();
        } else {
            resetFilters();
        }

        showSuccessMessage('تم حذف العملية بنجاح ✓');
    } catch (error) {
        console.error('❌ خطأ تفصيلي أثناء الحذف:', error);
        alert('فشل الحذف: ' + error.message);
    }
};

window.applyFilters = function() {
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    const filterUser = document.getElementById('filterUser').value;

    filteredSales = allSales.filter(sale => {
        let match = true;

        if (dateFrom) {
            const fromDate = new Date(dateFrom);
            const saleDate = parseDate(sale.date);
            if (saleDate < fromDate) match = false;
        }

        if (dateTo) {
            const toDate = new Date(dateTo);
            const saleDate = parseDate(sale.date);
            if (saleDate > toDate) match = false;
        }

        if (filterUser && sale.user !== filterUser) {
            match = false;
        }

        return match;
    });

    updateReportDisplay();
};

window.resetFilters = function() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('dateFrom').value = today;
    document.getElementById('dateTo').value = today;
    document.getElementById('filterUser').value = '';
    filteredSales = [...allSales];
    updateReportDisplay();
};

function setTodayDates() {
    const today = new Date().toISOString().split('T')[0];
    const dateFromEl = document.getElementById('dateFrom');
    const dateToEl = document.getElementById('dateTo');
    if (dateFromEl) dateFromEl.value = today;
    if (dateToEl) dateToEl.value = today;
}

function parseDate(dateString) {
    const parts = dateString.split('/');
    if (parts.length === 3) {
        return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    return new Date(dateString);
}

function updateReportDisplay() {
    updateSummary();
    updateCategoryBreakdown();
    updateUserBreakdown();
    updateDetailsTable();
}

function updateSummary() {
    const totalSales = filteredSales.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
    const totalTransactions = filteredSales.length;

    document.getElementById('totalSales').textContent = formatMoney(totalSales) + currency;
    document.getElementById('totalTransactions').textContent = totalTransactions;
}

function updateCategoryBreakdown() {
    const breakdown = {};

    filteredSales.forEach(sale => {
        if (!breakdown[sale.type]) {
            breakdown[sale.type] = { count: 0, total: 0 };
        }
        breakdown[sale.type].count += 1;
        breakdown[sale.type].total += Number(sale.total) || 0;
    });

    const container = document.getElementById('categoryBreakdown');
    if (Object.keys(breakdown).length === 0) {
        container.innerHTML = '<p class="empty-msg">لا توجد بيانات</p>';
        return;
    }

    container.innerHTML = Object.entries(breakdown).map(([type, data]) => `
        <div class="category-item">
            <span class="category-item-name">${type}</span>
            <span class="category-item-value">${formatMoney(data.total)}${currency}</span>
            <span style="color: #999; font-size: 0.9em;">(${data.count} عملية)</span>
        </div>
    `).join('');
}

function updateUserBreakdown() {
    const breakdown = {};

    filteredSales.forEach(sale => {
        if (!breakdown[sale.user]) {
            breakdown[sale.user] = { count: 0, total: 0 };
        }
        breakdown[sale.user].count += 1;
        breakdown[sale.user].total += Number(sale.total) || 0;
    });

    const container = document.getElementById('userBreakdown');
    if (Object.keys(breakdown).length === 0) {
        container.innerHTML = '<p class="empty-msg">لا توجد بيانات</p>';
        return;
    }

    container.innerHTML = Object.entries(breakdown).map(([user, data]) => `
        <div class="user-item">
            <span class="user-item-name">👤 ${user}</span>
            <span class="user-item-value">${formatMoney(data.total)}${currency}</span>
            <span style="color: #999; font-size: 0.9em;">(${data.count} عملية)</span>
        </div>
    `).join('');
}

function updateDetailsTable() {
    const tableBody = document.getElementById('detailsTableBody');

    if (!tableBody) return;

    if (filteredSales.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="9" class="empty-msg">لا توجد عمليات</td></tr>';
        return;
    }

    tableBody.innerHTML = filteredSales.map(sale => `
        <tr>
            <td>${sale.date} ${sale.time}</td>
            <td>${sale.user}</td>
            <td>${sale.type}</td>
            <td>${sale.itemName}</td>
            <td>${formatMoney(sale.price)}${currency}</td>
            <td>${formatMoney(sale.quantity)}</td>
            <td>${formatMoney(sale.total)}${currency}</td>
            <td>${sale.notes || '-'}</td>
            <td>
                <button class="delete-btn" onclick="deleteSale('${sale.id || ''}', '${sale.itemName || ''}', ${sale.price || 0}, '${sale.time || ''}')">حذف</button>
            </td>
        </tr>
    `).join('');
}

function showSuccessMessage(message) {
    const msg = document.createElement('div');
    msg.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4caf50;
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        z-index: 1000;
        box-shadow: 0 8px 25px rgba(0,0,0,0.2);
        font-weight: bold;
    `;
    msg.textContent = message;
    document.body.appendChild(msg);

    setTimeout(() => {
        msg.remove();
    }, 2200);
}

window.printReport = function() {
    window.print();
};

window.updateServiceType = function() {
    // سيتم التوسعة مستقبلا
};
