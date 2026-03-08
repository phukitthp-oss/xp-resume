/**
 * Clock - System tray clock for Windows XP Desktop Simulator
 */

class Clock {
    constructor(elementId) {
        this.element = document.getElementById(elementId);
        this.interval = null;
        
        if (this.element) {
            this.start();
        }
    }

    start() {
        this.update();
        this.interval = setInterval(() => this.update(), 1000);
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    update() {
        if (!this.element) return;
        
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        const displayMinutes = minutes.toString().padStart(2, '0');
        
        this.element.textContent = `${displayHours}:${displayMinutes} ${ampm}`;
    }
}

// Export for use in main.js
window.Clock = Clock;
