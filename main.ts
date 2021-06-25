import { parseFlags } from "https://deno.land/x/cliffy@v0.19.2/flags/mod.ts";
import { runClient } from "./client/client.ts";
import { Command, Constant } from "./deps.ts";
import { runServer } from "./server/server.ts";

if (import.meta.main) {
	const args = parseFlags(Deno.args);
	const flag = args.flags as Record<string, string>
	const {
		host = Constant.addr,
	} = flag
	
	
	let runType: 'server' | 'client' = 'client'

	await new Command()
		.name("DenoUno")
		.version("0.1.0")
		.description("Command line uno game made by Deno")
		.option('--host', 'specify a server address to connect')
		.option('--port', `specify a port to listen when as server, `)
		.command("server [port]", "start as a server")
		.action((_, args = Constant.serverPort) => {
			runServer(args)
			runType = 'server'
		})
		.parse(Deno.args);
	
	runType === 'client' && runClient(host);
}