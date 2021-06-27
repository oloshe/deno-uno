import { Keypress } from "../deps.ts";
import { joinRoom } from "./game.ts"
import { Dialoguer, SelectOption } from "./dialoguer.ts"
import { playerUser } from "../common/user.ts"
import { MyEvent } from "../common/event.ts"
import { ws } from "./net/ws.ts"
import { Cache } from "./cache.ts"
import { GameState } from "../common/mod.ts";

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
			title: 'please input your nick',
		})
		const newNick = str.trim();
		if (!newNick) continue
		const ret = await ws.sendFuture(MyEvent.ChangeNick, newNick)
		if (ret.succ) {
			playerUser.setName(newNick);
		} else {
			console.log('change nick fail. press any key to continue.')
			await new Keypress();
		}
		break;
	}
}

export const myInfo = () => {
	console.log(Dialoguer.colors.blue('~') +' Deno Uno')
	console.log(`[nick: ${playerUser.name}]`)
}

export const roomList = async (no = 1) => {
	console.clear()
	const listNum = 5
	const { list, max } = await ws.sendFuture(MyEvent.GetRoomList, { no, num: listNum })
	const items: SelectOption['items'] = list.map((rd, index) => {
		return {
			name: Dialoguer.ansi
				.text(rd.name)
				.cursorForward(1)
				.text(`[${rd.count}/${rd.max}]`)
				.cursorForward(1)
				.text(rd.pwd ? Dialoguer.colors.yellow.bgBlack(`[lock]`) : '')
				.text(rd.status === GameState.Start ? Dialoguer.colors.yellow.bgBlack('[start]') : '')
				.toString(),
				//`${rd.name} [owner:${rd.owner}] [${rd.count}/${rd.max}] ${rd.pwd ? Dialoguer.colors.yellow.bgBlack(`[lock]`) : ''}`,
			value: index.toString(),
			// disabled: rd.count >= rd.max
		}
	});
	items.push(Dialoguer.selectDivider)
	no < max && items.push('next page');
	no > 1 && items.push('prev page');
	items.push(...[
		'create room',
		'refresh',
		'back',
	])

	const selected = await Dialoguer.Select({
		title: list.length === 0 ? `oop, it have no room` : 'please choose a room',
		items,
	})

	switch (selected) {
		case 'next page': await roomList(no + 1); break;
		case 'prev page': await roomList(no - 1); break;
		case 'create room': await createRoom(); break;
		case 'refresh': await roomList(); break;
		case 'back': break;
		default: {
			const index = parseInt(selected)
			const { id, pwd } = list[index]
			let inputPwd: string | undefined
			pwd && (inputPwd = await Dialoguer.Input({ title: 'please input password' }))
			const ret = await joinRoom(id, inputPwd);
			!ret && await roomList()
		}
	}
}

const createRoom = async () => {
	while (true) {
		const inputName = await Dialoguer.Input({
			title: 'room name',
		})
		const name = inputName.trim()
		if (!name) continue
		const inputNum = await Dialoguer.Select({
			title: 'maximun number of people',
			items: ['2', '3', '4', '5', '6', '7', '8', '9', '10'],
		})
		const max = parseInt(inputNum)
		if (isNaN(max)) continue
		let pwd = await Dialoguer.Input({
			title: `password (if u need)`
		})
		pwd = pwd.trim()
		const ret = await ws.sendFuture(MyEvent.CreateRoom, {
			name, max, owner: playerUser.name, _pwd: pwd,
		})
		if (ret.succ) {
			await joinRoom(ret.roomid, pwd)
		} else {
			console.log('create room fail')
			await new Keypress()
		}
		break;
	}
}