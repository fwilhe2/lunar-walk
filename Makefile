.PHONY: install dev test check start build build-linux build-mac build-windows clean

install:
	bun install

dev:
	bun run dev

test:
	bun run test

check:
	bun run check

start:
	bun run start

build:
	bun run dist

build-linux:
	bun run dist:linux

build-mac:
	bun run dist:mac

build-windows:
	bun run dist:win

clean:
	rm -rf dist release
