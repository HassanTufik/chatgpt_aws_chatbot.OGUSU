// Load crypto-js library from CDN
const script = document.createElement('script');
script.src = "https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.0.0/crypto-js.min.js";
document.head.appendChild(script);

var rowIndex = "";

async function fetchData(hash) {
    const url = 'https://bs61lgzu4g.execute-api.us-east-1.amazonaws.com/prod/sendback'; 

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ hash: hash }) // Send hash value in JSON format
    });

    if (!response.ok) {
        // If response is an error
        console.error('Error fetching data:', response.status, response.statusText);
        return null;
    }

    const data = await response.json(); // Get response data in JSON format
    const jsondata = JSON.parse(data.body);
    return jsondata.data; // Return the retrieved data
}

function extractType(field,key,idx) {
    var query;
    var value;
    var inputtype = 0;
    switch (field[key]["type"]) {
        case 'SINGLE_LINE_TEXT':
            query = `${idx}.kb-field[field-id="${key}"] input`;
            value = field[key]["value"];
            inputtype = 1;
            break;
        case 'RADIO_BUTTON':
            query = `${idx}.kb-field[field-id="${key}"]`;
            value = field[key]["value"];
            inputtype = 2;
            break;
        case 'CHECK_BOX':
            query = `${idx}.kb-field[field-id="${key}"]`;
            value = field[key]["value"];
            if (value) {
                inputtype = 2;
            }
            else{
                inputtype = 0;
            }
            break;
        case 'DROP_DOWN':
            query = `${idx}.kb-field[field-id="${key}"] select`;
            value = field[key]["value"];
            inputtype = 1;
            break;
        // case 'USER_SELECT':
        //     query = `.kb-field[field-id="${key}"] input`;
        //     value = field[key]["value"];
        //     break;
        case 'NUMBER':
            query = `${idx}.kb-field[field-id="${key}"] input`;
            value = field[key]["value"];
            inputtype = 1;
            break;
        // case 'ORGANIZATION_SELECT':
        //     query = `.kb-field[field-id="${key}"] input`;
        //     value = field[key]["value"];
        //     inputtype = 1;
        //     break;
        case 'DATE':
            query = `${idx}.kb-field[field-id="${key}"] input`;
            value = field[key]["value"];
            inputtype = 1;
            break;
        case 'TIME':
            query = `${idx}.kb-field[field-id="${key}"]`;
            value = field[key]["value"];
            inputtype = 3;
            break;
        case 'MULTI_LINE_TEXT':
            query = `${idx}.kb-field[field-id="${key}"] textarea`;
            value = field[key]["value"];
            inputtype = 1;
            break;
        case 'RICH_TEXT':
            query = `${idx}.kb-field[field-id="${key}"] textarea`;
            value = field[key]["value"];
            inputtype = 1;
            break;
        case 'SUBTABLE':
            for (let i = 0; i < field[key]["value"].length; i++) {
                // Add a row if there are multiple items
                if (i > 0) {
                    var table = document.querySelector(`${idx}table.kb-table[field-id="${key}"]`);
                    var child = document.querySelector(`${idx}table.kb-table[field-id="${key}"] tbody tr`);
                    table.insertRow(child);
                    rowIndex = `tr.kb-scope[row-idx="${i}"] `;
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
                var inputField = document.querySelector(query + " .kb-guide");
                inputField.textContent = value;
                inputcheck.checked = true;
            break;
            case 3:
                var inputhour = document.querySelector(query + " .kb-hour select");
                var inputminute = document.querySelector(query + " .kb-minute select");
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
        case 'kb-field':
            // var query = `.kb-field[field-id="${key}"] input, ` +
            //             `.kb-field[field-id="${key}"] select, ` + 
            //             `.kb-field[field-id="${key}"] textarea`;
            const ischeckbox = item.querySelector('.kb-checkbox');
            const isradio = item.querySelector('.kb-radio');
            const istime = item.querySelector('.kb-hour');
            if (ischeckbox) {
                var span = item.querySelector('.kb-checkbox .kb-guide');
                var data = {
                    id : key,
                    type : type,
                    value : span.textContent
                }
                return data;
            }
            if (isradio) {
                var span = item.querySelector('.kb-radio .kb-guide');
                var data = {
                    id : key,
                    type : type,
                    value : span.textContent
                }
                return data;
            }
            if (istime) {
                var inputhour = item.querySelector('.kb-hour select');
                var inputminute = item.querySelector('.kb-minute select');
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
        case 'kb-table':
            var tr = item.querySelectorAll('tr');
            // var query = `.kb-table[field-id="${key}"] > tbody > tr > input, ` + 
            //             `.kb-table[field-id="${key}"] > tbody > tr  > select, ` + 
            //             `.kb-table[field-id="${key}"] > tbody > tr  > textarea, ` + 
            //             `.kb-table[field-id="${key}"] > tbody > tr  > table`;
            var subarray = [];
            tr.forEach(element => {
                var query = `.kb-field, .kb-table`;
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
        case 'kb-field':
            var query = `${rowIndex}.kb-field[field-id="${key}"] input, ` +
                        `${rowIndex}.kb-field[field-id="${key}"] select, ` + 
                        `${rowIndex}.kb-field[field-id="${key}"] textarea`;
            var ischeckbox = document.querySelector(`${rowIndex}.kb-field[field-id="${key}"] .kb-checkbox`);
            var isradio = document.querySelector(`${rowIndex}.kb-field[field-id="${key}"] .kb-radio`);
            var istime = document.querySelector(`${rowIndex}.kb-field[field-id="${key}"] .kb-hour`);
            if (ischeckbox && value) {
                var inputcheckboxs = document.querySelectorAll(`${rowIndex}.kb-field[field-id="${key}"] input`);
                inputcheckboxs.forEach(element => {
                    element.checked = false;
                });
                var inputcheck = document.querySelector(`${rowIndex}.kb-field[field-id="${key}"] input[value=${value}]`);
                var inputField = document.querySelector(`${rowIndex}.kb-field[field-id="${key}"] .kb-guide`);
                inputField.textContent = value;
                inputcheck.checked = true;
            }
            else if (isradio && value) {
                var inputradios = document.querySelectorAll(`${rowIndex}.kb-field[field-id="${key}"] input`);
                inputradios.forEach(element => {
                    element.checked = false;
                });
                var inputradio = document.querySelector(`${rowIndex}.kb-field[field-id="${key}"] input[value=${value}]`);
                var inputField = document.querySelector(`${rowIndex}.kb-field[field-id="${key}"] .kb-guide`);
                inputField.textContent = value;
                inputradio.checked = true;
            }
            else if (istime) {
                var inputhour = document.querySelector(`${rowIndex}.kb-field[field-id="${key}"] .kb-hour select`);
                var inputminute = document.querySelector(`${rowIndex}.kb-field[field-id="${key}"] .kb-minute select`);
                inputhour.value = value.split(":")[0];
                inputminute.value = value.split(":")[1];
            }
            else{
                var inputField = document.querySelector(query);
                inputField.value = value;
            }
            break;
        case 'kb-table':
            for (let i = 0; i < value.length; i++) {
                // Add a row if there are multiple items
                if (i > 0) {
                    var table = document.querySelector(`.kb-table[field-id="${key}"]`);
                    var child = document.querySelector(`.kb-table[field-id="${key}"] tbody tr`);
                    table.insertRow(child);
                    rowIndex = `tr.kb-scope[row-idx="${i}"] `;
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

    // Get the URL of the current page (used as a key)
    var pageKey = window.location.href;


    // Get the parent element to observe
    const parentNode = document.body;  // If the parent element is not found, monitor the entire body

    // Option settings
    const config = { childList: true, subtree: true };

    // Callback function
    const callback = function(mutationsList, observer) {
        for (let mutation of mutationsList) {
            if (mutation.type === 'childList') {
                // Check if the added elements have the specified class
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 3)  {
                        if (data_loaded) {
                            return;
                        }
                        runAdditionalProcess();
                        observer.disconnect(); // Stop checking
                        return;
                    }
                });
            }
        }
    };

    // Create an observer instance
    const observer = new MutationObserver(callback);

    // Start checking
    observer.observe(parentNode, config);

    // Processes to execute after form construction is complete
    function runAdditionalProcess() {
        data_loaded = true;
        // Get the added parameters
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
                });
        }
        if(!params.size){
            // Load previously saved data from localStorage
            var savedData = localStorage.getItem(pageKey.split('?')[0]);
            if (savedData) {
                var data = JSON.parse(savedData);
                Object.keys(data.fields).forEach(function(key) {
                    setItemdata(data.fields[key],key);
                });
            }
        
        }

        // Create the save button
        // Setup change listeners for specific reference fields to dynamically hide/show
        setTimeout(() => {
            const transField = document.querySelector('.kb-field[field-id="Transportation"]');
            if (transField) transField.addEventListener('change', updateVisibility);
            
            const tripField = document.querySelector('.kb-field[field-id="Business_trip_request"]');
            if (tripField) tripField.addEventListener('change', updateVisibility);
            
            // Fallback listen to entire form for change events 
            const injectorBody = document.querySelector('.kb-injector-body');
            if (injectorBody) injectorBody.addEventListener('change', updateVisibility);
            
            // Initial check
            updateVisibility();
        }, 500);

        var saveButton = document.createElement('button');
        saveButton.id = 'saveButton';
        saveButton.textContent = 'Save';
        saveButton.style.backgroundColor = 'lime'; // Set the button's background color to green
        saveButton.style.marginLeft = '10px'; // Add space on the left side
        saveButton.style.verticalAlign = 'text-bottom';

        // Create a clear button
        var clearButton = document.createElement('button');
        clearButton.id = 'clearButton';
        clearButton.textContent = 'Clear';
        clearButton.style.backgroundColor = 'red'; // Set the button's background color to red
        clearButton.style.marginLeft = '10px'; // Add space on the left side
        clearButton.style.verticalAlign = 'text-bottom';

        var title = document.querySelectorAll('.kb-injector-header-title');
        if (title[0]) {
            title[0].appendChild(saveButton);
            title[0].appendChild(clearButton);
        }

        // Get all elements with the 'kb-injector-button' class
        var buttons = document.querySelectorAll('.kb-injector-button');

        // Add a click event to each button
        buttons.forEach(function (button) {
            button.addEventListener('click', function () {
                localStorage.removeItem(pageKey.split('?')[0]);
            });
        });

        // Add process for when the save button is clicked
        saveButton.addEventListener('click', function () {
            // Show a warning and ask for user confirmation
            var confirmSave = confirm('Saving data on a shared device (like a workplace computer) poses a risk of third parties retrieving your data. Do you still want to save?');
            if (confirmSave) {
                // Get all the input tags with 'input' in the ID
                // var inputFields = document.querySelectorAll('input, select, textarea');`.kb-field:not(.kb-unuse), .kb-table(.kb-unuse)`
                var inputFields = document.querySelectorAll('.kb-injector-body > .kb-field:not(.kb-unuse), .kb-injector-body > .kb-table:not(.kb-unuse)');
                var fielddata = {};
                // Display the retrieved elements in a log
                inputFields.forEach(element => {
                    var id = element.getAttribute('field-id');
                    fielddata[id] = getItemdata(element,id);                    
                });
                var data = {
                    url: pageKey.split('?')[0], // Include current page URL when saving
                    fields: fielddata // Save input data
                };

                // Save data to localStorage
                localStorage.setItem(pageKey.split('?')[0], JSON.stringify(data));

                // Get the main element with the 'test' class
                var mainElement = document.querySelector('.kb-injector-body');

                if (mainElement) {
                    // Remove the 'unsaved' attribute
                    mainElement.removeAttribute('unsaved');
                }
                alert('Data has been stored');
            } else {
                alert('Save was cancelled');
            }
        });

        // Add process for when the clear button is clicked
        clearButton.addEventListener('click', function () {
            var confirmClear = confirm('Are you sure you want to clear the saved data on this page?');
            if (confirmClear) {
                localStorage.removeItem(pageKey);
                alert('Saved data has been cleared');
                window.location.reload(); // Reload the page to initialize input fields
            } else {
                alert('Clear was cancelled');
            }
        });
    
    }

    // -- Visibility Logic for Transportation & Business Trip Request --
    function updateVisibility() {
        const FIELD_TRANSPORTATION = 'Transportation';
        const FIELD_VEHICLE_NAME = 'Vehicle_name';     
        const FIELD_DISTANCE = 'One_way_distance';      
        const FIELD_FEE = 'Fee';                        
        const FIELD_SHINKANSEN_GA = 'Shinkansen_arranged_by_General_Affairs';

        const FIELD_TRIP_REQUEST = 'Business_trip_request'; 
        const FIELD_RATES = 'Domestic_business_trip_rates';  
        const FIELD_DAYS = 'Number_of_days';                 
        const FIELD_MAGNIFICATION = 'Magnification';         
        const FIELD_ALLOWANCE = 'Business_trip_allowance'; 

        function getFieldValue(fieldId) {
            const fieldEl = document.querySelector(`.kb-field[field-id="${fieldId}"]`);
            if (!fieldEl) return '';
            
            const checkedRadio = fieldEl.querySelector('input[type="radio"]:checked');
            if (checkedRadio) {
                return checkedRadio.value || (checkedRadio.nextElementSibling ? checkedRadio.nextElementSibling.textContent : '');
            }
            
            const selectEl = fieldEl.querySelector('select');
            if (selectEl) return selectEl.value;
            
            const inputEl = fieldEl.querySelector('input');
            if (inputEl) return inputEl.value;
            
            return '';
        }

        function setFieldVisible(fieldId, isVisible) {
            const fieldEl = document.querySelector(`.kb-field[field-id="${fieldId}"]`);
            if (fieldEl) {
                fieldEl.style.display = isVisible ? '' : 'none';
            }
        }

        const transVal = getFieldValue(FIELD_TRANSPORTATION).toLowerCase();
        let showVehicleName = false;
        let showDistance = false;
        let showFee = false;
        let showShinkansenGA = false;

        if (transVal.includes('company car') || transVal.includes('ç¤¾ç”¨è‡ªå‹•è»Š') || transVal.includes('社用自動車')) {
            showVehicleName = true;
        } else if (transVal.includes('private car') || transVal.includes('è‡ªå®¶ç”¨è»Š') || transVal.includes('自家用車')) {
            showVehicleName = true;
            showDistance = true;
        } else if (transVal.includes('bullet train') || transVal.includes('æ–°å¹¹ç·š') || transVal.includes('新幹線')) {
            showFee = true;
            showShinkansenGA = true;
        } else if (transVal.includes('train') || transVal.includes('é›»è»Š') || transVal.includes('電車')) {
            showFee = true;
        } else if (transVal.includes('bus') || transVal.includes('ãƒ ã‚¹') || transVal.includes('バス')) {
            showFee = true;
        } else if (transVal.includes('others') || transVal.includes('ã  ã ®ä»–') || transVal.includes('その他')) {
            showFee = true;
        }

        setFieldVisible(FIELD_VEHICLE_NAME, showVehicleName);
        setFieldVisible(FIELD_DISTANCE, showDistance);
        setFieldVisible(FIELD_FEE, showFee);
        setFieldVisible(FIELD_SHINKANSEN_GA, showShinkansenGA);

        const tripVal = getFieldValue(FIELD_TRIP_REQUEST).toLowerCase();
        let showTripFields = false;

        if (tripVal.includes('yes') || tripVal.includes('æœ‰') || tripVal.includes('有')) {
            showTripFields = true;
        }

        setFieldVisible(FIELD_RATES, showTripFields);
        setFieldVisible(FIELD_DAYS, showTripFields);
        setFieldVisible(FIELD_MAGNIFICATION, showTripFields);
        setFieldVisible(FIELD_ALLOWANCE, showTripFields);
    }

    // Decrypting function
    function decrypt(encryptedText, password) {
        const parts = encryptedText.split(':'); // Split IV and cipher text
        const iv = CryptoJS.enc.Hex.parse(parts[0]); // Convert IV from Hex to WordArray
        const ciphertext = CryptoJS.enc.Hex.parse(parts[1]); // Convert cipher text from Hex to WordArray

        const key = CryptoJS.SHA256(password); // Generate a key from the password

        const decrypted = CryptoJS.AES.decrypt(
            { ciphertext: ciphertext },
            key,
            {
                iv: iv,
                mode: CryptoJS.mode.CBC,
                padding: CryptoJS.pad.Pkcs7
            }
        );

        return decrypted.toString(CryptoJS.enc.Utf8); // Returns string in UTF-8 format
    }
});