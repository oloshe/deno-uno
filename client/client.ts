import { mainMenu, login } from "./menu.ts"
import { createWebsocket } from "./net/ws.ts"


if (import.meta.main) {
	try {
		await createWebsocket()
		await login()
		mainMenu()
	} catch (_) {
		console.error('connection error, please check the server is running or contact with the admin.')
	}
}

