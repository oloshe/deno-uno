

import { MyEvent, EventData, ResponseData, ReqData, ResponseEventDataDefine, PushData, Dialoguer, playerUser, Cache } from "../../deps.ts"
import { mainMenu } from "../menu.ts";

let _websocket: WebSocket
let lastestHost = '', lastestPort = ''
let _preventReconnect = false
let fork: ReturnType<typeof Deno.run>

type dataCallbackFn<T> = ((data: ResponseData<T>) => void) | ((data: PushData<T>) => void)

type dataCallbackData<T> = {
	cb: dataCallbackFn<T>
	once?: boolean
}

const dataCallback: Map<MyEvent, dataCallbackData<unknown>[]> = new Map();

function processCallbackMap<T extends MyEvent>(event: T, callback: (list: dataCallbackData<T>[]) => void) {
	const data = dataCallback.get(event) || []
	callback(data)
	dataCallback.set(event, data)
}
function addCallback<T extends MyEvent>(event: T, fn: dataCallbackFn<T>, once = false) {
	processCallbackMap(event, list => {
		list.push({
			cb: <dataCallbackFn<unknown>>fn,
			once,
		})
	})
}
function removeCallback<T extends MyEvent>(event: T, fn: dataCallbackFn<T>) {
	processCallbackMap(event, list => {
		const idx = list.findIndex(itm => itm.cb === fn)
		idx !== -1 && list.splice(idx, 1)
	})
}

export function createWebsocket(host: string, port: string) {
	lastestHost = host
	lastestPort = port
	return new Promise((resolve, reject) => {
		try {
			_websocket = new WebSocket(`ws://${host}:${port}`)
		} catch (e) {
			console.log(e)
			return reject(e)
		}
		console.clear()
		console.log('connecting server...')
		_websocket.onmessage = function (ev: MessageEvent) {
			const _rawdata = JSON.parse(ev.data)
			if (_rawdata === '1') {
				ppChecker.reset().start()
			}
			// console.log('[ws.onmessage]', _rawdata)
			const { func, data } = _rawdata;
			Cache.set(func, data)
			const cbData = dataCallback.get(func)
			if (cbData) {
				const filterCbData = cbData.filter(itm => {
					// 执行回调
					itm.cb(data)
					return !itm.once
				})
				// 去除单次回调
				filterCbData.length !== cbData.length && dataCallback.set(func, filterCbData)
			}
		}
		_websocket.onopen = async () => {
			resolve(void 0)
			_preventReconnect = false
			console.clear()
			ppChecker.reset().start()
			await login()
			mainMenu()
		}
		_websocket.onerror = function (_) {
			_websocket.close()
		}
		_websocket.onclose = async () => {
			!_preventReconnect && await reconnect()
		}
	})
}

export const login = async () => {
	while (true) {
		let ret
		do {
			ret = await Dialoguer.Input({ title: 'please input a nick' })
			ret = ret.trim()
		} while(!ret)
		const resp = await ws.sendFuture(MyEvent.Login, { nick: ret })
		console.log(resp.succ)
		if (resp.succ) {
			playerUser.setName(ret)
			break
		} else {
			console.log(`login fail, please try again!`)
		}
	}
}

async function reconnect() {
	console.clear()
	console.error(`connect to ${lastestHost}:${lastestPort} failed, please check the server is running or contact with the admin.\n`)

	const ret = await Dialoguer.Select({
		title: 'select',
		items: [
			'reconnect',
			'change server address',
			'create local server',
			'exit'
		]
	})
	if (ret === 'exit') {
		Deno.exit(1)
	} else if (ret === 'reconnect') {
		await createWebsocket(lastestHost, lastestPort)
	} else if (ret === 'change server address') {
		const _host = (await Dialoguer.Input({ title: `please input address (e.g ${lastestHost})` })).trim()
		const _port = (await Dialoguer.Input({ title: `please input port (e.g ${lastestPort})` })).trim()
		await createWebsocket(_host, _port)
	} else if (ret === 'create local server') {
		fork = Deno.run({
			cmd: ['deno', 'run', '--unstable', '--allow-net', 'server/server.ts'],
			stdout: 'null',
			stderr: 'null',
		})
		window.onunload = () => {
			fork.kill(2)
		}
	}
}


export function preventReconnect() {
	_preventReconnect = true
}
export async function checkConnection() {
	if (_websocket.readyState !== _websocket.OPEN) {
		await reconnect()
	} else {
		_preventReconnect = false
	}
}


export class ws {
	static send<T extends MyEvent>(event: T, data: EventData<T>, callback?: (data: ResponseData<T>) => void) {
		const _transData: ReqData<T> = {
			func: event,
			data,
		}
		// console.log(event, callback)
		callback && addCallback(event, callback, true);
		if (_websocket.readyState !== _websocket.OPEN) {
			console.error('socket is not open');
			return
		}
		_websocket.send(JSON.stringify(_transData))
	}

	static sendFuture<T extends keyof ResponseEventDataDefine>(event: T, data: EventData<T>): Promise<ResponseData<T>> {
		return new Promise((resolve) => {
			this.send(event, data, (resp) => {
				resolve(resp)
			})
		})
	}
	static on<T extends MyEvent>(event: T, callback: (data: PushData<T>) => void) {
		addCallback(event, callback);
		return { off: () => this.off(event, callback) }
	}
	static off<T extends MyEvent>(event: T, callback:  (data: PushData<T>) => void) {
		removeCallback(event, callback)
	}
}

class ppChecker {
	static _timeout = 10000
	static _timeoutId = 0
	static reset() {
		clearTimeout(this._timeoutId)
		return this
	}
	static start() {
		// console.log('ping')
		// _websocket.send('0')
		// this._timeoutId = setTimeout(() => {
		// 	_websocket?.close()
		// }, this._timeout)
	}
}