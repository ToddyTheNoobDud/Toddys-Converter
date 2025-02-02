import { readdir } from 'fs/promises';
import { join, extname } from 'path';

export const Filereader = async (dir) => {
  const files = [];
  
  try {
    const directoryData = await readdir(dir, { withFileTypes: true });

    for (const entry of directoryData) {
      const filePath = join(dir, entry.name);
      if (entry.isDirectory()) {
        const subFiles = await Filereader(filePath);
        files.push(...subFiles);
      } else if (extname(entry.name) === '.mjs') {
        files.push(filePath);
      }
    }
  } catch (error) {
    console.error(`Failed to read directory: ${dir}`, error);
  }

  return files;
};
