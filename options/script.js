async function addDownloadLink() {
    let data = await getDataFromLocal("TAB_HIST_EXPORT_DATA", "[]");
    data = data.data;
    let blob = new Blob([data], { type: "application/json" });
    let url = URL.createObjectURL(blob);
    let fileName = "tabs_hist_export_" + getTimeString() + ".json";

    let dataDiv = document.getElementById("data");
    dataDiv.innerText = "";
    let anchorTag = document.createElement("a");
    anchorTag.innerText = "Download tabs history"
    dataDiv.appendChild(anchorTag);
    anchorTag.href = url;
    anchorTag.download = fileName;
}

async function showLog() {
    let logs = await getDataFromLocal("logs", []);
    logs = logs.data;
    let logStr = logs.join('\n');
    let logsDiv = document.getElementById("logs");
    logsDiv.innerText = logStr;
}

let options = null;

async function setup() {
    await ensureOptions();

    let debugInput = document.getElementById("debug-check");
    debugInput.checked = options.debug;

    let currentWinOnlyInput  = document.getElementById("only-curr-window-check");
    currentWinOnlyInput.checked = options.currentWinOnly;
    
    let earlyBreakInput = document.getElementById("test-check");
    earlyBreakInput.checked = options.earlyBreak;
    
    let dryRunInput = document.getElementById("dry-run-check");
    dryRunInput.checked = options.dryRun;
    
    let pageLoadTimeInput = document.getElementById("page-load-time");
    pageLoadTimeInput.value = options.pageLoadTime;

    await setDataToLocal("options", options);

    await setupEventListeners();
}

async function ensureOptions() {
    if (options == null)
    {   
        options = await getDataFromLocal("options", DEFAULT_OPTIONS);
        options = options.data;
    }
}

async function onDebugChanged() {
    let debugInput = document.getElementById("debug-check");
    let val = debugInput.checked;
    await ensureOptions();
    options.debug = val;
    setDataToLocal("options", options);
}

async function onOnlyCurrWindowChanged() {
    let debugInput = document.getElementById("only-curr-window-check");
    let val = debugInput.checked;
    await ensureOptions();
    options.currentWinOnly = val;
    setDataToLocal("options", options);
}

async function onEarlyBreakChanged() {
    let earlyBreakInput = document.getElementById("test-check");
    let val = earlyBreakInput.checked;
    await ensureOptions();
    options.earlyBreak = val;
    setDataToLocal("options", options);
}

async function onDryRunChanged() {
    let dryRunInput = document.getElementById("dry-run-check");
    let val = dryRunInput.checked;
    await ensureOptions();
    options.dryRun = val;
    setDataToLocal("options", options);
}

async function onPageLoadTimeApplyBtnClicked() {
    let pageLoadTimeApplyBtn = document.getElementById("page-load-time");
    let val = parseInt(pageLoadTimeApplyBtn.value, 10);
    await ensureOptions();
    options.pageLoadTime = val;
    setDataToLocal("options", options);
}

async function setupEventListeners() {
    let debugInput = document.getElementById("debug-check");
    debugInput.addEventListener('change', onDebugChanged);
    let onlyCurrWindowInput = document.getElementById("only-curr-window-check");
    onlyCurrWindowInput.addEventListener('change', onOnlyCurrWindowChanged);
    let earlyBreakInput = document.getElementById("test-check");
    earlyBreakInput.addEventListener('change', onEarlyBreakChanged);
    let dryRunInput = document.getElementById("dry-run-check");
    dryRunInput.addEventListener('change', onDryRunChanged);
    let pageLoadTimeApplyBtn = document.getElementById("page-load-time-apply");
    pageLoadTimeApplyBtn.addEventListener('click', onPageLoadTimeApplyBtnClicked);
}

async function setVisited() {
    await setDataToLocal("hasVisitedOptions", true);
}

addEventListener("DOMContentLoaded", async () => {
    await setVisited();
    await addDownloadLink();
    await setup();
    await showLog();
});
