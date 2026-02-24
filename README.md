# SignBear 🧸

Professional EU-compliant PDF document signing app with signature placement, audit trails, and QR verification.

## Features

### 📄 Document Handling
- Upload PDF files up to 10MB
- Preview all pages before signing
- Navigate through multi-page documents
- Page jump for quick navigation

### ✍️ Signature Creation
- **Draw** - Natural handwriting with adjustable ink color (3 options) and width (3 sizes)
- **Type** - Choose from 3 professional signature fonts
- **Upload** - Import your own signature image (PNG, JPG)

### 📍 Smart Placement
- Tap anywhere on any page to place your signature
- Add date stamps at specific locations
- Visual placement indicators
- Signature size adjustment (slider)
- Remove placements easily

### 🔒 EU Compliance (eIDAS & GDPR)
- **GDPR Consent** - Privacy modal before processing
- **eIDAS Compliant** - Meets EU electronic signature standards
- **Audit Trail** - Complete event log with timestamps
- **Document Hash** - SHA-256 for tamper detection
- **Timezone Support** - UTC and local timestamps
- **Data Retention Notice** - Clear data handling information
- **User Rights** - GDPR rights explained

### 📋 Document Verification
- Unique document ID (SB-XXXXXXXX-XXXXXX format)
- QR code linking to verification page
- Complete audit trail viewing
- Document integrity verification
- Signatory information display

### 👤 Signer Information
- Full name and email
- Title/Position
- Organization
- Optional initials on each page

### 📱 Mobile-First Design
- Touch-friendly signature canvas
- Responsive layout
- Works on all devices
- Glass morphism UI
- Smooth animations

## Output

Each signed PDF includes:
1. **Original document pages** with signatures and dates placed
2. **Signature Certificate Page** with:
   - Document information
   - Signatory details
   - Timestamps (UTC and local)
   - QR verification code
   - eIDAS compliance notice
3. **Audit Trail Page** with:
   - Complete event log
   - Timestamps for all actions
   - Session information
   - Verification hash

## Usage

1. **Upload** - Drag & drop or select a PDF document
2. **Accept Privacy** - Review and accept GDPR terms
3. **Prepare** - Enter your details and create your signature
4. **Place** - Navigate pages and tap to place signatures/dates
5. **Download** - Get your signed PDF with verification pages

## Tech Stack

- Vanilla JavaScript (no framework)
- PDF.js for PDF rendering
- pdf-lib for PDF generation
- QRCode.js for QR generation
- Tailwind CSS (CDN)

## Live Demo

Visit: https://signbear.vercel.app

## Verification

Verify signed documents at: https://signbear.vercel.app/verify.html?id=YOUR_DOCUMENT_ID

## EU Compliance

This application is designed to comply with:
- **eIDAS** (EU Regulation No 910/2014) - Electronic identification and trust services
- **GDPR** - General Data Protection Regulation

## Built By

Little Bear 🧸 - An AI assistant

## License

MIT
