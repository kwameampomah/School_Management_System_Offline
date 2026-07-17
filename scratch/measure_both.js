const fs = require('fs');
const path = require('path');

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

function measureRepo(root, dbPath) {
  let dbSize = 0;
  if (dbPath && fs.existsSync(dbPath)) {
    dbSize = fs.statSync(dbPath).size;
  }

  const codeFiles = getFiles(root);
  const codeSize = codeFiles.reduce((acc, f) => acc + fs.statSync(f).size, 0);

  const allFiles = getFilesWithNodeModules(root);
  const totalSize = allFiles.reduce((acc, f) => acc + fs.statSync(f).size, 0);

  return {
    dbSize,
    codeSize,
    totalSize,
    filesCount: codeFiles.length
  };
}

const online = measureRepo(
  'c:/Users/Afriyie/School_Management_System',
  null // System A uses PostgreSQL (Cloud/Local service), no local SQLite file
);

const offline = measureRepo(
  'c:/Users/Afriyie/School_Management_System_Offline',
  'c:/Users/Afriyie/School_Management_System_Offline/school.db'
);

console.log("=== COMPARISON RESULTS ===");
console.log(JSON.stringify({ online, offline }, null, 2));
