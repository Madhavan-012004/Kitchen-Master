const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ARGS = process.argv.slice(2);
const CMD = ARGS[0];

const KEYS_DIR = path.join(__dirname, 'keys');
const PRIVATE_KEY_PATH = path.join(KEYS_DIR, 'private.pem');
const PUBLIC_KEY_PATH = path.join(KEYS_DIR, 'public.pem');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function generateKeys() {
  console.log('Generating RSA 2048 keys...');
  ensureDir(KEYS_DIR);
  
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });

  fs.writeFileSync(PRIVATE_KEY_PATH, privateKey);
  fs.writeFileSync(PUBLIC_KEY_PATH, publicKey);

  console.log(`Keys generated successfully at ${KEYS_DIR}`);
  console.log(`IMPORTANT: Keep private.pem secure! Do not distribute it.`);
  console.log(`Copy public.pem to the backend application to verify licenses.`);
  process.exit(0);
}

function generateLicense() {
  const reqFilePath = ARGS[1];
  if (!reqFilePath) {
    console.error('Usage: node license_manager.js generate-license <path-to-machine.req>');
    process.exit(1);
  }

  if (!fs.existsSync(PRIVATE_KEY_PATH)) {
    console.error('Private key not found. Run generate-keys first.');
    process.exit(1);
  }

  let reqData;
  try {
    const reqFileContent = fs.readFileSync(reqFilePath, 'utf8');
    reqData = JSON.parse(reqFileContent);
  } catch (error) {
    console.error('Error reading or parsing machine.req:', error.message);
    process.exit(1);
  }

  const hardwareId = reqData.hardwareId;
  if (!hardwareId) {
    console.error('Invalid machine.req: hardwareId is missing.');
    process.exit(1);
  }

  console.log(`Generating license for Hardware ID: ${hardwareId}`);
  
  rl.question('Enter expiration date (YYYY-MM-DD) or press Enter for 1 year from now: ', (inputDate) => {
    let expiresAt;
    if (inputDate && inputDate.trim() !== '') {
      expiresAt = new Date(inputDate).toISOString();
    } else {
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      expiresAt = nextYear.toISOString();
    }

    const issuedAt = new Date().toISOString();

    const licensePayload = {
      hardwareId,
      issuedAt,
      expiresAt,
      features: ['ALL']
    };

    // Sign the payload
    const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');
    const sign = crypto.createSign('SHA256');
    sign.update(JSON.stringify(licensePayload));
    sign.end();
    
    const signature = sign.sign(privateKey, 'base64');

    const finalLicense = {
      ...licensePayload,
      signature
    };

    const outPath = path.join(__dirname, 'license.lic');
    fs.writeFileSync(outPath, Buffer.from(JSON.stringify(finalLicense, null, 2)).toString('base64'));
    
    console.log(`\nLicense generated successfully at: ${outPath}`);
    console.log(`Valid until: ${expiresAt}`);
    process.exit(0);
  });
}

function verifyLicense() {
    const licFilePath = ARGS[1];
    if (!licFilePath) {
      console.error('Usage: node license_manager.js verify <path-to-license.lic>');
      process.exit(1);
    }
  
    if (!fs.existsSync(PUBLIC_KEY_PATH)) {
      console.error('Public key not found.');
      process.exit(1);
    }
  
    try {
        const b64Data = fs.readFileSync(licFilePath, 'utf8');
        const rawJson = Buffer.from(b64Data, 'base64').toString('utf8');
        const licenseData = JSON.parse(rawJson);
        
        const { signature, ...payload } = licenseData;
        
        const publicKey = fs.readFileSync(PUBLIC_KEY_PATH, 'utf8');
        const verify = crypto.createVerify('SHA256');
        verify.update(JSON.stringify(payload));
        verify.end();
        
        const isValid = verify.verify(publicKey, signature, 'base64');
        
        if (isValid) {
            console.log('Signature is VALID.');
            console.log(JSON.stringify(payload, null, 2));
        } else {
            console.error('Signature is INVALID or tampered.');
        }
    } catch (e) {
        console.error('Verification failed:', e.message);
    }
    process.exit(0);
}

switch (CMD) {
  case 'generate-keys':
    generateKeys();
    break;
  case 'generate-license':
    generateLicense();
    break;
  case 'verify':
    verifyLicense();
    break;
  default:
    console.log('HQ License Manager');
    console.log('Commands:');
    console.log('  node license_manager.js generate-keys');
    console.log('  node license_manager.js generate-license <machine.req>');
    console.log('  node license_manager.js verify <license.lic>');
    process.exit(1);
}
