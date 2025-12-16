import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadConfig } from './utils/config_loader';
import IPChecker from './core/ip_checker';
import ClashController from './core/clash_api';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CONFIGURATION ---
const cfg = (loadConfig("config.yaml") || {}) as Record<string, string>;

const CLASH_CONFIG_PATH = cfg['yaml_path'] || "YOUR_CLASH_CONFIG_PATH_HERE";
const CLASH_API_URL = cfg['clash_api_url'] || "http://127.0.0.1:9097";
const CLASH_API_SECRET = cfg['clash_api_secret'] || "";
const SELECTOR_NAME = cfg['selector_name'] || "GLOBAL";
const OUTPUT_SUFFIX = cfg['output_suffix'] || "_checked";
// Keep hardcoded like Python version (even though config has skip_keywords)
const SKIP_KEYWORDS = ["剩余", "重置", "到期", "有效期", "官网", "网址", "更新", "公告"];

async function testSingleProxy(controller: ClashController, checker: IPChecker, proxyName: string, selector: string, localProxy: string) {
    /**
     * Tests a single proxy: switches to it, waits, and checks IP.
     * Returns the result dictionary (or error dict).
     */
    console.log(`\nTesting: ${proxyName}`);

    // 1. Switch Node
    console.log(`  -> Switching ${selector} ...`);
    const switched = await controller.switchProxy(selector, proxyName);
    if (!switched) {
        console.log("  -> Switch failed, skipping IP check.");
        return { full_string: "【❌ Switch Error】", ip: "Error", pure_score: "?", bot_score: "?" };
    }

    // 2. Wait for switch to take effect
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 3. Check IP with Retry
    console.log("  -> Running IP Check...");
    let res = null;
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            res = await checker.check("https://ippure.com/", localProxy || null);
            if (res.error === null && res.pure_score !== '❓') {
                break; // Success
            }
            if (attempt === 0) {
                console.log("     Retrying IP check...");
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        } catch (error) {
            console.log(`     Check error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    if (!res) {
        res = { full_string: "【❌ Error】", ip: "Error", pure_score: "?", bot_score: "?" };
    }

    const fullStr = res['full_string'];
    const ipAddr = res['ip'] || 'Unknown';
    const pScore = res['pure_score'] || 'N/A';
    const bScore = res['bot_score'] || 'N/A';

    console.log(`  -> Result: ${fullStr}`);
    console.log(`  -> Details: IP: ${ipAddr} | Score: ${pScore} | Bot: ${bScore}`);

    return res;
}

function saveConfigResults(originalConfig: Record<string, any>, resultsMap: Record<string, string>, outputPath: string) {
    /**
     * Appends results to proxy names and saves the new config file.
     */
    console.log("\nUpdating config names...");
    const newProxies = [];
    const nameMapping: Record<string, string> = {}; // Old -> New

    const proxies = originalConfig['proxies'] || [];
    for (const proxy of proxies) {
        const oldName = proxy['name'];
        if (oldName in resultsMap) {
            const newName = `${oldName} ${resultsMap[oldName]}`;
            proxy['name'] = newName;
            nameMapping[oldName] = newName;
        }
        newProxies.push(proxy);
    }

    originalConfig['proxies'] = newProxies;

    // Update groups
    if (originalConfig['proxy-groups']) {
        for (const group of originalConfig['proxy-groups']) {
            if (group['proxies']) {
                const newGroupProxies = [];
                for (const pName of group['proxies']) {
                    if (pName in nameMapping) {
                        newGroupProxies.push(nameMapping[pName]);
                    } else {
                        newGroupProxies.push(pName);
                    }
                }
                group['proxies'] = newGroupProxies;
            }
        }
    }

    try {
        const yamlStr = yaml.dump(originalConfig, {
            allowUnicode: true,
            flowLevel: -1,
            sortKeys: false
        } as yaml.DumpOptions);
        fs.writeFileSync(outputPath, yamlStr, 'utf8');
        console.log(`\nSuccess! Saved updated config to: ${outputPath}`);
    } catch (error) {
        console.log(`Error saving config: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function main() {
    console.log(`Loading config from: ${CLASH_CONFIG_PATH}`);
    if (!fs.existsSync(CLASH_CONFIG_PATH)) {
        console.log(`Error: Config file not found at ${CLASH_CONFIG_PATH}`);
        return;
    }

    let configData: Record<string, any>;
    try {
        const fileContents = fs.readFileSync(CLASH_CONFIG_PATH, 'utf8');
        configData = (yaml.load(fileContents) || {}) as Record<string, any>;
    } catch (error) {
        console.log(`Error parsing YAML: ${error instanceof Error ? error.message : String(error)}`);
        return;
    }

    const proxies = configData['proxies'] || [];
    if (proxies.length === 0) {
        console.log("No 'proxies' found in config.");
        return;
    }

    console.log(`Found ${proxies.length} proxies to test.`);

    const controller = new ClashController(CLASH_API_URL, CLASH_API_SECRET);

    // FORCE GLOBAL MODE
    await controller.setMode("global");

    // DETECT PORT
    const mixedPort = await controller.getRunningPort();
    console.log(`Detected Running Port from API: ${mixedPort}`);

    const localProxyUrl = `http://127.0.0.1:${mixedPort}`;
    console.log(`Using Local Proxy: ${localProxyUrl}`);

    const selectorToUse = SELECTOR_NAME;

    const checker = new IPChecker(true);
    await checker.start();

    const resultsMap: Record<string, string> = {}; // name -> result_string

    try {
        for (let i = 0; i < proxies.length; i++) {
            const proxy = proxies[i];
            const name = proxy['name'];

            // Check Skip logic
            let shouldSkip = false;
            for (const kw of SKIP_KEYWORDS) {
                if (name.includes(kw)) {
                    shouldSkip = true;
                    break;
                }
            }

            if (shouldSkip) {
                console.log(`\n[${i + 1}/${proxies.length}] Skipping (Status Node): ${name}`);
                continue;
            }

            process.stdout.write(`[${i + 1}/${proxies.length}] Progress...`);

            // CALL TEST FUNCTION
            const res = await testSingleProxy(controller, checker, name, selectorToUse, localProxyUrl) as Record<string, string>;
            resultsMap[name] = res['full_string'];

        }
    } catch (error) {
        if (error instanceof Error && (error.name === 'SIGINT' || (error as any).code === 'SIGINT')) {
            console.log("\nProcess interrupted by user. Saving current progress...");
        } else {
            throw error;
        }
    } finally {
        await checker.stop();
    }

    // SAVE RESULTS
    const base = path.basename(CLASH_CONFIG_PATH);
    const ext = path.extname(base);
    const filename = path.basename(base, ext);
    const outputFilename = `${filename}${OUTPUT_SUFFIX}${ext}`;
    const outputPath = path.join(process.cwd(), outputFilename);

    saveConfigResults(configData, resultsMap, outputPath);
}

// Handle process interruption
process.on('SIGINT', async () => {
    console.log("\nProcess interrupted by user. Saving current progress...");
    process.exit(0);
});

main().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
});

