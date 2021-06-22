import { parseFlags } from "https://deno.land/x/cliffy@v0.19.2/flags/mod.ts";
import { runClient } from "./client/client.ts";
import { Constant } from "./deps.ts";
import { runServer } from "./server/server.ts";

if (import.meta.main) {
	const args = parseFlags(Deno.args);
	const flag = args.flags as Record<string, string>
	const port = flag.port || Constant.port
	console.log(flag)
	if (flag.server) {
		runServer(port)
	} else {
		runClient(flag.host, port)
	}
}