// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.
import { serve } from "https://deno.land/std@0.99.0/http/server.ts";
import {
	acceptWebSocket,
	isWebSocketCloseEvent,
	WebSocket,
	ReqData,
	v4,
	Constant
} from "../deps.ts";
import { Connection } from "./cache.ts"
import { Logger } from "./logger.ts"
import { EventRouter } from "./eventRouter.ts";


export async function handleWs(sock: WebSocket) {
	Logger.log("socket connected!");
	const sockid = v4.generate()
	Connection.add(sockid, sock)
	const router = new EventRouter(sockid, sock);
	try {
		for await (const ev of sock) {
			if (isWebSocketCloseEvent(ev)) {
				const { code, reason } = ev;
				Logger.log("[ws::close]", code, reason);
			}
			if (typeof ev === "string") {
				if (ev === '0') {
					sock.send('1');
				} else {
					const req: ReqData<never> = JSON.parse(ev)
					try {
						router.handle(req)
					} catch (e) {
						console.log(e)
					}
				}
			}
		}
		Connection.del(sockid)
	} catch (err) {
		Logger.error(`failed to receive frame: ${err}`);
		if (!sock.isClosed) {
			await sock.close(1000).catch(Logger.error);
		}
	}
}

export async function runServer(port = Constant.serverPort) {
	Logger.log(`websocket server is running on :${port}`);
	const conn = serve(`:${port}`)
	for await (const req of conn) {
		const { conn, r: bufReader, w: bufWriter, headers } = req;
		acceptWebSocket({
			conn,
			bufReader,
			bufWriter,
			headers,
		})
			.then(handleWs)
			.catch(async (err) => {
				Logger.error(`failed to accept websocket: ${err}`);
				await req.respond({ status: 400 });
			});
	}
}
if (import.meta.main) {
	runServer()
}