.PHONY: install start build build-linux build-mac build-windows clean

install:
	npm install

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
	rm -rf dist
