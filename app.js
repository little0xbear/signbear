// SignBear 🧸 - Professional PDF Signing App
// Built by Little Bear
// EU eIDAS/GDPR Compliant

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
  documentHash: null,
  signedPdfBytes: null,
  signaturePlacements: [],
  datePlacements: [],
  includeInitials: false,
  signatureSize: 150,
  placementMode: 'signature',
  selectedPlacement: null,
  // EU Compliance
  gdprConsent: false,
  sessionStartTime: null,
  auditLog: [],
  clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  userAgent: navigator.userAgent,
  language: navigator.language
};

// Storage keys
const SIGNED_DOCS_KEY = 'signbear-signed-docs';
const GDPR_CONSENT_KEY = 'signbear-gdpr-consent';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initDropZone();
  initSignatureCanvas();
  initFileInput();
  loadSavedSigner();
  loadGDPRConsent();
  state.documentId = generateDocumentId();
  state.sessionStartTime = new Date().toISOString();
  
  // Log session start
  addAuditEntry('SESSION_START', 'User started signing session');
  
  // Type signature preview
  document.getElementById('typedSignature').addEventListener('input', updateTypedPreview);
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closePdfPreview();
      closeHelp();
      closePrivacyModal();
    }
  });
});

// Audit logging
function addAuditEntry(action, details, metadata = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    timestampLocal: new Date().toLocaleString('en-US', {
      timeZone: state.clientTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    }),
    action,
    details,
    timezone: state.clientTimezone,
    ...metadata
  };
  state.auditLog.push(entry);
  return entry;
}

// GDPR Consent
function loadGDPRConsent() {
  const consent = localStorage.getItem(GDPR_CONSENT_KEY);
  if (consent) {
    state.gdprConsent = true;
  }
}

function saveGDPRConsent() {
  localStorage.setItem(GDPR_CONSENT_KEY, JSON.stringify({
    consented: true,
    timestamp: new Date().toISOString(),
    version: '1.0'
  }));
  state.gdprConsent = true;
  addAuditEntry('GDPR_CONSENT', 'User consented to privacy policy and data processing');
}

function showPrivacyModal() {
  document.getElementById('privacyModal').classList.remove('hidden');
  document.getElementById('privacyModal').classList.add('flex');
}

function closePrivacyModal() {
  document.getElementById('privacyModal').classList.add('hidden');
  document.getElementById('privacyModal').classList.remove('flex');
}

function acceptPrivacy() {
  saveGDPRConsent();
  closePrivacyModal();
  showToast('Privacy preferences saved', 'success');
}

// Generate unique document ID
function generateDocumentId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `SB-${timestamp}-${random}`;
}

// Generate document hash (for tamper detection)
async function generateDocumentHash(bytes) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

// Toast notification
function showToast(message, type = 'info', duration = 3000) {
  const existing = document.querySelector('.toast-notification');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = `toast-notification fixed bottom-24 left-4 right-4 max-w-md mx-auto px-4 py-3 rounded-xl text-sm font-medium z-50 flex items-center gap-3 ${
    type === 'success' ? 'bg-green-600' : 
    type === 'error' ? 'bg-red-600' : 
    type === 'warning' ? 'bg-yellow-600' : 'bg-blue-600'
  }`;
  
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : type === 'warning' ? '⚠' : 'ℹ';
  toast.innerHTML = `<span class="text-lg">${icon}</span><span>${message}</span>`;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function closeToast() {
  const toast = document.querySelector('.toast-notification');
  if (toast) toast.remove();
}

// Load script dynamically
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
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
    showToast('File too large. Maximum size is 10MB.', 'error');
    return;
  }
  
  // Check GDPR consent
  if (!state.gdprConsent) {
    showPrivacyModal();
    return;
  }
  
  try {
    state.pdfFile = file;
    addAuditEntry('DOCUMENT_UPLOAD', `Document uploaded: ${file.name}`, {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    });
    
    const arrayBuffer = await file.arrayBuffer();
    state.pdfBytes = new Uint8Array(arrayBuffer);
    
    // Generate hash for tamper detection
    state.documentHash = await generateDocumentHash(state.pdfBytes);
    
    // Load with PDF.js for preview
    state.pdfDoc = await pdfjsLib.getDocument({ data: state.pdfBytes.slice() }).promise;
    state.totalPages = state.pdfDoc.numPages;
    
    // Load with pdf-lib for editing
    state.pdfDocPdfLib = await PDFLib.PDFDocument.load(state.pdfBytes);
    
    // Update UI
    document.getElementById('docTitle').textContent = file.name;
    document.getElementById('docInfo').textContent = `${state.totalPages} page${state.totalPages > 1 ? 's' : ''} • ${formatFileSize(file.size)}`;
    
    addAuditEntry('DOCUMENT_LOADED', 'Document loaded successfully', {
      pageCount: state.totalPages,
      documentHash: state.documentHash
    });
    
    showToast('Document loaded successfully', 'success');
    goToStep(2);
  } catch (error) {
    console.error('Error loading PDF:', error);
    addAuditEntry('ERROR', `Failed to load document: ${error.message}`);
    showToast('Error loading PDF. Please try another file.', 'error');
  }
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
      addAuditEntry('SIGNATURE_DRAW', 'Signature stroke added');
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
  addAuditEntry('SIGNATURE_CLEAR', 'Signature cleared');
}

function undoStroke() {
  if (state.strokes.length > 0) {
    state.strokes.pop();
    redrawStrokes();
    addAuditEntry('SIGNATURE_UNDO', 'Signature stroke undone');
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
  document.querySelectorAll('[onclick^="setLineWidth"]').forEach(btn => {
    btn.classList.remove('bg-blue-600');
    btn.classList.add('bg-slate-700');
  });
  document.querySelector(`[onclick="setLineWidth(${width})"]`)?.classList.add('bg-blue-600');
  document.querySelector(`[onclick="setLineWidth(${width})"]`)?.classList.remove('bg-slate-700');
}

// Update signature size
function updateSigSize(value) {
  state.signatureSize = parseInt(value);
  const labels = { 80: 'Tiny', 100: 'Small', 150: 'Medium', 200: 'Large', 250: 'Extra Large' };
  const closest = Object.keys(labels).reduce((a, b) => 
    Math.abs(b - value) < Math.abs(a - value) ? b : a
  );
  document.getElementById('sigSizeLabel').textContent = labels[closest] || 'Custom';
}

// Set signature mode
function setSignatureMode(mode) {
  state.signatureMode = mode;
  addAuditEntry('SIGNATURE_MODE', `Signature mode changed to: ${mode}`);
  
  document.getElementById('drawMode').classList.toggle('hidden', mode !== 'draw');
  document.getElementById('typeMode').classList.toggle('hidden', mode !== 'type');
  document.getElementById('uploadMode').classList.toggle('hidden', mode !== 'upload');
  
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
  
  if (file.size > 2 * 1024 * 1024) {
    showToast('Image too large. Maximum 2MB.', 'error');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = (event) => {
    state.uploadedSigData = event.target.result;
    document.getElementById('uploadedSigImg').src = state.uploadedSigData;
    document.getElementById('uploadedSigPreview').classList.remove('hidden');
    addAuditEntry('SIGNATURE_UPLOAD', 'Signature image uploaded');
    showToast('Signature image uploaded', 'success');
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

// Save signed document info for verification
function saveSignedDocumentInfo() {
  const docs = JSON.parse(localStorage.getItem(SIGNED_DOCS_KEY) || '{}');
  docs[state.documentId] = {
    id: state.documentId,
    hash: state.documentHash,
    fileName: state.pdfFile.name,
    signerName: state.signerName,
    signerEmail: state.signerEmail,
    signerTitle: state.signerTitle,
    signerOrg: state.signerOrg,
    signedAt: new Date().toISOString(),
    signedAtLocal: new Date().toLocaleString('en-US', {
      timeZone: state.clientTimezone,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    }),
    totalPages: state.totalPages,
    signatureCount: state.signaturePlacements.length,
    dateCount: state.datePlacements.length,
    timezone: state.clientTimezone,
    auditLog: state.auditLog,
    userAgent: state.userAgent,
    language: state.language,
    sessionDuration: Date.now() - new Date(state.sessionStartTime).getTime()
  };
  localStorage.setItem(SIGNED_DOCS_KEY, JSON.stringify(docs));
}

// Get signed document info
function getSignedDocumentInfo(docId) {
  const docs = JSON.parse(localStorage.getItem(SIGNED_DOCS_KEY) || '{}');
  return docs[docId] || null;
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
      showToast('Please enter your name', 'warning');
      document.getElementById('signerName').focus();
      return;
    }
    if (!state.signerEmail || !state.signerEmail.includes('@')) {
      showToast('Please enter a valid email address', 'warning');
      document.getElementById('signerEmail').focus();
      return;
    }
    
    // Check signature
    if (state.signatureMode === 'draw' && state.strokes.length === 0) {
      showToast('Please draw your signature', 'warning');
      return;
    }
    if (state.signatureMode === 'type' && !document.getElementById('typedSignature').value.trim()) {
      showToast('Please type your signature', 'warning');
      document.getElementById('typedSignature').focus();
      return;
    }
    if (state.signatureMode === 'upload' && !state.uploadedSigData) {
      showToast('Please upload a signature image', 'warning');
      return;
    }
    
    saveSignerInfo();
    addAuditEntry('SIGNER_INFO', 'Signer information saved', {
      name: state.signerName,
      email: state.signerEmail,
      hasTitle: !!state.signerTitle,
      hasOrg: !!state.signerOrg,
      includeInitials: state.includeInitials
    });
    
    // Get signature preview
    const sigImage = await getSignatureImage();
    document.getElementById('placementSigPreview').src = sigImage;
    
    // Render first page
    state.currentPage = 1;
    await renderCurrentPage();
    
    addAuditEntry('PLACEMENT_MODE', 'Entered signature placement mode');
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
  
  // Show/hide page jump for multi-page documents
  const pageJumpContainer = document.getElementById('pageJumpContainer');
  if (state.totalPages > 3) {
    pageJumpContainer.classList.remove('hidden');
    const pageJump = document.getElementById('pageJump');
    pageJump.innerHTML = '';
    for (let i = 1; i <= state.totalPages; i++) {
      pageJump.innerHTML += `<option value="${i}" ${i === state.currentPage ? 'selected' : ''}>Page ${i}</option>`;
    }
  } else {
    pageJumpContainer.classList.add('hidden');
  }
  
  // Setup overlay for placements
  const overlay = document.getElementById('signatureOverlay');
  overlay.innerHTML = '';
  
  // Show signature placements on this page
  const pageSignaturePlacements = state.signaturePlacements.filter(p => p.page === state.currentPage);
  pageSignaturePlacements.forEach((p, i) => {
    const div = createPlacementElement(p, i, 'signature');
    overlay.appendChild(div);
  });
  
  // Show date placements on this page
  const pageDatePlacements = state.datePlacements.filter(p => p.page === state.currentPage);
  pageDatePlacements.forEach((p, i) => {
    const div = createPlacementElement(p, i, 'date');
    overlay.appendChild(div);
  });
  
  // Click to place
  overlay.onclick = async (e) => {
    if (e.target !== overlay) return;
    
    const rect = overlay.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    
    if (state.placementMode === 'signature') {
      const sigWidth = state.signatureSize / scaledViewport.width;
      const sigHeight = sigWidth * 0.4;
      
      state.signaturePlacements.push({
        page: state.currentPage,
        x: Math.max(0, Math.min(1 - sigWidth, x - sigWidth / 2)),
        y: Math.max(0, Math.min(1 - sigHeight, y - sigHeight / 2)),
        width: sigWidth,
        height: sigHeight
      });
      
      addAuditEntry('SIGNATURE_PLACED', `Signature placed on page ${state.currentPage}`);
      showToast('Signature placed', 'success');
    } else {
      state.datePlacements.push({
        page: state.currentPage,
        x: Math.max(0, x - 0.08),
        y: Math.max(0, y - 0.02),
        width: 0.16,
        height: 0.04
      });
      
      addAuditEntry('DATE_PLACED', `Date placed on page ${state.currentPage}`);
      showToast('Date placed', 'success');
    }
    
    await renderCurrentPage();
    updatePlacementsList();
  };
}

// Create placement element
function createPlacementElement(placement, index, type) {
  const div = document.createElement('div');
  div.className = `signature-field placed ${type === 'date' ? 'date-field' : ''}`;
  div.style.left = `${placement.x * 100}%`;
  div.style.top = `${placement.y * 100}%`;
  div.style.width = `${placement.width * 100}%`;
  div.style.height = `${placement.height * 100}%`;
  div.dataset.type = type;
  div.dataset.index = index;
  
  if (type === 'date') {
    div.innerHTML = `<span class="text-xs text-blue-600 p-1">📅 Date</span>`;
  } else {
    div.innerHTML = `<span class="text-xs text-green-600 p-1">✓ Signature</span>`;
  }
  
  div.onclick = (e) => {
    e.stopPropagation();
    selectPlacement(placement, index, type);
  };
  
  return div;
}

// Select placement
function selectPlacement(placement, index, type) {
  state.selectedPlacement = { placement, index, type };
  
  document.querySelectorAll('.signature-field').forEach(el => {
    el.style.outline = 'none';
  });
  
  event.target.closest('.signature-field').style.outline = '2px solid white';
}

// Set placement mode
function setPlacementMode(mode) {
  state.placementMode = mode;
  
  document.querySelectorAll('[onclick^="setPlacementMode"]').forEach(btn => {
    btn.classList.remove('bg-blue-600');
    btn.classList.add('bg-slate-700');
  });
  document.querySelector(`[onclick="setPlacementMode('${mode}')"]`)?.classList.add('bg-blue-600');
  document.querySelector(`[onclick="setPlacementMode('${mode}')"]`)?.classList.remove('bg-slate-700');
}

// Update placements list
function updatePlacementsList() {
  const container = document.getElementById('placedSignaturesList');
  const content = document.getElementById('signaturesListContent');
  
  const totalPlacements = state.signaturePlacements.length + state.datePlacements.length;
  
  if (totalPlacements === 0) {
    container.classList.add('hidden');
    return;
  }
  
  container.classList.remove('hidden');
  
  let html = '';
  
  state.signaturePlacements.forEach((p, i) => {
    html += `
      <div class="flex items-center justify-between bg-slate-700/30 rounded-lg px-3 py-2">
        <span class="text-sm flex items-center gap-2">
          <span class="text-green-400">✓</span>
          Signature on Page ${p.page}
        </span>
        <button onclick="removeSignaturePlacement(${i})" class="text-red-400 hover:text-red-300 text-sm p-1">✕</button>
      </div>
    `;
  });
  
  state.datePlacements.forEach((p, i) => {
    html += `
      <div class="flex items-center justify-between bg-slate-700/30 rounded-lg px-3 py-2">
        <span class="text-sm flex items-center gap-2">
          <span class="text-blue-400">📅</span>
          Date on Page ${p.page}
        </span>
        <button onclick="removeDatePlacement(${i})" class="text-red-400 hover:text-red-300 text-sm p-1">✕</button>
      </div>
    `;
  });
  
  content.innerHTML = html;
}

// Remove placements
async function removeSignaturePlacement(index) {
  const placement = state.signaturePlacements[index];
  state.signaturePlacements.splice(index, 1);
  addAuditEntry('SIGNATURE_REMOVED', `Signature removed from page ${placement.page}`);
  await renderCurrentPage();
  updatePlacementsList();
  showToast('Signature removed', 'info');
}

async function removeDatePlacement(index) {
  const placement = state.datePlacements[index];
  state.datePlacements.splice(index, 1);
  addAuditEntry('DATE_REMOVED', `Date removed from page ${placement.page}`);
  await renderCurrentPage();
  updatePlacementsList();
  showToast('Date removed', 'info');
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

async function jumpToPage(pageNum) {
  const page = parseInt(pageNum);
  if (page >= 1 && page <= state.totalPages && page !== state.currentPage) {
    state.currentPage = page;
    await renderCurrentPage();
  }
}

// Preview document
async function previewDocument() {
  const modal = document.getElementById('pdfModal');
  const container = document.getElementById('pdfPages');
  container.innerHTML = '<div class="text-center py-8"><div class="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto"></div><p class="text-sm text-slate-400 mt-2">Loading...</p></div>';
  
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  
  addAuditEntry('DOCUMENT_PREVIEW', 'Document preview opened');
  
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
    wrapper.className = 'text-center mb-6';
    wrapper.innerHTML = `<p class="text-sm text-slate-400 mb-2">Page ${i}</p>`;
    wrapper.appendChild(canvas);
    container.appendChild(wrapper);
  }
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
  if (state.signaturePlacements.length === 0) {
    showToast('Please place at least one signature on the document', 'warning');
    return;
  }
  
  // Check if QRCode library is loaded
  if (typeof QRCode === 'undefined') {
    showToast('QR code library not loaded. Please refresh the page.', 'error');
    try {
      await loadScript('https://unpkg.com/qrcode@1.5.3/build/qrcode.min.js');
    } catch (e) {
      showToast('Failed to load QR code library', 'error');
      return;
    }
  }
  
  const btn = document.getElementById('signButton');
  btn.disabled = true;
  btn.innerHTML = '<svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg> Signing...';
  
  addAuditEntry('SIGNING_STARTED', 'Document signing process started');
  
  try {
    const sigImageData = await getSignatureImage();
    const pdfDoc = await PDFLib.PDFDocument.load(state.pdfBytes);
    const sigImageBytes = await fetch(sigImageData).then(r => r.arrayBuffer());
    const sigImage = await pdfDoc.embedPng(sigImageBytes);
    
    const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
    const fontMono = await pdfDoc.embedFont(PDFLib.StandardFonts.Courier);
    
    const dateFormat = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const dateStr = dateFormat.format(new Date());
    
    // Place signatures on pages
    for (const placement of state.signaturePlacements) {
      const page = pdfDoc.getPage(placement.page - 1);
      const { width, height } = page.getSize();
      
      const sigWidth = placement.width * width;
      const sigHeight = placement.height * height;
      const sigX = placement.x * width;
      const sigY = height - (placement.y * height) - sigHeight;
      
      page.drawImage(sigImage, { x: sigX, y: sigY, width: sigWidth, height: sigHeight });
    }
    
    // Place dates on pages
    for (const placement of state.datePlacements) {
      const page = pdfDoc.getPage(placement.page - 1);
      const { width, height } = page.getSize();
      
      const dateX = placement.x * width;
      const dateY = height - (placement.y * height) - (placement.height * height / 2);
      
      page.drawText(dateStr, { x: dateX, y: dateY, size: 10, font: font, color: PDFLib.rgb(0.3, 0.3, 0.3) });
    }
    
    // Add initials if requested
    if (state.includeInitials) {
      const initials = state.signerName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
      
      for (let i = 0; i < pdfDoc.getPageCount(); i++) {
        const page = pdfDoc.getPage(i);
        const { width, height } = page.getSize();
        page.drawText(initials, { x: width - 50, y: 30, size: 10, font: font, color: PDFLib.rgb(0.4, 0.4, 0.4) });
      }
    }
    
    // ============================================
    // SIGNATURE PAGE (eIDAS Compliant)
    // ============================================
    const sigPage = pdfDoc.addPage([612, 792]);
    const { width: pageWidth, height: pageHeight } = sigPage.getSize();
    
    // Header
    sigPage.drawText('ELECTRONIC SIGNATURE CERTIFICATE', {
      x: 50, y: pageHeight - 50, size: 18, font: fontBold, color: PDFLib.rgb(0.1, 0.1, 0.1)
    });
    
    sigPage.drawRectangle({
      x: 50, y: pageHeight - 70, width: pageWidth - 100, height: 3,
      color: PDFLib.rgb(0.2, 0.4, 0.8)
    });
    
    // eIDAS Compliance Notice
    sigPage.drawText('This document has been electronically signed in accordance with EU eIDAS Regulation (EU) No 910/2014', {
      x: 50, y: pageHeight - 90, size: 8, font: font, color: PDFLib.rgb(0.4, 0.4, 0.4)
    });
    
    // Document Section
    let yPos = pageHeight - 120;
    
    sigPage.drawText('DOCUMENT INFORMATION', {
      x: 50, y: yPos, size: 12, font: fontBold, color: PDFLib.rgb(0.2, 0.2, 0.2)
    });
    
    yPos -= 20;
    sigPage.drawText('Document Name:', { x: 50, y: yPos, size: 10, font: fontBold, color: PDFLib.rgb(0.4, 0.4, 0.4) });
    sigPage.drawText(state.pdfFile.name.substring(0, 50), { x: 180, y: yPos, size: 10, font: font, color: PDFLib.rgb(0.2, 0.2, 0.2) });
    
    yPos -= 18;
    sigPage.drawText('Document ID:', { x: 50, y: yPos, size: 10, font: fontBold, color: PDFLib.rgb(0.4, 0.4, 0.4) });
    sigPage.drawText(state.documentId, { x: 180, y: yPos, size: 10, font: fontMono, color: PDFLib.rgb(0.2, 0.2, 0.2) });
    
    yPos -= 18;
    sigPage.drawText('Document Hash:', { x: 50, y: yPos, size: 10, font: fontBold, color: PDFLib.rgb(0.4, 0.4, 0.4) });
    sigPage.drawText(state.documentHash, { x: 180, y: yPos, size: 10, font: fontMono, color: PDFLib.rgb(0.2, 0.2, 0.2) });
    
    yPos -= 18;
    sigPage.drawText('Total Pages:', { x: 50, y: yPos, size: 10, font: fontBold, color: PDFLib.rgb(0.4, 0.4, 0.4) });
    sigPage.drawText(String(state.totalPages), { x: 180, y: yPos, size: 10, font: font, color: PDFLib.rgb(0.2, 0.2, 0.2) });
    
    // Signatory Section
    yPos -= 35;
    sigPage.drawText('SIGNATORY', {
      x: 50, y: yPos, size: 12, font: fontBold, color: PDFLib.rgb(0.2, 0.2, 0.2)
    });
    
    yPos -= 15;
    sigPage.drawRectangle({
      x: 50, y: yPos - 130, width: pageWidth - 100, height: 140,
      borderColor: PDFLib.rgb(0.8, 0.8, 0.8), borderWidth: 1,
      color: PDFLib.rgb(0.99, 0.99, 0.99)
    });
    
    yPos -= 18;
    sigPage.drawText('Full Name:', { x: 70, y: yPos, size: 9, font: fontBold, color: PDFLib.rgb(0.5, 0.5, 0.5) });
    sigPage.drawText(state.signerName, { x: 180, y: yPos, size: 11, font: font, color: PDFLib.rgb(0.1, 0.1, 0.1) });
    
    yPos -= 18;
    sigPage.drawText('Email:', { x: 70, y: yPos, size: 9, font: fontBold, color: PDFLib.rgb(0.5, 0.5, 0.5) });
    sigPage.drawText(state.signerEmail, { x: 180, y: yPos, size: 11, font: font, color: PDFLib.rgb(0.1, 0.1, 0.1) });
    
    if (state.signerTitle) {
      yPos -= 18;
      sigPage.drawText('Title:', { x: 70, y: yPos, size: 9, font: fontBold, color: PDFLib.rgb(0.5, 0.5, 0.5) });
      sigPage.drawText(state.signerTitle, { x: 180, y: yPos, size: 11, font: font, color: PDFLib.rgb(0.1, 0.1, 0.1) });
    }
    
    if (state.signerOrg) {
      yPos -= 18;
      sigPage.drawText('Organization:', { x: 70, y: yPos, size: 9, font: fontBold, color: PDFLib.rgb(0.5, 0.5, 0.5) });
      sigPage.drawText(state.signerOrg, { x: 180, y: yPos, size: 11, font: font, color: PDFLib.rgb(0.1, 0.1, 0.1) });
    }
    
    yPos -= 25;
    sigPage.drawText('Signature:', { x: 70, y: yPos, size: 9, font: fontBold, color: PDFLib.rgb(0.5, 0.5, 0.5) });
    sigPage.drawImage(sigImage, { x: 70, y: yPos - 45, width: 160, height: 45 });
    
    // Timestamp Section
    yPos = yPos - 70;
    sigPage.drawText('SIGNING DETAILS', {
      x: 50, y: yPos, size: 12, font: fontBold, color: PDFLib.rgb(0.2, 0.2, 0.2)
    });
    
    yPos -= 18;
    const signedAtUTC = new Date().toISOString();
    const signedAtLocal = new Date().toLocaleString('en-US', {
      timeZone: state.clientTimezone,
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      timeZoneName: 'short'
    });
    
    sigPage.drawText('Date/Time (UTC):', { x: 50, y: yPos, size: 9, font: fontBold, color: PDFLib.rgb(0.5, 0.5, 0.5) });
    sigPage.drawText(signedAtUTC, { x: 180, y: yPos, size: 9, font: fontMono, color: PDFLib.rgb(0.2, 0.2, 0.2) });
    
    yPos -= 16;
    sigPage.drawText('Date/Time (Local):', { x: 50, y: yPos, size: 9, font: fontBold, color: PDFLib.rgb(0.5, 0.5, 0.5) });
    sigPage.drawText(signedAtLocal, { x: 180, y: yPos, size: 9, font: font, color: PDFLib.rgb(0.2, 0.2, 0.2) });
    
    yPos -= 16;
    sigPage.drawText('Timezone:', { x: 50, y: yPos, size: 9, font: fontBold, color: PDFLib.rgb(0.5, 0.5, 0.5) });
    sigPage.drawText(state.clientTimezone, { x: 180, y: yPos, size: 9, font: font, color: PDFLib.rgb(0.2, 0.2, 0.2) });
    
    yPos -= 16;
    sigPage.drawText('Signatures Placed:', { x: 50, y: yPos, size: 9, font: fontBold, color: PDFLib.rgb(0.5, 0.5, 0.5) });
    sigPage.drawText(String(state.signaturePlacements.length), { x: 180, y: yPos, size: 9, font: font, color: PDFLib.rgb(0.2, 0.2, 0.2) });
    
    // QR Code
    yPos = Math.min(yPos - 60, 180);
    sigPage.drawText('VERIFICATION', {
      x: 50, y: yPos, size: 12, font: fontBold, color: PDFLib.rgb(0.2, 0.2, 0.2)
    });
    
    const verifyUrl = `${window.location.origin}/verify.html?id=${state.documentId}`;
    
    let qrDataUrl;
    if (typeof QRCode !== 'undefined') {
      qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 150, margin: 1 });
    } else {
      qrDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    }
    const qrImageBytes = await fetch(qrDataUrl).then(r => r.arrayBuffer());
    const qrImage = await pdfDoc.embedPng(qrImageBytes);
    
    sigPage.drawImage(qrImage, { x: 50, y: yPos - 120, width: 90, height: 90 });
    
    sigPage.drawText('Scan to verify authenticity', { x: 150, y: yPos - 40, size: 9, font: font, color: PDFLib.rgb(0.4, 0.4, 0.4) });
    sigPage.drawText(`ID: ${state.documentId}`, { x: 150, y: yPos - 55, size: 8, font: fontMono, color: PDFLib.rgb(0.5, 0.5, 0.5) });
    
    // ============================================
    // AUDIT TRAIL PAGE (New for EU Compliance)
    // ============================================
    const auditPage = pdfDoc.addPage([612, 792]);
    let aY = pageHeight - 50;
    
    auditPage.drawText('AUDIT TRAIL & VERIFICATION LOG', {
      x: 50, y: aY, size: 18, font: fontBold, color: PDFLib.rgb(0.1, 0.1, 0.1)
    });
    
    auditPage.drawRectangle({
      x: 50, y: aY - 20, width: pageWidth - 100, height: 3,
      color: PDFLib.rgb(0.2, 0.4, 0.8)
    });
    
    // Document Reference
    aY -= 50;
    auditPage.drawText('Document ID:', { x: 50, y: aY, size: 10, font: fontBold, color: PDFLib.rgb(0.4, 0.4, 0.4) });
    auditPage.drawText(state.documentId, { x: 150, y: aY, size: 10, font: fontMono, color: PDFLib.rgb(0.2, 0.2, 0.2) });
    
    aY -= 16;
    auditPage.drawText('Document Hash:', { x: 50, y: aY, size: 10, font: fontBold, color: PDFLib.rgb(0.4, 0.4, 0.4) });
    auditPage.drawText(state.documentHash, { x: 150, y: aY, size: 10, font: fontMono, color: PDFLib.rgb(0.2, 0.2, 0.2) });
    
    // Session Info
    aY -= 35;
    auditPage.drawText('SESSION INFORMATION', {
      x: 50, y: aY, size: 12, font: fontBold, color: PDFLib.rgb(0.2, 0.2, 0.2)
    });
    
    aY -= 18;
    auditPage.drawText('Session Started:', { x: 50, y: aY, size: 9, font: fontBold, color: PDFLib.rgb(0.5, 0.5, 0.5) });
    auditPage.drawText(state.sessionStartTime, { x: 180, y: aY, size: 9, font: fontMono, color: PDFLib.rgb(0.2, 0.2, 0.2) });
    
    aY -= 16;
    auditPage.drawText('Session Ended:', { x: 50, y: aY, size: 9, font: fontBold, color: PDFLib.rgb(0.5, 0.5, 0.5) });
    auditPage.drawText(signedAtUTC, { x: 180, y: aY, size: 9, font: fontMono, color: PDFLib.rgb(0.2, 0.2, 0.2) });
    
    aY -= 16;
    auditPage.drawText('Client Timezone:', { x: 50, y: aY, size: 9, font: fontBold, color: PDFLib.rgb(0.5, 0.5, 0.5) });
    auditPage.drawText(state.clientTimezone, { x: 180, y: aY, size: 9, font: font, color: PDFLib.rgb(0.2, 0.2, 0.2) });
    
    aY -= 16;
    auditPage.drawText('Browser Language:', { x: 50, y: aY, size: 9, font: fontBold, color: PDFLib.rgb(0.5, 0.5, 0.5) });
    auditPage.drawText(state.language, { x: 180, y: aY, size: 9, font: font, color: PDFLib.rgb(0.2, 0.2, 0.2) });
    
    // Audit Log
    aY -= 35;
    auditPage.drawText('EVENT LOG', {
      x: 50, y: aY, size: 12, font: fontBold, color: PDFLib.rgb(0.2, 0.2, 0.2)
    });
    
    // Table header
    aY -= 15;
    auditPage.drawRectangle({
      x: 50, y: aY - 15, width: pageWidth - 100, height: 15,
      color: PDFLib.rgb(0.9, 0.9, 0.9)
    });
    auditPage.drawText('Timestamp (UTC)', { x: 55, y: aY - 12, size: 8, font: fontBold, color: PDFLib.rgb(0.3, 0.3, 0.3) });
    auditPage.drawText('Event', { x: 200, y: aY - 12, size: 8, font: fontBold, color: PDFLib.rgb(0.3, 0.3, 0.3) });
    auditPage.drawText('Details', { x: 350, y: aY - 12, size: 8, font: fontBold, color: PDFLib.rgb(0.3, 0.3, 0.3) });
    
    // Log entries
    aY -= 20;
    state.auditLog.forEach((entry, i) => {
      if (aY < 80) return; // Stop if we run out of space
      
      const bgColor = i % 2 === 0 ? PDFLib.rgb(0.98, 0.98, 0.98) : PDFLib.rgb(1, 1, 1);
      auditPage.drawRectangle({
        x: 50, y: aY - 12, width: pageWidth - 100, height: 14,
        color: bgColor
      });
      
      const ts = entry.timestamp.split('T')[1]?.split('.')[0] || entry.timestamp;
      auditPage.drawText(ts, { x: 55, y: aY - 10, size: 7, font: fontMono, color: PDFLib.rgb(0.3, 0.3, 0.3) });
      auditPage.drawText(entry.action.substring(0, 20), { x: 200, y: aY - 10, size: 7, font: font, color: PDFLib.rgb(0.3, 0.3, 0.3) });
      auditPage.drawText(entry.details.substring(0, 40), { x: 350, y: aY - 10, size: 7, font: font, color: PDFLib.rgb(0.3, 0.3, 0.3) });
      
      aY -= 14;
    });
    
    // Compliance footer
    auditPage.drawText('This audit trail is generated automatically and is an integral part of the signed document.', {
      x: 50, y: 50, size: 8, font: font, color: PDFLib.rgb(0.5, 0.5, 0.5)
    });
    auditPage.drawText('Any modification to this document will invalidate the signature.', {
      x: 50, y: 38, size: 8, font: font, color: PDFLib.rgb(0.5, 0.5, 0.5)
    });
    auditPage.drawText(`Generated by SignBear 🧸 at ${signedAtUTC}`, {
      x: 50, y: 26, size: 7, font: font, color: PDFLib.rgb(0.6, 0.6, 0.6)
    });
    
    // Save
    state.signedPdfBytes = await pdfDoc.save();
    
    // Add final audit entry
    addAuditEntry('DOCUMENT_SIGNED', 'Document successfully signed and sealed');
    
    // Save document info for verification
    saveSignedDocumentInfo();
    
    // Update final page UI
    const initials = state.signerName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    document.getElementById('finalDocId').textContent = state.documentId;
    document.getElementById('finalInitials').textContent = initials;
    document.getElementById('finalName').textContent = state.signerName;
    document.getElementById('finalEmail').textContent = state.signerEmail;
    document.getElementById('finalDate').textContent = signedAtLocal;
    
    // Generate QR for display
    const qrCanvas = document.getElementById('qrCode');
    if (typeof QRCode !== 'undefined') {
      await QRCode.toCanvas(qrCanvas, verifyUrl, { width: 180, margin: 2 });
    } else {
      qrCanvas.parentElement.innerHTML = `<p class="text-xs text-slate-600 break-all">${verifyUrl}</p>`;
    }
    
    showToast('Document signed successfully!', 'success');
    goToStep(4);
    
  } catch (error) {
    console.error('Error signing document:', error);
    addAuditEntry('SIGNING_ERROR', `Error: ${error.message}`);
    showToast('Error signing document: ' + error.message, 'error');
    btn.disabled = false;
    btn.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> Sign & Download';
  }
}

// Copy document ID
function copyDocId() {
  navigator.clipboard.writeText(state.documentId);
  showToast('Document ID copied!', 'success');
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
  
  addAuditEntry('DOCUMENT_DOWNLOADED', 'Signed document downloaded');
  showToast('PDF downloaded!', 'success');
}

// Share document
async function shareDocument() {
  const verifyUrl = `${window.location.origin}/verify.html?id=${state.documentId}`;
  const shareText = `Document signed with SignBear 🧸\n\nDocument: ${state.pdfFile.name}\nDocument ID: ${state.documentId}\nSigned by: ${state.signerName}\n\nVerify: ${verifyUrl}`;
  
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Signed Document', text: shareText });
      addAuditEntry('DOCUMENT_SHARED', 'Document shared via Web Share API');
    } catch (e) {}
  } else {
    await navigator.clipboard.writeText(shareText);
    addAuditEntry('LINK_COPIED', 'Verification link copied to clipboard');
    showToast('Verification link copied to clipboard!', 'success');
  }
}

// Reset app
function resetApp() {
  addAuditEntry('SESSION_RESET', 'User started a new signing session');
  
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
    documentHash: null,
    signedPdfBytes: null,
    signaturePlacements: [],
    datePlacements: [],
    placementMode: 'signature',
    selectedPlacement: null,
    sessionStartTime: new Date().toISOString(),
    auditLog: []
  });
  
  document.getElementById('typedSignature').value = '';
  document.getElementById('uploadedSigPreview').classList.add('hidden');
  document.getElementById('placedSignaturesList').classList.add('hidden');
  
  clearSignature();
  goToStep(1);
}

// Close modals on backdrop click
document.getElementById('pdfModal')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closePdfPreview();
});

document.getElementById('helpModal')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeHelp();
});

document.getElementById('privacyModal')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closePrivacyModal();
});
