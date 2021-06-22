import { Constant } from "../deps.ts";
import { createWebsocket } from "./net/ws.ts"

export async function runClient(host = Constant.host, port = Constant.port) {
	await createWebsocket(host, port)
}

if (import.meta.main) {
	runClient()
}

