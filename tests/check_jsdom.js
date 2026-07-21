// Check JSDOM availability and basic environment test
try {
    const { JSDOM } = require('jsdom');
    console.log("JSDOM is available.");
} catch (e) {
    console.log("JSDOM is not installed:", e.message);
}
