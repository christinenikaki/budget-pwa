console.log("Script loaded!");

// --- DOM Element References ---
const fileInput = document.getElementById('jsonFileInput');
const loadStatusDiv = document.getElementById('load-status');
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
 * @param {object} data The parsed JSON data object.
 */
function processBudgetData(data) {
    // --- Basic Data Validation ---
    if (typeof data !== 'object' || data === null) {
         updateStatus("Error: Invalid data format (not an object).", "error");
         return;
    }
    if (!data.accounts || typeof data.accounts !== 'object') {
        updateStatus("Error: Missing or invalid 'accounts' data.", "error");
        return;
    }
    if (!data.transactions || !Array.isArray(data.transactions)) {
        updateStatus("Error: Missing or invalid 'transactions' data.", "error");
        return;
    }
    if (typeof data.ready_to_assign !== 'number') {
         // Allow 0, so check specifically for number type
        updateStatus("Error: Missing or invalid 'ready_to_assign' data.", "error");
        return;
    }
    // Add more checks if needed (e.g., for categories, budget_periods)

    // --- Update UI Sections ---
    try {
        populateAccountFilter(data.accounts);
        // Pass both categories list AND transactions to catch all used categories
        populateCategoryFilter(data.categories, data.transactions);
        const latestMonth = findLatestMonth(data.transactions);
        let monthSummary = { latestMonth: latestMonth, income: 0, spending: 0 }; // Default
        if (latestMonth) {
            monthSummary = { // Recalculate if month found
                latestMonth: latestMonth,
                ...calculatePeriodSummary(latestMonth, data.transactions) // Spread calculated income/spending
            };
        }
        displayDashboardSummary(monthSummary); // Update the summary section
        displayAccountBalances(data.accounts);
        displayRTA(data.ready_to_assign);
        displayTransactions(data.transactions);

        resetAllFilters(); // Call reset to ensure table matches default filter state

        // Show the data sections now that they are populated
        showDataSections();
        updateStatus(`Data from file displayed successfully.`, "success");

    } catch(uiError) {
         console.error("Error updating UI:", uiError);
         updateStatus(`Error displaying data: ${uiError.message}`, "error");
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
 * Displays transactions in the table, adding data attributes for filtering.
 * @param {Array} transactions The transactions array from the JSON data.
 */
function displayTransactions(transactions) {
    if (!transactionsTbody) return;
    transactionsTbody.innerHTML = ''; // Clear previous transactions

    if (transactions.length === 0) {
        transactionsTbody.innerHTML = '<tr><td colspan="6">No transactions found.</td></tr>';
        // Hide no results message initially if table is empty
         if (noResultsMessage) noResultsMessage.classList.add('hidden');
        return;
    }

    // Optional: Sort transactions by date (descending)
    const sortedTransactions = transactions.sort((a, b) => {
        const dateA = a.date || '0000-00-00';
        const dateB = b.date || '0000-00-00';
        return dateB.localeCompare(dateA);
    });


    sortedTransactions.forEach(tx => {
        const row = transactionsTbody.insertRow();

        // --- Store data in data-* attributes for filtering ---
        const txDate = tx.date || '';
        const txType = tx.type || 'unknown';
        // Handle account based on type
        let txAccount = ''; // Account used for filtering (single value)
        let displayAccount = 'N/A'; // What's shown in the cell
        if (txType === 'transfer') {
            txAccount = `${tx.source_account || '?'}|${tx.destination_account || '?'}`; // Store both for potential complex filter, or pick one? Let's just use source for simplicity here
            displayAccount = `${tx.source_account || '?'} -> ${tx.destination_account || '?'}`;
            // For filtering, maybe check if filter matches EITHER source or dest?
            // Alternative: Just filter based on source account maybe? Let's try filtering on source only first.
            row.dataset.account = tx.source_account || ''; // Filter based on source
            // Or add both: row.dataset.sourceAccount = tx.source_account || ''; row.dataset.destAccount = tx.destination_account || '';
        } else {
            txAccount = tx.account || '';
            displayAccount = txAccount;
            row.dataset.account = txAccount; // Store account name
        }
        const txCategory = tx.category || (txType === 'transfer' ? '' : 'Uncategorized'); // Use '' for transfer category filter
        const txPayee = tx.payee || (txType === 'transfer' ? 'Transfer' : '');
        const txMemo = tx.memo || '';

        row.dataset.date = txDate;
        row.dataset.category = txCategory;
        row.dataset.payee = txPayee; // Store raw payee
        row.dataset.memo = txMemo; // Store raw memo
        // row.dataset.account is set above based on type


        // --- Populate Cells ---
        const cellDate = row.insertCell();
        cellDate.textContent = txDate || 'N/A';

        const cellType = row.insertCell();
        cellType.textContent = txType.charAt(0).toUpperCase() + txType.slice(1);

        const cellAccount = row.insertCell();
        cellAccount.textContent = displayAccount;
         if (txType === 'transfer') cellAccount.style.fontStyle = 'italic';

        const cellPayee = row.insertCell();
        cellPayee.textContent = txPayee || txMemo || 'N/A'; // Display Payee or Memo if payee empty


        const cellCategory = row.insertCell();
        cellCategory.textContent = txCategory || '-'; // Display category or '-'

        const cellAmount = row.insertCell();
        cellAmount.textContent = formatCurrency(tx.amount || 0);
        // Add class based on transaction type for potential styling
         switch(txType) { // Simplified from before
             case 'income': cellAmount.classList.add('positive-currency'); break;
             case 'expense': cellAmount.classList.add('negative-currency'); break;
             case 'refund': cellAmount.classList.add('positive-currency'); break; // Or neutral?
             case 'transfer': cellAmount.classList.add('zero-currency'); break;
             default: cellAmount.classList.add('zero-currency');
         }
         cellAmount.style.textAlign = 'right';
         cellAmount.style.fontFamily = 'monospace';
    });

     // Ensure no-results message is hidden after populating
     if (noResultsMessage) noResultsMessage.classList.add('hidden');
}

/**
 * Populates the account filter dropdown.
 * @param {object} accounts Accounts object { accountName: balance }.
 */
function populateAccountFilter(accounts) {
    if (!filterAccountSelect) return;
    // Clear existing options (keep the first "-- All --" option)
    filterAccountSelect.length = 1;

    const accountNames = Object.keys(accounts).sort(); // Get sorted names
    accountNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        filterAccountSelect.appendChild(option);
    });
}

/**
 * Populates the category filter dropdown.
 * @param {Array} categories Categories array [categoryName1, categoryName2].
 * @param {Array} transactions Transaction list (to include categories only present in transactions)
 */
function populateCategoryFilter(categories = [], transactions = []) {
    if (!filterCategorySelect) return;
    // Clear existing options (keep the first "-- All --" option)
    filterCategorySelect.length = 1;

    // Create a set to store unique category names from both lists
    const categorySet = new Set(categories);

    // Add categories found only in transactions (e.g., if category list is incomplete)
     transactions.forEach(tx => {
        if(tx.category) categorySet.add(tx.category);
        // Also add 'Uncategorized' if present and not already in main list
        if (!tx.category && tx.type !== 'transfer' && !categorySet.has('Uncategorized')) {
            categorySet.add('Uncategorized');
        }
     });


    const categoryNames = Array.from(categorySet).sort(); // Get unique sorted names
    categoryNames.forEach(name => {
        if (!name) return; // Skip empty category names if any
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        filterCategorySelect.appendChild(option);
    });
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

/** Shows the main data sections. */
function showDataSections() {
    if(dashboardSection) dashboardSection.classList.remove('hidden');
    if(transactionsSection) transactionsSection.classList.remove('hidden');
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