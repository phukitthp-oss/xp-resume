# Windows XP Desktop Simulator - Portfolio Website

A pixel-perfect, interactive Windows XP-inspired personal portfolio website built with pure HTML, CSS, and Vanilla JavaScript.

## 🚀 Features

- **Boot Screen** - Animated loading screen with progress bar
- **Login Screen** - Click to log in experience
- **Welcome Screen** - Classic XP welcome animation
- **Desktop** - Full desktop with icons, taskbar, and system tray
- **Window Manager** - Draggable, minimizable, maximizable windows with focus management
- **Start Menu** - Functional start menu with shortcuts
- **Command Prompt** - Interactive terminal with custom commands
- **Responsive** - Mobile warning for best desktop experience

## 📁 Project Structure

```
/xp-resume
├── index.html              # Main entry point
├── /css
│   ├── reset.css          # Normalize styles
│   └── style.css          # Main XP theme styling
├── /js
│   ├── window-manager.js  # Window operations (drag, minimize, etc.)
│   ├── clock.js           # System tray clock
│   └── main.js            # App initialization
└── /assets
    ├── /images            # Avatar and project images
    └── /icons             # Favicon and icons
```

## 🎨 Customization Guide

### 1. Personal Information
Edit `index.html` and replace the following placeholders:

- `YourName` / `Your Name` → Your actual name
- `Frontend Developer` → Your role/title
- `your.email@gmail.com` → Your email
- `Your City, Country` → Your location
- Social media links (Instagram, GitHub, LinkedIn)

### 2. About Me Content
Find the `window-about` section in `index.html` and update:
- Biography paragraphs
- Skills list
- Software/tools list

### 3. Resume Content
Find the `window-resume` section and update:
- Work experience
- Education
- Skills
- Contact info

### 4. Projects
Find the `window-projects` section and update:
- Project cards (thumbnail, title, description)
- Project links

### 5. Images
Add your images to `/assets/images/`:
- `avatar.png` - Your profile photo (used in multiple places)
- `wallpaper-bliss.jpg` - Desktop wallpaper (optional, uses gradient fallback)
- Project thumbnails

### 6. Colors
Edit CSS variables in `style.css` at `:root` to change the color scheme.

## 🖥️ Running Locally

```bash
# Using Python
python -m http.server 8080

# Using Node.js (http-server)
npx http-server

# Using VS Code
# Install "Live Server" extension and click "Go Live"
```

Then open `http://localhost:8080` in your browser.

## ⌨️ Command Prompt Commands

The built-in terminal supports these commands:
- `help` - List available commands
- `about` - About this portfolio
- `skills` - List skills
- `contact` - Contact information
- `projects` - List projects
- `open [window]` - Open a window (about, resume, projects, contact)
- `clear` / `cls` - Clear screen
- `date` - Show current date/time
- `echo [message]` - Echo a message
- `whoami` - Display user info

## 📱 Mobile Support

The site shows a "Desktop Experience Required" message on mobile devices. This is intentional as the XP interface is designed for desktop interaction.

## 🛠️ Built With

- **HTML5** - Semantic markup
- **CSS3** - Flexbox, Grid, CSS Variables, Gradients
- **Vanilla JavaScript (ES6+)** - No frameworks
- **SVG** - Inline icons (no external dependencies)

## 📄 License

Free to use for personal portfolios. Inspired by Microsoft Windows XP.

---

Made with 💙 and nostalgia for Windows XP
