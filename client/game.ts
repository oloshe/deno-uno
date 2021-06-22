import { ws, MyEvent, Dialoguer } from "../deps.ts"

export async function joinRoom(id: string) {
	console.clear()
	const ret = await ws.sendFuture(MyEvent.JoinRoom, { id })
	if (ret.succ) {
		await gamePage()
	} else {
		console.log('join room fail!');
	}
}

export async function gamePage() {
	console.clear()
	console.log('Game')
	await Dialoguer.Input({ title: 'welcome' });
	ws.send(MyEvent.ExitRoom, null)
}