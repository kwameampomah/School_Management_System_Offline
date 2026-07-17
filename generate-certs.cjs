/**
 * generate-certs.cjs
 * Generates a self-signed SSL certificate for LAN HTTPS.
 * Uses the 'selfsigned' npm package — no OpenSSL binary required.
 *
 * Run once before starting the system:
 *   node generate-certs.cjs
 *
 * Certificates are saved to ./certs/ and valid for 10 years.
 * They are gitignored and must be regenerated on each new machine.
 */

const fs   = require("fs");
const path = require("path");

const certsDir = path.join(__dirname, "certs");
const keyPath  = path.join(certsDir, "server.key");
const certPath = path.join(certsDir, "server.crt");

if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  console.log("✅ Certificates already exist at ./certs/ — no action needed.");
  process.exit(0);
}

if (!fs.existsSync(certsDir)) {
  fs.mkdirSync(certsDir, { recursive: true });
}

const selfsigned = require("selfsigned");

async function main() {
  console.log("🔐 Generating self-signed SSL certificate...\n");

  // selfsigned v5: attrs must be null or empty array, options use 'days'
  const pems = await selfsigned.generate(null, {
    keySize:   2048,
    days:      3650,  // Valid for 10 years
    algorithm: "sha256",
  });

  // pems = { private, public, cert, fingerprint }
  fs.writeFileSync(keyPath,  pems.private);
  fs.writeFileSync(certPath, pems.cert);

  console.log("✅ SSL certificate generated successfully!");
  console.log(`   Key:  ${keyPath}`);
  console.log(`   Cert: ${certPath}`);
  console.log("");
  console.log("📋 IMPORTANT — Browser Trust Warning:");
  console.log("   When you open the app for the first time, your browser will");
  console.log("   show a 'Your connection is not private' warning.");
  console.log("   This is normal for self-signed certificates on a local network.");
  console.log("   Click 'Advanced' then 'Proceed to localhost' to continue.");
  console.log("   You only need to do this once per browser per device.\n");
}

main().catch(e => {
  console.error("❌ Failed to generate certificate:", e.message);
  process.exit(1);
});
