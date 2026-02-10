# Product Management Review: SAFE Calculator

## Executive Summary

The SAFE Calculator is a high-utility tool for founders and investors to model equity dilution. The core calculation engine is robust and handles complex scenarios like MFN caps and option pool top-ups. However, there are opportunities to improve the user experience (UX) and reduce technical friction for non-technical users.

---

## 1. User Experience (UX) Audit

### Key Strengths

- **Live Updates**: The "state-first" architecture provides immediate feedback as users change inputs.
- **Visual Clarity**: Highly effective use of "Pre vs Post" side-by-side comparisons and Chart.js visualizations.
- **AI Insights**: The natural language summary helps non-experts understand the implications of their data.

### Opportunities for Improvement

- **Input Friction**: The `formatInputLive` logic can occasionally conflict with rapid typing or backspacing. Forcing a field to `0` instead of allowing it to be empty can be frustrating.
- **Error Visibility**: Errors are displayed at the top of the page. If the user is editing a long cap table at the bottom, they may miss the error message.
- **Data Persistence**: There is no "Auto-save" or "Export Data" (to JSON/CSV). If the user refreshes, all data is lost.
- **Undo Capability**: Deleting a row is permanent and lacks a confirmation or "Undo" button.

---

## 2. Technical & Logic Audit

### Calculation Engine

- **Convergence**: The `fitConversion` loop is capped at 100 iterations. While sufficient for standard rounds, extreme edge cases (e.g., negative valuations or circular ESOP pools) could potentially fail to converge.
- **MFN Ordering**: MFN (Most Favored Nation) logic depends on the _order_ of the SAFEs in the list. Users might not realize that moving a SAFE up or down could change its calculated cap.
- **Rounding Strategy**: The app uses a global `DEFAULT_ROUNDING_STRATEGY`. Some jurisdictions or legal documents require specific flooring/ceiling rules for share counts that are not currently configurable.

### Backend & Integration

- **Server Dependency**: The "Download PDF" and "Email Report" features require a local Node.js server. For a user running this via a simple browser file (`index.html`), these features appear "broken."
- **Security**: The email service requires a Gmail App Password. While handled via `.env`, this is a significant hurdle for users wanting to self-host or use different providers.

---

## 3. Product Roadmap & Recommendations

### High Priority (Low Effort)

- [ ] **Validation Feedback**: Add red borders/inline errors to specific input fields when data is invalid.
- [ ] **Confirmation on Delete**: Add a simple `confirm()` dialog before deleting shareholders or SAFEs.
- [ ] **Empty State Handling**: Allow fields to be empty while typing, only reverting to `0` on `blur`.

### Medium Priority (Medium Effort)

- [ ] **Client-side PDF Generation**: Move PDF generation to the frontend (e.g., using `jspdf` and `html2canvas` directly) to remove the backend dependency for downloading.
- [ ] **Local Storage**: Auto-save the calculator state to the browser's `localStorage` so users don't lose work on refresh.

### Low Priority (High Effort)

- [ ] **Scenario Comparison**: Allow users to save multiple "Scenarios" and compare them side-by-side.
- [ ] **CSV Import**: Allow users to upload their existing cap table from a spreadsheet.
