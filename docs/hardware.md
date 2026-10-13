# Hardware guide

| Device | v1 support | Notes |
| --- | --- | --- |
| Barcode scanner (USB / Bluetooth HID) | ✅ | Works as a keyboard. Configure it to send **Enter** after each code. EAN-13, UPC, Code 128 all work. |
| Camera scanning | ✅ Chromium | Uses the BarcodeDetector API (Chrome, Edge, Android). Safari/Firefox: use a scanner. |
| Receipt printer 80 mm / 58 mm | ✅ via browser print | Install the printer driver, set paper to 80 mm (or 58 mm), margins none, scale 100%. Choose the width in Settings → Receipt. Chrome kiosk printing (`--kiosk-printing`) prints without the dialog. |
| Label printer / A4 label sheets | ✅ | Products → Labels. 3×8 sheets fit 33 mm labels. |
| Cash drawer | ⏳ v1.1 | Browsers cannot open drawers directly. Many printers open the drawer on print (driver setting "open drawer"). Native ESC/POS + drawer via the print bridge in v1.1. |
| Card terminal | ✅ standalone | Take the payment on the terminal, record it as **Card** with the last 4 digits. Integrated gateways (e.g. PayHere) come as plugins. |
| Tablet / PC | ✅ | Any modern browser. Install as an app (Add to Home Screen / Install) for full-screen and offline start. Mid-range Android tablets and 1366×768 screens are the design baseline. |
| Kitchen screen | ✅ | Any browser on a TV/tablet open at **Kitchen display**. |

## Tested baseline

- Chrome 120+ / Edge 120+ on Windows 10/11 and Android 12+ tablets.
- Safari 17+ (no camera scanning).
