import { commonProperties } from './properties.js';
import { planDescription } from './examples.js';

/**
 * Input schema for the action tool
 */
export const actionToolSchema = {
    type: "object",
    properties: {
        ...commonProperties,
        plan: {
            type: "string",
            description: planDescription
        }
    },
    required: ["url"]
}; 