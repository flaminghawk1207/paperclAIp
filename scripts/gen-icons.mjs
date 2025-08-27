import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const projectRoot = path.resolve(process.cwd());
const assetsDir = path.join(projectRoot, 'assets');
const svgPath = path.join(assetsDir, 'icon.svg');
const pngBase = path.join(assetsDir, 'icon.png');
const icnsPath = path.join(assetsDir, 'icon.icns');
const icoPath = path.join(assetsDir, 'icon.ico');

const iconsetDir = path.join(assetsDir, 'icon.iconset');

async function ensureDir(dir) {
	await fs.mkdir(dir, { recursive: true });
}

async function renderBasePng() {
	const svg = await fs.readFile(svgPath);
	await sharp(svg, { density: 512 })
		.resize(1024, 1024)
		.png({ compressionLevel: 9 })
		.toFile(pngBase);
	console.log('Wrote', path.relative(projectRoot, pngBase));
}

async function renderIconsetPngs() {
	const sizes = [16, 32, 64, 128, 256, 512, 1024];
	await ensureDir(iconsetDir);
	const svg = await fs.readFile(svgPath);
	for (const size of sizes) {
		const filename = `icon_${size}x${size}.png`;
		const filePath = path.join(iconsetDir, filename);
		await sharp(svg, { density: 512 })
			.resize(size, size)
			.png({ compressionLevel: 9 })
			.toFile(filePath);
	}
	console.log('Wrote iconset PNGs in', path.relative(projectRoot, iconsetDir));
}

async function buildIcns() {
	// macOS-only: use iconutil if available
	try {
		await fs.access('/usr/bin/iconutil');
	} catch {
		console.warn('iconutil not found; skipping .icns generation.');
		return;
	}
	const { execFile } = await import('node:child_process');
	const execFileAsync = (cmd, args) => new Promise((resolve, reject) => {
		execFile(cmd, args, (err, stdout, stderr) => {
			if (err) reject(Object.assign(err, { stdout, stderr }));
			else resolve({ stdout, stderr });
		});
	});
	await execFileAsync('/usr/bin/iconutil', ['-c', 'icns', iconsetDir, '-o', icnsPath]);
	console.log('Wrote', path.relative(projectRoot, icnsPath));
}

async function buildIco() {
	const sizes = [16, 24, 32, 48, 64, 128, 256];
	const buffers = [];
	for (const size of sizes) {
		const buf = await sharp(pngBase).resize(size, size).png().toBuffer();
		buffers.push(buf);
	}
	const ico = await pngToIco(buffers);
	await fs.writeFile(icoPath, ico);
	console.log('Wrote', path.relative(projectRoot, icoPath));
}

async function main() {
	await ensureDir(assetsDir);
	await renderBasePng();
	await renderIconsetPngs();
	await buildIcns();
	await buildIco();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
