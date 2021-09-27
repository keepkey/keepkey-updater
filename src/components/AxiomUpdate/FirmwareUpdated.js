import React, { Component, Fragment } from 'react';
import ConnectKeepKey from '../../images/connect-keepkey.svg'

export default class FirmwareUpdated extends Component {
  componentDidMount() {
    this.props.updateTitleBar({ progress: 85 })
  }

  componentDidUpdate() {
    const { features, transitionState } = this.props;
    if(!features) { return null; }
    if(!features.bootloaderMode) {
      transitionState('UPDATE_COMPLETE');
    }
  }

  render() {
    return(
      <Fragment>
        <h2 style={{ fontSize: '29px', fontWeight: 400, color: '#ffffff' }}>Almost done</h2>
        <span>Unplug the KeepKey and plug it back in.</span>
        <img style={ConnectKeepKeyStyles} src={ConnectKeepKey} alt="device outline" />
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
