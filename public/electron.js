const electron = require('electron');
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const path = require('path');
const isDev = require('electron-is-dev');
const usbDetect = require('usb-detection');
const { NodeWebUSBKeepKeyAdapter } = require('@shapeshiftoss/hdwallet-keepkey-nodewebusb')
const { HIDKeepKeyAdapter } = require('@shapeshiftoss/hdwallet-keepkey-nodehid')
const { Keyring } = require('@shapeshiftoss/hdwallet-core')
const url = require('url')
const fetch = require('./node-fetch-file-url');

const FIRMWARE_MANIFEST_URL = (() => {
  if (process.argv[1] === "--manifest") {
    try {
      return new URL(process.argv[2]);
    } catch {
      return url.pathToFileURL(process.argv[2]);
    }
  }
  return new URL("https://static.shapeshift.com/firmware/releases.json");
})()

let mainWindow;

usbDetect.startMonitoring();

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

const normalizeWebUsbFeatures = async (features) => {
  if (!features) return null
  const { bootloaderHash, firmwareHash } = features
  const decodedBootloaderHash = base64toHEX(bootloaderHash)
  const decodedFirmwareHash = base64toHEX(firmwareHash)
  return {
    ...features,
    firmwareVersion: (await getFirmwareData())?.hashes?.firmware?.[decodedFirmwareHash] ?? "Unknown",
    bootloaderVersion: (await getFirmwareData())?.hashes?.bootloader?.[decodedBootloaderHash] ?? "Unknown"
  }
}

const normalizeHidFeatures = async (features) => {
  if (!features) return null
  const { bootloaderHash, bootloaderMode } = features
  const decodedHash = base64toHEX(bootloaderHash)
  const normedFeatures = {
    ...features,
    bootloaderVersion: (await getFirmwareData())?.hashes?.bootloader?.[decodedHash] ?? "Unknown"
  }
  if (!bootloaderMode) {
    const { majorVersion, minorVersion, patchVersion, bootloaderHash } = features
    normedFeatures.firmwareVersion = `v${majorVersion}.${minorVersion}.${patchVersion}`
  }
  return normedFeatures
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
    await hidAdapter.initialize()
    const wallet = keyring.get()
    if (!wallet) throw 'No wallet in the keyring'
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
    const uploadResult = await wallet.firmwareUpload(binary)
    return uploadResult
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
    console.log('error uploading to device: ', error)
    return false
  }
}

// =======================================================================================
// talking to S3 Bucket

let firmwareDataPromise, firmwareBinary, blupdaterBinary

const getFirmwareData = async () => {
  if (!firmwareDataPromise) {
    firmwareDataPromise = fetch(FIRMWARE_MANIFEST_URL).then(x => x.json())
  }
  return await firmwareDataPromise
}

const setTempFirmware = async () => {
  const path = (await getFirmwareData()).latest.firmware.url
  try {
    firmwareBinary = await getBinary(path)
  } catch (err) {
    console.log({ err })
    mainWindow.webContents.send('error', 'ERROR FETCHING FIRMWARE');
  }
}

const setTempBlupdater = async () => {
  const path = (await getFirmwareData()).latest.bootloader.url
  try {
    blupdaterBinary = await getBinary(path)
  } catch (err) {
    console.log({ err })
    mainWindow.webContents.send('error', 'ERROR FETCHING BOOTLOADER');
  }
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

usbDetect.on('add:11044:1', async function(device) {
  mainWindow.webContents.send('connecting', true)
  const wallet = await createHidWallet()
  const features = wallet ? wallet.features : null
  mainWindow.webContents.send('features', await normalizeHidFeatures(features))
  mainWindow.webContents.send('connecting', false)
});

usbDetect.on('remove:11044:1', function(device) {
  keyring.removeAll()
  mainWindow.webContents.send('features', null);
  mainWindow.webContents.send('connecting', false);
});

usbDetect.on('add:11044:2', async function(device) {
  mainWindow.webContents.send('connecting', true)
  const wallet = await createWebUsbWallet()
  mainWindow.webContents.send('connecting', false)
  const features = wallet ? wallet.features : null
  mainWindow.webContents.send('features', await normalizeWebUsbFeatures(features))
});

usbDetect.on('remove:11044:2', async function(device) {
  const wallet = Object.values(keyring.wallets)[0]
  if (!!wallet) wallet.transport.disconnect()
  await keyring.removeAll()
  mainWindow.webContents.send('features', null)
  mainWindow.webContents.send('connecting', false)
});

// =======================================================================================
// callbacks for messages from render process

electron.ipcMain.on('app-start', async (event, arg) => {
  try {
    mainWindow.webContents.send('latest', (await getFirmwareData()).latest);
    let connectedDeviceProductId
    await usbDetect.find(0x2b24, function(err, foundDevices) { connectedDeviceProductId = foundDevices.length ? foundDevices[0].productId : null })
    let features, wallet
    switch (connectedDeviceProductId) {
      case 1:
        wallet = await createHidWallet()
        features = wallet ? await normalizeHidFeatures(wallet.features) : null
        break
      case 2:
        wallet = await createWebUsbWallet()
        features = wallet ? await normalizeWebUsbFeatures(wallet.features) : null
        break
      default:
        features = null
    }
    mainWindow.webContents.send('features', features)
  } catch (error) {
    console.log('failed to fetch firmware info or binaries: ', error)
    mainWindow.webContents.send('error', 'ERROR FETCHING RELEASE DATA');
  }
  mainWindow.webContents.send('connecting', false)
});

electron.ipcMain.on('update-required', async (event, updateRequired) => {
  if (updateRequired.bootloader && !blupdaterBinary) await setTempBlupdater()
  if (updateRequired.firmware && !firmwareBinary) await setTempFirmware()
})

electron.ipcMain.on('wipe-keepkey', async (event, updateRequired) => {
  try {
    const options = {
      type: 'question',
      buttons: ['cancel', 'wipe device'],
      defaultId: 2,
      title: 'Question',
      message: 'To reset your device\'s pin, you must wipe and continue.',
      detail: 'This will WIPE your device!',
      checkboxLabel: 'I have my recovery phrase',
      checkboxChecked: true,
    };
    electron.dialog.showMessageBox(null, options, (response, checkboxChecked) => {
      if(response === 1 && checkboxChecked){
        wipeDevice()
      }
    });
  } catch(err) {
    console.error('failed to wipe device: ', err);
    mainWindow.webContents.send('update-status', 'FAILED');
  }
})

electron.ipcMain.on('update-firmware', async (event, arg) => {
  try {
    if(!firmwareBinary) await setTempFirmware()
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
    if(!blupdaterBinary) await setTempBlupdater()
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


electron.ipcMain.on('close-application', async (event, arg) => {
  try {
    const wallet = Object.values(keyring.wallets)[0]
    if (!!wallet) wallet.transport.disconnect()
    await keyring.removeAll()
    app.quit()
  } catch(err) {
    console.log('Error closing application: ', err)
  }
});

// =======================================================================================
// app creation

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 407,
    height: 525,
    title: '',
    resizable: isDev,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: false,
      webSecurity: true,
    },
  });
  if (!isDev) mainWindow.removeMenu();
  const bundledIndexPath = `file://${path.join(__dirname, '../build/index.html')}`;
  mainWindow.on('closed', () => mainWindow = null);
  await mainWindow.loadURL(isDev ? 'http://localhost:3000' : bundledIndexPath).catch(() => mainWindow.loadURL(bundledIndexPath));
}

app.on('ready', createWindow);

app.on('before-quit', () => {
  usbDetect.stopMonitoring();
  webUsbAdapter.clearDevices()
  const { ipcMain } = electron;
  ipcMain.removeAllListeners('app-start');
  ipcMain.removeAllListeners('update-firmware');
  ipcMain.removeAllListeners('update-bootloader');
  ipcMain.removeAllListeners('set-policy');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
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
