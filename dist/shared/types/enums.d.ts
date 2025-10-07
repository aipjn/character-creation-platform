export declare const STYLE_TYPE: {
    readonly FANTASY: "FANTASY";
    readonly CYBERPUNK: "CYBERPUNK";
    readonly ANIME: "ANIME";
    readonly VINTAGE: "VINTAGE";
    readonly REALISTIC: "REALISTIC";
    readonly CARTOON: "CARTOON";
    readonly MINIMALIST: "MINIMALIST";
};
export type StyleType = (typeof STYLE_TYPE)[keyof typeof STYLE_TYPE];
export declare const STYLE_TYPES: readonly StyleType[];
export declare const GENERATION_STATUS: {
    readonly PENDING: "PENDING";
    readonly PROCESSING: "PROCESSING";
    readonly COMPLETED: "COMPLETED";
    readonly FAILED: "FAILED";
};
export type GenerationStatus = (typeof GENERATION_STATUS)[keyof typeof GENERATION_STATUS];
export declare const GENERATION_STATUSES: readonly GenerationStatus[];
//# sourceMappingURL=enums.d.ts.map