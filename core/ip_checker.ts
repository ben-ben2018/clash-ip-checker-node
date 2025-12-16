import { Browser, BrowserContextOptions, chromium } from 'playwright';
import axios, { AxiosRequestConfig } from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { HttpProxyAgent } from 'http-proxy-agent';

class IPChecker {
    headless: boolean;
    browser: Browser | null;
    cache: Record<string, any>;
    constructor(headless = true) {
        this.headless = headless;
        this.browser = null;
        this.cache = {}; // Map IP -> Result Dict
    }

    async start() {
        this.browser = await chromium.launch({
            headless: this.headless,
            args: ["--no-sandbox", "--disable-setuid-sandbox"]
        });
    }

    async stop() {
        if (this.browser) {
            await this.browser.close();
        }
    }

    getEmoji(percentageStr: string) {
        try {
            const val = parseFloat(percentageStr.replace('%', ''));
            // Logic from ipcheck.py with user approved thresholds
            if (val <= 10) return "⚪";
            if (val <= 30) return "🟢";
            if (val <= 50) return "🟡";
            if (val <= 70) return "🟠";
            if (val <= 90) return "🔴";
            return "⚫";
        } catch {
            return "❓";
        }
    }

    async getSimpleIP(proxy: string | null = null) {
        /** Fast IPv4 check for caching. */
        const urls = ["http://api.ipify.org", "http://v4.ident.me"];
        for (const url of urls) {
            try {
                // User modified timeout to 3s
                const config = {
                    timeout: 3000,
                    validateStatus: () => true // Accept any status code
                } as AxiosRequestConfig;
                if (proxy) {
                    // Use proxy agent for axios (similar to aiohttp proxy parameter)
                    const proxyAgent = url.startsWith('https')
                        ? new HttpsProxyAgent(proxy)
                        : new HttpProxyAgent(proxy);
                    config.httpAgent = proxyAgent;
                    config.httpsAgent = proxyAgent;
                }
                const response = await axios.get(url, config);
                if (response.status === 200) {
                    const ip = String(response.data).trim();
                    // Keep the same regex as Python version (even with the bug)
                    if (/^\d{1,3}(\.\d{1,3}){3}\d{1,3}$/.test(ip)) {
                        return ip;
                    }
                }
            } catch (error) {
                continue;
            }
        }
        return null;
    }

    async check(url = "https://ippure.com/", proxy: string | null = null, timeout = 20000) {
        if (!this.browser) {
            await this.start();
        }

        // 1. Cleaner Fast IP & Cache Logic
        let currentIP = await this.getSimpleIP(proxy);
        if (currentIP && this.cache[currentIP]) {
            console.log(`     [Cache Hit] ${currentIP}`);
            return this.cache[currentIP];
        }

        if (currentIP) {
            console.log(`     [New IP] ${currentIP}`);
        } else {
            console.log("     [Warning] Fast IP check failed. Scanning with browser...");
        }

        // 2. Browser Check (Logic from ipcheck.py)
        const contextOptions = {
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        } as BrowserContextOptions;
        if (proxy) {
            contextOptions.proxy = { server: proxy };
        }

        const context = await this.browser!.newContext(contextOptions);

        // Resource blocking (Optimization)
        await context.route("**/*", (route) => {
            const resourceType = route.request().resourceType();
            if (["image", "media", "font"].includes(resourceType)) {
                route.abort();
            } else {
                route.continue();
            }
        });

        const page = await context.newPage();

        // Default Result Structure
        const result = {
            pure_emoji: "❓",
            bot_emoji: "❓",
            ip_attr: "❓",
            ip_src: "❓",
            pure_score: "❓",
            bot_score: "❓",
            full_string: "",
            ip: currentIP || "❓",
            error: null as string | null
        };

        try {
            await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeout });

            // Logic from ipcheck.py - Optimized wait
            try {
                await page.waitForSelector("text=人机流量比", { timeout: 10000 });
            } catch {
                // Ignore timeout
            }

            await page.waitForTimeout(2000);
            const text = await page.innerText("body");

            // 1. IPPure Score
            const scoreMatch = text.match(/IPPure系数.*?(\d+%)/s);
            if (scoreMatch) {
                result.pure_score = scoreMatch[1];
                result.pure_emoji = this.getEmoji(result.pure_score);
            }

            // 2. Bot Ratio
            const botMatch = text.match(/bot\s*(\d+(\.\d+)?)%/i);
            if (botMatch) {
                let val = botMatch[0].replace(/bot/i, '').trim();
                if (!val.endsWith('%')) val += "%";
                result.bot_score = val;
                result.bot_emoji = this.getEmoji(val);
            }

            // 3. Attributes
            let attrMatch = text.match(/IP属性\s*\n\s*(.+)/);
            if (!attrMatch) {
                attrMatch = text.match(/IP属性\s*(.+)/);
            }
            if (attrMatch) {
                const raw = attrMatch[1].trim();
                result.ip_attr = raw.replace(/IP$/, "");
            }

            // 4. Source
            let srcMatch = text.match(/IP来源\s*\n\s*(.+)/);
            if (!srcMatch) {
                srcMatch = text.match(/IP来源\s*(.+)/);
            }
            if (srcMatch) {
                const raw = srcMatch[1].trim();
                result.ip_src = raw.replace(/IP$/, "");
            }

            // 5. Fallback IP if fast check failed
            if (result.ip === "❓") {
                const ipMatch = text.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
                if (ipMatch) {
                    result.ip = ipMatch[0];
                }
            }

            // Construct String with user requested '|' separator
            const attr = result.ip_attr !== "❓" ? result.ip_attr : "";
            const src = result.ip_src !== "❓" ? result.ip_src : "";
            let info = `${attr}|${src}`.trim();
            if (info === "|") info = "未知"; // Handle empty case gracefully
            if (!info) info = "未知";

            result.full_string = `【${result.pure_emoji}${result.bot_emoji} ${info}】`;

            // Cache Update
            if (result.ip !== "❓" && result.pure_score !== "❓") {
                this.cache[result.ip] = { ...result };
            }

        } catch (error: unknown) {
            result.error = error instanceof Error ? error.message : String(error);
            result.full_string = "【❌ Error】";
        } finally {
            if (!this.headless) {
                console.log("     [Debug] Waiting 5s before closing browser window...");
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
            await page.close();
            await context.close();
        }

        return result;
    }
}

export default IPChecker;

