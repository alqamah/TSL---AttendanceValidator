function updateFileName(inputId, statusId) {
    const input = document.getElementById(inputId);
    const status = document.getElementById(statusId);
    if (input.files && input.files[0]) {
        status.textContent = input.files[0].name;
    } else {
        status.textContent = "";
    }
}

async function processFiles() {
    const fileAInput = document.getElementById('fileA');
    const infoPanel = document.getElementById('infoPanel');
    const outputDiv = document.getElementById('output');

    if (!fileAInput.files[0]) {
        alert("Please upload File A.");
        return;
    }

    outputDiv.innerHTML = '<div class="spinner"></div>';
    infoPanel.style.display = 'none';

    try {
        const fileAData = await readFileA(fileAInput.files[0]);

        infoPanel.innerHTML = `
            <strong>File A Data Extracted:</strong><br>
            Reference Date: ${fileAData.dateStr}<br>
            Count: ${fileAData.records.length} records.
        `;
        infoPanel.style.display = 'block';

        displayFileAData(fileAData);

    } catch (err) {
        console.error(err);
        outputDiv.innerHTML = `<div style="text-align: center; color: var(--danger); padding: 20px;"><strong>Error:</strong> ${err.message}</div>`;
    }
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

                if (headerRowIndex === -1) return reject(new Error("Safety Pass No column not found."));

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

function displayFileAData(fileAData) {
    let html = `
    <div class="results-table-wrapper">
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Safety Pass Number</th>
                    <th>Name</th>
                    <th>Punch in time</th>
                    <th>Punch out time</th>
                </tr>
            </thead>
            <tbody>
                ${fileAData.records.map(rec => `
                    <tr>
                        <td>${rec.date}</td>
                        <td><strong>${rec.id}</strong></td>
                        <td>${rec.name}</td>
                        <td>${rec.in}</td>
                        <td>${rec.out}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>`;
    document.getElementById('output').innerHTML = html;
}

function formatTime(val) {
    if (!val) return "N/A";
    if (typeof val === 'number') {
        const totalSeconds = Math.round(val * 86400);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const h = hours % 12 || 12;
        const m = minutes < 10 ? '0' + minutes : minutes;
        return `${h}:${m} ${ampm}`;
    }
    return val.toString().trim();
}
