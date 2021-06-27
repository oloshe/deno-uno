const devConf = {
	addr: 'localhost:20210'
}

const prodConf = {
	addr: '101.34.48.12:20210',
}

const defaultConf = {
	isDev: true,
	serverPort: '20210',
}

export const Constant = Object.assign(defaultConf, defaultConf.isDev ? devConf : prodConf)