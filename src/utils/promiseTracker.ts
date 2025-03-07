import { debug } from './logging';

/**
 * A utility class to track pending promises and ensure they're properly awaited or cleaned up
 */
class PromiseTracker {
    private pendingPromises = new Set<Promise<any>>();
    private labels = new Map<Promise<any>, string>();

    /**
     * Track a promise to ensure it's properly awaited
     * @param promise The promise to track
     * @param label Optional label for debugging
     * @returns The original promise wrapped with tracking
     */
    track<T>(promise: Promise<T>, label = 'unlabeled'): Promise<T> {
        this.pendingPromises.add(promise);
        this.labels.set(promise, label);
        
        return promise.finally(() => {
            this.pendingPromises.delete(promise);
            this.labels.delete(promise);
        });
    }

    /**
     * Wait for all pending promises to complete or timeout
     * @param timeout Maximum time to wait in milliseconds
     * @returns A promise that resolves when all pending promises complete or timeout
     */
    async waitForPending(timeout = 5000): Promise<void> {
        if (this.pendingPromises.size === 0) return;
        
        debug(`Waiting for ${this.pendingPromises.size} pending promises to complete`);
        
        // Log the labels of pending promises for debugging
        if (this.pendingPromises.size > 0) {
            const pendingLabels = [...this.pendingPromises].map(p => this.labels.get(p) || 'unlabeled');
            debug(`Pending promises: ${pendingLabels.join(', ')}`);
        }
        
        const timeoutPromise = new Promise<void>((_, reject) => {
            setTimeout(() => reject(new Error(`Timeout waiting for ${this.pendingPromises.size} pending promises`)), timeout);
        });
        
        try {
            await Promise.race([
                Promise.all([...this.pendingPromises]),
                timeoutPromise
            ]);
        } catch (err) {
            debug(`Some promises didn't complete: ${this.pendingPromises.size} remaining`);
            // Clear the pending promises to avoid memory leaks
            this.pendingPromises.clear();
            this.labels.clear();
        }
    }

    /**
     * Get the count of pending promises
     */
    get pendingCount(): number {
        return this.pendingPromises.size;
    }

    /**
     * Flush the event loop to ensure all microtasks are processed
     */
    flushEventLoop(): Promise<void> {
        return new Promise(resolve => setImmediate(resolve));
    }
}

// Export a singleton instance
export const promiseTracker = new PromiseTracker(); 