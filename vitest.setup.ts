// 测试环境变量（在所有测试模块加载前注入，模块内部 getEnv() 惰性读取）
process.env.DATABASE_URL ??= "postgres://postgres:postgres@localhost:35432/fraxtal";
process.env.JWT_SECRET ??= "test-only-secret-0123456789abcdef-fraxtal";
