document.addEventListener('DOMContentLoaded', async () => {
    const vendorEl = document.getElementById('vendor');
    const modelEl = document.getElementById('model');
    const osEl = document.getElementById('os');

    // 1. Initial basic detection (UAParser)
    const parser = new UAParser();
    const result = parser.getResult();

    let vendor = result.device.vendor || '未知供應商';
    let model = result.device.model || '未知型號';
    let os = `${result.os.name} ${result.os.version}`;
    let deviceType = result.device.type; // mobile, tablet, etc.

    // Update UI with initial findings
    vendorEl.textContent = vendor;
    modelEl.textContent = model;
    osEl.textContent = os;

    // 2. Enhanced Detection (Async)
    // 2a. Client Hints (Android/Chrome)
    if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
        try {
            const uaData = await navigator.userAgentData.getHighEntropyValues([
                "model",
                "platform",
                "platformVersion",
                "architecture"
            ]);

            if (uaData.model) {
                model = uaData.model;
                modelEl.textContent = model + ' (精確)';

                // Infer vendor from model if unknown
                if (vendor === '未知供應商' || vendor === 'Unknown Vendor') {
                    const knownVendors = ['ASUS', 'Samsung', 'Google', 'Xiaomi', 'Oppo', 'Vivo', 'Sony', 'Realme', 'OnePlus', 'Huawei', 'Motorola', 'LG', 'HTC', 'Nokia', 'Lenovo'];
                    const upperModel = model.toUpperCase();

                    for (const v of knownVendors) {
                        if (upperModel.includes(v.toUpperCase())) {
                            vendor = v;
                            vendorEl.textContent = vendor + ' (推測)';
                            break;
                        }
                        // Special cases
                        if (upperModel.startsWith('SM-')) { vendor = 'Samsung'; vendorEl.textContent = vendor + ' (推測)'; break; }
                        if (upperModel.startsWith('Pixel')) { vendor = 'Google'; vendorEl.textContent = vendor + ' (推測)'; break; }
                        if (upperModel.startsWith('RMX')) { vendor = 'Realme'; vendorEl.textContent = vendor + ' (推測)'; break; }
                        if (upperModel.startsWith('CPH') || upperModel.startsWith('PGT')) { vendor = 'Oppo'; vendorEl.textContent = vendor + ' (推測)'; break; } // Approximate
                    }
                }
            }

            if (uaData.platform) {
                // platformVersion usually major.minor.patch
                os = `${uaData.platform} ${uaData.platformVersion}`;
                osEl.textContent = os;
            }
        } catch (e) {
            console.log("UA-CH failed", e);
        }
    }
    // 2b. WebGL Renderer (iOS/Fallback)
    else {
        const glInfo = getWebGLRenderer();
        if (glInfo) {
            console.log("WebGL Renderer:", glInfo);
            // If model is generic "iPhone", append GPU info to help identify generation
            if (model === 'iPhone' || model === 'iPad' || model === '未知型號') {
                // GPU strings usually look like "Apple A14 GPU"
                if (glInfo.includes("Apple")) {
                    model += ` (${glInfo})`;
                    modelEl.textContent = model;
                    vendor = "Apple"; // Force vendor if inferred
                    vendorEl.textContent = vendor + ' (推測)';
                }
            }
        }
    }

    // 3. Fetch Data
    let arcoreDevices = [];
    let ligarDevices = [];

    try {
        const arResponse = await fetch('data/arcore_devices.json');
        arcoreDevices = await arResponse.json();
    } catch (e) {
        console.error('Failed to load ARCore list', e);
        document.getElementById('arcore-detail').textContent = '載入設備列表時發生錯誤。';
    }

    try {
        const ligarResponse = await fetch('data/ligar_devices.json');
        ligarDevices = await ligarResponse.json();
    } catch (e) {
        console.error('Failed to load LiGAR list', e);
        document.getElementById('ligar-detail').textContent = '載入設備列表時發生錯誤。';
    }

    // 4. Check Support with Refined Data
    checkSupport(vendor, model, arcoreDevices, 'arcore');
    checkSupport(vendor, model, ligarDevices, 'ligar');
});

// Helper to get WebGL Renderer string
function getWebGLRenderer() {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) return null;

        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (!debugInfo) return null;

        return gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    } catch (e) {
        return null;
    }
}

function checkSupport(vendor, model, deviceList, type) {
    const statusElement = document.getElementById(`${type}-status`);
    const detailElement = document.getElementById(`${type}-detail`);

    statusElement.classList.remove('loading');

    // Basic validation
    if ((!vendor || vendor === '未知供應商') && (!model || model === '未知型號') && !model.includes('GPU')) {
        statusElement.textContent = '未知設備';
        statusElement.classList.add('unknown');
        detailElement.textContent = '無法可靠地檢測設備型號。';
        return;
    }

    // Normalize strings for comparison
    const targetVendor = (vendor || '').toLowerCase();
    const targetModel = (model || '').toLowerCase();

    // Fuzzy matching logic
    const isSupported = deviceList.some(device => {
        const jsonVendor = (device.manufacturer || '').toLowerCase();
        const jsonModel = (device.model || '').toLowerCase();

        // Check 1: Vendor match (if present)
        const vendorMatch = !jsonVendor || targetVendor.includes(jsonVendor) || jsonVendor.includes(targetVendor);

        if (!vendorMatch) return false;

        // Check 2: Model match
        // We split model strings to check specifically for model numbers e.g. "Pixel 6"
        return targetModel.includes(jsonModel) || jsonModel.includes(targetModel);
    });

    if (isSupported) {
        statusElement.textContent = '支援';
        statusElement.classList.add('supported');
        detailElement.textContent = `此設備型號 (${model}) 已列於 ${type === 'arcore' ? 'ARCore' : 'LiGAR'} 資料庫中。`;
    } else {
        statusElement.textContent = '不支援';
        statusElement.classList.add('unsupported');
        detailElement.textContent = `此設備 (${model}) 未在 ${type === 'arcore' ? 'ARCore' : 'LiGAR'} 資料庫中找到。`;
    }
}
