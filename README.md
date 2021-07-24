# Deno Uno

a command line online game of uno.

## Environment

Deno: [1.11.2](https://deno.land/#installation)

## Tutorial

### play

```shell
deno run --unstable --allow-net https://gitee.com/oloshe/deno-uno/attach_files/756244/download/uno@0.1.0.js

# or
git clone https://github.com/oloshe/deno-uno uno
cd uno
deno run --unstable --allow-net main.ts
```

> For convenience, the following command replaces the URL address with `uno.js`

### run as your local server

```shell
deno run --unstable --allow-net uno.js server

# or
deno run --unstable --allow-net main.ts server
```

### connect other server

```shell
deno run --unstable --allow-net uno.js --host <host addr>
```

### control

press **W (up)** or **S (down)** to control the cursor

press **Enter** to confirm

## Screenshot

![menu](https://raw.githubusercontent.com/oloshe/deno-uno/master/pics/WX20210628-211439.png)

![room](https://raw.githubusercontent.com/oloshe/deno-uno/master/pics/WX20210628-211604.png)

![game](https://raw.githubusercontent.com/oloshe/deno-uno/master/pics/WX20210628-211656.png)

![win](https://raw.githubusercontent.com/oloshe/deno-uno/master/pics/WX20210628-211812.png)

## Have Fun

:)
