/////////////////////////////// PREAMBLE ///////////////////////////////////////
/** @type {Options} */
let options = null;
/** @type {[string]} */
let LOG = [];

class CaughtError { }
const CAUGHT_ERROR = new CaughtError();
//////////////////////////// PREAMBLE END //////////////////////////////////////

// Extension button clicked
browser.browserAction.onClicked.addListener(mainExportSync);

function mainExportSync() {
    mainExport()
}

async function mainExport() {
    try {
        LOG = [];
        let res = await ensureOptionsPageVisited();
        if (res instanceof CaughtError) return;
        if (!res) return;

        // reset log
        await saveLog();
        res = await loadOptions();
        if (res instanceof CaughtError) return;
        if (res === false) {
            res = saveOptions();
            if (res instanceof CaughtError) return;
        }

        // loop through all tabs
        let allTabIds = await getAllTabIds();
        if (allTabIds instanceof CaughtError) return;
        logInfo(`Found ${allTabIds.length} tabs`);

        let data = [];
        for (const tabId of allTabIds) {
            //   open tab
            logInfo(`tabId: ${tabId}`)

            // dry run, do nothing
            if (options.dryRun) {
                logInfo(`[DRY_MOCK]: Making tabId: ${tabId} active`);
                logInfo(`[DRY_MOCK]: Going back in tabId(${tabId}) history`);
                logInfo(`[DRY_MOCK]: Going forward in tabId(${tabId}) history`);
                logInfo(`[DRY_MOCK]: Going back to tabId(${tabId})'s original page`);
                data.push([`DRY_TAB(${tabId})_URL_1`, `DRY_TAB(${tabId})_URL_2`, `DRY_TAB(${tabId})_URL_3`, `DRY_TAB(${tabId})_URL_4`]);
                continue;
            }

            res = await activateTab(tabId);
            if (res instanceof CaughtError) return;
            //   save history relative location
            //   go to beginning of history
            let wentBack = await goBackToFirst(tabId);
            if (wentBack instanceof CaughtError) return;
            //     save url
            //     advance history
            let wentForward = await goForwardToLast(tabId);
            if (wentForward instanceof CaughtError) return;
            const deltaTabHist = wentForward.delta + wentBack.delta;
            //   restore history location
            res = await restoreTabToPage(tabId, deltaTabHist);
            if (res instanceof CaughtError) return;
            data.push(wentForward.urls);

            if (options.earlyBreak) break;
        }
        logInfo("Done getting data");

        // save data to file
        res = await saveDataToFile(data);
        if (res instanceof CaughtError) return;

    } catch (e) {
        logErr(e);
        showNotification(NOTIFICATIONS.ERROR, `${DISPLAY_EXT_NAME} | ERROR`, "Something unexpected happened.");
    }
}

async function ensureOptionsPageVisited() {
    let visited = await getDataFromLocal("hasVisitedOptions", false);
    if (!visited.data) {
        showNotification(NOTIFICATIONS.ENSURE_OPTIONS_VISIT, `${DISPLAY_EXT_NAME}`, "Please visit the extension option page before starting the export process.")
    }
    return visited.data;
}

/**
 * @param {*} data
 * @returns {boolean | CaughtError}
 */
async function saveDataToFile(data) {
    try {
        logInfo("Saving tabs data")
        let spaces = options.prettyJson ? 4 : null;
        let jsonStr = JSON.stringify(data, null, spaces);
        await browser.storage.local.set({ "TAB_HIST_EXPORT_DATA": jsonStr });

        if (await isAndroid()) {
            showNotification(
                NOTIFICATIONS.ANDROID_DOWNLOAD,
                `${DISPLAY_EXT_NAME} | DONE`,
                "Cannot start automatic download of data on android. Please go to the options to access the download link.");
            // early return for android
            return true;
        }

        // cannot save data to file on android
        let blob = new Blob([jsonStr], { type: "application/json" });
        let url = URL.createObjectURL(blob);

        let fileName = "tabs_hist_export_" + getTimeString() + ".json";

        let downloadId = await browser.downloads.download({ url: url, filename: fileName });
        logInfo(`Started downloading: ${downloadId}`);
        return true;
    } catch (e) {
        logErr(e);
        showNotification(NOTIFICATIONS.ERROR, `${DISPLAY_EXT_NAME} | ERROR`, "Could not start download.");
        return CAUGHT_ERROR;
    }
}

/**
 * @param {tab.id} tabId 
 * @param {number} deltaBackwards 
 * @returns {id: tab.id | CaughtError} - delta is a number >= 0, 0 means there was no forward to go to
*/
async function restoreTabToPage(tabId, deltaBackwards) {
    try {
        logInfo(`Going back to tabId(${tabId})'s original page`);
        for (let i = 0; i < deltaBackwards; i++) {
            browser.tabs.goBack(tabId);
            await sleep(options.pageLoadTime);
        }

        return tabId;
    } catch (e) {
        logErr(e);
        showNotification(NOTIFICATIONS.ERROR, `${DISPLAY_EXT_NAME} | ERROR`, "Could not go back to tab's original page.");
        return CAUGHT_ERROR;
    }
}

/**
 * @param {tab.id} tabId 
 * @returns {{id: tab.id, delta: number, urls:[string]}| CaughtError} - delta is a number >= 0, 0 means there was no forward to go to
*/
async function goForwardToLast(tabId) {
    try {
        logInfo(`Going forward in tabId(${tabId}) history`);
        let delta = -1; // start at -1 because the loop does at least 1 iteration
        let tab = await browser.tabs.get(tabId);
        let url = tab.url;
        let prevUrl = null;

        let visited = [];

        while (url != prevUrl) {
            prevUrl = url;
            visited.push(prevUrl);
            await browser.tabs.goForward(tab.id);

            // this doesn't wait for the page to fully load, may need to add some content script to talk to
            await sleep(options.pageLoadTime);

            tab = await browser.tabs.get(tabId);
            while (tab.status != "complete") {
                // wait for tab to completely load
                await sleep(100)
                // assume that tab has not changed
            }
            url = tab.url;
            delta++;
        }

        return { id: tab.id, delta: delta, urls: visited };
    } catch (e) {
        logErr(e);
        showNotification(NOTIFICATIONS.ERROR, `${DISPLAY_EXT_NAME} | ERROR`, "Could not go forward in tab history.");
        return CAUGHT_ERROR;
    }
}

/**
 * @param {tab.id} tabId 
 * @returns {{id: tab.id, delta: number}| CaughtError} - delta is a number <= 0, 0 means there was no back to go to
*/
async function goBackToFirst(tabId) {
    try {
        logInfo(`Going back in tabId(${tabId}) history`);
        let delta = 1; // start at 1 because the loop does at least 1 iteration
        let tab = await browser.tabs.get(tabId);
        let url = tab.url;
        let prevUrl = null;

        while (url != prevUrl) {
            prevUrl = url;
            await browser.tabs.goBack(tab.id);

            // this doesn't wait for the page to fully load, may need to add some content script to talk to
            await sleep(options.pageLoadTime);

            tab = await browser.tabs.get(tabId);
            while (tab.status != "complete") {
                // wait for tab to completely load
                await sleep(100)
                // assume that tab has not changed
            }
            url = tab.url;
            delta--;
        }

        return { id: tab.id, delta: delta };
    } catch (e) {
        logErr(e);
        showNotification(NOTIFICATIONS.ERROR, `${DISPLAY_EXT_NAME} | ERROR`, "Could not go back in tab history.");
        return CAUGHT_ERROR;
    }
}

/**
 * @param {tab.id} tabId 
 * @returns {tab.id | CaughtError}
*/
async function activateTab(tabId) {
    try {
        logInfo(`Making tabId: ${tabId} active`);
        let tab = await browser.tabs.update(tabId, { active: true });
        if (tabId == tab.id)
        {
            logInfo("tabId has been preserved");
        }
        else
        {
            logWarn(`tabId has changed | original='${tabId}', new='${tab.id}'`);
        }
        logInfo(`tab.title: ${tab.title}`);

        while (tab.status != "complete") {
            // wait for tab to completely load
            await sleep(100)
            // assume that tab has not changed
        }
        return tab.id;
    } catch (e) {
        logErr(e);
        showNotification(NOTIFICATIONS.ERROR, `${DISPLAY_EXT_NAME} | ERROR`, "Could not activate tab.\n(Activating all tabs manually one by one could help this.)");
        return CAUGHT_ERROR;
    }
}

/**
 * @returns {[tab.id]| CaughtError}
 */
async function getAllTabIds() {
    try {
        const query = options.currentWinOnly ? { currentWindow: true } : {};
        let allTabs = await browser.tabs.query(query);
        return allTabs.map(tab => tab.id);
    } catch (e) {
        logErr(e);
        showNotification(NOTIFICATIONS.ERROR, `${DISPLAY_EXT_NAME} | ERROR`, "Could not get tabs.");
        return CAUGHT_ERROR;
    }
}

/**
 * @returns {boolean | CaughtError} - returns true if successfully saved some options object
 */
async function saveOptions() {
    try {
        await browser.storage.local.set({ "options": options });
        return true;
    } catch (e) {
        logErr(e);
        showNotification(NOTIFICATIONS.ERROR, `${DISPLAY_EXT_NAME} | ERROR`, "Could not save options.");
        return CAUGHT_ERROR;
    }
}

/**
 * @returns {boolean | CaughtError} - returns true if successfully loaded some options object
 */
async function loadOptions() {
    try {
        let data = await getDataFromLocal("options", DEFAULT_OPTIONS);
        options = data.data;
        return data.success;
    } catch (e) {
        logErr(e);
        showNotification(NOTIFICATIONS.ERROR, `${DISPLAY_EXT_NAME} | ERROR`, "Could not get options, using defaults.");
        return CAUGHT_ERROR;
    }
}

//////////////////////////////////////////////////////////////////
//                      UTILITY DATA
/////////////////////////////////////////////////////////////////

const DISPLAY_EXT_NAME = browser.runtime.getManifest()["name"];
const DBG_EXT_NAME = "TAB_HIST_EXP";

/**
 * @typedef {Object} Notification
 * @property {!string} id notification id - so it can be overwritten and cleared
 * @property {string} iconUrl the url to the icon to show in the notification
*/

/**
 * @constant
 * @type {Object.<string, Notification>} 
*/
const NOTIFICATIONS = {
    ERROR: {
        id: "ERROR_NOTIFICATION_ID",
        iconUrl: browser.runtime.getURL("icons/icon.png"),
    },
    ANDROID_DOWNLOAD: {
        id: "ANDROID_DOWNLOAD_NOTIFICATION",
        iconUrl: browser.runtime.getURL("icons/icon.png"),
    },
    ENSURE_OPTIONS_VISIT: {
        id: "ENSURE_OPTIONS_VISIT",
        iconUrl: browser.runtime.getURL("icons/icon.png"),
    }
};

//////////////////////////////////////////////////////////////////
//                      UTILITY FUNCTIONS
/////////////////////////////////////////////////////////////////

/**
 * @param {*} obj 
 * @returns {string}
 */
function getAsStr(obj) {
    if (typeof obj === 'string') return obj;
    if (!isNullOrUndefined(obj) &&
        !isNullOrUndefined(obj.stack) &&
        !isNullOrUndefined(obj.message) &&
        typeof obj.stack === 'string' &&
        typeof obj.message === 'string') {

        // this is an error message
        return `${obj.message}`;
    }
    return JSON.stringify(obj);
}

function saveLog() {
    browser.storage.local.set({ "logs": LOG });
}

/**
 * @param {number} ms
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * log info - diagnostics only
 * @param {any} data 
*/
function logInfo(data) {
    if (!options.debug) return;
    let logStr = `[INFO]: ${getAsStr(data)}`;
    LOG.push(logStr);
    saveLog();
    console.log(`[INFO][${DBG_EXT_NAME}]: `, data)
}

/**
 * log warnings - diagnostics only
 * @param {any} data 
*/
function logWarn(data) {
    if (!options.debug) return;
    let logStr = `[WARNING]: ${getAsStr(data)}`;
    LOG.push(logStr);
    saveLog();
    console.log(`[WARNING][${DBG_EXT_NAME}]: `, data)
}

/**
 * log errors - diagnostics only
 * @param {any} data 
*/
function logErr(data) {
    if (!options.debug) return;
    let logStr = `[ERROR]: ${getAsStr(data)}`;
    LOG.push(logStr);
    saveLog();
    console.log(`[ERROR][${DBG_EXT_NAME}]: `, data)
}

/**
 * Show notification to the user
 * @param {Notification} notification 
 * @param {string} title 
 * @param {string} msg 
*/
async function showNotification(notification, title, msg) {
    let notifObj = {
        type: "basic",
        title: title,
        message: msg
    };

    if (notification.iconUrl)
        notifObj.iconUrl = notification.iconUrl;

    await browser.notifications.create(notification.id, notifObj);
}

async function isAndroid() {
    let platformInfo = await browser.runtime.getPlatformInfo()
    logInfo(platformInfo)
    return platformInfo.os == 'android'
}
