import { createWriteStream, promises as fs } from 'node:fs';
import path from 'node:path';
import archiver from 'archiver';

const distDir = path.resolve('dist');
const artifactsDir = path.resolve('artifacts');
const outputPath = path.join(artifactsDir, 'taskheatmap.zip');

async function ensureBuildExists() {
  try {
    const stats = await fs.stat(distDir);
    if (!stats.isDirectory()) {
      throw new Error('dist exists but is not a directory');
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error('dist directory not found. Run `npm run build` first.');
    }

    throw error;
  }
}

async function createArchive() {
  await fs.mkdir(artifactsDir, { recursive: true });

  const archive = archiver('zip', { zlib: { level: 9 } });
  const output = createWriteStream(outputPath);

  archive.directory(distDir, false);
  archive.pipe(output);

  await archive.finalize();

  return new Promise((resolve, reject) => {
    output.on('close', () => resolve(outputPath));
    archive.on('error', reject);
  });
}

(async () => {
  await ensureBuildExists();
  const archivePath = await createArchive();
  console.info(`Packaged Chrome extension → ${archivePath}`);
})();
