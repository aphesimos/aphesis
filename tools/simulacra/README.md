How the density maps in `system/assets/Simulacra/` were made from public-domain sources (Wikimedia Commons):

- **creation, hands** (Michelangelo, c. 1512): keep the warm skin and drapery so the plaster stays empty:
  `density = clamp(clamp((saturation - .18) / .25) * luminance * 1.6) ^ 1.1`; hands = crop rows 150–420, columns 300–980 of the 1280px image.
- **ouroboros, flammarion, khunrath** (engravings): invert, then levels 0.15–0.85 (ouroboros) or 0.2–0.9; Flammarion loses its caption (bottom 9.5%).
- **hermes** (Praxiteles): crop, levels 0.60–0.90, gamma 0.75, so the museum background falls to black.
- **trismegistus** (Siena pavement): levels 0.45–0.95, gamma 1.1.
- Every map: grayscale PNG, resized to 480px on the long side.
