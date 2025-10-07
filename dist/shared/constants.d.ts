export declare const API_ENDPOINTS: {
    readonly HEALTH: "/health";
    readonly API_V1: "/api/v1";
    readonly CHARACTERS: "/api/v1/characters";
    readonly USERS: "/api/v1/users";
    readonly UPLOAD: "/api/v1/upload";
};
export declare const HTTP_STATUS: {
    readonly OK: 200;
    readonly CREATED: 201;
    readonly BAD_REQUEST: 400;
    readonly UNAUTHORIZED: 401;
    readonly FORBIDDEN: 403;
    readonly NOT_FOUND: 404;
    readonly INTERNAL_SERVER_ERROR: 500;
};
export declare const CHARACTER_LIMITS: {
    readonly MAX_NAME_LENGTH: 100;
    readonly MAX_DESCRIPTION_LENGTH: 1000;
    readonly MAX_TAGS: 10;
    readonly MAX_TAG_LENGTH: 50;
};
export declare const FILE_LIMITS: {
    readonly MAX_FILE_SIZE: number;
    readonly ALLOWED_IMAGE_TYPES: readonly ["image/jpeg", "image/png", "image/webp"];
    readonly ALLOWED_EXTENSIONS: readonly [".jpg", ".jpeg", ".png", ".webp"];
};
export declare const DEFAULT_VALUES: {
    readonly CHARACTER_VERSION: 1;
    readonly PUBLIC_CHARACTER: false;
    readonly DEFAULT_PORT: 3000;
};
//# sourceMappingURL=constants.d.ts.map