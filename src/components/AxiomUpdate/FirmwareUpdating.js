import React, { Component, Fragment } from 'react';
import HoldAndRelease from '../../images/hold-and-release.svg';
import KeepKeyOutline from '../../images/keepkey-outline.svg';

export default class FirmwareUpdating extends Component {
  componentDidMount() {
    setTimeout(this.props.updateFirmware, 300) // allow time for render before halting the process
    this.props.updateTitleBar({ title: 'Firmware Update', progress: 50 })
  }

  render() {
    const { deviceIsInitialized } = this.props
    return(
      <Fragment>
        <h2 style={{ fontSize: '29px', fontWeight: 400, color: '#ffffff' }}>
          Confirm { deviceIsInitialized ? 'backup' : 'on device' }
        </h2>
        { deviceIsInitialized ?
          <p>
            Confirm that you have your recovery sentence by holding down the button
            on your KeepKey until the device displays a check mark.
          </p> :
          <Fragment>
            <p>
              Since this is a new device, ignore the statement on the KeepKey screen
              that says "Verify Backup". (You'll get a recovery sentence later.)
            </p>
            <p>
              Just hold down the button on your KeepKey until the device displays
              a check mark.
            </p>
          </Fragment>
        }
        <p style={warningStyles}>DO NOT UNPLUG</p>
        <img
          src={this.props.uploading ? KeepKeyOutline : HoldAndRelease}
          style={holdAndReleaseStyles}
          alt="hold button"
        />
      </Fragment>
      );
  }
};

const warningStyles = {
  fontWeight: '700',
  textAlign: 'center',
}

const holdAndReleaseStyles = {
  position: 'absolute',
  width: 345,
  bottom: -68,
  left: 'calc(50% - 163px)'
}

