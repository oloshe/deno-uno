import { mainMenu } from "./menu.ts"
import { createWebsocket } from "./ws.ts"


if (import.meta.main) {
	mainMenu()
	createWebsocket()
}

