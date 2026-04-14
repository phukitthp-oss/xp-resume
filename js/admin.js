/**
 * Admin Panel JavaScript
 * Manages content, uploads, and settings for XP Portfolio
 */

// Configuration
const CONFIG_KEY = 'xp_portfolio_config';
const PASSWORD_KEY = 'xp_admin_password_hash';

async function hashPassword(plain) {
    const buf = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(plain)
    );
    return Array.from(new Uint8Array(buf))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// ==========================================
// Error Logging System
// ==========================================
const errorLogs = [];

function logError(message, details = '') {
    const timestamp = new Date().toLocaleString('th-TH');
    const logEntry = { timestamp, message, details };
    errorLogs.push(logEntry);
    console.error(`[${timestamp}] ${message}`, details);
    updateErrorLogUI();
}

function updateErrorLogUI() {
    const logContainer = document.getElementById('errorLogContainer');
    if (!logContainer) return;
    
    if (errorLogs.length === 0) {
        logContainer.innerHTML = '<div style="color:#666;padding:10px;">No errors logged</div>';
        return;
    }
    
    logContainer.innerHTML = errorLogs.map((log, i) => `
        <div style="padding:8px;border-bottom:1px solid #ddd;font-size:12px;">
            <span style="color:#666;">[${log.timestamp}]</span>
            <span style="color:#c00;">${log.message}</span>
            ${log.details ? `<div style="color:#888;margin-top:4px;font-size:11px;">${log.details}</div>` : ''}
        </div>
    `).reverse().join('');
}

function clearErrorLogs() {
    errorLogs.length = 0;
    updateErrorLogUI();
    showMessage('✅ Error logs cleared', 'success');
}

// ==========================================
// IndexedDB for Project Images Storage
// ==========================================
const DB_NAME = 'xp_portfolio_images';
const DB_VERSION = 1;
const STORE_NAME = 'project_banners';

let imageDB = null;

function initImageDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => {
            console.error('IndexedDB error:', request.error);
            reject(request.error);
        };
        
        request.onsuccess = () => {
            imageDB = request.result;
            console.log('IndexedDB initialized');
            resolve(imageDB);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                console.log('Object store created');
            }
        };
    });
}

// Save image to IndexedDB
function saveImageToDB(imageId, imageData) {
    return new Promise((resolve, reject) => {
        if (!imageDB) {
            reject('Database not initialized');
            return;
        }
        const transaction = imageDB.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put({ id: imageId, data: imageData, timestamp: Date.now() });
        
        request.onsuccess = () => resolve(imageId);
        request.onerror = () => reject(request.error);
    });
}

// Get image from IndexedDB
function getImageFromDB(imageId) {
    return new Promise((resolve, reject) => {
        if (!imageDB) {
            reject('Database not initialized');
            return;
        }
        const transaction = imageDB.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(imageId);
        
        request.onsuccess = () => resolve(request.result?.data || null);
        request.onerror = () => reject(request.error);
    });
}

// Delete image from IndexedDB
function deleteImageFromDB(imageId) {
    return new Promise((resolve, reject) => {
        if (!imageDB) {
            reject('Database not initialized');
            return;
        }
        const transaction = imageDB.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(imageId);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Generate unique image ID
function generateImageId() {
    return 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize IndexedDB for image storage
    try {
        await initImageDB();
        console.log('Image database ready');
    } catch (err) {
        console.warn('IndexedDB not available, using localStorage fallback');
    }
    loadConfig();
});

// Authentication
async function adminAuth() {
    const input = document.getElementById('adminPassword').value;
    if (!input) return;
    const stored = localStorage.getItem(PASSWORD_KEY);
    if (!stored) {
        // No password set yet — show setup flow
        showFirstLoginSection();
        return;
    }
    const hash = await hashPassword(input);
    if (hash === stored) {
        document.getElementById('adminLogin').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'flex';
        loadAllData();
        showMessage('Login successful', 'success');
    } else {
        const errEl = document.getElementById('loginError');
        if (errEl) errEl.textContent = 'Incorrect password';
    }
}

function showFirstLoginSection() {
    document.getElementById('loginBox').style.display = 'none';
    document.getElementById('firstLoginSection').style.display = 'block';
}

async function setFirstPassword() {
    const pw = document.getElementById('firstPassword').value;
    const pw2 = document.getElementById('firstPasswordConfirm').value;
    const errEl = document.getElementById('firstLoginError');
    if (pw.length < 8) { errEl.textContent = 'Password must be at least 8 characters'; return; }
    if (pw !== pw2) { errEl.textContent = 'Passwords do not match'; return; }
    const hash = await hashPassword(pw);
    localStorage.setItem(PASSWORD_KEY, hash);
    document.getElementById('firstLoginSection').style.display = 'none';
    document.getElementById('adminLogin').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'flex';
    loadAllData();
    showMessage('Password set. Welcome!', 'success');
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        document.getElementById('adminLogin').style.display = 'flex';
        document.getElementById('adminPanel').style.display = 'none';
        document.getElementById('adminPassword').value = '';
    }
}

// Navigation
function showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.admin-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Remove active from all nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected section
    document.getElementById(`section-${sectionName}`).classList.add('active');
    
    // Set active nav button
    event.target.classList.add('active');
}

// Configuration Management
function loadConfig() {
    const config = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');
    return config;
}

function saveConfig(config) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    offerConfigDownload(config);
}

function offerConfigDownload(config) {
    const existing = URL.createObjectURL(
        new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
    );
    const btn = document.getElementById('downloadConfigBtn');
    if (!btn) return;
    btn.href = existing;
    btn.download = 'config.json';
    btn.classList.remove('hidden');
}

function loadAllData() {
    const config = loadConfig();
    
    // Load content
    if (config.content) {
        document.getElementById('bootTitle').value = config.content.bootTitle || 'Mitchlvin';
        document.getElementById('bootTitleSuffix').value = config.content.bootTitleSuffix || 'XP';
        document.getElementById('bootSubtitle').value = config.content.bootSubtitle || 'Visual Designer';
        document.getElementById('bootHint').value = config.content.bootHint || 'For the best experience\nEnter Full Screen (F11)';
        document.getElementById('bootPortfolio').value = config.content.bootPortfolio || 'Portfolio®';
        document.getElementById('loginTitle').value = config.content.loginTitle || 'YourName';
        document.getElementById('loginTitleSuffix').value = config.content.loginTitleSuffix || 'XP';
        document.getElementById('loginSubtitle').value = config.content.loginSubtitle || 'Frontend Developer';
        document.getElementById('userName').value = config.content.userName || 'Your Name';
        document.getElementById('userRole').value = config.content.userRole || 'Frontend Developer';
    }
    
    // Load profile
    if (config.profile) {
        document.getElementById('profileEmail').value = config.profile.email || 'your.email@gmail.com';
        document.getElementById('profileLocation').value = config.profile.location || 'Your City, Country';
        document.getElementById('socialInstagram').value = config.profile.instagram || 'https://instagram.com';
        document.getElementById('socialGithub').value = config.profile.github || 'https://github.com';
        document.getElementById('socialLinkedin').value = config.profile.linkedin || 'https://linkedin.com';
    }
    
    // Load boot text
    if (config.bootText) {
        document.getElementById('bootTextLeft').value = config.bootText.left || 'Mitchlvin';
        document.getElementById('bootTextRight').value = config.bootText.right || 'XP';
        document.getElementById('bootTextSubtitle').value = config.bootText.subtitle || 'Visual Designer';
        document.getElementById('bootTextBottomLeft').value = config.bootText.bottomLeft || 'For the best experience\nEnter Full Screen (F11)';
        document.getElementById('bootTextBottomRight').value = config.bootText.bottomRight || 'Portfolio®';
        // Load font sizes
        document.getElementById('bootFontName').value = config.bootText.fontName || 72;
        document.getElementById('bootFontXP').value = config.bootText.fontXP || 48;
        document.getElementById('bootFontSubtitle').value = config.bootText.fontSubtitle || 24;
        document.getElementById('bootFontHint').value = config.bootText.fontHint || 14;
        document.getElementById('bootFontBrand').value = config.bootText.fontBrand || 36;
    }
    
    // Load boot loader settings
    if (config.bootLoader) {
        document.getElementById('bootLoaderLoops').value = config.bootLoader.loops || 1;
        document.getElementById('bootLoaderWidth').value = config.bootLoader.width || 220;
        document.getElementById('bootLoaderHeight').value = config.bootLoader.height || 22;
        document.getElementById('bootLoaderRadius').value = config.bootLoader.radius || 0;
        document.getElementById('bootLoaderDuration').value = config.bootLoader.duration || 2;
    }
    
    // Load boot screen duration
    if (config.bootScreenDuration !== undefined) {
        document.getElementById('bootScreenDuration').value = config.bootScreenDuration;
    }
    
    // Load icon size, font size, gap and margin
    if (config.iconSize) {
        document.getElementById('iconSize').value = config.iconSize;
    }
    if (config.iconFontSize) {
        document.getElementById('iconFontSize').value = config.iconFontSize;
    }
    if (config.iconGap) {
        document.getElementById('iconGap').value = config.iconGap;
    }
    if (config.iconMargin) {
        document.getElementById('iconMargin').value = config.iconMargin;
    }
    
    // Load CRT settings
    if (config.crtEffect) {
        document.getElementById('crtScanlineOpacity').value = config.crtEffect.scanlineOpacity || 0.5;
        document.getElementById('crtVignetteOpacity').value = config.crtEffect.vignetteOpacity || 0;
        document.getElementById('crtBrightness').value = config.crtEffect.brightness || 100;
        document.getElementById('crtScanlineValue').textContent = (config.crtEffect.scanlineOpacity || 0.5) + '%';
        document.getElementById('crtVignetteValue').textContent = (config.crtEffect.vignetteOpacity || 0) + '%';
        document.getElementById('crtBrightnessValue').textContent = (config.crtEffect.brightness || 100) + '%';
    }
    
    // Load images
    if (config.images) {
        if (config.images.wallpaper) {
            document.getElementById('currentWallpaper').src = config.images.wallpaper;
        } else if (config.images.wallpaperColor) {
            const color = config.images.wallpaperColor;
            document.getElementById('wallpaperColor').value = color;
            document.getElementById('wallpaperColorHex').value = color;
            const preview = document.getElementById('currentWallpaper');
            preview.style.background = color;
            preview.src = '';
        }
        if (config.images.bootScreen) {
            document.getElementById('currentBootScreen').src = config.images.bootScreen;
        } else if (config.images.bootScreenColor) {
            const color = config.images.bootScreenColor;
            document.getElementById('bootScreenColor').value = color;
            document.getElementById('bootScreenColorHex').value = color;
            const preview = document.getElementById('currentBootScreen');
            preview.style.background = color;
            preview.src = '';
        }
        if (config.images.avatar) {
            document.getElementById('currentAvatar').src = config.images.avatar;
        }
        if (config.images.icons) {
            Object.keys(config.images.icons).forEach(key => {
                const img = document.getElementById(`icon${key.charAt(0).toUpperCase() + key.slice(1)}`);
                if (img) img.src = config.images.icons[key];
            });
        }
        if (config.images.bootLogo) {
            document.getElementById('iconBootLogo').src = config.images.bootLogo;
        }
        if (config.images.loginAvatar) {
            document.getElementById('iconLoginAvatar').src = config.images.loginAvatar;
        }
        if (config.images.aboutAvatars) {
            for (let i = 1; i <= 4; i++) {
                const avatarSrc = config.images.aboutAvatars[`avatar${i}`];
                if (avatarSrc) {
                    const preview = document.getElementById(`previewAvatar${i}`);
                    if (preview) preview.src = avatarSrc;
                }
            }
        }
        if (config.images.cvImage) {
            const cvPreview = document.getElementById('currentCVPreview');
            if (cvPreview) {
                cvPreview.src = config.images.cvImage;
                cvPreview.style.display = 'block';
            }
        }
    }
    
    // Load Resume settings
    if (config.resume) {
        if (config.resume.bgColor) document.getElementById('resumeBgColor').value = config.resume.bgColor;
    }
    
    // Load About Me content
    if (config.aboutMe) {
        if (config.aboutMe.title) document.getElementById('aboutMeTitle').value = config.aboutMe.title;
        if (config.aboutMe.paragraph1) document.getElementById('aboutPara1').value = config.aboutMe.paragraph1;
        if (config.aboutMe.paragraph2) document.getElementById('aboutPara2').value = config.aboutMe.paragraph2;
        if (config.aboutMe.paragraph3) document.getElementById('aboutPara3').value = config.aboutMe.paragraph3;
        if (config.aboutMe.paragraph4) document.getElementById('aboutPara4').value = config.aboutMe.paragraph4;
        if (config.aboutMe.skillsTitle) document.getElementById('skillsHeaderTitle').value = config.aboutMe.skillsTitle;
        if (config.aboutMe.skills) document.getElementById('aboutSkillsList').value = config.aboutMe.skills;
        if (config.aboutMe.softwareTitle) document.getElementById('softwareHeaderTitle').value = config.aboutMe.softwareTitle;
        if (config.aboutMe.software) document.getElementById('aboutSoftwareList').value = config.aboutMe.software;
        if (config.aboutMe.sidebarColor) document.getElementById('aboutSidebarColor').value = config.aboutMe.sidebarColor;
        if (config.aboutMe.mainColor) document.getElementById('aboutMainColor').value = config.aboutMe.mainColor;
        if (config.aboutMe.titleSize) document.getElementById('aboutTitleSize').value = config.aboutMe.titleSize;
        if (config.aboutMe.fontSize) document.getElementById('aboutFontSize').value = config.aboutMe.fontSize;
        if (config.aboutMe.avatarSize) document.getElementById('aboutAvatarSize').value = config.aboutMe.avatarSize;
    }
    
    // Load projects list
    loadProjectsList();
    
    // Load categories list
    loadCategoriesList();
}

// Wallpaper Management
function previewWallpaper(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const preview = document.getElementById('wallpaperPreview');
            preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function uploadWallpaper() {
    const input = document.getElementById('wallpaperInput');
    if (!input.files || !input.files[0]) {
        logError('Please select an image first', 'uploadWallpaper');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const config = loadConfig();
        if (!config.images) config.images = {};
        config.images.wallpaper = e.target.result;
        saveConfig(config);
        
        document.getElementById('currentWallpaper').src = e.target.result;
        showMessage('✅ Wallpaper updated successfully!', 'success');
        
        // Apply to main site
        applyWallpaperToSite(e.target.result);
    };
    reader.readAsDataURL(input.files[0]);
}

function resetWallpaper() {
    if (confirm('Reset wallpaper to default?')) {
        const config = loadConfig();
        if (config.images) delete config.images.wallpaper;
        saveConfig(config);
        
        document.getElementById('currentWallpaper').src = 'assets/wallpaper-bliss.jpg';
        document.getElementById('wallpaperPreview').innerHTML = '';
        document.getElementById('wallpaperInput').value = '';
        showMessage('✅ Wallpaper reset to default!', 'success');
    }
}

function applyWallpaperToSite(imageData) {
    // This would need to be implemented based on your site structure
    // For now, we save to localStorage and the main site can read it
    localStorage.setItem('custom_wallpaper', imageData);
}

// Color Picker Management
function updateColorPicker(hexValue) {
    const colorInput = document.getElementById('wallpaperColor');
    const hexInput = document.getElementById('wallpaperColorHex');
    
    if (hexValue.match(/^#[0-9A-F]{6}$/i)) {
        colorInput.value = hexValue;
    }
}

// Sync color picker with hex input
document.addEventListener('DOMContentLoaded', () => {
    const colorInput = document.getElementById('wallpaperColor');
    const hexInput = document.getElementById('wallpaperColorHex');
    
    if (colorInput && hexInput) {
        colorInput.addEventListener('input', (e) => {
            hexInput.value = e.target.value;
        });
    }
    
    // Boot screen color picker sync
    const bootColorInput = document.getElementById('bootScreenColor');
    const bootHexInput = document.getElementById('bootScreenColorHex');
    
    if (bootColorInput && bootHexInput) {
        bootColorInput.addEventListener('input', (e) => {
            bootHexInput.value = e.target.value;
        });
    }
});

function applyWallpaperColor() {
    const color = document.getElementById('wallpaperColor').value;
    
    const config = loadConfig();
    if (!config.images) config.images = {};
    config.images.wallpaperColor = color;
    delete config.images.wallpaper; // Remove image if using color
    saveConfig(config);
    
    // Update preview
    const preview = document.getElementById('currentWallpaper');
    preview.style.background = color;
    preview.style.objectFit = 'none';
    preview.src = '';
    
    showMessage('✅ Wallpaper color applied successfully!', 'success');
    
    // Apply to main site
    const desktop = window.opener?.document.getElementById('desktop');
    if (desktop) {
        desktop.style.backgroundImage = 'none';
        desktop.style.backgroundColor = color;
    }
}

function removeWallpaperImage() {
    const config = loadConfig();
    if (config.images) {
        delete config.images.wallpaper;
    }
    saveConfig(config);
    
    // Clear preview
    document.getElementById('wallpaperPreview').innerHTML = '';
    document.getElementById('wallpaperInput').value = '';
    
    // Update current wallpaper display
    const preview = document.getElementById('currentWallpaper');
    if (config.images?.wallpaperColor) {
        preview.style.background = config.images.wallpaperColor;
        preview.src = '';
    } else {
        preview.style.background = '';
        preview.src = 'assets/wallpaper-bliss.jpg';
    }
    
    showMessage('✅ Wallpaper image removed!', 'success');
    localStorage.removeItem('custom_wallpaper');
}

function removeWallpaperColor() {
    const config = loadConfig();
    if (config.images) {
        delete config.images.wallpaperColor;
    }
    saveConfig(config);
    
    // Update current wallpaper display
    const preview = document.getElementById('currentWallpaper');
    preview.style.background = '';
    
    if (config.images?.wallpaper) {
        preview.src = config.images.wallpaper;
    } else {
        preview.src = 'assets/wallpaper-bliss.jpg';
    }
    
    showMessage('✅ Background color removed!', 'success');
}

// Boot Screen Management
function previewBootScreen(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const preview = document.getElementById('bootScreenPreview');
            preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function uploadBootScreen() {
    const input = document.getElementById('bootScreenInput');
    if (!input.files || !input.files[0]) {
        logError('Please select an image first', 'uploadBootScreen');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const config = loadConfig();
        if (!config.images) config.images = {};
        config.images.bootScreen = e.target.result;
        saveConfig(config);
        
        document.getElementById('currentBootScreen').src = e.target.result;
        showMessage('✅ Boot screen updated successfully!', 'success');
        
        // Apply to main site
        applyBootScreenToSite(e.target.result);
    };
    reader.readAsDataURL(input.files[0]);
}

function resetBootScreen() {
    if (confirm('Reset boot screen to default?')) {
        const config = loadConfig();
        if (config.images) delete config.images.bootScreen;
        saveConfig(config);
        
        document.getElementById('currentBootScreen').src = 'assets/images/boot-screen.jpg';
        document.getElementById('bootScreenPreview').innerHTML = '';
        document.getElementById('bootScreenInput').value = '';
        showMessage('✅ Boot screen reset to default!', 'success');
        
        // Remove from main site
        const bootScreen = window.opener?.document.getElementById('bootScreen');
        if (bootScreen) {
            bootScreen.style.backgroundImage = "url('assets/images/boot-screen.jpg')";
        }
    }
}

function applyBootScreenToSite(imageData) {
    // Apply to main site if window is open
    const bootScreen = window.opener?.document.getElementById('bootScreen');
    if (bootScreen) {
        bootScreen.style.backgroundImage = `url(${imageData})`;
    }
}

// Boot Screen Color Management
function updateBootColorPicker(hexValue) {
    const colorInput = document.getElementById('bootScreenColor');
    const hexInput = document.getElementById('bootScreenColorHex');
    
    if (hexValue.match(/^#[0-9A-F]{6}$/i)) {
        colorInput.value = hexValue;
    }
}

function applyBootScreenColor() {
    const color = document.getElementById('bootScreenColor').value;
    
    const config = loadConfig();
    if (!config.images) config.images = {};
    config.images.bootScreenColor = color;
    delete config.images.bootScreen; // Remove image if using color
    saveConfig(config);
    
    // Update preview
    const preview = document.getElementById('currentBootScreen');
    preview.style.background = color;
    preview.style.objectFit = 'none';
    preview.src = '';
    
    showMessage('✅ Boot screen background color applied!', 'success');
    
    // Apply to main site
    const bootScreen = window.opener?.document.getElementById('bootScreen');
    if (bootScreen) {
        bootScreen.style.backgroundImage = 'none';
        bootScreen.style.backgroundColor = color;
    }
}

// Boot Screen Text Management
function saveBootScreenText() {
    try {
        const config = loadConfig();
        if (!config.bootText) config.bootText = {};
        
        config.bootText = {
            left: document.getElementById('bootTextLeft').value,
            right: document.getElementById('bootTextRight').value,
            subtitle: document.getElementById('bootTextSubtitle').value,
            bottomLeft: document.getElementById('bootTextBottomLeft').value,
            bottomRight: document.getElementById('bootTextBottomRight').value,
            // Font sizes
            fontName: parseInt(document.getElementById('bootFontName').value) || 72,
            fontXP: parseInt(document.getElementById('bootFontXP').value) || 48,
            fontSubtitle: parseInt(document.getElementById('bootFontSubtitle').value) || 24,
            fontHint: parseInt(document.getElementById('bootFontHint').value) || 14,
            fontBrand: parseInt(document.getElementById('bootFontBrand').value) || 36
        };
        
        saveConfig(config);
        
        // Verify save
        const verify = loadConfig();
        if (verify.bootText && verify.bootText.fontName === config.bootText.fontName) {
            alert('✅ Boot screen saved!\nFont sizes: Name=' + config.bootText.fontName + 'px, XP=' + config.bootText.fontXP + 'px');
            showMessage('✅ Boot screen text & font sizes saved successfully!', 'success');
        } else {
            alert('❌ Save verification failed');
        }
        
        // Apply to main site
        applyBootTextToSite(config.bootText);
    } catch (error) {
        alert('❌ Error: ' + error.message);
        console.error('saveBootScreenText error:', error);
    }
}

function applyBootTextToSite(bootText) {
    if (!bootText) return;
    
    // Update title left (boot-name)
    const bootName = document.querySelector('.boot-name');
    if (bootName) {
        bootName.textContent = bootText.left;
        if (bootText.fontName) bootName.style.fontSize = bootText.fontName + 'px';
    }
    
    // Update title right (boot-xp)
    const bootXp = document.querySelector('.boot-xp');
    if (bootXp) {
        bootXp.textContent = bootText.right;
        if (bootText.fontXP) bootXp.style.fontSize = bootText.fontXP + 'px';
    }
    
    // Update subtitle
    const bootSubtitle = document.querySelector('.boot-subtitle');
    if (bootSubtitle) {
        bootSubtitle.textContent = bootText.subtitle;
        if (bootText.fontSubtitle) bootSubtitle.style.fontSize = bootText.fontSubtitle + 'px';
    }
    
    // Update bottom left (boot-hint)
    const bootHint = document.querySelector('.boot-hint');
    if (bootHint) {
        bootHint.innerHTML = bootText.bottomLeft.replace(/\n/g, '<br>');
        if (bootText.fontHint) bootHint.style.fontSize = bootText.fontHint + 'px';
    }
    
    // Update bottom right (boot-brand)
    const bootBrand = document.querySelector('.boot-brand');
    if (bootBrand) {
        bootBrand.innerHTML = bootText.bottomRight;
        if (bootText.fontBrand) bootBrand.style.fontSize = bootText.fontBrand + 'px';
    }
}

// Boot Loader Settings Management
function saveBootLoaderSettings() {
    const config = loadConfig();
    if (!config.bootLoader) config.bootLoader = {};
    
    config.bootLoader = {
        loops: parseInt(document.getElementById('bootLoaderLoops').value) || 1,
        width: parseInt(document.getElementById('bootLoaderWidth').value) || 220,
        height: parseInt(document.getElementById('bootLoaderHeight').value) || 22,
        radius: parseInt(document.getElementById('bootLoaderRadius').value) || 0,
        duration: parseFloat(document.getElementById('bootLoaderDuration').value) || 2
    };
    
    saveConfig(config);
    showMessage('✅ Loading bar settings saved successfully!', 'success');
    
    // Apply to main site
    applyBootLoaderToSite(config.bootLoader);
}

function applyBootLoaderToSite(bootLoader) {
    if (!bootLoader) return;
    
    const loader = document.querySelector('.boot-loader');
    const loaderBar = document.querySelector('.boot-loader-bar');
    
    if (loader) {
        loader.style.width = `${bootLoader.width}px`;
        loader.style.height = `${bootLoader.height}px`;
        loader.style.borderRadius = `${bootLoader.radius}px`;
    }
    
    if (loaderBar) {
        // Remove existing animation
        loaderBar.style.animation = 'none';
        
        // Force reflow
        void loaderBar.offsetWidth;
        
        // Apply new animation
        const iterationCount = bootLoader.loops === 0 ? 'infinite' : bootLoader.loops;
        loaderBar.style.animation = `loading ${bootLoader.duration}s ease-in-out ${iterationCount}`;
        loaderBar.style.borderRadius = `${bootLoader.radius}px`;
    }
}

// Icon Management
let iconPreviews = {};

function previewIcon(input, iconName) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            iconPreviews[iconName] = e.target.result;
            document.getElementById(`icon${iconName.charAt(0).toUpperCase() + iconName.slice(1)}`).src = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function uploadIcon(iconName) {
    if (!iconPreviews[iconName]) {
        logError('Please select an image first', 'uploadIcon: ' + iconName);
        return;
    }
    
    const config = loadConfig();
    if (!config.images) config.images = {};
    
    // Handle boot/login icons separately
    if (iconName === 'bootLogo' || iconName === 'loginAvatar') {
        config.images[iconName] = iconPreviews[iconName];
        saveConfig(config);
        showMessage(`✅ ${iconName === 'bootLogo' ? 'Boot logo' : 'Login avatar'} updated!`, 'success');
        
        // Apply to main site
        if (iconName === 'bootLogo') {
            const bootLogo = document.querySelector('.boot-logo');
            if (bootLogo) bootLogo.src = iconPreviews[iconName];
        } else if (iconName === 'loginAvatar') {
            const loginAvatar = document.querySelector('.login-avatar');
            if (loginAvatar) loginAvatar.src = iconPreviews[iconName];
        }
    } else {
        // Desktop icons
        if (!config.images.icons) config.images.icons = {};
        config.images.icons[iconName] = iconPreviews[iconName];
        saveConfig(config);
        showMessage(`✅ ${iconName.charAt(0).toUpperCase() + iconName.slice(1)} icon updated!`, 'success');
        
        // Apply to main site immediately
        applyIconsToSite();
    }
}

// Icon Settings Management
function saveIconSettings() {
    const config = loadConfig();
    config.iconSize = parseInt(document.getElementById('iconSize').value) || 48;
    config.iconFontSize = parseInt(document.getElementById('iconFontSize').value) || 11;
    config.iconGap = parseInt(document.getElementById('iconGap').value) || 25;
    config.iconMargin = parseInt(document.getElementById('iconMargin').value) || 20;
    
    saveConfig(config);
    showMessage('✅ Icon settings saved successfully!', 'success');
    
    // Apply to main site
    applyIconSettingsToSite(config.iconSize, config.iconFontSize, config.iconGap, config.iconMargin);
}

function applyIconSettingsToSite(iconSize, iconFontSize, iconGap, iconMargin) {
    if (!iconSize) iconSize = 48;
    if (!iconFontSize) iconFontSize = 11;
    if (!iconGap) iconGap = 25;
    if (!iconMargin) iconMargin = 20;
    
    // Apply to icon container
    const iconContainer = document.querySelector('.desktop-icons');
    if (iconContainer) {
        iconContainer.style.gap = `${iconGap}px`;
        iconContainer.style.top = `${iconMargin}px`;
        iconContainer.style.left = `${iconMargin}px`;
    }
    
    const desktopIcons = document.querySelectorAll('.desktop-icon');
    desktopIcons.forEach(icon => {
        const img = icon.querySelector('img');
        const label = icon.querySelector('.desktop-icon-label');
        if (img) {
            img.style.width = `${iconSize}px`;
            img.style.height = `${iconSize}px`;
        }
        if (label) {
            label.style.fontSize = `${iconFontSize}px`;
        }
    });
}

// Boot Screen Duration Management
function saveBootScreenDuration() {
    const config = loadConfig();
    config.bootScreenDuration = parseFloat(document.getElementById('bootScreenDuration').value) || 3;
    
    saveConfig(config);
    showMessage('✅ Boot screen duration saved successfully!', 'success');
}

// Content Management
function saveContent() {
    const config = loadConfig();
    config.content = {
        bootTitle: document.getElementById('bootTitle').value,
        bootTitleSuffix: document.getElementById('bootTitleSuffix').value,
        bootSubtitle: document.getElementById('bootSubtitle').value,
        bootHint: document.getElementById('bootHint').value,
        bootPortfolio: document.getElementById('bootPortfolio').value,
        loginTitle: document.getElementById('loginTitle').value,
        loginTitleSuffix: document.getElementById('loginTitleSuffix').value,
        loginSubtitle: document.getElementById('loginSubtitle').value,
        userName: document.getElementById('userName').value,
        userRole: document.getElementById('userRole').value
    };
    saveConfig(config);
    
    // Apply boot screen content to main site
    applyBootContentToSite(config.content);
    
    showMessage('✅ Content saved successfully!', 'success');
}

// Apply boot content to main site
function applyBootContentToSite(content) {
    if (!content) return;
    
    // Update boot title
    const bootName = document.querySelector('.boot-name');
    const bootXp = document.querySelector('.boot-xp');
    if (bootName && bootXp) {
        bootName.textContent = content.bootTitle || 'Phukit T.';
        bootXp.textContent = content.bootTitleSuffix || 'xp';
    }
    
    // Update boot subtitle
    const bootSubtitle = document.querySelector('.boot-subtitle');
    if (bootSubtitle) {
        bootSubtitle.textContent = content.bootSubtitle || 'Visual Designer';
    }
    
    // Update boot hint
    const bootHint = document.querySelector('.boot-hint');
    if (bootHint) {
        bootHint.innerHTML = (content.bootHint || 'For the best experience<br>Enter Full Screen (F11)').replace(/\n/g, '<br>');
    }
    
    // Update boot portfolio
    const bootPortfolio = document.querySelector('.boot-portfolio');
    if (bootPortfolio) {
        bootPortfolio.textContent = content.bootPortfolio || 'Portfolio®';
    }
    
    // Update user name in start menu
    const startMenuUser = document.querySelector('.start-menu-user');
    if (startMenuUser) {
        startMenuUser.textContent = content.userName || 'Phukit T.';
    }
}

// Profile Management
function previewAvatar(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('currentAvatar').src = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function uploadAvatar() {
    const input = document.querySelector('#section-profile input[type="file"]');
    if (!input.files || !input.files[0]) {
        logError('Please select an image first', 'uploadAvatar');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const config = loadConfig();
        if (!config.images) config.images = {};
        config.images.avatar = e.target.result;
        saveConfig(config);
        showMessage('✅ Avatar updated successfully!', 'success');
    };
    reader.readAsDataURL(input.files[0]);
}

function saveProfile() {
    const config = loadConfig();
    config.profile = {
        email: document.getElementById('profileEmail').value,
        location: document.getElementById('profileLocation').value,
        instagram: document.getElementById('socialInstagram').value,
        github: document.getElementById('socialGithub').value,
        linkedin: document.getElementById('socialLinkedin').value
    };
    saveConfig(config);
    showMessage('✅ Profile saved successfully!', 'success');
}

// ===== Category Management =====
const defaultCategories = [
    { id: 'all', name: 'All', icon: 'https://cdn-icons-png.flaticon.com/16/1946/1946488.png' },
    { id: 'image', name: 'Image', icon: 'https://cdn-icons-png.flaticon.com/16/1829/1829586.png' },
    { id: 'web', name: 'Web', icon: 'https://cdn-icons-png.flaticon.com/16/1006/1006771.png' },
    { id: 'video', name: 'Video', icon: 'https://cdn-icons-png.flaticon.com/16/1179/1179069.png' },
    { id: 'client', name: 'Client', icon: 'https://cdn-icons-png.flaticon.com/16/1077/1077063.png' },
    { id: 'personal', name: 'Personal', icon: 'https://cdn-icons-png.flaticon.com/16/1077/1077114.png' }
];

function getCategories() {
    const config = loadConfig();
    return config.categories || defaultCategories;
}

function loadCategoriesList() {
    const container = document.getElementById('categoriesList');
    if (!container) return;
    
    const categories = getCategories();
    container.innerHTML = '';
    
    categories.forEach((cat, index) => {
        const item = document.createElement('div');
        item.style.cssText = 'display: flex; align-items: center; gap: 10px; padding: 10px; background: #fff; border: 1px solid #ddd; border-radius: 6px; margin-bottom: 8px;';
        item.innerHTML = `
            <span style="cursor: move; color: #999;">☰</span>
            <img src="${cat.icon}" style="width: 20px; height: 20px; ${cat.hidden ? 'opacity: 0.3;' : ''}" onerror="this.src='https://cdn-icons-png.flaticon.com/16/1946/1946488.png'">
            <input type="text" value="${cat.name}" onchange="updateCategoryName(${index}, this.value)" style="flex: 1; padding: 5px; border: 1px solid #ddd; border-radius: 4px;">
            <input type="text" value="${cat.icon}" onchange="updateCategoryIcon(${index}, this.value)" placeholder="Icon URL" style="flex: 2; padding: 5px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px;">
            <span style="color: #888; font-size: 11px;">${cat.id}</span>
            <label style="display: flex; align-items: center; gap: 4px; font-size: 11px; color: #666; cursor: pointer;" title="Hide this category">
                <input type="checkbox" ${cat.hidden ? 'checked' : ''} onchange="toggleCategoryVisibility(${index}, this.checked)"> Hide
            </label>
            ${cat.id !== 'all' ? `<button onclick="removeCategory(${index})" style="background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">🗑️</button>` : '<span style="width: 40px;"></span>'}
            <button onclick="moveCategoryUp(${index})" style="background: #6c757d; color: white; border: none; padding: 5px 8px; border-radius: 4px; cursor: pointer;" ${index === 0 ? 'disabled' : ''}>↑</button>
            <button onclick="moveCategoryDown(${index})" style="background: #6c757d; color: white; border: none; padding: 5px 8px; border-radius: 4px; cursor: pointer;" ${index === categories.length - 1 ? 'disabled' : ''}>↓</button>
        `;
        container.appendChild(item);
    });
}

function toggleCategoryVisibility(index, hidden) {
    const config = loadConfig();
    if (!config.categories) config.categories = [...defaultCategories];
    
    config.categories[index].hidden = hidden;
    saveConfig(config);
    loadCategoriesList();
}

function saveCategories() {
    showMessage('✅ Categories saved successfully!', 'success');
}

function addCategory() {
    const id = document.getElementById('newCategoryId').value.toLowerCase().trim();
    const name = document.getElementById('newCategoryName').value.trim();
    const icon = document.getElementById('newCategoryIcon').value.trim();
    
    if (!id || !name) {
        logError('Please enter Category ID and Display Name', 'addCategory');
        return;
    }
    
    const config = loadConfig();
    if (!config.categories) config.categories = [...defaultCategories];
    
    // Check if ID already exists
    if (config.categories.some(c => c.id === id)) {
        logError('Category ID already exists: ' + id, 'addCategory');
        return;
    }
    
    config.categories.push({
        id,
        name,
        icon: icon || 'https://cdn-icons-png.flaticon.com/16/1946/1946488.png'
    });
    
    saveConfig(config);
    loadCategoriesList();
    
    // Clear inputs
    document.getElementById('newCategoryId').value = '';
    document.getElementById('newCategoryName').value = '';
    document.getElementById('newCategoryIcon').value = '';
    
    showMessage('✅ Category added!', 'success');
}

function removeCategory(index) {
    const config = loadConfig();
    if (!config.categories) config.categories = [...defaultCategories];
    
    const cat = config.categories[index];
    if (cat.id === 'all') {
        logError('Cannot remove "All" category', 'removeCategory');
        return;
    }
    
    if (confirm(`Remove category "${cat.name}"?`)) {
        config.categories.splice(index, 1);
        saveConfig(config);
        loadCategoriesList();
        showMessage('✅ Category removed!', 'success');
    }
}

function updateCategoryName(index, newName) {
    const config = loadConfig();
    if (!config.categories) config.categories = [...defaultCategories];
    
    config.categories[index].name = newName;
    saveConfig(config);
    showMessage('✅ Category name updated!', 'success');
}

function updateCategoryIcon(index, newIcon) {
    const config = loadConfig();
    if (!config.categories) config.categories = [...defaultCategories];
    
    config.categories[index].icon = newIcon;
    saveConfig(config);
    loadCategoriesList();
    showMessage('✅ Category icon updated!', 'success');
}

function moveCategoryUp(index) {
    if (index === 0) return;
    const config = loadConfig();
    if (!config.categories) config.categories = [...defaultCategories];
    
    [config.categories[index], config.categories[index - 1]] = [config.categories[index - 1], config.categories[index]];
    saveConfig(config);
    loadCategoriesList();
}

function moveCategoryDown(index) {
    const config = loadConfig();
    if (!config.categories) config.categories = [...defaultCategories];
    if (index >= config.categories.length - 1) return;
    
    [config.categories[index], config.categories[index + 1]] = [config.categories[index + 1], config.categories[index]];
    saveConfig(config);
    loadCategoriesList();
}

function resetCategoriesToDefault() {
    if (confirm('Reset all categories to default?')) {
        const config = loadConfig();
        config.categories = [...defaultCategories];
        saveConfig(config);
        loadCategoriesList();
        showMessage('✅ Categories reset to default!', 'success');
    }
}

// Reset Skills & Software to Default
function resetSkillsSoftware() {
    if (confirm('Are you sure you want to reset Skills & Software to default?')) {
        document.getElementById('skillsHeaderTitle').value = 'Skills';
        document.getElementById('aboutSkillsList').value = '🎨 Graphic Design\n🌐 Web Design\n📱 Social Graphics\n🎬 Video Production\n🖥️ UX/UI Design\n💡 Creative Thinking';
        document.getElementById('softwareHeaderTitle').value = 'Software';
        document.getElementById('aboutSoftwareList').value = '🎨 Adobe CC\n💻 VS Code\n🤖 Claude\n🧠 Cursor\n🌐 WordPress';
        
        // Save reset values
        saveSkillsSoftware();
    }
}

// Save Skills & Software
function saveSkillsSoftware() {
    try {
        const config = loadConfig();
        if (!config.aboutMe) config.aboutMe = {};
        
        const skillsTitle = document.getElementById('skillsHeaderTitle').value;
        const skills = document.getElementById('aboutSkillsList').value;
        const softwareTitle = document.getElementById('softwareHeaderTitle').value;
        const software = document.getElementById('aboutSoftwareList').value;
        
        config.aboutMe.skillsTitle = skillsTitle;
        config.aboutMe.skills = skills;
        config.aboutMe.softwareTitle = softwareTitle;
        config.aboutMe.software = software;
        
        saveConfig(config);
        
        // Verify save
        const verify = loadConfig();
        if (!verify.aboutMe || verify.aboutMe.skillsTitle !== skillsTitle) {
            throw new Error('Failed to save config');
        }
        
        // Apply to main site
        const skillsHeader = document.getElementById('skillsHeader');
        if (skillsHeader && skillsTitle) {
            skillsHeader.textContent = skillsTitle;
        }
        
        if (config.aboutMe.skills) {
            const skillsContainer = document.getElementById('aboutSkills');
            if (skillsContainer) {
                const skillsArray = config.aboutMe.skills.split('\n').filter(s => s.trim());
                skillsContainer.innerHTML = skillsArray.map(s => `<div class="sidebar-item">${s}</div>`).join('');
            }
        }
        
        const softwareHeader = document.getElementById('softwareHeader');
        if (softwareHeader && softwareTitle) {
            softwareHeader.textContent = softwareTitle;
        }
        
        if (config.aboutMe.software) {
            const softwareContainer = document.getElementById('aboutSoftware');
            if (softwareContainer) {
                const softwareArray = config.aboutMe.software.split('\n').filter(s => s.trim());
                softwareContainer.innerHTML = softwareArray.map(s => `<div class="sidebar-item">${s}</div>`).join('');
            }
        }
        
        // Show success notification
        alert('✅ Skills & Software saved successfully!');
        showMessage('✅ Skills & Software saved successfully!', 'success');
        
    } catch (error) {
        console.error('Save error:', error);
        alert('❌ Failed to save Skills & Software: ' + error.message);
        logError('Failed to save Skills & Software', 'saveSkillsSoftware: ' + error.message);
    }
}

// About Me Management
function saveAboutMe() {
    const config = loadConfig();
    config.aboutMe = {
        title: document.getElementById('aboutMeTitle').value,
        paragraph1: document.getElementById('aboutPara1').value,
        paragraph2: document.getElementById('aboutPara2').value,
        paragraph3: document.getElementById('aboutPara3').value,
        paragraph4: document.getElementById('aboutPara4').value,
        sidebarColor: document.getElementById('aboutSidebarColor').value,
        mainColor: document.getElementById('aboutMainColor').value,
        titleSize: document.getElementById('aboutTitleSize').value,
        fontSize: document.getElementById('aboutFontSize').value,
        avatarSize: document.getElementById('aboutAvatarSize').value,
        skills: document.getElementById('aboutSkillsList').value,
        software: document.getElementById('aboutSoftwareList').value
    };
    saveConfig(config);
    showMessage('✅ About Me saved successfully!', 'success');
}

function uploadAboutAvatar(input, num) {
    if (!input.files || !input.files[0]) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const config = loadConfig();
        if (!config.images) config.images = {};
        if (!config.images.aboutAvatars) config.images.aboutAvatars = {};
        config.images.aboutAvatars[`avatar${num}`] = e.target.result;
        saveConfig(config);
        
        const preview = document.getElementById(`previewAvatar${num}`);
        if (preview) {
            preview.src = e.target.result;
        }
        showMessage(`✅ Avatar ${num} uploaded!`, 'success');
    };
    reader.readAsDataURL(input.files[0]);
}

function clearAboutAvatar(num) {
    const config = loadConfig();
    if (config.images && config.images.aboutAvatars) {
        delete config.images.aboutAvatars[`avatar${num}`];
        saveConfig(config);
    }
    const preview = document.getElementById(`previewAvatar${num}`);
    if (preview) {
        preview.src = '';
    }
    showMessage(`Avatar ${num} cleared`, 'success');
}

// CV/Resume Management
function uploadCVImage(input) {
    if (!input.files || !input.files[0]) return;
    
    const file = input.files[0];
    const maxSize = 2 * 1024 * 1024; // 2MB limit
    
    // Check file size
    if (file.size > maxSize) {
        // Compress image if too large
        compressImage(file, 0.7, function(compressedData) {
            saveCVImage(compressedData);
        });
    } else {
        const reader = new FileReader();
        reader.onload = function(e) {
            saveCVImage(e.target.result);
        };
        reader.onerror = function() {
            logError('Error reading CV file', 'uploadCVImage');
        };
        reader.readAsDataURL(file);
    }
}

function compressImage(file, quality, callback) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const maxWidth = 800;
            const maxHeight = 1132; // A4 ratio
            let width = img.width;
            let height = img.height;
            
            if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
            }
            if (height > maxHeight) {
                width = (width * maxHeight) / height;
                height = maxHeight;
            }
            
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            callback(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function saveCVImage(imageData) {
    try {
        const config = loadConfig();
        if (!config.images) config.images = {};
        config.images.cvImage = imageData;
        saveConfig(config);
        
        const preview = document.getElementById('currentCVPreview');
        if (preview) {
            preview.src = imageData;
            preview.style.display = 'block';
        }
        showMessage('✅ CV image uploaded!', 'success');
    } catch (e) {
        logError('Image too large. Please use a smaller image.', 'saveCVImage: ' + e.message);
    }
}

function clearCVImage() {
    const config = loadConfig();
    if (config.images) {
        delete config.images.cvImage;
        saveConfig(config);
    }
    const preview = document.getElementById('currentCVPreview');
    if (preview) {
        preview.src = '';
        preview.style.display = 'none';
    }
    showMessage('CV image cleared', 'success');
}

function saveResumeSettings() {
    const config = loadConfig();
    if (!config.resume) config.resume = {};
    config.resume.bgColor = document.getElementById('resumeBgColor').value;
    saveConfig(config);
    showMessage('✅ Resume settings saved!', 'success');
}

// Projects Management
function loadProjectsList() {
    const config = loadConfig();
    const container = document.getElementById('projectsList');
    if (!container) return;
    
    const projects = config.projects || [];
    
    if (projects.length === 0) {
        container.innerHTML = '<p style="color: #888; font-style: italic; padding: 15px; text-align: center; background: #f8f9fa; border-radius: 6px; border: 1px dashed #ddd;">No projects yet. Add your first project below.</p>';
        return;
    }
    
    container.innerHTML = `
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
                <tr style="background: #f8f9fa; border-bottom: 2px solid #e0e0e0;">
                    <th style="padding: 12px 15px; text-align: left; font-weight: 600; color: #333;">#</th>
                    <th style="padding: 12px 15px; text-align: left; font-weight: 600; color: #333;">Color</th>
                    <th style="padding: 12px 15px; text-align: left; font-weight: 600; color: #333;">Title</th>
                    <th style="padding: 12px 15px; text-align: left; font-weight: 600; color: #333;">Category</th>
                    <th style="padding: 12px 15px; text-align: left; font-weight: 600; color: #333;">Banners</th>
                    <th style="padding: 12px 15px; text-align: center; font-weight: 600; color: #333;">Actions</th>
                </tr>
            </thead>
            <tbody>
                ${projects.map((project, index) => `
                    <tr style="border-bottom: 1px solid #eee; transition: background 0.2s;" onmouseover="this.style.background='#f8f9fc'" onmouseout="this.style.background='#fff'">
                        <td style="padding: 12px 15px; color: #666;">${index + 1}</td>
                        <td style="padding: 12px 15px;">
                            <div style="width: 50px; height: 25px; border-radius: 4px; background: linear-gradient(135deg, ${project.color1} 0%, ${project.color2} 100%); border: 1px solid #ddd;"></div>
                        </td>
                        <td style="padding: 12px 15px;">
                            <strong style="color: #333;">${project.title}</strong>
                            <div style="font-size: 11px; color: #888; margin-top: 2px;">${project.desc || ''}</div>
                        </td>
                        <td style="padding: 12px 15px;">
                            <span style="background: #e3f2fd; color: #1976d2; font-size: 11px; padding: 3px 10px; border-radius: 12px; text-transform: capitalize;">${project.category}</span>
                        </td>
                        <td style="padding: 12px 15px;">
                            ${project.banners && project.banners.length > 0 
                                ? `<span style="background: #e8f5e9; color: #388e3c; font-size: 11px; padding: 3px 10px; border-radius: 12px;">${project.banners.length} images</span>` 
                                : '<span style="color: #999; font-size: 11px;">None</span>'}
                        </td>
                        <td style="padding: 12px 15px; text-align: center;">
                            <button onclick="editProject(${index})" style="background: #667eea; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px; margin-right: 5px;" title="Edit">✏️ Edit</button>
                            <button onclick="deleteProject(${index})" style="background: #dc3545; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px;" title="Delete">🗑️</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// Temporary storage for banner images (stores {id, data} objects)
window.tempProjectBanners = [];

async function uploadProjectBanner(input, index) {
    console.log('uploadProjectBanner called with index:', index);
    if (!input.files || !input.files[0]) {
        console.log('No file selected');
        return;
    }
    
    const file = input.files[0];
    console.log('File selected:', file.name, file.size);
    
    // Show loading state
    const preview = document.getElementById(`bannerPreview${index}`);
    if (preview) {
        preview.style.display = 'block';
        preview.style.opacity = '0.5';
    }
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        const imageData = e.target.result;
        const imageId = generateImageId();
        
        console.log('File read successfully, saving to IndexedDB...');
        
        try {
            // Save to IndexedDB
            if (imageDB) {
                await saveImageToDB(imageId, imageData);
                console.log('Image saved to IndexedDB:', imageId);
            }
            
            // Store reference (ID and data for preview)
            window.tempProjectBanners[index] = {
                id: imageId,
                data: imageData
            };
            
            // Update preview
            if (preview) {
                preview.src = imageData;
                preview.style.display = 'block';
                preview.style.opacity = '1';
            }
            
            console.log('Banner', index, 'uploaded successfully');
            showMessage(`✅ Banner ${index + 1} uploaded!`, 'success');
        } catch (err) {
            console.error('Error saving to IndexedDB:', err);
            // Fallback: store base64 directly
            window.tempProjectBanners[index] = {
                id: imageId,
                data: imageData
            };
            if (preview) {
                preview.src = imageData;
                preview.style.display = 'block';
                preview.style.opacity = '1';
            }
            showMessage(`✅ Banner ${index + 1} uploaded!`, 'success');
        }
    };
    reader.onerror = function(e) {
        console.error('Error reading file:', e);
        logError('เกิดข้อผิดพลาดในการอ่านไฟล์', 'uploadProjectBanner');
        if (preview) preview.style.opacity = '1';
    };
    reader.readAsDataURL(file);
}

// Make function globally accessible
window.uploadProjectBanner = uploadProjectBanner;

function addProject() {
    console.log('addProject called');
    
    const title = document.getElementById('newProjectTitle').value;
    const category = document.getElementById('newProjectCategory').value;
    const desc = document.getElementById('newProjectDesc').value;
    const color1 = document.getElementById('newProjectColor1').value;
    const color2 = document.getElementById('newProjectColor2').value;
    const count = document.getElementById('newProjectCount').value;
    const brief = document.getElementById('newProjectBrief').value;
    const description = document.getElementById('newProjectDescription').value;
    const url = document.getElementById('newProjectUrl').value;
    
    // Collect banner images - extract data from {id, data} objects
    const banners = window.tempProjectBanners 
        ? window.tempProjectBanners.filter(b => b).map(b => b.data || b) 
        : [];
    
    console.log('Project data:', { title, category, desc, banners: banners.length });
    
    if (!title) {
        logError('Please enter a project title', 'addProject');
        return;
    }
    
    const config = loadConfig();
    if (!config.projects) config.projects = [];
    
    const newProject = {
        title,
        category,
        desc: desc || `Personal Work • ${category.charAt(0).toUpperCase() + category.slice(1)}`,
        color1,
        color2,
        count: count || '1 Item',
        brief: brief || '',
        description: description || '',
        banners: banners,
        url
    };
    
    config.projects.push(newProject);
    saveConfig(config);
    
    console.log('Project saved:', newProject);
    
    loadProjectsList();
    
    // Clear inputs
    document.getElementById('newProjectTitle').value = '';
    document.getElementById('newProjectDesc').value = '';
    document.getElementById('newProjectBrief').value = '';
    document.getElementById('newProjectDescription').value = '';
    document.getElementById('newProjectUrl').value = '';
    
    // Clear banner previews
    window.tempProjectBanners = [];
    for (let i = 0; i < 5; i++) {
        const preview = document.getElementById(`bannerPreview${i}`);
        if (preview) {
            preview.src = '';
            preview.style.display = 'none';
        }
    }
    
    showMessage('✅ Project added successfully!', 'success');
    console.log('Project added successfully');
    
    // Navigate back to projects list
    showSection('projects');
}

// Track editing state
window.editingProjectIndex = null;

function editProject(index) {
    const config = loadConfig();
    const project = config.projects[index];
    if (!project) return;
    
    // Set editing mode
    window.editingProjectIndex = index;
    
    // Populate form with project data
    document.getElementById('newProjectTitle').value = project.title || '';
    document.getElementById('newProjectCategory').value = project.category || 'web';
    document.getElementById('newProjectDesc').value = project.desc || '';
    document.getElementById('newProjectColor1').value = project.color1 || '#667eea';
    document.getElementById('newProjectColor2').value = project.color2 || '#764ba2';
    document.getElementById('newProjectCount').value = project.count || '1 Item';
    document.getElementById('newProjectBrief').value = project.brief || '';
    document.getElementById('newProjectDescription').value = project.description || '';
    document.getElementById('newProjectUrl').value = project.url || '';
    
    // Load existing banners - convert to {id, data} format
    window.tempProjectBanners = [];
    if (project.banners) {
        project.banners.forEach((banner, i) => {
            // Handle both old format (string) and new format ({id, data})
            const bannerData = typeof banner === 'string' ? banner : (banner.data || banner);
            window.tempProjectBanners[i] = {
                id: generateImageId(),
                data: bannerData
            };
        });
    }
    
    for (let i = 0; i < 5; i++) {
        const preview = document.getElementById(`bannerPreview${i}`);
        if (preview) {
            const banner = window.tempProjectBanners[i];
            if (banner && banner.data) {
                preview.src = banner.data;
                preview.style.display = 'block';
            } else {
                preview.src = '';
                preview.style.display = 'none';
            }
        }
    }
    
    // Update section title and button
    const sectionTitle = document.getElementById('addProjectTitle');
    if (sectionTitle) sectionTitle.textContent = '✏️ Edit Project: ' + project.title;
    
    const saveBtn = document.getElementById('saveProjectBtn');
    if (saveBtn) {
        saveBtn.textContent = '💾 Update Project';
        saveBtn.onclick = function() { saveProject(); };
    }
    
    // Show cancel button
    const cancelBtn = document.getElementById('cancelEditBtn');
    if (cancelBtn) cancelBtn.style.display = 'inline-block';
    
    // Navigate to Add Project section
    showSection('addproject');
    
    // Focus on title field
    setTimeout(() => {
        document.getElementById('newProjectTitle').focus();
    }, 100);
}

function cancelEdit() {
    window.editingProjectIndex = null;
    clearProjectForm();
    
    // Reset section title
    const sectionTitle = document.getElementById('addProjectTitle');
    if (sectionTitle) sectionTitle.textContent = 'Add New Project';
    
    // Reset button
    const saveBtn = document.getElementById('saveProjectBtn');
    if (saveBtn) {
        saveBtn.textContent = 'Add Project';
        saveBtn.onclick = function() { addProject(); };
    }
    
    // Hide cancel button
    const cancelBtn = document.getElementById('cancelEditBtn');
    if (cancelBtn) cancelBtn.style.display = 'none';
}

function saveProject() {
    const title = document.getElementById('newProjectTitle').value;
    const category = document.getElementById('newProjectCategory').value;
    const desc = document.getElementById('newProjectDesc').value;
    const color1 = document.getElementById('newProjectColor1').value;
    const color2 = document.getElementById('newProjectColor2').value;
    const count = document.getElementById('newProjectCount').value;
    const brief = document.getElementById('newProjectBrief').value;
    const description = document.getElementById('newProjectDescription').value;
    const url = document.getElementById('newProjectUrl').value;
    // Extract data from {id, data} objects
    const banners = window.tempProjectBanners.filter(b => b).map(b => b.data || b);
    
    if (!title) {
        logError('Please enter a project title', 'saveProject');
        return;
    }
    
    const config = loadConfig();
    if (!config.projects) config.projects = [];
    
    const projectData = {
        title,
        category,
        desc: desc || `Personal Work • ${category.charAt(0).toUpperCase() + category.slice(1)}`,
        color1,
        color2,
        count: count || '1 Item',
        brief: brief || '',
        description: description || '',
        banners: banners,
        url
    };
    
    if (window.editingProjectIndex !== null) {
        // Update existing project
        config.projects[window.editingProjectIndex] = projectData;
        showMessage('✅ Project updated!', 'success');
    } else {
        // Add new project
        config.projects.push(projectData);
        showMessage('✅ Project added!', 'success');
    }
    
    saveConfig(config);
    loadProjectsList();
    clearProjectForm();
    
    // Reset section title
    const sectionTitle = document.getElementById('addProjectTitle');
    if (sectionTitle) sectionTitle.textContent = 'Add New Project';
    
    // Reset button
    const saveBtn = document.getElementById('saveProjectBtn');
    if (saveBtn) {
        saveBtn.textContent = 'Add Project';
        saveBtn.onclick = function() { addProject(); };
    }
    
    // Hide cancel button
    const cancelBtn = document.getElementById('cancelEditBtn');
    if (cancelBtn) cancelBtn.style.display = 'none';
    
    window.editingProjectIndex = null;
    
    // Navigate back to projects list
    showSection('projects');
}

function clearProjectForm() {
    document.getElementById('newProjectTitle').value = '';
    document.getElementById('newProjectCategory').value = 'web';
    document.getElementById('newProjectDesc').value = '';
    document.getElementById('newProjectColor1').value = '#667eea';
    document.getElementById('newProjectColor2').value = '#764ba2';
    document.getElementById('newProjectCount').value = '1 Item';
    document.getElementById('newProjectBrief').value = '';
    document.getElementById('newProjectDescription').value = '';
    document.getElementById('newProjectUrl').value = '';
    
    // Clear banner previews
    window.tempProjectBanners = [];
    for (let i = 0; i < 5; i++) {
        const preview = document.getElementById(`bannerPreview${i}`);
        if (preview) {
            preview.src = '';
            preview.style.display = 'none';
        }
    }
}

function deleteProject(index) {
    if (!confirm('Delete this project?')) return;
    
    const config = loadConfig();
    if (config.projects) {
        config.projects.splice(index, 1);
        saveConfig(config);
        loadProjectsList();
        showMessage('Project deleted', 'success');
    }
}

// CRT Effect Settings
function updateCrtPreview() {
    const scanline = document.getElementById('crtScanlineOpacity').value;
    const vignette = document.getElementById('crtVignetteOpacity').value;
    const brightness = document.getElementById('crtBrightness').value;
    document.getElementById('crtScanlineValue').textContent = scanline + '%';
    document.getElementById('crtVignetteValue').textContent = vignette + '%';
    document.getElementById('crtBrightnessValue').textContent = brightness + '%';
}

function saveCrtSettings() {
    const config = loadConfig();
    config.crtEffect = {
        scanlineOpacity: parseFloat(document.getElementById('crtScanlineOpacity').value) || 0.5,
        vignetteOpacity: parseInt(document.getElementById('crtVignetteOpacity').value) || 0,
        brightness: parseInt(document.getElementById('crtBrightness').value) || 100
    };
    saveConfig(config);
    showMessage('✅ CRT settings saved successfully!', 'success');
}

// Settings Management
async function changePassword() {
    const newPw = document.getElementById('newPassword').value;
    const confirmPw = document.getElementById('confirmPassword').value;
    if (newPw.length < 8) { showMessage('Password must be at least 8 characters', 'error'); return; }
    if (newPw !== confirmPw) { showMessage('Passwords do not match', 'error'); return; }
    const hash = await hashPassword(newPw);
    localStorage.setItem(PASSWORD_KEY, hash);
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';
    showMessage('Password updated', 'success');
}

function exportConfig() {
    const config = loadConfig();
    const dataStr = JSON.stringify(config, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'xp-portfolio-config.json';
    link.click();
    URL.revokeObjectURL(url);
    showMessage('✅ Configuration exported!', 'success');
}

function importConfig(input) {
    if (!input.files || !input.files[0]) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const config = JSON.parse(e.target.result);
            saveConfig(config);
            loadAllData();
            showMessage('✅ Configuration imported successfully!', 'success');
        } catch (error) {
            logError('Invalid configuration file', 'importConfig: ' + error.message);
        }
    };
    reader.readAsText(input.files[0]);
}

// Key for storing default configuration
const DEFAULT_CONFIG_KEY = 'xp_portfolio_default_config';

// Save current config as new default
function saveAsDefault() {
    if (!confirm('💾 บันทึกการตั้งค่าปัจจุบันเป็นค่าเริ่มต้นใหม่?')) {
        return;
    }
    
    const currentConfig = loadConfig();
    localStorage.setItem(DEFAULT_CONFIG_KEY, JSON.stringify(currentConfig));
    showMessage('✅ บันทึกเป็นค่าเริ่มต้นใหม่สำเร็จ!', 'success');
}

// Load saved default config
function loadDefaultConfig() {
    const savedDefault = localStorage.getItem(DEFAULT_CONFIG_KEY);
    if (savedDefault) {
        try {
            return JSON.parse(savedDefault);
        } catch (e) {
            return null;
        }
    }
    return null;
}

function resetToDefaults() {
    const savedDefault = loadDefaultConfig();
    const hasCustomDefault = savedDefault !== null;
    
    const message = hasCustomDefault 
        ? '⚠️ รีเซ็ตกลับเป็นค่าเริ่มต้นที่คุณบันทึกไว้?' 
        : '⚠️ รีเซ็ตกลับเป็นค่าเริ่มต้นของระบบ?';
    
    if (!confirm(message)) {
        return;
    }
    
    if (!confirm('⚠️ ยืนยันอีกครั้ง! การกระทำนี้ไม่สามารถย้อนกลับได้!')) {
        return;
    }
    
    if (hasCustomDefault) {
        // Reset to saved default
        localStorage.setItem(CONFIG_KEY, JSON.stringify(savedDefault));
    } else {
        // Reset to system default (remove config)
        localStorage.removeItem(CONFIG_KEY);
    }
    
    loadAllData();
    showMessage('✅ รีเซ็ตเป็นค่าเริ่มต้นสำเร็จ!', 'success');
}

// Utility Functions
function showMessage(text, type) {
    const existingMsg = document.querySelector('.message');
    if (existingMsg) existingMsg.remove();
    
    const message = document.createElement('div');
    message.className = `message ${type}`;
    message.textContent = text;
    message.style.cssText = 'padding: 10px 15px; margin-bottom: 15px; border-radius: 4px; font-size: 13px; font-weight: bold;';
    
    if (type === 'success') {
        message.style.background = '#d4edda';
        message.style.color = '#155724';
        message.style.border = '1px solid #c3e6cb';
    } else if (type === 'error') {
        message.style.background = '#f8d7da';
        message.style.color = '#721c24';
        message.style.border = '1px solid #f5c6cb';
    }
    
    const activeSection = document.querySelector('.admin-section.active');
    if (activeSection) {
        activeSection.insertBefore(message, activeSection.firstChild);
    } else {
        // Fallback: show as fixed toast
        message.style.cssText += 'position: fixed; top: 20px; right: 20px; z-index: 9999; box-shadow: 0 4px 12px rgba(0,0,0,0.3);';
        document.body.appendChild(message);
    }
    
    setTimeout(() => message.remove(), 3000);
}

// Apply saved config to main site (called from index.html)
function applyConfigToSite() {
    const config = loadConfig();
    
    // Apply boot screen
    if (config.images) {
        const bootScreen = document.getElementById('bootScreen');
        if (bootScreen) {
            if (config.images.bootScreenColor) {
                bootScreen.style.backgroundImage = 'none';
                bootScreen.style.backgroundColor = config.images.bootScreenColor;
            } else if (config.images.bootScreen) {
                bootScreen.style.backgroundImage = `url(${config.images.bootScreen})`;
                bootScreen.style.backgroundColor = '';
            }
        }
    }
    
    // Apply boot text
    if (config.bootText) {
        applyBootTextToSite(config.bootText);
    }
    
    // Apply boot loader settings
    if (config.bootLoader) {
        applyBootLoaderToSite(config.bootLoader);
    }
    
    // Apply icon size
    if (config.iconSize) {
        applyIconSizeToSite(config.iconSize);
    }
    
    // Apply boot and login icons
    if (config.images) {
        if (config.images.bootLogo) {
            const bootLogo = document.querySelector('.boot-logo');
            if (bootLogo) bootLogo.src = config.images.bootLogo;
        }
        if (config.images.loginAvatar) {
            const loginAvatar = document.querySelector('.login-avatar');
            if (loginAvatar) loginAvatar.src = config.images.loginAvatar;
        }
    }
    
    // Apply wallpaper
    if (config.images) {
        const desktop = document.getElementById('desktop');
        if (desktop) {
            if (config.images.wallpaperColor) {
                desktop.style.backgroundImage = 'none';
                desktop.style.backgroundColor = config.images.wallpaperColor;
            } else if (config.images.wallpaper) {
                desktop.style.backgroundImage = `url(${config.images.wallpaper})`;
                desktop.style.backgroundColor = '';
            }
        }
    }
    
    // Apply content
    if (config.content) {
        // Boot screen
        const bootTitle = document.querySelector('.boot-title');
        if (bootTitle) {
            bootTitle.innerHTML = `${config.content.bootTitle}<span>${config.content.bootTitleSuffix}</span>`;
        }
        
        const bootSubtitle = document.querySelector('.boot-subtitle');
        if (bootSubtitle) {
            bootSubtitle.textContent = config.content.bootSubtitle;
        }
        
        // Login screen
        const loginTitle = document.querySelector('.login-brand-title');
        if (loginTitle) {
            loginTitle.innerHTML = `${config.content.loginTitle}<span>${config.content.loginTitleSuffix}</span>`;
        }
        
        // Update all user name instances
        document.querySelectorAll('.login-user-name, .start-menu-user').forEach(el => {
            el.textContent = config.content.userName;
        });
    }
    
    // Apply avatar
    if (config.images && config.images.avatar) {
        document.querySelectorAll('.login-avatar img, .start-menu-avatar img, .about-avatar img').forEach(img => {
            img.src = config.images.avatar;
        });
    }
    
    // Apply desktop icons
    applyIconsToSite();
    
    // Apply profile
    if (config.profile) {
        document.querySelectorAll('[href*="instagram"]').forEach(link => {
            link.href = config.profile.instagram;
        });
        document.querySelectorAll('[href*="github"]').forEach(link => {
            link.href = config.profile.github;
        });
        document.querySelectorAll('[href*="linkedin"]').forEach(link => {
            link.href = config.profile.linkedin;
        });
    }
}

// Apply icons to BOTH Desktop and Start Menu
function applyIconsToSite() {
    const config = loadConfig();
    if (!config.images || !config.images.icons) return;
    
    const icons = config.images.icons;
    const iconKeys = ['about', 'resume', 'projects', 'contact'];
    
    iconKeys.forEach(key => {
        if (icons[key]) {
            // Apply to Desktop icon
            const desktopIcon = document.querySelector(`.desktop-icon[data-window="${key}"] img`);
            if (desktopIcon) desktopIcon.src = icons[key];
            
            // Apply to Start Menu icon
            const startMenuIcon = document.querySelector(`.start-menu-item[data-window="${key}"] img`);
            if (startMenuIcon) startMenuIcon.src = icons[key];
            
            // Apply to Window titlebar icon
            const windowIcon = document.querySelector(`#window-${key} .window-titlebar-icon`);
            if (windowIcon) windowIcon.src = icons[key];
            
            // Apply to Toolbar icon (About Me window)
            const toolbarIcon = document.querySelector(`.toolbar-icon[data-window="${key}"]`);
            if (toolbarIcon) toolbarIcon.src = icons[key];
        }
    });
}

// ==========================================
// My Projects - Main Site Rendering
// ==========================================

const PROJECT_ICONS = {
    web: 'https://cdn-icons-png.flaticon.com/16/1006/1006771.png',
    image: 'https://cdn-icons-png.flaticon.com/16/1829/1829586.png',
    video: 'https://cdn-icons-png.flaticon.com/16/1179/1179069.png',
    client: 'https://cdn-icons-png.flaticon.com/16/1077/1077063.png',
    personal: 'https://cdn-icons-png.flaticon.com/16/1077/1077114.png',
    app: 'https://cdn-icons-png.flaticon.com/16/2586/2586488.png',
    branding: 'https://cdn-icons-png.flaticon.com/16/3135/3135706.png',
    art: 'https://cdn-icons-png.flaticon.com/16/2829/2829076.png'
};

let currentSlideIndex = 0;
let currentFilter = 'all';

function renderProjectsOnMainSite(filter = 'all') {
    const config = JSON.parse(localStorage.getItem('xp_portfolio_config') || '{}');
    const projects = config.projects || [];
    const grid = document.getElementById('projectsGrid');
    
    if (!grid) return;
    
    currentFilter = filter;
    grid.innerHTML = '';
    
    // Filter projects
    const filtered = filter === 'all' 
        ? projects 
        : projects.filter(p => p.category === filter);
    
    if (filtered.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #888;">
                <p style="font-size: 48px; margin-bottom: 10px;">📁</p>
                <p>No projects found${filter !== 'all' ? ' in this category' : ''}.</p>
                <p style="font-size: 12px; margin-top: 10px;">Add projects via Admin Panel</p>
            </div>
        `;
        return;
    }
    
    filtered.forEach((project, idx) => {
        const originalIndex = projects.indexOf(project);
        const card = createProjectCard(project, originalIndex);
        grid.appendChild(card);
    });
    
    setupProjectSearch();
    setupCategoryFilter();
}

function createProjectCard(project, index) {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.dataset.category = project.category;
    card.dataset.index = index;
    card.dataset.title = project.title.toLowerCase();
    
    // Get thumbnail
    let thumbStyle = '';
    const bannerData = project.banners && project.banners[0];
    if (bannerData) {
        const imgSrc = typeof bannerData === 'object' ? bannerData.data : bannerData;
        thumbStyle = `background-image: url('${imgSrc}'); background-size: cover; background-position: center;`;
    } else {
        thumbStyle = `background: linear-gradient(135deg, ${project.color1 || '#667eea'} 0%, ${project.color2 || '#764ba2'} 100%);`;
    }
    
    card.innerHTML = `
        <div class="project-thumb" style="${thumbStyle}">
            <span class="project-count">${project.count || '1 Item'}</span>
        </div>
        <div class="project-info">
            <img src="${PROJECT_ICONS[project.category] || PROJECT_ICONS.web}" alt="${project.category}">
            <div>
                <h4>${project.title}</h4>
                <span>${project.desc || project.category}</span>
            </div>
        </div>
    `;
    
    card.addEventListener('click', () => openProjectDetail(index));
    return card;
}

function openProjectDetail(index) {
    const config = JSON.parse(localStorage.getItem('xp_portfolio_config') || '{}');
    const project = config.projects?.[index];
    if (!project) return;
    
    const grid = document.getElementById('projectsGrid');
    const detail = document.getElementById('projectDetail');
    if (!grid || !detail) return;
    
    // Populate detail view
    const setContent = (id, content) => {
        const el = document.getElementById(id);
        if (el) el.textContent = content;
    };
    
    setContent('projectDetailTitle', project.title);
    setContent('projectDetailCat', project.category.charAt(0).toUpperCase() + project.category.slice(1));
    setContent('projectDetailType', project.desc?.includes('Client') ? 'Client Work' : 'Personal Work');
    setContent('projectDetailBrief', project.brief || 'No brief available.');
    setContent('projectDetailDesc', project.description || 'No description available.');
    
    // Project icon
    const iconEl = document.getElementById('projectDetailIcon');
    if (iconEl) {
        iconEl.style.background = `linear-gradient(135deg, ${project.color1 || '#667eea'}, ${project.color2 || '#764ba2'})`;
    }
    
    // Visit URL button
    const urlBtn = document.getElementById('projectDetailUrl');
    if (urlBtn) {
        urlBtn.style.display = project.url ? 'inline-block' : 'none';
        urlBtn.href = project.url || '#';
    }
    
    // Setup slider
    setupProjectSlider(project);
    
    // Setup suggested projects
    setupSuggestedProjects(index, config.projects);
    
    // Show detail view
    grid.style.display = 'none';
    detail.style.display = 'block';
    
    // Setup back button
    const backBtn = document.getElementById('projectDetailBack');
    if (backBtn) {
        backBtn.onclick = () => {
            detail.style.display = 'none';
            grid.style.display = 'grid';
        };
    }
}

function setupProjectSlider(project) {
    const container = document.getElementById('projectSliderContainer');
    const dotsContainer = document.getElementById('sliderDots');
    if (!container) return;
    
    const banners = project.banners || [];
    currentSlideIndex = 0;
    
    if (banners.length > 0) {
        container.innerHTML = banners.map((banner, i) => {
            const imgSrc = typeof banner === 'object' ? banner.data : banner;
            return `<div class="project-slide" style="background-image: url('${imgSrc}'); background-size: cover; background-position: center;"></div>`;
        }).join('');
        
        if (dotsContainer) {
            dotsContainer.innerHTML = banners.map((_, i) => 
                `<div class="slider-dot ${i === 0 ? 'active' : ''}" data-slide="${i}"></div>`
            ).join('');
            
            dotsContainer.querySelectorAll('.slider-dot').forEach(dot => {
                dot.addEventListener('click', () => goToSlide(parseInt(dot.dataset.slide)));
            });
        }
    } else {
        container.innerHTML = `<div class="project-slide" style="background: linear-gradient(135deg, ${project.color1 || '#667eea'}, ${project.color2 || '#764ba2'});"></div>`;
        if (dotsContainer) dotsContainer.innerHTML = '';
    }
    
    container.style.transform = 'translateX(0)';
    
    // Slider navigation
    const prevBtn = document.getElementById('sliderPrev');
    const nextBtn = document.getElementById('sliderNext');
    
    if (prevBtn) prevBtn.onclick = () => navigateSlide(-1, banners.length);
    if (nextBtn) nextBtn.onclick = () => navigateSlide(1, banners.length);
}

function navigateSlide(direction, total) {
    if (total <= 1) return;
    currentSlideIndex = (currentSlideIndex + direction + total) % total;
    goToSlide(currentSlideIndex);
}

function goToSlide(index) {
    const container = document.getElementById('projectSliderContainer');
    const dots = document.querySelectorAll('#sliderDots .slider-dot');
    
    if (container) {
        container.style.transform = `translateX(-${index * 100}%)`;
    }
    
    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === index);
    });
    
    currentSlideIndex = index;
}

function setupSuggestedProjects(currentIndex, allProjects) {
    const container = document.getElementById('projectSuggested');
    if (!container || !allProjects) return;
    
    const suggested = allProjects
        .filter((_, i) => i !== currentIndex)
        .slice(0, 3);
    
    container.innerHTML = suggested.map((p, i) => {
        const originalIndex = allProjects.indexOf(p);
        const bannerData = p.banners && p.banners[0];
        let thumbStyle = '';
        
        if (bannerData) {
            const imgSrc = typeof bannerData === 'object' ? bannerData.data : bannerData;
            thumbStyle = `background-image: url('${imgSrc}'); background-size: cover;`;
        } else {
            thumbStyle = `background: linear-gradient(135deg, ${p.color1 || '#667eea'}, ${p.color2 || '#764ba2'});`;
        }
        
        return `
            <div class="suggested-project" onclick="openProjectDetail(${originalIndex})" style="cursor: pointer;">
                <div class="suggested-thumb" style="${thumbStyle}"></div>
                <div class="suggested-info">
                    <strong>${p.title}</strong>
                    <span>${p.category}</span>
                </div>
            </div>
        `;
    }).join('');
}

function setupProjectSearch() {
    const searchInput = document.getElementById('projectSearch');
    if (!searchInput) return;
    
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const cards = document.querySelectorAll('#projectsGrid .project-card');
        
        cards.forEach(card => {
            const title = card.dataset.title || '';
            card.style.display = title.includes(query) ? 'block' : 'none';
        });
    });
}

function setupCategoryFilter() {
    // Render categories from config
    const sidebar = document.querySelector('.projects-sidebar');
    if (sidebar) {
        const config = JSON.parse(localStorage.getItem('xp_portfolio_config') || '{}');
        const categories = config.categories || [
            { id: 'all', name: 'All', icon: 'https://cdn-icons-png.flaticon.com/16/1946/1946488.png' },
            { id: 'image', name: 'Image', icon: 'https://cdn-icons-png.flaticon.com/16/1829/1829586.png' },
            { id: 'web', name: 'Web', icon: 'https://cdn-icons-png.flaticon.com/16/1006/1006771.png' },
            { id: 'video', name: 'Video', icon: 'https://cdn-icons-png.flaticon.com/16/1179/1179069.png' },
            { id: 'client', name: 'Client', icon: 'https://cdn-icons-png.flaticon.com/16/1077/1077063.png' },
            { id: 'personal', name: 'Personal', icon: 'https://cdn-icons-png.flaticon.com/16/1077/1077114.png' }
        ];
        
        // Filter out hidden categories
        const visibleCategories = categories.filter(cat => !cat.hidden);
        
        sidebar.innerHTML = visibleCategories.map(cat => `
            <div class="projects-category ${cat.id === currentFilter ? 'active' : ''}" data-filter="${cat.id}">
                <img src="${cat.icon}" alt="" onerror="this.src='https://cdn-icons-png.flaticon.com/16/1946/1946488.png'"> ${cat.name}
            </div>
        `).join('');
    }
    
    // Setup click handlers
    const categoryElements = document.querySelectorAll('.projects-category');
    categoryElements.forEach(cat => {
        cat.onclick = () => {
            categoryElements.forEach(c => c.classList.remove('active'));
            cat.classList.add('active');
            renderProjectsOnMainSite(cat.dataset.filter);
        };
    });
}

// Export for use in main site and admin panel
if (typeof window !== 'undefined') {
    window.applyConfigToSite = applyConfigToSite;
    window.renderProjectsOnMainSite = renderProjectsOnMainSite;
    window.openProjectDetail = openProjectDetail;
    
    // Project management functions
    window.addProject = addProject;
    window.editProject = editProject;
    window.deleteProject = deleteProject;
    window.saveProject = saveProject;
    window.cancelEdit = cancelEdit;
    window.clearProjectForm = clearProjectForm;
    window.loadProjectsList = loadProjectsList;
    
    // Wallpaper functions
    window.uploadWallpaper = uploadWallpaper;
    window.resetWallpaper = resetWallpaper;
    window.previewWallpaper = previewWallpaper;
    window.applyWallpaperColor = applyWallpaperColor;
    window.removeWallpaperImage = removeWallpaperImage;
    window.removeWallpaperColor = removeWallpaperColor;
    
    // Boot screen functions
    window.uploadBootScreen = uploadBootScreen;
    window.resetBootScreen = resetBootScreen;
    window.previewBootScreen = previewBootScreen;
    window.applyBootScreenColor = applyBootScreenColor;
    
    // Profile functions
    window.saveProfile = saveProfile;
    window.uploadAvatar = uploadAvatar;
    window.previewAvatar = previewAvatar;
    
    // About Me functions
    window.saveAboutMe = saveAboutMe;
    
    // Category functions
    window.addCategory = addCategory;
    window.removeCategory = removeCategory;
    window.updateCategoryName = updateCategoryName;
    window.updateCategoryIcon = updateCategoryIcon;
    window.moveCategoryUp = moveCategoryUp;
    window.moveCategoryDown = moveCategoryDown;
    window.resetCategoriesToDefault = resetCategoriesToDefault;
    window.loadCategoriesList = loadCategoriesList;
    window.getCategories = getCategories;
    window.toggleCategoryVisibility = toggleCategoryVisibility;
    window.saveCategories = saveCategories;
    window.setFirstPassword = setFirstPassword;
}
