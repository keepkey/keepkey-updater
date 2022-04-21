import React, { Component, Fragment } from 'react';
import Updatable from '../Updatable';
import KeepKeyStatic from '../../images/keepkey-static.svg';

const stripV = (version) => version.replace(/v/g, '')

export default class BootloaderUpdated extends Component {
  constructor(props) {
    super(props)
    this.state = { readyForFirmwareUpdate: false }
  }

  componentDidUpdate(prevProps) {
    const { features, firmwareData } = this.props;
    if(!features) return null
    const reconnectInBootloaderMode = !prevProps.features
      && features.bootloaderMode
      && firmwareData?.latest?.bootloader?.version === features?.bootloaderVersion
    if(reconnectInBootloaderMode && !this.state.readyForFirmwareUpdate) {
      this.setState({ readyForFirmwareUpdate: true })
      this.props.updateTitleBar({ title: 'Bootloader Updated', progress: 100 })
    }
    if (this.state.readyForFirmwareUpdate) {
      this.props.updateTitleBar({ progress: 50 })
    }
  }

  initiateFirmwareUpdate() {
    this.props.transitionState('UPDATE_FIRMWARE')
  }

  render() {
    if (this.state.readyForFirmwareUpdate) {
      const { bootloaderVersion } = this.props.features ?? {}
      return(
        <div>
          <h1>Bootloader Updated</h1>
          <p>Now you just need to update the firmware.</p>
          <div>
            <Updatable
              title="bootloader"
              current={true}
              version={stripV(bootloaderVersion)}
              showStatus={true}
            />
            <Updatable
              title="firmware"
              current={false}
              version={'--'}
              showStatus={true}
              handleUpdateClick={() => this.initiateFirmwareUpdate()}
            />
          </div>
        </div>
      )
    }
    return(
      <Fragment>
        <h2 style={{ fontSize: '29px', fontWeight: 400, color: '#ffffff' }}>Updating Bootloader</h2>
        <p style={{ margin: '1.5em 0' }}>If the update process does not start automatically within the next few seconds, unplug your KeepKey and plug it back in.</p>
        <img style={ConnectKeepKeyStyles} src={KeepKeyStatic} alt="device outline" />
      </Fragment>
    );
  }
}

const ConnectKeepKeyStyles = {
  position: 'absolute',
  width: 292,
  bottom: -25,
  left: 'calc(50% - 155px)'
};
