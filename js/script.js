document.addEventListener('DOMContentLoaded', async () => {
    // 1. Detect Device Info
    const parser = new UAParser();
    const result = parser.getResult();

    // For desktop testing, if model is undefined, show browser info or generic message
    const vendor = result.device.vendor || '未知供應商';
    const model = result.device.model || '未知型號';
    const os = `${result.os.name} ${result.os.version}`;

    document.getElementById('vendor').textContent = vendor;
    document.getElementById('model').textContent = model;
    document.getElementById('os').textContent = os;

    // 2. Fetch Data
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

    // 3. Check ARCore Support
    checkSupport(vendor, model, arcoreDevices, 'arcore');

    // 4. Check LiGAR Support
    checkSupport(vendor, model, ligarDevices, 'ligar');
});

function checkSupport(vendor, model, deviceList, type) {
    const statusElement = document.getElementById(`${type}-status`);
    const detailElement = document.getElementById(`${type}-detail`);

    statusElement.classList.remove('loading');

    if (!vendor || vendor === '未知供應商' || !model || model === '未知型號') {
        statusElement.textContent = '未知設備';
        statusElement.classList.add('unknown');
        detailElement.textContent = '無法可靠地檢測設備型號。';
        return;
    }

    // Normalize strings for comparison
    const targetVendor = vendor.toLowerCase();
    const targetModel = model.toLowerCase();

    // specific check for iOS devices since UA parser might just give "iPhone"
    // Ideally we need more precise detection for iPhone models (e.g. checking screen size/pixel ratio or GPU renderer)
    // For this MVP, we will rely on what UA parser gives us.

    const isSupported = deviceList.some(device => {
        // Simple inclusion check. 
        // Real-world matching is harder because "Pixel 6" in JSON might match "Pixel 6 Build/..." in UA
        // But UAParser usually extracts the clean model name.

        const jsonVendor = device.manufacturer.toLowerCase();
        const jsonModel = device.model.toLowerCase();

        return targetVendor.includes(jsonVendor) && (targetModel.includes(jsonModel) || jsonModel.includes(targetModel));
    });

    if (isSupported) {
        statusElement.textContent = '支援';
        statusElement.classList.add('supported');
        detailElement.textContent = `此設備型號已列於 ${type === 'arcore' ? 'ARCore' : 'LiGAR'} 資料庫中。`;
    } else {
        statusElement.textContent = '不支援';
        statusElement.classList.add('unsupported');
        detailElement.textContent = `此設備未在 ${type === 'arcore' ? 'ARCore' : 'LiGAR'} 資料庫中找到。`;
    }
}
