import { Dialoguer, playerUser, MyEvent, Keypress, RoomData, ws } from "../deps.ts";

export const mainMenu = async () => {
	while (1) {
		console.clear()
		myInfo()
		console.log()
		const ret = await Dialoguer.Select({
			title: 'please choose:',
			items: [
				'room list',
				'create room',
				'setting',
				'exit',
			]
		})
		switch (ret) {
			case 'room list': await roomList(); break;
			case 'create room': await createRoom(); break;
			case 'setting': await settingMenu(); break;
			case 'exit': exit();
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

export const roomList = () => {
	console.clear()
	ws.send(MyEvent.GetRoomList, null, (data) => {
		console.log(data)
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