import type { Page } from "playwright";
import { getFullPath, checkPageStability, checkLayoutStability } from "../scripts";
import { debug, info, warn, error } from "../../utils/logging";

// Global type declarations for injected scripts
declare global {
    interface Window {
        getFullPath: (element: Element) => string;
        checkPageStability: () => boolean;
        checkLayoutStability: () => boolean;
        stabilityScriptsInjected?: boolean;
    }
}

/**
 * Injects stability checking scripts into the page
 * These scripts are used to check for DOM mutations and layout shifts
 */
export async function injectStabilityScripts(page: Page): Promise<void> {
    try {
        debug("Injecting stability scripts");
        await page.waitForLoadState("domcontentloaded").catch(() => {
            warn("domcontentloaded wait failed");
        });

        const isInjected = await page
            .evaluate(() => {
                return (
                    window.stabilityScriptsInjected === true &&
                    typeof window.getFullPath === "function" &&
                    typeof window.checkPageStability === "function" &&
                    typeof window.checkLayoutStability === "function"
                );
            })
            .catch(() => false);

        if (isInjected) {
            debug("Scripts already injected and verified, skipping");
            return;
        }

        // Inject each function separately to ensure proper evaluation
        await page
            .evaluate(
                `
      window.getFullPath = ${getFullPath.toString()};
      window.checkPageStability = ${checkPageStability.toString()};
      window.checkLayoutStability = ${checkLayoutStability.toString()};
      window.stabilityScriptsInjected = true;
      console.warn('Scripts injected successfully');
    `
            )
            .catch((err) => {
                throw new Error(`Failed to inject scripts: ${err instanceof Error ? err.message : String(err)}`);
            });

        // Verify injection
        const verified = await page
            .evaluate(() => {
                return (
                    typeof window.getFullPath === "function" &&
                    typeof window.checkPageStability === "function" &&
                    typeof window.checkLayoutStability === "function"
                );
            })
            .catch(() => false);

        if (!verified) {
            throw new Error("Script injection verification failed");
        }

        info("Stability scripts injection complete and verified");
    } catch (err) {
        error("Error injecting stability scripts", { error: err instanceof Error ? err.message : String(err) });
        throw err;
    }
} 