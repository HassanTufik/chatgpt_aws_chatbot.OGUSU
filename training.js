// crypto-jsライブラリをCDNから読み込む
const script = document.createElement('script');
script.src = "https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.0.0/crypto-js.min.js";
document.head.appendChild(script);

var rowIndex = "";

async function fetchData(hash) {
    const url = 'https://urlshorter.kintonesendback.workers.dev/retrieve'; // Cloudflare WorkerのURL

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ hash: hash }) // ハッシュ値をJSON形式で送信
    });

    if (!response.ok) {
        // レスポンスがエラーの場合
        console.error('Error fetching data:', response.status, response.statusText);
        return null;
    }

    const data = await response.json(); // レスポンスデータをJSON形式で取得
    return data; // 取得したデータを返す
}

// ══════════════════════════════════════════════════════════════════════
//  条件付き表示ロジック (Conditional field visibility)  v3 — exact match
//  ・対象は「フィールドコード(field-id)」または「キャプション完全一致」で特定
//  ・前方一致をやめ、交通機関手当経理用 / 出張手当経理用 等の誤検出を防止
// ══════════════════════════════════════════════════════════════════════
console.log('[webformassist] conditional rules v3 loaded');

// 全角括弧→半角、空白除去で正規化
function normalizeText(s) {
    if (!s) return '';
    return s.replace(/[（）]/g, function (m) { return m === '（' ? '(' : ')'; })
            .replace(/\s+/g, '')
            .trim();
}

// 各対象フィールドの定義。fieldId が分かるものはそれを最優先で使用。
var FIELDS = {
    transportation : { caption: '交通機関' },             // ドロップダウン(サブテーブル内)
    vehicleName    : { caption: '車種名' },
    oneWayDistance : { caption: '片道距離' },
    fee            : { caption: '料金' },
    shinkansen     : { caption: '新幹線（総務手配）' },     // チェックボックス
    businessTrip   : { caption: '出張申請' },             // チェックボックス 無/有
    domesticRate   : { fieldId: '国内出張単価_0', caption: '国内出張単価' },
    numberOfDays   : { fieldId: '出張日数',       caption: '日数' },
    magnification  : { fieldId: '倍率',           caption: '倍率' },
    tripAllowance  : { fieldId: '出張手当',       caption: '出張手当' }
};

// ラッパーの直属キャプション文字列を取得（入れ子フィールドの誤取得を防ぐ）
function getCaptionText(wrapper) {
    var cap = wrapper.querySelector('.bst-field-caption, .bst-table-caption, .bst-label');
    if (!cap) return '';
    var owner = cap.closest('.bst-field, .bst-table');
    if (owner && owner !== wrapper) return '';
    return cap.textContent;
}

// 対象フィールド要素を取得（field-id 完全一致 → キャプション完全一致）
function findField(def, root) {
    var scope = root || document;
    if (def.fieldId) {
        var byId = scope.querySelector('.bst-field[field-id="' + def.fieldId + '"], .bst-table[field-id="' + def.fieldId + '"]');
        if (byId) return byId;
    }
    if (def.caption) {
        var target = normalizeText(def.caption);
        var wrappers = scope.querySelectorAll('.bst-field, .bst-table');
        for (var i = 0; i < wrappers.length; i++) {
            if (normalizeText(getCaptionText(wrappers[i])) === target) return wrappers[i];
        }
    }
    return null;
}

// 表示/非表示の切り替え。非表示時は入力を無効化し送信させない。
// bst-unuse（レイアウト未配置）フィールドも表示できるようにクラスを外す。
function setFieldVisible(def, visible, root) {
    var el = findField(def, root);
    if (!el) return;
    if (visible) {
        el.classList.remove('bst-cond-hidden');
        el.classList.remove('bst-unuse');
        el.style.removeProperty('display');
    } else {
        el.classList.add('bst-cond-hidden');
        el.style.setProperty('display', 'none', 'important');
    }
    el.querySelectorAll('input, select, textarea').forEach(function (inp) {
        inp.disabled = !visible;
    });
}

// 交通機関の現在値を取得
function getTransportValue(root) {
    var el = findField(FIELDS.transportation, root);
    if (!el) return '';
    var sel = el.querySelector('select');
    if (sel && sel.value) return sel.value;
    var guide = el.querySelector('.bst-guide');
    if (guide && guide.textContent.trim()) return guide.textContent;
    var input = el.querySelector('input');
    return input ? input.value : '';
}

// 交通機関の条件を1スコープ(行)に適用
function applyTransportRules(root) {
    var v = normalizeText(getTransportValue(root));

    setFieldVisible(FIELDS.vehicleName,    false, root);
    setFieldVisible(FIELDS.oneWayDistance, false, root);
    setFieldVisible(FIELDS.fee,            false, root);
    setFieldVisible(FIELDS.shinkansen,     false, root);

    if (v === '社用自動車') {
        setFieldVisible(FIELDS.vehicleName, true, root);                 // 1
    } else if (v === '自家用車') {
        setFieldVisible(FIELDS.vehicleName, true, root);                 // 2
        setFieldVisible(FIELDS.oneWayDistance, true, root);
    } else if (v === '新幹線') {
        setFieldVisible(FIELDS.fee, true, root);                         // 5
        setFieldVisible(FIELDS.shinkansen, true, root);
    } else if (v === 'バス') {
        setFieldVisible(FIELDS.fee, true, root);                         // 3
    } else if (v === '電車') {
        setFieldVisible(FIELDS.fee, true, root);                         // 4
    } else if (v === 'その他') {
        setFieldVisible(FIELDS.fee, true, root);                         // 6
    }
}

// 出張申請(無/有)の値を取得
function getBusinessTripValue() {
    var el = findField(FIELDS.businessTrip);
    if (!el) return '';
    var guide = el.querySelector('.bst-guide');
    if (guide && guide.textContent.trim()) return guide.textContent;
    var checked = el.querySelector('input:checked');
    return checked ? (checked.value || '') : '';
}

// 出張申請の条件：有→表示 / 無・未選択→非表示
function applyBusinessTripRules() {
    var v = normalizeText(getBusinessTripValue());
    var show = (v.indexOf('有') !== -1) && (v.indexOf('無') === -1);
    setFieldVisible(FIELDS.domesticRate,  show);
    setFieldVisible(FIELDS.numberOfDays,  show);
    setFieldVisible(FIELDS.magnification, show);
    setFieldVisible(FIELDS.tripAllowance, show);
}

// 新幹線（総務手配）チェックボックスを1つだけ選択可能にする
function enforceSingleSelectShinkansen(root) {
    var el = findField(FIELDS.shinkansen, root);
    if (!el) return;
    var inputs = el.querySelectorAll('input[type="checkbox"], input');
    inputs.forEach(function (inp) {
        if (inp.dataset.ssBound === '1') return;
        inp.dataset.ssBound = '1';
        inp.addEventListener('change', function () {
            if (inp.checked) {
                inputs.forEach(function (other) { if (other !== inp) other.checked = false; });
                var g = el.querySelector('.bst-guide');
                if (g) g.textContent = inp.value;
            }
        });
    });
    var checkedList = el.querySelectorAll('input:checked');
    if (checkedList.length > 1) {
        for (var i = 1; i < checkedList.length; i++) checkedList[i].checked = false;
        var g2 = el.querySelector('.bst-guide');
        if (g2) g2.textContent = checkedList[0].value;
    }
}

// すべての条件を再評価
function applyAllConditions() {
    var target = normalizeText(FIELDS.transportation.caption);
    var handledRows = [];
    document.querySelectorAll('.bst-field').forEach(function (f) {
        if (normalizeText(getCaptionText(f)) !== target) return;   // 完全一致のみ
        var row = f.closest('tr.bst-scope') || document;
        if (handledRows.indexOf(row) !== -1) return;
        handledRows.push(row);
        var scope = (row === document) ? document : row;
        applyTransportRules(scope);
        enforceSingleSelectShinkansen(scope);
    });
    applyBusinessTripRules();
}

// 変更イベントを結び付ける（二重登録防止）
function bindConditionListeners() {
    var tCap = normalizeText(FIELDS.transportation.caption);
    var bCap = normalizeText(FIELDS.businessTrip.caption);
    var sCap = normalizeText(FIELDS.shinkansen.caption);
    document.querySelectorAll('.bst-field').forEach(function (f) {
        var cap = normalizeText(getCaptionText(f));
        if (cap !== tCap && cap !== bCap && cap !== sCap) return;
        if (f.dataset.condBound === '1') return;
        f.dataset.condBound = '1';
        var recompute = function () { setTimeout(applyAllConditions, 0); };
        f.querySelectorAll('select').forEach(function (s) { s.addEventListener('change', recompute); });
        f.querySelectorAll('input').forEach(function (inp) { inp.addEventListener('change', recompute); });
        f.addEventListener('click', recompute);
    });
}

// 初期化：リスナー登録＋評価。行追加にも追従。
function initConditions() {
    bindConditionListeners();
    applyAllConditions();
    var body = document.querySelector('.bst-injector-body') || document.body;
    var mo = new MutationObserver(function () {
        bindConditionListeners();
        applyAllConditions();
    });
    mo.observe(body, { childList: true, subtree: true });
}

// 自己完結ブートストラップ：交通機関フィールドが現れるまでポーリングし、
// 既存の読み込み処理に依存せず確実に初期化する。
(function bootstrapConditions() {
    var tries = 0;
    var timer = setInterval(function () {
        tries++;
        var hasTransport = false;
        var target = normalizeText(FIELDS.transportation.caption);
        var fields = document.querySelectorAll('.bst-field');
        for (var i = 0; i < fields.length; i++) {
            if (normalizeText(getCaptionText(fields[i])) === target) { hasTransport = true; break; }
        }
        if (hasTransport) {
            clearInterval(timer);
            initConditions();
        } else if (tries > 40) { // 約20秒で諦める
            clearInterval(timer);
        }
    }, 500);
})();


function extractType(field,key,idx) {
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
            }
            else{
                inputtype = 0;
            }
            break;
        case 'DROP_DOWN':
            query = `${idx}.bst-field[field-id="${key}"] select`;
            value = field[key]["value"];
            inputtype = 1;
            break;
        // case 'USER_SELECT':
        //     query = `.bst-field[field-id="${key}"] input`;
        //     value = field[key]["value"];
        //     break;
        case 'NUMBER':
            query = `${idx}.bst-field[field-id="${key}"] input`;
            value = field[key]["value"];
            inputtype = 1;
            break;
        // case 'ORGANIZATION_SELECT':
        //     query = `.bst-field[field-id="${key}"] input`;
        //     value = field[key]["value"];
        //     inputtype = 1;
        //     break;
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
                // 項目が複数ある場合は行を追加
                if (i > 0) {
                    var table = document.querySelector(`${idx}table.bst-table[field-id="${key}"]`);
                    var child = document.querySelector(`${idx}table.bst-table[field-id="${key}"] tbody tr`);
                    table.insertRow(child);
                    rowIndex = `tr.bst-scope[row-idx="${i}"] `;
                }
                Object.keys(field[key]["value"][i]).forEach(function(subkey) {
                    if (field[key]["value"][i][subkey]["type"] != 'NONE'){
                        extractType(field[key]["value"][i],subkey,rowIndex);
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
                // var inputcheck = document.querySelector(query + " input[value='" + value + "']");
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

function getItemdata(item,key){
    var type = item.getAttribute('class');
    switch (type) {
        case 'bst-field':
            // var query = `.bst-field[field-id="${key}"] input, ` +
            //             `.bst-field[field-id="${key}"] select, ` + 
            //             `.bst-field[field-id="${key}"] textarea`;
            const ischeckbox = item.querySelector('.bst-checkbox');
            const isradio = item.querySelector('.bst-radio');
            const istime = item.querySelector('.bst-hour');
            if (ischeckbox) {
                var span = item.querySelector('.bst-checkbox .bst-guide');
                var data = {
                    id : key,
                    type : type,
                    value : span.textContent
                }
                return data;
            }
            if (isradio) {
                var span = item.querySelector('.bst-radio .bst-guide');
                var data = {
                    id : key,
                    type : type,
                    value : span.textContent
                }
                return data;
            }
            if (istime) {
                var inputhour = item.querySelector('.bst-hour select');
                var inputminute = item.querySelector('.bst-minute select');
                var data = {
                    id : key,
                    type : type,
                    value : inputhour.value + ":" + inputminute.value
                }
                return data;
            }
            var query = `input, select, textarea`;
            var inputField = item.querySelector(query);
            var data = {
                id : key,
                type : type,
                value : inputField.value
            }
            return data;
        case 'bst-table':
            var tr = item.querySelectorAll('tr');
            // var query = `.bst-table[field-id="${key}"] > tbody > tr > input, ` + 
            //             `.bst-table[field-id="${key}"] > tbody > tr  > select, ` + 
            //             `.bst-table[field-id="${key}"] > tbody > tr  > textarea, ` + 
            //             `.bst-table[field-id="${key}"] > tbody > tr  > table`;
            var subarray = [];
            tr.forEach(element => {
                var query = `.bst-field, .bst-table`;
                var inputFields = element.querySelectorAll(query);
                var subdata = {};
                inputFields.forEach(input => {
                    var id = input.getAttribute('field-id');
                    subdata[id] = getItemdata(input,id);
                });
                subarray.push(subdata);    
            });
            var data = {
                id : key,
                type : type,
                value : subarray
            }
            return data;    
        default:
            return data;
    }
}

function setItemdata(item,key){
    var type = item.type;
    var value = item.value;
    switch (type) {
        case 'bst-field':
            var query = `${rowIndex}.bst-field[field-id="${key}"] input, ` +
                        `${rowIndex}.bst-field[field-id="${key}"] select, ` + 
                        `${rowIndex}.bst-field[field-id="${key}"] textarea`;
            var ischeckbox = document.querySelector(`${rowIndex}.bst-field[field-id="${key}"] .bst-checkbox`);
            var isradio = document.querySelector(`${rowIndex}.bst-field[field-id="${key}"] .bst-radio`);
            var istime = document.querySelector(`${rowIndex}.bst-field[field-id="${key}"] .bst-hour`);
            if (ischeckbox && value) {
                var inputcheckboxs = document.querySelectorAll(`${rowIndex}.bst-field[field-id="${key}"] input`);
                inputcheckboxs.forEach(element => {
                    element.checked = false;
                });
                var inputcheck = document.querySelector(`${rowIndex}.bst-field[field-id="${key}"] input[value="${value}"]`);
                var inputField = document.querySelector(`${rowIndex}.bst-field[field-id="${key}"] .bst-guide`);
                inputField.textContent = value;
                inputcheck.checked = true;
            }
            else if (isradio && value) {
                var inputradios = document.querySelectorAll(`${rowIndex}.bst-field[field-id="${key}"] input`);
                inputradios.forEach(element => {
                    element.checked = false;
                });
                var inputradio = document.querySelector(`${rowIndex}.bst-field[field-id="${key}"] input[value="${value}"]`);
                var inputField = document.querySelector(`${rowIndex}.bst-field[field-id="${key}"] .bst-guide`);
                inputField.textContent = value;
                inputradio.checked = true;
            }
            else if (istime) {
                var inputhour = document.querySelector(`${rowIndex}.bst-field[field-id="${key}"] .bst-hour select`);
                var inputminute = document.querySelector(`${rowIndex}.bst-field[field-id="${key}"] .bst-minute select`);
                inputhour.value = value.split(":")[0];
                inputminute.value = value.split(":")[1];
            }
            else{
                var inputField = document.querySelector(query);
                inputField.value = value;
            }
            break;
        case 'bst-table':
            for (let i = 0; i < value.length; i++) {
                // 項目が複数ある場合は行を追加
                if (i > 0) {
                    var table = document.querySelector(`.bst-table[field-id="${key}"]`);
                    var child = document.querySelector(`.bst-table[field-id="${key}"] tbody tr`);
                    table.insertRow(child);
                    rowIndex = `tr.bst-scope[row-idx="${i}"] `;
                }
                Object.keys(value[i]).forEach(function(subkey) {
                    if (value[i][subkey]["type"] != 'NONE'){
                        setItemdata(value[i][subkey],subkey);
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

    // 現在のページのURLを取得（キーとして使用）
    var pageKey = window.location.href;


    // 監視対象の親要素を取得します
    const parentNode = document.body;  // 親要素が見つからない場合、全体のボディを監視

    // オプション設定
    const config = { childList: true, subtree: true };

    // コールバック関数
    const callback = function(mutationsList, observer) {
        for (let mutation of mutationsList) {
            if (mutation.type === 'childList') {
                // 追加された要素が指定したクラスを持つかどうかを確認
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 3)  {
                        console.log(node);
                        if (data_loaded) {
                            return;
                        }
                        runAdditionalProcess();
                        observer.disconnect(); // 監視を停止
                        return;
                    }
                });
            }
        }
    };

    // オブザーバーインスタンスを生成
    const observer = new MutationObserver(callback);

    // 監視を開始
    observer.observe(parentNode, config);

    // フォーム構築完了後に実行したい処理
    function runAdditionalProcess() {
        data_loaded = true;
        // 付与されたパラメータを取得
        var params = new URLSearchParams(window.location.search);
        const paramText = params.get('data');
        if(params.size){
            fetchData(paramText)
                .then(data => {
                    if (data) {
                        const password = 'og-ogsas';
                        try {
                            const decryptedData = decrypt(data, password);
                            const jsonparam = JSON.parse(decryptedData);
                            Object.keys(jsonparam).forEach(function(key) {
                                if (jsonparam[key]["type"] != 'NONE'){
                                    extractType(jsonparam,key,"");
                                }
                            });
                        } catch (error) {
                            console.error(error.message);
                        }
                    } else {
                        console.log('No data found for the given hash.');
                    }
                })
                ;
        }
        if(!params.size){
            // 前回保存されたデータをlocalStorageから読み込む
            var savedData = localStorage.getItem(pageKey.split('?')[0]);
            if (savedData) {
                var data = JSON.parse(savedData);
                Object.keys(data.fields).forEach(function(key) {
                    setItemdata(data.fields[key],key);
                });
            }
        }

        // 保存ボタンを作成
        var saveButton = document.createElement('button');
        saveButton.id = 'saveButton';
        saveButton.textContent = '保存';
        saveButton.style.backgroundColor = 'lime'; // ボタンの色を緑に設定
        saveButton.style.marginLeft = '10px'; // 左側にスペースを追加
        saveButton.style.verticalAlign = 'text-bottom';

        // クリアボタンを作成
        var clearButton = document.createElement('button');
        clearButton.id = 'clearButton';
        clearButton.textContent = 'クリア';
        clearButton.style.backgroundColor = 'red'; // ボタンの色を赤に設定
        clearButton.style.marginLeft = '10px'; // 左側にスペースを追加
        clearButton.style.verticalAlign = 'text-bottom';

        var title = document.querySelectorAll('.bst-injector-header-title');
        if (title[0]) {
            title[0].appendChild(saveButton);
            title[0].appendChild(clearButton);
        }

        // bst-injector-buttonクラスを持つすべての要素を取得
        var buttons = document.querySelectorAll('.bst-injector-button');

        // 各ボタンにクリックイベントを追加
        buttons.forEach(function (button) {
            button.addEventListener('click', function () {
                localStorage.removeItem(pageKey.split('?')[0]);
            });
        });

        // 保存ボタンがクリックされたときの処理を追加
        saveButton.addEventListener('click', function () {
            // 警告を表示してユーザーに確認
            var confirmSave = confirm('共有のデバイス（職場のパソコンなど）では保存したデータが第三者に見られる危険があります。それでも保存しますか？');
            if (confirmSave) {
                // IDに'input'を含むすべてのinputタグを取得
                // var inputFields = document.querySelectorAll('input, select, textarea');`.bst-field:not(.bst-unuse), .bst-table(.bst-unuse)`
                var inputFields = document.querySelectorAll('.bst-injector-body > .bst-field:not(.bst-unuse), .bst-injector-body > .bst-table:not(.bst-unuse)');
                var fielddata = {};
                // 取得した要素をログに表示
                inputFields.forEach(element => {
                    var id = element.getAttribute('field-id');
                    fielddata[id] = getItemdata(element,id);                    
                });
                var data = {
                    url: pageKey.split('?')[0], // 保存時に現在のページのURLを含む
                    fields: fielddata // 入力データを保存
                };

                // データをlocalStorageに保存
                localStorage.setItem(pageKey.split('?')[0], JSON.stringify(data));

                // classが'test'のmain要素を取得
                var mainElement = document.querySelector('.bst-injector-body');

                if (mainElement) {
                    // 'unsaved'属性を削除
                    mainElement.removeAttribute('unsaved');
                }
                alert('データが保存されました');
            } else {
                alert('保存がキャンセルされました');
            }
        });

        // クリアボタンがクリックされたときの処理を追加
        clearButton.addEventListener('click', function () {
            var confirmClear = confirm('現在のページの保存データをクリアしますか？');
            if (confirmClear) {
                localStorage.removeItem(pageKey);
                alert('保存データがクリアされました');
                window.location.reload(); // ページをリロードして入力フィールドを初期化
            } else {
                alert('クリアがキャンセルされました');
            }
        });
    
    }

    // 復号化関数
    function decrypt(encryptedText, password) {
        const parts = encryptedText.split(':'); // IVと暗号文を分割
        const iv = CryptoJS.enc.Hex.parse(parts[0]); // IVをHexからWordArrayに変換
        const ciphertext = CryptoJS.enc.Hex.parse(parts[1]); // 暗号文をHexからWordArrayに変換

        const key = CryptoJS.SHA256(password); // パスワードからキーを生成

        const decrypted = CryptoJS.AES.decrypt(
            { ciphertext: ciphertext },
            key,
            {
                iv: iv,
                mode: CryptoJS.mode.CBC,
                padding: CryptoJS.pad.Pkcs7
            }
        );

        return decrypted.toString(CryptoJS.enc.Utf8); // UTF-8形式で復号化されたテキストを返す
    }
});
