const fs = require('fs');

function clean(file) {
    let lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    let newLines = [];
    let skipping = false;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        if (line.includes('const tryConnect = (opts) => {') && lines[i + 1].includes('capacitorSerial.requestPermission')) {
            skipping = true;
        }

        if (!skipping) {
            newLines.push(line);
        }

        if (skipping && line === '            tryConnect({ dtr: true });') {
            // skip the 'return;' and '}' which come immediately after
            if (lines[i + 1].includes('return;')) {
                i++; // skip return
            }
            skipping = false; // Next line which is '        }' should be kept because my injected block was missing it!
            // Wait, my injected block DID have the final `return;\n        }` included? Let's check!
            // View file output:
            // 344:                     };
            // 345:                 } else {
            // 346:                     alert('Scale connection failed. Make sure it is plugged in and NO OTHER APP is using it.');
            // 347:                 }
            // 348:             };
            // 349: 
            // 350:             const tryConnect = (opts) => {
            // Ah! My injected block was just `const tryConnect = (opts) => { ... }`. It did NOT return! 
            // The original `tryConnect({dtr: true}); return; }` IS STILL REQUIRED for my new injected function! 
            // Because my new injected `const tryConnect` needs to be CALLED!
        }
    }
    // fs.writeFileSync(file, newLines.join('\n'));
}
