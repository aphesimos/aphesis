How the density maps in `system/assets/Simulacra/` were made. `research.md` is the ranked research behind the choice of images.

- **Paintings, pavements, prints** (all .jpg maps): crop to the figure, without frames or borders. Convert to grey, then set levels: black point at the 30th percentile, white point at the 97.5th. Apply gamma 0.8 for dark paintings, 1.1 for the Siena pavements, 2.2 for the Veiled Virgin and 1.2 for the Laocoön photograph. Blur the Faust etching 1.6px and the Doré plate 0.8px first. Resize to 640px on the long side; save as JPEG q84.
- **creation, hands** (Michelangelo): keep only the warm skin and drapery, so the plaster stays empty:
  `density = clamp(clamp((saturation - .18) / .25) * luminance * 1.6) ^ 1.1`. The hands are rows 150–420 and columns 300–980 of the 1280px image.
- **trismegistus** (Siena): levels 0.45–0.95, gamma 1.1. **flammarion**: inverted, levels 0.2–0.9, caption removed.
- **Cagnacci**: cropped inside the frame to x 13.5–86%, y 10.5–66%, keeping the ouroboros, the hourglass and the skull.
