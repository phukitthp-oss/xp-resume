/**
 * JPG to PDF Converter
 * Converts multiple JPG/PNG images to a single PDF file
 */

// Store selected images
let jpg2pdfImages = [];

// Handle file drop
function handleJpg2PdfDrop(event) {
    event.preventDefault();
    const dropZone = document.getElementById('jpg2pdfDropZone');
    dropZone.style.borderColor = '#7f9db9';
    dropZone.style.background = '#fff';
    
    const files = event.dataTransfer.files;
    processJpg2PdfFiles(files);
}

// Handle file select
function handleJpg2PdfSelect(input) {
    const files = input.files;
    processJpg2PdfFiles(files);
}

// Process selected files
function processJpg2PdfFiles(files) {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        if (!validTypes.includes(file.type)) {
            updateJpg2PdfStatus(`Skipped: ${file.name} (not a valid image)`);
            continue;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            jpg2pdfImages.push({
                name: file.name,
                data: e.target.result,
                type: file.type
            });
            updateJpg2PdfPreview();
        };
        reader.readAsDataURL(file);
    }
}

// Update preview thumbnails
function updateJpg2PdfPreview() {
    const previewContainer = document.getElementById('jpg2pdfPreview');
    const thumbnailsContainer = document.getElementById('jpg2pdfThumbnails');
    const countElement = document.getElementById('jpg2pdfCount');
    const convertBtn = document.getElementById('jpg2pdfConvertBtn');
    
    if (jpg2pdfImages.length > 0) {
        previewContainer.style.display = 'block';
        countElement.textContent = jpg2pdfImages.length;
        
        // Enable convert button
        convertBtn.disabled = false;
        convertBtn.style.opacity = '1';
        convertBtn.style.cursor = 'pointer';
        
        // Generate thumbnails
        thumbnailsContainer.innerHTML = jpg2pdfImages.map((img, index) => `
            <div style="position: relative; width: 80px; text-align: center;">
                <img src="${img.data}" style="width: 80px; height: 80px; object-fit: cover; border: 1px solid #ccc; border-radius: 4px;">
                <button onclick="removeJpg2PdfImage(${index})" style="position: absolute; top: -5px; right: -5px; width: 18px; height: 18px; border-radius: 50%; background: #cc0000; color: white; border: none; cursor: pointer; font-size: 10px; line-height: 1;">×</button>
                <div style="font-size: 9px; color: #666; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${img.name}</div>
            </div>
        `).join('');
        
        updateJpg2PdfStatus(`${jpg2pdfImages.length} image(s) ready to convert`);
    } else {
        previewContainer.style.display = 'none';
        convertBtn.disabled = true;
        convertBtn.style.opacity = '0.5';
        convertBtn.style.cursor = 'not-allowed';
        updateJpg2PdfStatus('Ready - Select images to convert');
    }
}

// Remove single image
function removeJpg2PdfImage(index) {
    jpg2pdfImages.splice(index, 1);
    updateJpg2PdfPreview();
}

// Clear all images
function clearJpg2PdfImages() {
    jpg2pdfImages = [];
    document.getElementById('jpg2pdfInput').value = '';
    updateJpg2PdfPreview();
}

// Update status bar
function updateJpg2PdfStatus(message) {
    const statusBar = document.querySelector('#window-jpg2pdf .window-statusbar');
    if (statusBar) {
        statusBar.textContent = message;
    }
}

// Convert to PDF
async function convertJpg2Pdf() {
    if (jpg2pdfImages.length === 0) {
        updateJpg2PdfStatus('Error: No images selected');
        return;
    }
    
    const progressContainer = document.getElementById('jpg2pdfProgress');
    const progressBar = document.getElementById('jpg2pdfProgressBar');
    const progressText = document.getElementById('jpg2pdfProgressText');
    const convertBtn = document.getElementById('jpg2pdfConvertBtn');
    
    // Show progress
    progressContainer.style.display = 'block';
    convertBtn.disabled = true;
    convertBtn.style.opacity = '0.5';
    
    // Get options
    const pageSize = document.getElementById('jpg2pdfPageSize').value;
    const orientation = document.getElementById('jpg2pdfOrientation').value;
    const quality = parseFloat(document.getElementById('jpg2pdfQuality').value);
    
    try {
        // Initialize jsPDF
        const { jsPDF } = window.jspdf;
        
        let pdf;
        const pageSizes = {
            'a4': [210, 297],
            'letter': [215.9, 279.4],
            'fit': null
        };
        
        updateJpg2PdfStatus('Creating PDF...');
        
        for (let i = 0; i < jpg2pdfImages.length; i++) {
            const img = jpg2pdfImages[i];
            const progress = ((i + 1) / jpg2pdfImages.length) * 100;
            
            progressBar.style.width = progress + '%';
            progressText.textContent = `Processing image ${i + 1} of ${jpg2pdfImages.length}...`;
            
            // Load image to get dimensions
            const imgObj = await loadImage(img.data);
            const imgWidth = imgObj.width;
            const imgHeight = imgObj.height;
            
            // Determine orientation
            let pageOrientation;
            if (orientation === 'auto') {
                pageOrientation = imgWidth > imgHeight ? 'landscape' : 'portrait';
            } else {
                pageOrientation = orientation;
            }
            
            // Calculate page dimensions
            let pageWidth, pageHeight;
            
            if (pageSize === 'fit') {
                // Convert pixels to mm (assuming 96 DPI)
                pageWidth = imgWidth * 0.264583;
                pageHeight = imgHeight * 0.264583;
            } else {
                const size = pageSizes[pageSize];
                if (pageOrientation === 'landscape') {
                    pageWidth = size[1];
                    pageHeight = size[0];
                } else {
                    pageWidth = size[0];
                    pageHeight = size[1];
                }
            }
            
            // Create PDF on first image or add page
            if (i === 0) {
                pdf = new jsPDF({
                    orientation: pageOrientation,
                    unit: 'mm',
                    format: pageSize === 'fit' ? [pageWidth, pageHeight] : pageSize
                });
            } else {
                pdf.addPage(pageSize === 'fit' ? [pageWidth, pageHeight] : pageSize, pageOrientation);
            }
            
            // Calculate image placement (fit to page with margins)
            const margin = pageSize === 'fit' ? 0 : 10;
            const availableWidth = pageWidth - (margin * 2);
            const availableHeight = pageHeight - (margin * 2);
            
            const ratio = Math.min(availableWidth / imgWidth, availableHeight / imgHeight);
            const finalWidth = imgWidth * ratio;
            const finalHeight = imgHeight * ratio;
            
            // Center image on page
            const x = (pageWidth - finalWidth) / 2;
            const y = (pageHeight - finalHeight) / 2;
            
            // Add image to PDF
            const imgFormat = img.type === 'image/png' ? 'PNG' : 'JPEG';
            pdf.addImage(img.data, imgFormat, x, y, finalWidth, finalHeight, undefined, 'MEDIUM');
            
            // Small delay to update UI
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        // Generate filename
        const timestamp = new Date().toISOString().slice(0, 10);
        const filename = `converted_${timestamp}.pdf`;
        
        // Download PDF
        progressText.textContent = 'Generating PDF file...';
        pdf.save(filename);
        
        progressBar.style.width = '100%';
        progressText.textContent = 'Done! PDF downloaded.';
        updateJpg2PdfStatus(`Success! Downloaded: ${filename}`);
        
        // Hide progress after delay
        setTimeout(() => {
            progressContainer.style.display = 'none';
            progressBar.style.width = '0%';
            convertBtn.disabled = false;
            convertBtn.style.opacity = '1';
        }, 2000);
        
    } catch (error) {
        console.error('PDF conversion error:', error);
        progressText.textContent = 'Error: ' + error.message;
        updateJpg2PdfStatus('Error: Failed to create PDF');
        
        setTimeout(() => {
            progressContainer.style.display = 'none';
            progressBar.style.width = '0%';
            convertBtn.disabled = false;
            convertBtn.style.opacity = '1';
        }, 3000);
    }
}

// Helper: Load image and get dimensions
function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

// Make functions globally accessible
window.handleJpg2PdfDrop = handleJpg2PdfDrop;
window.handleJpg2PdfSelect = handleJpg2PdfSelect;
window.removeJpg2PdfImage = removeJpg2PdfImage;
window.clearJpg2PdfImages = clearJpg2PdfImages;
window.convertJpg2Pdf = convertJpg2Pdf;
