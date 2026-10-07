# App icons

Drop the following PNG files into this folder. They are referenced by
`app/manifest.ts` (and the Apple touch icon is picked up by the app metadata in
`app/layout.tsx`). No binary images are checked in yet — add them here:

| File | Size | Notes |
| --- | --- | --- |
| `icon-192.png` | 192×192 | Standard icon (`purpose: any`) |
| `icon-512.png` | 512×512 | Standard icon (`purpose: any`) |
| `icon-512-maskable.png` | 512×512 | Maskable icon — keep the logo within a ~10% safe-area padding on all sides |
| `apple-touch-icon.png` | 180×180 | Apple home-screen icon |

Keep the filenames exactly as above so the manifest and metadata resolve correctly.
