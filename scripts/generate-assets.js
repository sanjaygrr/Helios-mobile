const Jimp = require('jimp');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');

// Ignis color palette
const COLORS = {
  primary: 0xAA2B1DFF,    // #AA2B1D
  secondary: 0xCC561EFF,  // #CC561E
  accent: 0xEF8D32FF,     // #EF8D32
  highlight: 0xBECA5CFF,  // #BECA5C
  white: 0xFFFFFFFF,
};

async function createSplashScreen() {
  const width = 1284;
  const height = 2778;
  const image = new Jimp(width, height, COLORS.primary);

  // Add a simple flame icon in the center using circles
  const centerX = width / 2;
  const centerY = height / 2 - 100;

  // Main flame shape (orange)
  for (let y = 0; y < 200; y++) {
    const radius = Math.max(0, 80 - y * 0.4);
    for (let x = -radius; x <= radius; x++) {
      const px = Math.round(centerX + x);
      const py = Math.round(centerY + y - 100);
      if (px >= 0 && px < width && py >= 0 && py < height) {
        image.setPixelColor(COLORS.accent, px, py);
      }
    }
  }

  // Inner flame (yellow-ish)
  for (let y = 0; y < 120; y++) {
    const radius = Math.max(0, 40 - y * 0.3);
    for (let x = -radius; x <= radius; x++) {
      const px = Math.round(centerX + x);
      const py = Math.round(centerY + y - 60);
      if (px >= 0 && px < width && py >= 0 && py < height) {
        image.setPixelColor(COLORS.highlight, px, py);
      }
    }
  }

  await image.writeAsync(path.join(ASSETS_DIR, 'splash.png'));
  console.log('Created splash.png');
}

async function createIcon() {
  const size = 1024;
  const image = new Jimp(size, size, COLORS.primary);

  const centerX = size / 2;
  const centerY = size / 2;

  // Outer circle
  const outerRadius = 400;
  for (let y = -outerRadius; y <= outerRadius; y++) {
    for (let x = -outerRadius; x <= outerRadius; x++) {
      if (x * x + y * y <= outerRadius * outerRadius) {
        const px = Math.round(centerX + x);
        const py = Math.round(centerY + y);
        if (px >= 0 && px < size && py >= 0 && py < size) {
          image.setPixelColor(COLORS.secondary, px, py);
        }
      }
    }
  }

  // Main flame
  for (let y = 0; y < 300; y++) {
    const radius = Math.max(0, 120 - y * 0.4);
    for (let x = -radius; x <= radius; x++) {
      const px = Math.round(centerX + x);
      const py = Math.round(centerY + y - 150);
      if (px >= 0 && px < size && py >= 0 && py < size) {
        image.setPixelColor(COLORS.accent, px, py);
      }
    }
  }

  // Inner flame
  for (let y = 0; y < 180; y++) {
    const radius = Math.max(0, 60 - y * 0.33);
    for (let x = -radius; x <= radius; x++) {
      const px = Math.round(centerX + x);
      const py = Math.round(centerY + y - 90);
      if (px >= 0 && px < size && py >= 0 && py < size) {
        image.setPixelColor(COLORS.highlight, px, py);
      }
    }
  }

  await image.writeAsync(path.join(ASSETS_DIR, 'icon.png'));
  console.log('Created icon.png');
}

async function createAdaptiveIcon() {
  const size = 1024;
  const image = new Jimp(size, size, 0x00000000); // Transparent

  const centerX = size / 2;
  const centerY = size / 2;

  // Main flame (orange)
  for (let y = 0; y < 400; y++) {
    const radius = Math.max(0, 160 - y * 0.4);
    for (let x = -radius; x <= radius; x++) {
      const px = Math.round(centerX + x);
      const py = Math.round(centerY + y - 200);
      if (px >= 0 && px < size && py >= 0 && py < size) {
        image.setPixelColor(COLORS.accent, px, py);
      }
    }
  }

  // Inner flame
  for (let y = 0; y < 240; y++) {
    const radius = Math.max(0, 80 - y * 0.33);
    for (let x = -radius; x <= radius; x++) {
      const px = Math.round(centerX + x);
      const py = Math.round(centerY + y - 120);
      if (px >= 0 && px < size && py >= 0 && py < size) {
        image.setPixelColor(COLORS.highlight, px, py);
      }
    }
  }

  await image.writeAsync(path.join(ASSETS_DIR, 'adaptive-icon.png'));
  console.log('Created adaptive-icon.png');
}

async function createFaviconPng() {
  const size = 48;
  const image = new Jimp(size, size, COLORS.primary);

  const centerX = size / 2;
  const centerY = size / 2;

  // Simple flame
  for (let y = 0; y < 24; y++) {
    const radius = Math.max(0, 10 - y * 0.4);
    for (let x = -radius; x <= radius; x++) {
      const px = Math.round(centerX + x);
      const py = Math.round(centerY + y - 12);
      if (px >= 0 && px < size && py >= 0 && py < size) {
        image.setPixelColor(COLORS.accent, px, py);
      }
    }
  }

  await image.writeAsync(path.join(ASSETS_DIR, 'favicon.png'));
  console.log('Created favicon.png');
}

async function main() {
  console.log('Generating Ignis assets...\n');

  try {
    await createSplashScreen();
    await createIcon();
    await createAdaptiveIcon();
    await createFaviconPng();

    console.log('\nAll assets generated successfully!');
  } catch (error) {
    console.error('Error generating assets:', error);
    process.exit(1);
  }
}

main();
