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
        
        // Create a copy of the pending promises to avoid modification during iteration
        const pendingPromisesCopy = [...this.pendingPromises];
        
        // Create individual timeout promises for each pending promise
        const timeoutPromises = pendingPromisesCopy.map(promise => {
            return Promise.race([
                promise.catch(err => {
                    debug(`Promise error (${this.labels.get(promise) || 'unlabeled'}): ${err}`);
                    return null;
                }),
                new Promise<null>(resolve => {
                    setTimeout(() => {
                        debug(`Promise timed out (${this.labels.get(promise) || 'unlabeled'})`);
                        resolve(null);
                    }, timeout);
                })
            ]);
        });
        
        // Wait for all promises to either complete or timeout
        await Promise.all(timeoutPromises);
        
        // Clear any remaining promises to prevent memory leaks
        this.pendingPromises.clear();
        this.labels.clear();
        
        debug('All pending promises handled');
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