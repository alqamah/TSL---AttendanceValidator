// --- START OF FILE script.js ---

// Global variables to store parsed data
let extractedA_Data = []; // Array of { fileName, dateStr, records: [] }
let extractedB_Data = []; // Array of all records from File B
let comparisonResults = []; // Processed results for display

// UI Helper: Update filename label on upload
function updateFileName(inputId, statusId) {
    const input = document.getElementById(inputId);
    const status = document.getElementById(statusId);
    if (input.files && input.files.length > 0) {
        if (input.files.length === 1) {
            status.textContent = input.files[0].name;
        } else {
            status.textContent = `${input.files.length} files selected`;
        }
    } else {
        status.textContent = "";
    }
}

// --- STEP 1: EXTRACT FILE A (Multiple Files) ---
async function extractFileA() {
    const fileAInput = document.getElementById('fileA');
    const outputDiv = document.getElementById('output');
    const infoPanel = document.getElementById('infoPanel');

    if (!fileAInput.files || fileAInput.files.length === 0) {
        alert("Please upload at least one File A.");
        return;
    }

    // Reset previous state
    extractedA_Data = [];
    outputDiv.innerHTML = '<div class="spinner"></div><p style="text-align:center">Reading File A(s)...</p>';

    let processedCount = 0;
    let errors = [];

    try {
        // Process files sequentially or in parallel. Parallel is fine.
        const promises = Array.from(fileAInput.files).map(async (file) => {
            try {
                const data = await readFileA(file);
                // Attach file name for reference
                return { fileName: file.name, ...data };
            } catch (e) {
                errors.push(`${file.name}: ${e.message}`);
                return null;
            }
        });

        const results = await Promise.all(promises);

        // Filter out failed uploads
        extractedA_Data = results.filter(r => r !== null);

        if (extractedA_Data.length === 0) {
            outputDiv.innerHTML = `<div style="text-align: center; color: red;">Failed to read any files.<br>${errors.join('<br>')}</div>`;
            return;
        }

        // Summary
        let summaryHtml = `<strong>File A Ready:</strong><br>`;
        extractedA_Data.forEach(item => {
            summaryHtml += `Date: ${item.dateStr} (${item.records.length} records) - ${item.fileName}<br>`;
        });

        if (errors.length > 0) {
            summaryHtml += `<br><span style="color:red">Errors: ${errors.length} files failed.</span>`;
        }

        infoPanel.innerHTML = summaryHtml;
        infoPanel.style.display = 'block';
        outputDiv.innerHTML = '<p style="text-align:center; color:green;">File A(s) Processed. Now Upload File B.</p>';

    } catch (err) {
        console.error(err);
        outputDiv.innerHTML = `<div style="text-align: center; color: red; padding: 20px;"><strong>Error details:</strong> ${err.message}</div>`;
    }
}

// --- STEP 2: EXTRACT FILE B (ALL SHEETS) ---
async function extractFileB() {
    const fileBInput = document.getElementById('fileB');
    const outputDiv = document.getElementById('output');
    const infoPanel = document.getElementById('infoPanel');

    if (!fileBInput.files[0]) {
        alert("Please upload File B.");
        return;
    }

    // Reset previous B state
    extractedB_Data = [];
    outputDiv.innerHTML = '<div class="spinner"></div><p style="text-align:center">Reading Multi-sheet File B...</p>';

    try {
        const fileBData = await readFileBAsList(fileBInput.files[0]);
        extractedB_Data = fileBData;

        // Append info to panel
        const currentContent = infoPanel.innerHTML;
        infoPanel.innerHTML = currentContent + `
            <br><br><strong>File B Ready:</strong><br>
            Total Records Scanned: ${fileBData.length} (across all sheets)
        `;

        outputDiv.innerHTML = '<p style="text-align:center; color:green;">File B Uploaded Successfully. Click "Compare Files" to generate report.</p>';

    } catch (err) {
        console.error(err);
        outputDiv.innerHTML = `<div style="text-align: center; color: red; padding: 20px;"><strong>Error File B:</strong> ${err.message}</div>`;
    }
}

// --- STEP 3: COMPARE FILES ---
function compareFiles() {
    if (extractedA_Data.length === 0 || extractedB_Data.length === 0) {
        alert("Please parse both File A (at least one) and File B first.");
        return;
    }

    // 1. Index File B for fast lookup
    // Key: "NORMALIZED_DATE|ID" -> Record
    const mapB = {};
    extractedB_Data.forEach(rec => {
        const normDate = normalizeDate(rec.date);
        const key = `${normDate}|${rec.id}`;
        mapB[key] = rec;
    });

    // 2. Build Comparison List
    comparisonResults = [];

    extractedA_Data.forEach(fileA => {
        const targetDateNorm = normalizeDate(fileA.dateStr);

        fileA.records.forEach(rowA => {
            const key = `${targetDateNorm}|${rowA.id}`;
            const rowB = mapB[key];

            let bIn = "N/A";
            let bOut = "N/A";
            let status = "";
            let colorClass = "";

            if (rowB) {
                bIn = rowB.in;
                bOut = rowB.out;

                // Compare Times
                const minA_In = getMinutesFromTime(rowA.in);
                const minB_In = getMinutesFromTime(bIn);
                const minA_Out = getMinutesFromTime(rowA.out);
                const minB_Out = getMinutesFromTime(bOut);

                // Strict match logic
                const inMatch = (minA_In === minB_In);
                const outMatch = (minA_Out === minB_Out);

                if (inMatch && outMatch) {
                    status = "MATCH";
                    colorClass = "status-match";
                } else {
                    status = "MISMATCH";
                    colorClass = "status-mismatch";
                }
            } else {
                status = "NOT FOUND IN B";
                colorClass = "status-missing";
            }

            comparisonResults.push({
                date: fileA.dateStr,
                id: rowA.id,
                name: rowA.name,
                inA: rowA.in,
                outA: rowA.out,
                inB: bIn,
                outB: bOut,
                status: status,
                statusKey: status, // for filtering
                colorClass: colorClass
            });
        });
    });

    renderTable();
}

// --- STEP 4: RENDER TABLE (Filter & Sort) ---
function renderTable() {
    const outputDiv = document.getElementById('output');
    const filterVal = document.getElementById('filterStatus') ? document.getElementById('filterStatus').value : 'ALL';
    const sortByName = document.getElementById('sortByName') ? document.getElementById('sortByName').checked : false;

    if (comparisonResults.length === 0) {
        outputDiv.innerHTML = '<p style="text-align:center;">No results to display.</p>';
        return;
    }

    // Filter
    let displayData = comparisonResults.filter(r => {
        if (filterVal === 'ALL') return true;
        if (filterVal === 'MATCH' && r.statusKey === 'MATCH') return true;
        if (filterVal === 'MISMATCH' && r.statusKey === 'MISMATCH') return true;
        if (filterVal === 'NOT_FOUND' && r.statusKey === 'NOT FOUND IN B') return true;
        return false;
    });

    // Sort
    if (sortByName) {
        displayData.sort((a, b) => a.name.localeCompare(b.name));
    }

    // Stats
    let matchCount = comparisonResults.filter(r => r.statusKey === 'MATCH').length;
    let mismatchCount = comparisonResults.filter(r => r.statusKey === 'MISMATCH').length;
    let missingCount = comparisonResults.filter(r => r.statusKey === 'NOT FOUND IN B').length;

    // Generate HTML
    let html = `
    <div class="results-table-wrapper">
        <div style="padding:15px; background:#333; color: white; margin-bottom:10px; border-radius:5px; display: flex; gap: 15px; align-items: center;">
            <strong>Total Summary:</strong> 
            <span>Matches: <span class="badge match">${matchCount}</span></span>
            <span>Mismatches: <span class="badge mismatch">${mismatchCount}</span></span>
            <span>Missing in B: <span class="badge missing">${missingCount}</span></span>
        </div>

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
        let badgeClass = "";
        if (row.statusKey === 'MATCH') badgeClass = "badge match";
        else if (row.statusKey === 'MISMATCH') badgeClass = "badge mismatch";
        else badgeClass = "badge missing";

        html += `
            <tr>
                <td>${row.date}</td>
                <td>${row.id}</td>
                <td>${row.name}</td>
                <td>${row.inA}</td>
                <td>${row.inB}</td>
                <td>${row.outA}</td>
                <td>${row.outB}</td>
                <td><span class="${badgeClass}">${row.status}</span></td>
            </tr>
        `;
    });

    html += `</tbody></table></div>`;
    outputDiv.innerHTML = html;
}

// --- DOWNLOAD REPORT ---
function downloadReport() {
    if (comparisonResults.length === 0) {
        alert("No data to download. Please compare files first.");
        return;
    }

    // Check if sorted
    const sortByName = document.getElementById('sortByName') ? document.getElementById('sortByName').checked : false;
    let dataToExport = [...comparisonResults];

    if (sortByName) {
        dataToExport.sort((a, b) => a.name.localeCompare(b.name));
    }

    const exportData = dataToExport.map(r => ({
        "Date": r.date,
        "Safety Pass No": r.id,
        "Name": r.name,
        "File A In": r.inA,
        "File B In": r.inB,
        "File A Out": r.outA,
        "File B Out": r.outB,
        "Status": r.status
    }));

    // 2. Create Sheet
    const ws = XLSX.utils.json_to_sheet(exportData);

    // 3. Column Widths
    const wscols = [
        { wch: 12 }, // Date
        { wch: 15 }, // ID
        { wch: 25 }, // Name
        { wch: 10 }, // In A
        { wch: 10 }, // In B
        { wch: 10 }, // Out A
        { wch: 10 }, // Out B
        { wch: 15 }  // Status
    ];
    ws['!cols'] = wscols;

    // 4. Create Workbook & Export
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Comparison Report");
    XLSX.writeFile(wb, "Attendance_Discrepancy_Report.xlsx");
}

// --- PARSER: FILE A ---
function readFileA(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array', cellText: false, cellDates: true });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

                // 1. Extract Date from Header (Rows 1-20)
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

                if (!extractedDate) return reject(new Error("Date not found in File A header (Rows 1-20)."));

                // 2. Find Header Row for Data Table
                let headerRowIndex = -1;
                for (let i = 0; i < aoa.length; i++) {
                    if (aoa[i].join(" ").toLowerCase().includes("safety pass no")) {
                        headerRowIndex = i;
                        break;
                    }
                }
                if (headerRowIndex === -1) return reject(new Error("Column 'Safety Pass No' not found in File A."));

                // 3. Map Columns
                const rawRecords = XLSX.utils.sheet_to_json(sheet, { range: headerRowIndex, raw: false });
                if (rawRecords.length === 0) return reject(new Error("Table found but empty."));

                const keys = Object.keys(rawRecords[0]);
                const idKey = keys.find(k => k.toLowerCase().includes("safety pass no"));
                const inKey = keys.find(k => k.toLowerCase().includes("in time"));
                const outKey = keys.find(k => k.toLowerCase().includes("out time"));
                const nameKey = keys.find(k => k.toLowerCase().includes("employee name"));

                if (!idKey || !inKey || !outKey) return reject(new Error("Could not map columns (ID, In, Out) in File A."));

                // 4. Build List
                const cleanRecords = rawRecords.map(r => ({
                    id: (r[idKey] || '').toString().trim(),
                    name: r[nameKey] || '',
                    in: formatTime(r[inKey]),
                    out: formatTime(r[outKey])
                })).filter(r => r.id);

                resolve({ dateStr: extractedDate, records: cleanRecords });
            } catch (error) {
                reject(new Error("Parse fail File A: " + error.message));
            }
        };
        reader.readAsArrayBuffer(file);
    });
}

// --- PARSER: FILE B (ALL SHEETS) ---
function readFileBAsList(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });

                const allRecords = [];

                // LOOP THROUGH ALL SHEETS
                workbook.SheetNames.forEach(sheetName => {
                    const sheet = workbook.Sheets[sheetName];
                    const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

                    // Assuming Data starts from index 2 (Row 3)
                    for (let i = 2; i < aoa.length; i++) {
                        const row = aoa[i];
                        if (!row || row.length < 2) continue;

                        const opNameCheck = (row[3] || '').toString().trim().toUpperCase();
                        if (opNameCheck === 'OFF') continue;

                        const rawDate = row[1];
                        let dateStr = "";

                        if (rawDate instanceof Date) {
                            const m = String(rawDate.getMonth() + 1).padStart(2, '0');
                            const d = String(rawDate.getDate()).padStart(2, '0');
                            const y = rawDate.getFullYear();
                            dateStr = `${d}-${m}-${y}`;
                        } else if (rawDate) {
                            dateStr = rawDate.toString().trim();
                        }

                        // --- 1. OPERATOR CHECK ---
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

                        // --- 2. FLAGMAN CHECK ---
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

                console.log(`Extracted ${allRecords.length} records from File B.`);
                resolve(allRecords);

            } catch (error) {
                reject(new Error("File B fail: " + error.message));
            }
        };
        reader.readAsArrayBuffer(file);
    });
}

// --- HELPER FUNCTIONS ---

function formatTime(val) {
    if (!val) return "N/A";
    if (typeof val === 'string' && val.trim().toUpperCase() === "OFF") return "N/A";

    if (typeof val === 'number') {
        const totalSeconds = Math.round(val * 86400);
        let h = Math.floor(totalSeconds / 3600);
        const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${h}:${m} ${ampm}`;
    }

    if (val instanceof Date) {
        let h = val.getHours();
        const m = String(val.getMinutes()).padStart(2, '0');
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${h}:${m} ${ampm}`;
    }

    return val.toString().trim();
}

function normalizeDate(dateStr) {
    if (!dateStr) return "";
    let s = dateStr.replace(/\//g, '-');
    const parts = s.split('-');
    if (parts.length === 3) {
        let d = parts[0].padStart(2, '0');
        let m = parts[1].padStart(2, '0');
        let y = parts[2];
        if (y.length === 2) y = "20" + y;
        return `${d}-${m}-${y}`;
    }
    return s;
}

function getMinutesFromTime(timeStr) {
    if (!timeStr || timeStr === "N/A" || timeStr.trim() === "") return -1;
    const s = timeStr.toString().toLowerCase().replace(/\s/g, '');
    const match = s.match(/^(\d{1,2}):(\d{2})([ap]m)?$/);
    if (!match) return -999;

    let hour = parseInt(match[1], 10);
    const min = parseInt(match[2], 10);
    const meridian = match[3];

    if (meridian) {
        if (meridian === 'pm' && hour < 12) hour += 12;
        if (meridian === 'am' && hour === 12) hour = 0;
    }
    return (hour * 60) + min;
}
