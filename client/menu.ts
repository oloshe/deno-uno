import { Dialoguer, playerUser, MyEvent, Keypress, ws } from "../deps.ts";
import { joinRoom } from "./game.ts"

export const login = async () => {
	while (1) {
		const ret = await (await Dialoguer.Input({ title: 'please input a nick' })).trim()
		const resp = await ws.sendFuture(MyEvent.Login, { nick: ret })
		console.log(resp.succ)
		if (resp.succ) {
			playerUser.setName(ret)
			break
		} else {
			console.log(`it's a duplicate nick, please try again!`)
		}
	}
}

export const mainMenu = async () => {
	while (1) {
		console.clear()
		myInfo()
		console.log()
		const items = [
			'room list',
			'create room',
			'setting',
			'exit',
		]
		const ret = await Dialoguer.Select({
			title: 'please choose:',
			items,
		})
		switch (ret) {
			case items[0]: await roomList(); break;
			case items[1]: await createRoom(); break;
			case items[2]: await settingMenu(); break;
			case items[3]: exit();
		}
	}
}
const exit = () => {
	console.clear()
	console.log(`Goodbye, see you soon, ${playerUser.name}!`)
	Deno.exit(1)
}

export const settingMenu = async () => {
	while (1) {
		const str = await Dialoguer.Input({
			title: 'please input your user name',
		})
		playerUser.setName(str.trim());
		await new Keypress();
		break;
	}
}

export const myInfo = () => {
	console.log(`hello ${playerUser.name} !`)
}

export const roomList = async () => {
	console.clear()
	return await new Promise((resolve) => {
		ws.send(MyEvent.GetRoomList, null, async (data) => {
			if (data.length === 0) {
				console.log('no room')
				await new Keypress();
				return resolve(void 0)
			}
			const ret = await Dialoguer.Select({
				title: 'please choose a room',
				items: [...data.map(rd => {
					return {
						name: `${rd.name} [max:${rd.max}] [owner:${rd.owner}]`,
						value: rd.id,
					}
				}), ...[
					'back'
				]],
			})
			console.log(ret)
			switch (ret) {
				case 'back': resolve(void 0); break;
				default: await joinRoom(ret); break;
			}
		})
	})
}

const createRoom = async () => {
	const inputName = await Dialoguer.Input({
		title: 'what is your room name',
	})
	const name = inputName.trim()
	const inputNum = await Dialoguer.Select({
		title: 'what is the maximun number of people',
		items: ['3', '4', '5', '6', '7', '8'],
	})
	const max = parseInt(inputNum)
	ws.send(MyEvent.CreateRoom, {
		name, max, owner: playerUser.name
	})
}