import { ws, MyEvent, Dialoguer } from "../deps.ts"

export async function joinRoom(id: string) {
	console.clear()
	const ret = await ws.sendFuture(MyEvent.JoinRoom, { id })
	if (ret.succ) {
		await gameInterface()
	} else {
		console.log('join room fail!');
	}
}

async function gameInterface() {
	await Dialoguer.Input({ title: 'welcome' });
}