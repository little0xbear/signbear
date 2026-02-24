// SignBear 🧸 - PDF Document Signing App
// Built by Little Bear

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// State
const state = {
  currentStep: 1,
  pdfFile: null,
  pdfBytes: null,
  pdfDoc: null,
  signerName: '',
  signerEmail: '',
  signatureMode: 'draw',
  signatureImage: null,
  strokes: [],
  documentId: null,
  signedPdfBytes: null
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initDropZone();
  initSignatureCanvas();
  initFileInput();
  loadSavedSigner();
  
  // Generate document ID early
  state.documentId = generateDocumentId();
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
  state.pdfFile = file;
  
  // Read file as ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();
  state.pdfBytes = new Uint8Array(arrayBuffer);
  
  // Load with PDF.js for preview
  state.pdfDoc = await pdfjsLib.getDocument({ data: state.pdfBytes.slice() }).promise;
  
  // Update UI
  document.getElementById('docTitle').textContent = file.name;
  document.getElementById('docInfo').textContent = `${state.pdfDoc.numPages} page${state.pdfDoc.numPages > 1 ? 's' : ''} • ${formatFileSize(file.size)}`;
  
  // Go to step 2
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
  
  // Set canvas size
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
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
    currentStroke = [getPos(e)];
    e.preventDefault();
  }
  
  function draw(e) {
    if (!isDrawing) return;
    const pos = getPos(e);
    currentStroke.push(pos);
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    redrawStrokes();
    
    // Draw current stroke
    ctx.beginPath();
    ctx.moveTo(currentStroke[0].x, currentStroke[0].y);
    currentStroke.forEach(point => ctx.lineTo(point.x, point.y));
    ctx.stroke();
    
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
    ctx.beginPath();
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

// Set signature mode
function setSignatureMode(mode) {
  state.signatureMode = mode;
  
  document.getElementById('drawMode').classList.toggle('hidden', mode !== 'draw');
  document.getElementById('typeMode').classList.toggle('hidden', mode !== 'type');
  
  document.getElementById('modeDraw').classList.toggle('bg-blue-600', mode === 'draw');
  document.getElementById('modeDraw').classList.toggle('bg-slate-700', mode !== 'draw');
  document.getElementById('modeType').classList.toggle('bg-blue-600', mode === 'type');
  document.getElementById('modeType').classList.toggle('bg-slate-700', mode !== 'type');
  
  // Update typed signature preview
  const input = document.getElementById('typedSignature');
  const preview = document.getElementById('typedSignaturePreview');
  input.addEventListener('input', () => {
    preview.textContent = input.value || 'Your signature';
  });
}

// Get signature as image
function getSignatureImage() {
  return new Promise((resolve) => {
    if (state.signatureMode === 'draw') {
      const canvas = document.getElementById('signatureCanvas');
      
      // Create a new canvas with just the signature
      const sigCanvas = document.createElement('canvas');
      sigCanvas.width = canvas.width;
      sigCanvas.height = canvas.height;
      const ctx = sigCanvas.getContext('2d');
      
      // White background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, sigCanvas.width, sigCanvas.height);
      
      // Draw strokes
      ctx.scale(2, 2);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      state.strokes.forEach(stroke => {
        ctx.beginPath();
        ctx.moveTo(stroke[0].x, stroke[0].y);
        stroke.forEach(point => ctx.lineTo(point.x, point.y));
        ctx.stroke();
      });
      
      resolve(sigCanvas.toDataURL('image/png'));
    } else {
      // Type mode - create image from text
      const text = document.getElementById('typedSignature').value || 'Signature';
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 100;
      const ctx = canvas.getContext('2d');
      
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.fillStyle = '#1e293b';
      ctx.font = '48px "Dancing Script", cursive';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);
      
      resolve(canvas.toDataURL('image/png'));
    }
  });
}

// Load saved signer info
function loadSavedSigner() {
  const saved = localStorage.getItem('signbear-signer');
  if (saved) {
    const { name, email } = JSON.parse(saved);
    document.getElementById('signerName').value = name || '';
    document.getElementById('signerEmail').value = email || '';
  }
}

// Save signer info
function saveSignerInfo() {
  localStorage.setItem('signbear-signer', JSON.stringify({
    name: state.signerName,
    email: state.signerEmail
  }));
}

// Go to step
function goToStep(step) {
  // Validate current step before proceeding
  if (step === 3) {
    state.signerName = document.getElementById('signerName').value.trim();
    state.signerEmail = document.getElementById('signerEmail').value.trim();
    
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
    
    saveSignerInfo();
    updateReviewPage();
  }
  
  state.currentStep = step;
  
  // Update step visibility
  document.querySelectorAll('.step-content').forEach((el, i) => {
    el.classList.toggle('hidden', i + 1 !== step);
  });
  
  // Update progress indicators
  document.querySelectorAll('.step-indicator').forEach((el, i) => {
    const stepNum = i + 1;
    el.classList.remove('step-active', 'step-complete', 'step-pending');
    if (stepNum < step) {
      el.classList.add('step-complete');
      el.innerHTML = '✓';
    } else if (stepNum === step) {
      el.classList.add('step-active');
      el.innerHTML = stepNum;
    } else {
      el.classList.add('step-pending');
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
    1: 'Sign documents securely',
    2: 'Add your signature',
    3: 'Review before signing',
    4: 'Document signed!'
  };
  document.getElementById('headerSubtitle').textContent = subtitles[step];
}

// Update review page
async function updateReviewPage() {
  document.getElementById('reviewDocTitle').textContent = state.pdfFile.name;
  document.getElementById('reviewDocInfo').textContent = `${state.pdfDoc.numPages} page${state.pdfDoc.numPages > 1 ? 's' : ''}`;
  
  // Initials
  const initials = state.signerName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  document.getElementById('reviewInitials').textContent = initials;
  
  document.getElementById('reviewName').textContent = state.signerName;
  document.getElementById('reviewEmail').textContent = state.signerEmail;
  
  // Signature preview
  const sigImage = await getSignatureImage();
  document.getElementById('reviewSignature').src = sigImage;
  
  // Document ID
  document.getElementById('reviewDocId').textContent = state.documentId;
}

// Show PDF preview
async function showPdfPreview() {
  const modal = document.getElementById('pdfModal');
  const container = document.getElementById('pdfPages');
  container.innerHTML = '';
  
  for (let i = 1; i <= state.pdfDoc.numPages; i++) {
    const page = await state.pdfDoc.getPage(i);
    const scale = 1.5;
    const viewport = page.getViewport({ scale });
    
    const canvas = document.createElement('canvas');
    canvas.className = 'pdf-page mx-auto bg-white rounded-lg';
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    
    container.appendChild(canvas);
  }
  
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closePdfPreview() {
  const modal = document.getElementById('pdfModal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

// Sign document
async function signDocument() {
  const btn = document.getElementById('signButton');
  btn.disabled = true;
  btn.innerHTML = '<svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg> Signing...';
  
  try {
    // Get signature image
    const sigImageData = await getSignatureImage();
    
    // Load PDF with pdf-lib
    const pdfDoc = await PDFLib.PDFDocument.load(state.pdfBytes);
    
    // Create signature page
    const sigPage = pdfDoc.addPage([612, 792]); // US Letter
    
    // Embed signature image
    const sigImageBytes = await fetch(sigImageData).then(r => r.arrayBuffer());
    const sigImage = await pdfDoc.embedPng(sigImageBytes);
    
    // Draw signature page content
    const { width, height } = sigPage.getSize();
    const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
    
    // Header
    sigPage.drawText('DOCUMENT SIGNATURE PAGE', {
      x: 50,
      y: height - 50,
      size: 18,
      font: fontBold,
      color: PDFLib.rgb(0.1, 0.1, 0.1)
    });
    
    // Divider line
    sigPage.drawLine({
      start: { x: 50, y: height - 70 },
      end: { x: width - 50, y: height - 70 },
      thickness: 1,
      color: PDFLib.rgb(0.8, 0.8, 0.8)
    });
    
    // Document info
    sigPage.drawText('Document:', { x: 50, y: height - 100, size: 12, font: fontBold, color: PDFLib.rgb(0.3, 0.3, 0.3) });
    sigPage.drawText(state.pdfFile.name, { x: 150, y: height - 100, size: 12, font: font, color: PDFLib.rgb(0.3, 0.3, 0.3) });
    
    // Document ID
    sigPage.drawText('Document ID:', { x: 50, y: height - 125, size: 12, font: fontBold, color: PDFLib.rgb(0.3, 0.3, 0.3) });
    sigPage.drawText(state.documentId, { x: 150, y: height - 125, size: 12, font: font, color: PDFLib.rgb(0.3, 0.3, 0.3) });
    
    // Signed date
    const signedDate = new Date().toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
    sigPage.drawText('Signed:', { x: 50, y: height - 150, size: 12, font: fontBold, color: PDFLib.rgb(0.3, 0.3, 0.3) });
    sigPage.drawText(signedDate, { x: 150, y: height - 150, size: 12, font: font, color: PDFLib.rgb(0.3, 0.3, 0.3) });
    
    // Signatory section
    sigPage.drawText('SIGNATORY', {
      x: 50,
      y: height - 200,
      size: 14,
      font: fontBold,
      color: PDFLib.rgb(0.1, 0.1, 0.1)
    });
    
    // Signatory box
    sigPage.drawRectangle({
      x: 50,
      y: height - 380,
      width: width - 100,
      height: 160,
      borderColor: PDFLib.rgb(0.8, 0.8, 0.8),
      borderWidth: 1,
      color: PDFLib.rgb(0.98, 0.98, 0.98)
    });
    
    // Name
    sigPage.drawText('Name:', { x: 70, y: height - 240, size: 11, font: fontBold, color: PDFLib.rgb(0.4, 0.4, 0.4) });
    sigPage.drawText(state.signerName, { x: 130, y: height - 240, size: 12, font: font, color: PDFLib.rgb(0.1, 0.1, 0.1) });
    
    // Email
    sigPage.drawText('Email:', { x: 70, y: height - 265, size: 11, font: fontBold, color: PDFLib.rgb(0.4, 0.4, 0.4) });
    sigPage.drawText(state.signerEmail, { x: 130, y: height - 265, size: 12, font: font, color: PDFLib.rgb(0.1, 0.1, 0.1) });
    
    // Signature
    sigPage.drawText('Signature:', { x: 70, y: height - 295, size: 11, font: fontBold, color: PDFLib.rgb(0.4, 0.4, 0.4) });
    sigPage.drawImage(sigImage, {
      x: 70,
      y: height - 370,
      width: 200,
      height: 60
    });
    
    // QR Code section
    sigPage.drawText('VERIFICATION', {
      x: 50,
      y: height - 420,
      size: 14,
      font: fontBold,
      color: PDFLib.rgb(0.1, 0.1, 0.1)
    });
    
    // Generate QR code
    const verifyUrl = `${window.location.origin}/verify.html?id=${state.documentId}`;
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 150, margin: 1 });
    const qrImageBytes = await fetch(qrDataUrl).then(r => r.arrayBuffer());
    const qrImage = await pdfDoc.embedPng(qrImageBytes);
    
    sigPage.drawImage(qrImage, {
      x: 50,
      y: height - 580,
      width: 100,
      height: 100
    });
    
    sigPage.drawText('Scan to verify authenticity', {
      x: 160,
      y: height - 540,
      size: 10,
      font: font,
      color: PDFLib.rgb(0.4, 0.4, 0.4)
    });
    
    sigPage.drawText(`ID: ${state.documentId}`, {
      x: 160,
      y: height - 560,
      size: 10,
      font: font,
      color: PDFLib.rgb(0.4, 0.4, 0.4)
    });
    
    // Footer
    sigPage.drawText('This document was signed electronically using SignBear', {
      x: 50,
      y: 30,
      size: 9,
      font: font,
      color: PDFLib.rgb(0.5, 0.5, 0.5)
    });
    
    sigPage.drawText(`Generated: ${new Date().toISOString()}`, {
      x: 50,
      y: 15,
      size: 8,
      font: font,
      color: PDFLib.rgb(0.6, 0.6, 0.6)
    });
    
    // Save signed PDF
    state.signedPdfBytes = await pdfDoc.save();
    
    // Update final page
    document.getElementById('finalDocId').textContent = state.documentId;
    
    // Generate QR code for display
    const qrCanvas = document.getElementById('qrCode');
    await QRCode.toCanvas(qrCanvas, verifyUrl, { width: 200, margin: 2 });
    
    // Go to done step
    goToStep(4);
    
  } catch (error) {
    console.error('Error signing document:', error);
    alert('Error signing document: ' + error.message);
    btn.disabled = false;
    btn.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> Sign Document';
  }
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
  const shareText = `Document signed with SignBear 🧸\n\nDocument ID: ${state.documentId}\nVerify: ${verifyUrl}`;
  
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Signed Document',
        text: shareText
      });
    } catch (e) {
      // User cancelled or error
    }
  } else {
    // Fallback: copy to clipboard
    await navigator.clipboard.writeText(shareText);
    alert('Link copied to clipboard!');
  }
}

// Reset app
function resetApp() {
  state.currentStep = 1;
  state.pdfFile = null;
  state.pdfBytes = null;
  state.pdfDoc = null;
  state.signerName = '';
  state.signerEmail = '';
  state.signatureMode = 'draw';
  state.signatureImage = null;
  state.strokes = [];
  state.documentId = generateDocumentId();
  state.signedPdfBytes = null;
  
  // Reset form
  document.getElementById('signerName').value = '';
  document.getElementById('signerEmail').value = '';
  document.getElementById('typedSignature').value = '';
  document.getElementById('typedSignaturePreview').textContent = 'Your signature';
  
  clearSignature();
  goToStep(1);
}
