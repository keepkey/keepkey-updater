const electron = require('electron');
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const path = require('path');
const url = require('url');
const isDev = require('electron-is-dev');
const usbDetect = require('usb-detection');
const { NodeWebUSBKeepKeyAdapter } = require('@shapeshiftoss/hdwallet-keepkey-nodewebusb')
const { HIDKeepKeyAdapter } = require('@shapeshiftoss/hdwallet-keepkey-nodehid')
const { Keyring } = require('@shapeshiftoss/hdwallet-core')
const request = require('request')

const FIRMWARE_BASE_URL = "https://static.shapeshift.com/firmware/"

let mainWindow;

usbDetect.startMonitoring();

// =======================================================================================
// talking to KeepKey

const keyring = new Keyring
let webUsbAdapter, hidAdapter

const bootloaderHashToVersion = {
  '6397c446f6b9002a8b150bf4b9b4e0bb66800ed099b881ca49700139b0559f10': 'v1.0.0',
  'f13ce228c0bb2bdbc56bdcb5f4569367f8e3011074ccc63331348deb498f2d8f': 'v1.0.0',
  'd544b5e06b0c355d68b868ac7580e9bab2d224a1e2440881cc1bca2b816752d5': 'v1.0.1',
  'ec618836f86423dbd3114c37d6e3e4ffdfb87d9e4c6199cf3e163a67b27498a2': 'v1.0.1',
  'cd702b91028a2cfa55af43d3407ba0f6f752a4a2be0583a172983b303ab1032e': 'v1.0.2',
  'bcafb38cd0fbd6e2bdbea89fb90235559fdda360765b74e4a8758b4eff2d4921': 'v1.0.2',
  'cb222548a39ff6cbe2ae2f02c8d431c9ae0df850f814444911f521b95ab02f4c': 'v1.0.3',
  '917d1952260c9b89f3a96bea07eea4074afdcc0e8cdd5d064e36868bdd68ba7d': 'v1.0.3',
  '6465bc505586700a8111c4bf7db6f40af73e720f9e488d20db56135e5a690c4f': 'v1.0.3',
  'db4bc389335e876e942ae3b12558cecd202b745903e79b34dd2c32532708860e': 'v1.0.3',
  '2e38950143cf350345a6ddada4c0c4f21eb2ed337309f39c5dbc70b6c091ae00': 'v1.0.3',
  '83d14cb6c7c48af2a83bc326353ee6b9abdd74cfe47ba567de1cb564da65e8e9': 'v1.0.3',
  '770b30aaa0be884ee8621859f5d055437f894a5c9c7ca22635e7024e059857b7': 'v1.0.4',
  'fc4e5c4dc2e5127b6814a3f69424c936f1dc241d1daf2c5a2d8f0728eb69d20d': 'v1.0.4',
  'e45f587fb07533d832548402d0e71d8e8234881da54d86c4b699c28a6482b0ee': 'v1.1.0',
  '9bf1580d1b21250f922b68794cdadd6c8e166ae5b15ce160a42f8c44a2f05936': 'v2.0.0',
}

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

const normalizeWebUsbFeatures = (features) => {
  if (!features) return null
  const { majorVersion, minorVersion, patchVersion, bootloaderHash } = features
  const decodedHash = base64toHEX(bootloaderHash)
  return {
    ...features,
    firmwareVersion: `v${majorVersion}.${minorVersion}.${patchVersion}`,
    bootloaderVersion: bootloaderHashToVersion[decodedHash]
  }
}

const normalizeHidFeatures = (features) => {
  if (!features) return null
  const { bootloaderHash, bootloaderMode } = features
  const decodedHash = base64toHEX(bootloaderHash)
  const normedFeatures = {
    ...features,
    bootloaderVersion: bootloaderHashToVersion[decodedHash]
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

let latestFirmwareData, firmwareBinary, blupdaterBinary

const getLatestFirmwareData = async () => {
  return new Promise((resolve, reject) => {
    request(`${FIRMWARE_BASE_URL}releases.json`, (err, response, body) => {
      if(err) return reject(err)
      resolve(JSON.parse(body).latest)
    })
  })
}

const setTempFirmware = async () => {
  if(!latestFirmwareData) return
  const path = latestFirmwareData.firmware.url
  try {
    firmwareBinary = await getBinary(path)
  } catch (err) {
    console.log({ err })
    mainWindow.webContents.send('error', 'ERROR FETCHING FIRMWARE');
  }
}

const setTempBlupdater = async () => {
  if(!latestFirmwareData) return
  const path = latestFirmwareData.bootloader.url
  try {
    blupdaterBinary = await getBinary(path)
  } catch (err) {
    console.log({ err })
    mainWindow.webContents.send('error', 'ERROR FETCHING BOOTLOADER');
  }
}

const getBinary = async (path) => {
  return new Promise((resolve, reject) => {
    request({
      url: FIRMWARE_BASE_URL + path,
      headers: {
        accept: 'application/octet-stream',
      },
      encoding: null
    }, (err, response, body) => {
      if(err) return reject(err)
      if(response.statusCode !== 200) return reject('Unable to fetch latest firmware')
      const firmwareIsValid = !!body
        && body.slice(0x0000, 0x0004).toString() === 'KPKY' // check for 'magic' bytes
        && body.slice(0x0004, 0x0008).readUInt32LE() === body.length - 256 // check firmware length - metadata
        && body.slice(0x000B, 0x000C).readUInt8() & 0x01 // check that flag is not set to wipe device
      if(!firmwareIsValid) return reject('Fetched data is not valid firmware')
      resolve(body)
    })
  })
}

// =======================================================================================
// usb dis/connect listeners

usbDetect.on('add:11044:1', async function(device) {
  mainWindow.webContents.send('connecting', true)
  const wallet = await createHidWallet()
  const features = wallet ? wallet.features : null
  mainWindow.webContents.send('features', normalizeHidFeatures(features))
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
  mainWindow.webContents.send('features', normalizeWebUsbFeatures(features))
});

usbDetect.on('remove:11044:2', async function(device) {
  const wallet = Object.values(keyring.wallets)[0]
  if (!!wallet) wallet.transport.disconnect()
  await keyring.removeAll()
  webUsbAdapter.clearDevices()
  mainWindow.webContents.send('features', null)
  mainWindow.webContents.send('connecting', false)
});

// =======================================================================================
// callbacks for messages from render process

electron.ipcMain.on('app-start', async (event, arg) => {
  try {
    latestFirmwareData = await getLatestFirmwareData();
    mainWindow.webContents.send('latest', latestFirmwareData);
    let connectedDeviceProductId
    await usbDetect.find(0x2b24, function(err, foundDevices) { connectedDeviceProductId = foundDevices.length ? foundDevices[0].productId : null })
    let features, wallet
    switch (connectedDeviceProductId) {
      case 1:
        wallet = await createHidWallet()
        features = wallet ? normalizeHidFeatures(wallet.features) : null
        break
      case 2:
        wallet = await createWebUsbWallet()
        features = wallet ? normalizeWebUsbFeatures(wallet.features) : null
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
      mainWindow.webContents.send('update-status', 'FIRMWARE_UPDATE_SUCCESS');
      // mainWindow.webContents.send('update-status', 'FAILED');
    }
  } catch(err) {
    console.log('failed to upload binary to device: ', err);
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
      // mainWindow.webContents.send('update-status', 'FAILED');
      mainWindow.webContents.send('update-status', 'BOOTLOADER_UPDATE_SUCCESS');
    }
  } catch(err) {
    mainWindow.webContents.send('update-status', 'FAILED');
  }
});


electron.ipcMain.on('close-application', async (event, arg) => {
  try {
    const wallet = Object.values(keyring.wallets)[0]
    if (!!wallet) wallet.transport.disconnect()
    await keyring.removeAll()
    webUsbAdapter.clearDevices()
    app.quit()
  } catch(err) {
    console.log('Error closing application: ', err)
  }
});

// =======================================================================================
// app creation

async function createWindow() {
  mainWindow = new BrowserWindow({ width: 407, height: 525, title: '', resizable: isDev });
  mainWindow.loadURL(isDev ? 'http://localhost:3000' : `file://${path.join(__dirname, '../build/index.html')}`);
  mainWindow.on('closed', () => mainWindow = null);
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
