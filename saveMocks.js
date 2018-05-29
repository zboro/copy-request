function saveMocks() {
    const saveMocksBtn = document.getElementById('saveMocksBtn');
    const filter = document.getElementById('filter');

    saveMocksBtn.addEventListener('click', () => {
        chrome.devtools.network.getHAR(onSaveMocksBtnClick);
    });

    function onSaveMocksBtnClick(har) {
        const zip = new JSZip();
        const now = new Date();
        const name = prompt('Mock name') || `mocks-${now.toISOString().replace(/[.:-]/g, '')}`;

        const mockFilePromises = saveMocksToFolder(har, filter.value, zip, name);

        Promise.all(mockFilePromises)
            .then(() => (
                zip.generateAsync({
                    type: 'string',
                })
            ))
            .then((content) => {
                chrome.downloads.download({
                    url: `data:application/zip;base64,${btoa(content)}`,
                    filename: `${name}.zip`,
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
            request.getContent((content) => {
                mockFolder.file(`${index}.json`, content);
                resolve();
            });
        });
    }

    function getIndexFileHeader() {
        return 'export function startMocks(options = {}) {\n    cy.server(options);\n';
    }

    function getIndexFileFooter() {
        return '}\n';
    }

    function getUrl(request) {
        return clearVariableQueryParams(request.request.url.replace(/https:\/\/.*?\//, '**/'));
    }

    function clearVariableQueryParams(url) {
        const variableParams = ['_', 'retinaResolution'];
        let clearedUrl = url;
        variableParams.forEach((param) => {
            clearedUrl = clearedUrl.replace(new RegExp(`${param}=\\w+`), `${param}=*`);
        });
        return clearedUrl;
    }

    function saveMocksToFolder(har, urlFilter, zip, name) {
        const rootFolder = zip.folder(name);
        const mocksFolderName = 'mocks';
        const mocksFolder = rootFolder.folder(mocksFolderName);

        let indexFile = getIndexFileHeader();

        const requests = har.entries;
        const mockFilePromises = requests.filter(shouldMockResponse(urlFilter))
            .map((request, index) => {
                indexFile += getCyRouteDefinition(request, name, mocksFolderName, index);
                return saveResponseBody(request, index, mocksFolder);
            });

        indexFile += getIndexFileFooter();
        rootFolder.file('index.js', indexFile);

        return mockFilePromises;
    }

    function shouldMockResponse(urlFilter) {
        return (request) => {
            const matchesFilter = !urlFilter || request.request.url.match(urlFilter);
            return matchesFilter && isSupportedMethod(request) && isJson(request);
        };
    }

    function getCyRouteDefinition(request, name, mocksFolderName, index) {
        return `    cy.route('${request.request.method}', '${getUrl(request)}', 'fixture:${name}/${mocksFolderName}/${index}.json');\n`;
    }
}

saveMocks();
