# KeepKey Updater

## Setup
install deps and run:

```
yarn
yarn electron-dev
```

Changes to the display process (the things in `src/`) will automatically trigger a reload. Changes
to the main process (the things in `public/`) will require a manual restart to be reflected.

## Build

### Versions

There are three versions of the updater: Mac OS, Linux, and Windows. You must build on the host OS for the app you're packaging. 

#### Mac OS

The `macos` build requires that the app be signed. As of 10.14.5, the app must also be notarized by Apple. The build process will do this automatically but you must configure the build machine with the following:

	1. A Developer ID signing certificate must be added to the key store. This is typically done by signing into your developer account via the Xcode GUI.
	2. You must set the following environment variables where XXXXX is the your developer ID and YYYYY is an app-specific password.

		export APPLEID="XXXXX"
		export APPLEIDPW= "YYYYY"

#### Windows

Build the app on a Windows machine.

#### Linux

Build the app on a Linux machine.


### Build Process

```
nvm use
rm -rf build dist node_modules
yarn install --frozen-lockfile
yarn electron-pack
```

This will create installer and app images for the host OS you're on in `/dist`.

## Adding New Firmware/Bootloader Versions

The KeepKey Updater will automatically grab what's in the `latest` parameter block in `releases.json`. To release a new version of either of these:

1) Get hashes for the firmware and/or signed bootloader:

    - Firmware: Use the SHA-256 hash of firmware.keepkey.bin
```
openssl dgst -sha256 -r firmware.keepkey.bin | cut -d ' ' -f 1
```

    - Bootloader: Use the double-SHA-256 of bootloader.bin (*not* blupdater.bin).

```
openssl dgst -sha256 -binary bootloader.bin | openssl dgst -sha256 -r | cut -d ' ' -f 1
```

2) Drop a hash+version keypair in `releases.json`, following the existing pattern. Update `latest` version as appropriate.

3) Commit changes to `releases.json`, plus new binary image files in a subdirectory of `firmware`.

4) Run `firmware/ipns-deploy.sh`, providing an IPNS keyfile and a web3.storage API key.

5) Done.
