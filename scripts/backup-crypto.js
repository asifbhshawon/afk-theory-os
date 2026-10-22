// Helper utility for AES-256-GCM Authenticated Encryption & Decryption
const fs = require("fs");
const crypto = require("crypto");

const command = process.argv[2];

function readJsonWithoutBOM(filePath) {
  let content = fs.readFileSync(filePath, "utf8");
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1);
  }
  return JSON.parse(content);
}

if (command === "encrypt") {
  // Usage: node backup-crypto.js encrypt <rawDumpFile> <password> <encDumpFile>
  const rawFile = process.argv[3];
  const password = process.argv[4];
  const encFile = process.argv[5];

  const rawData = fs.readFileSync(rawFile);
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 32);
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(rawData), cipher.final()]);
  const authTag = cipher.getAuthTag();

  fs.writeFileSync(encFile, encrypted);
  if (fs.existsSync(rawFile)) {
    fs.unlinkSync(rawFile); // Delete plaintext
  }

  const result = {
    salt: salt.toString("hex"),
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
    encSize: encrypted.length,
  };

  process.stdout.write(JSON.stringify(result));
  process.exit(0);
}

if (command === "verify") {
  // Usage: node backup-crypto.js verify <manifestFile> <encFile> <password>
  const manifestFile = process.argv[3];
  const encFile = process.argv[4];
  const password = process.argv[5];

  const manifest = readJsonWithoutBOM(manifestFile);
  const encData = fs.readFileSync(encFile);

  const salt = Buffer.from(manifest.encryption.salt, "hex");
  const iv = Buffer.from(manifest.encryption.iv, "hex");
  const authTag = Buffer.from(manifest.encryption.authTag, "hex");
  const key = crypto.scryptSync(password, salt, 32);

  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encData), decipher.final()]);
    const hash = crypto.createHash("sha256").update(decrypted).digest("hex");

    if (hash.toUpperCase() !== manifest.database.originalSha256.toUpperCase()) {
      process.stderr.write(`Checksum mismatch! Expected: ${manifest.database.originalSha256}, Got: ${hash}`);
      process.exit(2);
    }

    process.stdout.write(JSON.stringify({ verified: true, size: decrypted.length, hash }));
    process.exit(0);
  } catch (err) {
    process.stderr.write(`Authentication tag check failed: ${err.message}`);
    process.exit(1);
  }
}

if (command === "decrypt") {
  // Usage: node backup-crypto.js decrypt <manifestFile> <encFile> <password> <outRawFile>
  const manifestFile = process.argv[3];
  const encFile = process.argv[4];
  const password = process.argv[5];
  const outFile = process.argv[6];

  const manifest = readJsonWithoutBOM(manifestFile);
  const encData = fs.readFileSync(encFile);

  const salt = Buffer.from(manifest.encryption.salt, "hex");
  const iv = Buffer.from(manifest.encryption.iv, "hex");
  const authTag = Buffer.from(manifest.encryption.authTag, "hex");
  const key = crypto.scryptSync(password, salt, 32);

  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encData), decipher.final()]);
    fs.writeFileSync(outFile, decrypted);
    process.exit(0);
  } catch (err) {
    process.stderr.write(`Decryption failed: ${err.message}`);
    process.exit(1);
  }
}

process.stderr.write("Unknown command: " + command);
process.exit(1);
