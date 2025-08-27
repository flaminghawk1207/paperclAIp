import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const projectRoot = path.resolve(process.cwd());
const assetsDir = path.join(projectRoot, 'assets');
const svgPath = path.join(assetsDir, 'icon.svg');
const pngPath = path.join(assetsDir, 'icon.png');

async function ensureDirExists(dirPath) {
	await fs.mkdir(dirPath, { recursive: true });
}

async function renderSvgToPng() {
	await ensureDirExists(assetsDir);
	const svg = await fs.readFile(svgPath);
	// Render a high-res 1024x1024 PNG from SVG for icon generation
	await sharp(svg, { density: 512 })
		.resize(1024, 1024, { fit: 'contain' })
		.png({ compressionLevel: 9 })
		.toFile(pngPath);
	console.log('Wrote', path.relative(projectRoot, pngPath));
}

renderSvgToPng().catch((err) => {
	console.error('Failed to render SVG to PNG:', err);
	process.exit(1);
});
