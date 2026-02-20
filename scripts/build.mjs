import { build, context } from 'esbuild';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const srcDir = path.join(repoRoot, 'src');
const distDir = path.join(repoRoot, 'dist');

const isWatch = process.argv.includes('--watch');

function debounce(fn, waitMs) {
	let timer;
	return (...args) => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => fn(...args), waitMs);
	};
}

async function rmrf(dir) {
	await fs.rm(dir, { recursive: true, force: true });
}

async function ensureDir(dir) {
	await fs.mkdir(dir, { recursive: true });
}

async function copyDir(from, to) {
	await ensureDir(to);
	const entries = await fs.readdir(from, { withFileTypes: true });
	await Promise.all(
		entries.map(async (entry) => {
			const srcPath = path.join(from, entry.name);
			const dstPath = path.join(to, entry.name);
			if (entry.isDirectory()) {
				await copyDir(srcPath, dstPath);
				return;
			}
			if (entry.isFile()) {
				await fs.copyFile(srcPath, dstPath);
			}
		})
	);
}

async function copyStaticAssets() {
	await fs.copyFile(path.join(srcDir, 'manifest.json'), path.join(distDir, 'manifest.json'));
	await fs.copyFile(path.join(srcDir, 'styles.css'), path.join(distDir, 'styles.css'));
	await copyDir(path.join(srcDir, 'icons'), path.join(distDir, 'icons'));
}

async function main() {
	if (!isWatch) {
		await rmrf(distDir);
	}
	await ensureDir(distDir);
	await copyStaticAssets();

	const buildOptions = {
		entryPoints: [path.join(srcDir, 'content.ts')],
		bundle: true,
		outfile: path.join(distDir, 'content.js'),
		format: 'iife',
		target: ['es2022'],
		sourcemap: isWatch ? 'inline' : false,
		minify: false,
		platform: 'browser',
		logLevel: 'info'
	};

	if (!isWatch) {
		await build(buildOptions);
		return;
	}

	// Watch mode (esbuild v0.20+): use context().watch().
	const ctx = await context(buildOptions);
	await ctx.watch();
	console.log('Watching for changes...');

	// Also watch static assets (manifest/styles/icons) and copy to dist.
	const debouncedCopy = debounce(() => {
		copyStaticAssets().catch((err) => console.error('Static asset copy failed:', err));
	}, 50);

	const watchTargets = [
		path.join(srcDir, 'manifest.json'),
		path.join(srcDir, 'styles.css'),
		path.join(srcDir, 'icons')
	];

	watchTargets.forEach((watchPath) => {
		try {
			fsSync.watch(watchPath, { recursive: true }, debouncedCopy);
		} catch (err) {
			// Fallback: if recursive watch isn't supported, just do nothing.
			console.warn('Static watch not available for', watchPath, err);
		}
	});
}

main().catch((err) => {
	console.error(err);
	process.exitCode = 1;
});
