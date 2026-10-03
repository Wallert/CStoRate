/**
 * CStoRate - Master E2E Automated Test Runner
 */

const { runTier1Tests } = require('./tier1_feature_tests');
const { runTier2Tests } = require('./tier2_boundary_tests');
const { runTier3Tests } = require('./tier3_cross_feature_tests');
const { runTier4Tests } = require('./tier4_real_world_tests');
const { runTier5Tests } = require('./tier5_adversarial_tests');
const { runReleaseRegressionTests } = require('./release_regression_tests');
const { runAuditRegressionTests } = require('./audit_regression_tests');
const { assertNoRuntimeErrors, closeTestEnvironments } = require('./harness');

class TestReporter {
    constructor() {
        this.totalTests = 0;
        this.passed = 0;
        this.failed = 0;
        this.currentSuite = "";
        this.failures = [];
        this.startTime = Date.now();
    }

    startSuite(suiteName) {
        this.currentSuite = suiteName;
        console.log(`\n==================================================`);
        console.log(`SUITE: ${suiteName}`);
        console.log(`==================================================`);
    }

    async test(name, fn) {
        this.totalTests++;
        const testStart = Date.now();
        try {
            await fn();
            assertNoRuntimeErrors();
            this.passed++;
            const duration = Date.now() - testStart;
            console.log(`  ✓ PASS: ${name} (${duration}ms)`);
        } catch (err) {
            this.failed++;
            const duration = Date.now() - testStart;
            console.log(`  ✗ FAIL: ${name} (${duration}ms)`);
            console.log(`      Error: ${err.message}`);
            this.failures.push({
                suite: this.currentSuite,
                name,
                error: err.message,
                stack: err.stack
            });
        } finally {
            closeTestEnvironments();
        }
    }

    assert(condition, message) {
        if (!condition) {
            throw new Error(message || "Assertion failed");
        }
    }

    finishSuite() {
        // Log suite complete
    }

    printSummary() {
        const totalDuration = Date.now() - this.startTime;
        console.log(`\n==================================================`);
        console.log(`E2E TEST RUNNER SUMMARY RESULTS`);
        console.log(`==================================================`);
        console.log(`Total Suites: 7`);
        console.log(`Total Tests:  ${this.totalTests}`);
        console.log(`Passed:       ${this.passed}`);
        console.log(`Failed:       ${this.failed}`);
        console.log(`Duration:     ${totalDuration}ms`);
        console.log(`Status:       ${this.failed === 0 ? "SUCCESS (100% PASS)" : "FAILURE"}`);
        console.log(`==================================================\n`);

        if (this.failures.length > 0) {
            console.log(`FAILURE DETAILS:`);
            this.failures.forEach((f, idx) => {
                console.log(`\n${idx + 1}) [${f.suite}] ${f.name}`);
                console.log(`   ${f.error}`);
            });
            console.log(`\n`);
        }
        
        return this.failed === 0;
    }
}

async function main() {
    const reporter = new TestReporter();
    
    console.log("Starting CStoRate E2E Test Suite Execution...");
    console.log(`Timestamp: ${new Date().toISOString()}`);

    try {
        await runTier1Tests(reporter);
        await runTier2Tests(reporter);
        await runTier3Tests(reporter);
        await runTier4Tests(reporter);
        await runTier5Tests(reporter);
        await runReleaseRegressionTests(reporter);
        await runAuditRegressionTests(reporter);
    } catch (err) {
        console.error("Critical test execution failure:", err);
        process.exit(1);
    }

    const success = reporter.printSummary();
    if (!success) {
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { main, TestReporter };
