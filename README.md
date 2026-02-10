# EquityList SAFE Calculator Documentation

## Overview

The EquityList SAFE Calculator is a comprehensive tool designed to model equity dilution, SAFE note conversions, and priced round impacts on a company's capitalization table. It provides a real-time interactive UI for planning and generates high-quality PDF reports that can be emailed to users.

---

## Project Structure

```text
.
├── backend/                # Node.js Express server
│   ├── mailer.js           # Email service (Nodemailer)
│   ├── server.js           # PDF generation & API endpoints
│   ├── public/             # Static files for PDF templates
│   │   └── js/             # JS, CSS, and HTML for PDF reports
│   └── package.json        # Backend dependencies
├── index.html              # Main calculator frontend
├── script.js               # Core calculation engine & UI logic
├── style.css               # Frontend styling
└── .gitignore              # Git ignore rules
```

---

## Technical Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3 (Tailwind CSS for some components)
- **Backend**: Node.js, Express.js
- **PDF Generation**: Puppeteer (headless browser)
- **Emails**: Nodemailer (via Gmail SMTP)
- **State Management**: Local JavaScript State Object in `script.js`

---

## Core Components

### 1. Calculation Engine (`script.js`)

The "brain" of the application. It handles all complex financial math, including:

- **SAFE Conversion Models**: Handles Pre-money and Post-money SAFEs.
- **MFN Clauses**: Logic specifically designed to handle Most Favored Nation (MFN) caps.
- **Iterative Fitting**: Uses mathematical fitting to determine Price Per Share (PPS) when multiple conversion rules interact (e.g., option pool refreshes during a round).
- **Cap Table Generation**: Builds staged cap tables (Pre-round, Post-SAFE, Post-Priced Round).

### 2. Backend API (`backend/server.js`)

A supporting service that provides:

- **`POST /generate-pdf`**: Accepts calculation data and uses Puppeteer to render the PDF templates located in `backend/public/js/`.
- **`POST /send-email`**: Combines PDF generation with the `mailer.js` service to send reports directly to users.

### 3. Report Templates (`backend/public/js/`)

These files are used by Puppeteer to generate the final PDF report.

- `summary.html`: Overview of key metrics.
- `ownership.html`: Visualizations and detailed ownership tables.
- `terms2.html`: Detailed term descriptions and math.
- `report-config.js`: Hydrates these templates with data from the frontend.

---

## Logic: Inputs & Outputs

### 1. User Inputs & State Management

The application uses a **state-first** architecture.

- **Interaction**: Input fields have `onchange` or `oninput` listeners.
- **State Update**: Functions like `updateRow(id, field, value)` update the central `state` object after cleaning the data (e.g., stripping commas).
- **Reactive Trigger**: Every state update calls `updateUI()`, which resets the calculation pipeline and redraws the interface.

### 2. The Calculation Pipeline

When `updateUI()` is called:

1. **Pre-round Snapshot**: `buildEstimatedPreRoundCapTable()` creates a "before" view of ownership.
2. **Core Math Fitting**: `fitConversion()` handles the heavy lifting. It determines Price Per Share (PPS), SAFE shares (based on Cap/Discount), and Option Pool top-ups using an iterative fitting method.
3. **Post-round Structure**: `buildPricedRoundCapTable()` generates the final data structure for the post-investment world.

### 3. Output Rendering

The final data is pushed to the DOM:

- **Summary Metrics**: Real-time ownership % and dilution metrics.
- **Dynamic Tables**: `renderBreakdownTable()` performs a side-by-side "Pre" vs "Post" comparison with dynamic tags (e.g., "MFN SAFE", "Pool top-up").
- **Visualizations**: `renderPieChart()` and `renderBarChart()` provide visual confirmation of the equity distribution.
- **AI Insights**: `renderAIAdvisor()` generates context-aware logic to highlight specific risks or changes (e.g., dropping below 50% majority).

---

## PDF & Integration Logic

1. **Capture**: "Email Report" triggers `prepareReportData()`, gathering the current state.
2. **Backend**: Sent to the Node.js server where **Puppeteer** renders high-quality templates.
3. **Delivery**: The resulting PDF is returned for download or sent via Gmail SMTP.

---

## Setup & Configuration

### Prerequisites

- Node.js (v14+)
- Gmail account with "App Password" enabled (for production email)

### Installation

1. Navigate to the `backend/` directory:
   ```bash
   cd backend
   npm install
   ```

### Environment Variables

Create a `.env` file in the `backend/` directory:

```env
PORT=3000
GMAIL_USER=your-email@gmail.com
GMAIL_PASS=your-app-password
```

### Running Locally

1. Start the backend:
   ```bash
   node server.js
   ```
2. Open `index.html` in your browser.

---

## Maintenance Notes

- **Extending Math**: Most financial logic is in `script.js` under `PART 1: CORE ENGINE`.
- **UI Changes**: Layout and input responsiveness are managed in `style.css` and `script.js` under `PART 2: UI & RENDERING`.
- **PDF Styling**: PDF-specific styles are in `backend/public/js/shared-styles.css`.
