// SignBear 🧸 - Professional PDF Signing App
// Built by Little Bear

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// State
const state = {
  currentStep: 1,
  currentPage: 1,
  totalPages: 1,
  pdfFile: null,
  pdfBytes: null,
  pdfDoc: null,
  pdfDocPdfLib: null,
  signerName: '',
  signerEmail: '',
  signerTitle: '',
  signerOrg: '',
  signatureMode: 'draw',
  signatureFont: 'signature1',
  inkColor: '#1e293b',
  lineWidth: 3,
  strokes: [],
  uploadedSigData: null,
  documentId: null,
  signedPdfBytes: null,
  signaturePlacements: [], // { page, x, y, width, height }
  includeInitials: false,
  pageCanvases: {} // cached rendered pages
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initDropZone();
  initSignatureCanvas();
  initFileInput();
  loadSavedSigner();
  state.documentId = generateDocumentId();
  
  // Type signature preview
  document.getElementById('typedSignature').addEventListener('input', updateTypedPreview);
});

// Generate unique document ID
function generateDocumentId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `SB-${timestamp}-${random}`;
}

// Initialize drop zone
function initDropZone() {
  const dropZone = document.getElementById('dropZone');
  
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event => {
    dropZone.addEventListener(event, preventDefaults);
  });
  
  ['dragenter', 'dragover'].forEach(event => {
    dropZone.addEventListener(event, () => dropZone.classList.add('dragover'));
  });
  
  ['dragleave', 'drop'].forEach(event => {
    dropZone.addEventListener(event, () => dropZone.classList.remove('dragover'));
  });
  
  dropZone.addEventListener('drop', handleDrop);
}

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

function handleDrop(e) {
  const files = e.dataTransfer.files;
  if (files.length > 0 && files[0].type === 'application/pdf') {
    handleFile(files[0]);
  }
}

// Initialize file input
function initFileInput() {
  document.getElementById('fileInput').addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  });
}

// Handle uploaded file
async function handleFile(file) {
  if (file.size > 10 * 1024 * 1024) {
    alert('File too large. Maximum size is 10MB.');
    return;
  }
  
  state.pdfFile = file;
  
  const arrayBuffer = await file.arrayBuffer();
  state.pdfBytes = new Uint8Array(arrayBuffer);
  
  // Load with PDF.js for preview
  state.pdfDoc = await pdfjsLib.getDocument({ data: state.pdfBytes.slice() }).promise;
  state.totalPages = state.pdfDoc.numPages;
  
  // Load with pdf-lib for editing
  state.pdfDocPdfLib = await PDFLib.PDFDocument.load(state.pdfBytes);
  
  // Update UI
  document.getElementById('docTitle').textContent = file.name;
  document.getElementById('docInfo').textContent = `${state.totalPages} page${state.totalPages > 1 ? 's' : ''} • ${formatFileSize(file.size)}`;
  
  goToStep(2);
}

// Format file size
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Initialize signature canvas
function initSignatureCanvas() {
  const canvas = document.getElementById('signatureCanvas');
  const ctx = canvas.getContext('2d');
  
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    ctx.strokeStyle = state.inkColor;
    ctx.lineWidth = state.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    redrawStrokes();
  }
  
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  
  let isDrawing = false;
  let currentStroke = [];
  
  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    };
  }
  
  function startDrawing(e) {
    isDrawing = true;
    currentStroke = [{ ...getPos(e), color: state.inkColor, width: state.lineWidth }];
    e.preventDefault();
  }
  
  function draw(e) {
    if (!isDrawing) return;
    const pos = getPos(e);
    currentStroke.push({ ...pos, color: state.inkColor, width: state.lineWidth });
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    redrawStrokes();
    
    // Draw current stroke
    if (currentStroke.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = currentStroke[0].color;
      ctx.lineWidth = currentStroke[0].width;
      ctx.moveTo(currentStroke[0].x, currentStroke[0].y);
      currentStroke.forEach(point => ctx.lineTo(point.x, point.y));
      ctx.stroke();
    }
    
    e.preventDefault();
  }
  
  function stopDrawing(e) {
    if (isDrawing && currentStroke.length > 1) {
      state.strokes.push([...currentStroke]);
    }
    isDrawing = false;
    currentStroke = [];
    e.preventDefault();
  }
  
  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseleave', stopDrawing);
  
  canvas.addEventListener('touchstart', startDrawing, { passive: false });
  canvas.addEventListener('touchmove', draw, { passive: false });
  canvas.addEventListener('touchend', stopDrawing, { passive: false });
}

function redrawStrokes() {
  const canvas = document.getElementById('signatureCanvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  state.strokes.forEach(stroke => {
    if (stroke.length < 2) return;
    ctx.beginPath();
    ctx.strokeStyle = stroke[0].color;
    ctx.lineWidth = stroke[0].width;
    ctx.moveTo(stroke[0].x, stroke[0].y);
    stroke.forEach(point => ctx.lineTo(point.x, point.y));
    ctx.stroke();
  });
}

function clearSignature() {
  state.strokes = [];
  const canvas = document.getElementById('signatureCanvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function undoStroke() {
  if (state.strokes.length > 0) {
    state.strokes.pop();
    redrawStrokes();
  }
}

// Set ink color
function setInkColor(color) {
  state.inkColor = color;
  document.querySelectorAll('.color-option').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.color === color);
  });
}

// Set line width
function setLineWidth(width) {
  state.lineWidth = width;
}

// Set signature mode
function setSignatureMode(mode) {
  state.signatureMode = mode;
  
  document.getElementById('drawMode').classList.toggle('hidden', mode !== 'draw');
  document.getElementById('typeMode').classList.toggle('hidden', mode !== 'type');
  document.getElementById('uploadMode').classList.toggle('hidden', mode !== 'upload');
  
  // Update tabs
  document.getElementById('tabDraw').className = `flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 ${mode === 'draw' ? 'tab-active' : 'text-slate-400'}`;
  document.getElementById('tabType').className = `flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 ${mode === 'type' ? 'tab-active' : 'text-slate-400'}`;
  document.getElementById('tabUpload').className = `flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 ${mode === 'upload' ? 'tab-active' : 'text-slate-400'}`;
}

// Set signature font
function setSignatureFont(font) {
  state.signatureFont = font;
  
  document.querySelectorAll('.font-btn').forEach(btn => {
    btn.classList.toggle('border-blue-500', btn.dataset.font === font);
    btn.classList.toggle('border-transparent', btn.dataset.font !== font);
  });
  
  updateTypedPreview();
}

// Update typed signature preview
function updateTypedPreview() {
  const input = document.getElementById('typedSignature');
  const preview = document.getElementById('typedSignaturePreview');
  const text = input.value || 'Your Signature';
  
  preview.textContent = text;
  preview.className = `${state.signatureFont} text-3xl text-slate-800`;
}

// Handle signature upload
function handleSignatureUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (event) => {
    state.uploadedSigData = event.target.result;
    document.getElementById('uploadedSigImg').src = state.uploadedSigData;
    document.getElementById('uploadedSigPreview').classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

// Get signature as image data URL
async function getSignatureImage() {
  return new Promise((resolve) => {
    if (state.signatureMode === 'draw') {
      const canvas = document.getElementById('signatureCanvas');
      
      const sigCanvas = document.createElement('canvas');
      sigCanvas.width = canvas.width;
      sigCanvas.height = canvas.height;
      const ctx = sigCanvas.getContext('2d');
      
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, sigCanvas.width, sigCanvas.height);
      
      ctx.scale(2, 2);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      state.strokes.forEach(stroke => {
        if (stroke.length < 2) return;
        ctx.beginPath();
        ctx.strokeStyle = stroke[0].color;
        ctx.lineWidth = stroke[0].width;
        ctx.moveTo(stroke[0].x, stroke[0].y);
        stroke.forEach(point => ctx.lineTo(point.x, point.y));
        ctx.stroke();
      });
      
      resolve(sigCanvas.toDataURL('image/png'));
    } else if (state.signatureMode === 'type') {
      const text = document.getElementById('typedSignature').value || 'Signature';
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 100;
      const ctx = canvas.getContext('2d');
      
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.fillStyle = '#1e293b';
      
      // Map font names
      const fontMap = {
        'signature1': '48px "Dancing Script", cursive',
        'signature2': '48px "Great Vibes", cursive',
        'signature3': '48px "Pacifico", cursive'
      };
      
      ctx.font = fontMap[state.signatureFont] || fontMap['signature1'];
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);
      
      resolve(canvas.toDataURL('image/png'));
    } else if (state.signatureMode === 'upload' && state.uploadedSigData) {
      resolve(state.uploadedSigData);
    } else {
      // Fallback
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 50;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#1e293b';
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(state.signerName || 'Signature', canvas.width / 2, canvas.height / 2);
      resolve(canvas.toDataURL('image/png'));
    }
  });
}

// Load saved signer info
function loadSavedSigner() {
  const saved = localStorage.getItem('signbear-signer');
  if (saved) {
    const { name, email, title, org } = JSON.parse(saved);
    document.getElementById('signerName').value = name || '';
    document.getElementById('signerEmail').value = email || '';
    document.getElementById('signerTitle').value = title || '';
    document.getElementById('signerOrg').value = org || '';
  }
}

// Save signer info
function saveSignerInfo() {
  localStorage.setItem('signbear-signer', JSON.stringify({
    name: state.signerName,
    email: state.signerEmail,
    title: state.signerTitle,
    org: state.signerOrg
  }));
}

// Go to step
async function goToStep(step) {
  // Validate before step 3
  if (step === 3) {
    state.signerName = document.getElementById('signerName').value.trim();
    state.signerEmail = document.getElementById('signerEmail').value.trim();
    state.signerTitle = document.getElementById('signerTitle').value.trim();
    state.signerOrg = document.getElementById('signerOrg').value.trim();
    state.includeInitials = document.getElementById('includeInitials').checked;
    
    if (!state.signerName) {
      alert('Please enter your name');
      return;
    }
    if (!state.signerEmail || !state.signerEmail.includes('@')) {
      alert('Please enter a valid email address');
      return;
    }
    
    // Check signature
    if (state.signatureMode === 'draw' && state.strokes.length === 0) {
      alert('Please draw your signature');
      return;
    }
    if (state.signatureMode === 'type' && !document.getElementById('typedSignature').value.trim()) {
      alert('Please type your signature');
      return;
    }
    if (state.signatureMode === 'upload' && !state.uploadedSigData) {
      alert('Please upload a signature image');
      return;
    }
    
    saveSignerInfo();
    
    // Get signature preview
    const sigImage = await getSignatureImage();
    document.getElementById('placementSigPreview').src = sigImage;
    
    // Render first page
    state.currentPage = 1;
    await renderCurrentPage();
  }
  
  state.currentStep = step;
  
  // Update step visibility
  document.querySelectorAll('.step-content').forEach((el, i) => {
    el.classList.toggle('hidden', i + 1 !== step);
    if (i + 1 === step) {
      el.classList.add('fade-in');
    }
  });
  
  // Update progress indicators
  document.querySelectorAll('.step-indicator').forEach((el, i) => {
    const stepNum = i + 1;
    el.classList.remove('bg-blue-600', 'bg-green-500', 'bg-slate-700');
    el.classList.remove('text-white', 'text-slate-400');
    if (stepNum < step) {
      el.classList.add('bg-green-500', 'text-white');
      el.innerHTML = '✓';
    } else if (stepNum === step) {
      el.classList.add('bg-blue-600', 'text-white');
      el.innerHTML = stepNum;
    } else {
      el.classList.add('bg-slate-700', 'text-slate-400');
      el.innerHTML = stepNum;
    }
  });
  
  // Update progress bar
  const fills = document.querySelectorAll('.progress-fill');
  fills.forEach((fill, i) => {
    const progress = step > i + 1 ? 100 : 0;
    fill.style.width = progress + '%';
  });
  
  // Update header subtitle
  const subtitles = {
    1: 'Professional PDF Signing',
    2: 'Create Your Signature',
    3: 'Place on Document',
    4: 'Document Signed!'
  };
  document.getElementById('headerSubtitle').textContent = subtitles[step];
}

// Render current PDF page
async function renderCurrentPage() {
  const page = await state.pdfDoc.getPage(state.currentPage);
  const canvas = document.getElementById('pdfPageCanvas');
  const ctx = canvas.getContext('2d');
  
  const containerWidth = document.getElementById('pdfPageContainer').offsetWidth;
  const viewport = page.getViewport({ scale: 1 });
  const scale = containerWidth / viewport.width;
  const scaledViewport = page.getViewport({ scale });
  
  canvas.width = scaledViewport.width;
  canvas.height = scaledViewport.height;
  
  await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
  
  // Update page info
  document.getElementById('currentPageNum').textContent = state.currentPage;
  document.getElementById('totalPages').textContent = state.totalPages;
  
  // Update nav buttons
  document.getElementById('prevPageBtn').disabled = state.currentPage <= 1;
  document.getElementById('nextPageBtn').disabled = state.currentPage >= state.totalPages;
  
  // Setup click handler for signature placement
  const overlay = document.getElementById('signatureOverlay');
  overlay.innerHTML = '';
  
  // Show existing placements on this page
  const pagePlacements = state.signaturePlacements.filter(p => p.page === state.currentPage);
  pagePlacements.forEach((p, i) => {
    const div = document.createElement('div');
    div.className = 'signature-field placed';
    div.style.left = `${p.x * 100}%`;
    div.style.top = `${p.y * 100}%`;
    div.style.width = `${p.width * 100}%`;
    div.style.height = `${p.height * 100}%`;
    div.innerHTML = `<span class="text-xs text-green-600 p-1">✓ Placed</span>`;
    overlay.appendChild(div);
  });
  
  // Click to place
  overlay.onclick = async (e) => {
    const rect = overlay.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    
    // Add placement (signature will be 20% width, 10% height)
    state.signaturePlacements.push({
      page: state.currentPage,
      x: x - 0.1, // center on click
      y: y - 0.05,
      width: 0.2,
      height: 0.1
    });
    
    // Re-render
    await renderCurrentPage();
    updatePlacementsList();
  };
}

// Update placements list
function updatePlacementsList() {
  const container = document.getElementById('placedSignaturesList');
  const content = document.getElementById('signaturesListContent');
  
  if (state.signaturePlacements.length === 0) {
    container.classList.add('hidden');
    return;
  }
  
  container.classList.remove('hidden');
  content.innerHTML = state.signaturePlacements.map((p, i) => `
    <div class="flex items-center justify-between bg-slate-700/30 rounded-lg px-3 py-2">
      <span class="text-sm">Page ${p.page}</span>
      <button onclick="removePlacement(${i})" class="text-red-400 hover:text-red-300 text-sm">Remove</button>
    </div>
  `).join('');
}

// Remove placement
async function removePlacement(index) {
  state.signaturePlacements.splice(index, 1);
  await renderCurrentPage();
  updatePlacementsList();
}

// Page navigation
async function prevPage() {
  if (state.currentPage > 1) {
    state.currentPage--;
    await renderCurrentPage();
  }
}

async function nextPage() {
  if (state.currentPage < state.totalPages) {
    state.currentPage++;
    await renderCurrentPage();
  }
}

// Preview document
async function previewDocument() {
  const modal = document.getElementById('pdfModal');
  const container = document.getElementById('pdfPages');
  container.innerHTML = '';
  
  for (let i = 1; i <= state.pdfDoc.numPages; i++) {
    const page = await state.pdfDoc.getPage(i);
    const scale = 1.5;
    const viewport = page.getViewport({ scale });
    
    const canvas = document.createElement('canvas');
    canvas.className = 'mx-auto bg-white rounded-lg shadow-lg';
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    
    const wrapper = document.createElement('div');
    wrapper.className = 'text-center';
    wrapper.innerHTML = `<p class="text-sm text-slate-400 mb-2">Page ${i}</p>`;
    wrapper.appendChild(canvas);
    container.appendChild(wrapper);
  }
  
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closePdfPreview() {
  document.getElementById('pdfModal').classList.add('hidden');
  document.getElementById('pdfModal').classList.remove('flex');
}

// Show help
function showHelp() {
  document.getElementById('helpModal').classList.remove('hidden');
  document.getElementById('helpModal').classList.add('flex');
}

function closeHelp() {
  document.getElementById('helpModal').classList.add('hidden');
  document.getElementById('helpModal').classList.remove('flex');
}

// Sign document
async function signDocument() {
  const btn = document.getElementById('signButton');
  btn.disabled = true;
  btn.innerHTML = '<svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg> Signing...';
  
  try {
    // Get signature image
    const sigImageData = await getSignatureImage();
    
    // Create fresh copy of PDF
    const pdfDoc = await PDFLib.PDFDocument.load(state.pdfBytes);
    
    // Embed signature image
    const sigImageBytes = await fetch(sigImageData).then(r => r.arrayBuffer());
    const sigImage = await pdfDoc.embedPng(sigImageBytes);
    
    const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
    
    // Place signatures on pages
    for (const placement of state.signaturePlacements) {
      const page = pdfDoc.getPage(placement.page - 1);
      const { width, height } = page.getSize();
      
      const sigWidth = placement.width * width;
      const sigHeight = placement.height * height;
      const sigX = placement.x * width;
      const sigY = height - (placement.y * height) - sigHeight;
      
      page.drawImage(sigImage, {
        x: sigX,
        y: sigY,
        width: sigWidth,
        height: sigHeight
      });
    }
    
    // Add initials if requested
    if (state.includeInitials) {
      const initials = state.signerName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
      
      for (let i = 0; i < pdfDoc.getPageCount(); i++) {
        const page = pdfDoc.getPage(i);
        const { width, height } = page.getSize();
        
        // Small initials in bottom right
        page.drawText(initials, {
          x: width - 50,
          y: 30,
          size: 10,
          font: font,
          color: PDFLib.rgb(0.4, 0.4, 0.4)
        });
      }
    }
    
    // Create signature page
    const sigPage = pdfDoc.addPage([612, 792]);
    const { width, height } = sigPage.getSize();
    
    // Header
    sigPage.drawText('DOCUMENT SIGNATURE PAGE', {
      x: 50, y: height - 50, size: 20, font: fontBold, color: PDFLib.rgb(0.1, 0.1, 0.1)
    });
    
    sigPage.drawLine({
      start: { x: 50, y: height - 70 },
      end: { x: width - 50, y: height - 70 },
      thickness: 2, color: PDFLib.rgb(0.2, 0.4, 0.8)
    });
    
    // Document info
    let yPos = height - 110;
    
    sigPage.drawText('Document:', { x: 50, y: yPos, size: 11, font: fontBold, color: PDFLib.rgb(0.4, 0.4, 0.4) });
    sigPage.drawText(state.pdfFile.name, { x: 150, y: yPos, size: 11, font: font, color: PDFLib.rgb(0.2, 0.2, 0.2) });
    
    yPos -= 25;
    sigPage.drawText('Document ID:', { x: 50, y: yPos, size: 11, font: fontBold, color: PDFLib.rgb(0.4, 0.4, 0.4) });
    sigPage.drawText(state.documentId, { x: 150, y: yPos, size: 11, font: font, color: PDFLib.rgb(0.2, 0.2, 0.2) });
    
    yPos -= 25;
    const signedDate = new Date().toLocaleString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
    });
    sigPage.drawText('Signed:', { x: 50, y: yPos, size: 11, font: fontBold, color: PDFLib.rgb(0.4, 0.4, 0.4) });
    sigPage.drawText(signedDate, { x: 150, y: yPos, size: 11, font: font, color: PDFLib.rgb(0.2, 0.2, 0.2) });
    
    // Signatory section
    yPos -= 50;
    sigPage.drawText('SIGNATORY', { x: 50, y: yPos, size: 14, font: fontBold, color: PDFLib.rgb(0.1, 0.1, 0.1) });
    
    yPos -= 15;
    sigPage.drawRectangle({
      x: 50, y: yPos - 130, width: width - 100, height: 140,
      borderColor: PDFLib.rgb(0.8, 0.8, 0.8), borderWidth: 1,
      color: PDFLib.rgb(0.99, 0.99, 0.99)
    });
    
    yPos -= 20;
    sigPage.drawText('Name:', { x: 70, y: yPos, size: 10, font: fontBold, color: PDFLib.rgb(0.5, 0.5, 0.5) });
    sigPage.drawText(state.signerName, { x: 150, y: yPos, size: 12, font: font, color: PDFLib.rgb(0.1, 0.1, 0.1) });
    
    yPos -= 20;
    sigPage.drawText('Email:', { x: 70, y: yPos, size: 10, font: fontBold, color: PDFLib.rgb(0.5, 0.5, 0.5) });
    sigPage.drawText(state.signerEmail, { x: 150, y: yPos, size: 12, font: font, color: PDFLib.rgb(0.1, 0.1, 0.1) });
    
    if (state.signerTitle) {
      yPos -= 20;
      sigPage.drawText('Title:', { x: 70, y: yPos, size: 10, font: fontBold, color: PDFLib.rgb(0.5, 0.5, 0.5) });
      sigPage.drawText(state.signerTitle, { x: 150, y: yPos, size: 12, font: font, color: PDFLib.rgb(0.1, 0.1, 0.1) });
    }
    
    if (state.signerOrg) {
      yPos -= 20;
      sigPage.drawText('Organization:', { x: 70, y: yPos, size: 10, font: fontBold, color: PDFLib.rgb(0.5, 0.5, 0.5) });
      sigPage.drawText(state.signerOrg, { x: 150, y: yPos, size: 12, font: font, color: PDFLib.rgb(0.1, 0.1, 0.1) });
    }
    
    yPos -= 25;
    sigPage.drawText('Signature:', { x: 70, y: yPos, size: 10, font: fontBold, color: PDFLib.rgb(0.5, 0.5, 0.5) });
    sigPage.drawImage(sigImage, { x: 70, y: yPos - 50, width: 180, height: 50 });
    
    // QR Code section
    yPos = yPos - 100;
    sigPage.drawText('VERIFICATION', { x: 50, y: yPos, size: 14, font: fontBold, color: PDFLib.rgb(0.1, 0.1, 0.1) });
    
    const verifyUrl = `${window.location.origin}/verify.html?id=${state.documentId}`;
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 150, margin: 1 });
    const qrImageBytes = await fetch(qrDataUrl).then(r => r.arrayBuffer());
    const qrImage = await pdfDoc.embedPng(qrImageBytes);
    
    sigPage.drawImage(qrImage, { x: 50, y: yPos - 130, width: 100, height: 100 });
    
    sigPage.drawText('Scan to verify authenticity', { x: 160, y: yPos - 50, size: 10, font: font, color: PDFLib.rgb(0.4, 0.4, 0.4) });
    sigPage.drawText(`ID: ${state.documentId}`, { x: 160, y: yPos - 70, size: 9, font: font, color: PDFLib.rgb(0.5, 0.5, 0.5) });
    
    // Footer
    sigPage.drawText('This document was signed electronically using SignBear 🧸', {
      x: 50, y: 30, size: 9, font: font, color: PDFLib.rgb(0.5, 0.5, 0.5)
    });
    sigPage.drawText(`Generated: ${new Date().toISOString()}`, {
      x: 50, y: 15, size: 8, font: font, color: PDFLib.rgb(0.6, 0.6, 0.6)
    });
    
    // Save
    state.signedPdfBytes = await pdfDoc.save();
    
    // Update final page
    const initials = state.signerName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    document.getElementById('finalDocId').textContent = state.documentId;
    document.getElementById('finalInitials').textContent = initials;
    document.getElementById('finalName').textContent = state.signerName;
    document.getElementById('finalEmail').textContent = state.signerEmail;
    document.getElementById('finalDate').textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    
    // Generate QR for display
    const qrCanvas = document.getElementById('qrCode');
    await QRCode.toCanvas(qrCanvas, verifyUrl, { width: 180, margin: 2 });
    
    goToStep(4);
    
  } catch (error) {
    console.error('Error signing document:', error);
    alert('Error signing document: ' + error.message);
    btn.disabled = false;
    btn.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> Sign & Download';
  }
}

// Copy document ID
function copyDocId() {
  navigator.clipboard.writeText(state.documentId);
  // Could add toast notification here
}

// Download signed PDF
function downloadSignedPdf() {
  if (!state.signedPdfBytes) return;
  
  const blob = new Blob([state.signedPdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `signed_${state.pdfFile.name}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Share document
async function shareDocument() {
  const verifyUrl = `${window.location.origin}/verify.html?id=${state.documentId}`;
  const shareText = `Document signed with SignBear 🧸\n\nDocument: ${state.pdfFile.name}\nDocument ID: ${state.documentId}\nSigned by: ${state.signerName}\n\nVerify: ${verifyUrl}`;
  
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Signed Document', text: shareText });
    } catch (e) {}
  } else {
    await navigator.clipboard.writeText(shareText);
    alert('Verification link copied to clipboard!');
  }
}

// Reset app
function resetApp() {
  Object.assign(state, {
    currentStep: 1,
    currentPage: 1,
    pdfFile: null,
    pdfBytes: null,
    pdfDoc: null,
    pdfDocPdfLib: null,
    strokes: [],
    uploadedSigData: null,
    documentId: generateDocumentId(),
    signedPdfBytes: null,
    signaturePlacements: [],
    pageCanvases: {}
  });
  
  document.getElementById('typedSignature').value = '';
  document.getElementById('uploadedSigPreview').classList.add('hidden');
  document.getElementById('placedSignaturesList').classList.add('hidden');
  
  clearSignature();
  goToStep(1);
}

// Close modals on backdrop click
document.getElementById('pdfModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closePdfPreview();
});

document.getElementById('helpModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeHelp();
});
