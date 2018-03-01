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
        const mockFolder = zip.folder(name)

        let indexFile = getIndexFileHeader();

        var requests = har.entries;
        var urlFilter = filter.value;
        const mockFilePromises = requests.filter((request) => {
            const matchesFilter = !urlFilter || request.request.url.match(urlFilter);
            return matchesFilter && request.request.method === 'GET' &&  isJson(request);
        }).map((request, index) => {
            indexFile += `cy.route("${getUrl(request)}", "fixture:${name}/${index}.json");\n`;
            return saveResponseBody(request, index, mockFolder);
        });

        indexFile += getIndexFileFooter();
        mockFolder.file('index.js', indexFile);

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

    function saveResponseBody(request, index, mockFolder) {
        return new Promise((resolve) => {
            request.getContent(function(content) {
                mockFolder.file(`${index}.json`, content);
                resolve();
            });
        });
    }

    function getIndexFileHeader() {
        return `export function startMocks() {
            cy.server();
        `;
    }

    function getIndexFileFooter() {
        return '}';
    }

    function getUrl(request) {
        return request.request.url.replace(/https:\/\/.*?\//, '**/');
    }
})();
