function requestList() {
    const showListBtn = document.getElementById('showRequestsBtn');
    const requestListBody = document.getElementById('requestListBody');
    const filter = document.getElementById('filter');
    const errorsOnly = document.getElementById('errorsOnly');

    const listeners = [];
    let previousRequest = null;

    showListBtn.addEventListener('click', reload);
    errorsOnly.addEventListener('click', () => {
        chrome.storage.local.set({
            errorsOnly: errorsOnly.checked,
        });
        reload();
    });

    filter.addEventListener('change', () => {
        chrome.storage.local.set({
            filter: filter.value,
        });
        reload();
    });

    loadSettings();
    reload();
    setInterval(reload, 1000);

    function loadSettings() {
        chrome.storage.local.get([
            'filter',
            'errorsOnly',
        ], (settings) => {
            filter.value = settings.filter || '';
            errorsOnly.checked = !!settings.errorsOnly;
        });
    }

    function reload() {
        chrome.devtools.network.getHAR(displayRequests);
    }

    function displayRequests(har) {
        const requests = har.entries;
        clearTable();
        const urlFilter = filter.value;
        const errorFilter = errorsOnly.checked;
        requests.forEach((request) => {
            if (
                (errorFilter && request.response.status < 400)
                || (urlFilter && !request.request.url.match(urlFilter))
            ) {
                return;
            }
            drawRow(request);
        });
    }

    function clearTable() {
        requestListBody.innerHTML = '';
        listeners.forEach((item) => {
            item.button.removeEventListener('click', item.listener);
        });
        listeners.splice(0);
    }

    function drawRow(request) {
        const row = document.createElement('tr');
        const copyNode = document.createElement('td');
        const copyBtn = createCopyBtn(request);
        copyNode.appendChild(copyBtn);
        const statusNode = document.createElement('td');
        statusNode.innerHTML = request.response.status;
        if (request.response.status >= 400) {
            statusNode.className = 'error';
        }
        const methodNode = document.createElement('td');
        methodNode.innerHTML = request.request.method;
        const urlNode = document.createElement('td');
        urlNode.innerHTML = request.request.url;

        row.appendChild(copyNode);
        row.appendChild(statusNode);
        row.appendChild(methodNode);
        row.appendChild(urlNode);
        requestListBody.appendChild(row);
    }

    function createCopyBtn(request) {
        const copyBtn = document.createElement('button');
        copyBtn.title = 'Copy';
        copyBtn.className = 'copyBtn';
        const listener = copyRequest.bind(null, request);
        copyBtn.addEventListener('click', listener);
        listeners.push({
            button: copyBtn,
            listener,
        });
        return copyBtn;
    }

    function copyRequest(request, evt) {
        formatRequest(request, (stringToCopy) => {
            const text = evt.ctrlKey ? [previousRequest, stringToCopy].join('\n\n\n') : stringToCopy;
            previousRequest = text;
            copyToClipboard(text);
        });
    }

    function formatRequest(entry, callback) {
        const requestHeaders = formatRequestHeaders(entry.request);
        const requestBody = formatRequestBody(entry.request);
        const responseHeaders = formatResponseHeaders(entry.response);
        formatResponseBody(entry, (responseBody) => {
            callback([
                requestHeaders,
                requestBody,
                responseHeaders,
                responseBody,
            ].join('\n\n'));
        });
    }

    function formatRequestHeaders(request) {
        return [
            `${request.method} ${request.url}`,
        ].concat(formatHeaders(request.headers)).join('\n');
    }

    function formatRequestBody(request) {
        if (!request.postData) {
            return '';
        }
        if (request.postData.mimeType === 'application/json') {
            try {
                return JSON.stringify(JSON.parse(request.postData.text), null, '\t');
            } catch (e) {
                return request.postData.text;
            }
        }
        return request.postData.text;
    }

    function formatResponseHeaders(response) {
        return [
            `${response.status} ${response.statusText}`,
        ].concat(formatHeaders(response.headers)).join('\n');
    }

    function formatResponseBody(request, callback) {
        request.getContent((content) => {
            callback(content);
        });
    }

    function formatHeaders(headers) {
        return headers.map(header => `${header.name}: ${header.value}`);
    }

    function copyToClipboard(text) {
        const textarea = document.createElement('textarea');

        // copy doesn't work when not placed in dom
        // or hidden with display none, so hide it off screen
        textarea.style.width = 0;
        textarea.style.height = 0;
        textarea.style.position = 'absolute';
        textarea.style.top = '-50px';
        document.body.appendChild(textarea);

        textarea.value = text;
        textarea.select();
        document.execCommand('copy');

        document.body.removeChild(textarea);
    }
}

requestList();
