import React, { Component, Fragment } from 'react';
import { Button } from 'semantic-ui-react'

const { ipcRenderer, shell } = window.require('electron');

export default class BootloaderMode extends Component {
  constructor(props) {
    super(props);
    this.state = {
      showUpdates: false
    }
  }

  update(type) {
    ipcRenderer.send(type);
  }

  navigateToHelp(e) {
    const url = 'https://shapeshift.zendesk.com/hc/en-us/categories/360001062760-Beta'
    shell.openExternal(url)
  }

  renderWarning() {
    return(
      <div style={{ textAlign: 'left' }}>
        <p>
          You probably got to this screen by accident. No problem -- it happens! Just unplug
          your KeepKey and plug it back in (without holding the button).
        </p>
        <div style={{ width: 100, height: 1, margin: '10px auto',  backgroundColor: 'rgb(135, 152, 173)' }} />
        <p>
          If you're following the instructions of a ShapeShift customer support agent, you're
          in the right place.
        </p>
        <p><a style={{ cursor: 'pointer' }} onClick={() => this.setState({ showUpdates: true })}>
          Click here if advised by customer support.
        </a></p>
        <p style={{ color: '#FFFFFF', marginTop: 60, textAlign: 'center' }}>
          Keep seeing this screen? <a style={{ cursor: 'pointer' }} onClick={this.navigateToHelp}>Get Help</a>
        </p>
      </div>
    )
  }

  renderOptions() {
    const { initiateUpdate, latest: { bootloader: { version }}, features: { bootloaderVersion }} = this.props;
    return(
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'space-around', height: 280 }}>
        <Button primary onClick={() => initiateUpdate('UPDATE_BOOTLOADER')}>Update Bootloader & Firmware</Button>
        { version === bootloaderVersion &&
          <Button primary onClick={() => initiateUpdate('UPDATE_FIRMWARE')}>Update Firmware</Button> }
          <p>
            Not sure how you got to this screen?
            <br />
            Unplug your KeepKey and plug it back in.
          </p>
          <p style={{ justifySelf: 'flex-end' }}>
            Confused? <a style={{ cursor: 'pointer' }} onClick={this.navigateToHelp}>Get Help</a>
          </p>
      </div>
    )
  }

  render() {
    return(
      <Fragment>
        <h1 style={{ color: '#FFFFFF', textAlign: 'center' }}>Update Mode</h1>
        { this.state.showUpdates ?
          this.renderOptions() :
          this.renderWarning()
        }
      </Fragment>
    )
  }
};

