// Stub env BEFORE any module imports config.ts (which calls schema.parse(process.env)
// at module load). Vitest evaluates this file before any test module is loaded.
process.env.MONGO_URL ??= "mongodb://test-host:27017/plumbline-test";
process.env.ANTHROPIC_API_KEY ??= "test-key-not-real";
process.env.LOG_LEVEL ??= "silent";
process.env.UPLOADS_DIR ??= "/tmp/plumbline-test-uploads";
