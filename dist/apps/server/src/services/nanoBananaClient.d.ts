export interface GenerationRequest {
    type: string;
    prompt: string;
    quality?: string;
    width?: number;
    height?: number;
    style?: string;
}
export interface GenerationResponse {
    id: string;
    status: string;
    result?: {
        imageUrl: string;
        thumbnailUrl: string;
    };
}
export declare class NanoBananaClient {
    private geminiClient;
    constructor();
    generateImage(request: GenerationRequest): Promise<GenerationResponse>;
}
export declare const getDefaultNanoBananaClient: () => NanoBananaClient;
export default NanoBananaClient;
//# sourceMappingURL=nanoBananaClient.d.ts.map