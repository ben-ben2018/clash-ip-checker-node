import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';

export function loadConfig(configPath = "config.yaml") {
    /**
     * Load configuration from yaml file.
     * If not found, returns null or specific default/error logic.
     */
    if (!fs.existsSync(configPath)) {
        return null;
    }

    try {
        const fileContents = fs.readFileSync(configPath, 'utf8');
        return yaml.load(fileContents);
    } catch (error: unknown) {
        console.log(`Error loading config file: ${error instanceof Error ? error.message : String(error)}`);
        return null;
    }
}

export function validateConfig(config: Record<string, any>) {
    /**
     * Validate essential config keys.
     */
    const required = ["clash_api_url", "yaml_path"];
    const missing = required.filter(k => !config || !config[k]);

    if (missing.length > 0) {
        console.log(`Missing required config fields: ${missing.join(', ')}`);
        return false;
    }

    if (!fs.existsSync(config['yaml_path'])) {
        console.log(`Config Error: Target YAML file not found at ${config['yaml_path']}`);
        return false;
    }

    return true;
}

