import { parseFlags } from "https://deno.land/x/cliffy@v0.19.2/flags/mod.ts";
import { ClientConf } from "./client/client.config.ts";
import { runClient } from "./client/client.ts";
import { Command } from "./deps.ts";
import { Constant } from "./common/constant.ts"
import { runServer } from "./server/server.ts";

if (import.meta.main) {
	const args = parseFlags(Deno.args);
	const flag = args.flags as Record<string, string>
	let {
		host = Constant.addr,
		port = Constant.serverPort,
	} = flag
	
	
	let runType: 'server' | 'client' = 'client'

	await new Command()
		.name("DenoUno")
		.version(ClientConf.version)
		.description("Command line uno game made by Deno")
		.option('--host [host]', `specify a server address to connect, default port is ${Constant.serverPort}`)
		.option('--port <port>', `specify a port to connect `)
		.command("server [port]", "start as a server")
		.action((_, args = Constant.serverPort) => {
			runServer(args)
			runType = 'server'
		})
		.parse(Deno.args);
	
	if (flag.port) {
		if (/:\d+/.test(host)) host = host.replace(/(?<=:)\d+)/, port);
		else host = host + ':' + flag.port
	}
	runType === 'client' && runClient(host);
}