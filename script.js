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
        displayAccountBalances(data.accounts);
        displayRTA(data.ready_to_assign);
        displayTransactions(data.transactions);

        // Show the data sections now that they are populated
        showDataSections();
        updateStatus(`Data from file displayed successfully.`, "success");

    } catch(uiError) {
         console.error("Error updating UI:", uiError);
         updateStatus(`Error displaying data: ${uiError.message}`, "error");
    }
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
 * Displays the Ready to Assign value.
 * @param {number} rta The Ready to Assign value from the JSON data.
 */
function displayRTA(rta) {
    if (!rtaValueElement) return;
    rtaValueElement.textContent = formatCurrency(rta);
    rtaValueElement.className = rta < 0 ? 'negative-currency' : (rta > 0 ? 'positive-currency' : 'zero-currency');
}

/**
 * Displays transactions in the table.
 * @param {Array} transactions The transactions array from the JSON data.
 */
function displayTransactions(transactions) {
    if (!transactionsTbody) return;
    transactionsTbody.innerHTML = ''; // Clear previous transactions

    if (transactions.length === 0) {
        transactionsTbody.innerHTML = '<tr><td colspan="6">No transactions found.</td></tr>';
        return;
    }

    // Optional: Sort transactions by date (descending) like in the Python app
    const sortedTransactions = transactions.sort((a, b) => {
        // Basic date sort, assumes YYYY-MM-DD format
        // More robust sorting might handle invalid dates better
        const dateA = a.date || '0000-00-00';
        const dateB = b.date || '0000-00-00';
        return dateB.localeCompare(dateA); // Newest first
    });


    sortedTransactions.forEach(tx => {
        const row = transactionsTbody.insertRow();

        const cellDate = row.insertCell();
        cellDate.textContent = tx.date || 'N/A';

        const cellType = row.insertCell();
        cellType.textContent = tx.type ? tx.type.charAt(0).toUpperCase() + tx.type.slice(1) : 'N/A'; // Capitalize

        const cellAccount = row.insertCell();
        // Handle transfer accounts differently
        if (tx.type === 'transfer') {
             cellAccount.textContent = `${tx.source_account || '?'} -> ${tx.destination_account || '?'}`;
             cellAccount.style.fontStyle = 'italic'; // Indicate transfer
        } else {
             cellAccount.textContent = tx.account || 'N/A';
        }


        const cellPayee = row.insertCell();
        // Use Payee for I/E/R, potentially Memo for Transfer if no specific payee field
        cellPayee.textContent = tx.payee || tx.memo || (tx.type === 'transfer' ? 'Transfer' : 'N/A');

        const cellCategory = row.insertCell();
        cellCategory.textContent = tx.category || (tx.type === 'transfer' ? '-' : 'Uncategorized'); // Show '-' for transfers

        const cellAmount = row.insertCell();
        cellAmount.textContent = formatCurrency(tx.amount || 0);
        // Add class based on transaction type for potential styling
        switch(tx.type) {
            case 'income':
                cellAmount.classList.add('positive-currency'); // Green
                break;
            case 'expense':
                cellAmount.classList.add('negative-currency'); // Red
                break;
            case 'refund':
                 cellAmount.classList.add('positive-currency'); // Green (or could be neutral)
                 break;
             case 'transfer':
                 cellAmount.classList.add('zero-currency'); // Neutral grey
                 break;
            default:
                 cellAmount.classList.add('zero-currency');
        }
         cellAmount.style.textAlign = 'right'; // Align amounts right
         cellAmount.style.fontFamily = 'monospace'; // Monospace for alignment
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
    const options = { style: 'currency', currency: 'USD' }; // Adjust currency as needed (e.g., 'EUR')
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