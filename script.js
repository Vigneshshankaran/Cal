/**
 * ============================================
 * SAFE & Priced Round Cap Table Calculator
 * ============================================
 * 
 * This calculator models equity ownership through SAFE conversions
 * and priced funding rounds. It handles:
 * - Common stock (founders, employees, option pools)
 * - SAFE notes (post-money and discount SAFEs)
 * - Priced equity rounds (Series A, B, etc.)
 * - Option pool management and dilution tracking
 * 
 * Key Formulas:
 * - Post-money Valuation = Pre-money + New Investment
 * - Price Per Share (PPS) = Pre-money / Pre-round Shares
 * - Ownership % = (Shareholder Shares / Total Shares) × 100
 * - SAFE Shares = Investment / min(Cap PPS, Discount PPS)
 */

// ============================================
// TYPE DEFINITIONS & CONSTANTS
// ============================================

/**
 * Enum for cap table row types
 * Used to categorize different equity instruments
 */
const CapTableRowType = {
    Common: "common",           // Common stock (founders, employees)
    Safe: "safe",               // SAFE notes
    Series: "series",           // Priced round investors
    Total: "total",             // Summary row
    RefreshedOptions: "refreshedOptions", // Option pool adjustments
};

/**
 * Enum for common stock subtypes
 */
const CommonRowType = {
    Shareholder: "shareholder", // Individual shareholders
    UnusedOptions: "unusedOptions", // Unallocated option pool
};

/**
 * Default rounding strategy for calculations
 * Ensures consistent precision across all computations
 */
const DEFAULT_ROUNDING_STRATEGY = {
    roundShares: true,    // Round share counts to whole numbers
    roundPPSPlaces: 8,    // Price per share precision (8 decimal places)
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Converts a string or number to a numeric value
 * Strips out currency symbols, commas, and other non-numeric characters
 * @param {string|number} value - The value to convert
 * @returns {number} Parsed numeric value
 */
const stringToNumber = (value) => {
    // If already a number, return as-is
    if (typeof value === "number") return value;

    // Remove all non-numeric characters except minus sign and decimal point
    const cleanedValue = String(value).replace(/[^-\d.]/g, "");

    // Parse as float or integer depending on presence of decimal point
    return cleanedValue.includes(".")
        ? parseFloat(cleanedValue)
        : parseInt(cleanedValue, 10) || 0;
};

/**
 * Formats a number as USD currency with commas
 * @param {number|string} value - The value to format
 * @returns {string} Formatted currency string (e.g., "$1,234,567")
 */
const formatUSDWithCommas = (value) => {
    const num = stringToNumber(value);
    return num.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0, // No cents
    });
};

/**
 * Formats a number with thousand separators
 * @param {number|string} value - The value to format
 * @returns {string} Formatted number string (e.g., "1,234,567")
 */
const formatNumberWithCommas = (value) => {
    return stringToNumber(value).toLocaleString("en-US", { style: "decimal" });
};

/**
 * Safely formats a decimal value as a percentage
 * Handles edge cases like null, undefined, NaN, and infinity
 * @param {number} value - Decimal value (e.g., 0.25 for 25%)
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted percentage or em dash if invalid
 */
const safeFormatPercent = (value, decimals = 2) => {
    // Return em dash for invalid values
    if (value === null || value === undefined || isNaN(value) || !isFinite(value))
        return "—";

    // Convert decimal to percentage (0.25 → 25.00%)
    return `${(value * 100).toFixed(decimals)}%`;
};



/**
 * Safely formats a number with commas
 * @param {number} value - The value to format
 * @returns {string} Formatted number or em dash if invalid
 */
const safeFormatNumber = (value) => {
    if (value === null || value === undefined || isNaN(value) || !isFinite(value))
        return "—";
    return formatNumberWithCommas(value);
};

/**
 * Safely formats a value as USD currency
 * @param {number} value - The value to format
 * @returns {string} Formatted currency or em dash if invalid
 */
const safeFormatCurrency = (value) => {
    if (value === null || value === undefined || isNaN(value) || !isFinite(value))
        return "—";
    return formatUSDWithCommas(value);
};

/**
 * Formats price per share with higher precision (3 decimal places)
 * Used for share prices which can be fractional cents
 * @param {number|string} value - The PPS value to format
 * @returns {string} Formatted PPS (e.g., "$1.234")
 */
const formatPPSWithCommas = (value) => {
    const num = stringToNumber(value);
    return num.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 3,  // Allow up to 3 decimal places
        minimumFractionDigits: 2,  // Always show at least 2 decimals
    });
};

/**
 * Safely formats a value as USD (alias for safeFormatCurrency)
 * @param {number} value - The value to format
 * @returns {string} Formatted currency or em dash if invalid
 */
const safeFormatUSD = (value) => {
    if (value === null || value === undefined || isNaN(value) || !isFinite(value))
        return "—";
    return formatUSDWithCommas(value);
};

/**
 * Safely formats price per share
 * @param {number} value - The PPS value to format
 * @returns {string} Formatted PPS or em dash if invalid
 */
const safeFormatPPS = (value) => {
    if (value === null || value === undefined || isNaN(value) || !isFinite(value))
        return "—";
    return formatPPSWithCommas(value);
};



/**
 * Formats numeric input fields in real-time as user types
 * Adds thousand separators and maintains cursor position
 * @param {HTMLInputElement} input - The input element to format
 * @param {boolean} isCurrency - Whether to format as currency (default: false)
 */
const formatInputLive = (input, isCurrency = false) => {
    // Extract numeric value from input
    const rawValue = input.value.replace(/[^\d.-]/g, "");
    const numValue = parseFloat(rawValue) || 0;

    // Save cursor position before formatting
    const cursorPos = input.selectionStart;
    const oldLength = input.value.length;

    // Apply appropriate formatting
    if (isCurrency) {
        input.value = formatUSDWithCommas(numValue);
    } else {
        input.value = formatNumberWithCommas(numValue);
    }

    // Restore cursor position, accounting for added/removed characters
    const newLength = input.value.length;
    const diff = newLength - oldLength;
    const newPos = Math.max(0, cursorPos + diff);
    input.setSelectionRange(newPos, newPos);
};

// Expose formatInputLive globally for use in HTML event handlers
window.formatInputLive = formatInputLive;

/**
 * Rounds share counts according to the specified strategy
 * @param {number} num - The number of shares to round
 * @param {object} strategy - Rounding strategy (default: DEFAULT_ROUNDING_STRATEGY)
 * @returns {number} Rounded share count
 */
const roundShares = (num, strategy = DEFAULT_ROUNDING_STRATEGY) => {
    if (strategy.roundDownShares) return Math.floor(num);  // Always round down
    if (strategy.roundShares) return Math.round(num);      // Round to nearest
    return num;  // No rounding
};



const roundPPSToPlaces = (num, places) => {

    if (places < 0) return num;

    const factor = Math.pow(10, places);

    return Math.ceil(num * factor) / factor;

};



// --- SAFE Calculation Logic ---



const isMFN = (safe) => {

    return (

        safe.conversionType === "mfn" ||

        safe.conversionType === "ycmfn" ||

        (safe.sideLetters && safe.sideLetters.includes("mfn"))

    );

};



const getMFNCapAfter = (rows, idx) => {

    return (

        rows.slice(idx + 1).reduce((val, row) => {

            if (isMFN(row) || row.conversionType === "pre") return val;

            if (val === 0) return row.cap;

            if (val > 0 && row.cap > 0 && row.cap < val) return row.cap;

            return val;

        }, 0) || 0

    );

};



const getCapForSafe = (idx, safes) => {

    const safe = safes[idx];

    if (!isMFN(safe)) return safe.cap;



    const inheritedCap = getMFNCapAfter(safes, idx);

    const ownCap = safe.cap || 0;



    if (ownCap > 0 && inheritedCap > 0) return Math.min(ownCap, inheritedCap);

    if (ownCap > 0) return ownCap;

    if (inheritedCap > 0) return inheritedCap;

    return 0;

};



const populateSafeCaps = (safeNotes) => {

    return safeNotes.map((safe, idx) => {

        if (isMFN(safe)) {

            return { ...safe, cap: getCapForSafe(idx, safeNotes) };

        }

        return { ...safe };

    });

};



const safeConvert = (safe, preShares, postShares, pps) => {

    if (safe.cap === 0) return (1 - (safe.discount || 0)) * pps;

    const discountPPS = (1 - (safe.discount || 0)) * pps;

    const shares = safe.conversionType === "pre" ? preShares : postShares;

    const capPPS = safe.cap / shares;

    return Math.min(discountPPS, capPPS);

};



const sumSafeConvertedShares = (

    safes,

    pps,

    preMoneyShares,

    postMoneyShares,

    roundingStrategy

) => {

    return safes.reduce((acc, safe) => {

        const discountPPS = roundPPSToPlaces(

            safeConvert(safe, preMoneyShares, postMoneyShares, pps),

            roundingStrategy.roundPPSPlaces

        );

        const postSafeShares = safe.investment / discountPPS;

        return acc + roundShares(postSafeShares, roundingStrategy);

    }, 0);

};



// --- Error Checking ---



const checkSafeNotesForErrors = (safeNotes) => {

    let ownershipError = undefined;

    safeNotes.forEach((safe) => {

        if (safe.investment >= safe.cap && safe.cap !== 0) {

            ownershipError = {

                type: "error",

                reason:

                    "Investment cannot utilize the entire Cap (Investment >= Cap). This is mathematically impossible for a Pre-money SAFE model.",

            };

        }

    });

    return ownershipError;

};



// --- Conversion Solver ---



const calculatePreAndPostMoneyShares = (

    preMoneyValuation,

    commonShares,

    unusedOptions,

    targetOptionsPct,

    seriesInvestments,

    totalShares,

    roundingStrategy = DEFAULT_ROUNDING_STRATEGY

) => {

    let optionsPool = roundShares(

        totalShares * (targetOptionsPct / 100),

        roundingStrategy

    );

    if (optionsPool < unusedOptions) optionsPool = unusedOptions;

    const increaseInOptionsPool = optionsPool - unusedOptions;

    const seriesInvestmentTotal = seriesInvestments.reduce((a, b) => a + b, 0);

    const pps =

        totalShares > 0

            ? roundPPSToPlaces(

                (preMoneyValuation + seriesInvestmentTotal) / totalShares,

                roundingStrategy.roundPPSPlaces

            )

            : 0;

    const seriesShares =

        pps > 0

            ? seriesInvestments.reduce(

                (acc, inv) => acc + roundShares(inv / pps, roundingStrategy),

                0

            )

            : 0;

    const preMoneyShares = commonShares + unusedOptions + increaseInOptionsPool;

    const postMoneyShares = totalShares - seriesShares - increaseInOptionsPool;



    return {

        preMoneyShares,

        postMoneyShares,

        pps,

        optionsPool,

        increaseInOptionsPool,

        totalShares: postMoneyShares + increaseInOptionsPool + seriesShares,

        seriesShares,

        totalSeriesInvestment: seriesInvestmentTotal,

    };

};



const attemptFit = (

    preMoneyValuation,

    commonShares,

    unusedOptions,

    targetOptionsPct,

    safes,

    seriesInvestments,

    totalShares,

    roundingStrategy = DEFAULT_ROUNDING_STRATEGY

) => {

    const results = calculatePreAndPostMoneyShares(

        preMoneyValuation,

        commonShares,

        unusedOptions,

        targetOptionsPct,

        seriesInvestments,

        totalShares,

        roundingStrategy

    );

    const safeShares = sumSafeConvertedShares(

        safes,

        results.pps,

        results.preMoneyShares,

        results.postMoneyShares,

        roundingStrategy

    );

    return results.seriesShares + commonShares + results.optionsPool + safeShares;

};



const fitConversion = (

    preMoneyValuation,

    commonShares,

    safes,

    unusedOptions,

    targetOptionsPct,

    seriesInvestments,

    roundingStrategy = DEFAULT_ROUNDING_STRATEGY

) => {

    let totalShares = commonShares + unusedOptions;

    let lastTotalShares = totalShares;

    for (let i = 0; i < 100; i++) {

        totalShares = attemptFit(

            preMoneyValuation,

            commonShares,

            unusedOptions,

            targetOptionsPct,

            safes,

            seriesInvestments,

            totalShares,

            roundingStrategy

        );

        if (totalShares === lastTotalShares) break;

        lastTotalShares = totalShares;

    }

    const res = calculatePreAndPostMoneyShares(

        preMoneyValuation,

        commonShares,

        unusedOptions,

        targetOptionsPct,

        seriesInvestments,

        totalShares,

        roundingStrategy

    );

    const ppss = safes.map((safe) =>

        roundPPSToPlaces(

            safeConvert(safe, res.preMoneyShares, res.postMoneyShares, res.pps),

            roundingStrategy.roundPPSPlaces

        )

    );

    const convertedSafeShares = sumSafeConvertedShares(

        safes,

        res.pps,

        res.preMoneyShares,

        res.postMoneyShares,

        roundingStrategy

    );

    const totalSeriesInvestment = seriesInvestments.reduce((a, b) => a + b, 0);



    return {

        ...res,

        ppss,

        totalShares,

        newSharesIssued: totalShares - commonShares - unusedOptions,

        convertedSafeShares,

        totalOptions: res.increaseInOptionsPool + unusedOptions,

        additionalOptions: res.increaseInOptionsPool,

        totalInvested:

            totalSeriesInvestment +

            safes.reduce((acc, safe) => acc + safe.investment, 0),

        totalSeriesInvestment,

    };

};



// --- Cap Table Builders ---



const buildTBDPreRoundCapTable = (safeNotes, common) => {

    const totalInvestment = safeNotes.reduce(

        (acc, investor) => acc + investor.investment,

        0

    );

    const totalShares = common.reduce((acc, c) => acc + c.shares, 0);

    const reason = "Unable to model Pre-Round cap table with uncapped SAFE's";



    return {

        common: common.map((c) => ({

            ...c,

            ownershipPct: 0,

            ownershipError: { type: "tbd", reason },

        })),

        safes: safeNotes.map((s) => ({

            ...s,

            ownershipError: { type: "tbd", reason },

            type: CapTableRowType.Safe,

        })),

        total: {

            name: "Total",

            shares: totalShares,

            investment: totalInvestment,

            ownershipPct: 1,

            type: CapTableRowType.Total,

        },

    };

};



const buildErrorPreRoundCapTable = (safeNotes, common) => {

    const totalInvestment = safeNotes.reduce(

        (acc, investor) => acc + investor.investment,

        0

    );

    const totalShares = common.reduce((acc, c) => acc + c.shares, 0);



    return {

        common: common.map((c) => ({

            ...c,

            ownershipPct: 0,

            ownershipError: { type: "error" },

        })),

        safes: safeNotes.map((s) => {

            const error = { type: "error" };

            if (s.investment >= s.cap && s.cap !== 0)

                error.reason = "SAFE's investment cannot equal or exceed the Cap";

            return { ...s, ownershipError: error, type: CapTableRowType.Safe };

        }),

        total: {

            name: "Total",

            shares: totalShares,

            investment: totalInvestment,

            ownershipPct: 1,

            type: CapTableRowType.Total,

        },

    };

};



const buildEstimatedPreRoundCapTable = (

    rowData,

    roundingStrategy = DEFAULT_ROUNDING_STRATEGY

) => {

    const common = rowData.filter((r) => r.type === CapTableRowType.Common);

    const preMoneyShares = common.reduce((acc, r) => acc + r.shares, 0);

    const safeNotes = populateSafeCaps(

        rowData.filter((r) => r.type === CapTableRowType.Safe)

    );



    if (safeNotes.some((s) => s.cap !== 0 && s.cap <= s.investment)) {

        return buildErrorPreRoundCapTable(safeNotes, common);

    }



    const maxCap = safeNotes.reduce((max, s) => Math.max(max, s.cap), 0);

    if (maxCap === 0) return buildTBDPreRoundCapTable(safeNotes, common);



    let safeRows = safeNotes.map((safe) => {

        const cap = safe.cap === 0 ? maxCap : safe.cap;

        if (safe.conversionType === "pre") {

            const shares = roundShares(

                (safe.investment / cap) * preMoneyShares,

                roundingStrategy

            );

            return { ...safe, shares, type: CapTableRowType.Safe };

        } else {

            return {

                ...safe,

                ownershipPct: safe.investment / cap,

                type: CapTableRowType.Safe,

            };

        }

    });



    const preMoneySafeShares = safeRows.reduce(

        (acc, s) => acc + (s.shares || 0),

        0

    );

    const postSharePct = safeRows.reduce(

        (acc, s) => acc + (s.ownershipPct || 0),

        0

    );

    const postCap = roundShares(

        (preMoneyShares + preMoneySafeShares) / (1 - postSharePct),

        roundingStrategy

    );



    safeRows = safeRows.map((s) => {

        if (s.shares) return { ...s, ownershipPct: s.shares / postCap };

        return {

            ...s,

            shares: roundShares((s.ownershipPct || 0) * postCap, roundingStrategy),

        };

    });



    const finalTotalShares =

        preMoneyShares + safeRows.reduce((acc, s) => acc + (s.shares || 0), 0);



    return {

        common: common.map((c) => ({ ...c, ownershipPct: c.shares / postCap })),

        safes: safeRows,

        total: {

            shares: finalTotalShares,

            investment: safeNotes.reduce((a, s) => a + s.investment, 0),

            ownershipPct: 1,

            type: CapTableRowType.Total,

        },

    };

};



const buildPricedRoundCapTable = (pricedConversion, rowData) => {

    const common = rowData.filter(

        (r) => r.type === CapTableRowType.Common && r.id !== "UnusedOptionsPool"

    );

    const safes = rowData.filter((r) => r.type === CapTableRowType.Safe);

    const series = rowData.filter((r) => r.type === CapTableRowType.Series);

    const totalShares = pricedConversion.totalShares;

    const totalInvestment =

        series.reduce((a, s) => a + s.investment, 0) +

        safes.reduce((a, s) => a + s.investment, 0);



    return {

        common: common.map((c) => ({ ...c, ownershipPct: c.shares / totalShares })),

        safes: safes.map((s, idx) => {

            const pps = pricedConversion.ppss[idx];

            const shares = roundShares(s.investment / pps);

            return {

                ...s,

                pps,

                shares,

                ownershipPct: shares / totalShares,

                type: CapTableRowType.Safe,

            };

        }),

        series: series.map((se) => {

            const shares = roundShares(se.investment / pricedConversion.pps);

            return {

                ...se,

                pps: pricedConversion.pps,

                shares,

                ownershipPct: shares / totalShares,

                type: CapTableRowType.Series,

            };

        }),

        refreshedOptionsPool: {

            name: "Refreshed Options Pool",

            shares: pricedConversion.totalOptions,

            ownershipPct: pricedConversion.totalOptions / totalShares,

            type: CapTableRowType.RefreshedOptions,

        },

        total: {

            name: "Total",

            shares: totalShares,

            investment: totalInvestment,

            ownershipPct: 1,

            type: CapTableRowType.Total,

        },

    };

};



// --- Application State ---



const state = {
    name: "Standalone Worksheet",
    roundName: "Series A",
    rowData: [
        {
            id: "1",
            type: "common",
            name: "Founder 1",
            shares: 4000000,
            category: "Founder",
        },
        {
            id: "2",
            type: "common",
            name: "Founder 2",
            shares: 4000000,
            category: "Founder",
        },
        {
            id: "IssuedOptions",
            type: "common",
            name: "Employee (granted)",
            shares: 1000000,
            category: "ESOP Pool (granted)",
        },
        {
            id: "UnusedOptionsPool",
            type: "common",
            name: "ESOP Pool (unallocated)",
            shares: 1000000,
            category: "ESOP Pool (unallocated)",
        },
        {
            id: "3",
            type: "safe",
            name: "SAFE 1",
            investment: 500000,
            cap: 1000000,
            discount: 0.2, // 20%
            conversionType: "post",
        },
        { id: "4", type: "series", name: "Investor 1", investment: 2000000 },
    ],
    preMoney: 10000000,
    targetOptionsPool: 10,
    pricedRounds: 1, // Always show priced round by default
    darkMode: false,
};



const TRASH_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>`;



// --- Core UI Logic ---



const updateUI = () => {

    try {

        console.log("updateUI called", state);

        const preRound = buildEstimatedPreRoundCapTable(state.rowData);



        // Refresh inputs values if they might have changed from state

        const preMoneyInput = document.getElementById("pre-money-input");

        if (preMoneyInput && document.activeElement !== preMoneyInput) {

            preMoneyInput.value = formatUSDWithCommas(state.preMoney);

        }

        const targetOptionsInput = document.getElementById("target-options-input");

        if (targetOptionsInput && document.activeElement !== targetOptionsInput) {

            targetOptionsInput.value = state.targetOptionsPool;

        }



        // Initial renders from rowData

        renderSAFEs();

        renderSeriesInvestors();



        // Update first card footer & current unallocated ESOP val

        const esopRow = state.rowData.find((r) => r.id === "UnusedOptionsPool");

        const unusedOptionsValue = esopRow ? esopRow.shares : 0;



        const S0 = state.rowData

            .filter((r) => r.type === CapTableRowType.Common)

            .reduce((a, r) => a + r.shares, 0);

        const totalSharesVal = document.getElementById("total-shares-val");

        if (totalSharesVal) totalSharesVal.textContent = formatNumberWithCommas(S0);



        const currentEsopVal = document.getElementById("current-esop-val");

        if (currentEsopVal)

            currentEsopVal.textContent = formatNumberWithCommas(unusedOptionsValue);



        renderShareholders(S0);



        // ERROR CHECK: Validate SAFEs before attempting detailed conversion

        // MFN FIX: We must populate/resolve caps for MFN SAFEs first!

        const rawSafes = state.rowData.filter(

            (r) => r.type === CapTableRowType.Safe

        );

        const safes = populateSafeCaps(rawSafes);



        const error = checkSafeNotesForErrors(safes);



        // Get Results Container for error display

        const resultsHeader = document.querySelector("#results-card .card-header");

        // Remove any existing error alert

        const existingError = document.getElementById("results-error-alert");

        if (existingError) existingError.remove();



        if (error) {

            // Display Error

            if (resultsHeader) {

                const errorDiv = document.createElement("div");

                errorDiv.id = "results-error-alert";

                errorDiv.style.backgroundColor = "rgba(220, 38, 38, 0.1)"; // var(--danger) with opacity

                errorDiv.style.color = "var(--danger)";

                errorDiv.style.border = "1px solid var(--danger)";

                errorDiv.style.padding = "0.75rem";

                errorDiv.style.borderRadius = "var(--radius-md)";

                errorDiv.style.marginTop = "1rem";

                errorDiv.style.fontSize = "0.875rem";

                errorDiv.innerHTML = `<strong>Error:</strong> ${error.reason}`;

                resultsHeader.parentNode.insertBefore(

                    errorDiv,

                    resultsHeader.nextSibling

                );

            }



            // Clear Charts & Tables to avoid misleading data

            document.getElementById("post-round-table").innerHTML = "";

            document.getElementById("pie-chart-container").innerHTML = "";

            document.getElementById("bar-chart-container").innerHTML = "";

            document.getElementById("ai-insights-container").innerHTML = "";



            // Reset Summary Metrics

            document.getElementById("round-pps-val").textContent = "—";

            document.getElementById("post-money-val").textContent = "—";

            document.getElementById("total-post-shares-val").textContent = "—";

            document.getElementById("founder-ownership-val").textContent = "—";



            return; // STOP execution

        }



        // Calculate priced round (Only if no errors)

        const commonShares = state.rowData

            .filter(

                (r) => r.type === CapTableRowType.Common && r.id !== "UnusedOptionsPool"

            )

            .reduce((a, r) => a + r.shares, 0);

        const seriesInvs = state.rowData

            .filter((r) => r.type === CapTableRowType.Series)

            .map((s) => s.investment);

        const pricedConversion = fitConversion(

            state.preMoney,

            commonShares,

            safes,

            unusedOptionsValue,

            state.targetOptionsPool,

            seriesInvs

        );



        console.log("Priced Conversion Result:", pricedConversion);



        // Populate Priced Round read-only fields

        // Note: total-series-investment is calculated but not present in index.html,

        // strictly following UI-only rendering fix by not adding new elements.



        const roundPpsEl = document.getElementById("round-pps-val");

        if (roundPpsEl)

            roundPpsEl.textContent = safeFormatPPS(pricedConversion.pps);



        // Post-money Valuation = Total Post-Round Shares * PPS

        const postMoneyVal = pricedConversion.totalShares * pricedConversion.pps;

        const postMoneyEl = document.getElementById("post-money-val");

        if (postMoneyEl) postMoneyEl.textContent = safeFormatCurrency(postMoneyVal);



        const additionalOptionsEl = document.getElementById(

            "additional-options-val"

        );

        if (additionalOptionsEl)

            additionalOptionsEl.textContent = safeFormatNumber(

                pricedConversion.additionalOptions

            );



        // New Investors Shares (Series Investors)

        const newInvestorsSharesEl = document.getElementById(

            "new-investors-shares-val"

        );

        if (newInvestorsSharesEl)

            newInvestorsSharesEl.textContent = safeFormatNumber(

                pricedConversion.seriesShares

            );



        // Build Post Round data

        const postRound = buildPricedRoundCapTable(pricedConversion, state.rowData);



        // Populate Metrics

        const totalPostSharesEl = document.getElementById("total-post-shares-val");

        if (totalPostSharesEl)

            totalPostSharesEl.textContent = safeFormatNumber(postRound.total.shares);



        // Dynamic Founder metrics

        const foundersPost = postRound.common.filter(

            (c) => c.category === "Founder"

        );

        const totalFounderPctPost = foundersPost.reduce(

            (a, f) => a + f.ownershipPct,

            0

        );



        // Calculate Pre-round (Post-SAFE) Founder %

        // If priced round is valid, use it to resolve uncapped SAFEs. Otherwise fallback to estimated pre-round.

        let totalFounderPctPre = 0;

        if (pricedConversion && pricedConversion.totalShares > 0) {

            // Re-calculate pre-money shares from priced conversion result

            // PreMoneyShares = TotalShares - SeriesShares - OptionPoolIncrease

            // Note: pricedConversion.newSharesIssued includes OptionPoolIncrease

            const preMoneyShares =

                pricedConversion.totalShares -

                pricedConversion.seriesShares -

                pricedConversion.increaseInOptionsPool;

            const founderShares = foundersPost.reduce((a, f) => a + f.shares, 0); // Founder shares don't change

            totalFounderPctPre =

                preMoneyShares > 0 ? founderShares / preMoneyShares : 0;

        } else {

            const foundersPre = preRound.common.filter(

                (c) => c.category === "Founder"

            );

            totalFounderPctPre = foundersPre.reduce((a, f) => a + f.ownershipPct, 0);

        }



        const founderOwnershipEl = document.getElementById("founder-ownership-val");

        if (founderOwnershipEl) {

            founderOwnershipEl.textContent = safeFormatPercent(totalFounderPctPost);

        }



        const dilution =

            totalFounderPctPre > 0 ? totalFounderPctPre - totalFounderPctPost : NaN;

        const founderDilutionEl = document.getElementById("founder-dilution-val");

        if (founderDilutionEl) {

            founderDilutionEl.textContent = safeFormatPercent(dilution);

        }



        const dilutionNoteEl = document.getElementById("dilution-summary-note");

        if (dilutionNoteEl) {

            const dilutionVal = isNaN(dilution) ? "—" : (dilution * 100).toFixed(2);

            dilutionNoteEl.textContent = `Founders diluted by ${dilutionVal} percentage points.`;

        }



        // Render Breakdown Table

        renderBreakdownTable(preRound, postRound, pricedConversion.pps);



        // Render Charts

        renderPieChart(postRound);

        renderBarChart(totalFounderPctPre, totalFounderPctPost);



        // Render AI Advisor

        renderAIAdvisor(preRound, postRound, pricedConversion, state);

    } catch (error) {

        console.error("Error updating UI:", error);

    }

};



const renderShareholders = (totalSharesS0) => {

    const container = document.getElementById("shareholders-body");

    container.innerHTML = "";



    const categories = [

        "Founder",

        "ESOP Pool (granted)",

        "ESOP Pool (unallocated)",

        "Investor",

        "Other",

    ];



    // Render from rowData

    state.rowData

        .filter((r) => r.type === CapTableRowType.Common)

        .forEach((row) => {

            const ownershipPct = totalSharesS0 > 0 ? row.shares / totalSharesS0 : NaN;

            const pctText = safeFormatPercent(ownershipPct);



            const tr = document.createElement("tr");

            tr.innerHTML = `

      <td><input class="input" value="${row.name}" onchange="updateRow('${row.id

                }', 'name', this.value)"></td>

      <td>

        <select class="input" onchange="updateRow('${row.id

                }', 'category', this.value)">

          ${categories

                    .map(

                        (cat) =>

                            `<option value="${cat}" ${row.category === cat ? "selected" : ""

                            }>${cat}</option>`

                    )

                    .join("")}

        </select>

      </td>

      <td><input class="input" type="text" value="${formatNumberWithCommas(

                        row.shares

                    )}" oninput="formatInputLive(this, false)" onchange="updateRow('${row.id

                }', 'shares', this.value)"></td>

      <td class="text-right">${pctText}</td>

      <td class="text-right">

        <button class="btn-trash" onclick="deleteRow('${row.id

                }')">${TRASH_ICON}</button>

      </td>

    `;

            container.appendChild(tr);

        });

};



const renderSAFEs = () => {

    const container = document.getElementById("safes-body");

    container.innerHTML = "";



    // MFN FIX: Resolve caps for display

    const rawSafes = state.rowData.filter((r) => r.type === "safe");

    const resolvedSafes = populateSafeCaps(rawSafes);



    rawSafes.forEach((row, idx) => {

        const tr = document.createElement("tr");



        // MFN Tag Logic

        let mfnTag = "";

        if (isMFN(row)) {

            // Find resolved cap from the pre-calculated list

            const resolvedSafe = resolvedSafes.find((s) => s.id === row.id);

            const appliedVal = safeFormatUSD(

                resolvedSafe ? resolvedSafe.cap : row.cap

            );

            mfnTag = `<div class="mfn-valuation-tag">MFN · Applied valuation: ${appliedVal}</div>`;

        }



        tr.innerHTML = `

      <td>

        <input class="input" value="${row.name}" onchange="updateRow('${row.id

            }', 'name', this.value)">

        ${mfnTag}

      </td>

      <td><input class="input" type="text" value="${formatUSDWithCommas(

                row.investment

            )}" oninput="formatInputLive(this, true)" onchange="updateRow('${row.id

            }', 'investment', this.value)"></td>

      <td><input class="input" type="text" value="${formatUSDWithCommas(

                row.cap

            )}" oninput="formatInputLive(this, true)" onchange="updateRow('${row.id

            }', 'cap', this.value)"></td>

      <td>

        <div class="percentage-input-wrapper">

          <input class="input compact-input" type="text" value="${(

                row.discount * 100

            ).toFixed(

                0

            )}" oninput="formatInputLive(this, false)" onchange="updateRow('${row.id

            }', 'discount', this.value)">

          <span class="percentage-suffix">%</span>

        </div>

      </td>

      <td>

        <select class="input" onchange="updateRow('${row.id

            }', 'conversionType', this.value)">

          <option value="post" ${row.conversionType === "post" ? "selected" : ""

            }>Post-money</option>

          <option value="pre" ${row.conversionType === "pre" ? "selected" : ""

            }>Pre-money</option>

          <option value="mfn" ${row.conversionType === "mfn" ? "selected" : ""

            }>MFN</option>

        </select>

      </td>

      <td class="text-right">

        <button class="btn-trash" onclick="deleteRow('${row.id

            }')">${TRASH_ICON}</button>

      </td>

    `;

        container.appendChild(tr);

    });

};



const renderSeriesInvestors = () => {

    const container = document.getElementById("series-body");

    container.innerHTML = "";

    state.rowData

        .filter((r) => r.type === "series")

        .forEach((row) => {

            const tr = document.createElement("tr");

            tr.innerHTML = `

      <td><input class="input" value="${row.name}" onchange="updateRow('${row.id

                }', 'name', this.value)"></td>

      <td><input class="input" type="text" value="${formatUSDWithCommas(

                    row.investment

                )}" oninput="formatInputLive(this, true)" onchange="updateRow('${row.id

                }', 'investment', this.value)"></td>

      <td class="text-right">

        <button class="btn-trash" onclick="deleteRow('${row.id

                }')">${TRASH_ICON}</button>

      </td>

    `;

            container.appendChild(tr);

        });

};



// Helper to get raw rows from structured data for consistent table and chart rendering

const getRowData = (data) => {

    const rows = [];

    if (!data) return rows;



    // Common shareholders

    if (data.common) {

        data.common.forEach((r) => {

            rows.push({

                id: r.id,

                name: r.name,

                category: r.category || "Other",

                shares: r.shares || 0,

                ownershipPct: r.ownershipPct || 0,

                isPricedOrSafe: false,

            });

        });

    }



    // SAFEs - shown individually

    if (data.safes) {

        data.safes.forEach((s) => {

            rows.push({

                id: s.id,

                name: s.name,

                category: "SAFE Converter",

                shares: s.shares || 0,

                ownershipPct: s.ownershipPct || 0,

                isPricedOrSafe: true,

                pps_val: s.pps,

                conversionType: s.conversionType,

                isMFN: isMFN(s),

            });

        });

    }



    // Series Investors - shown individually

    if (data.series) {

        data.series.forEach((se) => {

            rows.push({

                id: se.id,

                name: se.name || "New Investor",

                category: "New Investor",

                shares: se.shares || 0,

                ownershipPct: se.ownershipPct || 0,

                isPricedOrSafe: true,

                pps_val: se.pps,

            });

        });

    }



    // Refreshed Options Pool (Post-round only)

    if (data.refreshedOptionsPool && data.refreshedOptionsPool.shares > 0) {

        rows.push({

            id: "UnusedOptionsPool",

            name: "ESOP Pool (unallocated)",

            category: "ESOP Pool (unallocated)",

            shares: data.refreshedOptionsPool.shares || 0,

            ownershipPct: data.refreshedOptionsPool.ownershipPct || 0,

            isPricedOrSafe: false,

        });

    }



    return rows;

};



const renderBreakdownTable = (preData, postData, pps) => {

    const container = document.getElementById("post-round-table");

    if (!container) return;

    container.innerHTML = "";



    const preRows = getRowData(preData);

    const postRows = getRowData(postData);



    // Guardrail: Check validity at the top so loops can use it

    const preSharesValid =

        preData &&

        preData.total &&

        !isNaN(preData.total.shares) &&

        preData.total.shares > 0;

    const postSharesValid =

        postData &&

        postData.total &&

        !isNaN(postData.total.shares) &&

        postData.total.shares > 0;



    // Get all unique IDs

    const allIds = Array.from(

        new Set([...preRows.map((r) => r.id), ...postRows.map((r) => r.id)])

    );



    allIds.forEach((id) => {

        const pre = preRows.find((r) => r.id === id) || {

            id: id,

            name: "",

            category: "—",

            shares: 0,

            ownershipPct: 0,

            isVirtual: true,

        };

        const post = postRows.find((r) => r.id === id) || {

            id: id,

            name: "",

            category: "—",

            shares: 0,

            ownershipPct: 0,

        };



        // If row didn't exist in pre-round (isVirtual) or has 0 shares, show "—" instead of "0.00%"

        const prePctLabel =

            preSharesValid && !pre.isVirtual && pre.shares > 0

                ? safeFormatPercent(pre.ownershipPct)

                : "—";

        const postPctLabel =

            postSharesValid && post.shares > 0

                ? safeFormatPercent(post.ownershipPct)

                : "—";



        // Determine Name to show

        let displayName = post.name || pre.name || "—";

        // removed auto-renaming logic to respect input name



        // Tags Generation

        let tagsHtml = "";



        // SAFE Tags

        if (post.isPricedOrSafe && post.category === "SAFE Converter") {

            if (post.isMFN) {

                tagsHtml += `<span class="tag tag-mfn">MFN</span>`;

                tagsHtml += `<span class="tag tag-post">Post-money SAFE</span>`; // MFN usually converts as Post

            } else if (post.conversionType === "pre") {

                tagsHtml += `<span class="tag tag-pre">Pre-money SAFE</span>`;

            } else {

                tagsHtml += `<span class="tag tag-post">Post-money SAFE</span>`;

            }

        }



        // Pool Top-Up Tag

        // Check if it's the pool row OR if the category matches

        if (post.id === "UnusedOptionsPool" && postSharesValid && pre.shares >= 0) {

            if (post.shares > pre.shares + 1) {

                // Tolerance for rounding

                tagsHtml += `<span class="tag tag-topup">Pool Top-Up</span>`;

            }

        }



        const tr = document.createElement("tr");

        tr.innerHTML = `

        <td>

            ${displayName}

            ${tagsHtml}

        </td>

        <td class="text-right pre-value">${safeFormatNumber(pre.shares)}</td>

        <td class="text-right post-value">${safeFormatNumber(post.shares)}</td>

        <td class="text-right pre-value">${prePctLabel}</td>

        <td class="text-right post-value">${postPctLabel}</td>

        <td class="text-right hide-on-mobile">${safeFormatPPS(

            post.pps_val

        )}</td>

    `;

        container.appendChild(tr);

    });



    // Total row

    const totalTr = document.createElement("tr");

    totalTr.style.fontWeight = "700";



    // Guardrail: only show 100.00% if shares are validly computable

    // (preSharesValid and postSharesValid are defined at top of function)

    const prePctLabel = preSharesValid ? "100.00%" : "—";

    const postPctLabel = postSharesValid ? "100.00%" : "—";



    totalTr.innerHTML = `

        <td>Total</td>

        <td class="text-right pre-value">${safeFormatNumber(

        preData.total.shares

    )}</td>

        <td class="text-right post-value">${safeFormatNumber(

        postData.total.shares

    )}</td>

        <td class="text-right pre-value">${prePctLabel}</td>

        <td class="text-right post-value">${postPctLabel}</td>

        <td class="text-right"></td>

    `;

    container.appendChild(totalTr);

};



// --- Charting ---



const renderPieChart = (postRound) => {
    const container = document.getElementById("pie-chart-container");
    if (!container) return;

    if (window.pieChartInstance) {
        window.pieChartInstance.destroy();
    }

    container.innerHTML = '<canvas id="pieChartCanvas"></canvas>';

    const totalShares = postRound && postRound.total ? postRound.total.shares : 0;
    if (totalShares <= 0) return;

    const rowData = getRowData(postRound);
    const labels = rowData.map(row => row.name);
    const data = rowData.map(row => row.shares);
    const backgroundColors = rowData.map((_, index) => `var(--color-chart-${(index % 5) + 1})`);

    const ctx = document.getElementById('pieChartCanvas').getContext('2d');
    window.pieChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: backgroundColors,
                borderWidth: 2,
                borderColor: '#ffffff',
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 1.8,
            cutout: '70%',
            plugins: {
                legend: {
                    position: 'right',
                    align: 'center',
                    labels: {
                        padding: 16,
                        usePointStyle: true,
                        pointStyle: 'circle',
                        font: {
                            size: 13,
                            family: "'Inter', sans-serif",
                            weight: '500'
                        },
                        color: 'var(--text-medium)',
                        boxWidth: 10,
                        boxHeight: 10,
                        generateLabels: function (chart) {
                            const data = chart.data;
                            if (data.labels.length && data.datasets.length) {
                                return data.labels.map((label, i) => {
                                    const value = data.datasets[0].data[i];
                                    const percentage = ((value / totalShares) * 100).toFixed(1);
                                    return {
                                        text: `${label}  ${percentage}%`,
                                        fillStyle: data.datasets[0].backgroundColor[i],
                                        hidden: false,
                                        index: i
                                    };
                                });
                            }
                            return [];
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    padding: 12,
                    cornerRadius: 8,
                    titleFont: { size: 13, weight: '600' },
                    bodyFont: { size: 12 },
                    callbacks: {
                        label: function (context) {
                            const value = context.raw;
                            const percentage = ((value / totalShares) * 100).toFixed(1);
                            return ` ${formatNumberWithCommas(value)} shares (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
};

const old_renderPieChart_removed = () => {



    // Guardrail: Render if total shares are > 0 (even in pre-round state)

    const totalShares = postRound && postRound.total ? postRound.total.shares : 0;

    if (totalShares <= 0) {

        return;

    }



    const slices = getRowData(postRound).map((row, index) => {
        const colors = [
            "var(--color-chart-1)",
            "var(--color-chart-2)",
            "var(--color-chart-3)",
            "var(--color-chart-4)",
            "var(--color-chart-5)",
        ];
        return {
            ...row,
            color: colors[index % colors.length],
        };
    });



    // totalShares is already defined above



    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

    svg.setAttribute("viewBox", "0 0 100 100");

    svg.setAttribute("class", "chart-svg");



    let currentAngle = 0;

    slices.forEach((slice) => {

        if (slice.shares === 0) return;

        const slicePct = slice.shares / totalShares;

        const sliceAngle = slicePct * 360;



        const x1 = 50 + 40 * Math.cos((Math.PI * (currentAngle - 90)) / 180);

        const y1 = 50 + 40 * Math.sin((Math.PI * (currentAngle - 90)) / 180);

        currentAngle += sliceAngle;

        const x2 = 50 + 40 * Math.cos((Math.PI * (currentAngle - 90)) / 180);

        const y2 = 50 + 40 * Math.sin((Math.PI * (currentAngle - 90)) / 180);



        const largeArcFlag = sliceAngle > 180 ? 1 : 0;

        const pathData =
            slicePct >= 0.999
                ? `M 50,10 A 40,40 0 1,1 49.9,10 Z`
                : `M 50,50 L ${x1},${y1} A 40,40 0 ${largeArcFlag},1 ${x2},${y2} Z`;

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", pathData);
        path.setAttribute("fill", slice.color);
        path.setAttribute("stroke", "var(--white)");
        path.setAttribute("stroke-width", "2");
        svg.appendChild(path);
    });



    // Donut Cutout (White Center) - Larger radius for thinner donut look
    const centerCircle = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle"
    );
    centerCircle.setAttribute("cx", "50");
    centerCircle.setAttribute("cy", "50");
    centerCircle.setAttribute("r", "35"); // Increased from 26
    centerCircle.setAttribute("fill", "white");
    svg.appendChild(centerCircle);

    // Center Text
    const centerText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    centerText.setAttribute("x", "50");
    centerText.setAttribute("y", "50");
    centerText.setAttribute("text-anchor", "middle");
    centerText.setAttribute("dominant-baseline", "middle");
    centerText.setAttribute("font-family", "Inter, sans-serif");

    const tspanValue = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
    tspanValue.setAttribute("x", "50");
    tspanValue.setAttribute("dy", "-0.2em");
    tspanValue.setAttribute("font-size", "12");
    tspanValue.setAttribute("font-weight", "700");
    tspanValue.setAttribute("fill", "var(--text-dark)");
    tspanValue.textContent = safeFormatNumber(totalShares); // Show total shares or similar

    const tspanLabel = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
    tspanLabel.setAttribute("x", "50");
    tspanLabel.setAttribute("dy", "1.2em");
    tspanLabel.setAttribute("font-size", "8");
    tspanLabel.setAttribute("fill", "var(--text-light)");
    tspanLabel.textContent = "Total Shares";

    centerText.appendChild(tspanValue);
    centerText.appendChild(tspanLabel);
    svg.appendChild(centerText);

    container.appendChild(svg);

    // Legend
    const legend = document.createElement("div");
    legend.className = "donut-legend";
    slices.forEach((slice) => {
        if (slice.shares === 0) return;
        const pctText = safeFormatPercent(slice.ownershipPct);
        const row = document.createElement("div");
        row.className = "legend-row";
        row.innerHTML = `
            <div class="legend-left">
                <div class="legend-dot" style="background: ${slice.color}"></div>
                <span>${slice.name}</span>
            </div>
            <span class="legend-pct">${pctText}</span>
        `;
        legend.appendChild(row);
    });
    container.appendChild(legend);

    // Footer
    const footer = document.createElement("div");
    footer.className = "chart-footer";
    footer.innerHTML = `
        <div class="chart-footer-trend">
            Trending up by 5.2% this month <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trending-up"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
        </div>
        <div class="chart-footer-subtext">
            Showing total ownership distribution
        </div>
    `;
    container.appendChild(footer);
};



const renderBarChart = (preFounderPct, postFounderPct) => {
    const container = document.getElementById("bar-chart-container");
    if (!container) return;

    if (window.barChartInstance) {
        window.barChartInstance.destroy();
    }

    container.innerHTML = '<canvas id="barChartCanvas"></canvas>';

    const preValid = !isNaN(preFounderPct) && isFinite(preFounderPct) && preFounderPct > 0;
    const postValid = !isNaN(postFounderPct) && isFinite(postFounderPct) && postFounderPct > 0;

    if (!preValid && !postValid) return;

    const labels = ["Pre-round", "Post-round"];
    const data = [
        preValid ? preFounderPct * 100 : 0,
        postValid ? postFounderPct * 100 : 0
    ];

    const ctx = document.getElementById('barChartCanvas').getContext('2d');
    window.barChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Founder Ownership',
                data: data,
                backgroundColor: [
                    getComputedStyle(document.documentElement).getPropertyValue('--chart-5').trim() || '#c7d2fe',
                    getComputedStyle(document.documentElement).getPropertyValue('--chart-1').trim() || '#818cf8'
                ],
                borderRadius: 8,
                barPercentage: 0.5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 1.8,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        callback: (value) => value + "%",
                        font: { size: 12, family: "'Inter', sans-serif" },
                        color: 'var(--text-medium)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: { size: 13, family: "'Inter', sans-serif", weight: '500' },
                        color: 'var(--text-medium)'
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    padding: 12,
                    cornerRadius: 8,
                    titleFont: { size: 13, weight: '600' },
                    bodyFont: { size: 12 },
                    callbacks: {
                        label: (context) => `${context.dataset.label}: ${context.raw.toFixed(1)}%`
                    }
                }
            }
        }
    });
};

const renderAIAdvisor = (preRound, postRound, pricedConversion, state) => {

    const container = document.getElementById("ai-insights-container");

    if (!container) return;

    container.innerHTML = "";



    const newMoneyRaised = pricedConversion.totalSeriesInvestment;

    const preMoney = state.preMoney;



    // 1. Gating

    if (preMoney <= 0 || newMoneyRaised <= 0) {

        container.innerHTML = `<p class="card-subtext">Insights will appear once you enter your cap table and round terms.</p>`;

        return;

    }



    const insights = [];



    // a) Scenario summary

    const investment = formatUSDWithCommas(newMoneyRaised);

    const preMoneyStr = formatUSDWithCommas(preMoney);

    insights.push(`
        <div class="insight-item">
            <div class="insight-icon">📊</div>
            <div>You are modeling a <strong>${state.roundName}</strong> round raising <strong>${investment}</strong> at a <strong>${preMoneyStr}</strong> pre-money valuation.</div>
        </div>
    `);



    // b) Founder ownership change

    const foundersPost = postRound.common.filter((c) => c.category === "Founder");

    const foundersPre = preRound.common.filter((c) => c.category === "Founder");

    const totalFounderPctPost = foundersPost.reduce(

        (a, f) => a + f.ownershipPct,

        0

    );

    const totalFounderPctPre = foundersPre.reduce(

        (a, f) => a + f.ownershipPct,

        0

    );



    insights.push(`
        <div class="insight-item">
            <div class="insight-icon">👥</div>
            <div>Founder ownership changes from <strong>${safeFormatPercent(totalFounderPctPre)}</strong> pre-round to <strong>${safeFormatPercent(totalFounderPctPost)}</strong> post-round.</div>
        </div>
    `);



    // c) Majority ownership warning (conditional)

    if (totalFounderPctPre >= 0.5 && totalFounderPctPost < 0.5) {
        insights.push(`
            <div class="insight-item" style="border-left-color: var(--danger);">
                <div class="insight-icon">⚠️</div>
                <div style="color: var(--danger); font-weight: 500;">Founders have dropped below 50% majority ownership in this round.</div>
            </div>
        `);
    }



    // d) Option pool explanation (conditional)

    if (pricedConversion.increaseInOptionsPool > 0) {
        insights.push(`
            <div class="insight-item">
                <div class="insight-icon">💡</div>
                <div>The model includes an option pool top-up to reach the target of <strong>${state.targetOptionsPool}%</strong>, which issued additional shares pre-round.</div>
            </div>
        `);
    }



    container.innerHTML = insights.join("");

};



// --- Event Handlers ---



window.updateRow = (id, field, value) => {

    const row = state.rowData.find((r) => r.id === id);

    if (!row) return;



    if (field === "shares" || field === "investment" || field === "cap") {

        row[field] = stringToNumber(value);

    } else if (field === "discount") {

        row[field] = stringToNumber(value) / 100;

    } else {

        row[field] = value;

    }

    updateUI();

};



window.addRow = (type) => {

    const id =

        Date.now().toString() + "-" + Math.random().toString(36).substr(2, 9);

    if (type === "common") {

        state.rowData.push({

            id,

            type,

            name: "New Shareholder",

            shares: 0,

            category: "Investor",

        });

    } else if (type === "safe") {

        state.rowData.push({

            id,

            type,

            name: "New SAFE",

            investment: 0,

            cap: 0,

            discount: 0,

            conversionType: "post",

        });

    } else if (type === "series") {

        state.rowData.push({ id, type, name: "New Investor", investment: 0 });

    }

    updateUI();

};



window.deleteRow = (id) => {

    // If user deletes the "UnusedOptionsPool", they likely want to remove the pool concept entirely.

    // So we effectively set the Target Option Pool to 0%.

    if (id === "UnusedOptionsPool") {

        state.targetOptionsPool = 0;

        const targetInput = document.getElementById("target-options-input");

        if (targetInput) targetInput.value = "0";

    }



    state.rowData = state.rowData.filter((r) => r.id !== id);

    updateUI();

};



window.togglePricedRound = () => {

    state.pricedRounds = state.pricedRounds === 0 ? 1 : 0;

    const btn = document.getElementById("toggle-priced-btn");

    btn.textContent =

        state.pricedRounds > 0 ? "Remove Priced Round" : "Add Priced Round";

    updateUI();

};



window.updateGlobal = (field, value) => {

    if (field === "preMoney" || field === "targetOptionsPool") {

        state[field] = stringToNumber(value);

    } else {

        state[field] = value;

    }

    updateUI();

};



window.toggleDarkMode = () => {

    state.darkMode = !state.darkMode;

    document.documentElement.classList.toggle("dark", state.darkMode);

    localStorage.setItem("color-theme", state.darkMode ? "dark" : "light");

};



// --- Initialization ---



document.addEventListener("DOMContentLoaded", () => {

    // Check theme

    const storedTheme = localStorage.getItem("color-theme");

    if (

        storedTheme === "dark" ||

        (!storedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches)

    ) {

        state.darkMode = true;

        document.documentElement.classList.add("dark");

    }



    updateUI();

});