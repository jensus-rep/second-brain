// Completes Next's standalone output so `.next/standalone` can be deployed as-is to Azure App Service.
import { cpSync, existsSync, writeFileSync } from "node:fs";

const out = ".next/standalone";
if (!existsSync(out + "/server.js")) throw new Error("Missing .next/standalone/server.js – is output: \"standalone\" set?");
cpSync(".next/static", out + "/.next/static", { recursive: true });
cpSync("public", out + "/public", { recursive: true });
// App Service sets HOSTNAME to the container name; Next must listen on all interfaces on the given PORT.
writeFileSync(out + "/startup.sh", "#!/bin/sh\nset -eu\nexport HOSTNAME=0.0.0.0\nexport NODE_ENV=production\nexec node server.js\n", { mode: 0o755 });
console.log("Standalone package ready in " + out);
