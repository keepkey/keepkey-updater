import React, { Component } from 'react';
import Initial from './Initial';
import BootloaderUpdating from './BootloaderUpdating';
import BootloaderUpdated from './BootloaderUpdated';
import FirmwareUpdating from './FirmwareUpdating';
import FirmwareUpdated from './FirmwareUpdated';

const { ipcRenderer } = window.require('electron');

export default class AxiomUpdate extends Component {
  constructor(props) {
    super(props);
    this.state = {
      updateState: 'initial',
      updateStatus: null,
      deviceIsInitialized: props.features && props.features.initialized,
    }
    this.transitionState = this.transitionState.bind(this);
    this.handleNewUpdateStatus = this.handleNewUpdateStatus.bind(this);
    this.setDeviceIsInitialized = this.setDeviceIsInitialized.bind(this);
  }

  handleNewUpdateStatus(event, message) {
    this.transitionState(message);
  }

  componentDidMount() {
    ipcRenderer.on('update-status', this.handleNewUpdateStatus);
  }

  componentWillUnmount() {
    ipcRenderer.removeListener('update-status', this.handleNewUpdateStatus);
  }

  transitionState(action) {
    const { updateState } = this.state;
    const nextState = updateMachine[updateState][action];
    if(nextState) {
      this.setState({ updateState: nextState });
    }
  }

  updateBootloader() {
    ipcRenderer.send('update-bootloader');
  }

  updateFirmware() {
    ipcRenderer.send('update-firmware');
  }

  setDeviceIsInitialized(deviceIsInitialized) {
    this.setState({ deviceIsInitialized })
  }

  renderUnknownError() {
    return(
      <div>
        <span>Something went wrong. Please unplug your KeepKey, restart KeepKey Updater, and try again.</span>
      </div>
    )
  }

  renderUpdateStage() {
    const { updateState, deviceIsInitialized } = this.state;
    const { features, start, cancel, updateTitleBar, latest } = this.props;
    const shared = {
      features,
      start,
      cancel,
      latest,
      updateTitleBar,
      deviceIsInitialized,
      transitionState: this.transitionState
    };
    switch(updateState) {
      case 'initial':
        const initialProps = { ...shared, setDeviceIsInitialized: this.setDeviceIsInitialized }
        return <Initial { ...initialProps } />;
      case 'updatingBootloader':
        return <BootloaderUpdating
          deviceIsInitialized={deviceIsInitialized}
          updateTitleBar={updateTitleBar}
          updateBootloader={this.updateBootloader} />;
      case 'bootloaderUpdated':
        return <BootloaderUpdated { ...shared } />;
      case 'updatingFirmware':
        return <FirmwareUpdating
          deviceIsInitialized={deviceIsInitialized}
          updateTitleBar={updateTitleBar}
          updateFirmware={this.updateFirmware} />
      case 'firmwareUpdated':
        return <FirmwareUpdated { ...shared } />;
      case 'updateComplete':
        cancel()
        return null
      case 'failure':
        return this.renderUnknownError();
      default:
        return this.renderUnknownError();
    }
  }

  render() {
    return(
      <div style={{ textAlign: 'center' }}>
        {this.renderUpdateStage()}
      </div>
    );
  }
};

const updateMachine = {
  initial: {
    UPDATE_BOOTLOADER: 'updatingBootloader',
    UPDATE_FIRMWARE: 'updatingFirmware',
  },
  updatingBootloader: {
    BOOTLOADER_UPDATE_SUCCESS: 'bootloaderUpdated',
    FAILED: 'failure',
  },
  bootloaderUpdated: {
    UPDATE_FIRMWARE: 'updatingFirmware'
  },
  updatingFirmware: {
    FIRMWARE_UPDATE_SUCCESS: 'firmwareUpdated',
    FAILED: 'failure',
  },
  firmwareUpdated: {
    UPDATE_COMPLETE: 'updateComplete', // skip to complete as we are not updating policies
  },
  failure: {
    RESTART: 'updatingBootloader',
  },
};


