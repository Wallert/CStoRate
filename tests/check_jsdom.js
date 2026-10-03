// Check JSDOM availability and basic environment test
try {
    const { JSDOM } = require('jsdom');
    console.log("JSDOM is available.");
} catch (e) {
    console.error("JSDOM is not installed:", e.message);
    process.exitCode = 1;
}
