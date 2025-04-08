// python3 -m http.server
console.log("Script loaded!");

// --- DOM Element References ---
const fileInput = document.getElementById('jsonFileInput');
const loadStatusDiv = document.getElementById('load-status');
const fileLoaderSection = document.getElementById('file-loader');
const dashboardSection = document.getElementById('dashboard-summary');
const transactionsSection = document.getElementById('transactions-list');
const balancesList = document.getElementById('balances-list');
const rtaValueElement = document.getElementById('rta-value');
const transactionsTbody = document.getElementById('transactions-tbody');
const currentYearSpan = document.getElementById('current-year');
const summaryMonthElement = document.getElementById('summary-month');
const summaryIncomeElement = document.getElementById('summary-income');
const summarySpendingElement = document.getElementById('summary-spending');
const filterSearchInput = document.getElementById('filter-search');
const filterAccountSelect = document.getElementById('filter-account');
const filterCategorySelect = document.getElementById('filter-category');
const filterStartDateInput = document.getElementById('filter-start-date');
const filterEndDateInput = document.getElementById('filter-end-date');
const resetFiltersButton = document.getElementById('reset-filters');
const noResultsMessage = document.getElementById('no-results-message');
let db; // Variable to hold the database instance

const addExpenseFormSection = document.getElementById('add-expense-form');
const newTxForm = document.getElementById('new-tx-form');
const txTypeSelect = document.getElementById('tx-type');
const txDateInput = document.getElementById('tx-date');
const txAccountSelect = document.getElementById('tx-account');
const txPayeeInput = document.getElementById('tx-payee');
const txCategorySelect = document.getElementById('tx-category');
const txAmountInput = document.getElementById('tx-amount');
const txMemoInput = document.getElementById('tx-memo');
const addTxStatusDiv = document.getElementById('add-tx-status');

const syncSection = document.getElementById('sync-section');
const pendingCountSpan = document.getElementById('pending-count');
const exportDataButton = document.getElementById('export-data-button');
const clearPendingButton = document.getElementById('clear-pending-button');
const exportStatusDiv = document.getElementById('export-status');
let originalBudgetData = null; // Store the initially loaded data

const budgetViewSection = document.getElementById('budget-view');
const budgetViewMonthSpan = document.getElementById('budget-view-month');
const budgetTbody = document.getElementById('budget-tbody');
const totalBudgetedValueTd = document.getElementById('total-budgeted-value');
const totalSpentValueTd = document.getElementById('total-spent-value');
const totalAvailableValueTd = document.getElementById('total-available-value');
const budgetNoDataMsg = document.getElementById('budget-no-data');

const chartsSection = document.getElementById('charts-section');
const spendingChartCanvas = document.getElementById('spendingPieChart');
const chartMonthDisplaySpan = document.getElementById('chart-month-display');
const chartNoDataMsg = document.getElementById('chart-no-data');
let spendingPieChartInstance = null; // To destroy previous chart before rendering new one

const menuToggleButton = document.getElementById('menu-toggle');
const menuCloseButton = document.getElementById('menu-close');
const sideMenu = document.getElementById('side-menu');
const overlay = document.getElementById('overlay');
const navLinks = document.querySelectorAll('.nav-link');
const mainSections = document.querySelectorAll('.main-section'); // Get all sections

// --- Define Constants ---
const DB_NAME = 'budgetAppDB';
const DB_VERSION = 1; // Increment if you change the schema later
const PENDING_TX_STORE_NAME = 'pendingTransactions';
const UNKNOWN_INCOME_SOURCE = "Unknown Income Source";
const UNCATEGORIZED = "Uncategorized";
const SAVINGS_GROUP_NAME = "Savings Goals";
const ARCHIVED_GROUP_NAME = "Archived";


/**
 * Initializes the IndexedDB database.
 */
function initDB() {
    return new Promise((resolve, reject) => {
        console.log("Initializing IndexedDB...");
        // Check if DB is already initialized
        if (db) {
            console.log("DB already initialized.");
            return resolve(db);
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error("IndexedDB error:", event.target.error);
            reject("Error opening IndexedDB.");
        };

        request.onsuccess = (event) => {
            db = event.target.result; // Store the database instance
            console.log("IndexedDB initialized successfully:", db);
            resolve(db);
        };

        // This event only runs if the database doesn't exist or needs upgrading
        request.onupgradeneeded = (event) => {
            console.log("IndexedDB upgrade needed...");
            let tempDb = event.target.result;

            // Create the object store for pending transactions
            // Use autoIncrementing key for simplicity
            if (!tempDb.objectStoreNames.contains(PENDING_TX_STORE_NAME)) {
                console.log(`Creating object store: ${PENDING_TX_STORE_NAME}`);
                const store = tempDb.createObjectStore(PENDING_TX_STORE_NAME, {
                    keyPath: 'id', // Use 'id' as the primary key
                    autoIncrement: true // Automatically generate unique IDs
                });
                // Optional: Create indexes for faster searching if needed (e.g., by date)
                 store.createIndex('dateIndex', 'date', { unique: false });
                 console.log("Created date index on pending store.");
            }
             console.log("IndexedDB upgrade complete.");
        };
    });
}
initDB().catch(error => {
    console.error("Failed to initialize IndexedDB on startup:", error);
    // Maybe display an error to the user that offline saving won't work
    updateStatus("Warning: Offline storage unavailable. Entered expenses won't be saved.", "error");
});


// --- Initial Setup ---
if (currentYearSpan) {
    currentYearSpan.textContent = new Date().getFullYear();
}

// --- Event Listener for File Input ---
if (fileInput) {
    fileInput.addEventListener('change', handleFileSelect);
} else {
    console.error("File input element not found!");
}

// --- Menu Toggle Functionality ---
function toggleMenu(forceClose = false) {
    if (!sideMenu || !overlay) return;
    const isOpen = sideMenu.classList.contains('open');
    if (forceClose || isOpen) {
        sideMenu.classList.remove('open');
        overlay.classList.remove('visible');
    } else {
        sideMenu.classList.add('open');
        overlay.classList.add('visible');
    }
}

// --- Event Listeners for Menu ---
if (menuToggleButton) {
    menuToggleButton.addEventListener('click', () => toggleMenu());
}
if (menuCloseButton) {
    menuCloseButton.addEventListener('click', () => toggleMenu(true)); // Force close
}
if (overlay) {
    overlay.addEventListener('click', () => toggleMenu(true)); // Close on overlay click
}

// --- Navigation Link Click Handler ---
navLinks.forEach(link => {
    link.addEventListener('click', (event) => {
        event.preventDefault(); // Stop default link behavior
        const sectionId = link.dataset.section; // Get target section ID from data attribute

        // Hide all main sections
        mainSections.forEach(section => {
            section.classList.add('hidden');
        });

        // Show the target section
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.classList.remove('hidden');
            console.log(`Navigating to section: #${sectionId}`);
        } else {
            console.warn(`Target section not found: #${sectionId}`);
            // Show a default section like dashboard if target fails?
            document.getElementById('dashboard-summary')?.classList.remove('hidden');
        }

        // Close the menu
        toggleMenu(true); // Force close
    });
});

// --- Core Functions ---

/**
 * Handles the file selection event.
 * @param {Event} event The file input change event.
 */
function handleFileSelect(event) {
    const file = event.target.files[0]; // Get the selected file (first one)

    if (!file) {
        updateStatus("No file selected.", "info");
        return; // Exit if no file is chosen
    }

    if (file.type !== "application/json") {
        updateStatus(`Error: Selected file (${file.name}) is not a JSON file.`, "error");
        clearDataDisplay(); // Clear any old data
        hideDataSections();
        return;
    }

    updateStatus(`Reading file: ${file.name}...`, "info");

    const reader = new FileReader();

    // Callback function when file reading is complete
    reader.onload = function(e) {
        const fileContent = e.target.result;
        try {
            // Attempt to parse the file content as JSON
            const jsonData = JSON.parse(fileContent);
            updateStatus(`File ${file.name} loaded successfully. Processing...`, "success");
            processBudgetData(jsonData); // Process the valid JSON data
        } catch (error) {
            console.error("Error parsing JSON:", error);
            updateStatus(`Error: Could not parse JSON file (${file.name}). Is it valid JSON? ${error.message}`, "error");
            clearDataDisplay();
            hideDataSections();
        }
    };

    // Callback function if there's an error reading the file
    reader.onerror = function(e) {
        console.error("Error reading file:", e);
        updateStatus(`Error reading file ${file.name}.`, "error");
        clearDataDisplay();
        hideDataSections();
    };

    // Read the file as text
    reader.readAsText(file);
}

/**
 * Processes the parsed budget data and updates the UI.
 * Stores original data and loads pending transactions.
 * @param {object} data The parsed JSON data object.
 */
async function processBudgetData(data) {
    // (Keep validation and originalBudgetData assignment)
    originalBudgetData = JSON.parse(JSON.stringify(data));

    try {
        // (Keep filter population, pending transaction loading, etc.)
        populateAccountFilter(data.accounts, [filterAccountSelect, txAccountSelect]);
        populateCategoryFilter(data.categories, data.transactions, [filterCategorySelect, txCategorySelect]);
        const pendingTransactions = await loadPendingTransactions();
        updatePendingCountUI(pendingTransactions.length);
        const originalTransactions = data.transactions || [];
        const allTransactionsForDisplay = [...originalTransactions, ...pendingTransactions];

        const latestMonth = findLatestMonth(originalTransactions) || findLatestMonth(pendingTransactions);

         // --- Display Dashboard Summary ---
         let monthSummary = { latestMonth: latestMonth || 'N/A', income: 0, spending: 0 };
         if (latestMonth) {
             monthSummary = {
                 latestMonth: latestMonth,
                 ...calculatePeriodSummary(latestMonth, allTransactionsForDisplay) // Use combined
             };
         }
        displayDashboardSummary(monthSummary);
        displayAccountBalances(data.accounts); // Show original balances
        displayRTA(data.ready_to_assign); // Show original RTA
        displayTransactions(originalTransactions, pendingTransactions); // Show combined transactions list
        resetAllFilters();

        // --- Calculate and Display Budget View ---
        if (latestMonth && data.categories && data.budget_periods) {
            console.log(`Calculating budget view for: ${latestMonth}`);
            const budgetViewData = calculateBudgetViewData(
                latestMonth,
                data.categories,
                data.budget_periods,
                allTransactionsForDisplay, // Use combined transactions for budget calcs
                data.category_groups || {}
            );
            // Indicate that pending items affect this view
            const budgetTitleSuffix = pendingTransactions.length > 0 ? " (incl. pending)" : "";
            renderBudgetTable(budgetViewData.rows, budgetViewData.totals, latestMonth, budgetTitleSuffix);
        } else {
            // Hide if no data
            if (budgetViewSection) budgetViewSection.classList.add('hidden');
        }

        // --- Calculate and Display Spending Chart ---
        if (latestMonth && spendingChartCanvas) {
            console.log(`Calculating spending chart data for: ${latestMonth}`);
            const chartData = calculateSpendingBreakdown(
                latestMonth,
                allTransactionsForDisplay, // Use all of the transactions for chart data
                data.category_groups || {}
            );
            // Indicate that pending items affect this view
            const chartTitleSuffix = pendingTransactions.length > 0 ? " (incl. pending)" : "";
            if (chartMonthDisplaySpan) chartMonthDisplaySpan.textContent = latestMonth + chartTitleSuffix;

            if (chartData && chartData.labels.length > 0) {
                 if (chartMonthDisplaySpan) chartMonthDisplaySpan.textContent = latestMonth;
                renderSpendingChart(chartData);
            } else {
                // Hide chart elements if no data
                if (spendingPieChartInstance) { spendingPieChartInstance.destroy(); spendingPieChartInstance = null; }
                if (chartNoDataMsg) chartNoDataMsg.classList.remove('hidden'); // Show no data msg
                if (spendingChartCanvas.parentElement) spendingChartCanvas.parentElement.style.display = 'none';
            }
        } else {
            // Hide if no month/canvas
            if (chartsSection) chartsSection.classList.add('hidden');
        }
        // *** HIDE THE FILE LOADER SECTION ***
        if (fileLoaderSection) {
            fileLoaderSection.classList.add('hidden');
            console.log("File loader section hidden after successful data load.");
        } else {
            console.warn("Could not find fileLoaderSection to hide.");
        }

        updateStatus(`Data ready. Select a view from the menu.`, "success"); // Update status

    } catch (uiError) {
        // (Keep error handling)
        console.error("Error updating UI:", uiError);
        updateStatus(`Error displaying data: ${uiError.message}`, "error");
    }
}

// --- Budget Calculation Helper Functions ---

/**
 * Gets the previous month's period string (YYYY-MM).
 * @param {string} periodStr The current period (YYYY-MM).
 * @returns {string|null} The previous period string or null if input is invalid.
 */
function getPreviousPeriodJS(periodStr) {
    if (!periodStr || !/^\d{4}-\d{2}$/.test(periodStr)) {
        return null;
    }
    try {
        const [year, month] = periodStr.split('-').map(Number);
        // Create a date object for the first of the current month
        const currentDate = new Date(year, month - 1, 1); // month is 0-indexed
        // Subtract one day to get to the last day of the previous month
        currentDate.setDate(currentDate.getDate() - 1);
        // Format the resulting date
        const prevYear = currentDate.getFullYear();
        const prevMonth = (currentDate.getMonth() + 1).toString().padStart(2, '0'); // month + 1, pad with zero
        return `${prevYear}-${prevMonth}`;
    } catch (e) {
        console.error("Error getting previous period:", e);
        return null;
    }
}

/**
 * Calculates NET spending for a specific category within a specific period.
 * Mirrors Python's calculate_category_spending (basic version).
 * @param {string} period The period prefix (YYYY-MM).
 * @param {string} categoryName The category to calculate spending for.
 * @param {Array} transactions The list of transactions to check.
 * @returns {number} The net spending amount for that category in that period.
 */
function calculateCategorySpendingJS(period, categoryName, transactions) {
    let netSpent = 0.0;
    if (!period || !categoryName || !transactions) {
        return 0.0;
    }

    transactions.forEach(tx => {
        // Check category, date, and type
        if (tx.category === categoryName &&
            tx.date && tx.date.startsWith(period) &&
            (tx.type === 'expense' || tx.type === 'refund'))
        {
            try {
                const amount = parseFloat(tx.amount || 0);
                 if (isNaN(amount)) return; // Skip invalid amounts

                if (tx.type === 'expense') {
                    netSpent += amount;
                } else if (tx.type === 'refund') {
                    netSpent -= amount;
                }
            } catch (e) {
                 console.warn(`Error parsing amount during category spending calc: ${e}`, tx);
            }
        }
    });
    return netSpent;
}

// --- Main Budget View Calculation Function ---

/**
 * Calculates the data needed for the budget view table for a specific period.
 * Mirrors Python's get_budget_display_data logic.
 * @param {string} period The target period (YYYY-MM).
 * @param {Array} categories List of all category names.
 * @param {object} budgetPeriodsData Budget data { "YYYY-MM": { "Category": Amount } }.
 * @param {Array} transactions List of transactions (use original, not pending).
 * @param {object} groupsData Category groups mapping { "Category": "Group Name" }.
 * @returns {{rows: Array<object>, totals: {budgeted: number, spent: number, available: number}}}
 */
function calculateBudgetViewData(period, categories = [], budgetPeriodsData = {}, transactions = [], groupsData = {}) {
    const budgetRows = [];
    let totalBudgeted = 0.0;
    let totalSpent = 0.0; // Activity total
    let totalAvailable = 0.0; // Running total available

    // Exclude internal/special categories and sort
    let displayCategories = categories.filter(c => c !== UNKNOWN_INCOME_SOURCE);
    displayCategories.sort();
    // Ensure Uncategorized is last if present
    if (displayCategories.includes(UNCATEGORIZED)) {
        displayCategories = displayCategories.filter(c => c !== UNCATEGORIZED);
        displayCategories.push(UNCATEGORIZED);
    }

    const periodBudget = budgetPeriodsData[period] || {};
    const previousPeriod = getPreviousPeriodJS(period);
    const previousPeriodBudget = previousPeriod ? (budgetPeriodsData[previousPeriod] || {}) : {};

    console.log(`Budget Data for ${period}:`, periodBudget);
    console.log(`Previous Period: ${previousPeriod}`);

    displayCategories.forEach(cat => {
        const group = groupsData[cat];
        const isArchived = group === ARCHIVED_GROUP_NAME;
        const isSavingsGoal = group === SAVINGS_GROUP_NAME;

        // *** Skip Archived Categories *** (Simplified: Always skip for now)
        if (isArchived) {
            console.log(`Skipping archived category: ${cat}`);
            return; // continue to next category
        }

        const budgeted = periodBudget[cat] || 0.0;
        const spent = calculateCategorySpendingJS(period, cat, transactions);

        let prevAvailable = 0.0;
        if (previousPeriod) {
            const prevBudgeted = previousPeriodBudget[cat] || 0.0;
            const prevSpent = calculateCategorySpendingJS(previousPeriod, cat, transactions);
            prevAvailable = prevBudgeted - prevSpent;
        }

        const available = prevAvailable + budgeted - spent;

        budgetRows.push({
            name: cat,
            prev_avail: prevAvailable,
            budgeted: budgeted,
            spent: spent, // This is 'Activity'
            available: available,
            is_savings_goal: isSavingsGoal
            // is_archived: isArchived // We filter out archived above
        });

        // Accumulate totals (only for non-archived rows)
        totalBudgeted += budgeted;
        totalSpent += spent;
        // Total available is calculated cumulatively at the end from totals
    });

    totalAvailable = (budgetRows.reduce((sum, row) => sum + row.prev_avail, 0)) + totalBudgeted - totalSpent;
    // Alt check: Sum of individual 'available' amounts should match:
    // const sumAvailable = budgetRows.reduce((sum, row) => sum + row.available, 0);
    // console.log("Check Total Available:", totalAvailable, "vs Sum:", sumAvailable);

    return {
        rows: budgetRows,
        totals: {
            budgeted: totalBudgeted,
            spent: totalSpent,
            available: totalAvailable
        }
    };
}

// --- Budget Table Rendering Function ---

/**
 * Renders the calculated budget data into the HTML table.
 * @param {Array<object>} budgetRows Array of row data objects.
 * @param {{budgeted: number, spent: number, available: number}} totals Calculated totals.
 * @param {string} period The period being displayed (YYYY-MM).
 * @param {string} titleSuffix Optional suffix for the title (e.g., " (incl. pending)").
 */
function renderBudgetTable(budgetRows, totals, period, titleSuffix = "") {
    // Clear previous content
    if (budgetTbody) budgetTbody.innerHTML = '';
    if (budgetViewMonthSpan) budgetViewMonthSpan.textContent = (period || '--') + titleSuffix;

    // Clear totals
    if (totalBudgetedValueTd) totalBudgetedValueTd.textContent = '--';
    if (totalSpentValueTd) totalSpentValueTd.textContent = '--';
    if (totalAvailableValueTd) totalAvailableValueTd.textContent = '--';
    if (budgetNoDataMsg) budgetNoDataMsg.classList.add('hidden');

    if (!budgetTbody || !budgetRows || budgetRows.length === 0) {
         if (budgetNoDataMsg) budgetNoDataMsg.classList.remove('hidden');
        console.warn("No budget rows to render for period:", period);
        return;
    }

    budgetRows.forEach(row => {
        const tr = budgetTbody.insertRow();
        if (row.is_savings_goal) {
            tr.classList.add('savings-goal-row'); // Add class for styling
        }

        const cellCat = tr.insertCell();
        cellCat.textContent = row.name;

        const cellPrevAvail = tr.insertCell();
        cellPrevAvail.textContent = formatCurrency(row.prev_avail);
        cellPrevAvail.className = `currency ${getCurrencyClass(row.prev_avail)}`;

        const cellBudgeted = tr.insertCell();
        cellBudgeted.textContent = formatCurrency(row.budgeted);
         // Budgeted usually not colored, unless maybe 0?
         cellBudgeted.className = `currency ${getCurrencyClass(row.budgeted, true)}`; // Pass true to allow positive color

        const cellSpent = tr.insertCell(); // Activity
        cellSpent.textContent = formatCurrency(row.spent);
        // Spending is "negative" impact, show red if > 0, green if negative (refunds > expenses)
        cellSpent.className = `currency ${row.spent > 0 ? 'negative-currency' : (row.spent < 0 ? 'positive-currency' : 'zero-currency')}`;


        const cellAvailable = tr.insertCell();
        cellAvailable.textContent = formatCurrency(row.available);
        cellAvailable.className = `currency ${getCurrencyClass(row.available)}`;
    });

    // Populate totals
    if (totalBudgetedValueTd) {
        totalBudgetedValueTd.textContent = formatCurrency(totals.budgeted);
        totalBudgetedValueTd.className = `currency ${getCurrencyClass(totals.budgeted, true)}`;
    }
    if (totalSpentValueTd) {
        totalSpentValueTd.textContent = formatCurrency(totals.spent);
         totalSpentValueTd.className = `currency ${totals.spent > 0 ? 'negative-currency' : (totals.spent < 0 ? 'positive-currency' : 'zero-currency')}`;
    }
    if (totalAvailableValueTd) {
        totalAvailableValueTd.textContent = formatCurrency(totals.available);
        totalAvailableValueTd.className = `currency ${getCurrencyClass(totals.available)}`;
    }
}

// --- Chart Data Calculation Function ---

/**
 * Calculates positive net spending aggregated by category for a pie chart.
 * Excludes Savings Goals and internal categories.
 * @param {string} period The target period (YYYY-MM).
 * @param {Array} transactions List of transactions (use original).
 * @param {object} groupsData Category groups mapping { "Category": "Group Name" }.
 * @returns {{labels: Array<string>, data: Array<number>}|null} Object with labels and data arrays, or null if no data.
 */
function calculateSpendingBreakdown(period, transactions = [], groupsData = {}) {
    const spendingByCategory = {}; // { CategoryName: netSpending }

    transactions.forEach(tx => {
        if (!tx.date || !tx.date.startsWith(period) || tx.type === 'transfer' || tx.type === 'income') {
            return; // Skip if not in period or not expense/refund
        }

        const category = tx.category || UNCATEGORIZED; // Default to Uncategorized
        const group = groupsData[category];

        // Skip Savings Goals and internal categories
        if (group === SAVINGS_GROUP_NAME || category === UNKNOWN_INCOME_SOURCE) {
            return;
        }

        try {
            const amount = parseFloat(tx.amount || 0);
            if (isNaN(amount)) return;

            if (!spendingByCategory[category]) {
                spendingByCategory[category] = 0;
            }

            if (tx.type === 'expense') {
                spendingByCategory[category] += amount;
            } else if (tx.type === 'refund') {
                spendingByCategory[category] -= amount;
            }
        } catch (e) {
            console.warn(`Error parsing amount during spending breakdown calc: ${e}`, tx);
        }
    });

    // Filter out categories with zero or negative net spending, sort by amount desc
    const spendingEntries = Object.entries(spendingByCategory)
        .filter(([cat, amount]) => amount > 0.005) // Keep only positive net spending
        .sort(([, amountA], [, amountB]) => amountB - amountA); // Sort descending

    if (spendingEntries.length === 0) {
        return null; // No data for the chart
    }

    // Optional: Group small slices into "Other"
    const threshold = 0.03; // Example: Group slices less than 3% of total
    const totalSpending = spendingEntries.reduce((sum, [, amount]) => sum + amount, 0);
    let otherAmount = 0;
    const finalEntries = [];

    spendingEntries.forEach(([cat, amount]) => {
        if (amount / totalSpending < threshold && spendingEntries.length > 5) { // Only group if there are enough slices
            otherAmount += amount;
        } else {
            finalEntries.push([cat, amount]);
        }
    });

    if (otherAmount > 0.005) {
        finalEntries.push(["Other", otherAmount]);
    }

    // Prepare data for Chart.js
    const labels = finalEntries.map(([cat]) => cat);
    const data = finalEntries.map(([, amount]) => amount);

    return { labels, data };
}

// --- Chart Rendering Function ---

/**
 * Renders the spending pie chart using Chart.js.
 * @param {{labels: Array<string>, data: Array<number>}} chartData Object with labels and data arrays.
 */
function renderSpendingChart(chartData) {
    if (!spendingChartCanvas || !chartData) {
        console.error("Cannot render chart: Canvas not found or no data.");
        return;
    }
     if (spendingChartCanvas.parentElement) spendingChartCanvas.parentElement.style.display = 'block'; // Ensure container is visible


    // Destroy previous chart instance if it exists
    if (spendingPieChartInstance) {
        spendingPieChartInstance.destroy();
         console.log("Destroyed previous chart instance.");
    }

    const ctx = spendingChartCanvas.getContext('2d');
    spendingPieChartInstance = new Chart(ctx, {
        type: 'pie', // or 'doughnut'
        data: {
            labels: chartData.labels,
            datasets: [{
                label: 'Spending',
                data: chartData.data,
                // Chart.js provides default colors, or you can define your own array:
                // backgroundColor: ['#dc3545', '#fd7e14', '#ffc107', '#28a745', '#20c997', '#17a2b8', '#007bff', '#6f42c1', '#e83e8c'],
                 borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // Allow canvas resizing based on container
            plugins: {
                legend: {
                    position: 'top', // Or 'bottom', 'left', 'right'
                },
                tooltip: {
                    callbacks: {
                         // Format tooltip to show currency and percentage
                         label: function(context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            const value = context.parsed || 0;
                            label += formatCurrency(value); // Add formatted currency

                            // Calculate percentage
                            const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) + '%' : '0.0%';
                            label += ` (${percentage})`;

                            return label;
                        }
                    }
                },
                title: { // Optional chart title within the canvas area
                    display: false, // Already have h2 above
                    // text: `Spending Breakdown for ${latestMonth}` // Use variable if needed
                }
            }
        }
    });
    console.log("Rendered new spending chart.");
}

/**
 * Helper to get the appropriate CSS class for currency values.
 * @param {number} amount The amount.
 * @param {boolean} allowPositive Set to true if positive values should get 'positive-currency' class.
 * @returns {string} CSS class name ('positive-currency', 'negative-currency', or 'zero-currency').
 */
function getCurrencyClass(amount, allowPositive = false) {
    // Use a small tolerance for zero checks
    const tolerance = 0.005;
   if (amount < -tolerance) {
       return 'negative-currency';
   } else if (amount > tolerance && allowPositive) {
       return 'positive-currency';
   } else if (amount > tolerance && !allowPositive) {
        return ''; // Standard positive numbers often don't need a specific class unless requested
   }
   else {
       return 'zero-currency';
   }
}

/**
* Finds the latest month (YYYY-MM) present in the transaction data.
 * @param {Array} transactions The transactions array.
 * @returns {string|null} The latest month string or null if none found.
 */
function findLatestMonth(transactions) {
    let latestMonth = null;
    if (!transactions || transactions.length === 0) {
        return null;
    }
    transactions.forEach(tx => {
        if (tx.date && typeof tx.date === 'string' && tx.date.length >= 7) {
            const month = tx.date.substring(0, 7); // Extract YYYY-MM
            // Basic validation for YYYY-MM format
            if (/^\d{4}-\d{2}$/.test(month)) {
                if (latestMonth === null || month > latestMonth) {
                    latestMonth = month;
                }
            }
        }
    });
    return latestMonth;
}

/**
 * Calculates income and net spending for a specific period prefix (YYYY-MM).
 * NOTE: This version does NOT exclude savings goals like the Python version might.
 * @param {string} periodPrefix The period string (e.g., "2024-05").
 * @param {Array} transactions The transactions array.
 * @returns {object} An object { income: number, spending: number }.
 */
function calculatePeriodSummary(periodPrefix, transactions) {
    let totalIncome = 0.0;
    let totalExpense = 0.0;
    let totalRefund = 0.0;

    if (!periodPrefix || !transactions) {
        return { income: 0.0, spending: 0.0 };
    }

    transactions.forEach(tx => {
        if (tx.date && typeof tx.date === 'string' && tx.date.startsWith(periodPrefix) && tx.type !== 'transfer') {
            try {
                const amount = parseFloat(tx.amount || 0);
                if (isNaN(amount)) { // Skip if amount is not a valid number
                   console.warn(`Skipping transaction with invalid amount in period ${periodPrefix}:`, tx);
                   return;
                }

                if (tx.type === 'income') {
                    totalIncome += amount;
                } else if (tx.type === 'expense') {
                    totalExpense += amount;
                } else if (tx.type === 'refund') {
                    totalRefund += amount;
                }
            } catch (e) {
                console.error(`Error processing amount for transaction ID ${tx.id || 'N/A'}:`, e);
            }
        }
    });

    const netSpending = totalExpense - totalRefund;
    return { income: totalIncome, spending: netSpending };
}
// --- UI Update Functions ---

/**
 * Displays the account balances in the list.
 * @param {object} accounts The accounts object from the JSON data.
 */
function displayAccountBalances(accounts) {
    if (!balancesList) return;
    balancesList.innerHTML = ''; // Clear previous balances

    if (Object.keys(accounts).length === 0) {
        balancesList.innerHTML = '<li>No accounts found.</li>';
        return;
    }

    // Sort account names alphabetically for consistent display
    const sortedAccountNames = Object.keys(accounts).sort();

    sortedAccountNames.forEach(accountName => {
        const balance = accounts[accountName];
        const li = document.createElement('li');
        li.textContent = `${accountName}: `;
        const span = document.createElement('span');
        span.textContent = formatCurrency(balance);
        span.className = balance < 0 ? 'negative-currency' : (balance > 0 ? 'positive-currency' : 'zero-currency');
        li.appendChild(span);
        balancesList.appendChild(li);
    });
}

/**
 * Displays the calculated dashboard summary for the latest month.
 * @param {object} summaryData Object containing { latestMonth, income, spending }.
 */
function displayDashboardSummary(summaryData) {
    if (!summaryMonthElement || !summaryIncomeElement || !summarySpendingElement) {
        console.error("Dashboard summary elements not found in DOM!");
        return;
    }
    if (!summaryData || !summaryData.latestMonth) {
         summaryMonthElement.textContent = 'N/A';
         summaryIncomeElement.textContent = formatCurrency(0);
         summarySpendingElement.textContent = formatCurrency(0);
         return;
    }

    summaryMonthElement.textContent = summaryData.latestMonth;

    summaryIncomeElement.textContent = formatCurrency(summaryData.income);
    summaryIncomeElement.className = summaryData.income > 0 ? 'positive-currency' : 'zero-currency';

    summarySpendingElement.textContent = formatCurrency(summaryData.spending);
     // Spending is typically "negative" impact, show red if > 0 spent
    summarySpendingElement.className = summaryData.spending > 0 ? 'negative-currency' : (summaryData.spending < 0 ? 'positive-currency' : 'zero-currency');
}

/**
 * Displays the Ready to Assign value.
 * @param {number} rta The Ready to Assign value from the JSON data.
 */
function displayRTA(rta) {
    if (!rtaValueElement) return;
    rtaValueElement.textContent = formatCurrency(rta);
    rtaValueElement.className = rta < 0 ? 'negative-currency' : (rta > 0 ? 'positive-currency' : 'zero-currency');
}

/**
 * Displays transactions in the table, marking pending ones.
 * @param {Array} originalTransactions The original transactions array.
 * @param {Array} pendingTransactions Transactions from IndexedDB.
 */
function displayTransactions(originalTransactions = [], pendingTransactions = []) {
    if (!transactionsTbody) return;
    transactionsTbody.innerHTML = ''; // Clear previous transactions

    const combined = [...originalTransactions, ...pendingTransactions];

    if (combined.length === 0) {
        transactionsTbody.innerHTML = '<tr><td colspan="6">No transactions found.</td></tr>';
        if (noResultsMessage) noResultsMessage.classList.add('hidden');
        return;
    }

    const sortedTransactions = combined.sort((a, b) => {
        const dateA = a.date || '0000-00-00';
        const dateB = b.date || '0000-00-00';
        // Add secondary sort by entry timestamp or ID if available for stability
        if (dateB !== dateA) {
            return dateB.localeCompare(dateA);
        }
        const pendingA = a.status === 'pending';
        const pendingB = b.status === 'pending';
        if(pendingA !== pendingB) return pendingB ? 1 : -1; // Show pending later on same day? Or earlier? Adjust as needed.
        return (b.amount || 0) - (a.amount || 0); // Example fallback
    });

    sortedTransactions.forEach(tx => {
        const row = transactionsTbody.insertRow();
        const isPending = tx.status === 'pending'; // Check if it's a pending one

        // --- Store data in data-* attributes (same as before) ---
        const txDate = tx.date || '';
        // ... (rest of the data attribute logic remains largely the same) ...
        let txAccount = '';
        let displayAccount = 'N/A';
        const txType = tx.type || 'unknown';
        if (txType === 'transfer') {
             // Handle transfers if you implement them
             displayAccount = `${tx.source_account || '?'} -> ${tx.destination_account || '?'}`;
             row.dataset.account = tx.source_account || '';
        } else {
             txAccount = tx.account || '';
             displayAccount = txAccount;
             row.dataset.account = txAccount;
        }
        const txCategory = tx.category || (txType === 'transfer' ? '' : 'Uncategorized');
        const txPayee = tx.payee || (txType === 'transfer' ? 'Transfer' : '');
        const txMemo = tx.memo || '';

        row.dataset.date = txDate;
        row.dataset.category = txCategory;
        row.dataset.payee = txPayee;
        row.dataset.memo = txMemo;

        // --- Populate Cells ---
        // *** Insert Icon Cell (at the beginning - index 0) ***
        const cellIcon = row.insertCell(0); // Insert as the first cell
        cellIcon.classList.add('td-icon'); // Add class for styling
        const icon = document.createElement('i'); // Create <i> element for Font Awesome
        icon.classList.add('fa-solid'); // Base class for solid icons
        let iconClass = 'fa-question-circle'; // Default icon
        let iconTitle = txType.charAt(0).toUpperCase() + txType.slice(1); // Tooltip text

        switch (txType) {
            case 'income':
                iconClass = 'fa-arrow-down';
                icon.style.color = '#28a745'; // Green
                break;
            case 'expense':
                iconClass = 'fa-arrow-up';
                icon.style.color = '#dc3545'; // Red
                break;
            case 'refund':
                iconClass = 'fa-rotate-left'; // Or fa-undo
                icon.style.color = '#17a2b8'; // Info/blue color
                break;
            case 'transfer':
                iconClass = 'fa-exchange-alt'; // Or fa-arrows-alt-h
                icon.style.color = '#6c757d'; // Gray
                break;
        }
        icon.classList.add(iconClass);
        icon.title = iconTitle; // Add tooltip
        icon.setAttribute('aria-label', iconTitle); // Accessibility
        cellIcon.appendChild(icon);

        // Insert remaining cells (indices shift because icon is now cell 0)
        const cellDate = row.insertCell(1);
        cellDate.textContent = txDate || 'N/A';
        if (isPending) cellDate.textContent = `[P] ${cellDate.textContent}`; // Add pending prefix here now

        const cellAccount = row.insertCell(2);
        cellAccount.textContent = displayAccount;
         if (txType === 'transfer') cellAccount.style.fontStyle = 'italic';

         const cellPayee = row.insertCell(3);
         cellPayee.textContent = txPayee || txMemo || 'N/A';

         const cellCategory = row.insertCell(4);
         cellCategory.textContent = txCategory || '-';

         const cellAmount = row.insertCell(5);
         cellAmount.textContent = formatCurrency(tx.amount || 0);
         // Apply currency class (reuse existing logic)
          switch(txType) {
              case 'income': cellAmount.classList.add('positive-currency'); break;
              case 'expense': cellAmount.classList.add('negative-currency'); break;
              case 'refund': cellAmount.classList.add('positive-currency'); break;
              case 'transfer': cellAmount.classList.add('zero-currency'); break;
              default: cellAmount.classList.add('zero-currency');
          }
          cellAmount.style.textAlign = 'right';
          cellAmount.style.fontFamily = 'monospace';
    });

    if (noResultsMessage) noResultsMessage.classList.add('hidden');
}

/**
 * Populates account filter dropdown(s).
 * @param {object} accounts Accounts object { accountName: balance }.
 * @param {Array<HTMLSelectElement>} selectElements Array of select elements to populate.
 */
function populateAccountFilter(accounts, selectElements = []) {
    if (!accounts) return;
    const accountNames = Object.keys(accounts).sort();

    selectElements.forEach(select => {
        if (!select) return;
        // Store current value if needed, or assume reset is fine
        // Clear existing options (keep the first default option if it exists)
        const firstOptionText = select.options.length > 0 ? select.options[0].text : "";
        select.length = 0; // Clear all
        if(firstOptionText.toLowerCase().includes("all") || firstOptionText.toLowerCase().includes("select")){
             const defaultOption = document.createElement('option');
             defaultOption.value = "";
             defaultOption.textContent = firstOptionText; // Restore default option
             select.appendChild(defaultOption);
        }


        accountNames.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            select.appendChild(option);
        });
    });
}

/**
 * Populates category filter dropdown(s).
 * @param {Array} categories Categories array [categoryName1, categoryName2].
 * @param {Array} transactions Transaction list.
 * @param {Array<HTMLSelectElement>} selectElements Array of select elements to populate.
 */
function populateCategoryFilter(categories = [], transactions = [], selectElements = []) {
    if(!categories && !transactions) return;
   // Create a set to store unique category names (same logic as before)
   const categorySet = new Set(categories);
   transactions.forEach(tx => {
       if(tx.category) categorySet.add(tx.category);
       if (!tx.category && tx.type !== 'transfer' && !categorySet.has('Uncategorized')) {
           categorySet.add('Uncategorized');
       }
   });
   // Remove internal categories if they slip in?
   // categorySet.delete("Unknown Income Source");
   // Add filter logic here? Exclude Savings/Archived for the ADD form dropdown?
   // let validCategoryNames = Array.from(categorySet).sort();

   selectElements.forEach(select => {
       if (!select) return;
       const firstOptionText = select.options.length > 0 ? select.options[0].text : "";
       select.length = 0; // Clear all
        if(firstOptionText.toLowerCase().includes("all") || firstOptionText.toLowerCase().includes("select")){
            const defaultOption = document.createElement('option');
            defaultOption.value = "";
            defaultOption.textContent = firstOptionText; // Restore default option
            select.appendChild(defaultOption);
       }

       // Filter categories specifically for the ADD form if needed
       let categoryNamesForSelect = Array.from(categorySet).sort();
       if (select.id === 'tx-category') {
           // Example: Filter out specific categories for the 'Add Transaction' dropdown
           // Assuming originalBudgetData.category_groups exists and holds group info
           const groups = originalBudgetData?.category_groups || {};
           const savingsGroupName = "Savings Goals"; // Define constants if possible
           const archivedGroupName = "Archived";
           categoryNamesForSelect = categoryNamesForSelect.filter(cat =>
                groups[cat] !== savingsGroupName && groups[cat] !== archivedGroupName && cat !== "Unknown Income Source"
           );
       }


       categoryNamesForSelect.forEach(name => {
           if (!name) return;
           const option = document.createElement('option');
           option.value = name;
           option.textContent = name;
           select.appendChild(option);
       });
   });
}
// --- IndexedDB Interaction Functions ---

/**
 * Saves a single pending transaction to IndexedDB.
 * @param {object} transaction The transaction object to save.
 */
function savePendingTransaction(transaction) {
    return new Promise(async (resolve, reject) => {
        if (!db) {
            try {
                await initDB(); // Ensure DB is ready
            } catch (err) {
                 return reject("Database not initialized.");
            }
        }

        // Add a status marker
        transaction.status = 'pending';
        // Add a timestamp for potential sorting/reference
        transaction.entry_timestamp = new Date().toISOString();

        const tx = db.transaction(PENDING_TX_STORE_NAME, 'readwrite');
        const store = tx.objectStore(PENDING_TX_STORE_NAME);

        // 'add' will fail if key already exists (good if using non-auto keys)
        // Since we use autoIncrement, 'add' is fine.
        const request = store.add(transaction);

        request.onsuccess = (event) => {
            console.log("Pending transaction saved successfully to IndexedDB, ID:", event.target.result);
            resolve(event.target.result); // Return the new ID
        };

        request.onerror = (event) => {
            console.error("Error saving pending transaction:", event.target.error);
            reject("Error saving transaction.");
        };
    });
}

/**
 * Loads all pending transactions from IndexedDB.
 * @returns {Promise<Array>} A promise that resolves with an array of pending transactions.
 */
function loadPendingTransactions() {
    return new Promise(async (resolve, reject) => {
         if (!db) {
            try {
                await initDB();
            } catch (err) {
                 return reject("Database not initialized.");
            }
        }
        const tx = db.transaction(PENDING_TX_STORE_NAME, 'readonly');
        const store = tx.objectStore(PENDING_TX_STORE_NAME);
        const request = store.getAll(); // Get all records

        request.onsuccess = (event) => {
            console.log(`Loaded ${event.target.result.length} pending transactions.`);
            resolve(event.target.result || []); // Return results or empty array
        };

        request.onerror = (event) => {
            console.error("Error loading pending transactions:", event.target.error);
            reject("Error loading transactions.");
        };
    });
}

/**
 * Clears all pending transactions from IndexedDB.
 */
function clearPendingTransactions() {
    return new Promise(async (resolve, reject) => {
        if (!db) {
             try {
                await initDB();
            } catch (err) {
                 return reject("Database not initialized.");
            }
        }

        const tx = db.transaction(PENDING_TX_STORE_NAME, 'readwrite');
        const store = tx.objectStore(PENDING_TX_STORE_NAME);
        const request = store.clear(); // Delete all records

        request.onsuccess = () => {
            console.log("Pending transactions cleared from IndexedDB.");
            resolve();
        };

        request.onerror = (event) => {
            console.error("Error clearing pending transactions:", event.target.error);
            reject("Error clearing transactions.");
        };
    });
}

// --- Add Form Handling ---
if (newTxForm) {
    newTxForm.addEventListener('submit', handleAddTransaction);
}

/**
 * Handles the submission of the new transaction form.
 * @param {Event} event The form submission event.
 */
async function handleAddTransaction(event) {
    event.preventDefault(); // Prevent default page reload
    if (!addTxStatusDiv) return;

    addTxStatusDiv.textContent = "Adding...";
    addTxStatusDiv.className = 'status-info';

    // Basic validation (redundant with 'required' but good practice)
    if (!txDateInput.value || !txAccountSelect.value || !txCategorySelect.value || !txAmountInput.value) {
        addTxStatusDiv.textContent = "Error: Please fill all required fields.";
        addTxStatusDiv.className = 'status-error';
        return;
    }

    const newTx = {
        type: txTypeSelect.value,
        date: txDateInput.value,
        account: txAccountSelect.value,
        payee: txPayeeInput.value.trim() || `(${txTypeSelect.value})`, // Use type if payee empty
        category: txCategorySelect.value,
        amount: parseFloat(txAmountInput.value),
        memo: txMemoInput.value.trim(),
        // 'status' and 'entry_timestamp' added by savePendingTransaction
    };

     // Validate amount further
     if (isNaN(newTx.amount) || newTx.amount <= 0) {
         addTxStatusDiv.textContent = "Error: Invalid amount.";
         addTxStatusDiv.className = 'status-error';
         return;
     }

    try {
        // Save to IndexedDB
        const newId = await savePendingTransaction(newTx);
        newTx.id = newId; // Add the generated ID back for UI update

        // Update UI immediately
        // 1. Reload pending list (or just add newTx to existing pending list in memory)
        const updatedPending = await loadPendingTransactions();
        updatePendingCountUI(updatedPending.length);

        // 2. Re-render the transaction table
        // We need original transactions here. Assume `originalBudgetData` holds them.
        displayTransactions(originalBudgetData?.transactions || [], updatedPending);
        resetAllFilters(); // Applying filters might hide the newly added row, so reset

        // 3. Clear the form
        newTxForm.reset();
        txDateInput.valueAsDate = new Date(); // Set date to today

        // 4. Update status message
        addTxStatusDiv.textContent = "Transaction added locally.";
        addTxStatusDiv.className = 'status-success';

    } catch (error) {
        console.error("Failed to add transaction:", error);
        addTxStatusDiv.textContent = `Error: ${error}`;
        addTxStatusDiv.className = 'status-error';
    }
}

// --- Sync Section Handling ---

/** Updates the pending count display and button states. */
function updatePendingCountUI(count) {
    if (pendingCountSpan) pendingCountSpan.textContent = count;
    if (exportDataButton) exportDataButton.disabled = count === 0;
    if (clearPendingButton) clearPendingButton.disabled = count === 0;
}

if(exportDataButton) {
   exportDataButton.addEventListener('click', handleExportData);
}
if(clearPendingButton) {
   clearPendingButton.addEventListener('click', handleClearPending);
}

/**
 * Generates a Version 4 UUID string.
 * Uses browser's crypto API if available, otherwise provides a basic fallback.
 * @returns {string} A UUID string.
 */
function generateUUID() {
    if (self.crypto && self.crypto.randomUUID) {
        return self.crypto.randomUUID();
    } else {
        console.warn("Using basic fallback for UUID generation.");
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}

/**
 * Handles the export data button click. Merges pending transactions,
 * recalculates balances/RTA, and triggers download of the full updated JSON data.
 */
async function handleExportData() {
    // Check if original data is loaded (should be if export button is enabled)
    if (!originalBudgetData) {
        updateExportStatus("Error: No original data loaded to merge with.", "error");
        return;
    }
    updateExportStatus("Preparing export...", "info");

    try {
        // 1. Load pending transactions from IndexedDB
        const pendingTransactions = await loadPendingTransactions();

        // Check if there's anything to export
        if (pendingTransactions.length === 0) {
            updateExportStatus("No pending transactions to export.", "info");
            return; // Nothing to do
        }

        // 2. Create a deep copy of the original data to modify safely
        let finalData = JSON.parse(JSON.stringify(originalBudgetData));

        // 3. Merge pending transactions and recalculate state
        pendingTransactions.forEach(pendingTx => {
            // a) Destructure temporary 'status' field, keep the rest
            const { status, ...txDataFromDB } = pendingTx;

            // b) Create the final transaction object for saving
            const txToSave = {
                ...txDataFromDB, // Includes type, date, account, payee, category, amount, memo, entry_timestamp
                id: generateUUID(), // Generate a new UUID string for the 'id'
                // Ensure amount is a number
                amount: parseFloat(txDataFromDB.amount || 0),
            };

            // c) Add the formatted transaction to the final list
            finalData.transactions.push(txToSave);

            // d) Adjust account balances and RTA based on the added transaction
            const amount = txToSave.amount; // Use amount from the object we just created
            const accountName = txToSave.account;
            const txType = txToSave.type;

            if (finalData.accounts[accountName] === undefined) {
                // Log warning but potentially continue if it was a valid pending entry
                console.warn(`Account '${accountName}' not found during export recalculation for Tx ID (pending): ${pendingTx.id}. Balance/RTA might be inaccurate.`);
                // Depending on strictness, you could choose to skip this transaction's effect
            }

            // Apply financial impact
            if (txType === 'income') {
                if (finalData.accounts[accountName] !== undefined) {
                    finalData.accounts[accountName] += amount;
                }
                finalData.ready_to_assign += amount; // Adjust RTA for income
            } else if (txType === 'expense') {
                if (finalData.accounts[accountName] !== undefined) {
                    finalData.accounts[accountName] -= amount;
                }
                // No direct RTA change for expense
            } else if (txType === 'refund') {
                if (finalData.accounts[accountName] !== undefined) {
                    finalData.accounts[accountName] += amount;
                }
                // No direct RTA change for refund
            }
            // Add transfer logic here if you implement transfers in the PWA
            // else if (txType === 'transfer') { ... recalculate source/dest balances ... }

        }); // End forEach loop

        // 4. Prepare the final JSON file for download
        const jsonDataString = JSON.stringify(finalData, null, 4); // Pretty print JSON
        const blob = new Blob([jsonDataString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        // 5. Create a temporary link and trigger the download
        const a = document.createElement('a');
        a.href = url;
        // Create a filename with a timestamp for clarity
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-'); // YYYY-MM-DDTHH-MM-SS-mmmZ
        a.download = `budget_data_${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a); // Link needs to be in the document to be clicked programmatically
        a.click(); // Simulate a click to trigger download

        // 6. Clean up the temporary link and object URL
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // 7. Update status message
        updateExportStatus("Export file generated. Please save it and use it to replace your original file.", "success");

        // 8. IMPORTANT: Do NOT automatically clear pending items here.
        // Let the user manually clear them using the 'Clear Pending Entries' button
        // after they have successfully saved and transferred the file.

    } catch (error) {
        // Handle any errors during the process
        console.error("Export failed:", error);
        updateExportStatus(`Export failed: ${error}`, "error");
    }
}

/**
 * Handles the clear pending button click.
 */
async function handleClearPending() {
    if (confirm("Are you sure you want to clear all locally saved, unsynced transactions? This cannot be undone.")) {
         updateExportStatus("Clearing pending entries...", "info");
         try {
             await clearPendingTransactions();
             updatePendingCountUI(0);
             // Re-render the transaction list without pending items
             displayTransactions(originalBudgetData?.transactions || [], []);
             updateExportStatus("Pending entries cleared.", "success");
             addTxStatusDiv.textContent = ""; // Clear add form status too
         } catch (error) {
              console.error("Failed to clear pending:", error);
             updateExportStatus(`Error clearing pending entries: ${error}`, "error");
         }
    }
}

/** Updates the export status message area */
function updateExportStatus(message, type = "info") {
    if (exportStatusDiv) {
        exportStatusDiv.textContent = message;
        exportStatusDiv.className = `status-${type}`;
    }
    console.log(`Export Status [${type}]: ${message}`);
}


// --- Helper Functions ---

/**
 * Formats a number as currency (simple version).
 * @param {number} amount The number to format.
 * @returns {string} Formatted currency string (e.g., $1,234.56 or ($1,234.56)).
 */
function formatCurrency(amount) {
    if (typeof amount !== 'number') {
        return "$?.??"; // Handle non-numeric input
    }
    const options = { style: 'currency', currency: 'EUR' }; // Adjust currency as needed (e.g., 'EUR')
    // Basic handling for negative display similar to Python version
    if (amount < 0) {
        // Format absolute value and wrap in parentheses
        return `(${Math.abs(amount).toLocaleString(undefined, options)})`;
    } else {
        return amount.toLocaleString(undefined, options);
    }
}

/**
 * Updates the status message area.
 * @param {string} message The message to display.
 * @param {string} type 'info', 'success', or 'error' for potential styling.
 */
function updateStatus(message, type = "info") {
    if (!loadStatusDiv) return;
    loadStatusDiv.textContent = message;
    loadStatusDiv.className = `status-${type}`; // Add class for styling
    console.log(`Status [${type}]: ${message}`); // Also log to console
}

/** Clears the data display areas. */
function clearDataDisplay() {
    if (balancesList) balancesList.innerHTML = '<li>Load data...</li>';
    if (rtaValueElement) rtaValueElement.textContent = 'Load data...';
    if (transactionsTbody) transactionsTbody.innerHTML = '<tr><td colspan="6">Load data...</td></tr>';
    if (summaryMonthElement) summaryMonthElement.textContent = '--';
    if (summaryIncomeElement) {
         summaryIncomeElement.textContent = 'Loading...';
         summaryIncomeElement.className = ''; // Reset class
    }
    if (summarySpendingElement) {
         summarySpendingElement.textContent = 'Loading...';
         summarySpendingElement.className = ''; // Reset class
    }
}

/** Hides the main data sections. */
function hideDataSections() {
    if(dashboardSection) dashboardSection.classList.add('hidden');
    if(transactionsSection) transactionsSection.classList.add('hidden');
}

/**
 * Filters the displayed transaction rows based on current filter inputs.
 */
function filterTransactions() {
    if (!transactionsTbody) return; // No table body to filter

    // Get current filter values
    const searchTerm = filterSearchInput.value.toLowerCase().trim();
    const selectedAccount = filterAccountSelect.value;
    const selectedCategory = filterCategorySelect.value;
    const startDate = filterStartDateInput.value; // Format: YYYY-MM-DD
    const endDate = filterEndDateInput.value;     // Format: YYYY-MM-DD

    const rows = transactionsTbody.rows; // Get all rows in the tbody
    let visibleRowCount = 0;

    // Loop through all table rows (transactions)
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row.dataset) continue; // Skip if row has no data (e.g., header?) - safety check

        // Get data from data-* attributes for the current row
        const rowDate = row.dataset.date || '';
        const rowAccount = row.dataset.account || ''; // Account name used for filtering
        const rowCategory = row.dataset.category || '';
        const rowPayee = (row.dataset.payee || '').toLowerCase();
        const rowMemo = (row.dataset.memo || '').toLowerCase();

        let showRow = true; // Assume row should be shown initially

        // --- Apply filters ---

        // 1. Search Term Filter (Payee or Memo)
        if (searchTerm && !(rowPayee.includes(searchTerm) || rowMemo.includes(searchTerm))) {
            showRow = false;
        }

        // 2. Account Filter
        // If filtering transfers, maybe check if account is source OR dest?
        // Current simple check: exact match on row.dataset.account
        if (showRow && selectedAccount && rowAccount !== selectedAccount) {
             // TODO: Enhance transfer filtering if needed (e.g., check source/dest if stored separately)
             showRow = false;
        }

        // 3. Category Filter
        if (showRow && selectedCategory && rowCategory !== selectedCategory) {
            showRow = false;
        }

        // 4. Start Date Filter
        if (showRow && startDate && rowDate && rowDate < startDate) { // Check rowDate exists
            showRow = false;
        }

        // 5. End Date Filter
        if (showRow && endDate && rowDate && rowDate > endDate) { // Check rowDate exists
            showRow = false;
        }

        // --- Show/Hide Row ---
        row.style.display = showRow ? '' : 'none'; // Show or hide
        if (showRow) {
            visibleRowCount++;
        }
    }

     // Show/hide the 'no results' message
    if (noResultsMessage) {
        noResultsMessage.classList.toggle('hidden', visibleRowCount > 0);
    }
}

/**
 * Resets all filter inputs to their default state and re-applies filtering.
 */
function resetAllFilters() {
    if (filterSearchInput) filterSearchInput.value = '';
    if (filterAccountSelect) filterAccountSelect.value = '';
    if (filterCategorySelect) filterCategorySelect.value = '';
    if (filterStartDateInput) filterStartDateInput.value = '';
    if (filterEndDateInput) filterEndDateInput.value = '';
    filterTransactions(); // Re-apply filters (which will show all rows)
}

// --- PWA Service Worker Registration ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js') // Path relative to origin
        .then(registration => {
          console.log('Service Worker registered successfully with scope:', registration.scope);
        })
        .catch(error => {
          console.error('Service Worker registration failed:', error);
        });
    });
  } else {
    console.log('Service Worker is not supported by this browser.');
  }

  // --- Filter Event Listeners ---
if (filterSearchInput) filterSearchInput.addEventListener('input', filterTransactions);
if (filterAccountSelect) filterAccountSelect.addEventListener('change', filterTransactions);
if (filterCategorySelect) filterCategorySelect.addEventListener('change', filterTransactions);
if (filterStartDateInput) filterStartDateInput.addEventListener('input', filterTransactions);
if (filterEndDateInput) filterEndDateInput.addEventListener('input', filterTransactions);
if (resetFiltersButton) resetFiltersButton.addEventListener('click', resetAllFilters);

// --- Initialize Date Input ---
if (txDateInput) {
    txDateInput.valueAsDate = new Date(); // Default to today's date
}