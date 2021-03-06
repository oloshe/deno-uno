import { Constant } from "../common/constant.ts";
import { createWebsocket } from "./net/ws.ts"

export async function runClient(addr = Constant.addr) {
	await createWebsocket(addr)
}

if (import.meta.main) {
	runClient()
}

