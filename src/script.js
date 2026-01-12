// --- START OF FILE script.js ---

// Global variables to store parsed data
let extractedA = null;
let extractedB = null;

// UI Helper: Update filename label on upload
function updateFileName(inputId, statusId) {
    const input = document.getElementById(inputId);
    const status = document.getElementById(statusId);
    if (input.files && input.files[0]) {
        status.textContent = input.files[0].name;
    } else {
        status.textContent = "";
    }
}

// --- STEP 1: EXTRACT FILE A ---
async function extractFileA() {
    const fileAInput = document.getElementById('fileA');
    const outputDiv = document.getElementById('output');
    const infoPanel = document.getElementById('infoPanel');

    if (!fileAInput.files[0]) {
        alert("Please upload File A.");
        return;
    }

    // Reset previous state
    extractedA = null;
    outputDiv.innerHTML = '<div class="spinner"></div><p style="text-align:center">Reading File A...</p>';
    
    try {
        const fileAData = await readFileA(fileAInput.files[0]);
        extractedA = fileAData;

        infoPanel.innerHTML = `
            <strong>File A Ready:</strong><br>
            Reference Date: ${fileAData.dateStr}<br>
            Employees found: ${fileAData.records.length}
        `;
        infoPanel.style.display = 'block';
        outputDiv.innerHTML = '<p style="text-align:center; color:green;">File A Uploded Successfully. Now Upload File B.</p>';

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

    // Reset previous B state
    extractedB = null;
    outputDiv.innerHTML = '<div class="spinner"></div><p style="text-align:center">Reading ALL sheets in File B...</p>';

    try {
        const fileBData = await readFileBAsList(fileBInput.files[0]);
        extractedB = fileBData;

        // Append info to panel
        infoPanel.innerHTML += `
            <br><br><strong>File B Ready:</strong><br>
            Total Records Scanned: ${fileBData.length} (across all sheets)
        `;
        
        outputDiv.innerHTML = '<p style="text-align:center; color:green;">File B Uploaded Successfully. Click "Compare Files" to generate report.</p>';

    } catch (err) {
        console.error(err);
        outputDiv.innerHTML = `<div style="text-align: center; color: red; padding: 20px;"><strong>Error File B:</strong> ${err.message}</div>`;
    }
}

//NO FILTER


// --- STEP 3: COMPARE AND DISPLAY ---
function compareFiles() {
    const outputDiv = document.getElementById('output');

    if (!extractedA || !extractedB) {
        alert("Please parse both files first.");
        return;
    }

    // 1. Normalize the Target Date from File A (e.g. "01-11-2025")
    const targetDateNorm = normalizeDate(extractedA.dateStr); 
    console.log("Target Date:", targetDateNorm);

    // 2. Filter File B to only include records matching that date
    const mapB = {};
    let bRecordCount = 0;

    extractedB.forEach(rec => {
        const recDateNorm = normalizeDate(rec.date);
        if (recDateNorm === targetDateNorm) {
            mapB[rec.id] = rec;
            bRecordCount++;
        }
    });
    
    console.log(`Matching records in File B for date ${targetDateNorm}: ${bRecordCount}`);

    // 3. Build the Comparison Table based on File A records
    let html = `
    <div class="results-table-wrapper">
        <h3 style="padding: 20px; color: white;">Comparison Report (Date: ${extractedA.dateStr})</h3>
        <table>
            <thead>
                <tr>
                    <th>Safety Pass No</th>
                    <th>Name</th>
                    <th>File A Punch-In</th>
                    <th>File B Punch-In</th>
                    <th>File A Punch-Out</th>
                    <th>File B Punch-Out</th>
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

            // --- TIME COMPARISON LOGIC ---
            // Convert time strings to Minutes for numerical comparison
            // This handles cases like "05:00 AM" vs "5:00 am"
            const minA_In = getMinutesFromTime(rowA.in);
            const minB_In = getMinutesFromTime(bIn);
            const minA_Out = getMinutesFromTime(rowA.out);
            const minB_Out = getMinutesFromTime(bOut);

            // Compare numerical values
            // Note: If data is missing (-1), it won't match unless both are missing
            const inMatch = (minA_In === minB_In);
            const outMatch = (minA_Out === minB_Out);

            if (inMatch && outMatch) {
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
		//continue;
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
        <div style="padding:15px; background:#eee; margin-top:10px; border-radius:5px;">
            <strong>Summary:</strong> &nbsp; 
            <span style="color:green">Matches: ${matchCount}</span> &nbsp;|&nbsp; 
            <span style="color:orange">Mismatches: ${mismatchCount}</span> &nbsp;|&nbsp; 
            <span style="color:red">Missing in B: ${missingCount}</span>
        </div>
    </div>`;

    outputDiv.innerHTML = html;
}


//FILTER ONLY GREEN
/*

// --- STEP 3: COMPARE AND DISPLAY ---
function compareFiles() {
    const outputDiv = document.getElementById('output');

    if (!extractedA || !extractedB) {
        alert("Please parse both files first.");
        return;
    }

    // Read filter from UI (default to 'match' if not present)
    const filterEl = document.getElementById('filterType');
    const filterType = filterEl ? filterEl.value : 'match'; // 'match' | 'mismatch'

    // 1. Normalize the Target Date from File A (e.g. "01-11-2025")
    const targetDateNorm = normalizeDate(extractedA.dateStr); 
    console.log("Target Date:", targetDateNorm);

    // 2. Filter File B to only include records matching that date
    const mapB = {};
    let bRecordCount = 0;

    extractedB.forEach(rec => {
        const recDateNorm = normalizeDate(rec.date);
        if (recDateNorm === targetDateNorm) {
            mapB[rec.id] = rec;
            bRecordCount++;
        }
    });
    
    console.log(`Matching records in File B for date ${targetDateNorm}: ${bRecordCount}`);

    // 3. Build the Comparison Table based on File A records
    let html = `
    <div class="results-table-wrapper">
        <h3 style="padding: 20px; color: white;">Comparison Report (Date: ${extractedA.dateStr})</h3>
        <table>
            <thead>
                <tr>
                    <th>Safety Pass No</th>
                    <th>Name</th>
                    <th>File A Punch-In</th>
                    <th>File B Punch-In</th>
                    <th>File A Punch-Out</th>
                    <th>File B Punch-Out</th>
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
        let colorStyle = "";

        if (rowB) {
            bIn = rowB.in;
            bOut = rowB.out;

            // --- TIME COMPARISON LOGIC ---
            const minA_In = getMinutesFromTime(rowA.in);
            const minB_In = getMinutesFromTime(bIn);
            const minA_Out = getMinutesFromTime(rowA.out);
            const minB_Out = getMinutesFromTime(bOut);

            const inMatch = (minA_In === minB_In);
            const outMatch = (minA_Out === minB_Out);

            if (inMatch && outMatch) {
                status = "MATCH";
                colorStyle = "color: green; font-weight:bold;";
                matchCount++;
            } else {
                status = "MISMATCH";
                colorStyle = "color: orange; font-weight:bold;";
                mismatchCount++;
            }

        } else {
            // Do not display "NOT FOUND IN B" rows
            status = "NOT FOUND IN B";
            colorStyle = "color: red; font-weight:bold;";
            missingCount++;
            return; // Skip rendering this row altogether
        }

        // Apply filter: only render rows that match the selected filterType
        const isMatchRow = status === "MATCH";
        const shouldRender =
            (filterType === 'match' && isMatchRow) ||
            (filterType === 'mismatch' && !isMatchRow);

        if (!shouldRender) {
            return; // Skip rows outside the filter
        }

        html += `
            <tr>
                <td>${rowA.id}</td>
                <td>${rowA.name}</td>
                <td>${rowA.in}</td>
                <td>${bIn}</td>
                <td>${rowA.out}</td>
                <td>${bOut}</td>
                <td style="${colorStyle}">${status}</td>
            </tr>
        `;
    });

    html += `</tbody></table>
        <div style="padding:15px; background:#eee; margin-top:10px; border-radius:5px;">
            <strong>Summary:</strong>&nbsp; 
            <span style="color:green">Matches: ${matchCount}</span>&nbsp;|&nbsp; 
            <span style="color:orange">Mismatches: ${mismatchCount}</span>
            <!-- Missing in B counted but not displayed as rows; uncomment if you want to show the count:
            &nbsp;|&nbsp;<span style="color:red">Missing in B: ${missingCount}</span>
            -->
        </div>
    </div>`;

    outputDiv.innerHTML = html;
}
*/

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
                        // Looking for Flagman ID in column K (Index 10)
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

// Converts various inputs (Excel Number, Date Obj, String) to "H:MM AM/PM" String
function formatTime(val) {
    if (!val) return "N/A";
    if (typeof val === 'string' && val.trim().toUpperCase() === "OFF") return "N/A";

    // Excel number (fraction of day)
    if (typeof val === 'number') {
        const totalSeconds = Math.round(val * 86400);
        let h = Math.floor(totalSeconds / 3600);
        const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${h}:${m} ${ampm}`;
    }

    // Date Object
    if (val instanceof Date) {
        let h = val.getHours();
        const m = String(val.getMinutes()).padStart(2, '0');
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${h}:${m} ${ampm}`;
    }

    return val.toString().trim();
}

// Converts "01/11/2025" or "1-11-2025" to standard "DD-MM-YYYY" for key matching
function normalizeDate(dateStr) {
    if (!dateStr) return "";
    
    // Replace slashes with dashes
    let s = dateStr.replace(/\//g, '-');
    
    // Split to check format
    const parts = s.split('-'); 
    
    if (parts.length === 3) {
        let d = parts[0].padStart(2, '0');
        let m = parts[1].padStart(2, '0');
        let y = parts[2];
        
        // Handle 2-digit year
        if (y.length === 2) y = "20" + y;
        
        return `${d}-${m}-${y}`;
    }
    return s;
}

// Converts "05:20 PM" or "5:20 AM" into total minutes (e.g., 320)
// Used only for the final comparison logic
function getMinutesFromTime(timeStr) {
    if (!timeStr || timeStr === "N/A" || timeStr.trim() === "") return -1;
    
    // Normalize: remove spaces, lowercase
    const s = timeStr.toString().toLowerCase().replace(/\s/g, '');
    
    // Regex to find HH:MM and optional am/pm
    const match = s.match(/^(\d{1,2}):(\d{2})([ap]m)?$/);
    
    if (!match) return -999; 

    let hour = parseInt(match[1], 10);
    const min = parseInt(match[2], 10);
    const meridian = match[3]; // "am" or "pm"

    if (meridian) {
        if (meridian === 'pm' && hour < 12) hour += 12;
        if (meridian === 'am' && hour === 12) hour = 0;
    }

    return (hour * 60) + min;
}