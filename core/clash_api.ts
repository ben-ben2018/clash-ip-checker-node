import axios from 'axios';

class ClashController {
    apiUrl: string;
    headers: Record<string, string>;
    constructor(apiUrl: string, secret = "") {
        this.apiUrl = apiUrl.replace(/\/$/, '');
        this.headers = {
            "Authorization": `Bearer ${secret}`,
            "Content-Type": "application/json"
        };
    }

    async switchProxy(selector: string, proxyName: string) {
        /** Switches the selector to the specified proxy. */
        const url = `${this.apiUrl}/proxies/${encodeURIComponent(selector)}`;
        const payload = { name: proxyName };
        try {
            const response = await axios.put(url, payload, {
                headers: this.headers,
                timeout: 5000
            });
            if (response.status === 204) {
                return true;
            } else {
                console.log(`Failed to switch to ${proxyName}. Status: ${response.status}`);
                return false;
            }
        } catch (error: unknown) {
            console.log(`API Error switching to ${proxyName}: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }

    async setMode(mode: string) {
        /** Sets the Clash mode (global, rule, direct). */
        const url = `${this.apiUrl}/configs`;
        const payload = { mode: mode };
        try {
            const response = await axios.patch(url, payload, {
                headers: this.headers,
                timeout: 5000
            });
            if (response.status === 204) {
                console.log(`Successfully set mode to: ${mode}`);
                return true;
            } else {
                console.log(`Failed to set mode logic. Status: ${response.status}`);
                return false;
            }
        } catch (error: unknown) {
            console.log(`API Error setting mode: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }

    async getRunningPort() {
        /** Fetches the mixed-port or http-port from running instance. */
        try {
            const response = await axios.get(`${this.apiUrl}/configs`, {
                headers: this.headers
            });
            if (response.status === 200) {
                const conf = response.data;
                if (conf['mixed-port'] && conf['mixed-port'] !== 0) return conf['mixed-port'];
                if (conf['port'] && conf['port'] !== 0) return conf['port'];
                if (conf['socks-port'] && conf['socks-port'] !== 0) return conf['socks-port'];
            }
        } catch (error: unknown) {
            // Ignore
        }
        return 7890; // Default fallback
    }

    async getProxies() {
        /** Fetches all proxies. */
        try {
            const response = await axios.get(`${this.apiUrl}/proxies`, {
                headers: this.headers
            });
            if (response.status === 200) {
                return response.data.proxies || {};
            }
        } catch (error: unknown) {
            console.log(`Error fetching proxies: ${error instanceof Error ? error.message : String(error)}`);
        }
        return null;
    }
}

export default ClashController;

