// --- START OF FILE script.js ---

function updateFileName(inputId, statusId) {
    const input = document.getElementById(inputId);
    const status = document.getElementById(statusId);
    if (input.files && input.files[0]) {
        status.textContent = input.files[0].name;
    } else {
        status.textContent = "";
    }
}

// Global variables to store data
let extractedA = null;
let extractedB = null;

// --- STEP 1: EXTRACT FILE A ---
async function extractFileA() {
    const fileAInput = document.getElementById('fileA');
    const outputDiv = document.getElementById('output');
    const infoPanel = document.getElementById('infoPanel');

    if (!fileAInput.files[0]) {
        alert("Please upload File A.");
        return;
    }

    outputDiv.innerHTML = '<div class="spinner"></div><p style="text-align:center">Reading File A...</p>';
    
    try {
        const fileAData = await readFileA(fileAInput.files[0]);
        extractedA = fileAData;

        infoPanel.innerHTML = `
            <strong>File A Ready:</strong><br>
            Reference Date: ${fileAData.dateStr}<br>
            Employees to Check: ${fileAData.records.length}
        `;
        infoPanel.style.display = 'block';
        outputDiv.innerHTML = '<p style="text-align:center; color:green;">File A Parsed Successfully. Now Upload File B.</p>';

    } catch (err) {
        console.error(err);
        outputDiv.innerHTML = `<div style="text-align: center; color: red; padding: 20px;"><strong>Error File A:</strong> ${err.message}</div>`;
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

    outputDiv.innerHTML = '<div class="spinner"></div><p style="text-align:center">Reading ALL sheets in File B...</p>';

    try {
        const fileBData = await readFileBAsList(fileBInput.files[0]);
        extractedB = fileBData;

        // Append info to panel
        infoPanel.innerHTML += `
            <br><br><strong>File B Ready:</strong><br>
            Total Records Found: ${fileBData.length} (across all sheets)
        `;
        
        outputDiv.innerHTML = '<p style="text-align:center; color:green;">File B Parsed Successfully. Click "Compare Files" to generate report.</p>';

    } catch (err) {
        console.error(err);
        outputDiv.innerHTML = `<div style="text-align: center; color: red; padding: 20px;"><strong>Error File B:</strong> ${err.message}</div>`;
    }
}

// --- STEP 3: COMPARE AND DISPLAY ---
function compareFiles() {
    const outputDiv = document.getElementById('output');

    if (!extractedA || !extractedB) {
        alert("Please parse both files first.");
        return;
    }

    // 1. Normalize the Target Date from File A
    const targetDateNorm = normalizeDate(extractedA.dateStr); // e.g., "01-11-2025"

    console.log("Target Date (Normalized):", targetDateNorm);

    // 2. Filter File B to only include records matching that date
    // We create a Map for O(1) lookup: Key = Safety Pass No, Value = {in, out}
    const mapB = {};

    extractedB.forEach(rec => {
        const recDateNorm = normalizeDate(rec.date);
        if (recDateNorm === targetDateNorm) {
            mapB[rec.id] = rec;
        }
    });

    console.log(`Found ${Object.keys(mapB).length} matching records in File B for date ${targetDateNorm}`);

    // 3. Build the Comparison Table based on File A records
    let html = `
    <div class="results-table-wrapper">
        <h3 style="padding: 20px; color: #333;">Comparison Report (Date: ${extractedA.dateStr})</h3>
        <table>
            <thead>
                <tr>
                    <th>Safety Pass No</th>
                    <th>Name</th>
                    <th style="background:#e3f2fd">File A In</th>
                    <th style="background:#e8f5e9">File B In</th>
                    <th style="background:#e3f2fd">File A Out</th>
                    <th style="background:#e8f5e9">File B Out</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
    `;

    let matchCount = 0;
    let mismatchCount = 0;
    let missingCount = 0;

    extractedA.records.forEach(rowA => {
        const rowB = mapB[rowA.id];
        
        let bIn = "N/A";
        let bOut = "N/A";
        let status = "";
        let colorClass = "";

        if (rowB) {
            bIn = rowB.in;
            bOut = rowB.out;

            // Compare Times (Simple string match)
            if (rowA.in === bIn && rowA.out === bOut) {
                status = "MATCH";
                colorClass = "color: green; font-weight:bold;";
                matchCount++;
            } else {
                status = "MISMATCH";
                colorClass = "color: orange; font-weight:bold;";
                mismatchCount++;
            }
        } else {
            status = "NOT FOUND IN B";
            colorClass = "color: red; font-weight:bold;";
            missingCount++;
        }

        html += `
            <tr>
                <td>${rowA.id}</td>
                <td>${rowA.name}</td>
                <td>${rowA.in}</td>
                <td>${bIn}</td>
                <td>${rowA.out}</td>
                <td>${bOut}</td>
                <td style="${colorClass}">${status}</td>
            </tr>
        `;
    });

    html += `</tbody></table>
        <div style="padding:15px; background:#eee; margin-top:10px;">
            <strong>Summary:</strong> Matches: ${matchCount} | Mismatches: ${mismatchCount} | Missing in B: ${missingCount}
        </div>
    </div>`;

    outputDiv.innerHTML = html;
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

                // 1. Extract Date from Header (Regex)
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

                // 2. Find Header Row
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
                if(rawRecords.length === 0) return reject(new Error("Table found but empty."));

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
                })).filter(r => r.id); // Remove empty rows

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
                // cellDates: true handles Excel serial dates automatically
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

                        // Check 'Operator Name' (Col D/Index 3) for "OFF"
                        const opNameCheck = (row[3] || '').toString().trim().toUpperCase();
                        if (opNameCheck === 'OFF') continue;

                        // Parse Date
                        const rawDate = row[1]; // Col B
                        let dateStr = "";

                        if (rawDate instanceof Date) {
                            // Standardize to DD-MM-YYYY
                            const m = String(rawDate.getMonth() + 1).padStart(2, '0');
                            const d = String(rawDate.getDate()).padStart(2, '0');
                            const y = rawDate.getFullYear();
                            dateStr = `${d}-${m}-${y}`; 
                        } else if (rawDate) {
                            dateStr = rawDate.toString().trim();
                        }

                        // --- 1. OPERATOR CHECK (Col E: Safety Pass, F: In, G: Out) ---
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

                        // --- 2. FLAGMAN CHECK (Col K: Safety Pass, L: In, M: Out) ---
                        // Note: Based on your previous context:
                        // J=Flagman Name, K=Flagman NO, L=Punch In, M=Punch Out
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

    // Convert Excel fraction to time
    if (typeof val === 'number') {
        // Excel treats 1 as 24 hours. 
        const totalSeconds = Math.round(val * 86400);
        let h = Math.floor(totalSeconds / 3600);
        const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${h}:${m} ${ampm}`;
    }

    // Convert Date object to Time String
    if (val instanceof Date) {
        let h = val.getHours();
        const m = String(val.getMinutes()).padStart(2, '0');
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${h}:${m} ${ampm}`;
    }

    return val.toString().trim();
}

// Ensure both dates convert to "DD-MM-YYYY" for string comparison
function normalizeDate(dateStr) {
    if (!dateStr) return "";
    
    // Replace slashes with dashes
    let s = dateStr.replace(/\//g, '-');
    
    // Split
    const parts = s.split('-'); // e.g., ["1", "11", "2025"] or ["01", "11", "25"]
    
    if (parts.length === 3) {
        let d = parts[0].padStart(2, '0');
        let m = parts[1].padStart(2, '0');
        let y = parts[2];
        
        // Handle 2-digit year (assume 20xx)
        if (y.length === 2) y = "20" + y;
        
        return `${d}-${m}-${y}`;
    }
    return s;
}
