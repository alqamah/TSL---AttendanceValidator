// --- START OF FILE script.js ---

/**
 * Global variables to store parsed data from File A and File B.
 * extractedA_Data: Array of objects { fileName, dateStr, records: [] }
 * extractedB_Data: Array of all records from File B (across sheets)
 * comparisonResults: Array of the final compared records used for display/export
 */
let extractedA_Data = [];
let extractedB_Data = [];
let comparisonResults = [];

/**
 * Update the validation message or file count when the user selects a file.
 * @param {string} inputId - The ID of the file input element.
 * @param {string} statusId - The ID of the element to display the file name/status.
 */
function updateFileName(inputId, statusId) {
    const input = document.getElementById(inputId);
    const status = document.getElementById(statusId);
    if (input.files && input.files.length > 0) {
        status.textContent = input.files.length === 1 ?
            input.files[0].name :
            `${input.files.length} files selected`;
    } else {
        status.textContent = "";
    }
}

/**
 * Triggered by "Extract data from file A".
 * Reads one or multiple .xls/.xlsx files, extracts date and records.
 * Resets previous results and hides the report table/controls.
 */
async function extractFileA() {
    const fileAInput = document.getElementById('fileA');
    const outputDiv = document.getElementById('output');
    const infoPanel = document.getElementById('infoPanel');
    const controlsArea = document.querySelector('.controls-area');

    if (!fileAInput.files || fileAInput.files.length === 0) {
        alert("Please upload at least one File A.");
        return;
    }

    // Reset State
    extractedA_Data = [];
    outputDiv.innerHTML = '<div class="spinner"></div><p style="text-align:center">Reading File A(s)...</p>';
    document.getElementById('resultsSummary').innerHTML = '';
    controlsArea.style.display = 'none';

    let errors = [];

    try {
        // Read all files in parallel
        const promises = Array.from(fileAInput.files).map(async (file) => {
            try {
                const data = await readFileA(file);
                return {
                    fileName: file.name,
                    ...data
                };
            } catch (e) {
                errors.push(`${file.name}: ${e.message}`);
                return null;
            }
        });

        const results = await Promise.all(promises);
        extractedA_Data = results.filter(r => r !== null);

        if (extractedA_Data.length === 0) {
            outputDiv.innerHTML = `<div style="text-align: center; color: var(--danger);">Failed to read any files.<br>${errors.join('<br>')}</div>`;
            return;
        }

        // Generate Summary of loaded files
        let summaryHtml = `<strong>File A Ready:</strong><br>`;
        extractedA_Data.forEach(item => {
            summaryHtml += `Date: ${item.dateStr} (${item.records.length} records) - ${item.fileName}<br>`;
        });

        if (errors.length > 0) {
            summaryHtml += `<br><span style="color:var(--danger)">Errors: ${errors.length} files failed.</span>`;
        }

        infoPanel.innerHTML = summaryHtml;
        infoPanel.style.display = 'block';
        outputDiv.innerHTML = '<p style="text-align:center; color:var(--success);">File A(s) Processed. Now Upload File B.</p>';

    } catch (err) {
        console.error(err);
        outputDiv.innerHTML = `<div style="text-align: center; color: var(--danger); padding: 20px;"><strong>Error details:</strong> ${err.message}</div>`;
    }
}

/**
 * Triggered by "Extract data from file B".
 * Reads a single multi-sheet .xlsx file.
 * Resets previous results and hides the report table/controls.
 */
async function extractFileB() {
    const fileBInput = document.getElementById('fileB');
    const outputDiv = document.getElementById('output');
    const infoPanel = document.getElementById('infoPanel');
    const controlsArea = document.querySelector('.controls-area');

    if (!fileBInput.files[0]) {
        alert("Please upload File B.");
        return;
    }

    // Reset State
    extractedB_Data = [];
    outputDiv.innerHTML = '<div class="spinner"></div><p style="text-align:center">Reading Multi-sheet File B...</p>';
    document.getElementById('resultsSummary').innerHTML = '';
    controlsArea.style.display = 'none';

    try {
        const fileBData = await readFileBAsList(fileBInput.files[0]);
        extractedB_Data = fileBData;

        // Append to info panel
        infoPanel.innerHTML += `
            <br><br><strong>File B Ready:</strong><br>
            Total Records Scanned: ${fileBData.length} (across all sheets)
        `;

        outputDiv.innerHTML = '<p style="text-align:center; color:var(--success);">File B Uploaded Successfully. Click "Compare Files" to generate report.</p>';

    } catch (err) {
        console.error(err);
        outputDiv.innerHTML = `<div style="text-align: center; color: var(--danger); padding: 20px;"><strong>Error File B:</strong> ${err.message}</div>`;
    }
}

/**
 * Triggered by "Compare files".
 * Matches records from File A against File B based on Normalized Date and ID.
 * Generates the comparisonResults array and renders the table.
 */
function compareFiles() {
    if (extractedA_Data.length === 0 || extractedB_Data.length === 0) {
        alert("Please parse both File A (at least one) and File B first.");
        return;
    }

    // 1. Index File B for fast lookup: "NORMALIZED_DATE|ID" -> Record
    const mapB = new Map();
    for (const rec of extractedB_Data) {
        const key = `${normalizeDate(rec.date)}|${rec.id}`;
        mapB.set(key, rec);
    }

    // 2. Build Comparison Results
    comparisonResults = [];

    for (const fileA of extractedA_Data) {
        const targetDateNorm = normalizeDate(fileA.dateStr);

        for (const rowA of fileA.records) {
            const key = `${targetDateNorm}|${rowA.id}`;
            const rowB = mapB.get(key);

            let bIn = "N/A";
            let bOut = "N/A";
            let status = "";

            if (rowB) {
                bIn = rowB.in;
                bOut = rowB.out;

                // Compare Times (minutes from midnight)
                // Strict match: (Time A == Time B)
                const matchIn = getMinutesFromTime(rowA.in) === getMinutesFromTime(bIn);
                const matchOut = getMinutesFromTime(rowA.out) === getMinutesFromTime(bOut);

                status = (matchIn && matchOut) ? "MATCH" : "MISMATCH";
            } else {
                status = "NOT FOUND IN B";
            }

            comparisonResults.push({
                date: fileA.dateStr,
                id: rowA.id,
                name: rowA.name,
                inA: rowA.in,
                outA: rowA.out,
                inB: bIn,
                outB: bOut,
                statusKey: status, // Internal key for filtering
                statusLabel: status // Display text
            });
        }
    }

    renderTable();
}

/**
 * Renders the HTML table and summary stats based on current filters and sort options.
 * Also toggles the visibility of the control area.
 */
function renderTable() {
    const outputDiv = document.getElementById('output');
    const summaryDiv = document.getElementById('resultsSummary');
    const controlsArea = document.querySelector('.controls-area');

    // Get current UI state
    const filterEl = document.getElementById('filterStatus');
    const sortEl = document.getElementById('sortByName');
    const filterVal = filterEl ? filterEl.value : 'ALL';
    const sortByName = sortEl ? sortEl.checked : false;

    if (comparisonResults.length === 0) {
        outputDiv.innerHTML = '<p style="text-align:center;">No results to display.</p>';
        summaryDiv.innerHTML = '';
        controlsArea.style.display = 'none';
        return;
    }

    // Show controls now that we have data
    controlsArea.style.display = 'flex';

    // Apply Filter
    let displayData = comparisonResults;
    if (filterVal !== 'ALL') {
        displayData = displayData.filter(r => r.statusKey === filterVal || (filterVal === 'NOT_FOUND' && r.statusKey === 'NOT FOUND IN B'));
    }

    // Apply Sort
    if (sortByName) {
        // Create a shallow copy to stay pure, then sort
        displayData = [...displayData].sort((a, b) => a.name.localeCompare(b.name));
    }

    // Calculate Stats
    const matchCount = comparisonResults.filter(r => r.statusKey === 'MATCH').length;
    const mismatchCount = comparisonResults.filter(r => r.statusKey === 'MISMATCH').length;
    const missingCount = comparisonResults.filter(r => r.statusKey === 'NOT FOUND IN B').length;

    // 1. Render Summary
    summaryDiv.innerHTML = `
        <div style="padding:15px; background: rgba(0,0,0,0.4); border: 1px solid var(--glass-border); color: white; margin-bottom:10px; border-radius:5px; display: flex; gap: 15px; align-items: center; justify-content: center;">
            <strong style="font-size: 1.1em;">Summary:</strong> 
            <span class="badge match">Matches: ${matchCount}</span>
            <span class="badge mismatch">Mismatches: ${mismatchCount}</span>
            <span class="badge missing">Missing in B: ${missingCount}</span>
        </div>
    `;

    // 2. Render Table
    let tableHtml = `
    <div class="results-table-wrapper">
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Safety Pass No</th>
                    <th>Name</th>
                    <th>File A In</th>
                    <th>File B In</th>
                    <th>File A Out</th>
                    <th>File B Out</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
    `;

    displayData.forEach(row => {
        let badgeClass = "badge";
        if (row.statusKey === 'MATCH') badgeClass += " match";
        else if (row.statusKey === 'MISMATCH') badgeClass += " mismatch";
        else badgeClass += " missing";

        tableHtml += `
            <tr>
                <td>${row.date}</td>
                <td>${row.id}</td>
                <td>${row.name}</td>
                <td>${row.inA}</td>
                <td>${row.inB}</td>
                <td>${row.outA}</td>
                <td>${row.outB}</td>
                <td><span class="${badgeClass}">${row.statusLabel}</span></td>
            </tr>
        `;
    });

    tableHtml += `</tbody></table></div>`;
    outputDiv.innerHTML = tableHtml;
}

/**
 * Exports the currently displayed comparison results to an Excel file.
 */
function downloadReport() {
    if (comparisonResults.length === 0) {
        alert("No data to download. Please compare files first.");
        return;
    }

    const sortByName = document.getElementById('sortByName') ? document.getElementById('sortByName').checked : false;
    let dataToExport = [...comparisonResults];

    if (sortByName) {
        dataToExport.sort((a, b) => a.name.localeCompare(b.name));
    }

    // Map to simple object for SheetJS
    const exportData = dataToExport.map(r => ({
        "Date": r.date,
        "Safety Pass No": r.id,
        "Name": r.name,
        "File A In": r.inA,
        "File B In": r.inB,
        "File A Out": r.outA,
        "File B Out": r.outB,
        "Status": r.statusLabel
    }));

    // Create Worksheet
    const ws = XLSX.utils.json_to_sheet(exportData);

    // Set Column Widths
    ws['!cols'] = [
        { wch: 12 }, { wch: 15 }, { wch: 25 },
        { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 15 }
    ];

    // Create Workbook & Save
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Comparison Report");
    XLSX.writeFile(wb, "Attendance_Discrepancy_Report.xlsx");
}

/**
 * Reads a single File A (Daily Report), extracting date and records.
 * @param {File} file - The uploaded .xls file
 * @returns {Promise<Object>} - { dateStr, records }
 */
function readFileA(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array', cellText: false, cellDates: true });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

                // 1. Find Date in the first 20 rows
                let extractedDate = null;
                const dateRegex = /Date\s*[:\.-]?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i;

                for (let i = 0; i < 20 && i < aoa.length; i++) {
                    const rowStr = aoa[i].join(" ");
                    const match = rowStr.match(dateRegex);
                    if (match) {
                        extractedDate = match[1];
                        break;
                    }
                }

                if (!extractedDate) {
                    return reject(new Error("Date not found in File A header (Rows 1-20)."));
                }

                // 2. Find Table Header
                let headerIndex = -1;
                for (let i = 0; i < aoa.length; i++) {
                    if (aoa[i].join(" ").toLowerCase().includes("safety pass no")) {
                        headerIndex = i;
                        break;
                    }
                }
                if (headerIndex === -1) {
                    return reject(new Error("Column 'Safety Pass No' not found."));
                }

                // 3. Extract Records
                const rawRecords = XLSX.utils.sheet_to_json(sheet, { range: headerIndex, raw: false });
                if (rawRecords.length === 0) return reject(new Error("Table found but empty."));

                // Dynamically find keys based on lowercase match
                const keys = Object.keys(rawRecords[0]);
                const idKey = keys.find(k => k.toLowerCase().includes("safety pass no"));
                const inKey = keys.find(k => k.toLowerCase().includes("in time"));
                const outKey = keys.find(k => k.toLowerCase().includes("out time"));
                const nameKey = keys.find(k => k.toLowerCase().includes("employee name"));

                if (!idKey || !inKey || !outKey) {
                    return reject(new Error("Missing required columns (Safety Pass No, In Time, Out Time)."));
                }

                const cleanRecords = rawRecords
                    .map(r => ({
                        id: (r[idKey] || '').toString().trim(),
                        name: r[nameKey] || '',
                        in: formatTime(r[inKey]),
                        out: formatTime(r[outKey])
                    }))
                    .filter(r => r.id); // Filter out empty IDs

                resolve({ dateStr: extractedDate, records: cleanRecords });

            } catch (error) {
                reject(new Error("Parse fail: " + error.message));
            }
        };

        reader.onerror = () => reject(new Error("File read error"));
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Reads File B (Vendor Report), iterating through ALL sheets.
 * @param {File} file - The .xlsx file
 * @returns {Promise<Array>} - List of all found records
 */
function readFileBAsList(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                const allRecords = [];

                workbook.SheetNames.forEach(sheetName => {
                    const sheet = workbook.Sheets[sheetName];
                    // Skip empty sheets if any logic needed, but looping safe
                    const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

                    // Data usually starts at row 3 (index 2)
                    for (let i = 2; i < aoa.length; i++) {
                        const row = aoa[i];
                        if (!row || row.length < 5) continue;

                        // Check 'OFF' statuses
                        const opNameCheck = (row[3] || '').toString().trim().toUpperCase(); // Operator Name col
                        if (opNameCheck === 'OFF') continue;

                        // Parse Date
                        let dateStr = "";
                        const rawDate = row[1];
                        if (rawDate instanceof Date) {
                            const d = String(rawDate.getDate()).padStart(2, '0');
                            const m = String(rawDate.getMonth() + 1).padStart(2, '0');
                            const y = rawDate.getFullYear();
                            dateStr = `${d}-${m}-${y}`;
                        } else if (rawDate) {
                            dateStr = rawDate.toString().trim();
                        }

                        // --- Extract Operator (Col Index 4) ---
                        const opID = (row[4] || '').toString().trim();
                        if (opID && opID.toLowerCase() !== "off") {
                            allRecords.push({
                                sheet: sheetName,
                                date: dateStr,
                                id: opID,
                                in: formatTime(row[5]),
                                out: formatTime(row[6])
                            });
                        }

                        // --- Extract Flagman (Col Index 10) ---
                        const flID = (row[10] || '').toString().trim();
                        if (flID && flID.toLowerCase() !== "off") {
                            allRecords.push({
                                sheet: sheetName,
                                date: dateStr,
                                id: flID,
                                in: formatTime(row[11]),
                                out: formatTime(row[12])
                            });
                        }
                    }
                });

                resolve(allRecords);

            } catch (error) {
                reject(new Error("File B parse fail: " + error.message));
            }
        };

        reader.onerror = () => reject(new Error("File read error"));
        reader.readAsArrayBuffer(file);
    });
}

/** ----------------------------
 *  HELPER FUNCTIONS
 *  ----------------------------
 */

/**
 * Formats a time value (Excel serial, Date object, or String) into "HH:MM AM/PM"
 */
function formatTime(val) {
    if (!val) return "N/A";
    const s = val.toString().trim().toUpperCase();
    if (s === "OFF" || s === "") return "N/A";

    // Handle Excel fractional day (e.g. 0.5 = 12:00 PM)
    if (typeof val === 'number') {
        const totalSeconds = Math.round(val * 86400);
        let h = Math.floor(totalSeconds / 3600);
        const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${h}:${m} ${ampm}`;
    }

    // Handle JS Date
    if (val instanceof Date) {
        let h = val.getHours();
        const m = String(val.getMinutes()).padStart(2, '0');
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${h}:${m} ${ampm}`;
    }

    return s;
}

/**
 * Normalizes date separators to dashes (e.g. 1/2/22 -> 01-02-2022)
 */
function normalizeDate(dateStr) {
    if (!dateStr) return "";
    let s = dateStr.replace(/\//g, '-');
    const parts = s.split('-');

    // Attempt basic fix for d-m-y or d-m-yy
    if (parts.length === 3) {
        const d = parts[0].padStart(2, '0');
        const m = parts[1].padStart(2, '0');
        let y = parts[2];
        if (y.length === 2) y = "20" + y;
        return `${d}-${m}-${y}`;
    }
    return s;
}

/**
 * Parses "H:MM AM/PM" or "HH:MM" into minutes from midnight for comparison.
 * Returns -1 if invalid/empty.
 */
function getMinutesFromTime(timeStr) {
    if (!timeStr || timeStr === "N/A" || typeof timeStr !== 'string') return -1;

    // Normalize string: remove spaces, lowercase
    const s = timeStr.toLowerCase().replace(/\s/g, '');

    // Pattern: 12:30pm or 14:30
    const match = s.match(/^(\d{1,2}):(\d{2})([ap]m)?$/);
    if (!match) return -999; // Error value

    let hour = parseInt(match[1], 10);
    const min = parseInt(match[2], 10);
    const meridian = match[3];

    if (meridian) {
        if (meridian === 'pm' && hour < 12) hour += 12;
        if (meridian === 'am' && hour === 12) hour = 0;
    }

    return (hour * 60) + min;
}
