//////////////////////////////////////////////////////////////////
//                           MISC
/////////////////////////////////////////////////////////////////

/**
 * Get time as "%d-%m-y_%h-%m-%s" string
 * @returns {string} 
 */
function getTimeString() {
    let res = '';
    let d = new Date();
    let formatDate = (arg) => (arg < 10) ? '0' + arg : arg;

    try {
        let date = formatDate(d.getDate());
        let month = formatDate(d.getMonth() + 1);
        let year = d.getFullYear();
        let hours = formatDate(d.getHours());
        let minutes = formatDate(d.getMinutes());
        let seconds = formatDate(d.getSeconds());
        res = "" + date + "-" + month + "-" + year + "_" + hours + "-" + minutes + "-" + seconds;
    }
    catch (e) {
        res = d.getTime();
    }

    return res;
}

function isNullOrUndefined(obj) {
    return obj === null || obj === undefined;
}

//////////////////////////////////////////////////////////////////
//                         OPTIONS
/////////////////////////////////////////////////////////////////

/**
 * @typedef {Object} Options
 * @property {boolean} debug
 * @property {boolean} prettyJson
 * @property {boolean} currentWinOnly
 * @property {boolean} earlyBreak
 * @property {boolean} dryRun
 * @property {number} pageLoadTime
*/

/**
 * @constant
 * @type {Options}
*/
const DEFAULT_OPTIONS = { debug: false, prettyJson: false, currentWinOnly: true, earlyBreak: false, pageLoadTime: 5000, dryRun: false }

//////////////////////////////////////////////////////////////////
//                         STORAGE
/////////////////////////////////////////////////////////////////

/**
 * @param {string} key - the key for the local store data
 * @param {*} defaultVal - what to return in the data key if no value was found in local storage
 * @returns {{success: bool, data: *}} success is true if the data was found and retrieved successfully, false otherwise
 */
async function getDataFromLocal(key, defaultVal) {
    let data = await browser.storage.local.get(key);
    if (!data) return { success: false, data: defaultVal };
    if (!data[key]) return { success: false, data: defaultVal };
    return { success: true, data: data[key] };
}

/**
 * @param {string} key key to put into the local storage 
 * @param {*} obj object to put into the local storage
 */
async function setDataToLocal(key, obj) {
    await browser.storage.local.set({ [key]: obj });
}
