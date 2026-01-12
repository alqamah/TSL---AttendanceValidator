// --- START OF FILE script.js ---

// Global variables to store parsed data
let extractedA = null;
let extractedB = null;

// New Globals for Search/Filter
let comparisonResults = []; // Stores the final compared validation list
let currentFilter = 'all';  // 'all' | 'MATCH' | 'MISMATCH' | 'NOT FOUND IN B' | 'DUPLICATE'
let searchTerm = '';

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

// --- STEP 1: EXTRACT FILE A (MULTIPLE FILES) ---
async function extractFileA() {
    const fileAInput = document.getElementById('fileA');
    const outputDiv = document.getElementById('output');
    const infoPanel = document.getElementById('infoPanel');

    if (!fileAInput.files || fileAInput.files.length === 0) {
        alert("Please upload at least one File A.");
        return false;
    }

    // Reset previous state
    extractedA = { records: [], dates: new Set() }; // Reset
    outputDiv.innerHTML = '<div class="spinner"></div><p style="text-align:center">Reading File A...</p>';

    let errors = [];

    try {
        // Iterate over all selected files
        for (let i = 0; i < fileAInput.files.length; i++) {
            const file = fileAInput.files[i];
            try {
                const fileData = await readFileA(file);
                // fileData = { dateStr: "DD-MM-YYYY", records: [...] }

                extractedA.dates.add(fileData.dateStr);

                // Add Date to each record and push to master list
                fileData.records.forEach(rec => {
                    extractedA.records.push({
                        ...rec,
                        date: fileData.dateStr
                    });
                });

            } catch (err) {
                console.error(`Error parsing ${file.name}:`, err);
                errors.push(`${file.name}: ${err.message}`);
            }
        }

        if (extractedA.records.length === 0) {
            throw new Error("No valid records found in any of the uploaded files. " + errors.join(", "));
        }

        const dateList = Array.from(extractedA.dates).join(", ");

        infoPanel.innerHTML = `
            <strong>File A Ready:</strong><br>
            Dates Found: ${dateList}<br>
            Total Records: ${extractedA.records.length}
        `;
        if (errors.length > 0) {
            infoPanel.innerHTML += `<br><span style="color:red; font-size:0.9em;">Errors: ${errors.join("; ")}</span>`;
        }

        infoPanel.style.display = 'block';
        return true;

    } catch (err) {
        console.error(err);
        outputDiv.innerHTML = `<div style="text-align: center; color: red; padding: 20px;"><strong>Error File A:</strong> ${err.message}</div>`;
        return false;
    }
}

// --- STEP 2: EXTRACT FILE B (ALL SHEETS) ---
async function extractFileB() {
    const fileBInput = document.getElementById('fileB');
    const outputDiv = document.getElementById('output');
    const infoPanel = document.getElementById('infoPanel');

    if (!fileBInput.files[0]) {
        alert("Please upload File B.");
        return false;
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

        return true;

    } catch (err) {
        console.error(err);
        outputDiv.innerHTML = `<div style="text-align: center; color: red; padding: 20px;"><strong>Error File B:</strong> ${err.message}</div>`;
        return false;
    }
}

async function processAndCompare() {
    // 1. Check if files are selected
    const fileAInput = document.getElementById('fileA');
    const fileBInput = document.getElementById('fileB');

    if (!fileAInput.files || fileAInput.files.length === 0) {
        alert("Please upload File A.");
        return;
    }
    if (!fileBInput.files || fileBInput.files.length === 0) {
        alert("Please upload File B.");
        return;
    }

    // 2. Extract File A
    const successA = await extractFileA();
    if (!successA) return;

    // 3. Extract File B
    const successB = await extractFileB();
    if (!successB) return;

    // 4. Compare
    compareFiles();
}

//NO FILTER


// --- STEP 3: COMPARE AND DISPLAY ---
function compareFiles() {
    const outputDiv = document.getElementById('output');
    const controlsDiv = document.getElementById('controls');

    if (!extractedA || !extractedA.records || extractedA.records.length === 0) {
        alert("Please parse File A first.");
        return;
    }
    if (!extractedB) {
        alert("Please parse File B first.");
        return;
    }

    // 1. Create Data Structure for File A (Key: ID + Date)
    const mapA = {};
    extractedA.records.forEach(rec => {
        const key = `${rec.id}_${normalizeDate(rec.date)}`;
        mapA[key] = rec;
    });

    console.log(`Map A created with ${Object.keys(mapA).length} unique entries.`);

    // 2. Filter File B & Detect Duplicates
    const mapB = {};

    extractedB.forEach(rec => {
        const key = `${rec.id}_${normalizeDate(rec.date)}`;

        if (mapA[key]) {
            if (!mapB[key]) {
                mapB[key] = {
                    record: rec,
                    history: [rec]
                };
            } else {
                mapB[key].history.push(rec);
            }
        }
    });

    // 3. Build Comparison Results Array (Populate Global Variable)
    comparisonResults = [];

    extractedA.records.forEach(rowA => {
        const key = `${rowA.id}_${normalizeDate(rowA.date)}`;
        const entryB = mapB[key];

        let resultRow = {
            //date: rowA.date.substring(0, 5),
            date: rowA.date,
            id: rowA.id,
            name: rowA.name,
            crane: "N/A",
            inA: rowA.in,
            inB: "N/A",
            outA: rowA.out,
            outB: "N/A",
            status: "",
            colorClass: ""
        };

        if (entryB) {
            // Check for Duplicates
            if (entryB.history.length > 1) {
                resultRow.status = "DUPLICATE";
                resultRow.colorClass = "color: #FE91FF; font-weight:bold;";
                const uniqueCranes = [...new Set(entryB.history.map(r => r.sheet))];
                resultRow.crane = uniqueCranes.join(", ");

                const uniqueIn = [...new Set(entryB.history.map(r => r.in))];
                resultRow.inB = uniqueIn.join(" / ");

                const uniqueOut = [...new Set(entryB.history.map(r => r.out))];
                resultRow.outB = uniqueOut.join(" / ");

            } else {
                // Single Match
                const rowB = entryB.record;
                resultRow.crane = rowB.sheet;
                resultRow.inB = rowB.in;
                resultRow.outB = rowB.out;

                // Time Comparison
                const minA_In = getMinutesFromTime(rowA.in);
                const minB_In = getMinutesFromTime(resultRow.inB);
                const minA_Out = getMinutesFromTime(rowA.out);
                const minB_Out = getMinutesFromTime(resultRow.outB);

                const inMatch = (minA_In === minB_In);
                const outMatch = (minA_Out === minB_Out);

                if (inMatch && outMatch) {
                    resultRow.status = "MATCH";
                    resultRow.colorClass = "color: #AFE1AF; font-weight:bold;";
                } else {
                    resultRow.status = "MISMATCH";
                    resultRow.colorClass = "color: #FF7559; font-weight:bold;";
                }
            }
            comparisonResults.push(resultRow);
        }
    });

    // Show Controls
    controlsDiv.style.display = "flex";

    // Initial Render
    filterData();
}

// --- FILTER & RENDER LOGIC ---

function setFilter(filterType, btnElement) {
    currentFilter = filterType;

    // Update active button state
    const btns = document.querySelectorAll('.btn-filter');
    btns.forEach(b => b.classList.remove('active'));
    btnElement.classList.add('active');

    filterData();
}

function filterData() {
    const searchInput = document.getElementById('searchInput');
    searchTerm = searchInput.value.toLowerCase().trim();

    const filtered = comparisonResults.filter(row => {
        // 1. Status Filter
        let statusMatch = true;
        if (currentFilter !== 'all') {
            statusMatch = (row.status === currentFilter);
        }

        // 2. Search Filter (Name or ID)
        let searchMatch = true;
        if (searchTerm) {
            searchMatch = row.name.toLowerCase().includes(searchTerm) ||
                row.id.toLowerCase().includes(searchTerm);
        }

        return statusMatch && searchMatch;
    });

    renderTable(filtered);
}

function renderTable(data) {
    const outputDiv = document.getElementById('output');

    // Calculate Summary Counts from ALL results (to show overall health)
    let match = 0, mismatch = 0, duplicate = 0;
    comparisonResults.forEach(r => {
        if (r.status === "MATCH") match++;
        else if (r.status === "MISMATCH") mismatch++;
        else if (r.status === "DUPLICATE") duplicate++;
    });

    let html = `
    <div class="results-table-wrapper">
        <h3 style="padding: 20px; color: white;">Comparison Report</h3>
        <p style="padding-left: 20px; color: #ddd;">
            Total Records: ${comparisonResults.length} &nbsp;|&nbsp; 
            Showing: ${data.length}
        </p>
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Safety Pass No &nbsp;</th>
                    <th>Name</th>
                    <th>Crane Name &emsp; </th>
                    <th>CLM P-In</th>
                    <th>Vendor P-In</th>
                    <th>CLM P-Out</th>
                    <th>Vendor P-Out</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
    `;

    if (data.length === 0) {
        html += `<tr><td colspan="9" style="text-align:center; padding: 20px;">No records match your filters.</td></tr>`;
    } else {
        data.forEach(row => {
            html += `
                <tr>
                    <td>${row.date}</td>
                    <td>${row.id}</td>
                    <td>${row.name}</td>
                    <td>${row.crane}</td>
                    <td>${row.inA}</td>
                    <td>${row.inB}</td>
                    <td>${row.outA}</td>
                    <td>${row.outB}</td>
                    <td style="${row.colorClass}">${row.status}</td>
                </tr>
            `;
        });
    }

    html += `</tbody></table>
        <div style="padding:15px; background:#eee; margin-top:10px; border-radius:5px; color: #333;">
            <strong>Overall Summary:</strong> &nbsp; 
            <span style="color:green">Matches: ${match}</span> &nbsp;|&nbsp; 
            <span style="color:orange">Mismatches: ${mismatch}</span> &nbsp;|&nbsp; 
            <span style="color:purple">Duplicates in B: ${duplicate}</span>
        </div>
    </div>`;

    outputDiv.innerHTML = html;
}

// --- DOWNLOAD FUNCTION ---
function downloadReport() {
    if (!comparisonResults || comparisonResults.length === 0) {
        alert("No data to download.");
        return;
    }

    // Map to simple object structure for SheetJS
    const exportData = comparisonResults.map(row => ({
        "Date": row.date,
        "Safety Pass No": row.id,
        "Name": row.name,
        "Crane Name": row.crane,
        "File A In": row.inA,
        "File B In": row.inB,
        "File A Out": row.outA,
        "File B Out": row.outB,
        "Status": row.status
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Comparison Report");

    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Attendance_Report_${dateStr}.xlsx`);
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