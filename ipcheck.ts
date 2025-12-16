import { chromium } from 'playwright';

function getEmoji(percentageStr: string) {
    try {
        const val = parseFloat(percentageStr.replace('%', ''));
        // Mapping logic:
        // Low score/ratio (clean) -> High score/ratio (bad/bot)
        // 0 - 10: ⚪ (White)
        // 10 - 30: 🟢 (Green)
        // 30 - 50: 🟡 (Yellow)
        // 50 - 70: 🟠 (Orange)
        // 70 - 90: 🔴 (Red)
        // 90+: ⚫ (Black)
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

async function main() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    });
    const page = await context.newPage();

    try {
        // Navigate
        await page.goto("https://ippure.com/", { waitUntil: "domcontentloaded", timeout: 60000 });

        // Wait for key specific text to ensure dynamic content loads
        // Waiting for "IPPure系数" or "人机流量比"
        try {
            await page.waitForSelector("text=人机流量比", { timeout: 20000 });
        } catch {
            console.log("Error: Page load timeout or bot challenge.");
            return;
        }

        // visual wait for values to populate
        await page.waitForTimeout(2000);

        // Extract full text for regex processing
        const text = await page.innerText("body");

        // 1. IPPure Score (IPPure系数)
        // Pattern looking for "IPPure系数" followed by number%
        const scoreMatch = text.match(/IPPure系数.*?(\d+%)/s);
        const pureScore = scoreMatch ? scoreMatch[1] : "❓";
        const pureEmoji = getEmoji(pureScore);

        // 2. Human/Bot Ratio (人机流量比)
        // Pattern looking for "bot" followed by percentage
        const botMatch = text.match(/bot\s*(\d+(\.\d+)?)%/i);
        let botVal = botMatch ? botMatch[0].replace(/bot/i, '').trim() : "❓";
        // Ensure we have the % sign
        if (botVal !== "❓" && !botVal.endsWith('%')) {
            botVal += "%";
        }
        const botEmoji = getEmoji(botVal);

        // 3. IP Attributes (IP属性)
        // Find "IP属性" line
        let attrMatch = text.match(/IP属性\s*\n\s*(.+)/);
        if (!attrMatch) {
            attrMatch = text.match(/IP属性\s*(.+)/);
        }

        let ipAttr = "❓";
        if (attrMatch) {
            const rawAttr = attrMatch[1].trim();
            // Remove trailing "IP" if present (e.g. "机房IP" -> "机房")
            ipAttr = rawAttr.replace(/IP$/, "");
        }

        // 4. IP Source (IP来源)
        // Find "IP来源" line
        let srcMatch = text.match(/IP来源\s*\n\s*(.+)/);
        if (!srcMatch) {
            srcMatch = text.match(/IP来源\s*(.+)/);
        }

        let ipSrc = "❓";
        if (srcMatch) {
            const rawSrc = srcMatch[1].trim();
            ipSrc = rawSrc.replace(/IP$/, "");
        }

        // Final Output Format: 【IPPure系数 人机流量比 IP属性 IP来源】
        // Example: 【⚪🟡 机房 广播】
        console.log(`【${pureEmoji}${botEmoji} ${ipAttr} ${ipSrc}】`);

    } catch (error: unknown) {
        console.log(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
        await browser.close();
    }
}

main().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
});

