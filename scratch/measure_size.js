const fs = require('fs');
const path = require('path');

const root = 'c:/Users/Afriyie/School_Management_System_Offline';

function getFiles(dir, filesList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const name = path.join(dir, file);
    if (fs.statSync(name).isDirectory()) {
      if (file !== 'node_modules' && file !== '.git') {
        getFiles(name, filesList);
      }
    } else {
      filesList.push(name);
    }
  }
  return filesList;
}

function getFilesWithNodeModules(dir, filesList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const name = path.join(dir, file);
    if (fs.statSync(name).isDirectory()) {
      if (file !== '.git') {
        getFilesWithNodeModules(name, filesList);
      }
    } else {
      filesList.push(name);
    }
  }
  return filesList;
}

// 1. Database file size
let dbSize = 0;
const dbPath = path.join(root, 'school.db');
if (fs.existsSync(dbPath)) {
  dbSize = fs.statSync(dbPath).size;
}

// 2. Code base size (excluding node_modules and .git)
const codeFiles = getFiles(root);
const codeSize = codeFiles.reduce((acc, f) => acc + fs.statSync(f).size, 0);

// 3. Total size (including node_modules)
const allFiles = getFilesWithNodeModules(root);
const totalSize = allFiles.reduce((acc, f) => acc + fs.statSync(f).size, 0);

console.log(`DB_SIZE: ${(dbSize / 1024).toFixed(2)} KB (${dbSize} bytes)`);
console.log(`CODE_SIZE: ${(codeSize / 1024 / 1024).toFixed(2)} MB (${codeSize} bytes)`);
console.log(`TOTAL_SIZE: ${(totalSize / 1024 / 1024).toFixed(2)} MB (${totalSize} bytes)`);
console.log(`FILES_COUNT: ${codeFiles.length} source files`);
