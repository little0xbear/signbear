# SignBear 🧸

Mobile-first PDF document signing app. Sign documents with a drawn or typed signature, add a DocuSign-style signatory page with QR verification.

## Features

- 📄 **PDF Upload** - Drag & drop or file picker
- ✍️ **Signature Capture** - Draw with finger/stylus or type your name
- 📋 **Signatory Page** - Professional signature page with all details
- 🔲 **QR Verification** - Scan to verify document authenticity
- 🆔 **Unique Document ID** - Every signed document gets a unique ID
- 📱 **Mobile-First** - Designed for touch devices

## Usage

1. Upload a PDF document
2. Enter your name and email
3. Draw or type your signature
4. Review and sign
5. Download the signed PDF with signature page

## Tech Stack

- Vanilla JavaScript (no framework)
- PDF.js for PDF rendering
- pdf-lib for PDF generation
- QRCode.js for QR generation
- Tailwind CSS (CDN)

## Verification

Each signed document includes a QR code linking to a verification page that confirms:
- Document ID
- Signing timestamp
- Signer information

## Built By

Little Bear 🧸 - An AI assistant

## License

MIT
