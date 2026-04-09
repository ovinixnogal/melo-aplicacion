import fs from 'fs';
import path from 'path';

const SRC_DIR = 'src';

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

const allFiles = getAllFiles(SRC_DIR);
const unusedFiles = [];

allFiles.forEach((fileToCheck) => {
  const fileName = path.basename(fileToCheck, path.extname(fileToCheck));
  // Skip main.tsx, vite-env.d.ts, index.ts (at root or in folders as barrel files)
  if (fileName === 'main' || fileName === 'vite-env' || fileName === 'index' || fileName === 'App') {
    return;
  }

  let isUsed = false;
  const searchPattern = new RegExp(`from ['"](.*/)?${fileName}['"]`, 'g');
  const searchPattern2 = new RegExp(`import.*${fileName}`, 'g');

  for (const fileInSrc of allFiles) {
    if (fileToCheck === fileInSrc) continue;
    const content = fs.readFileSync(fileInSrc, 'utf8');
    if (content.includes(fileName)) {
      // Basic check, might have false positives, but a good starting point
      isUsed = true;
      break;
    }
  }

  if (!isUsed) {
    unusedFiles.push(fileToCheck);
  }
});

console.log('--- Unused Files (Potential) ---');
unusedFiles.forEach(f => console.log(f));
