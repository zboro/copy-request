(function() {
    var saveMocksBtn = document.getElementById('saveMocksBtn');
    var filter = document.getElementById('filter');

    saveMocksBtn.addEventListener('click', () => {
        chrome.devtools.network.getHAR(saveMocks);
    });

    function saveMocks(har) {
        const zip = new JSZip();
        const now = new Date();
        const name = prompt('Mock name') || `mocks-${now.toISOString().replace(/[.:-]/g, '')}`;
        const mocksFolderName = 'mocks';

        const rootFolder = zip.folder(name);
        const mocksFolder = rootFolder.folder(mocksFolderName);

        let indexFile = getIndexFileHeader();

        var requests = har.entries;
        var urlFilter = filter.value;
        const mockFilePromises = requests.filter((request) => {
            const matchesFilter = !urlFilter || request.request.url.match(urlFilter);
            return matchesFilter && isSupportedMethod(request) &&  isJson(request);
        }).map((request, index) => {
            indexFile += `    cy.route('${request.request.method}', '${getUrl(request)}', 'fixture:${name}/${mocksFolderName}/${index}.json');\n`;
            return saveResponseBody(request, index, mocksFolder);
        });

        indexFile += getIndexFileFooter();
        rootFolder.file('index.js', indexFile);

        Promise.all(mockFilePromises)
        .then(() => {
            return zip.generateAsync({
                type: 'string'
            })
        })
        .then((content) => {
            chrome.downloads.download({
                url: 'data:application/zip;base64,' + btoa(content),
                filename: `${name}.zip`
            });
        });
    }

    function isJson(request) {
        const contentTypeHeader = request.response.headers.find(header => header.name.toLowerCase() === 'content-type');
        if (!contentTypeHeader) {
            return false;
        }
        return contentTypeHeader.value.includes('application/json') || contentTypeHeader.value.endsWith('+json');
    }

    function isSupportedMethod(request) {
        return ['GET', 'PUT', 'POST', 'DEL', 'PATCH'].includes(request.request.method);
    }

    function saveResponseBody(request, index, mockFolder) {
        return new Promise((resolve) => {
            request.getContent(function(content) {
                mockFolder.file(`${index}.json`, content);
                resolve();
            });
        });
    }

    function getIndexFileHeader() {
        return `export function startMocks(options = {}) {\n    cy.server(options);\n`;
    }

    function getIndexFileFooter() {
        return '}';
    }

    function getUrl(request) {
        return request.request.url.replace(/https:\/\/.*?\//, '**/');
    }
})();
