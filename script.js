const CapTableRowType = {
    Common: "common",           
    Safe: "safe",               
    Series: "series",           
    Total: "total",             
    RefreshedOptions: "refreshedOptions", 
};

const CommonRowType = {
    Shareholder: "shareholder", 
    UnusedOptions: "unusedOptions", 
};

const DEFAULT_ROUNDING_STRATEGY = {
    roundShares: true,    
    roundPPSPlaces: 8,    
};

const stringToNumber = (value) => {
    
    if (typeof value === "number") return value;

    const cleanedValue = String(value).replace(/[^-\d.]/g, "");

    return cleanedValue.includes(".")
        ? parseFloat(cleanedValue)
        : parseInt(cleanedValue, 10) || 0;
};

const formatUSDWithCommas = (value) => {
    const num = stringToNumber(value);
    return num.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0, 
    });
};

const formatNumberWithCommas = (value) => {
    return stringToNumber(value).toLocaleString("en-US", { style: "decimal" });
};

const safeFormatPercent = (value, decimals = 2) => {
    
    if (value === null || value === undefined || isNaN(value) || !isFinite(value))
        return "—";

    return `${(value * 100).toFixed(decimals)}%`;
};

const safeFormatNumber = (value) => {
    if (value === null || value === undefined || isNaN(value) || !isFinite(value))
        return "—";
    return formatNumberWithCommas(value);
};

const safeFormatCurrency = (value) => {
    if (value === null || value === undefined || isNaN(value) || !isFinite(value))
        return "—";
    return formatUSDWithCommas(value);
};

const formatPPSWithCommas = (value) => {
    const num = stringToNumber(value);
    return num.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 3,  
        minimumFractionDigits: 2,  
    });
};

const safeFormatUSD = (value) => {
    if (value === null || value === undefined || isNaN(value) || !isFinite(value))
        return "—";
    return formatUSDWithCommas(value);
};

const safeFormatPPS = (value) => {
    if (value === null || value === undefined || isNaN(value) || !isFinite(value))
        return "—";
    return formatPPSWithCommas(value);
};

const formatInputLive = (input, isCurrency = false) => {
    let value = input.value;
    
    // Save cursor position
    const start = input.selectionStart;
    const oldLength = value.length;

    if (isCurrency) {
        // Remove everything except digits
        let digits = value.replace(/\D/g, "");
        if (digits === "") {
            input.value = "0";
        } else {
            input.value = formatNumberWithCommas(parseInt(digits));
        }
    } else {
        // Remove everything except digits
        let digits = value.replace(/\D/g, "");
        if (digits === "") {
            input.value = "0";
        } else {
            input.value = formatNumberWithCommas(parseInt(digits));
        }
    }

    // Restore cursor position
    const newLength = input.value.length;
    const diff = newLength - oldLength;
    const newPos = Math.max(0, cursorPos + diff);
    input.setSelectionRange(newPos, newPos);
};

window.formatInputLive = formatInputLive;

const roundShares = (num, strategy = DEFAULT_ROUNDING_STRATEGY) => {
    if (strategy.roundDownShares) return Math.floor(num);  
    if (strategy.roundShares) return Math.round(num);      
    return num;  
};

const roundPPSToPlaces = (num, places) => {

    if (places < 0) return num;

    const factor = Math.pow(10, places);

    return Math.ceil(num * factor) / factor;

};

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

const sumSafeConvertedShares = (safes, pps, preMoneyShares, postMoneyShares, roundingStrategy) => {
    return safes.reduce((acc, safe) => {
        const discountPPS = roundPPSToPlaces(
            safeConvert(safe, preMoneyShares, postMoneyShares, pps),
            roundingStrategy.roundPPSPlaces
        );
        const postSafeShares = safe.investment / discountPPS;
        return acc + roundShares(postSafeShares, roundingStrategy);
    }, 0);
};

const checkSafeNotesForErrors = (safeNotes) => {
    let ownershipError = undefined;
    safeNotes.forEach((safe) => {
        if (safe.investment >= safe.cap && safe.cap !== 0) {
            ownershipError = {
                type: "error",
                reason: "Investment cannot utilize the entire Cap (Investment >= Cap). This is mathematically impossible for a Pre-money SAFE model.",
            };
        }
    });
    return ownershipError;
};

const calculatePreAndPostMoneyShares = (
    preMoneyValuation,
    commonShares,
    unusedOptions,
    targetOptionsPct,
    seriesInvestments,
    totalShares,
    roundingStrategy = DEFAULT_ROUNDING_STRATEGY
) => {
    let optionsPool = roundShares(totalShares * (targetOptionsPct / 100), roundingStrategy);
    if (optionsPool < unusedOptions) optionsPool = unusedOptions;
    const increaseInOptionsPool = optionsPool - unusedOptions;
    const seriesInvestmentTotal = seriesInvestments.reduce((a, b) => a + b, 0);
    const pps = totalShares > 0
        ? roundPPSToPlaces((preMoneyValuation + seriesInvestmentTotal) / totalShares, roundingStrategy.roundPPSPlaces)
        : 0;
    const seriesShares = pps > 0
        ? seriesInvestments.reduce((acc, inv) => acc + roundShares(inv / pps, roundingStrategy), 0)
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

const attemptFit = (preMoneyValuation, commonShares, unusedOptions, targetOptionsPct, safes, seriesInvestments, totalShares, roundingStrategy = DEFAULT_ROUNDING_STRATEGY) => {
    const results = calculatePreAndPostMoneyShares(preMoneyValuation, commonShares, unusedOptions, targetOptionsPct, seriesInvestments, totalShares, roundingStrategy);
    const safeShares = sumSafeConvertedShares(safes, results.pps, results.preMoneyShares, results.postMoneyShares, roundingStrategy);
    return results.seriesShares + commonShares + results.optionsPool + safeShares;
};

const fitConversion = (preMoneyValuation, commonShares, safes, unusedOptions, targetOptionsPct, seriesInvestments, roundingStrategy = DEFAULT_ROUNDING_STRATEGY) => {
    let totalShares = commonShares + unusedOptions;
    let lastTotalShares = totalShares;
    for (let i = 0; i < 100; i++) {
        totalShares = attemptFit(preMoneyValuation, commonShares, unusedOptions, targetOptionsPct, safes, seriesInvestments, totalShares, roundingStrategy);
        if (totalShares === lastTotalShares) break;
        lastTotalShares = totalShares;
    }
    const res = calculatePreAndPostMoneyShares(preMoneyValuation, commonShares, unusedOptions, targetOptionsPct, seriesInvestments, totalShares, roundingStrategy);
    const ppss = safes.map((safe) =>
        roundPPSToPlaces(safeConvert(safe, res.preMoneyShares, res.postMoneyShares, res.pps), roundingStrategy.roundPPSPlaces)
    );
    const convertedSafeShares = sumSafeConvertedShares(safes, res.pps, res.preMoneyShares, res.postMoneyShares, roundingStrategy);
    const totalSeriesInvestment = seriesInvestments.reduce((a, b) => a + b, 0);

    return {
        ...res,
        ppss,
        totalShares,
        newSharesIssued: totalShares - commonShares - unusedOptions,
        convertedSafeShares,
        totalOptions: res.increaseInOptionsPool + unusedOptions,
        additionalOptions: res.increaseInOptionsPool,
        totalInvested: totalSeriesInvestment + safes.reduce((acc, safe) => acc + safe.investment, 0),
        totalSeriesInvestment,
    };
};

const buildTBDPreRoundCapTable = (safeNotes, common) => {
    const totalInvestment = safeNotes.reduce((acc, investor) => acc + investor.investment, 0);
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
    const totalInvestment = safeNotes.reduce((acc, investor) => acc + investor.investment, 0);
    const totalShares = common.reduce((acc, c) => acc + c.shares, 0);
    return {
        common: common.map((c) => ({
            ...c,
            ownershipPct: 0,
            ownershipError: { type: "error" },
        })),
        safes: safeNotes.map((s) => {
            const error = { type: "error" };
            if (s.investment >= s.cap && s.cap !== 0) error.reason = "SAFE's investment cannot equal or exceed the Cap";
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

const buildStrictlyPreRoundCapTable = (rowData) => {
    const common = rowData.filter((r) => r.type === CapTableRowType.Common);
    const totalShares = common.reduce((acc, r) => acc + r.shares, 0);

    return {
        common: common.map((c) => ({
            ...c,
            ownershipPct: totalShares > 0 ? c.shares / totalShares : 0,
        })),
        safes: rowData
            .filter((r) => r.type === CapTableRowType.Safe)
            .map((s) => ({ ...s, shares: 0, ownershipPct: 0 })),
        total: {
            shares: totalShares,
            investment: 0,
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

const INITIAL_STATE = {
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
            discount: 0.2, 
            conversionType: "post",
        },
        { id: "4", type: "series", name: "Investor 1", investment: 2000000 },
    ],
    preMoney: 10000000,
    targetOptionsPool: 10,
    pricedRounds: 1, 
};

let state = JSON.parse(JSON.stringify(INITIAL_STATE));

window.resetCalculator = () => {
    state = JSON.parse(JSON.stringify(INITIAL_STATE));
    clearGlobalErrors();
    updateUI();
};

const showGlobalError = (message) => {
    const container = document.getElementById("global-error-container");
    if (container) {
        container.innerHTML = `
            <div id="results-error-alert" style="background-color: rgba(239, 68, 68, 0.1); color: var(--danger); border: 1px solid var(--danger); padding: 1rem; border-radius: var(--radius-small); font-size: 0.9375rem; display: flex; align-items: center; gap: 0.75rem;">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                <span><strong>Error:</strong> ${message}</span>
            </div>
        `;
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

const clearGlobalErrors = () => {
    const container = document.getElementById("global-error-container");
    if (container) container.innerHTML = "";
};

const TRASH_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>`;

const updateUI = () => {
    try {
        console.log("updateUI called", state);
        clearGlobalErrors();

        if (state.preMoney <= 0) {
            showGlobalError("Pre-money valuation is required and must be greater than 0 to calculate.");
            
            document.getElementById("round-pps-val").textContent = "—";
            document.getElementById("post-money-val").textContent = "—";
            document.getElementById("total-post-shares-val").textContent = "—";
            document.getElementById("founder-ownership-val").textContent = "—";
            document.getElementById("post-round-table").innerHTML = "";
            document.getElementById("pie-chart-container").innerHTML = "";
            document.getElementById("bar-chart-container").innerHTML = "";
            document.getElementById("ai-insights-container").innerHTML = "";
            return;
        }

        const preRound = buildEstimatedPreRoundCapTable(state.rowData);

        const preMoneyInput = document.getElementById("pre-money-input");

        if (preMoneyInput && document.activeElement !== preMoneyInput) {
            preMoneyInput.value = formatNumberWithCommas(state.preMoney);
        }

        const targetOptionsInput = document.getElementById("target-options-input");

        if (targetOptionsInput && document.activeElement !== targetOptionsInput) {

            targetOptionsInput.value = state.targetOptionsPool;

        }

        renderSAFEs();

        renderSeriesInvestors();

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

        const rawSafes = state.rowData.filter(

            (r) => r.type === CapTableRowType.Safe

        );

        const safes = populateSafeCaps(rawSafes);

        const error = checkSafeNotesForErrors(safes);

        if (error) {
            showGlobalError(error.reason);

            document.getElementById("post-round-table").innerHTML = "";

            document.getElementById("pie-chart-container").innerHTML = "";

            document.getElementById("bar-chart-container").innerHTML = "";

            document.getElementById("ai-insights-container").innerHTML = "";

            document.getElementById("round-pps-val").textContent = "—";

            document.getElementById("post-money-val").textContent = "—";

            document.getElementById("total-post-shares-val").textContent = "—";

            document.getElementById("founder-ownership-val").textContent = "—";

            return; 

        }

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

        const roundPpsEl = document.getElementById("round-pps-val");

        if (roundPpsEl)

            roundPpsEl.textContent = safeFormatPPS(pricedConversion.pps);

        const postMoneyVal = pricedConversion.totalShares * pricedConversion.pps;
        const postMoneyEl = document.getElementById("post-money-val");
        if (postMoneyEl) postMoneyEl.textContent = safeFormatCurrency(postMoneyVal);
        

        const additionalOptionsEl = document.getElementById("additional-options-val");
        if (additionalOptionsEl) additionalOptionsEl.textContent = safeFormatNumber(pricedConversion.additionalOptions);

        const additionalOptionsTextEl = document.getElementById("additional-options-val-text");
        if (additionalOptionsTextEl) additionalOptionsTextEl.textContent = `+${safeFormatNumber(pricedConversion.additionalOptions)} shares will be added to reach target`;

        const newInvestorsSharesEl = document.getElementById(

            "new-investors-shares-val"

        );

        if (newInvestorsSharesEl)

            newInvestorsSharesEl.textContent = safeFormatNumber(

                pricedConversion.seriesShares

            );

        const postRound = buildPricedRoundCapTable(pricedConversion, state.rowData);

        const totalPostSharesEl = document.getElementById("total-post-shares-val");

        if (totalPostSharesEl)

            totalPostSharesEl.textContent = safeFormatNumber(postRound.total.shares);

        const foundersPost = postRound.common.filter(

            (c) => c.category === "Founder"

        );

        const totalFounderPctPost = foundersPost.reduce(

            (a, f) => a + f.ownershipPct,

            0

        );

        const commonSharesTotal = state.rowData
            .filter((r) => r.type === CapTableRowType.Common)
            .reduce((a, r) => a + r.shares, 0);

        const founderSharesPre = state.rowData
            .filter((r) => r.type === CapTableRowType.Common && r.category === "Founder")
            .reduce((a, r) => a + r.shares, 0);

        const totalFounderPctPre = commonSharesTotal > 0 ? founderSharesPre / commonSharesTotal : 0;

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

        const strictlyPreRound = buildStrictlyPreRoundCapTable(state.rowData);

        renderBreakdownTable(strictlyPreRound, postRound, pricedConversion.pps);

        renderPieChart(postRound);

        renderBarChart(totalFounderPctPre, totalFounderPctPost);

        renderAIAdvisor(preRound, postRound, pricedConversion, state);

    } catch (error) {

        console.error("Error updating UI:", error);

    }

};

const renderShareholders = (totalSharesS0) => {
    const container = document.getElementById("shareholders-body");
    container.innerHTML = "";
    const categories = ["Founder", "ESOP Pool (granted)", "ESOP Pool (unallocated)", "Investor", "Other"];
    const shareholders = state.rowData.filter((r) => r.type === CapTableRowType.Common);
    
    shareholders.forEach((row) => {
        const ownershipPct = totalSharesS0 > 0 ? row.shares / totalSharesS0 : NaN;
        const pctText = safeFormatPercent(ownershipPct);
        const card = document.createElement("div");
        card.className = "input-row-card";
        card.innerHTML = `
            <div class="row-card-header">
                <input class="input flex-1" value="${row.name}" placeholder="Name" onchange="updateRow('${row.id}', 'name', this.value)">
                <button class="btn-trash row-trash-btn" onclick="deleteRow('${row.id}')">${TRASH_ICON}</button>
            </div>
            <div class="row-card-grid-shareholder">
                <div>
                    <label class="field-label row-field-label">Category</label>
                    <select class="select row-select" onchange="updateRow('${row.id}', 'category', this.value)">
                        ${categories.map(cat => `<option value="${cat}" ${row.category === cat ? "selected" : ""}>${cat}</option>`).join("")}
                    </select>
                </div>
                <div>
                    <label class="field-label row-field-label">Shares</label>
                    <div class="flex items-center">
                        <input class="input row-input-right" type="text" value="${formatNumberWithCommas(row.shares)}" 
                            oninput="formatInputLive(this, false)" onchange="updateRow('${row.id}', 'shares', this.value)">
                        <span class="input-suffix">shares</span>
                    </div>
                </div>
                <div class="pct-badge badge-fixed-height">${pctText}</div>
            </div>
        `;
        container.appendChild(card);
    });

    const footer = document.getElementById("cap-table-footer");
    footer.className = "card-footer-total";
    footer.innerHTML = `
        <span>Total fully diluted shares</span>
        <span class="footer-total-value">${formatNumberWithCommas(totalSharesS0)}</span>
    `;
};

const renderSAFEs = () => {
    const container = document.getElementById("safes-body");
    if (!container) return;
    container.innerHTML = "";
    const safeRows = state.rowData.filter((r) => r.type === CapTableRowType.Safe);
    let totalInv = 0;
    
    safeRows.forEach((row) => {
        totalInv += row.investment;
        const card = document.createElement("div");
        card.className = "input-row-card";
        card.innerHTML = `
            <div class="safe-card-header">
                <input class="input safe-name-input" value="${row.name}" placeholder="New SAFE" onchange="updateRow('${row.id}', 'name', this.value)" />
                <button class="btn-trash row-trash-btn" onclick="deleteRow('${row.id}')">${TRASH_ICON}</button>
            </div>
            <div class="row-card-grid-safe">
                <div>
                    <label class="field-label">Investment</label>
                    <div class="input-with-symbol">
                        <span class="input-symbol">$</span>
                        <input class="input row-input-right" type="text" value="${formatNumberWithCommas(row.investment)}" 
                            oninput="formatInputLive(this, true)" onchange="updateRow('${row.id}', 'investment', this.value)" />
                    </div>
                </div>
                <div>
                    <label class="field-label">Valuation Cap</label>
                    <div class="input-with-symbol">
                        <span class="input-symbol">$</span>
                        <input class="input row-input-right" type="text" value="${formatNumberWithCommas(row.cap)}" 
                            oninput="formatInputLive(this, true)" onchange="updateRow('${row.id}', 'cap', this.value)" />
                    </div>
                </div>
                <div>
                    <label class="field-label">Discount</label>
                    <div class="input-with-symbol-right">
                        <input class="input safe-discount-input" type="text" value="${Math.round(row.discount * 100)}" 
                            oninput="formatInputLive(this, false)" onchange="updateRow('${row.id}', 'discount', this.value)" />
                        <span class="input-symbol">%</span>
                    </div>
                </div>
                <div>
                    <label class="field-label">Type</label>
                    <select class="select row-select" onchange="updateRow('${row.id}', 'conversionType', this.value)">
                        <option value="post" ${row.conversionType === "post" ? "selected" : ""}>Post-money</option>
                        <option value="pre" ${row.conversionType === "pre" ? "selected" : ""}>Pre-money</option>
                    </select>
                </div>
            </div>
        `;
        container.appendChild(card);
    });

    const safesSection = document.getElementById("safes-container").parentElement;
    let totalRow = safesSection.querySelector(".card-footer-total");
    if (!totalRow) {
        totalRow = document.createElement("div");
        totalRow.className = "card-footer-total";
        safesSection.appendChild(totalRow);
    }
    totalRow.innerHTML = `
        <span>Total SAFE investment</span>
        <span class="footer-total-value">${formatUSDWithCommas(totalInv)}</span>
    `;
};

const renderSeriesInvestors = () => {
    const container = document.getElementById("series-body");
    if (!container) return;
    container.innerHTML = "";
    const seriesInvestors = state.rowData.filter((r) => r.type === CapTableRowType.Series);
    let totalInv = 0;
    
    seriesInvestors.forEach((row) => {
        totalInv += row.investment;
        const card = document.createElement("div");
        card.className = "series-investor-row";
        card.innerHTML = `
            <input class="input flex-2" value="${row.name}" placeholder="Name" onchange="updateRow('${row.id}', 'name', this.value)">
            <div class="input-with-symbol flex-1">
                <span class="input-symbol">$</span>
                <input class="input series-investor-input" type="text" value="${formatNumberWithCommas(row.investment)}" 
                    oninput="formatInputLive(this, true)" onchange="updateRow('${row.id}', 'investment', this.value)">
            </div>
            <button class="btn-trash row-trash-btn" onclick="deleteRow('${row.id}')">${TRASH_ICON}</button>
        `;
        container.appendChild(card);
    });

    const seriesSection = document.getElementById("series-container").parentElement;
    let totalRow = seriesSection.querySelector(".card-footer-total-series");
    if (!totalRow) {
        totalRow = document.createElement("div");
        totalRow.className = "card-footer-total card-footer-total-series";
        seriesSection.appendChild(totalRow);
    }
    totalRow.innerHTML = `
        <span>Total raising</span>
        <span class="footer-total-value">${formatUSDWithCommas(totalInv)}</span>
    `;
};

const getRowData = (data) => {
    const rows = [];

    if (!data) return rows;

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

        const prePctLabel =

            preSharesValid && !pre.isVirtual && pre.shares > 0

                ? safeFormatPercent(pre.ownershipPct)

                : "—";

        const postPctLabel =

            postSharesValid && post.shares > 0

                ? safeFormatPercent(post.ownershipPct)

                : "—";

        let displayName = post.name || pre.name || "—";

        let tagsHtml = "";

        if (post.isPricedOrSafe && post.category === "SAFE Converter") {

            if (post.isMFN) {

                tagsHtml += `<span class="tag tag-mfn">MFN</span>`;

                tagsHtml += `<span class="tag tag-post">Post-money SAFE</span>`; 

            } else if (post.conversionType === "pre") {

                tagsHtml += `<span class="tag tag-pre">Pre-money SAFE</span>`;

            } else {

                tagsHtml += `<span class="tag tag-post">Post-money SAFE</span>`;

            }

        }

        if (post.id === "UnusedOptionsPool" && postSharesValid && pre.shares >= 0) {

            if (post.shares > pre.shares + 1) {

                tagsHtml += `<span class="tag tag-topup">Pool Top-Up</span>`;

            }

        }

        const tr = document.createElement("tr");
        tr.className = "group investor-row"; /* Added investor-row for styling */
        tr.id = `row-${id}`;

        tr.innerHTML = `
        <td class="col-name">
            <div class="flex-cell-content">
                <span class="font-medium text-dark">${displayName}</span>
                ${tagsHtml}
            </div>
        </td>

        <td class="text-right text-muted">${safeFormatNumber(pre.shares)}</td>

        <td class="text-right font-medium text-dark">${safeFormatNumber(post.shares)}</td>

        <td class="text-right text-muted">${prePctLabel}</td>

        <td class="text-right font-medium text-brand">${postPctLabel}</td>

        <td class="text-right text-muted hide-on-mobile">${safeFormatPPS(
            post.pps_val
        )}</td>
    `;

        container.appendChild(tr);

    });

    const totalTr = document.createElement("tr");
    totalTr.className = "total-row"; 
    totalTr.style.fontWeight = "600";
    totalTr.style.backgroundColor = "var(--slate-50)";

    const prePctLabel = preSharesValid ? "100.00%" : "—";
    const postPctLabel = postSharesValid ? "100.00%" : "—";

    totalTr.innerHTML = `
        <td class="col-name" style="display: table-cell;">Total</td>

        <td class="text-right pre-value">${safeFormatNumber(

        preData.total.shares

    )}</td>

        <td class="text-right post-value post-shares-value">${safeFormatNumber(

        postData.total.shares

    )}</td>

        <td class="text-right pre-value">${prePctLabel}</td>

        <td class="text-right post-value post-pct-value">${postPctLabel}</td>

        <td class="text-right"></td>

    `;

    container.appendChild(totalTr);

};

const renderPieChart = (postRound) => {
    const container = document.getElementById("pie-chart-container");
    if (!container) return;

    if (window.pieChartInstance) {
        window.pieChartInstance.destroy();
        window.pieChartInstance = null;
    }

    container.innerHTML = `
        <div class="chart-wrapper-pie">
            <canvas id="pieChartCanvas"></canvas>
        </div>
    `;

    const totalShares = postRound?.total?.shares || 0;
    if (totalShares <= 0) return;

    const rowData = getRowData(postRound);
    if (!rowData.length) return;

    const labels = rowData.map(r => r.name);
    const data = rowData.map(r => r.shares);
    const backgroundColors = [
        "#5F17EA", "#8B5CF6", "#22D3EE", "#22C55E", "#FACC15", 
        "#A78BFA", "#6366F1", "#3B82F6", "#06B6D4", "#10B981"
    ];

    const canvas = document.getElementById("pieChartCanvas");
    const ctx = canvas.getContext("2d");

    window.pieChartInstance = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: backgroundColors,
                borderWidth: 2,
                borderColor: "#ffffff",
                hoverOffset: 15 /* Increased for sector expansion effect */
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "50%",
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const id = rowData[index].id;
                    const rowEl = document.getElementById(`row-${id}`);
                    if (rowEl) {
                        rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        rowEl.classList.add('highlight-row');
                        rowEl.classList.add('highlight-flash');
                        setTimeout(() => {
                            rowEl.classList.remove('highlight-row');
                            rowEl.classList.remove('highlight-flash');
                        }, 2000);
                    }
                }
            },
            onHover: (event, elements) => {
                if (event.native) {
                    event.native.target.style.cursor = elements.length > 0 ? 'pointer' : 'default';
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        boxWidth: 8,
                        boxHeight: 8,
                        borderRadius: 4,
                        usePointStyle: true,
                        color: "#4B5563",
                        font: { 
                            size: 11, 
                            family: "'Inter', sans-serif", 
                            weight: 500
                        },
                        padding: 20,
                        generateLabels: (chart) => {
                            const data = chart.data;
                            if (data.labels.length && data.datasets.length) {
                                return data.labels.map((label, i) => {
                                    const value = data.datasets[0].data[i];
                                    const percentage = ((value / totalShares) * 100).toFixed(1);
                                    if (value / totalShares < 0.005) return null;
                                    return {
                                        text: `${label} (${percentage}%)`,
                                        fillStyle: data.datasets[0].backgroundColor[i],
                                        pointStyle: 'circle',
                                        hidden: false,
                                        index: i
                                    };
                                }).filter(item => item !== null);
                            }
                            return [];
                        }
                    }
                },
                tooltip: {
                    enabled: true,
                    backgroundColor: '#ffffff',
                    titleColor: '#111827',
                    bodyColor: '#4B5563',
                    borderColor: '#E5E7EB',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8,
                    titleFont: { size: 13, weight: '600', family: "'Inter', sans-serif" },
                    bodyFont: { size: 12, family: "'Inter', sans-serif" },
                    callbacks: {
                        label: (context) => {
                            const value = context.raw;
                            const percentage = ((value / totalShares) * 100).toFixed(1);
                            return ` Shares: ${formatNumberWithCommas(value)} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
};

/* Removed dead old_renderPieChart_removed */

const renderBarChart = (preFounderPct, postFounderPct) => {
    const container = document.getElementById("bar-chart-container");
    if (!container) return;

    if (window.barChartInstance) {
        window.barChartInstance.destroy();
    }

    container.innerHTML = `
        <div class="chart-wrapper-bar">
            <canvas id="barChartCanvas"></canvas>
        </div>
    `;

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
                backgroundColor: ["#E5E5ED", "#5f17ea"],
                barPercentage: 0.5,
                categoryPercentage: 0.7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: { color: 'rgba(0, 0, 0, 0.05)', drawBorder: false },
                    ticks: {
                        callback: (value) => value + "%",
                        font: { size: 11, family: "'Inter', sans-serif" },
                        color: '#64748B',
                        // Hide ticks if container is too small
                        display: (context) => context.chart.height > 100
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        font: { size: 12, family: "'Inter', sans-serif", weight: '500' },
                        color: '#475569',
                        // Hide labels if container is too narrow
                        display: (context) => context.chart.width > 120
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    padding: 12,
                    cornerRadius: 8,
                    titleFont: { family: "'Inter', sans-serif" },
                    bodyFont: { family: "'Inter', sans-serif" },
                    callbacks: {
                        label: (context) => ` Ownership: ${context.raw.toFixed(1)}%`
                    }
                }
            },
            layout: {
                padding: { top: 20, bottom: 5, left: 10, right: 10 }
            }
        }
    });

    // Add summary text below bar chart
    const summaryText = document.createElement("div");
    summaryText.className = "chart-summary-text";
    summaryText.innerHTML = `${(preFounderPct * 100).toFixed(1)}% &rarr; ${(postFounderPct * 100).toFixed(1)}%`;
    container.appendChild(summaryText);
};

// Global Loading State
let aiLoadingTimeout = null;

const renderAIAdvisor = (preRound, postRound, pricedConversion, state) => {
    const container = document.getElementById("ai-insights-container");
    if (!container) return;

    // Clear any pending timeout to prevent race conditions
    if (aiLoadingTimeout) clearTimeout(aiLoadingTimeout);

    const newMoneyRaised = pricedConversion.totalSeriesInvestment;
    const preMoney = state.preMoney;

    if (preMoney <= 0 || newMoneyRaised <= 0) {
        container.innerHTML = `<p class="card-subtext">Insights will appear once you enter your cap table and round terms.</p>`;
        return;
    }

    // Show Skeleton Loader Immediately
    container.innerHTML = `
        <div class="ai-skeleton-loader">
            <div class="ai-skeleton-line" style="width: 100%;"></div>
            <div class="ai-skeleton-line" style="width: 85%;"></div>
            <div class="ai-skeleton-line" style="width: 60%;"></div>
        </div>
    `;

    // Delay actual rendering to simulate "thinking"
    aiLoadingTimeout = setTimeout(() => {
        const insights = [];
        const investment = formatUSDWithCommas(newMoneyRaised);
        const preMoneyStr = formatUSDWithCommas(preMoney);

        const foundersPost = postRound.common.filter((c) => c.category === "Founder");
        const foundersPre = preRound.common.filter((c) => c.category === "Founder");
        const totalFounderPctPost = foundersPost.reduce((a, f) => a + f.ownershipPct, 0);
        const totalFounderPctPre = foundersPre.reduce((a, f) => a + f.ownershipPct, 0);

        // Interpretation sentence
        insights.push(`<p>You are modeling a <strong>${state.roundName}</strong> round raising <strong>${investment}</strong> at a <strong>${preMoneyStr}</strong> pre-money valuation. Founder ownership changes from <strong>${safeFormatPercent(totalFounderPctPre)}</strong> to <strong>${safeFormatPercent(totalFounderPctPost)}</strong> post-round.</p>`);

        const safesCount = state.rowData.filter(r => r.type === CapTableRowType.Safe).length;
        const totalSafeInvestment = state.rowData
            .filter(r => r.type === CapTableRowType.Safe)
            .reduce((sum, s) => sum + s.investment, 0);

        if (safesCount > 0) {
            insights.push(`<p>${safesCount} SAFE${safesCount > 1 ? 's' : ''} totaling ${formatUSDWithCommas(totalSafeInvestment)} will convert.</p>`);
        }
        if (totalFounderPctPre >= 0.5 && totalFounderPctPost < 0.5) {
            insights.push(`
                <div class="insight-item">
                    <div class="insight-danger">Founders have dropped below 50% majority ownership in this round.</div>
                </div>
            `);
        }
        if (pricedConversion.increaseInOptionsPool > 0) {
            insights.push(`
                <div class="insight-item">
                    <div>The model includes an option pool top-up to reach the target of <strong>${state.targetOptionsPool}%</strong>, which issued additional shares pre-round.</div>
                </div>
            `);
        }
        container.innerHTML = insights.join("");
    }, 1000); // 1.0 second delay
};

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

    } else if (type === CapTableRowType.Safe) {

        state.rowData.push({

            id,

            type,

            name: "New SAFE",

            investment: 0,

            cap: 0,

            discount: 0,

            conversionType: "post",

        });

    } else if (type === CapTableRowType.Series) {

        state.rowData.push({ id, type, name: "New Investor", investment: 0 });

    }

    updateUI();

};

window.deleteRow = (id) => {
    const row = state.rowData.find((r) => r.id === id);
    if (!row) return;

    if (id === "UnusedOptionsPool") {
        state.targetOptionsPool = 0;
        const targetInput = document.getElementById("target-options-input");
        if (targetInput) targetInput.value = "0";
    } else {
        if (row.type === CapTableRowType.Common) {
            const commonCount = state.rowData.filter(
                (r) => r.type === CapTableRowType.Common && r.id !== "UnusedOptionsPool"
            ).length;
            if (commonCount <= 1) return;
        } else if (row.type === CapTableRowType.Safe) {
            const safeCount = state.rowData.filter((r) => r.type === CapTableRowType.Safe).length;
            if (safeCount <= 1) return;
        } else if (row.type === CapTableRowType.Series) {
            const seriesCount = state.rowData.filter((r) => r.type === CapTableRowType.Series).length;
            if (seriesCount <= 1) return;
        }
    }

    state.rowData = state.rowData.filter((r) => r.id !== id);
    updateUI();
};

window.togglePricedRound = () => {
    state.pricedRounds = state.pricedRounds === 0 ? 1 : 0;
    const btn = document.getElementById("toggle-priced-btn");
    if (btn) btn.textContent = state.pricedRounds > 0 ? "Remove Priced Round" : "Add Priced Round";
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

document.addEventListener("DOMContentLoaded", () => {
    updateUI();
});
