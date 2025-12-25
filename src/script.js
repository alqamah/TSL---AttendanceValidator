function updateFileName(inputId, statusId) {
    const input = document.getElementById(inputId);
    const status = document.getElementById(statusId);
    if (input.files && input.files[0]) {
        status.textContent = input.files[0].name;
    } else {
        status.textContent = "";
    }
}

// Global variable to store data for comparison later
let extractedA = null;
let extractedB = null;

async function extractFileA() {
    const fileAInput = document.getElementById('fileA');
    const outputDiv = document.getElementById('output');
    const infoPanel = document.getElementById('infoPanel');

    if (!fileAInput.files[0]) {
        alert("Please upload File A.");
        return;
    }

    outputDiv.innerHTML = '<div class="spinner"></div>';
    infoPanel.style.display = 'none';

    try {
        const fileAData = await readFileA(fileAInput.files[0]);
        extractedA = fileAData;

        infoPanel.innerHTML = `
            <strong>File A Data Extracted:</strong><br>
            Reference Date: ${fileAData.dateStr}<br>
            Count: ${fileAData.records.length} records.
        `;
        infoPanel.style.display = 'block';

        displayExtractedData("Extracted Data from File A", [
            "Date", "Safety Pass Number", "Name", "Punch in time", "Punch out time"
        ], fileAData.records.map(r => [
            r.date, r.id, r.name, r.in, r.out
        ]));

    } catch (err) {
        console.error(err);
        outputDiv.innerHTML = `<div style="text-align: center; color: var(--danger); padding: 20px;"><strong>Error:</strong> ${err.message}</div>`;
    }
}

async function extractFileB() {
    const fileBInput = document.getElementById('fileB');
    const outputDiv = document.getElementById('output');
    const infoPanel = document.getElementById('infoPanel');

    if (!fileBInput.files[0]) {
        alert("Please upload File B.");
        return;
    }

    outputDiv.innerHTML = '<div class="spinner"></div>';
    infoPanel.style.display = 'none';

    try {
        const fileBData = await readFileBAsList(fileBInput.files[0]);
        extractedB = fileBData;

        infoPanel.innerHTML = `
            <strong>File B Data Extracted:</strong><br>
            Total Records Found: ${fileBData.length} (including Operators and Flagmen)
        `;
        infoPanel.style.display = 'block';

        displayExtractedData("Extracted Data from File B", [
            "Date", "Safety Pass Number", "Name", "Punch in time", "Punch out time"
        ], fileBData.map(r => [
            r.date, r.id, r.name, r.in, r.out
        ]));

    } catch (err) {
        console.error(err);
        outputDiv.innerHTML = `<div style="text-align: center; color: var(--danger); padding: 20px;"><strong>Error:</strong> ${err.message}</div>`;
    }
}

function compareFiles() {
    // Logic not implemented as per request
    alert("Comparison logic not yet implemented.");
}

function readFileA(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array', cellText: false, cellDates: true });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

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

                if (!extractedDate) return reject(new Error("Date not found in File A header."));

                let headerRowIndex = -1;
                for (let i = 0; i < aoa.length; i++) {
                    if (aoa[i].join(" ").toLowerCase().includes("safety pass no")) {
                        headerRowIndex = i;
                        break;
                    }
                }

                if (headerRowIndex === -1) return reject(new Error("Safety Pass No column not found in File A."));

                const rawRecords = XLSX.utils.sheet_to_json(sheet, { range: headerRowIndex, raw: false });
                const keys = Object.keys(rawRecords[0] || {});
                const idKey = keys.find(k => k.toLowerCase().includes("safety pass no"));
                const inKey = keys.find(k => k.toLowerCase().includes("in time"));
                const outKey = keys.find(k => k.toLowerCase().includes("out time"));
                const nameKey = keys.find(k => k.toLowerCase().includes("employee name"));

                const cleanRecords = rawRecords.map(r => ({
                    date: extractedDate,
                    id: (r[idKey] || '').toString().trim(),
                    name: r[nameKey] || '',
                    in: formatTime(r[inKey]),
                    out: formatTime(r[outKey])
                })).filter(r => r.id);

                resolve({ dateStr: extractedDate, records: cleanRecords });
            } catch (error) {
                reject(new Error("Parse fail: " + error.message));
            }
        };
        reader.readAsArrayBuffer(file);
    });
}

function readFileBAsList(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                // cellDates: true allows SheetJS to give us Date objects for dates and times
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

                const records = [];
                // Data starts from index 2 (A3) as index 1 (Row 2) is the header SL NO, DATE, etc.
                for (let i = 2; i < aoa.length; i++) {
                    const row = aoa[i];
                    if (!row || row.length < 2) continue;

                    // Check if Operator Name (Column D, index 3) is "OFF" - discard row if true
                    const opNameCheck = (row[3] || '').toString().trim().toUpperCase();
                    if (opNameCheck === 'OFF') continue;

                    const rawDate = row[1]; // B: DATE
                    let dateStr = "";

                    if (rawDate instanceof Date) {
                        // Extract components manually to avoid timezone issues
                        // and format as DD/MM/YYYY
                        const m = String(rawDate.getMonth() + 1).padStart(2, '0');
                        const d = String(rawDate.getDate()).padStart(2, '0');
                        const y = rawDate.getFullYear();
                        dateStr = `${d}/${m}/${y}`;
                    } else if (rawDate) {
                        // If it's already a string, just ensure it's trimmed
                        dateStr = rawDate.toString().trim();
                    }

                    // Operator Section (D, E, F, G)
                    const opID = (row[4] || '').toString().trim(); // E: SAFETY PASS NO
                    if (opID && opID.toLowerCase() !== "off") {
                        records.push({
                            date: dateStr,
                            id: opID,
                            name: (row[3] || '').toString().trim(), // D: OPERATOR NAME
                            in: formatTime(row[5]), // F: OPR. PUNCH IN
                            out: formatTime(row[6]) // G: OPR PUNCH OUT
                        });
                    }

                    // Flagman Section (J, K, L, M)
                    const flID = (row[10] || '').toString().trim(); // K: SAFETY PASS NO
                    if (flID && flID.toLowerCase() !== "off") {
                        records.push({
                            date: dateStr,
                            id: flID,
                            name: (row[9] || '').toString().trim(), // J: FLAGMAN NAME
                            in: formatTime(row[11]), // L: FLAGMAN PUNCH IN
                            out: formatTime(row[12]) // M: FLAGMAN PUNCH OUT
                        });
                    }
                }
                resolve(records);
            } catch (error) {
                reject(new Error("File B fail: " + error.message));
            }
        };
        reader.readAsArrayBuffer(file);
    });
}

function displayExtractedData(title, headers, rows) {
    let html = `
    <div class="results-table-wrapper">
        <h3 style="padding: 20px; margin: 0; color: var(--accent-color);">${title}</h3>
        <table>
            <thead>
                <tr>
                    ${headers.map(h => `<th>${h}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
                ${rows.map(row => `
                    <tr>
                        ${row.map((cell, idx) => `<td>${idx === 1 ? `<strong>${cell}</strong>` : cell}</td>`).join('')}
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>`;
    document.getElementById('output').innerHTML = html;
}

function formatTime(val) {
    if (!val) return "N/A";

    // Check if it's a string "OFF" or similar
    if (typeof val === 'string' && val.trim().toUpperCase() === "OFF") return "N/A";

    // parsing if it's a string that looks like a date/time from the previous failure
    if (typeof val === 'string' && val.includes("Standard Time")) {
        const parsed = new Date(val);
        if (!isNaN(parsed)) val = parsed;
    }

    // Robust Date check
    if (val instanceof Date || Object.prototype.toString.call(val) === '[object Date]') {
        let h = val.getHours();
        const m = String(val.getMinutes()).padStart(2, '0');
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${h}:${m} ${ampm}`;
    }

    // If it's a number (Excel fraction of day)
    if (typeof val === 'number') {
        const totalSeconds = Math.round(val * 86400);
        let h = Math.floor(totalSeconds / 3600);
        const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${h}:${m} ${ampm}`;
    }

    return val.toString().trim();
}
