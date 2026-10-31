import path from "node:path";
import { config } from "dotenv";
import { bootstrapDatabase } from "../src/db/bootstrap";

config({ path: path.join(process.cwd(), ".env.local") });
config({ path: path.join(process.cwd(), ".env") });

bootstrapDatabase();
console.log("Database is up to date.");
