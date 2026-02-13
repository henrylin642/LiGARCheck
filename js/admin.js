document.addEventListener('DOMContentLoaded', async () => {
    const loginSection = document.getElementById('login-section');
    const uploadSection = document.getElementById('upload-section');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const uploadBtn = document.getElementById('upload-btn');
    const fileInput = document.getElementById('csv-file');
    const statusEl = document.getElementById('upload-status');
    const logsEl = document.getElementById('upload-logs');

    // 0. Check Supabase Initialization
    if (typeof supabase === 'undefined') {
        alert('錯誤：無法連接到 Supabase。請檢查 js/config.js 設定是否正確，或是否成功載入 Supabase SDK。');
        return;
    }

    // 1. Check Session
    const checkSession = async () => {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
            console.error('Session check error:', error);
        }

        if (session) {
            loginSection.style.display = 'none';
            uploadSection.style.display = 'block';
            log('已登入: ' + session.user.email);
        } else {
            loginSection.style.display = 'block';
            uploadSection.style.display = 'none';
        }
    };

    await checkSession();

    // 2. Login Logic
    loginBtn.addEventListener('click', async () => {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const msgEl = document.getElementById('login-message');

        msgEl.textContent = '登入中...';

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            msgEl.textContent = '登入失敗: ' + error.message;
            msgEl.style.color = 'red';
        } else {
            msgEl.textContent = '登入成功!';
            msgEl.style.color = 'green';
            checkSession();
        }
    });

    // 3. Logout Logic
    logoutBtn.addEventListener('click', async () => {
        await supabase.auth.signOut();
        checkSession();
    });

    // 4. File Selection
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            uploadBtn.disabled = false;
        } else {
            uploadBtn.disabled = true;
        }
    });

    // 5. Upload Logic
    uploadBtn.addEventListener('click', () => {
        const file = fileInput.files[0];
        if (!file) return;

        statusEl.style.display = 'block';
        statusEl.textContent = '解析 CSV 中...';
        statusEl.className = 'status-indicator loading';
        logsEl.textContent = '';

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                log(`解析完成: 共有 ${results.data.length} 筆資料`);
                await processAndUpload(results.data);
            },
            error: (err) => {
                log('CSV 解析錯誤: ' + err.message);
                statusEl.textContent = '解析失敗';
                statusEl.className = 'status-indicator unsupported';
            }
        });
    });

    async function processAndUpload(rows) {
        statusEl.textContent = '處理資料中...';
        const devices = [];

        // 1. Transform Data
        for (const row of rows) {
            // Helper: Clean string, return null if empty or '-'
            const getVal = (key) => {
                let val = (row[key] || '').toString().trim();
                if (val === '-' || val === '') return null;
                return val;
            };

            // Helper: Parse boolean
            const getBool = (key) => {
                const val = getVal(key);
                if (!val) return null;
                return val.toLowerCase() === 'true';
            };

            // Helper: Parse number
            const getNum = (key) => {
                const val = getVal(key);
                if (!val) return null;
                const num = parseFloat(val);
                return isNaN(num) ? null : num;
            };

            const brand = getVal('Brand');
            const model = getVal('Model');
            const deviceModelName = getVal('Device model name');

            // Skip empty rows (must have at least Brand or Model or Name)
            if (!brand && !model && !deviceModelName) continue;

            // Map all fields
            devices.push({
                csv_id: getVal('Id'),
                brand: brand,
                model: model,
                date_added: getVal('Date'),
                adapted: getBool('Adapted'),
                created_at_source: getVal('Created at'),
                updated_at_source: getVal('Updated at'),
                support_ar_core: getBool('Support ar core'),
                support_camera_two: getBool('Support camera two'),
                open_gl_es_version: getVal('Open gl es version'),
                device_model_name: deviceModelName,
                platform: getVal('Platform'),
                model_numbers: getVal('Model numbers'),

                intr_fx: getNum('Intr fx'),
                intr_fy: getNum('Intr fy'),
                intr_cx: getNum('Intr cx'),
                intr_cy: getNum('Intr cy'),
                intr_k1: getNum('Intr k1'),
                intr_k2: getNum('Intr k2'),
                intr_k3: getNum('Intr k3'),
                intr_k4: getNum('Intr k4'),
                intr_k5: getNum('Intr k5'),

                expo_default: getVal('Expo default'),
                focus_default: getVal('Focus default'),
                iso_default: getVal('Iso default'),
                img_width: getNum('Img width'),
                img_height: getNum('Img height')
            });
        }

        log(`處理完成: 準備上傳 ${devices.length} 筆資料`);

        // 2. Upload to Supabase
        if (!confirm(`確定要清除舊資料並寫入 ${devices.length} 筆新資料嗎？`)) {
            statusEl.textContent = '已取消';
            statusEl.className = 'status-indicator';
            return;
        }

        statusEl.textContent = '上傳中...';

        // Batch insert
        const CHUNK_SIZE = 1000;
        let successCount = 0;
        let failCount = 0;

        // Step 2a: Delete all existing
        const { error: deleteError } = await supabase
            .from('ligar_devices')
            .delete()
            .neq('id', -1); // Delete all

        if (deleteError) {
            log('清除舊資料失敗: ' + deleteError.message);
        } else {
            log('舊資料已清除');
        }

        // Step 2b: Insert
        for (let i = 0; i < devices.length; i += CHUNK_SIZE) {
            const chunk = devices.slice(i, i + CHUNK_SIZE);
            const { error } = await supabase
                .from('ligar_devices')
                .insert(chunk);

            if (error) {
                log(`批次 ${i} - ${i + CHUNK_SIZE} 失敗: ${error.message}`);
                failCount += chunk.length;
            } else {
                log(`批次 ${i} - ${i + chunk.length} 上傳成功`);
                successCount += chunk.length;
            }
        }

        if (failCount === 0) {
            statusEl.textContent = '上傳完成';
            statusEl.className = 'status-indicator supported';
            log('所有資料已更新成功！');
        } else {
            statusEl.textContent = '部分失敗';
            statusEl.className = 'status-indicator unsupported';
        }
    }

    function log(msg) {
        const line = document.createElement('div');
        line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
        logsEl.appendChild(line);
        logsEl.scrollTop = logsEl.scrollHeight;
    }
});
