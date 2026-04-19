# App Icon

Windows requires a multi-resolution `.ico` file at `resources/icon.ico` for the
installer, executable, and shortcuts. This folder ships with `icon.svg` (the
source). Convert it to `.ico` once before the first packaged Windows build.

## One-time conversion

Easiest options (no install):

1. **icoconvert.com** or **convertio.co** — upload `icon.svg`, request sizes
   `16, 24, 32, 48, 64, 128, 256`, download as `icon.ico`, place it here.
2. ImageMagick (if installed):
   ```sh
   convert -background none -density 384 -resize 256x256 \
     resources/icon.svg \
     -define icon:auto-resize=16,24,32,48,64,128,256 \
     resources/icon.ico
   ```
3. Inkscape + png2ico:
   ```sh
   inkscape resources/icon.svg --export-type=png --export-filename=icon-256.png -w 256 -h 256
   png2ico resources/icon.ico icon-16.png icon-32.png icon-64.png icon-128.png icon-256.png
   ```

The build will still succeed without `icon.ico` — Electron will fall back to
the default Electron icon. For a production build you definitely want the
real `.ico`.
