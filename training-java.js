// crypto-jsライブラリをCDNから読み込む
const script = document.createElement('script');
script.src = "https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.0.0/crypto-js.min.js";
document.head.appendChild(script);

var rowIndex = "";

async function fetchData(hash) {
    const url = 'https://urlshorter.kintonesendback.workers.dev/retrieve';

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ hash: hash })
    });

    if (!response.ok) {
        console.error('Error fetching data:', response.status, response.statusText);
        return null;
    }

    const data = await response.json();
    return data;
}

// ─────────────────────────────────────────────
// Transportation field visibility controller
// field-id values – adjust if your kintone app uses different IDs
// ─────────────────────────────────────────────
const TRANSPORT_FIELD_IDS = {
    transportation : '交通手段',          // Transportation (radio/dropdown)
    vehicleName    : '車種名',            // vehicle name / 車種名
    oneWayDistance : '片道距離',          // One-way distance / 片道距離
    fee            : '料金',             // Fee / 料金
    shinkansen     : '新幹線_総務手配',    // Shinkansen arranged by General Affairs / 新幹線（総務手配）
};

// Business trip request field IDs
const BUSINESS_TRIP_FIELD_IDS = {
    businessTripFlag  : '出張手当有無',    // nothing/無 or yes/有
    domesticRate      : '国内出張単価',    // Domestic business trip rates
    numberOfDays      : '日数',           // Number of days
    magnification     : '倍率',           // magnification
    tripAllowance     : '出張手当',       // Business trip allowance
};

/**
 * Show or hide a field element (and its label row if present).
 * Works for both top-level fields and subtable cell fields.
 * @param {string} fieldId  – the field-id attribute value
 * @param {boolean} visible – true = show, false = hide
 * @param {string} scopeSelector – optional CSS prefix (e.g. inside a subtable row)
 */
function setFieldVisibility(fieldId, visible, scopeSelector) {
    const prefix = scopeSelector || '';
    // Match both .bst-field and .bst-table wrappers
    const selectors = [
        `${prefix}.bst-field[field-id="${fieldId}"]`,
        `${prefix}.bst-table[field-id="${fieldId}"]`,
    ];
    selectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
            el.style.display = visible ? '' : 'none';
            // Also hide/show the associated label if it sits in a sibling .bst-label
            const labelSel = `${prefix}.bst-label[field-id="${fieldId}"]`;
            document.querySelectorAll(labelSel).forEach(lbl => {
                lbl.style.display = visible ? '' : 'none';
            });
            // Disable/enable inputs so hidden values are not submitted
            el.querySelectorAll('input, select, textarea').forEach(inp => {
                inp.disabled = !visible;
            });
        });
    });
}

/**
 * Apply Transportation conditional rules.
 * @param {string} selectedValue – the currently selected transportation option
 * @param {string} scopeSelector – optional subtable row scope prefix
 */
function applyTransportationRules(selectedValue, scopeSelector) {
    // Normalise: collapse all whitespace so spacing differences never matter.
    const v = (selectedValue || '').replace(/\s+/g, '');
    const IDs = TRANSPORT_FIELD_IDS;

    // Default: hide all dependent fields first
    setFieldVisibility(IDs.vehicleName,    false, scopeSelector);
    setFieldVisibility(IDs.oneWayDistance, false, scopeSelector);
    setFieldVisibility(IDs.fee,            false, scopeSelector);
    setFieldVisibility(IDs.shinkansen,     false, scopeSelector);

    // Match on the unambiguous Japanese keyword contained in every label
    // variant (Japanese-only, English-only, or bilingual "english/日本語").
    // NOTE: 新幹線 must be checked BEFORE the generic fee-only options so the
    // bullet-train rule wins, and 社用自動車 / 自家用車 are distinct substrings.

    // Rule 1: company car / 社用自動車  -> vehicle name only
    if (v.includes('社用自動車') || v.includes('社用') || /companycar/i.test(v)) {
        setFieldVisibility(IDs.vehicleName, true, scopeSelector);
    }
    // Rule 2: private car / 自家用車  -> vehicle name + one-way distance
    else if (v.includes('自家用車') || v.includes('自家用') || /privatecar/i.test(v)) {
        setFieldVisibility(IDs.vehicleName,    true, scopeSelector);
        setFieldVisibility(IDs.oneWayDistance, true, scopeSelector);
    }
    // Rule 5: bullet train / 新幹線  -> fee + shinkansen (checked early on purpose)
    else if (v.includes('新幹線') || /bullettrain/i.test(v)) {
        setFieldVisibility(IDs.fee,        true, scopeSelector);
        setFieldVisibility(IDs.shinkansen, true, scopeSelector);
    }
    // Rule 3: Bus / バス  -> fee only
    else if (v.includes('バス') || /\bbus\b/i.test(v) || /bus/i.test(v)) {
        setFieldVisibility(IDs.fee, true, scopeSelector);
    }
    // Rule 4: train / 電車  -> fee only
    else if (v.includes('電車') || /train/i.test(v)) {
        setFieldVisibility(IDs.fee, true, scopeSelector);
    }
    // Rule 6: others / その他  -> fee only
    else if (v.includes('その他') || /others?/i.test(v)) {
        setFieldVisibility(IDs.fee, true, scopeSelector);
    }
}

/**
 * Apply Business trip request conditional rules.
 * @param {string} selectedValue – 無 / 有 (or English equivalents)
 */
function applyBusinessTripRules(selectedValue) {
    const v = (selectedValue || '').replace(/\s+/g, '');
    const IDs = BUSINESS_TRIP_FIELD_IDS;
    // "有" (yes) shows the fields; "無" (nothing), empty, or anything else hides.
    // Check 無 first so a stray 有 substring can't override an explicit 無.
    let hasTrip;
    if (v.includes('無') || /^no(ne|thing)?$/i.test(v)) {
        hasTrip = false;
    } else if (v.includes('有') || /yes/i.test(v)) {
        hasTrip = true;
    } else {
        hasTrip = false; // default: hidden when nothing is selected
    }

    setFieldVisibility(IDs.domesticRate,  hasTrip);
    setFieldVisibility(IDs.numberOfDays,  hasTrip);
    setFieldVisibility(IDs.magnification, hasTrip);
    setFieldVisibility(IDs.tripAllowance, hasTrip);
}

/**
 * Read the current value from a radio/checkbox/dropdown .bst-field element.
 */
function getFieldValue(fieldId, scopeSelector) {
    const prefix = scopeSelector || '';
    const el = document.querySelector(`${prefix}.bst-field[field-id="${fieldId}"]`);
    if (!el) return '';

    // Radio / Checkbox: value stored in .bst-guide span
    const guide = el.querySelector('.bst-guide');
    if (guide) return guide.textContent.trim();

    // Select / Input
    const sel = el.querySelector('select');
    if (sel) return sel.value;
    const inp = el.querySelector('input');
    if (inp) return inp.value;

    return '';
}

/**
 * Attach change listeners to a Transportation field (works for radio, checkbox, select).
 */
function attachTransportationListener(fieldId, scopeSelector) {
    const prefix = scopeSelector || '';
    const wrapper = document.querySelector(`${prefix}.bst-field[field-id="${fieldId}"]`);
    if (!wrapper) return;
    if (wrapper.dataset.condBound === '1') return; // avoid double-binding
    wrapper.dataset.condBound = '1';

    // Re-read the *current* value after the framework has updated the DOM.
    const recompute = () => setTimeout(() => {
        applyTransportationRules(getFieldValue(fieldId, scopeSelector), scopeSelector);
    }, 0);

    // Cover radio/checkbox, dropdowns, and the bst-injector guide span clicks.
    wrapper.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(inp => {
        inp.addEventListener('change', () => {
            // Prefer the changed input's own value, fall back to a re-read.
            if (inp.checked && inp.value) {
                applyTransportationRules(inp.value, scopeSelector);
            } else {
                recompute();
            }
        });
    });
    wrapper.querySelectorAll('select').forEach(sel => {
        sel.addEventListener('change', () => applyTransportationRules(sel.value, scopeSelector));
    });
    // Safety net for custom radio/checkbox widgets that update on click.
    wrapper.addEventListener('click', recompute);
}

/**
 * Attach change listeners to the Business trip flag field.
 */
function attachBusinessTripListener(fieldId) {
    const wrapper = document.querySelector(`.bst-field[field-id="${fieldId}"]`);
    if (!wrapper) return;
    if (wrapper.dataset.condBound === '1') return; // avoid double-binding
    wrapper.dataset.condBound = '1';

    const recompute = () => setTimeout(() => {
        applyBusinessTripRules(getFieldValue(fieldId));
    }, 0);

    wrapper.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(inp => {
        inp.addEventListener('change', () => {
            if (inp.checked && inp.value) {
                applyBusinessTripRules(inp.value);
            } else {
                recompute();
            }
        });
    });
    wrapper.querySelectorAll('select').forEach(sel => {
        sel.addEventListener('change', () => applyBusinessTripRules(sel.value));
    });
    wrapper.addEventListener('click', recompute);
}

/**
 * Run all conditional rules based on current field values (called after data load).
 */
function applyAllConditionalRules() {
    // Transportation (top-level)
    const transportVal = getFieldValue(TRANSPORT_FIELD_IDS.transportation);
    applyTransportationRules(transportVal);
    attachTransportationListener(TRANSPORT_FIELD_IDS.transportation);

    // Business trip
    const tripVal = getFieldValue(BUSINESS_TRIP_FIELD_IDS.businessTripFlag);
    applyBusinessTripRules(tripVal);
    attachBusinessTripListener(BUSINESS_TRIP_FIELD_IDS.businessTripFlag);

    // If Transportation lives inside a subtable, handle each row
    document.querySelectorAll(`tr.bst-scope`).forEach(row => {
        const rowIdx = row.getAttribute('row-idx');
        const scopeSel = `tr.bst-scope[row-idx="${rowIdx}"] `;
        const rowTransportVal = getFieldValue(TRANSPORT_FIELD_IDS.transportation, scopeSel);
        if (rowTransportVal !== '') {
            applyTransportationRules(rowTransportVal, scopeSel);
            attachTransportationListener(TRANSPORT_FIELD_IDS.transportation, scopeSel);
        }
    });
}

// ─────────────────────────────────────────────
// Original helper functions (unchanged)
// ─────────────────────────────────────────────
function extractType(field, key, idx) {
    var query;
    var value;
    var inputtype = 0;
    switch (field[key]["type"]) {
        case 'SINGLE_LINE_TEXT':
            query = `${idx}.bst-field[field-id="${key}"] input`;
            value = field[key]["value"];
            inputtype = 1;
            break;
        case 'RADIO_BUTTON':
            query = `${idx}.bst-field[field-id="${key}"]`;
            value = field[key]["value"];
            inputtype = 2;
            break;
        case 'CHECK_BOX':
            query = `${idx}.bst-field[field-id="${key}"]`;
            value = field[key]["value"];
            if (value) {
                inputtype = 2;
            } else {
                inputtype = 0;
            }
            break;
        case 'DROP_DOWN':
            query = `${idx}.bst-field[field-id="${key}"] select`;
            value = field[key]["value"];
            inputtype = 1;
            break;
        case 'NUMBER':
            query = `${idx}.bst-field[field-id="${key}"] input`;
            value = field[key]["value"];
            inputtype = 1;
            break;
        case 'DATE':
            query = `${idx}.bst-field[field-id="${key}"] input`;
            value = field[key]["value"];
            inputtype = 1;
            break;
        case 'TIME':
            query = `${idx}.bst-field[field-id="${key}"]`;
            value = field[key]["value"];
            inputtype = 3;
            break;
        case 'MULTI_LINE_TEXT':
            query = `${idx}.bst-field[field-id="${key}"] textarea`;
            value = field[key]["value"];
            inputtype = 1;
            break;
        case 'RICH_TEXT':
            query = `${idx}.bst-field[field-id="${key}"] textarea`;
            value = field[key]["value"];
            inputtype = 1;
            break;
        case 'SUBTABLE':
            for (let i = 0; i < field[key]["value"].length; i++) {
                if (i > 0) {
                    var table = document.querySelector(`${idx}table.bst-table[field-id="${key}"]`);
                    var child = document.querySelector(`${idx}table.bst-table[field-id="${key}"] tbody tr`);
                    table.insertRow(child);
                    rowIndex = `tr.bst-scope[row-idx="${i}"] `;
                }
                Object.keys(field[key]["value"][i]).forEach(function (subkey) {
                    if (field[key]["value"][i][subkey]["type"] != 'NONE') {
                        extractType(field[key]["value"][i], subkey, rowIndex);
                    }
                });
            }
            rowIndex = "";
            return;
        default:
            break;
    }
    if (query) {
        switch (inputtype) {
            case 1:
                var inputField = document.querySelector(query);
                inputField.value = value;
                break;
            case 2:
                var inputchecks = document.querySelectorAll(query + " input");
                inputchecks.forEach(element => {
                    element.checked = false;
                });
                var inputcheck = document.querySelector(query + " input[value='" + value + "']");
                var inputField = document.querySelector(query + " .bst-guide");
                inputField.textContent = value;
                inputcheck.checked = true;
                break;
            case 3:
                var inputhour = document.querySelector(query + " .bst-hour select");
                var inputminute = document.querySelector(query + " .bst-minute select");
                inputhour.value = value.split(":")[0];
                inputminute.value = value.split(":")[1];
                break;
            default:
                break;
        }
    }
}

function getItemdata(item, key) {
    var type = item.getAttribute('class');
    switch (type) {
        case 'bst-field':
            const ischeckbox = item.querySelector('.bst-checkbox');
            const isradio = item.querySelector('.bst-radio');
            const istime = item.querySelector('.bst-hour');
            if (ischeckbox) {
                var span = item.querySelector('.bst-checkbox .bst-guide');
                var data = { id: key, type: type, value: span.textContent };
                return data;
            }
            if (isradio) {
                var span = item.querySelector('.bst-radio .bst-guide');
                var data = { id: key, type: type, value: span.textContent };
                return data;
            }
            if (istime) {
                var inputhour = item.querySelector('.bst-hour select');
                var inputminute = item.querySelector('.bst-minute select');
                var data = { id: key, type: type, value: inputhour.value + ":" + inputminute.value };
                return data;
            }
            var query = `input, select, textarea`;
            var inputField = item.querySelector(query);
            var data = { id: key, type: type, value: inputField.value };
            return data;
        case 'bst-table':
            var tr = item.querySelectorAll('tr');
            var subarray = [];
            tr.forEach(element => {
                var query = `.bst-field, .bst-table`;
                var inputFields = element.querySelectorAll(query);
                var subdata = {};
                inputFields.forEach(input => {
                    var id = input.getAttribute('field-id');
                    subdata[id] = getItemdata(input, id);
                });
                subarray.push(subdata);
            });
            var data = { id: key, type: type, value: subarray };
            return data;
        default:
            return data;
    }
}

function setItemdata(item, key) {
    var type = item.type;
    var value = item.value;
    switch (type) {
        case 'bst-field':
            var query = `${rowIndex}.bst-field[field-id="${key}"] input, ` +
                        `${rowIndex}.bst-field[field-id="${key}"] select, ` +
                        `${rowIndex}.bst-field[field-id="${key}"] textarea`;
            var ischeckbox = document.querySelector(`${rowIndex}.bst-field[field-id="${key}"] .bst-checkbox`);
            var isradio    = document.querySelector(`${rowIndex}.bst-field[field-id="${key}"] .bst-radio`);
            var istime     = document.querySelector(`${rowIndex}.bst-field[field-id="${key}"] .bst-hour`);
            if (ischeckbox && value) {
                var inputcheckboxs = document.querySelectorAll(`${rowIndex}.bst-field[field-id="${key}"] input`);
                inputcheckboxs.forEach(element => { element.checked = false; });
                var inputcheck = document.querySelector(`${rowIndex}.bst-field[field-id="${key}"] input[value="${value}"]`);
                var inputField = document.querySelector(`${rowIndex}.bst-field[field-id="${key}"] .bst-guide`);
                inputField.textContent = value;
                inputcheck.checked = true;
            } else if (isradio && value) {
                var inputradios = document.querySelectorAll(`${rowIndex}.bst-field[field-id="${key}"] input`);
                inputradios.forEach(element => { element.checked = false; });
                var inputradio = document.querySelector(`${rowIndex}.bst-field[field-id="${key}"] input[value="${value}"]`);
                var inputField = document.querySelector(`${rowIndex}.bst-field[field-id="${key}"] .bst-guide`);
                inputField.textContent = value;
                inputradio.checked = true;
            } else if (istime) {
                var inputhour   = document.querySelector(`${rowIndex}.bst-field[field-id="${key}"] .bst-hour select`);
                var inputminute = document.querySelector(`${rowIndex}.bst-field[field-id="${key}"] .bst-minute select`);
                inputhour.value   = value.split(":")[0];
                inputminute.value = value.split(":")[1];
            } else {
                var inputField = document.querySelector(query);
                inputField.value = value;
            }
            break;
        case 'bst-table':
            for (let i = 0; i < value.length; i++) {
                if (i > 0) {
                    var table = document.querySelector(`.bst-table[field-id="${key}"]`);
                    var child = document.querySelector(`.bst-table[field-id="${key}"] tbody tr`);
                    table.insertRow(child);
                    rowIndex = `tr.bst-scope[row-idx="${i}"] `;
                }
                Object.keys(value[i]).forEach(function (subkey) {
                    if (value[i][subkey]["type"] != 'NONE') {
                        setItemdata(value[i][subkey], subkey);
                    }
                });
            }
            rowIndex = "";
            break;
        default:
            break;
    }
    return;
}

var data_loaded = false;

window.addEventListener('load', function () {

    var pageKey = window.location.href;

    const parentNode = document.body;
    const config = { childList: true, subtree: true };

    const callback = function (mutationsList, observer) {
        for (let mutation of mutationsList) {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 3) {
                        console.log(node);
                        if (data_loaded) { return; }
                        runAdditionalProcess();
                        observer.disconnect();
                        return;
                    }
                });
            }
        }
    };

    const observer = new MutationObserver(callback);
    observer.observe(parentNode, config);

    function runAdditionalProcess() {
        data_loaded = true;

        var params = new URLSearchParams(window.location.search);
        const paramText = params.get('data');

        if (params.size) {
            fetchData(paramText)
                .then(data => {
                    if (data) {
                        const password = 'og-ogsas';
                        try {
                            const decryptedData = decrypt(data, password);
                            const jsonparam = JSON.parse(decryptedData);
                            Object.keys(jsonparam).forEach(function (key) {
                                if (jsonparam[key]["type"] != 'NONE') {
                                    extractType(jsonparam, key, "");
                                }
                            });
                        } catch (error) {
                            console.error(error.message);
                        }
                    } else {
                        console.log('No data found for the given hash.');
                    }
                })
                // ↓ Apply rules AFTER remote data has been populated
                .then(() => applyAllConditionalRules());
        }

        if (!params.size) {
            var savedData = localStorage.getItem(pageKey.split('?')[0]);
            if (savedData) {
                var data = JSON.parse(savedData);
                Object.keys(data.fields).forEach(function (key) {
                    setItemdata(data.fields[key], key);
                });
            }
            // Apply rules after local data (or blank form) is ready
            applyAllConditionalRules();
        }

        // ── Save button ──────────────────────────────────────────
        var saveButton = document.createElement('button');
        saveButton.id = 'saveButton';
        saveButton.textContent = '保存';
        saveButton.style.backgroundColor = 'lime';
        saveButton.style.marginLeft = '10px';
        saveButton.style.verticalAlign = 'text-bottom';

        // ── Clear button ─────────────────────────────────────────
        var clearButton = document.createElement('button');
        clearButton.id = 'clearButton';
        clearButton.textContent = 'クリア';
        clearButton.style.backgroundColor = 'red';
        clearButton.style.marginLeft = '10px';
        clearButton.style.verticalAlign = 'text-bottom';

        var title = document.querySelectorAll('.bst-injector-header-title');
        if (title[0]) {
            title[0].appendChild(saveButton);
            title[0].appendChild(clearButton);
        }

        var buttons = document.querySelectorAll('.bst-injector-button');
        buttons.forEach(function (button) {
            button.addEventListener('click', function () {
                localStorage.removeItem(pageKey.split('?')[0]);
            });
        });

        saveButton.addEventListener('click', function () {
            var confirmSave = confirm('共有のデバイス（職場のパソコンなど）では保存したデータが第三者に見られる危険があります。それでも保存しますか？');
            if (confirmSave) {
                var inputFields = document.querySelectorAll('.bst-injector-body > .bst-field:not(.bst-unuse), .bst-injector-body > .bst-table:not(.bst-unuse)');
                var fielddata = {};
                inputFields.forEach(element => {
                    var id = element.getAttribute('field-id');
                    fielddata[id] = getItemdata(element, id);
                });
                var data = {
                    url: pageKey.split('?')[0],
                    fields: fielddata
                };
                localStorage.setItem(pageKey.split('?')[0], JSON.stringify(data));

                var mainElement = document.querySelector('.bst-injector-body');
                if (mainElement) { mainElement.removeAttribute('unsaved'); }
                alert('データが保存されました');
            } else {
                alert('保存がキャンセルされました');
            }
        });

        clearButton.addEventListener('click', function () {
            var confirmClear = confirm('現在のページの保存データをクリアしますか？');
            if (confirmClear) {
                localStorage.removeItem(pageKey);
                alert('保存データがクリアされました');
                window.location.reload();
            } else {
                alert('クリアがキャンセルされました');
            }
        });
    }

    // ── Decrypt helper ───────────────────────────────────────────
    function decrypt(encryptedText, password) {
        const parts = encryptedText.split(':');
        const iv = CryptoJS.enc.Hex.parse(parts[0]);
        const ciphertext = CryptoJS.enc.Hex.parse(parts[1]);
        const key = CryptoJS.SHA256(password);
        const decrypted = CryptoJS.AES.decrypt(
            { ciphertext: ciphertext },
            key,
            { iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
        );
        return decrypted.toString(CryptoJS.enc.Utf8);
    }
});