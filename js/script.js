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

    // 4. Check Support
    // 4a. Check LiGAR Support (Supabase)
    const ligarStatusEl = document.getElementById('ligar-status');
    const ligarDetailEl = document.getElementById('ligar-detail');

    try {
        if (!supabase) throw new Error('Supabase client not initialized');

        // Fetch all devices (or filtering by vendor server-side would be better optimization later)
        // For now, to match existing logic, we fetch all.
        // Optimization: We could do .select('*').ilike('manufacturer', `%${vendor}%`) to reduce data transfer

        let query = supabase.from('ligar_devices').select('*');

        const { data, error } = await query;

        if (error) throw error;

        ligarDevices = data;
        checkSupport(vendor, model, ligarDevices, 'ligar');

    } catch (e) {
        console.error('Failed to load LiGAR list from Supabase', e);
        ligarStatusEl.textContent = '資料庫連線失敗';
        ligarStatusEl.classList.add('unsupported');
        ligarDetailEl.textContent = '無法連接至雲端資料庫。請檢查網路或 Config 設定。';
    }

    // 4b. Check ARCore Support (Hybrid: WebXR + List)
    const arStatusEl = document.getElementById('arcore-status');
    const arDetailEl = document.getElementById('arcore-detail');

    // Default to loading
    arStatusEl.classList.add('loading');
    arStatusEl.textContent = '檢查中...';

    // Try WebXR first (Real verification)
    if (navigator.xr && navigator.xr.isSessionSupported) {
        try {
            const isArSupported = await navigator.xr.isSessionSupported('immersive-ar');
            arStatusEl.classList.remove('loading');

            if (isArSupported) {
                arStatusEl.textContent = '支援 (WebXR)';
                arStatusEl.classList.add('supported');
                arDetailEl.textContent = '此設備與瀏覽器完全支援 WebXR AR 模式。';
            } else {
                // WebXR verification failed, fallback to list check
                // This handles cases where hardware supports it but browser might not (e.g. incorrect flags)
                // Or simply unsupported.
                checkSupport(vendor, model, arcoreDevices, 'arcore');
            }
        } catch (e) {
            console.warn("WebXR check failed, falling back to database", e);
            checkSupport(vendor, model, arcoreDevices, 'arcore');
        }
    } else {
        // No WebXR API, fallback to list
        checkSupport(vendor, model, arcoreDevices, 'arcore');
    }
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


function checkSupport(vendor, model, deviceList, type, suffix = '') {
    const statusElement = document.getElementById(`${type}-status`);
    const detailElement = document.getElementById(`${type}-detail`);

    statusElement.classList.remove('loading');
    statusElement.classList.remove('supported', 'unsupported', 'unknown', 'not-adapted'); // Clear all classes

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
    // Find the matching device object
    const matchedDevice = deviceList.find(device => {
        if (type === 'ligar') {
            // New Schema: brand, model, device_model_name, adapted
            const jsonVendor = (device.brand || '').toLowerCase();
            const jsonModel = (device.model || '').toLowerCase();
            const jsonDeviceName = (device.device_model_name || '').toLowerCase();

            // Check 1: Vendor match (if present)
            const vendorMatch = !jsonVendor || targetVendor.includes(jsonVendor) || jsonVendor.includes(targetVendor);
            if (!vendorMatch) return false;

            // Check 2: Model match (check against both model and device_model_name)
            return (jsonModel && (targetModel.includes(jsonModel) || jsonModel.includes(targetModel))) ||
                (jsonDeviceName && (targetModel.includes(jsonDeviceName) || jsonDeviceName.includes(targetModel)));
        } else {
            // Old Schema (ARCore): manufacturer, model
            const jsonVendor = (device.manufacturer || '').toLowerCase();
            const jsonModel = (device.model || '').toLowerCase();

            const vendorMatch = !jsonVendor || targetVendor.includes(jsonVendor) || jsonVendor.includes(targetVendor);
            if (!vendorMatch) return false;

            return targetModel.includes(jsonModel) || jsonModel.includes(targetModel);
        }
    });

    if (matchedDevice) {
        // Device found in database
        if (type === 'ligar') {
            // Check 'adapted' boolean
            if (matchedDevice.adapted === true) {
                statusElement.textContent = '已適配 (支援)';
                statusElement.classList.add('supported');
                const matchedName = matchedDevice.device_model_name || matchedDevice.model;
                detailElement.textContent = `此設備型號 (${matchedName}) 已列於 LiGAR 適配清單中且支援。`;
            } else {
                statusElement.textContent = '已適配 (不支援)';
                statusElement.classList.add('unsupported');
                const matchedName = matchedDevice.device_model_name || matchedDevice.model;
                detailElement.textContent = `此設備型號 (${matchedName}) 已列於 LiGAR 適配清單中，但標記為不支援。`;
            }
        } else {
            // Standard check (like ARCore list which implies support if present)
            statusElement.textContent = '支援' + suffix;
            statusElement.classList.add('supported');
            detailElement.textContent = `此設備型號 (${matchedDevice.model}) 已列於 ${type === 'arcore' ? 'ARCore' : 'LiGAR'} 資料庫中。`;
        }
    } else {
        // Device Not found in database
        if (type === 'ligar') {
            statusElement.textContent = '尚未適配';
            statusElement.classList.add('unknown');
            statusElement.style.backgroundColor = '#f1c40f'; // Yellow
            statusElement.style.color = '#fff';
            detailElement.textContent = `此設備 (${model}) 尚未在 LiGAR 適配清單中找到。`;
        } else {
            statusElement.textContent = '不支援';
            statusElement.classList.add('unsupported');
            detailElement.textContent = `此設備 (${model}) 未在 ${type === 'arcore' ? 'ARCore' : 'LiGAR'} 資料庫中找到，且未檢測到 WebXR 支援。`;
        }
    }
}
