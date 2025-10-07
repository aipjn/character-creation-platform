declare class ServerManager {
    private server;
    private isShuttingDown;
    private connections;
    private startTime;
    start(): Promise<void>;
    private validateEnvironment;
    private configureServer;
    private setupConnectionTracking;
    private listen;
    private performHealthChecks;
    private setupGracefulShutdown;
    private shutdown;
    getStatus(): {
        isRunning: boolean;
        uptime: number;
        pid: number;
        port: number;
        environment: string;
        memory: NodeJS.MemoryUsage;
        connections: number;
    };
    restart(): Promise<void>;
}
declare const serverManager: ServerManager;
export { serverManager };
export default serverManager;
export declare const startServer: () => Promise<void>;
export declare const getServerStatus: () => {
    isRunning: boolean;
    uptime: number;
    pid: number;
    port: number;
    environment: string;
    memory: NodeJS.MemoryUsage;
    connections: number;
};
export declare const restartServer: () => Promise<void>;
export declare const checkServerHealth: () => Promise<{
    status: "healthy" | "unhealthy";
    details: any;
}>;
//# sourceMappingURL=server.d.ts.map