/**
 * WindowManager - Handles window operations for Windows XP Desktop Simulator
 * Features: Open, Close, Minimize, Maximize, Drag, Focus, Taskbar Integration
 */

class WindowManager {
    constructor() {
        this.windows = new Map();
        this.activeWindow = null;
        this.highestZIndex = 100;
        this.dragState = {
            isDragging: false,
            window: null,
            offsetX: 0,
            offsetY: 0
        };
        
        this.init();
    }

    init() {
        // Find all windows and register them
        document.querySelectorAll('.window').forEach(win => {
            const id = win.id.replace('window-', '');
            this.windows.set(id, {
                element: win,
                isMinimized: false,
                isMaximized: false,
                originalPosition: null,
                originalSize: null
            });
        });

        // Setup global event listeners
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Desktop icon clicks
        document.querySelectorAll('.desktop-icon').forEach(icon => {
            icon.addEventListener('dblclick', (e) => {
                const windowId = icon.dataset.window;
                if (windowId) this.openWindow(windowId);
            });
        });

        // Start menu item clicks
        document.querySelectorAll('.start-menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const windowId = item.dataset.window;
                const link = item.dataset.link;
                
                if (windowId) {
                    this.openWindow(windowId);
                    this.closeStartMenu();
                } else if (link) {
                    window.open(link, '_blank');
                    this.closeStartMenu();
                }
            });
        });

        // Welcome popup links
        document.querySelectorAll('.welcome-popup-link').forEach(link => {
            link.addEventListener('click', (e) => {
                const windowId = link.dataset.window;
                const url = link.dataset.link;
                
                if (windowId) {
                    this.openWindow(windowId);
                } else if (url) {
                    window.open(url, '_blank');
                }
            });
        });

        // Toolbar links (About Me window navigation)
        document.querySelectorAll('.toolbar-link').forEach(link => {
            link.addEventListener('click', (e) => {
                const windowId = link.dataset.window;
                if (windowId) {
                    this.openWindow(windowId);
                }
            });
        });

        // Sidebar section collapse/expand
        document.querySelectorAll('.sidebar-header').forEach(header => {
            header.addEventListener('click', () => {
                const section = header.closest('.sidebar-section');
                if (section) {
                    section.classList.toggle('collapsed');
                }
            });
        });

        // Resume toolbar buttons
        this.setupResumeToolbar();
        
        // Projects filter functionality
        this.setupProjectsFilter();
        
        // Menu Exit button
        document.querySelectorAll('.menu-exit').forEach(exitBtn => {
            exitBtn.addEventListener('click', (e) => {
                const win = exitBtn.closest('.window');
                if (win) {
                    const windowId = win.id.replace('window-', '');
                    this.closeWindow(windowId);
                }
            });
        });
        
        // Menu Restore button (toggle maximize)
        document.querySelectorAll('.menu-restore').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const win = btn.closest('.window');
                if (win) {
                    const windowId = win.id.replace('window-', '');
                    this.toggleMaximize(windowId);
                }
            });
        });
        
        // Menu Minimize button
        document.querySelectorAll('.menu-minimize').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const win = btn.closest('.window');
                if (win) {
                    const windowId = win.id.replace('window-', '');
                    this.minimizeWindow(windowId);
                }
            });
        });

        // Window titlebar button clicks
        document.querySelectorAll('.window-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const win = btn.closest('.window');
                const action = btn.dataset.action;
                const windowId = win.id.replace('window-', '');
                
                switch (action) {
                    case 'minimize':
                        this.minimizeWindow(windowId);
                        break;
                    case 'maximize':
                        this.toggleMaximize(windowId);
                        break;
                    case 'close':
                        this.closeWindow(windowId);
                        break;
                }
            });
        });

        // Window focus on click
        document.querySelectorAll('.window').forEach(win => {
            win.addEventListener('mousedown', (e) => {
                const windowId = win.id.replace('window-', '');
                this.focusWindow(windowId);
            });
        });

        // Titlebar drag
        document.querySelectorAll('.window-titlebar').forEach(titlebar => {
            titlebar.addEventListener('mousedown', (e) => {
                if (e.target.closest('.window-btn')) return;
                
                const win = titlebar.closest('.window');
                const windowId = win.id.replace('window-', '');
                const windowData = this.windows.get(windowId);
                
                if (windowData && !windowData.isMaximized) {
                    this.startDrag(win, e);
                }
            });

            // Double-click to maximize
            titlebar.addEventListener('dblclick', (e) => {
                if (e.target.closest('.window-btn')) return;
                
                const win = titlebar.closest('.window');
                const windowId = win.id.replace('window-', '');
                this.toggleMaximize(windowId);
            });
        });

        // Global mouse move and up for dragging
        document.addEventListener('mousemove', (e) => this.onDrag(e));
        document.addEventListener('mouseup', () => this.stopDrag());

        // Start button
        const startButton = document.getElementById('startButton');
        if (startButton) {
            startButton.addEventListener('click', () => this.toggleStartMenu());
        }

        // Close start menu when clicking outside
        document.addEventListener('click', (e) => {
            const startMenu = document.getElementById('startMenu');
            const startButton = document.getElementById('startButton');
            
            if (startMenu && startMenu.classList.contains('active')) {
                if (!startMenu.contains(e.target) && !startButton.contains(e.target)) {
                    this.closeStartMenu();
                }
            }
        });

        // Welcome popup close
        const welcomeClose = document.getElementById('welcomeClose');
        if (welcomeClose) {
            welcomeClose.addEventListener('click', () => {
                document.getElementById('welcomePopup')?.classList.remove('active');
            });
        }

        // Taskbar item clicks
        document.getElementById('taskbarItems')?.addEventListener('click', (e) => {
            const item = e.target.closest('.taskbar-item');
            if (item) {
                const windowId = item.dataset.window;
                this.toggleMinimize(windowId);
            }
        });
    }

    openWindow(windowId) {
        const windowData = this.windows.get(windowId);
        if (!windowData) return;

        const win = windowData.element;
        
        // Position window if first time opening
        if (!win.style.left || !win.style.top) {
            const offset = this.getWindowOffset(windowId);
            win.style.left = `${100 + offset * 30}px`;
            win.style.top = `${50 + offset * 30}px`;
            win.style.width = '600px';
            win.style.height = '400px';
        }

        win.classList.add('active');
        win.classList.remove('minimized');
        windowData.isMinimized = false;
        
        this.focusWindow(windowId);
        this.updateTaskbar();
    }

    closeWindow(windowId) {
        const windowData = this.windows.get(windowId);
        if (!windowData) return;

        windowData.element.classList.remove('active');
        windowData.isMinimized = false;
        windowData.isMaximized = false;
        
        // Reset active window
        if (this.activeWindow === windowId) {
            this.activeWindow = null;
        }
        
        this.updateTaskbar();
    }

    minimizeWindow(windowId) {
        const windowData = this.windows.get(windowId);
        if (!windowData) return;

        const win = windowData.element;
        
        // Add minimize animation
        win.classList.add('minimizing');
        
        // Get taskbar button position for animation target
        const taskbarBtn = document.querySelector(`.taskbar-btn[data-window="${windowId}"]`);
        if (taskbarBtn) {
            const btnRect = taskbarBtn.getBoundingClientRect();
            win.style.setProperty('--minimize-target-x', `${btnRect.left + btnRect.width / 2}px`);
            win.style.setProperty('--minimize-target-y', `${btnRect.top}px`);
        }
        
        // After animation completes, hide the window
        setTimeout(() => {
            win.classList.remove('minimizing');
            win.classList.add('minimized');
            windowData.isMinimized = true;
            
            // Focus next window
            if (this.activeWindow === windowId) {
                this.focusNextWindow();
            }
            
            this.updateTaskbar();
        }, 200);
    }

    toggleMinimize(windowId) {
        const windowData = this.windows.get(windowId);
        if (!windowData) return;

        if (windowData.isMinimized) {
            // Restore with animation
            const win = windowData.element;
            win.classList.remove('minimized');
            win.classList.add('restoring');
            windowData.isMinimized = false;
            
            setTimeout(() => {
                win.classList.remove('restoring');
            }, 200);
            
            this.focusWindow(windowId);
        } else if (this.activeWindow === windowId) {
            this.minimizeWindow(windowId);
        } else {
            this.focusWindow(windowId);
        }
        
        this.updateTaskbar();
    }

    toggleMaximize(windowId) {
        const windowData = this.windows.get(windowId);
        if (!windowData) return;

        const win = windowData.element;

        if (windowData.isMaximized) {
            // Restore
            win.classList.remove('maximized');
            if (windowData.originalPosition) {
                win.style.left = windowData.originalPosition.left;
                win.style.top = windowData.originalPosition.top;
                win.style.width = windowData.originalSize.width;
                win.style.height = windowData.originalSize.height;
            }
            windowData.isMaximized = false;
        } else {
            // Maximize
            windowData.originalPosition = {
                left: win.style.left,
                top: win.style.top
            };
            windowData.originalSize = {
                width: win.style.width,
                height: win.style.height
            };
            win.classList.add('maximized');
            windowData.isMaximized = true;
        }
    }

    focusWindow(windowId) {
        const windowData = this.windows.get(windowId);
        if (!windowData) return;

        // Remove inactive class from all windows
        this.windows.forEach((data, id) => {
            data.element.classList.add('inactive');
        });

        // Set this window as active
        windowData.element.classList.remove('inactive');
        windowData.element.style.zIndex = ++this.highestZIndex;
        this.activeWindow = windowId;
        
        this.updateTaskbar();
    }

    focusNextWindow() {
        let nextWindow = null;
        let highestZ = 0;

        this.windows.forEach((data, id) => {
            if (data.element.classList.contains('active') && 
                !data.isMinimized && 
                id !== this.activeWindow) {
                const z = parseInt(data.element.style.zIndex || 0);
                if (z > highestZ) {
                    highestZ = z;
                    nextWindow = id;
                }
            }
        });

        if (nextWindow) {
            this.focusWindow(nextWindow);
        } else {
            this.activeWindow = null;
        }
    }

    startDrag(win, e) {
        this.dragState.isDragging = true;
        this.dragState.window = win;
        this.dragState.offsetX = e.clientX - win.offsetLeft;
        this.dragState.offsetY = e.clientY - win.offsetTop;
        
        document.body.style.cursor = 'move';
        document.body.style.userSelect = 'none';
    }

    onDrag(e) {
        if (!this.dragState.isDragging) return;

        const win = this.dragState.window;
        const desktop = document.getElementById('desktop');
        const desktopRect = desktop.getBoundingClientRect();
        
        let newX = e.clientX - this.dragState.offsetX;
        let newY = e.clientY - this.dragState.offsetY;

        // Boundary checks
        const minVisible = 50;
        newX = Math.max(-win.offsetWidth + minVisible, Math.min(newX, desktopRect.width - minVisible));
        newY = Math.max(0, Math.min(newY, desktopRect.height - minVisible));

        win.style.left = `${newX}px`;
        win.style.top = `${newY}px`;
    }

    stopDrag() {
        this.dragState.isDragging = false;
        this.dragState.window = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }

    toggleStartMenu() {
        const startMenu = document.getElementById('startMenu');
        if (startMenu) {
            startMenu.classList.toggle('active');
        }
    }

    closeStartMenu() {
        const startMenu = document.getElementById('startMenu');
        if (startMenu) {
            startMenu.classList.remove('active');
        }
    }

    updateTaskbar() {
        const taskbarItems = document.getElementById('taskbarItems');
        if (!taskbarItems) return;

        taskbarItems.innerHTML = '';

        this.windows.forEach((data, id) => {
            if (data.element.classList.contains('active')) {
                const item = document.createElement('div');
                item.className = 'taskbar-item';
                item.dataset.window = id;
                
                if (this.activeWindow === id && !data.isMinimized) {
                    item.classList.add('active');
                }

                const icon = data.element.querySelector('.window-titlebar-icon');
                const title = data.element.dataset.title || id;

                item.innerHTML = `
                    <img class="taskbar-item-icon" src="${icon ? icon.src : ''}" alt="">
                    <span class="taskbar-item-title">${title}</span>
                `;

                taskbarItems.appendChild(item);
            }
        });
    }

    getWindowOffset(windowId) {
        let count = 0;
        this.windows.forEach((data, id) => {
            if (data.element.classList.contains('active') && id !== windowId) {
                count++;
            }
        });
        return count;
    }

    setupResumeToolbar() {
        const self = this;
        let zoomLevel = 1;
        
        // Zoom button
        const zoomBtn = document.getElementById('resumeZoomBtn');
        if (zoomBtn) {
            zoomBtn.addEventListener('click', () => {
                const cvImg = document.getElementById('resumeCV');
                if (cvImg) {
                    // Zoom: 1x → 1.5x → 2x → 1x (no zoom out below 100%)
                    if (zoomLevel >= 2) {
                        zoomLevel = 1;
                    } else {
                        zoomLevel += 0.5;
                    }
                    cvImg.style.transform = `scale(${zoomLevel})`;
                    cvImg.style.transformOrigin = 'top center';
                    cvImg.style.transition = 'transform 0.3s ease';
                }
            });
        }
        
        // Save as PDF button
        const saveBtn = document.getElementById('resumeSaveBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                const cvImg = document.getElementById('resumeCV');
                if (cvImg && cvImg.src && !cvImg.src.includes('data:image/svg+xml')) {
                    // Create download link for the image
                    const link = document.createElement('a');
                    link.download = 'resume.png';
                    link.href = cvImg.src;
                    link.click();
                } else {
                    alert('Please upload a CV image first in Admin Panel');
                }
            });
        }
        
        // Print button
        const printBtn = document.getElementById('resumePrintBtn');
        if (printBtn) {
            printBtn.addEventListener('click', () => {
                const cvImg = document.getElementById('resumeCV');
                if (cvImg && cvImg.src && !cvImg.src.includes('data:image/svg+xml')) {
                    const printWindow = window.open('', '_blank');
                    printWindow.document.write(`
                        <html>
                        <head><title>Print Resume</title></head>
                        <body style="margin:0; display:flex; justify-content:center;">
                            <img src="${cvImg.src}" style="max-width:100%; height:auto;">
                        </body>
                        </html>
                    `);
                    printWindow.document.close();
                    printWindow.onload = function() {
                        printWindow.print();
                        printWindow.close();
                    };
                } else {
                    alert('Please upload a CV image first in Admin Panel');
                }
            });
        }
        
        // Contact Me button
        const contactBtn = document.getElementById('resumeContactBtn');
        if (contactBtn) {
            contactBtn.addEventListener('click', () => {
                self.openWindow('contact');
                // Ensure contact window is on top
                setTimeout(() => {
                    self.focusWindow('contact');
                    const contactWin = document.getElementById('window-contact');
                    if (contactWin) {
                        contactWin.style.zIndex = '9999';
                    }
                }, 50);
            });
        }
        
        // Click on image to zoom
        const cvImg = document.getElementById('resumeCV');
        if (cvImg) {
            cvImg.style.cursor = 'zoom-in';
            cvImg.addEventListener('click', () => {
                // Zoom: 1x → 1.5x → 2x → 1x
                if (zoomLevel >= 2) {
                    zoomLevel = 1;
                    cvImg.style.cursor = 'zoom-in';
                } else {
                    zoomLevel += 0.5;
                    if (zoomLevel >= 2) cvImg.style.cursor = 'zoom-out';
                }
                cvImg.style.transform = `scale(${zoomLevel})`;
                cvImg.style.transformOrigin = 'top center';
                cvImg.style.transition = 'transform 0.3s ease';
            });
        }
    }

    setupProjectsFilter() {
        // Category filter
        document.querySelectorAll('.projects-category').forEach(cat => {
            cat.addEventListener('click', () => {
                // Update active state
                document.querySelectorAll('.projects-category').forEach(c => c.classList.remove('active'));
                cat.classList.add('active');
                
                const filter = cat.dataset.filter;
                const cards = document.querySelectorAll('.project-card');
                
                cards.forEach(card => {
                    if (filter === 'all' || card.dataset.category === filter) {
                        card.style.display = 'block';
                    } else {
                        card.style.display = 'none';
                    }
                });
            });
        });
        
        // Search functionality
        const searchInput = document.getElementById('projectSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase();
                const cards = document.querySelectorAll('.project-card');
                
                cards.forEach(card => {
                    const title = card.querySelector('h4').textContent.toLowerCase();
                    const desc = card.querySelector('.project-info span').textContent.toLowerCase();
                    
                    if (title.includes(query) || desc.includes(query)) {
                        card.style.display = 'block';
                    } else {
                        card.style.display = 'none';
                    }
                });
            });
        }
        
        // Project detail view
        this.setupProjectDetailView();
    }
    
    setupProjectDetailView() {
        const self = this;
        const projectDetail = document.getElementById('projectDetail');
        const projectsGrid = document.getElementById('projectsGrid');
        const backBtn = document.getElementById('projectDetailBack');
        
        if (!projectDetail || !projectsGrid) return;
        
        // Back button
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                projectDetail.style.display = 'none';
                projectsGrid.style.display = 'grid';
            });
        }
        
        // Slider controls
        this.currentSlide = 0;
        const sliderPrev = document.getElementById('sliderPrev');
        const sliderNext = document.getElementById('sliderNext');
        const sliderDots = document.getElementById('sliderDots');
        const sliderContainer = document.getElementById('projectSliderContainer');
        
        if (sliderPrev) {
            sliderPrev.addEventListener('click', () => {
                const slides = sliderContainer.querySelectorAll('.project-slide');
                if (slides.length <= 1) return;
                this.currentSlide = (this.currentSlide - 1 + slides.length) % slides.length;
                sliderContainer.style.transform = `translateX(-${this.currentSlide * 100}%)`;
                this.updateSliderDots();
            });
        }
        
        if (sliderNext) {
            sliderNext.addEventListener('click', () => {
                const slides = sliderContainer.querySelectorAll('.project-slide');
                if (slides.length <= 1) return;
                this.currentSlide = (this.currentSlide + 1) % slides.length;
                sliderContainer.style.transform = `translateX(-${this.currentSlide * 100}%)`;
                this.updateSliderDots();
            });
        }
        
        if (sliderDots) {
            sliderDots.addEventListener('click', (e) => {
                if (e.target.classList.contains('slider-dot')) {
                    this.currentSlide = parseInt(e.target.dataset.index);
                    sliderContainer.style.transform = `translateX(-${this.currentSlide * 100}%)`;
                    this.updateSliderDots();
                }
            });
        }
        
        // Click on project card to show detail
        projectsGrid.addEventListener('click', (e) => {
            const card = e.target.closest('.project-card');
            if (!card) return;
            
            // Get project data from card
            const title = card.querySelector('h4')?.textContent || 'Project';
            const desc = card.querySelector('.project-info span')?.textContent || '';
            const thumb = card.querySelector('.project-thumb');
            const bgStyle = thumb?.style.background || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            const category = card.dataset.category || 'web';
            
            // Get project data from config if available
            const config = JSON.parse(localStorage.getItem('xp_portfolio_config') || '{}');
            const projects = config.projects || [];
            const projectData = projects.find(p => p.title === title) || {};
            
            // Update detail view
            document.getElementById('projectDetailTitle').textContent = title;
            document.getElementById('projectDetailCat').textContent = category.charAt(0).toUpperCase() + category.slice(1);
            document.getElementById('projectDetailType').textContent = desc.includes('Client') ? 'Client Work' : 'Personal Work';
            document.getElementById('projectDetailBrief').textContent = projectData.brief || 'No brief available.';
            document.getElementById('projectDetailDesc').textContent = projectData.description || 'No description available.';
            
            // Update visit URL button
            const visitBtn = document.getElementById('projectDetailUrl');
            if (visitBtn) {
                if (projectData.url) {
                    visitBtn.href = projectData.url;
                    visitBtn.style.display = 'inline-block';
                } else {
                    visitBtn.style.display = 'none';
                }
            }
            
            // Setup slider with banners or fallback to gradient
            const sliderContainer = document.getElementById('projectSliderContainer');
            const sliderDots = document.getElementById('sliderDots');
            const banners = projectData.banners || [];
            
            if (banners.length > 0) {
                sliderContainer.innerHTML = banners.map((banner, i) => 
                    `<div class="project-slide" style="background-image: url('${banner}');"></div>`
                ).join('');
                sliderDots.innerHTML = banners.map((_, i) => 
                    `<div class="slider-dot ${i === 0 ? 'active' : ''}" data-index="${i}"></div>`
                ).join('');
            } else {
                sliderContainer.innerHTML = `<div class="project-slide" style="background: ${bgStyle};"></div>`;
                sliderDots.innerHTML = '<div class="slider-dot active" data-index="0"></div>';
            }
            
            // Reset slider position
            sliderContainer.style.transform = 'translateX(0)';
            self.currentSlide = 0;
            
            // Show suggested projects
            const suggested = document.getElementById('projectSuggested');
            if (suggested) {
                const otherProjects = projects.filter(p => p.title !== title).slice(0, 3);
                suggested.innerHTML = otherProjects.map(p => `
                    <div class="suggested-item" data-title="${p.title}">
                        <div class="suggested-thumb" style="background: linear-gradient(135deg, ${p.color1} 0%, ${p.color2} 100%);"></div>
                        <div class="suggested-info">
                            <h5>${p.title}</h5>
                            <span>${p.desc}</span>
                        </div>
                    </div>
                `).join('');
            }
            
            // Show detail view
            projectsGrid.style.display = 'none';
            projectDetail.style.display = 'block';
        });
    }
    
    updateSliderDots() {
        const dots = document.querySelectorAll('.slider-dot');
        dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === this.currentSlide);
        });
    }
}

// Export for use in main.js
window.WindowManager = WindowManager;
