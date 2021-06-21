// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.
import { serve } from "https://deno.land/std@0.99.0/http/server.ts";
import {
	acceptWebSocket,
	isWebSocketCloseEvent,
	// isWebSocketPingEvent,
	WebSocket,
	ReqData,
	v4
} from "../deps.ts";
import {
	handleEvent
} from "./handler.ts"
import { addConnection, delConnection, getPlayer } from "./cache.ts"
import { Logger } from "./logger.ts"


async function handleWs(sock: WebSocket) {
	Logger.log("socket connected!");
	const sockid = v4.generate()
	addConnection(sockid, sock)
	try {
		for await (const ev of sock) {
			if (isWebSocketCloseEvent(ev)) {
				// close.
				const { code, reason } = ev;
				Logger.log("ws:Close", code, reason);
				break;
			}
			if (typeof ev === "string") {
				if (ev === '0') { sock.send('1'); continue }
				const _data: ReqData<never> = JSON.parse(ev)
				handleEvent(_data, sock, sockid);
			}
		}
		Logger.log('[logout]', getPlayer(sockid)?.nick);
		delConnection(sockid)
	} catch (err) {
		Logger.error(`failed to receive frame: ${err}`);
		if (!sock.isClosed) {
			await sock.close(1000).catch(Logger.error);
		}
	}
}

if (import.meta.main) {

	const port = Deno.args[0] || "3333";

	Logger.log(`websocket server is running on :${port}`);
	for await (const req of serve(`:${port}`)) {
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