import { Dialoguer, playerUser, Keypress } from "../deps.ts";

export const mainMenu = async () => {
	while (1) {
		console.clear()
		const ret = await Dialoguer.Select({
			title: 'please choose:',
			items: [
				'room list',
				'setting',
				'exit',
			]
		})
		switch (ret) {
			case 'setting': await settingMenu(); break;
		}
		// console.log(ret)
	}
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