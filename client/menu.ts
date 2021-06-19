import { Dialoguer, playerUser, MyEvent, Keypress, RoomData, ws } from "../deps.ts";

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
		console.log('go')
		ws.send(MyEvent.GetRoomList, null, async (data) => {
			const ret = await Dialoguer.Select({
				title: 'please choose a room',
				items: data.map(rd => {
					return {
						name: `${rd.name} [max:${rd.max}] [owner:${rd.owner}]`,
						value: rd.name,
					}
				}),
			})
			console.log(ret)
			resolve(void 0)
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
	const roomData = new RoomData({
		name, max, owner: playerUser.name
	})
	ws.send(MyEvent.CreateRoom, roomData)
}