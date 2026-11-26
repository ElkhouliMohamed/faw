import { PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = g.prisma ?? new PrismaClient({ datasources: { db: { url: process.env.LARAVEL_DATABASE_URL || "file:/workspace/faw-api/database/database.sqlite" } } });
if (process.env.NODE_ENV !== "production") g.prisma = prisma;
