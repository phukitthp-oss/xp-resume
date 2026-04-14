/**
 * Main.js - Initialization for Windows XP Desktop Simulator
 */

(function() {
    'use strict';

    let windowManager = null;
    let clock = null;

    function deepMerge(base, override) {
        const result = Object.assign({}, base);
        for (const key of Object.keys(override)) {
            if (
                override[key] !== null &&
                typeof override[key] === 'object' &&
                !Array.isArray(override[key]) &&
                typeof base[key] === 'object' &&
                base[key] !== null
            ) {
                result[key] = deepMerge(base[key], override[key]);
            } else {
                result[key] = override[key];
            }
        }
        return result;
    }

    async function loadConfig() {
        let base = {};
        try {
            const res = await fetch('data/config.json');
            if (res.ok) base = await res.json();
        } catch (_) { /* offline or file missing — fall through to localStorage */ }
        const draft = JSON.parse(localStorage.getItem('xp_portfolio_config') || '{}');
        return deepMerge(base, draft);
    }

    /**
     * Initialize the application
     */
    async function init() {
        // Boot screen fade out after 3.5 seconds
        const bootScreen = document.getElementById('bootScreen');
        if (bootScreen) {
            setTimeout(() => {
                bootScreen.classList.add('fade-out');
                setTimeout(() => {
                    bootScreen.style.display = 'none';
                }, 500);
            }, 3500);
        }
        
        // Initialize WindowManager
        windowManager = new WindowManager();

        // Initialize Clock
        clock = new Clock('trayClock');

        // Apply saved configuration from admin panel
        await applyConfig();

        // Setup additional event listeners
        setupEventListeners();

        console.log('Windows XP Desktop Simulator initialized');
    }

    /**
     * Apply configuration from localStorage (admin panel settings)
     */
    async function applyConfig() {
        const config = await loadConfig();

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

            // Apply custom icons to Desktop, Start Menu, and Toolbar
            if (config.images.icons) {
                Object.entries(config.images.icons).forEach(([key, value]) => {
                    if (value) {
                        // Apply to Desktop icon
                        const desktopIcon = document.querySelector(`.desktop-icon[data-window="${key}"] img`);
                        if (desktopIcon) desktopIcon.src = value;
                        
                        // Apply to Start Menu icon
                        const startMenuIcon = document.querySelector(`.start-menu-item[data-window="${key}"] img`);
                        if (startMenuIcon) startMenuIcon.src = value;
                        
                        // Apply to Toolbar icon (About Me window)
                        const toolbarIcon = document.querySelector(`.toolbar-icon[data-window="${key}"]`);
                        if (toolbarIcon) toolbarIcon.src = value;
                    }
                });
            }
        }

        // Apply icon size, font size, gap and margin
        const iconContainer = document.querySelector('.desktop-icons');
        if (iconContainer) {
            if (config.iconGap) iconContainer.style.gap = `${config.iconGap}px`;
            if (config.iconMargin) {
                iconContainer.style.top = `${config.iconMargin}px`;
                iconContainer.style.left = `${config.iconMargin}px`;
            }
        }
        
        if (config.iconSize || config.iconFontSize) {
            document.querySelectorAll('.desktop-icon').forEach(icon => {
                const img = icon.querySelector('img');
                const label = icon.querySelector('.desktop-icon-label');
                if (img && config.iconSize) {
                    img.style.width = `${config.iconSize}px`;
                    img.style.height = `${config.iconSize}px`;
                }
                if (label && config.iconFontSize) {
                    label.style.fontSize = `${config.iconFontSize}px`;
                }
            });
        }

        // Apply user name
        if (config.content && config.content.userName) {
            const userElement = document.querySelector('.start-menu-user');
            if (userElement) {
                userElement.textContent = config.content.userName;
            }
        }

        // Apply Boot Screen Text
        if (config.bootText) {
            const bootName = document.querySelector('.boot-name');
            if (bootName) {
                if (config.bootText.left) bootName.textContent = config.bootText.left;
                if (config.bootText.fontName) bootName.style.fontSize = config.bootText.fontName + 'px';
            }
            
            const bootXp = document.querySelector('.boot-xp');
            if (bootXp) {
                if (config.bootText.right) bootXp.textContent = config.bootText.right;
                if (config.bootText.fontXP) bootXp.style.fontSize = config.bootText.fontXP + 'px';
            }
            
            const bootSubtitle = document.querySelector('.boot-subtitle');
            if (bootSubtitle) {
                if (config.bootText.subtitle) bootSubtitle.textContent = config.bootText.subtitle;
                if (config.bootText.fontSubtitle) bootSubtitle.style.fontSize = config.bootText.fontSubtitle + 'px';
            }
            
            const bootHint = document.querySelector('.boot-hint');
            if (bootHint) {
                if (config.bootText.bottomLeft) bootHint.innerHTML = config.bootText.bottomLeft.replace(/\n/g, '<br>');
                if (config.bootText.fontHint) bootHint.style.fontSize = config.bootText.fontHint + 'px';
            }
            
            const bootBrand = document.querySelector('.boot-brand');
            if (bootBrand) {
                if (config.bootText.bottomRight) bootBrand.innerHTML = config.bootText.bottomRight;
                if (config.bootText.fontBrand) bootBrand.style.fontSize = config.bootText.fontBrand + 'px';
            }
        }

        // Apply profile data
        if (config.profile) {
            // Update social links
            if (config.profile.instagram) {
                const igLink = document.querySelector('.start-menu-item[data-link*="instagram"]');
                if (igLink) igLink.dataset.link = config.profile.instagram;
                const aboutIgLink = document.getElementById('socialInstagramLink');
                if (aboutIgLink) aboutIgLink.href = config.profile.instagram;
                const projectsIgLink = document.getElementById('projectsInstagram');
                if (projectsIgLink) projectsIgLink.href = config.profile.instagram;
            }
            if (config.profile.github) {
                const ghLink = document.querySelector('.start-menu-item[data-link*="github"]');
                if (ghLink) ghLink.dataset.link = config.profile.github;
                const aboutGhLink = document.getElementById('socialGithubLink');
                if (aboutGhLink) aboutGhLink.href = config.profile.github;
                const projectsGhLink = document.getElementById('projectsGithub');
                if (projectsGhLink) projectsGhLink.href = config.profile.github;
            }
            if (config.profile.linkedin) {
                const liLink = document.querySelector('.start-menu-item[data-link*="linkedin"]');
                if (liLink) liLink.dataset.link = config.profile.linkedin;
                const aboutLiLink = document.getElementById('socialLinkedinLink');
                if (aboutLiLink) aboutLiLink.href = config.profile.linkedin;
                const projectsLiLink = document.getElementById('projectsLinkedin');
                if (projectsLiLink) projectsLiLink.href = config.profile.linkedin;
            }
        }
        
        // Apply About Me content
        if (config.aboutMe) {
            const title = document.getElementById('aboutTitle');
            if (title && config.aboutMe.title) title.textContent = config.aboutMe.title;
            
            const p1 = document.getElementById('aboutParagraph1');
            if (p1 && config.aboutMe.paragraph1) p1.textContent = config.aboutMe.paragraph1;
            
            const p2 = document.getElementById('aboutParagraph2');
            if (p2 && config.aboutMe.paragraph2) p2.textContent = config.aboutMe.paragraph2;
            
            const p3 = document.getElementById('aboutParagraph3');
            if (p3 && config.aboutMe.paragraph3) p3.textContent = config.aboutMe.paragraph3;
            
            const p4 = document.getElementById('aboutParagraph4');
            if (p4 && config.aboutMe.paragraph4) p4.textContent = config.aboutMe.paragraph4;
            
            // Apply Skills Title
            if (config.aboutMe.skillsTitle) {
                const skillsHeader = document.getElementById('skillsHeader');
                if (skillsHeader) skillsHeader.textContent = config.aboutMe.skillsTitle;
            }
            
            // Apply skills list
            if (config.aboutMe.skills) {
                const skillsContainer = document.getElementById('aboutSkills');
                if (skillsContainer) {
                    const skills = config.aboutMe.skills.split('\n').filter(s => s.trim());
                    skillsContainer.innerHTML = skills.map(s => `<div class="sidebar-item">${s}</div>`).join('');
                }
            }
            
            // Apply Software Title
            if (config.aboutMe.softwareTitle) {
                const softwareHeader = document.getElementById('softwareHeader');
                if (softwareHeader) softwareHeader.textContent = config.aboutMe.softwareTitle;
            }
            
            // Apply software list
            if (config.aboutMe.software) {
                const softwareContainer = document.getElementById('aboutSoftware');
                if (softwareContainer) {
                    const software = config.aboutMe.software.split('\n').filter(s => s.trim());
                    softwareContainer.innerHTML = software.map(s => `<div class="sidebar-item">${s}</div>`).join('');
                }
            }
            
            // Apply About Me colors
            if (config.aboutMe.sidebarColor || config.aboutMe.mainColor) {
                const aboutContent = document.querySelector('.about-window-content');
                const sidebar = document.querySelector('.about-sidebar');
                const mainArea = document.querySelector('.about-main');
                
                if (aboutContent && config.aboutMe.sidebarColor && config.aboutMe.mainColor) {
                    aboutContent.style.background = `linear-gradient(to right, ${config.aboutMe.sidebarColor} 0%, ${config.aboutMe.sidebarColor} 180px, ${config.aboutMe.mainColor} 180px, ${config.aboutMe.mainColor} 100%)`;
                }
            }
            
            // Apply About Me sizes
            if (config.aboutMe.titleSize) {
                const aboutTitle = document.getElementById('aboutTitle');
                if (aboutTitle) aboutTitle.style.fontSize = `${config.aboutMe.titleSize}px`;
            }
            if (config.aboutMe.fontSize) {
                document.querySelectorAll('.about-paragraph').forEach(p => {
                    p.style.fontSize = `${config.aboutMe.fontSize}px`;
                });
            }
            if (config.aboutMe.avatarSize) {
                document.querySelectorAll('.about-avatar').forEach(img => {
                    img.style.width = `${config.aboutMe.avatarSize}px`;
                    img.style.height = `${config.aboutMe.avatarSize}px`;
                });
            }
        }
        
        // Apply About avatars
        if (config.images && config.images.aboutAvatars) {
            for (let i = 1; i <= 4; i++) {
                const avatarSrc = config.images.aboutAvatars[`avatar${i}`];
                if (avatarSrc) {
                    const avatar = document.getElementById(`aboutAvatar${i}`);
                    if (avatar) avatar.src = avatarSrc;
                }
            }
        }
        
        // Apply CV image
        if (config.images && config.images.cvImage) {
            const cvImg = document.getElementById('resumeCV');
            if (cvImg) cvImg.src = config.images.cvImage;
        }
        
        // Apply Resume background color
        if (config.resume && config.resume.bgColor) {
            const resumeViewer = document.getElementById('resumeViewer');
            if (resumeViewer) {
                resumeViewer.style.background = config.resume.bgColor;
            }
        }
        
        // Apply Projects from config using renderProjectsOnMainSite
        if (typeof renderProjectsOnMainSite === 'function') {
            renderProjectsOnMainSite();
        } else {
            // Fallback: wait for admin.js to load
            setTimeout(() => {
                if (typeof renderProjectsOnMainSite === 'function') {
                    renderProjectsOnMainSite();
                }
            }, 100);
        }
    }

    /**
     * Setup additional event listeners
     */
    function setupEventListeners() {
        // Log Off button
        const logOffBtn = document.getElementById('logOffBtn');
        if (logOffBtn) {
            logOffBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to log off?')) {
                    location.reload();
                }
            });
        }

        // Shut Down button
        const shutDownBtn = document.getElementById('shutDownBtn');
        if (shutDownBtn) {
            shutDownBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to shut down?')) {
                    document.body.style.transition = 'opacity 1s';
                    document.body.style.opacity = '0';
                    setTimeout(() => {
                        document.body.innerHTML = '<div style="background:#000;width:100%;height:100%;display:flex;justify-content:center;align-items:center;color:#fff;font-family:Tahoma;">It is now safe to turn off your computer.</div>';
                        document.body.style.opacity = '1';
                    }, 1000);
                }
            });
        }

        // Auto-hide welcome popup after 10 seconds
        setTimeout(() => {
            const welcomePopup = document.getElementById('welcomePopup');
            if (welcomePopup && welcomePopup.classList.contains('active')) {
                welcomePopup.classList.remove('active');
            }
        }, 10000);

        // Information button - toggle welcome popup
        const infoBtn = document.getElementById('infoBtn');
        if (infoBtn) {
            infoBtn.addEventListener('click', () => {
                const welcomePopup = document.getElementById('welcomePopup');
                if (welcomePopup) {
                    welcomePopup.classList.toggle('active');
                }
            });
        }

        // CRT Effects button
        const crtBtn = document.getElementById('crtBtn');
        let crtEnabled = false;
        let crtOverlay = null;
        
        let crtWaveInterval = null;
        
        if (crtBtn) {
            crtBtn.addEventListener('click', () => {
                crtEnabled = !crtEnabled;
                const tooltip = document.getElementById('crtTooltip');
                
                // Get CRT settings from localStorage
                const savedConfig = JSON.parse(localStorage.getItem('xp_portfolio_config') || '{}');
                const crtSettings = savedConfig.crtEffect || { scanlineOpacity: 0.5, vignetteOpacity: 0, brightness: 100 };
                const scanlineOpacity = crtSettings.scanlineOpacity / 100;
                const brightness = crtSettings.brightness || 100;
                
                if (crtEnabled) {
                    // Remove existing overlay first
                    const existingOverlay = document.getElementById('crtOverlay');
                    if (existingOverlay) existingOverlay.remove();
                    const existingWave = document.getElementById('crtWave');
                    if (existingWave) existingWave.remove();
                    
                    // Create CRT overlay - nearly invisible scanlines for crystal clear text
                    crtOverlay = document.createElement('div');
                    crtOverlay.id = 'crtOverlay';
                    crtOverlay.style.cssText = `
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100vw;
                        height: 100vh;
                        pointer-events: none;
                        z-index: 99998;
                        background: 
                            repeating-linear-gradient(
                                0deg,
                                rgba(0, 0, 0, ${scanlineOpacity}),
                                rgba(0, 0, 0, ${scanlineOpacity}) 1px,
                                transparent 1px,
                                transparent 4px
                            );
                    `;
                    document.body.appendChild(crtOverlay);
                    
                    // Create scanning wave line - every 4 seconds
                    const wave = document.createElement('div');
                    wave.id = 'crtWave';
                    wave.style.cssText = `
                        position: fixed;
                        top: -10px;
                        left: 0;
                        width: 100vw;
                        height: 2px;
                        background: linear-gradient(to bottom, 
                            transparent, 
                            rgba(255, 255, 255, 0.04), 
                            transparent);
                        pointer-events: none;
                        z-index: 99999;
                        animation: crtWaveAnim 4s linear infinite;
                    `;
                    document.body.appendChild(wave);
                    
                    // Add CSS animation if not exists
                    if (!document.getElementById('crtWaveStyle')) {
                        const style = document.createElement('style');
                        style.id = 'crtWaveStyle';
                        style.textContent = `
                            @keyframes crtWaveAnim {
                                0% { top: -10px; }
                                100% { top: 100vh; }
                            }
                        `;
                        document.head.appendChild(style);
                    }
                    
                    // Apply brightness filter to desktop
                    const desktop = document.getElementById('desktop');
                    if (desktop) {
                        desktop.style.filter = `brightness(${brightness}%)`;
                    }
                    
                    crtBtn.title = 'CRT Effects: ON';
                    if (tooltip) {
                        tooltip.textContent = 'CRT Effects: ON';
                        tooltip.classList.add('active');
                        setTimeout(() => tooltip.classList.remove('active'), 2000);
                    }
                } else {
                    // Remove CRT overlay and wave
                    if (crtOverlay) {
                        crtOverlay.remove();
                        crtOverlay = null;
                    }
                    const existingOverlay = document.getElementById('crtOverlay');
                    if (existingOverlay) existingOverlay.remove();
                    const existingWave = document.getElementById('crtWave');
                    if (existingWave) existingWave.remove();
                    
                    // Reset brightness filter
                    const desktop = document.getElementById('desktop');
                    if (desktop) {
                        desktop.style.filter = '';
                    }
                    
                    crtBtn.title = 'CRT Effects: OFF';
                    if (tooltip) {
                        tooltip.textContent = 'CRT Effects: OFF';
                        tooltip.classList.add('active');
                        setTimeout(() => tooltip.classList.remove('active'), 2000);
                    }
                }
            });
        }

        // Fullscreen button
        const fullscreenBtn = document.getElementById('fullscreenBtn');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => {
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen().catch(err => {
                        console.log('Fullscreen error:', err);
                    });
                } else {
                    document.exitFullscreen();
                }
            });
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => init().catch(console.error));
    } else {
        init().catch(console.error);
    }
})();
