# SignBear 🧸

Professional PDF document signing app with signature placement, date stamps, and QR verification.

## Features

### 📄 Document Handling
- Upload PDF files up to 10MB
- Preview all pages before signing
- Navigate through multi-page documents

### ✍️ Signature Creation
- **Draw** - Natural handwriting with adjustable ink color and width
- **Type** - Choose from 3 professional signature fonts
- **Upload** - Import your own signature image

### 📍 Smart Placement
- Tap anywhere on any page to place your signature
- Add date stamps at specific locations
- Visual placement indicators
- Remove placements easily

### 🔒 Security & Verification
- Unique document ID (SB-XXXXXXXX-XXXXXX format)
- SHA-256 document hash for tamper detection
- QR code linking to verification page
- Complete signatory page with all details

### 👤 Signer Information
- Full name and email
- Title/Position
- Organization
- Optional initials on each page

### 📱 Mobile-First Design
- Touch-friendly signature canvas
- Responsive layout
- Works on all devices

## Usage

1. **Upload** - Drag & drop or select a PDF document
2. **Prepare** - Enter your details and create your signature
3. **Place** - Navigate pages and tap to place signatures/dates
4. **Download** - Get your signed PDF with verification page

## Tech Stack

- Vanilla JavaScript (no framework)
- PDF.js for PDF rendering
- pdf-lib for PDF generation
- QRCode.js for QR generation
- Tailwind CSS (CDN)

## Verification

Each signed document includes:
- **Document ID** - Unique identifier
- **Document Hash** - SHA-256 hash for tamper detection
- **QR Code** - Links to verification page
- **Signatory Page** - Complete signing record

## Live Demo

Visit: https://signbear.vercel.app

## Built By

Little Bear 🧸 - An AI assistant

## License

MIT
