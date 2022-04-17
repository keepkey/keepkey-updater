import React, { Fragment } from 'react';
import Updatable from './Updatable';
import { Button } from 'semantic-ui-react'
import semverCmp from 'semver-compare'

const { shell, ipcRenderer } = window.require('electron');

const stripV = (version) => version.replace(/v/g, '')

const versionIsUpToDate = (current, target) => {
  current = current.replace(/^v/, "");
  target = target.replace(/^v/, "");
  try {
    return semverCmp(current, target) !== -1;
  } catch (e) {
    return false;
  }
};

export default ({ features, initiateUpdate, latest, connecting, updateTitleBar })  => {
  const { firmwareVersion, bootloaderVersion } = features;
  let latestFirmwareVersion, latestBootloaderVersion;
  if (latest) {
    latestFirmwareVersion = latest.firmware.version;
    latestBootloaderVersion = latest.bootloader.version;
  }
  const firmwareCurrent = versionIsUpToDate(firmwareVersion, latestFirmwareVersion);
  const bootloaderCurrent = versionIsUpToDate(bootloaderVersion, latestBootloaderVersion);
  const updateRequired = !(bootloaderCurrent && firmwareCurrent);

  if(updateRequired && !connecting) {
    const requiredUpdates = {
      bootloader: !bootloaderCurrent,
      firmware: !firmwareCurrent
    }
    ipcRenderer.send('update-required', requiredUpdates);
  }

  const goToShapeshift = (e) => {
    e.preventDefault();
    const url = 'https://app.shapeshift.com';
    shell.openExternal(url);
    ipcRenderer.send('close-application')
  }

  const forgotPin = (e) => {
    ipcRenderer.send('wipe-keepkey')
  }

  const handleUpdateClick = () => {
    const title = bootloaderCurrent ? 'Firmware Update' : 'Bootloader Update'
    updateTitleBar({ title })
    initiateUpdate(bootloaderCurrent ? 'UPDATE_FIRMWARE' : 'UPDATE_BOOTLOADER')
  }

  const deviceIsUpdated = bootloaderCurrent && firmwareCurrent
  if (deviceIsUpdated) updateTitleBar({ title: 'Firmware Updated', progress: 100 })

  return(
    <Fragment>
      { deviceIsUpdated ?
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h1 style={{ color: '#FFFFFF' }}>KeepKey Updated</h1>
          <span>Your KeepKey is updated and ready to use.</span>
        </div> :
        <h1 style={{ textAlign: 'center', color: '#FFFFFF' }}>Update Required</h1>
      }
      <div style={{
        margin: '30px auto'
      }}>
        <Updatable
          title="bootloader"
          current={bootloaderCurrent}
          version={stripV(bootloaderVersion)}
          handleUpdateClick={handleUpdateClick}
          showStatus={true}
        />
        <Updatable
          title="firmware"
          current={firmwareCurrent}
          version={stripV(firmwareVersion)}
          handleUpdateClick={handleUpdateClick}
          showStatus={bootloaderCurrent}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
      { !updateRequired &&
          <Button primary onClick={goToShapeshift} style={{ fontWeight: 400, fontSize: '18px', marginBottom: '15px' }}>
            Head over to ShapeShift!
          </Button>
      }
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Button warn onClick={forgotPin} style={{ fontWeight: 200, fontSize: '9px' }}>
          Forgot Pin?
        </Button>
      </div>
    </Fragment>
  );
}

