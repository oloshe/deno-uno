

import { MyEvent, EventData, ResponseData, ReqData, ResponseEventDataDefine, PushData, Dialoguer, playerUser, Cache, deferred, Table, Cell } from "../../deps.ts"
import { ClientConf } from "../client.config.ts";
import { mainMenu } from "../menu.ts";

let _websocket: WebSocket
let lastestAddr = ''

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

export function createWebsocket(addr: string) {
	const signal = deferred<void>()
	let connected = false
	lastestAddr = addr
	try {
		_websocket = new WebSocket(`ws://${addr}`)
	} catch (e) {
		console.log(e)
		return signal.reject()
	}
	console.clear()
	console.log('connecting server...')
	_websocket.onmessage = function (ev: MessageEvent) {
		const _rawdata = JSON.parse(ev.data)
		if (_rawdata == 1) {
			ppChecker.reset().start()
			return
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
		signal.resolve()
		connected = true
		ppChecker.reset().start()
		console.clear()
		await login()
		mainMenu()
	}
	_websocket.onerror = function (_) {
		_websocket.close()
	}
	_websocket.onclose = () => {
		console.clear()
		console.log('lost connection');
		if (connected) {
			Deno.exit(1)
		} else {
			reconnect()
		}
	}
	return signal;
}

export const login = async () => {

	Table.from([
		[Cell.from(`Welcome To ${Dialoguer.ansi.link(Dialoguer.colors.brightBlue('DenoUno'), 'https://baidu.com')}`).colSpan(2)],
		[`version`, ClientConf.version],
	])
		.border(true)
		.render()
	if (Deno.build.os === 'windows') {
		Dialoguer.tty
			.cursorNextLine(1)
			.text(`(Windows Only)`)
			.cursorNextLine
			.text(`if u see garbled please restart after use ${Dialoguer.colors.brightBlue('chcp 65001')} to switch ur code page to 65001.`)
			.cursorNextLine(2)
	}
	while (true) {
		let ret
		do {
			ret = await Dialoguer.Input({ title: 'please input a nick' })
			ret = ret.trim()
		} while(!ret)
		const resp = await ws.sendFuture(MyEvent.Login, { nick: ret, cv: ClientConf.cv })
		if (resp.succ) {
			playerUser.setName(ret)
			break
		} else {
			console.log(`login fail, please try again later!`)
			switch (resp.reason) {
				case 'version': console.log(`reson: ur client's version is not consistent with the target server's version`); break;
				case 'count_limit': console.log(`reson: the number of server's connections exceeds the maximum limit.`)
			}
		}
	}
}

async function reconnect() {
	console.clear()
	console.error(`connect to ${lastestAddr} failed, please check the server is running or contact with the admin.\n`)

	const ret = await Dialoguer.Select({
		title: 'select',
		items: [
			'reconnect',
			'change server address',
			'exit'
		]
	})
	if (ret === 'exit') {
		Deno.exit(1)
	} else if (ret === 'reconnect') {
		await createWebsocket(lastestAddr)
	} else if (ret === 'change server address') {
		const _addr = (await Dialoguer.Input({ title: `please input address` })).trim()
		await createWebsocket(_addr)
	}
}

export async function checkConnection() {
	if (_websocket.readyState !== _websocket.OPEN) {
		await reconnect()
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
	static _serverTimeoutId = 0
	static reset() {
		clearTimeout(this._timeoutId)
		clearInterval(this._serverTimeoutId)
		return this
	}
	static start() {
		this._timeoutId = setTimeout(() => {
			_websocket.send('0')
			this._serverTimeoutId = setTimeout(() => _websocket.close(),)
		}, this._timeout)
	}
}