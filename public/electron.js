const electron = require('electron');
const app = electron.app;
const dialog = electron.dialog;
const ipcMain = electron.ipcMain;
const BrowserWindow = electron.BrowserWindow;
const path = require('path');
const isDev = require('electron-is-dev');
const { WebUSB } = require('usb');
const { NodeWebUSBKeepKeyAdapter } = require('@shapeshiftoss/hdwallet-keepkey-nodewebusb')
const { HIDKeepKeyAdapter } = require('@shapeshiftoss/hdwallet-keepkey-nodehid')
const { Keyring } = require('@shapeshiftoss/hdwallet-core')
const url = require('url')
const crypto = require('crypto')
const fetch = require('./node-fetch-file-url');

const DEFAULT_MANIFEST_URL = 'https://ipfs.io/ipns/k51qzi5uqu5dlbggjzdpw8ya206zkcdmd1gmg77oqdmuhs899bgfv43lzhd5er/releases.json';
const DEFAULT_SUPPORT_LINK = 'https://shapeshift.zendesk.com';

const normalizeManifestUrl = (x) => {
  try {
    return new URL(x);
  } catch {
    if (process.env.PORTABLE_EXECUTABLE_DIR) x = path.resolve(process.env.PORTABLE_EXECUTABLE_DIR, x)
    return url.pathToFileURL(x);
  }
}

const FIRMWARE_MANIFEST_URL = (() => {
  if (process.argv[1] === "--manifest") return normalizeManifestUrl(process.argv[2]);
  if (process.env.KEEPKEY_FIRMWARE_MANIFEST) return normalizeManifestUrl(process.env.KEEPKEY_FIRMWARE_MANIFEST);
  return new URL(DEFAULT_MANIFEST_URL);
})()

let mainWindow;

const webusb = new WebUSB({ allowAllDevices: true })

// =======================================================================================
// talking to KeepKey

const keyring = new Keyring
let webUsbAdapter, hidAdapter

const atob = str => Buffer.from(str, 'base64').toString('binary');

const base64toHEX = (base64) => {
  var raw = atob(base64);
  var HEX = '';

  for (let i = 0; i < raw.length; i++ ) {
    var _hex = raw.charCodeAt(i).toString(16)

    HEX += (_hex.length==2?_hex:'0'+_hex);
  }

  return HEX
}

const sleep = (millis) => (new Promise((resolve, reject) => {
  setTimeout(resolve, millis)
}))

const normalizeFeatures = async (features) => {
  if (!features) return null
  const { bootloaderHash, firmwareHash } = features
  const decodedBootloaderHash = bootloaderHash && base64toHEX(bootloaderHash)
  const decodedFirmwareHash = firmwareHash && base64toHEX(firmwareHash)
  const hashes = (await getFirmwareData().catch(() => undefined)).hashes
  return {
    ...features,
    firmwareVersion: hashes?.firmware?.[decodedFirmwareHash] ?? "Unknown",
    bootloaderVersion: hashes?.bootloader?.[decodedBootloaderHash] ?? "Unknown"
  }
}

const createWebUsbWallet = async (attempts = 0) => {
  try {
    webUsbAdapter = await NodeWebUSBKeepKeyAdapter.useKeyring(keyring)
    const wallet = await webUsbAdapter.pairDevice()
    return wallet
  } catch (error) {
    if (attempts < 10) {
      await sleep(500)
      return await createWebUsbWallet(attempts + 1)
    }
    console.log('error creating WebUSB wallet: ', error)
    return null
  }
}

const createHidWallet = async (attempts = 0) => {
  try {
    hidAdapter = await HIDKeepKeyAdapter.useKeyring(keyring)
    const wallet = await hidAdapter.pairDevice()
    return wallet
  } catch (error) {
    if (attempts < 10) {
      await sleep(500)
      return await createHidWallet(attempts + 1)
    }
    console.log('error creating HID wallet: ', error)
    return null
  }
}

const uploadToDevice = async (binary) => {
  try {
    const wallet = Object.values(keyring.wallets)[0]
    if (!wallet) return null
    if (!firmwareIsValid(binary)) throw new Error("firmware binary not valid");
    await wallet.firmwareErase()
    mainWindow.webContents.send("update-status", "UPLOAD_IN_PROGRESS")
    await wallet.firmwareUpload(binary)
    return true
  } catch (error) {
    console.log('error uploading to device: ', error)
    return false
  }
}

const wipeDevice = async () => {
  try {
    const wallet = Object.values(keyring.wallets)[0]
    if (!wallet) return null
    const result = await wallet.wipe()
    return result
  } catch (error) {
    console.log('error wiping device: ', error)
    return false
  }
}

// =======================================================================================
// talking to S3 Bucket

let firmwareDataPromise, firmwareBinaryPromise, blupdaterBinaryPromise

const getFirmwareData = async () => {
  if (!firmwareDataPromise) {
    firmwareDataPromise = fetch(FIRMWARE_MANIFEST_URL).then(x => x.json())
    firmwareDataPromise.then(() => console.log('firmware data loaded'))
  }
  return await firmwareDataPromise
}

const getFirmwareBinary = async () => {
  if (!firmwareBinaryPromise) {
    firmwareBinaryPromise = (async () => {
      try {
        const fwData = await getFirmwareData()
        const path = fwData.latest.firmware.url
        const hash = fwData.latest.firmware.hash
        const firmwareBinary = await getBinary(path)
        if (hash && crypto.createHash("sha256").update(firmwareBinary).digest().toString("hex") !== hash) {
          throw new Error("hash mismatch");
        }
        return firmwareBinary
      } catch (err) {
        console.log({ err })
        mainWindow.webContents.send('error', 'ERROR FETCHING FIRMWARE');
        throw err
      }
    })();
    firmwareBinaryPromise.then(() => console.log('firmware binary loaded'))
  }
  return await firmwareBinaryPromise
}

const getBlupdaterBinary = async () => {
  if (!blupdaterBinaryPromise) {
    blupdaterBinaryPromise = (async () => {
      try {
        const fwData = await getFirmwareData()
        const path = fwData.latest.bootloader.url
        const hash = fwData.latest.bootloader.hash
        const blupdaterBinary = await getBinary(path)
        if (hash && crypto.createHash("sha256").update(blupdaterBinary).digest().toString("hex") !== hash) {
          throw new Error("hash mismatch");
        }
        return blupdaterBinary
      } catch (err) {
        console.log({ err })
        mainWindow.webContents.send('error', 'ERROR FETCHING BOOTLOADER');
        throw err
      }
    })()
    blupdaterBinaryPromise.then(() => console.log('blupdater binary loaded'))
  }
  return await blupdaterBinaryPromise
}

const firmwareIsValid = (buf) => {
  return !!buf
  && buf.slice(0x0000, 0x0004).toString() === 'KPKY' // check for 'magic' bytes
  && buf.slice(0x0004, 0x0008).readUInt32LE() === buf.length - 256 // check firmware length - metadata
  && buf.slice(0x000B, 0x000C).readUInt8() & 0x01 // check that flag is not set to wipe device
}

const getBinary = async (path) => {
  const res = await fetch(new URL(path, FIRMWARE_MANIFEST_URL), {
    headers: {
      accept: 'application/octet-stream'
    }
  })
  if (!res.ok) throw new Error('Unable to fetch latest firmware')
  const body = Buffer.from(await res.arrayBuffer())
  if(!firmwareIsValid(body)) throw new Error('Fetched data is not valid firmware')
  return body
}

// =======================================================================================
// usb dis/connect listeners

webusb.addEventListener("connect", async (ev) => {
  try {
    const device = ev.device
    if (device.vendorId !== 0x2b24) return
    if (![0x0001, 0x0002].includes(device.productId)) return
    mainWindow.webContents.send('connecting', true)
    const wallet = (device.productId === 0x0001 ? await createHidWallet() : await createWebUsbWallet());
    const features = wallet ? wallet.features : null
    mainWindow.webContents.send('features', await normalizeFeatures(features))
    mainWindow.webContents.send('connecting', false)
  } catch (e) {
    console.error("USB connection handler error", e)
    mainWindow.webContents.send('update-status', 'FAILED');
  }
})

webusb.addEventListener("disconnect", async (ev) => {
  try {
    const wallet = Object.values(keyring.wallets)[0]
    if (!!wallet) wallet.transport.disconnect()
    await keyring.removeAll()
    mainWindow.webContents.send('features', null);
    mainWindow.webContents.send('connecting', false);
  } catch (e) {
    console.error("USB disconnection handler error", e)
    mainWindow.webContents.send('update-status', 'FAILED');
  }
});

// =======================================================================================
// callbacks for messages from render process

electron.ipcMain.on('app-start', async (event, arg) => {
  try {
    mainWindow.webContents.send('app-version', `v${app.getVersion()}`);
    const [ firmwareData ] = await Promise.all([getFirmwareData(), getFirmwareBinary(), getBlupdaterBinary()])
    mainWindow.webContents.send('firmware-data', firmwareData);
    const connectedDeviceProductId = await webusb.requestDevice({
      filters: [
        { vendorId: 0x2b24, productId: 0x0001 },
        { vendorId: 0x2b24, productId: 0x0002 },
      ]
    }).then(x => x.productId, () => null)
    let features, wallet
    switch (connectedDeviceProductId) {
      case 1:
        wallet = await createHidWallet()
        features = wallet ? await normalizeFeatures(wallet.features) : null
        break
      case 2:
        wallet = await createWebUsbWallet()
        features = wallet ? await normalizeFeatures(wallet.features) : null
        break
      default:
        features = null
    }
    mainWindow.webContents.send('features', features)
  } catch (error) {
    console.log('failed to fetch firmware info or binaries: ', error)
    mainWindow.webContents.send('error', 'ERROR FETCHING RELEASE DATA');
    mainWindow.webContents.send('firmware-data', {});
  }
  mainWindow.webContents.send('connecting', false)
});

electron.ipcMain.on('update-required', async (event, updateRequired) => {
  if (updateRequired.bootloader) await getBlupdaterBinary().catch(() => undefined)
  if (updateRequired.firmware) await getFirmwareBinary().catch(() => undefined)
})

electron.ipcMain.on('wipe-keepkey', async (event, updateRequired) => {
  try {
    const options = {
      type: 'question',
      buttons: ['cancel', 'wipe device'],
      defaultId: 2,
      title: 'Reset Device',
      message: 'To remove your PIN, you must reset your device to factory settings.',
      detail: 'This will WIPE your device!',
      checkboxLabel: 'I have my recovery phrase',
      checkboxChecked: false,
    };
    const msgBoxResp = await electron.dialog.showMessageBox(null, options)
    if (msgBoxResp.response === 1){
      if (msgBoxResp.checkboxChecked) {
        await wipeDevice()
      } else {
        electron.dialog.showErrorBox('Reset Device', 'Confirm that you have your recovery phrase available before wiping your device.')
      }
    }
  } catch(err) {
    console.error('failed to wipe device: ', err);
    mainWindow.webContents.send('update-status', 'FAILED');
  }
})

electron.ipcMain.on('update-firmware', async (event, arg) => {
  try {
    const firmwareBinary = await getFirmwareBinary()
    const updateResponse = await uploadToDevice(firmwareBinary)
    if(updateResponse) {
      mainWindow.webContents.send('update-status', 'FIRMWARE_UPDATE_SUCCESS');
    } else {
      mainWindow.webContents.send('update-status', 'FAILED');
    }
  } catch(err) {
    console.error('failed to upload firmware to device: ', err);
    mainWindow.webContents.send('update-status', 'FAILED');
  }
});

electron.ipcMain.on('update-bootloader', async (event, arg) => {
  try {
    const blupdaterBinary = await getBlupdaterBinary()
    const updateResponse = await uploadToDevice(blupdaterBinary)
    if(updateResponse) {
      mainWindow.webContents.send('update-status', 'BOOTLOADER_UPDATE_SUCCESS');
    } else {
      mainWindow.webContents.send('update-status', 'FAILED');
    }
  } catch (err) {
    console.error('failed to upload bootloader to device: ', err);
    mainWindow.webContents.send('update-status', 'FAILED');
  }
});

electron.ipcMain.on('update-custom', async (event, arg) => {
  try {
    const { filePaths: customBinaryPaths } = await dialog.showOpenDialog({
      filters: [{ name: "Firmware Images", extensions: ["bin"] }],
      properties: ["openFile", "dontAddToRecent"],
    });
    const customBinaryPath = customBinaryPaths[0];
    if (!customBinaryPath) throw new Error("no file selected");
    const customBinary = Buffer.from(await (await fetch(url.pathToFileURL(customBinaryPath))).arrayBuffer());
    if (!firmwareIsValid(customBinary)) throw new Error("the selected file is not a valid firmware image");
    const updateResponse = await uploadToDevice(customBinary)
    if (updateResponse) {
      mainWindow.webContents.send('update-status', 'CUSTOM_UPDATE_SUCCESS');
    } else {
      mainWindow.webContents.send('update-status', 'FAILED');
    }
  } catch (err) {
    console.error('failed to upload custom binary to device: ', err);
    mainWindow.webContents.send('update-status', 'FAILED');
  }
});

const closeApp = async () => {
  try {
    const wallet = Object.values(keyring.wallets)[0]
    if (!!wallet) wallet.transport.disconnect()
    await keyring.removeAll()
    app.quit()
  } catch(err) {
    console.log('Error closing application: ', err)
  }
}

electron.ipcMain.on('close-application', async (event, arg) => {
  await closeApp()
});

electron.ipcMain.on('go-to-app', async (event, arg) => {
  const link = (await getFirmwareData())?.links?.app
  if (link && link.startsWith('https://')) await electron.shell.openExternal(link)
  await closeApp()
});

electron.ipcMain.on('get-help', async (event, arg) => {
  const link = (await getFirmwareData().catch(() => undefined))?.links?.support ?? DEFAULT_SUPPORT_LINK
  if (link && link.startsWith('https://')) await electron.shell.openExternal(link)
});

electron.ipcMain.on('update-updater', async (event, arg) => {
  const link = (await getFirmwareData().catch(() => undefined))?.links?.updater
  if (link && link.startsWith('https://')) {
    await electron.shell.openExternal(link)
    await closeApp()
  }
});

// =======================================================================================
// app creation

async function createWindow() {
  if (!isDev) electron.Menu.setApplicationMenu(electron.Menu.buildFromTemplate([]));
  mainWindow = new BrowserWindow({
    width: 407,
    height: 525,
    title: 'KeepKey Updater',
    resizable: isDev,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: false,
      webSecurity: true,
    },
  });
  if (!isDev) {
    mainWindow.removeMenu();
  }
  const bundledIndexPath = `file://${path.join(__dirname, '../build/index.html')}`;
  mainWindow.on('closed', () => mainWindow = null);
  mainWindow.on('ready-to-show', () => mainWindow.show());
  await mainWindow.loadURL(isDev ? 'http://localhost:3000' : bundledIndexPath).catch(() => mainWindow.loadURL(bundledIndexPath));
}

app.on('ready', createWindow);

app.on('before-quit', () => {
  ipcMain.removeAllListeners('app-start');
  ipcMain.removeAllListeners('update-firmware');
  ipcMain.removeAllListeners('update-bootloader');
  ipcMain.removeAllListeners('update-custom');
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// =======================================================================================
// shitty catch all error handling

process.on('uncaughtException', (error) => {
  console.log('ERROR: ', error)
  mainWindow.webContents.send('uncaught-exception', error)
})
