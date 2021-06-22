// import { assertEquals } from "https://deno.land/std@0.99.0/testing/asserts.ts";
// import { createWebsocket } from "./client/net/ws.ts";
// import { MyEvent } from "./deps.ts";

// const addr = 'ws://127.0.0.1:3333'

// Deno.test({
// 	name: 'login/createRoom',
// 	fn: async () => {
// 		const websocket = await createWebsocket(addr)
// 		const ws = new WsProto(websocket);
// 		const nick1 = 'test-user-1'
		
// 		// 登录
// 		const ret1 = await ws.sendFuture(MyEvent.Login, { nick: nick1 });
// 		console.log('[login result]', ret1);
// 		assertEquals(ret1.succ, true, 'login fail')
		
// 		// 创建房间
// 		const ret2 = await ws.sendFuture(MyEvent.CreateRoom, {
// 			'name': 'test-room-1',
// 			'owner': nick1,
// 			'max': 3,
// 		})
// 		assertEquals(ret2.succ, true, 'create room fail')

// 		websocket.close()
// 	}
// })