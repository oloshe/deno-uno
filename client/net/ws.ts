import { Event, EventData, TransData } from "../../deps.ts"
let _websocket: WebSocket

export function createWebsocket() {
	console.log('connecting server...')
	_websocket = new WebSocket('ws://127.0.0.1:3333')
	_websocket.onopen = () => {
		console.log('connect success!')
	}
	_websocket.onerror = () => {
	}
	_websocket.onclose = () => {
	}
	_websocket.onmessage = function (ev: MessageEvent) {
		console.log(ev.data)
	}
}



export function send<T extends Event>(event: T, data: EventData<T>) {
	const _transData: TransData<T> = {
		func: event,
		data,
	}
	_websocket.send(JSON.stringify(_transData))
}