# Live Link : 
https://alqamah.github.io/TSL---AttendanceValidator/src/index.html

# Attendance Reconciliation Tool - Usage Guide

This tool is designed to automate the validation of attendance records by comparing Daily CLM Reports (File A) against Vendor Monthly Reports (File B).

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Input File Requirements](#input-file-requirements)
3. [Step-by-Step Instructions](#step-by-step-instructions)
4. [Understanding the Results](#understanding-the-results)
5. [Troubleshooting](#troubleshooting)

---

## Prerequisites
- A web browser.
- The Excel files you wish to compare.

## Input File Requirements

### File A: CLM Daily Report
- **Format:** `.xls` or `.xlsx`
- **Upload Type:** Supports **multiple files** at once (e.g., daily reports for different dates).
- **Required Structure:**
  - **Date:** Must be present in the first 20 rows of the file header (e.g., `Date : 12-01-2025`).
  - **Data Table:** Must contain a header row with the following column names:
    - `Safety Pass No` (Unique Identifier)
    - `Employee Name`
    - `In Time`
    - `Out Time`

### File B: Vendor Monthly Report
- **Format:** `.xlsx` or `.xls`
- **Upload Type:** Single file containing multiple sheets.
- **Processing:** The tool scans **ALL sheets** in the workbook.
- **Required Structure:**
  - **Date:** Column B (Row 1 is header, data starts Row 3).
  - **Operator Data:**
    - Name: Column D (If "OFF", row is skipped).
    - Safety Pass No: Column E.
    - In Time: Column F.
    - Out Time: Column G.
  - **Flagman Data:**
    - Safety Pass No: Column K.
    - In Time: Column L.
    - Out Time: Column M.

---

## Step-by-Step Instructions

### 1. Upload CLM Daily Reports (File A)
1. Locate the section titled **"CLM Daily Report (File A)"**.
2. Click **"Choose File"**.
3. Select one or more daily report files.
4. The tool will parse the files and display the dates found and total records extracted.

### 2. Upload Vendor Monthly Report (File B)
1. Locate the section titled **"Vendor Monthly Report (File B)"**.
2. Click **"Choose File"**.
3. Select the monthly report file.
4. The tool will read all sheets and display the total number of records scanned.

### 3. Process & Compare
1. Once both files are uploaded and status shows "Ready", click the **"Process & Compare"** button.
2. The tool will match records based on **Safety Pass No** and **Date**.

---

## Understanding the Results

After processing, a report table will appear. You can search, filter, and export this data.

### Status Codes
- <span style="color:#AFE1AF; font-weight:bold;">MATCH</span>: The **In Time** and **Out Time** in File A match File B exactly.
- <span style="color:#FF7559; font-weight:bold;">MISMATCH</span>: The record exists in both files, but the times do not match.
- <span style="color:#FE91FF; font-weight:bold;">DUPLICATE</span>: The employee appears more than once in File B for the same date (e.g., worked on multiple cranes/shifts).

### Filtering & Search
- **Search Bar:** Type a Name or Safety Pass No to find specific records immediately.
- **Filter Buttons:**
  - **All:** Show all compared records.
  - **Match:** Show only valid matches.
  - **Mismatch:** Show only records with time discrepancies.
  - **Duplicate:** Show records that appear multiple times in File B.

### Export
- Click **"Download Excel"** to save the current comparison report to your computer.

---

## Troubleshooting

- **"Date not found in File A header"**: Ensure the text "Date :" followed by the date (DD-MM-YYYY) exists in the top 20 rows of your CLM report.
- **"Column 'Safety Pass No' not found"**: Check that your CLM report headers are on a single row and spelling matches exactly.
- **No records showing**: Ensure the dates in File A match the dates present in File B. Records are only compared if the Date matches.


# PRESENTATION
- **" https://docs.google.com/presentation/d/e/2PACX-1vS9TdTQEWcKIQNW1180kjNAOeN70KSglJItdfmrBt6zn4pOTT8ywl1Grb2u0LbRFczHwc76LxkqAvzZ/pub?start=false&loop=false&delayms=60000&slide=id.g3bbce37d7f5_4_4290 "**
