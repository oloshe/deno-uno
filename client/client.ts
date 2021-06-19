import { mainMenu } from "./menu.ts"
import { createWebsocket } from "./net/ws.ts"


if (import.meta.main) {
	mainMenu()
	createWebsocket()
}

