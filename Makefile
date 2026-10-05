.PHONY: install dev test check start build build-linux build-mac build-windows clean

install:
	npm install

dev:
	npm run dev

test:
	npm test

check:
	npm run check

start:
	npm start

build:
	npm run dist

build-linux:
	npm run dist:linux

build-mac:
	npm run dist:mac

build-windows:
	npm run dist:win

clean:
	rm -rf dist release
